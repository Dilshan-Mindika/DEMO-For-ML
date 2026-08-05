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
  CheckCircle,
  Server
} from "lucide-react";

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

interface ApiResponse {
  telemetry: TelemetryData;
  prediction: PredictionResult;
  error?: string;
}

const API_BASE_URL = "http://127.0.0.1:5000";

export default function DashboardPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Manual inputs for age & daily usage
  const [manualAge, setManualAge] = useState<number>(24);
  const [dailyUsage, setDailyUsage] = useState<number>(6.5);

  const fetchPrediction = async (age = manualAge, usage = dailyUsage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, daily_usage: usage }),
      });

      if (!res.ok) {
        throw new Error(`Backend API Error: ${res.statusText}`);
      }

      const json: ApiResponse = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }

      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to backend server.");
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
    fetchPrediction();
  }, []);

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
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight font-outfit">ApexPulse</h2>
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                Lifecycle AI
              </span>
            </div>
          </div>

          <nav className="space-y-2">
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-white bg-blue-500/10 border-l-4 border-blue-500 rounded-lg text-sm font-medium"
            >
              <Activity className="w-4 h-4 text-blue-400" />
              Overview
            </a>
          </nav>
        </div>

        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
            <div>
              <strong className="block text-xs font-semibold">AI Agent System</strong>
              <small className="text-[11px] text-gray-400">Monitoring Active</small>
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
              Enterprise Laptop Lifecycle Prediction
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time hardware telemetry & XGBoost Remaining Useful Life (RUL) inference
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 text-blue-400">
              <Laptop className="w-4 h-4" />
              <span>{telemetry?.device_model || "Detecting Hardware..."}</span>
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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Hero RUL Banner */}
          <section className="col-span-12 glass-card p-6 md:p-8 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <span className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> XGBoost RUL Forecast
              </span>
              <span className="text-xs text-gray-400">
                Updated: {prediction ? new Date(prediction.timestamp).toLocaleTimeString() : "--"}
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

              {/* Interactive Age & Usage Controls */}
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
            {/* Battery Health */}
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Battery className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase font-semibold block">
                  Battery Health
                </span>
                <h2 className="text-2xl font-bold font-outfit mt-0.5">
                  {mlInput ? `${mlInput.battery_health.toFixed(1)}%` : "--%"}
                </h2>
                <div className="text-xs text-gray-500 mt-1">
                  {mlInput ? `${mlInput.battery_cycles} Cycles` : "--"} •{" "}
                  {telemetry?.power_plugged ? "AC Plugged" : "On Battery"}
                </div>
              </div>
            </div>

            {/* SSD Health */}
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase font-semibold block">
                  SSD Health
                </span>
                <h2 className="text-2xl font-bold font-outfit mt-0.5">
                  {mlInput ? `${mlInput.ssd_health.toFixed(1)}%` : "--%"}
                </h2>
                <div className="text-xs text-gray-500 mt-1">Physical Storage Integrity</div>
              </div>
            </div>

            {/* Avg Temperature */}
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                <Thermometer className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase font-semibold block">
                  Avg CPU Temp
                </span>
                <h2 className="text-2xl font-bold font-outfit mt-0.5">
                  {mlInput ? `${mlInput.temperature.toFixed(1)} °C` : "-- °C"}
                </h2>
                <div className="text-xs text-gray-500 mt-1">LibreHardwareMonitor Sensor</div>
              </div>
            </div>

            {/* Shutdown Count */}
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase font-semibold block">
                  Shutdowns (30d)
                </span>
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
              {/* Performance Score */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span>Performance Score</span>
                  <span className="text-blue-400">
                    {mlInput ? `${mlInput.performance_score.toFixed(1)} / 100` : "--"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${mlInput?.performance_score || 0}%` }}
                  />
                </div>
                <small className="text-[11px] text-gray-500 mt-1 block">
                  CPU, RAM & Disk Load Contention
                </small>
              </div>

              {/* EDHI Score */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span>Enterprise Device Health Index (EDHI)</span>
                  <span className="text-emerald-400">
                    {mlInput ? `${mlInput.edhi.toFixed(1)} / 100` : "--"}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-700"
                    style={{ width: `${mlInput?.edhi || 0}%` }}
                  />
                </div>
                <small className="text-[11px] text-gray-500 mt-1 block">
                  Multi-Factor Holistic Integrity
                </small>
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
              <button
                onClick={() => triggerMaintenance("replace_battery")}
                disabled={loading}
                className="bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 p-4 rounded-xl text-left transition-all flex items-center gap-4 group"
              >
                <Battery className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm">Replace Battery</strong>
                  <span className="text-xs text-gray-400">Reset Health to 100% & Cycles to 0</span>
                </div>
              </button>

              <button
                onClick={() => triggerMaintenance("replace_ssd")}
                disabled={loading}
                className="bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 p-4 rounded-xl text-left transition-all flex items-center gap-4 group"
              >
                <HardDrive className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm">Replace SSD</strong>
                  <span className="text-xs text-gray-400">Reset SSD Health to 100%</span>
                </div>
              </button>

              <button
                onClick={() => triggerMaintenance("full_overhaul")}
                disabled={loading}
                className="bg-gradient-to-br from-indigo-600/30 to-emerald-600/30 border border-indigo-500/40 hover:border-indigo-400 p-4 rounded-xl text-left transition-all flex items-center gap-4 group"
              >
                <Sparkles className="w-6 h-6 text-indigo-300 group-hover:scale-110 transition-transform" />
                <div>
                  <strong className="block text-sm text-white">Full Refurbish</strong>
                  <span className="text-xs text-gray-300">New Battery + SSD + Thermal Service</span>
                </div>
              </button>
            </div>
          </section>

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
