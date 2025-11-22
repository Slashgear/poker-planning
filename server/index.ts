import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { existsSync } from "fs";
import { RoomStorage, type Room, type RoomState } from "./storage.js";
import { securityHeaders } from "./security.js";
import { createOpenAPIApp } from "./openapi.js";

// Constants
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

// Create OpenAPI-enabled API routes
const api = createOpenAPIApp(
  storage,
  roomClients,
  generateRoomCode,
  generateSessionId,
  getRoomState,
  broadcastToRoom,
);

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
