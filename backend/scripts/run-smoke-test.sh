#!/usr/bin/env bash
# Shell script to run the assignment smoke test against a running backend
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
SMOKE_SCRIPT="$BACKEND_DIR/smoke_test.py"

BASE_URL="${1:-http://localhost:8000}"

echo "========================================"
echo "   VIKMO DealerDesk - Smoke Test Runner "
echo "========================================"

cd "$BACKEND_DIR"
echo "Executing smoke_test.py against $BASE_URL --all"

if command -v uv &> /dev/null; then
    uv run python "$SMOKE_SCRIPT" --base-url "$BASE_URL" --all
elif command -v python3 &> /dev/null; then
    python3 "$SMOKE_SCRIPT" --base-url "$BASE_URL" --all
elif command -v python &> /dev/null; then
    python "$SMOKE_SCRIPT" --base-url "$BASE_URL" --all
else
    echo "Python not found. Please install Python 3.11+."
    exit 1
fi

