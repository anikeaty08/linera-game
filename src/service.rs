#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Request, Response, Schema};
use linera_sdk::{
    abi::WithServiceAbi,
    linera_base_types::{AccountOwner, TimeDelta},
    views::View,
    Service, ServiceRuntime,
};

use self::state::{FullGameState, GamePlatformState, GameInfo, PlayerStats};
use game_platform::{
    BlackjackGame, ChessBoard, Clock, GameLobby, GameMode, GameStatus, GameType,
    LeaderboardEntry, LobbyStatus, Operation, Player, PokerGame, Timeouts, UserProfile,
};

pub struct GamePlatformService {
    state: Arc<GamePlatformState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(GamePlatformService);

impl WithServiceAbi for GamePlatformService {
    type Abi = game_platform::GamePlatformAbi;
}

impl Service for GamePlatformService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = GamePlatformState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        GamePlatformService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(
            QueryRoot {
                state: self.state.clone(),
            },
            MutationRoot {
                runtime: self.runtime.clone(),
            },
            EmptySubscription,
        )
        .finish();

        schema.execute(request).await
    }
}

struct QueryRoot {
    state: Arc<GamePlatformState>,
}

#[Object]
impl QueryRoot {
    // ============ USER QUERIES ============

    /// Get user profile by Linera owner address
    async fn user_profile(&self, owner: String) -> Option<UserProfile> {
        let owner = parse_account_owner(&owner)?;
        self.state.user_profiles.get(&owner).await.ok().flatten()
    }

    /// Get user profile by ETH address
    async fn user_by_eth_address(&self, eth_address: String) -> Option<UserProfile> {
        let owner = self.state.eth_to_owner
            .get(&eth_address.to_lowercase())
            .await
            .ok()
            .flatten()?;
        self.state.user_profiles.get(&owner).await.ok().flatten()
    }

    /// Get user profile by username
    async fn user_by_username(&self, username: String) -> Option<UserProfile> {
        let owner = self.state.username_to_owner
            .get(&username.to_lowercase())
            .await
            .ok()
            .flatten()?;
        self.state.user_profiles.get(&owner).await.ok().flatten()
    }

    /// Get player statistics
    async fn player_stats(&self, owner: String) -> Option<PlayerStats> {
        let owner = parse_account_owner(&owner)?;
        self.state.stats.get(&owner).await.ok().flatten()
    }

    /// Check if username is available
    async fn is_username_available(&self, username: String) -> bool {
        self.state.username_to_owner
            .get(&username.to_lowercase())
            .await
            .ok()
            .flatten()
            .is_none()
    }

    // ============ GAME QUERIES ============

    /// Get game state by ID
    async fn game(&self, game_id: String) -> Option<FullGameState> {
        self.state.games.get(&game_id).await.ok().flatten()
    }

    /// Get active games for a player
    async fn player_active_games(&self, owner: String) -> Vec<GameInfo> {
        let owner = match parse_account_owner(&owner) {
            Some(o) => o,
            None => return vec![],
        };

        let game_ids = self.state.player_games
            .get(&owner)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let mut games = vec![];
        let owner_str = format!("{:?}", owner);

        for game_id in game_ids {
            if let Ok(Some(game)) = self.state.games.get(&game_id).await {
                if game.status == GameStatus::InProgress || game.status == GameStatus::WaitingForOpponent {
                    let opponent_idx = if game.players.get(0) == Some(&owner_str) { 1 } else { 0 };
                    games.push(GameInfo {
                        game_id: game.game_id,
                        game_type: game.game_type,
                        game_mode: game.game_mode,
                        opponent: game.players.get(opponent_idx).cloned().unwrap_or_default(),
                        opponent_name: game.player_names.get(opponent_idx).cloned().unwrap_or_default(),
                        status: game.status,
                        created_at: game.created_at,
                        updated_at: game.updated_at,
                        winner: game.winner,
                    });
                }
            }
        }

        games
    }

