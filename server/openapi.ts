import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { RoomStorage, type RoomState } from "./storage.js";
import { isValidVote, isValidName, isValidRoomCode } from "./security.js";

// Constants
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

// Zod schemas
const RoomCodeSchema = z
  .string()
  .length(6)
  .regex(/^[A-Z0-9]{6}$/)
  .openapi({ example: "ABC123", description: "6-character room code" });

const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Room not found" }),
  })
  .openapi("Error");

const SuccessSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .openapi("Success");

const MemberInfoSchema = z
  .object({
    id: z.string().openapi({ example: "abc123def456" }),
    name: z.string().openapi({ example: "Alice" }),
  })
  .openapi("MemberInfo");

const RoomInfoSchema = z
  .object({
    code: z.string().openapi({ example: "ABC123" }),
    memberCount: z.number().int().openapi({ example: 5 }),
    currentMember: MemberInfoSchema.nullable().openapi({
      description: "Information about the current member (if authenticated)",
    }),
  })
  .openapi("RoomInfo");

const MemberSchema = z
  .object({
    id: z.string().openapi({ example: "abc123def456" }),
    name: z.string().openapi({ example: "Alice" }),
    vote: z
      .union([z.number().int(), z.enum(["?", "☕"]), z.null()])
      .openapi({ example: 5 }),
  })
  .openapi("Member");

// RoomState schema for SSE events (not used in OpenAPI routes since SSE isn't documented)
const _RoomStateSchema = z
  .object({
    code: z.string().openapi({ example: "ABC123" }),
    members: z.array(MemberSchema),
    showResults: z.boolean().openapi({ example: false }),
  })
  .openapi("RoomState");

const VoteValueSchema = z
  .union([
    z.enum(["1", "2", "3", "5", "8", "13", "21", "34", "55"]),
    z
      .number()
      .int()
      .refine((v) => [1, 2, 3, 5, 8, 13, 21, 34, 55].includes(v)),
    z.enum(["?", "☕"]),
    z.null(),
  ])
  .openapi({
    example: 5,
    description: "Fibonacci number, '?' for unsure, '☕' for break, or null",
  });

