#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    abi::WithContractAbi,
    linera_base_types::AccountOwner,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use self::state::{FullGameState, GamePlatformState, PlayerStats};
use game_platform::{
    BlackjackGame, ChessBoard, Clock, GameLobby, GameMode, GameOutcome, GameStatus,
    GameType, LeaderboardEntry, LobbyStatus, Operation, Player, PokerGame, Timeouts, UserProfile,
};

pub struct GamePlatformContract {
    state: GamePlatformState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(GamePlatformContract);

impl WithContractAbi for GamePlatformContract {
    type Abi = game_platform::GamePlatformAbi;
}

impl Contract for GamePlatformContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = GamePlatformState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        GamePlatformContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        self.runtime.application_parameters();
        
        // Initialize state - all operations are silent (no panics)
        self.state.default_timeouts.set(Timeouts::default());
        self.state.leaderboard.set(vec![]);
        self.state.active_lobby_ids.set(vec![]);
        self.state.total_games_played.set(0);
        self.state.total_users.set(0);
        
        eprintln!("✅ Game platform contract instantiated");
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        let timestamp = self.runtime.system_time().micros() as u64;

        match operation {
            Operation::RegisterUser { username, eth_address, avatar_url } => {
                // Get owner - fallback to deriving from ETH address if no signer
                let owner = match self.runtime.authenticated_signer() {
                    Some(signer) => signer,
                    None => {
                        eprintln!("⚠️ No authenticated signer for RegisterUser");
                        // Try to derive owner from ETH address
                        match parse_account_owner_from_eth(&eth_address) {
                            Some(o) => o,
                            None => {
                                eprintln!("❌ Cannot parse ETH address as owner: {}", eth_address);
                                return GameOutcome::InProgress;
                            }
                        }
                    }
                };

                eprintln!("📝 Registering user: {} with ETH: {}", username, eth_address);

                // Check if username is taken - graceful error handling
                let existing_username = self.state
                    .username_to_owner
                    .get(&username.to_lowercase())
                    .await
                    .unwrap_or(None);

                if let Some(existing_owner) = existing_username {
                    // Get the ETH address for the existing owner to check if it matches
                    if let Ok(Some(existing_profile)) = self.state
                        .user_profiles
                        .get(&existing_owner)
                        .await {
                        if existing_profile.eth_address.to_lowercase() != eth_address.to_lowercase() {
                            eprintln!("❌ Username already taken: {}", username);
                            return GameOutcome::InProgress;
                        }
                    }
                }

                // Check if ETH address is already registered
                let existing_eth_owner = self.state
                    .eth_to_owner
                    .get(&eth_address.to_lowercase())
                    .await
                    .unwrap_or(None);

                let profile = if let Some(existing_owner) = existing_eth_owner {
                    eprintln!("📝 ETH address already exists, updating profile");
                    
                    // ETH address already registered - update existing profile
                    match self.state
                        .user_profiles
                        .get(&existing_owner)
                        .await
                    {
                        Ok(Some(mut existing_profile)) => {
                            if existing_owner != owner {
                                eprintln!("❌ ETH address registered to different owner");
                                return GameOutcome::InProgress;
                            }

                            // Remove old username mapping if changed
                            if existing_profile.username.to_lowercase() != username.to_lowercase() {
                                let _ = self.state.username_to_owner
                                    .remove(&existing_profile.username.to_lowercase());
                            }
                            
                            existing_profile.username = username.clone();
                            existing_profile.avatar_url = avatar_url;
                            existing_profile.last_active = timestamp;
                            existing_profile
                        }
                        _ => {
                            eprintln!("❌ Could not load existing profile");
                            return GameOutcome::InProgress;
                        }
                    }
                } else {
                    eprintln!("✨ Creating new user profile");
                    
                    // New ETH address - create new user
                    let total = self.state.total_users.get().clone();
                    self.state.total_users.set(total + 1);

                    // Initialize stats
                    let stats = PlayerStats {
                        chess_elo: 1200,
                        ..Default::default()
                    };
                    let _ = self.state.stats.insert(&owner, stats);

                    UserProfile::new(username.clone(), eth_address.clone(), avatar_url, timestamp)
                };

                // Save mappings - ignore errors
                let _ = self.state.user_profiles.insert(&owner, profile.clone());
                let _ = self.state.username_to_owner.insert(&username.to_lowercase(), owner);
                let _ = self.state.eth_to_owner.insert(&eth_address.to_lowercase(), owner);

                eprintln!("✅ User registered: {}", username);
                GameOutcome::InProgress
            }

            Operation::UpdateProfile { username, avatar_url } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut profile = match self.state
                    .user_profiles
                    .get(&owner)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(p) => p,
                    None => return GameOutcome::InProgress,
                };