    /// Get active games for a player by ETH address
    async fn player_active_games_by_eth(&self, eth_address: String) -> Vec<GameInfo> {
        let owner = match self.state.eth_to_owner.get(&eth_address.to_lowercase()).await {
            Ok(Some(o)) => o,
            _ => return vec![],
        };

        let game_ids = self.state.player_games
            .get(&owner)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let mut games = vec![];
        let owner_str = format!("{:?}", owner);

        for game_id in game_ids {
            if let Ok(Some(game)) = self.state.games.get(&game_id).await {
                if game.status == GameStatus::InProgress || game.status == GameStatus::WaitingForOpponent {
                    let opponent_idx = if game.players.get(0) == Some(&owner_str) { 1 } else { 0 };
                    games.push(GameInfo {
                        game_id: game.game_id,
                        game_type: game.game_type,
                        game_mode: game.game_mode,
                        opponent: game.players.get(opponent_idx).cloned().unwrap_or_default(),
                        opponent_name: game.player_names.get(opponent_idx).cloned().unwrap_or_default(),
                        status: game.status,
                        created_at: game.created_at,
                        updated_at: game.updated_at,
                        winner: game.winner,
                    });
                }
            }
        }

        games
    }

    /// Get game history for a player
    async fn player_game_history(&self, owner: String, limit: i32) -> Vec<GameInfo> {
        let owner = match parse_account_owner(&owner) {
            Some(o) => o,
            None => return vec![],
        };

        let game_ids = self.state.player_games
            .get(&owner)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let mut games = vec![];
        let owner_str = format!("{:?}", owner);

        for game_id in game_ids.iter().rev().take(limit as usize) {
            if let Ok(Some(game)) = self.state.games.get(game_id).await {
                if game.status == GameStatus::Completed || game.status == GameStatus::TimedOut {
                    let opponent_idx = if game.players.get(0) == Some(&owner_str) { 1 } else { 0 };
                    games.push(GameInfo {
                        game_id: game.game_id,
                        game_type: game.game_type,
                        game_mode: game.game_mode,
                        opponent: game.players.get(opponent_idx).cloned().unwrap_or_default(),
                        opponent_name: game.player_names.get(opponent_idx).cloned().unwrap_or_default(),
                        status: game.status,
                        created_at: game.created_at,
                        updated_at: game.updated_at,
                        winner: game.winner,
                    });
                }
            }
        }

        games
    }

    // ============ CHESS QUERIES ============

    /// Get chess board for a game
    async fn chess_board(&self, game_id: String) -> Option<ChessBoard> {
        let game = self.state.games.get(&game_id).await.ok()??;
        game.chess_board
    }

    /// Get valid moves for a piece (simplified)
    async fn chess_valid_moves(&self, _game_id: String, _square: i32) -> Vec<i32> {
        vec![]
    }

    // ============ POKER QUERIES ============

    /// Get poker game state
    async fn poker_game(&self, game_id: String) -> Option<PokerGame> {
        let game = self.state.games.get(&game_id).await.ok()??;
        game.poker_game
    }

    // ============ BLACKJACK QUERIES ============

    /// Get blackjack game state
    async fn blackjack_game(&self, game_id: String) -> Option<BlackjackGame> {
        let game = self.state.games.get(&game_id).await.ok()??;
        game.blackjack_game
    }

    // ============ LOBBY QUERIES ============

    /// Get lobby by ID
    async fn lobby(&self, lobby_id: String) -> Option<GameLobby> {
        self.state.lobbies.get(&lobby_id).await.ok().flatten()
    }

    /// Get all open public lobbies
    async fn open_lobbies(&self, game_type: Option<GameType>) -> Vec<GameLobby> {
        let lobby_ids = self.state.active_lobby_ids.get().clone();
        let mut lobbies = vec![];

        for lobby_id in lobby_ids {
            if let Ok(Some(lobby)) = self.state.lobbies.get(&lobby_id).await {
                if lobby.status == LobbyStatus::Open && lobby.is_public {
                    if let Some(gt) = game_type {
                        if lobby.game_type == gt {
                            lobbies.push(lobby);
                        }
                    } else {
                        lobbies.push(lobby);
                    }
                }
            }
        }

        lobbies
    }

    /// Get lobbies created by a player
    async fn player_lobbies(&self, owner: String) -> Vec<GameLobby> {
        let owner = match parse_account_owner(&owner) {
            Some(o) => o,
            None => return vec![],
        };

        let lobby_ids = self.state.active_lobby_ids.get().clone();
        let mut lobbies = vec![];
        let owner_str = format!("{:?}", owner);

        for lobby_id in lobby_ids {
            if let Ok(Some(lobby)) = self.state.lobbies.get(&lobby_id).await {
                if lobby.players.contains(&owner_str) {
                    lobbies.push(lobby);
                }
            }
        }

        lobbies
    }

    // ============ LEADERBOARD QUERIES ============

    /// Get leaderboard
    async fn leaderboard(&self, _game_type: Option<GameType>, limit: i32) -> Vec<LeaderboardEntry> {
        let entries = self.state.leaderboard.get().clone();
        entries.into_iter().take(limit as usize).collect()
    }

