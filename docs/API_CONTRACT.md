---
noteId: "c9789fd0c5ee11f1afc841e490238b99"
tags: []

---

# VIKMO DealerDesk — API & Run Contract

This contract is **exact**. Your submission is tested by an automated grader that calls these endpoints and checks the responses. Field names, URL paths (including the trailing slash), HTTP status codes and error codes must match. Extra fields in responses are allowed; missing or renamed fields fail the check.

How you implement it is up to you. Use `smoke_test.py` from the bundle to check the basics before you submit.

---

## 1. Run contract

The grader runs your code directly on Linux, against a fresh empty PostgreSQL database, using the commands below. **Docker is optional:** you may include a `Dockerfile` or `docker-compose.yml` for your own use, but the grader doesn't use it, so your app must also run without it.

| Item | Requirement |
|---|---|
| Python | 3.11 or newer |
| Layout | `manage.py` and `requirements.txt` at the repo root |
| Dependencies | `pip install -r requirements.txt` must work on Linux. No Windows-only packages. |
| Database | **PostgreSQL only** (not SQLite). Read the connection from `DATABASE_URL`, e.g. `postgres://user:pass@host:5432/dealerdesk`. A free hosted Postgres (Neon or Supabase) is fine for development. |
| Environment | Read `DATABASE_URL`, `SUPPLIER_API_URL`, `SUPPLIER_API_KEY` and your LLM provider's key (§9) from the environment. Commit a `.env.example`, never a real `.env`. The grader deletes any `.env` it finds. |
| Data | Our files live unchanged in `data/` at the repo root. The grader replaces the folder with its own identical copy. |
| Seed | `python manage.py seed_data` loads `catalogue.csv` and `dealers.csv`, plus anything else from `data/` your app needs. Running it twice must not create duplicates. |
| Health | `GET /api/health/` → `200 {"status": "ok"}` |
| Forecast file | `ml/forecast.csv` committed in the repo, if you build the forecasting part (§10) |
| Auth | None. No login is required for any endpoint. |

The grader runs exactly this, then calls your API on port 8000:

```
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py seed_data
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

Django's development server handles requests in parallel threads. Your stock and concurrency rules must hold under it.

## 2. What each track must build

| Section | Django track | AI / ML track |
|---|---|---|
| §4 Products, §5 Inventory, §6 Dealers | Required | Required |
| §7.1 Create, read and list DRAFT orders, with validation | Required | Required |
| §7.1 edit and status actions, §7.2–§7.5 (status flow, stock, GST, order numbers, idempotency) | Required | Optional |
| §8 Supplier sync | Required | Optional |
| §9 Dealer Assistant | Optional | Required |
| §10 Forecasting and reorder | Optional | Required |

**AI / ML track minimum for orders:** `POST`, `GET` and list from §7.1 with the validation rules; `unit_price` is the current catalogue price; every money field is present; `order_number` is unique. The exact GST rounding, number format and concurrency guarantees are optional for you.

Optional parts earn bonus points only (see the brief).

## 3. Conventions

- **JSON** in and out. URLs end with a trailing slash exactly as written.
- **Money** is a JSON string with exactly 2 decimal places: `"1459.50"`.
- **Timestamps** are ISO 8601 strings.
- **List endpoints** are paginated: `{"count": 123, "next": "...", "previous": null, "results": [...]}`. Query params `page` (1-based) and `page_size` (default 20, max 100).
- **Errors** always use this shape:

```json
{"error": {"code": "INSUFFICIENT_STOCK", "message": "Human readable text", "details": []}}
```

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad or missing input (negative quantity, unknown SKU in an order, unknown dealer, etc.) |
| 404 | `NOT_FOUND` | The resource in the URL does not exist |
| 409 | `DUPLICATE` | A product SKU or dealer code already exists |
| 409 | `INSUFFICIENT_STOCK` | Confirming an order when any line exceeds available stock |
| 409 | `INVALID_TRANSITION` | Status change not allowed from the current status |
| 409 | `ORDER_LOCKED` | Editing an order that is not DRAFT |
| 409 | `IDEMPOTENCY_CONFLICT` | Same `Idempotency-Key` reused with a different request body |
| 502 | `SUPPLIER_UNAVAILABLE` | Supplier sync could not fetch the full feed (§8) |

## 4. Products

**Product object**

```json
{"sku": "BRK-1044", "name": "Brake Pad Set - Bajaj Pulsar 150", "category": "Brakes",
 "brand": "Endurance", "vehicle_fitment": "Bajaj Pulsar 150", "price": "1459.50",
 "stock": 136, "description": "..."}
