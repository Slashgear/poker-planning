import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createRoom } from '../hooks/useRoom'

export default function Home() {
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateRoom = async () => {
    setIsCreating(true)
    setError(null)

    const result = await createRoom()

    if ('error' in result) {
      setError(result.error)
      setIsCreating(false)
      return
    }

    navigate({ to: '/room/$code', params: { code: result.code } })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Poker Planning
        </h1>
        <p className="text-lg text-purple-200 mb-8 max-w-md mx-auto">
          Collaborative estimation with the Fibonacci sequence. Create a room and invite your team.
        </p>

        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg"
        >
          {isCreating ? 'Creating...' : 'Create a Room'}
        </button>

        {error && (
          <p className="mt-4 text-red-400">{error}</p>
        )}

        <div className="mt-12 text-sm text-purple-300/70">
          <p>Rooms expire after 2 hours of inactivity</p>
        </div>
      </div>
    </div>
  )
}
