import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function Landing() {
  const navigate = useNavigate()
  const { isConnected, isRegistered, isLoading, ethAddress, connectWallet, disconnectWallet, registerUser } = useStore()
  const [showRegister, setShowRegister] = useState(false)
  const [username, setUsername] = useState('')

  // If already connected and registered, go to dashboard
  useEffect(() => {
    if (isConnected && isRegistered) {
      navigate('/dashboard')
    } else if (isConnected && !isRegistered) {
      setShowRegister(true)
    }
  }, [isConnected, isRegistered, navigate])

  const handleConnect = async () => {
    const success = await connectWallet()
    if (success) {
      const store = useStore.getState()
      if (store.isRegistered) {
        navigate('/dashboard')
      } else {
        setShowRegister(true)
      }
    }
  }

  const handleDisconnect = () => {
    disconnectWallet()
    setShowRegister(false)
    setUsername('')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (username.length < 3) {
      useStore.getState().showToast('Username must be at least 3 characters', 'error')
      return
    }
    const success = await registerUser(username)
    if (success) {
      // Wait a moment to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 500))
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-8 animate-pulse-glow inline-block rounded-full p-4 bg-surface-800">
            <span className="text-6xl sm:text-8xl">🎮</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold mb-6">
            <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400 bg-clip-text text-transparent">
              ChainGames
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-300 mb-4">
            Play Chess, Poker & Blackjack On-Chain
          </p>

          <p className="text-gray-400 mb-12 max-w-2xl mx-auto">
            Fully decentralized gaming platform. Provably fair. Your stats live forever on Linera blockchain.
            Zero backend servers - everything runs in your browser and on-chain.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <div className="bg-surface-800 rounded-xl p-6 border border-surface-700">
              <div className="text-3xl mb-3">⛓️</div>
              <h3 className="text-lg font-semibold mb-2">Blockchain-Powered</h3>
              <p className="text-sm text-gray-400">All game states stored on Linera blockchain. Verifiable and permanent.</p>
            </div>
            <div className="bg-surface-800 rounded-xl p-6 border border-surface-700">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-lg font-semibold mb-2">AI Opponents</h3>
              <p className="text-sm text-gray-400">Play vs intelligent AI powered by Gemini. Three difficulty levels.</p>
            </div>
            <div className="bg-surface-800 rounded-xl p-6 border border-surface-700">
              <div className="text-3xl mb-3">👥</div>
              <h3 className="text-lg font-semibold mb-2">Multiplayer</h3>
              <p className="text-sm text-gray-400">Challenge friends with shareable links. Real-time blockchain sync.</p>
            </div>
          </div>

          {/* CTA */}
          {!showRegister ? (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="wallet-btn text-lg px-8 py-4 rounded-xl"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="spinner w-5 h-5" />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 35 33">
                    <path
                      fill="currentColor"
                      d="M32.958 1l-13.134 9.718 2.442-5.727z M1.002 1l13.017 9.809-2.324-5.818zm27.237 22.253l-3.487 5.339 7.464 2.057 2.142-7.272zm-28.478.123l2.13 7.26 7.452-2.058-3.476-5.327z"
                    />
                    <path
                      fill="currentColor"
                      d="M13.463 14.814l-2.07 3.127 7.37.336-.262-7.927zm8.074 0l-5.1-4.555-.174 8.018 7.359-.336zm-10.576 10.06l4.426-2.159-3.822-2.983zm8.672-2.159l4.414 2.16-.594-5.143z"
                    />
                  </svg>
                  Connect MetaMask
                </span>
              )}
            </button>
          ) : (
            <div className="bg-surface-800 rounded-xl p-8 max-w-md mx-auto border border-surface-700">
              <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
              <p className="text-gray-400 mb-2">Choose your username to get started</p>
              {ethAddress && (
                <p className="text-sm text-primary-400 mb-4 font-mono">
                  Connected: {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
                </p>
              )}
              <form onSubmit={handleRegister}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (3-20 chars)"
                  minLength={3}
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-lg bg-surface-700 border border-surface-600 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 mb-4"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || username.length < 3}
                  className="w-full btn-game btn-primary mb-3"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Disconnect Wallet
                </button>
              </form>
            </div>
          )}

          {isConnected && isRegistered && (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-game btn-primary text-lg px-8 py-4"
            >
              Go to Dashboard →
            </button>
          )}
        </div>
      </div>

      {/* Games Preview */}
      <div className="bg-surface-800 border-t border-surface-700 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">Available Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="game-select-card text-center">
              <div className="text-6xl mb-4">♟️</div>
              <h3 className="text-xl font-bold mb-2">Chess</h3>
              <p className="text-gray-400 text-sm">Classic strategy game with full move validation, timers, and ELO rating</p>
            </div>
            <div className="game-select-card text-center">
              <div className="text-6xl mb-4">🃏</div>
              <h3 className="text-xl font-bold mb-2">Poker</h3>
              <p className="text-gray-400 text-sm">Texas Hold'em with betting, all-in mechanics, and hand evaluation</p>
            </div>
            <div className="game-select-card text-center">
              <div className="text-6xl mb-4">🎴</div>
              <h3 className="text-xl font-bold mb-2">Blackjack</h3>
              <p className="text-gray-400 text-sm">Beat the dealer with hit, stand, double down, and split options</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-surface-900 py-8 border-t border-surface-700">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400 mb-4">
            Powered by Linera Blockchain • MetaMask for Identity • Zero Backend Servers
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <span>100% Decentralized</span>
            <span>•</span>
            <span>Provably Fair</span>
            <span>•</span>
            <span>Open Source</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
