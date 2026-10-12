from django.http import HttpResponse


class CorsMiddleware:
    """Lightweight CORS middleware for local frontend dev server access."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse()
        else:
            response = self.get_response(request)

        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Idempotency-Key, X-Api-Key"
        response["Access-Control-Expose-Headers"] = "Content-Length, Idempotency-Key"
        return response

