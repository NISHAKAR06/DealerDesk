#!/usr/bin/env bash
# Shell script to run migrations, seed data, and start Django server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "   DealerDesk Django Backend Server     "
echo "========================================"

cd "$BACKEND_DIR"

if command -v uv &> /dev/null; then
    echo "Running migrations with uv..."
    uv run python manage.py migrate --noinput
    echo "Seeding data..."
    uv run python manage.py seed_data
    echo "Starting Django server on 0.0.0.0:8000..."
    uv run python manage.py runserver 0.0.0.0:8000
elif command -v python3 &> /dev/null; then
    echo "Running migrations with python3..."
    python3 manage.py migrate --noinput
    echo "Seeding data..."
    python3 manage.py seed_data
    echo "Starting Django server on 0.0.0.0:8000..."
    python3 manage.py runserver 0.0.0.0:8000
elif command -v python &> /dev/null; then
    echo "Running migrations with python..."
    python manage.py migrate --noinput
    echo "Seeding data..."
    python manage.py seed_data
    echo "Starting Django server on 0.0.0.0:8000..."
    python manage.py runserver 0.0.0.0:8000
else
    echo "Python 3 is required to run the Django backend."
    exit 1
fi

