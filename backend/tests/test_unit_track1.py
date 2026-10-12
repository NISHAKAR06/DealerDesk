"""Unit test suite for Track 1 business logic, serializers, and calculations.

Can run independently without requiring a running PostgreSQL server.
"""
import os
import sys
from decimal import Decimal
from pathlib import Path
import unittest

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dealerdesk.settings")
os.environ.setdefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dealerdesk")
import django
django.setup()

from core.exceptions import (
    ContractDuplicateError,
    ContractNotFoundError,
    ContractValidationError,
    IdempotencyConflictError,
    InsufficientStockError,
    InvalidTransitionError,
    OrderLockedError,
    SupplierUnavailableError,
)
from core.serializers import (
    MoneyField,
    OrderCreateSerializer,
    ProductCreateSerializer,
)


class TestUnitTrack1(unittest.TestCase):
    def test_money_field_two_decimal_places(self):
        f = MoneyField()
        self.assertEqual(f.to_representation(Decimal("1459.5")), "1459.50")
        self.assertEqual(f.to_representation(Decimal("0")), "0.00")
        self.assertEqual(f.to_representation(Decimal("123.456")), "123.46")

    def test_product_create_serializer_validations(self):
        # Valid payload
        s = ProductCreateSerializer(data={
            "sku": "BRK-1044",
            "name": "Brake Pad Set",
            "category": "Brakes",
            "brand": "Endurance",
            "vehicle_fitment": "Bajaj Pulsar 150",
            "price": "1459.50",
        })
        self.assertTrue(s.is_valid(), s.errors)

        # Invalid price: negative
        s2 = ProductCreateSerializer(data={
            "sku": "BRK-1044",
            "name": "Brake Pad Set",
            "category": "Brakes",
            "brand": "Endurance",
            "vehicle_fitment": "Bajaj Pulsar 150",
            "price": "-50.00",
        })
        self.assertFalse(s2.is_valid())

        # Invalid price: 3 decimals
        s3 = ProductCreateSerializer(data={
            "sku": "BRK-1044",
            "name": "Brake Pad Set",
            "category": "Brakes",
            "brand": "Endurance",
            "vehicle_fitment": "Bajaj Pulsar 150",
            "price": "1459.555",
        })
        self.assertFalse(s3.is_valid())

    def test_order_create_serializer_validations(self):
        # Valid order payload
        s = OrderCreateSerializer(data={
            "dealer_id": 7,
            "items": [{"sku": "BRK-1044", "quantity": 3}],
        })
        self.assertTrue(s.is_valid(), s.errors)

        # Empty items rejected
        s_empty = OrderCreateSerializer(data={
            "dealer_id": 7,
            "items": [],
        })
        self.assertFalse(s_empty.is_valid())

        # Duplicate SKUs in order rejected
        s_dup = OrderCreateSerializer(data={
            "dealer_id": 7,
            "items": [
                {"sku": "BRK-1044", "quantity": 3},
                {"sku": "BRK-1044", "quantity": 2},
            ],
        })
        self.assertFalse(s_dup.is_valid())

        # Zero quantity rejected
        s_zero = OrderCreateSerializer(data={
            "dealer_id": 7,
            "items": [{"sku": "BRK-1044", "quantity": 0}],
        })
        self.assertFalse(s_zero.is_valid())

    def test_contract_error_codes(self):
        self.assertEqual(ContractValidationError().code, "VALIDATION_ERROR")
        self.assertEqual(ContractNotFoundError().code, "NOT_FOUND")
        self.assertEqual(ContractDuplicateError().code, "DUPLICATE")
        self.assertEqual(InsufficientStockError().code, "INSUFFICIENT_STOCK")
        self.assertEqual(InvalidTransitionError().code, "INVALID_TRANSITION")
        self.assertEqual(OrderLockedError().code, "ORDER_LOCKED")
        self.assertEqual(IdempotencyConflictError().code, "IDEMPOTENCY_CONFLICT")
        self.assertEqual(SupplierUnavailableError().code, "SUPPLIER_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
