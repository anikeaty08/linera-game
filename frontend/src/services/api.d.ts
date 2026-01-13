
export const GameAPI: {
    config: any;
    getStatus: () => any;
    reset: () => void;
    checkConnection: () => Promise<{ connected: boolean; data?: any; error?: string }>;

    // User Operations
    registerUser: (username: string, ethAddress: string, avatarUrl?: string) => Promise<any>;
    updateProfile: (username: string, avatarUrl: string) => Promise<any>;
    getUserProfile: (ownerAddress: string) => Promise<any>;
    getUserByEthAddress: (ethAddress: string) => Promise<any>;
    getUserByUsername: (username: string) => Promise<any>;
    isUsernameAvailable: (username: string) => Promise<boolean>;
    getPlayerStats: (ownerAddress: string) => Promise<any>;

    // Lobby Operations
    createLobby: (gameType: number, gameMode: number, isPublic?: boolean, password?: string | null, timeControl?: number) => Promise<any>;
    joinLobby: (lobbyId: string, password?: string | null) => Promise<any>;
    cancelLobby: (lobbyId: string) => Promise<any>;
    getLobby: (lobbyId: string) => Promise<any>;
    getOpenLobbies: (gameType?: number | null) => Promise<any>;
    getPlayerLobbies: (ownerAddress: string) => Promise<any>;

    // Game Operations
    createGame: (gameType: number, gameMode: number, opponent?: string | null, timeSeconds?: number) => Promise<any>;
    getGame: (gameId: string) => Promise<any>;
    getPlayerActiveGames: (ownerAddress: string) => Promise<any>;
    getPlayerActiveGamesByEth: (ethAddress: string) => Promise<any>;
    getPlayerGameHistory: (ownerAddress: string, limit?: number) => Promise<any>;

    // Chess Operations
    getChessBoard: (gameId: string) => Promise<any>;
    makeChessMove: (gameId: string, fromSquare: number, toSquare: number, promotion?: string | null) => Promise<any>;

    // Poker Operations
    getPokerGame: (gameId: string) => Promise<any>;
    pokerAction: (gameId: string, action: string, betAmount?: number | null) => Promise<any>;

    // Blackjack Operations
    getBlackjackGame: (gameId: string) => Promise<any>;
    blackjackAction: (gameId: string, action: string) => Promise<any>;
    blackjackBet: (gameId: string, amount: number) => Promise<any>;

    // Game Control
    resignGame: (gameId: string) => Promise<any>;
    offerDraw: (gameId: string) => Promise<any>;
    acceptDraw: (gameId: string) => Promise<any>;
    claimTimeout: (gameId: string) => Promise<any>;
    recordBotGame: (gameType: number, won: boolean, moves: number, ethAddress: string) => Promise<any>;

    // Queries
    isPlayerTurn: (gameId: string, ownerAddress: string) => Promise<boolean>;
    getTimeRemaining: (gameId: string) => Promise<any>;
    getGameClock: (gameId: string) => Promise<any>;

    // Leaderboard
    getLeaderboard: (gameType?: number | null, limit?: number) => Promise<any>;
    getPlayerRank: (ownerAddress: string, gameType?: number | null) => Promise<any>;

    // Global Stats
    getTotalGamesPlayed: () => Promise<number>;
    getTotalUsers: () => Promise<number>;
};

export class GameStateManager {
    constructor(onUpdate: (data: any) => void, onError?: (error: any) => void);
    startPolling(gameId: string, gameType: any): void;
    stopPolling(): void;
    poll(): Promise<void>;
}

export class LobbyManager {
    constructor(onUpdate: (data: any) => void, onError?: (error: any) => void);
    startPolling(lobbyId: string): void;
    stopPolling(): void;
    poll(): Promise<void>;
}
