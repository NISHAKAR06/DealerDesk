import re
from decimal import Decimal
from django.db import models
from django.db.models import CheckConstraint, Q
from django.utils import timezone


class Product(models.Model):
    """Automotive spare-part product catalogue record."""
    sku = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=128, db_index=True)
    brand = models.CharField(max_length=128, db_index=True)
    vehicle_fitment = models.CharField(max_length=255, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.IntegerField(default=0)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sku"]
        constraints = [
            CheckConstraint(
                check=Q(stock__gte=0),
                name="product_stock_non_negative",
            ),
            CheckConstraint(
                check=Q(price__gt=Decimal("0.00")),
                name="product_price_strictly_positive",
            ),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class Dealer(models.Model):
    """Registered dealer account."""
    dealer_code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=128, blank=True, default="")
    phone = models.CharField(max_length=64, blank=True, default="")
    email = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=64, blank=True, default="")
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.dealer_code} - {self.name}"


class OrderStatus(models.TextChoices):
    DRAFT = "DRAFT", "DRAFT"
    CONFIRMED = "CONFIRMED", "CONFIRMED"
    DISPATCHED = "DISPATCHED", "DISPATCHED"
    DELIVERED = "DELIVERED", "DELIVERED"
    CANCELLED = "CANCELLED", "CANCELLED"


class Order(models.Model):
    """B2B dealer purchase requisition / order."""
    order_number = models.CharField(max_length=64, unique=True, db_index=True)
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.DRAFT,
        db_index=True,
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} ({self.status})"


class OrderLineItem(models.Model):
    """Line item within an order."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    sku = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    line_tax = models.DecimalField(max_digits=14, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["id"]
        constraints = [
            CheckConstraint(
                check=Q(quantity__gte=1),
                name="order_item_quantity_gte_1",
            ),
        ]

    def __str__(self):
        return f"{self.order.order_number}: {self.sku} x {self.quantity}"


class OrderSequence(models.Model):
    """Atomic daily counter for generating unique ORD-YYYYMMDD-NNNN order numbers."""
    date_str = models.CharField(max_length=8, unique=True, primary_key=True)
    last_seq = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.date_str}: {self.last_seq}"


class IdempotencyRecord(models.Model):
    """Idempotency record to prevent duplicate concurrent order creations."""
    key = models.CharField(max_length=255, unique=True, db_index=True)
    request_hash = models.CharField(max_length=64)
    order_number = models.CharField(max_length=64)
    response_body = models.JSONField()
    status_code = models.IntegerField(default=201)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Key {self.key} -> {self.order_number}"


class SupplierSyncLog(models.Model):
    """Audit record for supplier sync operations."""
    created_count = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    unchanged_count = models.IntegerField(default=0)
    rejected_count = models.IntegerField(default=0)
    pages_fetched = models.IntegerField(default=0)
    requests_made = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

