"""
PyInstaller Builder Script for ApexPulse Client Agent.
Compiles agent/client_agent.py into a standalone, zero-dependency ApexPulseAgent.exe binary for Windows devices.
"""

import os
import sys
import subprocess

def build_exe():
    print("=" * 60)
    print("  ApexPulse Standalone EXE Builder")
    print("=" * 60)

    # 1. Install PyInstaller if missing
    try:
        import PyInstaller
    except ImportError:
        print("[+] Installing PyInstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    agent_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client_agent.py")
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=ApexPulseAgent",
        f"--distpath={output_dir}",
        agent_script
    ]

    print(f"[+] Compiling standalone executable from: {agent_script}")
    subprocess.run(cmd, check=True)
    print(f"\n[+] Executable built successfully at: {os.path.join(output_dir, 'ApexPulseAgent', 'ApexPulseAgent.exe')}")

if __name__ == "__main__":
    build_exe()
