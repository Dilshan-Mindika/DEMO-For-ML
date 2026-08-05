import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_rul_model.pkl")
LHM_URL = "http://127.0.0.1:8085/data.json"
LHM_DIR = os.path.join(BASE_DIR, "LibreHardwareMonitor-net472")
LHM_EXE = os.path.join(LHM_DIR, "LibreHardwareMonitor.exe")

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
