import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { Chess, Square, Move } from 'chess.js'
import { useStore } from '../store/useStore'
import { GameAPI, GameStateManager } from '../services/api'

// Use environment variable for API key or fallback
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAI-OprKZKht1ay3Ut18Po8C2V7cLiiyHA'

// Piece symbols
const pieceSymbols: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
}

export default function ChessGame() {
  const { mode } = useParams()
  const [searchParams] = useSearchParams()
  const lobbyId = searchParams.get('lobby')
  const gameIdParam = searchParams.get('gameId')
  const navigate = useNavigate()
  const { isConnected, isRegistered, userProfile, showToast, ethAddress, refreshProfile } = useStore()

  const [game, setGame] = useState(new Chess())
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<string[]>([])
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [gameOver, setGameOver] = useState<{ winner: string; reason: string } | null>(null)
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [showDifficultyModal, setShowDifficultyModal] = useState(mode === 'bot')
  const [boardTheme, setBoardTheme] = useState<'classic' | 'green' | 'blue' | 'purple' | 'dark'>('classic')
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ w: 300, b: 300 })
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w')

  // On-chain game state (for both friend and bot mode)
  const [onchainGameId, setOnchainGameId] = useState<string | null>(gameIdParam)
  const [waitingForOpponent, setWaitingForOpponent] = useState(mode === 'friend' && lobbyId && !gameIdParam)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [creatingGame, setCreatingGame] = useState(false)

  if (!isConnected || !isRegistered) {
    return <Navigate to="/" replace />
  }

  // Friend mode: Poll lobby for game start
  useEffect(() => {
    if (mode !== 'friend' || !lobbyId || onchainGameId) return

    const pollLobby = async () => {
      try {
        const data = await GameAPI.getLobby(lobbyId)
        if (data?.lobby) {
          if (data.lobby.gameId) {
            // Game has started!
            setOnchainGameId(data.lobby.gameId)
            setWaitingForOpponent(false)

            // Determine player color based on creator
            const isCreator = data.lobby.creator === ethAddress
            setPlayerColor(isCreator ? 'w' : 'b')

            // Set opponent name
            const opponentIndex = isCreator ? 1 : 0
            if (data.lobby.players && data.lobby.players.length > 1) {
              setOpponentName(data.lobby.playerNames?.[opponentIndex] || 'Opponent')
            }

            showToast('Opponent joined! Game starting...', 'success')
          } else if (data.lobby.status === 'CANCELLED' || data.lobby.status === 'EXPIRED') {
            showToast('Lobby has been cancelled or expired', 'error')
            navigate('/play')
          }
        }
      } catch (error) {
        console.error('Error polling lobby:', error)
      }
    }

    pollLobby() // Initial poll
    const interval = setInterval(pollLobby, 2000)

    return () => clearInterval(interval)
  }, [mode, lobbyId, onchainGameId, ethAddress, navigate, showToast])

  // Poll game state from blockchain (for both friend and bot mode)
  useEffect(() => {
    if ((mode !== 'friend' && mode !== 'bot') || !onchainGameId || gameOver) return

    const pollGame = async () => {
      try {
        const data = await GameAPI.getGame(onchainGameId)
        if (data?.game) {
          const gameData = data.game

          // Update game status
          if (gameData.status === 'COMPLETED') {
            const winnerColor = gameData.winner === ethAddress ? playerColor : (playerColor === 'w' ? 'b' : 'w')
            setGameOver({
              winner: winnerColor === 'w' ? 'White' : 'Black',
              reason: gameData.chessBoard?.isCheckmate ? 'Checkmate' : 'Game Over',
            })
            // Refresh profile when game completes
            setTimeout(() => refreshProfile(), 1000)
            return
          }

          // Sync board state from blockchain if opponent made a move
          if (gameData.chessBoard?.moveHistory) {
            const onchainMoves = gameData.chessBoard.moveHistory.length
            const localMoves = moveHistory.length

            if (onchainMoves > localMoves) {
              // Replay moves to sync state
              const newGame = new Chess()
              for (const move of gameData.chessBoard.moveHistory) {
                const fromFile = String.fromCharCode(97 + (move.fromSquare % 8))
                const fromRank = Math.floor(move.fromSquare / 8) + 1
                const toFile = String.fromCharCode(97 + (move.toSquare % 8))
                const toRank = Math.floor(move.toSquare / 8) + 1
                const from = `${fromFile}${fromRank}` as Square
                const to = `${toFile}${toRank}` as Square

                newGame.move({ from, to, promotion: move.promotion?.toLowerCase() || 'q' })
              }

              setGame(newGame)
              setMoveHistory(gameData.chessBoard.moveHistory.map((m: any) => m.notation))
              setCurrentTurn(newGame.turn())

              // Check for game over
              if (newGame.isGameOver()) {
                let winner = 'Draw'
                let reason = ''

                if (newGame.isCheckmate()) {
                  winner = newGame.turn() === 'w' ? 'Black' : 'White'
                  reason = 'Checkmate'
                } else if (newGame.isDraw()) {
                  reason = 'Draw'
                }

                setGameOver({ winner, reason })
                // Refresh profile when game completes
                setTimeout(() => refreshProfile(), 1000)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error polling game:', error)
      }
    }

    pollGame() // Initial poll
    const interval = setInterval(pollGame, 2000)

    return () => clearInterval(interval)
  }, [mode, onchainGameId, gameOver, moveHistory.length, ethAddress, playerColor])

  // Timer effect
  useEffect(() => {
    if (gameOver || showDifficultyModal || showThemeModal) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = { ...prev }
        newTime[currentTurn] = Math.max(0, newTime[currentTurn] - 1)

        if (newTime[currentTurn] === 0) {
          setGameOver({
            winner: currentTurn === 'w' ? 'Black' : 'White',
            reason: 'Time out',
          })
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentTurn, gameOver, showDifficultyModal])

  // Get square color
  const getSquareColor = (row: number, col: number) => {
    return (row + col) % 2 === 0 ? 'light' : 'dark'
  }

  // Get piece at square
  const getPiece = (square: string) => {
    const piece = game.get(square as Square)
    if (!piece) return null
    return pieceSymbols[`${piece.color}${piece.type}`]
  }

  // Handle square click
  const handleSquareClick = (square: string) => {
    if (gameOver || isThinking || waitingForOpponent) return
    // Only allow moves on your turn for bot and friend modes
    if ((mode === 'bot' || mode === 'friend') && game.turn() !== playerColor) return

    const piece = game.get(square as Square)

    // If a piece is already selected
    if (selectedSquare) {
      // Try to make a move
      const move = validMoves.find((m) => m === square)
      if (move) {
        makeMove(selectedSquare, square)
      } else if (piece && piece.color === game.turn()) {
        // Select new piece
        selectPiece(square)
      } else {
        // Deselect
        setSelectedSquare(null)
        setValidMoves([])
      }
    } else if (piece && piece.color === game.turn()) {
      selectPiece(square)
    }
  }

  // Select piece and show valid moves
  const selectPiece = (square: string) => {
    const moves = game.moves({ square: square as Square, verbose: true })
    setSelectedSquare(square)
    setValidMoves(moves.map((m) => m.to))
  }

  // Convert algebraic square to index (0-63)
  const squareToIndex = (square: string): number => {
    const file = square.charCodeAt(0) - 97 // 'a' = 0
    const rank = parseInt(square[1]) - 1   // '1' = 0
    return rank * 8 + file
  }

  // Make a move - stores on chain
  const makeMove = async (from: string, to: string) => {
    try {
      const move = game.move({ from: from as Square, to: to as Square, promotion: 'q' })
      if (!move) return

      const newGame = new Chess(game.fen())
      setGame(newGame)
      setMoveHistory([...moveHistory, move.san])
      setSelectedSquare(null)
      setValidMoves([])
      setCurrentTurn(newGame.turn())

      // Store move on blockchain for all modes (friend, bot)
      if ((mode === 'friend' || mode === 'bot') && onchainGameId) {
        const fromIndex = squareToIndex(from)
        const toIndex = squareToIndex(to)
        const promotion = move.promotion || null

        // Fire and forget - don't block the UI for chain storage
        GameAPI.makeChessMove(onchainGameId, fromIndex, toIndex, promotion)
          .then(() => {
            console.log('Move stored on chain:', move.san)
          })
          .catch((error) => {
            console.error('Failed to store move on chain:', error)
            // Don't show error to user - move is already made locally
          })
      }

      // Check game over
      if (newGame.isGameOver()) {
        let winner = 'Draw'
        let reason = ''
        let playerWon = false

        if (newGame.isCheckmate()) {
          winner = newGame.turn() === 'w' ? 'Black' : 'White'
          reason = 'Checkmate'
          // Player wins if the losing side (whose turn it is) is not the player
          playerWon = (newGame.turn() !== playerColor)
        } else if (newGame.isDraw()) {
          if (newGame.isStalemate()) reason = 'Stalemate'
          else if (newGame.isThreefoldRepetition()) reason = 'Threefold repetition'
          else if (newGame.isInsufficientMaterial()) reason = 'Insufficient material'
          else reason = '50-move rule'
        }

        setGameOver({ winner, reason })

        // Record bot game result to blockchain
        if (mode === 'bot') {
          recordGameResult(playerWon, moveHistory.length + 1)
        }
        return
      }

      // Bot move
      if (mode === 'bot' && newGame.turn() !== playerColor) {
        await makeBotMove(newGame)
      }
    } catch (error) {
      console.error('Invalid move:', error)
    }
  }

  // Bot move using Gemini AI
  const makeBotMove = async (currentGame: Chess) => {
    setIsThinking(true)

    try {
      const legalMoves = currentGame.moves()

      // For easy mode or as fallback, use random move
      if (difficulty === 'easy' || legalMoves.length === 0) {
        await new Promise((r) => setTimeout(r, 500))
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        currentGame.move(randomMove)
      } else {
        // Use Gemini AI for medium/hard
        const prompt = `You are a chess AI playing as ${currentGame.turn() === 'w' ? 'White' : 'Black'}.
Current position (FEN): ${currentGame.fen()}
Legal moves: ${legalMoves.join(', ')}
Difficulty: ${difficulty}

${difficulty === 'medium' ? 'Play a good but not perfect move.' : 'Play the best possible move.'}

Respond with ONLY the move in algebraic notation (e.g., "e4", "Nf3", "O-O"). Nothing else.`

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: difficulty === 'medium' ? 0.7 : 0.2, maxOutputTokens: 10 },
            }),
          }
        )

        const data = await response.json()
        const aiMove = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        // Validate AI move
        if (aiMove && legalMoves.includes(aiMove)) {
          await new Promise((r) => setTimeout(r, 800))
          currentGame.move(aiMove)
        } else {
          // Fallback to random move
          const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
          await new Promise((r) => setTimeout(r, 500))
          currentGame.move(randomMove)
        }
      }

      const newGame = new Chess(currentGame.fen())
      setGame(newGame)
      setMoveHistory([...moveHistory, currentGame.history().slice(-1)[0]])
      setCurrentTurn(newGame.turn())

      // Check game over after bot move
      if (newGame.isGameOver()) {
        let winner = 'Draw'
        let reason = ''
        let playerWon = false

        if (newGame.isCheckmate()) {
          winner = newGame.turn() === 'w' ? 'Black' : 'White'
          reason = 'Checkmate'
          // Player loses if it's their turn and they're in checkmate
          playerWon = (newGame.turn() !== playerColor)
        } else if (newGame.isDraw()) {
          reason = 'Draw'
        }

        setGameOver({ winner, reason })

        // Record bot game result
        recordGameResult(playerWon, moveHistory.length + 1)
      }
    } catch (error) {
      console.error('Bot error:', error)
      // Fallback to random move
      const legalMoves = currentGame.moves()
      if (legalMoves.length > 0) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        currentGame.move(randomMove)
        setGame(new Chess(currentGame.fen()))
        setMoveHistory([...moveHistory, currentGame.history().slice(-1)[0]])
      }
    }

    setIsThinking(false)
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Record game result to blockchain
  const recordGameResult = async (won: boolean, moves: number) => {
    if (!ethAddress) {
      console.error('No eth address found for recording game')
      return
    }
    try {
      console.log('Recording game result:', { won, moves, ethAddress })
      // Chess = 0, Poker = 1, Blackjack = 2
      await GameAPI.recordBotGame(0, won, moves, ethAddress)
      showToast(won ? 'Victory recorded on-chain!' : 'Game recorded on-chain', 'success')
      // Refresh profile to show updated stats
      setTimeout(() => refreshProfile(), 2000)
    } catch (error) {
      console.error('Failed to record game:', error)
      showToast('Failed to record game on blockchain', 'error')
    }
  }

  // Resign
  const handleResign = async () => {
    setGameOver({
      winner: playerColor === 'w' ? 'Black' : 'White',
      reason: 'Resignation',
    })

    // Record to blockchain based on mode
    if (mode === 'bot') {
      // Record loss on resignation for bot game
      recordGameResult(false, moveHistory.length)
    } else if (mode === 'friend' && onchainGameId) {
      // Resign on blockchain for friend game
      try {
        await GameAPI.resignGame(onchainGameId)
        showToast('Game resigned on blockchain', 'info')
      } catch (error) {
        console.error('Failed to resign on blockchain:', error)
        showToast('Failed to record resignation on blockchain', 'error')
      }
    }
  }

  // New game
  const handleNewGame = () => {
    setGame(new Chess())
    setMoveHistory([])
    setSelectedSquare(null)
    setValidMoves([])
    setGameOver(null)
    setTimeLeft({ w: 300, b: 300 })
    setCurrentTurn('w')
    if (mode === 'bot') {
      setShowDifficultyModal(true)
    }
  }

  // Start game with difficulty - create on-chain game for bot mode
  const startGame = async (diff: 'easy' | 'medium' | 'hard') => {
    setDifficulty(diff)
    setShowDifficultyModal(false)
    setPlayerColor('w')
    
    // Create on-chain game for bot mode
    if (mode === 'bot') {
      setCreatingGame(true)
      try {
        showToast('Creating game on blockchain...', 'info')

        // Create game on-chain with VS_BOT mode
        await GameAPI.createGame('CHESS', 'VS_BOT', null, 300)
        
        // Poll for the newly created game ID
        let attempts = 0
        const maxAttempts = 15
        let foundGameId: string | null = null
        
        while (attempts < maxAttempts && !foundGameId) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          try {
            const data = await GameAPI.getPlayerActiveGamesByEth(ethAddress || '')
            if (data?.playerActiveGamesByEth && data.playerActiveGamesByEth.length > 0) {
              // Find the most recent CHESS VS_BOT game
              const botGames = data.playerActiveGamesByEth.filter((g: any) => 
                g.gameType === 'CHESS' && g.gameMode === 'VS_BOT' && g.status === 'IN_PROGRESS'
              )
              if (botGames.length > 0) {
                // Sort by createdAt descending and take the most recent
                botGames.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
                foundGameId = botGames[0].gameId
                setOnchainGameId(foundGameId)
                showToast('Game created on-chain!', 'success')
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
        }
      } catch (error) {
        console.error('Error creating game:', error)
        showToast('Failed to create game on blockchain', 'error')
      } finally {
        setCreatingGame(false)
      }
    }
    
    // Initialize local game state
    setGame(new Chess())
    setMoveHistory([])
    setGameOver(null)
  }

  // Render board
  const renderBoard = () => {
    const squares = []
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const ranks = playerColor === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
    const fileOrder = playerColor === 'w' ? files : [...files].reverse()

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const square = `${fileOrder[f]}${ranks[r]}`
        const piece = getPiece(square)
        const isSelected = selectedSquare === square
        const isValidMove = validMoves.includes(square)
        const hasPiece = game.get(square as Square)
        const isCheck = game.isCheck() && hasPiece?.type === 'k' && hasPiece?.color === game.turn()

        squares.push(
          <div
            key={square}
            onClick={() => handleSquareClick(square)}
            className={`chess-square ${getSquareColor(r, f)} ${isSelected ? 'selected' : ''} ${
              isValidMove ? (hasPiece ? 'valid-capture' : 'valid-move') : ''
            } ${isCheck ? 'ring-4 ring-red-500' : ''}`}
          >
            {piece && (
              <span className={`chess-piece ${hasPiece?.color === 'w' ? 'white' : 'black'}`}>
                {piece}
              </span>
            )}
          </div>
        )
      }
    }

    return squares
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Theme Selection Modal */}
      {showThemeModal && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up">
            <h2 className="text-xl font-bold mb-4 text-center">Choose Board Theme</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setBoardTheme('classic')
                  setShowThemeModal(false)
                }}
                className={`p-4 rounded-lg transition-colors border-2 ${
                  boardTheme === 'classic'
                    ? 'bg-amber-600 border-amber-400'
                    : 'bg-surface-700 border-surface-600 hover:bg-surface-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #f0d9b5 0%, #eed4a8 100%)' }}></div>
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #b58863 0%, #a67c52 100%)' }}></div>
                </div>
                <div className="font-bold text-sm">Classic</div>
              </button>
              <button
                onClick={() => {
                  setBoardTheme('green')
                  setShowThemeModal(false)
                }}
                className={`p-4 rounded-lg transition-colors border-2 ${
                  boardTheme === 'green'
                    ? 'bg-green-600 border-green-400'
                    : 'bg-surface-700 border-surface-600 hover:bg-surface-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}></div>
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)' }}></div>
                </div>
                <div className="font-bold text-sm">Green</div>
              </button>
              <button
                onClick={() => {
                  setBoardTheme('blue')
                  setShowThemeModal(false)
                }}
                className={`p-4 rounded-lg transition-colors border-2 ${
                  boardTheme === 'blue'
                    ? 'bg-blue-600 border-blue-400'
                    : 'bg-surface-700 border-surface-600 hover:bg-surface-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}></div>
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)' }}></div>
                </div>
                <div className="font-bold text-sm">Blue</div>
              </button>
              <button
                onClick={() => {
                  setBoardTheme('purple')
                  setShowThemeModal(false)
                }}
                className={`p-4 rounded-lg transition-colors border-2 ${
                  boardTheme === 'purple'
                    ? 'bg-purple-600 border-purple-400'
                    : 'bg-surface-700 border-surface-600 hover:bg-surface-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' }}></div>
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #ba68c8 0%, #ab47bc 100%)' }}></div>
                </div>
                <div className="font-bold text-sm">Purple</div>
              </button>
              <button
                onClick={() => {
                  setBoardTheme('dark')
                  setShowThemeModal(false)
                }}
                className={`p-4 rounded-lg transition-colors border-2 col-span-2 ${
                  boardTheme === 'dark'
                    ? 'bg-gray-700 border-gray-400'
                    : 'bg-surface-700 border-surface-600 hover:bg-surface-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #616161 0%, #424242 100%)' }}></div>
                  <div className="w-8 h-8 rounded" style={{ background: 'linear-gradient(135deg, #212121 0%, #000000 100%)' }}></div>
                </div>
                <div className="font-bold text-sm">Dark</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty Modal */}
      {showDifficultyModal && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up">
            <h2 className="text-xl font-bold mb-4 text-center">Select Difficulty</h2>
            <div className="space-y-3">
              <button
                onClick={() => startGame('easy')}
                className="w-full p-4 rounded-lg bg-green-600 hover:bg-green-700 transition-colors"
              >
                <div className="font-bold">Easy</div>
                <div className="text-sm opacity-80">Random moves</div>
              </button>
              <button
                onClick={() => startGame('medium')}
                className="w-full p-4 rounded-lg bg-yellow-600 hover:bg-yellow-700 transition-colors"
              >
                <div className="font-bold">Medium</div>
                <div className="text-sm opacity-80">Gemini AI - Balanced</div>
              </button>
              <button
                onClick={() => startGame('hard')}
                className="w-full p-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              >
                <div className="font-bold">Hard</div>
                <div className="text-sm opacity-80">Gemini AI - Best moves</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for Opponent Modal */}
      {waitingForOpponent && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold mb-2">Waiting for Opponent</h2>
            <p className="text-gray-400 mb-4">Share this link with a friend to start the game</p>
            <div className="bg-surface-700 rounded-lg p-3 mb-4">
              <code className="text-sm break-all text-primary-400">
                {`${window.location.origin}/join/${lobbyId}`}
              </code>
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/join/${lobbyId}`)
                  showToast('Link copied!', 'success')
                } catch {
                  showToast('Failed to copy link', 'error')
                }
              }}
              className="btn-game btn-primary mb-3 w-full"
            >
              Copy Link
            </button>
            <button
              onClick={() => navigate('/play')}
              className="btn-game btn-secondary w-full"
            >
              Cancel Lobby
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
              Checking for opponent...
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="modal-backdrop">
          <div className="bg-surface-800 rounded-xl p-6 max-w-md w-full mx-4 border border-surface-700 animate-slide-up text-center">
            <div className="text-6xl mb-4">{gameOver.winner === 'Draw' ? '🤝' : '🏆'}</div>
            <h2 className="text-2xl font-bold mb-2">
              {gameOver.winner === 'Draw' ? 'Draw!' : `${gameOver.winner} Wins!`}
            </h2>
            <p className="text-gray-400 mb-6">{gameOver.reason}</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/play')} className="flex-1 btn-game btn-secondary">
                Back to Menu
              </button>
              <button onClick={handleNewGame} className="flex-1 btn-game btn-primary">
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
        <h1 className="text-2xl font-bold">
          Chess {mode === 'bot' && `vs AI (${difficulty})`}
          {mode === 'local' && '(Local)'}
          {mode === 'friend' && '(vs Friend)'}
        </h1>
        <div className="w-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Board */}
        <div className="lg:col-span-2">
          {/* Opponent Timer */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center">
                {mode === 'bot' ? '🤖' : '👤'}
              </div>
              <div>
                <div className="font-medium">
                  {mode === 'bot' ? 'AI Bot' : mode === 'friend' ? (opponentName || 'Opponent') : 'Player 2'}
                </div>
                <div className="text-sm text-gray-400">
                  {playerColor === 'w' ? 'Black' : 'White'}
                </div>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-lg font-mono text-xl ${
                currentTurn !== playerColor ? 'bg-primary-600' : 'bg-surface-700'
              }`}
            >
              {formatTime(playerColor === 'w' ? timeLeft.b : timeLeft.w)}
            </div>
          </div>

          {/* Chess Board */}
          <div className="w-full max-w-[560px] mx-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Chess Board</h3>
              <button
                onClick={() => setShowThemeModal(true)}
                className="px-3 py-1 text-sm bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors"
              >
                🎨 Change Theme
              </button>
            </div>
            <div
              className={`chess-board-theme-${boardTheme} grid grid-cols-8 border-4 border-surface-600 rounded-lg overflow-hidden shadow-xl`}
              style={{
                aspectRatio: '1',
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gridTemplateRows: 'repeat(8, 1fr)'
              }}
            >
              {renderBoard()}
            </div>
          </div>

          {/* Player Timer */}
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center font-bold">
                {userProfile?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{userProfile?.username}</div>
                <div className="text-sm text-gray-400">
                  {playerColor === 'w' ? 'White' : 'Black'}
                </div>
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-lg font-mono text-xl ${
                currentTurn === playerColor ? 'bg-primary-600' : 'bg-surface-700'
              }`}
            >
              {formatTime(playerColor === 'w' ? timeLeft.w : timeLeft.b)}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
            <div className="text-center">
              {isThinking ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="spinner w-5 h-5" />
                  <span>AI is thinking...</span>
                </div>
              ) : game.isCheck() ? (
                <span className="text-red-400 font-bold">Check!</span>
              ) : (
                <span>
                  {currentTurn === playerColor ? 'Your turn' : "Opponent's turn"}
                </span>
              )}
            </div>
          </div>

          {/* Move History */}
          <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
            <h3 className="font-semibold mb-3">Move History</h3>
            <div className="max-h-64 overflow-y-auto">
              {moveHistory.length === 0 ? (
                <p className="text-gray-400 text-sm">No moves yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {moveHistory.map((move, i) => (
                    <div
                      key={i}
                      className={`px-2 py-1 rounded ${
                        i % 2 === 0 ? 'bg-surface-700' : ''
                      }`}
                    >
                      {i % 2 === 0 && <span className="text-gray-400">{Math.floor(i / 2) + 1}. </span>}
                      {move}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={handleResign} className="w-full btn-game btn-danger" disabled={!!gameOver}>
              Resign
            </button>
            <button onClick={handleNewGame} className="w-full btn-game btn-secondary">
              New Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
