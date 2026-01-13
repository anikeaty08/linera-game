import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { GameAPI, GameStateManager } from '../services/api'

interface Card {
  rank: number // 2-14 (14=Ace)
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}

interface Player {
  hand: Card[]
  chips: number
  bet: number
  isBusted: boolean
  isStanding: boolean
  hasBlackjack: boolean
  name: string
}

const suitSymbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const rankNames: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
}

const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Charlie']

function createDeck(): Card[] {
  const deck: Card[] = []
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
  // Use 6 decks
  for (let d = 0; d < 6; d++) {
    for (const suit of suits) {
      for (let rank = 2; rank <= 14; rank++) {
        deck.push({ rank, suit })
      }
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

function getCardValue(card: Card): number {
  if (card.rank >= 11 && card.rank <= 13) return 10
  if (card.rank === 14) return 11 // Ace counts as 11 initially
  return card.rank
}

function calculateHandValue(hand: Card[]): { value: number; soft: boolean } {
  let value = 0
  let aces = 0

  for (const card of hand) {
    value += getCardValue(card)
    if (card.rank === 14) aces++
  }

  // Reduce aces from 11 to 1 if needed
  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return { value, soft: aces > 0 && value <= 21 }
}

type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null

export default function BlackjackGame() {
  const { mode } = useParams()
  const navigate = useNavigate()
  const { isConnected, isRegistered, userProfile, showToast, ethAddress, refreshProfile } = useStore()

  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [bots, setBots] = useState<Player[]>([
    { hand: [], chips: 1000, bet: 100, isBusted: false, isStanding: false, hasBlackjack: false, name: BOT_NAMES[0] },
    { hand: [], chips: 1000, bet: 100, isBusted: false, isStanding: false, hasBlackjack: false, name: BOT_NAMES[1] },
    { hand: [], chips: 1000, bet: 100, isBusted: false, isStanding: false, hasBlackjack: false, name: BOT_NAMES[2] },
  ])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [bet, setBet] = useState(100)
  const [chips, setChips] = useState(1000)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(-1) // -1 = human, 0-2 = bots, 3 = dealer
  const [showDealerCard, setShowDealerCard] = useState(false)
  const [result, setResult] = useState<GameResult>(null)
  const [canDouble, setCanDouble] = useState(true)
  const [playerResults, setPlayerResults] = useState<{ player: string; result: string; payout: number }[]>([])
  const [showBetModal, setShowBetModal] = useState(true)
  
  // On-chain game state - don't block gameplay for chain operations
  const [onchainGameId, setOnchainGameId] = useState<string | null>(null)
  const gameCreatedRef = useRef(false)

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  // Create on-chain game for bot mode in background (don't block gameplay)
  useEffect(() => {
    if (mode === 'bot' && !gameCreatedRef.current) {
      gameCreatedRef.current = true
      createOnchainGame()
    }
  }, [mode])

  // Create on-chain game in background - don't block the UI
  const createOnchainGame = async () => {
    try {
      console.log('Creating blackjack game on blockchain...')
      const result = await GameAPI.createGame(2, 0, null, 300) // 2 = Blackjack, 0 = VS_BOT

      if (result?.createGame) {
        setOnchainGameId(result.createGame)
        console.log('Blackjack game created on-chain:', result.createGame)
      }
    } catch (error) {
      console.error('Error creating blackjack game on chain:', error)
      // Don't block gameplay - game works locally
    }
  }

  // Record game result to blockchain
  const recordGameResult = async (won: boolean) => {
    if (!ethAddress || mode !== 'bot') return
    try {
      // Chess = 0, Poker = 1, Blackjack = 2
      await GameAPI.recordBotGame(2, won, 1, ethAddress)
      showToast(won ? 'Victory recorded on-chain!' : 'Game recorded on-chain', 'success')
      setTimeout(() => refreshProfile(), 1000)
    } catch (error) {
      console.error('Failed to record game:', error)
    }
  }

  // Bot decision logic (basic strategy)
  const botShouldHit = (botHand: Card[]): boolean => {
    const handValue = calculateHandValue(botHand)
    // Simple strategy: hit on < 17, stand on >= 17
    return handValue.value < 17
  }

  // Play bot turn
  const playBotTurn = async (botIndex: number) => {
    const bot = bots[botIndex]
    if (bot.isBusted || bot.isStanding || bot.hasBlackjack) {
      moveToNextPlayer()
      return
    }

    await new Promise(resolve => setTimeout(resolve, 800))

    let newDeck = [...deck]
    let newBots = [...bots]

    while (botShouldHit(newBots[botIndex].hand) && !newBots[botIndex].isBusted) {
      const newCard = newDeck.pop()!
      newBots[botIndex].hand = [...newBots[botIndex].hand, newCard]
      setDeck(newDeck)
      setBots(newBots)

      const handValue = calculateHandValue(newBots[botIndex].hand)
      if (handValue.value > 21) {
        newBots[botIndex].isBusted = true
        setBots(newBots)
        break
      }

      await new Promise(resolve => setTimeout(resolve, 800))
    }

    if (!newBots[botIndex].isBusted) {
      newBots[botIndex].isStanding = true
      setBots(newBots)
    }

    moveToNextPlayer()
  }

  const moveToNextPlayer = () => {
    if (currentPlayerIndex < 2) {
      // Move to next bot
      setCurrentPlayerIndex(currentPlayerIndex + 1)
    } else {
      // All players done, dealer's turn
      setCurrentPlayerIndex(3)
      playDealer()
    }
  }

  const startNewGame = (betAmount: number) => {
    if (betAmount > chips) {
      showToast('Insufficient chips', 'error')
      return
    }

    const newDeck = createDeck()
    
    // Deal initial cards: player, bot1, bot2, bot3, dealer, player, bot1, bot2, bot3, dealer
    const pHand = [newDeck.pop()!, newDeck.pop()!]
    const b1Hand = [newDeck.pop()!, newDeck.pop()!]
    const b2Hand = [newDeck.pop()!, newDeck.pop()!]
    const b3Hand = [newDeck.pop()!, newDeck.pop()!]
    const dHand = [newDeck.pop()!, newDeck.pop()!]

    setDeck(newDeck)
    setPlayerHand(pHand)
    setBots([
      { hand: b1Hand, chips: bots[0].chips, bet: betAmount, isBusted: false, isStanding: false, hasBlackjack: calculateHandValue(b1Hand).value === 21, name: BOT_NAMES[0] },
      { hand: b2Hand, chips: bots[1].chips, bet: betAmount, isBusted: false, isStanding: false, hasBlackjack: calculateHandValue(b2Hand).value === 21, name: BOT_NAMES[1] },
      { hand: b3Hand, chips: bots[2].chips, bet: betAmount, isBusted: false, isStanding: false, hasBlackjack: calculateHandValue(b3Hand).value === 21, name: BOT_NAMES[2] },
    ])
    setDealerHand(dHand)
    setBet(betAmount)
    setChips((prev) => prev - betAmount)
    setCurrentPlayerIndex(-1) // Human player goes first
    setShowDealerCard(false)
    setResult(null)
    setCanDouble(true)
    setPlayerResults([])

    // Check for player blackjack
    const playerValue = calculateHandValue(pHand)
    if (playerValue.value === 21) {
      setShowDealerCard(true)
      const dealerValue = calculateHandValue(dHand)
      if (dealerValue.value === 21) {
        setChips((prev) => prev + betAmount)
      } else {
        setChips((prev) => prev + betAmount * 2.5)
      }
      // Player blackjack, move to bots
      setCurrentPlayerIndex(0)
    }

    setShowBetModal(false)
  }

  const hit = async () => {
    if (currentPlayerIndex !== -1 || result) return

    const newDeck = [...deck]
    const newCard = newDeck.pop()!
    const newHand = [...playerHand, newCard]

    setDeck(newDeck)
    setPlayerHand(newHand)
    setCanDouble(false)

    const value = calculateHandValue(newHand)
    if (value.value > 21) {
      // Player busted
      setCurrentPlayerIndex(0) // Move to first bot
    }
  }

  const stand = async () => {
    if (currentPlayerIndex !== -1 || result) return
    setCurrentPlayerIndex(0) // Move to first bot
  }

  const double = async () => {
    if (currentPlayerIndex !== -1 || !canDouble || bet > chips || result) return

    const newDeck = [...deck]
    const newCard = newDeck.pop()!
    const newHand = [...playerHand, newCard]

    setDeck(newDeck)
    setPlayerHand(newHand)
    setChips((prev) => prev - bet)
    setBet((prev) => prev * 2)
    setCanDouble(false)

    const value = calculateHandValue(newHand)
    if (value.value > 21) {
      // Player busted
    }
    setCurrentPlayerIndex(0) // Move to first bot
  }

  // Play bots after human
  useEffect(() => {
    if (currentPlayerIndex >= 0 && currentPlayerIndex < 3 && !showBetModal && !result) {
      playBotTurn(currentPlayerIndex)
    }
  }, [currentPlayerIndex, showBetModal, result])

  const playDealer = async () => {
    let newDeck = [...deck]
    let newDealerHand = [...dealerHand]

    // Dealer draws until 17 or higher
    while (calculateHandValue(newDealerHand).value < 17) {
      await new Promise((r) => setTimeout(r, 500))
      const newCard = newDeck.pop()!
      newDealerHand = [...newDealerHand, newCard]
      setDealerHand(newDealerHand)
      setDeck(newDeck)
    }

    setShowDealerCard(true)
    calculateResults(newDealerHand)
  }

  const calculateResults = (finalDealerHand: Card[]) => {
    const dealerValue = calculateHandValue(finalDealerHand).value
    const dealerBusted = dealerValue > 21
    
    const results: { player: string; result: string; payout: number }[] = []
    let playerWon = false

    // Human player result
    const playerValue = calculateHandValue(playerHand).value
    const playerBusted = playerValue > 21
    const playerBlackjack = playerHand.length === 2 && playerValue === 21

    if (playerBusted) {
      results.push({ player: userProfile?.username || 'You', result: 'BUST', payout: -bet })
      playerWon = false
    } else if (playerBlackjack && dealerValue !== 21) {
      const payout = Math.floor(bet * 2.5)
      results.push({ player: userProfile?.username || 'You', result: 'BLACKJACK!', payout })
      setChips((prev) => prev + bet + payout)
      playerWon = true
    } else if (dealerBusted || playerValue > dealerValue) {
      const payout = bet * 2
      results.push({ player: userProfile?.username || 'You', result: 'WIN', payout })
      setChips((prev) => prev + payout)
      playerWon = true
    } else if (playerValue < dealerValue) {
      results.push({ player: userProfile?.username || 'You', result: 'LOSE', payout: -bet })
      playerWon = false
    } else {
      results.push({ player: userProfile?.username || 'You', result: 'PUSH', payout: 0 })
      setChips((prev) => prev + bet)
      playerWon = false
    }

    // Bot results
    bots.forEach((bot, index) => {
      const botValue = calculateHandValue(bot.hand).value
      const botBusted = botValue > 21
      const botBlackjack = bot.hand.length === 2 && botValue === 21

      if (botBusted) {
        results.push({ player: bot.name, result: 'BUST', payout: -bot.bet })
      } else if (botBlackjack && dealerValue !== 21) {
        const payout = Math.floor(bot.bet * 2.5)
        results.push({ player: bot.name, result: 'BLACKJACK!', payout })
      } else if (dealerBusted || botValue > dealerValue) {
        const payout = bot.bet * 2
        results.push({ player: bot.name, result: 'WIN', payout })
      } else if (botValue < dealerValue) {
        results.push({ player: bot.name, result: 'LOSE', payout: -bot.bet })
      } else {
        results.push({ player: bot.name, result: 'PUSH', payout: 0 })
      }
    })

    setPlayerResults(results)
    setResult(playerWon ? 'win' : 'lose')
    
    if (mode === 'bot') {
      recordGameResult(playerWon)
    }
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

  const playerValue = calculateHandValue(playerHand)
  const dealerValue = calculateHandValue(showDealerCard ? dealerHand : [dealerHand[0] || { rank: 0, suit: 'hearts' }])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Bet Modal */}
      {showBetModal && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up">
            <h2 className="text-xl font-bold mb-4 text-center">Place Your Bet</h2>
            <div className="text-center mb-4">
              <span className="text-gray-400">Your chips: </span>
              <span className="text-2xl font-bold text-yellow-400">${chips}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[25, 50, 100, 250].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBet(amount)}
                  className={`py-2 rounded-lg transition-colors ${
                    bet === amount ? 'bg-primary-600' : 'bg-surface-700 hover:bg-surface-600'
                  }`}
                  disabled={amount > chips}
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(Math.min(chips, Math.max(10, Number(e.target.value))))}
                className="flex-1 px-4 py-2 rounded-lg bg-surface-700 text-center text-xl"
                min={10}
                max={chips}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/play')} className="flex-1 btn-game btn-secondary">
                Back
              </button>
              <button
                onClick={() => startNewGame(bet)}
                disabled={bet > chips || bet < 10}
                className="flex-1 btn-game btn-primary"
              >
                Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {result && playerResults.length > 0 && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-2xl w-full mx-4 border border-surface-700 animate-slide-up">
            <h2 className="text-2xl font-bold mb-4 text-center">Round Results</h2>
            <div className="space-y-2 mb-6">
              {playerResults.map((r, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-surface-700 rounded-lg">
                  <span className="font-semibold">{r.player}</span>
                  <span className={`font-bold ${r.payout > 0 ? 'text-green-400' : r.payout < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {r.result} {r.payout !== 0 && (r.payout > 0 ? `+$${r.payout}` : `-$${Math.abs(r.payout)}`)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/play')} className="flex-1 btn-game btn-secondary">
                Back to Menu
              </button>
              <button
                onClick={() => {
                  setShowBetModal(true)
                  setResult(null)
                  setPlayerResults([])
                }}
                disabled={chips < 10}
                className="flex-1 btn-game btn-primary"
              >
                Play Again
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
        <h1 className="text-2xl font-bold">Blackjack (4 Players)</h1>
        <div className="text-right">
          <div className="text-sm text-gray-400">Your Chips</div>
          <div className="text-xl font-bold text-yellow-400">${chips}</div>
        </div>
      </div>

      {/* Game Area */}
      <div className="blackjack-table">
        {/* Dealer Section */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-3">Dealer</h3>
          <div className="flex justify-center gap-2 mb-2">
            {dealerHand.map((card, i) => (
              <div key={i} className="transform hover:translate-y-[-4px] transition-transform">
                {renderCard(card, i === 1 && !showDealerCard)}
              </div>
            ))}
          </div>
          <div className="text-xl font-bold">
            {showDealerCard
              ? calculateHandValue(dealerHand).value
              : dealerHand[0] ? getCardValue(dealerHand[0]) : 0}
            {!showDealerCard && <span className="text-gray-400"> + ?</span>}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-green-600 my-4 opacity-50" />

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Human Player */}
          <div className={`text-center p-4 rounded-lg ${currentPlayerIndex === -1 ? 'bg-primary-600/20 ring-2 ring-primary-400' : 'bg-surface-800'}`}>
            <h4 className="font-semibold mb-2">{userProfile?.username || 'You'}</h4>
            <div className="flex justify-center gap-1 mb-2">
              {playerHand.map((card, i) => (
                <div key={i} className="transform hover:translate-y-[-4px] transition-transform">
                  {renderCard(card)}
                </div>
              ))}
            </div>
            <div className="text-sm font-bold">
              {playerValue.value}
              {playerValue.soft && playerValue.value <= 21 && <span className="text-gray-400"> (soft)</span>}
              {playerValue.value > 21 && <span className="text-red-400"> BUST</span>}
            </div>
            <div className="text-xs text-yellow-400 mt-1">Bet: ${bet}</div>
          </div>

          {/* Bot Players */}
          {bots.map((bot, index) => {
            const botValue = calculateHandValue(bot.hand)
            return (
              <div key={index} className={`text-center p-4 rounded-lg ${currentPlayerIndex === index ? 'bg-blue-600/20 ring-2 ring-blue-400' : 'bg-surface-800'}`}>
                <h4 className="font-semibold mb-2">{bot.name}</h4>
                <div className="flex justify-center gap-1 mb-2">
                  {bot.hand.map((card, i) => (
                    <div key={i} className="transform hover:translate-y-[-4px] transition-transform">
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
                <div className="text-sm font-bold">
                  {botValue.value}
                  {bot.isBusted && <span className="text-red-400"> BUST</span>}
                  {bot.hasBlackjack && <span className="text-green-400"> BJ!</span>}
                </div>
                <div className="text-xs text-yellow-400 mt-1">Bet: ${bot.bet}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      {currentPlayerIndex === -1 && !result && (
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={hit} className="btn-game btn-primary">
            Hit
          </button>
          <button onClick={stand} className="btn-game btn-secondary">
            Stand
          </button>
          <button
            onClick={double}
            disabled={!canDouble || bet > chips}
            className="btn-game btn-warning disabled:opacity-50"
          >
            Double
          </button>
        </div>
      )}

      {/* Turn Indicator */}
      {!showBetModal && !result && (
        <div className="mt-4 text-center">
          {currentPlayerIndex === -1 && (
            <p className="text-primary-400 font-semibold">Your Turn</p>
          )}
          {currentPlayerIndex >= 0 && currentPlayerIndex < 3 && (
            <p className="text-blue-400 font-semibold">{bots[currentPlayerIndex].name}'s Turn</p>
          )}
          {currentPlayerIndex === 3 && (
            <p className="text-green-400 font-semibold">Dealer's Turn</p>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 text-center text-sm text-gray-400">
        <p>Get as close to 21 as possible without going over.</p>
        <p>Dealer must hit on 16 and stand on 17.</p>
        <p>Blackjack pays 3:2. Playing with 3 bots.</p>
      </div>
    </div>
  )
}
