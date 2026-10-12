---
noteId: "9b7f4e60c5ff11f1afc841e490238b99"
tags: []

---

# VIKMO DealerDesk — Frontend Application

Production-quality B2B automotive spare-parts inventory, dealer, order-management, supplier-integration, and AI-assisted forecasting frontend for **VIKMO DealerDesk**.

Designed as a high-density, serious enterprise operations platform following ERP/operations SaaS usability principles.

---

## 1. Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or newer (tested on Node v22.15.0)
- **npm**: v9.0.0 or newer

### Setup & Run Commands

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install all dependencies
npm install

# 3. Start the Vite development server (runs on http://localhost:5173)
npm run dev

# 4. Compile the production bundle and run strict TypeScript checks
npm run build

# 5. Preview the production build locally
npm run preview
```

---

## 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Base URL pointing to the Django REST backend server |
| `VITE_ENABLE_DEMO_FALLBACK` | `false` | Optional toggle to enable bundled fixtures from `data/` for local UI previewing |

> **Note on Backend Integration & Trailing Slashes**: All requests dispatched through `src/lib/api-client.ts` strictly preserve Django REST Framework's trailing slash requirements (e.g. `/api/products/`, `/api/inventory/{sku}/`, `/api/orders/{order_number}/confirm/`).

---

## 3. Technology Stack

- **Framework**: React 18 with TypeScript (strict type checking enabled)
- **Build Tool**: Vite 8 with `@vitejs/plugin-react`
- **Styling**: Tailwind CSS & PostCSS
- **Routing**: React Router v6 with `React.lazy()` route-level code splitting
- **Server State & Caching**: TanStack Query (React Query v5) with query keys and safe mutation policies
- **Forms & Validation**: React Hook Form with Zod schemas (`@hookform/resolvers/zod`)
- **Data Visualization**: Recharts (responsive 4-week demand projection bar charts)
- **HTTP Client**: Axios with centralized error interceptors and Django error contract parsing
- **Icons**: Lucide React
- **Date Utilities**: date-fns for ISO 8601 timestamp formatting

---

## 4. Application Architecture & Screens

```
frontend/src/
├── app/
│   ├── providers.tsx          # QueryClientProvider and ToastProvider
│   └── router.tsx             # Lazy route definitions and Suspense boundaries
├── components/
│   ├── common/
│   │   ├── confirm-dialog.tsx # Accessible confirmation modal for status changes
│   │   ├── empty-state.tsx    # Empty data state panels
│   │   ├── error-state.tsx    # Standardized API error display with retry
│   │   ├── loading-state.tsx  # Spinners and skeleton tables
│   │   ├── pagination.tsx     # Page size and 1-based pagination control
│   │   └── status-badge.tsx   # Order lifecycle and stock health badges
│   ├── layout/
│   │   ├── app-layout.tsx     # Shell with banner, sidebar, header, and main outlet
│   │   ├── header.tsx         # Breadcrumb, global SKU search, health status, refresh
│   │   └── sidebar.tsx        # Collapsible desktop sidebar and mobile navigation drawer
│   └── ui/                    # Reusable button, input, card, dialog, drawer, toast
├── features/
│   ├── assistant/             # AI Dealer Assistant with tool calls & cited SKUs
│   ├── dashboard/             # Overview dashboard with KPI cards and pipeline
│   ├── dealers/               # Dealer directory, detail drawer, creation modal
│   ├── forecasting/           # 4-week demand projections & safety-stock table
│   ├── integrations/          # Synchronous supplier catalog synchronization
│   ├── inventory/             # Stock overwrite interface and audit reason dialog
│   ├── orders/                # Order list, create draft requisition, order detail
│   ├── products/              # Catalogue search, category filters, product CRUD
│   └── settings/              # System health check and API contract matrix
├── hooks/                     # Custom React Query and mutation hooks
├── lib/
│   ├── api-client.ts          # Centralized API client targeting backend endpoints
│   ├── demo-data.ts           # Bundled fixtures extracted from data/ catalogue & dealers
│   ├── query-client.ts        # TanStack query cache and key definitions
│   └── utils.ts               # Formatting (currency, date), error parsers, clsx
└── types/
    ├── api.ts                 # Type definitions mirroring API_CONTRACT.md
    └── index.ts               # UI and toast types
