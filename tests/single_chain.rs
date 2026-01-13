// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

//! Integration testing for the game_platform application.

#![cfg(not(target_arch = "wasm32"))]

use game_platform::{GameType, GameMode, Operation};
use linera_sdk::test::{QueryOutcome, TestValidator};

/// Tests user registration and querying
#[tokio::test(flavor = "multi_thread")]
async fn test_user_registration() {
    let (validator, module_id) =
        TestValidator::with_current_module::<game_platform::GamePlatformAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Register a user
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RegisterUser {
                username: "TestPlayer".to_string(),
                eth_address: "0x1234567890abcdef1234567890abcdef12345678".to_string(),
                avatar_url: "https://example.com/avatar.png".to_string(),
            });
        })
        .await;

    // Query total users
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { totalUsers }")
        .await;
    let total_users = response["totalUsers"].as_i64().expect("Failed to get total users");
    assert_eq!(total_users, 1);

    // Check username availability (should be taken now)
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, r#"query { isUsernameAvailable(username: "testplayer") }"#)
        .await;
    let is_available = response["isUsernameAvailable"].as_bool().expect("Failed to get availability");
    assert!(!is_available); // Should be taken (case-insensitive)

    // Check different username is available
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, r#"query { isUsernameAvailable(username: "newplayer") }"#)
        .await;
    let is_available = response["isUsernameAvailable"].as_bool().expect("Failed to get availability");
    assert!(is_available);
}

/// Tests creating a lobby
#[tokio::test(flavor = "multi_thread")]
async fn test_create_lobby() {
    let (validator, module_id) =
        TestValidator::with_current_module::<game_platform::GamePlatformAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // First register a user
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RegisterUser {
                username: "LobbyCreator".to_string(),
                eth_address: "0xabcdef1234567890abcdef1234567890abcdef12".to_string(),
                avatar_url: "".to_string(),
            });
        })
        .await;

    // Create a lobby
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::CreateLobby {
                game_type: GameType::Chess,
                game_mode: GameMode::VsFriend,
                is_public: true,
                password: None,
                time_control: 300,
            });
        })
        .await;

    // Query open lobbies
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, r#"query { openLobbies { lobbyId gameType creatorName } }"#)
        .await;

    let lobbies = response["openLobbies"].as_array().expect("Failed to get lobbies");
    assert_eq!(lobbies.len(), 1);
    assert_eq!(lobbies[0]["creatorName"].as_str().unwrap(), "LobbyCreator");
}

/// Tests recording bot game results
#[tokio::test(flavor = "multi_thread")]
async fn test_record_bot_game() {
    let (validator, module_id) =
        TestValidator::with_current_module::<game_platform::GamePlatformAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Register a user
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RegisterUser {
                username: "BotPlayer".to_string(),
                eth_address: "0x9876543210fedcba9876543210fedcba98765432".to_string(),
                avatar_url: "".to_string(),
            });
        })
        .await;

    // Record a win against bot
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RecordBotGame {
                game_type: GameType::Chess,
                won: true,
                moves: 25,
            });
        })
        .await;

    // Record a loss against bot
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RecordBotGame {
                game_type: GameType::Chess,
                won: false,
                moves: 30,
            });
        })
        .await;

    // Check leaderboard has the entry
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, r#"query { leaderboard(limit: 10) { username wins losses totalGames } }"#)
        .await;

    let leaderboard = response["leaderboard"].as_array().expect("Failed to get leaderboard");
    assert!(!leaderboard.is_empty());

    let entry = &leaderboard[0];
    assert_eq!(entry["username"].as_str().unwrap(), "BotPlayer");
    assert_eq!(entry["wins"].as_i64().unwrap(), 1);
    assert_eq!(entry["losses"].as_i64().unwrap(), 1);
    assert_eq!(entry["totalGames"].as_i64().unwrap(), 2);
}

/// Tests global stats queries
#[tokio::test(flavor = "multi_thread")]
async fn test_global_stats() {
    let (validator, module_id) =
        TestValidator::with_current_module::<game_platform::GamePlatformAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Query initial stats
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { totalGamesPlayed totalUsers }")
        .await;

    assert_eq!(response["totalGamesPlayed"].as_i64().unwrap(), 0);
    assert_eq!(response["totalUsers"].as_i64().unwrap(), 0);

    // Register users
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RegisterUser {
                username: "Player1".to_string(),
                eth_address: "0x1111111111111111111111111111111111111111".to_string(),
                avatar_url: "".to_string(),
            });
        })
        .await;

    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { totalUsers }")
        .await;

    assert_eq!(response["totalUsers"].as_i64().unwrap(), 1);
}
