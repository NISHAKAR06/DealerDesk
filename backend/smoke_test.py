#!/usr/bin/env python3
"""DealerDesk smoke test: checks the basics of the contract before you submit.

    pip install requests
    python smoke_test.py --base-url http://localhost:8000 --track django
    python smoke_test.py --base-url http://localhost:8000 --track aiml
    python smoke_test.py --base-url http://localhost:8000 --all      # also check optional parts

Run it against a FRESHLY SEEDED database (it creates a test dealer and orders).
Passing this does NOT mean you'll score well. The hidden grader tests the business rules,
concurrency, the supplier sync's behaviour, the assistant and the forecast in depth.
"""
import argparse, csv, os, re, sys, uuid

try:
    import requests
except ImportError:
    sys.exit("Please `pip install requests` first.")

MONEY = re.compile(r"^-?\d+\.\d{2}$")
ORDER_NO = re.compile(r"^ORD-\d{8}-\d{4}$")
results = []


def check(name, fn):
    try:
        problem = fn()
    except requests.RequestException as e:
        problem = f"request failed: {e}"
    except Exception as e:  # a crashing check is reported, never stops the run
        problem = f"{type(e).__name__}: {e}"
    ok = not problem
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + ("" if ok else f"\n         -> {problem}"))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--track", choices=["django", "aiml"])
    ap.add_argument("--all", action="store_true", help="check every part, required or not")
    ap.add_argument("--data", default="data", help="path to the data/ folder")
    ap.add_argument("--forecast", default=os.path.join("ml", "forecast.csv"))
    a = ap.parse_args()
    if not a.track and not a.all:
        ap.error("give --track django, --track aiml or --all")
    B = a.base_url.rstrip("/")
    S = requests.Session()
    get = lambda p, **kw: S.get(B + p, timeout=kw.pop("timeout", 20), **kw)
    post = lambda p, body=None, **kw: S.post(B + p, json=body, timeout=kw.pop("timeout", 20), **kw)
    parts = {"core"}
    if a.all or a.track == "django":
        parts |= {"engine", "sync"}
    if a.all or a.track == "aiml":
        parts |= {"assistant", "forecast"}
    ctx = {}

    def err_shape(r, status, code):
        if r.status_code != status:
            return f"expected HTTP {status}, got {r.status_code}: {r.text[:200]}"
        try:
            e = r.json()["error"]
        except Exception:
            return f'body must be {{"error": {{"code", "message", "details"}}}}, got: {r.text[:200]}'
        if e.get("code") != code or "message" not in e or not isinstance(e.get("details"), list):
            return f"expected error.code={code} with message and details list, got {e}"
        return None

    print(f"\nDealerDesk smoke test against {B}  (parts: {', '.join(sorted(parts))})\n")
    print("Core")

    def health():
        r = get("/api/health/")
        if r.status_code != 200 or r.json() != {"status": "ok"}:
            return f'expected 200 {{"status": "ok"}}, got {r.status_code} {r.text[:100]}'
    if not check("GET /api/health/", health):
        print("\nThe app isn't reachable or healthy; fix that first.")
        sys.exit(1)

    def products():
        r = get("/api/products/?page_size=5")
        b = r.json()
        for k in ("count", "next", "previous", "results"):
            if k not in b:
                return f"paginated list must include '{k}'"
        if b["count"] != 600:
            return f"count is {b['count']}, expected 600 on a freshly seeded database (seed twice must not duplicate)"
        p = b["results"][0]
        for k in ("sku", "name", "category", "brand", "vehicle_fitment", "price", "stock", "description"):
            if k not in p:
                return f"product is missing '{k}'"
        if not (isinstance(p["price"], str) and MONEY.match(p["price"])):
            return f"price must be a string with 2 decimals, got {p['price']!r}"
        if not isinstance(p["stock"], int):
            return f"stock must be an integer, got {p['stock']!r}"
        ctx["products"] = b["results"]
    check("GET /api/products/ (pagination, fields, 600 seeded)", products)

    def product_detail():
        sku = ctx["products"][0]["sku"]
        r = get(f"/api/products/{sku}/")
        if r.status_code != 200 or r.json().get("sku") != sku:
            return f"GET /api/products/{sku}/ returned {r.status_code}"
        return err_shape(get("/api/products/NOPE-0000/"), 404, "NOT_FOUND")
    check("GET /api/products/{sku}/ and 404 error shape", product_detail)

    def dealers():
        b = get("/api/dealers/?page_size=5").json()
        if b.get("count") != 25:
            return f"count is {b.get('count')}, expected 25"
        d = b["results"][0]
        for k in ("id", "dealer_code", "name", "credit_limit"):
            if k not in d:
                return f"dealer is missing '{k}'"
        r = post("/api/dealers/", {"dealer_code": f"SMOKE-{uuid.uuid4().hex[:6]}", "name": "Smoke Test Dealer"})
        if r.status_code != 201:
            return f"POST /api/dealers/ returned {r.status_code}: {r.text[:150]}"
        ctx["dealer"] = r.json()["id"]
    check("Dealers: list (25 seeded) and create", dealers)

    def inventory():
        sku = ctx["products"][0]["sku"]
        r = S.put(f"{B}/api/inventory/{sku}/", json={"quantity": 50, "reason": "smoke test"}, timeout=20)
        if r.status_code != 200 or r.json().get("quantity") != 50:
            return f"PUT /api/inventory/{sku}/ returned {r.status_code}: {r.text[:150]}"
        if get(f"/api/products/{sku}/").json().get("stock") != 50:
            return "product stock doesn't reflect the inventory update"
        ctx["sku"] = sku
    check("PUT /api/inventory/{sku}/", inventory)

    def create_order():
        r = post("/api/orders/", {"dealer_id": ctx["dealer"], "items": [{"sku": ctx["sku"], "quantity": 2}]})
        if r.status_code != 201:
            return f"expected 201, got {r.status_code}: {r.text[:200]}"
        o = r.json()
        for k in ("order_number", "dealer_id", "status", "items", "subtotal", "tax_total", "grand_total", "created_at", "updated_at"):
            if k not in o:
                return f"order is missing '{k}'"
        if o["status"] != "DRAFT":
            return f"new orders must be DRAFT, got {o['status']}"
        it = o["items"][0] if o["items"] else {}
        for k in ("sku", "name", "quantity", "unit_price", "line_subtotal", "line_tax", "line_total"):
            if k not in it:
                return f"order item is missing '{k}'"
        for k in ("subtotal", "tax_total", "grand_total"):
            if not (isinstance(o[k], str) and MONEY.match(o[k])):
                return f"{k} must be a string with 2 decimals, got {o[k]!r}"
        if "engine" in parts and not ORDER_NO.match(o["order_number"]):
            return f"order_number must look like ORD-YYYYMMDD-NNNN, got {o['order_number']!r}"
        if get(f"/api/orders/{o['order_number']}/").status_code != 200:
            return "GET /api/orders/{order_number}/ failed"
        ctx["order"] = o["order_number"]
    check("POST /api/orders/ creates a DRAFT (shape, money format)", create_order)

    check("Validation error shape (empty items)",
          lambda: err_shape(post("/api/orders/", {"dealer_id": ctx.get("dealer"), "items": []}), 400, "VALIDATION_ERROR"))

    if "engine" in parts:
        print("\nOrder engine")

        def lifecycle():
            n = ctx["order"]
            r = post(f"/api/orders/{n}/confirm/")
            if r.status_code != 200 or r.json().get("status") != "CONFIRMED":
                return f"confirm returned {r.status_code}: {r.text[:150]}"
            if get(f"/api/products/{ctx['sku']}/").json()["stock"] != 48:
                return "confirming 2 units should reduce stock from 50 to 48"
            r = post(f"/api/orders/{n}/cancel/")
            if r.status_code != 200 or r.json().get("status") != "CANCELLED":
                return f"cancel returned {r.status_code}: {r.text[:150]}"
            if get(f"/api/products/{ctx['sku']}/").json()["stock"] != 50:
                return "cancelling a confirmed order should restore stock to 50"
            return err_shape(post(f"/api/orders/{n}/confirm/"), 409, "INVALID_TRANSITION")
        check("Confirm, cancel and an invalid transition", lifecycle)

    if "sync" in parts:
        print("\nSupplier sync  (start supplier_mock/mock_supplier.py and point SUPPLIER_API_URL at it)")

        def sync():
            r = post("/api/sync/supplier/", timeout=150)
            if r.status_code == 502:
                return "got 502: is the supplier mock running, and are SUPPLIER_API_URL / SUPPLIER_API_KEY set for your app?"
            if r.status_code != 200:
                return f"expected 200, got {r.status_code}: {r.text[:200]}"
            b = r.json()
            for k in ("created", "updated", "unchanged", "rejected", "pages_fetched", "requests_made"):
                if k not in b:
                    return f"response is missing '{k}'"
            if not isinstance(b["rejected"], list):
                return "'rejected' must be a list"
            print(f"         summary: created={b['created']} updated={b['updated']} unchanged={b['unchanged']} "
                  f"rejected={len(b['rejected'])} pages={b['pages_fetched']} requests={b['requests_made']}")
        check("POST /api/sync/supplier/ (response shape only)", sync)

    if "assistant" in parts:
        print("\nDealer Assistant")

        def chat():
            r = post("/api/assistant/chat/", {"session_id": f"smoke-{uuid.uuid4().hex[:6]}", "dealer_id": ctx.get("dealer"),
                                               "message": "Hello, what can you help me with?"}, timeout=90)
            if r.status_code != 200:
                return f"expected 200, got {r.status_code}: {r.text[:200]}"
            b = r.json()
            if not isinstance(b.get("reply"), str):
                return "'reply' must be a string"
            for k in ("cited_skus", "tool_calls", "actions"):
                if not isinstance(b.get(k), list):
                    return f"'{k}' must be a list"
        check("POST /api/assistant/chat/ (response shape only)", chat)

    if "forecast" in parts:
        print("\nForecasting")
        weeks = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]

        def forecast_file():
            lead = os.path.join(a.data, "lead_times.csv")
            if not os.path.exists(a.forecast):
                return f"{a.forecast} not found (run this from your repo root, or pass --forecast)"
            rows = list(csv.DictReader(open(a.forecast, encoding="utf-8")))
            if not rows or list(rows[0].keys())[:3] != ["sku", "week_start", "forecast_units"]:
                return "columns must be: sku,week_start,forecast_units"
            skus = {r["sku"] for r in csv.DictReader(open(lead))} if os.path.exists(lead) else None
            have = {(r["sku"], r["week_start"]) for r in rows}
            if skus and have != {(s, w) for s in skus for w in weeks}:
                return f"need exactly one row per forecast SKU per week ({len(skus) * 4} rows), got {len(rows)} rows"
            if any(float(r["forecast_units"]) < 0 for r in rows):
                return "forecast_units must be non-negative"
            ctx["fsku"] = rows[0]["sku"]
        check("ml/forecast.csv (columns, 160 rows, weeks)", forecast_file)

        def forecast_api():
            sku = ctx.get("fsku")
            if not sku:
                return "skipped: forecast.csv check failed"
            b = get(f"/api/forecast/{sku}/").json()
            if [x.get("week_start") for x in b.get("forecast", [])] != weeks:
                return f"expected 4 weeks {weeks}, got {b}"
            r = get("/api/reorder-suggestions/", timeout=60)
            res = r.json().get("results")
            if not isinstance(res, list) or len(res) != 40:
                return f"expected 40 results, got {len(res) if isinstance(res, list) else res!r}"
            for k in ("sku", "current_stock", "lead_time_weeks", "lead_time_demand", "safety_stock", "reorder_point", "reorder_qty"):
                if k not in res[0]:
                    return f"reorder entry is missing '{k}'"
        check("GET /api/forecast/{sku}/ and /api/reorder-suggestions/ (shape only)", forecast_api)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed.")
    print("Reminder: this checks the contract basics only. It is not your score.\n")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
