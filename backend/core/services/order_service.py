import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo
from django.db import transaction
from django.utils import timezone

from core.exceptions import (
    ContractNotFoundError,
    ContractValidationError,
    IdempotencyConflictError,
    InsufficientStockError,
    InvalidTransitionError,
    OrderLockedError,
)
from core.models import (
    Dealer,
    IdempotencyRecord,
    Order,
    OrderLineItem,
    OrderSequence,
    OrderStatus,
    Product,
)

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")
GST_RATE = Decimal("0.18")


def _hash_request_body(body_data: dict) -> str:
    """Computes deterministic SHA256 hash of JSON payload."""
    canonical = json.dumps(body_data, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class OrderService:
    @staticmethod
    def _validate_and_resolve_items(items_data: list) -> dict:
        """Validates non-empty order items, unique SKUs, positive quantities, and resolves Product objects."""
        if not items_data:
            raise ContractValidationError(message="Order must contain at least one item.")

        seen_skus = set()
        for item in items_data:
            sku = item.get("sku")
            if not sku:
                raise ContractValidationError(message="Each line item must have a SKU.")
            if sku in seen_skus:
                raise ContractValidationError(message=f"Duplicate SKU '{sku}' found in order.")
            seen_skus.add(sku)
            qty = item.get("quantity")
            if not isinstance(qty, int) or qty < 1:
                raise ContractValidationError(message=f"Quantity for SKU '{sku}' must be an integer >= 1.")

        products_by_sku = {p.sku: p for p in Product.objects.filter(sku__in=seen_skus)}
        missing_skus = seen_skus - set(products_by_sku.keys())
        if missing_skus:
            missing_list = ", ".join(sorted(missing_skus))
            raise ContractValidationError(message=f"Unknown SKU(s) in order: {missing_list}")

        return products_by_sku

    @staticmethod
    def _populate_order_line_items(order: Order, items_data: list, products_by_sku: dict) -> None:
        """Computes 18% GST with ROUND_HALF_UP per line, bulk-creates OrderLineItems, and updates order totals."""
        subtotal_accum = Decimal("0.00")
        tax_accum = Decimal("0.00")
        line_items_to_create = []

        for item in items_data:
            product = products_by_sku[item["sku"]]
            qty = item["quantity"]
            unit_price = product.price.quantize(Decimal("0.01"))
            line_subtotal = (unit_price * qty).quantize(Decimal("0.01"))
            line_tax = (line_subtotal * GST_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            line_total = (line_subtotal + line_tax).quantize(Decimal("0.01"))

            subtotal_accum += line_subtotal
            tax_accum += line_tax

            line_items_to_create.append(
                OrderLineItem(
                    order=order,
                    product=product,
                    sku=product.sku,
                    name=product.name,
                    quantity=qty,
                    unit_price=unit_price,
                    line_subtotal=line_subtotal,
                    line_tax=line_tax,
                    line_total=line_total,
                )
            )

        OrderLineItem.objects.bulk_create(line_items_to_create)

        order.subtotal = subtotal_accum.quantize(Decimal("0.01"))
        order.tax_total = tax_accum.quantize(Decimal("0.01"))
        order.grand_total = (subtotal_accum + tax_accum).quantize(Decimal("0.01"))
        order.updated_at = timezone.now()
        order.save(update_fields=["subtotal", "tax_total", "grand_total", "updated_at"])

    @staticmethod
    def create_draft_order(dealer_id: int, items_data: list, idempotency_key: str = None) -> Order:
        """Creates a new DRAFT order with transactional validation, sequence number, and GST calculations."""
        req_hash = None
        if idempotency_key:
            req_hash = _hash_request_body({"dealer_id": dealer_id, "items": items_data})
            existing_record = IdempotencyRecord.objects.filter(key=idempotency_key).first()
            if existing_record:
                if existing_record.request_hash == req_hash:
                    original_order = Order.objects.filter(order_number=existing_record.order_number).first()
                    if original_order:
                        return original_order
                else:
                    raise IdempotencyConflictError(
                        message=f"Idempotency-Key '{idempotency_key}' was reused with a different request body."
                    )

        products_by_sku = OrderService._validate_and_resolve_items(items_data)

        dealer = Dealer.objects.filter(id=dealer_id).first()
        if not dealer:
            raise ContractValidationError(message=f"Dealer with id {dealer_id} does not exist.")

        with transaction.atomic():
            now_kolkata = timezone.now().astimezone(KOLKATA_TZ)
            date_str = now_kolkata.strftime("%Y%m%d")

            seq_obj, _ = OrderSequence.objects.select_for_update().get_or_create(
                date_str=date_str, defaults={"last_seq": 0}
            )
            seq_obj.last_seq += 1
            seq_obj.save(update_fields=["last_seq"])
            order_number = f"ORD-{date_str}-{seq_obj.last_seq:04d}"

            order = Order.objects.create(
                order_number=order_number,
                dealer=dealer,
                status=OrderStatus.DRAFT,
                created_at=timezone.now(),
            )

            OrderService._populate_order_line_items(order, items_data, products_by_sku)

            if idempotency_key and req_hash:
                IdempotencyRecord.objects.create(
                    key=idempotency_key,
                    request_hash=req_hash,
                    order_number=order.order_number,
                    response_body={},
                    status_code=201,
                )

            return order

    @staticmethod
    def update_draft_order(order_number: str, items_data: list) -> Order:
        """Replaces items on a DRAFT order. Rejects non-DRAFT orders with 409 ORDER_LOCKED."""
        if not items_data:
            raise ContractValidationError(message="Order must contain at least one item.")

        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")

        if order.status != OrderStatus.DRAFT:
            raise OrderLockedError(message=f"Cannot edit order '{order_number}' in status {order.status}.")

        products_by_sku = OrderService._validate_and_resolve_items(items_data)

        with transaction.atomic():
            order.items.all().delete()
            OrderService._populate_order_line_items(order, items_data, products_by_sku)
            return order

    @staticmethod
    def confirm_order(order_number: str) -> Order:
        """DRAFT -> CONFIRMED. Validates and deducts stock under row-level database locks."""
        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")

        if order.status != OrderStatus.DRAFT:
            raise InvalidTransitionError(message=f"Cannot confirm order in status {order.status}.")

        with transaction.atomic():
            # Lock the order
            order = Order.objects.select_for_update().get(order_number=order_number)
            if order.status != OrderStatus.DRAFT:
                raise InvalidTransitionError(message=f"Cannot confirm order in status {order.status}.")

            items = list(order.items.select_related("product").all())
            product_ids = [item.product_id for item in items]

            # Lock products in deterministic order to avoid deadlocks
            products_locked = {
                p.id: p
                for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
            }

            short_lines = []
            short_messages = []

            for item in items:
                p = products_locked.get(item.product_id)
                if not p or p.stock < item.quantity:
                    available = p.stock if p else 0
                    short_lines.append({
                        "sku": item.sku,
                        "requested": item.quantity,
                        "available": available,
                    })
                    short_messages.append(
                        f"Insufficient stock for {item.name}. Available: {available}, Requested: {item.quantity}"
                    )

            if short_lines:
                raise InsufficientStockError(
                    message=" ".join(short_messages),
                    details=short_lines,
                )

            # Deduct stock and lock unit prices
            for item in items:
                p = products_locked[item.product_id]
                p.stock -= item.quantity
                p.save(update_fields=["stock"])

            order.status = OrderStatus.CONFIRMED
            order.updated_at = timezone.now()
            order.save(update_fields=["status", "updated_at"])

            return order

    @staticmethod
    def dispatch_order(order_number: str) -> Order:
        """CONFIRMED -> DISPATCHED."""
        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")

        if order.status != OrderStatus.CONFIRMED:
            raise InvalidTransitionError(message=f"Cannot dispatch order in status {order.status}.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(order_number=order_number)
            if order.status != OrderStatus.CONFIRMED:
                raise InvalidTransitionError(message=f"Cannot dispatch order in status {order.status}.")

            order.status = OrderStatus.DISPATCHED
            order.updated_at = timezone.now()
            order.save(update_fields=["status", "updated_at"])
            return order

    @staticmethod
    def deliver_order(order_number: str) -> Order:
        """DISPATCHED -> DELIVERED."""
        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")

        if order.status != OrderStatus.DISPATCHED:
            raise InvalidTransitionError(message=f"Cannot deliver order in status {order.status}.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(order_number=order_number)
            if order.status != OrderStatus.DISPATCHED:
                raise InvalidTransitionError(message=f"Cannot deliver order in status {order.status}.")

            order.status = OrderStatus.DELIVERED
            order.updated_at = timezone.now()
            order.save(update_fields=["status", "updated_at"])
            return order

    @staticmethod
    def cancel_order(order_number: str) -> Order:
        """DRAFT -> CANCELLED or CONFIRMED -> CANCELLED (restores stock exactly once)."""
        order = Order.objects.filter(order_number=order_number).first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")

        if order.status not in (OrderStatus.DRAFT, OrderStatus.CONFIRMED):
            raise InvalidTransitionError(message=f"Cannot cancel order in status {order.status}.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(order_number=order_number)
            if order.status not in (OrderStatus.DRAFT, OrderStatus.CONFIRMED):
                raise InvalidTransitionError(message=f"Cannot cancel order in status {order.status}.")

            if order.status == OrderStatus.CONFIRMED:
                items = list(order.items.select_related("product").all())
                product_ids = [item.product_id for item in items]
                products_locked = {
                    p.id: p
                    for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
                }
                for item in items:
                    p = products_locked.get(item.product_id)
                    if p:
                        p.stock += item.quantity
                        p.save(update_fields=["stock"])

            order.status = OrderStatus.CANCELLED
            order.updated_at = timezone.now()
            order.save(update_fields=["status", "updated_at"])
            return order

