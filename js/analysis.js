// js/analysis.js - Dust বাদ, Efficiency Calculated, Chart Fixed

import { ref, onValue, push, set, get } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

// ==================== Chart.js Load ====================
let Chart = null;
let chartLoaded = false;

function loadChartScript() {
    return new Promise((resolve, reject) => {
        if (typeof window.Chart !== 'undefined') {
            Chart = window.Chart;
            chartLoaded = true;
            resolve(Chart);
            return;
        }
        
        const existingScript = document.querySelector('script[src*="chart.umd"]');
        if (existingScript) {
            setTimeout(() => {
                if (typeof window.Chart !== 'undefined') {
                    Chart = window.Chart;
                    chartLoaded = true;
                    resolve(Chart);
                } else {
                    reject(new Error('Chart.js already loading but not ready'));
                }
            }, 1000);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.async = true;
        script.onload = function() {
            Chart = window.Chart;
            chartLoaded = true;
            console.log('✅ Chart.js loaded successfully');
            resolve(Chart);
        };
        script.onerror = function() {
            reject(new Error('Chart.js লোড করতে ব্যর্থ'));
        };
        document.head.appendChild(script);
    });
}

// ==================== Constants ====================
const SAVE_INTERVAL = 5000;
const MAX_HISTORY_DISPLAY = 20;

// ==================== Global ====================
let historyData = [];
let currentSensorData = null;
let autoSaveInterval = null;
let lastSaveTime = 0;
let combinedListenerUnsubscribe = null;
let chartInstance = null;
let chartMode = 'voltage';
let chartData = {
    labels: [],
    solarVoltage: [],
    batteryVoltage: [],
    loadVoltage: [],
    solarCurrent: [],
    batteryCurrent: [],
    loadCurrent: []
};

// ==================== Utility ====================
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleDateString('bn-BD', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    } catch (e) { return 'Invalid'; }
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleTimeString('bn-BD', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch (e) { return 'Invalid'; }
}

// ==================== SOC CALCULATION (Linear) ====================
// 11.0V = 0%, 13.7V = 100%
function calculateSOC(voltage) {
    let soc = ((voltage - 11.0) / 2.7) * 100;
    return Math.max(0, Math.min(100, soc));
}

// ==================== EFFICIENCY CALCULATION ====================
function calculateEfficiency(data, powerSource) {
    const loadVoltage = parseFloat(data.load_voltage) || 0;
    const loadCurrent = parseFloat(data.battery_current) || 0;
    const outputPower = loadVoltage * loadCurrent;
    
    let inputPower = 0;
    let efficiency = 0;
    
    if (powerSource === 'solar') {
        const solarVoltage = parseFloat(data.solar_voltage) || 0;
        const solarCurrent = parseFloat(data.solar_current) || 0;
        inputPower = solarVoltage * solarCurrent;
        if (inputPower > 0.1) {
            efficiency = Math.min((outputPower / inputPower) * 100, 95);
        }
    } 
    else if (powerSource === 'battery') {
        const batteryVoltage = parseFloat(data.battery_voltage) || 0;
        const batteryCurrent = parseFloat(data.battery_current) || 0;
        inputPower = batteryVoltage * batteryCurrent;
        if (inputPower > 0.1) {
            efficiency = Math.min((outputPower / inputPower) * 100, 98);
        }
    } 
    else if (powerSource === 'grid') {
        inputPower = outputPower / 0.95;
        efficiency = outputPower > 0.1 ? 95 : 0;
    }
    
    efficiency = Math.max(0, Math.min(100, efficiency));
    if (outputPower < 0.1) efficiency = 0;
    
    return { efficiency, outputPower, inputPower };
}

// ==================== Load Analysis ====================
export async function loadAnalysis() {
    const content = document.getElementById("content");
    if (!content) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        content.innerHTML = `<div class="card text-center"><p>🔴 ডিভাইস সিলেক্ট করুন</p></div>`;
        return;
    }
    
    content.innerHTML = `
        <div class="analysis-container">
            <div class="summary-container">
                <div class="summary-card solar">
                    <div class="summary-header">
                        <i class="fas fa-solar-panel"></i>
                        <h3>SOLAR SUMMARY</h3>
                    </div>
                    <div class="summary-body-dual">
                        <div class="summary-left">
                            <div class="summary-value-left">
                                <span id="solarSummaryV" class="value-large">0.0</span>
                                <span class="unit-small">V</span>
                            </div>
                            <div class="summary-value-left">
                                <span id="solarSummaryA" class="value-large">0.00</span>
                                <span class="unit-small">A</span>
                            </div>
                        </div>
                        <div class="summary-right">
                            <div class="summary-value-right">
                                <span id="solarSummaryW" class="value-huge">0.0</span>
                                <span class="unit-small">W</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="summary-card battery">
                    <div class="summary-header">
                        <i class="fas fa-battery-full"></i>
                        <h3>BATTERY SUMMARY</h3>
                    </div>
                    <div class="summary-body-dual">
                        <div class="summary-left">
                            <div class="summary-value-left">
                                <span id="batterySummaryV" class="value-large">0.0</span>
                                <span class="unit-small">V</span>
                            </div>
                            <div class="summary-value-left">
                                <span id="batterySummaryA" class="value-large">0.00</span>
                                <span class="unit-small">A</span>
                            </div>
                        </div>
                        <div class="summary-right">
                            <div class="summary-value-right">
                                <span id="batterySummaryW" class="value-huge">0.0</span>
                                <span class="unit-small">W</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="summary-card load">
                    <div class="summary-header">
                        <i class="fas fa-plug"></i>
                        <h3>LOAD SUMMARY</h3>
                    </div>
                    <div class="summary-body-dual">
                        <div class="summary-left">
                            <div class="summary-value-left">
                                <span id="loadSummaryV" class="value-large">0.0</span>
                                <span class="unit-small">V</span>
                            </div>
                            <div class="summary-value-left">
                                <span id="loadSummaryA" class="value-large">0.00</span>
                                <span class="unit-small">A</span>
                            </div>
                        </div>
                        <div class="summary-right">
                            <div class="summary-value-right">
                                <span id="loadSummaryW" class="value-huge">0.0</span>
                                <span class="unit-small">W</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="history-card" style="margin-top: 15px;">
                <div class="history-header">
                    <i class="fas fa-chart-line"></i>
                    <h3>ভোল্টেজ ও কারেন্ট চার্ট</h3>
                    <div class="history-actions">
                        <button id="toggleChartBtn" class="btn-small"><i class="fas fa-exchange-alt"></i> V/A</button>
                    </div>
                </div>
                <div id="chartContainer" style="padding: 15px; width: 100%; height: 320px; position: relative;">
                    <canvas id="analysisChart"></canvas>
                </div>
            </div>
            
            <div class="history-card" style="margin-top: 15px;">
                <div class="history-header">
                    <i class="fas fa-table"></i>
                    <h3>ঐতিহাসিক ডাটা</h3>
                    <div class="history-actions">
                        <span id="saveStatus" class="save-status">🟢 সংরক্ষণ সক্রিয়</span>
                        <button id="refreshHistoryBtn" class="btn-small"><i class="fas fa-sync-alt"></i> রিফ্রেশ</button>
                        <button id="exportDataBtn" class="btn-small"><i class="fas fa-download"></i> এক্সপোর্ট</button>
                    </div>
                </div>
                <div style="width: 100%; overflow-x: auto; padding: 0 5px;">
                    <table class="data-table" style="width: 100%; min-width: 600px; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">#</th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">তারিখ<br><span style="font-size:10px;color:#94a3b8;">সময়</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">সোলার<br><span style="font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">সোলার<br><span style="font-size:10px;color:#94a3b8;">A</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">ব্যাটারি<br><span style="font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">ব্যাটারি<br><span style="font-size:10px;color:#94a3b8;">A</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">লোড<br><span style="font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">লোড<br><span style="font-size:10px;color:#94a3b8;">A*</span></th>
                                <th style="padding: 10px 4px; text-align: center; background: rgba(0,0,0,0.2);">এফিশিয়েন্সি</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <tr><td colspan="9" style="text-align: center; padding: 25px;">📥 ডাটা লোড হচ্ছে...</td></tr>
                        </tbody>
                    </table>
                    <div style="text-align: right; padding: 5px 10px; font-size: 10px; color: #64748b;">
                        * লোড A = ব্যাটারি A | এফিশিয়েন্সি = Web App calculated
                    </div>
                </div>
            </div>
        </div>
    `;
    
    try {
        await loadChartScript();
        console.log('✅ Chart ready');
    } catch (error) {
        console.error('Chart.js load failed:', error);
    }
    
    setupCombinedListener();
    await loadHistoryData();
    startAutoSave();
    
    if (chartLoaded && Chart) {
        initChart();
    } else {
        setTimeout(() => {
            if (Chart || window.Chart) {
                Chart = window.Chart;
                initChart();
            }
        }, 1000);
    }
    
    document.getElementById("refreshHistoryBtn")?.addEventListener("click", () => loadHistoryData());
    document.getElementById("exportDataBtn")?.addEventListener("click", () => exportHistoryData());
    document.getElementById("toggleChartBtn")?.addEventListener("click", () => toggleChartMode());
}