    /// Get player rank
    async fn player_rank(&self, owner: String, _game_type: Option<GameType>) -> Option<u32> {
        let entries = self.state.leaderboard.get().clone();
        let owner = parse_account_owner(&owner)?;

        if let Ok(Some(profile)) = self.state.user_profiles.get(&owner).await {
            for entry in &entries {
                if entry.eth_address == profile.eth_address {
                    return Some(entry.rank);
                }
            }
        }
        None
    }

    // ============ GLOBAL STATS ============

    /// Get total games played
    async fn total_games_played(&self) -> i64 {
        self.state.total_games_played.get().clone() as i64
    }

    /// Get total registered users
    async fn total_users(&self) -> i64 {
        self.state.total_users.get().clone() as i64
    }

    /// Get game clock
    async fn game_clock(&self, game_id: String) -> Option<Clock> {
        let game = self.state.games.get(&game_id).await.ok()??;
        Some(game.clock)
    }

    /// Check if it's player's turn
    async fn is_player_turn(&self, game_id: String, owner: String) -> bool {
        let owner = match parse_account_owner(&owner) {
            Some(o) => o,
            None => return false,
        };

        let game = match self.state.games.get(&game_id).await.ok().flatten() {
            Some(g) => g,
            None => return false,
        };

        let owner_str = format!("{:?}", owner);
        let player_idx = match game.players.iter().position(|p| p == &owner_str) {
            Some(i) => i,
            None => return false,
        };

        match game.game_type {
            GameType::Chess => {
                if let Some(board) = game.chess_board {
                    let active = if board.active_player == Player::One { 0 } else { 1 };
                    return player_idx == active;
                }
            }
            GameType::Poker => {
                if let Some(poker) = game.poker_game {
                    let active = if poker.active_player == Player::One { 0 } else { 1 };
                    return player_idx == active;
                }
            }
            GameType::Blackjack => {
                if let Some(bj) = game.blackjack_game {
                    return bj.is_player_turn && player_idx == 0;
                }
            }
        }

        false
    }

    /// Get time remaining for each player
    async fn time_remaining(&self, game_id: String) -> Vec<i64> {
        let game = match self.state.games.get(&game_id).await.ok().flatten() {
            Some(g) => g,
            None => return vec![300, 300],
        };

        vec![
            game.clock.time_left[0].as_micros() as i64 / 1_000_000,
            game.clock.time_left[1].as_micros() as i64 / 1_000_000,
        ]
    }
}

struct MutationRoot {
    runtime: Arc<ServiceRuntime<GamePlatformService>>,
}

#[Object]
impl MutationRoot {
    // ============ USER MUTATIONS ============

