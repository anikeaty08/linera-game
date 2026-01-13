# 🎮 ChainGames

[![Linera](https://img.shields.io/badge/Linera-v0.15.8-blue?style=for-the-badge&logo=blockchain&logoColor=white)](https://linera.io)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-Latest-orange?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![On-Chain](https://img.shields.io/badge/100%25-On--Chain-success?style=for-the-badge)](https://github.com)

> **Fully decentralized gaming platform on Linera blockchain** featuring Chess ♟️, Poker 🃏, and Blackjack 🎰. Pure client-side with all game states, profiles, and leaderboards stored on-chain.

---

## ✨ Features

- 🎯 **Pure Client-Side** - No backend servers, just React + `@linera/client`
- ⛓️ **100% On-Chain** - All user data, game states, and stats live on blockchain
- 🤖 **AI Opponents** - Play against Gemini-powered bots
- 🏆 **Live Leaderboards** - Global rankings with ELO ratings
- 👥 **Multiplayer Lobbies** - Create public/private game rooms

---

## 🚀 Quick Start

### Prerequisites
```bash
# Install Linera CLI
curl https://linera.io/install.sh | bash
linera --version
```

### Local Development

```bash
# 1. Start Linera service
linera service --port 8080

# 2. Run frontend
cd frontend
npm install
npm run dev
```

**Frontend:** `http://localhost:5173`  
**GraphQL Playground:** `http://localhost:8080`

---

## 📦 Contract Info

```
Chain ID: 81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9
App ID:   55b7f913527c71c4b7f3887b9b19440aff59fdac9e78e4297217c376c4532b61
Endpoint: http://localhost:8080/chains/{CHAIN_ID}/applications/{APP_ID}
```

---

## 🎮 Games

<table>
<tr>
<td align="center" width="33%">

### ♟️ Chess
Full FIDE rules  
Castling & en passant  
Time controls  
Move history

</td>
<td align="center" width="33%">

### 🃏 Poker
Texas Hold'em  
Betting rounds  
Hand evaluation  
Pot management

</td>
<td align="center" width="33%">

### 🎰 Blackjack
Hit/Stand/Double  
Insurance bets  
Dealer AI  
Split hands

</td>
</tr>
</table>

---

## 🔍 GraphQL Examples

### Queries
```graphql
# Platform stats
{ totalUsers totalGamesPlayed }

# Leaderboard
{ leaderboard(limit: 10) { rank username wins losses elo } }

# Game state
{ game(gameId: "...") { status players winner } }
```

### Mutations
```graphql
# Register user
mutation { registerUser(username: "Player1", ethAddress: "0x...", avatarUrl: "") }

# Make chess move (squares: 0=a1, 63=h8)
mutation { chessMove(gameId: "...", fromSquare: 12, toSquare: 28) }

# Record bot game
mutation { recordBotGame(gameType: CHESS, won: true, moves: 25) }
```

<details>
<summary>📖 <b>Full API Reference</b></summary>

### Key Queries
- `totalUsers` / `totalGamesPlayed` - Platform stats
- `leaderboard(limit)` - Top players
- `game(gameId)` - Game state
- `openLobbies(gameType?)` - Available lobbies
- `userByEthAddress(address)` - User profile

### Key Mutations
- `registerUser(username, ethAddress, avatarUrl)` - Create account
- `createLobby(gameType, gameMode, isPublic, timeControl)` - New lobby
- `joinLobby(lobbyId, password?)` - Join game
- `chessMove(gameId, fromSquare, toSquare)` - Chess move
- `pokerAction(gameId, action, betAmount?)` - Poker action
- `blackjackAction(gameId, action)` - Blackjack action

</details>

---

## 🛠️ Tech Stack

**Blockchain** • Linera v0.15.8 + async-graphql  
**Contract** • Rust (WASM)  
**Frontend** • React 18 + TypeScript + Vite  
**Styling** • TailwindCSS  
**State** • Zustand  
**AI** • Gemini API  

---

## 📁 Project Structure

```
linera-game/
├── src/
│   ├── lib.rs          # Core types & game logic
│   ├── state.rs        # Blockchain storage
│   ├── contract.rs     # Smart contract
│   └── service.rs      # GraphQL API
├── frontend/
│   ├── src/
│   │   ├── pages/      # Game UIs
│   │   ├── store/      # Zustand store
│   │   └── services/   # API client
│   └── package.json
└── tests/
    └── single_chain.rs
```

---

## 🧪 Testing

### GraphQL Playground
Navigate to `http://localhost:8080` and test:
```graphql
query { totalUsers totalGamesPlayed }
```

### cURL
```bash
curl -X POST "http://localhost:8080/chains/.../applications/..." \
  -H "Content-Type: application/json" \
  -d '{"query": "{ totalUsers }"}'
```

### Clear Cache
```javascript
// Browser console (F12)
localStorage.removeItem('chaingames-store')
location.reload()
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Frontend not updating | Clear localStorage or poll `game(gameId)` query |
| Service not responding | Check `curl http://localhost:8080` |
| Need to rebuild | `cargo build --release --target wasm32-unknown-unknown` |

---

## 🌐 On-Chain Architecture

All game data lives on Linera blockchain:

✅ User profiles with ELO ratings  
✅ Complete game states and move history  
✅ Multiplayer lobbies and matchmaking  
✅ Global leaderboards per game type  

Every move is a GraphQL mutation executing on-chain. No centralized servers!

---

## 📄 License

MIT License

---

<div align="center">

**Built with ❤️ on Linera Blockchain**

[Linera Docs](https://docs.linera.io) • [Report Bug](../../issues) • [Request Feature](../../issues)

[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-orange?style=flat-square&logo=rust)](https://www.rust-lang.org)
[![Powered by React](https://img.shields.io/badge/Powered%20by-React-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Blockchain](https://img.shields.io/badge/100%25-Decentralized-success?style=flat-square)](https://linera.io)

</div>