// ==================== Chart Init ====================
function initChart() {
    const ctx = document.getElementById('analysisChart');
    if (!ctx) {
        console.warn('Chart canvas not found');
        return;
    }
    
    if (!Chart && !window.Chart) {
        console.warn('Chart.js not loaded');
        const container = document.getElementById('chartContainer');
        if (container) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">📊 চার্ট লোড হয়নি<br><small>ইন্টারনেট চেক করুন</small></div>';
        }
        return;
    }
    
    if (!Chart) {
        Chart = window.Chart;
    }
    
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    try {
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels.length > 0 ? chartData.labels : ['No Data'],
                datasets: [
                    {
                        label: 'সোলার V',
                        data: chartData.solarVoltage.length > 0 ? chartData.solarVoltage : [0],
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'ব্যাটারি V',
                        data: chartData.batteryVoltage.length > 0 ? chartData.batteryVoltage : [0],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'লোড V',
                        data: chartData.loadVoltage.length > 0 ? chartData.loadVoltage : [0],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1', font: { size: 11 }, boxWidth: 12, padding: 10 }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', font: { size: 9 }, maxTicksLimit: 10 },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
        console.log('✅ Chart initialized successfully');
    } catch (error) {
        console.error('Chart error:', error);
    }
}

// ==================== Chart Toggle ====================
function toggleChartMode() {
    if (!chartInstance) {
        console.warn('Chart not initialized');
        return;
    }
    
    chartMode = chartMode === 'voltage' ? 'current' : 'voltage';
    
    if (chartMode === 'voltage') {
        chartInstance.data.datasets = [
            { label: 'সোলার V', data: chartData.solarVoltage, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, fill: true },
            { label: 'ব্যাটারি V', data: chartData.batteryVoltage, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, fill: true },
            { label: 'লোড V', data: chartData.loadVoltage, borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, fill: true }
        ];
    } else {
        chartInstance.data.datasets = [
            { label: 'সোলার A', data: chartData.solarCurrent, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [5, 3], fill: true },
            { label: 'ব্যাটারি A', data: chartData.batteryCurrent, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [5, 3], fill: true },
            { label: 'লোড A (ব্যাটারি)', data: chartData.loadCurrent, borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.1)', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [5, 3], fill: true }
        ];
    }
    chartInstance.update();
}

