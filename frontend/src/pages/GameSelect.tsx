import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI } from '../services/api'

type GameType = 'chess' | 'poker' | 'blackjack'

export default function GameSelect() {
  const navigate = useNavigate()
  const { isConnected, isRegistered, showToast } = useStore()
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null)
  const [showLobbyModal, setShowLobbyModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [lobbySettings, setLobbySettings] = useState({
    isPublic: true,
    password: '',
    timeControl: 300,
  })

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  const games = [
    {
      id: 'chess' as GameType,
      name: 'Chess',
      icon: '♟️',
      description: 'Classic strategy game with full move validation',
      modes: ['vs Bot', 'vs Friend', 'Local'],
    },
    {
      id: 'poker' as GameType,
      name: 'Poker',
      icon: '🃏',
      description: 'Texas Hold\'em with betting mechanics',
      modes: ['vs Bot', 'vs Friend', 'Local'],
    },
    {
      id: 'blackjack' as GameType,
      name: 'Blackjack',
      icon: '🎴',
      description: 'Beat the dealer to 21',
      modes: ['vs Bot', 'Local'],
    },
  ]

  const createLobby = async () => {
    if (!selectedGame || creating) return

    setCreating(true)

    try {
      // Convert game type to enum format
      const gameType = selectedGame.toUpperCase() as 'CHESS' | 'POKER' | 'BLACKJACK'

      // Create lobby on blockchain
      const result = await GameAPI.createLobby(
        gameType,
        'VS_FRIEND',
        lobbySettings.isPublic,
        lobbySettings.isPublic ? null : lobbySettings.password,
        lobbySettings.timeControl
      )

      if (result?.createLobby) {
        const lobbyId = result.createLobby
        const shareUrl = `${window.location.origin}/join/${lobbyId}`

        try {
          await navigator.clipboard.writeText(shareUrl)
          showToast('Lobby created! Link copied to clipboard.', 'success')
        } catch {
          showToast('Lobby created! Share this link: ' + shareUrl, 'info')
        }

        setShowLobbyModal(false)

        // Navigate to the game page to wait for opponent
        navigate(`/${selectedGame}/friend?lobby=${lobbyId}`)
      } else {
        showToast('Failed to create lobby', 'error')
      }
    } catch (error: any) {
      console.error('Failed to create lobby:', error)
      showToast(error.message || 'Failed to create lobby on blockchain', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Game</h1>
        <p className="text-gray-400">Select a game and game mode to start playing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {games.map((game) => (
          <div key={game.id} className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
            {/* Game Header */}
            <div className="p-6 text-center border-b border-surface-700">
              <div className="text-6xl mb-4">{game.icon}</div>
              <h2 className="text-2xl font-bold mb-2">{game.name}</h2>
              <p className="text-gray-400 text-sm">{game.description}</p>
            </div>

            {/* Game Modes */}
            <div className="p-4 space-y-3">
              {/* vs Bot */}
              <Link
                to={`/${game.id}/bot`}
                className="flex items-center justify-between p-4 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="font-medium">vs Bot</div>
                    <div className="text-xs text-gray-400">Play against AI</div>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </Link>

              {/* vs Friend */}
              {game.modes.includes('vs Friend') && (
                <button
                  onClick={() => {
                    setSelectedGame(game.id)
                    setShowLobbyModal(true)
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👥</span>
                    <div className="text-left">
                      <div className="font-medium">vs Friend</div>
                      <div className="text-xs text-gray-400">Create shareable link</div>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
              )}

              {/* Local */}
              <Link
                to={`/${game.id}/local`}
                className="flex items-center justify-between p-4 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="font-medium">Local</div>
                    <div className="text-xs text-gray-400">Same device</div>
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Lobby Creation Modal */}
      {showLobbyModal && (
        <div className="modal-backdrop" onClick={() => setShowLobbyModal(false)}>
          <div
            className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Create Game Lobby</h2>

            <div className="space-y-4">
              {/* Game Type */}
              <div className="flex items-center gap-3 p-3 bg-surface-700 rounded-lg">
                <span className="text-3xl">
                  {games.find((g) => g.id === selectedGame)?.icon}
                </span>
                <span className="font-medium">
                  {games.find((g) => g.id === selectedGame)?.name}
                </span>
              </div>

              {/* Time Control */}
              <div>
                <label className="block text-sm font-medium mb-2">Time Control</label>
                <select
                  value={lobbySettings.timeControl}
                  onChange={(e) => setLobbySettings({ ...lobbySettings, timeControl: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-lg bg-surface-700 border border-surface-600 focus:outline-none focus:border-primary-500"
                >
                  <option value={180}>3 minutes</option>
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                  <option value={900}>15 minutes</option>
                </select>
              </div>

              {/* Public/Private */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Public Lobby</span>
                <button
                  onClick={() => setLobbySettings({ ...lobbySettings, isPublic: !lobbySettings.isPublic })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    lobbySettings.isPublic ? 'bg-primary-600' : 'bg-surface-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      lobbySettings.isPublic ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Password (if private) */}
              {!lobbySettings.isPublic && (
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={lobbySettings.password}
                    onChange={(e) => setLobbySettings({ ...lobbySettings, password: e.target.value })}
                    placeholder="Enter lobby password"
                    className="w-full px-4 py-2 rounded-lg bg-surface-700 border border-surface-600 focus:outline-none focus:border-primary-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLobbyModal(false)}
                disabled={creating}
                className="flex-1 btn-game btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createLobby}
                disabled={creating || (!lobbySettings.isPublic && !lobbySettings.password)}
                className="flex-1 btn-game btn-primary disabled:opacity-50"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </span>
                ) : (
                  'Create & Copy Link'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
