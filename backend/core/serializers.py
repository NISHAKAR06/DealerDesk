from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from rest_framework import serializers

from core.models import Dealer, Order, OrderLineItem, Product


class MoneyField(serializers.CharField):
    """Formats Decimal values as JSON string with exactly 2 decimal places."""
    def to_representation(self, value):
        if value is None:
            return "0.00"
        return f"{Decimal(str(value)):.2f}"


class ProductSerializer(serializers.ModelSerializer):
    price = MoneyField()
    stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "stock",
            "description",
        ]

    def validate_price(self, value):
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Invalid price format")
        if d <= Decimal("0.00"):
            raise serializers.ValidationError("Price must be strictly positive")
        # Check at most 2 decimal places
        parts = str(value).split(".")
        if len(parts) > 1 and len(parts[1]) > 2:
            raise serializers.ValidationError("Price cannot have more than 2 decimal places")
        return d.quantize(Decimal("0.01"))


class ProductCreateSerializer(serializers.ModelSerializer):
    price = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Product
        fields = [
            "sku",
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "description",
        ]
        extra_kwargs = {
            "sku": {"validators": []},
        }

    def validate_price(self, value):
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Invalid price format")
        if d <= Decimal("0.00"):
            raise serializers.ValidationError("Price must be strictly positive")
        parts = str(value).split(".")
        if len(parts) > 1 and len(parts[1]) > 2:
            raise serializers.ValidationError("Price cannot have more than 2 decimal places")
        return d.quantize(Decimal("0.01"))

    def create(self, validated_data):
        validated_data["stock"] = 0
        return super().create(validated_data)


class ProductUpdateSerializer(serializers.ModelSerializer):
    price = serializers.CharField(required=False)
    name = serializers.CharField(required=False)
    category = serializers.CharField(required=False)
    brand = serializers.CharField(required=False)
    vehicle_fitment = serializers.CharField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Product
        fields = [
            "name",
            "category",
            "brand",
            "vehicle_fitment",
            "price",
            "description",
        ]

    def validate_price(self, value):
        if value is None:
            return None
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Invalid price format")
        if d <= Decimal("0.00"):
            raise serializers.ValidationError("Price must be strictly positive")
        parts = str(value).split(".")
        if len(parts) > 1 and len(parts[1]) > 2:
            raise serializers.ValidationError("Price cannot have more than 2 decimal places")
        return d.quantize(Decimal("0.01"))


class InventoryAdjustmentSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class DealerSerializer(serializers.ModelSerializer):
    credit_limit = MoneyField()

    class Meta:
        model = Dealer
        fields = [
            "id",
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]


class DealerCreateSerializer(serializers.ModelSerializer):
    dealer_code = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    city = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.CharField(required=False, allow_blank=True, default="")
    gstin = serializers.CharField(required=False, allow_blank=True, default="")
    credit_limit = serializers.CharField(required=False, default="0.00")

    class Meta:
        model = Dealer
        fields = [
            "dealer_code",
            "name",
            "city",
            "phone",
            "email",
            "gstin",
            "credit_limit",
        ]
        extra_kwargs = {
            "dealer_code": {"validators": []},
        }

    def validate_credit_limit(self, value):
        if not value:
            return Decimal("0.00")
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Invalid credit limit")
        return d.quantize(Decimal("0.01"))


class OrderLineItemSerializer(serializers.ModelSerializer):
    unit_price = MoneyField()
    line_subtotal = MoneyField()
    line_tax = MoneyField()
    line_total = MoneyField()

    class Meta:
        model = OrderLineItem
        fields = [
            "sku",
            "name",
            "quantity",
            "unit_price",
            "line_subtotal",
            "line_tax",
            "line_total",
        ]


class OrderSerializer(serializers.ModelSerializer):
    dealer_id = serializers.IntegerField(source="dealer.id")
    items = OrderLineItemSerializer(many=True, read_only=True)
    subtotal = MoneyField()
    tax_total = MoneyField()
    grand_total = MoneyField()
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")

    class Meta:
        model = Order
        fields = [
            "order_number",
            "dealer_id",
            "status",
            "items",
            "subtotal",
            "tax_total",
            "grand_total",
            "created_at",
            "updated_at",
        ]


class OrderItemInputSerializer(serializers.Serializer):
    sku = serializers.CharField(required=True)
    quantity = serializers.IntegerField(min_value=1)


class OrderCreateSerializer(serializers.Serializer):
    dealer_id = serializers.IntegerField(required=True)
    items = OrderItemInputSerializer(many=True, required=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Order must contain at least one item")
        skus = [item["sku"] for item in items]
        if len(skus) != len(set(skus)):
            raise serializers.ValidationError("Duplicate SKUs are not allowed in the same order")
        return items


class OrderUpdateSerializer(serializers.Serializer):
    items = OrderItemInputSerializer(many=True, required=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Order must contain at least one item")
        skus = [item["sku"] for item in items]
        if len(skus) != len(set(skus)):
            raise serializers.ValidationError("Duplicate SKUs are not allowed in the same order")
        return items
