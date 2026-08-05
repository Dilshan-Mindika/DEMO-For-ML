import os
import sys
import time
import subprocess
import webbrowser

from backend.config import LHM_EXE, LHM_URL
from backend.app import app

def is_lhm_running() -> bool:
    try:
        import psutil
        for proc in psutil.process_iter(['name']):
            if proc.info['name'] and 'librehardwaremonitor' in proc.info['name'].lower():
                return True
    except Exception:
        pass
    return False

def start_lhm():
    if not is_lhm_running() and os.path.exists(LHM_EXE):
        print(f"[+] Starting LibreHardwareMonitor background service from: {LHM_EXE}")
        try:
            subprocess.Popen([LHM_EXE], creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            time.sleep(2)
        except Exception as e:
            print(f"[!] Warning: Could not auto-start LibreHardwareMonitor: {e}")
    elif is_lhm_running():
        print("[+] LibreHardwareMonitor service is already active.")

def main():
    print("=" * 70)
    print("  APEXPULSE: Enterprise Laptop Lifecycle & RUL Prediction System")
    print("=" * 70)

    # 1. Start LibreHardwareMonitor if present
    start_lhm()

    # 2. Open dashboard in default browser
    url = "http://127.0.0.1:5000"
    print(f"[+] Launching Enterprise Dashboard at: {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass

    # 3. Start Flask REST Server
    app.run(host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    main()
