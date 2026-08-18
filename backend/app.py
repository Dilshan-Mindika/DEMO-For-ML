import os
import sys
import warnings

# Suppress non-critical library warnings
warnings.filterwarnings("ignore")

# Ensure project root is in sys.path when running `python backend/app.py` directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from backend.config import BASE_DIR, SERVER_PORT, API_KEY, ALLOWED_ORIGINS
    from backend.core.collector import HardwareCollector
    from backend.core.agent import DeviceHealthAgent
    from backend.core.model_service import LifecyclePredictor
    from backend.core.component_manager import ComponentMaintenanceManager
    from backend.core.fleet_manager import FleetManager
    from backend.models.telemetry_schema import TelemetryData, MLInputSchema
except ImportError:
    from config import BASE_DIR, SERVER_PORT, API_KEY, ALLOWED_ORIGINS
    from core.collector import HardwareCollector
    from core.agent import DeviceHealthAgent
    from core.model_service import LifecyclePredictor
    from core.component_manager import ComponentMaintenanceManager
    from core.fleet_manager import FleetManager
    from models.telemetry_schema import TelemetryData, MLInputSchema

app = Flask(__name__)

# Configure Cross-Origin Resource Sharing
if ALLOWED_ORIGINS == "*":
    CORS(app)
else:
    CORS(app, origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()])

# Singleton OOP Services
collector = HardwareCollector()
agent = DeviceHealthAgent()
predictor = LifecyclePredictor()
maintenance_mgr = ComponentMaintenanceManager()
fleet_mgr = FleetManager()

class VercelPathFixMiddleware:
    """WSGI Middleware to strip Vercel serverless prefix (/api/index) from PATH_INFO."""
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        path_info = environ.get("PATH_INFO", "")
        if path_info.startswith("/api/index.py"):
            path_info = path_info[13:] or "/"
            environ["PATH_INFO"] = path_info
        elif path_info.startswith("/api/index"):
            path_info = path_info[10:] or "/"
            environ["PATH_INFO"] = path_info
        return self.app(environ, start_response)

app.wsgi_app = VercelPathFixMiddleware(app.wsgi_app)

# Auto-register local host on startup
try:
    local_telemetry = collector.collect_all()
    local_input = agent.process_telemetry(local_telemetry)
    local_pred = predictor.predict(local_input)
    fleet_mgr.register_or_update(local_telemetry, local_pred)
except Exception as err:
    print(f"[!] Warning: Initial startup telemetry collection skipped: {err}")


def verify_api_key_if_required() -> bool:
    """Verifies X-API-Key request header if APEXPULSE_API_KEY is configured in backend environment."""
    if not API_KEY:
        return True
    req_key = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
    return req_key == API_KEY


@app.route("/", methods=["GET"])
@app.route("/api/index", methods=["GET"])
@app.route("/api/index.py", methods=["GET"])
def index_root():
    return jsonify({
        "status": "online",
        "service": "ApexPulse Enterprise Laptop Lifecycle & Fleet Monitoring API",
        "model_loaded": predictor.model is not None,
        "model_error": predictor.load_error,
        "model_path": predictor.model_path,
        "monitored_devices": len(fleet_mgr.get_all_devices()),
        "endpoints": {
            "health": "/api/health",
            "predict": "/api/predict",
            "devices": "/api/devices",
            "telemetry": "/api/devices/telemetry"
        }
    })


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "online",
        "service": "Enterprise Laptop Lifecycle Prediction API",
        "model_loaded": predictor.model is not None,
        "model_error": predictor.load_error,
        "model_path": predictor.model_path,
        "monitored_devices": len(fleet_mgr.get_all_devices())
    })


@app.route("/api/predict", methods=["POST", "GET"])
def predict_rul():
    try:
        params = request.get_json(silent=True)
        if not isinstance(params, dict):
            params = {}

        raw_age = params.get("age", request.args.get("age", 24.0))
        raw_usage = params.get("daily_usage", request.args.get("daily_usage", 6.5))

        try:
            manual_age = float(raw_age)
        except (ValueError, TypeError):
            manual_age = 24.0

        try:
            daily_usage = float(raw_usage)
        except (ValueError, TypeError):
            daily_usage = 6.5

        # 1. Collect hardware telemetry
        telemetry = collector.collect_all()

        # 2. Agent processing
        ml_input = agent.process_telemetry(
            telemetry=telemetry,
            manual_age_months=manual_age,
            daily_usage_hours=daily_usage
        )

        # 3. Model Inference & Recommendation
        result = predictor.predict(ml_input)

        # 4. Register in Fleet Manager
        record = fleet_mgr.register_or_update(telemetry, result)

        return jsonify({
            "telemetry": telemetry.to_dict(),
            "prediction": result.to_dict(),
            "fleet": fleet_mgr.get_fleet_summary()
        })

    except Exception as e:
        return jsonify({
            "error": f"Prediction pipeline error: {str(e)}",
            "status": "error"
        }), 500


import threading
from datetime import datetime

FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "apex-ml-4b1d9")