// ==================== Chart Update ====================
function updateChart() {
    if (!chartInstance) return;
    
    const labels = historyData.map(item => {
        const d = new Date(item.timestamp);
        return d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
    }).reverse();
    
    const solarVoltage = historyData.map(item => item.solar_voltage || 0).reverse();
    const batteryVoltage = historyData.map(item => item.battery_voltage || 0).reverse();
    const loadVoltage = historyData.map(item => item.load_voltage || 0).reverse();
    const solarCurrent = historyData.map(item => item.solar_current || 0).reverse();
    const batteryCurrent = historyData.map(item => item.battery_current || 0).reverse();
    const loadCurrent = historyData.map(item => item.battery_current || 0).reverse();
    
    chartData.labels = labels;
    chartData.solarVoltage = solarVoltage;
    chartData.batteryVoltage = batteryVoltage;
    chartData.loadVoltage = loadVoltage;
    chartData.solarCurrent = solarCurrent;
    chartData.batteryCurrent = batteryCurrent;
    chartData.loadCurrent = loadCurrent;
    
    if (chartMode === 'voltage') {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = solarVoltage;
        chartInstance.data.datasets[1].data = batteryVoltage;
        chartInstance.data.datasets[2].data = loadVoltage;
    } else {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = solarCurrent;
        chartInstance.data.datasets[1].data = batteryCurrent;
        chartInstance.data.datasets[2].data = loadCurrent;
    }
    
    chartInstance.update('none');
}

