from django.db.models import Q
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.exceptions import (
    ContractDuplicateError,
    ContractNotFoundError,
    ContractValidationError,
)
from core.models import Dealer, Order, Product
from core.pagination import StandardPagination
from core.serializers import (
    DealerCreateSerializer,
    DealerSerializer,
    InventoryAdjustmentSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    OrderUpdateSerializer,
    ProductCreateSerializer,
    ProductSerializer,
    ProductUpdateSerializer,
)
from core.services.order_service import OrderService
from core.services.supplier_sync import SupplierSyncService


@api_view(["GET"])
def health(request):
    """GET /api/health/ — liveness probe for assignment grader and monitoring."""
    return JsonResponse({"status": "ok"})


# ==============================================================================
# Products API
# ==============================================================================

@api_view(["GET", "POST"])
def product_list(request):
    """
    GET /api/products/  -> Paginated list with search, category, vehicle filters.
    POST /api/products/ -> Creates a new product with stock 0.
    """
    if request.method == "GET":
        queryset = Product.objects.all().order_by("sku")

        search_query = request.query_params.get("search")
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                Q(sku__icontains=q) | Q(name__icontains=q) | Q(brand__icontains=q)
            )

        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category.strip())

        vehicle = request.query_params.get("vehicle")
        if vehicle:
            queryset = queryset.filter(vehicle_fitment__icontains=vehicle.strip())

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ProductSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        serializer = ProductCreateSerializer(data=request.data)
        if not serializer.is_valid():
            # Check if failure was duplicate SKU
            sku_val = request.data.get("sku")
            if sku_val and Product.objects.filter(sku=sku_val).exists():
                raise ContractDuplicateError(message=f"Product with SKU '{sku_val}' already exists.")
            errors = serializer.errors
            raise ContractValidationError(message="Invalid product payload.", details=errors)

        sku_val = serializer.validated_data["sku"]
        if Product.objects.filter(sku=sku_val).exists():
            raise ContractDuplicateError(message=f"Product with SKU '{sku_val}' already exists.")

        product = serializer.save()
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
def product_detail(request, sku):
    """
    GET /api/products/{sku}/   -> Product detail or 404.
    PATCH /api/products/{sku}/ -> Partial update of product fields. SKU cannot change.
    """
    product = Product.objects.filter(sku=sku).first()
    if not product:
        raise ContractNotFoundError(message=f"Product with SKU '{sku}' not found.")

    if request.method == "GET":
        return Response(ProductSerializer(product).data)

    elif request.method == "PATCH":
        # Ensure SKU cannot be changed
        if "sku" in request.data and request.data["sku"] != product.sku:
            raise ContractValidationError(message="Product SKU cannot be modified.")

        serializer = ProductUpdateSerializer(product, data=request.data, partial=True)
        if not serializer.is_valid():
            raise ContractValidationError(message="Invalid product update payload.", details=serializer.errors)

        product = serializer.save()
        return Response(ProductSerializer(product).data)


# ==============================================================================
# Inventory API
# ==============================================================================

@api_view(["PUT"])
def inventory_adjust(request, sku):
    """
    PUT /api/inventory/{sku}/ -> Overwrites stock quantity.
    Payload: {"quantity": 25, "reason": "stock count correction"}
    """
    product = Product.objects.filter(sku=sku).first()
    if not product:
        raise ContractNotFoundError(message=f"Product with SKU '{sku}' not found.")

    serializer = InventoryAdjustmentSerializer(data=request.data)
    if not serializer.is_valid():
        raise ContractValidationError(message="Invalid inventory payload.", details=serializer.errors)

    new_qty = serializer.validated_data["quantity"]
    product.stock = new_qty
    product.save(update_fields=["stock"])

    return Response({"sku": product.sku, "quantity": product.stock})


# ==============================================================================
# Dealers API
# ==============================================================================

