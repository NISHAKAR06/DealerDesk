"""Comprehensive test suite for Track 1 (Django Backend).

Covers models, serializers, pricing/GST rules, products API, inventory API,
dealers API, transactional order lifecycle, stock deduction/restoration,
and supplier sync service.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Dealer, Order, OrderLineItem, OrderStatus, Product
from core.serializers import (
    DealerSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    ProductCreateSerializer,
    ProductSerializer,
)
from core.services.order_service import OrderService
from core.services.supplier_sync import SupplierSyncService


class TestPricingAndSerializers(TestCase):
    """Unit tests for pricing, GST rounding, and serializer validation."""

    def test_money_field_formatting(self):
        prod = Product(
            sku="TST-1001",
            name="Test Part",
            category="Brakes",
            brand="Brembo",
            vehicle_fitment="Universal",
            price=Decimal("1459.50"),
            stock=10,
        )
        serializer = ProductSerializer(prod)
        self.assertEqual(serializer.data["price"], "1459.50")
        self.assertIsInstance(serializer.data["price"], str)

    def test_product_create_serializer_validates_price(self):
        # Valid price
        valid_data = {
            "sku": "TST-1002",
            "name": "Spark Plug",
            "category": "Ignition",
            "brand": "NGK",
            "vehicle_fitment": "Universal",
            "price": "250.00",
        }
        s = ProductCreateSerializer(data=valid_data)
        self.assertTrue(s.is_valid(), s.errors)

        # Negative price -> invalid
        s_neg = ProductCreateSerializer(data={**valid_data, "price": "-10.00"})
        self.assertFalse(s_neg.is_valid())

        # More than 2 decimals -> invalid
        s_dec = ProductCreateSerializer(data={**valid_data, "price": "250.123"})
        self.assertFalse(s_dec.is_valid())

    def test_order_create_serializer_duplicate_skus_rejected(self):
        data = {
            "dealer_id": 1,
            "items": [
                {"sku": "BRK-1044", "quantity": 2},
                {"sku": "BRK-1044", "quantity": 1},
            ],
        }
        s = OrderCreateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn("Duplicate SKUs", str(s.errors))

    def test_order_create_serializer_empty_items_rejected(self):
        data = {"dealer_id": 1, "items": []}
        s = OrderCreateSerializer(data=data)
        self.assertFalse(s.is_valid())


class TestTrack1APIEndpoints(TestCase):
    """Integration tests for all Track 1 endpoints against test database."""

    def setUp(self):
        self.client = APIClient()
        self.product1 = Product.objects.create(
            sku="BRK-1044",
            name="Brake Pad Set - Bajaj Pulsar 150",
            category="Brakes",
            brand="Endurance",
            vehicle_fitment="Bajaj Pulsar 150",
            price=Decimal("1459.50"),
            stock=50,
            description="High performance brake pads",
        )
        self.product2 = Product.objects.create(
            sku="CHN-1001",
            name="Chain Sprocket Kit - Bajaj Pulsar 150",
            category="Drivetrain",
            brand="RK",
            vehicle_fitment="Bajaj Pulsar 150",
            price=Decimal("2990.00"),
            stock=20,
            description="Complete chain kit",
        )
        self.dealer = Dealer.objects.create(
            dealer_code="DLR-001",
            name="Apex Auto",
            city="Bengaluru",
            phone="9876543210",
            email="apex@example.com",
            gstin="29ABCDE1234F1Z5",
            credit_limit=Decimal("50000.00"),
        )

    # ---- Health check ----
    def test_health_check(self):
        res = self.client.get("/api/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "ok"})

    # ---- Products API ----
    def test_product_list_and_filters(self):
        res = self.client.get("/api/products/?category=Brakes")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["sku"], "BRK-1044")

        # Search filter
        res_s = self.client.get("/api/products/?search=endurance")
        self.assertEqual(res_s.status_code, 200)
        self.assertEqual(res_s.json()["count"], 1)

    def test_product_create_and_duplicate_handling(self):
        payload = {
            "sku": "FIL-1001",
            "name": "Oil Filter",
            "category": "Filters",
            "brand": "Bosch",
            "vehicle_fitment": "Universal",
            "price": "350.00",
            "description": "OEM oil filter",
        }
        res = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["sku"], "FIL-1001")
        self.assertEqual(data["stock"], 0)  # Always created with stock 0 per contract

        # Duplicate SKU -> 409 DUPLICATE
        res_dup = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(res_dup.status_code, 409)
        self.assertEqual(res_dup.json()["error"]["code"], "DUPLICATE")

    def test_product_detail_and_404(self):
        res = self.client.get("/api/products/BRK-1044/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["sku"], "BRK-1044")

        res_404 = self.client.get("/api/products/NONEXISTENT/")
        self.assertEqual(res_404.status_code, 404)
        self.assertEqual(res_404.json()["error"]["code"], "NOT_FOUND")

    def test_product_patch(self):
        res = self.client.patch("/api/products/BRK-1044/", {"price": "1599.00"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["price"], "1599.00")

    # ---- Inventory API ----
    def test_inventory_adjust(self):
        res = self.client.put(
            "/api/inventory/BRK-1044/",
            {"quantity": 75, "reason": "annual physical audit"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"sku": "BRK-1044", "quantity": 75})

        # Verify stock on product
        self.product1.refresh_from_db()
        self.assertEqual(self.product1.stock, 75)

    # ---- Dealers API ----
    def test_dealer_list_and_create(self):
        res = self.client.get("/api/dealers/")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.json()["count"], 1)

        new_dealer_payload = {
            "dealer_code": "DLR-999",
            "name": "Super Fast Spares",
            "city": "Mumbai",
            "phone": "9998887776",
        }
        res_c = self.client.post("/api/dealers/", new_dealer_payload, format="json")
        self.assertEqual(res_c.status_code, 201)
        self.assertEqual(res_c.json()["dealer_code"], "DLR-999")

        # Duplicate dealer code -> 409 DUPLICATE
        res_dup = self.client.post("/api/dealers/", new_dealer_payload, format="json")
        self.assertEqual(res_dup.status_code, 409)
        self.assertEqual(res_dup.json()["error"]["code"], "DUPLICATE")

    # ---- Orders & Lifecycle Engine ----
    def test_order_creation_and_gst_calculation(self):
        payload = {
            "dealer_id": self.dealer.id,
            "items": [
                {"sku": "BRK-1044", "quantity": 3},
            ],
        }
        res = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data["order_number"].startswith("ORD-"))
        self.assertEqual(data["status"], "DRAFT")
        # 1459.50 * 3 = 4378.50 subtotal
        # 4378.50 * 0.18 = 788.13 tax
        # line_total = 5166.63
        self.assertEqual(data["subtotal"], "4378.50")
        self.assertEqual(data["tax_total"], "788.13")
        self.assertEqual(data["grand_total"], "5166.63")

    def test_order_lifecycle_confirm_deducts_stock_and_cancel_restores(self):
        initial_stock = self.product1.stock  # 50
        order = OrderService.create_draft_order(
            dealer_id=self.dealer.id,
            items_data=[{"sku": "BRK-1044", "quantity": 5}],
        )

        # Confirm order
        res_conf = self.client.post(f"/api/orders/{order.order_number}/confirm/")
        self.assertEqual(res_conf.status_code, 200)
        self.assertEqual(res_conf.json()["status"], "CONFIRMED")

        self.product1.refresh_from_db()
        self.assertEqual(self.product1.stock, initial_stock - 5)  # 45

        # Cancel order restores stock
        res_canc = self.client.post(f"/api/orders/{order.order_number}/cancel/")
        self.assertEqual(res_canc.status_code, 200)
        self.assertEqual(res_canc.json()["status"], "CANCELLED")

        self.product1.refresh_from_db()
        self.assertEqual(self.product1.stock, initial_stock)  # 50

    def test_order_confirm_fails_on_insufficient_stock(self):
        order = OrderService.create_draft_order(
            dealer_id=self.dealer.id,
            items_data=[{"sku": "BRK-1044", "quantity": 999}],  # exceeds 50
        )
        res_conf = self.client.post(f"/api/orders/{order.order_number}/confirm/")
        self.assertEqual(res_conf.status_code, 409)
        err = res_conf.json()["error"]
        self.assertEqual(err["code"], "INSUFFICIENT_STOCK")
        self.assertTrue(len(err["details"]) > 0)
        self.assertEqual(err["details"][0]["sku"], "BRK-1044")
        self.assertEqual(err["details"][0]["requested"], 999)
        self.assertEqual(err["details"][0]["available"], 50)

    def test_invalid_order_transition_rejected(self):
        order = OrderService.create_draft_order(
            dealer_id=self.dealer.id,
            items_data=[{"sku": "BRK-1044", "quantity": 1}],
        )
        # Cannot dispatch a DRAFT order directly
        res_disp = self.client.post(f"/api/orders/{order.order_number}/dispatch/")
        self.assertEqual(res_disp.status_code, 409)
        self.assertEqual(res_disp.json()["error"]["code"], "INVALID_TRANSITION")


class TestSupplierSync(TestCase):
    """Tests for external supplier sync service with mocked responses."""

    @patch("requests.Session.get")
    def test_supplier_sync_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "items": [
                {
                    "supplier_sku": "SUP-101",
                    "sku": "NEW-PART-1",
                    "name": "New Clutch Cable",
                    "category": "Controls",
                    "brand": "Endurance",
                    "vehicle_fitment": "Universal",
                    "price": "450.00",
                    "supplier_stock": 100,
                    "updated_at": "2026-10-10T10:00:00Z",
                },
                {
                    "supplier_sku": "SUP-102",
                    "sku": "",  # Invalid: missing SKU
                    "price": "100.00",
                },
            ],
            "next_cursor": None,
        }
        mock_get.return_value = mock_resp

        result = SupplierSyncService.sync_catalogue()
        self.assertEqual(result["created"], 1)
        self.assertEqual(result["updated"], 0)
        self.assertEqual(result["unchanged"], 0)
        self.assertEqual(len(result["rejected"]), 1)
        self.assertEqual(result["rejected"][0]["reason"], "missing or empty sku")

        # Verify created product in DB has stock 0
        new_prod = Product.objects.filter(sku="NEW-PART-1").first()
        self.assertIsNotNone(new_prod)
        self.assertEqual(new_prod.stock, 0)

