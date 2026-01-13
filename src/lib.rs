// Multi-Game Platform ABI - Chess, Poker, Blackjack
// Fully decentralized gaming on Linera blockchain

use async_graphql::{Enum, InputObject, Request, Response, SimpleObject};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{AccountOwner, ContractAbi, ServiceAbi, TimeDelta, Timestamp},
};
use serde::{Deserialize, Serialize};

pub struct GamePlatformAbi;

// ============ GAME TYPES ============

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GameType {
    Chess,
    Poker,
    Blackjack,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GameMode {
    VsBot,
    VsFriend,
    Local,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum GameStatus {
    WaitingForOpponent,
    InProgress,
    Completed,
    Cancelled,
    TimedOut,
}

// ============ USER PROFILE ============

#[derive(Debug, Clone, Default, Serialize, Deserialize, SimpleObject)]
pub struct UserProfile {
    pub username: String,
    pub eth_address: String,
    pub avatar_url: String,
    pub created_at: u64,
    pub last_active: u64,
    // Chess stats
    pub chess_wins: u32,
    pub chess_losses: u32,
    pub chess_draws: u32,
    pub chess_elo: u32,
    // Poker stats
    pub poker_wins: u32,
    pub poker_losses: u32,
    pub poker_chips_won: i64,
    // Blackjack stats
    pub blackjack_wins: u32,
    pub blackjack_losses: u32,
    pub blackjack_pushes: u32,
    // Overall stats
    pub total_games: u32,
    pub current_streak: i32,
    pub best_streak: u32,
}

impl UserProfile {
    pub fn new(username: String, eth_address: String, avatar_url: String, timestamp: u64) -> Self {
        UserProfile {
            username,
            eth_address,
            avatar_url,
            created_at: timestamp,
            last_active: timestamp,
            chess_elo: 1200, // Starting ELO
            ..Default::default()
        }
    }
}

// ============ LOBBY SYSTEM ============

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct GameLobby {
    pub lobby_id: String,
    pub creator: String,
    pub creator_name: String,
    pub game_type: GameType,
    pub game_mode: GameMode,
    pub is_public: bool,
    pub password_hash: Option<String>,
    pub status: LobbyStatus,
    pub time_control: u64,
    pub created_at: u64,
    pub expires_at: u64,
    pub players: Vec<String>,
    pub game_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum LobbyStatus {
    Open,
    Full,
    Started,
    Cancelled,
    Expired,
}

// ============ CHESS ============

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum PieceType {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, SimpleObject)]
pub struct ChessPiece {
    pub piece_type: PieceType,
    pub owner: Player,
    pub has_moved: bool,
}

#[derive(Clone, Default, Serialize, Deserialize, SimpleObject)]
pub struct ChessBoard {
    pub squares: Vec<Option<ChessPiece>>,
    pub active_player: Player,
    pub castling_rights: CastlingRights,
    pub en_passant_square: Option<u8>,
    pub halfmove_clock: u16,
    pub fullmove_number: u16,
    pub move_history: Vec<ChessMoveRecord>,
    pub is_check: bool,
    pub is_checkmate: bool,
    pub is_stalemate: bool,
    pub captured_white: Vec<PieceType>,
    pub captured_black: Vec<PieceType>,
}

#[derive(Clone, Serialize, Deserialize, SimpleObject)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

impl Default for CastlingRights {
    fn default() -> Self {
        CastlingRights {
            white_kingside: true,
            white_queenside: true,
            black_kingside: true,
            black_queenside: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct ChessMoveRecord {
    pub from_square: u8,
    pub to_square: u8,
    pub piece: PieceType,
    pub captured: Option<PieceType>,
    pub promotion: Option<PieceType>,
    pub is_castle: bool,
    pub is_en_passant: bool,
    pub notation: String,
    pub timestamp: u64,
}

impl ChessBoard {
    pub fn new() -> Self {
        let mut board = ChessBoard {
            squares: vec![None; 64],
            active_player: Player::One,
            castling_rights: CastlingRights::default(),
            en_passant_square: None,
            halfmove_clock: 0,
            fullmove_number: 1,
            move_history: vec![],
            is_check: false,
            is_checkmate: false,
            is_stalemate: false,
            captured_white: vec![],
            captured_black: vec![],
        };
        board.setup_initial_position();
        board
    }

    fn setup_initial_position(&mut self) {
        // White pieces (Player One) - rows 0-1
        let back_row = [
            PieceType::Rook, PieceType::Knight, PieceType::Bishop, PieceType::Queen,
            PieceType::King, PieceType::Bishop, PieceType::Knight, PieceType::Rook,
        ];

        for (i, piece_type) in back_row.iter().enumerate() {
            self.squares[i] = Some(ChessPiece {
                piece_type: *piece_type,
                owner: Player::One,
                has_moved: false,
            });
        }

        for i in 8..16 {
            self.squares[i] = Some(ChessPiece {
                piece_type: PieceType::Pawn,
                owner: Player::One,
                has_moved: false,
            });
        }

        // Black pieces (Player Two) - rows 6-7
        for i in 48..56 {
            self.squares[i] = Some(ChessPiece {
                piece_type: PieceType::Pawn,
                owner: Player::Two,
                has_moved: false,
            });
        }

        for (i, piece_type) in back_row.iter().enumerate() {
            self.squares[56 + i] = Some(ChessPiece {
                piece_type: *piece_type,
                owner: Player::Two,
                has_moved: false,
            });
        }
    }

    pub fn make_move(&mut self, from: u8, to: u8, promotion: Option<PieceType>, timestamp: u64) -> Result<GameOutcome, String> {
        if from >= 64 || to >= 64 {
            return Err("Invalid square".to_string());
        }

        let piece = self.squares[from as usize].ok_or("No piece at source")?;

        if piece.owner != self.active_player {
            return Err("Not your piece".to_string());
        }

        // Validate move (basic validation - full validation in frontend)
        let captured = self.squares[to as usize];

        // Handle captures
        if let Some(cap) = captured {
            if cap.owner == piece.owner {
                return Err("Cannot capture own piece".to_string());
            }
            match self.active_player {
                Player::One => self.captured_black.push(cap.piece_type),
                Player::Two => self.captured_white.push(cap.piece_type),
            }
        }

        // Check for castling
        let is_castle = piece.piece_type == PieceType::King &&
            ((from == 4 && (to == 6 || to == 2)) || (from == 60 && (to == 62 || to == 58)));

        if is_castle {
            // Move rook
            match to {
                6 => { // White kingside
                    self.squares[5] = self.squares[7].take();
                    if let Some(ref mut rook) = self.squares[5] {
                        rook.has_moved = true;
                    }
                }
                2 => { // White queenside
                    self.squares[3] = self.squares[0].take();
                    if let Some(ref mut rook) = self.squares[3] {
                        rook.has_moved = true;
                    }
                }
                62 => { // Black kingside
                    self.squares[61] = self.squares[63].take();
                    if let Some(ref mut rook) = self.squares[61] {
                        rook.has_moved = true;
                    }
                }
                58 => { // Black queenside
                    self.squares[59] = self.squares[56].take();
                    if let Some(ref mut rook) = self.squares[59] {
                        rook.has_moved = true;
                    }
                }
                _ => {}
            }
        }

        // Handle en passant
        let is_en_passant = piece.piece_type == PieceType::Pawn &&
            self.en_passant_square == Some(to) &&
            from % 8 != to % 8 && captured.is_none();

        if is_en_passant {
            let captured_pawn_sq = if self.active_player == Player::One {
                to - 8
            } else {
                to + 8
            };
            self.squares[captured_pawn_sq as usize] = None;
            match self.active_player {
                Player::One => self.captured_black.push(PieceType::Pawn),
                Player::Two => self.captured_white.push(PieceType::Pawn),
            }
        }

        // Update en passant square
        self.en_passant_square = if piece.piece_type == PieceType::Pawn {
            let diff = (to as i8 - from as i8).abs();
            if diff == 16 {
                Some((from + to) / 2)
            } else {
                None
            }
        } else {
            None
        };

        // Handle pawn promotion
        let final_piece = if piece.piece_type == PieceType::Pawn && (to / 8 == 0 || to / 8 == 7) {
            ChessPiece {
                piece_type: promotion.unwrap_or(PieceType::Queen),
                owner: piece.owner,
                has_moved: true,
            }
        } else {
            ChessPiece {
                has_moved: true,
                ..piece
            }
        };

        // Move the piece
        self.squares[to as usize] = Some(final_piece);
        self.squares[from as usize] = None;

        // Update castling rights
        if piece.piece_type == PieceType::King {
            match piece.owner {
                Player::One => {
                    self.castling_rights.white_kingside = false;
                    self.castling_rights.white_queenside = false;
                }
                Player::Two => {
                    self.castling_rights.black_kingside = false;
                    self.castling_rights.black_queenside = false;
                }
            }
        }
        if piece.piece_type == PieceType::Rook {
            match from {
                0 => self.castling_rights.white_queenside = false,
                7 => self.castling_rights.white_kingside = false,
                56 => self.castling_rights.black_queenside = false,
                63 => self.castling_rights.black_kingside = false,
                _ => {}
            }
        }

        // Generate notation
        let notation = self.generate_notation(from, to, &piece, captured.map(|c| c.piece_type), promotion, is_castle, is_en_passant);

        // Record move
        self.move_history.push(ChessMoveRecord {
            from_square: from,
            to_square: to,
            piece: piece.piece_type,
            captured: captured.map(|c| c.piece_type),
            promotion,
            is_castle,
            is_en_passant,
            notation,
            timestamp,
        });

        // Update counters
        if piece.piece_type == PieceType::Pawn || captured.is_some() {
            self.halfmove_clock = 0;
        } else {
            self.halfmove_clock += 1;
        }

        if self.active_player == Player::Two {
            self.fullmove_number += 1;
        }

        // Switch player
        self.active_player = self.active_player.other();

        // Check for checkmate/stalemate (basic check - full detection in frontend)
        self.update_game_status();

        if self.is_checkmate {
            Ok(GameOutcome::Winner(self.active_player.other()))
        } else if self.is_stalemate || self.halfmove_clock >= 100 {
            Ok(GameOutcome::Draw)
        } else {
            Ok(GameOutcome::InProgress)
        }
    }

    fn generate_notation(&self, from: u8, to: u8, piece: &ChessPiece, captured: Option<PieceType>, promotion: Option<PieceType>, is_castle: bool, _is_en_passant: bool) -> String {
        if is_castle {
            return if to % 8 > from % 8 { "O-O".to_string() } else { "O-O-O".to_string() };
        }

        let files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let from_file = files[(from % 8) as usize];
        let to_file = files[(to % 8) as usize];
        let to_rank = (to / 8) + 1;

        let piece_char = match piece.piece_type {
            PieceType::Pawn => String::new(),
            PieceType::Knight => "N".to_string(),
            PieceType::Bishop => "B".to_string(),
            PieceType::Rook => "R".to_string(),
            PieceType::Queen => "Q".to_string(),
            PieceType::King => "K".to_string(),
        };

        let capture_str = if captured.is_some() {
            if piece.piece_type == PieceType::Pawn {
                format!("{}x", from_file)
            } else {
                "x".to_string()
            }
        } else {
            String::new()
        };

        let promo_str = promotion.map(|p| format!("={}", match p {
            PieceType::Queen => "Q",
            PieceType::Rook => "R",
            PieceType::Bishop => "B",
            PieceType::Knight => "N",
            _ => "Q",
        })).unwrap_or_default();

        format!("{}{}{}{}{}", piece_char, capture_str, to_file, to_rank, promo_str)
    }

    fn update_game_status(&mut self) {
        // Find king position
        let king_sq = self.find_king(self.active_player);
        if let Some(king_pos) = king_sq {
            self.is_check = self.is_square_attacked(king_pos, self.active_player.other());
        }
        // Full checkmate/stalemate detection done in frontend for performance
    }

    fn find_king(&self, player: Player) -> Option<u8> {
        for (i, sq) in self.squares.iter().enumerate() {
            if let Some(piece) = sq {
                if piece.piece_type == PieceType::King && piece.owner == player {
                    return Some(i as u8);
                }
            }
        }
        None
    }

    fn is_square_attacked(&self, square: u8, by_player: Player) -> bool {
        // Simplified attack detection
        for (i, sq) in self.squares.iter().enumerate() {
            if let Some(piece) = sq {
                if piece.owner == by_player {
                    if self.can_piece_attack(i as u8, square, piece) {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn can_piece_attack(&self, from: u8, to: u8, piece: &ChessPiece) -> bool {
        let from_row = from / 8;
        let from_col = from % 8;
        let to_row = to / 8;
        let to_col = to % 8;
        let row_diff = (to_row as i8 - from_row as i8).abs();
        let col_diff = (to_col as i8 - from_col as i8).abs();

        match piece.piece_type {
            PieceType::Pawn => {
                let direction: i8 = if piece.owner == Player::One { 1 } else { -1 };
                col_diff == 1 && (to_row as i8 - from_row as i8) == direction
            }
            PieceType::Knight => {
                (row_diff == 2 && col_diff == 1) || (row_diff == 1 && col_diff == 2)
            }
            PieceType::Bishop => {
                row_diff == col_diff && row_diff > 0
            }
            PieceType::Rook => {
                (row_diff == 0 || col_diff == 0) && (row_diff > 0 || col_diff > 0)
            }
            PieceType::Queen => {
                (row_diff == col_diff || row_diff == 0 || col_diff == 0) && (row_diff > 0 || col_diff > 0)
            }
            PieceType::King => {
                row_diff <= 1 && col_diff <= 1 && (row_diff > 0 || col_diff > 0)
            }
        }
    }
}

// ============ POKER ============

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, SimpleObject)]
pub struct Card {
    pub rank: u8,  // 2-14 (11=J, 12=Q, 13=K, 14=A)
    pub suit: Suit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum Suit {
    Hearts,
    Diamonds,
    Clubs,
    Spades,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum PokerStage {
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum PokerAction {
    Fold,
    Check,
    Call,
    Raise,
    AllIn,
}

#[derive(Clone, Serialize, Deserialize, SimpleObject)]
pub struct PokerGame {
    pub player_hands: Vec<Vec<Card>>,
    pub community_cards: Vec<Card>,
    pub deck: Vec<Card>,
    pub pot: u64,
    pub current_bet: u64,
    pub player_bets: Vec<u64>,
    pub player_chips: Vec<u64>,
    pub active_player: Player,
    pub stage: PokerStage,
    pub dealer: Player,
    pub folded: Vec<bool>,
    pub all_in: Vec<bool>,
    pub last_raiser: Option<Player>,
    pub action_history: Vec<PokerActionRecord>,
    pub round_complete: bool,
    pub small_blind: u64,
    pub big_blind: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct PokerActionRecord {
    pub player: Player,
    pub action: PokerAction,
    pub amount: u64,
    pub stage: PokerStage,
    pub timestamp: u64,
}

impl PokerGame {
    pub fn new(starting_chips: u64, small_blind: u64, big_blind: u64, seed: u64) -> Self {
        let mut deck = Self::create_shuffled_deck(seed);

        // Deal 2 cards to each player
        let p1_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];
        let p2_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];

        PokerGame {
            player_hands: vec![p1_hand, p2_hand],
            community_cards: vec![],
            deck,
            pot: small_blind + big_blind,
            current_bet: big_blind,
            player_bets: vec![small_blind, big_blind],
            player_chips: vec![starting_chips - small_blind, starting_chips - big_blind],
            active_player: Player::One, // Small blind acts first pre-flop
            stage: PokerStage::PreFlop,
            dealer: Player::One,
            folded: vec![false, false],
            all_in: vec![false, false],
            last_raiser: Some(Player::Two), // Big blind is initial "raiser"
            action_history: vec![],
            round_complete: false,
            small_blind,
            big_blind,
        }
    }

    fn create_shuffled_deck(seed: u64) -> Vec<Card> {
        let mut deck = Vec::with_capacity(52);
        for suit in [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades] {
            for rank in 2..=14 {
                deck.push(Card { rank, suit });
            }
        }

        // Simple shuffle using seed
        let mut rng_state = seed;
        for i in (1..deck.len()).rev() {
            rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
            let j = (rng_state as usize) % (i + 1);
            deck.swap(i, j);
        }

        deck
    }

    pub fn make_action(&mut self, action: PokerAction, amount: Option<u64>, timestamp: u64) -> Result<GameOutcome, String> {
        let player_idx = self.active_player.index();

        if self.folded[player_idx] {
            return Err("Player has folded".to_string());
        }

        match action {
            PokerAction::Fold => {
                self.folded[player_idx] = true;
                self.action_history.push(PokerActionRecord {
                    player: self.active_player,
                    action,
                    amount: 0,
                    stage: self.stage,
                    timestamp,
                });
                return Ok(GameOutcome::Winner(self.active_player.other()));
            }
            PokerAction::Check => {
                if self.player_bets[player_idx] < self.current_bet {
                    return Err("Cannot check, must call or raise".to_string());
                }
            }
            PokerAction::Call => {
                let to_call = self.current_bet - self.player_bets[player_idx];
                if to_call > self.player_chips[player_idx] {
                    // All-in
                    let chips = self.player_chips[player_idx];
                    self.pot += chips;
                    self.player_bets[player_idx] += chips;
                    self.player_chips[player_idx] = 0;
                    self.all_in[player_idx] = true;
                } else {
                    self.pot += to_call;
                    self.player_bets[player_idx] = self.current_bet;
                    self.player_chips[player_idx] -= to_call;
                }
            }
            PokerAction::Raise => {
                let raise_amount = amount.unwrap_or(self.big_blind);
                let to_call = self.current_bet - self.player_bets[player_idx];
                let total = to_call + raise_amount;

                if total > self.player_chips[player_idx] {
                    return Err("Insufficient chips".to_string());
                }

                self.pot += total;
                self.player_chips[player_idx] -= total;
                self.player_bets[player_idx] = self.current_bet + raise_amount;
                self.current_bet = self.player_bets[player_idx];
                self.last_raiser = Some(self.active_player);
            }
            PokerAction::AllIn => {
                let chips = self.player_chips[player_idx];
                self.pot += chips;
                self.player_bets[player_idx] += chips;
                self.player_chips[player_idx] = 0;
                self.all_in[player_idx] = true;

                if self.player_bets[player_idx] > self.current_bet {
                    self.current_bet = self.player_bets[player_idx];
                    self.last_raiser = Some(self.active_player);
                }
            }
        }

        self.action_history.push(PokerActionRecord {
            player: self.active_player,
            action,
            amount: amount.unwrap_or(0),
            stage: self.stage,
            timestamp,
        });

        // Check if betting round is complete
        if self.is_round_complete() {
            self.advance_stage();
        } else {
            self.active_player = self.active_player.other();
        }

        if self.stage == PokerStage::Showdown {
            return self.determine_winner();
        }

        Ok(GameOutcome::InProgress)
    }

    fn is_round_complete(&self) -> bool {
        // Both players have acted and bets are equal (or one is all-in)
        let p1_bet = self.player_bets[0];
        let p2_bet = self.player_bets[1];

        if self.all_in[0] || self.all_in[1] {
            return true;
        }

        p1_bet == p2_bet && self.action_history.iter().filter(|a| a.stage == self.stage).count() >= 2
    }

    fn advance_stage(&mut self) {
        // Reset for new round
        self.player_bets = vec![0, 0];
        self.current_bet = 0;
        self.last_raiser = None;

        match self.stage {
            PokerStage::PreFlop => {
                self.stage = PokerStage::Flop;
                // Deal 3 community cards
                for _ in 0..3 {
                    if let Some(card) = self.deck.pop() {
                        self.community_cards.push(card);
                    }
                }
                self.active_player = self.dealer.other();
            }
            PokerStage::Flop => {
                self.stage = PokerStage::Turn;
                if let Some(card) = self.deck.pop() {
                    self.community_cards.push(card);
                }
                self.active_player = self.dealer.other();
            }
            PokerStage::Turn => {
                self.stage = PokerStage::River;
                if let Some(card) = self.deck.pop() {
                    self.community_cards.push(card);
                }
                self.active_player = self.dealer.other();
            }
            PokerStage::River => {
                self.stage = PokerStage::Showdown;
            }
            PokerStage::Showdown => {}
        }
    }

    fn determine_winner(&self) -> Result<GameOutcome, String> {
        // Evaluate hands and determine winner
        let p1_score = self.evaluate_hand(0);
        let p2_score = self.evaluate_hand(1);

        if p1_score > p2_score {
            Ok(GameOutcome::Winner(Player::One))
        } else if p2_score > p1_score {
            Ok(GameOutcome::Winner(Player::Two))
        } else {
            Ok(GameOutcome::Draw)
        }
    }

    fn evaluate_hand(&self, player_idx: usize) -> u32 {
        // Combine player's hole cards with community cards
        let mut all_cards = self.player_hands[player_idx].clone();
        all_cards.extend(self.community_cards.iter().cloned());

        // Simple hand ranking (higher = better)
        // This is simplified - full poker hand evaluation in frontend
        let score: u32;

        // Count ranks
        let mut rank_counts = [0u8; 15];
        let mut suit_counts = [0u8; 4];

        for card in &all_cards {
            rank_counts[card.rank as usize] += 1;
            suit_counts[card.suit as usize] += 1;
        }

        // Check for flush
        let is_flush = suit_counts.iter().any(|&c| c >= 5);

        // Check for straight
        let is_straight = self.check_straight(&rank_counts);

        // Count pairs, trips, quads
        let pairs: Vec<usize> = rank_counts.iter().enumerate().filter(|(_, &c)| c == 2).map(|(i, _)| i).collect();
        let trips: Vec<usize> = rank_counts.iter().enumerate().filter(|(_, &c)| c == 3).map(|(i, _)| i).collect();
        let quads: Vec<usize> = rank_counts.iter().enumerate().filter(|(_, &c)| c == 4).map(|(i, _)| i).collect();

        if is_straight && is_flush {
            score = 800 + rank_counts.iter().enumerate().filter(|(_, &c)| c > 0).map(|(i, _)| i).max().unwrap_or(0) as u32;
        } else if !quads.is_empty() {
            score = 700 + quads[0] as u32;
        } else if !trips.is_empty() && !pairs.is_empty() {
            score = 600 + trips[0] as u32;
        } else if is_flush {
            score = 500;
        } else if is_straight {
            score = 400;
        } else if !trips.is_empty() {
            score = 300 + trips[0] as u32;
        } else if pairs.len() >= 2 {
            score = 200 + *pairs.iter().max().unwrap_or(&0) as u32;
        } else if pairs.len() == 1 {
            score = 100 + pairs[0] as u32;
        } else {
            score = rank_counts.iter().enumerate().filter(|(_, &c)| c > 0).map(|(i, _)| i).max().unwrap_or(0) as u32;
        }

        score
    }

    fn check_straight(&self, rank_counts: &[u8; 15]) -> bool {
        let mut consecutive = 0;
        for i in (2..=14).rev() {
            if rank_counts[i] > 0 {
                consecutive += 1;
                if consecutive >= 5 {
                    return true;
                }
            } else {
                consecutive = 0;
            }
        }
        // Check wheel (A-2-3-4-5)
        if rank_counts[14] > 0 && rank_counts[2] > 0 && rank_counts[3] > 0 && rank_counts[4] > 0 && rank_counts[5] > 0 {
            return true;
        }
        false
    }
}

// ============ BLACKJACK ============

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum BlackjackAction {
    Hit,
    Stand,
    Double,
    Split,
    Insurance,
}

#[derive(Clone, Serialize, Deserialize, SimpleObject)]
pub struct BlackjackGame {
    pub player_hands: Vec<Vec<Card>>,
    pub dealer_hand: Vec<Card>,
    pub deck: Vec<Card>,
    pub current_hand: usize,
    pub bets: Vec<u64>,
    pub player_chips: u64,
    pub is_player_turn: bool,
    pub is_game_over: bool,
    pub insurance_bet: Option<u64>,
    pub results: Vec<BlackjackResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum)]
pub enum BlackjackResult {
    Win,
    Lose,
    Push,
    Blackjack,
    Bust,
}

impl BlackjackGame {
    pub fn new(bet: u64, player_chips: u64, seed: u64) -> Self {
        let mut deck = Self::create_shuffled_deck(seed);

        // Deal initial cards
        let player_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];
        let dealer_hand = vec![deck.pop().unwrap(), deck.pop().unwrap()];

        BlackjackGame {
            player_hands: vec![player_hand],
            dealer_hand,
            deck,
            current_hand: 0,
            bets: vec![bet],
            player_chips: player_chips - bet,
            is_player_turn: true,
            is_game_over: false,
            insurance_bet: None,
            results: vec![],
        }
    }

    fn create_shuffled_deck(seed: u64) -> Vec<Card> {
        // Use 6 decks for blackjack
        let mut deck = Vec::with_capacity(312);
        for _ in 0..6 {
            for suit in [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades] {
                for rank in 2..=14 {
                    deck.push(Card { rank, suit });
                }
            }
        }

        let mut rng_state = seed;
        for i in (1..deck.len()).rev() {
            rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
            let j = (rng_state as usize) % (i + 1);
            deck.swap(i, j);
        }

        deck
    }

    pub fn make_action(&mut self, action: BlackjackAction) -> Result<GameOutcome, String> {
        if !self.is_player_turn || self.is_game_over {
            return Err("Not player's turn".to_string());
        }

        match action {
            BlackjackAction::Hit => {
                if let Some(card) = self.deck.pop() {
                    self.player_hands[self.current_hand].push(card);
                }

                let value = self.calculate_hand_value(&self.player_hands[self.current_hand]);
                if value > 21 {
                    self.results.push(BlackjackResult::Bust);
                    self.advance_hand();
                }
            }
            BlackjackAction::Stand => {
                self.advance_hand();
            }
            BlackjackAction::Double => {
                if self.player_hands[self.current_hand].len() != 2 {
                    return Err("Can only double on first two cards".to_string());
                }

                let bet = self.bets[self.current_hand];
                if bet > self.player_chips {
                    return Err("Insufficient chips to double".to_string());
                }

                self.player_chips -= bet;
                self.bets[self.current_hand] *= 2;

                if let Some(card) = self.deck.pop() {
                    self.player_hands[self.current_hand].push(card);
                }

                let value = self.calculate_hand_value(&self.player_hands[self.current_hand]);
                if value > 21 {
                    self.results.push(BlackjackResult::Bust);
                }
                self.advance_hand();
            }
            BlackjackAction::Split => {
                let hand = &self.player_hands[self.current_hand];
                if hand.len() != 2 || hand[0].rank != hand[1].rank {
                    return Err("Cannot split".to_string());
                }

                let bet = self.bets[self.current_hand];
                if bet > self.player_chips {
                    return Err("Insufficient chips to split".to_string());
                }

                self.player_chips -= bet;
                let second_card = self.player_hands[self.current_hand].pop().unwrap();
                self.player_hands.push(vec![second_card]);
                self.bets.push(bet);

                // Deal one card to each hand
                if let Some(card) = self.deck.pop() {
                    self.player_hands[self.current_hand].push(card);
                }
                if let Some(card) = self.deck.pop() {
                    self.player_hands.last_mut().unwrap().push(card);
                }
            }
            BlackjackAction::Insurance => {
                if self.dealer_hand[0].rank != 14 {
                    return Err("Insurance only available when dealer shows Ace".to_string());
                }
                let insurance = self.bets[0] / 2;
                if insurance > self.player_chips {
                    return Err("Insufficient chips for insurance".to_string());
                }
                self.player_chips -= insurance;
                self.insurance_bet = Some(insurance);
            }
        }

        if !self.is_player_turn {
            self.play_dealer();
            self.resolve_game();
        }

        if self.is_game_over {
            // Calculate total winnings
            let mut won = false;
            for result in &self.results {
                if matches!(result, BlackjackResult::Win | BlackjackResult::Blackjack) {
                    won = true;
                    break;
                }
            }
            if won {
                Ok(GameOutcome::Winner(Player::One))
            } else if self.results.iter().all(|r| matches!(r, BlackjackResult::Push)) {
                Ok(GameOutcome::Draw)
            } else {
                Ok(GameOutcome::Winner(Player::Two)) // House wins
            }
        } else {
            Ok(GameOutcome::InProgress)
        }
    }

    fn advance_hand(&mut self) {
        self.current_hand += 1;
        if self.current_hand >= self.player_hands.len() {
            self.is_player_turn = false;
        }
    }

    fn play_dealer(&mut self) {
        while self.calculate_hand_value(&self.dealer_hand) < 17 {
            if let Some(card) = self.deck.pop() {
                self.dealer_hand.push(card);
            }
        }
    }

    fn resolve_game(&mut self) {
        let dealer_value = self.calculate_hand_value(&self.dealer_hand);
        let dealer_bust = dealer_value > 21;
        let dealer_blackjack = dealer_value == 21 && self.dealer_hand.len() == 2;

        // Handle insurance
        if let Some(insurance) = self.insurance_bet {
            if dealer_blackjack {
                self.player_chips += insurance * 3; // 2:1 payout plus original bet
            }
        }

        for (i, hand) in self.player_hands.iter().enumerate() {
            if i < self.results.len() {
                continue; // Already resolved (bust)
            }

            let player_value = self.calculate_hand_value(hand);
            let player_blackjack = player_value == 21 && hand.len() == 2;

            let result = if player_blackjack && !dealer_blackjack {
                self.player_chips += (self.bets[i] as f64 * 2.5) as u64; // 3:2 payout
                BlackjackResult::Blackjack
            } else if dealer_bust {
                self.player_chips += self.bets[i] * 2;
                BlackjackResult::Win
            } else if dealer_blackjack && !player_blackjack {
                BlackjackResult::Lose
            } else if player_value > dealer_value {
                self.player_chips += self.bets[i] * 2;
                BlackjackResult::Win
            } else if player_value < dealer_value {
                BlackjackResult::Lose
            } else {
                self.player_chips += self.bets[i]; // Return bet
                BlackjackResult::Push
            };

            self.results.push(result);
        }

        self.is_game_over = true;
    }

    fn calculate_hand_value(&self, hand: &[Card]) -> u32 {
        let mut value = 0u32;
        let mut aces = 0u32;

        for card in hand {
            let card_value = match card.rank {
                2..=10 => card.rank as u32,
                11..=13 => 10, // J, Q, K
                14 => { // Ace
                    aces += 1;
                    11
                }
                _ => 0,
            };
            value += card_value;
        }

        // Reduce aces from 11 to 1 if needed
        while value > 21 && aces > 0 {
            value -= 10;
            aces -= 1;
        }

        value
    }

    pub fn get_player_hand_value(&self, hand_idx: usize) -> u32 {
        self.calculate_hand_value(&self.player_hands[hand_idx])
    }

    pub fn get_dealer_visible_value(&self) -> u32 {
        if self.is_player_turn {
            // Only show first card value
            match self.dealer_hand[0].rank {
                2..=10 => self.dealer_hand[0].rank as u32,
                11..=13 => 10,
                14 => 11,
                _ => 0,
            }
        } else {
            self.calculate_hand_value(&self.dealer_hand)
        }
    }
}

// ============ GAME STATE ============

#[derive(Clone, Serialize, Deserialize, SimpleObject)]
pub struct GameState {
    pub game_id: String,
    pub game_type: GameType,
    pub game_mode: GameMode,
    pub status: GameStatus,
    pub players: Vec<String>,
    pub player_names: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub winner: Option<Player>,
    // Game-specific state
    pub chess_board: Option<ChessBoard>,
    pub poker_game: Option<PokerGame>,
    pub blackjack_game: Option<BlackjackGame>,
}

// ============ COMMON TYPES ============

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Enum, Default)]
pub enum Player {
    #[default]
    One,
    Two,
}

impl Player {
    pub fn other(self) -> Self {
        match self {
            Player::One => Player::Two,
            Player::Two => Player::One,
        }
    }

    pub fn index(&self) -> usize {
        match self {
            Player::One => 0,
            Player::Two => 1,
        }
    }
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameOutcome {
    Winner(Player),
    Draw,
    InProgress,
}

// ============ CLOCK ============

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, SimpleObject)]
pub struct Clock {
    pub time_left: [TimeDelta; 2],
    pub increment: TimeDelta,
    pub current_turn_start: Timestamp,
    pub block_delay: TimeDelta,
}

impl Clock {
    pub fn new(block_time: Timestamp, timeouts: &Timeouts) -> Self {
        Self {
            time_left: [timeouts.start_time, timeouts.start_time],
            increment: timeouts.increment,
            current_turn_start: block_time,
            block_delay: timeouts.block_delay,
        }
    }

    pub fn make_move(&mut self, block_time: Timestamp, player: Player) {
        let duration = block_time.delta_since(self.current_turn_start);
        let i = player.index();
        if self.time_left[i] >= duration {
            self.time_left[i] = self.time_left[i]
                .saturating_sub(duration)
                .saturating_add(self.increment);
        }
        self.current_turn_start = block_time;
    }

    pub fn timed_out(&self, block_time: Timestamp, player: Player) -> bool {
        self.time_left[player.index()] < block_time.delta_since(self.current_turn_start)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, SimpleObject, InputObject)]
#[graphql(input_name = "TimeoutsInput")]
pub struct Timeouts {
    pub start_time: TimeDelta,
    pub increment: TimeDelta,
    pub block_delay: TimeDelta,
}

impl Default for Timeouts {
    fn default() -> Timeouts {
        Timeouts {
            start_time: TimeDelta::from_secs(300),
            increment: TimeDelta::from_secs(10),
            block_delay: TimeDelta::from_secs(5),
        }
    }
}

// ============ LEADERBOARD ============

#[derive(Debug, Clone, Serialize, Deserialize, SimpleObject)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub username: String,
    pub eth_address: String,
    pub wins: u32,
    pub losses: u32,
    pub win_rate: f64,
    pub elo: u32,
    pub total_games: u32,
}

// ============ OPERATIONS ============

#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    // User Management
    RegisterUser {
        username: String,
        eth_address: String,
        avatar_url: String,
    },
    UpdateProfile {
        username: Option<String>,
        avatar_url: Option<String>,
    },

    // Lobby Management
    CreateLobby {
        game_type: GameType,
        game_mode: GameMode,
        is_public: bool,
        password: Option<String>,
        time_control: u64,
    },
    JoinLobby {
        lobby_id: String,
        password: Option<String>,
    },
    CancelLobby {
        lobby_id: String,
    },

    // Game Operations
    CreateGame {
        game_type: GameType,
        game_mode: GameMode,
        opponent: Option<AccountOwner>,
        timeouts: Option<Timeouts>,
    },

    // Chess Operations
    ChessMove {
        game_id: String,
        from_square: u8,
        to_square: u8,
        promotion: Option<PieceType>,
    },

    // Poker Operations
    PokerAction {
        game_id: String,
        action: PokerAction,
        bet_amount: Option<u64>,
    },

    // Blackjack Operations
    BlackjackAction {
        game_id: String,
        action: BlackjackAction,
    },

    // Game Control
    ResignGame {
        game_id: String,
    },
    OfferDraw {
        game_id: String,
    },
    AcceptDraw {
        game_id: String,
    },
    ClaimTimeout {
        game_id: String,
    },

    // Record bot game result
    RecordBotGame {
        game_type: GameType,
        won: bool,
        moves: u32,
        eth_address: String,
    },
}

impl ContractAbi for GamePlatformAbi {
    type Operation = Operation;
    type Response = GameOutcome;
}

impl ServiceAbi for GamePlatformAbi {
    type Query = Request;
    type QueryResponse = Response;
}
