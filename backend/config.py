import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Multi-location model resolution for Vercel / serverless environments
candidate_model_paths = [
    os.path.join(BASE_DIR, "models", "xgboost_rul_model.pkl"),
    os.path.join(os.path.dirname(BASE_DIR), "models", "xgboost_rul_model.pkl"),
    os.path.join(os.getcwd(), "models", "xgboost_rul_model.pkl"),
    os.path.join(os.getcwd(), "backend", "models", "xgboost_rul_model.pkl"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "xgboost_rul_model.pkl")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "xgboost_rul_model.pkl")),
    "/var/task/models/xgboost_rul_model.pkl",
    "/var/task/backend/models/xgboost_rul_model.pkl",
    "/var/task/api/models/xgboost_rul_model.pkl"
]

MODEL_PATH = os.environ.get("MODEL_PATH", candidate_model_paths[0])
for p in candidate_model_paths:
    if os.path.exists(p):
        MODEL_PATH = p
        break

LHM_URL = os.environ.get("LHM_URL", "http://127.0.0.1:8085/data.json")
LHM_DIR = os.path.join(BASE_DIR, "LibreHardwareMonitor-net472")
LHM_EXE = os.path.join(LHM_DIR, "LibreHardwareMonitor.exe")

# Production & Performance Configuration
SERVER_PORT = int(os.environ.get("PORT", 5000))
API_KEY = os.environ.get("APEXPULSE_API_KEY", "")  # Optional API key for remote agents
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", 10))  # Hardware telemetry cache duration
import tempfile

default_store = os.path.join(tempfile.gettempdir(), "fleet_store.json") if os.environ.get("VERCEL") else os.path.join(BASE_DIR, "fleet_store.json")
FLEET_STORE_PATH = os.environ.get("FLEET_STORE_PATH", default_store)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

# Default Fallback Values when Hardware Sensors are Unavailable
DEFAULT_BATTERY_HEALTH = 100.0
DEFAULT_BATTERY_CYCLES = 0
DEFAULT_SSD_HEALTH = 100.0
DEFAULT_TEMPERATURE = 45.0
DEFAULT_SHUTDOWN_COUNT = 0

# RUL Recommendation Thresholds (Months)
RUL_HEALTHY_THRESHOLD = 36.0
RUL_MONITOR_THRESHOLD = 24.0
RUL_PLAN_REPLACEMENT_THRESHOLD = 12.0
