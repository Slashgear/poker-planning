import { useState, useEffect, useCallback } from 'react'

interface Member {
  id: string
  name: string
  vote: number | string | null
}

interface RoomState {
  code: string
  members: Member[]
  showResults: boolean
}

interface RoomInfo {
  code: string
  memberCount: number
  currentMember: {
    id: string
    name: string
  } | null
}

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

export function useRoom(roomCode: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Fetch room info
  const fetchRoomInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rooms/${roomCode}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        if (response.status === 404) {
          setError('Room not found')
        } else {
          setError('Failed to fetch room info')
        }
        return null
      }
      const info = await response.json()
      setRoomInfo(info)
      setError(null)
      return info
    } catch {
      setError('Failed to connect to server')
      return null
    }
  }, [roomCode])

  // Join room
  const join = useCallback(async (name: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          return { success: false, error: 'Name already taken' }
        }
        return { success: false, error: data.error || 'Failed to join' }
      }

      const data = await response.json()
      await fetchRoomInfo()
      return { success: true, memberId: data.memberId, name: data.name }
    } catch {
      return { success: false, error: 'Failed to connect to server' }
    }
  }, [roomCode, fetchRoomInfo])

  // Vote
  const vote = useCallback(async (value: number | string | null) => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomCode}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value })
      })
    } catch {
      setError('Failed to vote')
    }
  }, [roomCode])

  // Reveal
  const reveal = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomCode}/reveal`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      setError('Failed to reveal')
    }
  }, [roomCode])

  // Reset
  const reset = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomCode}/reset`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      setError('Failed to reset')
    }
  }, [roomCode])

  // Remove member
  const removeMember = useCallback(async (memberId: string) => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomCode}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
    } catch {
      setError('Failed to remove member')
    }
  }, [roomCode])

  // SSE connection
  useEffect(() => {
    fetchRoomInfo()

    const eventSource = new EventSource(
      `${API_BASE}/api/rooms/${roomCode}/events`,
      { withCredentials: true }
    )

    eventSource.addEventListener('update', (event) => {
      const data = JSON.parse(event.data)
      setRoomState(data)
      setIsConnected(true)
    })

    eventSource.onerror = () => {
      setIsConnected(false)
    }

    return () => {
      eventSource.close()
    }
  }, [roomCode, fetchRoomInfo])

  return {
    roomState,
    roomInfo,
    error,
    isConnected,
    join,
    vote,
    reveal,
    reset,
    removeMember,
    refetchInfo: fetchRoomInfo
  }
}

export async function createRoom(): Promise<{ code: string } | { error: string }> {
  const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : ''

  try {
    const response = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      return { error: 'Failed to create room' }
    }

    return await response.json()
  } catch {
    return { error: 'Failed to connect to server' }
  }
}
