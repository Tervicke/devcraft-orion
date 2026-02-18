#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting backend on http://localhost:3000..."
bun run index.ts &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend"
echo "Starting frontend on http://localhost:5173..."
bun dev

echo "Stopping backend..."
kill "$BACKEND_PID" 2>/dev/null || true

