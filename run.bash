#!/usr/bin/env bash

set -eu

echo "🚀 Starting ChainGames Platform..."

# Set up nvm and node environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Start Linera network
echo "📦 Starting Linera network..."
eval "$(linera net helper)"
linera_spawn linera net up --with-faucet

export LINERA_FAUCET_URL=http://localhost:8080

# Initialize wallet if needed
if [ ! -f ~/.config/linera/wallet.json ]; then
    echo "💰 Initializing wallet..."
    linera wallet init --faucet="$LINERA_FAUCET_URL"
    linera wallet request-chain --faucet="$LINERA_FAUCET_URL"
fi

# Build and publish your backend
echo "🔨 Building Rust backend..."
cd /build

# Build the contract and service for WASM
cargo build --release --target wasm32-unknown-unknown

# Build and run your frontend
echo "🎨 Building and running frontend..."
cd /build/frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    pnpm install
fi

# Build frontend for production
echo "🔨 Building frontend..."
pnpm run build

# Start the frontend preview server
echo "🌐 Starting frontend server on http://0.0.0.0:5173..."
exec pnpm run preview --host 0.0.0.0 --port 5173
