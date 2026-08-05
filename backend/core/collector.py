import os
import re
import json
import socket
import psutil
import platform
import requests
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, List

try:
    import wmi
except ImportError:
    wmi = None

from backend.config import LHM_URL, DEFAULT_BATTERY_HEALTH, DEFAULT_SSD_HEALTH, DEFAULT_TEMPERATURE, DEFAULT_SHUTDOWN_COUNT
from backend.models.telemetry_schema import TelemetryData


class HardwareCollector:
    """
    Object-Oriented Hardware Telemetry Collector.
    Gathers metrics from WMI, psutil, Windows PowerCfg, Event Logs, and LibreHardwareMonitor.
    """

    def __init__(self, lhm_url: str = LHM_URL):
        self.lhm_url = lhm_url

    def get_device_info(self) -> Dict[str, Any]:
        info = {
            "device_name": socket.gethostname(),
            "os_name": platform.system(),
            "os_version": platform.version(),
            "manufacturer": "Unknown",
            "device_model": "Standard Laptop",
            "serial_number": "N/A"
        }

        if wmi:
            try:
                c = wmi.WMI()
                system_list = c.Win32_ComputerSystem()
                if system_list:
                    sys_obj = system_list[0]
                    if sys_obj.Manufacturer:
                        info["manufacturer"] = sys_obj.Manufacturer.strip()
                    if sys_obj.Model:
                        info["device_model"] = sys_obj.Model.strip()

                bios_list = c.Win32_BIOS()
                if bios_list and bios_list[0].SerialNumber:
                    info["serial_number"] = bios_list[0].SerialNumber.strip()
            except Exception:
                pass

        return info

    def get_basic_metrics(self) -> Dict[str, Any]:
        try:
            cpu_usage = psutil.cpu_percent(interval=0.5)
        except Exception:
            cpu_usage = None

        try:
            ram_usage = psutil.virtual_memory().percent
        except Exception:
            ram_usage = None

        try:
            disk_usage = psutil.disk_usage("C:\\").percent
        except Exception:
            disk_usage = None

        try:
            battery = psutil.sensors_battery()
            battery_percent = battery.percent if battery else None
            power_plugged = battery.power_plugged if battery else None
        except Exception:
            battery_percent = None
            power_plugged = None

        return {
            "cpu_usage": cpu_usage,
            "ram_usage": ram_usage,
            "disk_usage": disk_usage,
            "battery_percent": battery_percent,
            "power_plugged": power_plugged
        }

    def get_uptime_hours(self) -> float:
        try:
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            return round(uptime.total_seconds() / 3600.0, 2)
        except Exception:
            return 24.0

    def get_battery_wear(self) -> Dict[str, Any]:
        """Runs powercfg /batteryreport and extracts capacity metrics."""
        result = {
            "design_capacity_mwh": None,
            "full_charge_capacity_mwh": None,
            "battery_health": DEFAULT_BATTERY_HEALTH,
            "battery_wear": 0.0,
            "battery_cycles": 150  # Default reasonable cycle count estimation if unreadable
        }

        try:
            report_path = os.path.join(os.getcwd(), "battery-report.html")
            subprocess.run(
                ["powercfg", "/batteryreport", "/output", report_path],
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10
            )

            if os.path.exists(report_path):
                with open(report_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                design_match = re.search(r"DESIGN CAPACITY.*?([\d,]+)\s*mWh", content, re.IGNORECASE | re.DOTALL)
                full_match = re.search(r"FULL CHARGE CAPACITY.*?([\d,]+)\s*mWh", content, re.IGNORECASE | re.DOTALL)
                cycle_match = re.search(r"CYCLE COUNT.*?([\d,]+)", content, re.IGNORECASE | re.DOTALL)

                if design_match and full_match:
                    design = int(design_match.group(1).replace(",", ""))
                    full = int(full_match.group(1).replace(",", ""))
                    if design > 0:
                        health = min(100.0, max(0.0, (full / design) * 100.0))
                        wear = 100.0 - health
                        result["design_capacity_mwh"] = design
                        result["full_charge_capacity_mwh"] = full
                        result["battery_health"] = round(health, 2)
                        result["battery_wear"] = round(wear, 2)

                if cycle_match and cycle_match.group(1).isdigit():
                    result["battery_cycles"] = int(cycle_match.group(1).replace(",", ""))

        except Exception:
            pass

        return result

    def get_shutdown_count_30d(self) -> int:
        """Counts kernel power crashes (41/6008) in the last 30 days via PowerShell."""
        try:
            ps_script = r"""
            $count41 = (Get-WinEvent -FilterHashtable @{LogName='System'; ID=41; StartTime=(Get-Date).AddDays(-30)} -ErrorAction SilentlyContinue | Measure-Object).Count
            $count6008 = (Get-WinEvent -FilterHashtable @{LogName='System'; ID=6008; StartTime=(Get-Date).AddDays(-30)} -ErrorAction SilentlyContinue | Measure-Object).Count
            Write-Output ($count41 + $count6008)
            """
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=10
            )
            out = res.stdout.strip()
            if out.isdigit():
                return int(out)
        except Exception:
            pass
        return DEFAULT_SHUTDOWN_COUNT

    def get_ssd_health_percent(self) -> float:
        """Queries physical disk status via PowerShell."""
        try:
            ps_script = r"""
            $disks = Get-PhysicalDisk | Select FriendlyName, HealthStatus
            $disks | ConvertTo-Json -Compress
            """
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=10
            )
            out = res.stdout.strip()
            if out:
                disks = json.loads(out)
                if isinstance(disks, dict):
                    disks = [disks]
                scores = []
                for d in disks:
                    st = str(d.get("HealthStatus", "")).lower()
                    if st == "healthy":
                        scores.append(100.0)
                    elif st == "warning":
                        scores.append(70.0)
                    else:
                        scores.append(50.0)
                if scores:
                    return round(sum(scores) / len(scores), 2)
        except Exception:
            pass
        return DEFAULT_SSD_HEALTH

    def get_temperature_from_lhm(self) -> Dict[str, Optional[float]]:
        """Queries LibreHardwareMonitor JSON endpoint."""
        try:
            resp = requests.get(self.lhm_url, timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                temps = []
                self._flatten_lhm_nodes(data, temps)
                if temps:
                    return {
                        "temperature_current": round(temps[0], 2),
                        "temperature_avg": round(sum(temps) / len(temps), 2)
                    }
        except Exception:
            pass
        return {
            "temperature_current": DEFAULT_TEMPERATURE,
            "temperature_avg": DEFAULT_TEMPERATURE
        }

    def _flatten_lhm_nodes(self, node: Any, temps: List[float]):
        if isinstance(node, dict):
            text = str(node.get("Text", "")).lower()
            val = node.get("Value")
            if any(k in text for k in ["cpu package", "cpu core", "package", "core #", "cpu"]):
                if val:
                    m = re.search(r"(-?\d+(\.\d+)?)", str(val))
                    if m:
                        num = float(m.group(1))
                        if 0 < num < 120:
                            temps.append(num)
            for child in node.get("Children", []):
                self._flatten_lhm_nodes(child, temps)
        elif isinstance(node, list):
            for item in node:
                self._flatten_lhm_nodes(item, temps)

    def collect_all(self) -> TelemetryData:
        dev_info = self.get_device_info()
        basic = self.get_basic_metrics()
        wear = self.get_battery_wear()
        temp = self.get_temperature_from_lhm()
        uptime = self.get_uptime_hours()
        shutdowns = self.get_shutdown_count_30d()
        ssd_health = self.get_ssd_health_percent()

        return TelemetryData(
            device_name=dev_info["device_name"],
            device_model=dev_info["device_model"],
            os_name=dev_info["os_name"],
            os_version=dev_info["os_version"],
            manufacturer=dev_info["manufacturer"],
            serial_number=dev_info["serial_number"],
            cpu_usage=basic["cpu_usage"],
            ram_usage=basic["ram_usage"],
            disk_usage=basic["disk_usage"],
            battery_percent=basic["battery_percent"],
            power_plugged=basic["power_plugged"],
            design_capacity_mwh=wear["design_capacity_mwh"],
            full_charge_capacity_mwh=wear["full_charge_capacity_mwh"],
            battery_health=wear["battery_health"],
            battery_wear=wear["battery_wear"],
            battery_cycles=wear["battery_cycles"],
            temperature_current=temp["temperature_current"],
            temperature_avg=temp["temperature_avg"],
            disk_health_status=[{"FriendlyName": "PhysicalDisk0", "HealthStatus": "Healthy"}],
            ssd_health_percent=ssd_health,
            uptime_hours=uptime,
            shutdowns_30d=shutdowns,
            timestamp=datetime.now().isoformat()
        )
