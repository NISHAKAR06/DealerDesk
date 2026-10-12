#!/usr/bin/env python3
"""Local copy of the DealerDesk supplier API, for building the supplier sync (contract section 8).

    python supplier_mock/mock_supplier.py            # rate limits + one temporary failure, like the real thing
    python supplier_mock/mock_supplier.py --outage   # one page never recovers: your sync must change nothing
    python supplier_mock/mock_supplier.py --calm     # no rate limits or failures (for first steps only)

Then run your app with SUPPLIER_API_URL and SUPPLIER_API_KEY set to the values printed at startup.
Standard library only. The feed is built from data/catalogue.csv; the grader uses different data.
"""
import argparse, base64, csv, json, math, os, random, threading, time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

MAX_LIMIT = 20


def encode_cursor(offset):
    return base64.urlsafe_b64encode(f"o:{offset}".encode()).decode().rstrip("=")


def decode_cursor(cursor):
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        return int(raw.split(":")[1])
    except Exception:
        return None


class SupplierMock:
    """The supplier API.

    throttle_every: every Nth request gets 429 + Retry-After. Requests that arrive before the
                    Retry-After time has passed also get 429.
    transient:      {page_index: [status, status, ...]} returned for the first attempts at that page.
    outage_pages:   page indexes that always return 503.
    """

    def __init__(self, feed, key, throttle_every=0, retry_after=1, transient=None, outage_pages=(), verbose=False):
        self.lock = threading.Lock()
        self.key, self.verbose = key, verbose
        self.configure(feed, throttle_every, retry_after, transient, outage_pages)

    def configure(self, feed, throttle_every=0, retry_after=1, transient=None, outage_pages=()):
        with self.lock:
            self.feed = list(feed)
            self.throttle_every, self.retry_after = throttle_every, retry_after
            self.transient = {k: list(v) for k, v in (transient or {}).items()}
            self.outage_pages = set(outage_pages)
            self.n = 0
            self.blocked_until = 0.0
            self.log = []

    def handle(self, path, query, headers):
        with self.lock:
            now = time.time()
            self.n += 1
            u = urlparse(path)
            if u.path.rstrip("/") != "/v1/products":
                return self._rec(now, None, 404, {"error": "not found"})
            if headers.get("X-Api-Key") != self.key:
                return self._rec(now, None, 401, {"error": "invalid api key"})
            q = parse_qs(u.query)
            cursor = (q.get("cursor") or [None])[0]
            try:
                limit = min(MAX_LIMIT, max(1, int((q.get("limit") or [MAX_LIMIT])[0])))
            except ValueError:
                limit = MAX_LIMIT
            offset = 0 if cursor in (None, "") else decode_cursor(cursor)
            if offset is None or offset < 0 or offset > len(self.feed):
                return self._rec(now, None, 400, {"error": "invalid cursor"})
            page = offset // MAX_LIMIT
            if now < self.blocked_until:
                wait = max(1, math.ceil(self.blocked_until - now))
                return self._rec(now, page, 429, {"error": "rate limited"}, {"Retry-After": str(wait)}, offset)
            if self.throttle_every and self.n % self.throttle_every == 0:
                self.blocked_until = now + self.retry_after
                return self._rec(now, page, 429, {"error": "rate limited"}, {"Retry-After": str(self.retry_after)}, offset)
            if page in self.outage_pages:
                return self._rec(now, page, 503, {"error": "service unavailable"}, None, offset)
            if self.transient.get(page):
                status = self.transient[page].pop(0)
                return self._rec(now, page, status, {"error": "temporary failure"}, None, offset)
            items = self.feed[offset: offset + limit]
            nxt = offset + limit
            body = {"items": items, "next_cursor": encode_cursor(nxt) if nxt < len(self.feed) else None}
            return self._rec(now, page, 200, body, offset=offset, count=len(items))

    def _rec(self, t, page, status, body, extra_headers=None, offset=None, count=0):
        self.log.append(dict(t=t, page=page, status=status, offset=offset, count=count))
        if self.verbose:
            print(f"  {time.strftime('%H:%M:%S')}  page={page}  -> {status}" + (f" ({count} items)" if status == 200 else ""), flush=True)
        return status, body, extra_headers or {}


def serve(mock, host="127.0.0.1", port=8099):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            status, body, extra = mock.handle(self.path, None, self.headers)
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            for k, v in extra.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a):
            pass

    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


