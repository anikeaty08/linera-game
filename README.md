# 🎮 ChainGames

[![Linera](https://img.shields.io/badge/Linera-v0.15.8-blue?style=for-the-badge&logo=blockchain&logoColor=white)](https://linera.io)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.86-orange?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![On-Chain](https://img.shields.io/badge/100%25-On--Chain-success?style=for-the-badge)](https://github.com)

> **Fully decentralized gaming platform on Linera blockchain** with Chess ♟️, Poker 🃏, and Blackjack 🎰. Pure client-side architecture—all profiles, game states, and leaderboards live on-chain.

---

## ✨ Features

- 🎯 **Pure Client-Side** - React + `@linera/client`, zero backend
- ⛓️ **100% On-Chain** - User data, game states, stats stored on blockchain
- 🤖 **AI Opponents** - Gemini-powered bots
- 🏆 **Live Leaderboards** - Global ELO rankings
- 👥 **Multiplayer** - Public/private lobbies
- 🐳 **Docker Ready** - One-command deployment

---

## 🚀 Quick Start

### 🐳 Docker (Recommended)

```bash
# Prerequisites: Docker + Docker Compose installed

# Clone and run
cd linera-game
docker compose build
docker compose up
```

**Access:**
- Frontend: http://localhost:5173
- GraphQL API: http://localhost:8080
- Shard Proxy: http://localhost:9001

**Stop:** `docker compose down`

---

### 💻 Local Development

**Prerequisites:**
```bash
# Rust 1.86+
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Linera CLI
curl https://linera.io/install.sh | bash

# Node.js 20+ LTS
curl https://raw.githubusercontent.com/creationix/nvm/v0.40.3/install.sh | bash
nvm install lts/krypton
npm install -g pnpm
```

**Run:**
```bash
# Terminal 1: Start Linera
linera service --port 8080

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

---

## 📦 Contract Details

```
Chain ID: 81cbeb0c7f867f5c00ba0893dd32423e1375ee7f1a713610f267d3754c44b9e9
App ID:   55b7f913527c71c4b7f3887b9b19440aff59fdac9e78e4297217c376c4532b61
Endpoint: http://localhost:8080/chains/{CHAIN_ID}/applications/{APP_ID}
```

**Stack:** Linera SDK 0.15.8 · async-graphql 7.0.17 · Rust WASM contract

---

## 🎮 Games

| ♟️ **Chess** | 🃏 **Poker** | 🎰 **Blackjack** |
|-------------|-------------|-----------------|
| FIDE rules | Texas Hold'em | Hit/Stand/Double |
| Castling/En passant | Betting rounds | Insurance bets |
| Time controls | Hand evaluation | Dealer AI |
| Move history | Pot management | Split hands |

---

## 🔍 GraphQL API

### Queries
```graphql
# Stats
{ totalUsers totalGamesPlayed }

# Leaderboard
{ leaderboard(limit: 10) { rank username wins losses elo } }

# Game state
{ game(gameId: "...") { status players winner } }

# Open lobbies
{ openLobbies(gameType: CHESS) { lobbyId gameMode isPublic } }

# User profile
{ userByEthAddress(address: "0x...") { username wins losses elo } }
```

### Mutations
```graphql
# Register
mutation { registerUser(username: "Player1", ethAddress: "0x...", avatarUrl: "") }

# Create lobby
mutation { createLobby(gameType: CHESS, gameMode: MULTIPLAYER, isPublic: true, timeControl: 600) }

# Join game
mutation { joinLobby(lobbyId: "...", password: null) }

# Chess move (0=a1, 63=h8)
mutation { chessMove(gameId: "...", fromSquare: 12, toSquare: 28) }

# Poker action
mutation { pokerAction(gameId: "...", action: RAISE, betAmount: 100) }

# Blackjack action
mutation { blackjackAction(gameId: "...", action: HIT) }

# Record bot game
mutation { recordBotGame(gameType: CHESS, won: true, moves: 25) }
```

---

## 🛠️ Tech Stack

**Blockchain:** Linera v0.15.8 (Rust WASM contract + async-graphql)  
**Frontend:** React 18 · TypeScript · Vite · TailwindCSS  
**State:** Zustand  
**AI:** Gemini API

---

## 📁 Structure

```
linera-game/
├── src/
│   ├── lib.rs          # Core types & game logic
│   ├── state.rs        # Blockchain storage
│   ├── contract.rs     # Smart contract
│   └── service.rs      # GraphQL service
├── frontend/
│   ├── src/
│   │   ├── pages/      # Game UIs
│   │   ├── store/      # Zustand state
│   │   └── services/   # API client
│   └── package.json
└── tests/
    └── single_chain.rs
```

---

## 🐛 Troubleshooting

### Docker Issues

| Problem | Fix |
|---------|-----|
| Port in use | `docker compose down && docker system prune` |
| Build fails | `docker compose build --no-cache` |
| Container won't start | `docker logs <container-id>` |
| Frontend not loading | Wait 40s for healthcheck, check http://localhost:5173 |
| GraphQL down | Check Linera service: `docker logs <container-id>` |
| Slow performance | Allocate more resources in Docker settings |

**Useful commands:**
```bash
docker compose logs -f              # View logs
docker exec -it <container-id> bash # Shell access
docker compose down -v              # Stop + remove volumes
docker system prune -a --volumes    # Clean everything
```

### General Issues

| Problem | Fix |
|---------|-----|
| Frontend not updating | `localStorage.removeItem('chaingames-store')` + reload |
| GraphQL errors | Verify endpoint matches chain/app IDs |
| State not persisting | Check mutation response handling |
| Import errors | `npm install` in frontend directory |
| Service down | `curl http://localhost:8080` |
| Need rebuild | `cargo build --release --target wasm32-unknown-unknown` |

---

## 🧪 Testing

### GraphQL Playground
Visit `http://localhost:8080/chains/{chain-id}/applications/{app-id}`:
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

## 🌐 On-Chain Architecture

Every action is a blockchain transaction:
- ✅ User profiles with ELO ratings
- ✅ Complete game states + move history
- ✅ Multiplayer lobbies + matchmaking
- ✅ Global leaderboards per game

**No centralized servers.** Every move = GraphQL mutation executing on-chain.

---

## 🐳 Docker Architecture

**Container:** `rust:1.86-slim` base image  
**Ports:** 5173 (frontend), 8080 (GraphQL), 8079 (faucet), 9001 (proxy), 13001 (shard)  
**Volume:** Project mounted to `/build` with hot reload  
**Startup:** `run.bash` initializes network → compiles contract → starts services

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