import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.models.telemetry_schema import TelemetryData, MLInputSchema, PredictionResult


class FleetManager:
    """
    Object-Oriented Enterprise Fleet Manager.
    Tracks all registered enterprise laptops, telemetry history, and RUL predictions.
    """

    def __init__(self):
        # Keyed by device_id (unique combination of serial_number / hostname)
        self._devices: Dict[str, Dict[str, Any]] = {}

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
            "last_seen": datetime.now().isoformat(),
            "telemetry": telemetry.to_dict(),
            "prediction": prediction.to_dict()
        }

        self._devices[device_id] = device_record
        return device_record

    def get_all_devices(self) -> List[Dict[str, Any]]:
        """Returns list of summary objects for all monitored fleet devices."""
        summary_list = []
        for dev_id, record in self._devices.items():
            pred = record["prediction"]
            ml_in = pred["ml_input"]
            summary_list.append({
                "device_id": record["device_id"],
                "device_name": record["device_name"],
                "device_model": record["device_model"],
                "manufacturer": record["manufacturer"],
                "serial_number": record["serial_number"],
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
        return self._devices.get(device_id)

    def get_fleet_summary(self) -> Dict[str, Any]:
        """Calculates fleet-wide aggregate statistics."""
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

        healthy = sum(1 for d in devices if d["prediction"]["status_level"] == "healthy")
        monitor = sum(1 for d in devices if d["prediction"]["status_level"] == "monitor")
        replacement = sum(1 for d in devices if d["prediction"]["status_level"] in ["plan_replacement", "replace_soon"])

        avg_rul = sum(d["prediction"]["rul_months"] for d in devices) / total
        avg_edhi = sum(d["prediction"]["ml_input"]["edhi"] for d in devices) / total

        return {
            "total_devices": total,
            "healthy_count": healthy,
            "monitor_count": monitor,
            "replacement_count": replacement,
            "avg_rul_months": round(avg_rul, 1),
            "avg_edhi": round(avg_edhi, 1)
        }
