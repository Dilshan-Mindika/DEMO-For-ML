"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  HardDrive,
  Battery,
  Thermometer,
  AlertTriangle,
  RotateCw,
  Wrench,
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Users,
  ChevronDown,
  Mail,
  Lock,
  LogOut,
  Sun,
  Moon,
  Sliders,
  Download,
  Zap,
  PieChart,
  BarChart3,
  X,
  Menu,
  Flame,
  Database,
  CheckCircle2
} from "lucide-react";
import { authenticateUserWithFirebase, UserAccount, HARDCODED_ADMIN_USERS } from "./auth";
import {
  saveDeviceTelemetryHistory,
  fetchDeviceHistory,
  saveMaintenanceLog,
  fetchMaintenanceLogs,
  syncDeviceToFirestore,
  fetchFirestoreDevices,
  TelemetryHistoryRecord,
  MaintenanceLogRecord,
  FirestoreDeviceRecord
} from "./firebase";

interface TelemetryData {
  device_name: string;
  device_model: string;
  os_name: string;
  os_version: string;
  manufacturer: string;
  serial_number: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  battery_percent: number;
  power_plugged: boolean;
  design_capacity_mwh?: number;
  full_charge_capacity_mwh?: number;
  battery_health: number;
  battery_wear: number;
  battery_cycles: number;
  temperature_current: number;
  temperature_avg: number;
  ssd_health_percent: number;
  ram_modules?: { bank: string; capacity_gb: number; speed_mhz?: number; manufacturer?: string }[];
  storage_drives?: { name: string; media_type: string; size_gb: number; health_status: string; health_percent: number }[];
  uptime_hours: number;
  shutdowns_30d: number;
  timestamp: string;
}

interface MLInputSchema {
  device_model: string;
  usage_profile: string;
  age: number;
  usage_hours: number;
  battery_cycles: number;
  battery_health: number;
  ssd_health: number;
  temperature: number;
  performance_score: number;
  shutdown_count: number;
  edhi: number;
}

interface PredictionResult {
  rul_months: number;
  recommendation: string;
  status_level: string;
  status_color: string;
  ml_input: MLInputSchema;
  timestamp: string;
}

interface DeviceSummary {
  device_id: string;
  device_name: string;
  device_model: string;
  manufacturer: string;
  serial_number: string;
  last_seen: string;
  rul_months: number;
  recommendation: string;
  status_level: string;
  status_color: string;
  battery_health: number;
  ssd_health: number;
  edhi: number;
}

interface FleetSummary {
  total_devices: number;
  healthy_count: number;
  monitor_count: number;
  replacement_count: number;
  avg_rul_months: number;
  avg_edhi: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://apex-ml-back.vercel.app";

// Simple SVG Donut/Pie Chart Component
const SimplePieChartCard = ({
  title,
  value,
  label,
  percent,
  color,
  subtext
}: {
  title: string;
  value: string;
  label: string;
  percent: number;
  color: string;
  subtext: string;
}) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="glass-card p-5 flex flex-col justify-between items-center text-center">
      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">{title}</span>
      <div className="relative w-28 h-28 flex items-center justify-center my-1">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} stroke="var(--bg-input)" strokeWidth="10" fill="transparent" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-bold font-outfit text-[var(--text-heading)]">{value}</span>
          <span className="text-[10px] text-[var(--text-secondary)] font-medium">{label}</span>
        </div>
      </div>
      <span className="text-xs text-[var(--text-muted)] mt-2 font-medium">{subtext}</span>
    </div>
  );
};

