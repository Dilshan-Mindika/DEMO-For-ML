/**
 * APEXPULSE ENTERPRISE DASHBOARD JAVASCRIPT
 * Handles real-time telemetry fetching, ML prediction rendering, and component maintenance simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch on page load
    fetchTelemetryAndPrediction();

    // Refresh button event listener
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchTelemetryAndPrediction();
        });
    }
});

let currentMLInput = null;
``
/**
 * Fetches real-time telemetry and runs XGBoost RUL prediction via backend API.
 */
async function fetchTelemetryAndPrediction() {
    const refreshIcon = document.getElementById('refresh-icon');
    if (refreshIcon) refreshIcon.classList.add('spinning');

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ age: 24, daily_usage: 6.5 })
        });

        if (!response.ok) {
            throw new Error(`API response error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        currentMLInput = data.prediction.ml_input;
        renderDashboard(data);

    } catch (error) {
        console.error('Error fetching telemetry/prediction:', error);
        alert(`Dashboard Telemetry Error: ${error.message}`);
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('spinning');
    }
}

/**
 * Renders data into UI components.
 */
function renderDashboard(data) {
    const { telemetry, prediction } = data;
    const mlInput = prediction.ml_input;

    // Header & Timestamp
    document.getElementById('device-model-header').innerText = telemetry.device_model || 'Standard Laptop';
    document.getElementById('last-updated').innerText = `Last Updated: ${new Date().toLocaleTimeString()}`;

    // RUL Prediction Gauge
    const rulVal = document.getElementById('rul-value');
    rulVal.innerText = prediction.rul_months.toFixed(1);

    // Recommendation Badge & Colors
    const recBadge = document.getElementById('recommendation-badge');
    const recText = document.getElementById('recommendation-text');
    const recIconI = document.getElementById('rec-icon-i');

    recText.innerText = prediction.recommendation;
    recText.style.color = prediction.status_color;

    if (recBadge) {
        recBadge.style.borderColor = prediction.status_color;
    }

    // Set icon based on status level
    if (prediction.status_level === 'healthy') {
        recIconI.className = 'fa-solid fa-shield-heart';
        recIconI.parentElement.style.color = '#10B981';
        recIconI.parentElement.style.background = 'rgba(16, 185, 129, 0.15)';
    } else if (prediction.status_level === 'monitor') {
        recIconI.className = 'fa-solid fa-eye';
        recIconI.parentElement.style.color = '#3B82F6';
        recIconI.parentElement.style.background = 'rgba(59, 130, 246, 0.15)';
    } else if (prediction.status_level === 'plan_replacement') {
        recIconI.className = 'fa-solid fa-clock-rotate-left';
        recIconI.parentElement.style.color = '#F59E0B';
        recIconI.parentElement.style.background = 'rgba(245, 158, 11, 0.15)';
    } else {
        recIconI.className = 'fa-solid fa-triangle-exclamation';
        recIconI.parentElement.style.color = '#EF4444';
        recIconI.parentElement.style.background = 'rgba(239, 68, 68, 0.15)';
    }

    // Usage Profile Details
    document.getElementById('usage-profile-val').innerText = mlInput.usage_profile;
    document.getElementById('device-age-val').innerText = `${mlInput.age} Months`;
    document.getElementById('usage-hours-val').innerText = `${mlInput.usage_hours.toLocaleString()} hrs`;

    // Metric Cards
    document.getElementById('battery-health-val').innerText = `${mlInput.battery_health.toFixed(1)}%`;
    document.getElementById('battery-cycles-val').innerText = `${mlInput.battery_cycles} Cycles`;
    document.getElementById('battery-state-val').innerText = telemetry.power_plugged ? 'AC Plugged' : 'On Battery';

    document.getElementById('ssd-health-val').innerText = `${mlInput.ssd_health.toFixed(1)}%`;
    document.getElementById('temp-val').innerText = `${mlInput.temperature.toFixed(1)} °C`;
    document.getElementById('shutdown-val').innerText = `${mlInput.shutdown_count}`;

    // AI Agent Score Bars
    const perfScore = mlInput.performance_score;
    document.getElementById('perf-score-text').innerText = `${perfScore.toFixed(1)} / 100`;
    document.getElementById('perf-score-bar').style.width = `${perfScore}%`;

    const edhiScore = mlInput.edhi;
    document.getElementById('edhi-score-text').innerText = `${edhiScore.toFixed(1)} / 100`;
    document.getElementById('edhi-score-bar').style.width = `${edhiScore}%`;

    // Render Feature Matrix Table
    renderFeatureTable(mlInput);
}

/**
 * Triggers Component-Level Maintenance Simulation.
 */
async function triggerMaintenance(action) {
    if (!currentMLInput) {
        alert('Please wait for initial telemetry data to load before triggering maintenance.');
        return;
    }

    const refreshIcon = document.getElementById('refresh-icon');
    if (refreshIcon) refreshIcon.classList.add('spinning');

    try {
        const response = await fetch('/api/simulate-maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: action,
                ml_input: currentMLInput
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        currentMLInput = data.prediction.ml_input;

        // Render updated prediction
        renderDashboard({
            telemetry: {
                device_model: currentMLInput.device_model,
                power_plugged: true
            },
            prediction: data.prediction
        });

    } catch (error) {
        console.error('Maintenance Simulation Error:', error);
        alert(`Maintenance Error: ${error.message}`);
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('spinning');
    }
}

/**
 * Populates the feature vector table.
 */
function renderFeatureTable(mlInput) {
    const tbody = document.getElementById('feature-table-body');
    if (!tbody) return;

    const rows = [
        { name: 'device_model', val: mlInput.device_model, type: 'Categorical', src: 'WMI Query' },
        { name: 'usage_profile', val: mlInput.usage_profile, type: 'Categorical', src: 'AI Agent Classifier' },
        { name: 'age', val: `${mlInput.age} months`, type: 'Numeric', src: 'Lifecycle History' },
        { name: 'usage_hours', val: `${mlInput.usage_hours} hrs`, type: 'Numeric', src: 'Operational Log' },
        { name: 'battery_cycles', val: mlInput.battery_cycles, type: 'Numeric', src: 'PowerCfg Report' },
        { name: 'battery_health', val: `${mlInput.battery_health}%`, type: 'Numeric', src: 'PowerCfg Report' },
        { name: 'ssd_health', val: `${mlInput.ssd_health}%`, type: 'Numeric', src: 'PowerShell PhysicalDisk' },
        { name: 'temperature', val: `${mlInput.temperature} °C`, type: 'Numeric', src: 'LibreHardwareMonitor API' },
        { name: 'performance_score', val: `${mlInput.performance_score} / 100`, type: 'Numeric', src: 'AI Agent Evaluator' },
        { name: 'shutdown_count', val: mlInput.shutdown_count, type: 'Numeric', src: 'Windows System Event Log' },
        { name: 'edhi', val: `${mlInput.edhi} / 100`, type: 'Numeric', src: 'Enterprise Health Index Agent' }
    ];

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><strong>${r.name}</strong></td>
            <td><code>${r.val}</code></td>
            <td><span class="badge-profile">${r.type}</span></td>
            <td><small>${r.src}</small></td>
        </tr>
    `).join('');
}
