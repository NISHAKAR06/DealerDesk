# VIKMO DealerDesk

Enterprise B2B automotive spare-parts inventory, dealer, order-management, supplier-integration and AI-assisted forecasting platform.

**Submission Track:** **Both Track 1 (Django Backend) AND Track 2 (AI/ML) Fully Implemented & Verified**  
**Architectural Decisions & Proofs:** Complete technical rationales, exact line-by-line citations, and mathematical formulations are documented in [`DECISIONS.md`](DECISIONS.md).

---

## ⚡ Mandatory Evaluation Run Contract (Section 9.1)

Per Section 9.1 of `docs/VIKMO_DealerDesk_Assignment.pdf`, the automated evaluation grader executes from the **repository root**:

```bash
pip install -r backend/requirements.txt
python backend/manage.py migrate --noinput
python backend/manage.py seed_data
python backend/manage.py seed_data
python backend/manage.py runserver 0.0.0.0:8000 --noreload
```

> **Backend Architecture:** Both Django (Core) and Machine Learning (ML) live entirely inside the `backend/` directory. All backend commands and dependencies are centralized in `backend/requirements.txt`.

---

## Architecture Overview

```text
DealerDesk/
├── Dockerfile                         # Production multi-stage Dockerfile (Render)
├── render.yaml                        # Render Blueprint specification
├── DECISIONS.md                       # Comprehensive architectural decisions (15-point submission artifact)
├── backend/                           # Complete Backend (Django REST Framework + AI/ML App)
│   ├── core/                          # Core models, views, serializers, services
│   │   ├── management/commands/       # seed_data command (idempotent CSV ingestion)
│   │   ├── migrations/                # Database migrations (0001_initial.py)
│   │   ├── services/                  # OrderService (lifecycle engine), SupplierSyncService
│   │   ├── exceptions.py              # Custom error handling matching API_CONTRACT schema
│   │   ├── middleware.py              # Lightweight CORS middleware for local frontend dev
│   │   ├── models.py                  # Product, Dealer, Order, OrderLineItem, OrderSequence
│   │   ├── pagination.py              # StandardPagination (page, page_size, default 20, max 100)
│   │   ├── serializers.py             # Model serializers with MoneyField (2-decimal strings)
│   │   ├── urls.py                    # Route definitions (all with trailing slashes)
│   │   └── views.py                   # Endpoints: Products, Inventory, Dealers, Orders, Sync
│   ├── ml/                            # Dedicated AI & ML Application (Track 2)
│   │   ├── artifacts/                 # Serialized model (demand_forecaster.joblib)
│   │   ├── services/                  # AssistantService (Gemini LLM) & ForecastingService
│   │   ├── apps.py                    # MlConfig Django app definition
│   │   ├── forecast.csv               # 160-row 4-week ML forecast predictions (40 SKUs x 4 weeks)
│   │   ├── train_model.py             # scikit-learn training & chronological holdout evaluation
│   │   ├── urls.py                    # Routes: /api/assistant/chat/, /api/forecast/, /api/reorder-suggestions/
│   │   └── views.py                   # API endpoints for AI Assistant & Demand Forecasting
│   ├── data/                          # Canonical CSV datasets (7 files)
│   │   ├── catalogue.csv              # 600 automotive spare parts
│   │   ├── dealers.csv                # 25 registered dealer accounts
│   │   ├── lead_times.csv             # 40 forecast SKUs with supplier lead times
│   │   ├── sales_history.csv          # 104-week historical sales records
│   │   ├── promo_calendar.csv         # Promotional discount calendar
│   │   ├── festival_calendar.csv      # Regional demand spikes
│   │   └── DATA_README.md             # Dataset documentation
│   ├── dealerdesk/                    # Django project settings & root URLs
│   │   ├── settings.py                # Environment-driven settings (PostgreSQL only)
│   │   ├── urls.py                    # Root URL router (mounts core.urls & ml.urls)
│   │   └── wsgi.py                    # WSGI application
│   ├── scripts/                       # Automation scripts (start, test, smoke-test)
│   ├── supplier_mock/                 # Mock supplier server (:8099)
│   ├── tests/                         # Full test suites (contract, unit, track 1, track 2)
│   ├── manage.py                      # Django administrative CLI
│   ├── requirements.txt               # Backend Python dependencies (Django, ML, Gunicorn)
│   ├── smoke_test.py                  # Official assignment smoke test
│   └── .env.example                   # Backend environment configuration template
├── frontend/                          # Enterprise React 18 + TypeScript application
│   ├── src/                           # 9 complete operational modules
│   ├── package.json                   # UI build scripts ("dev", "build", "preview")
│   └── vite.config.ts                 # Vite config with DRF proxy
├── docs/                              # Project documentation
│   ├── API_CONTRACT.md                # Authoritative API Contract
│   └── VIKMO_DealerDesk_Assignment.pdf# Official assignment specification
├── .gitignore                         # Git exclusion rules
└── README.md                          # Comprehensive project documentation
```

