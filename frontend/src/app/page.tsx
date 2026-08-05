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
  Clock,
  Sparkles,
  Laptop,
  Server,
  Users,
  ChevronDown,
  Lock,
  Mail,
  Key,
  LogOut,
  UserCheck
} from "lucide-react";
import { authenticateUser, HARDCODED_ADMIN_USERS, UserAccount } from "./auth";

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

const API_BASE_URL = "http://127.0.0.1:5000";

export default function DashboardPage() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>("admin@apex.com");
  const [loginPassword, setLoginPassword] = useState<string>("admin123");
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard Data State
  const [data, setData] = useState<{ telemetry: TelemetryData; prediction: PredictionResult } | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [devicesList, setDevicesList] = useState<DeviceSummary[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [manualAge, setManualAge] = useState<number>(24);
  const [dailyUsage, setDailyUsage] = useState<number>(6.5);

  useEffect(() => {
    const savedUser = localStorage.getItem("apex_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const user = authenticateUser(loginEmail, loginPassword);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem("apex_user", JSON.stringify(user));
      fetchPrediction();
    } else {
      setAuthError("Invalid administrator credentials. Please check email or password.");
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
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md glass-card p-8 relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mx-auto mb-4">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-outfit text-white">ApexPulse Enterprise</h1>
            <p className="text-xs text-gray-400 mt-1">Predictive Maintenance & Fleet Monitoring Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="admin@apex.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
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

          {/* Quick Select Preset Admin Credentials */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-3 text-center">
              Quick Login (5 Hardcoded Accounts)
            </span>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {Object.values(HARDCODED_ADMIN_USERS).map((acc) => (
                <button
                  key={acc.user.email}
                  onClick={() => {
                    setLoginEmail(acc.user.email);
                    setLoginPassword(acc.pass);
                  }}
                  className="w-full text-left bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 p-2.5 rounded-lg text-xs flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${acc.user.avatarColor}`} />
                    <div>
                      <strong className="block text-white font-medium">{acc.user.name}</strong>
                      <span className="text-[10px] text-gray-400">{acc.user.email}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-white/10 group-hover:bg-blue-500/20 text-gray-300 px-2 py-0.5 rounded font-mono">
                    {acc.pass}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A]/80 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight font-outfit">ApexPulse</h2>
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                Enterprise Fleet AI
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

          <nav className="space-y-2">
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-white bg-blue-500/10 border-l-4 border-blue-500 rounded-lg text-sm font-medium"
            >
              <Activity className="w-4 h-4 text-blue-400" />
              Fleet Overview
            </a>
          </nav>
        </div>

        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
            <div>
              <strong className="block text-xs font-semibold">Fleet Collector API</strong>
              <small className="text-[11px] text-gray-400">Listening on :5000</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-outfit">
              Enterprise Laptop Fleet Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Multi-device hardware telemetry monitoring & XGBoost RUL predictive maintenance
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Device Selector */}
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value === "local") fetchPrediction();
                  else selectDevice(e.target.value);
                }}
                className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-xs font-semibold text-white focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
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
              <span>{loading ? "Refreshing..." : "Refresh Telemetry"}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Backend Connection Issue:</strong> {error}
              <div className="text-xs text-rose-400 mt-1">
                Make sure Flask backend is running (`python backend/app.py` on port 5000).
              </div>
            </div>
          </div>
        )}

        {/* Fleet Summary Banner */}
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Hero RUL Banner */}
          <section className="col-span-12 glass-card p-6 md:p-8 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <span className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> XGBoost RUL Forecast
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

              {/* Recommendation Box */}
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

            {/* Profile Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Usage Profile:</span>
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

          {/* Metrics Grid */}
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
                  {mlInput ? `${mlInput.battery_cycles} Cycles` : "--"} • {telemetry?.power_plugged ? "AC Plugged" : "On Battery"}
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
                <div className="text-xs text-gray-500 mt-1">Physical Storage Integrity</div>
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
                <div className="text-xs text-gray-500 mt-1">Thermal Monitoring Sensor</div>
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
                <div className="text-xs text-gray-500 mt-1">Kernel Power Crash Logs</div>
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
                <small className="text-[11px] text-gray-500 mt-1 block">Multi-Factor Holistic Integrity</small>
              </div>
            </div>
          </section>

          {/* Component Maintenance Simulation */}
          <section className="col-span-12 glass-card p-6">
            <div className="mb-4">
              <h3 className="font-bold text-base font-outfit flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-400" /> Component-Level Maintenance Simulation
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Simulate part replacements (e.g. Battery reset to 100% health & 0 cycles) to evaluate instant RUL extension while preserving device history.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button onClick={() => triggerMaintenance("replace_battery")} disabled={loading} className="bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 p-4 rounded-xl text-left transition-all flex items-center gap-4 group">
                <Battery className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm">Replace Battery</strong>
                  <span className="text-xs text-gray-400">Reset Health to 100% & Cycles to 0</span>
                </div>
              </button>

              <button onClick={() => triggerMaintenance("replace_ssd")} disabled={loading} className="bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 p-4 rounded-xl text-left transition-all flex items-center gap-4 group">
                <HardDrive className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm">Replace SSD</strong>
                  <span className="text-xs text-gray-400">Reset SSD Health to 100%</span>
                </div>
              </button>

              <button onClick={() => triggerMaintenance("full_overhaul")} disabled={loading} className="bg-gradient-to-br from-indigo-600/30 to-emerald-600/30 border border-indigo-500/40 hover:border-indigo-400 p-4 rounded-xl text-left transition-all flex items-center gap-4 group">
                <Sparkles className="w-6 h-6 text-indigo-300 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm text-white">Full Refurbish</strong>
                  <span className="text-xs text-gray-300">New Battery + SSD + Thermal Service</span>
                </div>
              </button>
            </div>
          </section>

          {/* Fleet Inventory Table */}
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

          {/* Feature Matrix Table */}
          <section className="col-span-12 glass-card p-6">
            <h3 className="font-bold text-base font-outfit flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-gray-400" /> Feature Vector Passed to XGBoost Model
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-3 px-4">Feature Name</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Data Type</th>
                    <th className="py-3 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {mlInput && (
                    <>
                      <tr>
                        <td className="py-3 px-4 font-semibold">device_model</td>
                        <td className="py-3 px-4 font-mono text-blue-400">{mlInput.device_model}</td>
                        <td className="py-3 px-4 text-indigo-400">Categorical</td>
                        <td className="py-3 px-4 text-gray-400">WMI Query</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">usage_profile</td>
                        <td className="py-3 px-4 font-mono text-indigo-400">{mlInput.usage_profile}</td>
                        <td className="py-3 px-4 text-indigo-400">Categorical</td>
                        <td className="py-3 px-4 text-gray-400">AI Agent Classifier</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">age</td>
                        <td className="py-3 px-4 font-mono">{mlInput.age} months</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">Lifecycle History</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">usage_hours</td>
                        <td className="py-3 px-4 font-mono">{mlInput.usage_hours} hrs</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">Operational Log</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">battery_cycles</td>
                        <td className="py-3 px-4 font-mono">{mlInput.battery_cycles}</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">PowerCfg Report</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">battery_health</td>
                        <td className="py-3 px-4 font-mono">{mlInput.battery_health}%</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">PowerCfg Report</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">ssd_health</td>
                        <td className="py-3 px-4 font-mono">{mlInput.ssd_health}%</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">PowerShell PhysicalDisk</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">temperature</td>
                        <td className="py-3 px-4 font-mono">{mlInput.temperature} °C</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">LibreHardwareMonitor API</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">performance_score</td>
                        <td className="py-3 px-4 font-mono">{mlInput.performance_score} / 100</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">AI Agent Evaluator</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">shutdown_count</td>
                        <td className="py-3 px-4 font-mono">{mlInput.shutdown_count}</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">Windows System Event Log</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold">edhi</td>
                        <td className="py-3 px-4 font-mono">{mlInput.edhi} / 100</td>
                        <td className="py-3 px-4 text-emerald-400">Numeric</td>
                        <td className="py-3 px-4 text-gray-400">Enterprise Health Index Agent</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
