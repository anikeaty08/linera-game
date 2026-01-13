import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function Profile() {
  const { isConnected, isRegistered, userProfile, ethAddress, lineraPublicKey, showToast, updateUsername } = useStore()
  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [showWalletDetails, setShowWalletDetails] = useState(false)

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  const handleSaveUsername = async () => {
    if (newUsername.trim().length < 3) {
      showToast('Username must be at least 3 characters', 'error')
      return
    }
    if (newUsername.trim().length > 20) {
      showToast('Username must be 20 characters or less', 'error')
      return
    }

    try {
      await updateUsername(newUsername.trim())
      showToast('Username updated successfully!', 'success')
      setIsEditing(false)
      setNewUsername('')
    } catch {
      showToast('Failed to update username', 'error')
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} copied to clipboard!`, 'success')
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  const totalWins = (userProfile?.chessWins || 0) + (userProfile?.pokerWins || 0) + (userProfile?.blackjackWins || 0)
  const winRate = userProfile?.totalGames ? Math.round((totalWins / userProfile.totalGames) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-surface-800 rounded-xl border border-surface-700 overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-primary-600 to-accent-600" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <div className="w-24 h-24 rounded-full bg-surface-700 border-4 border-surface-800 flex items-center justify-center text-4xl font-bold">
              {userProfile?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder={userProfile?.username}
                      className="px-3 py-1 rounded-lg bg-surface-700 border border-surface-600 focus:outline-none focus:border-primary-500"
                      maxLength={20}
                    />
                    <button onClick={handleSaveUsername} className="btn-game btn-primary text-sm py-1">
                      Save
                    </button>
                    <button onClick={() => setIsEditing(false)} className="btn-game btn-secondary text-sm py-1">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{userProfile?.username}</h1>
                    <button
                      onClick={() => {
                        setNewUsername(userProfile?.username || '')
                        setIsEditing(true)
                      }}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
              <div className="text-gray-400 text-sm mt-1">
                Member since {new Date(userProfile?.createdAt || Date.now()).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Wallet Information</h2>
          <button
            onClick={() => setShowWalletDetails(!showWalletDetails)}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            {showWalletDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Ethereum Address */}
          <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
            <div>
              <div className="text-sm text-gray-400 mb-1">Ethereum Address (Identity)</div>
              <div className="font-mono text-sm">
                {showWalletDetails ? ethAddress : `${ethAddress?.slice(0, 10)}...${ethAddress?.slice(-8)}`}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(ethAddress || '', 'ETH Address')}
              className="text-gray-400 hover:text-white p-2"
            >
              Copy
            </button>
          </div>

          {/* Linera Public Key */}
          <div className="flex items-center justify-between p-4 bg-surface-700 rounded-lg">
            <div>
              <div className="text-sm text-gray-400 mb-1">
                Linera Public Key (Gaming Wallet) <span className="text-yellow-400">*</span>
              </div>
              <div className="font-mono text-sm">
                {showWalletDetails
                  ? lineraPublicKey || 'Not generated'
                  : `${lineraPublicKey?.slice(0, 10) || 'N/A'}...${lineraPublicKey?.slice(-8) || ''}`}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(lineraPublicKey || '', 'Linera Key')}
              className="text-gray-400 hover:text-white p-2"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-surface-700/50 rounded-lg space-y-2">
          <p className="text-sm text-gray-400">
            <span className="text-yellow-400">*</span> This is a temporary Linera wallet generated for gameplay. It's stored locally in your browser and encrypted with your MetaMask signature.
          </p>
          <p className="text-sm text-gray-400">
            <strong className="text-white">Why MetaMask?</strong> MetaMask is used for identity verification and authentication. Your Ethereum address serves as your unique identity on the platform, while the Linera wallet handles all game transactions on-chain. This separation ensures your main wallet stays secure while you play.
          </p>
          <p className="text-sm text-gray-400">
            The Linera private key is encrypted and stored locally in your browser using your MetaMask signature. Only you can access it.
          </p>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Overall Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="text-3xl font-bold text-green-400">{totalWins}</div>
            <div className="text-sm text-gray-400">Total Wins</div>
          </div>
          <div className="stat-card">
            <div className="text-3xl font-bold text-accent-400">{winRate}%</div>
            <div className="text-sm text-gray-400">Win Rate</div>
          </div>
          <div className="stat-card">
            <div className="text-3xl font-bold text-yellow-400">
              {(userProfile?.currentStreak || 0) > 0 ? '+' : ''}{userProfile?.currentStreak || 0}
            </div>
            <div className="text-sm text-gray-400">Current Streak</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Current Streak:</span>
            <span className={`text-2xl font-bold ${(userProfile?.currentStreak || 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {(userProfile?.currentStreak || 0) > 0 ? '+' : ''}{userProfile?.currentStreak || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Game-specific Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chess Stats */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">♟️</span>
            <h3 className="text-lg font-semibold">Chess</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">ELO Rating</span>
              <span className="font-bold text-primary-400">{userProfile?.chessElo || 1200}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wins</span>
              <span className="text-green-400">{userProfile?.chessWins || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Draws</span>
              <span>{userProfile?.chessDraws || 0}</span>
            </div>
          </div>
        </div>

        {/* Poker Stats */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🃏</span>
            <h3 className="text-lg font-semibold">Poker</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Chips Won</span>
              <span className="font-bold text-yellow-400">${(userProfile?.pokerChipsWon || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Hands Won</span>
              <span className="text-green-400">{userProfile?.pokerWins || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Best Hand</span>
              <span>{userProfile?.pokerBestHand || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Blackjack Stats */}
        <div className="bg-surface-800 rounded-xl border border-surface-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🎴</span>
            <h3 className="text-lg font-semibold">Blackjack</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Chips Won</span>
              <span className="font-bold text-yellow-400">${(userProfile?.blackjackChipsWon || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wins</span>
              <span className="text-green-400">{userProfile?.blackjackWins || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pushes</span>
              <span>{userProfile?.blackjackPushes || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Blackjacks</span>
              <span className="text-purple-400">{userProfile?.blackjackNaturals || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Achievements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg border ${totalWins >= 1 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-700 border-surface-600 opacity-50'}`}>
            <div className="text-3xl mb-2">🏆</div>
            <div className="font-medium">First Win</div>
            <div className="text-xs text-gray-400">Win your first game</div>
          </div>
          <div className={`p-4 rounded-lg border ${totalWins >= 10 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-700 border-surface-600 opacity-50'}`}>
            <div className="text-3xl mb-2">⭐</div>
            <div className="font-medium">Rising Star</div>
            <div className="text-xs text-gray-400">Win 10 games</div>
          </div>
          <div className={`p-4 rounded-lg border ${(userProfile?.currentStreak || 0) >= 5 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-700 border-surface-600 opacity-50'}`}>
            <div className="text-3xl mb-2">🔥</div>
            <div className="font-medium">On Fire</div>
            <div className="text-xs text-gray-400">5 game win streak</div>
          </div>
          <div className={`p-4 rounded-lg border ${(userProfile?.chessElo || 1200) >= 1500 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-700 border-surface-600 opacity-50'}`}>
            <div className="text-3xl mb-2">♟️</div>
            <div className="font-medium">Chess Master</div>
            <div className="text-xs text-gray-400">Reach 1500 ELO</div>
          </div>
        </div>
      </div>
    </div>
  )
}
