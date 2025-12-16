import { getRedisClient } from "./redis.js";
import type { Redis } from "ioredis";

// Types
export interface Member {
  id: string;
  name: string;
  vote: number | string | null;
  lastActivity: number;
}

export interface Room {
  code: string;
  members: Map<string, Member>;
  showResults: boolean;
  createdAt: number;
}

export interface RoomState {
  code: string;
  members: Array<{
    id: string;
    name: string;
    vote: number | string | null;
  }>;
  showResults: boolean;
}

export interface GlobalStats {
  cumulative: {
    rooms: number;
    participants: number;
    votes: number;
  };
  active: {
    rooms: number;
    participants: number;
    votes: number;
  };
}

// Constants
const ROOM_TTL = 2 * 60 * 60; // 2 hours in seconds
const ROOM_KEY_PREFIX = "room:";
const EMPTY_ROOM_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes - grace period before deleting empty rooms

// Serialize room to JSON (convert Map to array)
function serializeRoom(room: Room): string {
  return JSON.stringify({
    code: room.code,
    members: Array.from(room.members.entries()),
    showResults: room.showResults,
    createdAt: room.createdAt,
  });
}

// Deserialize room from JSON (convert array back to Map)
function deserializeRoom(data: string): Room {
  const parsed = JSON.parse(data);
  return {
    code: parsed.code,
    members: new Map(parsed.members),
    showResults: parsed.showResults,
    createdAt: parsed.createdAt,
  };
}

export class RoomStorage {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  private getRoomKey(code: string): string {
    return `${ROOM_KEY_PREFIX}${code}`;
  }

  async createRoom(code: string): Promise<Room> {
    const room: Room = {
      code,
      members: new Map(),
      showResults: false,
      createdAt: Date.now(),
    };

    await this.redis.setex(
      this.getRoomKey(code),
      ROOM_TTL,
      serializeRoom(room),
    );

    console.log(
      `[ROOM_CREATED] Room ${code} created with TTL ${ROOM_TTL}s (${ROOM_TTL / 3600}h)`,
    );

    // Increment cumulative rooms counter
    await this.incrementStat("rooms");

    return room;
  }

  async getRoom(code: string): Promise<Room | null> {
    const data = await this.redis.get(this.getRoomKey(code));
    if (!data) {
      console.log(
        `[ROOM_NOT_FOUND] Room ${code} not found in Redis - may have expired or been deleted`,
      );
      return null;
    }
    return deserializeRoom(data);
  }

  async updateRoom(room: Room): Promise<void> {
    const key = this.getRoomKey(room.code);
    const ttl = await this.redis.ttl(key);

    // Keep existing TTL or use default
    const expiryTime = ttl > 0 ? ttl : ROOM_TTL;

    // Log warning if TTL is getting low (less than 1 hour)
    if (ttl > 0 && ttl < 3600) {
      console.log(
        `[ROOM_TTL_WARNING] Room ${room.code}: TTL is low (${ttl}s / ${Math.round(ttl / 60)}min)`,
        {
          roomCode: room.code,
          ttl,
          roomAge: Math.round((Date.now() - room.createdAt) / 1000),
          memberCount: room.members.size,
        },
      );
    }

    await this.redis.setex(key, expiryTime, serializeRoom(room));
  }

  async deleteRoom(code: string): Promise<void> {
    await this.redis.del(this.getRoomKey(code));
  }

  async roomExists(code: string): Promise<boolean> {
    const exists = await this.redis.exists(this.getRoomKey(code));
    return exists === 1;
  }