                if let Some(new_username) = username {
                    // Check if new username is taken
                    let existing = self.state
                        .username_to_owner
                        .get(&new_username.to_lowercase())
                        .await
                        .unwrap_or(None);

                    if let Some(existing_owner) = existing {
                        if existing_owner != owner {
                            return GameOutcome::InProgress;
                        }
                    }

                    // Remove old username mapping
                    let _ = self.state.username_to_owner
                        .remove(&profile.username.to_lowercase());

                    profile.username = new_username.clone();
                    let _ = self.state.username_to_owner
                        .insert(&new_username.to_lowercase(), owner);
                }

                if let Some(new_avatar) = avatar_url {
                    profile.avatar_url = new_avatar;
                }

                profile.last_active = timestamp;
                let _ = self.state.user_profiles.insert(&owner, profile);

                GameOutcome::InProgress
            }

            Operation::CreateLobby { game_type, game_mode, is_public, password, time_control } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let profile = match self.state
                    .user_profiles
                    .get(&owner)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(p) => p,
                    None => return GameOutcome::InProgress,
                };

                // Generate lobby ID
                let lobby_id = format!("{:x}{:x}", timestamp, owner.to_string().len());

                let password_hash = password.map(|p| {
                    format!("{:x}", p.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64)))
                });

                let lobby = GameLobby {
                    lobby_id: lobby_id.clone(),
                    creator: format!("{:?}", owner),
                    creator_name: profile.username,
                    game_type,
                    game_mode,
                    is_public,
                    password_hash,
                    status: LobbyStatus::Open,
                    time_control,
                    created_at: timestamp,
                    expires_at: timestamp + 900_000_000,
                    players: vec![format!("{:?}", owner)],
                    game_id: None,
                };

                let _ = self.state.lobbies.insert(&lobby_id, lobby);

                let mut lobby_ids = self.state.active_lobby_ids.get().clone();
                lobby_ids.push(lobby_id);
                self.state.active_lobby_ids.set(lobby_ids);

                GameOutcome::InProgress
            }

            Operation::JoinLobby { lobby_id, password } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let profile = match self.state
                    .user_profiles
                    .get(&owner)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(p) => p,
                    None => return GameOutcome::InProgress,
                };

                let mut lobby = match self.state
                    .lobbies
                    .get(&lobby_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(l) => l,
                    None => return GameOutcome::InProgress,
                };

                // Check lobby status
                if lobby.status != LobbyStatus::Open {
                    return GameOutcome::InProgress;
                }

                // Check expiration
                if timestamp > lobby.expires_at {
                    lobby.status = LobbyStatus::Expired;
                    let _ = self.state.lobbies.insert(&lobby_id, lobby);
                    return GameOutcome::InProgress;
                }

                // Check password
                if let Some(ref hash) = lobby.password_hash {
                    let provided_hash = password.map(|p| {
                        format!("{:x}", p.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64)))
                    });
                    if provided_hash.as_ref() != Some(hash) {
                        return GameOutcome::InProgress;
                    }
                }

                // Add player
                lobby.players.push(format!("{:?}", owner));
                lobby.status = LobbyStatus::Full;

                // Create game
                let game_id = format!("game_{}", lobby_id);
                lobby.game_id = Some(game_id.clone());

                let creator_str = &lobby.players[0];
                let joiner_str = format!("{:?}", owner);

                let timeouts = Timeouts {
                    start_time: linera_sdk::linera_base_types::TimeDelta::from_secs(lobby.time_control),
                    increment: linera_sdk::linera_base_types::TimeDelta::from_secs(10),
                    block_delay: linera_sdk::linera_base_types::TimeDelta::from_secs(5),
                };

                let clock = Clock::new(self.runtime.system_time(), &timeouts);

                let game_state = match lobby.game_type {
                    GameType::Chess => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Chess,
                        game_mode: lobby.game_mode,
                        status: GameStatus::InProgress,
                        players: vec![creator_str.clone(), joiner_str.clone()],
                        player_names: vec![lobby.creator_name.clone(), profile.username.clone()],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: Some(ChessBoard::new()),
                        poker_game: None,
                        blackjack_game: None,
                    },
                    GameType::Poker => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Poker,
                        game_mode: lobby.game_mode,
                        status: GameStatus::InProgress,
                        players: vec![creator_str.clone(), joiner_str.clone()],
                        player_names: vec![lobby.creator_name.clone(), profile.username.clone()],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: None,
                        poker_game: Some(PokerGame::new(1000, 10, 20, timestamp)),
                        blackjack_game: None,
                    },
                    GameType::Blackjack => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Blackjack,
                        game_mode: lobby.game_mode,
                        status: GameStatus::InProgress,
                        players: vec![creator_str.clone(), joiner_str.clone()],
                        player_names: vec![lobby.creator_name.clone(), profile.username.clone()],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: None,
                        poker_game: None,
                        blackjack_game: Some(BlackjackGame::new(100, 1000, timestamp)),
                    },
                };

                let _ = self.state.games.insert(&game_id, game_state);

                lobby.status = LobbyStatus::Started;
                let _ = self.state.lobbies.insert(&lobby_id, lobby);

                let mut joiner_games = self.state
                    .player_games
                    .get(&owner)
                    .await
                    .unwrap_or(None)
                    .unwrap_or_default();
                joiner_games.push(game_id.clone());
                let _ = self.state.player_games.insert(&owner, joiner_games);

                let mut lobby_ids = self.state.active_lobby_ids.get().clone();
                lobby_ids.retain(|id| id != &lobby_id);
                self.state.active_lobby_ids.set(lobby_ids);

                let total = self.state.total_games_played.get().clone();
                self.state.total_games_played.set(total + 1);

                GameOutcome::InProgress
            }

            Operation::CancelLobby { lobby_id } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut lobby = match self.state
                    .lobbies
                    .get(&lobby_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(l) => l,
                    None => return GameOutcome::InProgress,
                };

                let owner_str = format!("{:?}", owner);
                if lobby.players.get(0) != Some(&owner_str) {
                    return GameOutcome::InProgress;
                }

                lobby.status = LobbyStatus::Cancelled;
                let _ = self.state.lobbies.insert(&lobby_id, lobby);

                let mut lobby_ids = self.state.active_lobby_ids.get().clone();
                lobby_ids.retain(|id| id != &lobby_id);
                self.state.active_lobby_ids.set(lobby_ids);

                GameOutcome::InProgress
            }

            Operation::CreateGame { game_type, game_mode, opponent, timeouts } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let profile = match self.state
                    .user_profiles
                    .get(&owner)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(p) => p,
                    None => return GameOutcome::InProgress,
                };

                let game_id = format!("{:x}{:x}", timestamp, owner.to_string().len());
                let timeouts = timeouts.unwrap_or_default();
                let clock = Clock::new(self.runtime.system_time(), &timeouts);

                let (opponent_str, opponent_name) = if let Some(opp) = opponent {
                    match self.state
                        .user_profiles
                        .get(&opp)
                        .await
                        .ok()
                        .flatten()
                    {
                        Some(p) => (format!("{:?}", opp), p.username),
                        None => ("BOT".to_string(), "AI Bot".to_string()),
                    }
                } else {
                    ("BOT".to_string(), "AI Bot".to_string())
                };

                let game_state = match game_type {
                    GameType::Chess => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Chess,
                        game_mode,
                        status: GameStatus::InProgress,
                        players: vec![format!("{:?}", owner), opponent_str],
                        player_names: vec![profile.username, opponent_name],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: Some(ChessBoard::new()),
                        poker_game: None,
                        blackjack_game: None,
                    },
                    GameType::Poker => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Poker,
                        game_mode,
                        status: GameStatus::InProgress,
                        players: vec![format!("{:?}", owner), opponent_str],
                        player_names: vec![profile.username, opponent_name],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: None,
                        poker_game: Some(PokerGame::new(1000, 10, 20, timestamp)),
                        blackjack_game: None,
                    },
                    GameType::Blackjack => FullGameState {
                        game_id: game_id.clone(),
                        game_type: GameType::Blackjack,
                        game_mode,
                        status: GameStatus::InProgress,
                        players: vec![format!("{:?}", owner), opponent_str],
                        player_names: vec![profile.username, opponent_name],
                        created_at: timestamp,
                        updated_at: timestamp,
                        winner: None,
                        clock,
                        draw_offered_by: None,
                        chess_board: None,
                        poker_game: None,
                        blackjack_game: Some(BlackjackGame::new(100, 1000, timestamp)),
                    },
                };

                let _ = self.state.games.insert(&game_id, game_state);

                let mut player_games = self.state
                    .player_games
                    .get(&owner)
                    .await
                    .unwrap_or(None)
                    .unwrap_or_default();
                player_games.push(game_id);
                let _ = self.state.player_games.insert(&owner, player_games);

                let total = self.state.total_games_played.get().clone();
                self.state.total_games_played.set(total + 1);

                GameOutcome::InProgress
            }

            Operation::ChessMove { game_id, from_square, to_square, promotion } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                if game.status != GameStatus::InProgress {
                    return GameOutcome::InProgress;
                }

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.game_mode {
                    GameMode::VsBot => {
                        if game.players.get(0) != Some(&owner_str) {
                            return GameOutcome::InProgress;
                        }
                        0
                    }
                    _ => match game.players.iter().position(|p| p == &owner_str) {
                        Some(idx) => idx,
                        None => return GameOutcome::InProgress,
                    }
                };

                let mut board = match game.chess_board {
                    Some(b) => b,
                    None => return GameOutcome::InProgress,
                };

                let expected_player = if board.active_player == Player::One { 0 } else { 1 };
                if player_idx != expected_player {
                    return GameOutcome::InProgress;
                }

                match board.make_move(from_square, to_square, promotion, timestamp) {
                    Ok(outcome) => {
                        game.chess_board = Some(board);
                        game.updated_at = timestamp;

                        let player = if player_idx == 0 { Player::One } else { Player::Two };
                        game.clock.make_move(self.runtime.system_time(), player);

                        match &outcome {
                            GameOutcome::Winner(winner) => {
                                game.status = GameStatus::Completed;
                                game.winner = Some(*winner);
                                self.record_game_result(&game, *winner).await;
                            }
                            GameOutcome::Draw => {
                                game.status = GameStatus::Completed;
                                self.record_draw_result(&game).await;
                            }
                            GameOutcome::InProgress => {}
                        }

                        let _ = self.state.games.insert(&game_id, game);
                        outcome
                    }
                    Err(_) => GameOutcome::InProgress,
                }
            }

            Operation::PokerAction { game_id, action, bet_amount } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                if game.status != GameStatus::InProgress {
                    return GameOutcome::InProgress;
                }

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.players.iter().position(|p| p == &owner_str) {
                    Some(idx) => idx,
                    None => return GameOutcome::InProgress,
                };

                let mut poker = match game.poker_game {
                    Some(p) => p,
                    None => return GameOutcome::InProgress,
                };

                let expected_player = if poker.active_player == Player::One { 0 } else { 1 };
                if player_idx != expected_player {
                    return GameOutcome::InProgress;
                }

                match poker.make_action(action, bet_amount, timestamp) {
                    Ok(outcome) => {
                        game.poker_game = Some(poker);
                        game.updated_at = timestamp;

                        match &outcome {
                            GameOutcome::Winner(winner) => {
                                game.status = GameStatus::Completed;
                                game.winner = Some(*winner);
                                self.record_game_result(&game, *winner).await;
                            }
                            GameOutcome::Draw => {
                                game.status = GameStatus::Completed;
                                self.record_draw_result(&game).await;
                            }
                            GameOutcome::InProgress => {}
                        }

                        let _ = self.state.games.insert(&game_id, game);
                        outcome
                    }
                    Err(_) => GameOutcome::InProgress,
                }
            }

            Operation::BlackjackAction { game_id, action } => {
                let _owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                if game.status != GameStatus::InProgress {
                    return GameOutcome::InProgress;
                }

                let mut blackjack = match game.blackjack_game {
                    Some(bj) => bj,
                    None => return GameOutcome::InProgress,
                };

                match blackjack.make_action(action) {
                    Ok(outcome) => {
                        game.blackjack_game = Some(blackjack);
                        game.updated_at = timestamp;

                        match &outcome {
                            GameOutcome::Winner(winner) => {
                                game.status = GameStatus::Completed;
                                game.winner = Some(*winner);
                                self.record_game_result(&game, *winner).await;
                            }
                            GameOutcome::Draw => {
                                game.status = GameStatus::Completed;
                                self.record_draw_result(&game).await;
                            }
                            GameOutcome::InProgress => {}
                        }

                        let _ = self.state.games.insert(&game_id, game);
                        outcome
                    }
                    Err(_) => GameOutcome::InProgress,
                }
            }

            Operation::ResignGame { game_id } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.players.iter().position(|p| p == &owner_str) {
                    Some(idx) => idx,
                    None => return GameOutcome::InProgress,
                };

                let winner = if player_idx == 0 { Player::Two } else { Player::One };

                game.status = GameStatus::Completed;
                game.winner = Some(winner);
                game.updated_at = timestamp;

                self.record_game_result(&game, winner).await;
                let _ = self.state.games.insert(&game_id, game);

                GameOutcome::Winner(winner)
            }

            Operation::OfferDraw { game_id } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.players.iter().position(|p| p == &owner_str) {
                    Some(idx) => idx,
                    None => return GameOutcome::InProgress,
                };

                let player = if player_idx == 0 { Player::One } else { Player::Two };
                game.draw_offered_by = Some(player);
                game.updated_at = timestamp;

                let _ = self.state.games.insert(&game_id, game);

                GameOutcome::InProgress
            }

            Operation::AcceptDraw { game_id } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                if game.draw_offered_by.is_none() {
                    return GameOutcome::InProgress;
                }

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.players.iter().position(|p| p == &owner_str) {
                    Some(idx) => idx,
                    None => return GameOutcome::InProgress,
                };

                let player = if player_idx == 0 { Player::One } else { Player::Two };

                if game.draw_offered_by == Some(player) {
                    return GameOutcome::InProgress;
                }

                game.status = GameStatus::Completed;
                game.updated_at = timestamp;

                self.record_draw_result(&game).await;
                let _ = self.state.games.insert(&game_id, game);

                GameOutcome::Draw
            }

            Operation::ClaimTimeout { game_id } => {
                let owner = match self.runtime.authenticated_signer() {
                    Some(o) => o,
                    None => return GameOutcome::InProgress,
                };

                let mut game = match self.state
                    .games
                    .get(&game_id)
                    .await
                    .ok()
                    .flatten()
                {
                    Some(g) => g,
                    None => return GameOutcome::InProgress,
                };

                let owner_str = format!("{:?}", owner);
                let player_idx = match game.players.iter().position(|p| p == &owner_str) {
                    Some(idx) => idx,
                    None => return GameOutcome::InProgress,
                };

                let player = if player_idx == 0 { Player::One } else { Player::Two };
                let opponent = player.other();

                if !game.clock.timed_out(self.runtime.system_time(), opponent) {
                    return GameOutcome::InProgress;
                }

                game.status = GameStatus::TimedOut;
                game.winner = Some(player);
                game.updated_at = timestamp;

                self.record_game_result(&game, player).await;
                let _ = self.state.games.insert(&game_id, game);

                GameOutcome::Winner(player)
            }

            Operation::RecordBotGame { game_type, won, moves: _, eth_address } => {
                let owner = match self.state.eth_to_owner.get(&eth_address.to_lowercase()).await {
                    Ok(Some(owner)) => owner,
                    _ => {
                        return GameOutcome::InProgress;
                    }
                };

                let mut stats = self.state
                    .stats
                    .get(&owner)
                    .await
                    .unwrap_or(None)
                    .unwrap_or_default();

                if won {
                    stats.record_win(game_type);
                } else {
                    stats.record_loss(game_type);
                }

                let _ = self.state.stats.insert(&owner, stats);

                if let Ok(Some(mut profile)) = self.state.user_profiles.get(&owner).await {
                    match game_type {
                        GameType::Chess => {
                            if won { profile.chess_wins += 1; } else { profile.chess_losses += 1; }
                        }
                        GameType::Poker => {
                            if won { profile.poker_wins += 1; } else { profile.poker_losses += 1; }
                        }
                        GameType::Blackjack => {
                            if won { profile.blackjack_wins += 1; } else { profile.blackjack_losses += 1; }
                        }
                    }
                    profile.total_games += 1;
                    profile.last_active = timestamp;

                    if won {
                        if profile.current_streak >= 0 {
                            profile.current_streak += 1;
                        } else {
                            profile.current_streak = 1;
                        }
                        if profile.current_streak > profile.best_streak as i32 {
                            profile.best_streak = profile.current_streak as u32;
                        }
                    } else {
                        if profile.current_streak <= 0 {
                            profile.current_streak -= 1;
                        } else {
                            profile.current_streak = -1;
                        }
                    }

                    self.add_or_update_leaderboard_entry(&profile).await;
                    let _ = self.state.user_profiles.insert(&owner, profile);
                }

                if won {
                    GameOutcome::Winner(Player::One)
                } else {
                    GameOutcome::Winner(Player::Two)
                }
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {
        panic!("Messages not supported");
    }

    async fn store(mut self) {
        let _ = self.state.save().await;
    }
}

