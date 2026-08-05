# ApexPulse: Enterprise Laptop Lifecycle & RUL Prediction System

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost%20ML-orange.svg)](https://xgboost.readthedocs.io/)
[![License](https://img.shields.io/badge/License-Enterprise-emerald.svg)]()

> **ApexPulse** is an end-to-end Enterprise Laptop Predictive Maintenance and Remaining Useful Life (RUL) forecasting platform. It combines automated Windows hardware telemetry collection, an AI Health Scoring Agent, XGBoost machine learning pipeline inference, component-level maintenance simulation, and a modern glassmorphic Next.js web dashboard with multi-user static admin authentication.

---

## 🔐 Enterprise Admin Login Credentials (5 Accounts)

The dashboard includes a glassmorphic authentication system supporting 5 hardcoded administrator accounts:

| Administrator Email | Password | Name | Role |
| :--- | :--- | :--- | :--- |
| `admin@apex.com` | `admin123` | **Dilshan Mindika** | Lead IT Administrator |
| `sysadmin@apex.com` | `sysadmin123` | **Kasun Perera** | System Administrator |
| `security@apex.com` | `security123` | **Nuwan Fernando** | Security Operations |
| `manager@apex.com` | `manager123` | **Chamari Silva** | IT Fleet Manager |
| `support@apex.com` | `support123` | **Pathum Jayawardena** | IT Helpdesk Specialist |

---

## 🏗️ Industrial Project Structure

The project strictly follows industrial repository standards:

```
DEMO For ML/
├── backend/                     # Python REST API & Core ML Intelligence
│   ├── app.py                   # Flask REST API server (CORS enabled on port 5000)
│   ├── config.py                # Configuration paths & RUL thresholds
│   ├── models/                  # Dataclasses & Trained ML Artifacts
│   │   ├── telemetry_schema.py  # TelemetryData, MLInputSchema, PredictionResult
│   │   └── xgboost_rul_model.pkl # Trained XGBoost RUL Prediction Model Pipeline
│   ├── core/                    # OOP Intelligence Modules
│   │   ├── collector.py         # HardwareCollector (WMI, psutil, PowerCfg, Event Logs, LHM)
│   │   ├── agent.py             # DeviceHealthAgent (Usage Profile, Performance Score, EDHI)
│   │   ├── model_service.py     # LifecyclePredictor (XGBoost RUL Model Inference)
│   │   ├── component_manager.py # ComponentMaintenanceManager (Battery & SSD replacements)
│   │   └── fleet_manager.py     # FleetManager (Multi-Device Inventory Tracking)
│   └── tests/                   # Automated Unit Test Suite
│       └── test_pipeline.py     # Pipeline Unit Tests
│
├── frontend/                    # Next.js 15 Web Dashboard Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main Dashboard & Login View (React, TypeScript)
│   │   │   ├── auth.ts          # Static 5-User Admin Authentication Module
│   │   │   ├── layout.tsx       # Root layout with fonts
│   │   │   └── globals.css      # Dark theme Tailwind styling & glassmorphism tokens
│   │   └── package.json         # Node dependencies
│   └── ...
│
├── agent/                       # Client Agent & 1-Click Installer Package
│   ├── client_agent.py          # Standalone Python telemetry agent
│   ├── Install_ApexPulse_Agent.bat # Double-clickable 1-Click Windows Startup Installer
│   └── build_agent_exe.py       # PyInstaller standalone EXE compiler
│
├── .gitignore                   # Workspace Git Ignore Rules
└── README.md                    # System Documentation
```

---

## ⚡ Key Features

### 1. 1-Click Double-Click Client Agent Installation
Target employee laptops can be configured in seconds without running PowerShell commands:
- Simply double-click **[`agent/Install_ApexPulse_Agent.bat`](file:///c:/Users/Dilshan%20Mindika/Downloads/DEMO%20For%20ML/agent/Install_ApexPulse_Agent.bat)**.
- Copies the agent to `%AppData%\ApexPulseAgent` and registers it in **Windows Registry Startup** (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\ApexPulseAgent`).
- The agent launches automatically on Windows startup and POSTs hardware metrics to the central server every 30 minutes.

### 2. Multi-Device Enterprise Fleet Inventory
- Central Fleet Manager (`backend/core/fleet_manager.py`) tracks all connected laptops by Serial Number and Hostname.
- Next.js dashboard includes a **Device Selector Dropdown** allowing IT administrators to switch telemetry views across employee laptops in real time.

### 3. AI Health Scoring & XGBoost RUL Prediction
- Evaluates Usage Profile (`Light`, `Normal`, `Heavy`), Performance Score (0-100), and Enterprise Device Health Index (EDHI) (0-100).
- Predicts Remaining Useful Life in months and maps recommendation badges (`Healthy Device`, `Monitor Device`, `Plan Replacement`, `Replace Soon`).

---

## 🛠️ Quick Start Guide

### Step 1: Start Backend API (Port 5000)
```powershell
python backend/app.py
```

### Step 2: Start Next.js Frontend (Port 3000)
```powershell
cd frontend
npm run dev
```

### Step 3: Log In to Dashboard
1. Open **`http://localhost:3000`** in your browser.
2. Sign in using any of the 5 admin accounts (e.g. `admin@apex.com` / `admin123` for **Dilshan Mindika**).