// Helper to create app with dependencies
export function createOpenAPIApp(
  storage: RoomStorage,
  roomClients: Map<string, Set<(data: RoomState) => void>>,
  generateRoomCode: () => Promise<string>,
  generateSessionId: () => string,
  getRoomState: (room: any) => RoomState,
  broadcastToRoom: (code: string) => Promise<void>,
) {
  const app = new OpenAPIHono();

  // Health check route
  const healthRoute = createRoute({
    method: "get",
    path: "/health",
    tags: ["health"],
    responses: {
      200: {
        description: "API is healthy",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().openapi({ example: "ok" }),
            }),
          },
        },
      },
    },
  });

  app.openapi(healthRoute, (c) => {
    return c.json({ status: "ok" });
  });

  // Create room route
  const createRoomRoute = createRoute({
    method: "post",
    path: "/rooms",
    tags: ["rooms"],
    summary: "Create a new room",
    description:
      "Creates a new poker planning room with a unique 6-character code",
    responses: {
      200: {
        description: "Room created successfully",
        content: {
          "application/json": {
            schema: z.object({
              code: RoomCodeSchema,
            }),
          },
        },
      },
    },
  });

  app.openapi(createRoomRoute, async (c) => {
    const code = await generateRoomCode();
    await storage.createRoom(code);
    roomClients.set(code, new Set());
    return c.json({ code });
  });

  // Get room info route
  const getRoomRoute = createRoute({
    method: "get",
    path: "/rooms/{code}",
    tags: ["rooms"],
    summary: "Get room information",
    description: "Retrieves basic information about a room",
    request: {
      params: z.object({
        code: RoomCodeSchema,
      }),
    },
    responses: {
      200: {
        description: "Room information retrieved successfully",
        content: {
          "application/json": {
            schema: RoomInfoSchema,
          },
        },
      },
      404: {
        description: "Room not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(getRoomRoute, async (c) => {
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

  // Join room route
  const joinRoomRoute = createRoute({
    method: "post",
    path: "/rooms/{code}/join",
    tags: ["rooms", "members"],
    summary: "Join a room",
    description:
      "Join an existing room with a unique name. Sets a session cookie for authentication.",
    request: {
      params: z.object({
        code: RoomCodeSchema,
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(1).max(50).openapi({
                example: "Alice",
                description: "Member name (unique within room)",
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Successfully joined the room",
        headers: z.object({
          "Set-Cookie": z.string().openapi({
            example:
              "session_id=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200",
          }),
        }),
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              memberId: z.string().openapi({ example: "abc123def456" }),
              name: z.string().openapi({ example: "Alice" }),
            }),
          },
        },
      },
      400: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Room not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      409: {
        description: "Name already taken",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(joinRoomRoute, async (c) => {
    const code = c.req.param("code").toUpperCase();
    const { name } = await c.req.json();

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

  // Vote route
  const voteRoute = createRoute({
    method: "post",
    path: "/rooms/{code}/vote",
    tags: ["voting"],
    summary: "Submit a vote",
    description: "Submit or update your vote for the current estimation",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        code: RoomCodeSchema,
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              value: VoteValueSchema,
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Vote submitted successfully",
        content: {
          "application/json": {
            schema: SuccessSchema,
          },
        },
      },
      400: {
        description: "Invalid vote value or room code",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Not authenticated",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      403: {
        description: "Not a member of this room",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Room not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(voteRoute, async (c) => {
    const code = c.req.param("code").toUpperCase();
    const { value } = await c.req.json();

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

  // Reveal votes route
  const revealRoute = createRoute({
    method: "post",
    path: "/rooms/{code}/reveal",
    tags: ["voting"],
    summary: "Reveal all votes",
    description: "Reveal all votes in the room. Any member can trigger this.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        code: RoomCodeSchema,
      }),
    },
    responses: {
      200: {
        description: "Votes revealed successfully",
        content: {
          "application/json": {
            schema: SuccessSchema,
          },
        },
      },
      403: {
        description: "Not a member of this room",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Room not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(revealRoute, async (c) => {
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

  // Reset votes route
  const resetRoute = createRoute({
    method: "post",
    path: "/rooms/{code}/reset",
    tags: ["voting"],
    summary: "Reset the voting session",
    description:
      "Reset the current voting session. Clears all votes and hides results.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        code: RoomCodeSchema,
      }),
    },
    responses: {
      200: {
        description: "Voting session reset successfully",
        content: {
          "application/json": {
            schema: SuccessSchema,
          },
        },
      },
      403: {
        description: "Not a member of this room",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Room not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(resetRoute, async (c) => {
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

  // Remove member route
  const removeMemberRoute = createRoute({
    method: "delete",
    path: "/rooms/{code}/members/{memberId}",
    tags: ["members"],
    summary: "Remove a member from the room",
    description: "Remove a member from the room. Any member can remove others.",
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        code: RoomCodeSchema,
        memberId: z.string().openapi({ example: "abc123def456" }),
      }),
    },
    responses: {
      200: {
        description: "Member removed successfully",
        content: {
          "application/json": {
            schema: SuccessSchema,
          },
        },
      },
      403: {
        description: "Not a member of this room",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Room or member not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  });

  app.openapi(removeMemberRoute, async (c) => {
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

  // SSE events route (not documented in OpenAPI as it's SSE)
  app.get("/rooms/:code/events", async (c) => {
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

  // OpenAPI documentation
  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Poker Planning API",
      version: "2.4.0",
      description: `
Collaborative poker planning web application for agile team estimation using the Fibonacci sequence.

## Features
- Dynamic rooms with shareable 6-character codes
- Real-time synchronization with Server-Sent Events
- Anonymous votes until collective reveal
- Session-based authentication with httpOnly cookies
- Automatic cleanup of inactive members (5 minutes)

## Authentication
Authentication is handled via httpOnly cookies (\`session_id\`). The cookie is automatically set when joining a room.
      `.trim(),
      contact: {
        name: "GitHub Repository",
        url: "https://github.com/Slashgear/poker-planning",
      },
      license: {
        name: "ISC",
        url: "https://opensource.org/licenses/ISC",
      },
    },
    servers: [
      {
        url: "https://poker.slashgear.dev/api",
        description: "Production server",
      },
      {
        url: "https://poker-staging.slashgear.dev/api",
        description: "Staging server",
      },
      {
        url: "http://localhost:3001/api",
        description: "Local development server",
      },
    ],
  });

  // Swagger UI
  app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

  return app;
}
