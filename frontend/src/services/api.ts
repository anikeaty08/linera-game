// Linera Game Platform API Service
// Simple HTTP GraphQL client for localhost development
// All game data stored on-chain

// Configuration
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || '81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9';
const APP_ID = import.meta.env.VITE_APP_ID || '718c8da4131a55bc33fcd2d9547c96e93040b227b221acc67b80fad9151b35df';
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || `http://localhost:8080/chains/${CHAIN_ID}/applications/${APP_ID}`;

export const CONFIG = {
    chainId: CHAIN_ID,
    appId: APP_ID,
    endpoint: GRAPHQL_ENDPOINT,
    pollingInterval: 2000,
};

/**
 * Execute a GraphQL query using HTTP fetch
 */
async function graphqlQuery(query: string, variables: any = {}): Promise<any> {
    try {
        console.log('GraphQL Query:', { query: query.substring(0, 100) + '...', variables });
        
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('GraphQL Response:', result);

        if (result.errors) {
            const errorMsg = result.errors[0]?.message || 'GraphQL error';
            throw new Error(errorMsg);
        }

        return result.data || result;
    } catch (error: any) {
        console.error('GraphQL query failed:', error);
        throw error;
    }
}

/**
 * Execute a GraphQL mutation using HTTP fetch
 */
async function graphqlMutation(mutation: string, variables: any = {}): Promise<any> {
    try {
        console.log('GraphQL Mutation:', { mutation: mutation.substring(0, 100) + '...', variables });
        
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: mutation,
                variables,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('GraphQL Mutation Response:', result);

        if (result.errors) {
            const errorMsg = result.errors[0]?.message || 'Mutation error';
            throw new Error(errorMsg);
        }

        return result.data || result;
    } catch (error: any) {
        console.error('GraphQL mutation failed:', error);
        throw error;
    }
}

