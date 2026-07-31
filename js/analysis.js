// js/analysis.js - এনালাইসিস মডিউল (টেবিল: তারিখের নিচে সময়)

// ==================== Firebase ইমপোর্ট ====================
import { ref, onValue, push, set, get, update } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

// ==================== Chart.js - Dynamic Script Load ====================
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
            reject(new Error('Chart.js লোড করতে ব্যর্থ হয়েছে'));
        };
        document.head.appendChild(script);
    });
}

// ==================== কনস্ট্যান্টস ====================
const SAVE_INTERVAL = 5000;
const MAX_HISTORY_DISPLAY = 20;

// ==================== গ্লোবাল ভেরিয়েবল ====================
let historyData = [];
let currentSensorData = null;
let autoSaveInterval = null;
let lastSaveTime = 0;
let combinedListenerUnsubscribe = null;
let chartInstance = null;
let chartData = {
    labels: [],
    solarVoltage: [],
    batteryVoltage: [],
    loadVoltage: [],
    solarCurrent: [],
    batteryCurrent: [],
    loadCurrent: []
};

// ==================== ইউটিলিটি ফাংশনস ====================

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleDateString('bn-BD', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return 'Invalid Time';
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleString('bn-BD', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

// ==================== লোড অ্যানালাইসিস ====================
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
            <!-- সামারি কার্ডস -->
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
            
            <!-- Chart Section -->
            <div class="history-card" style="margin-top: 15px;">
                <div class="history-header">
                    <i class="fas fa-chart-line"></i>
                    <h3>ভোল্টেজ ও কারেন্ট চার্ট</h3>
                    <div class="history-actions">
                        <button id="toggleChartBtn" class="btn-small"><i class="fas fa-exchange-alt"></i> V/A</button>
                    </div>
                </div>
                <div style="padding: 15px; width: 100%; height: 320px; position: relative;">
                    <canvas id="analysisChart"></canvas>
                </div>
            </div>
            
            <!-- History Table - তারিখের নিচে সময় -->
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
                <div style="width: 100%; overflow-x: auto; padding: 0 5px; -webkit-overflow-scrolling: touch;">
                    <table class="data-table" style="width: 100%; min-width: 650px; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">#</th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">তারিখ<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">সময়</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">সোলার<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">সোলার<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">A</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">ব্যাটারি<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">ব্যাটারি<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">A</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">লোড<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">V</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">লোড<br><span style="font-weight:normal;font-size:10px;color:#94a3b8;">A</span></th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">ডাস্ট</th>
                                <th style="padding: 10px 4px; text-align: center; white-space: nowrap; background: rgba(0,0,0,0.2);">এফিশিয়েন্সি</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <tr><td colspan="10" style="text-align: center; padding: 25px;">📥 ডাটা লোড হচ্ছে...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    try {
        await loadChartScript();
    } catch (error) {
        console.warn('Chart.js লোড না হলে চার্ট দেখাবে না:', error);
    }
    
    setupCombinedListener();
    await loadHistoryData();
    startAutoSave();
    
    setTimeout(() => {
        initChart();
    }, 500);
    
    document.getElementById("refreshHistoryBtn")?.addEventListener("click", () => loadHistoryData());
    document.getElementById("exportDataBtn")?.addEventListener("click", () => exportHistoryData());
    document.getElementById("toggleChartBtn")?.addEventListener("click", toggleChartMode);
}

// ==================== চার্ট ইনিশিয়ালাইজ ====================
function initChart() {
    const ctx = document.getElementById('analysisChart');
    if (!ctx) return;
    
    if (!Chart) {
        ctx.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">📊 চার্ট লোড করতে সমস্যা<br><small>ইন্টারনেট কানেকশন চেক করুন</small></div>';
        return;
    }
    
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    
    try {
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'সোলার V',
                        data: chartData.solarVoltage,
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'ব্যাটারি V',
                        data: chartData.batteryVoltage,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3,
                        pointRadius: 2,
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'লোড V',
                        data: chartData.loadVoltage,
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
                        labels: { 
                            color: '#cbd5e1',
                            font: { size: 11 },
                            boxWidth: 12,
                            padding: 10
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#94a3b8',
                            font: { size: 9 },
                            maxTicksLimit: 10
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        ticks: { 
                            color: '#94a3b8',
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
        console.log('✅ Chart initialized');
    } catch (error) {
        console.error('Chart error:', error);
    }
}

// ==================== চার্ট মোড টগল ====================
let chartMode = 'voltage';

function toggleChartMode() {
    if (!chartInstance || !Chart) return;
    
    chartMode = chartMode === 'voltage' ? 'current' : 'voltage';
    const btn = document.getElementById('toggleChartBtn');
    
    if (chartMode === 'voltage') {
        btn.innerHTML = '<i class="fas fa-exchange-alt"></i> V/A';
        chartInstance.data.datasets = [
            {
                label: 'সোলার V',
                data: chartData.solarVoltage,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                fill: true
            },
            {
                label: 'ব্যাটারি V',
                data: chartData.batteryVoltage,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                fill: true
            },
            {
                label: 'লোড V',
                data: chartData.loadVoltage,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                fill: true
            }
        ];
    } else {
        btn.innerHTML = '<i class="fas fa-exchange-alt"></i> V/A';
        chartInstance.data.datasets = [
            {
                label: 'সোলার A',
                data: chartData.solarCurrent,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                borderDash: [5, 3],
                fill: true
            },
            {
                label: 'ব্যাটারি A',
                data: chartData.batteryCurrent,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                borderDash: [5, 3],
                fill: true
            },
            {
                label: 'লোড A',
                data: chartData.loadCurrent,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                borderWidth: 2,
                borderDash: [5, 3],
                fill: true
            }
        ];
    }
    chartInstance.update();
}

// ==================== চার্ট আপডেট ====================
function updateChart() {
    if (!chartInstance || !Chart) return;
    
    const labels = historyData.map(item => {
        const d = new Date(item.timestamp);
        return d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
    }).reverse();
    
    const solarVoltage = historyData.map(item => item.solar_voltage || 0).reverse();
    const batteryVoltage = historyData.map(item => item.battery_voltage || 0).reverse();
    const loadVoltage = historyData.map(item => item.load_voltage || 0).reverse();
    const solarCurrent = historyData.map(item => item.solar_current || 0).reverse();
    const batteryCurrent = historyData.map(item => item.battery_current || 0).reverse();
    const loadCurrent = historyData.map(item => item.load_current || 0).reverse();
    
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

// ==================== সেন্সর লিসেনার ====================
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
    
    const unsubscribe = onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentSensorData = data;
            updateSummaryCards(data);
            updateSaveStatus(true);
        } else {
            currentSensorData = null;
            updateSaveStatus(false);
        }
    }, (error) => {
        console.error("Listener error:", error);
        updateSaveStatus(false);
    });
    
    combinedListenerUnsubscribe = unsubscribe;
}

