import os
import sys

# Ensure the project root is in the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from a2wsgi import ASGIMiddleware

from src.server.main import app

# Wrap the ASGI app with a WSGI middleware for PythonAnywhere
application = ASGIMiddleware(app)
