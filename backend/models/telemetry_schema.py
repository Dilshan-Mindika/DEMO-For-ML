from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List

@dataclass
class TelemetryData:
    """Raw Hardware Telemetry collected from Windows OS & LibreHardwareMonitor."""
    device_name: str
    device_model: str
    os_name: str
    os_version: str
    manufacturer: str
    serial_number: Optional[str]
    cpu_usage: Optional[float]
    ram_usage: Optional[float]
    disk_usage: Optional[float]
    battery_percent: Optional[float]
    power_plugged: Optional[bool]
    design_capacity_mwh: Optional[int]
    full_charge_capacity_mwh: Optional[int]
    battery_health: Optional[float]
    battery_wear: Optional[float]
    battery_cycles: Optional[int]
    temperature_current: Optional[float]
    temperature_avg: Optional[float]
    disk_health_status: Optional[List[Dict[str, Any]]]
    ssd_health_percent: Optional[float]
    uptime_hours: Optional[float]
    shutdowns_30d: Optional[int]
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MLInputSchema:
    """Dataset payload formatted specifically for the XGBoost RUL Model (11 features)."""
    device_model: str
    usage_profile: str
    age: float
    usage_hours: float
    battery_cycles: int
    battery_health: float
    ssd_health: float
    temperature: float
    performance_score: float
    shutdown_count: int
    edhi: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PredictionResult:
    """Result of Remaining Useful Life prediction and recommendation."""
    rul_months: float
    recommendation: str
    status_level: str  # 'healthy', 'monitor', 'plan_replacement', 'replace_soon'
    status_color: str
    ml_input: Dict[str, Any]
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
