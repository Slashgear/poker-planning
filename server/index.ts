import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { existsSync } from 'fs'
import { getCookie, setCookie } from 'hono/cookie'

// Types
interface Member {
  id: string
  name: string
  vote: number | string | null
  lastActivity: number
}

interface Room {
  code: string
  members: Map<string, Member>
  showResults: boolean
  createdAt: number
}

interface RoomState {
  code: string
  members: Array<{
    id: string
    name: string
    vote: number | string | null
  }>
  showResults: boolean
}

// Constants
const SESSION_DURATION = 2 * 60 * 60 * 1000 // 2 hours
const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

// State
const rooms = new Map<string, Room>()
const roomClients = new Map<string, Set<(data: RoomState) => void>>()

// Generate short room code (6 characters)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No confusing chars (0/O, 1/I/L)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  // Ensure uniqueness
  if (rooms.has(code)) {
    return generateRoomCode()
  }
  return code
}

// Generate session ID
function generateSessionId(): string {
  return crypto.randomUUID()
}

// Get room state for broadcasting
function getRoomState(room: Room): RoomState {
  return {
    code: room.code,
    members: Array.from(room.members.values()).map(m => ({
      id: m.id,
      name: m.name,
      vote: room.showResults ? m.vote : (m.vote !== null ? 'hidden' : null)
    })),
    showResults: room.showResults
  }
}

// Broadcast to all clients in a room
function broadcastToRoom(roomCode: string) {
  const room = rooms.get(roomCode)
  if (!room) return

  const clients = roomClients.get(roomCode)
  if (!clients) return

  const state = getRoomState(room)
  clients.forEach(sendUpdate => sendUpdate(state))
}

// Cleanup inactive members and empty rooms
function cleanup() {
  const now = Date.now()

  for (const [code, room] of rooms) {
    // Remove inactive members
    for (const [memberId, member] of room.members) {
      if (now - member.lastActivity > INACTIVITY_TIMEOUT) {
        room.members.delete(memberId)
      }
    }

    // Remove empty rooms
    if (room.members.size === 0) {
      rooms.delete(code)
      roomClients.delete(code)
    } else {
      broadcastToRoom(code)
    }
  }
}

// Start cleanup interval
setInterval(cleanup, CLEANUP_INTERVAL)

const app = new Hono()

// CORS
app.use('/*', cors({
  origin: (origin) => origin || '*',
  credentials: true
}))

// API Routes
const api = new Hono()

// Create a new room
api.post('/rooms', (c) => {
  const code = generateRoomCode()
  const room: Room = {
    code,
    members: new Map(),
    showResults: false,
    createdAt: Date.now()
  }
  rooms.set(code, room)
  roomClients.set(code, new Set())

  return c.json({ code })
})

// Join a room
api.post('/rooms/:code/join', async (c) => {
  const code = c.req.param('code').toUpperCase()
  const { name } = await c.req.json<{ name: string }>()

  const room = rooms.get(code)
  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  // Check if name is unique in room
  const nameExists = Array.from(room.members.values()).some(
    m => m.name.toLowerCase() === name.toLowerCase()
  )
  if (nameExists) {
    return c.json({ error: 'Name already taken in this room' }, 409)
  }

  // Create or get session
  let sessionId = getCookie(c, 'session_id')
  if (!sessionId) {
    sessionId = generateSessionId()
  }

  // Create member
  const member: Member = {
    id: sessionId,
    name,
    vote: null,
    lastActivity: Date.now()
  }

  room.members.set(sessionId, member)

  // Set cookie
  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,
    maxAge: SESSION_DURATION / 1000,
    sameSite: 'Lax',
    path: '/'
  })

  broadcastToRoom(code)

  return c.json({
    success: true,
    memberId: sessionId,
    name
  })
})

