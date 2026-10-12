# VIKMO DealerDesk

Enterprise B2B automotive spare-parts inventory, dealer, order-management, supplier-integration and AI-assisted forecasting platform.

---

## Architecture Overview

All backend Python code, models, data, migrations, virtual environment, and operational scripts live **strictly inside the `backend/` directory**.

```text
DealerDesk/
├── backend/                           # Complete Django REST Framework Backend
│   ├── core/                          # Core application models, views, serializers, services
│   │   ├── management/commands/       # seed_data command (idempotent CSV ingestion)
│   │   ├── migrations/                # Database migrations (committed: 0001_initial.py)
│   │   ├── services/                  # OrderService (lifecycle engine), SupplierSyncService
│   │   ├── exceptions.py              # Custom error handling matching API_CONTRACT schema
│   │   ├── middleware.py              # Lightweight CORS middleware for local frontend dev
│   │   ├── models.py                  # Product, Dealer, Order, OrderLineItem, OrderSequence, IdempotencyRecord
│   │   ├── pagination.py              # StandardPagination (page, page_size, default 20, max 100)
│   │   ├── serializers.py             # Model serializers with MoneyField (2-decimal strings)
│   │   ├── urls.py                    # Route definitions (all with trailing slashes)
│   │   └── views.py                   # API endpoints for Products, Inventory, Dealers, Orders, Sync
│   ├── data/                          # Canonical CSV datasets (catalogue, dealers, lead times)
│   │   ├── catalogue.csv              # 600 automotive spare parts
│   │   ├── dealers.csv                # 25 registered dealer accounts
│   │   ├── lead_times.csv             # 40 forecast SKUs with supplier lead times
│   │   └── sales_history.csv          # Historical weekly unit sales
│   ├── dealerdesk/                    # Django project settings & root URLs
│   │   ├── settings.py                # Environment-driven settings (PostgreSQL only)
│   │   ├── urls.py                    # Root URL router
│   │   └── wsgi.py                    # WSGI application
│   ├── ml/                            # ML forecasting data and models
│   ├── scripts/                       # Automation scripts (Backend ONLY)
│   │   ├── start-backend.ps1 / .sh    # Migrates database, seeds data, starts server on :8000
│   │   ├── start-supplier-mock.ps1/.sh# Starts mock supplier service on :8099
│   │   ├── run-tests.ps1 / .sh        # Runs contract and unit test suites
│   │   └── run-smoke-test.ps1 / .sh   # Runs assignment official smoke test
│   ├── supplier_mock/                 # Mock supplier server implementation
│   │   └── mock_supplier.py           # Simulates rate-limited paginated supplier feed
│   ├── tests/                         # Backend test suites
│   │   ├── test_backend_contract.py   # Schema, URL, and data file integrity checks
│   │   ├── test_unit_track1.py        # Serializers, pricing, GST rounding, error codes
│   │   ├── test_django_track.py       # Full Django TestCase integration suite
│   │   └── README.md                  # Test suite documentation
│   ├── .venv/                         # Dedicated Python virtual environment
│   ├── manage.py                      # Django administrative CLI
│   ├── requirements.txt               # Backend Python dependencies
│   ├── smoke_test.py                  # Official assignment smoke test
│   └── .env.example                   # Backend environment configuration template
│
├── frontend/                          # Enterprise React + TypeScript application
│   ├── src/                           # 9 complete operational modules
│   ├── public/                        # Static assets and icons
│   ├── package.json                   # UI build scripts ("dev", "build", "preview")
│   ├── vite.config.ts                 # Vite config with DRF proxy
│   └── tsconfig.json                  # Strict TypeScript configuration
│
├── docs/                              # Project documentation
│   ├── API_CONTRACT.md                # Authoritative API Contract
│   └── VIKMO_DealerDesk_Assignment.pdf# Assignment specification
│
├── .gitignore                         # Ignores .venv, node_modules, dist, .env
├── .env.example                       # Root environment configuration template
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

#### 7. Forecasting & Reorder Engine (§10)
- **`GET /api/reorder-suggestions/`**
  - **Rules**: Evaluates 40 forecast SKUs against actual lead-time data (`backend/data/lead_times.csv`) and 104-week sales history (`backend/data/sales_history.csv`).
  - **Formulas**:
    - $L = \text{lead\_time\_weeks}$
    - $\text{lead\_time\_demand} = \sum_{w=1}^L \text{forecast\_units}_w$
    - $\sigma = \text{sample standard deviation of recent 12 weeks}$
    - $\text{safety\_stock} = \lceil 1.65 \times \sigma \times \sqrt{L} \rceil$
    - $\text{reorder\_point} = \text{lead\_time\_demand} + \text{safety\_stock}$
    - $\text{reorder\_qty} = \max(0, \lceil \text{reorder\_point} - \text{current\_stock} \rceil)$
  - **Response**: `200 OK`
  ```json
  {
    "results": [
      {
        "sku": "FIL-1016",
        "current_stock": 99,
        "lead_time_weeks": 3,
        "lead_time_demand": 70.5,
        "safety_stock": 42,
        "reorder_point": 112.5,
        "reorder_qty": 14
      }
    ]
  }
  ```
- **`GET /api/forecast/{sku}/`**
  - **Response**: `200 OK` (4 weeks: `2026-09-28`, `2026-10-05`, `2026-10-12`, `2026-10-19`) matching `backend/ml/forecast.csv`. Returns `404 NOT_FOUND` for non-forecast SKUs.

#### 8. Dealer Assistant Chat API (§9)
- **`POST /api/assistant/chat/`**
  - **Body**: `{"session_id": "sess-1", "dealer_id": 7, "message": "Do you have brake pads for a Pulsar 150?"}`
  - **Rules**: Generates natural dialogue responses with tool calling (`search_parts`, `check_stock`, `create_draft_order`) grounded strictly in live PostgreSQL data.
  - **Response**: `200 OK`
  ```json
  {
    "reply": "Yes — Endurance Brake Pad Set (BRK-1044) fits the Bajaj Pulsar 150...",
    "cited_skus": ["BRK-1044"],
    "tool_calls": [{"name": "search_parts", "arguments": {"query": "brake pads", "vehicle": "Bajaj Pulsar 150"}}],
    "actions": []
  }
  ```

---

## 6. Testing & Quality Assurance

### 1. Run Automated Test Suites
Runs contract validation, CSV schema integrity, and unit tests:
```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/run-tests.ps1
```
Or via shell:
```bash
./backend/scripts/run-tests.sh
```

### 2. Run Full Django Integration Tests (with PostgreSQL)
```bash
cd backend
python manage.py test tests
```

### 3. Run Official Assignment Smoke Test
1. Start the mock supplier service (in a separate terminal):
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/start-supplier-mock.ps1
   ```
2. Start the Django server on port 8000:
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/start-backend.ps1
   ```
3. Execute the assignment smoke test:
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/run-smoke-test.ps1 -Track django
   ```
   Or directly via python:
   ```bash
   cd backend
   python smoke_test.py --base-url http://localhost:8000 --track django
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
