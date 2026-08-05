import os
import re
import json
import time
import socket
import psutil
import platform
import requests
import subprocess
from datetime import datetime
import wmi

# =========================
# CONFIG
# =========================
LHM_URL = "http://127.0.0.1:8085/data.json"   # LibreHardwareMonitor web server
OUTPUT_FILE = "device_metrics.json"

# If you later want to send to your server, set:
SERVER_API_URL = None   # Example: "http://192.168.1.10:5000/api/device-metrics"


# =========================
# DEVICE INFO
# =========================
def get_device_info():
    info = {
        "device_name": socket.gethostname(),
        "os": platform.system(),
        "os_version": platform.version(),
        "timestamp": datetime.now().isoformat()
    }

    try:
        c = wmi.WMI()
        system = c.Win32_ComputerSystem()[0]
        bios = c.Win32_BIOS()[0]

        info.update({
            "manufacturer": system.Manufacturer,
            "model": system.Model,
            "serial_number": bios.SerialNumber
        })
    except Exception:
        info.update({
            "manufacturer": None,
            "model": None,
            "serial_number": None
        })

    return info


# =========================
# BASIC SYSTEM METRICS
# =========================
def get_basic_metrics():
    try:
        cpu_usage = psutil.cpu_percent(interval=1)
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


# =========================
# UPTIME
# =========================
def get_uptime_hours():
    try:
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        now = datetime.now()
        uptime = now - boot_time
        return round(uptime.total_seconds() / 3600, 2)
    except Exception:
        return None


# =========================
# BATTERY WEAR / HEALTH
# =========================
def get_battery_wear():
    """
    Generates Windows battery report and parses:
    - DESIGN CAPACITY
    - FULL CHARGE CAPACITY

    Returns:
    design_capacity_mwh
    full_charge_capacity_mwh
    battery_health_percent
    battery_wear_percent
    """
    try:
        report_path = os.path.join(os.getcwd(), "battery-report.html")

        subprocess.run(
            ["powercfg", "/batteryreport", "/output", report_path],
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        if not os.path.exists(report_path):
            return {
                "design_capacity_mwh": None,
                "full_charge_capacity_mwh": None,
                "battery_health_percent": None,
                "battery_wear_percent": None
            }

        with open(report_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # Works with values like 57,000 mWh
        design_match = re.search(r"DESIGN CAPACITY.*?([\d,]+)\s*mWh", content, re.IGNORECASE | re.DOTALL)
        full_match = re.search(r"FULL CHARGE CAPACITY.*?([\d,]+)\s*mWh", content, re.IGNORECASE | re.DOTALL)

        if design_match and full_match:
            design = int(design_match.group(1).replace(",", ""))
            full = int(full_match.group(1).replace(",", ""))

            if design > 0:
                health = (full / design) * 100
                wear = 100 - health
            else:
                health = None
                wear = None

            return {
                "design_capacity_mwh": design,
                "full_charge_capacity_mwh": full,
                "battery_health_percent": round(health, 2) if health is not None else None,
                "battery_wear_percent": round(wear, 2) if wear is not None else None
            }

        return {
            "design_capacity_mwh": None,
            "full_charge_capacity_mwh": None,
            "battery_health_percent": None,
            "battery_wear_percent": None
        }

    except Exception:
        return {
            "design_capacity_mwh": None,
            "full_charge_capacity_mwh": None,
            "battery_health_percent": None,
            "battery_wear_percent": None
        }


# =========================
# SHUTDOWN COUNT (LAST 30 DAYS)
# =========================
def get_shutdown_count_30d():
    """
    Counts unexpected shutdown-related events.
    Using Event IDs:
    - 41  (Kernel-Power)
    - 6008 (unexpected shutdown)
    """
    try:
        ps_script = r"""
        $count41 = (Get-WinEvent -FilterHashtable @{LogName='System'; ID=41; StartTime=(Get-Date).AddDays(-30)} -ErrorAction SilentlyContinue | Measure-Object).Count
        $count6008 = (Get-WinEvent -FilterHashtable @{LogName='System'; ID=6008; StartTime=(Get-Date).AddDays(-30)} -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Output ($count41 + $count6008)
        """

        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True
        )

        output = result.stdout.strip()
        return int(output) if output.isdigit() else None

    except Exception:
        return None


# =========================
# DISK HEALTH STATUS
# =========================
def get_disk_health():

    try:

        ps_script = r"""
        $disks = Get-PhysicalDisk | Select-Object FriendlyName, HealthStatus
        $disks | ConvertTo-Json -Compress
        """

        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True
        )

        output = result.stdout.strip()

        if not output:
            return {"disk_health_status": None}

        data = json.loads(output)

        if isinstance(data, dict):
            data = [data]

        statuses = []

        for d in data:

            statuses.append({
                "disk_name": d.get("FriendlyName"),
                "health_status": d.get("HealthStatus")
            })

        return {
            "disk_health_status": statuses
        }

    except Exception:

        return {
            "disk_health_status": None
        }