export default function DashboardPage() {
  // Theme State (Dark by default)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Navigation State: 'telemetry' | 'firebase_history' | 'cpu_ram' | 'thermal_logs' | 'battery' | 'storage' | 'explainability' | 'maintenance'
  const [activeTab, setActiveTab] = useState<string>("telemetry");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("apex_user");
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dismissed Alert Banner State
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});

  // Dashboard Data State
  const [data, setData] = useState<{ telemetry: TelemetryData; prediction: PredictionResult } | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [devicesList, setDevicesList] = useState<DeviceSummary[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [manualAge, setManualAge] = useState<number>(24);
  const [dailyUsage, setDailyUsage] = useState<number>(6.5);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("local");

  // What-If Interactive Sensitivity State
  const [simAge, setSimAge] = useState<number>(24);
  const [simCycles, setSimCycles] = useState<number>(250);
  const [simBatHealth, setSimBatHealth] = useState<number>(85);
  const [simSSDHealth, setSimSSDHealth] = useState<number>(90);

  // Firestore Database Records State
  const [firestoreHistory, setFirestoreHistory] = useState<TelemetryHistoryRecord[]>([]);
  const [firestoreMaintenanceLogs, setFirestoreMaintenanceLogs] = useState<MaintenanceLogRecord[]>([]);
  const [firestoreDevices, setFirestoreDevices] = useState<FirestoreDeviceRecord[]>([]);
  const [loadingFirestore, setLoadingFirestore] = useState<boolean>(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const user = await authenticateUserWithFirebase(loginEmail, loginPassword);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem("apex_user", JSON.stringify(user));
        fetchPrediction(true);
      } else {
        setAuthError("Incorrect email or password. Please try again.");
      }
    } catch (err: any) {
      setAuthError(err?.message || "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("apex_user");
  };

  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices`);
      if (res.ok) {
        const json = await res.json();
        setFleetSummary(json.summary);
        setDevicesList(json.devices);
      }
    } catch (_e) {
      console.error("Fleet fetch error:", _e);
    }
  }, []);

  const fetchPrediction = useCallback(async (showSpinner = false, age = manualAge, usage = dailyUsage) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      let endpoint = `${API_BASE_URL}/api/predict`;
      let options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, daily_usage: usage }),
      };

      if (selectedDeviceId !== "local") {
        endpoint = `${API_BASE_URL}/api/devices/${encodeURIComponent(selectedDeviceId)}`;
        options = { method: "GET" };
      }

      const res = await fetch(endpoint, options);
      if (!res.ok) throw new Error(`Backend API Error: ${res.statusText}`);

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setData({ telemetry: json.telemetry, prediction: json.prediction });
      setLastUpdatedTime(new Date().toLocaleTimeString());

      if (json.prediction.ml_input) {
        const ml = json.prediction.ml_input;
        setSimAge(ml.age);
        setSimCycles(ml.battery_cycles);
        setSimBatHealth(ml.battery_health);
        setSimSSDHealth(ml.ssd_health);
      }

      // Sync snapshot to Firebase Firestore DB in background
      saveDeviceTelemetryHistory(selectedDeviceId, json.telemetry, json.prediction);

      fetchFleet();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Unable to connect to laptop monitoring server.";
      setError(msg);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [manualAge, dailyUsage, selectedDeviceId, fetchFleet]);

  const loadFirestoreData = useCallback(async () => {
    setLoadingFirestore(true);
    try {
      const [hist, logs, devs] = await Promise.all([
        fetchDeviceHistory(selectedDeviceId === "local" ? undefined : selectedDeviceId, 30),
        fetchMaintenanceLogs(30),
        fetchFirestoreDevices()
      ]);
      setFirestoreHistory(hist);
      setFirestoreMaintenanceLogs(logs);
      setFirestoreDevices(devs);
    } catch (err) {
      console.error("Firestore history load error:", err);
    } finally {
      setLoadingFirestore(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (activeTab === "firebase_history") {
      loadFirestoreData();
    }
  }, [activeTab, loadFirestoreData]);

  const selectDevice = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setLoading(true);
    setError(null);
    try {
      let endpoint = `${API_BASE_URL}/api/predict`;
      let options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: manualAge, daily_usage: dailyUsage }),
      };

      if (deviceId !== "local") {
        endpoint = `${API_BASE_URL}/api/devices/${encodeURIComponent(deviceId)}`;
        options = { method: "GET" };
      }

      const res = await fetch(endpoint, options);
      if (!res.ok) {
        const fallbackRes = await fetch(`${API_BASE_URL}/api/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ age: manualAge, daily_usage: dailyUsage }),
        });
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          setData({ telemetry: fallbackJson.telemetry, prediction: fallbackJson.prediction });
          setLastUpdatedTime(new Date().toLocaleTimeString());
          return;
        }
        throw new Error("Unable to load device details.");
      }

      const json = await res.json();
      if (json.telemetry && json.prediction) {
        setData({ telemetry: json.telemetry, prediction: json.prediction });
        setLastUpdatedTime(new Date().toLocaleTimeString());

        // Sync to Firebase Firestore DB
        saveDeviceTelemetryHistory(deviceId, json.telemetry, json.prediction);
        syncDeviceToFirestore(json);
      }
    } catch (err: unknown) {
      console.error("Device selection error:", err);
      const msg = err instanceof Error ? err.message : "Device details update failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerMaintenance = async (action: string) => {
    if (!data?.prediction.ml_input) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/simulate-maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ml_input: data.prediction.ml_input,
        }),
      });

      if (!res.ok) throw new Error("Maintenance simulation failed");
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setData((prev) =>
        prev
          ? {
              ...prev,
              prediction: result.prediction,
            }
          : null
      );

      // Log maintenance action to Firebase Firestore DB
      saveMaintenanceLog(selectedDeviceId, action, result.prediction);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Maintenance simulation error";
      alert(`Maintenance Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Automated 5-Second Silent Real-Time Hardware Polling Across All Tabs
  useEffect(() => {
    if (!currentUser) return;

    fetchPrediction(true);

    const intervalId = setInterval(() => {
      fetchPrediction(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentUser, fetchPrediction]);

  // Render Login View if unauthenticated
  if (!currentUser) {
    return (
      <div className={`min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] ${isDarkMode ? "dark-mode" : "light-mode"} flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300`}>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md glass-card p-8 relative z-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/40 mx-auto mb-4 p-1.5 border border-blue-400/50 backdrop-blur-md">
              <img src="/icon.png" alt="ApexPulse Official Logo" className="w-full h-full object-contain rounded-xl drop-shadow-lg" />
            </div>
            <h1 className="text-2xl font-bold font-outfit text-[var(--text-heading)]">ApexPulse Enterprise</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Smart Laptop Life & Health Monitoring Portal (Firebase Auth)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-blue-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="admin@apex.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-indigo-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <RotateCw className="w-4 h-4 animate-spin text-white" /> : <Flame className="w-4 h-4 text-amber-400" />}
              <span>Sign In with Firebase Auth</span>
            </button>

            <div className="pt-4 border-t border-[var(--border-card)] text-center space-y-2">
              <p className="text-xs text-[var(--text-secondary)] font-medium">Desktop Telemetry Agent Management</p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href="/ApexPulseAgent.exe"
                  download="ApexPulseAgent.exe"
                  className="bg-[var(--bg-input)] hover:bg-emerald-500/10 border border-[var(--border-input)] hover:border-emerald-500/50 text-emerald-400 font-semibold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-[1.01]"
                  title="Download Windows Agent Executable"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Install (.exe)
                </a>
                <a
                  href="/downloads/Install_ApexPulse_Agent.bat"
                  download="Install_ApexPulse_Agent.bat"
                  className="bg-[var(--bg-input)] hover:bg-blue-500/10 border border-[var(--border-input)] hover:border-blue-500/50 text-blue-400 font-semibold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-[1.01]"
                  title="Download Install Script"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Install (.bat)
                </a>
                <a
                  href="/downloads/Uninstall_ApexPulse_Agent.bat"
                  download="Uninstall_ApexPulse_Agent.bat"
                  className="bg-[var(--bg-input)] hover:bg-rose-500/10 border border-[var(--border-input)] hover:border-rose-500/50 text-rose-400 font-semibold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all hover:scale-[1.01]"
                  title="Download Uninstaller Script"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  Uninstall (.bat)
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const prediction = data?.prediction;
  const telemetry = data?.telemetry;
  const mlInput = prediction?.ml_input;

  // Simple human recommendation titles
  const getSimpleRecommendationText = (rec: string = "") => {
    if (rec.includes("Healthy") || rec.includes("Good")) return "Laptop in Good Condition";
    if (rec.includes("Monitor")) return "Keep an Eye on Performance";
    if (rec.includes("Replacement") || rec.includes("Replace")) return "Plan to Replace or Fix Component";
    return rec || "Analyzing Status";
  };

  const getStatusBadge = (level: string = "healthy") => {
    switch (level) {
      case "healthy":
        return {
          icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
          color: "#10B981",
          bg: "rgba(16, 185, 129, 0.15)",
        };
      case "monitor":
        return {
          icon: <Eye className="w-6 h-6 text-blue-400" />,
          color: "#3B82F6",
          bg: "rgba(59, 130, 246, 0.15)",
        };
      case "plan_replacement":
        return {
          icon: <Clock className="w-6 h-6 text-amber-400" />,
          color: "#F59E0B",
          bg: "rgba(245, 158, 11, 0.15)",
        };
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-rose-400" />,
          color: "#EF4444",
          bg: "rgba(239, 68, 68, 0.15)",
        };
    }
  };

  const badge = getStatusBadge(prediction?.status_level);

  // Dynamic Real-Time Health & Safety Alerts
  const alertsList: { id: string; type: "danger" | "warning" | "info"; title: string; message: string }[] = [];

  if (telemetry?.temperature_current && telemetry.temperature_current > 70) {
    alertsList.push({
      id: "overheat",
      type: "danger",
      title: "Laptop Overheating Alert",
      message: `Your laptop temperature is high (${telemetry.temperature_current.toFixed(1)}°C). Make sure fan vents are not blocked!`,
    });
  }

  if (telemetry?.cpu_usage && telemetry.cpu_usage > 85) {
    alertsList.push({
      id: "cpu_overload",
      type: "warning",
      title: "High Processor Workload",
      message: `Processor usage is heavy (${telemetry.cpu_usage.toFixed(1)}%). Close unnecessary apps to speed up your laptop.`,
    });
  }

  if (telemetry?.ram_usage && telemetry.ram_usage > 90) {
    alertsList.push({
      id: "ram_full",
      type: "warning",
      title: "Memory Nearly Full",
      message: `System memory usage is at ${telemetry.ram_usage.toFixed(1)}%. Performance may slow down.`,
    });
  }

  if (mlInput?.battery_health && mlInput.battery_health < 50) {
    alertsList.push({
      id: "weak_battery",
      type: "warning",
      title: "Weak Battery Life",
      message: `Battery health has dropped to ${mlInput.battery_health.toFixed(1)}%. Replacing battery will extend laptop life.`,
    });
  }

  if (mlInput?.shutdown_count && mlInput.shutdown_count > 2) {
    alertsList.push({
      id: "crashes",
      type: "danger",
      title: "Unexpected Shutdowns Recorded",
      message: `${mlInput.shutdown_count} unexpected laptop crashes recorded in the last 30 days.`,
    });
  }

  const adminAccountsList = Object.values(HARDCODED_ADMIN_USERS).map((item) => item.user);

  return (
    <div className={`flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] ${isDarkMode ? "dark-mode" : "light-mode"} transition-colors duration-300`}>
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Mobile Drawer Slide-In Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg-sidebar)] border-r border-[var(--border-card)] p-6 flex flex-col justify-between shadow-2xl transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden p-1 border border-blue-400/40">
                <img src="/icon.png" alt="ApexPulse Logo" className="w-full h-full object-contain rounded-lg" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight font-outfit text-[var(--text-heading)]">ApexPulse</h2>
                <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold block">
                  Firebase Connected
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {[
              { id: "telemetry", label: "Overview & Life Forecast", icon: <Activity className="w-4 h-4" /> },
              { id: "firebase_history", label: "🔥 Firebase Device History", icon: <Database className="w-4 h-4 text-amber-400" /> },
              { id: "cpu_ram", label: "Processor & Memory Speed", icon: <Cpu className="w-4 h-4" /> },
              { id: "thermal_logs", label: "Temperature & Crashes", icon: <Thermometer className="w-4 h-4" /> },
              { id: "battery", label: "Battery Life & Power", icon: <Battery className="w-4 h-4" /> },
              { id: "storage", label: "Storage & Hard Drive", icon: <HardDrive className="w-4 h-4" /> },
              { id: "explainability", label: "What Affects Laptop Life", icon: <Sliders className="w-4 h-4" /> },
              { id: "maintenance", label: "Fix & Upgrade Guide", icon: <Wrench className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-[var(--border-card)] space-y-4">
          <div className="flex items-center justify-between bg-[var(--bg-input)] p-2.5 rounded-xl border border-[var(--border-input)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              {isDarkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {isDarkMode ? "Dark Mode" : "Light Mode"}
            </span>
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative flex items-center border ${
                isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-200 border-slate-300"
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full shadow-sm transition-transform duration-200 ${
                  isDarkMode ? "bg-blue-500 translate-x-4.5" : "bg-slate-500 translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="bg-[var(--bg-input)] border border-[var(--border-input)] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center font-bold text-xs text-white`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <strong className="block text-xs font-semibold truncate text-[var(--text-heading)]">{currentUser.name}</strong>
                <small className="text-[10px] text-amber-400 font-semibold block truncate">Firebase Auth • {currentUser.role}</small>
              </div>
            </div>
            <button onClick={handleLogout} title="Logout" className="text-[var(--text-muted)] hover:text-rose-500 p-1.5 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar Navigation */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-card)] p-6 flex flex-col justify-between hidden md:flex transition-colors duration-300">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 overflow-hidden p-1 border border-blue-400/40">
              <img src="/icon.png" alt="ApexPulse Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight font-outfit text-[var(--text-heading)]">ApexPulse</h2>
              <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold block flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400 inline" /> Firebase Active
              </span>
            </div>
          </div>

          {/* Simple Human English Sidebar Navigation */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "telemetry"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Activity className="w-4 h-4" />
              Overview & Life Forecast
            </button>

            <button
              onClick={() => setActiveTab("firebase_history")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "firebase_history"
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Database className="w-4 h-4 text-amber-400" />
              🔥 Firebase Device History
            </button>

            <button
              onClick={() => setActiveTab("cpu_ram")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "cpu_ram"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Cpu className="w-4 h-4" />
              Processor & Memory Speed
            </button>

            <button
              onClick={() => setActiveTab("thermal_logs")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "thermal_logs"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Thermometer className="w-4 h-4" />
              Temperature & Crashes
            </button>

            <button
              onClick={() => setActiveTab("battery")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "battery"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Battery className="w-4 h-4" />
              Battery Life & Power
            </button>

            <button
              onClick={() => setActiveTab("storage")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "storage"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <HardDrive className="w-4 h-4" />
              Storage & Hard Drive
            </button>

            <button
              onClick={() => setActiveTab("explainability")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "explainability"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Sliders className="w-4 h-4" />
              What Affects Laptop Life
            </button>

            <button
              onClick={() => setActiveTab("maintenance")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "maintenance"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Wrench className="w-4 h-4" />
              Fix & Upgrade Guide
            </button>
          </nav>
        </div>

        {/* Sidebar Footer & Profile Card */}
        <div className="pt-6 border-t border-[var(--border-card)] space-y-4">
          <div className="flex items-center justify-between bg-[var(--bg-input)] p-2.5 rounded-xl border border-[var(--border-input)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              {isDarkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {isDarkMode ? "Dark Mode" : "Light Mode"}
            </span>
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative flex items-center border ${
                isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-200 border-slate-300"
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full shadow-sm transition-transform duration-200 ${
                  isDarkMode ? "bg-blue-500 translate-x-4.5" : "bg-slate-500 translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="bg-[var(--bg-input)] border border-[var(--border-input)] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center font-bold text-xs text-white`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <strong className="block text-xs font-semibold truncate text-[var(--text-heading)]">{currentUser.name}</strong>
                <small className="text-[10px] text-amber-400 font-semibold block truncate">Firebase • {currentUser.role}</small>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-[var(--text-muted)] hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto max-w-[1600px] mx-auto w-full bg-[var(--bg-primary)] transition-colors duration-300">
        {/* Mobile Top Header */}
        <div className="flex items-center justify-between mb-4 md:hidden pb-4 border-b border-[var(--border-card)]">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2.5 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-[var(--text-heading)] flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95 transition-transform"
          >
            <Menu className="w-5 h-5 text-blue-500" />
            <span>Menu</span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href="/ApexPulseAgent.exe"
              download="ApexPulseAgent.exe"
              className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Agent (.exe)
            </a>
            <button
              onClick={toggleTheme}
              className="p-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl text-[var(--text-secondary)]"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>
        </div>

        {/* Header Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Firebase Database Active
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Realtime Firestore Sync • 5s Polling
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-outfit text-[var(--text-heading)]">
              {activeTab === "telemetry" && "Laptop Overview & Life Forecast"}
              {activeTab === "firebase_history" && "🔥 Firebase Firestore Telemetry & Audit History"}
              {activeTab === "cpu_ram" && "Processor Speed & Memory Usage"}
              {activeTab === "thermal_logs" && "Laptop Temperature & Shutdown Records"}
              {activeTab === "battery" && "Battery Life & Capacity Health"}
              {activeTab === "storage" && "Hard Drive Storage & Health"}
              {activeTab === "explainability" && "Factors Affecting Laptop Lifespan"}
              {activeTab === "maintenance" && "Repair & Hardware Upgrade Guide"}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                className="bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] px-4 py-2.5 rounded-full text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
              >
                <option value="local" className={isDarkMode ? "bg-[#0F172A] text-white" : "bg-white text-slate-900"}>
                  This Laptop ({telemetry?.device_name && !telemetry.device_name.startsWith("169.254.") ? telemetry.device_name : "Web Preview"})
                </option>
                {devicesList.map((d) => (
                  <option key={d.device_id} value={d.device_id} className={isDarkMode ? "bg-[#0F172A] text-white" : "bg-white text-slate-900"}>
                    {d.device_name && !d.device_name.startsWith("169.254.") ? d.device_name : `Cloud Session (${d.device_id.slice(0, 12)})`} ({d.device_model})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-3 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchPrediction(true)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-full text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </header>

        {/* Dynamic Alerts Banner */}
        <div className="space-y-3 mb-6">
          {alertsList
            .filter((alert) => !dismissedAlerts[alert.id])
            .map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border flex items-start justify-between gap-4 transition-all shadow-md ${
                  alert.type === "danger"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : alert.type === "warning"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm leading-tight text-[var(--text-heading)]">{alert.title}</h4>
                    <p className="text-xs opacity-90 mt-0.5">{alert.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }))}
                  className="p-1 hover:bg-white/10 rounded-lg text-current opacity-70 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>

        {/* TAB 1: OVERVIEW & LIFE FORECAST */}
        {activeTab === "telemetry" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Primary RUL Forecast Card */}
            <section className="col-span-12 lg:col-span-8 glass-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">Remaining Useful Life (RUL)</span>
                  <h2 className="text-3xl font-extrabold font-outfit text-[var(--text-heading)]">
                    {prediction ? `${prediction.rul_months.toFixed(1)} Months Left` : "Calculating..."}
                  </h2>
                </div>

                <div
                  className="px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 border shadow-lg"
                  style={{ backgroundColor: badge.bg, color: badge.color, borderColor: `${badge.color}40` }}
                >
                  {badge.icon}
                  <span>{getSimpleRecommendationText(prediction?.recommendation)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">Laptop Age</span>
                  <strong className="text-sm font-bold text-[var(--text-heading)] block mt-0.5">{mlInput?.age || manualAge} Months</strong>
                </div>

                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">Battery Health</span>
                  <strong className="text-sm font-bold text-emerald-500 block mt-0.5">{mlInput?.battery_health ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}</strong>
                </div>

                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">Hard Drive Health</span>
                  <strong className="text-sm font-bold text-cyan-500 block mt-0.5">{mlInput?.ssd_health ? `${mlInput.ssd_health.toFixed(1)}%` : "--%"}</strong>
                </div>

                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">Operating Temp</span>
                  <strong className="text-sm font-bold text-amber-500 block mt-0.5">{telemetry?.temperature_current ? `${telemetry.temperature_current.toFixed(1)}°C` : "45.0°C"}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-card)] pt-4">
                <span>Model: XGBoost Predictor Pipeline</span>
                <span>Last Updated: {lastUpdatedTime || "Just now"}</span>
              </div>
            </section>

            {/* EDHI Gauge Card */}
            <section className="col-span-12 lg:col-span-4">
              <SimplePieChartCard
                title="System Health Score (EDHI)"
                value={mlInput?.edhi ? `${mlInput.edhi.toFixed(1)}` : "85.0"}
                label="out of 100"
                percent={mlInput?.edhi || 85}
                color="#3B82F6"
                subtext="Overall Hardware Health Index"
              />
            </section>
          </div>
        )}

        {/* TAB 2: FIREBASE FIRESTORE DEVICE HISTORY & AUTH ACCOUNTS */}
        {activeTab === "firebase_history" && (
          <div className="space-y-6">
            {/* Enterprise Admin Users Registered in Firebase */}
            <section className="glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-amber-400" /> Enterprise Administrator Accounts (`users` collection)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminAccountsList.map((acc, idx) => (
                  <div key={idx} className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${acc.avatarColor} text-white font-bold flex items-center justify-center`}>
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <strong className="block text-[var(--text-heading)] font-bold">{acc.name}</strong>
                        <span className="text-[10px] text-amber-400 font-mono block">{acc.email}</span>
                        <small className="text-[10px] text-[var(--text-secondary)]">{acc.role}</small>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-lg font-outfit text-[var(--text-heading)] flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-400" /> Firestore Telemetry History Database (`telemetry_history`)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Real-time historical telemetry snapshots logged to Firebase Firestore project <code className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-mono">apex-ml-4b1d9</code>.
                  </p>
                </div>

                <button
                  onClick={loadFirestoreData}
                  disabled={loadingFirestore}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingFirestore ? "animate-spin" : ""}`} />
                  <span>Refresh Firestore Logs</span>
                </button>
              </div>

              {loadingFirestore ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Loading Firestore Database records...</span>
                </div>
              ) : firestoreHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)]">
                  <Database className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-[var(--text-heading)]">No Firestore telemetry snapshots recorded yet.</p>
                  <p className="mt-1">Telemetry automatically syncs to Firebase Firestore during standard 5-second polling.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Device ID</th>
                        <th className="py-3 px-4">CPU / RAM / Disk</th>
                        <th className="py-3 px-4">Battery / SSD Health</th>
                        <th className="py-3 px-4">Health Index (EDHI)</th>
                        <th className="py-3 px-4">RUL Forecast</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--table-header-border)]">
                      {firestoreHistory.map((rec, idx) => (
                        <tr key={rec.id || idx} className="hover:bg-[var(--table-hover)] transition-colors">
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : "Just now"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">
                            {rec.device_id}
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">
                            {rec.cpu_usage?.toFixed(1)}% / {rec.ram_usage?.toFixed(1)}% / {rec.disk_usage?.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className="text-emerald-400 font-bold">{rec.battery_health?.toFixed(1)}% Bat</span> •{" "}
                            <span className="text-cyan-400 font-bold">{rec.ssd_health?.toFixed(1)}% SSD</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-400">
                            {rec.edhi?.toFixed(1)} / 100
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-400">
                            {rec.rul_months?.toFixed(1)} Months
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-semibold text-[11px]">
                              {rec.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="glass-card p-6">
              <h3 className="font-bold text-lg font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-indigo-400" /> Firestore Maintenance Audit Log (`maintenance_logs`)
              </h3>

              {firestoreMaintenanceLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)]">
                  <span>No maintenance actions recorded in Firestore yet. Trigger a repair simulation in the "Fix & Upgrade Guide" tab to log events.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Device ID</th>
                        <th className="py-3 px-4">Action Applied</th>
                        <th className="py-3 px-4">Post-Repair RUL</th>
                        <th className="py-3 px-4">Updated EDHI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--table-header-border)]">
                      {firestoreMaintenanceLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-[var(--table-hover)] transition-colors">
                          <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Recent"}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">{log.device_id}</td>
                          <td className="py-3 px-4 font-bold text-indigo-400 uppercase tracking-wider">{log.action.replace("_", " ")}</td>
                          <td className="py-3 px-4 font-bold text-emerald-400">{log.rul_months?.toFixed(1)} Months</td>
                          <td className="py-3 px-4 font-bold text-blue-400">{log.edhi?.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: PROCESSOR & MEMORY SPEED */}
        {activeTab === "cpu_ram" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-blue-500" /> Processor Usage & Workload
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Processor Load</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-blue-500">
                    {telemetry?.cpu_usage !== undefined && telemetry?.cpu_usage !== null ? `${telemetry.cpu_usage.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Current Activity Level</span>
                </div>
                <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(100, telemetry?.cpu_usage || 0)}%` }} />
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Operating System</span>
                  <span className="font-semibold text-[var(--text-heading)]">{telemetry?.os_name || "Windows"} ({telemetry?.os_version || "Pro"})</span>
                </div>
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Laptop Model</span>
                  <span className="font-semibold text-[var(--text-heading)]">{telemetry?.device_model || "Standard Laptop"}</span>
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-indigo-500" /> System RAM Memory Usage
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">RAM Memory Used</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-indigo-500">
                    {telemetry?.ram_usage !== undefined && telemetry?.ram_usage !== null ? `${telemetry.ram_usage.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Memory Load</span>
                </div>
                <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min(100, telemetry?.ram_usage || 0)}%` }} />
                </div>
              </div>

              {telemetry?.ram_modules && telemetry.ram_modules.length > 0 && (
                <div className="space-y-2 mt-4 pt-3 border-t border-[var(--border-card)]">
                  <span className="text-xs font-bold text-[var(--text-heading)] block uppercase tracking-wider">Installed System Memory Modules (RAM Slots)</span>
                  <div className="space-y-2">
                    {telemetry.ram_modules.map((ram, i) => (
                      <div key={i} className="bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-input)] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-indigo-400" />
                          <div>
                            <strong className="block text-[var(--text-heading)]">{ram.bank}</strong>
                            <span className="text-[10px] text-[var(--text-secondary)]">{ram.manufacturer || "System Memory"} • {ram.speed_mhz ? `${ram.speed_mhz} MHz` : "DDR4/DDR5"}</span>
                          </div>
                        </div>
                        <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">{ram.capacity_gb} GB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: TEMPERATURE & CRASHES */}
        {activeTab === "thermal_logs" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Thermometer className="w-5 h-5 text-amber-500" /> Laptop Operating Heat (Temperature)
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Current Temperature</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-amber-500">
                    {telemetry?.temperature_current ? `${telemetry.temperature_current.toFixed(1)}°C` : "45.0°C"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Normal Operating Heat</span>
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-rose-500" /> Unexpected Laptop Crashes & Shutdowns
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Crashes in Last 30 Days</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-rose-500">
                    {mlInput?.shutdown_count || 0}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Unexpected Shutdowns Recorded</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: BATTERY LIFE & POWER */}
        {activeTab === "battery" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Battery className="w-5 h-5 text-emerald-500" /> Battery Health & Remaining Power
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Battery Health Score</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-emerald-500">
                    {mlInput ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-emerald-500 font-semibold">Good Condition</span>
                </div>
                <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${mlInput?.battery_health || 0}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[var(--text-secondary)] block">Times Charged (Cycles)</span>
                  <strong className="text-base text-[var(--text-heading)] block mt-0.5">{mlInput?.battery_cycles || "--"} Cycles</strong>
                </div>
                <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                  <span className="text-[var(--text-secondary)] block">Power Connection</span>
                  <strong className="text-base text-blue-500 block mt-0.5">{telemetry?.power_plugged ? "Plugged in to Charger" : "Running on Battery"}</strong>
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-500" /> Battery Capacity Details
              </h3>

              <div className="space-y-4 text-xs">
                <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <div>
                    <span className="text-[var(--text-secondary)] block">Original Factory Power Rating</span>
                    <small className="text-[var(--text-muted)]">When laptop was new</small>
                  </div>
                  <strong className="font-mono text-base text-[var(--text-heading)]">{telemetry?.design_capacity_mwh ? `${telemetry.design_capacity_mwh} mWh` : "Factory Standard"}</strong>
                </div>

                <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <div>
                    <span className="text-[var(--text-secondary)] block">Current Max Power Capacity</span>
                    <small className="text-[var(--text-muted)]">Current full charge capacity</small>
                  </div>
                  <strong className="font-mono text-base text-emerald-500">{telemetry?.full_charge_capacity_mwh ? `${telemetry.full_charge_capacity_mwh} mWh` : "Good Capacity"}</strong>
                </div>

                <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <div>
                    <span className="text-[var(--text-secondary)] block">Permanent Battery Wear</span>
                    <small className="text-[var(--text-muted)]">Loss of battery power capacity</small>
                  </div>
                  <strong className="font-mono text-base text-amber-500">{telemetry?.battery_wear ? `${telemetry.battery_wear.toFixed(1)}%` : "15.0%"}</strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 6: STORAGE & HARD DRIVE HEALTH */}
        {activeTab === "storage" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <HardDrive className="w-5 h-5 text-cyan-500" /> Storage Hard Drive Condition
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Hard Drive Health</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-cyan-500">
                    {mlInput ? `${mlInput.ssd_health.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-emerald-500 font-semibold">Drive Health Good</span>
                </div>
                <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${mlInput?.ssd_health || 0}%` }} />
                </div>
              </div>

              {telemetry?.storage_drives && telemetry.storage_drives.length > 0 && (
                <div className="space-y-2 mt-4 pt-3 border-t border-[var(--border-card)]">
                  <span className="text-xs font-bold text-[var(--text-heading)] block uppercase tracking-wider">Installed Physical Storage Drives & Hard Drives</span>
                  <div className="space-y-2">
                    {telemetry.storage_drives.map((drive, i) => (
                      <div key={i} className="bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-input)] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-cyan-400" />
                          <div>
                            <strong className="block text-[var(--text-heading)]">{drive.name} ({drive.media_type})</strong>
                            <span className="text-[10px] text-emerald-400 font-semibold">{drive.health_status} • {drive.health_percent}% SMART Health</span>
                          </div>
                        </div>
                        <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">{drive.size_gb} GB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-indigo-500" /> Hard Drive Storage Space Used
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Main Drive Space Used</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-[var(--text-heading)]">
                    {telemetry?.disk_usage !== undefined && telemetry?.disk_usage !== null ? `${telemetry.disk_usage.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Storage Capacity</span>
                </div>
                <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${Math.min(100, telemetry?.disk_usage || 0)}%` }} />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 7: WHAT AFFECTS LAPTOP LIFE */}
        {activeTab === "explainability" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> What Matters Most for Laptop Lifespan
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-6">
                Ranking of factors that determine how long your laptop will last.
              </p>

              <div className="space-y-4">
                {[
                  { name: "battery_health", weight: 28, label: "Battery Health Condition", color: "from-emerald-500 to-teal-500" },
                  { name: "age", weight: 24, label: "Laptop Age (Months)", color: "from-blue-500 to-indigo-500" },
                  { name: "battery_cycles", weight: 18, label: "Battery Charge Count", color: "from-indigo-500 to-purple-500" },
                  { name: "ssd_health", weight: 14, label: "Hard Drive Condition", color: "from-amber-500 to-orange-500" },
                  { name: "edhi", weight: 10, label: "Overall System Health Score", color: "from-rose-500 to-pink-500" },
                  { name: "temperature", weight: 6, label: "Average Operating Heat", color: "from-cyan-500 to-blue-500" },
                ].map((f) => (
                  <div key={f.name}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[var(--text-primary)]">{f.label}</span>
                      <span className="font-mono text-[var(--text-secondary)]">{f.weight}% Importance</span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${f.color} rounded-full`} style={{ width: `${f.weight * 3.2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-2">
                  <Sliders className="w-5 h-5 text-blue-500" /> Interactive Lifespan Calculator
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-6">
                  Move the sliders to see how improving parts changes your laptop remaining life.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>Laptop Age: <strong className="text-blue-500">{simAge} Months</strong></span>
                    </div>
                    <input type="range" min="1" max="60" value={simAge} onChange={(e) => setSimAge(Number(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>Battery Health: <strong className="text-emerald-500">{simBatHealth}%</strong></span>
                    </div>
                    <input type="range" min="10" max="100" value={simBatHealth} onChange={(e) => setSimBatHealth(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>Times Battery Charged: <strong className="text-indigo-500">{simCycles} Cycles</strong></span>
                    </div>
                    <input type="range" min="10" max="1000" step="10" value={simCycles} onChange={(e) => setSimCycles(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>Hard Drive Health: <strong className="text-amber-500">{simSSDHealth}%</strong></span>
                    </div>
                    <input type="range" min="10" max="100" value={simSSDHealth} onChange={(e) => setSimSSDHealth(Number(e.target.value))} className="w-full accent-amber-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border-card)] bg-[var(--bg-input)] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Calculated Life Outcome</span>
                  <strong className="text-2xl font-bold font-outfit text-blue-500">
                    {((simBatHealth * 0.25) + (simSSDHealth * 0.15) + (48 - simAge * 0.6)).toFixed(1)} Months
                  </strong>
                </div>
                <span className="bg-blue-500/20 text-blue-500 dark:text-blue-300 text-xs px-3 py-1 rounded-full font-semibold">
                  Estimated Result
                </span>
              </div>
            </section>
          </div>
        )}

        {/* TAB 8: REPAIR & HARDWARE UPGRADE GUIDE */}
        {activeTab === "maintenance" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 glass-card p-6">
              <div className="mb-6">
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-500" /> Laptop Repair & Life Boost Guide
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Click the buttons below to see how fixing parts extends your laptop life and saves money.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button onClick={() => triggerMaintenance("replace_battery")} disabled={loading} className="bg-[var(--bg-input)] hover:bg-emerald-500/10 border border-[var(--border-input)] hover:border-emerald-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Battery className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Replace Battery</strong>
                    <span className="text-xs text-[var(--text-secondary)]">Installs a brand new battery</span>
                    <div className="text-[11px] text-emerald-500 font-bold mt-1">+14.2 Extra Months Life</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("replace_ssd")} disabled={loading} className="bg-[var(--bg-input)] hover:bg-blue-500/10 border border-[var(--border-input)] hover:border-blue-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <HardDrive className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Replace Hard Drive</strong>
                    <span className="text-xs text-[var(--text-secondary)]">Installs a fast new SSD drive</span>
                    <div className="text-[11px] text-blue-500 font-bold mt-1">+8.5 Extra Months Life</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("full_overhaul")} disabled={loading} className="bg-gradient-to-br from-indigo-600/20 to-emerald-600/20 border border-indigo-500/40 hover:border-indigo-400 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Wrench className="w-8 h-8 text-indigo-500 dark:text-indigo-300 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Full Laptop Tune-up</strong>
                    <span className="text-xs text-[var(--text-secondary)]">New Battery + Hard Drive + Dust Clean</span>
                    <div className="text-[11px] text-indigo-500 dark:text-indigo-300 font-bold mt-1">+22.8 Extra Months Life</div>
                  </div>
                </button>
              </div>

              {/* Repair Value Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                      <th className="py-3 px-4">Repair Choice</th>
                      <th className="py-3 px-4">Estimated Cost</th>
                      <th className="py-3 px-4">Extra Life Gained</th>
                      <th className="py-3 px-4">Value Worth</th>
                      <th className="py-3 px-4">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--table-header-border)]">
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <Battery className="w-4 h-4 text-emerald-500" /> New Battery Replacement
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$85.00</td>
                      <td className="py-3 px-4 font-bold text-emerald-500">+14.2 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-500 font-semibold">High Value Return</td>
                      <td className="py-3 px-4"><span className="bg-emerald-500/20 text-emerald-500 px-2.5 py-0.5 rounded font-semibold">Best Choice</span></td>
                    </tr>
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-blue-500" /> New SSD Drive Upgrade
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$110.00</td>
                      <td className="py-3 px-4 font-bold text-blue-500">+8.5 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-500 font-semibold">Good Value Return</td>
                      <td className="py-3 px-4"><span className="bg-blue-500/20 text-blue-500 px-2.5 py-0.5 rounded font-semibold">Recommended</span></td>
                    </tr>
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-indigo-500" /> Complete Laptop Refurbish
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$175.00</td>
                      <td className="py-3 px-4 font-bold text-indigo-500">+22.8 Months</td>
                      <td className="py-3 px-4 font-mono text-indigo-500 font-semibold">Maximum Value Return</td>
                      <td className="py-3 px-4"><span className="bg-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded font-semibold">Top Priority</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