// ==================== Sensor Listener ====================
function setupCombinedListener() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    if (combinedListenerUnsubscribe) {
        combinedListenerUnsubscribe();
        combinedListenerUnsubscribe = null;
    }
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    const unsub1 = onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentSensorData = data;
            updateSummaryCards(data);
            updateSaveStatus(true);
        } else {
            currentSensorData = null;
            updateSaveStatus(false);
        }
    });
    
    const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    const unsub2 = onValue(systemStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status && status.power_source) {
            window._currentPowerSource = status.power_source;
        }
    });
    
    combinedListenerUnsubscribe = () => {
        unsub1();
        unsub2();
    };
}

// ==================== Summary Cards ====================
function updateSummaryCards(data) {
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    const solarCurrent = parseFloat(data.solar_current) || 0;
    const solarPower = solarVoltage * solarCurrent;
    
    document.getElementById('solarSummaryV').textContent = solarVoltage.toFixed(1);
    document.getElementById('solarSummaryA').textContent = solarCurrent.toFixed(2);
    document.getElementById('solarSummaryW').textContent = solarPower.toFixed(1);
    
    const batteryVoltage = parseFloat(data.battery_voltage) || 0;
    const batteryCurrent = parseFloat(data.battery_current) || 0;
    const batteryPower = Math.abs(batteryVoltage * batteryCurrent);
    
    document.getElementById('batterySummaryV').textContent = batteryVoltage.toFixed(1);
    document.getElementById('batterySummaryA').textContent = batteryCurrent.toFixed(2);
    document.getElementById('batterySummaryW').textContent = batteryPower.toFixed(1);
    
    const loadVoltage = parseFloat(data.load_voltage) || 0;
    const loadCurrent = parseFloat(data.battery_current) || 0;
    const loadPower = loadVoltage * loadCurrent;
    
    document.getElementById('loadSummaryV').textContent = loadVoltage.toFixed(1);
    document.getElementById('loadSummaryA').textContent = loadCurrent.toFixed(2);
    document.getElementById('loadSummaryW').textContent = loadPower.toFixed(1);
}

// ==================== Auto Save ====================
function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(async () => {
        if (currentSensorData) await saveToHistory(currentSensorData);
    }, SAVE_INTERVAL);
}

async function saveToHistory(data) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const now = Date.now();
    if (now - lastSaveTime < 3000) return;
    lastSaveTime = now;
    
    const loadCurrent = parseFloat(data.battery_current) || 0;
    const powerSource = window._currentPowerSource || 'grid';
    const effData = calculateEfficiency(data, powerSource);
    
    const historyEntry = {
        timestamp: now,
        solar_voltage: parseFloat(data.solar_voltage) || 0,
        solar_current: parseFloat(data.solar_current) || 0,
        battery_voltage: parseFloat(data.battery_voltage) || 0,
        battery_current: parseFloat(data.battery_current) || 0,
        load_voltage: parseFloat(data.load_voltage) || 0,
        load_current: loadCurrent,
        efficiency: effData.efficiency,
        battery_soc: calculateSOC(parseFloat(data.battery_voltage) || 0)   // ✅ SOC যোগ
    };
    
    try {
        const historyRef = push(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/history`));
        await set(historyRef, historyEntry);
        historyData.unshift(historyEntry);
        if (historyData.length > MAX_HISTORY_DISPLAY) historyData = historyData.slice(0, MAX_HISTORY_DISPLAY);
        updateHistoryTable();
        updateChart();
        flashSaveIndicator();
    } catch (error) {
        console.error("সেভ ব্যর্থ:", error);
    }
}

// ==================== Load History ====================
async function loadHistoryData() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const tbody = document.getElementById('historyTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 25px;">📥 ডাটা আনছি...</td></tr>';
    
    try {
        const historyRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/history`);
        const snapshot = await get(historyRef);
        
        if (snapshot.exists()) {
            const history = snapshot.val();
            const historyArray = Object.values(history);
            historyArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            historyData = historyArray.slice(0, MAX_HISTORY_DISPLAY).map(item => ({
                ...item,
                load_current: item.battery_current || 0,
                efficiency: item.efficiency || 0,
                battery_soc: item.battery_soc || calculateSOC(item.battery_voltage || 0)
            }));
            
            updateHistoryTable();
            updateChart();
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 25px;">📭 কোনো ডাটা নেই</td></tr>';
        }
    } catch (error) {
        console.error("লোড ব্যর্থ:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 25px; color: #ef4444;">❌ লোড ব্যর্থ</td></tr>';
    }
}