@api_view(["GET", "POST"])
def dealer_list(request):
    """
    GET /api/dealers/  -> Paginated list of registered dealers.
    POST /api/dealers/ -> Register a new dealer account.
    """
    if request.method == "GET":
        queryset = Dealer.objects.all().order_by("id")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = DealerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        serializer = DealerCreateSerializer(data=request.data)
        if not serializer.is_valid():
            code_val = request.data.get("dealer_code")
            if code_val and Dealer.objects.filter(dealer_code=code_val).exists():
                raise ContractDuplicateError(message=f"Dealer code '{code_val}' already exists.")
            raise ContractValidationError(message="Invalid dealer payload.", details=serializer.errors)

        code_val = serializer.validated_data["dealer_code"]
        if Dealer.objects.filter(dealer_code=code_val).exists():
            raise ContractDuplicateError(message=f"Dealer code '{code_val}' already exists.")

        dealer = serializer.save()
        return Response(DealerSerializer(dealer).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def dealer_detail(request, pk):
    """GET /api/dealers/{id}/ -> Dealer detail by ID or dealer_code."""
    dealer = None
    if str(pk).isdigit():
        dealer = Dealer.objects.filter(id=int(pk)).first()
    if not dealer:
        dealer = Dealer.objects.filter(dealer_code=str(pk)).first()

    if not dealer:
        raise ContractNotFoundError(message=f"Dealer '{pk}' not found.")

    return Response(DealerSerializer(dealer).data)


# ==============================================================================
# Orders API
# ==============================================================================

@api_view(["GET", "POST"])
def order_list(request):
    """
    GET /api/orders/  -> Paginated list with dealer_id and status filters.
    POST /api/orders/ -> Creates a DRAFT order. Supports Idempotency-Key.
    """
    if request.method == "GET":
        queryset = Order.objects.all().prefetch_related("items").order_by("-created_at")

        dealer_id = request.query_params.get("dealer_id")
        if dealer_id:
            try:
                queryset = queryset.filter(dealer_id=int(dealer_id))
            except ValueError:
                pass

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.strip().upper())

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = OrderSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == "POST":
        serializer = OrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            raise ContractValidationError(message="Invalid order payload.", details=serializer.errors)

        idempotency_key = request.headers.get("Idempotency-Key") or request.META.get("HTTP_IDEMPOTENCY_KEY")

        order = OrderService.create_draft_order(
            dealer_id=serializer.validated_data["dealer_id"],
            items_data=serializer.validated_data["items"],
            idempotency_key=idempotency_key,
        )
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT"])
def order_detail(request, order_number):
    """
    GET /api/orders/{order_number}/ -> Order details.
    PUT /api/orders/{order_number}/ -> Replaces items while DRAFT.
    """
    if request.method == "GET":
        order = Order.objects.filter(order_number=order_number).prefetch_related("items").first()
        if not order:
            raise ContractNotFoundError(message=f"Order '{order_number}' not found.")
        return Response(OrderSerializer(order).data)

    elif request.method == "PUT":
        serializer = OrderUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            raise ContractValidationError(message="Invalid order update payload.", details=serializer.errors)

        updated_order = OrderService.update_draft_order(
            order_number=order_number,
            items_data=serializer.validated_data["items"],
        )
        return Response(OrderSerializer(updated_order).data)


@api_view(["POST"])
def order_confirm(request, order_number):
    """POST /api/orders/{order_number}/confirm/ -> Transitions DRAFT to CONFIRMED."""
    order = OrderService.confirm_order(order_number)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
def order_dispatch(request, order_number):
    """POST /api/orders/{order_number}/dispatch/ -> Transitions CONFIRMED to DISPATCHED."""
    order = OrderService.dispatch_order(order_number)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
def order_deliver(request, order_number):
    """POST /api/orders/{order_number}/deliver/ -> Transitions DISPATCHED to DELIVERED."""
    order = OrderService.deliver_order(order_number)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
def order_cancel(request, order_number):
    """POST /api/orders/{order_number}/cancel/ -> Cancels order (restores stock if CONFIRMED)."""
    order = OrderService.cancel_order(order_number)
    return Response(OrderSerializer(order).data)


# ==============================================================================
# Supplier Sync API
# ==============================================================================

@api_view(["POST"])
def supplier_sync(request):
    """POST /api/sync/supplier/ -> Performs full supplier catalogue synchronization."""
    summary = SupplierSyncService.sync_catalogue()
    return Response(summary, status=status.HTTP_200_OK)


# ==============================================================================
# Forecasting & Reorder API (§10)
# ==============================================================================

@api_view(["GET"])
def reorder_suggestions(request):
    """GET /api/reorder-suggestions/ -> Reorder suggestions for 40 forecast SKUs."""
    from core.services.forecasting_service import ForecastingService

    results = ForecastingService.get_reorder_suggestions()
    return Response({"results": results}, status=status.HTTP_200_OK)


@api_view(["GET"])
def sku_forecast(request, sku):
    """GET /api/forecast/{sku}/ -> 4 weeks forecast units."""
    from core.services.forecasting_service import ForecastingService

    forecast_data = ForecastingService.get_sku_forecast(sku.strip())
    if not forecast_data:
        raise ContractNotFoundError(f"SKU '{sku}' is not a forecast catalogue part.")
    return Response(forecast_data, status=status.HTTP_200_OK)


# ==============================================================================
# Dealer Assistant API (§9)
# ==============================================================================

@api_view(["POST"])
def assistant_chat(request):
    """POST /api/assistant/chat/ -> GenAI assistant turn with tool calling."""
    from core.services.assistant_service import AssistantService

    session_id = request.data.get("session_id", "default-session")
    dealer_id = request.data.get("dealer_id")
    message = request.data.get("message", "")

    if not message:
        raise ContractValidationError("Message is required.")

    res = AssistantService.handle_message(
        session_id=str(session_id),
        dealer_id=dealer_id,
        message=message,
    )
    return Response(res, status=status.HTTP_200_OK)


@api_view(["GET"])
def supplier_sync_history(request):
    """GET /api/sync/supplier/history/ -> Audit trail of sync runs."""
    from core.models import SupplierSyncLog

    logs = SupplierSyncLog.objects.all()[:20]
    data = [
        {
            "id": log.id,
            "created": log.created_count,
            "updated": log.updated_count,
            "unchanged": log.unchanged_count,
            "rejected": log.rejected_count,
            "pages_fetched": log.pages_fetched,
            "requests_made": log.requests_made,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
    return Response({"results": data}, status=status.HTTP_200_OK)

