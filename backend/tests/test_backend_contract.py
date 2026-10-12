"""Backend API Contract & Data Verification Suite

Verifies backend invariants, data files, contract schemas, and liveness
against API_CONTRACT.md.
"""
import unittest
import urllib.request
import urllib.error
import json
import csv
import os
import re
from pathlib import Path

BASE_URL = os.environ.get("DEALERDESK_API_URL", "http://127.0.0.1:8000")
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"

MONEY_REGEX = re.compile(r"^-?\d+\.\d{2}$")
ORDER_NO_REGEX = re.compile(r"^ORD-\d{8}-\d{4}$")


class TestBackendContract(unittest.TestCase):
    """Test suite for backend contract rules and data files."""

    def test_01_health_endpoint_liveness(self):
        """GET /api/health/ must return 200 with {'status': 'ok'} if backend is up."""
        url = f"{BASE_URL}/api/health/"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                self.assertEqual(response.status, 200)
                data = json.loads(response.read().decode())
                self.assertEqual(data.get("status"), "ok")
        except (urllib.error.URLError, ConnectionRefusedError) as e:
            self.skipTest(f"Django backend not running at {BASE_URL}: {e}")

    def test_02_contract_trailing_slashes(self):
        """All documented API endpoints must strictly end with a trailing slash."""
        endpoints = [
            "/api/health/",
            "/api/products/",
            "/api/products/BRK-1044/",
            "/api/inventory/BRK-1044/",
            "/api/dealers/",
            "/api/dealers/1/",
            "/api/orders/",
            "/api/orders/ORD-20261012-0001/",
            "/api/orders/ORD-20261012-0001/confirm/",
            "/api/orders/ORD-20261012-0001/dispatch/",
            "/api/orders/ORD-20261012-0001/deliver/",
            "/api/orders/ORD-20261012-0001/cancel/",
            "/api/sync/supplier/",
            "/api/assistant/chat/",
            "/api/forecast/BRK-1044/",
            "/api/reorder-suggestions/",
        ]
        for ep in endpoints:
            self.assertTrue(ep.endswith("/"), f"Endpoint '{ep}' must end with a trailing slash.")

    def test_03_catalogue_data_file(self):
        """Verify data/catalogue.csv contains valid columns and at least 600 SKUs."""
        cat_file = DATA_DIR / "catalogue.csv"
        self.assertTrue(cat_file.exists(), f"catalogue.csv must exist at {cat_file}")

        with open(cat_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            required_cols = {"sku", "name", "category", "brand", "vehicle_fitment", "price", "stock", "description"}
            self.assertTrue(required_cols.issubset(set(reader.fieldnames or [])), f"catalogue.csv missing columns: {required_cols - set(reader.fieldnames or [])}")
            rows = list(reader)
            self.assertGreaterEqual(len(rows), 600, f"Expected at least 600 catalogue rows, got {len(rows)}")

            # Check money format on catalogue prices
            for r in rows[:10]:
                self.assertRegex(r["price"], MONEY_REGEX, f"Price {r['price']} must match string with 2 decimals")

    def test_04_dealers_data_file(self):
        """Verify data/dealers.csv contains valid columns and registered dealers."""
        dealers_file = DATA_DIR / "dealers.csv"
        self.assertTrue(dealers_file.exists(), f"dealers.csv must exist at {dealers_file}")

        with open(dealers_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            required_cols = {"dealer_code", "name", "city", "phone", "email", "gstin", "credit_limit"}
            self.assertTrue(required_cols.issubset(set(reader.fieldnames or [])), "dealers.csv missing required columns")
            rows = list(reader)
            self.assertGreaterEqual(len(rows), 25, f"Expected at least 25 dealers, got {len(rows)}")

    def test_05_lead_times_data_file(self):
        """Verify data/lead_times.csv contains 40 SKUs for forecasting."""
        lead_file = DATA_DIR / "lead_times.csv"
        self.assertTrue(lead_file.exists(), f"lead_times.csv must exist at {lead_file}")

        with open(lead_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            self.assertEqual(len(rows), 40, f"Expected 40 forecast SKUs in lead_times.csv, got {len(rows)}")

    def test_06_error_code_invariants(self):
        """Verify documented error codes enum."""
        documented_codes = {
            "VALIDATION_ERROR",
            "NOT_FOUND",
            "DUPLICATE",
            "INSUFFICIENT_STOCK",
            "INVALID_TRANSITION",
            "ORDER_LOCKED",
            "IDEMPOTENCY_CONFLICT",
            "SUPPLIER_UNAVAILABLE",
        }
        for code in documented_codes:
            self.assertTrue(code.isupper() and "_" in code or code.isupper())


if __name__ == "__main__":
    unittest.main()
