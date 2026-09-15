// js/dashboard.js - SOC calculation JS থেকে (ESP32 থেকে নয়)
// Battery Full হলে Charging indicator বন্ধ
// Battery % voltage থেকে calculate হয়

export async function loadDashboard() {
    const content = document.getElementById("content");
    if (!content) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    const networkStatus = document.getElementById('network_status');
    if (networkStatus) {
        if (!database || !currentUserId || !currentDeviceId) {
            networkStatus.textContent = '⏳ কনফিগার হচ্ছে...';
            networkStatus.className = 'network-status configuring';
            networkStatus.style.color = '#f59e0b';
        } else {
            networkStatus.textContent = '✅ কানেক্টেড';
            networkStatus.className = 'network-status connected';
            networkStatus.style.color = '#10b981';
        }
    }
    
    if (!database || !currentUserId || !currentDeviceId) {
        content.innerHTML = `
            <div class="card text-center">
                <p>🔴 ডিভাইস সিলেক্ট করুন</p>
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <!-- SAFETY ALERT -->
        <div id="safety_alert" class="safety-alert"></div>

        <!-- STATUS BAR -->
        <div class="status-bar">
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-robot"></i>
                    <span class="status-label">মোড:</span>
                </div>
                <div class="status-value">
                    <span id="mode_indicator" class="auto-indicator">অটো মোড</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-wifi"></i>
                    <span class="status-label">নেটওয়ার্ক:</span>
                </div>
                <div class="status-value">
                    <span id="network_status" class="network-status connected">✅ কানেক্টেড</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-leaf"></i>
                    <span class="status-label">দক্ষতা:</span>
                </div>
                <div class="status-value">
                    <span id="efficiency">-- %</span>
                </div>
            </div>
            
            <!-- BATTERY + Charging Status -->
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-battery-half"></i>
                    <span class="status-label">ব্যাটারি:</span>
                </div>
                <div class="status-value">
                    <span id="battery_soc" class="battery_percentage">0%</span>
                    <span id="battery_charge_status" class="charge-status normal">⚪ স্বাভাবিক</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-brush"></i>
                    <span class="status-label">ক্লিনিং:</span>
                </div>
                <div class="status-value">
                    <span id="cleaning_status_indicator" class="cleaning-status idle">⏹ নিষ্ক্রিয়</span>
                    <span id="cleaning_dot" class="cleaning-dot idle-dot"></span>
                </div>
            </div>
        </div>

        <!-- BATTERY STATUS CARD -->
        <div class="battery-status-card">
            <div class="card-header">
                <h3><i class="fas fa-battery-full"></i> ব্যাটারি স্ট্যাটাস</h3>
            </div>
            <div class="card-body">
                <div class="battery-display">
                    <div class="battery-percentage">
                        <span id="battery_percentage_value" class="percentage-value">0</span>
                        <span class="percentage-symbol">%</span>
                    </div>
                    <div class="battery-progress">
                        <div class="battery-progress-track">
                            <div id="batteryProgressBar" class="battery-progress-bar" style="width: 0%"></div>
                        </div>
                        <div class="battery-labels">
                            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                        </div>
                    </div>
                    <div class="battery-info-row">
                        <div class="battery-info-item">
                            <div class="info-label">ভোল্টেজ</div>
                            <div class="info-value" id="battery_voltage">0.00 <span class="unit">V</span></div>
                        </div>
                        <div class="battery-info-item">
                            <div class="info-label">স্বাস্থ্য</div>
                            <div id="batteryHealthStatus" class="info-value health-text">সুস্থ</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- CURRENT SOURCE -->
        <div class="current-source-wrapper">
            <span class="current-source-label">বর্তমান সোর্স:</span>
            <span id="currentSourceSpan" class="current-source solar">সোলার → ব্যাটারি → লোড</span>
        </div>
        
        <!-- POWER FLOW SVG -->
        <div class="power-flow-wrapper">
            <svg viewBox="0 0 500 550" width="100%" height="100%" class="power-flow-svg">
                <defs>
                    <filter id="glowSolar" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="glowGrid" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="glowBattery" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <style>
                        @keyframes flowMove {
                            0% { stroke-dashoffset: 30; }
                            100% { stroke-dashoffset: 0; }
                        }
                    </style>
                </defs>
                
                <line x1="140" y1="180" x2="140" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="140" y1="220" x2="250" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="360" y1="180" x2="360" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="360" y1="220" x2="250" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="250" y1="220" x2="250" y2="280" stroke="#334155" stroke-width="4"/>
                <line x1="250" y1="400" x2="250" y2="450" stroke="#334155" stroke-width="4"/>
                
                <path id="solarToBatteryFlow" d="M140 180 L140 220 L250 220 L250 280" stroke="#f97316" stroke-width="5" fill="none" stroke-dasharray="12 18" stroke-linecap="round" style="display: none;"/>
                <path id="gridToBatteryFlow" d="M360 180 L360 220 L250 220 L250 280" stroke="#3b82f6" stroke-width="5" fill="none" stroke-dasharray="12 18" stroke-linecap="round" style="display: none;"/>
                <line id="batteryToLoadFlow" x1="250" y1="400" x2="250" y2="450" stroke="#10b981" stroke-width="5" stroke-dasharray="12 18" stroke-linecap="round" style="display: none;"/>
                
                <g id="solarGroup">
                    <rect id="solarBox" x="70" y="90" width="140" height="90" rx="16" fill="#1e293b" stroke="#334155" stroke-width="3"/>
                    <text x="140" y="125" text-anchor="middle" font-size="32">☀️</text>
                    <text x="140" y="150" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">SOLAR</text>
                    <text id="solarVoltageText" x="140" y="168" text-anchor="middle" fill="#64748b" font-size="12">0.0 V</text>
                </g>
                
                <g id="gridGroup">
                    <rect id="gridBox" x="290" y="90" width="140" height="90" rx="16" fill="#1e293b" stroke="#334155" stroke-width="3"/>
                    <text x="360" y="125" text-anchor="middle" font-size="32">🏭</text>
                    <text x="360" y="150" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">GRID</text>
                    <text id="gridStatusText" x="360" y="168" text-anchor="middle" fill="#64748b" font-size="12">স্ট্যান্ডবাই</text>
                </g>
                
                <g id="batteryGroup">
                    <rect id="batteryBox" x="145" y="280" width="210" height="120" rx="20" fill="#1e293b" stroke="#10b981" stroke-width="4"/>
                    <text x="250" y="320" text-anchor="middle" font-size="36">🔋</text>
                    <text x="250" y="350" text-anchor="middle" fill="#e2e8f0" font-size="18" font-weight="bold">BATTERY</text>
                    <text id="batteryPercentageText" x="250" y="382" text-anchor="middle" fill="#10b981" font-size="26" font-weight="bold">0%</text>
                </g>
                
                <g id="loadGroup">
                    <rect id="loadBox" x="170" y="450" width="160" height="80" rx="16" fill="#1e293b" stroke="#06b6d4" stroke-width="3"/>
                    <text x="250" y="482" text-anchor="middle" font-size="28">⚡</text>
                    <text x="250" y="508" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">LOAD</text>
                    <text id="loadPowerText" x="250" y="522" text-anchor="middle" fill="#64748b" font-size="11">0 W</text>
                </g>
            </svg>
        </div>
    `;
    
    setupDashboardListeners();
    await fetchDashboardData();
    setupSafetyAlertNotification();
}

// ==================== SOC CALCULATION (JS থেকে) ====================
// 11.0V = 0%, 13.7V = 100%
function calculateSOC(voltage) {
    let soc = ((voltage - 11.0) / 2.7) * 100;
    return Math.max(0, Math.min(100, soc));
}

// ==================== BATTERY CHARGING STATUS ====================
function getBatteryChargeStatus(data) {
    // ✅ Voltage থেকে SOC calculate
    const batteryVoltage = parseFloat(data.battery_voltage) || 0;
    const batterySOC = calculateSOC(batteryVoltage);
    
    const batteryCurrent = parseFloat(data.battery_current) || 0;
    const solarCurrent = parseFloat(data.solar_current) || 0;
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    
    // Priority 1: Battery Full
    const isFull = (batterySOC >= 95) || (batteryVoltage >= 13.7);
    
    // Priority 2: Charging (Full না হলে)
    const isCharging = !isFull && 
                       (solarVoltage > 13.0) && 
                       (batteryCurrent > 0.1) && 
                       (solarCurrent > 0.1);
    
    // Priority 3: Critical / Low
    const isCritical = batterySOC < 15;
    const isLow = batterySOC < 30 && batterySOC >= 15;
    
    if (isFull) {
        return {
            label: '✅ ফুল',
            color: '#3b82f6',
            className: 'charge-status full'
        };
    } else if (isCharging) {
        return {
            label: '⚡ চার্জিং',
            color: '#10b981',
            className: 'charge-status charging'
        };
    } else if (isCritical) {
        return {
            label: '🔴 খুব কম',
            color: '#ef4444',
            className: 'charge-status critical'
        };
    } else if (isLow) {
        return {
            label: '⚠️ কম',
            color: '#f59e0b',
            className: 'charge-status low'
        };
    } else {
        return {
            label: '⚪ স্বাভাবিক',
            color: '#94a3b8',
            className: 'charge-status normal'
        };
    }
}

// ==================== UPDATE CHARGING STATUS ====================
function updateChargingStatusUI(data) {
    const statusData = getBatteryChargeStatus(data);
    
    const chargeStatusEl = document.getElementById('battery_charge_status');
    if (chargeStatusEl) {
        chargeStatusEl.textContent = statusData.label;
        chargeStatusEl.className = statusData.className;
        chargeStatusEl.style.color = statusData.color;
    }
}

// ==================== EFFICIENCY ====================
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

function updateEfficiencyDisplay(data, powerSource) {
    const efficiencyElement = document.getElementById('efficiency');
    if (!efficiencyElement) return;
    
    const effData = calculateEfficiency(data, powerSource);
    const efficiency = effData.efficiency;
    
    if (efficiency > 0) {
        efficiencyElement.textContent = efficiency.toFixed(1) + ' %';
        if (efficiency > 80) efficiencyElement.style.color = '#10b981';
        else if (efficiency > 60) efficiencyElement.style.color = '#f59e0b';
        else if (efficiency > 30) efficiencyElement.style.color = '#f97316';
        else efficiencyElement.style.color = '#ef4444';
    } else {
        efficiencyElement.textContent = '-- %';
        efficiencyElement.style.color = '#64748b';
    }
}

// ==================== SAFETY ALERT ====================
function setupSafetyAlertNotification() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
            get(systemStatusRef).then((statusSnapshot) => {
                if (statusSnapshot.exists()) checkAndShowAlert(data, statusSnapshot.val());
            }).catch(() => checkAndShowAlert(data, null));
        }
    });
}

