FROM rust:1.86-slim

SHELL ["bash", "-c"]

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    protobuf-compiler \
    clang \
    make \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Linera services (matching project version)
RUN cargo install --locked linera-service@0.15.8 linera-storage-service@0.15.8

# Install Node.js via nvm
RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.40.3/install.sh | bash \
    && . ~/.nvm/nvm.sh \
    && nvm install lts/krypton \
    && nvm alias default lts/krypton \
    && nvm use default \
    && npm install -g pnpm

# Set up environment for nvm
ENV NVM_DIR="/root/.nvm"

WORKDIR /build

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

ENTRYPOINT bash /build/run.bash
