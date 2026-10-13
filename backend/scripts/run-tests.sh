#!/usr/bin/env bash
# Shell script to run Backend automated test suites
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_TEST="$BACKEND_DIR/tests/test_backend_contract.py"
UNIT_TEST="$BACKEND_DIR/tests/test_unit_track1.py"
TRACK2_TEST="$BACKEND_DIR/tests/test_track2_ai_ml.py"

echo "========================================"
echo "   VIKMO DealerDesk - Backend Tests     "
echo "========================================"

cd "$BACKEND_DIR"

if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
elif command -v uv &> /dev/null; then
    PYTHON_CMD="uv run python"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Python not found. Please install Python 3.11+."
    exit 1
fi

echo ""
echo "[1/3] Running Backend Contract & Data Integrity Tests..."
$PYTHON_CMD "$CONTRACT_TEST"

echo ""
echo "[2/3] Running Track 1 Serializers, Pricing & Error Invariant Unit Tests..."
$PYTHON_CMD "$UNIT_TEST"

echo ""
echo "[3/3] Running Track 2 AI Assistant, Forecasting & Reorder Engine Tests..."
$PYTHON_CMD "$TRACK2_TEST"

echo ""
echo "========================================"
echo "   All Backend Tests Completed Successfully! "
echo "========================================"
