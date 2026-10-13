"""
Track 2: AI & ML Automated Test Suite.
Validates docs/API_CONTRACT.md §9 (Dealer Assistant) and §10 (Forecasting & Reorder Engine).
"""

import csv
import json
import math
import os
import re
import sys
import unittest
from pathlib import Path
from decimal import Decimal

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dealerdesk.settings")
import django
django.setup()

import requests
from django.conf import settings
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from core.models import Dealer, Order, OrderLineItem, Product
from core.services.order_service import OrderService
from ml.services.assistant_service import AssistantService
from ml.services.forecasting_service import ForecastingService


class Track2ForecastingTests(TestCase):
    """Test suite for Track 2 Demand Forecasting and Forecast File generation."""

    def test_forecast_file_structure_and_counts(self):
        """Verifies backend/ml/forecast.csv and trained scikit-learn artifact exist and are valid."""
        base_dir = Path(settings.BASE_DIR)
        csv_path = base_dir / "ml" / "forecast.csv"
        self.assertTrue(csv_path.exists(), "backend/ml/forecast.csv must exist")

        artifact_path = base_dir / "ml" / "artifacts" / "demand_forecaster.joblib"
        self.assertTrue(artifact_path.exists(), "backend/ml/artifacts/demand_forecaster.joblib must exist")
        artifact = ForecastingService.get_trained_artifact()
        self.assertIn("model", artifact)
        self.assertTrue(hasattr(artifact["model"], "predict"))

        with open(csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            self.assertEqual(
                reader.fieldnames[:3],
                ["sku", "week_start", "forecast_units"],
                "Headers must be sku,week_start,forecast_units",
            )
            rows = list(reader)

        self.assertEqual(len(rows), 160, "Expected exactly 160 forecast rows (40 SKUs x 4 weeks)")
        expected_weeks = {"2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"}
        found_weeks = {r["week_start"] for r in rows}
        self.assertEqual(found_weeks, expected_weeks)

        skus = {r["sku"] for r in rows}
        self.assertEqual(len(skus), 40, "Expected exactly 40 unique forecast SKUs")

        for r in rows:
            val = float(r["forecast_units"])
            self.assertGreaterEqual(val, 0.0, f"Forecast units must be non-negative for {r['sku']}")

    def test_get_sku_forecast_api_success(self):
        """GET /api/forecast/{sku}/ returns 4 weeks of forecast data for valid lead-time SKU."""
        client = APIClient()
        response = client.get("/api/forecast/FIL-1016/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["sku"], "FIL-1016")
        self.assertIn("forecast", data)
        self.assertEqual(len(data["forecast"]), 4)

        weeks = [pt["week_start"] for pt in data["forecast"]]
        self.assertEqual(weeks, ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"])
        for pt in data["forecast"]:
            self.assertIsInstance(pt["forecast_units"], (int, float))
            self.assertGreaterEqual(pt["forecast_units"], 0)

    def test_get_sku_forecast_api_not_found(self):
        """GET /api/forecast/{sku}/ returns 404 NOT_FOUND for unknown SKU."""
        client = APIClient()
        response = client.get("/api/forecast/UNKNOWN-9999/")
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertIn("error", data)
        self.assertEqual(data["error"]["code"], "NOT_FOUND")


class Track2ReorderSuggestionsTests(TestCase):
    """Test suite for Track 2 Reorder Suggestions API and formula compliance."""

    def test_reorder_suggestions_count_and_schema(self):
        """GET /api/reorder-suggestions/ returns exactly 40 results with all contract fields."""
        client = APIClient()
        response = client.get("/api/reorder-suggestions/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        results = data["results"]
        self.assertEqual(len(results), 40, "Expected 40 reorder suggestion items")

        required_keys = {
            "sku",
            "current_stock",
            "lead_time_weeks",
            "lead_time_demand",
            "safety_stock",
            "reorder_point",
            "reorder_qty",
        }
        for item in results:
            self.assertTrue(required_keys.issubset(set(item.keys())))
            self.assertIsInstance(item["sku"], str)
            self.assertIsInstance(item["current_stock"], int)
            self.assertIsInstance(item["lead_time_weeks"], int)
            self.assertIsInstance(item["lead_time_demand"], (int, float))
            self.assertIsInstance(item["safety_stock"], int)
            self.assertIsInstance(item["reorder_point"], (int, float))
            self.assertIsInstance(item["reorder_qty"], int)

    def test_reorder_suggestions_formula_consistency(self):
        """Validates that reorder_point and reorder_qty strictly obey the contract formulas."""
        client = APIClient()
        response = client.get("/api/reorder-suggestions/")
        results = response.json()["results"]

        for item in results:
            # reorder_point = lead_time_demand + safety_stock
            expected_point = round(item["lead_time_demand"] + item["safety_stock"], 1)
            self.assertAlmostEqual(item["reorder_point"], expected_point, places=1)

            # reorder_qty = max(0, ceil(reorder_point - current_stock))
            expected_qty = max(0, math.ceil(item["reorder_point"] - item["current_stock"]))
            self.assertEqual(item["reorder_qty"], expected_qty)


class Track2AssistantTests(TestCase):
    """Test suite for Track 2 Dealer Assistant chat endpoint and tool calling."""

    def setUp(self):
        self.client = APIClient()
        self.dealer = Dealer.objects.filter(dealer_code="DLR-001").first()
        if not self.dealer:
            self.dealer, _ = Dealer.objects.get_or_create(
                dealer_code="DLR-001",
                defaults={"name": "ABC Motors", "city": "Kochi", "credit_limit": Decimal("50000.00")}
            )
        self.product = Product.objects.filter(sku="BRK-1044").first()
        if not self.product:
            self.product, _ = Product.objects.get_or_create(
                sku="BRK-1044",
                defaults={
                    "name": "Brake Pad Set - Bajaj Pulsar 150",
                    "category": "Brakes",
                    "brand": "Endurance",
                    "vehicle_fitment": "Bajaj Pulsar 150",
                    "price": Decimal("1459.50"),
                    "stock": 136,
                    "description": "High quality disc brake pads",
                }
            )

    def test_assistant_chat_empty_message_rejected(self):
        """POST /api/assistant/chat/ rejects empty message with 400 VALIDATION_ERROR."""
        response = self.client.post(
            "/api/assistant/chat/",
            {"session_id": "s1", "dealer_id": self.dealer.id, "message": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["error"]["code"], "VALIDATION_ERROR")

    def test_assistant_chat_long_message_rejected(self):
        """POST /api/assistant/chat/ rejects overly long message with 400 VALIDATION_ERROR."""
        long_msg = "A" * 4500
        response = self.client.post(
            "/api/assistant/chat/",
            {"session_id": "s1", "dealer_id": self.dealer.id, "message": long_msg},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["error"]["code"], "VALIDATION_ERROR")

    def test_assistant_chat_part_query_response_schema(self):
        """POST /api/assistant/chat/ returns contract schema: reply, cited_skus, tool_calls, actions."""
        response = self.client.post(
            "/api/assistant/chat/",
            {
                "session_id": "s1",
                "dealer_id": self.dealer.id,
                "message": "Do you have brake pads for Bajaj Pulsar 150?",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reply", data)
        self.assertIsInstance(data["reply"], str)
        self.assertTrue(len(data["reply"]) > 0)

        self.assertIn("cited_skus", data)
        self.assertIsInstance(data["cited_skus"], list)

        self.assertIn("tool_calls", data)
        self.assertIsInstance(data["tool_calls"], list)

        self.assertIn("actions", data)
        self.assertIsInstance(data["actions"], list)

    def test_assistant_chat_check_stock_query(self):
        """Assistant accurately reports real PostgreSQL stock and price for a specific SKU."""
        response = self.client.post(
            "/api/assistant/chat/",
            {
                "session_id": "s2",
                "dealer_id": self.dealer.id,
                "message": "What is the available stock for SKU BRK-1044?",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("BRK-1044", data["cited_skus"])
        self.assertTrue(any(tc["name"] == "check_stock" for tc in data["tool_calls"]))
        # Verify real database stock and price are cited
        self.assertIn(str(self.product.stock), data["reply"])
        self.assertIn(str(self.product.price), data["reply"])

    def test_assistant_chat_create_draft_order(self):
        """Assistant creates a DRAFT order for a dealer and reports draft_order_created action."""
        response = self.client.post(
            "/api/assistant/chat/",
            {
                "session_id": "s3",
                "dealer_id": self.dealer.id,
                "message": "Create a draft order for 3 units of BRK-1044",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("BRK-1044", data["cited_skus"])
        self.assertTrue(any(a["type"] == "draft_order_created" for a in data["actions"]))
        order_num = data["actions"][0]["order_number"]
        self.assertTrue(order_num.startswith("ORD-"))

        # Verify order was actually created in database as DRAFT
        order = Order.objects.get(order_number=order_num)
        self.assertEqual(order.status, "DRAFT")
        self.assertEqual(order.dealer.dealer_code, self.dealer.dealer_code)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().quantity, 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)

