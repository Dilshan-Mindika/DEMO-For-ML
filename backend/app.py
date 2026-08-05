import os
from flask import Flask, jsonify, request, send_from_directory

from backend.config import BASE_DIR
from backend.core.collector import HardwareCollector
from backend.core.agent import DeviceHealthAgent
from backend.core.model_service import LifecyclePredictor
from backend.core.component_manager import ComponentMaintenanceManager
from backend.models.telemetry_schema import MLInputSchema

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"))

# Singleton OOP Services
collector = HardwareCollector()
agent = DeviceHealthAgent()
predictor = LifecyclePredictor()
maintenance_mgr = ComponentMaintenanceManager()


@app.route("/")
def index():
    """Serves the primary Enterprise Dashboard frontend."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "online",
        "service": "Enterprise Laptop Lifecycle Prediction API",
        "model_loaded": predictor.model is not None
    })


@app.route("/api/telemetry", methods=["GET"])
def get_telemetry():
    try:
        telemetry = collector.collect_all()
        return jsonify(telemetry.to_dict())
    except Exception as e:
        return jsonify({"error": f"Failed to collect telemetry: {str(e)}"}), 500


@app.route("/api/predict", methods=["POST", "GET"])
def predict_rul():
    try:
        # Check optional query params or JSON payload for age/usage overrides
        params = request.get_json(silent=True) or {}
        manual_age = float(params.get("age", request.args.get("age", 24.0)))
        daily_usage = float(params.get("daily_usage", request.args.get("daily_usage", 6.5)))

        # 1. Collect telemetry
        telemetry = collector.collect_all()

        # 2. Agent processing
        ml_input = agent.process_telemetry(
            telemetry=telemetry,
            manual_age_months=manual_age,
            daily_usage_hours=daily_usage
        )

        # 3. Model Inference & Recommendation
        result = predictor.predict(ml_input)

        response_payload = {
            "telemetry": telemetry.to_dict(),
            "prediction": result.to_dict()
        }

        return jsonify(response_payload)

    except Exception as e:
        return jsonify({
            "error": f"Prediction pipeline error: {str(e)}",
            "status": "error"
        }), 500


@app.route("/api/simulate-maintenance", methods=["POST"])
def simulate_maintenance():
    try:
        payload = request.get_json() or {}
        action = payload.get("action", "replace_battery")
        current_ml = payload.get("ml_input")

        if not current_ml:
            # Generate current ML input
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
    app.run(host="127.0.0.1", port=5000, debug=True)
