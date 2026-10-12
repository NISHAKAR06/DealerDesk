#!/usr/bin/env bash
# Shell script to run migrations, seed data, and start Django server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "   DealerDesk Django Backend Server     "
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
    echo "Python 3 is required to run the Django backend."
    exit 1
fi

echo "Running migrations..."
$PYTHON_CMD manage.py migrate --noinput

echo "Seeding data..."
$PYTHON_CMD manage.py seed_data

echo "Starting Django server on 0.0.0.0:8000..."
$PYTHON_CMD manage.py runserver 0.0.0.0:8000
