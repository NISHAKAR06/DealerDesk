#!/usr/bin/env bash
# Shell script to start the local Mock Supplier server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "   DealerDesk Mock Supplier Server      "
echo "========================================"

cd "$BACKEND_DIR"
if command -v uv &> /dev/null; then
    uv run python supplier_mock/mock_supplier.py "$@"
elif command -v python3 &> /dev/null; then
    python3 supplier_mock/mock_supplier.py "$@"
elif command -v python &> /dev/null; then
    python supplier_mock/mock_supplier.py "$@"
else
    echo "Python 3 is required to run the mock supplier."
    exit 1
fi