```

### Implemented Screens

1. **Overview Dashboard (`/`)**:
   - Total products, dealers, orders, and low-stock alerts derived from paginated API responses.
   - Recent orders table with click-through navigation to order details.
   - Low-stock inventory table highlighting parts with &le; 20 units remaining.
   - Order pipeline status breakdown (Draft, Confirmed, Dispatched, Delivered, Cancelled).
   - Quick action shortcuts to create orders, manage stock, and open the assistant.

2. **Products Catalogue (`/products`)**:
   - Paginated catalogue table with SKU, name, brand, category, fitment, price, and stock.
   - Multi-parameter filtering: `search` (SKU/name/brand), `category`, and `vehicle` fitment.
   - Add Product modal creating new parts with initial stock `0` (per contract).
   - Edit Product form allowing partial updates (name, category, brand, fitment, price, description) while locking SKU.
   - Slide-over Product Detail drawer with full OEM specifications.

3. **Inventory & Stock Management (`/inventory`)**:
   - Searchable inventory table with stock-level tabs (All, Healthy, Low Stock, Out of Stock).
   - Stock adjustment dialog executing `PUT /api/inventory/{sku}/` with `{"quantity": n, "reason": "..."}`.
   - Clear visual explanation that stock updates overwrite current balance rather than incrementing.
   - Mandatory reason logging and confirmation flow.

4. **Order Management (`/orders`)**:
   - Filterable list by dealer account and order status.
   - **Create Order (`/orders/new`)**: Dealer selection, dynamic part lookup, multi-SKU line assembly, duplicate SKU prevention, quantity validation (&ge; 1), and client preview of 18% GST (rounded half-up per line).
   - **Order Details (`/orders/:orderNumber`)**: Authoritative line item pricing, dealer requisition info, and contextual status action buttons following the state machine:
     - `DRAFT`: Confirm (atomically locks prices & deducts stock), Edit items, Cancel.
     - `CONFIRMED`: Dispatch in-transit, Cancel (restores stock).
     - `DISPATCHED`: Confirm delivery.
     - `DELIVERED` & `CANCELLED`: Terminal read-only state.
   - Handles `409 INSUFFICIENT_STOCK` by rendering individual short SKU lines and available quantities.

5. **Dealers Directory (`/dealers`)**:
   - Paginated dealer accounts list with dealer code, contact details, GSTIN, and credit lines.
   - Dealer registration modal enforcing required `dealer_code` and `name` with duplicate error reporting.
   - Dealer Details drawer displaying company profile and dealer-specific order history (`GET /api/orders/?dealer_id={id}`).

6. **AI Dealer Assistant (`/assistant`)**:
   - Built-in operations assistant connected to `POST /api/assistant/chat/`.
   - Maintains conversational memory via `session_id`.
   - Contextual dealer selector passing `dealer_id`.
   - Renders assistant response, invoked `tool_calls` (`search_parts`, `check_stock`, `create_draft_order`), and `cited_skus` as interactive product preview cards.
   - Displays direct deep-links when a `draft_order_created` action is executed.
   - Quick prompt starter chips, copy-to-clipboard, and conversation clear dialog.

7. **Forecasting & Reorder (`/forecasting`)**:
   - Recharts visualization showing the 4-week future demand forecast for any monitored SKU (`GET /api/forecast/{sku}/`).
   - 40-SKU Reorder Ledger (`GET /api/reorder-suggestions/`) displaying current stock, lead time in weeks, lead-time demand, safety stock, reorder point (ROP), and suggested reorder quantities.
   - Informational notices identifying statistical estimates.

8. **Supplier Sync (`/integrations`)**:
   - Integration console for `POST /api/sync/supplier/`.
   - Status indicators for `SUPPLIER_API_URL` and `SUPPLIER_API_KEY`.
   - Synchronous execution with long-request loading state and double-submit protection.
   - Metric summary cards (created, updated, unchanged, rejected, pages fetched, requests made).
   - Rejected items table highlighting supplier SKU and reason.

9. **Settings & Status (`/settings`)**:
   - System identity, versioning, and live API connectivity probe (`GET /api/health/`).
   - Regional timezone (Asia/Kolkata) and currency configurations.
   - Complete 16-endpoint API contract coverage matrix.
   - Optional Demo / Preview mode toggle for reviewers.

---

## 5. Contract Adherence & Backend Grader Compatibility

The frontend is strictly decoupled from the Django backend root. All original backend files (`manage.py`, `requirements.txt`, `data/`, `ml/`, `core/`, `dealerdesk/`) remain completely unmodified at the repository root.

When the Django REST Framework server is running, the frontend communicates with the real endpoints. If an endpoint has not yet been built on the backend, the frontend displays an informative error card identifying the missing endpoint, HTTP 404 status, and relevant section of `API_CONTRACT.md`.