impl GamePlatformContract {
    async fn record_game_result(&mut self, game: &FullGameState, winner: Player) {
        let winner_idx = winner.index();
        let loser_idx = winner.other().index();

        if game.game_mode == GameMode::VsBot {
            return;
        }

        if let Some(winner_owner_str) = game.players.get(winner_idx) {
            if let Some(winner_owner) = self.parse_owner_from_debug_str(winner_owner_str) {
                if let Ok(Some(mut stats)) = self.state.stats.get(&winner_owner).await {
                    stats.record_win(game.game_type);
                    let _ = self.state.stats.insert(&winner_owner, stats);
                }
                if let Ok(Some(mut profile)) = self.state.user_profiles.get(&winner_owner).await {
                    match game.game_type {
                        GameType::Chess => profile.chess_wins += 1,
                        GameType::Poker => profile.poker_wins += 1,
                        GameType::Blackjack => profile.blackjack_wins += 1,
                    }
                    profile.total_games += 1;
                    if profile.current_streak >= 0 {
                        profile.current_streak += 1;
                    } else {
                        profile.current_streak = 1;
                    }
                    if profile.current_streak > profile.best_streak as i32 {
                        profile.best_streak = profile.current_streak as u32;
                    }
                    let _ = self.state.user_profiles.insert(&winner_owner, profile);
                }
            }
        }

        if let Some(loser_owner_str) = game.players.get(loser_idx) {
            if let Some(loser_owner) = self.parse_owner_from_debug_str(loser_owner_str) {
                if let Ok(Some(mut stats)) = self.state.stats.get(&loser_owner).await {
                    stats.record_loss(game.game_type);
                    let _ = self.state.stats.insert(&loser_owner, stats);
                }
                if let Ok(Some(mut profile)) = self.state.user_profiles.get(&loser_owner).await {
                    match game.game_type {
                        GameType::Chess => profile.chess_losses += 1,
                        GameType::Poker => profile.poker_losses += 1,
                        GameType::Blackjack => profile.blackjack_losses += 1,
                    }
                    profile.total_games += 1;
                    if profile.current_streak <= 0 {
                        profile.current_streak -= 1;
                    } else {
                        profile.current_streak = -1;
                    }
                    let _ = self.state.user_profiles.insert(&loser_owner, profile);
                }
            }
        }

        self.update_leaderboard().await;
    }