let lastAlertTime = 0;
let lastAlertType = '';

function checkAndShowAlert(data, status = null) {
    const alertDiv = document.getElementById('safety_alert');
    if (!alertDiv) return;
    
    // ✅ Voltage থেকে SOC calculate
    const batteryVoltage = parseFloat(data.battery_voltage) || 0;
    const batterySOC = calculateSOC(batteryVoltage);
    
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    const powerSource = status?.power_source || 'grid';
    
    const effData = calculateEfficiency(data, powerSource);
    const efficiency = effData.efficiency;
    
    let message = '', type = '', show = false, icon = '';
    
    if (batterySOC < 15) {
        message = `⛔ জরুরি! ব্যাটারি চার্জ খুবই কম (${batterySOC.toFixed(0)}%)!`;
        type = 'danger'; icon = 'fa-battery-empty'; show = true;
    }
    else if (batterySOC < 25) {
        message = `⚠️ সতর্কতা! ব্যাটারি চার্জ কম (${batterySOC.toFixed(0)}%)।`;
        type = 'warning'; icon = 'fa-battery-quarter'; show = true;
    }
    else if (efficiency > 0 && efficiency < 30) {
        message = `⚠️ সিস্টেম দক্ষতা খুব কম (${efficiency.toFixed(1)}%)!`;
        type = 'warning'; icon = 'fa-exclamation-triangle'; show = true;
    }
    else if (efficiency > 0 && efficiency < 60) {
        message = `ℹ️ সিস্টেম দক্ষতা কম (${efficiency.toFixed(1)}%)।`;
        type = 'info'; icon = 'fa-info-circle'; show = true;
    }
    else if (solarVoltage < 11 && solarVoltage > 0) {
        message = `⚠️ সোলার ভোল্টেজ কম (${solarVoltage.toFixed(1)}V)।`;
        type = 'warning'; icon = 'fa-sun'; show = true;
    }
    else if (batteryVoltage < 11.5 && batteryVoltage > 0) {
        message = `⚠️ ব্যাটারি ভোল্টেজ কম (${batteryVoltage.toFixed(1)}V)।`;
        type = 'warning'; icon = 'fa-battery-half'; show = true;
    }
    
    if (status && status.mode === 'auto' && !show) {
        const currentSource = powerSource;
        if (window._lastPowerSource && window._lastPowerSource !== currentSource) {
            const sourceNames = { solar: '☀️ সোলার', battery: '🔋 ব্যাটারি', grid: '🏭 গ্রিড' };
            message = `🔄 অটো সুইচ: ${sourceNames[currentSource] || currentSource} চালু`;
            type = 'info'; icon = 'fa-exchange-alt'; show = true;
        }
        window._lastPowerSource = currentSource;
    }
    
    const now = Date.now();
    if (show && message === lastAlertType && (now - lastAlertTime) < 8000) show = false;
    
    if (show) {
        lastAlertTime = now;
        lastAlertType = message;
        
        let bgColor, borderColor, textColor;
        if (type === 'danger') { bgColor = 'rgba(239, 68, 68, 0.15)'; borderColor = '#ef4444'; textColor = '#ef4444'; }
        else if (type === 'warning') { bgColor = 'rgba(245, 158, 11, 0.15)'; borderColor = '#f59e0b'; textColor = '#f59e0b'; }
        else { bgColor = 'rgba(59, 130, 246, 0.15)'; borderColor = '#3b82f6'; textColor = '#60a5fa'; }
        
        alertDiv.style.background = bgColor;
        alertDiv.style.border = `1px solid ${borderColor}`;
        alertDiv.style.color = textColor;
        alertDiv.style.display = 'block';
        alertDiv.className = `safety-alert show ${type}`;
        
        alertDiv.innerHTML = `
            <div class="alert-notification">
                <i class="fas ${icon || 'fa-info-circle'}"></i>
                <span class="alert-message">${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        clearTimeout(window.alertHideTimer);
        window.alertHideTimer = setTimeout(() => {
            alertDiv.style.display = 'none';
            alertDiv.className = 'safety-alert';
        }, 5000);
    }
}

// ==================== DASHBOARD LISTENERS ====================
function setupDashboardListeners() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    
    onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            window._lastCurrentData = data;
            updateDashboardUI(data);
            updateCleaningStatus(data);
            updateChargingStatusUI(data);
        }
    });
    
    const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    
    onValue(systemStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
            updateSystemStatusUI(status);
            updatePowerFlowBySource(status.power_source);
        }
    });
}

// ==================== CLEANING STATUS ====================
function updateCleaningStatus(data) {
    const cleaningIndicator = document.getElementById('cleaning_status_indicator');
    const cleaningDot = document.getElementById('cleaning_dot');
    if (!cleaningIndicator || !cleaningDot) return;
    
    const cleaningStatus = data.cleaning_status || 'inactive';
    const brushStatus = data.brush_status || 'stopped';
    const modeSpan = document.getElementById('mode_indicator');
    const currentMode = modeSpan?.textContent || 'ম্যানুয়াল মোড';
    const isAutoMode = currentMode.includes('অটো');
    
    let statusText = '', dotColor = '', dotClass = '', statusColor = '';
    
    if (cleaningStatus === 'active') {
        if (brushStatus === 'forward') {
            statusText = '🔄 ফরওয়ার্ড'; dotColor = '#10b981'; dotClass = 'dot-active'; statusColor = '#10b981';
        } else if (brushStatus === 'reverse') {
            statusText = '🔄 রিভার্স'; dotColor = '#f59e0b'; dotClass = 'dot-active'; statusColor = '#f59e0b';
        } else {
            statusText = '🧹 চলমান'; dotColor = '#10b981'; dotClass = 'dot-active'; statusColor = '#10b981';
        }
    } else if (cleaningStatus === 'paused') {
        statusText = '⏸ বিরতি'; dotColor = '#f59e0b'; dotClass = 'dot-paused'; statusColor = '#f59e0b';
    } else {
        if (isAutoMode) {
            statusText = '🤖 অটো'; dotColor = '#60a5fa'; dotClass = 'dot-auto-idle'; statusColor = '#60a5fa';
        } else {
            statusText = '⏹ নিষ্ক্রিয়'; dotColor = '#6b7280'; dotClass = 'dot-idle'; statusColor = '#6b7280';
        }
    }
    
    cleaningIndicator.textContent = statusText;
    cleaningIndicator.style.color = statusColor;
    cleaningIndicator.className = `cleaning-status`;
    
    cleaningDot.style.background = dotColor;
    cleaningDot.className = `cleaning-dot ${dotClass}`;
}

// ==================== FETCH DATA ====================
async function fetchDashboardData() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
        const currentSnapshot = await get(currentDataRef);
        if (currentSnapshot.exists()) {
            const data = currentSnapshot.val();
            window._lastCurrentData = data;
            updateDashboardUI(data);
            updateCleaningStatus(data);
            updateChargingStatusUI(data);
        }
        
        const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const statusSnapshot = await get(systemStatusRef);
        if (statusSnapshot.exists()) {
            const status = statusSnapshot.val();
            updateSystemStatusUI(status);
            updatePowerFlowBySource(status.power_source);
            if (window._lastCurrentData) {
                updateEfficiencyDisplay(window._lastCurrentData, status.power_source);
            }
        }
    } catch (error) {
        console.error("Error fetching:", error);
    }
}

// ==================== UPDATE UI (SOC JS থেকে) ====================
function updateDashboardUI(data) {
    // ✅ Voltage থেকে SOC calculate (ESP32 থেকে নয়)
    const batteryVoltage = parseFloat(data.battery_voltage) || 0;
    const batterySOC = calculateSOC(batteryVoltage);
    
    // Battery SOC display
    const batterySocElement = document.getElementById('battery_soc');
    if (batterySocElement) batterySocElement.textContent = batterySOC.toFixed(1) + '%';
    
    const batteryPercentageValue = document.getElementById('battery_percentage_value');
    if (batteryPercentageValue) batteryPercentageValue.textContent = batterySOC.toFixed(1);
    
    const batteryPercentageText = document.getElementById('batteryPercentageText');
    if (batteryPercentageText) batteryPercentageText.textContent = batterySOC.toFixed(1) + '%';
    
    // Battery Voltage display
    const batteryVoltageElement = document.getElementById('battery_voltage');
    if (batteryVoltageElement) {
        batteryVoltageElement.innerHTML = batteryVoltage.toFixed(2) + ' <span class="unit">V</span>';
    }
    
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    const solarVoltageText = document.getElementById('solarVoltageText');
    if (solarVoltageText) {
        solarVoltageText.textContent = solarVoltage.toFixed(1) + ' V';
        solarVoltageText.style.fill = solarVoltage > 13 ? '#f97316' : '#64748b';
    }
    
    const loadVoltage = parseFloat(data.load_voltage) || 0;
    const loadCurrent = parseFloat(data.battery_current) || 0;
    const loadPower = loadVoltage * loadCurrent;
    
    const loadPowerText = document.getElementById('loadPowerText');
    if (loadPowerText) loadPowerText.textContent = loadPower.toFixed(1) + ' W';
    
    const batteryProgressBar = document.getElementById('batteryProgressBar');
    if (batteryProgressBar) {
        const soc = Math.min(100, Math.max(0, batterySOC));
        batteryProgressBar.style.width = soc + '%';
    }
    
    updateBatteryColors(batterySOC);
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (database && currentUserId && currentDeviceId) {
        const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        get(systemStatusRef).then((snapshot) => {
            if (snapshot.exists()) {
                const powerSource = snapshot.val().power_source || 'grid';
                updateEfficiencyDisplay(data, powerSource);
            }
        }).catch(() => updateEfficiencyDisplay(data, 'grid'));
    }
}

function updateSystemStatusUI(status) {
    const modeIndicator = document.getElementById('mode_indicator');
    if (modeIndicator) {
        const mode = status.mode || 'manual';
        if (mode === 'auto') {
            modeIndicator.textContent = '🤖 অটো মোড';
            modeIndicator.className = 'auto-indicator';
        } else if (mode === 'manual') {
            modeIndicator.textContent = '👤 ম্যানুয়াল মোড';
            modeIndicator.className = 'manual-indicator';
        } else if (mode === 'stop' || mode === 'emergency') {
            modeIndicator.textContent = '⛔ জরুরি বন্ধ';
            modeIndicator.className = 'stop-indicator';
        }
    }
}

// ==================== POWER FLOW ====================
function updatePowerFlowBySource(powerSource) {
    const solarToBatteryFlow = document.getElementById('solarToBatteryFlow');
    const gridToBatteryFlow = document.getElementById('gridToBatteryFlow');
    const batteryToLoadFlow = document.getElementById('batteryToLoadFlow');
    const solarBox = document.getElementById('solarBox');
    const gridBox = document.getElementById('gridBox');
    const batteryBox = document.getElementById('batteryBox');
    const loadBox = document.getElementById('loadBox');
    const gridStatusText = document.getElementById('gridStatusText');
    const currentSourceSpan = document.getElementById('currentSourceSpan');
    
    if (solarToBatteryFlow) { solarToBatteryFlow.style.display = 'none'; solarToBatteryFlow.style.animation = 'none'; }
    if (gridToBatteryFlow) { gridToBatteryFlow.style.display = 'none'; gridToBatteryFlow.style.animation = 'none'; }
    if (batteryToLoadFlow) { batteryToLoadFlow.style.display = 'none'; batteryToLoadFlow.style.animation = 'none'; }
    
    if (solarBox) { solarBox.setAttribute('stroke', '#334155'); solarBox.style.opacity = '1'; solarBox.style.filter = 'none'; }
    if (gridBox) { gridBox.setAttribute('stroke', '#334155'); gridBox.style.opacity = '1'; gridBox.style.filter = 'none'; }
    if (batteryBox) { batteryBox.setAttribute('stroke', '#10b981'); batteryBox.style.opacity = '1'; batteryBox.style.filter = 'none'; }
    if (loadBox) { loadBox.setAttribute('stroke', '#06b6d4'); loadBox.style.opacity = '1'; loadBox.style.filter = 'none'; }
    
    if (powerSource === 'off') {
        if (solarBox) { solarBox.setAttribute('stroke', '#4b5563'); solarBox.style.opacity = '0.4'; }
        if (gridBox) { gridBox.setAttribute('stroke', '#4b5563'); gridBox.style.opacity = '0.4'; }
        if (batteryBox) { batteryBox.setAttribute('stroke', '#4b5563'); batteryBox.style.opacity = '0.4'; }
        if (loadBox) { loadBox.setAttribute('stroke', '#4b5563'); loadBox.style.opacity = '0.4'; }
        if (gridStatusText) { gridStatusText.textContent = 'স্ট্যান্ডবাই'; gridStatusText.style.fill = '#64748b'; }
        if (currentSourceSpan) { currentSourceSpan.textContent = '⛔ সিস্টেম বন্ধ'; currentSourceSpan.className = 'current-source off'; }
        return;
    }
    
    switch(powerSource) {
        case 'solar':
            if (solarToBatteryFlow) { solarToBatteryFlow.style.display = 'block'; solarToBatteryFlow.style.animation = 'flowMove 0.8s linear infinite'; }
            if (batteryToLoadFlow) { batteryToLoadFlow.style.display = 'block'; batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite'; }
            if (solarBox) { solarBox.setAttribute('stroke', '#f97316'); solarBox.style.filter = 'url(#glowSolar)'; }
            if (batteryBox) { batteryBox.setAttribute('stroke', '#10b981'); batteryBox.style.filter = 'url(#glowBattery)'; }
            if (loadBox) loadBox.setAttribute('stroke', '#10b981');
            if (gridStatusText) { gridStatusText.textContent = 'স্ট্যান্ডবাই'; gridStatusText.style.fill = '#64748b'; }
            if (currentSourceSpan) { currentSourceSpan.textContent = '☀️ সোলার → ব্যাটারি → লোড'; currentSourceSpan.className = 'current-source solar'; }
            break;
        case 'battery':
            if (batteryToLoadFlow) { batteryToLoadFlow.style.display = 'block'; batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite'; }
            if (batteryBox) { batteryBox.setAttribute('stroke', '#10b981'); batteryBox.style.filter = 'url(#glowBattery)'; }
            if (loadBox) loadBox.setAttribute('stroke', '#10b981');
            if (gridStatusText) { gridStatusText.textContent = 'স্ট্যান্ডবাই'; gridStatusText.style.fill = '#64748b'; }
            if (currentSourceSpan) { currentSourceSpan.textContent = '🔋 ব্যাটারি → লোড'; currentSourceSpan.className = 'current-source battery'; }
            break;
        case 'grid':
            if (gridToBatteryFlow) { gridToBatteryFlow.style.display = 'block'; gridToBatteryFlow.style.animation = 'flowMove 0.8s linear infinite'; }
            if (batteryToLoadFlow) { batteryToLoadFlow.style.display = 'block'; batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite'; }
            if (gridBox) { gridBox.setAttribute('stroke', '#3b82f6'); gridBox.style.filter = 'url(#glowGrid)'; }
            if (batteryBox) { batteryBox.setAttribute('stroke', '#10b981'); batteryBox.style.filter = 'url(#glowBattery)'; }
            if (loadBox) loadBox.setAttribute('stroke', '#10b981');
            if (gridStatusText) { gridStatusText.textContent = '✅ সক্রিয়'; gridStatusText.style.fill = '#3b82f6'; }
            if (currentSourceSpan) { currentSourceSpan.textContent = '🏭 গ্রিড → ব্যাটারি → লোড'; currentSourceSpan.className = 'current-source grid'; }
            break;
    }
}

// ==================== BATTERY COLORS ====================
function updateBatteryColors(soc) {
    const percentageElement = document.getElementById('battery_percentage_value');
    const progressBar = document.getElementById('batteryProgressBar');
    const healthElement = document.getElementById('batteryHealthStatus');
    const batteryPercentageText = document.getElementById('batteryPercentageText');
    
    if (percentageElement) percentageElement.classList.remove('critical', 'warning', 'normal', 'good');
    if (progressBar) progressBar.classList.remove('critical', 'warning', 'normal', 'good');
    if (healthElement) healthElement.classList.remove('critical', 'warning', 'normal', 'good');
    
    if (soc < 20) {
        if (percentageElement) percentageElement.classList.add('critical');
        if (progressBar) progressBar.classList.add('critical');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#ef4444';
        if (healthElement) { healthElement.classList.add('critical'); healthElement.textContent = '🔴 ঝুঁকিপূর্ণ'; }
    } 
    else if (soc < 50) {
        if (percentageElement) percentageElement.classList.add('warning');
        if (progressBar) progressBar.classList.add('warning');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#f59e0b';
        if (healthElement) { healthElement.classList.add('warning'); healthElement.textContent = '🟡 সতর্কতা'; }
    } 
    else if (soc < 80) {
        if (percentageElement) percentageElement.classList.add('normal');
        if (progressBar) progressBar.classList.add('normal');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#10b981';
        if (healthElement) { healthElement.classList.add('normal'); healthElement.textContent = '🟢 ভালো'; }
    } 
    else {
        if (percentageElement) percentageElement.classList.add('good');
        if (progressBar) progressBar.classList.add('good');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#059669';
        if (healthElement) { healthElement.classList.add('good'); healthElement.textContent = '🌟 অতি ভালো'; }
    }
}

window.updateNetworkStatus = function(connected) {
    const networkStatus = document.getElementById('network_status');
    if (networkStatus) {
        if (connected) {
            networkStatus.textContent = '✅ কানেক্টেড';
            networkStatus.className = 'network-status connected';
            networkStatus.style.color = '#10b981';
        } else {
            networkStatus.textContent = '❌ ডিসকানেক্টেড';
            networkStatus.className = 'network-status disconnected';
            networkStatus.style.color = '#ef4444';
        }
    }
};

// ==================== CSS ====================
const alertStyles = document.createElement('style');
alertStyles.textContent = `
    .safety-alert { display: none; margin-bottom: 15px; border-radius: 10px; overflow: hidden; animation: slideDown 0.3s ease; }
    .safety-alert.show { display: block; }
    .alert-notification { display: flex; align-items: center; padding: 12px 16px; gap: 12px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border-radius: 10px; border: 1px solid rgba(96, 165, 250, 0.3); }
    .alert-notification i { font-size: 20px; flex-shrink: 0; }
    .alert-message { flex: 1; font-size: 14px; font-weight: 500; color: #e2e8f0; }
    .alert-close { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 14px; }
    .safety-alert.danger .alert-notification { border-color: #ef4444; background: rgba(239, 68, 68, 0.15); }
    .safety-alert.warning .alert-notification { border-color: #f59e0b; background: rgba(245, 158, 11, 0.15); }
    .safety-alert.info .alert-notification { border-color: #3b82f6; background: rgba(59, 130, 246, 0.15); }
    
    .cleaning-status { font-weight: 500; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
    .cleaning-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-left: 2px; }
    .cleaning-dot.dot-active { animation: dotPulse 1s infinite; box-shadow: 0 0 10px currentColor; }
    .cleaning-dot.dot-paused { animation: dotPulse 2s infinite; }
    .cleaning-dot.dot-auto-idle { opacity: 0.7; }
    .cleaning-dot.dot-idle { opacity: 0.4; }
    @keyframes dotPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
    
    .charge-status {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 12px;
        margin-left: 6px;
        transition: all 0.3s ease;
        display: inline-block;
    }
    
    .charge-status.charging {
        animation: chargePulse 1.5s ease-in-out infinite;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
    }
    
    .charge-status.full {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.4);
    }
    
    .charge-status.low {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        animation: warningBlink 2s ease-in-out infinite;
    }
    
    .charge-status.critical {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        animation: criticalBlink 1s ease-in-out infinite;
    }
    
    .charge-status.normal {
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.3);
    }
    
    @keyframes chargePulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(16, 185, 129, 0); }
        50% { transform: scale(1.05); box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); }
    }
    
    @keyframes warningBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    @keyframes criticalBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    
    .status-value { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
`;
document.head.appendChild(alertStyles);

console.log("✅ Dashboard.js - SOC JS থেকে calculate হয়, Battery Full হলে Charging বন্ধ");