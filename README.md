# ApexPulse: Enterprise Laptop Health Management & RUL Life Forecasting System

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost%20ML-orange.svg)](https://xgboost.readthedocs.io/)
[![Firebase](https://img.shields.io/badge/Database-Firebase%20Firestore-FFCA28.svg)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Enterprise-emerald.svg)]()

> **ApexPulse** is a production-ready Predictive Maintenance and Remaining Useful Life (RUL) forecasting platform for enterprise laptop fleets. It combines automated native Windows hardware telemetry collection, an AI Health Scoring Agent, XGBoost machine learning pipeline inference, sub-second real-time Firebase Firestore WebSocket sync (`onSnapshot`), and a modern glassmorphic Next.js web dashboard with multi-user admin authentication.

---

## 📖 Research Specification & Academic Manual
For deep architectural details, mathematical formulations (EDHI and XGBoost equations), complete codebase walkthroughs, and **100 Viva Voce Questions & Detailed Answers**, please see the master research specification file:
👉 **[`overview.md`](file:///d:/Projects/DEMO-For-ML/overview.md)**

---

## 🔐 Enterprise Admin Credentials (5 Accounts)

| Administrator Email | Password | Name | Role |
| :--- | :--- | :--- | :--- |
| `admin@apex.com` | `admin123` | **Dilshan Mindika** | Lead IT Administrator |
| `sysadmin@apex.com` | `sysadmin123` | **Kasun Perera** | System Administrator |
| `security@apex.com` | `security123` | **Nuwan Fernando** | Security Operations |
| `manager@apex.com` | `manager123` | **Chamari Silva** | IT Fleet Manager |
| `support@apex.com` | `support123` | **Pathum Jayawardena** | IT Helpdesk Specialist |

---

## ⚙️ Complete Local Setup & Execution Guide

### 1. Environment Prerequisites
Before setting up ApexPulse locally, ensure your machine has:
- **Operating System**: Windows 10 or 11 (64-bit) for native hardware WMI telemetry collection.
- **Python**: Python 3.10 or higher ([Download Python](https://www.python.org/downloads/)). *Make sure to check "Add Python to PATH" during installation.*
- **Node.js**: Node.js 18.0 or higher ([Download Node.js](https://nodejs.org/)).

---

### 2. Step-by-Step Backend Setup & Library Installation

1. Open your terminal or PowerShell and navigate to the project root directory:
   ```powershell
   cd d:\Projects\DEMO-For-ML
   ```

2. (Optional but Recommended) Create and activate a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. Install required Python packages:
   ```powershell
   pip install -r backend/requirements.txt
   ```
   *Required packages installed:*
   - `flask`, `flask-cors` (REST API Server)
   - `psutil` (System & Process Metrics)
   - `wmi`, `pywin32` (Windows Management Instrumentation - Windows only)
   - `requests` (HTTP Client)
   - `xgboost`, `scikit-learn`, `joblib` (Machine Learning Engine)

4. Test backend imports:
   ```powershell
   python -c "import sys; sys.path.insert(0, 'backend'); from core.collector import HardwareCollector; print('Backend environment verified!')"
   ```

---

### 3. Step-by-Step Frontend Setup & Dependencies Installation

1. Navigate to the `frontend/` directory:
   ```powershell
   cd frontend
   ```

2. Install Node modules:
   ```powershell
   npm install
   ```
   *Required packages installed:*
   - `next`, `react`, `react-dom` (Next.js 16 App Router)
   - `firebase` (Firebase Auth & Firestore Real-Time WebSockets)
   - `lucide-react` (Vector Icon Library)
   - `typescript` (Type Safety Compiler)

3. Verify environment configuration (`frontend/.env.local`):
   Ensure `frontend/.env.local` contains valid Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBtlciNYhSGiAO4npSIaSJYpocEAtPzO5w
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=apex-ml-4b1d9.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=apex-ml-4b1d9
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=apex-ml-4b1d9.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=633780934728
   NEXT_PUBLIC_FIREBASE_APP_ID=1:633780934728:web:53526501757ed9b69d607d
   ```

---

### 4. Running the Local Servers

#### Option A: Run Backend Server (Port 5000)
In Terminal 1 (from project root):
```powershell
python backend/app.py
```
*Output:* `* Running on http://127.0.0.1:5000`

#### Option B: Run Next.js Frontend Development Server (Port 3000)
In Terminal 2 (from `frontend/` directory):
```powershell
cd frontend
npm run dev
```
*Output:* `▲ Next.js 16 (Turbopack) - Ready in http://localhost:3000`

---

### 5. Accessing the Local Dashboard
1. Open your browser and go to **`http://localhost:3000`**.
2. Sign in with any of the 5 admin credentials (e.g. `admin@apex.com` / `admin123`).
3. View real-time hardware telemetry, sparklines, RUL predictions, and What-If simulator.

---

### 6. Installing & Running Remote Client Agent (`.bat` / `.exe`)

To register and monitor a laptop device:

#### Method 1: 1-Click Batch Installer (`.bat`)
- On target Windows laptop, right-click **`Install_ApexPulse_Agent.bat`** (located in `frontend/public/downloads/`) and select **Run as Administrator** (or double-click).
- Installs script to `%APPDATA%\ApexPulseAgent`, registers Windows Startup Registry key, and starts background polling every 30 seconds.

#### Method 2: Standalone Executable (`ApexPulseAgent.exe`)
- Recompile binary if needed:
  ```powershell
  python backend/agent/build_agent_exe.py
  ```
- Double-click **`ApexPulseAgent.exe`**. It executes silently in the background, reporting hardware telemetry to the backend and updating Firebase Firestore in **< 1 second**.

---

## 🚀 Production Deployment Commands

### Deploy Frontend & Backend to Vercel
```powershell
git add .
git commit -m "deploy: production deployment"
git push origin main
```

### Deploy Firebase Security Rules
Deploy updated rules using Firebase CLI or paste into [Firebase Console](https://console.firebase.google.com/u/0/project/apex-ml-4b1d9/firestore/rules):
```powershell
firebase deploy --only firestore:rules
```

---

## 📄 License & Credits
Developed as an Enterprise Academic Research Specification for AI-driven Predictive Maintenance & RUL Life Forecasting.
