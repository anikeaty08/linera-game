// Game Platform State - Full blockchain storage

use async_graphql::SimpleObject;
use linera_sdk::{
    linera_base_types::AccountOwner,
    views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext},
};
use serde::{Deserialize, Serialize};

use game_platform::{
    BlackjackGame, ChessBoard, Clock, GameLobby, GameMode, GameStatus, GameType,
    LeaderboardEntry, Player, PokerGame, Timeouts, UserProfile,
};

// ============ GAME INFO ============

#[derive(Clone, Eq, PartialEq, Serialize, Deserialize, SimpleObject)]
pub struct GameInfo {
    pub game_id: String,
    pub game_type: GameType,
    pub game_mode: GameMode,
    pub opponent: String,
    pub opponent_name: String,
    pub status: GameStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub winner: Option<Player>,
}

// ============ FULL GAME STATE ============

#[derive(Clone, Serialize, Deserialize, SimpleObject)]
pub struct FullGameState {
    pub game_id: String,
    pub game_type: GameType,
    pub game_mode: GameMode,
    pub status: GameStatus,
    pub players: Vec<String>,
    pub player_names: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub winner: Option<Player>,
    pub clock: Clock,
    pub draw_offered_by: Option<Player>,
    // Game-specific state
    pub chess_board: Option<ChessBoard>,
    pub poker_game: Option<PokerGame>,
    pub blackjack_game: Option<BlackjackGame>,
}

// ============ PLAYER STATS ============

#[derive(Clone, Default, Serialize, Deserialize, SimpleObject)]
pub struct PlayerStats {
    // Chess
    pub chess_wins: u32,
    pub chess_losses: u32,
    pub chess_draws: u32,
    pub chess_elo: u32,
    // Poker
    pub poker_wins: u32,
    pub poker_losses: u32,
    pub poker_chips_won: i64,
    // Blackjack
    pub blackjack_wins: u32,
    pub blackjack_losses: u32,
    pub blackjack_pushes: u32,
    // Overall
    pub total_games: u32,
    pub current_streak: i32,
    pub best_streak: u32,
}

#[allow(dead_code)]
impl PlayerStats {
    pub fn record_win(&mut self, game_type: GameType) {
        match game_type {
            GameType::Chess => self.chess_wins += 1,
            GameType::Poker => self.poker_wins += 1,
            GameType::Blackjack => self.blackjack_wins += 1,
        }
        self.total_games += 1;

        if self.current_streak >= 0 {
            self.current_streak += 1;
        } else {
            self.current_streak = 1;
        }

        if self.current_streak > self.best_streak as i32 {
            self.best_streak = self.current_streak as u32;
        }
    }

    pub fn record_loss(&mut self, game_type: GameType) {
        match game_type {
            GameType::Chess => self.chess_losses += 1,
            GameType::Poker => self.poker_losses += 1,
            GameType::Blackjack => self.blackjack_losses += 1,
        }
        self.total_games += 1;

        if self.current_streak <= 0 {
            self.current_streak -= 1;
        } else {
            self.current_streak = -1;
        }
    }

    pub fn record_draw(&mut self, game_type: GameType) {
        match game_type {
            GameType::Chess => self.chess_draws += 1,
            GameType::Poker => {}
            GameType::Blackjack => self.blackjack_pushes += 1,
        }
        self.total_games += 1;
        self.current_streak = 0;
    }

    pub fn update_elo(&mut self, delta: i32) {
        self.chess_elo = ((self.chess_elo as i32) + delta).max(100) as u32;
    }

    pub fn win_rate(&self) -> f64 {
        let total_wins = self.chess_wins + self.poker_wins + self.blackjack_wins;
        if self.total_games == 0 {
            0.0
        } else {
            (total_wins as f64 / self.total_games as f64) * 100.0
        }
    }
}

// ============ ROOT STATE ============

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct GamePlatformState {
    // User profiles (AccountOwner -> UserProfile)
    pub user_profiles: MapView<AccountOwner, UserProfile>,

    // ETH address to AccountOwner mapping
    pub eth_to_owner: MapView<String, AccountOwner>,

    // Username to AccountOwner mapping (for lookups)
    pub username_to_owner: MapView<String, AccountOwner>,

    // Player statistics
    pub stats: MapView<AccountOwner, PlayerStats>,

    // Active games (GameId -> FullGameState)
    pub games: MapView<String, FullGameState>,

    // Games by player (AccountOwner -> Vec<GameId>)
    pub player_games: MapView<AccountOwner, Vec<String>>,

    // Game lobbies (LobbyId -> GameLobby)
    pub lobbies: MapView<String, GameLobby>,

    // Active lobbies list
    pub active_lobby_ids: RegisterView<Vec<String>>,

    // Leaderboard entries (cached, updated on game completion)
    pub leaderboard: RegisterView<Vec<LeaderboardEntry>>,

    // Global counters
    pub total_games_played: RegisterView<u64>,
    pub total_users: RegisterView<u64>,

    // Current timeouts setting
    pub default_timeouts: RegisterView<Timeouts>,
}