---

## 1. Prerequisites

- **Python**: 3.11 or newer (Python 3.12 is configured in `backend/.venv`).
- **PostgreSQL**: PostgreSQL 14+ database. SQLite is prohibited by the contract.
  - *Local Docker*: `docker run --name dealerdesk-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dealerdesk -p 5432:5432 -d postgres:16`
  - *Hosted*: Free PostgreSQL instance from [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
- **Node.js**: v18+ with npm (for frontend development and production build).

---

## 2. Environment Configuration

Create a `.env` file inside `backend/` (or in the repository root):

```bash
cp .env.example backend/.env
```

Configure your environment variables:

```env
# Required: PostgreSQL connection string
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dealerdesk

# Supplier API (point to mock supplier on port 8099 for development)
SUPPLIER_API_URL=http://127.0.0.1:8099
SUPPLIER_API_KEY=dev-supplier-key

# Django Core
DJANGO_SECRET_KEY=change-me-to-a-secure-random-secret
DJANGO_DEBUG=1

# Track 2 AI Assistant (Google Gemini Function Calling)
GEMINI_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-flash-lite-latest
```

> **Security Note**: Never commit `.env` to Git. `.gitignore` is configured to exclude `.env` files.

---

## 3. Backend Quickstart (Inside `backend/`)

All backend commands are executed strictly within the `backend/` directory.

### Automated Startup
```powershell
# Windows PowerShell
.\backend\scripts\start-backend.ps1

# Linux / macOS
./backend/scripts/start-backend.sh
```

### Manual Step-by-Step Execution
```bash
# 1. Navigate to backend directory
cd backend

# 2. Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Apply database migrations
python manage.py migrate --noinput

# 5. Ingest catalogue and dealer datasets idempotently
python manage.py seed_data

# 6. Start development server on port 8000
python manage.py runserver 0.0.0.0:8000
```

---

## 4. Database Seeding & Invariants

The `python manage.py seed_data` command loads data idempotently from `backend/data/` inside atomic transactions:
- **`catalogue.csv`**: **600** verified automotive spare-part products. Stock quantities are set to the integer counts specified in the CSV, and prices are quantized to 2 decimal places.
- **`dealers.csv`**: **25** registered dealer profiles with credit limits and GSTIN numbers.
- **`lead_times.csv`**: **40** monitored SKUs with supplier lead-time weeks.

**Idempotency Guarantee**: Running `python manage.py seed_data` multiple times will never create duplicate records or corrupt existing orders.

---

## 5. API Reference (Track 1 — Django Backend)

All endpoints strictly adhere to [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). Every endpoint ends with a trailing slash and returns JSON.

### Error Envelope Specification
All HTTP errors conform to this unified structure:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Human readable explanation",
    "details": []
  }
}
```

| HTTP Status | Error Code | Trigger Condition |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Malformed input, negative quantity, unknown SKU/dealer, price precision > 2 decimals |
| `404` | `NOT_FOUND` | Resource requested in URL does not exist |
| `409` | `DUPLICATE` | Product SKU or Dealer code already exists |
| `409` | `INSUFFICIENT_STOCK` | Confirming an order when requested quantity exceeds available stock |
| `409` | `INVALID_TRANSITION` | Status transition forbidden from current state |
| `409` | `ORDER_LOCKED` | Attempting to edit an order that is not in `DRAFT` status |
| `409` | `IDEMPOTENCY_CONFLICT` | Same `Idempotency-Key` header reused with a different request payload |
| `502` | `SUPPLIER_UNAVAILABLE` | Supplier sync failed after 5 retries or supplier authentication error |

---

### Endpoint Catalog

#### 1. System Health
- **`GET /api/health/`**
  - **Response**: `200 OK`
  ```json
  {"status": "ok"}
  ```

#### 2. Products Catalogue (§4)
- **`GET /api/products/`**
  - **Query Params**: `page` (1-based), `page_size` (default 20, max 100), `search` (case-insensitive across sku, name, brand), `category` (exact), `vehicle` (case-insensitive substring of vehicle fitment).
  - **Response**: `200 OK`
  ```json
  {
    "count": 600,
    "next": "http://127.0.0.1:8000/api/products/?page=2",
    "previous": null,
    "results": [
      {
        "sku": "BRK-1044",
        "name": "Brake Pad Set - Bajaj Pulsar 150",
        "category": "Brakes",
        "brand": "Endurance",
        "vehicle_fitment": "Bajaj Pulsar 150",
        "price": "1459.50",
        "stock": 136,
        "description": "OEM replacement brake pads"
      }
    ]
  }
  ```
- **`POST /api/products/`**
  - **Body**: Product fields except `stock`. Creates product with stock initialized to `0`.
  - **Validation**: Price must be strictly positive with at most 2 decimal places. Duplicate SKU returns `409 DUPLICATE`.
  - **Response**: `201 Created`
- **`GET /api/products/{sku}/`**
  - **Response**: `200 OK` or `404 NOT_FOUND`.
- **`PATCH /api/products/{sku}/`**
  - **Body**: Partial update (`name`, `category`, `brand`, `vehicle_fitment`, `price`, `description`). SKU is immutable.
  - **Response**: `200 OK`.

#### 3. Inventory Overwrite (§5)
- **`PUT /api/inventory/{sku}/`**
  - **Body**: `{"quantity": 50, "reason": "stock count correction"}`
  - **Rules**: Quantity must be an integer $\ge 0$. Directly overwrites available quantity.
  - **Response**: `200 OK`
  ```json
  {"sku": "BRK-1044", "quantity": 50}
  ```

#### 4. Dealers Directory (§6)
- **`GET /api/dealers/`**
  - **Response**: `200 OK` (Paginated list).
- **`POST /api/dealers/`**
  - **Body**: `{"dealer_code": "DLR-026", "name": "Apex Spares", "city": "Pune", "phone": "9876543210", "credit_limit": "75000.00"}`
  - **Validation**: `dealer_code` and `name` required. Duplicate dealer code returns `409 DUPLICATE`.
  - **Response**: `201 Created`.
- **`GET /api/dealers/{id}/`**
  - **Response**: `200 OK` or `404 NOT_FOUND`.

#### 5. Orders & Lifecycle Engine (§7)
- **`POST /api/orders/`**
  - **Headers**: Optional `Idempotency-Key: <unique-uuid>`.
  - **Body**:
    ```json
    {
      "dealer_id": 7,
      "items": [
        {"sku": "BRK-1044", "quantity": 3}
      ]
    }
    ```
  - **Rules**: Creates order in `DRAFT` status. Generates concurrency-safe sequential order number `ORD-YYYYMMDD-NNNN` in `Asia/Kolkata` timezone. Locks unit prices to current catalogue price. Line tax is $18\%$ rounded per line using `ROUND_HALF_UP`.
  - **Response**: `201 Created`.
- **`GET /api/orders/`**
  - **Query Params**: `dealer_id`, `status`, `page`, `page_size`.
  - **Response**: `200 OK`.
- **`GET /api/orders/{order_number}/`**
  - **Response**: `200 OK` or `404 NOT_FOUND`.
- **`PUT /api/orders/{order_number}/`**
  - **Body**: `{"items": [...]}` replaces all line items. Allowed only while status is `DRAFT`; returns `409 ORDER_LOCKED` otherwise.
  - **Response**: `200 OK`.
- **`POST /api/orders/{order_number}/confirm/`**
  - **Transition**: `DRAFT` → `CONFIRMED`.
  - **Stock Validation**: Validates available stock for every line item using row locks (`select_for_update()`). If any item is insufficient, returns `409 INSUFFICIENT_STOCK` with detailed short-line breakdown:
    ```json
    {
      "error": {
        "code": "INSUFFICIENT_STOCK",
        "message": "Insufficient stock for Brake Pad Set. Available: 5, Requested: 10",
        "details": [
          {"sku": "BRK-1044", "requested": 10, "available": 5}
        ]
      }
    }
    ```
  - **Stock Deduction**: Upon confirmation, deducts quantities from available stock and locks prices permanently.
  - **Response**: `200 OK`.
- **`POST /api/orders/{order_number}/dispatch/`**
  - **Transition**: `CONFIRMED` → `DISPATCHED`. Returns `409 INVALID_TRANSITION` if not `CONFIRMED`.
- **`POST /api/orders/{order_number}/deliver/`**
  - **Transition**: `DISPATCHED` → `DELIVERED`. Returns `409 INVALID_TRANSITION` if not `DISPATCHED`.
- **`POST /api/orders/{order_number}/cancel/`**
  - **Transition**: `DRAFT` → `CANCELLED` or `CONFIRMED` → `CANCELLED`.
  - **Stock Restoration**: When cancelling a `CONFIRMED` order, restores product stock quantities exactly once. `DISPATCHED` and `DELIVERED` orders cannot be cancelled.

#### 6. Supplier Synchronization (§8)
- **`POST /api/sync/supplier/`**
  - **Rules**: Calls external supplier cursor feed, retrying on rate limits (`429` with `Retry-After`) and server errors (`5xx`) up to 5 times. Deduplicates SKUs taking the latest `updated_at`. Filters invalid items into `rejected`. Inserts new parts with `stock: 0` and updates modified non-stock fields. Never modifies existing internal stock.
  - **Response**: `200 OK`
    ```json
    {
      "created": 12,
      "updated": 30,
      "unchanged": 52,
      "rejected": [{"supplier_sku": "SUP-77120", "reason": "invalid price"}],
      "pages_fetched": 5,
      "requests_made": 8
    }
    ```

#### 7. Track 2 — Demand Forecasting & Reorder Engine (§10) (`backend/ml/`)
- **Methodology & Holdout Evaluation**:
  - **Dataset**: 104 weeks of genuine historical weekly unit demand (`backend/data/sales_history.csv`) across 40 monitored SKUs (`backend/data/lead_times.csv`).
  - **Model**: Trained `scikit-learn` `StandardScaler + Ridge` regression pipeline (`backend/ml/train_model.py`) using 16 time-series features (`lag_1`, `lag_2`, `lag_3`, `lag_4`, `lag_8`, `lag_12`, `rolling_mean_4`, `rolling_mean_8`, `rolling_mean_12`, `rolling_std_4`, `rolling_std_12`, `ewma_03`, `sin_week`, `cos_week`, `sku_mean`, `lead_time_weeks`), evaluated against `GradientBoostingRegressor` and `RandomForestRegressor` on a 4-week chronological holdout split (`WAPE = 29.86%`, `MAE = 10.17 units`).
  - **Serialized Model & Forecast Artifacts**: Saved strictly inside `backend/ml/` at `backend/ml/artifacts/demand_forecaster.joblib`, `backend/ml/artifacts/model_metrics.json`, and `backend/ml/forecast.csv` (160 rows = 40 SKUs $\times$ 4 future weeks: `2026-09-28`, `2026-10-05`, `2026-10-12`, `2026-10-19`). Can be retrained via `python ml/train_model.py` inside `backend/`.
- **`GET /api/forecast/{sku}/`**
  - **Response**: `200 OK` (4 future weeks matching `backend/ml/forecast.csv`). Returns `404 NOT_FOUND` for unknown or non-forecast SKUs.
  ```json
  {
    "sku": "FIL-1016",
    "forecast": [
      {"week_start": "2026-09-28", "forecast_units": 24.4},
      {"week_start": "2026-10-05", "forecast_units": 24.5},
      {"week_start": "2026-10-12", "forecast_units": 24.3},
      {"week_start": "2026-10-19", "forecast_units": 24.2}
    ]
  }
  ```
- **`GET /api/reorder-suggestions/`**
  - **Rules**: Evaluates all 40 forecast SKUs (unpaginated) in `backend/ml/services/forecasting_service.py` against live PostgreSQL `Product.stock`, supplier lead times (`lead_times.csv`), and historical demand variance (`sales_history.csv`).
  - **Formulas**:
    - $L = \text{lead\_time\_weeks}$
    - $\text{lead\_time\_demand} = \sum_{w=1}^L \text{forecast\_units}_w$
    - $\sigma = \text{sample standard deviation of most recent 12 weeks of sales}$
    - $\text{safety\_stock} = \lceil 1.65 \times \sigma \times \sqrt{L} \rceil$
    - $\text{reorder\_point} = \text{lead\_time\_demand} + \text{safety\_stock}$
    - $\text{reorder\_qty} = \max(0, \lceil \text{reorder\_point} - \text{current\_stock} \rceil)$

#### 8. Track 2 — Dealer Assistant Chat API (§9) (`backend/ml/`)
- **LLM Provider & Model**:
  - **Provider**: Google Gemini (`GEMINI_API_KEY`)
  - **Model**: `gemini-flash-lite-latest` (configurable via `LLM_MODEL`)
  - **Architecture**: Dedicated `AssistantService` (`backend/ml/services/assistant_service.py`) implementing a multi-step function-calling loop (`search_parts`, `check_stock`, `create_draft_order`) backed strictly by live PostgreSQL queries (`Product`, `Dealer`, `Order`, `OrderService`, and `ForecastingService`) with isolated per-`session_id` conversation memory.
- **`POST /api/assistant/chat/`**
  - **Body**: `{"session_id": "sess-1", "dealer_id": 7, "message": "Do you have brake pads for a Pulsar 150?"}`
  - **Validation**: Rejects empty/whitespace-only or excessively long ($> 4000$ chars) messages with `400 VALIDATION_ERROR`. Never confirms orders; only creates `DRAFT` orders.
  - **Response**: `200 OK`
  ```json
  {
    "reply": "Yes — Endurance Brake Pad Set (BRK-1044) fits the Bajaj Pulsar 150. We have 136 units in stock at ₹1459.50 per unit.",
    "cited_skus": ["BRK-1044"],
    "tool_calls": [{"name": "search_parts", "arguments": {"query": "brake pads", "vehicle": "Bajaj Pulsar 150"}}],
    "actions": []
  }
  ```

---

## 6. Testing & Quality Assurance

### 1. Run Complete Automated Test Suites (Track 1 + Track 2)
Runs contract validation, CSV schema integrity, Track 1 unit tests, and Track 2 AI/ML unit tests:
```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/run-tests.ps1
```
Or via shell:
```bash
./backend/scripts/run-tests.sh
```

### 2. Run Track 2 AI/ML Test Suite Directly
```bash
cd backend
python tests/test_track2_ai_ml.py
```

### 3. Run Official Assignment Smoke Test (All Tracks)
1. Start the mock supplier service (in a separate terminal):
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/start-supplier-mock.ps1
   ```