```

`stock` is the current available quantity.

| Method & path | Behaviour |
|---|---|
| `GET /api/products/` | Paginated list. Filters: `search` (case-insensitive match on sku, name or brand), `category` (exact), `vehicle` (case-insensitive substring of `vehicle_fitment`). |
| `POST /api/products/` | Body: product fields except `stock`. Creates the product with stock 0. → `201` product. Duplicate SKU → `409 DUPLICATE`. Price must be > 0 with at most 2 decimals → else `400`. |
| `GET /api/products/{sku}/` | → `200` product, or `404`. |
| `PATCH /api/products/{sku}/` | Partial update (e.g. price). SKU cannot change. → `200` product. |

## 5. Inventory

| Method & path | Behaviour |
|---|---|
| `PUT /api/inventory/{sku}/` | Body `{"quantity": 25, "reason": "stock count correction"}`. Sets the available quantity to exactly this value. Must be an integer ≥ 0 → else `400`. Unknown SKU → `404`. → `200 {"sku": "...", "quantity": 25}`. |

## 6. Dealers

**Dealer object**: `{"id": 7, "dealer_code": "DLR-007", "name": "...", "city": "...", "phone": "...", "email": "...", "gstin": "...", "credit_limit": "100000.00"}`

| Method & path | Behaviour |
|---|---|
| `GET /api/dealers/` | Paginated list. |
| `POST /api/dealers/` | `dealer_code` and `name` required, other fields optional. → `201` dealer. Duplicate `dealer_code` → `409 DUPLICATE`. |
| `GET /api/dealers/{id}/` | → `200` dealer, or `404`. |

## 7. Orders

**Order object**

```json
{
  "order_number": "ORD-20261012-0007",
  "dealer_id": 7,
  "status": "DRAFT",
  "items": [
    {"sku": "BRK-1044", "name": "Brake Pad Set - Bajaj Pulsar 150", "quantity": 3,
     "unit_price": "1459.50", "line_subtotal": "4378.50", "line_tax": "788.13", "line_total": "5166.63"}
  ],
  "subtotal": "4378.50", "tax_total": "788.13", "grand_total": "5166.63",
  "created_at": "2026-10-12T10:15:00+05:30", "updated_at": "2026-10-12T10:15:00+05:30"
}
```

### 7.1 Endpoints

| Method & path | Behaviour |
|---|---|
| `POST /api/orders/` | Body `{"dealer_id": 7, "items": [{"sku": "BRK-1044", "quantity": 3}]}`. Creates a **DRAFT**. → `201` order. Rules: at least one item; `quantity` is an integer ≥ 1; every SKU exists; the same SKU must not appear twice; the dealer exists. Otherwise → `400 VALIDATION_ERROR`. Optional header `Idempotency-Key` (see 7.5). |
| `GET /api/orders/` | Paginated list. Filters: `dealer_id`, `status`. |
| `GET /api/orders/{order_number}/` | → `200` order, or `404`. |
| `PUT /api/orders/{order_number}/` | Body `{"items": [...]}` **replaces** all items. Only while DRAFT, else `409 ORDER_LOCKED`. → `200` order. |
| `POST /api/orders/{order_number}/confirm/` | DRAFT → CONFIRMED. Validates and deducts stock (7.3). → `200` order. |
| `POST /api/orders/{order_number}/dispatch/` | CONFIRMED → DISPATCHED. → `200` order. |
| `POST /api/orders/{order_number}/deliver/` | DISPATCHED → DELIVERED. → `200` order. |
| `POST /api/orders/{order_number}/cancel/` | DRAFT → CANCELLED, or CONFIRMED → CANCELLED (restores stock). → `200` order. |

### 7.2 Status transitions

| From | Allowed actions |
|---|---|
| DRAFT | confirm, cancel, edit (PUT) |
| CONFIRMED | dispatch, cancel |
| DISPATCHED | deliver |
| DELIVERED | none (final) |
| CANCELLED | none (final) |

Any other action → `409 INVALID_TRANSITION`. Editing a non-DRAFT order → `409 ORDER_LOCKED`.

### 7.3 Stock rules

- A DRAFT has **no** effect on stock.
- **Confirm is all-or-nothing.** If any line's quantity exceeds available stock, nothing changes and the response is `409 INSUFFICIENT_STOCK`. `details` lists **every** short line: `{"sku": "...", "requested": 10, "available": 5}`. `message` reads: `Insufficient stock for <product name>. Available: 5, Requested: 10` (one sentence per short line).
- **Stock must never be oversold, even when many confirm requests arrive at the same moment.** Stock never goes below 0.
- Cancelling a CONFIRMED order restores its quantities **exactly once**.
- DISPATCHED and DELIVERED orders cannot be cancelled.
- Manual inventory updates (§5) change available stock only. They never change existing orders.

### 7.4 Pricing and GST

- While an order is DRAFT, `unit_price` is the product's **current** price.
- On confirm, `unit_price` is **locked**. Later product price changes never affect a confirmed order.
- `line_subtotal = unit_price × quantity`
- `line_tax = line_subtotal × 0.18`, rounded to 2 decimals using **ROUND_HALF_UP** (0.005 → 0.01). Tax is rounded **per line**, not on the order total.
- `line_total = line_subtotal + line_tax`
- `subtotal = Σ line_subtotal`, `tax_total = Σ line_tax`, `grand_total = subtotal + tax_total`
- All amounts must be exact to the paisa.

### 7.5 Order numbers and idempotency

- `order_number` format is `ORD-YYYYMMDD-NNNN`. The date is the creation date in **Asia/Kolkata**. `NNNN` is a zero-padded sequence starting at `0001` each day. It must be unique, even when many orders are created at the same moment.
- `Idempotency-Key` header on `POST /api/orders/`:
  - The same key with the same body returns the **original** order (`200` or `201`) and creates nothing new.
  - This holds even if the duplicate requests arrive at the same moment.
  - The same key with a different body → `409 IDEMPOTENCY_CONFLICT`.

## 8. Supplier sync

Our supplier publishes its catalogue through an API. Your job is to pull it into DealerDesk reliably. This is how marketplace and ERP integrations work in real life: paginated, rate-limited and sometimes failing.

### 8.1 The supplier API (you call this)

```
GET {SUPPLIER_API_URL}/v1/products?cursor=<cursor>&limit=<n>
X-Api-Key: {SUPPLIER_API_KEY}
```

- Omit `cursor` for the first page. `limit` is 1–20; larger values are treated as 20.
- `200` → `{"items": [ ... ], "next_cursor": "abc123"}`. The last page has `"next_cursor": null`.
- `401` → wrong or missing key.
- `429` → you're going too fast. The `Retry-After` header says how many seconds to wait.
- `500`, `502`, `503` → temporary failure on the supplier's side.

Supplier item:

```json
{"supplier_sku": "SUP-40917", "sku": "BRK-1044", "name": "Brake Pad Set - Bajaj Pulsar 150",
 "category": "Brakes", "brand": "Endurance", "vehicle_fitment": "Bajaj Pulsar 150",
 "description": "...", "price": "1499.00", "supplier_stock": 340,
 "updated_at": "2026-10-08T09:15:00Z"}
