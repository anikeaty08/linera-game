#!/usr/bin/env bash

set -eu

echo "=========================================="
echo "   ChainGames Platform - Docker Startup   "
echo "=========================================="

# Set up nvm and node environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Clean up any existing Linera processes
pkill -f "linera" 2>/dev/null || true
sleep 1

# Configuration
FAUCET_PORT=8079      # Internal faucet port
SERVICE_PORT=8080     # GraphQL service port (external)
FRONTEND_PORT=5173    # Frontend port

echo ""
echo "1. Starting Linera local network..."
echo "-----------------------------------"

# Set up the Linera network helper
eval "$(linera net helper)"

# Start the network with faucet on internal port (background)
linera_spawn linera net up --with-faucet --faucet-port $FAUCET_PORT &
NETWORK_PID=$!

# Wait for network to be ready
echo "   Waiting for network to start..."
sleep 10

# Check if faucet is responding
FAUCET_URL="http://localhost:$FAUCET_PORT"
echo "   Checking faucet at $FAUCET_URL..."

for i in {1..30}; do
    if curl -s "$FAUCET_URL" > /dev/null 2>&1; then
        echo "   Faucet is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   WARNING: Faucet may not be ready, continuing anyway..."
    fi
    echo "   Waiting for faucet... ($i/30)"
    sleep 2
done

export LINERA_FAUCET_URL="$FAUCET_URL"

echo ""
echo "2. Initializing wallet..."
echo "-----------------------------------"

# Remove old wallet config
rm -rf ~/.config/linera 2>/dev/null || true

# Initialize wallet from faucet
echo "   Initializing wallet from faucet..."
linera wallet init --faucet="$LINERA_FAUCET_URL" || {
    echo "   Retrying wallet init..."
    sleep 5
    linera wallet init --faucet="$LINERA_FAUCET_URL"
}

# Request a chain from the faucet
echo "   Requesting chain from faucet..."
linera wallet request-chain --faucet="$LINERA_FAUCET_URL" || {
    echo "   Retrying chain request..."
    sleep 3
    linera wallet request-chain --faucet="$LINERA_FAUCET_URL"
}

# Get chain ID from wallet
echo "   Getting chain information..."
WALLET_OUTPUT=$(linera wallet show 2>&1)
echo "   Wallet output:"
echo "$WALLET_OUTPUT"

# Extract chain ID (64-char hex string)
CHAIN_ID=$(echo "$WALLET_OUTPUT" | grep -oE '[a-f0-9]{64}' | head -1)

if [ -z "$CHAIN_ID" ]; then
    echo "   ERROR: Could not get Chain ID"
    echo "   Wallet show output: $WALLET_OUTPUT"
    exit 1
fi

echo "   Chain ID: $CHAIN_ID"

echo ""
echo "3. Building Linera contract..."
echo "-----------------------------------"
cd /build

# Build WASM contract and service
cargo build --release --target wasm32-unknown-unknown

# Find the built WASM files
CONTRACT_WASM="/build/target/wasm32-unknown-unknown/release/game_platform_contract.wasm"
SERVICE_WASM="/build/target/wasm32-unknown-unknown/release/game_platform_service.wasm"

if [ ! -f "$CONTRACT_WASM" ]; then
    echo "   ERROR: Contract WASM not found at $CONTRACT_WASM"
    ls -la /build/target/wasm32-unknown-unknown/release/*.wasm 2>/dev/null || echo "   No WASM files found"
    exit 1
fi

if [ ! -f "$SERVICE_WASM" ]; then
    echo "   ERROR: Service WASM not found at $SERVICE_WASM"
    exit 1
fi

echo "   Contract WASM: $(ls -lh $CONTRACT_WASM | awk '{print $5}')"
echo "   Service WASM: $(ls -lh $SERVICE_WASM | awk '{print $5}')"

echo ""
echo "4. Publishing application to chain..."
echo "-----------------------------------"

# Publish and create the application
PUBLISH_OUTPUT=$(linera publish-and-create "$CONTRACT_WASM" "$SERVICE_WASM" 2>&1)
echo "   Publish output:"
echo "$PUBLISH_OUTPUT"

# Extract application ID (64-char hex string, typically the last one)
APP_ID=$(echo "$PUBLISH_OUTPUT" | grep -oE '[a-f0-9]{64}' | tail -1)

if [ -z "$APP_ID" ]; then
    echo "   ERROR: Failed to extract Application ID"
    exit 1
fi

echo "   Application ID: $APP_ID"

echo ""
echo "5. Starting Linera GraphQL service..."
echo "-----------------------------------"

# Start linera service in background for GraphQL endpoint
linera service --port $SERVICE_PORT &
SERVICE_PID=$!
echo "   Linera service PID: $SERVICE_PID"

# Wait for service to be ready
sleep 5

# Test the GraphQL endpoint
GRAPHQL_URL="http://localhost:$SERVICE_PORT/chains/$CHAIN_ID/applications/$APP_ID"
echo "   GraphQL endpoint: $GRAPHQL_URL"

for i in {1..15}; do
    RESPONSE=$(curl -s -X POST "$GRAPHQL_URL" \
        -H "Content-Type: application/json" \
        -d '{"query": "{ totalUsers totalGamesPlayed }"}' 2>/dev/null || echo "")

    if echo "$RESPONSE" | grep -q "totalUsers"; then
        echo "   GraphQL endpoint is ready!"
        echo "   Response: $RESPONSE"
        break
    fi

    if [ $i -eq 15 ]; then
        echo "   WARNING: GraphQL endpoint test failed, but continuing..."
        echo "   Last response: $RESPONSE"
    fi

    echo "   Waiting for GraphQL service... ($i/15)"
    sleep 2
done

echo ""
echo "6. Updating frontend configuration..."
echo "-----------------------------------"
cd /build/frontend

# Update .env file with new chain ID and app ID
cat > .env << EOF
VITE_CHAIN_ID=$CHAIN_ID
VITE_APP_ID=$APP_ID
VITE_GEMINI_API_KEY=
VITE_GRAPHQL_ENDPOINT=http://localhost:$SERVICE_PORT/chains/$CHAIN_ID/applications/$APP_ID
EOF

echo "   Frontend .env updated:"
cat .env

echo ""
echo "7. Building frontend..."
echo "-----------------------------------"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing frontend dependencies..."
    pnpm install
fi

# Build frontend
echo "   Building frontend for production..."
pnpm run build

echo ""
echo "=========================================="
echo "     ChainGames Platform Ready!          "
echo "=========================================="
echo ""
echo "   Frontend URL:  http://localhost:$FRONTEND_PORT"
echo "   GraphQL URL:   $GRAPHQL_URL"
echo ""
echo "   Chain ID:  $CHAIN_ID"
echo "   App ID:    $APP_ID"
echo ""
echo "   All game data is stored on the Linera blockchain!"
echo "=========================================="
echo ""

# Handle shutdown gracefully
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVICE_PID 2>/dev/null || true
    kill $NETWORK_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Start frontend server in foreground
echo "Starting frontend server on http://0.0.0.0:$FRONTEND_PORT..."
pnpm run preview -- --host 0.0.0.0 --port $FRONTEND_PORT
