import { getRedisClient } from './redis.js'
import type { Redis } from 'ioredis'

// Types
export interface Member {
  id: string
  name: string
  vote: number | string | null
  lastActivity: number
}

export interface Room {
  code: string
  members: Map<string, Member>
  showResults: boolean
  createdAt: number
}

export interface RoomState {
  code: string
  members: Array<{
    id: string
    name: string
    vote: number | string | null
  }>
  showResults: boolean
}

// Constants
const ROOM_TTL = 2 * 60 * 60 // 2 hours in seconds
const ROOM_KEY_PREFIX = 'room:'

// Serialize room to JSON (convert Map to array)
function serializeRoom(room: Room): string {
  return JSON.stringify({
    code: room.code,
    members: Array.from(room.members.entries()),
    showResults: room.showResults,
    createdAt: room.createdAt
  })
}

// Deserialize room from JSON (convert array back to Map)
function deserializeRoom(data: string): Room {
  const parsed = JSON.parse(data)
  return {
    code: parsed.code,
    members: new Map(parsed.members),
    showResults: parsed.showResults,
    createdAt: parsed.createdAt
  }
}

export class RoomStorage {
  private redis: Redis

  constructor() {
    this.redis = getRedisClient()
  }

  private getRoomKey(code: string): string {
    return `${ROOM_KEY_PREFIX}${code}`
  }

  async createRoom(code: string): Promise<Room> {
    const room: Room = {
      code,
      members: new Map(),
      showResults: false,
      createdAt: Date.now()
    }

    await this.redis.setex(
      this.getRoomKey(code),
      ROOM_TTL,
      serializeRoom(room)
    )

    return room
  }

  async getRoom(code: string): Promise<Room | null> {
    const data = await this.redis.get(this.getRoomKey(code))
    if (!data) return null
    return deserializeRoom(data)
  }

  async updateRoom(room: Room): Promise<void> {
    const key = this.getRoomKey(room.code)
    const ttl = await this.redis.ttl(key)

    // Keep existing TTL or use default
    const expiryTime = ttl > 0 ? ttl : ROOM_TTL

    await this.redis.setex(
      key,
      expiryTime,
      serializeRoom(room)
    )
  }

  async deleteRoom(code: string): Promise<void> {
    await this.redis.del(this.getRoomKey(code))
  }

  async roomExists(code: string): Promise<boolean> {
    const exists = await this.redis.exists(this.getRoomKey(code))
    return exists === 1
  }

  // Cleanup inactive members across all rooms
  async cleanupInactiveMembers(inactivityTimeout: number): Promise<void> {
    const now = Date.now()
    const pattern = `${ROOM_KEY_PREFIX}*`

    // Get all room keys
    const keys = await this.redis.keys(pattern)

    for (const key of keys) {
      const data = await this.redis.get(key)
      if (!data) continue

      const room = deserializeRoom(data)
      let modified = false

      // Remove inactive members
      for (const [memberId, member] of room.members) {
        if (now - member.lastActivity > inactivityTimeout) {
          room.members.delete(memberId)
          modified = true
        }
      }

      // Delete room if empty, otherwise update
      if (room.members.size === 0) {
        await this.redis.del(key)
      } else if (modified) {
        await this.updateRoom(room)
      }
    }
  }
}
