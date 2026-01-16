from src.config import CORS_ORIGINS


def is_allowed_origin(origin: str) -> bool:
    """
    Checks if an origin is allowed according to CORS_ORIGINS and local development rules.
    """
    if not origin:
        return False

    if origin == "null":
        return True

    clean_origin = origin.rstrip("/").lower()
    clean_allowed = [o.rstrip("/").lower() for o in CORS_ORIGINS]

    if clean_origin in clean_allowed:
        return True

    # Allow any local port for dev if it's localhost or 127.0.0.1
    if clean_origin.startswith("http://localhost:") or clean_origin.startswith("http://127.0.0.1:"):
        return True

    # Additional check for exact localhost/127.0.0.1 without port
    if clean_origin in ["http://localhost", "http://127.0.0.1"]:
        return True

    return False


def get_allowed_origin_header(origin: str) -> str:
    """
    Returns the origin to be used in Access-Control-Allow-Origin header.
    Returns the first allowed origin if the provided one is not allowed.
    """
    if is_allowed_origin(origin):
        return origin
    return CORS_ORIGINS[0] if CORS_ORIGINS else "*"
