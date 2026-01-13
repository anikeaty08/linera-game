import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI } from '../services/api'

interface GameHistoryItem {
  gameId: string
  gameType: string
  gameMode: string
  status: string
  winner: string | null
  createdAt: number
  opponent?: string
  opponentName?: string
}

export default function Dashboard() {
  const { isConnected, isRegistered, userProfile, refreshProfile, ethAddress } = useStore()
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Refresh profile on mount and periodically
  useEffect(() => {
    if (isConnected && isRegistered && ethAddress) {
      // Initial refresh
      refreshProfile()

      // Fetch game history
      fetchGameHistory()

      // Set up periodic refresh (every 30 seconds)
      const interval = setInterval(() => {
        refreshProfile()
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [isConnected, isRegistered, ethAddress])

  const fetchGameHistory = async () => {
    if (!ethAddress) return

    setLoadingHistory(true)
    try {
      const data = await GameAPI.getPlayerGameHistory(ethAddress, 10)
      if (data?.playerGameHistory) {
        setGameHistory(data.playerGameHistory)
      }
    } catch (error) {
      console.error('Failed to fetch game history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  const stats = userProfile ? {
    totalWins: (userProfile.chessWins || 0) + (userProfile.pokerWins || 0) + (userProfile.blackjackWins || 0),
    winRate: userProfile.totalGames > 0
      ? Math.round(((userProfile.chessWins || 0) + (userProfile.pokerWins || 0) + (userProfile.blackjackWins || 0)) / userProfile.totalGames * 100)
      : 0,
    streak: userProfile.currentStreak || 0,
  } : { totalWins: 0, winRate: 0, streak: 0 }

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Unknown'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getGameIcon = (gameType: string) => {
    switch (gameType?.toUpperCase()) {
      case 'CHESS': return '♟️'
      case 'POKER': return '🃏'
      case 'BLACKJACK': return '🎴'
      default: return '🎮'
    }
  }

  const getResultBadge = (game: GameHistoryItem) => {
    if (game.status !== 'COMPLETED') {
      return { text: game.status, color: 'bg-yellow-500/20 text-yellow-400' }
    }
    if (!game.winner) {
      return { text: 'Draw', color: 'bg-gray-500/20 text-gray-400' }
    }
    const won = game.winner === ethAddress
    return won
      ? { text: 'Won', color: 'bg-green-500/20 text-green-400' }
      : { text: 'Lost', color: 'bg-red-500/20 text-red-400' }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, <span className="text-primary-400">{userProfile?.username}</span>!
        </h1>
        <p className="text-gray-400">Ready to play? Choose a game below or check your stats.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="text-3xl font-bold text-green-400">{stats.totalWins}</div>
          <div className="text-sm text-gray-400">Total Wins</div>
        </div>
        <div className="stat-card">
          <div className="text-3xl font-bold text-accent-400">{stats.winRate}%</div>
          <div className="text-sm text-gray-400">Win Rate</div>
        </div>
        <div className="stat-card">
          <div className="text-3xl font-bold text-yellow-400">
            {stats.streak > 0 ? `+${stats.streak}` : stats.streak}
          </div>
          <div className="text-sm text-gray-400">Current Streak</div>
        </div>
      </div>

      {/* Quick Play */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Play</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Chess */}
          <Link to="/chess/bot" className="game-select-card group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">♟️</span>
              <span className="text-xs px-2 py-1 bg-primary-600 rounded-full">vs Bot</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Chess</h3>
            <p className="text-sm text-gray-400 mb-4">Classic strategy game</p>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Wins: {userProfile?.chessWins || 0}</span>
              <span className="text-gray-400">ELO: {userProfile?.chessElo || 1200}</span>
            </div>
          </Link>

          {/* Poker */}
          <Link to="/poker/bot" className="game-select-card group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">🃏</span>
              <span className="text-xs px-2 py-1 bg-primary-600 rounded-full">vs Bot</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Poker</h3>
            <p className="text-sm text-gray-400 mb-4">Texas Hold'em</p>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Wins: {userProfile?.pokerWins || 0}</span>
              <span className="text-gray-400">Chips: {userProfile?.pokerChipsWon || 0}</span>
            </div>
          </Link>

          {/* Blackjack */}
          <Link to="/blackjack/bot" className="game-select-card group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">🎴</span>
              <span className="text-xs px-2 py-1 bg-primary-600 rounded-full">vs Dealer</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Blackjack</h3>
            <p className="text-sm text-gray-400 mb-4">Beat the dealer to 21</p>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Wins: {userProfile?.blackjackWins || 0}</span>
              <span className="text-gray-400">Chips: {userProfile?.blackjackChipsWon || 0}</span>
            </div>
          </Link>
        </div>
      </div>

      {/* More Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Play with Friend */}
        <div className="bg-surface-800 rounded-xl p-6 border border-surface-700">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>👥</span> Play with Friend
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Create a game lobby and share the link with a friend
          </p>
          <Link to="/play" className="btn-game btn-secondary inline-block">
            Create Lobby
          </Link>
        </div>

        {/* View Leaderboard */}
        <div className="bg-surface-800 rounded-xl p-6 border border-surface-700">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            See how you rank against other players
          </p>
          <Link to="/leaderboard" className="btn-game btn-secondary inline-block">
            View Rankings
          </Link>
        </div>
      </div>

      {/* Game History */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Games</h2>
          <button
            onClick={fetchGameHistory}
            className="text-sm text-primary-400 hover:text-primary-300"
            disabled={loadingHistory}
          >
            {loadingHistory ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
          {gameHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No games played yet. Start your first game above!</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-700">
              {gameHistory.map((game) => {
                const result = getResultBadge(game)
                return (
                  <div key={game.gameId} className="p-4 flex items-center justify-between hover:bg-surface-700/50">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getGameIcon(game.gameType)}</span>
                      <div>
                        <div className="font-medium">{game.gameType}</div>
                        <div className="text-sm text-gray-400">
                          {game.gameMode === 'VS_BOT' ? 'vs Bot' : game.opponentName || 'vs Player'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs ${result.color}`}>
                        {result.text}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTimeAgo(game.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
