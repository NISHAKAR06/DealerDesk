# syntax=docker/dockerfile:1
# ==============================================================================
# VIKMO DealerDesk — Single Production Dockerfile for Render
#
# Contains:
#   1. Frontend: React 18 + Vite + TypeScript production SPA bundle
#   2. Backend:  Django REST Framework (core) + Machine Learning app (ml)
#   3. Datasets: Canonical catalogue, dealer, and sales data in backend/data/
#   4. Gateway:  High-performance Nginx reverse proxy routing to Gunicorn & SPA
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend (React + Vite + TypeScript)
# ------------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install package dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

# Copy frontend source code
COPY frontend/ ./

# Build production distribution into /app/frontend/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime (Python 3.12 + Django + ML + Nginx)
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

# Runtime environment settings
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=10000 \
    DJANGO_SETTINGS_MODULE=dealerdesk.settings \
    PYTHONPATH=/app/backend \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies (nginx for web server, curl for healthchecks, gettext for envsubst)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies (Django, DRF, psycopg, scikit-learn, gunicorn)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy complete backend directory (contains core/, ml/, dealerdesk/, data/, manage.py)
COPY backend/ /app/backend/

# Copy built frontend SPA from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Ensure canonical datasets & ML forecast artifacts exist at both root and backend paths
RUN if [ -d "/app/backend/data" ]; then cp -r /app/backend/data /app/data; fi && \
    mkdir -p /app/ml && \
    if [ -f "/app/backend/ml/forecast.csv" ]; then cp /app/backend/ml/forecast.csv /app/ml/forecast.csv; fi

# Copy submission documentation if present
COPY DECISIONS.md* /app/

# Create Nginx server configuration template
RUN mkdir -p /etc/nginx/templates /app/staticfiles && \
    cat <<'EOF' > /etc/nginx/templates/default.conf.template
server {
    listen ${PORT};
    server_name _;

    client_max_body_size 25M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Django API routes (Core + ML endpoints: /api/products, /api/orders, /api/forecast, /api/assistant/chat)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Django Admin portal
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django static assets (collected by manage.py collectstatic)
    location /static/ {
        alias /app/staticfiles/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # Frontend Vite built assets (hashed immutable files)
    location /assets/ {
        alias /app/frontend/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend React SPA fallback (HTML5 History API client routing)
    location / {
        root /app/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Create container startup entrypoint
RUN cat <<'EOF' > /app/entrypoint.sh
#!/bin/sh
set -e

# Resolve target port (Render automatically provides $PORT, defaults to 10000)
PORT="${PORT:-10000}"
export PORT

echo "================================================================="
echo " Starting VIKMO DealerDesk on Render"
echo " Port:      $PORT"
echo " Backend:   Django 5.x + ML App (/app/backend)"
echo " Frontend:  React SPA (/app/frontend/dist)"
echo "================================================================="

# 1. Generate Nginx configuration from template with dynamic $PORT
mkdir -p /etc/nginx/conf.d
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 2. Database migrations and initial seeding (when DATABASE_URL is present)
if [ -n "$DATABASE_URL" ]; then
    echo ">> [1/3] Running database migrations..."
    python /app/backend/manage.py migrate --noinput || echo "Warning: Migration failed, continuing..."

    echo ">> [2/3] Seeding catalogue and dealer data..."
    python /app/backend/manage.py seed_data || echo "Warning: Seeding failed, continuing..."

    echo ">> [3/3] Collecting Django static assets..."
    python /app/backend/manage.py collectstatic --noinput || echo "Warning: collectstatic skipped..."
else
    echo ">> Warning: DATABASE_URL not detected. Skipping database migrations and seeding."
fi

# 3. Optional: Start Mock Supplier if configured
if [ "$RUN_MOCK_SUPPLIER" = "true" ] || echo "$SUPPLIER_API_URL" | grep -q "8099"; then
    echo ">> Starting mock supplier service on port 8099..."
    python /app/backend/supplier_mock/mock_supplier.py --port 8099 --key "${SUPPLIER_API_KEY:-dev-supplier-key}" &
fi

# 4. Start Gunicorn WSGI server on 127.0.0.1:8000
echo ">> Starting Gunicorn (Django WSGI engine)..."
gunicorn \
    --chdir /app/backend \
    dealerdesk.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers ${GUNICORN_WORKERS:-2} \
    --threads ${GUNICORN_THREADS:-4} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - &
GUNICORN_PID=$!

# 5. Wait for Gunicorn to pass initial healthcheck
echo ">> Waiting for backend to become ready..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8000/api/health/ > /dev/null 2>&1; then
        echo ">> Backend is healthy and ready!"
        break
    fi
    sleep 1
done

# Graceful process termination handler
cleanup() {
    echo ">> Terminating DealerDesk services..."
    kill -TERM "$GUNICORN_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "$GUNICORN_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# 6. Start Nginx in foreground to serve external traffic on $PORT
echo ">> Starting Nginx reverse proxy on 0.0.0.0:$PORT..."
nginx -g "daemon off;" &
NGINX_PID=$!

wait "$NGINX_PID"
EOF

RUN chmod +x /app/entrypoint.sh

# Expose Render default port and backend internal port
EXPOSE 10000 8000

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

