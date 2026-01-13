# ChainGames - On-Chain Gaming Platform

A fully decentralized gaming platform built on **Linera blockchain** featuring Chess, Poker, and Blackjack. All game states, user profiles, and statistics are stored on-chain.

**Pure client-side React app** using `@linera/client` which handles gRPC connections to Conway testnet validators automatically. No backend servers needed!

## Deployed Contract Info

| Property | Value |
|----------|-------|
| **Chain ID** | `81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9` |
| **Application ID** | `07880cdecc939c81a4df950e4d688b837b423937938e70f1d055bd321526add7` |
| **GraphQL Endpoint** | `http://localhost:8080/chains/{CHAIN_ID}/applications/{APP_ID}` |

---

## Quick Start

**Note:** This is a **pure client-side React app** using `@linera/client`. The library handles gRPC connections to Conway testnet validators automatically - just use the faucet URL and let the library handle the rest!

### Option 1: Local Development (with local Linera service)

1. **Start the Linera Service** (for local GraphQL queries):

```bash
# Make sure you have Linera CLI installed
linera --version

# Start the service on port 8080
linera service --port 8080
```

2. **Start the Frontend**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

3. **Access GraphQL Playground** (optional):

Open `http://localhost:8080` in your browser to access the GraphQL IDE.

### Option 2: Conway Testnet (Production)

For production deployment, `@linera/client` automatically connects to Conway testnet validators via gRPC. No local service needed!

1. **Set environment variables** (see `.env.example` in frontend directory)
2. **Start the Frontend**:

```bash
cd frontend
npm install
npm run dev
```

The app will connect to Conway testnet validators automatically via gRPC.

---

## Testing Queries in GraphQL Playground

When you open `http://localhost:8080`, you'll see the GraphQL IDE. Here's how to test:

### Step 1: Navigate to the Application Endpoint

Click on the application link or manually go to:
```
http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2
```

### Step 2: Run Test Queries

Copy and paste these queries into the left panel and click the "Play" button:

#### Check Platform Stats
```graphql
query {
  totalUsers
  totalGamesPlayed
}
```

#### Get Leaderboard
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

#### Check Username Availability
```graphql
query {
  isUsernameAvailable(username: "PlayerOne")
}
```

#### Get User by ETH Address
```graphql
query {
  userByEthAddress(ethAddress: "0x1234567890abcdef1234567890abcdef12345678") {
    username
    ethAddress
    totalGames
    chessWins
    chessLosses
    chessElo
    pokerWins
    pokerLosses
    blackjackWins
    blackjackLosses
    currentStreak
    bestStreak
  }
}
```

#### Get Open Lobbies
```graphql
query {
  openLobbies {
    lobbyId
    creatorName
    gameType
    gameMode
    timeControl
    createdAt
  }
}
```

#### Get Game State
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
      }
    }
  }
}
```

---

## Testing Mutations

### Register a New User
```graphql
mutation {
  registerUser(
    username: "TestPlayer"
    ethAddress: "0xabcdef1234567890abcdef1234567890abcdef12"
    avatarUrl: ""
  )
}
```

### Record a Bot Game Result
```graphql
mutation {
  recordBotGame(
    gameType: CHESS
    won: true
    moves: 25
  )
}
```

### Create a Lobby
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

### Make a Chess Move
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

---

## API Reference

### Queries

| Query | Description | Parameters |
|-------|-------------|------------|
| `totalUsers` | Get total registered users | - |
| `totalGamesPlayed` | Get total games played | - |
| `userProfile(owner)` | Get user by Linera address | `owner: String!` |
| `userByEthAddress(ethAddress)` | Get user by ETH address | `ethAddress: String!` |
| `userByUsername(username)` | Get user by username | `username: String!` |
| `isUsernameAvailable(username)` | Check username availability | `username: String!` |
| `playerStats(owner)` | Get player statistics | `owner: String!` |
| `game(gameId)` | Get game state | `gameId: String!` |
| `playerActiveGames(owner)` | Get active games | `owner: String!` |
| `playerGameHistory(owner, limit)` | Get game history | `owner: String!`, `limit: Int!` |
| `chessBoard(gameId)` | Get chess board state | `gameId: String!` |
| `pokerGame(gameId)` | Get poker game state | `gameId: String!` |
| `blackjackGame(gameId)` | Get blackjack state | `gameId: String!` |
| `lobby(lobbyId)` | Get lobby info | `lobbyId: String!` |
| `openLobbies(gameType)` | Get open lobbies | `gameType: GameType` (optional) |
| `leaderboard(gameType, limit)` | Get leaderboard | `gameType: GameType`, `limit: Int!` |
| `playerRank(owner, gameType)` | Get player rank | `owner: String!`, `gameType: GameType` |

### Mutations

| Mutation | Description | Parameters |
|----------|-------------|------------|
| `registerUser` | Register new user | `username`, `ethAddress`, `avatarUrl` |
| `updateProfile` | Update profile | `username`, `avatarUrl` |
| `createLobby` | Create game lobby | `gameType`, `gameMode`, `isPublic`, `password`, `timeControl` |
| `joinLobby` | Join a lobby | `lobbyId`, `password` |
| `cancelLobby` | Cancel lobby | `lobbyId` |
| `createGame` | Create direct game | `gameType`, `gameMode`, `opponent`, `timeSeconds` |
| `chessMove` | Make chess move | `gameId`, `fromSquare`, `toSquare`, `promotion` |
| `pokerAction` | Poker action | `gameId`, `action`, `betAmount` |
| `blackjackAction` | Blackjack action | `gameId`, `action` |
| `resignGame` | Resign from game | `gameId` |
| `offerDraw` | Offer draw | `gameId` |
| `acceptDraw` | Accept draw | `gameId` |
| `claimTimeout` | Claim timeout win | `gameId` |
| `recordBotGame` | Record bot game | `gameType`, `won`, `moves` |

### Enums

```graphql
enum GameType {
  CHESS
  POKER
  BLACKJACK
}

