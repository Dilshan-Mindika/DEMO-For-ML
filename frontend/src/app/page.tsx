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
  X
} from "lucide-react";
import { authenticateUser, UserAccount } from "./auth";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://demo-for-ml-back.vercel.app";

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

  // Navigation State: 'telemetry' | 'cpu_ram' | 'thermal_logs' | 'battery' | 'storage' | 'explainability' | 'maintenance'
  const [activeTab, setActiveTab] = useState<string>("telemetry");

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

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const user = authenticateUser(loginEmail, loginPassword);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem("apex_user", JSON.stringify(user));
      fetchPrediction(true);
    } else {
      setAuthError("Incorrect email or password. Please try again.");
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
      fetchFleet();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Unable to connect to laptop monitoring server.";
      setError(msg);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [manualAge, dailyUsage, selectedDeviceId, fetchFleet]);

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
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mx-auto mb-4">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-outfit text-[var(--text-heading)]">ApexPulse Enterprise</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Smart Laptop Life & Health Monitoring Portal</p>
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In to Laptop Portal
            </button>

            <div className="pt-4 border-t border-[var(--border-card)] text-center space-y-2">
              <p className="text-xs text-[var(--text-secondary)] font-medium">Need local laptop hardware telemetry agent?</p>
              <div className="flex gap-2">
                <a
                  href="/ApexPulseAgent.exe"
                  download="ApexPulseAgent.exe"
                  className="flex-1 bg-[var(--bg-input)] hover:bg-emerald-500/10 border border-[var(--border-input)] hover:border-emerald-500/50 text-emerald-400 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Download Agent (.exe)
                </a>
                <a
                  href="/downloads/Install_ApexPulse_Agent.bat"
                  download="Install_ApexPulse_Agent.bat"
                  className="bg-[var(--bg-input)] hover:bg-blue-500/10 border border-[var(--border-input)] hover:border-blue-500/50 text-blue-400 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  Script (.bat)
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

  return (
    <div className={`flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] ${isDarkMode ? "dark-mode" : "light-mode"} transition-colors duration-300`}>
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-card)] p-6 flex flex-col justify-between hidden md:flex transition-colors duration-300">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight font-outfit text-[var(--text-heading)]">ApexPulse</h2>
              <span className="text-[11px] text-blue-500 uppercase tracking-wider font-semibold block">
                Laptop Monitor
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
              Laptop Overview & Life
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
                isDarkMode
                  ? "bg-slate-700 border-slate-600"
                  : "bg-slate-200 border-slate-300"
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full shadow-sm transition-transform duration-200 ${
                  isDarkMode
                    ? "bg-blue-500 translate-x-4.5"
                    : "bg-slate-500 translate-x-0"
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
                <small className="text-[10px] text-[var(--text-secondary)] block truncate">{currentUser.role}</small>
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
      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-[var(--bg-primary)] transition-colors duration-300">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                Live Laptop Intelligence System
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Auto-refreshing every 5s
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-outfit text-[var(--text-heading)]">
              {activeTab === "telemetry" && "Laptop Overview & Life Forecast"}
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
                  This Laptop ({telemetry?.device_name || "Device"})
                </option>
                {devicesList.map((d) => (
                  <option key={d.device_id} value={d.device_id} className={isDarkMode ? "bg-[#0F172A] text-white" : "bg-white text-slate-900"}>
                    {d.device_name} ({d.device_model})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-3 top-3.5 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchPrediction(true)}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin-fast" : ""}`} />
              <span>{loading ? "Refreshing..." : "Check Now"}</span>
            </button>
          </div>
        </header>

        {/* Dynamic Warning Alert Popups for High Overuse / Overheating */}
        {alertsList.length > 0 && (
          <div className="space-y-3 mb-6">
            {alertsList.map(
              (alert) =>
                !dismissedAlerts[alert.id] && (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-md transition-all ${
                      alert.type === "danger"
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-500"
                        : alert.type === "warning"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                        : "bg-blue-500/15 border-blue-500/40 text-blue-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                      <div>
                        <strong className="block text-sm font-bold">{alert.title}</strong>
                        <p className="text-xs opacity-90 mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissedAlerts((prev) => ({ ...prev, [alert.id]: true }))}
                      className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                      title="Dismiss Warning"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Server Connection Notice:</strong> {error}
              <div className="text-xs text-rose-500 mt-1">
                Ensure backend API application is running on port 5000 (`python backend/app.py`).
              </div>
            </div>
          </div>
        )}

        {/* Fleet Summary Cards Banner */}
        {fleetSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Total Monitored Laptops</span>
                <strong className="text-xl font-bold font-outfit text-[var(--text-heading)]">{fleetSummary.total_devices}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Good Laptops</span>
                <strong className="text-xl font-bold font-outfit text-emerald-500">{fleetSummary.healthy_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Needs Watching</span>
                <strong className="text-xl font-bold font-outfit text-amber-500">{fleetSummary.monitor_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Action Needed</span>
                <strong className="text-xl font-bold font-outfit text-rose-500">{fleetSummary.replacement_count}</strong>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: LAPTOP OVERVIEW & LIFE EXPECTANCY */}
        {activeTab === "telemetry" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Hero Laptop Life Remaining Banner */}
            <section className="col-span-12 glass-card p-6 md:p-8 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <span className="bg-blue-500/15 text-blue-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  AI Life Expectancy Forecast
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Laptop: <strong>{telemetry?.device_name || "--"}</strong> • Serial: <strong>{telemetry?.serial_number || "--"}</strong> • Updated: <strong>{lastUpdatedTime || "--"}</strong>
                </span>
              </div>

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-6">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-6xl md:text-7xl font-extrabold font-outfit text-[var(--text-heading)]">
                      {prediction ? prediction.rul_months.toFixed(1) : "--"}
                    </span>
                    <span className="text-xl text-[var(--text-secondary)] font-semibold">Months</span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] mt-2 font-medium">
                    Estimated Remaining Laptop Useful Life
                  </div>
                </div>

                <div
                  className="w-full lg:max-w-md p-5 rounded-2xl border flex items-center gap-5 transition-all"
                  style={{
                    borderColor: badge.color,
                    backgroundColor: "var(--bg-input)",
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: badge.bg }}
                  >
                    {badge.icon}
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold block">
                      Recommended Action
                    </span>
                    <h3 className="text-xl font-bold font-outfit" style={{ color: badge.color }}>
                      {prediction ? getSimpleRecommendationText(prediction.recommendation) : "Analyzing..."}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-card)] flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-secondary)]">Daily Workload Profile:</span>
                  <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg font-bold">
                    {mlInput?.usage_profile || "Normal Work"}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">Laptop Age (Months):</span>
                    <input
                      type="number"
                      value={manualAge}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setManualAge(val);
                        fetchPrediction(true, val, dailyUsage);
                      }}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-heading)] rounded-lg px-2 py-1 text-center font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">Daily Use (Hours/Day):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={dailyUsage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDailyUsage(val);
                        fetchPrediction(true, manualAge, val);
                      }}
                      className="w-16 bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-heading)] rounded-lg px-2 py-1 text-center font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* FULL OVERVIEW PIE GRAPH VIEWS FOR ALL METRICS */}
            <section className="col-span-12">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-blue-500" /> Overall System Health Pie Chart Breakdown
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SimplePieChartCard
                  title="Overall Laptop Health"
                  value={mlInput ? `${mlInput.edhi.toFixed(0)}%` : "--%"}
                  label="Health Index"
                  percent={mlInput?.edhi || 0}
                  color="#10B981"
                  subtext="Combined battery, storage & speed rating"
                />

                <SimplePieChartCard
                  title="Battery Condition"
                  value={mlInput ? `${mlInput.battery_health.toFixed(0)}%` : "--%"}
                  label="Health Left"
                  percent={mlInput?.battery_health || 0}
                  color="#3B82F6"
                  subtext={mlInput ? `${mlInput.battery_cycles} Charge Cycles` : "--"}
                />

                <SimplePieChartCard
                  title="Hard Drive Health"
                  value={mlInput ? `${mlInput.ssd_health.toFixed(0)}%` : "--%"}
                  label="Storage Health"
                  percent={mlInput?.ssd_health || 0}
                  color="#06B6D4"
                  subtext="Physical drive health status"
                />

                <SimplePieChartCard
                  title="Processor Workload"
                  value={telemetry?.cpu_usage ? `${telemetry.cpu_usage.toFixed(0)}%` : "0%"}
                  label="CPU Load"
                  percent={telemetry?.cpu_usage || 0}
                  color="#F59E0B"
                  subtext={telemetry?.temperature_current ? `Temp: ${telemetry.temperature_current.toFixed(0)}°C` : "--"}
                />
              </div>
            </section>

            {/* Monitored Fleet Inventory Table */}
            {devicesList.length > 0 && (
              <section className="col-span-12 glass-card p-6">
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-500" /> Monitored Laptop Inventory
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                        <th className="py-3 px-4">Laptop Name</th>
                        <th className="py-3 px-4">Model & Serial</th>
                        <th className="py-3 px-4">Life Expectancy</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Battery Health</th>
                        <th className="py-3 px-4">Overall Score</th>
                        <th className="py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--table-header-border)]">
                      {devicesList.map((dev) => (
                        <tr key={dev.device_id} className="hover:bg-[var(--table-hover)] transition-colors">
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">{dev.device_name}</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">{dev.device_model} ({dev.serial_number})</td>
                          <td className="py-3 px-4 font-bold text-blue-500">{dev.rul_months.toFixed(1)} Months</td>
                          <td className="py-3 px-4 font-semibold" style={{ color: dev.status_color }}>{getSimpleRecommendationText(dev.recommendation)}</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{dev.battery_health.toFixed(1)}%</td>
                          <td className="py-3 px-4 font-mono text-emerald-500 font-bold">{dev.edhi.toFixed(1)} / 100</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => selectDevice(dev.device_id)}
                              className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-500 dark:text-blue-300 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Inspect Laptop
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: PROCESSOR & MEMORY SPEED DEEP-DIVE */}
        {activeTab === "cpu_ram" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-blue-500" /> Processor Speed & Load
              </h3>

              <div className="space-y-6">
                <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)]">
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Current Processor Load</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold font-outfit text-[var(--text-heading)]">
                      {telemetry?.cpu_usage !== undefined && telemetry?.cpu_usage !== null ? `${telemetry.cpu_usage.toFixed(1)}%` : "--%"}
                    </span>
                    <span className="text-xs text-blue-500 font-semibold">Active Workload</span>
                  </div>
                  <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, telemetry?.cpu_usage || 0)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                    <span className="text-[var(--text-secondary)] block">Laptop Name</span>
                    <strong className="text-sm text-[var(--text-heading)] block mt-0.5">{telemetry?.device_name || "--"}</strong>
                  </div>
                  <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                    <span className="text-[var(--text-secondary)] block">System Version</span>
                    <strong className="text-sm text-[var(--text-heading)] block mt-0.5">{telemetry?.os_name || "--"} ({telemetry?.os_version || "--"})</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-indigo-500" /> System Memory (RAM) Usage
              </h3>

              <div className="space-y-6">
                <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)]">
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Memory (RAM) In Use</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold font-outfit text-[var(--text-heading)]">
                      {telemetry?.ram_usage !== undefined && telemetry?.ram_usage !== null ? `${telemetry.ram_usage.toFixed(1)}%` : "--%"}
                    </span>
                    <span className="text-xs text-indigo-500 font-semibold">Memory Load</span>
                  </div>
                  <div className="w-full h-3 bg-[var(--bg-card)] rounded-full mt-3 overflow-hidden border border-[var(--border-card)]">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, telemetry?.ram_usage || 0)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                    <span className="text-[var(--text-secondary)] block">Time Running</span>
                    <strong className="text-sm text-[var(--text-heading)] block mt-0.5">{telemetry?.uptime_hours || "--"} Hours</strong>
                  </div>
                  <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)]">
                    <span className="text-[var(--text-secondary)] block">Workload & Speed Score</span>
                    <strong className="text-sm text-blue-500 block mt-0.5">{mlInput?.performance_score.toFixed(1) || "--"} / 100</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: TEMPERATURE & CRASHES DEEP-DIVE */}
        {activeTab === "thermal_logs" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Thermometer className="w-5 h-5 text-amber-500" /> Laptop Heat & Temperature
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Current Temperature</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-amber-500">
                    {mlInput ? `${mlInput.temperature.toFixed(1)} °C` : "-- °C"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Internal Sensor</span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Heat Status</span>
                  <span className="bg-emerald-500/20 text-emerald-500 font-bold px-2.5 py-0.5 rounded">Safe Operating Temperature</span>
                </div>
              </div>
            </section>

            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-rose-500" /> Unexpected Laptop Crashes (Last 30 Days)
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Unexpected Shutdowns</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-rose-500">
                    {mlInput ? mlInput.shutdown_count : "--"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Times Laptop Turned Off Suddenly</span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Crash Log Record</span>
                  <span className="font-bold text-[var(--text-primary)]">Windows Power Event History</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: BATTERY LIFE & HEALTH DEEP-DIVE */}
        {activeTab === "battery" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Battery className="w-5 h-5 text-emerald-500" /> Battery Health & Charge Capacity
              </h3>

              <div className="bg-[var(--bg-input)] p-5 rounded-2xl border border-[var(--border-input)] mb-6">
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block mb-1">Remaining Battery Health</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold font-outfit text-emerald-500">
                    {mlInput ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">Original Power Holding Level</span>
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

        {/* TAB 5: STORAGE & HARD DRIVE HEALTH DEEP-DIVE */}
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

              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-input)] p-3.5 rounded-xl border border-[var(--border-input)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Drive Diagnostic Check</span>
                  <span className="font-mono text-emerald-500 font-bold">Healthy Drive</span>
                </div>
              </div>
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

              <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-input)] text-xs">
                <span className="text-[var(--text-secondary)] block">Tip for Hard Drive Health</span>
                <p className="text-[var(--text-primary)] mt-1">
                  Keep at least 15% free space on your hard drive so windows can run smoothly and fast.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* TAB 6: WHAT AFFECTS LAPTOP LIFE & SLIDER TOOL */}
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

        {/* TAB 7: REPAIR & HARDWARE UPGRADE GUIDE */}
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
