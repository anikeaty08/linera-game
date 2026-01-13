# Texas Hold'em Poker - Linera Game Platform

## Overview

Texas Hold'em Poker implementation on the Linera blockchain. All game actions are stored on-chain for transparency and verifiability.

## Features

- **Full Texas Hold'em Rules**: Standard poker gameplay with blinds, betting rounds, and hand evaluation
- **On-Chain Storage**: Every action (fold, check, call, raise, all-in) is recorded on the Linera blockchain
- **AI Opponent**: Play against a Gemini-powered AI bot with adaptive strategy
- **Real-time Updates**: Game state polling every 2 seconds for multiplayer synchronization
- **Chip Management**: Track your chips across sessions

## Game Flow

### 1. Game Creation
- Game is created on-chain when you start playing
- Initial chip stack: 1000 chips per player
- Small blind: 10 chips, Big blind: 20 chips

### 2. Betting Rounds
1. **Pre-flop**: Players receive 2 hole cards, first betting round
2. **Flop**: 3 community cards dealt, second betting round
3. **Turn**: 4th community card dealt, third betting round
4. **River**: 5th community card dealt, final betting round
5. **Showdown**: Best 5-card hand wins

### 3. Available Actions
- **Fold**: Surrender your hand and forfeit the pot
- **Check**: Pass the action (only if no bet to call)
- **Call**: Match the current bet
- **Raise**: Increase the bet amount
- **All-in**: Bet all remaining chips

## On-Chain Data

### Stored per Game
```graphql
pokerGame {
  playerHands { rank, suit }
  communityCards { rank, suit }
  pot
  currentBet
  playerBets
  playerChips
  activePlayer
  stage
  folded
  allIn
  actionHistory {
    player
    action
    amount
    stage
    timestamp
  }
}
```

### Mutations (On-Chain Actions)
```graphql
mutation {
  pokerAction(gameId: "...", action: "RAISE", betAmount: 100)
}
```

## Hand Rankings (Highest to Lowest)

1. **Royal Flush**: A, K, Q, J, 10 of same suit
2. **Straight Flush**: 5 consecutive cards of same suit
3. **Four of a Kind**: 4 cards of same rank
4. **Full House**: 3 of a kind + pair
5. **Flush**: 5 cards of same suit
6. **Straight**: 5 consecutive cards
7. **Three of a Kind**: 3 cards of same rank
8. **Two Pair**: 2 different pairs
9. **One Pair**: 2 cards of same rank
10. **High Card**: Highest card wins

## Technical Details

### GraphQL API

**Create Game:**
```graphql
mutation {
  createGame(gameType: POKER, gameMode: VS_BOT, timeSeconds: 300)
}
```

**Get Game State:**
```graphql
query {
  pokerGame(gameId: "...") {
    pot
    stage
    playerChips
    communityCards { rank, suit }
  }
}
```

**Record Action:**
```graphql
mutation {
  pokerAction(gameId: "...", action: "CALL", betAmount: null)
}
```

### Bot AI Strategy

The bot uses Gemini AI to make decisions based on:
- Current hand strength
- Pot odds
- Community cards
- Game stage
- Opponent betting patterns

## Statistics Tracking

After each game, results are recorded:
```graphql
mutation {
  recordBotGame(gameType: POKER, won: true, moves: 1, ethAddress: "0x...")
}
```

Player stats include:
- Poker wins/losses
- Chips won
- Win rate
- Current streak

## Mobile Support

The game is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones

## Deployment

The poker game is deployed as part of the Linera Game Platform static site. No backend servers required - all game logic runs client-side with data stored on the Linera blockchain via gRPC connections to Conway testnet validators.
