# ChainGames GraphQL Testing Guide

**Note:** This app uses `@linera/client` which handles gRPC connections to Conway testnet validators automatically. For local development/testing, you can use the GraphQL playground below. For production, `@linera/client` connects via gRPC automatically.

## Accessing the GraphQL Playground (Local Development)

### Important: Use the Application-Specific Endpoint

The correct GraphQL endpoint for the ChainGames app (local development):

```
http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2
```

**DO NOT use** `http://localhost:8080` directly - that's the generic Linera schema, not the app's schema.

---

## Test Queries

### 1. Check Platform Stats
```graphql
query {
  totalUsers
  totalGamesPlayed
}
```

### 2. Check if Username is Available
```graphql
query {
  isUsernameAvailable(username: "TestPlayer")
}
```

### 3. Get User by ETH Address
```graphql
query {
  userByEthAddress(ethAddress: "0x1234567890abcdef1234567890abcdef12345678") {
    username
    ethAddress
    chessWins
    chessLosses
    chessElo
    totalGames
    currentStreak
    bestStreak
  }
}
```

### 4. Get Leaderboard
```graphql
query {
  leaderboard(limit: 10) {
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
```

### 5. Get Open Lobbies
```graphql
query {
  openLobbies {
    lobbyId
    creatorName
    gameType
    gameMode
    timeControl
    status
    createdAt
    players
  }
}
```

### 6. Get Specific Lobby
```graphql
query {
  lobby(lobbyId: "YOUR_LOBBY_ID") {
    lobbyId
    creator
    creatorName
    gameType
    gameMode
    isPublic
    status
    timeControl
    players
    gameId
  }
}
```

### 7. Get Game State
```graphql
query {
  game(gameId: "YOUR_GAME_ID") {
    gameId
    gameType
    gameMode
    status
    players
    playerNames
    winner
    chessBoard {
      activePlayer
      isCheck
      isCheckmate
      moveHistory {
        notation
        fromSquare
        toSquare
      }
    }
  }
}
```

---

## Test Mutations

### 1. Register a New User
```graphql
mutation {
  registerUser(
    username: "TestPlayer"
    ethAddress: "0xabcdef1234567890abcdef1234567890abcdef12"
    avatarUrl: ""
  )
}
```

### 2. Record a Bot Game Result
```graphql
mutation {
  recordBotGame(
    gameType: CHESS
    won: true
    moves: 25
    ethAddress: "0xabcdef1234567890abcdef1234567890abcdef12"
  )
}
```

### 3. Create a Lobby
```graphql
mutation {
  createLobby(
    gameType: CHESS
    gameMode: VS_FRIEND
    isPublic: true
    timeControl: 300
  )
}
```

### 4. Join a Lobby
```graphql
mutation {
  joinLobby(
    lobbyId: "YOUR_LOBBY_ID"
  )
}
```

### 5. Make a Chess Move
```graphql
mutation {
  chessMove(
    gameId: "YOUR_GAME_ID"
    fromSquare: 12
    toSquare: 28
  )
}
```
*Note: Squares are numbered 0-63, where 0=a1, 7=h1, 56=a8, 63=h8*

### 6. Resign from Game
```graphql
mutation {
  resignGame(gameId: "YOUR_GAME_ID")
}
```

---

## cURL Testing Commands

### Test Connection
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ totalUsers totalGamesPlayed }"}'
```

### Register User
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { registerUser(username: \"Player1\", ethAddress: \"0x1234567890abcdef1234567890abcdef12345678\", avatarUrl: \"\") }"}'
```

### Get User Profile
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ userByEthAddress(ethAddress: \"0x1234567890abcdef1234567890abcdef12345678\") { username chessWins chessLosses totalGames } }"}'
```

### Record Bot Game
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { recordBotGame(gameType: CHESS, won: true, moves: 25, ethAddress: \"0x1234567890abcdef1234567890abcdef12345678\") }"}'
```

### Get Leaderboard
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ leaderboard(limit: 10) { rank username wins losses elo } }"}'
```

---

## Debugging Tips

### 1. Check if Linera Service is Running
```bash
curl http://localhost:8080
```
If you see a response, the service is running.

### 2. Clear Frontend Cache
Open browser console (F12) and run:
```javascript
localStorage.removeItem('chaingames-store')
location.reload()
```

### 3. Check Current User Registration
After connecting wallet, verify the user is registered:
```graphql
query {
  userByEthAddress(ethAddress: "YOUR_ETH_ADDRESS") {
    username
    totalGames
    chessWins
    chessLosses
  }
}
```

### 4. Verify Game Recording
After a game ends, check the stats:
```graphql
query {
  userByEthAddress(ethAddress: "YOUR_ETH_ADDRESS") {
    chessWins
    chessLosses
    totalGames
    currentStreak
  }
}
```

---

## Enum Values

### GameType
- `CHESS`
- `POKER`
- `BLACKJACK`

### GameMode
- `VS_BOT`
- `VS_FRIEND`
- `LOCAL`

### GameStatus
- `WAITING_FOR_OPPONENT`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `TIMED_OUT`

---

## Troubleshooting

### "500 Internal Server Error"
1. Make sure the Linera service is running: `linera service --port 8080`
2. Check if the user is registered before recording games
3. Verify the eth_address matches a registered user

### Stats Not Updating
1. Wait a few seconds for blockchain confirmation
2. Query the user profile directly to verify
3. Check browser console for errors

### Multiplayer Not Working
1. Both players must be registered
2. Use the correct lobby ID
3. Poll the game state every 2 seconds for updates

---

## Architecture Notes

1. **Queries** are read-only operations that fetch data from the blockchain
2. **Mutations** schedule operations that modify blockchain state
3. Game state is persisted on-chain and synced via polling
4. Bot games record results via `recordBotGame` mutation
5. Friend games sync moves via `chessMove` mutation and poll for opponent moves