// ============ GAME API ============
export const GameAPI = {
    // Configuration
    config: CONFIG,

    // Get client status (simplified for localhost)
    getStatus: () => ({
        isInitialized: true,
        endpoint: GRAPHQL_ENDPOINT,
        config: CONFIG,
    }),

    // Reset client (no-op for HTTP)
    reset: () => {
        // No state to reset for HTTP client
    },

    // Check connection to the GraphQL endpoint
    async checkConnection() {
        try {
            const data = await graphqlQuery(`
                query {
                    totalUsers
                    totalGamesPlayed
                }
            `);
            return { connected: true, data };
        } catch (error: any) {
            return { connected: false, error: error.message };
        }
    },

    // ============ USER OPERATIONS ============

    // Register user profile on-chain
    async registerUser(username: string, ethAddress: string, avatarUrl: string = '') {
        return graphqlMutation(`
            mutation {
                registerUser(username: "${username}", ethAddress: "${ethAddress}", avatarUrl: "${avatarUrl}")
            }
        `);
    },

    // Update user profile
    async updateProfile(username: string, avatarUrl: string) {
        return graphqlMutation(`
            mutation {
                updateProfile(username: "${username || ''}", avatarUrl: "${avatarUrl || ''}")
            }
        `);
    },

    // Get user profile from chain
    async getUserProfile(ownerAddress: string) {
        return graphqlQuery(`
            query {
                userProfile(owner: "${ownerAddress}") {
                    username
                    ethAddress
                    avatarUrl
                    createdAt
                    lastActive
                    chessWins
                    chessLosses
                    chessDraws
                    chessElo
                    pokerWins
                    pokerLosses
                    pokerChipsWon
                    blackjackWins
                    blackjackLosses
                    blackjackPushes
                    totalGames
                    currentStreak
                    bestStreak
                }
            }
        `);
    },

    // Get user by ETH address
    async getUserByEthAddress(ethAddress: string) {
        const query = `
            query {
                userByEthAddress(ethAddress: "${ethAddress}") {
                    username
                    ethAddress
                    avatarUrl
                    createdAt
                    lastActive
                    chessWins
                    chessLosses
                    chessDraws
                    chessElo
                    pokerWins
                    pokerLosses
                    pokerChipsWon
                    blackjackWins
                    blackjackLosses
                    blackjackPushes
                    totalGames
                    currentStreak
                    bestStreak
                }
            }
        `;
        
        console.log('🔍 Sending query:', query);
        const result = await graphqlQuery(query);
        console.log('📦 Got result:', result);
        return result;
    },

    // Get user by username
    async getUserByUsername(username: string) {
        return graphqlQuery(`
            query {
                userByUsername(username: "${username}") {
                    username
                    ethAddress
                    avatarUrl
                    chessWins
                    chessLosses
                    chessElo
                    totalGames
                }
            }
        `);
    },

    // Check username availability
    async isUsernameAvailable(username: string) {
        const data = await graphqlQuery(`
            query {
                isUsernameAvailable(username: "${username}")
            }
        `);
        return data?.isUsernameAvailable ?? true;
    },

    // Get player stats
    async getPlayerStats(ownerAddress: string) {
        return graphqlQuery(`
            query {
                playerStats(owner: "${ownerAddress}") {
                    chessWins
                    chessLosses
                    chessDraws
                    chessElo
                    pokerWins
                    pokerLosses
                    pokerChipsWon
                    blackjackWins
                    blackjackLosses
                    blackjackPushes
                    totalGames
                    currentStreak
                    bestStreak
                }
            }
        `);
    },

    // ============ LOBBY OPERATIONS ============

    // Create a lobby
    async createLobby(gameType: number, gameMode: number, isPublic: boolean = true, password: string | null = null, timeControl: number = 300) {
        const passwordStr = password ? `"${password}"` : 'null';
        return graphqlMutation(`
            mutation {
                createLobby(
                    gameType: ${gameType}
                    gameMode: ${gameMode}
                    isPublic: ${isPublic}
                    password: ${passwordStr}
                    timeControl: ${timeControl}
                )
            }
        `);
    },

    // Join a lobby
    async joinLobby(lobbyId: string, password: string | null = null) {
        const passwordStr = password ? `"${password}"` : 'null';
        return graphqlMutation(`
            mutation {
                joinLobby(lobbyId: "${lobbyId}", password: ${passwordStr})
            }
        `);
    },

    // Cancel a lobby
    async cancelLobby(lobbyId: string) {
        return graphqlMutation(`
            mutation {
                cancelLobby(lobbyId: "${lobbyId}")
            }
        `);
    },

    // Get lobby info
    async getLobby(lobbyId: string) {
        return graphqlQuery(`
            query {
                lobby(lobbyId: "${lobbyId}") {
                    lobbyId
                    creator
                    creatorName
                    gameType
                    gameMode
                    isPublic
                    status
                    timeControl
                    createdAt
                    expiresAt
                    players
                    playerNames
                    gameId
                }
            }
        `);
    },

    // Get open lobbies
    async getOpenLobbies(gameType: number | null = null) {
        const gameTypeFilter = gameType ? `(gameType: ${gameType})` : '';
        return graphqlQuery(`
            query {
                openLobbies${gameTypeFilter} {
                    lobbyId
                    creator
                    creatorName
                    gameType
                    gameMode
                    isPublic
                    status
                    timeControl
                    createdAt
                    players
                }
            }
        `);
    },

    // Get player's lobbies
    async getPlayerLobbies(ownerAddress: string) {
        return graphqlQuery(`
            query {
                playerLobbies(owner: "${ownerAddress}") {
                    lobbyId
                    gameType
                    gameMode
                    status
                    createdAt
                    players
                    gameId
                }
            }
        `);
    },

    // ============ GAME OPERATIONS ============

    // Create a new game directly (vs bot or specific opponent)
    async createGame(gameType: number, gameMode: number, opponent: string | null = null, timeSeconds: number = 300) {
        const opponentStr = opponent ? `"${opponent}"` : 'null';
        return graphqlMutation(`
            mutation {
                createGame(
                    gameType: ${gameType}
                    gameMode: ${gameMode}
                    opponent: ${opponentStr}
                    timeSeconds: ${timeSeconds}
                )
            }
        `);
    },

    // Get game state by ID
    async getGame(gameId: string) {
        return graphqlQuery(`
            query {
                game(gameId: "${gameId}") {
                    gameId
                    gameType
                    gameMode
                    status
                    players
                    playerNames
                    createdAt
                    updatedAt
                    winner
                    drawOfferedBy
                    clock {
                        timeLeft
                        increment
                        currentTurnStart
                        blockDelay
                    }
                    chessBoard {
                        squares {
                            pieceType
                            owner
                            hasMoved
                        }
                        activePlayer
                        castlingRights {
                            whiteKingside
                            whiteQueenside
                            blackKingside
                            blackQueenside
                        }
                        enPassantSquare
                        halfmoveClock
                        fullmoveNumber
                        moveHistory {
                            fromSquare
                            toSquare
                            piece
                            captured
                            promotion
                            isCastle
                            isEnPassant
                            notation
                            timestamp
                        }
                        isCheck
                        isCheckmate
                        isStalemate
                        capturedWhite
                        capturedBlack
                    }
                    pokerGame {
                        playerHands {
                            rank
                            suit
                        }
                        communityCards {
                            rank
                            suit
                        }
                        pot
                        currentBet
                        playerBets
                        playerChips
                        activePlayer
                        stage
                        folded
                        allIn
                        actionHistory {
                            player
                            action
                            amount
                            stage
                            timestamp
                        }
                    }
                    blackjackGame {
                        playerHands {
                            rank
                            suit
                        }
                        dealerHand {
                            rank
                            suit
                        }
                        currentHand
                        bets
                        playerChips
                        isPlayerTurn
                        isGameOver
                        insuranceBet
                        results
                    }
                }
            }
        `);
    },

    // Get active games for a player
    async getPlayerActiveGames(ownerAddress: string) {
        return graphqlQuery(`
            query {
                playerActiveGames(owner: "${ownerAddress}") {
                    gameId
                    gameType
                    gameMode
                    opponent
                    opponentName
                    status
                    createdAt
                    updatedAt
                    winner
                }
            }
        `);
    },

    // Get active games for a player by ETH address
    async getPlayerActiveGamesByEth(ethAddress: string) {
        return graphqlQuery(`
            query {
                playerActiveGamesByEth(ethAddress: "${ethAddress}") {
                    gameId
                    gameType
                    gameMode
                    opponent
                    opponentName
                    status
                    createdAt
                    updatedAt
                    winner
                }
            }
        `);
    },

    // Get game history for a player
    async getPlayerGameHistory(ownerAddress: string, limit: number = 20) {
        return graphqlQuery(`
            query {
                playerGameHistory(owner: "${ownerAddress}", limit: ${limit}) {
                    gameId
                    gameType
                    gameMode
                    opponent
                    opponentName
                    status
                    createdAt
                    updatedAt
                    winner
                }
            }
        `);
    },

    // ============ CHESS OPERATIONS ============

    // Get chess board for a game
    async getChessBoard(gameId: string) {
        return graphqlQuery(`
            query {
                chessBoard(gameId: "${gameId}") {
                    squares {
                        pieceType
                        owner
                        hasMoved
                    }
                    activePlayer
                    castlingRights {
                        whiteKingside
                        whiteQueenside
                        blackKingside
                        blackQueenside
                    }
                    enPassantSquare
                    halfmoveClock
                    fullmoveNumber
                    moveHistory {
                        fromSquare
                        toSquare
                        piece
                        captured
                        promotion
                        isCastle
                        isEnPassant
                        notation
                        timestamp
                    }
                    isCheck
                    isCheckmate
                    isStalemate
                    capturedWhite
                    capturedBlack
                }
            }
        `);
    },

    // Make a chess move - stores move on chain
    async makeChessMove(gameId: string, fromSquare: number, toSquare: number, promotion: string | null = null) {
        const promotionStr = promotion ? `"${promotion}"` : 'null';
        return graphqlMutation(`
            mutation {
                chessMove(
                    gameId: "${gameId}"
                    fromSquare: ${fromSquare}
                    toSquare: ${toSquare}
                    promotion: ${promotionStr}
                )
            }
        `);
    },

    // ============ POKER OPERATIONS ============

    // Get poker game state
    async getPokerGame(gameId: string) {
        return graphqlQuery(`
            query {
                pokerGame(gameId: "${gameId}") {
                    playerHands {
                        rank
                        suit
                    }
                    communityCards {
                        rank
                        suit
                    }
                    pot
                    currentBet
                    playerBets
                    playerChips
                    activePlayer
                    stage
                    dealer
                    folded
                    allIn
                    lastRaiser
                    actionHistory {
                        player
                        action
                        amount
                        stage
                        timestamp
                    }
                    roundComplete
                    smallBlind
                    bigBlind
                }
            }
        `);
    },

    // Make a poker action - stores action on chain
    async pokerAction(gameId: string, action: string, betAmount: number | null = null) {
        const betStr = betAmount !== null ? betAmount : 'null';
        return graphqlMutation(`
            mutation {
                pokerAction(
                    gameId: "${gameId}"
                    action: "${action}"
                    betAmount: ${betStr}
                )
            }
        `);
    },

    // ============ BLACKJACK OPERATIONS ============

    // Get blackjack game state
    async getBlackjackGame(gameId: string) {
        return graphqlQuery(`
            query {
                blackjackGame(gameId: "${gameId}") {
                    playerHands {
                        rank
                        suit
                    }
                    dealerHand {
                        rank
                        suit
                    }
                    currentHand
                    bets
                    playerChips
                    isPlayerTurn
                    isGameOver
                    insuranceBet
                    results
                }
            }
        `);
    },

    // Make a blackjack action - stores action on chain
    async blackjackAction(gameId: string, action: string) {
        return graphqlMutation(`
            mutation {
                blackjackAction(gameId: "${gameId}", action: "${action}")
            }
        `);
    },

    // Place a blackjack bet
    async blackjackBet(gameId: string, amount: number) {
        return graphqlMutation(`
            mutation {
                blackjackBet(gameId: "${gameId}", amount: ${amount})
            }
        `);
    },

    // ============ GAME CONTROL ============

    // Resign from a game
    async resignGame(gameId: string) {
        return graphqlMutation(`
            mutation {
                resignGame(gameId: "${gameId}")
            }
        `);
    },

    // Offer a draw
    async offerDraw(gameId: string) {
        return graphqlMutation(`
            mutation {
                offerDraw(gameId: "${gameId}")
            }
        `);
    },

    // Accept a draw offer
    async acceptDraw(gameId: string) {
        return graphqlMutation(`
            mutation {
                acceptDraw(gameId: "${gameId}")
            }
        `);
    },

    // Claim timeout victory
    async claimTimeout(gameId: string) {
        return graphqlMutation(`
            mutation {
                claimTimeout(gameId: "${gameId}")
            }
        `);
    },

    // Record bot game result - updates stats on chain
    async recordBotGame(gameType: number, won: boolean, moves: number = 0, ethAddress: string) {
        return graphqlMutation(`
            mutation {
                recordBotGame(
                    gameType: ${gameType}
                    won: ${won}
                    moves: ${moves}
                    ethAddress: "${ethAddress}"
                )
            }
        `);
    },

    // ============ QUERIES ============

    // Check if it's a player's turn
    async isPlayerTurn(gameId: string, ownerAddress: string) {
        const data = await graphqlQuery(`
            query {
                isPlayerTurn(gameId: "${gameId}", owner: "${ownerAddress}")
            }
        `);
        return data?.isPlayerTurn ?? false;
    },

    // Get time remaining for both players
    async getTimeRemaining(gameId: string) {
        return graphqlQuery(`
            query {
                timeRemaining(gameId: "${gameId}")
            }
        `);
    },

    // Get game clock
    async getGameClock(gameId: string) {
        return graphqlQuery(`
            query {
                gameClock(gameId: "${gameId}") {
                    timeLeft
                    increment
                    currentTurnStart
                    blockDelay
                }
            }
        `);
    },

    // ============ LEADERBOARD ============

    // Get leaderboard
    async getLeaderboard(gameType: number | null = null, limit: number = 50) {
        const gameTypeFilter = gameType ? `gameType: ${gameType}, ` : '';
        return graphqlQuery(`
            query {
                leaderboard(${gameTypeFilter}limit: ${limit}) {
                    rank
                    username
                    ethAddress
                    wins
                    losses
                    winRate
                    elo
                    totalGames
                }
            }
        `);
    },

    // Get player rank
    async getPlayerRank(ownerAddress: string, gameType: number | null = null) {
        const gameTypeFilter = gameType ? `, gameType: ${gameType}` : '';
        return graphqlQuery(`
            query {
                playerRank(owner: "${ownerAddress}"${gameTypeFilter})
            }
        `);
    },

    // ============ GLOBAL STATS ============

    // Get total games played
    async getTotalGamesPlayed() {
        const data = await graphqlQuery(`
            query {
                totalGamesPlayed
            }
        `);
        return data?.totalGamesPlayed ?? 0;
    },

    // Get total users
    async getTotalUsers() {
        const data = await graphqlQuery(`
            query {
                totalUsers
            }
        `);
        return data?.totalUsers ?? 0;
    },
};

