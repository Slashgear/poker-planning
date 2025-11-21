import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { existsSync } from "fs";
import { getCookie, setCookie } from "hono/cookie";
import { RoomStorage, type Room, type RoomState } from "./storage.js";
import {
  rateLimiter,
  bodySizeLimiter,
  securityHeaders,
  isValidVote,
  isValidName,
  isValidRoomCode,
} from "./security.js";

// Constants
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// State
const storage = new RoomStorage();
const roomClients = new Map<string, Set<(data: RoomState) => void>>();

// Generate short room code (6 characters)
async function generateRoomCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars (0/O, 1/I/L)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (await storage.roomExists(code)) {
    return generateRoomCode();
  }
  return code;
}

// Generate session ID
function generateSessionId(): string {
  return crypto.randomUUID();
}

// Get room state for broadcasting
function getRoomState(room: Room): RoomState {
  return {
    code: room.code,
    members: Array.from(room.members.values()).map((m) => ({
      id: m.id,
      name: m.name,
      vote: room.showResults ? m.vote : m.vote !== null ? "hidden" : null,
    })),
    showResults: room.showResults,
  };
}

// Broadcast to all clients in a room
async function broadcastToRoom(roomCode: string) {
  const room = await storage.getRoom(roomCode);
  if (!room) return;

  const clients = roomClients.get(roomCode);
  if (!clients) return;

  const state = getRoomState(room);
  clients.forEach((sendUpdate) => sendUpdate(state));
}

// Cleanup inactive members and empty rooms
async function cleanup() {
  await storage.cleanupInactiveMembers(INACTIVITY_TIMEOUT);
}

// Start cleanup interval
setInterval(cleanup, CLEANUP_INTERVAL);

const app = new Hono();

// HTTP logger
app.use("*", logger());

// Security headers
app.use("/*", securityHeaders);

// CORS
app.use(
  "/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  }),
);

// API Routes
const api = new Hono();

// Health check endpoint (no rate limiting)
api.get("/health", async (c) => {
  try {
    // Check Redis connection
    const redis = (storage as any).redis;
    await redis.ping();

    return c.json({ status: "ok", redis: "connected" });
  } catch (error) {
    return c.json(
      {
        status: "error",
        redis: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      503,
    );
  }
});

// Rate limiting for API routes
api.use("/*", rateLimiter);

// Body size limiting for POST/PUT/PATCH
api.use("/*", async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    return bodySizeLimiter(c, next);
  }
  await next();
});

// Create a new room
api.post("/rooms", async (c) => {
  const code = await generateRoomCode();
  await storage.createRoom(code);
  roomClients.set(code, new Set());

  return c.json({ code });
});

// Join a room
api.post("/rooms/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const { name } = await c.req.json<{ name: string }>();

  // Validate room code
  if (!isValidRoomCode(code)) {
    return c.json({ error: "Invalid room code" }, 400);
  }

  // Validate name
  if (!isValidName(name)) {
    return c.json({ error: "Name must be between 1 and 50 characters" }, 400);
  }

  const room = await storage.getRoom(code);
  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  // Check if name is unique in room
  const nameExists = Array.from(room.members.values()).some(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  if (nameExists) {
    return c.json({ error: "Name already taken in this room" }, 409);
  }

  // Create or get session
  let sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    sessionId = generateSessionId();
  }

  // Create member
  const member = {
    id: sessionId,
    name,
    vote: null as number | string | null,
    lastActivity: Date.now(),
  };

  room.members.set(sessionId, member);
  await storage.updateRoom(room);

  // Set cookie
  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    maxAge: SESSION_DURATION / 1000,
    sameSite: "Lax",
    path: "/",
  });

  await broadcastToRoom(code);

  return c.json({
    success: true,
    memberId: sessionId,
    name,
  });
});