// ==================== Update Table ====================
function updateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 25px;">📭 কোনো ডাটা নেই</td></tr>';
        return;
    }
    
    tbody.innerHTML = historyData.map((item, index) => {
        const date = formatDate(item.timestamp);
        const time = formatTime(item.timestamp);
        const eff = item.efficiency || 0;
        const loadCurrent = item.battery_current || 0;
        
        let effColor = '#94a3b8';
        if (eff > 80) effColor = '#10b981';
        else if (eff > 60) effColor = '#f59e0b';
        else if (eff > 30) effColor = '#f97316';
        else if (eff > 0) effColor = '#ef4444';
        
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="text-align: center; font-weight: bold; color: #10b981; padding: 8px 4px;">${index + 1}</td>
                <td style="text-align: center; padding: 8px 4px; white-space: nowrap; line-height: 1.6;">
                    <div style="font-size: 12px; font-weight: 500;">${date}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${time}</div>
                </td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.solar_voltage || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.solar_current || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.battery_voltage || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.battery_current || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.load_voltage || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; font-weight: 500; color: #f59e0b;">${loadCurrent.toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; color: ${effColor}; font-weight: bold;">${eff.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');
}

function updateSaveStatus(isActive) {
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
        saveStatus.innerHTML = isActive ? '🟢 সংরক্ষণ সক্রিয়' : '🔴 ডাটা আসছে না';
        saveStatus.style.color = isActive ? '#10b981' : '#ef4444';
    }
}

function flashSaveIndicator() {
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
        saveStatus.style.opacity = '0.5';
        setTimeout(() => { if (saveStatus) saveStatus.style.opacity = '1'; }, 200);
    }
}

// ==================== Export ====================
function exportHistoryData() {
    if (!historyData || historyData.length === 0) {
        alert('এক্সপোর্ট করার ডাটা নেই');
        return;
    }
    
    const headers = ['ক্রমিক', 'তারিখ', 'সময়', 'সোলার V', 'সোলার A', 'ব্যাটারি V', 'ব্যাটারি A', 'লোড V', 'লোড A', 'এফিশিয়েন্সি (%)', 'SOC (%)'];
    const rows = historyData.map((item, index) => {
        const loadCurrent = item.battery_current || 0;
        return [
            index + 1,
            formatDate(item.timestamp),
            formatTime(item.timestamp),
            (item.solar_voltage || 0).toFixed(2),
            (item.solar_current || 0).toFixed(2),
            (item.battery_voltage || 0).toFixed(2),
            (item.battery_current || 0).toFixed(2),
            (item.load_voltage || 0).toFixed(2),
            loadCurrent.toFixed(2),
            (item.efficiency || 0).toFixed(1),
            (item.battery_soc || 0).toFixed(1)
        ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `solar_data_${new Date().toISOString().slice(0,19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert(`✅ এক্সপোর্ট সম্পন্ন: ${historyData.length} রেকর্ড`);
}

// ==================== Cleanup ====================
export function cleanupAnalysis() {
    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
    if (combinedListenerUnsubscribe) { combinedListenerUnsubscribe(); combinedListenerUnsubscribe = null; }
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    console.log("🧹 Analysis cleanup");
}

console.log("✅ Analysis.js - SOC Linear (11.0-13.7V)");