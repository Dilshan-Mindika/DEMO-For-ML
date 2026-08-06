import os
import sys

# Ensure both backend folder and parent folder are in sys.path for Vercel Serverless
API_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(API_DIR)
PARENT_DIR = os.path.dirname(BACKEND_DIR)

for path in [BACKEND_DIR, PARENT_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

try:
    from app import app as flask_app
except ImportError:
    from backend.app import app as flask_app

# Explicit top-level assignments for Vercel Python AST entrypoint scanner
app = flask_app
application = flask_app
handler = flask_app


