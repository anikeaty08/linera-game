import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI, GameStateManager } from '../services/api'

// Use environment variable for API key or fallback
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAI-OprKZKht1ay3Ut18Po8C2V7cLiiyHA'

interface Card {
  rank: number // 2-14 (14=Ace)
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}

const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const rankNames: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
}

function createDeck(): Card[] {
  const deck: Card[] = []
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit })
    }
  }
  return shuffle(deck)
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
type Action = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export default function PokerGame() {
  const { mode } = useParams()
  const navigate = useNavigate()
  const { isConnected, isRegistered, userProfile, showToast, ethAddress, refreshProfile } = useStore()

  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [botHand, setBotHand] = useState<Card[]>([])
  const [communityCards, setCommunityCards] = useState<Card[]>([])
  const [stage, setStage] = useState<PokerStage>('preflop')
  const [pot, setPot] = useState(0)
  const [playerChips, setPlayerChips] = useState(1000)
  const [botChips, setBotChips] = useState(1000)
  const [currentBet, setCurrentBet] = useState(0)
  const [playerBet, setPlayerBet] = useState(0)
  const [botBet, setBotBet] = useState(0)
  const [raiseAmount, setRaiseAmount] = useState(20)
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [gameOver, setGameOver] = useState<{ winner: string; reason: string } | null>(null)
  const [showCards, setShowCards] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])
  
  // On-chain game state
  const [onchainGameId, setOnchainGameId] = useState<string | null>(null)
  const [creatingGame, setCreatingGame] = useState(false)

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  // Initialize game - create on-chain game for bot mode
  useEffect(() => {
    if (mode === 'bot') {
      createOnchainGame()
    } else {
      startNewHand()
    }
  }, [mode])

  const startNewHand = () => {
    const newDeck = createDeck()
    const pHand = [newDeck.pop()!, newDeck.pop()!]
    const bHand = [newDeck.pop()!, newDeck.pop()!]

    setDeck(newDeck)
    setPlayerHand(pHand)
    setBotHand(bHand)
    setCommunityCards([])
    setStage('preflop')
    setPot(30) // Blinds
    setCurrentBet(20)
    setPlayerBet(10) // Small blind
    setBotBet(20) // Big blind
    setPlayerChips((prev) => prev - 10)
    setBotChips((prev) => prev - 20)
    setIsPlayerTurn(true)
    setShowCards(false)
    setActionLog(['New hand started', 'Player posts small blind: $10', 'Bot posts big blind: $20'])
    setGameOver(null)
  }

  const addLog = (message: string) => {
    setActionLog((prev) => [...prev, message])
  }

  // Create on-chain game for bot mode
  const createOnchainGame = async () => {
    setCreatingGame(true)
    try {
      showToast('Creating game on blockchain...', 'info')
      await GameAPI.createGame('POKER', 'VS_BOT', null, 300)
      
      // Poll for the newly created game ID
      let attempts = 0
      const maxAttempts = 15
      let foundGameId: string | null = null
      
      while (attempts < maxAttempts && !foundGameId) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        try {
          const data = await GameAPI.getPlayerActiveGamesByEth(ethAddress || '')
          if (data?.playerActiveGamesByEth && data.playerActiveGamesByEth.length > 0) {
            const botGames = data.playerActiveGamesByEth.filter((g: any) => 
              g.gameType === 'POKER' && g.gameMode === 'VS_BOT' && g.status === 'IN_PROGRESS'
            )
            if (botGames.length > 0) {
              botGames.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
              foundGameId = botGames[0].gameId
              setOnchainGameId(foundGameId)
              showToast('Game created on-chain!', 'success')
              startNewHand()
              break
            }
          }
        } catch (error) {
          console.error('Error polling for game ID:', error)
        }
        attempts++
      }
      
      if (!foundGameId && attempts >= maxAttempts) {
        showToast('Game created but could not retrieve game ID. Please refresh.', 'warning')
        startNewHand()
      }
    } catch (error) {
      console.error('Error creating game:', error)
      showToast('Failed to create game on blockchain', 'error')
      startNewHand()
    } finally {
      setCreatingGame(false)
    }
  }

  // Record game result to blockchain
  const recordGameResult = async (won: boolean) => {
    if (!ethAddress || mode !== 'bot') return
    try {
      // Chess = 0, Poker = 1, Blackjack = 2
      await GameAPI.recordBotGame(1, won, 1, ethAddress)
      showToast(won ? 'Victory recorded on-chain!' : 'Game recorded on-chain', 'success')
      // Refresh profile to show updated stats
      setTimeout(() => refreshProfile(), 1000)
    } catch (error) {
      console.error('Failed to record game:', error)
    }
  }

  // End game with result and record to blockchain
  const endGame = (winner: string, reason: string, playerWon: boolean | null) => {
    setGameOver({ winner, reason })
    if (mode === 'bot' && playerWon !== null) {
      recordGameResult(playerWon)
    }
  }

  const handleAction = async (action: Action, amount?: number) => {
    if (!isPlayerTurn || gameOver || creatingGame) return

    // Store action on blockchain (fire and forget - don't block UI)
    if (onchainGameId && mode === 'bot') {
      GameAPI.pokerAction(onchainGameId, action.toUpperCase(), amount || null)
        .then(() => {
          console.log('Poker action stored on chain:', action)
        })
        .catch((error) => {
          console.error('Failed to store action on chain:', error)
        })
    }

    switch (action) {
      case 'fold':
        addLog('Player folds')
        setBotChips((prev) => prev + pot)
        endGame('Bot', 'Player folded', false)
        return

      case 'check':
        if (currentBet > playerBet) {
          showToast('Cannot check - must call or raise', 'error')
          return
        }
        addLog('Player checks')
        break

      case 'call':
        const toCall = currentBet - playerBet
        if (toCall > playerChips) {
          // All-in
          setPot((prev) => prev + playerChips)
          setPlayerBet((prev) => prev + playerChips)
          setPlayerChips(0)
          addLog(`Player calls all-in: $${playerChips}`)
        } else {
          setPot((prev) => prev + toCall)
          setPlayerBet(currentBet)
          setPlayerChips((prev) => prev - toCall)
          addLog(`Player calls: $${toCall}`)
        }
        break

      case 'raise':
        const raiseTotal = currentBet - playerBet + (amount || raiseAmount)
        if (raiseTotal > playerChips) {
          showToast('Insufficient chips', 'error')
          return
        }
        setPot((prev) => prev + raiseTotal)
        setCurrentBet(currentBet + (amount || raiseAmount))
        setPlayerBet(currentBet + (amount || raiseAmount))
        setPlayerChips((prev) => prev - raiseTotal)
        addLog(`Player raises to $${currentBet + (amount || raiseAmount)}`)
        break

      case 'allin':
        setPot((prev) => prev + playerChips)
        const newBet = playerBet + playerChips
        if (newBet > currentBet) {
          setCurrentBet(newBet)
        }
        setPlayerBet(newBet)
        setPlayerChips(0)
        addLog(`Player goes all-in: $${playerChips}`)
        break
    }

    setIsPlayerTurn(false)

    // Check if betting round is complete
    if (action === 'check' || action === 'call') {
      if (playerBet === botBet) {
        await advanceStage()
        return
      }
    }

    // Bot's turn
    await botAction()
  }

  const botAction = async () => {
    setIsThinking(true)
    await new Promise((r) => setTimeout(r, 1000))

    try {
      // Use Gemini for bot decision
      const prompt = `You are playing Texas Hold'em Poker.
Your hand: ${botHand.map(c => `${rankNames[c.rank]}${suitSymbols[c.suit]}`).join(' ')}
Community cards: ${communityCards.length > 0 ? communityCards.map(c => `${rankNames[c.rank]}${suitSymbols[c.suit]}`).join(' ') : 'None yet'}
Stage: ${stage}
Pot: $${pot}
Your chips: $${botChips}
Your current bet: $${botBet}
Opponent's bet: $${playerBet}
Current bet to match: $${currentBet}

Decide your action. Options: fold, check (if no bet to call), call, raise, allin
Consider pot odds and hand strength.

Respond with ONLY one word: fold, check, call, raise, or allin`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 10 },
          }),
        }
      )

      const data = await response.json()
      let action = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || 'call'

      // Validate action
      const validActions = ['fold', 'check', 'call', 'raise', 'allin']
      if (!validActions.includes(action)) {
        action = currentBet > botBet ? 'call' : 'check'
      }

      // Cannot check if there's a bet to call
      if (action === 'check' && currentBet > botBet) {
        action = 'call'
      }

      // Execute bot action
      switch (action) {
        case 'fold':
          addLog('Bot folds')
          setPlayerChips((prev) => prev + pot)
          endGame('Player', 'Bot folded', true)
          setIsThinking(false)
          return

        case 'check':
          addLog('Bot checks')
          break

        case 'call':
          const toCall = currentBet - botBet
          if (toCall >= botChips) {
            setPot((prev) => prev + botChips)
            setBotBet((prev) => prev + botChips)
            setBotChips(0)
            addLog(`Bot calls all-in: $${botChips}`)
          } else {
            setPot((prev) => prev + toCall)
            setBotBet(currentBet)
            setBotChips((prev) => prev - toCall)
            addLog(`Bot calls: $${toCall}`)
          }
          break

        case 'raise':
          const raise = Math.min(botChips, 50)
          const raiseTotal = currentBet - botBet + raise
          setPot((prev) => prev + raiseTotal)
          setCurrentBet(currentBet + raise)
          setBotBet(currentBet + raise)
          setBotChips((prev) => prev - raiseTotal)
          addLog(`Bot raises to $${currentBet + raise}`)
          break

        case 'allin':
          setPot((prev) => prev + botChips)
          const newBet = botBet + botChips
          if (newBet > currentBet) {
            setCurrentBet(newBet)
          }
          setBotBet(newBet)
          setBotChips(0)
          addLog(`Bot goes all-in: $${botChips}`)
          break
      }

      // Check if betting round is complete
      if (playerBet === currentBet && (action === 'check' || action === 'call')) {
        await advanceStage()
      } else {
        setIsPlayerTurn(true)
      }
    } catch (error) {
      console.error('Bot error:', error)
      // Default to call
      const toCall = Math.min(currentBet - botBet, botChips)
      setPot((prev) => prev + toCall)
      setBotBet(currentBet)
      setBotChips((prev) => prev - toCall)
      addLog(`Bot calls: $${toCall}`)
      setIsPlayerTurn(true)
    }

    setIsThinking(false)
  }

  const advanceStage = async () => {
    const newDeck = [...deck]

    // Reset bets for new round
    setPlayerBet(0)
    setBotBet(0)
    setCurrentBet(0)

    if (stage === 'preflop') {
      // Deal flop
      const flop = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!]
      setCommunityCards(flop)
      setStage('flop')
      addLog(`Flop: ${flop.map(c => `${rankNames[c.rank]}${suitSymbols[c.suit]}`).join(' ')}`)
    } else if (stage === 'flop') {
      // Deal turn
      const turn = newDeck.pop()!
      setCommunityCards((prev) => [...prev, turn])
      setStage('turn')
      addLog(`Turn: ${rankNames[turn.rank]}${suitSymbols[turn.suit]}`)
    } else if (stage === 'turn') {
      // Deal river
      const river = newDeck.pop()!
      setCommunityCards((prev) => [...prev, river])
      setStage('river')
      addLog(`River: ${rankNames[river.rank]}${suitSymbols[river.suit]}`)
    } else if (stage === 'river') {
      // Showdown
      setStage('showdown')
      setShowCards(true)
      determineWinner()
      return
    }

    setDeck(newDeck)
    setIsPlayerTurn(true)
  }

  const determineWinner = () => {
    // Simplified hand evaluation
    const playerScore = evaluateHand([...playerHand, ...communityCards])
    const botScore = evaluateHand([...botHand, ...communityCards])

    addLog('--- Showdown ---')
    addLog(`Player hand: ${playerHand.map(c => `${rankNames[c.rank]}${suitSymbols[c.suit]}`).join(' ')}`)
    addLog(`Bot hand: ${botHand.map(c => `${rankNames[c.rank]}${suitSymbols[c.suit]}`).join(' ')}`)

    if (playerScore > botScore) {
      setPlayerChips((prev) => prev + pot)
      addLog(`Player wins $${pot}!`)
      endGame('Player', 'Better hand', true)
    } else if (botScore > playerScore) {
      setBotChips((prev) => prev + pot)
      addLog(`Bot wins $${pot}!`)
      endGame('Bot', 'Better hand', false)
    } else {
      const half = Math.floor(pot / 2)
      setPlayerChips((prev) => prev + half)
      setBotChips((prev) => prev + half)
      addLog('Split pot!')
      endGame('Tie', 'Equal hands', null) // null = no winner, don't record
    }
  }

  // Simplified hand evaluation
  const evaluateHand = (cards: Card[]): number => {
    const ranks = cards.map((c) => c.rank).sort((a, b) => b - a)
    const suits = cards.map((c) => c.suit)

    const rankCounts: Record<number, number> = {}
    ranks.forEach((r) => (rankCounts[r] = (rankCounts[r] || 0) + 1))

    const suitCounts: Record<string, number> = {}
    suits.forEach((s) => (suitCounts[s] = (suitCounts[s] || 0) + 1))

    const isFlush = Object.values(suitCounts).some((c) => c >= 5)
    const pairs = Object.entries(rankCounts).filter(([_, c]) => c === 2).map(([r]) => Number(r))
    const trips = Object.entries(rankCounts).filter(([_, c]) => c === 3).map(([r]) => Number(r))
    const quads = Object.entries(rankCounts).filter(([_, c]) => c === 4).map(([r]) => Number(r))

    // Check for straight
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a)
    let isStraight = false
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
        isStraight = true
        break
      }
    }

    // Scoring
    if (isStraight && isFlush) return 800 + Math.max(...ranks)
    if (quads.length > 0) return 700 + quads[0]
    if (trips.length > 0 && pairs.length > 0) return 600 + trips[0]
    if (isFlush) return 500 + Math.max(...ranks)
    if (isStraight) return 400 + Math.max(...ranks)
    if (trips.length > 0) return 300 + trips[0]
    if (pairs.length >= 2) return 200 + Math.max(...pairs)
    if (pairs.length === 1) return 100 + pairs[0]
    return Math.max(...ranks)
  }

  const renderCard = (card: Card, faceDown = false) => {
    if (faceDown) {
      return (
        <div className="playing-card face-down">
          <span className="text-2xl">🂠</span>
        </div>
      )
    }

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
    return (
      <div className={`playing-card ${isRed ? 'red' : 'black'}`}>
        <div className="text-lg font-bold">{rankNames[card.rank]}</div>
        <div className="text-2xl">{suitSymbols[card.suit]}</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Game Over Modal */}
      {gameOver && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up text-center">
            <div className="text-6xl mb-4">
              {gameOver.winner === 'Player' ? '🏆' : gameOver.winner === 'Tie' ? '🤝' : '😔'}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {gameOver.winner === 'Player' ? 'You Win!' : gameOver.winner === 'Tie' ? 'Tie!' : 'Bot Wins!'}
            </h2>
            <p className="text-gray-400 mb-6">{gameOver.reason}</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/play')} className="flex-1 btn-game btn-secondary">
                Back to Menu
              </button>
              <button onClick={startNewHand} className="flex-1 btn-game btn-primary">
                Next Hand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/play')} className="text-gray-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-2xl font-bold">Texas Hold'em Poker</h1>
        <div className="w-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Table */}
        <div className="lg:col-span-2">
          {/* Bot Section */}
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🤖</span>
                <span className="font-medium">Bot</span>
                <span className="text-sm text-gray-400">${botChips}</span>
              </div>
              <div className="flex gap-2 justify-center">
                {botHand.map((card, i) => (
                  <div key={i}>{renderCard(card, !showCards)}</div>
                ))}
              </div>
              {botBet > 0 && <div className="mt-2 text-sm text-yellow-400">Bet: ${botBet}</div>}
            </div>
          </div>

          {/* Community Cards */}
          <div className="poker-table py-8 px-4 mb-6">
            <div className="text-center mb-4">
              <span className="text-xl font-bold text-yellow-400">Pot: ${pot}</span>
            </div>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i}>
                  {communityCards[i] ? (
                    renderCard(communityCards[i])
                  ) : (
                    <div className="playing-card bg-green-800 border-2 border-green-600 opacity-50" />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-4 text-sm text-gray-400 capitalize">
              Stage: {stage}
            </div>
          </div>

          {/* Player Section */}
          <div className="flex justify-center items-center gap-4">
            <div className="text-center">
              <div className="flex gap-2 justify-center mb-2">
                {playerHand.map((card, i) => (
                  <div key={i}>{renderCard(card)}</div>
                ))}
              </div>
              {playerBet > 0 && <div className="mb-2 text-sm text-yellow-400">Bet: ${playerBet}</div>}
              <div className="flex items-center gap-2">
                <span className="text-2xl">👤</span>
                <span className="font-medium">{userProfile?.username}</span>
                <span className="text-sm text-gray-400">${playerChips}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => handleAction('fold')}
              disabled={!isPlayerTurn || !!gameOver || isThinking}
              className="btn-game btn-danger"
            >
              Fold
            </button>
            <button
              onClick={() => handleAction('check')}
              disabled={!isPlayerTurn || currentBet > playerBet || !!gameOver || isThinking}
              className="btn-game btn-secondary"
            >
              Check
            </button>
            <button
              onClick={() => handleAction('call')}
              disabled={!isPlayerTurn || currentBet === playerBet || !!gameOver || isThinking}
              className="btn-game btn-secondary"
            >
              Call ${currentBet - playerBet}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Math.max(20, Number(e.target.value)))}
                className="w-20 px-2 py-2 rounded-lg bg-surface-700 text-center"
                min={20}
              />
              <button
                onClick={() => handleAction('raise', raiseAmount)}
                disabled={!isPlayerTurn || !!gameOver || isThinking}
                className="btn-game btn-primary"
              >
                Raise
              </button>
            </div>
            <button
              onClick={() => handleAction('allin')}
              disabled={!isPlayerTurn || !!gameOver || isThinking}
              className="btn-game btn-warning"
            >
              All In
            </button>
          </div>

          {isThinking && (
            <div className="text-center mt-4 flex items-center justify-center gap-2">
              <div className="spinner w-5 h-5" />
              <span>Bot is thinking...</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action Log */}
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
            <h3 className="font-semibold mb-3">Action Log</h3>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {actionLog.map((log, i) => (
                <div key={i} className="text-sm text-gray-400">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* New Hand Button */}
          <button onClick={startNewHand} className="w-full btn-game btn-secondary">
            New Hand
          </button>
        </div>
      </div>
    </div>
  )
}