    /// Register a new user
    async fn register_user(
        &self,
        username: String,
        eth_address: String,
        avatar_url: Option<String>,
    ) -> Vec<u8> {
        let operation = Operation::RegisterUser {
            username,
            eth_address,
            avatar_url: avatar_url.unwrap_or_default(),
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Update user profile
    async fn update_profile(
        &self,
        username: Option<String>,
        avatar_url: Option<String>,
    ) -> Vec<u8> {
        let operation = Operation::UpdateProfile { username, avatar_url };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ LOBBY MUTATIONS ============

    /// Create a new game lobby
    async fn create_lobby(
        &self,
        game_type: GameType,
        game_mode: GameMode,
        is_public: bool,
        password: Option<String>,
        time_control: Option<i32>,
    ) -> Vec<u8> {
        let operation = Operation::CreateLobby {
            game_type,
            game_mode,
            is_public,
            password,
            time_control: time_control.unwrap_or(300) as u64,
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Join an existing lobby
    async fn join_lobby(
        &self,
        lobby_id: String,
        password: Option<String>,
    ) -> Vec<u8> {
        let operation = Operation::JoinLobby { lobby_id, password };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Cancel a lobby
    async fn cancel_lobby(&self, lobby_id: String) -> Vec<u8> {
        let operation = Operation::CancelLobby { lobby_id };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ GAME MUTATIONS ============

    /// Create a new game (vs bot or direct)
    async fn create_game(
        &self,
        game_type: GameType,
        game_mode: GameMode,
        opponent: Option<String>,
        time_seconds: Option<i32>,
    ) -> Vec<u8> {
        let opponent_owner = opponent.and_then(|o| parse_account_owner(&o));
        let time_secs = time_seconds.unwrap_or(300) as u64;

        let operation = Operation::CreateGame {
            game_type,
            game_mode,
            opponent: opponent_owner,
            timeouts: Some(Timeouts {
                start_time: TimeDelta::from_secs(time_secs),
                increment: TimeDelta::from_secs(10),
                block_delay: TimeDelta::from_secs(5),
            }),
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ CHESS MUTATIONS ============

    /// Make a chess move
    async fn chess_move(
        &self,
        game_id: String,
        from_square: i32,
        to_square: i32,
        promotion: Option<String>,
    ) -> Vec<u8> {
        let promo = promotion.and_then(|p| match p.to_lowercase().as_str() {
            "queen" | "q" => Some(game_platform::PieceType::Queen),
            "rook" | "r" => Some(game_platform::PieceType::Rook),
            "bishop" | "b" => Some(game_platform::PieceType::Bishop),
            "knight" | "n" => Some(game_platform::PieceType::Knight),
            _ => None,
        });

        let operation = Operation::ChessMove {
            game_id,
            from_square: from_square as u8,
            to_square: to_square as u8,
            promotion: promo,
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ POKER MUTATIONS ============

    /// Make a poker action
    async fn poker_action(
        &self,
        game_id: String,
        action: String,
        bet_amount: Option<i32>,
    ) -> Vec<u8> {
        let poker_action = match action.to_lowercase().as_str() {
            "fold" => game_platform::PokerAction::Fold,
            "check" => game_platform::PokerAction::Check,
            "call" => game_platform::PokerAction::Call,
            "raise" => game_platform::PokerAction::Raise,
            "allin" | "all_in" | "all-in" => game_platform::PokerAction::AllIn,
            _ => return vec![],
        };

        let operation = Operation::PokerAction {
            game_id,
            action: poker_action,
            bet_amount: bet_amount.map(|a| a as u64),
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ BLACKJACK MUTATIONS ============

    /// Make a blackjack action
    async fn blackjack_action(&self, game_id: String, action: String) -> Vec<u8> {
        let bj_action = match action.to_lowercase().as_str() {
            "hit" => game_platform::BlackjackAction::Hit,
            "stand" => game_platform::BlackjackAction::Stand,
            "double" => game_platform::BlackjackAction::Double,
            "split" => game_platform::BlackjackAction::Split,
            "insurance" => game_platform::BlackjackAction::Insurance,
            _ => return vec![],
        };

        let operation = Operation::BlackjackAction {
            game_id,
            action: bj_action,
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    // ============ GAME CONTROL MUTATIONS ============

    /// Resign from a game
    async fn resign_game(&self, game_id: String) -> Vec<u8> {
        let operation = Operation::ResignGame { game_id };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Offer a draw
    async fn offer_draw(&self, game_id: String) -> Vec<u8> {
        let operation = Operation::OfferDraw { game_id };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Accept a draw offer
    async fn accept_draw(&self, game_id: String) -> Vec<u8> {
        let operation = Operation::AcceptDraw { game_id };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Claim victory on timeout
    async fn claim_timeout(&self, game_id: String) -> Vec<u8> {
        let operation = Operation::ClaimTimeout { game_id };
        self.runtime.schedule_operation(&operation);
        vec![]
    }

    /// Record a bot game result
    async fn record_bot_game(
        &self,
        game_type: GameType,
        won: bool,
        moves: i32,
        eth_address: String,
    ) -> Vec<u8> {
        let operation = Operation::RecordBotGame {
            game_type,
            won,
            moves: moves as u32,
            eth_address,
        };
        self.runtime.schedule_operation(&operation);
        vec![]
    }
}

/// Parse an AccountOwner from a string format
fn parse_account_owner(s: &str) -> Option<AccountOwner> {
    let hex_str = if s.starts_with("Address32:") {
        &s[10..]
    } else if s.starts_with("User:") {
        &s[5..]
    } else if s.starts_with("0x") {
        let cleaned = &s[2..];
        if cleaned.len() == 40 {
            let bytes = hex::decode(cleaned).ok()?;
            if bytes.len() == 20 {
                let mut arr = [0u8; 20];
                arr.copy_from_slice(&bytes);
                return Some(AccountOwner::Address20(arr));
            }
        }
        cleaned
    } else {
        s
    };

    let bytes = hex::decode(hex_str).ok()?;
    if bytes.len() == 32 {
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Some(AccountOwner::Address32(linera_sdk::linera_base_types::CryptoHash::from(arr)))
    } else if bytes.len() == 20 {
        let mut arr = [0u8; 20];
        arr.copy_from_slice(&bytes);
        Some(AccountOwner::Address20(arr))
    } else {
        None
    }
}