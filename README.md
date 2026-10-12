# VIKMO DealerDesk

Enterprise B2B automotive spare-parts inventory, dealer, order-management, supplier-integration and AI-assisted forecasting platform.

---

## Architecture Overview

```text
DealerDesk/
├── backend/                       # Django REST Framework backend
│   ├── core/                      # Core models and business logic
│   ├── data/                      # Assignment CSV data (catalogue, dealers, lead times)
│   ├── dealerdesk/                # Django project settings and root URLs
│   ├── ml/                        # ML demand forecasting models and predictions
│   ├── scripts/                   # Backend automation & runner scripts
│   │   ├── start-backend.ps1/.sh
│   │   ├── start-supplier-mock.ps1/.sh
│   │   ├── run-tests.ps1/.sh
│   │   └── run-smoke-test.ps1/.sh
│   ├── supplier_mock/             # Mock supplier sync service
│   ├── tests/                     # Backend contract verification test suite
│   ├── manage.py
│   ├── requirements.txt
│   └── smoke_test.py              # Assignment official smoke test
│
├── frontend/                      # Enterprise React + TypeScript application
│   ├── src/                       # Production SPA codebase (9 complete operational screens)
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/                          # Specifications and API contracts
│   ├── API_CONTRACT.md            # Authoritative API Contract
│   └── VIKMO_DealerDesk_Assignment.pdf
│
├── .gitignore
├── .env.example
└── README.md
```

---

## 1. Backend Quickstart

The backend is housed entirely within [`backend/`](backend/).

### Automated Startup
```powershell
# Windows PowerShell
.\backend\scripts\start-backend.ps1

# Linux / macOS
./backend/scripts/start-backend.sh
```

### Manual Startup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000
```

### Running Backend Tests
```powershell
# Automated Contract & Data Tests
powershell backend/scripts/run-tests.ps1

# Assignment Smoke Test (with Django running on port 8000)
powershell backend/scripts/run-smoke-test.ps1
```

---

## 2. Frontend Quickstart

The frontend is housed in [`frontend/`](frontend/) and communicates with the backend via Vite proxy and Axios API client.

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** to view the application.

To produce a production build:
```bash
npm run build
```

---

## 3. Implemented Modules

1. **Overview Dashboard (`/`)**: KPI tiles, recent orders, low stock monitors, status distribution, 4-week forecasts.
2. **Products Catalogue (`/products`)**: SKU, category, and vehicle-fitment search, drawer inspector, creation (stock 0 per contract), editing.
3. **Inventory Management (`/inventory`)**: Stock-level filters, absolute overwrite stock adjustments (`PUT /api/inventory/{sku}/`), audit logging.
4. **Orders Fulfillment (`/orders`, `/orders/new`, `/orders/:orderNumber`)**: Dealer requisition creator with 18% GST preview, lifecycle status engine (`DRAFT` → `CONFIRMED` → `DISPATCHED` → `DELIVERED`/`CANCELLED`), line-level `409 INSUFFICIENT_STOCK` breakdown.
5. **Dealers Directory (`/dealers`)**: Registered dealer accounts, modal onboarding, dealer-filtered order ledger.
6. **AI Dealer Assistant (`/assistant`)**: Natural language chat with tool-invocation pills (`POST /api/assistant/chat/`), referenced part cards, draft creation links.
7. **Forecasting & Reorder (`/forecasting`)**: Recharts 4-week demand projection charts (`GET /api/forecast/{sku}/`), 40-SKU automated reorder table (`GET /api/reorder-suggestions/`).
8. **Supplier Sync (`/integrations`)**: Synchronous pull console (`POST /api/sync/supplier/`), timeout handling, rejected items table.
9. **Settings & Status (`/settings`)**: Live health probe, API contract matrix, environment config, demo mode toggle for unseeded backends.
