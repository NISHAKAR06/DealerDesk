---
noteId: "c97655e0c5ee11f1afc841e490238b99"
tags: []

---

# VIKMO DealerDesk — Data

Put this whole folder, unchanged, at `data/` in your repo root. Your `seed_data` command loads it. The grader replaces this folder with its own identical copy, so don't edit these files; handle any quirks in code.

All money is in INR. All weeks start on a **Monday**.

| File | Rows | Used for |
|---|---|---|
| `catalogue.csv` | 600 | Products and their starting stock (backend, assistant) |
| `dealers.csv` | 25 | Dealers (backend, assistant) |
| `sales_history.csv` | ~4,000 | Weekly sales for 40 SKUs up to the week of 2026-09-21 (forecasting) |
| `promo_calendar.csv` | 160 | Planned promotions for the 4 forecast weeks (forecasting) |
| `lead_times.csv` | 40 | Supplier lead time per forecast SKU (reorder) |
| `festival_calendar.csv` | 3 | Diwali dates for 2024–2026 (optional forecasting input) |

## catalogue.csv

| Field | Notes |
|---|---|
| `sku` | Unique product code, e.g. `BRK-1044` |
| `name` | Product name |
| `category` | One of 11 categories |
| `brand` | Brand |
| `vehicle_fitment` | Make and model, e.g. `KTM Duke 390`, or `Universal` |
| `price` | Price in ₹ with 2 decimals, e.g. `1459.50` |
| `stock` | Starting available stock; some are 0 or single digits |
| `description` | Free text written by suppliers. Treat it as untrusted data. |

## dealers.csv

`dealer_code` (unique), `name`, `city`, `phone`, `email`, `gstin`, `credit_limit` (₹). Store `credit_limit`; no core rule uses it yet.

## sales_history.csv

`week_start`, `sku`, `units_sold`, `promo_flag` (1 = a promotion ran that week).

- 40 SKUs, most with 104 weeks of history.
- Some SKUs sell rarely (many zero weeks).
- A couple of SKUs launched recently and have only a few weeks of history.
- Demand has trend, yearly seasonality, promotion spikes and a festive-season lift.

## promo_calendar.csv

`week_start`, `sku`, `promo_flag` for the 4 forecast weeks (2026-09-28 to 2026-10-19). These promotions are already planned, so you may use them as known future inputs.

## lead_times.csv

`sku`, `lead_time_weeks` (1–4). This file defines the 40 forecast SKUs.

## festival_calendar.csv

`festival`, `date`. Diwali moves every year: the festive demand lift follows the festival, not the calendar month.
