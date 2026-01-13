import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function Layout() {
  const { isConnected, ethAddress, userProfile, disconnectWallet, lineraPublicKey } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => location.pathname.startsWith(path)

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    // Could add a toast here for feedback
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-surface-800 border-b border-surface-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                ChainGames
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-surface-700'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/play"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive('/play') || isActive('/chess') || isActive('/poker') || isActive('/blackjack')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-surface-700'
                }`}
              >
                Play
              </Link>
              <Link
                to="/leaderboard"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive('/leaderboard')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-surface-700'
                }`}
              >
                Leaderboard
              </Link>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {isConnected && userProfile && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center text-sm font-bold">
                      {userProfile.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">{userProfile.username}</div>
                      <div className="text-xs text-gray-400">{truncateAddress(ethAddress!)}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Profile Dropdown */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      {/* Header */}
                      <div className="p-4 bg-gradient-to-r from-primary-600/20 to-accent-600/20 border-b border-surface-700">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center text-lg font-bold">
                            {userProfile.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{userProfile.username}</div>
                            <div className="text-xs text-gray-400">On-Chain Profile</div>
                          </div>
                        </div>
                      </div>

                      {/* Addresses */}
                      <div className="p-4 space-y-3">
                        {/* ETH Address */}
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">ETH Address</div>
                          <div className="flex items-center justify-between bg-surface-700/50 rounded-lg px-3 py-2">
                            <code className="text-sm text-primary-400 font-mono">
                              {truncateAddress(ethAddress!)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(ethAddress!, 'ETH Address')}
                              className="text-gray-400 hover:text-white transition-colors p-1"
                              title="Copy full address"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Linera Address */}
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Linera Address</div>
                          <div className="flex items-center justify-between bg-surface-700/50 rounded-lg px-3 py-2">
                            <code className="text-sm text-accent-400 font-mono">
                              {lineraPublicKey ? truncateAddress(lineraPublicKey) : 'Not generated'}
                            </code>
                            {lineraPublicKey && (
                              <button
                                onClick={() => copyToClipboard(lineraPublicKey, 'Linera Address')}
                                className="text-gray-400 hover:text-white transition-colors p-1"
                                title="Copy full address"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Stats Preview */}
                        <div className="pt-2 border-t border-surface-700">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Quick Stats</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-surface-700/50 rounded-lg p-2">
                              <div className="text-lg font-bold text-green-400">
                                {(userProfile.chessWins || 0) + (userProfile.pokerWins || 0) + (userProfile.blackjackWins || 0)}
                              </div>
                              <div className="text-xs text-gray-400">Wins</div>
                            </div>
                            <div className="bg-surface-700/50 rounded-lg p-2">
                              <div className="text-lg font-bold text-red-400">
                                {(userProfile.chessLosses || 0) + (userProfile.pokerLosses || 0) + (userProfile.blackjackLosses || 0)}
                              </div>
                              <div className="text-xs text-gray-400">Losses</div>
                            </div>
                            <div className="bg-surface-700/50 rounded-lg p-2">
                              <div className="text-lg font-bold text-primary-400">{userProfile.totalGames || 0}</div>
                              <div className="text-xs text-gray-400">Games</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-3 bg-surface-900/50 border-t border-surface-700 flex gap-2">
                        <Link
                          to="/profile"
                          onClick={() => setShowProfileDropdown(false)}
                          className="flex-1 text-center px-3 py-2 text-sm bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false)
                            disconnectWallet()
                            navigate('/')
                          }}
                          className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback disconnect button when no profile dropdown */}
              {(!isConnected || !userProfile) && (
                <button
                  onClick={() => {
                    disconnectWallet()
                    navigate('/')
                  }}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-surface-700">
          <div className="flex justify-around py-2">
            <Link
              to="/dashboard"
              className={`flex flex-col items-center px-3 py-1 ${
                isActive('/dashboard') ? 'text-primary-400' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">📊</span>
              <span className="text-xs">Dashboard</span>
            </Link>
            <Link
              to="/play"
              className={`flex flex-col items-center px-3 py-1 ${
                isActive('/play') ? 'text-primary-400' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">🎮</span>
              <span className="text-xs">Play</span>
            </Link>
            <Link
              to="/leaderboard"
              className={`flex flex-col items-center px-3 py-1 ${
                isActive('/leaderboard') ? 'text-primary-400' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">🏆</span>
              <span className="text-xs">Ranks</span>
            </Link>
            <Link
              to="/profile"
              className={`flex flex-col items-center px-3 py-1 ${
                isActive('/profile') ? 'text-primary-400' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">👤</span>
              <span className="text-xs">Profile</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface-800 border-t border-surface-700 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>Powered by Linera Blockchain • Fully Decentralized • No Backend Servers</p>
        </div>
      </footer>
    </div>
  )
}