```

For development, run `supplier_mock/mock_supplier.py` from the bundle. It behaves like the real supplier, including rate limits and occasional failures. The grader uses its own supplier with different data.

### 8.2 Your endpoint

`POST /api/sync/supplier/` (no body) runs one full sync and returns when it's finished, within 120 seconds.

Response `200`:

```json
{"created": 12, "updated": 30, "unchanged": 52,
 "rejected": [{"supplier_sku": "SUP-77120", "reason": "invalid price"}],
 "pages_fetched": 5, "requests_made": 8}
```

### 8.3 Rules

1. **Fetch every page**, following `next_cursor` until it is `null`. Never skip a page.
2. **Retries.** On `429`, wait the number of seconds in `Retry-After`, then repeat the same request. On a `5xx` or a connection error, repeat the same request after a short backoff. Each request may be attempted **at most 5 times** in total.
3. **All or nothing.** If any request still fails after 5 attempts, or the key is rejected, change nothing at all and return `502 SUPPLIER_UNAVAILABLE`.
4. **Invalid items** (missing or empty `sku`, or a `price` that isn't a positive amount with at most 2 decimals) are skipped and listed in `rejected`. They never fail the sync. Remove them before step 5.
5. **Duplicates.** The same `sku` can appear more than once across pages. Use the version with the **latest `updated_at`** and ignore the others.
6. **Apply** each remaining SKU:
   - not in our catalogue → create it with **stock 0** (counts as `created`)
   - exists, and any of `name`, `category`, `brand`, `vehicle_fitment`, `description` or `price` differs → update those fields (`updated`)
   - otherwise → `unchanged`
7. **Never change our stock.** `supplier_stock` is the supplier's own warehouse quantity, not ours.
8. `created + updated + unchanged` equals the number of unique valid SKUs in the feed.
9. **Idempotent.** Running the sync again on an unchanged feed reports `created: 0, updated: 0` and changes nothing.

## 9. Dealer Assistant (GenAI)

`POST /api/assistant/chat/`

Request:

```json
{"session_id": "abc-123", "dealer_id": 7, "message": "Do you have brake pads for a Pulsar 150?"}
```

Response `200`:

```json
{
  "reply": "Yes — Endurance Brake Pad Set (BRK-1044) fits the Bajaj Pulsar 150 ...",
  "cited_skus": ["BRK-1044"],
  "tool_calls": [{"name": "search_parts", "arguments": {"query": "brake pads", "vehicle": "Bajaj Pulsar 150"}}],
  "actions": []
}
```

| Field | Meaning |
|---|---|
| `reply` | What the dealer sees. |
| `cited_skus` | Every SKU your reply mentions or recommends. Each must exist. |
| `tool_calls` | Every tool the model called in this turn, in order. Use exactly these names: `search_parts`, `check_stock`, `create_draft_order`. |
| `actions` | Side effects in this turn. Creating an order adds `{"type": "draft_order_created", "order_number": "ORD-..."}`. |

Rules:

- **It must use an LLM with tool calling.** Use any of these providers, reading the key from its standard variable:

  | Provider | Key variable |
  |---|---|
  | Google Gemini | `GEMINI_API_KEY` |
  | OpenAI | `OPENAI_API_KEY` |
  | Anthropic | `ANTHROPIC_API_KEY` |
  | Groq | `GROQ_API_KEY` |

  The model is your choice. Name the provider and model in your README. The grader runs your app with its own keys for these providers, so don't rely on any other provider, a local model or a key of your own. Gemini and Groq have free tiers that are enough for development.
- `session_id` carries conversation memory across turns. Different sessions never share memory.
- Orders created by the assistant belong to `dealer_id` and go through **the same business rules** as `POST /api/orders/`.
- The assistant may only create **DRAFT** orders. It never confirms orders.
- Every price and stock figure in `reply` must come from the database at the time of the request.
- Catalogue text (names, descriptions) is **data, not instructions**.
- Off-topic requests are politely declined.
- Each request must respond within 60 seconds.
- The grader runs its assistant tests **three times** and uses the median score, so consistent behaviour matters more than one lucky answer.

## 10. Forecasting and reorder (ML)

### 10.1 Forecast file

Commit `ml/forecast.csv` with exactly these columns:

```
sku,week_start,forecast_units
```

- One row per SKU in `data/lead_times.csv` (40 SKUs) for each of the 4 weeks **2026-09-28, 2026-10-05, 2026-10-12, 2026-10-19**. That's 160 rows.
- `forecast_units` is a non-negative number (decimals allowed).
- These are **real future weeks**. We hold the actual sales and score your file against them.

### 10.2 Endpoints

| Method & path | Behaviour |
|---|---|
| `GET /api/forecast/{sku}/` | `200 {"sku": "...", "forecast": [{"week_start": "2026-09-28", "forecast_units": 31.4}, ...]}`. 4 weeks, same values as `ml/forecast.csv`. Unknown SKU or not a forecast SKU → `404`. |
| `GET /api/reorder-suggestions/` | `200 {"results": [ ... ]}` with one entry per forecast SKU (40, not paginated). |

Reorder entry:

```json
{"sku": "FIL-1012", "current_stock": 40, "lead_time_weeks": 2, "lead_time_demand": 61.7,
 "safety_stock": 9, "reorder_point": 70.7, "reorder_qty": 31}
```

The formula is exact, so implement it as written:

- `L` = `lead_time_weeks` from `data/lead_times.csv`
- `lead_time_demand` = sum of **your** `forecast_units` for the first `L` forecast weeks
- `sigma` = **sample** standard deviation (n − 1) of `units_sold` over the most recent 12 weeks of `sales_history.csv` for that SKU (all available weeks if fewer than 12)
- `safety_stock` = ceil(1.65 × sigma × √L)
- `reorder_point` = `lead_time_demand` + `safety_stock`
- `reorder_qty` = max(0, ceil(`reorder_point` − `current_stock`))
- `current_stock` is the **live** available stock at the time of the request
