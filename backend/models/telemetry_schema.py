from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List

@dataclass
class TelemetryData:
    """Raw Hardware Telemetry collected from Windows OS & LibreHardwareMonitor."""
    device_name: str = "Enterprise Laptop"
    device_model: str = "Standard Laptop"
    os_name: str = "Windows"
    os_version: str = "11"
    manufacturer: str = "OEM"
    serial_number: Optional[str] = "N/A"
    ip_address: Optional[str] = "127.0.0.1"
    cpu_usage: Optional[float] = 0.0
    ram_usage: Optional[float] = 0.0
    disk_usage: Optional[float] = 0.0
    battery_percent: Optional[float] = 100.0
    power_plugged: Optional[bool] = True
    design_capacity_mwh: Optional[int] = 50000
    full_charge_capacity_mwh: Optional[int] = 50000
    battery_health: Optional[float] = 100.0
    battery_wear: Optional[float] = 0.0
    battery_cycles: Optional[int] = 0
    temperature_current: Optional[float] = 45.0
    temperature_avg: Optional[float] = 45.0
    disk_health_status: Optional[List[Dict[str, Any]]] = None
    ssd_health_percent: Optional[float] = 100.0
    ram_modules: Optional[List[Dict[str, Any]]] = None
    storage_drives: Optional[List[Dict[str, Any]]] = None
    cpu_details: Optional[Dict[str, Any]] = None
    uptime_hours: Optional[float] = 0.0
    shutdowns_30d: Optional[int] = 0
    timestamp: str = ""

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
