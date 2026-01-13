import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import GameSelect from './pages/GameSelect'
import ChessGame from './pages/ChessGame'
import PokerGame from './pages/PokerGame'
import BlackjackGame from './pages/BlackjackGame'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import JoinLobby from './pages/JoinLobby'
import Toast from './components/Toast'

function App() {
  const { checkWalletConnection, toast, isConnected, ethAddress, refreshProfile } = useStore()

  useEffect(() => {
    checkWalletConnection()
  }, [checkWalletConnection])

  // Poll for profile updates every 30 seconds when connected
  // Note: Reduced frequency due to potential network issues with Linera validators
  useEffect(() => {
    if (!isConnected || !ethAddress) return

    const interval = setInterval(async () => {
      try {
        await refreshProfile()
      } catch (error) {
        // Silently handle polling errors - they're expected if network is unavailable
        console.log('[App] Profile refresh failed (network may be unavailable):', error)
      }
    }, 30000) // Poll every 30 seconds (reduced from 5s due to potential CORS issues)

    return () => clearInterval(interval)
  }, [isConnected, ethAddress, refreshProfile])

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join/:lobbyId" element={<JoinLobby />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/play" element={<GameSelect />} />
          <Route path="/chess/:mode" element={<ChessGame />} />
          <Route path="/chess/:mode/:gameId" element={<ChessGame />} />
          <Route path="/poker/:mode" element={<PokerGame />} />
          <Route path="/poker/:mode/:gameId" element={<PokerGame />} />
          <Route path="/blackjack/:mode" element={<BlackjackGame />} />
          <Route path="/blackjack/:mode/:gameId" element={<BlackjackGame />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}

export default App
