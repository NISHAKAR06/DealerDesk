#!/usr/bin/env bash
# Shell script to run Backend automated test suites
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
TEST_SCRIPT="$BACKEND_DIR/tests/test_backend_contract.py"

echo "========================================"
echo "   VIKMO DealerDesk - Backend Tests     "
echo "========================================"

cd "$BACKEND_DIR"
echo ""
echo "Running Backend Contract & Data Integrity Tests..."

if command -v uv &> /dev/null; then
    uv run python "$TEST_SCRIPT"
elif command -v python3 &> /dev/null; then
    python3 "$TEST_SCRIPT"
elif command -v python &> /dev/null; then
    python "$TEST_SCRIPT"
else
    echo "Python not found. Please install Python 3.11+."
    exit 1
fi

echo ""
echo "========================================"
echo "   Backend Tests Completed Successfully! "
echo "========================================"
