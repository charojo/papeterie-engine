from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.server.utils.cors_utils import get_allowed_origin_header, is_allowed_origin


class UnifiedCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Determine origin
        origin = request.headers.get("origin")

        # Preflight request
        if request.method == "OPTIONS":
            response = Response(status_code=204)
            if origin and is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "*"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

        # Regular request
        response = await call_next(request)

        if origin:
            if is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
            else:
                # Fallback to default if not allowed but we want to avoid total breakage
                # for some cases though usually we should just block it.
                response.headers["Access-Control-Allow-Origin"] = get_allowed_origin_header(None)
        else:
            # Fallback for no origin header
            response.headers["Access-Control-Allow-Origin"] = get_allowed_origin_header(None)

        return response
