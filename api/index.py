import os
import sys

# Ensure root workspace directory is in sys.path for Vercel Python runtime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app
