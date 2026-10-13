import logging
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class APIContractError(APIException):
    """Base exception following API_CONTRACT error specification."""
    status_code = status.HTTP_400_BAD_REQUEST
    code = "VALIDATION_ERROR"
    message = "Validation error"
    details = None

    def __init__(self, message=None, code=None, details=None, status_code=None):
        if message is not None:
            self.message = str(message)
        if code is not None:
            self.code = code
        if details is not None:
            self.details = details if isinstance(details, list) else [details]
        else:
            self.details = []
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)


class ContractValidationError(APIContractError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "VALIDATION_ERROR"


class ContractNotFoundError(APIContractError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    message = "Resource not found"


class ContractDuplicateError(APIContractError):
    status_code = status.HTTP_409_CONFLICT
    code = "DUPLICATE"
    message = "Duplicate record already exists"


class InsufficientStockError(APIContractError):
    status_code = status.HTTP_409_CONFLICT
    code = "INSUFFICIENT_STOCK"
    message = "Insufficient stock"


class InvalidTransitionError(APIContractError):
    status_code = status.HTTP_409_CONFLICT
    code = "INVALID_TRANSITION"
    message = "Status transition not allowed"


class OrderLockedError(APIContractError):
    status_code = status.HTTP_409_CONFLICT
    code = "ORDER_LOCKED"
    message = "Only DRAFT orders can be edited"


class IdempotencyConflictError(APIContractError):
    status_code = status.HTTP_409_CONFLICT
    code = "IDEMPOTENCY_CONFLICT"
    message = "Idempotency key reused with different payload"


class SupplierUnavailableError(APIContractError):
    status_code = status.HTTP_502_BAD_GATEWAY
    code = "SUPPLIER_UNAVAILABLE"
    message = "Supplier API is currently unavailable"


def custom_exception_handler(exc, context):
    """Custom exception handler to guarantee all API error responses follow API_CONTRACT."""
    if isinstance(exc, APIContractError):
        return Response(
            {
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details if isinstance(exc.details, list) else [],
                }
            },
            status=exc.status_code,
        )

    if isinstance(exc, Http404):
        return Response(
            {
                "error": {
                    "code": "NOT_FOUND",
                    "message": str(exc) or "Resource not found",
                    "details": [],
                }
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    response = exception_handler(exc, context)

    if response is not None:
        status_code = response.status_code
        error_code = "VALIDATION_ERROR"
        if status_code == 404:
            error_code = "NOT_FOUND"
        elif status_code == 409:
            error_code = "DUPLICATE"
        elif status_code == 401 or status_code == 403:
            error_code = "UNAUTHORIZED"
        elif status_code == 502:
            error_code = "SUPPLIER_UNAVAILABLE"

        message = "Validation error"
        details = []

        if isinstance(response.data, dict):
            if "detail" in response.data:
                message = str(response.data["detail"])
            else:
                field_errors = []
                for k, v in response.data.items():
                    v_str = ", ".join(str(i) for i in v) if isinstance(v, list) else str(v)
                    field_errors.append(f"{k}: {v_str}")
                    details.append({"field": k, "issue": v_str})
                if field_errors:
                    message = "; ".join(field_errors)
        elif isinstance(response.data, list):
            message = "; ".join(str(i) for i in response.data)
            details = list(response.data)

        response.data = {
            "error": {
                "code": error_code,
                "message": message,
                "details": details,
            }
        }
        return response

    # Unhandled exceptions: auto-retry once on transient cloud PostgreSQL SSL / socket drops
    from django.db import InterfaceError, OperationalError, close_old_connections, connections
    if isinstance(exc, (OperationalError, InterfaceError)):
        try:
            close_old_connections()
            for conn in connections.all():
                conn.close()
        except Exception:
            pass
        req = context.get("request")
        view = context.get("view")
        if req is not None and view is not None and not getattr(req, "_db_retried", False):
            setattr(req, "_db_retried", True)
            handler = getattr(view, req.method.lower(), None)
            if callable(handler):
                try:
                    import time
                    time.sleep(0.2)
                    return handler(req, *context.get("args", ()), **context.get("kwargs", {}))
                except Exception as retry_exc:
                    exc = retry_exc

    logger.exception("Unhandled server exception: %s", exc)
    return Response(
        {
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
                "details": [],
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