    async fn record_draw_result(&mut self, game: &FullGameState) {
        if game.game_mode == GameMode::VsBot {
            return;
        }

        for player_str in &game.players {
            if let Some(owner) = self.parse_owner_from_debug_str(player_str) {
                if let Ok(Some(mut stats)) = self.state.stats.get(&owner).await {
                    stats.record_draw(game.game_type);
                    let _ = self.state.stats.insert(&owner, stats);
                }
                if let Ok(Some(mut profile)) = self.state.user_profiles.get(&owner).await {
                    if game.game_type == GameType::Chess {
                        profile.chess_draws += 1;
                    } else if game.game_type == GameType::Blackjack {
                        profile.blackjack_pushes += 1;
                    }
                    profile.total_games += 1;
                    profile.current_streak = 0;
                    let _ = self.state.user_profiles.insert(&owner, profile);
                }
            }
        }

        self.update_leaderboard().await;
    }

    fn parse_owner_from_debug_str(&self, s: &str) -> Option<AccountOwner> {
        if s == "BOT" {
            return None;
        }

        // Parse Address20(hex_bytes) format
        if s.starts_with("Address20(") && s.ends_with(")") {
            let inner = &s[10..s.len()-1];
            // Parse the [u8; 20] array format like "[0, 1, 2, ...]"
            if inner.starts_with("[") && inner.ends_with("]") {
                let nums_str = &inner[1..inner.len()-1];
                let nums: Vec<u8> = nums_str
                    .split(',')
                    .filter_map(|n| n.trim().parse().ok())
                    .collect();
                if nums.len() == 20 {
                    let mut arr = [0u8; 20];
                    arr.copy_from_slice(&nums);
                    return Some(AccountOwner::Address20(arr));
                }
            }
        }

        // Parse Address32(CryptoHash(hex_bytes)) format
        if s.starts_with("Address32(CryptoHash(") && s.ends_with("))") {
            let inner = &s[21..s.len()-2];
            if inner.starts_with("[") && inner.ends_with("]") {
                let nums_str = &inner[1..inner.len()-1];
                let nums: Vec<u8> = nums_str
                    .split(',')
                    .filter_map(|n| n.trim().parse().ok())
                    .collect();
                if nums.len() == 32 {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&nums);
                    return Some(AccountOwner::Address32(linera_sdk::linera_base_types::CryptoHash::from(arr)));
                }
            }
        }