def sync_device_to_firestore_rest(record: dict):
    """Asynchronously syncs device telemetry & prediction to Firebase Firestore REST API."""
    def _worker():
        try:
            device_id = record.get("device_id")
            if not device_id:
                return

            telemetry = record.get("telemetry", {})
            prediction = record.get("prediction", {})
            ml_input = prediction.get("ml_input", {})

            url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/devices/{device_id}"

            payload = {
                "fields": {
                    "device_id": {"stringValue": str(device_id)},
                    "device_name": {"stringValue": str(record.get("device_name") or "Enterprise Laptop")},
                    "device_model": {"stringValue": str(record.get("device_model") or "Standard Model")},
                    "manufacturer": {"stringValue": str(record.get("manufacturer") or "OEM")},
                    "serial_number": {"stringValue": str(record.get("serial_number") or "N/A")},
                    "ip_address": {"stringValue": str(record.get("ip_address") or telemetry.get("ip_address") or "127.0.0.1")},
                    "status_level": {"stringValue": str(prediction.get("status_level") or "healthy")},
                    "status_color": {"stringValue": str(prediction.get("status_color") or "#10B981")},
                    "recommendation": {"stringValue": str(prediction.get("recommendation") or "Healthy Device")},
                    "rul_months": {"doubleValue": float(prediction.get("rul_months") or 36.0)},
                    "battery_health": {"doubleValue": float(ml_input.get("battery_health") or 100.0)},
                    "ssd_health": {"doubleValue": float(ml_input.get("ssd_health") or 100.0)},
                    "edhi": {"doubleValue": float(ml_input.get("edhi") or 85.0)},
                    "last_seen": {"stringValue": str(record.get("last_seen") or datetime.now().isoformat())}
                }
            }
            requests.patch(url, json=payload, timeout=5)
        except Exception:
            pass

    threading.Thread(target=_worker, daemon=True).start()


@app.route("/api/devices/telemetry", methods=["GET", "POST", "OPTIONS"])
def receive_client_telemetry():
    """API endpoint for remote client agents running on enterprise laptops."""
    try:
        if not verify_api_key_if_required():
            return jsonify({"error": "Unauthorized: Invalid or missing X-API-Key"}), 401

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Invalid JSON payload provided"}), 400

        # Extract actual client IP if telemetry contains loopback 127.0.0.1
        real_client_ip = (request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr or "")
        if not data.get("ip_address") or data.get("ip_address") == "127.0.0.1":
            if real_client_ip and real_client_ip != "127.0.0.1" and real_client_ip != "::1":
                data["ip_address"] = real_client_ip

        # Construct TelemetryData object with schema filtering
        valid_fields = TelemetryData.__dataclass_fields__.keys()
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        telemetry = TelemetryData(**filtered_data)

        # Run AI Agent & ML Prediction
        ml_input = agent.process_telemetry(telemetry)
        prediction = predictor.predict(ml_input)

        # Register/Update in Fleet Manager
        record = fleet_mgr.register_or_update(telemetry, prediction)

        # Real-time sub-second sync to Firebase Firestore REST API
        sync_device_to_firestore_rest(record)

        return jsonify({
            "status": "success",
            "device_id": record["device_id"],
            "prediction": prediction.to_dict()
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process client telemetry: {str(e)}"}), 500


@app.route("/api/devices", methods=["GET"])
def list_devices():
    """Returns list of all monitored fleet laptops and aggregate summary."""
    return jsonify({
        "summary": fleet_mgr.get_fleet_summary(),
        "devices": fleet_mgr.get_all_devices()
    })


@app.route("/api/devices/<device_id>", methods=["GET"])
def get_device_details(device_id):
    """Retrieves full telemetry & prediction details for a selected device with serverless fallback."""
    record = fleet_mgr.get_device(device_id)
    if not record:
        telemetry = collector.collect_all()
        ml_input = agent.process_telemetry(telemetry)
        prediction = predictor.predict(ml_input)
        record = fleet_mgr.register_or_update(telemetry, prediction)
    return jsonify(record)


@app.route("/api/simulate-maintenance", methods=["POST"])
def simulate_maintenance():
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}

        action = payload.get("action", "replace_battery")
        current_ml = payload.get("ml_input")

        if not current_ml or not isinstance(current_ml, dict):
            telemetry = collector.collect_all()
            ml_input = agent.process_telemetry(telemetry)
        else:
            valid_fields = MLInputSchema.__dataclass_fields__.keys()
            filtered_ml = {k: v for k, v in current_ml.items() if k in valid_fields}
            ml_input = MLInputSchema(**filtered_ml)

        # Execute Component Maintenance Action
        if action == "replace_battery":
            updated_input = maintenance_mgr.replace_battery(ml_input)
        elif action == "replace_ssd":
            updated_input = maintenance_mgr.replace_ssd(ml_input)
        elif action == "full_overhaul":
            updated_input = maintenance_mgr.full_overhaul(ml_input)
        else:
            return jsonify({"error": f"Unknown maintenance action: {action}"}), 400

        # Re-predict RUL
        new_result = predictor.predict(updated_input)

        return jsonify({
            "action_applied": action,
            "prediction": new_result.to_dict()
        })

    except Exception as e:
        return jsonify({"error": f"Maintenance simulation failed: {str(e)}"}), 500


@app.errorhandler(404)
def not_found_handler(e):
    return jsonify({
        "status": "online",
        "service": "ApexPulse Enterprise Laptop Lifecycle & Fleet Monitoring API",
        "message": "Resource endpoint active. Use /api/health or /api/predict.",
        "endpoints": {
            "health": "/api/health",
            "predict": "/api/predict",
            "devices": "/api/devices"
        }
    }), 200


if __name__ == "__main__":
    print("=" * 60)
    print("  APEXPULSE: Enterprise Laptop Lifecycle & Fleet Monitoring API")
    print(f"  Status: Active & Listening on http://0.0.0.0:{SERVER_PORT}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=SERVER_PORT, debug=False)