enum GameMode {
  VS_BOT
  VS_FRIEND
  LOCAL
}

enum GameStatus {
  WAITING_FOR_OPPONENT
  IN_PROGRESS
  COMPLETED
  CANCELLED
  TIMED_OUT
}
```

---

## Project Structure

```
linera-game/
├── src/
│   ├── lib.rs          # ABI types, enums, game logic structs
│   ├── state.rs        # Blockchain storage (MapView, RegisterView)
│   ├── contract.rs     # Smart contract operations
│   └── service.rs      # GraphQL queries and mutations
├── frontend/
│   ├── src/
│   │   ├── pages/      # React pages (Chess, Poker, Blackjack)
│   │   ├── store/      # Zustand state management
│   │   ├── services/   # API client (api.js)
│   │   └── components/ # Reusable UI components
│   └── package.json
├── tests/
│   └── single_chain.rs # Integration tests
├── Cargo.toml
└── README.md
```

---

## Troubleshooting

### Frontend Not Updating

The frontend uses local game state (chess.js) for immediate feedback. To sync with blockchain:

1. **For bot games**: Results are recorded via `recordBotGame` mutation after game ends
2. **For multiplayer**: Poll the `game(gameId)` query every few seconds

### Clear Cached State

If you see old data, clear localStorage:
```javascript
// Run in browser console (F12)
localStorage.removeItem('chaingames-store')
location.reload()
```

### Service Not Running

```bash
# Check if Linera service is running
curl http://localhost:8080

# Restart the service
linera service --port 8080
```

### Rebuild Contract

```bash
# Build for testing
cargo build

# Build for deployment (WASM)
cargo build --release --target wasm32-unknown-unknown
```

---

## Testing with cURL

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
  -d '{"query": "mutation { registerUser(username: \"Player1\", ethAddress: \"0x1234...\", avatarUrl: \"\") }"}'
```

### Get Leaderboard
```bash
curl -X POST "http://localhost:8080/chains/81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9/applications/52000db3cbc04e53f148ccff6670c98e3f09e952453aafc37cbe6a736bd73ad2" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ leaderboard(limit: 10) { rank username wins losses winRate } }"}'
```

---

## Game Features

### Chess
- Full piece movement validation
- Castling (kingside & queenside)
- En passant captures
- Pawn promotion
- Check/checkmate detection
- Move history with algebraic notation
- Time controls

### Poker (Texas Hold'em)
- Pre-flop, Flop, Turn, River stages
- Fold, Check, Call, Raise, All-in actions
- Pot management
- Hand evaluation
- Blind handling

### Blackjack
- Hit, Stand, Double Down, Split
- Insurance betting
- Dealer AI (hits to 17)
- Multiple hands support
- Natural blackjack detection

---

## Tech Stack

- **Blockchain**: Linera (v0.15.8)
- **Smart Contract**: Rust + async-graphql
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **State**: Zustand
- **Wallet**: MetaMask (for identity)
- **AI**: Gemini API (for bot opponents)

---

## Vercel Deployment

Deploy the frontend as a static site on Vercel:

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/linera-game&root-directory=frontend)

### Manual Deployment

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Navigate to frontend**:
```bash
cd frontend
```

3. **Deploy**:
```bash
vercel
```

### Environment Variables (Vercel Dashboard)

Add these in Vercel Project Settings > Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CHAIN_ID` | Your Linera chain ID | Yes |
| `VITE_APP_ID` | Your deployed app ID | Yes |
| `VITE_GEMINI_API_KEY` | Gemini API key for AI bots | No |

### WASM Headers

The `vercel.json` is pre-configured with:
- CORS headers for WASM support
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- SPA routing fallback

### Build Settings (Auto-detected)

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Framework**: Vite

---

## On-Chain Data

All game data is stored on the Linera blockchain:

- **User Profiles**: Username, stats, ELO ratings
- **Game States**: Board positions, move history
- **Lobbies**: Multiplayer game coordination
- **Leaderboards**: Rankings per game type

Each move/action is recorded as a GraphQL mutation that executes on-chain.

---

## License

MIT License
