"""
Legacy shim for device_agent.py
Redirects calls to the modular OOP backend in `backend/core/`.
"""

import json
from backend.core.collector import HardwareCollector
from backend.core.agent import DeviceHealthAgent
from backend.core.model_service import LifecyclePredictor

def collect_data():
    collector = HardwareCollector()
    telemetry = collector.collect_all()
    agent = DeviceHealthAgent()
    ml_input = agent.process_telemetry(telemetry)
    
    result = telemetry.to_dict()
    result.update(ml_input.to_dict())
    return result

if __name__ == "__main__":
    data = collect_data()
    print("\nCollected Telemetry & Agent Metrics:\n")
    print(json.dumps(data, indent=4))

    predictor = LifecyclePredictor()
    telemetry = HardwareCollector().collect_all()
    ml_input = DeviceHealthAgent().process_telemetry(telemetry)
    pred_result = predictor.predict(ml_input)

    print("\nPredicted Remaining Useful Life (RUL):", pred_result.rul_months, "Months")
    print("Recommendation:", pred_result.recommendation)