// Get room state (SSE)
api.get('/rooms/:code/events', (c) => {
  const code = c.req.param('code').toUpperCase()
  const room = rooms.get(code)

  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  // Update member activity if they have a session
  const sessionId = getCookie(c, 'session_id')
  if (sessionId) {
    const member = room.members.get(sessionId)
    if (member) {
      member.lastActivity = Date.now()
    }
  }

  return streamSSE(c, async (stream) => {
    const sendUpdate = (data: RoomState) => {
      stream.writeSSE({
        data: JSON.stringify(data),
        event: 'update'
      })
    }

    // Add client to room
    const clients = roomClients.get(code)
    if (clients) {
      clients.add(sendUpdate)
    }

    // Send current state
    await stream.writeSSE({
      data: JSON.stringify(getRoomState(room)),
      event: 'update'
    })

    // Cleanup on disconnect
    stream.onAbort(() => {
      const clients = roomClients.get(code)
      if (clients) {
        clients.delete(sendUpdate)
      }
    })

    // Keep alive
    while (true) {
      await stream.sleep(30000)
      await stream.writeSSE({
        data: 'ping',
        event: 'ping'
      })

      // Update activity
      if (sessionId) {
        const member = room.members.get(sessionId)
        if (member) {
          member.lastActivity = Date.now()
        }
      }
    }
  })
})

// Get room info
api.get('/rooms/:code', (c) => {
  const code = c.req.param('code').toUpperCase()
  const room = rooms.get(code)

  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  const sessionId = getCookie(c, 'session_id')
  const currentMember = sessionId ? room.members.get(sessionId) : null

  return c.json({
    code: room.code,
    memberCount: room.members.size,
    currentMember: currentMember ? {
      id: currentMember.id,
      name: currentMember.name
    } : null
  })
})

// Vote
api.post('/rooms/:code/vote', async (c) => {
  const code = c.req.param('code').toUpperCase()
  const { value } = await c.req.json<{ value: number | string | null }>()

  const room = rooms.get(code)
  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  const sessionId = getCookie(c, 'session_id')
  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  const member = room.members.get(sessionId)
  if (!member) {
    return c.json({ error: 'Not a member of this room' }, 403)
  }

  member.vote = value
  member.lastActivity = Date.now()

  broadcastToRoom(code)

  return c.json({ success: true })
})

// Reveal votes
api.post('/rooms/:code/reveal', (c) => {
  const code = c.req.param('code').toUpperCase()

  const room = rooms.get(code)
  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  const sessionId = getCookie(c, 'session_id')
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: 'Not a member of this room' }, 403)
  }

  room.showResults = true
  broadcastToRoom(code)

  return c.json({ success: true })
})

// Reset votes
api.post('/rooms/:code/reset', (c) => {
  const code = c.req.param('code').toUpperCase()

  const room = rooms.get(code)
  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  const sessionId = getCookie(c, 'session_id')
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: 'Not a member of this room' }, 403)
  }

  room.showResults = false
  for (const member of room.members.values()) {
    member.vote = null
  }

  broadcastToRoom(code)

  return c.json({ success: true })
})

// Remove a member from the room
api.delete('/rooms/:code/members/:memberId', (c) => {
  const code = c.req.param('code').toUpperCase()
  const memberId = c.req.param('memberId')

  const room = rooms.get(code)
  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }

  const sessionId = getCookie(c, 'session_id')
  if (!sessionId || !room.members.has(sessionId)) {
    return c.json({ error: 'Not a member of this room' }, 403)
  }

  if (!room.members.has(memberId)) {
    return c.json({ error: 'Member not found' }, 404)
  }

  room.members.delete(memberId)
  broadcastToRoom(code)

  return c.json({ success: true })
})

// Mount API
app.route('/api', api)

// Serve static files in production
const distPath = './dist'
if (existsSync(distPath)) {
  app.use('/*', serveStatic({ root: distPath }))
  app.get('*', serveStatic({ root: distPath, path: 'index.html' }))
  console.log('📦 Serving static files from dist/')
}

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
console.log(`🚀 Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