2. Start the Django server on port 8000:
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/start-backend.ps1
   ```
3. Execute the assignment smoke test across Track 1 (`django`), Track 2 (`aiml`), or both (`--all`):
   ```bash
   cd backend
   python smoke_test.py --base-url http://localhost:8000 --track django
   python smoke_test.py --base-url http://localhost:8000 --track aiml
   python smoke_test.py --base-url http://localhost:8000 --all
   ```

---

## 7. Frontend Quickstart

The frontend is an enterprise React 18 + TypeScript SPA located in `frontend/`.

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173**.

To create a production build:
```bash
npm run build
```

---

## 8. Common Setup Errors & Troubleshooting

1. **`django.core.exceptions.ImproperlyConfigured: Set DATABASE_URL to a PostgreSQL URL`**:
   - Ensure `DATABASE_URL` is configured in `backend/.env` or exported in your shell. SQLite is explicitly blocked by `settings.py` per assignment rules.
2. **`psycopg.OperationalError: connection to server at "localhost", port 5432 failed`**:
   - Start your local PostgreSQL service or ensure Docker container is running (`docker start dealerdesk-postgres`).
3. **Trailing Slashes on Endpoints**:
   - Django REST Framework requires trailing slashes (`/api/products/`, not `/api/products`). Calling without trailing slash returns 301 redirects or 404 in strict client contexts.
4. **Order Confirmation 409 Insufficient Stock**:
   - Verify that parts have sufficient inventory by checking `/api/products/{sku}/` or adjusting stock via `/api/inventory/{sku}/` before confirming an order.

---

## 9. Deploying to Render (Single Container)

The repository includes a production-ready, single **`Dockerfile`** that packages:
1. **Frontend**: React 18 + Vite SPA built into static assets.
2. **Backend**: Complete Django REST Framework API + ML application located in `backend/`.
3. **Gateway**: Built-in Nginx reverse proxy routing external web traffic on Render's dynamic `$PORT` to Gunicorn (`127.0.0.1:8000`) and the React SPA.

### Option A: One-Click Deploy via Render Blueprint (`render.yaml`)
1. Push your repository to GitHub.
2. Go to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your `DealerDesk` repository.
5. Render will automatically detect [`render.yaml`](render.yaml) and provision:
   - A managed PostgreSQL database (`dealerdesk-db`).
   - A Web Service (`dealerdesk`) running the single Docker container.
6. Provide your `GEMINI_API_KEY` when prompted and click **Apply**.

### Option B: Manual Web Service Setup on Render
1. In Render, select **New +** $\rightarrow$ **Web Service**.
2. Connect your Git repository.
3. Select **Docker** as the runtime environment (Render will automatically detect `Dockerfile`).
4. Set the following Environment Variables in the Render dashboard:
   * `DATABASE_URL`: Your PostgreSQL connection string (from Render Postgres or Neon).
   * `DJANGO_SECRET_KEY`: A secure random secret string.
   * `DJANGO_DEBUG`: `0`
   * `GEMINI_API_KEY`: Your Google Gemini API key for Track 2 assistant.
   * `LLM_MODEL`: `gemini-flash-lite-latest`
   * `SUPPLIER_API_URL`: `http://127.0.0.1:8099` (or external supplier URL).
   * `RUN_MOCK_SUPPLIER`: `true` (runs background mock supplier for inventory sync).
5. Health Check Path: `/api/health/`.
6. Click **Create Web Service**.
