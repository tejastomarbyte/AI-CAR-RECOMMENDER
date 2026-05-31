#!/usr/bin/env bash
# CarFind AI - Local dev startup (no Docker required)
# Usage: ./dev.sh [ANTHROPIC_API_KEY=your_key]

set -e
ROOT=$(cd "$(dirname "$0")" && pwd)

echo ""
echo "  🚗  CarFind AI - Local Dev Startup"
echo "  ─────────────────────────────────"

# ── Backend ────────────────────────────────────────────────────────────────────
echo "  [1/3] Setting up Python backend..."
cd "$ROOT/backend"

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "  → Created virtual environment"
fi

venv/bin/pip install -r requirements.txt -q
echo "  → Dependencies installed"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "  [2/3] Installing frontend dependencies..."
cd "$ROOT/frontend"
npm install --silent 2>/dev/null || true

# ── Start both ────────────────────────────────────────────────────────────────
echo "  [3/3] Starting services..."
echo ""
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo "  API docs → http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both"
echo ""

# Start backend in background
cd "$ROOT/backend"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend in background
cd "$ROOT/frontend"
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- --port 3000 &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM

wait
