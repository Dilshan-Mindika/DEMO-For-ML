# ApexPulse: Enterprise Laptop Lifecycle & RUL Prediction Dashboard

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost%20ML-orange.svg)](https://xgboost.readthedocs.io/)
[![License](https://img.shields.io/badge/License-Enterprise-emerald.svg)]()

> **ApexPulse** is an end-to-end Enterprise Laptop Predictive Maintenance and Remaining Useful Life (RUL) forecasting platform. It combines automated Windows hardware telemetry collection, an AI Health Scoring Agent, XGBoost machine learning pipeline inference, component-level maintenance simulation, and a modern glassmorphic Next.js web dashboard.

---

## 🏗️ Project Architecture & Directory Structure

The repository is organized into **two primary top-level folders**:

```
DEMO For ML/
├── backend/                  # Python Flask REST API & OOP Core Intelligence
│   ├── app.py                # Flask REST API endpoints (CORS enabled on port 5000)
│   ├── config.py             # Global configuration, fallback defaults, and RUL thresholds
│   ├── models/
│   │   └── telemetry_schema.py # Dataclasses for Telemetry, ML Payload, & Predictions
│   ├── core/
│   │   ├── collector.py      # HardwareCollector OOP (WMI, psutil, PowerCfg, Event Logs, LHM)
│   │   ├── agent.py          # DeviceHealthAgent OOP (Usage Profile, Performance, EDHI)
│   │   ├── model_service.py  # LifecyclePredictor OOP (XGBoost RUL Model Inference)
│   │   └── component_manager.py # ComponentMaintenanceManager (Battery/SSD replacement resets)
│   └── tests/
│       └── test_pipeline.py  # Automated Unit Test Suite
│
├── frontend/                 # Next.js 15 Web Dashboard Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # Main Dashboard Component (React, Lucide Icons, Glassmorphism)
│   │   │   ├── layout.tsx    # Root layout with Inter & Outfit fonts
│   │   │   └── globals.css   # Dark theme Tailwind styling & glassmorphism tokens
│   │   └── package.json      # Node dependencies (Next.js, React, TailwindCSS, Lucide)
│   └── ...
│
├── xgboost_rul_model.pkl     # Trained Scikit-Learn + XGBoost RUL Prediction Pipeline
├── LibreHardwareMonitor-net472/ # Windows Sensor Web API Server (HTTP 127.0.0.1:8085)
└── README.md                 # System Documentation
```

---

## ⚡ Key Features

### 1. Automatic Hardware Telemetry Collection
- **Device Model & OS:** WMI queries for Manufacturer, Model (`Win32_ComputerSystem`), and Serial Number (`Win32_BIOS`).
- **Battery Health & Wear:** Windows `powercfg /batteryreport` parser capturing Design Capacity (mWh), Full Charge Capacity (mWh), Health %, and Cycle Count.
- **SSD Storage Health:** PowerShell `Get-PhysicalDisk` inspector retrieving physical disk status.
- **Thermal Sensors:** Real-time CPU Core/Package temperatures extracted from LibreHardwareMonitor (`http://127.0.0.1:8085/data.json`).
- **Kernel Crashes:** PowerShell `Get-WinEvent` tracking Event IDs **41** (Kernel-Power) & **6008** (Unexpected Shutdowns) over the last 30 days.

### 2. AI Agent Health Calculations
- **Automatic Usage Profile Classifier:**
  - `< 5 hours/day` ➡️ `Light`
  - `5 – 8 hours/day` ➡️ `Normal`
  - `> 8 hours/day` ➡️ `Heavy`
- **Performance Score (0 – 100):** Multi-factor composite score evaluating CPU, RAM, and Disk load contention.
- **Enterprise Device Health Index (EDHI) (0 – 100):** Holistic index weighing battery health (25%), SSD health (25%), thermal stress (20%), crash logs (15%), and performance (15%).

### 3. Machine Learning RUL Prediction (XGBoost)
Pushes a structured 11-feature vector into `xgboost_rul_model.pkl`:
- `device_model`, `usage_profile`, `age`, `usage_hours`, `battery_cycles`, `battery_health`, `ssd_health`, `temperature`, `performance_score`, `shutdown_count`, `edhi`.

**Recommendation Decision Rules:**
| Predicted RUL (Months) | Status Level | Recommendation Category | Color Code |
| :--- | :--- | :--- | :--- |
| **> 36 Months** | `healthy` | **Healthy Device** | `#10B981` (Green) |
| **24 – 36 Months** | `monitor` | **Monitor Device** | `#3B82F6` (Blue) |
| **12 – 24 Months** | `plan_replacement` | **Plan Replacement** | `#F59E0B` (Orange) |
| **< 12 Months** | `replace_soon` | **Replace Soon** | `#EF4444` (Red) |

### 4. Component-Level Maintenance Simulation
Simulates part replacements (e.g. Battery replacement resetting health to 100% and cycles to 0, SSD replacement, or full refurbish) while **preserving historical device age and usage logs**, allowing IT administrators to evaluate instantaneous RUL extension.

---

## 🛠️ Installation & Setup Instructions

### Prerequisites
- **Python 3.10+**
- **Node.js v18+** and **npm**
- **Windows OS** (for native WMI, PowerCfg, and Event Log sensors)

---

### Step 1: Start the Backend API (Python)

1. Open PowerShell or Command Prompt in the project root:
```powershell
# Install Python dependencies
python -m pip install flask flask-cors psutil wmi requests joblib scikit-learn xgboost pandas
```

2. Start the Flask REST API server:
```powershell
python backend/app.py
```
- The backend API will start at **`http://127.0.0.1:5000`**.

---

### Step 2: Start the Next.js Frontend Dashboard

1. Open a new terminal in the `frontend/` directory:
```powershell
cd frontend

# Install Node dependencies (if not already installed)
npm install

# Start the Next.js development server
npm run dev
```
- The Next.js dashboard will be live at **`http://localhost:3000`**.

---

## 🧪 Running Automated Unit Tests

To verify backend telemetry collection, usage profile classification, EDHI calculation, and model prediction logic:

```powershell
python -m unittest discover -s backend/tests -p "test_*.py"
```

---

## 📡 REST API Documentation

### `POST /api/predict`
Calculates real-time telemetry, runs AI agent scoring, and returns XGBoost RUL prediction.
- **Request Body:** `{"age": 24, "daily_usage": 6.5}`
- **Response:**
```json
{
  "prediction": {
    "rul_months": 28.53,
    "recommendation": "Monitor Device",
    "status_level": "monitor",
    "status_color": "#3B82F6",
    "ml_input": {
      "device_model": "Dell XPS 15",
      "usage_profile": "Normal",
      "age": 24,
      "usage_hours": 4680,
      "battery_cycles": 280,
      "battery_health": 85.5,
      "ssd_health": 92.0,
      "temperature": 52.4,
      "performance_score": 88.0,
      "shutdown_count": 1,
      "edhi": 84.2
    }
  }
}
```

### `POST /api/simulate-maintenance`
Applies component-level resets and returns updated RUL prediction.
- **Request Body:** `{"action": "replace_battery", "ml_input": {...}}`
