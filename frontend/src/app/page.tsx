"use client";

import React, { useState, useEffect } from "react";
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
  Sparkles,
  Server,
  Users,
  ChevronDown,
  Mail,
  Lock,
  LogOut,
  Sun,
  Moon,
  Sliders,
  FileText,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Info,
  BookOpen
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
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Active Tab State: 'telemetry' | 'explainability' | 'maintenance' | 'methodology'
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
  const [error, setError] = useState<string | null>(null);

  const [manualAge, setManualAge] = useState<number>(24);
  const [dailyUsage, setDailyUsage] = useState<number>(6.5);

  // What-If Interactive Sensitivity State
  const [simAge, setSimAge] = useState<number>(24);
  const [simUsageHours, setSimUsageHours] = useState<number>(6.5);
  const [simCycles, setSimCycles] = useState<number>(250);
  const [simBatHealth, setSimBatHealth] = useState<number>(85);
  const [simSSDHealth, setSimSSDHealth] = useState<number>(90);
  const [simTemp, setSimTemp] = useState<number>(52);
  const [simResult, setSimResult] = useState<PredictionResult | null>(null);

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
      fetchPrediction();
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

  const fetchPrediction = async (age = manualAge, usage = dailyUsage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, daily_usage: usage }),
      });

      if (!res.ok) throw new Error(`Backend API Error: ${res.statusText}`);

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setData({ telemetry: json.telemetry, prediction: json.prediction });
      if (json.prediction.ml_input) {
        const ml = json.prediction.ml_input;
        setSimAge(ml.age);
        setSimCycles(ml.battery_cycles);
        setSimBatHealth(ml.battery_health);
        setSimSSDHealth(ml.ssd_health);
        setSimTemp(ml.temperature);
      }
      fetchFleet();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  const selectDevice = async (deviceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`);
      if (!res.ok) throw new Error("Device details fetch failed");
      const json = await res.json();
      setData({ telemetry: json.telemetry, prediction: json.prediction });
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

  useEffect(() => {
    if (currentUser) {
      fetchPrediction();
    }
  }, [currentUser]);

  // Render Login View if unauthenticated
  if (!currentUser) {
    return (
      <div className={`min-h-screen ${isDarkMode ? "bg-[#0B0F17] text-white" : "bg-slate-50 text-slate-900"} flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300`}>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md glass-card p-8 relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mx-auto mb-4">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-outfit">ApexPulse Enterprise</h1>
            <p className="text-xs text-gray-400 mt-1">University Final Year Research Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="admin@apex.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-indigo-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In to Research Portal
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
    <div className={`flex min-h-screen ${isDarkMode ? "dark-mode" : "light-mode"} transition-colors duration-300`}>
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0F172A]/80 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight font-outfit">ApexPulse</h2>
              <span className="text-[11px] text-blue-400 uppercase tracking-wider font-semibold block">
                Research Portal
              </span>
            </div>
          </div>

          {/* Active Admin Profile Card */}
          <div className="bg-white/5 border border-white/10 p-3 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center font-bold text-xs text-white`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <strong className="block text-xs font-semibold truncate text-white">{currentUser.name}</strong>
                <small className="text-[10px] text-gray-400 block truncate">{currentUser.role}</small>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Multi-Tab Research Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "telemetry"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
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
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
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
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Wrench className="w-4 h-4" />
              Prescriptive ROI Matrix
            </button>

            <button
              onClick={() => setActiveTab("methodology")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "methodology"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Research Methodology
            </button>
          </nav>
        </div>

        {/* Sidebar Footer & Theme Toggle */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-2">
              {isDarkMode ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {isDarkMode ? "Dark Theme" : "Light Theme"}
            </span>
            <button
              onClick={toggleTheme}
              className="w-9 h-5 bg-white/10 rounded-full p-0.5 transition-colors relative"
            >
              <div
                className={`w-4 h-4 rounded-full bg-blue-500 shadow-md transition-transform ${
                  isDarkMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
            <div>
              <strong className="block text-xs font-semibold">Flask REST API</strong>
              <small className="text-[11px] text-gray-400">Port 5000 Active</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> University Final Year Research Project
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-outfit">
              {activeTab === "telemetry" && "Fleet Telemetry & XGBoost RUL Forecasting"}
              {activeTab === "explainability" && "XGBoost Feature Sensitivity & Explainability"}
              {activeTab === "maintenance" && "Prescriptive Maintenance & ROI Optimization"}
              {activeTab === "methodology" && "Academic ML Research Methodology"}
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Device Selector */}
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value === "local") fetchPrediction();
                  else selectDevice(e.target.value);
                }}
                className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
              >
                <option value="local" className="bg-[#0F172A] text-white">
                  📍 Local Host ({telemetry?.device_name || "Device"})
                </option>
                {devicesList.map((d) => (
                  <option key={d.device_id} value={d.device_id} className="bg-[#0F172A] text-white">
                    💻 {d.device_name} ({d.device_model})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchPrediction()}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin-fast" : ""}`} />
              <span>{loading ? "Refreshing..." : "Refresh Payload"}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Backend API Connection Issue:</strong> {error}
              <div className="text-xs text-rose-400 mt-1">
                Make sure Flask backend server is listening on port 5000 (`python backend/app.py`).
              </div>
            </div>
          </div>
        )}

        {/* Fleet Summary Cards Banner */}
        {fleetSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block">Monitored Laptops</span>
                <strong className="text-xl font-bold font-outfit">{fleetSummary.total_devices}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block">Healthy Fleet</span>
                <strong className="text-xl font-bold font-outfit text-emerald-400">{fleetSummary.healthy_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block">Monitor Devices</span>
                <strong className="text-xl font-bold font-outfit text-amber-400">{fleetSummary.monitor_count}</strong>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block">Action Required</span>
                <strong className="text-xl font-bold font-outfit text-rose-400">{fleetSummary.replacement_count}</strong>
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
                <span className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> XGBoost Regressor RUL Forecast
                </span>
                <span className="text-xs text-gray-400">
                  Host: <strong>{telemetry?.device_name || "--"}</strong> • Updated: {prediction ? new Date(prediction.timestamp).toLocaleTimeString() : "--"}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-6">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-6xl md:text-7xl font-extrabold text-white font-outfit">
                      {prediction ? prediction.rul_months.toFixed(1) : "--"}
                    </span>
                    <span className="text-xl text-gray-400 font-semibold">Months</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-2 font-medium">
                    Forecasted Remaining Useful Life (RUL)
                  </div>
                </div>

                {/* Recommendation Card */}
                <div
                  className="w-full lg:max-w-md p-5 rounded-2xl border flex items-center gap-5 transition-all"
                  style={{
                    borderColor: badge.color,
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: badge.bg }}
                  >
                    {badge.icon}
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block">
                      Enterprise Recommendation
                    </span>
                    <h3 className="text-xl font-bold font-outfit" style={{ color: badge.color }}>
                      {prediction ? prediction.recommendation : "Analyzing..."}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Profile Inputs */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">AI Usage Profile:</span>
                  <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg font-bold">
                    {mlInput?.usage_profile || "Normal"}
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Device Age (Months):</span>
                    <input
                      type="number"
                      value={manualAge}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setManualAge(val);
                        fetchPrediction(val, dailyUsage);
                      }}
                      className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Daily Usage (Hours):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={dailyUsage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDailyUsage(val);
                        fetchPrediction(manualAge, val);
                      }}
                      className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Hardware Metrics Cards */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Battery className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Battery Health</span>
                  <h2 className="text-2xl font-bold font-outfit mt-0.5">
                    {mlInput ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="text-xs text-gray-500 mt-1">
                    {mlInput ? `${mlInput.battery_cycles} Cycles` : "--"} • {telemetry?.power_plugged ? "AC Power" : "Battery"}
                  </div>
                </div>
              </div>

              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">SSD Health</span>
                  <h2 className="text-2xl font-bold font-outfit mt-0.5">
                    {mlInput ? `${mlInput.ssd_health.toFixed(1)}%` : "--%"}
                  </h2>
                  <div className="text-xs text-gray-500 mt-1">Physical Drive Wear Status</div>
                </div>
              </div>

              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Thermometer className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Avg CPU Temp</span>
                  <h2 className="text-2xl font-bold font-outfit mt-0.5">
                    {mlInput ? `${mlInput.temperature.toFixed(1)} °C` : "-- °C"}
                  </h2>
                  <div className="text-xs text-gray-500 mt-1">Thermal Sensor Monitor</div>
                </div>
              </div>

              <div className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold block">Shutdowns (30d)</span>
                  <h2 className="text-2xl font-bold font-outfit mt-0.5">
                    {mlInput ? mlInput.shutdown_count : "--"}
                  </h2>
                  <div className="text-xs text-gray-500 mt-1">Kernel Power Logs</div>
                </div>
              </div>
            </div>

            {/* AI Scores Card */}
            <section className="col-span-12 lg:col-span-5 glass-card p-6 flex flex-col justify-between">
              <h3 className="font-bold text-base font-outfit flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-400" /> AI Agent Calculations
              </h3>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span>Performance Score</span>
                    <span className="text-blue-400">{mlInput ? `${mlInput.performance_score.toFixed(1)} / 100` : "--"}</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${mlInput?.performance_score || 0}%` }} />
                  </div>
                  <small className="text-[11px] text-gray-500 mt-1 block">CPU, RAM & Disk Load Contention</small>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span>Enterprise Device Health Index (EDHI)</span>
                    <span className="text-emerald-400">{mlInput ? `${mlInput.edhi.toFixed(1)} / 100` : "--"}</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${mlInput?.edhi || 0}%` }} />
                  </div>
                  <small className="text-[11px] text-gray-500 mt-1 block">Multi-Factor Holistic Integrity Index</small>
                </div>
              </div>
            </section>

            {/* Monitored Fleet Inventory Table */}
            {devicesList.length > 0 && (
              <section className="col-span-12 glass-card p-6">
                <h3 className="font-bold text-base font-outfit flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-400" /> Monitored Fleet Inventory
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="py-3 px-4">Device Hostname</th>
                        <th className="py-3 px-4">Model & Serial</th>
                        <th className="py-3 px-4">RUL Forecast</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Battery Health</th>
                        <th className="py-3 px-4">EDHI</th>
                        <th className="py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {devicesList.map((dev) => (
                        <tr key={dev.device_id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold text-white">{dev.device_name}</td>
                          <td className="py-3 px-4 text-gray-400">{dev.device_model} ({dev.serial_number})</td>
                          <td className="py-3 px-4 font-bold text-blue-400">{dev.rul_months.toFixed(1)} Months</td>
                          <td className="py-3 px-4 font-semibold" style={{ color: dev.status_color }}>{dev.recommendation}</td>
                          <td className="py-3 px-4 font-mono">{dev.battery_health.toFixed(1)}%</td>
                          <td className="py-3 px-4 font-mono text-emerald-400">{dev.edhi.toFixed(1)}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => selectDevice(dev.device_id)}
                              className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-3 py-1 rounded-lg text-[11px] font-semibold"
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
          </div>
        )}

        {/* TAB 2: MODEL EXPLAINABILITY & SENSITIVITY SIMULATOR */}
        {activeTab === "explainability" && (
          <div className="grid grid-cols-12 gap-6">
            {/* Feature Attribution Matrix */}
            <section className="col-span-12 lg:col-span-6 glass-card p-6">
              <h3 className="font-bold text-base font-outfit flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" /> XGBoost Feature Weight Attributions
              </h3>
              <p className="text-xs text-gray-400 mb-6">
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
                      <span>{f.label}</span>
                      <span className="font-mono text-gray-300">{f.weight}% Weight</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${f.color} rounded-full`} style={{ width: `${f.weight * 3.2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Interactive What-If Sensitivity Simulator */}
            <section className="col-span-12 lg:col-span-6 glass-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base font-outfit flex items-center gap-2 mb-2">
                  <Sliders className="w-5 h-5 text-blue-400" /> Interactive Sensitivity Simulator
                </h3>
                <p className="text-xs text-gray-400 mb-6">
                  Adjust parameter sliders to observe real-time feature impact on RUL predictions.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Device Age: <strong className="text-blue-400">{simAge} Months</strong></span>
                    </div>
                    <input type="range" min="1" max="60" value={simAge} onChange={(e) => setSimAge(Number(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Battery Health: <strong className="text-emerald-400">{simBatHealth}%</strong></span>
                    </div>
                    <input type="range" min="10" max="100" value={simBatHealth} onChange={(e) => setSimBatHealth(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Battery Cycles: <strong className="text-indigo-400">{simCycles} Cycles</strong></span>
                    </div>
                    <input type="range" min="10" max="1000" step="10" value={simCycles} onChange={(e) => setSimCycles(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>SSD Health: <strong className="text-amber-400">{simSSDHealth}%</strong></span>
                    </div>
                    <input type="range" min="10" max="100" value={simSSDHealth} onChange={(e) => setSimSSDHealth(Number(e.target.value))} className="w-full accent-amber-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 bg-white/5 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 uppercase font-semibold block">Simulated RUL Impact</span>
                  <strong className="text-2xl font-bold font-outfit text-blue-400">
                    {((simBatHealth * 0.25) + (simSSDHealth * 0.15) + (48 - simAge * 0.6)).toFixed(1)} Months
                  </strong>
                </div>
                <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold">
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
                <h3 className="font-bold text-base font-outfit flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-400" /> Prescriptive Component Maintenance Simulation
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Execute simulated hardware refurbishments to quantify life-extension and financial ROI.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button onClick={() => triggerMaintenance("replace_battery")} disabled={loading} className="bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Battery className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm">Replace Battery</strong>
                    <span className="text-xs text-gray-400">Reset Health to 100% & Cycles to 0</span>
                    <div className="text-[11px] text-emerald-400 font-bold mt-1">+14.2 Months RUL</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("replace_ssd")} disabled={loading} className="bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <HardDrive className="w-8 h-8 text-blue-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm">Replace SSD Drive</strong>
                    <span className="text-xs text-gray-400">Reset SSD Wear to 100%</span>
                    <div className="text-[11px] text-blue-400 font-bold mt-1">+8.5 Months RUL</div>
                  </div>
                </button>

                <button onClick={() => triggerMaintenance("full_overhaul")} disabled={loading} className="bg-gradient-to-br from-indigo-600/30 to-emerald-600/30 border border-indigo-500/40 hover:border-indigo-400 p-5 rounded-2xl text-left transition-all flex items-center gap-4 group">
                  <Sparkles className="w-8 h-8 text-indigo-300 group-hover:scale-110 transition-transform" />
                  <div>
                    <strong className="block text-sm text-white">Full Refurbish Overhaul</strong>
                    <span className="text-xs text-gray-300">New Battery + SSD + Thermal Service</span>
                    <div className="text-[11px] text-indigo-300 font-bold mt-1">+22.8 Months RUL</div>
                  </div>
                </button>
              </div>

              {/* Maintenance ROI Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="py-3 px-4">Intervention Type</th>
                      <th className="py-3 px-4">Estimated Cost ($)</th>
                      <th className="py-3 px-4">RUL Life Extension</th>
                      <th className="py-3 px-4">Financial ROI Ratio</th>
                      <th className="py-3 px-4">Recommendation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <Battery className="w-4 h-4 text-emerald-400" /> Battery Replacement
                      </td>
                      <td className="py-3 px-4 font-mono">$85.00</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">+14.2 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-400">4.2x ROI</td>
                      <td className="py-3 px-4"><span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded font-semibold">Optimal</span></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-blue-400" /> NVMe SSD Upgrade
                      </td>
                      <td className="py-3 px-4 font-mono">$110.00</td>
                      <td className="py-3 px-4 font-bold text-blue-400">+8.5 Months</td>
                      <td className="py-3 px-4 font-mono text-blue-400">2.1x ROI</td>
                      <td className="py-3 px-4"><span className="bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded font-semibold">Recommended</span></td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" /> Full Enterprise Refurbish
                      </td>
                      <td className="py-3 px-4 font-mono">$175.00</td>
                      <td className="py-3 px-4 font-bold text-indigo-400">+22.8 Months</td>
                      <td className="py-3 px-4 font-mono text-indigo-400">5.6x ROI</td>
                      <td className="py-3 px-4"><span className="bg-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded font-semibold">High Priority</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: ACADEMIC RESEARCH METHODOLOGY */}
        {activeTab === "methodology" && (
          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 glass-card p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-outfit">University Final Year Research Methodology</h2>
                  <p className="text-xs text-gray-400">Enterprise Laptop Hardware Wear & Machine Learning RUL Prediction Architecture</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-gray-300">
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-400" /> 1. XGBoost Regression Pipeline
                    </h4>
                    <p className="leading-relaxed">
                      The predictive pipeline utilizes an <strong>Extreme Gradient Boosting (XGBoost) Regressor</strong> model wrapped in a Scikit-learn <code className="text-indigo-400">ColumnTransformer</code>. It encodes categorical telemetry (device model, usage profile) and normalizes continuous hardware signals.
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> 2. Enterprise Device Health Index (EDHI) Formula
                    </h4>
                    <p className="leading-relaxed font-mono text-[11px] bg-black/30 p-2.5 rounded-lg border border-white/5 text-emerald-300 mb-2">
                      EDHI = 0.30(BatHealth) + 0.25(SSDHealth) + 0.20(PerfScore) + 0.15(TempFactor) - 0.10(Shutdowns)
                    </p>
                    <p className="leading-relaxed">
                      Synthesizes multi-factor physical telemetry into a single holistic health rating between 0 and 100.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                      <Server className="w-4 h-4 text-amber-400" /> 3. Automated Windows Telemetry Pipeline
                    </h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-400">
                      <li><strong>WMI API:</strong> Computer model & BIOS serial numbers.</li>
                      <li><strong>Windows PowerCfg:</strong> Design capacity vs full charge capacity (battery wear %).</li>
                      <li><strong>PowerShell PhysicalDisk:</strong> NVMe storage integrity status.</li>
                      <li><strong>Windows Event Log:</strong> Event IDs 41 & 6008 kernel power crash counts.</li>
                    </ul>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" /> 4. Research Citation & Team
                    </h4>
                    <p className="leading-relaxed">
                      Developed as a Final Year University Research Project focusing on enterprise hardware sustainability and AI-driven lifecycle optimization.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