  // Cleanup inactive members across all rooms
  async cleanupInactiveMembers(inactivityTimeout: number): Promise<void> {
    const now = Date.now();
    const pattern = `${ROOM_KEY_PREFIX}*`;

    // Get all room keys
    const keys = await this.redis.keys(pattern);

    console.log(
      `[CLEANUP_START] Starting cleanup cycle: ${keys.length} active room(s)`,
    );

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;

      const room = deserializeRoom(data);
      let modified = false;
      const inactiveMembersRemoved: Array<{
        id: string;
        name: string;
        inactiveDuration: number;
      }> = [];

      // Remove inactive members
      for (const [memberId, member] of room.members) {
        const inactiveDuration = now - member.lastActivity;
        if (inactiveDuration > inactivityTimeout) {
          inactiveMembersRemoved.push({
            id: memberId,
            name: member.name,
            inactiveDuration: Math.round(inactiveDuration / 1000), // Convert to seconds
          });
          room.members.delete(memberId);
          modified = true;
        }
      }

      // Log inactive member removals
      if (inactiveMembersRemoved.length > 0) {
        console.log(
          `[CLEANUP_INACTIVE_MEMBERS] Room ${room.code}: Removed ${inactiveMembersRemoved.length} inactive member(s)`,
          {
            roomCode: room.code,
            roomAge: Math.round((now - room.createdAt) / 1000),
            remainingMembers: room.members.size,
            removedMembers: inactiveMembersRemoved,
          },
        );
      }

      // Delete room if empty AND past grace period, otherwise update
      if (room.members.size === 0) {
        const roomAge = now - room.createdAt;
        // Only delete empty rooms that are older than the grace period
        // This prevents race condition where room is deleted before first member joins
        if (roomAge > EMPTY_ROOM_GRACE_PERIOD) {
          console.log(
            `[CLEANUP_EMPTY_ROOM] Room ${room.code}: Deleting empty room past grace period`,
            {
              roomCode: room.code,
              roomAge: Math.round(roomAge / 1000),
              gracePeriod: Math.round(EMPTY_ROOM_GRACE_PERIOD / 1000),
              hadInactiveMembers: inactiveMembersRemoved.length > 0,
            },
          );
          await this.redis.del(key);
        } else if (modified) {
          // Room is empty but within grace period - update to persist member removals
          console.log(
            `[CLEANUP_EMPTY_ROOM_GRACE] Room ${room.code}: Empty but within grace period, preserving room`,
            {
              roomCode: room.code,
              roomAge: Math.round(roomAge / 1000),
              gracePeriod: Math.round(EMPTY_ROOM_GRACE_PERIOD / 1000),
            },
          );
          await this.updateRoom(room);
        }
      } else if (modified) {
        await this.updateRoom(room);
      }
    }
  }

  async incrementStat(statName: string): Promise<void> {
    try {
      const key = `stats:${statName}:total`;
      await this.redis.incr(key);
    } catch (error) {
      console.error(
        `[STATS_INCREMENT_ERROR] Failed to increment ${statName}:`,
        error,
      );
      // Non-blocking: don't throw, stats are non-critical
    }
  }

  async getStats(): Promise<GlobalStats> {
    try {
      // Get cumulative stats from Redis counters
      const [totalRooms, totalParticipants, totalVotes] = await Promise.all([
        this.redis.get("stats:rooms:total"),
        this.redis.get("stats:participants:total"),
        this.redis.get("stats:votes:total"),
      ]);

      // Calculate active stats by scanning all rooms
      const pattern = `${ROOM_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      let activeParticipants = 0;
      let activeVotes = 0;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;

        const room = deserializeRoom(data);
        activeParticipants += room.members.size;

        // Count non-null votes
        for (const member of room.members.values()) {
          if (member.vote !== null) {
            activeVotes++;
          }
        }
      }

      return {
        cumulative: {
          rooms: parseInt(totalRooms || "0", 10),
          participants: parseInt(totalParticipants || "0", 10),
          votes: parseInt(totalVotes || "0", 10),
        },
        active: {
          rooms: keys.length,
          participants: activeParticipants,
          votes: activeVotes,
        },
      };
    } catch (error) {
      console.error("[STATS_FETCH_ERROR] Failed to fetch stats:", error);
      // Return zeros on error
      return {
        cumulative: { rooms: 0, participants: 0, votes: 0 },
        active: { rooms: 0, participants: 0, votes: 0 },
      };
    }
  }
}