# =========================
# SSD HEALTH %
# =========================
def get_ssd_health_percent():

    try:

        ps_script = r"""
        $disks = Get-PhysicalDisk | Select FriendlyName, HealthStatus
        $disks | ConvertTo-Json -Compress
        """

        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_script],
            capture_output=True,
            text=True
        )

        output = result.stdout.strip()

        if not output:
            return None

        disks = json.loads(output)

        if isinstance(disks, dict):
            disks = [disks]

        scores = []

        for disk in disks:

            status = str(
                disk.get(
                    "HealthStatus",
                    ""
                )
            ).lower()

            if status == "healthy":
                scores.append(100)

            elif status == "warning":
                scores.append(70)

            else:
                scores.append(50)

        return round(
            sum(scores) / len(scores),
            2
        )

    except Exception:
        return None
# =========================
# TEMPERATURE FROM LIBREHARDWAREMONITOR
# =========================
def flatten_lhm_nodes(node, results):
    """
    Recursively flatten LibreHardwareMonitor JSON tree.
    We look for nodes that carry sensor values.
    """
    if isinstance(node, dict):
        entry = {
            "text": node.get("Text"),
            "value": node.get("Value"),
            "id": node.get("id")
        }
        if entry["text"] is not None or entry["value"] is not None:
            results.append(entry)

        children = node.get("Children", [])
        if isinstance(children, list):
            for child in children:
                flatten_lhm_nodes(child, results)

    elif isinstance(node, list):
        for item in node:
            flatten_lhm_nodes(item, results)


def extract_number(value_text):
    if not value_text:
        return None
    match = re.search(r"(-?\d+(\.\d+)?)", str(value_text))
    return float(match.group(1)) if match else None


def get_temperature_from_lhm():
    """
    Requires LibreHardwareMonitor running with Web Server enabled.
    Tries to extract CPU temperature values and return:
    - cpu_temperature_current
    - cpu_temperature_avg
    """
    try:
        resp = requests.get(LHM_URL, timeout=3)
        resp.raise_for_status()
        data = resp.json()

        flat = []
        flatten_lhm_nodes(data, flat)

        cpu_temps = []

        for item in flat:
            text = str(item.get("text", "")).lower()
            value = item.get("value")

            # Look for temperature sensors likely related to CPU/package/core
            if any(k in text for k in ["cpu package", "cpu core", "package", "core #", "cpu"]):
                num = extract_number(value)
                if num is not None and 0 < num < 120:
                    cpu_temps.append(num)

        if cpu_temps:
            return {
                "cpu_temperature_current": round(cpu_temps[0], 2),
                "cpu_temperature_avg": round(sum(cpu_temps) / len(cpu_temps), 2)
            }

        return {
            "cpu_temperature_current": None,
            "cpu_temperature_avg": None
        }

    except Exception:
        return {
            "cpu_temperature_current": None,
            "cpu_temperature_avg": None
        }


# =========================
# SAVE JSON
# =========================
def save_to_json(data, filename=OUTPUT_FILE):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


# =========================
# OPTIONAL: SEND TO SERVER
# =========================
def send_to_server(data):
    if not SERVER_API_URL:
        return {"sent": False, "reason": "SERVER_API_URL not configured"}

    try:
        resp = requests.post(SERVER_API_URL, json=data, timeout=5)
        return {
            "sent": True,
            "status_code": resp.status_code,
            "response": resp.text
        }
    except Exception as e:
        return {
            "sent": False,
            "reason": str(e)
        }


# =========================
# MAIN COLLECTOR
# =========================
def collect_data():
    data = {}

    data.update(get_device_info())
    data.update(get_basic_metrics())

    data["uptime_hours"] = get_uptime_hours()
    data["shutdowns_30d"] = get_shutdown_count_30d()

    data.update(get_battery_wear())
    data.update(get_temperature_from_lhm())
    data.update(get_disk_health())
    data["ssd_health_percent"] = get_ssd_health_percent()
    return data


if __name__ == "__main__":
    metrics = collect_data()

    print("\nCollected Device Data:\n")
    print(json.dumps(metrics, indent=4))

    save_to_json(metrics)

    # Optional: send to server
    # result = send_to_server(metrics)
    # print("\nServer Upload Result:\n", json.dumps(result, indent=4))