# ----------------------------------------------------------------------------------------
# Public development feed (built from data/catalogue.csv)
# ----------------------------------------------------------------------------------------
def _ts(base, minutes):
    return (base + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_public_feed(catalogue_path, seed=7):
    rnd = random.Random(seed)
    rows = list(csv.DictReader(open(catalogue_path, encoding="utf-8")))
    base = datetime(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
    sup_ids = iter(rnd.sample(range(10000, 99999), 200))

    def item(r, **over):
        it = dict(supplier_sku=f"SUP-{next(sup_ids)}", sku=r["sku"], name=r["name"], category=r["category"],
                  brand=r["brand"], vehicle_fitment=r["vehicle_fitment"], description=r["description"],
                  price=r["price"], supplier_stock=rnd.randint(0, 900), updated_at=_ts(base, rnd.randint(0, 2000)))
        it.update(over)
        return it

    picks = rnd.sample(rows, 57)
    feed = []
    for i, r in enumerate(picks[:55]):
        if i < 18:
            feed.append(item(r, price=f"{float(r['price']) * rnd.uniform(1.04, 1.15):.2f}"))
        elif i < 21:
            feed.append(item(r, name=r["name"] + " (2026)"))
        elif i < 24:
            feed.append(item(r, description=r["description"] + " Now with a 1-year warranty."))
        else:
            feed.append(item(r))
    codes = ["BRK", "CHN", "FIL", "OIL", "ELE", "GRP", "ACC"]
    for i in range(12):
        code = codes[i % len(codes)]
        feed.append(dict(supplier_sku=f"SUP-{next(sup_ids)}", sku=f"{code}-5{i:03d}", name=f"Supplier Special Part {i + 1} - Universal",
                         category="Universal Accessories", brand="Moto Torque", vehicle_fitment="Universal",
                         description="New from the supplier.", price=f"{rnd.randint(150, 2500)}.00",
                         supplier_stock=rnd.randint(0, 900), updated_at=_ts(base, rnd.randint(0, 2000))))
    rnd.shuffle(feed)
    # duplicates: the newer version is sometimes first, sometimes last
    a, b = picks[55], picks[56]
    newer_a = item(a, price=f"{float(a['price']) + 50:.2f}", updated_at=_ts(base, 3000))
    older_a = dict(newer_a, price=f"{float(a['price']) + 10:.2f}", updated_at=_ts(base, 100))
    older_b = item(b, price=f"{float(b['price']) + 20:.2f}", updated_at=_ts(base, 200))
    newer_b = dict(older_b, price=f"{float(b['price']) + 70:.2f}", updated_at=_ts(base, 3100))
    feed.insert(3, newer_a); feed.insert(8, older_b)
    feed.insert(len(feed) - 4, older_a); feed.insert(len(feed) - 2, newer_b)
    # invalid items
    bad = item(rows[0]); bad.update(sku="")
    bad2 = item(rows[1]); bad2.update(price="N/A")
    bad3 = item(rows[2]); bad3.update(price="12.345")
    feed.insert(25, bad); feed.insert(41, bad2); feed.insert(57, bad3)
    return feed


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="DealerDesk supplier API mock")
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--key", default="dev-supplier-key")
    ap.add_argument("--catalogue", default=None, help="path to data/catalogue.csv")
    ap.add_argument("--outage", action="store_true", help="page 2 always returns 503")
    ap.add_argument("--calm", action="store_true", help="no rate limits or temporary failures")
    a = ap.parse_args()
    cat = a.catalogue
    if not cat:
        for c in (os.path.join(here, "..", "data", "catalogue.csv"), os.path.join("data", "catalogue.csv")):
            if os.path.exists(c):
                cat = c; break
    if not cat or not os.path.exists(cat):
        ap.error("can't find data/catalogue.csv; pass --catalogue path/to/catalogue.csv")
    feed = build_public_feed(cat)
    if a.calm:
        mock = SupplierMock(feed, a.key, verbose=True)
    else:
        mock = SupplierMock(feed, a.key, throttle_every=4, retry_after=1, transient={2: [500]},
                            outage_pages=[1] if a.outage else [], verbose=True)
    serve(mock, port=a.port)
    print(f"Supplier mock running: {len(feed)} items, {math.ceil(len(feed) / MAX_LIMIT)} pages"
          + ("  [OUTAGE: page 2 always fails]" if a.outage else "  [calm]" if a.calm else "  [rate limits + temporary failures]"))
    print(f"  SUPPLIER_API_URL=http://127.0.0.1:{a.port}")
    print(f"  SUPPLIER_API_KEY={a.key}")
    print("Restart this mock to reset its failures. Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
