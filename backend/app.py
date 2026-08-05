import os
import sys
import warnings

# Suppress non-critical library warnings
warnings.filterwarnings("ignore")

# Ensure project root is in sys.path when running `python backend/app.py` directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.config import BASE_DIR
from backend.core.collector import HardwareCollector
from backend.core.agent import DeviceHealthAgent
from backend.core.model_service import LifecyclePredictor
from backend.core.component_manager import ComponentMaintenanceManager
from backend.core.fleet_manager import FleetManager
from backend.models.telemetry_schema import TelemetryData, MLInputSchema

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for Next.js frontend

# Singleton OOP Services
collector = HardwareCollector()
agent = DeviceHealthAgent()
predictor = LifecyclePredictor()
maintenance_mgr = ComponentMaintenanceManager()
fleet_mgr = FleetManager()

# Auto-register local host on startup
local_telemetry = collector.collect_all()
local_input = agent.process_telemetry(local_telemetry)
local_pred = predictor.predict(local_input)
fleet_mgr.register_or_update(local_telemetry, local_pred)


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "online",
        "service": "Enterprise Laptop Lifecycle Prediction API",
        "model_loaded": predictor.model is not None,
        "monitored_devices": len(fleet_mgr.get_all_devices())
    })


@app.route("/api/predict", methods=["POST", "GET"])
def predict_rul():
    try:
        params = request.get_json(silent=True) or {}
        manual_age = float(params.get("age", request.args.get("age", 24.0)))
        daily_usage = float(params.get("daily_usage", request.args.get("daily_usage", 6.5)))

        # 1. Collect local hardware telemetry
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


@app.route("/api/devices/telemetry", methods=["POST"])
def receive_client_telemetry():
    """API endpoint for remote client agents running on enterprise laptops."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        # Construct TelemetryData object
        telemetry = TelemetryData(**data)

        # Run AI Agent & ML Prediction
        ml_input = agent.process_telemetry(telemetry)
        prediction = predictor.predict(ml_input)

        # Register/Update in Fleet Manager
        record = fleet_mgr.register_or_update(telemetry, prediction)

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
    """Retrieves full telemetry & prediction details for a selected device."""
    record = fleet_mgr.get_device(device_id)
    if not record:
        return jsonify({"error": f"Device ID '{device_id}' not found"}), 404
    return jsonify(record)


@app.route("/api/simulate-maintenance", methods=["POST"])
def simulate_maintenance():
    try:
        payload = request.get_json() or {}
        action = payload.get("action", "replace_battery")
        current_ml = payload.get("ml_input")
        device_id = payload.get("device_id")

        if not current_ml:
            telemetry = collector.collect_all()
            ml_input = agent.process_telemetry(telemetry)
        else:
            ml_input = MLInputSchema(**current_ml)

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


if __name__ == "__main__":
    print("=" * 60)
    print("  APEXPULSE: Enterprise Laptop Lifecycle & Fleet Monitoring API")
    print("  Status: Active & Listening on http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
