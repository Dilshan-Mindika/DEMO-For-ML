from typing import Dict, Any
from backend.models.telemetry_schema import MLInputSchema


class ComponentMaintenanceManager:
    """
    Component-Level Maintenance Manager.
    Simulates component replacements (e.g. Battery, SSD) by resetting component-specific wear metrics
    while preserving device history (device age, total usage hours, shutdown logs).
    """

    @staticmethod
    def replace_battery(ml_input: MLInputSchema) -> MLInputSchema:
        """Resets battery health to 100.0% and battery cycles to 0."""
        updated = MLInputSchema(
            device_model=ml_input.device_model,
            usage_profile=ml_input.usage_profile,
            age=ml_input.age,
            usage_hours=ml_input.usage_hours,
            battery_cycles=0,
            battery_health=100.0,
            ssd_health=ml_input.ssd_health,
            temperature=ml_input.temperature,
            performance_score=ml_input.performance_score,
            shutdown_count=ml_input.shutdown_count,
            edhi=min(100.0, ml_input.edhi + 15.0)  # EDHI boost after battery refresh
        )
        return updated

    @staticmethod
    def replace_ssd(ml_input: MLInputSchema) -> MLInputSchema:
        """Resets SSD health to 100.0%."""
        updated = MLInputSchema(
            device_model=ml_input.device_model,
            usage_profile=ml_input.usage_profile,
            age=ml_input.age,
            usage_hours=ml_input.usage_hours,
            battery_cycles=ml_input.battery_cycles,
            battery_health=ml_input.battery_health,
            ssd_health=100.0,
            temperature=ml_input.temperature,
            performance_score=ml_input.performance_score,
            shutdown_count=ml_input.shutdown_count,
            edhi=min(100.0, ml_input.edhi + 10.0)  # EDHI boost after SSD refresh
        )
        return updated

    @staticmethod
    def full_overhaul(ml_input: MLInputSchema) -> MLInputSchema:
        """Performs full maintenance overhaul (New Battery + New SSD + Thermal Clean)."""
        updated = MLInputSchema(
            device_model=ml_input.device_model,
            usage_profile=ml_input.usage_profile,
            age=ml_input.age,
            usage_hours=ml_input.usage_hours,
            battery_cycles=0,
            battery_health=100.0,
            ssd_health=100.0,
            temperature=max(35.0, ml_input.temperature - 10.0),
            performance_score=min(100.0, ml_input.performance_score + 10.0),
            shutdown_count=0,
            edhi=98.0
        )
        return updated