// Get room state (SSE)
api.get("/rooms/:code/events", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const room = await storage.getRoom(code);

  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  // Update member activity if they have a session
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    const member = room.members.get(sessionId);
    if (member) {
      member.lastActivity = Date.now();
      await storage.updateRoom(room);
    }
  }

  return streamSSE(c, async (stream) => {
    const sendUpdate = (data: RoomState) => {
      stream.writeSSE({
        data: JSON.stringify(data),
        event: "update",
      });
    };

    // Add client to room
    const clients = roomClients.get(code);
    if (clients) {
      clients.add(sendUpdate);
    }

    // Send current state
    await stream.writeSSE({
      data: JSON.stringify(getRoomState(room)),
      event: "update",
    });

    // Cleanup on disconnect
    stream.onAbort(() => {
      const clients = roomClients.get(code);
      if (clients) {
        clients.delete(sendUpdate);
      }
    });

    // Keep alive
    while (true) {
      await stream.sleep(30000);
      await stream.writeSSE({
        data: "ping",
        event: "ping",
      });

      // Update activity
      if (sessionId) {
        const latestRoom = await storage.getRoom(code);
        if (latestRoom) {
          const member = latestRoom.members.get(sessionId);
          if (member) {
            member.lastActivity = Date.now();
            await storage.updateRoom(latestRoom);
          }
        }
      }
    }
  });
});

// Get room info
api.get("/rooms/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const room = await storage.getRoom(code);

  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  const sessionId = getCookie(c, "session_id");
  const currentMember = sessionId ? room.members.get(sessionId) : null;

  return c.json({
    code: room.code,
    memberCount: room.members.size,
    currentMember: currentMember
      ? {
          id: currentMember.id,
          name: currentMember.name,
        }
      : null,
  });
});

// Vote
api.post("/rooms/:code/vote", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const { value } = await c.req.json<{ value: number | string | null }>();

  // Validate room code
  if (!isValidRoomCode(code)) {
    return c.json({ error: "Invalid room code" }, 400);
  }

  // Validate vote value
  if (!isValidVote(value)) {
    return c.json({ error: "Invalid vote value" }, 400);
  }

  const room = await storage.getRoom(code);
  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const member = room.members.get(sessionId);
  if (!member) {
    return c.json({ error: "Not a member of this room" }, 403);
  }

  member.vote = value;
  member.lastActivity = Date.now();

  await storage.updateRoom(room);
  await broadcastToRoom(code);

  return c.json({ success: true });
});

// Reveal votes
api.post("/rooms/:code/reveal", async (c) => {
  const code = c.req.param("code").toUpperCase();

  const room = await storage.getRoom(code);
  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: "Not a member of this room" }, 403);
  }

  room.showResults = true;
  await storage.updateRoom(room);
  await broadcastToRoom(code);

  return c.json({ success: true });
});

// Reset votes
api.post("/rooms/:code/reset", async (c) => {
  const code = c.req.param("code").toUpperCase();

  const room = await storage.getRoom(code);
  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: "Not a member of this room" }, 403);
  }

  room.showResults = false;
  for (const member of room.members.values()) {
    member.vote = null;
  }

  await storage.updateRoom(room);
  await broadcastToRoom(code);

  return c.json({ success: true });
});

// Remove a member from the room
api.delete("/rooms/:code/members/:memberId", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const memberId = c.req.param("memberId");

  const room = await storage.getRoom(code);
  if (!room) {
    return c.json({ error: "Room not found" }, 404);
  }

  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: "Not a member of this room" }, 403);
  }

  if (!room.members.has(memberId)) {
    return c.json({ error: "Member not found" }, 404);
  }

  room.members.delete(memberId);
  await storage.updateRoom(room);
  await broadcastToRoom(code);

  return c.json({ success: true });
});

// Mount API
app.route("/api", api);

// Serve static files in production
const distPath = "./dist";
if (existsSync(distPath)) {
  // Assets with hash in filename - cache for 1 year (immutable)
  app.use("/assets/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "public, max-age=31536000, immutable");
  });
  app.use("/assets/*", serveStatic({ root: distPath, precompressed: true }));

  // Other static files (favicon, etc) - cache for 1 day
  app.use("/*", async (c, next) => {
    await next();
    if (!c.req.path.startsWith("/api")) {
      c.header("Cache-Control", "public, max-age=86400");
    }
  });
  app.use("/*", serveStatic({ root: distPath, precompressed: true }));

  // SPA fallback - no cache for index.html
  app.get("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.get(
    "*",
    serveStatic({ root: distPath, path: "index.html", precompressed: true }),
  );
  console.log("📦 Serving static files from dist/");
}

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
console.log(`🚀 Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