// ============ GAME STATE MANAGER ============
// Real-time game state polling with push notifications

export class GameStateManager {
    onUpdate: (data: any) => void;
    onError: ((error: any) => void) | undefined;
    polling: boolean;
    pollInterval: any;
    gameId: string | null;
    gameType: any;

    constructor(onUpdate: (data: any) => void, onError?: (error: any) => void) {
        this.onUpdate = onUpdate;
        this.onError = onError;
        this.polling = false;
        this.pollInterval = null;
        this.gameId = null;
        this.gameType = null;
    }

    startPolling(gameId: string, gameType: any) {
        if (this.polling && this.gameId === gameId) return;

        this.stopPolling();

        this.gameId = gameId;
        this.gameType = gameType;
        this.polling = true;

        console.log(`Starting game state polling for ${gameId}`);

        this.poll(); // Immediate first poll
        this.pollInterval = setInterval(() => this.poll(), CONFIG.pollingInterval);
    }

    stopPolling() {
        this.polling = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('Game state polling stopped');
    }

    async poll() {
        if (!this.polling || !this.gameId) return;

        try {
            const data = await GameAPI.getGame(this.gameId);

            if (this.onUpdate && data) {
                this.onUpdate(data);
            }
        } catch (error) {
            console.error('Polling error:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }
}

// ============ LOBBY MANAGER ============
// Manages lobby state and polling

export class LobbyManager {
    onUpdate: (data: any) => void;
    onError: ((error: any) => void) | undefined;
    polling: boolean;
    pollInterval: any;
    lobbyId: string | null;

    constructor(onUpdate: (data: any) => void, onError?: (error: any) => void) {
        this.onUpdate = onUpdate;
        this.onError = onError;
        this.polling = false;
        this.pollInterval = null;
        this.lobbyId = null;
    }

    startPolling(lobbyId: string) {
        if (this.polling && this.lobbyId === lobbyId) return;

        this.stopPolling();

        this.lobbyId = lobbyId;
        this.polling = true;

        console.log(`Starting lobby polling for ${lobbyId}`);

        this.poll(); // Immediate first poll
        this.pollInterval = setInterval(() => this.poll(), CONFIG.pollingInterval);
    }

    stopPolling() {
        this.polling = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async poll() {
        if (!this.polling || !this.lobbyId) return;

        try {
            const data = await GameAPI.getLobby(this.lobbyId);

            if (this.onUpdate && data) {
                this.onUpdate(data);
            }
        } catch (error) {
            console.error('Lobby polling error:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }
}

export default GameAPI;
