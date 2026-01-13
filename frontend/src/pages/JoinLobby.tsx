import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI, LobbyManager } from '../services/api'

type GameType = 'CHESS' | 'POKER' | 'BLACKJACK'

interface LobbyInfo {
  lobbyId: string
  creator: string
  creatorName: string
  gameType: GameType
  gameMode: string
  isPublic: boolean
  status: string
  timeControl: number
  createdAt: number
  expiresAt: number
  players: string[]
  gameId?: string
}

export default function JoinLobby() {
  const { lobbyId } = useParams()
  const navigate = useNavigate()
  const { isConnected, isRegistered, userProfile, showToast, ethAddress } = useStore()

  const [lobby, setLobby] = useState<LobbyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lobbyId) {
      fetchLobbyInfo()
    }
  }, [lobbyId])

  const fetchLobbyInfo = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!lobbyId) {
        setError('Invalid lobby ID')
        return
      }

      const data = await GameAPI.getLobby(lobbyId)

      if (data?.lobby) {
        setLobby(data.lobby)
      } else {
        setError('Lobby not found')
      }
    } catch (err: any) {
      console.error('Failed to fetch lobby:', err)
      setError(err.message || 'Failed to fetch lobby information')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinLobby = async () => {
    if (!lobby || joining || !lobbyId) return

    setJoining(true)

    try {
      console.log('Joining lobby on chain:', lobbyId)
      const result = await GameAPI.joinLobby(lobbyId, lobby.isPublic ? null : password)

      console.log('Join lobby result:', result)

      showToast('Joining lobby...', 'info')

      // Poll for updated lobby state
      let attempts = 0
      const maxAttempts = 10
      let gameId = null

      while (attempts < maxAttempts && !gameId) {
        await new Promise(resolve => setTimeout(resolve, 1500))

        try {
          const updatedData = await GameAPI.getLobby(lobbyId)
          console.log('Updated lobby data:', updatedData)

          if (updatedData?.lobby?.gameId) {
            gameId = updatedData.lobby.gameId
            break
          }

          // Check if lobby status changed
          if (updatedData?.lobby?.status === 'STARTED' || updatedData?.lobby?.status === 'FULL') {
            // Game should be starting
            if (updatedData.lobby.gameId) {
              gameId = updatedData.lobby.gameId
              break
            }
          }
        } catch (pollError) {
          console.error('Error polling lobby:', pollError)
        }

        attempts++
      }

      if (gameId) {
        showToast('Joined lobby successfully!', 'success')
        const gameType = lobby.gameType.toLowerCase()
        navigate(`/${gameType}/friend?gameId=${gameId}`)
      } else {
        // Navigate to game page with lobby ID - game might start later
        showToast('Joined lobby! Waiting for game to start...', 'success')
        navigate(`/${lobby.gameType.toLowerCase()}/friend?lobby=${lobbyId}`)
      }
    } catch (err: any) {
      console.error('Failed to join lobby:', err)
      showToast(err.message || 'Failed to join lobby', 'error')
    } finally {
      setJoining(false)
    }
  }

  if (!isConnected || !isRegistered) {
    return <Navigate to={`/?redirect=/join/${lobbyId}`} replace />
  }

  const gameInfo: Record<string, { name: string; icon: string; description: string }> = {
    CHESS: { name: 'Chess', icon: '♟️', description: 'Classic strategy game' },
    POKER: { name: 'Poker', icon: '🃏', description: "Texas Hold'em" },
    BLACKJACK: { name: 'Blackjack', icon: '🎴', description: 'Beat the dealer' }
  }

  const formatTimeControl = (seconds: number) => {
    if (seconds >= 60) {
      return `${seconds / 60} minutes`
    }
    return `${seconds} seconds`
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WAITING':
        return { text: 'Waiting for players', color: 'bg-yellow-500/20 text-yellow-400' }
      case 'STARTED':
        return { text: 'Game in progress', color: 'bg-blue-500/20 text-blue-400' }
      case 'EXPIRED':
        return { text: 'Expired', color: 'bg-red-500/20 text-red-400' }
      case 'CANCELLED':
        return { text: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' }
      default:
        return { text: status, color: 'bg-gray-500/20 text-gray-400' }
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-700">
          <h1 className="text-2xl font-bold">Join Game Lobby</h1>
          <p className="text-gray-400 text-sm mt-1">You've been invited to play!</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading lobby from blockchain...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-xl font-bold text-red-400 mb-2">Lobby Not Found</h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => navigate('/play')}
                className="btn-game btn-primary"
              >
                Browse Games
              </button>
            </div>
          ) : lobby?.status === 'EXPIRED' ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-xl font-bold text-yellow-400 mb-2">Lobby Expired</h2>
              <p className="text-gray-400 mb-6">This lobby is no longer available</p>
              <button
                onClick={() => navigate('/play')}
                className="btn-game btn-primary"
              >
                Browse Games
              </button>
            </div>
          ) : lobby?.status === 'STARTED' ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-xl font-bold text-accent-400 mb-2">Game In Progress</h2>
              <p className="text-gray-400 mb-6">This game has already started</p>
              {lobby.gameId && (
                <button
                  onClick={() => navigate(`/${lobby.gameType.toLowerCase()}/friend?gameId=${lobby.gameId}`)}
                  className="btn-game btn-primary mb-3"
                >
                  Spectate Game
                </button>
              )}
              <button
                onClick={() => navigate('/play')}
                className="btn-game btn-secondary"
              >
                Browse Games
              </button>
            </div>
          ) : lobby ? (
            <>
              {/* Game Type Card */}
              <div className="bg-surface-700 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="text-6xl">{gameInfo[lobby.gameType]?.icon || '🎮'}</div>
                  <div>
                    <h2 className="text-2xl font-bold">{gameInfo[lobby.gameType]?.name || lobby.gameType}</h2>
                    <p className="text-gray-400">{gameInfo[lobby.gameType]?.description || 'Game'}</p>
                  </div>
                </div>
              </div>

              {/* Lobby Details */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
                  <span className="text-gray-400">Host</span>
                  <div className="text-right">
                    <div className="font-medium">{lobby.creatorName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{lobby.creator?.slice(0, 10)}...</div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
                  <span className="text-gray-400">Time Control</span>
                  <span className="font-medium">{formatTimeControl(lobby.timeControl || 300)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
                  <span className="text-gray-400">Lobby Type</span>
                  <span className={`px-2 py-1 rounded text-sm ${lobby.isPublic ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {lobby.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
                  <span className="text-gray-400">Status</span>
                  <span className={`px-2 py-1 rounded text-sm ${getStatusBadge(lobby.status).color}`}>
                    {getStatusBadge(lobby.status).text}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
                  <span className="text-gray-400">Players</span>
                  <span className="font-medium">{lobby.players?.length || 1} / 2</span>
                </div>
              </div>

              {/* Password Input (for private lobbies) */}
              {!lobby.isPublic && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Lobby Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter lobby password"
                    className="w-full px-4 py-3 rounded-lg bg-surface-700 border border-surface-600 focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}

              {/* Your Info */}
              <div className="bg-primary-600/10 border border-primary-500/30 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-400 mb-1">Joining as</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-bold">
                    {userProfile?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium">{userProfile?.username}</div>
                    <div className="text-xs text-gray-500">
                      {ethAddress?.slice(0, 6)}...{ethAddress?.slice(-4)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/play')}
                  className="flex-1 btn-game btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinLobby}
                  disabled={joining || (!lobby.isPublic && !password) || lobby.status !== 'WAITING'}
                  className="flex-1 btn-game btn-primary disabled:opacity-50"
                >
                  {joining ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Joining...
                    </span>
                  ) : (
                    'Join Game'
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Game data is stored on the Linera blockchain</p>
        <p className="mt-1">Lobby ID: {lobbyId}</p>
      </div>
    </div>
  )
}
