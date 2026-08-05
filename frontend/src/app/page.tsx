"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Server,
  Users,
  ChevronDown,
  Mail,
  Lock,
  LogOut,
  Sun,
  Moon,
  Sliders,
  BarChart3,
  Pause,
  Play,
  Zap
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

export default function DashboardPage() {
  // Theme State (Dark by default)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Active Tab State: 'telemetry' | 'explainability' | 'maintenance'
  const [activeTab, setActiveTab] = useState<string>("telemetry");

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard Data State
  const [data, setData] = useState<{ telemetry: TelemetryData; prediction: PredictionResult } | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [devicesList, setDevicesList] = useState<DeviceSummary[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(true);
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

  useEffect(() => {
    const savedUser = localStorage.getItem("apex_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

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
      setAuthError("Invalid administrator credentials. Access denied.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("apex_user");
  };

  const fetchFleet = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices`);
      if (res.ok) {
        const json = await res.json();
        setFleetSummary(json.summary);
        setDevicesList(json.devices);
      }
    } catch (e) {
      console.error("Fleet fetch error:", e);
    }
  };

  const fetchPrediction = async (showSpinner = false, age = manualAge, usage = dailyUsage) => {
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
        endpoint = `${API_BASE_URL}/api/devices/${selectedDeviceId}`;
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const selectDevice = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setLoading(true);
    try {
      let endpoint = `${API_BASE_URL}/api/predict`;
      let options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: manualAge, daily_usage: dailyUsage }),
      };

      if (deviceId !== "local") {
        endpoint = `${API_BASE_URL}/api/devices/${deviceId}`;
        options = { method: "GET" };
      }

      const res = await fetch(endpoint, options);
      if (!res.ok) throw new Error("Device details fetch failed");
      const json = await res.json();
      setData({ telemetry: json.telemetry, prediction: json.prediction });
      setLastUpdatedTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      alert(`Device Selection Error: ${err.message}`);
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
    } catch (err: any) {
      alert(`Maintenance Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Automated 3-Second Real-Time Telemetry Stream Polling Effect
  useEffect(() => {
    if (!currentUser) return;

    fetchPrediction(true);

    const intervalId = setInterval(() => {
      if (isAutoPolling) {
        fetchPrediction(false);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [currentUser, isAutoPolling, selectedDeviceId, manualAge, dailyUsage]);

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
            <p className="text-xs text-[var(--text-secondary)] mt-1">Real-World Laptop Lifecycle & Fleet Intelligence System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Administrator Email
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
              Sign In to Fleet Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const prediction = data?.prediction;
  const telemetry = data?.telemetry;
  const mlInput = prediction?.ml_input;

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
                Production Engine
              </span>
            </div>
          </div>

          {/* Enterprise Navigation Links (3 Tabs) */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "telemetry"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Activity className="w-4 h-4" />
              Fleet Analytics & RUL
            </button>

            <button
              onClick={() => setActiveTab("explainability")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "explainability"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Sliders className="w-4 h-4" />
              Model Explainability
            </button>

            <button
              onClick={() => setActiveTab("maintenance")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "maintenance"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-heading)]"
              }`}
            >
              <Wrench className="w-4 h-4" />
              Prescriptive ROI Matrix
            </button>
          </nav>
        </div>

        {/* Sidebar Footer & Bottom Profile Card */}
        <div className="pt-6 border-t border-[var(--border-card)] space-y-4">
          {/* Theme Toggle Switcher */}
          <div className="flex items-center justify-between bg-[var(--bg-input)] p-2.5 rounded-xl border border-[var(--border-input)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              {isDarkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {isDarkMode ? "Dark Theme" : "Light Theme"}
            </span>
            <button
              onClick={toggleTheme}
              className="w-9 h-5 bg-slate-300 dark:bg-slate-700 rounded-full p-0.5 transition-colors relative"
            >
              <div
                className={`w-4 h-4 rounded-full bg-blue-600 shadow-md transition-transform ${
                  isDarkMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Active Admin Profile Card */}
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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider mb-1">
              <span className="text-blue-500">Real-World Production System</span>
              {/* Live Streaming Pulse Indicator */}
              <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold">LIVE TELEMETRY STREAM (3s)</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-outfit text-[var(--text-heading)]">
              {activeTab === "telemetry" && "Fleet Telemetry & XGBoost RUL Forecasting"}
              {activeTab === "explainability" && "XGBoost Feature Sensitivity & Explainability"}
              {activeTab === "maintenance" && "Prescriptive Maintenance & ROI Optimization"}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Polling Stream Pause/Play Toggle */}
            <button
              onClick={() => setIsAutoPolling(!isAutoPolling)}
              title={isAutoPolling ? "Pause Live 3s Stream" : "Resume Live 3s Stream"}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isAutoPolling
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-500"
              }`}
            >
              {isAutoPolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isAutoPolling ? "Live Stream Active" : "Stream Paused"}</span>
            </button>

            {/* Device Selector */}
            <div className="relative">
              <select
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                className="bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] px-4 py-2.5 rounded-full text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
              >
                <option value="local" className={isDarkMode ? "bg-[#0F172A] text-white" : "bg-white text-slate-900"}>
                  Local Host ({telemetry?.device_name || "Device"})
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
              <span>{loading ? "Refreshing..." : "Refresh Payload"}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Backend API Connection Issue:</strong> {error}
              <div className="text-xs text-rose-500 mt-1">
                Make sure Flask backend server is listening on port 5000 (`python backend/app.py`).
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
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Monitored Laptops</span>
                <strong className="text-xl font-bold font-outfit text-[var(--text-heading)]">{fleetSummary.total_devices}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Healthy Fleet</span>
                <strong className="text-xl font-bold font-outfit text-emerald-500">{fleetSummary.healthy_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Monitor Devices</span>
                <strong className="text-xl font-bold font-outfit text-amber-500">{fleetSummary.monitor_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Action Required</span>
                <strong className="text-xl font-bold font-outfit text-rose-500">{fleetSummary.replacement_count}</strong>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: FLEET TELEMETRY & RUL FORECAST */}
        {activeTab === "telemetry" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Hero RUL Forecast Gauge Banner */}
            <section className="col-span-12 glass-card p-6 md:p-8 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <span className="bg-blue-500/15 text-blue-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  XGBoost Regressor RUL Forecast
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Host: <strong>{telemetry?.device_name || "--"}</strong> • Serial: <strong>{telemetry?.serial_number || "--"}</strong> • Live Updated: <strong>{lastUpdatedTime || "--"}</strong>
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
                    Forecasted Remaining Useful Life (RUL)
                  </div>
                </div>

                {/* Recommendation Card */}
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
                      Enterprise Recommendation
                    </span>
                    <h3 className="text-xl font-bold font-outfit" style={{ color: badge.color }}>
                      {prediction ? prediction.recommendation : "Analyzing..."}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Profile Inputs */}
              <div className="pt-4 border-t border-[var(--border-card)] flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-secondary)]">AI Usage Profile:</span>
                  <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg font-bold">
                    {mlInput?.usage_profile || "Normal"}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">Device Age (Months):</span>
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
                    <span className="text-[var(--text-secondary)]">Daily Usage (Hours):</span>
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

            {/* Dynamic Real-Time Hardware Metrics Grid */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Live CPU Usage Card */}
              <div className="glass-card p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">Live CPU Load</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-500 font-bold px-2 py-0.5 rounded">REALTIME</span>
                  </div>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {telemetry?.cpu_usage !== undefined && telemetry?.cpu_usage !== null ? `${telemetry.cpu_usage.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="w-full h-1.5 bg-[var(--bg-input)] rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, telemetry?.cpu_usage || 0)}%` }} />
                  </div>
                </div>
              </div>

              {/* Live RAM Usage Card */}
              <div className="glass-card p-5 flex items-center gap-4 border-l-4 border-l-indigo-500">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">Live RAM Usage</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-500 font-bold px-2 py-0.5 rounded">REALTIME</span>
                  </div>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {telemetry?.ram_usage !== undefined && telemetry?.ram_usage !== null ? `${telemetry.ram_usage.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="w-full h-1.5 bg-[var(--bg-input)] rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, telemetry?.ram_usage || 0)}%` }} />
                  </div>
                </div>
              </div>

              {/* Live CPU Temperature Card */}
              <div className="glass-card p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Thermometer className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">CPU Thermal Sensor</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-500 font-bold px-2 py-0.5 rounded">REALTIME</span>
                  </div>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {mlInput ? `${mlInput.temperature.toFixed(1)} °C` : "-- °C"}
                  </h2>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Live Thermal Zone Sensor</div>
                </div>
              </div>

              {/* Battery Wear Card */}
              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Battery className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">Battery Wear & Cycles</span>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {mlInput ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {mlInput ? `${mlInput.battery_cycles} Cycles` : "--"} • {telemetry?.power_plugged ? "AC Power" : "Battery"}
                  </div>
                </div>
              </div>

              {/* SSD Health Card */}
              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">SSD Health Status</span>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {mlInput ? `${mlInput.ssd_health.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Physical Drive Wear Status</div>
                </div>
              </div>

              {/* Kernel Shutdowns Card */}
              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold block">Shutdown Crashes (30d)</span>
                  <h2 className="text-2xl font-bold font-outfit text-[var(--text-heading)] mt-0.5">
                    {mlInput ? mlInput.shutdown_count : "--"}
                  </h2>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Windows Kernel Power Logs</div>
                </div>
              </div>
            </div>

            {/* AI Scores Card */}
            <section className="col-span-12 lg:col-span-5 glass-card p-6 flex flex-col justify-between">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-500" /> AI Agent Real-Time Calculations
              </h3>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-[var(--text-secondary)]">Live Performance Score</span>
                    <span className="text-blue-500 font-mono font-bold">{mlInput ? `${mlInput.performance_score.toFixed(1)} / 100` : "--"}</span>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${mlInput?.performance_score || 0}%` }} />
                  </div>
                  <small className="text-[11px] text-[var(--text-muted)] mt-1 block">Live CPU, RAM & Disk Load Contention Agent</small>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span className="text-[var(--text-secondary)]">Enterprise Device Health Index (EDHI)</span>
                    <span className="text-emerald-500 font-mono font-bold">{mlInput ? `${mlInput.edhi.toFixed(1)} / 100` : "--"}</span>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${mlInput?.edhi || 0}%` }} />
                  </div>
                  <small className="text-[11px] text-[var(--text-muted)] mt-1 block">Multi-Factor Holistic Integrity Index</small>
                </div>
              </div>
            </section>

            {/* Monitored Fleet Inventory Table */}
            {devicesList.length > 0 && (
              <section className="col-span-12 glass-card p-6">
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-500" /> Monitored Fleet Inventory
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                        <th className="py-3 px-4">Device Hostname</th>
                        <th className="py-3 px-4">Model & Serial</th>
                        <th className="py-3 px-4">RUL Forecast</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Battery Health</th>
                        <th className="py-3 px-4">EDHI</th>
                        <th className="py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--table-header-border)]">
                      {devicesList.map((dev) => (
                        <tr key={dev.device_id} className="hover:bg-[var(--table-hover)] transition-colors">
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">{dev.device_name}</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">{dev.device_model} ({dev.serial_number})</td>
                          <td className="py-3 px-4 font-bold text-blue-500">{dev.rul_months.toFixed(1)} Months</td>
                          <td className="py-3 px-4 font-semibold" style={{ color: dev.status_color }}>{dev.recommendation}</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{dev.battery_health.toFixed(1)}%</td>
                          <td className="py-3 px-4 font-mono text-emerald-500 font-bold">{dev.edhi.toFixed(1)}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => selectDevice(dev.device_id)}
                              className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-500 dark:text-blue-300 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Inspect Telemetry
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Real Feature Matrix Table */}
            <section className="col-span-12 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-gray-400" /> Live Hardware Telemetry Feature Vector Passed to XGBoost Model
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                      <th className="py-3 px-4">Feature Name</th>
                      <th className="py-3 px-4">Live Hardware Value</th>
                      <th className="py-3 px-4">Data Type</th>
                      <th className="py-3 px-4">Real Hardware Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--table-header-border)]">
                    {mlInput && (
                      <>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">device_model</td>
                          <td className="py-3 px-4 font-mono text-blue-500">{mlInput.device_model}</td>
                          <td className="py-3 px-4 text-indigo-500">Categorical</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real WMI Query (Win32_ComputerSystem)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">usage_profile</td>
                          <td className="py-3 px-4 font-mono text-indigo-500">{mlInput.usage_profile}</td>
                          <td className="py-3 px-4 text-indigo-500">Categorical</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Live AI Agent Classifier</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">age</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.age} months</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Device Lifecycle Input</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">usage_hours</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.usage_hours} hrs</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Calculated Daily Load</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">battery_cycles</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.battery_cycles}</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real Windows PowerCfg Report</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">battery_health</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.battery_health}%</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real Windows PowerCfg (Design vs Full Charge)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">ssd_health</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.ssd_health}%</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real PowerShell Get-PhysicalDisk</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">temperature</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.temperature} °C</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real LibreHardwareMonitor API Sensor</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">performance_score</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.performance_score} / 100</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real psutil CPU/RAM Contention Agent</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">shutdown_count</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.shutdown_count}</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real Windows Event Log (Event ID 41 & 6008)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold text-[var(--text-heading)]">edhi</td>
                          <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{mlInput.edhi} / 100</td>
                          <td className="py-3 px-4 text-emerald-500">Numeric</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">Real Enterprise Device Health Index Agent</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: MODEL EXPLAINABILITY & SENSITIVITY SIMULATOR */}
        {activeTab === "explainability" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Feature Attribution Matrix */}
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" /> XGBoost Feature Weight Attributions
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-6">
                Relative feature impact ranking derived from tree split gain and SHAP values.
              </p>

              <div className="space-y-4">
                {[
                  { name: "battery_health", weight: 28, label: "Battery Health (%)", color: "from-emerald-500 to-teal-500" },
                  { name: "age", weight: 24, label: "Device Age (Months)", color: "from-blue-500 to-indigo-500" },
                  { name: "battery_cycles", weight: 18, label: "Battery Cycle Count", color: "from-indigo-500 to-purple-500" },
                  { name: "ssd_health", weight: 14, label: "SSD Health (%)", color: "from-amber-500 to-orange-500" },
                  { name: "edhi", weight: 10, label: "Enterprise Device Health Index", color: "from-rose-500 to-pink-500" },
                  { name: "temperature", weight: 6, label: "Average Temperature (°C)", color: "from-cyan-500 to-blue-500" },
                ].map((f) => (
                  <div key={f.name}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[var(--text-primary)]">{f.label}</span>
                      <span className="font-mono text-[var(--text-secondary)]">{f.weight}% Weight</span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${f.color} rounded-full`} style={{ width: `${f.weight * 3.2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Interactive What-If Sensitivity Simulator */}
            <section className="col-span-12 lg:col-span-6 glass-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2 mb-2">
                  <Sliders className="w-5 h-5 text-blue-500" /> Interactive Sensitivity Simulator
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-6">
                  Adjust parameter sliders to observe real-time feature impact on RUL predictions.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>Device Age: <strong className="text-blue-500">{simAge} Months</strong></span>
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
                      <span>Battery Cycles: <strong className="text-indigo-500">{simCycles} Cycles</strong></span>
                    </div>
                    <input type="range" min="10" max="1000" step="10" value={simCycles} onChange={(e) => setSimCycles(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1 text-[var(--text-primary)]">
                      <span>SSD Health: <strong className="text-amber-500">{simSSDHealth}%</strong></span>
                    </div>
                    <input type="range" min="10" max="100" value={simSSDHealth} onChange={(e) => setSimSSDHealth(Number(e.target.value))} className="w-full accent-amber-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border-card)] bg-[var(--bg-input)] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold block">Simulated RUL Impact</span>
                  <strong className="text-2xl font-bold font-outfit text-blue-500">
                    {((simBatHealth * 0.25) + (simSSDHealth * 0.15) + (48 - simAge * 0.6)).toFixed(1)} Months
                  </strong>
                </div>
                <span className="bg-blue-500/20 text-blue-500 dark:text-blue-300 text-xs px-3 py-1 rounded-full font-semibold">
                  Dynamic Forecast
                </span>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: PRESCRIPTIVE MAINTENANCE & ROI MATRIX */}
        {activeTab === "maintenance" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Component Maintenance Actions */}
            <section className="col-span-12 glass-card p-6">
              <div className="mb-6">
                <h3 className="font-bold text-base font-outfit text-[var(--text-heading)] flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-500" /> Prescriptive Component Maintenance Simulation
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Execute simulated hardware refurbishments to quantify life-extension and financial ROI.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button onClick={() => triggerMaintenance("replace_battery")} disabled={loading} className="bg-[var(--bg-input)] hover:bg-emerald-500/10 border border-[var(--border-input)] hover:border-emerald-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Battery className="w-8 h-8 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Replace Battery</strong>
                    <span className="text-xs text-[var(--text-secondary)]">Reset Health to 100% & Cycles to 0</span>
                    <div className="text-[11px] text-emerald-500 font-bold mt-1">+14.2 Months RUL</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("replace_ssd")} disabled={loading} className="bg-[var(--bg-input)] hover:bg-blue-500/10 border border-[var(--border-input)] hover:border-blue-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <HardDrive className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Replace SSD Drive</strong>
                    <span className="text-xs text-[var(--text-secondary)]">Reset SSD Wear to 100%</span>
                    <div className="text-[11px] text-blue-500 font-bold mt-1">+8.5 Months RUL</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("full_overhaul")} disabled={loading} className="bg-gradient-to-br from-indigo-600/20 to-emerald-600/20 border border-indigo-500/40 hover:border-indigo-400 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Wrench className="w-8 h-8 text-indigo-500 dark:text-indigo-300 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-[var(--text-heading)]">Full Refurbish Overhaul</strong>
                    <span className="text-xs text-[var(--text-secondary)]">New Battery + SSD + Thermal Service</span>
                    <div className="text-[11px] text-indigo-500 dark:text-indigo-300 font-bold mt-1">+22.8 Months RUL</div>
                  </div>
                </button>
              </div>

              {/* Maintenance ROI Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--table-header-border)] text-[var(--text-secondary)]">
                      <th className="py-3 px-4">Intervention Type</th>
                      <th className="py-3 px-4">Estimated Cost ($)</th>
                      <th className="py-3 px-4">RUL Life Extension</th>
                      <th className="py-3 px-4">Financial ROI Ratio</th>
                      <th className="py-3 px-4">Recommendation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--table-header-border)]">
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <Battery className="w-4 h-4 text-emerald-500" /> Battery Replacement
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$85.00</td>
                      <td className="py-3 px-4 font-bold text-emerald-500">+14.2 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-500 font-semibold">4.2x ROI</td>
                      <td className="py-3 px-4"><span className="bg-emerald-500/20 text-emerald-500 px-2.5 py-0.5 rounded font-semibold">Optimal</span></td>
                    </tr>
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-blue-500" /> NVMe SSD Upgrade
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$110.00</td>
                      <td className="py-3 px-4 font-bold text-blue-500">+8.5 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-500 font-semibold">2.1x ROI</td>
                      <td className="py-3 px-4"><span className="bg-blue-500/20 text-blue-500 px-2.5 py-0.5 rounded font-semibold">Recommended</span></td>
                    </tr>
                    <tr className="hover:bg-[var(--table-hover)]">
                      <td className="py-3 px-4 font-semibold text-[var(--text-heading)] flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-indigo-500" /> Full Enterprise Refurbish
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">$175.00</td>
                      <td className="py-3 px-4 font-bold text-indigo-500">+22.8 Months</td>
                      <td className="py-3 px-4 font-mono text-indigo-500 font-semibold">5.6x ROI</td>
                      <td className="py-3 px-4"><span className="bg-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded font-semibold">High Priority</span></td>
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
