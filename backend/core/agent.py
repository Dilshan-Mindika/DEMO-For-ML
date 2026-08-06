from typing import Dict, Any
try:
    from backend.models.telemetry_schema import TelemetryData, MLInputSchema
except ImportError:
    from models.telemetry_schema import TelemetryData, MLInputSchema


class DeviceHealthAgent:
    """
    AI Health Agent that computes:
    - Usage Profile ('Light', 'Normal', 'Heavy')
    - Performance Score (0 - 100)
    - Enterprise Device Health Index (EDHI) (0 - 100)
    - Device Age & Cumulative Usage Hours
    """

    @staticmethod
    def calculate_usage_profile(usage_hours_per_day: float) -> str:
        """
        Calculates Usage Profile based on daily usage hours:
        < 5 hours/day  => Light
        5 - 8 hours/day => Normal
        > 8 hours/day  => Heavy
        """
        if usage_hours_per_day < 5.0:
            return "Light"
        elif 5.0 <= usage_hours_per_day <= 8.0:
            return "Normal"
        else:
            return "Heavy"

    @staticmethod
    def calculate_performance_score(cpu_usage: float, ram_usage: float, disk_usage: float) -> float:
        """
        Calculates Performance Score (0 - 100).
        Lower system resource contention yields higher performance score.
        """
        cpu = cpu_usage if cpu_usage is not None else 25.0
        ram = ram_usage if ram_usage is not None else 40.0
        disk = disk_usage if disk_usage is not None else 50.0

        # Weighted penalty for system load
        load_index = (cpu * 0.4) + (ram * 0.4) + (disk * 0.2)
        score = max(10.0, min(100.0, 100.0 - load_index * 0.75))
        return round(score, 2)

    @staticmethod
    def calculate_edhi(
        battery_health: float,
        ssd_health: float,
        temperature: float,
        shutdown_count: int,
        performance_score: float
    ) -> float:
        """
        Calculates Enterprise Device Health Index (EDHI) (0 - 100).
        Evaluates battery health, SSD health, temperature stress, crash count, and performance.
        """
        b_score = max(0.0, min(100.0, battery_health))
        s_score = max(0.0, min(100.0, ssd_health))

        # Thermal stress penalty (Ideal range <= 50C, severe penalty > 80C)
        if temperature <= 50.0:
            t_score = 100.0
        elif temperature <= 75.0:
            t_score = 100.0 - (temperature - 50.0) * 2.4
        else:
            t_score = max(0.0, 40.0 - (temperature - 75.0) * 3.0)

        # Shutdown penalty (10 pts lost per unexpected shutdown)
        shutdown_penalty = min(50.0, shutdown_count * 10.0)
        c_score = max(0.0, 100.0 - shutdown_penalty)

        # Weighted composite score
        edhi = (b_score * 0.25) + (s_score * 0.25) + (t_score * 0.20) + (c_score * 0.15) + (performance_score * 0.15)
        return round(max(0.0, min(100.0, edhi)), 2)

    def process_telemetry(
        self,
        telemetry: TelemetryData,
        manual_age_months: float = 24.0,
        daily_usage_hours: float = 6.5
    ) -> MLInputSchema:
        """
        Converts raw TelemetryData into the 11 ML feature inputs required by xgboost_rul_model.pkl.
        """
        profile = self.calculate_usage_profile(daily_usage_hours)
        perf_score = self.calculate_performance_score(
            telemetry.cpu_usage or 20.0,
            telemetry.ram_usage or 45.0,
            telemetry.disk_usage or 50.0
        )

        bat_health = telemetry.battery_health if telemetry.battery_health is not None else 100.0
        ssd_h = telemetry.ssd_health_percent if telemetry.ssd_health_percent is not None else 100.0
        temp_avg = telemetry.temperature_avg if telemetry.temperature_avg is not None else 45.0
        shutdowns = telemetry.shutdowns_30d if telemetry.shutdowns_30d is not None else 0

        edhi = self.calculate_edhi(
            battery_health=bat_health,
            ssd_health=ssd_h,
            temperature=temp_avg,
            shutdown_count=shutdowns,
            performance_score=perf_score
        )

        total_usage_hours = round(manual_age_months * 30.0 * daily_usage_hours, 1)
        bat_cycles = telemetry.battery_cycles if telemetry.battery_cycles is not None else int(manual_age_months * 12)

        return MLInputSchema(
            device_model=telemetry.device_model or "Standard Laptop",
            usage_profile=profile,
            age=manual_age_months,
            usage_hours=total_usage_hours,
            battery_cycles=bat_cycles,
            battery_health=bat_health,
            ssd_health=ssd_h,
            temperature=temp_avg,
            performance_score=perf_score,
            shutdown_count=shutdowns,
            edhi=edhi
        )
