import os
import json
import time
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional

try:
    from backend.config import FLEET_STORE_PATH
    from backend.models.telemetry_schema import TelemetryData, MLInputSchema, PredictionResult
except ImportError:
    from config import FLEET_STORE_PATH
    from models.telemetry_schema import TelemetryData, MLInputSchema, PredictionResult


class FleetManager:
    """
    Object-Oriented Enterprise Fleet Manager.
    Tracks all registered enterprise laptops, telemetry history, and RUL predictions.
    Thread-safe and persisted to JSON storage.
    """

    def __init__(self, store_path: str = FLEET_STORE_PATH):
        import tempfile
        self.store_path = store_path
        self.temp_store_path = os.path.join(tempfile.gettempdir(), "fleet_store.json")
        self._lock = threading.Lock()
        self._devices: Dict[str, Dict[str, Any]] = {}
        self._load_from_disk()

    def _load_from_disk(self):
        """Loads fleet records from JSON storage files if present, merging writable and seed stores."""
        candidates = [
            self.temp_store_path,
            self.store_path,
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fleet_store.json"),
            "/var/task/backend/fleet_store.json",
            "/var/task/fleet_store.json",
        ]
        merged: Dict[str, Dict[str, Any]] = {}
        for path in reversed(candidates):
            if path and os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            merged.update(data)
                except Exception:
                    pass
        self._devices = merged

    def _save_to_disk(self):
        """Persists fleet records to JSON storage files safely."""
        target_paths = [self.temp_store_path, self.store_path]
        for path in target_paths:
            if not path:
                continue
            try:
                temp_file = f"{path}.tmp"
                with open(temp_file, "w", encoding="utf-8") as f:
                    json.dump(self._devices, f, indent=2)
                os.replace(temp_file, path)
            except Exception:
                pass

    def register_or_update(
        self,
        telemetry: TelemetryData,
        prediction: PredictionResult
    ) -> Dict[str, Any]:
        """Registers a new device or updates an existing device record in the fleet."""
        serial = telemetry.serial_number or "N/A"
        hostname = telemetry.device_name or "Unknown-Host"
        
        # Unique Device Identifier
        device_id = f"{hostname.lower()}-{serial.lower()}".replace(" ", "-")

        device_record = {
            "device_id": device_id,
            "device_name": telemetry.device_name,
            "device_model": telemetry.device_model,
            "manufacturer": telemetry.manufacturer,
            "os_name": telemetry.os_name,
            "os_version": telemetry.os_version,
            "serial_number": telemetry.serial_number,
            "ip_address": getattr(telemetry, "ip_address", "127.0.0.1"),
            "last_seen": datetime.now().isoformat(),
            "telemetry": telemetry.to_dict(),
            "prediction": prediction.to_dict()
        }

        with self._lock:
            self._devices[device_id] = device_record
            self._save_to_disk()

        return device_record

    def get_all_devices(self) -> List[Dict[str, Any]]:
        """Returns list of summary objects for all monitored fleet devices."""
        summary_list = []
        with self._lock:
            for dev_id, record in self._devices.items():
                pred = record["prediction"]
                ml_in = pred["ml_input"]
                summary_list.append({
                    "device_id": record["device_id"],
                    "device_name": record["device_name"],
                    "device_model": record["device_model"],
                    "manufacturer": record["manufacturer"],
                    "serial_number": record["serial_number"],
                    "ip_address": record.get("ip_address") or record.get("telemetry", {}).get("ip_address") or "127.0.0.1",
                    "last_seen": record["last_seen"],
                    "rul_months": pred["rul_months"],
                    "recommendation": pred["recommendation"],
                    "status_level": pred["status_level"],
                    "status_color": pred["status_color"],
                    "battery_health": ml_in["battery_health"],
                    "ssd_health": ml_in["ssd_health"],
                    "edhi": ml_in["edhi"]
                })
        return summary_list

    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves full device payload by device_id."""
        with self._lock:
            return self._devices.get(device_id)

    def get_fleet_summary(self) -> Dict[str, Any]:
        """Calculates fleet-wide aggregate statistics."""
        with self._lock:
            devices = list(self._devices.values())
        
        total = len(devices)

        if total == 0:
            return {
                "total_devices": 0,
                "healthy_count": 0,
                "monitor_count": 0,
                "replacement_count": 0,
                "avg_rul_months": 0.0,
                "avg_edhi": 0.0
            }

        healthy = sum(1 for d in devices if d.get("prediction", {}).get("status_level") == "healthy")
        monitor = sum(1 for d in devices if d.get("prediction", {}).get("status_level") == "monitor")
        replacement = sum(1 for d in devices if d.get("prediction", {}).get("status_level") in ["plan_replacement", "replace_soon"])

        avg_rul = sum(d.get("prediction", {}).get("rul_months", 0.0) for d in devices) / total
        avg_edhi = sum(d.get("prediction", {}).get("ml_input", {}).get("edhi", 0.0) for d in devices) / total

        return {
            "total_devices": total,
            "healthy_count": healthy,
            "monitor_count": monitor,
            "replacement_count": replacement,
            "avg_rul_months": round(avg_rul, 1),
            "avg_edhi": round(avg_edhi, 1)
        }
