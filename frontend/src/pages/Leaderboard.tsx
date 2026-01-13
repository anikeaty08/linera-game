import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI } from '../services/api'

type GameFilter = 'all' | 'chess' | 'poker' | 'blackjack'
type TimeFilter = 'all' | 'week' | 'month'

interface LeaderboardEntry {
  rank: number
  username: string
  ethAddress: string
  wins: number
  losses: number
  winRate: number
  elo: number
  totalGames: number
}

export default function Leaderboard() {
  const { isConnected, isRegistered, userProfile, ethAddress, refreshProfile } = useStore()
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRank, setUserRank] = useState<number | null>(null)

  // Refresh profile on mount
  useEffect(() => {
    if (isConnected && isRegistered && ethAddress) {
      refreshProfile()
    }
  }, [isConnected, isRegistered, ethAddress, refreshProfile])

  // Fetch leaderboard from blockchain
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      setError(null)
      try {
        const gameType = gameFilter === 'all' ? null : gameFilter.toUpperCase()
        const data = await GameAPI.getLeaderboard(gameType, 50)
        if (data?.leaderboard) {
          setLeaderboard(data.leaderboard)
        } else {
          setLeaderboard([])
        }
      } catch (err: any) {
        console.error('Failed to fetch leaderboard:', err)
        setError('Failed to load leaderboard data')
        setLeaderboard([])
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [gameFilter])

  // Fetch user rank
  useEffect(() => {
    async function fetchUserRank() {
      if (!ethAddress) return
      try {
        const data = await GameAPI.getPlayerRank(ethAddress)
        setUserRank(data?.playerRank || null)
      } catch (err) {
        console.error('Failed to fetch user rank:', err)
      }
    }

    fetchUserRank()
  }, [ethAddress, gameFilter])

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  const getStatDisplay = (entry: LeaderboardEntry) => {
    switch (gameFilter) {
      case 'chess':
        return { label: 'ELO', value: entry.elo || 1200 }
      case 'poker':
        return { label: 'Win Rate', value: `${entry.winRate?.toFixed(1) || 0}%` }
      case 'blackjack':
        return { label: 'Wins', value: entry.wins || 0 }
      default:
        return { label: 'Win Rate', value: `${entry.winRate?.toFixed(1) || 0}%` }
    }
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '1st', color: 'text-yellow-400' }
    if (rank === 2) return { icon: '2nd', color: 'text-gray-300' }
    if (rank === 3) return { icon: '3rd', color: 'text-amber-600' }
    return { icon: `#${rank}`, color: 'text-gray-400' }
  }

  const formatAddress = (addr: string) => {
    if (!addr) return ''
    if (addr.length > 12) {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }
    return addr
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400">See how you rank against other players on ChainGames</p>
      </div>

      {/* User's Current Rank */}
      <div className="bg-gradient-to-r from-primary-600/20 to-accent-600/20 rounded-xl p-6 mb-8 border border-primary-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-2xl font-bold">
              {userProfile?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-xl font-bold">{userProfile?.username || 'Unknown'}</div>
              <div className="text-gray-400 text-sm">
                {formatAddress(ethAddress || '')}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Your Rank</div>
            <div className="text-3xl font-bold text-primary-400">
              {userRank ? `#${userRank}` : 'Unranked'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{userProfile?.totalGames || 0}</div>
            <div className="text-sm text-gray-400">Games</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {(userProfile?.chessWins || 0) + (userProfile?.pokerWins || 0) + (userProfile?.blackjackWins || 0)}
            </div>
            <div className="text-sm text-gray-400">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-400">{userProfile?.chessElo || 1200}</div>
            <div className="text-sm text-gray-400">Chess ELO</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {userProfile?.currentStreak && userProfile.currentStreak > 0 ? `+${userProfile.currentStreak}` : '0'}
            </div>
            <div className="text-sm text-gray-400">Streak</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Game Filter */}
        <div className="flex bg-surface-800 rounded-lg p-1">
          {(['all', 'chess', 'poker', 'blackjack'] as GameFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setGameFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                gameFilter === filter
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {filter === 'all' ? 'All Games' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Time Filter */}
        <div className="flex bg-surface-800 rounded-lg p-1">
          {(['all', 'week', 'month'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === filter
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {filter === 'all' ? 'All Time' : filter === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading leaderboard from blockchain...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-12 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-bold mb-2">No rankings yet</h3>
          <p className="text-gray-400 mb-6">Be the first to climb the leaderboard!</p>
          <Link
            to="/play"
            className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
          >
            Start Playing
          </Link>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-surface-700 text-sm font-medium text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2 text-center">Games</div>
            <div className="col-span-2 text-center">Wins</div>
            <div className="col-span-2 text-center">{leaderboard.length > 0 ? getStatDisplay(leaderboard[0]).label : 'Win Rate'}</div>
            <div className="col-span-1 text-center">ELO</div>
          </div>

          {/* Table Body */}
          {leaderboard.map((entry) => {
            const { icon, color } = getRankBadge(entry.rank)
            const stat = getStatDisplay(entry)
            const isCurrentUser = entry.ethAddress?.toLowerCase() === ethAddress?.toLowerCase()

            return (
              <div
                key={entry.rank}
                className={`grid grid-cols-12 gap-4 p-4 border-t border-surface-700 items-center ${
                  isCurrentUser ? 'bg-primary-600/10' : 'hover:bg-surface-700/50'
                }`}
              >
                <div className={`col-span-1 font-bold ${color}`}>{icon}</div>
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center font-bold">
                    {entry.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium">{entry.username || 'Anonymous'}</div>
                    <div className="text-xs text-gray-500">{formatAddress(entry.ethAddress)}</div>
                  </div>
                </div>
                <div className="col-span-2 text-center">{entry.totalGames || 0}</div>
                <div className="col-span-2 text-center text-green-400">{entry.wins || 0}</div>
                <div className="col-span-2 text-center font-medium">{stat.value}</div>
                <div className="col-span-1 text-center text-accent-400">{entry.elo || 1200}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Leaderboard data is fetched from the Linera blockchain</p>
        <p className="mt-1">
          <Link to="/play" className="text-primary-400 hover:underline">
            Play games to climb the ranks!
          </Link>
        </p>
      </div>
    </div>
  )
}