        // Try parsing hex string directly (ETH address format)
        let hex_str = if s.starts_with("0x") { &s[2..] } else { s };
        if hex_str.len() == 40 {
            if let Ok(bytes) = hex::decode(hex_str) {
                if bytes.len() == 20 {
                    let mut arr = [0u8; 20];
                    arr.copy_from_slice(&bytes);
                    return Some(AccountOwner::Address20(arr));
                }
            }
        }

        None
    }

    async fn update_leaderboard(&mut self) {
        let mut current = self.state.leaderboard.get().clone();

        current.sort_by(|a, b| {
            let a_rate = if a.total_games > 0 { a.wins as f64 / a.total_games as f64 } else { 0.0 };
            let b_rate = if b.total_games > 0 { b.wins as f64 / b.total_games as f64 } else { 0.0 };
            match b_rate.partial_cmp(&a_rate) {
                Some(std::cmp::Ordering::Equal) => b.total_games.cmp(&a.total_games),
                Some(ord) => ord,
                None => std::cmp::Ordering::Equal,
            }
        });

        for (i, entry) in current.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }

        self.state.leaderboard.set(current);
    }

    async fn add_or_update_leaderboard_entry(&mut self, profile: &UserProfile) {
        let mut entries = self.state.leaderboard.get().clone();

        let total_wins = profile.chess_wins + profile.poker_wins + profile.blackjack_wins;
        let total_losses = profile.chess_losses + profile.poker_losses + profile.blackjack_losses;
        let total_games = profile.total_games;
        let win_rate = if total_games > 0 {
            (total_wins as f64 / total_games as f64) * 100.0
        } else {
            0.0
        };

        let existing_idx = entries.iter().position(|e| e.eth_address == profile.eth_address);

        let entry = LeaderboardEntry {
            rank: 0,
            username: profile.username.clone(),
            eth_address: profile.eth_address.clone(),
            wins: total_wins,
            losses: total_losses,
            win_rate,
            elo: profile.chess_elo,
            total_games,
        };

        if let Some(idx) = existing_idx {
            entries[idx] = entry;
        } else if total_games > 0 {
            entries.push(entry);
        }

        self.state.leaderboard.set(entries);
        self.update_leaderboard().await;
    }
}

// Helper function to parse ETH address as owner
fn parse_account_owner_from_eth(eth_addr: &str) -> Option<AccountOwner> {
    let cleaned = if eth_addr.starts_with("0x") {
        &eth_addr[2..]
    } else {
        eth_addr
    };

    if cleaned.len() != 40 {
        return None;
    }

    let bytes = hex::decode(cleaned).ok()?;
    if bytes.len() == 20 {
        let mut arr = [0u8; 20];
        arr.copy_from_slice(&bytes);
        Some(AccountOwner::Address20(arr))
    } else {
        None
    }
}