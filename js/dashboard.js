// js/dashboard.js - ক্লিনিং স্ট্যাটাস ডট ইন্ডিকেটর সহ

export async function loadDashboard() {
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
        <!-- ================= SAFETY ALERT (শুধু নোটিফিকেশন) ================= -->
        <div id="safety_alert" class="safety-alert"></div>

        <!-- ================= STATUS BAR ================= -->
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
                    <span id="network_status" class="network-status connected">কানেক্টেড</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-wind"></i>
                    <span class="status-label">ধুলা:</span>
                </div>
                <div class="status-value">
                    <span id="dust">0 μg/m³</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-leaf"></i>
                    <span class="status-label">দক্ষতা:</span>
                </div>
                <div class="status-value">
                    <span id="efficiency">0 %</span>
                </div>
            </div>
            
            <div class="status-item">
                <div class="status-item-left">
                    <i class="fas fa-battery-half"></i>
                    <span class="status-label">ব্যাটারি :</span>
                </div>
                <div class="status-value">
                    <i class="fas fa-bolt" id="chargingIndicator" style="display: none;"></i>
                    <span id="battery_soc" class="battery_percentage">0%</span>
                </div>
            </div>
            
            <!-- ================= ক্লিনিং স্ট্যাটাস (ডট ইন্ডিকেটর সহ) ================= -->
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

        <!-- ================= BATTERY STATUS ================= -->
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
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
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
        
        <!-- ================= CURRENT SOURCE ================= -->
        <div class="current-source-wrapper">
            <span class="current-source-label">বর্তমান সোর্স:</span>
            <span id="currentSourceSpan" class="current-source solar">সোলার → ব্যাটারি → লোড</span>
        </div>
        
        <!-- ================= POWER FLOW SVG DIAGRAM ================= -->
        <div class="power-flow-wrapper">
            <svg viewBox="0 0 500 550" width="100%" height="100%" class="power-flow-svg">
                <defs>
                    <filter id="glowSolar" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id="glowGrid" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id="glowBattery" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <style>
                        @keyframes flowMove {
                            0% { stroke-dashoffset: 30; }
                            100% { stroke-dashoffset: 0; }
                        }
                    </style>
                </defs>
                
                <!-- Static Lines -->
                <line x1="140" y1="180" x2="140" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="140" y1="220" x2="250" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="360" y1="180" x2="360" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="360" y1="220" x2="250" y2="220" stroke="#334155" stroke-width="4"/>
                <line x1="250" y1="220" x2="250" y2="280" stroke="#334155" stroke-width="4"/>
                <line x1="250" y1="400" x2="250" y2="450" stroke="#334155" stroke-width="4"/>
                
                <!-- Animated Flow Lines -->
                <path id="solarToBatteryFlow" 
                      d="M140 180 L140 220 L250 220 L250 280" 
                      stroke="#f97316" stroke-width="5" fill="none"
                      stroke-dasharray="12 18" stroke-linecap="round"
                      style="display: none;"/>
                
                <path id="gridToBatteryFlow" 
                      d="M360 180 L360 220 L250 220 L250 280" 
                      stroke="#3b82f6" stroke-width="5" fill="none"
                      stroke-dasharray="12 18" stroke-linecap="round"
                      style="display: none;"/>
                
                <line id="batteryToLoadFlow" 
                      x1="250" y1="400" x2="250" y2="450" 
                      stroke="#10b981" stroke-width="5"
                      stroke-dasharray="12 18" stroke-linecap="round"
                      style="display: none;"/>
                
                <!-- SOLAR BOX -->
                <g id="solarGroup">
                    <rect id="solarBox" x="70" y="90" width="140" height="90" rx="16"
                          fill="#1e293b" stroke="#334155" stroke-width="3"/>
                    <text x="140" y="125" text-anchor="middle" font-size="32">☀️</text>
                    <text x="140" y="150" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">SOLAR</text>
                    <text id="solarVoltageText" x="140" y="168" text-anchor="middle" fill="#64748b" font-size="12">0.0 V</text>
                </g>
                
                <!-- GRID BOX -->
                <g id="gridGroup">
                    <rect id="gridBox" x="290" y="90" width="140" height="90" rx="16"
                          fill="#1e293b" stroke="#334155" stroke-width="3"/>
                    <text x="360" y="125" text-anchor="middle" font-size="32">🏭</text>
                    <text x="360" y="150" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">GRID</text>
                    <text id="gridStatusText" x="360" y="168" text-anchor="middle" fill="#64748b" font-size="12">স্ট্যান্ডবাই</text>
                </g>
                
                <!-- BATTERY BOX -->
                <g id="batteryGroup">
                    <rect id="batteryBox" x="145" y="280" width="210" height="120" rx="20"
                          fill="#1e293b" stroke="#10b981" stroke-width="4"/>
                    <text x="250" y="320" text-anchor="middle" font-size="36">🔋</text>
                    <text x="250" y="350" text-anchor="middle" fill="#e2e8f0" font-size="18" font-weight="bold">BATTERY</text>
                    <text id="batteryPercentageText" x="250" y="382" text-anchor="middle" fill="#10b981" font-size="26" font-weight="bold">0%</text>
                </g>
                
                <!-- LOAD BOX -->
                <g id="loadGroup">
                    <rect id="loadBox" x="170" y="450" width="160" height="80" rx="16"
                          fill="#1e293b" stroke="#06b6d4" stroke-width="3"/>
                    <text x="250" y="482" text-anchor="middle" font-size="28">⚡</text>
                    <text x="250" y="508" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold">LOAD</text>
                    <text id="loadPowerText" x="250" y="522" text-anchor="middle" fill="#64748b" font-size="11">0 W</text>
                </g>
            </svg>
        </div>
    `;
    
    setupDashboardListeners();
    await fetchDashboardData();
    
    // সেফটি অ্যালার্ট নোটিফিকেশন সেটআপ
    setupSafetyAlertNotification();
}

// ==================== সেফটি অ্যালার্ট নোটিফিকেশন ====================
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
                if (statusSnapshot.exists()) {
                    const status = statusSnapshot.val();
                    checkAndShowAlert(data, status);
                }
            }).catch(() => {
                checkAndShowAlert(data, null);
            });
        }
    });
}

// ==================== অ্যালার্ট চেক এবং শো ====================
let lastAlertTime = 0;
let lastAlertType = '';

function checkAndShowAlert(data, status = null) {
    const alertDiv = document.getElementById('safety_alert');
    if (!alertDiv) return;
    
    const batterySOC = parseFloat(data.battery_soc) || 0;
    const dustLevel = parseFloat(data.dust_level) || 0;
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    const batteryVoltage = parseFloat(data.battery_voltage) || 0;
    
    let message = '';
    let type = '';
    let show = false;
    let icon = '';
    
    // ========== জরুরি অ্যালার্ট (সর্বোচ্চ অগ্রাধিকার) ==========
    
    // 1. ব্যাটারি খুব কম (ক্রিটিক্যাল)
    if (batterySOC < 15) {
        message = `⛔ জরুরি! ব্যাটারি চার্জ খুবই কম (${batterySOC.toFixed(0)}%)! দ্রুত চার্জ দিন!`;
        type = 'danger';
        icon = 'fa-battery-empty';
        show = true;
    }
    // 2. ব্যাটারি কম
    else if (batterySOC < 25) {
        message = `⚠️ সতর্কতা! ব্যাটারি চার্জ কম (${batterySOC.toFixed(0)}%)। চার্জ করুন।`;
        type = 'warning';
        icon = 'fa-battery-quarter';
        show = true;
    }
    // 3. ধুলা বিপজ্জনক
    else if (dustLevel > 200) {
        message = `⛔ জরুরি! ধুলার মাত্রা বিপজ্জনক (${dustLevel.toFixed(0)} μg/m³)!`;
        type = 'danger';
        icon = 'fa-exclamation-triangle';
        show = true;
    }
    // 4. ধুলা বেশি
    else if (dustLevel > 100) {
        message = `⚠️ সতর্কতা! ধুলার মাত্রা বেশি (${dustLevel.toFixed(0)} μg/m³)।`;
        type = 'warning';
        icon = 'fa-wind';
        show = true;
    }
    // 5. সোলার ভোল্টেজ খুব কম
    else if (solarVoltage < 11 && solarVoltage > 0) {
        message = `⚠️ সোলার ভোল্টেজ কম (${solarVoltage.toFixed(1)}V)। চেক করুন।`;
        type = 'warning';
        icon = 'fa-sun';
        show = true;
    }
    // 6. ব্যাটারি ভোল্টেজ কম
    else if (batteryVoltage < 11.5 && batteryVoltage > 0) {
        message = `⚠️ ব্যাটারি ভোল্টেজ কম (${batteryVoltage.toFixed(1)}V)।`;
        type = 'warning';
        icon = 'fa-battery-half';
        show = true;
    }
    
    // ========== অটো সুইচিং অ্যালার্ট (শুধু অটো মোডে) ==========
    if (status && status.mode === 'auto' && !show) {
        const powerSource = status.power_source || 'grid';
        const currentSource = powerSource;
        
        // সোর্স চেঞ্জ হলে অ্যালার্ট
        if (window._lastPowerSource && window._lastPowerSource !== currentSource) {
            const sourceNames = {
                solar: '☀️ সোলার',
                battery: '🔋 ব্যাটারি',
                grid: '🏭 গ্রিড'
            };
            message = `🔄 অটো সুইচ: ${sourceNames[currentSource] || currentSource} চালু হয়েছে`;
            type = 'info';
            icon = 'fa-exchange-alt';
            show = true;
        }
        window._lastPowerSource = currentSource;
    }
    
    // ========== ডুপ্লিকেট অ্যালার্ট প্রতিরোধ ==========
    const now = Date.now();
    if (show && message === lastAlertType && (now - lastAlertTime) < 8000) {
        show = false;
    }
    
    // ========== অ্যালার্ট দেখান ==========
    if (show) {
        lastAlertTime = now;
        lastAlertType = message;
        
        // অ্যালার্ট স্টাইল
        let bgColor, borderColor, textColor;
        if (type === 'danger') {
            bgColor = 'rgba(239, 68, 68, 0.15)';
            borderColor = '#ef4444';
            textColor = '#ef4444';
        } else if (type === 'warning') {
            bgColor = 'rgba(245, 158, 11, 0.15)';
            borderColor = '#f59e0b';
            textColor = '#f59e0b';
        } else {
            bgColor = 'rgba(59, 130, 246, 0.15)';
            borderColor = '#3b82f6';
            textColor = '#60a5fa';
        }
        
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
        
        // অটো হাইড (৫ সেকেন্ড পর)
        clearTimeout(window.alertHideTimer);
        window.alertHideTimer = setTimeout(() => {
            alertDiv.style.display = 'none';
            alertDiv.className = 'safety-alert';
        }, 5000);
    }
}

// ==================== ড্যাশবোর্ড লিসেনার ====================
function setupDashboardListeners() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    
    onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateDashboardUI(data);
            updateCleaningStatus(data);
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

// ==================== ক্লিনিং স্ট্যাটাস আপডেট (ডট ইন্ডিকেটর সহ) ====================
function updateCleaningStatus(data) {
    const cleaningIndicator = document.getElementById('cleaning_status_indicator');
    const cleaningDot = document.getElementById('cleaning_dot');
    if (!cleaningIndicator || !cleaningDot) return;
    
    const cleaningStatus = data.cleaning_status || 'inactive';
    const brushStatus = data.brush_status || 'stopped';
    const modeSpan = document.getElementById('mode_indicator');
    const currentMode = modeSpan?.textContent || 'ম্যানুয়াল মোড';
    const isAutoMode = currentMode.includes('অটো');
    
    let statusText = '';
    let dotColor = '';
    let dotClass = '';
    let statusColor = '';
    
    // ক্লিনিং স্ট্যাটাস চেক
    if (cleaningStatus === 'active') {
        // ব্রাশ চলছে
        if (brushStatus === 'forward') {
            statusText = '🔄 ফরওয়ার্ড চলছে';
            dotColor = '#10b981';
            dotClass = 'dot-active';
            statusColor = '#10b981';
        } else if (brushStatus === 'reverse') {
            statusText = '🔄 রিভার্স চলছে';
            dotColor = '#f59e0b';
            dotClass = 'dot-active';
            statusColor = '#f59e0b';
        } else {
            statusText = '🧹 চলমান';
            dotColor = '#10b981';
            dotClass = 'dot-active';
            statusColor = '#10b981';
        }
    } else if (cleaningStatus === 'paused') {
        statusText = '⏸ বিরতিতে';
        dotColor = '#f59e0b';
        dotClass = 'dot-paused';
        statusColor = '#f59e0b';
    } else {
        // নিষ্ক্রিয়
        if (isAutoMode) {
            statusText = '🤖 অটো (স্ট্যান্ডবাই)';
            dotColor = '#60a5fa';
            dotClass = 'dot-auto-idle';
            statusColor = '#60a5fa';
        } else {
            statusText = '⏹ নিষ্ক্রিয়';
            dotColor = '#6b7280';
            dotClass = 'dot-idle';
            statusColor = '#6b7280';
        }
    }
    
    // টেক্সট আপডেট
    cleaningIndicator.textContent = statusText;
    cleaningIndicator.style.color = statusColor;
    cleaningIndicator.className = `cleaning-status`;
    
    // ডট আপডেট
    cleaningDot.style.background = dotColor;
    cleaningDot.className = `cleaning-dot ${dotClass}`;
    
    // টুলটিপ
    const modeText = isAutoMode ? '🔵 অটো' : '🟢 ম্যানুয়াল';
    cleaningIndicator.title = `মোড: ${modeText} | স্ট্যাটাস: ${statusText}`;
    cleaningDot.title = `মোড: ${modeText} | স্ট্যাটাস: ${statusText}`;
}

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
            updateDashboardUI(data);
            updateCleaningStatus(data);
        }
        
        const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const statusSnapshot = await get(systemStatusRef);
        if (statusSnapshot.exists()) {
            updateSystemStatusUI(statusSnapshot.val());
            updatePowerFlowBySource(statusSnapshot.val().power_source);
        }
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

function updateDashboardUI(data) {
    const batterySOC = parseFloat(data.battery_soc) || 0;
    
    const dustElement = document.getElementById('dust');
    if (dustElement) {
        const dustLevel = parseFloat(data.dust_level) || 0;
        dustElement.textContent = dustLevel.toFixed(1) + ' μg/m³';
    }
    
    const batterySocElement = document.getElementById('battery_soc');
    if (batterySocElement) {
        batterySocElement.textContent = batterySOC.toFixed(1) + '%';
    }
    
    const efficiencyElement = document.getElementById('efficiency');
    if (efficiencyElement) {
        const efficiency = parseFloat(data.efficiency) || 0;
        efficiencyElement.textContent = efficiency.toFixed(1) + ' %';
    }
    
    const batteryPercentageValue = document.getElementById('battery_percentage_value');
    if (batteryPercentageValue) {
        batteryPercentageValue.textContent = batterySOC.toFixed(1);
    }
    
    const batteryPercentageText = document.getElementById('batteryPercentageText');
    if (batteryPercentageText) {
        batteryPercentageText.textContent = batterySOC.toFixed(1) + '%';
    }
    
    const batteryVoltageElement = document.getElementById('battery_voltage');
    if (batteryVoltageElement) {
        const batteryVoltage = parseFloat(data.battery_voltage) || 0;
        batteryVoltageElement.innerHTML = batteryVoltage.toFixed(2) + ' <span class="unit">V</span>';
    }
    
    const solarVoltage = parseFloat(data.solar_voltage) || 0;
    const solarVoltageText = document.getElementById('solarVoltageText');
    if (solarVoltageText) {
        solarVoltageText.textContent = solarVoltage.toFixed(1) + ' V';
        if (solarVoltage > 13) {
            solarVoltageText.style.fill = '#f97316';
        } else {
            solarVoltageText.style.fill = '#64748b';
        }
    }
    
    const loadPower = (parseFloat(data.load_voltage) || 0) * (parseFloat(data.load_current) || 0);
    const loadPowerText = document.getElementById('loadPowerText');
    if (loadPowerText) {
        loadPowerText.textContent = loadPower.toFixed(1) + ' W';
    }
    
    const batteryProgressBar = document.getElementById('batteryProgressBar');
    if (batteryProgressBar) {
        const soc = Math.min(100, Math.max(0, batterySOC));
        batteryProgressBar.style.width = soc + '%';
    }
    
    updateBatteryColors(batterySOC);
    
    const solarCurrent = parseFloat(data.solar_current) || 0;
    const batteryCurrent = parseFloat(data.battery_current) || 0;
    const chargingIndicator = document.getElementById('chargingIndicator');
    if (chargingIndicator) {
        if (solarCurrent > 0.1 && batteryCurrent > 0) {
            chargingIndicator.style.display = 'inline-block';
            chargingIndicator.style.color = '#10b981';
        } else {
            chargingIndicator.style.display = 'none';
        }
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
        } else if (mode === 'stop') {
            modeIndicator.textContent = '⛔ জরুরি বন্ধ';
            modeIndicator.className = 'stop-indicator';
        }
    }
}

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
    
    if (solarToBatteryFlow) {
        solarToBatteryFlow.style.display = 'none';
        solarToBatteryFlow.style.animation = 'none';
    }
    if (gridToBatteryFlow) {
        gridToBatteryFlow.style.display = 'none';
        gridToBatteryFlow.style.animation = 'none';
    }
    if (batteryToLoadFlow) {
        batteryToLoadFlow.style.display = 'none';
        batteryToLoadFlow.style.animation = 'none';
    }
    
    if (solarBox) {
        solarBox.setAttribute('stroke', '#334155');
        solarBox.style.opacity = '1';
        solarBox.style.filter = 'none';
    }
    if (gridBox) {
        gridBox.setAttribute('stroke', '#334155');
        gridBox.style.opacity = '1';
        gridBox.style.filter = 'none';
    }
    if (batteryBox) {
        batteryBox.setAttribute('stroke', '#10b981');
        batteryBox.style.opacity = '1';
        batteryBox.style.filter = 'none';
    }
    if (loadBox) {
        loadBox.setAttribute('stroke', '#06b6d4');
        loadBox.style.opacity = '1';
        loadBox.style.filter = 'none';
    }
    
    if (powerSource === 'off') {
        if (solarBox) {
            solarBox.setAttribute('stroke', '#4b5563');
            solarBox.style.opacity = '0.4';
        }
        if (gridBox) {
            gridBox.setAttribute('stroke', '#4b5563');
            gridBox.style.opacity = '0.4';
        }
        if (batteryBox) {
            batteryBox.setAttribute('stroke', '#4b5563');
            batteryBox.style.opacity = '0.4';
        }
        if (loadBox) {
            loadBox.setAttribute('stroke', '#4b5563');
            loadBox.style.opacity = '0.4';
        }
        if (gridStatusText) {
            gridStatusText.textContent = 'স্ট্যান্ডবাই';
            gridStatusText.style.fill = '#64748b';
        }
        if (currentSourceSpan) {
            currentSourceSpan.textContent = '⛔ সিস্টেম বন্ধ';
            currentSourceSpan.className = 'current-source off';
        }
        return;
    }
    
    switch(powerSource) {
        case 'solar':
            if (solarToBatteryFlow) {
                solarToBatteryFlow.style.display = 'block';
                solarToBatteryFlow.style.animation = 'flowMove 0.8s linear infinite';
            }
            if (batteryToLoadFlow) {
                batteryToLoadFlow.style.display = 'block';
                batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite';
            }
            if (solarBox) {
                solarBox.setAttribute('stroke', '#f97316');
                solarBox.style.filter = 'url(#glowSolar)';
            }
            if (batteryBox) {
                batteryBox.setAttribute('stroke', '#10b981');
                batteryBox.style.filter = 'url(#glowBattery)';
            }
            if (loadBox) {
                loadBox.setAttribute('stroke', '#10b981');
            }
            if (gridStatusText) {
                gridStatusText.textContent = 'স্ট্যান্ডবাই';
                gridStatusText.style.fill = '#64748b';
            }
            if (currentSourceSpan) {
                currentSourceSpan.textContent = '☀️ সোলার → ব্যাটারি → লোড';
                currentSourceSpan.className = 'current-source solar';
            }
            break;
            
        case 'battery':
            if (batteryToLoadFlow) {
                batteryToLoadFlow.style.display = 'block';
                batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite';
            }
            if (batteryBox) {
                batteryBox.setAttribute('stroke', '#10b981');
                batteryBox.style.filter = 'url(#glowBattery)';
            }
            if (loadBox) {
                loadBox.setAttribute('stroke', '#10b981');
            }
            if (gridStatusText) {
                gridStatusText.textContent = 'স্ট্যান্ডবাই';
                gridStatusText.style.fill = '#64748b';
            }
            if (currentSourceSpan) {
                currentSourceSpan.textContent = '🔋 ব্যাটারি → লোড';
                currentSourceSpan.className = 'current-source battery';
            }
            break;
            
        case 'grid':
            if (gridToBatteryFlow) {
                gridToBatteryFlow.style.display = 'block';
                gridToBatteryFlow.style.animation = 'flowMove 0.8s linear infinite';
            }
            if (batteryToLoadFlow) {
                batteryToLoadFlow.style.display = 'block';
                batteryToLoadFlow.style.animation = 'flowMove 0.8s linear infinite';
            }
            if (gridBox) {
                gridBox.setAttribute('stroke', '#3b82f6');
                gridBox.style.filter = 'url(#glowGrid)';
            }
            if (batteryBox) {
                batteryBox.setAttribute('stroke', '#10b981');
                batteryBox.style.filter = 'url(#glowBattery)';
            }
            if (loadBox) {
                loadBox.setAttribute('stroke', '#10b981');
            }
            if (gridStatusText) {
                gridStatusText.textContent = '✅ সক্রিয়';
                gridStatusText.style.fill = '#3b82f6';
            }
            if (currentSourceSpan) {
                currentSourceSpan.textContent = '🏭 গ্রিড → ব্যাটারি → লোড';
                currentSourceSpan.className = 'current-source grid';
            }
            break;
            
        default:
            if (currentSourceSpan) {
                currentSourceSpan.textContent = '⚡ সিস্টেম বন্ধ';
                currentSourceSpan.className = 'current-source off';
            }
            break;
    }
}

function updateBatteryColors(soc) {
    const percentageElement = document.getElementById('battery_percentage_value');
    const progressBar = document.getElementById('batteryProgressBar');
    const healthElement = document.getElementById('batteryHealthStatus');
    const batteryPercentageText = document.getElementById('batteryPercentageText');
    
    if (percentageElement) {
        percentageElement.classList.remove('critical', 'warning', 'normal', 'good');
    }
    if (progressBar) {
        progressBar.classList.remove('critical', 'warning', 'normal', 'good');
    }
    if (healthElement) {
        healthElement.classList.remove('critical', 'warning', 'normal', 'good');
    }
    
    if (soc < 20) {
        if (percentageElement) percentageElement.classList.add('critical');
        if (progressBar) progressBar.classList.add('critical');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#ef4444';
        if (healthElement) {
            healthElement.classList.add('critical');
            healthElement.textContent = '🔴 ঝুঁকিপূর্ণ';
        }
    } 
    else if (soc < 50) {
        if (percentageElement) percentageElement.classList.add('warning');
        if (progressBar) progressBar.classList.add('warning');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#f59e0b';
        if (healthElement) {
            healthElement.classList.add('warning');
            healthElement.textContent = '🟡 সতর্কতা';
        }
    } 
    else if (soc < 80) {
        if (percentageElement) percentageElement.classList.add('normal');
        if (progressBar) progressBar.classList.add('normal');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#10b981';
        if (healthElement) {
            healthElement.classList.add('normal');
            healthElement.textContent = '🟢 ভালো';
        }
    } 
    else {
        if (percentageElement) percentageElement.classList.add('good');
        if (progressBar) progressBar.classList.add('good');
        if (batteryPercentageText) batteryPercentageText.style.fill = '#059669';
        if (healthElement) {
            healthElement.classList.add('good');
            healthElement.textContent = '🌟 অতি ভালো';
        }
    }
}

window.updateNetworkStatus = function(connected) {
    const networkStatus = document.getElementById('network_status');
    if (networkStatus) {
        if (connected) {
            networkStatus.textContent = '✅ কানেক্টেড';
            networkStatus.className = 'network-status connected';
        } else {
            networkStatus.textContent = '❌ ডিসকানেক্টেড';
            networkStatus.className = 'network-status disconnected';
        }
    }
};

// অ্যালার্ট CSS স্টাইল
const alertStyles = document.createElement('style');
alertStyles.textContent = `
    .safety-alert {
        display: none;
        margin-bottom: 15px;
        padding: 0;
        border-radius: 10px;
        overflow: hidden;
        animation: slideDown 0.3s ease;
        background: transparent !important;
        border: none !important;
    }
    
    .safety-alert.show {
        display: block;
    }
    
    .alert-notification {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 12px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 10px;
        border: 1px solid rgba(96, 165, 250, 0.3);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    
    .alert-notification i {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .alert-message {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: #e2e8f0;
    }
    
    .alert-close {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
        font-size: 14px;
    }
    
    .alert-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
    }
    
    .safety-alert.danger .alert-notification {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.15);
    }
    
    .safety-alert.danger .alert-notification i {
        color: #ef4444;
    }
    
    .safety-alert.warning .alert-notification {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.15);
    }
    
    .safety-alert.warning .alert-notification i {
        color: #f59e0b;
    }
    
    .safety-alert.info .alert-notification {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.15);
    }
    
    .safety-alert.info .alert-notification i {
        color: #3b82f6;
    }
    
    /* ================= ক্লিনিং স্ট্যাটাস ডট ইন্ডিকেটর ================= */
    .cleaning-status {
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        transition: all 0.3s;
        margin-right: 8px;
    }
    
    .cleaning-dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        transition: all 0.3s;
        flex-shrink: 0;
        margin-left: 2px;
    }
    
    .cleaning-dot.dot-active {
        animation: dotPulse 1s infinite;
        box-shadow: 0 0 10px currentColor;
    }
    
    .cleaning-dot.dot-paused {
        animation: dotPulse 2s infinite;
        box-shadow: 0 0 8px currentColor;
    }
    
    .cleaning-dot.dot-auto-idle {
        opacity: 0.7;
        box-shadow: 0 0 6px currentColor;
    }
    
    .cleaning-dot.dot-idle {
        opacity: 0.4;
    }
    
    @keyframes dotPulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.3);
            opacity: 0.7;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
    
    .status-value {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(alertStyles);

console.log("✅ Dashboard.js loaded - Cleaning status with dot indicator");