// ==================== সামারি কার্ড আপডেট ====================
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
    const loadCurrent = parseFloat(data.load_current) || 0;
    const loadPower = loadVoltage * loadCurrent;
    
    document.getElementById('loadSummaryV').textContent = loadVoltage.toFixed(1);
    document.getElementById('loadSummaryA').textContent = loadCurrent.toFixed(2);
    document.getElementById('loadSummaryW').textContent = loadPower.toFixed(1);
}

// ==================== অটো সেভ ====================
function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
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
    
    const historyEntry = {
        timestamp: now,
        solar_voltage: parseFloat(data.solar_voltage) || 0,
        solar_current: parseFloat(data.solar_current) || 0,
        battery_voltage: parseFloat(data.battery_voltage) || 0,
        battery_current: parseFloat(data.battery_current) || 0,
        load_voltage: parseFloat(data.load_voltage) || 0,
        load_current: parseFloat(data.load_current) || 0,
        dust_level: parseFloat(data.dust_level) || 0,
        efficiency: parseFloat(data.efficiency) || 0
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
        console.error("সেভ করতে সমস্যা:", error);
    }
}

// ==================== ইতিহাস লোড ====================
async function loadHistoryData() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const tbody = document.getElementById('historyTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px;">📥 ডাটা আনছি...</td></tr>';
    
    try {
        const historyRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/history`);
        const snapshot = await get(historyRef);
        
        if (snapshot.exists()) {
            const history = snapshot.val();
            const historyArray = Object.values(history);
            historyArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            historyData = historyArray.slice(0, MAX_HISTORY_DISPLAY);
            updateHistoryTable();
            updateChart();
        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px;">📭 কোনো ডাটা নেই</td></tr>';
        }
    } catch (error) {
        console.error("ইতিহাস লোডে সমস্যা:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px; color: #ef4444;">❌ লোড করতে সমস্যা</td></tr>';
    }
}

// ==================== টেবিল আপডেট ====================
function updateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px;">📭 কোনো ডাটা নেই</td></tr>';
        return;
    }
    
    tbody.innerHTML = historyData.map((item, index) => {
        const date = formatDate(item.timestamp);
        const time = formatTime(item.timestamp);
        const dust = item.dust_level || 0;
        const eff = item.efficiency || 0;
        let dustColor = dust > 150 ? '#ef4444' : dust > 75 ? '#f59e0b' : '#10b981';
        let effColor = eff < 50 ? '#ef4444' : eff < 70 ? '#f59e0b' : '#10b981';
        
        return `
            <tr style="transition: 0.3s; border-bottom: 1px solid rgba(255,255,255,0.05);">
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
                <td style="text-align: center; padding: 8px 4px; font-weight: 500;">${(item.load_current || 0).toFixed(2)}</td>
                <td style="text-align: center; padding: 8px 4px; color: ${dustColor}; font-weight: bold;">${dust.toFixed(1)}</td>
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

// ==================== এক্সপোর্ট ====================
function exportHistoryData() {
    if (!historyData || historyData.length === 0) {
        alert('এক্সপোর্ট করার মতো ডাটা নেই');
        return;
    }
    
    const headers = ['ক্রমিক', 'তারিখ', 'সময়', 'সোলার V', 'সোলার A', 'ব্যাটারি V', 'ব্যাটারি A', 'লোড V', 'লোড A', 'ডাস্ট', 'এফিশিয়েন্সি (%)'];
    const rows = historyData.map((item, index) => [
        index + 1,
        formatDate(item.timestamp),
        formatTime(item.timestamp),
        (item.solar_voltage || 0).toFixed(2),
        (item.solar_current || 0).toFixed(2),
        (item.battery_voltage || 0).toFixed(2),
        (item.battery_current || 0).toFixed(2),
        (item.load_voltage || 0).toFixed(2),
        (item.load_current || 0).toFixed(2),
        (item.dust_level || 0).toFixed(1),
        (item.efficiency || 0).toFixed(1)
    ]);
    
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

// ==================== ক্লিনআপ ====================
export function cleanupAnalysis() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    if (combinedListenerUnsubscribe) {
        combinedListenerUnsubscribe();
        combinedListenerUnsubscribe = null;
    }
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    console.log("🧹 Analysis cleanup completed");
}

console.log("✅ Analysis.js loaded - তারিখের নিচে সময়");