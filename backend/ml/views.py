"""
Views for the `ml` Django Application (Track 2 — AI Assistant & Demand Forecasting).
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.exceptions import ContractNotFoundError, ContractValidationError
from ml.services.assistant_service import AssistantService
from ml.services.forecasting_service import ForecastingService


@api_view(["GET"])
def reorder_suggestions(request):
    """GET /api/reorder-suggestions/ -> Reorder suggestions for 40 forecast SKUs."""
    results = ForecastingService.get_reorder_suggestions()
    return Response({"results": results}, status=status.HTTP_200_OK)


@api_view(["GET"])
def sku_forecast(request, sku):
    """GET /api/forecast/{sku}/ -> 4 weeks forecast units from trained ML model."""
    forecast_data = ForecastingService.get_sku_forecast(sku.strip())
    if not forecast_data:
        raise ContractNotFoundError(f"SKU '{sku}' is not a forecast catalogue part.")
    return Response(forecast_data, status=status.HTTP_200_OK)


@api_view(["POST"])
def assistant_chat(request):
    """POST /api/assistant/chat/ -> Google Gemini AI assistant turn with PostgreSQL tool calling."""
    session_id = request.data.get("session_id") or "default-session"
    dealer_id = request.data.get("dealer_id")
    raw_message = request.data.get("message")

    if raw_message is None or not str(raw_message).strip():
        raise ContractValidationError("Message is required and cannot be empty.")

    message_str = str(raw_message).strip()
    if len(message_str) > 4000:
        raise ContractValidationError("Message exceeds maximum allowed length of 4000 characters.")

    res = AssistantService.handle_message(
        session_id=str(session_id),
        dealer_id=dealer_id,
        message=message_str,
    )
    return Response(res, status=status.HTTP_200_OK)

