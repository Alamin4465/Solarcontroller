// js/control.js - v2.5 FINAL
// ✅ ESP32 v6.8.9 ALIGNED
// ✅ FIXED: Auto mode auto-start bug on dashboard return
// ✅ FIXED: Off command not reliable → retry 3x
// ✅ FIXED: Old commands cleared before sending new
// ✅ FIXED: Auto monitor only in auto mode
// ✅ FIXED: Grid switch only in auto mode

import { ref, onValue, get, push, update, set } from 'firebase/database';

// ==================== Global State ====================
let currentModeState = 'manual';
let currentSourceState = 'off';
let isAutoModeActive = false;
let autoCheckInterval = null;
let lastDataReceived = 0;
let commandInProgress = false;
let controlPanelLoaded = false;

const DATA_TIMEOUT_MS = 15000;
const CHECK_INTERVAL_MS = 5000;

const AUTO_THRESHOLDS = Object.freeze({
    SOLAR_MIN_VOLTAGE: 12.5,
    SOLAR_GOOD_VOLTAGE: 13.5,
    BATTERY_MIN_VOLTAGE: 11.8,
    BATTERY_CRITICAL_SOC: 25,
    BATTERY_GOOD_SOC: 40,
    CHECK_INTERVAL: 5000
});
window.AUTO_THRESHOLDS = AUTO_THRESHOLDS;

// ==================== Push Command (with old command cleanup) ====================
async function pushCommand(action, extraData = {}) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    const currentUser = window.currentUser;
    
    if (!database || !currentUserId || !currentDeviceId) {
        throw new Error('Missing user/device');
    }
    
    // ⭐ v2.5 — Clear old pending commands first
    try {
        const commandsRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`);
        const oldSnapshot = await get(commandsRef);
        if (oldSnapshot.exists()) {
            const oldCommands = oldSnapshot.val();
            const updates = {};
            Object.keys(oldCommands).forEach(key => {
                updates[key] = null;
            });
            if (Object.keys(updates).length > 0) {
                await update(commandsRef, updates);
                console.log(`🧹 Cleared ${Object.keys(updates).length} old commands`);
            }
        }
    } catch (e) {
        console.warn("Clear old commands error:", e);
    }
    
    const commandData = {
        action: action,
        ...extraData,
        timestamp: Date.now(),
        user_id: currentUserId,
        user_email: currentUser?.email || '',
        device_id: currentDeviceId
    };
    
    const commandsRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`);
    const newCommandRef = push(commandsRef);
    await set(newCommandRef, commandData);
    
    const lastCommandRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/last_command`);
    await set(lastCommandRef, {
        ...commandData,
        status: 'sent',
        sent_at: Date.now()
    });
    
    console.log(`📤 Command sent: ${action}`, extraData);
    return newCommandRef.key;
}

// ==================== Wait for Ack ====================
async function waitForModeChange(expectedMode, timeout = 2000) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return false;
    
    const startTime = Date.now();
    const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    
    while (Date.now() - startTime < timeout) {
        try {
            const snapshot = await get(statusRef);
            if (snapshot.exists()) {
                const status = snapshot.val();
                if (status.mode === expectedMode) {
                    console.log(`✅ Mode confirmed: ${expectedMode} (${Date.now() - startTime}ms)`);
                    return true;
                }
            }
        } catch (e) {
            console.warn("waitForModeChange error:", e);
        }
        await new Promise(r => setTimeout(r, 150));
    }
    
    console.warn(`⚠️ Mode change timeout: ${expectedMode}`);
    return false;
}

async function waitForPowerSource(expectedSource, timeout = 2500) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return false;
    
    const startTime = Date.now();
    const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    
    while (Date.now() - startTime < timeout) {
        try {
            const snapshot = await get(statusRef);
            if (snapshot.exists()) {
                const status = snapshot.val();
                if (status.power_source === expectedSource) {
                    console.log(`✅ Power source confirmed: ${expectedSource} (${Date.now() - startTime}ms)`);
                    return true;
                }
            }
        } catch (e) {
            console.warn("waitForPowerSource error:", e);
        }
        await new Promise(r => setTimeout(r, 150));
    }
    
    console.warn(`⚠️ Power source timeout: ${expectedSource}`);
    return false;
}

// ==================== Main Control Loader ====================
export async function loadControl() {
    const content = document.getElementById("content");
    if (!content) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        content.innerHTML = `<div class="card text-center"><p>ডিভাইস সিলেক্ট করুন</p></div>`;
        return;
    }
    
    // ⭐ v2.5 — Reset state on load
    currentModeState = 'manual';
    currentSourceState = 'off';
    controlPanelLoaded = false;
    
    content.innerHTML = `
        <div class="control-grid">
            <div class="card">
                <div class="card-header"><i class="fas fa-bolt"></i><h3>পাওয়ার কন্ট্রোল মোড</h3></div>
                <div class="mode-buttons">
                    <button id="autoModeBtn" class="btn-mode"><i class="fas fa-robot"></i> অটো</button>
                    <button id="manualModeBtn" class="btn-mode active"><i class="fas fa-hand"></i> ম্যানুয়াল</button>
                    <button id="stopModeBtn" class="btn-mode danger"><i class="fas fa-stop"></i> জরুরি বন্ধ</button>
                </div>
                <div id="powerSourceSection" class="power-buttons">
                    <h4>পাওয়ার সোর্স</h4>
                    <div class="source-group">
                        <button id="powerSolarBtn" class="btn-source solar">
                            <div class="toggle-track">
                                <span class="toggle-label"><i class="fas fa-sun"></i> সোলার</span>
                                <span class="toggle-thumb"><i class="fas fa-check"></i></span>
                                <span class="toggle-label"><i class="fas fa-power-off"></i></span>
                            </div>
                        </button>
                        
                        <button id="powerBatteryBtn" class="btn-source battery">
                            <div class="toggle-track">
                                <span class="toggle-label"><i class="fas fa-car-battery"></i> ব্যাটারি</span>
                                <span class="toggle-thumb"><i class="fas fa-check"></i></span>
                                <span class="toggle-label"><i class="fas fa-power-off"></i></span>
                            </div>
                        </button>
                        
                        <button id="powerGridBtn" class="btn-source grid">
                            <div class="toggle-track">
                                <span class="toggle-label"><i class="fas fa-city"></i> গ্রিড</span>
                                <span class="toggle-thumb"><i class="fas fa-check"></i></span>
                                <span class="toggle-label"><i class="fas fa-power-off"></i></span>
                            </div>
                        </button>
                        
                        <button id="powerAllOffBtn" class="btn-source off">
                            <div class="toggle-track">
                                <span class="toggle-label"><i class="fas fa-power-off"></i> অফ</span>
                                <span class="toggle-thumb"><i class="fas fa-times"></i></span>
                                <span class="toggle-label"><i class="fas fa-ban"></i></span>
                            </div>
                        </button>
                    </div>
                </div>
                <div class="current-status">
                    <span>বর্তমান মোড: </span>
                    <span id="currentModeStatus" class="badge manual">ম্যানুয়াল</span>
                </div>
                
                <div class="last-command-display" id="lastCommandDisplay" style="display:none;">
                    <i class="fas fa-paper-plane"></i>
                    <div class="last-command-info">
                        <span class="last-command-label">সর্বশেষ:</span>
                        <span class="last-command-value" id="lastCommandText">--</span>
                        <span class="last-command-time" id="lastCommandTime"></span>
                    </div>
                </div>
                
                <div id="autoReason" class="auto-reason hidden">
                    <i class="fas fa-info-circle"></i> <span id="autoReasonText"></span>
                </div>
                <div id="autoStatus" class="auto-status hidden">
                    <i class="fas fa-sync-alt fa-spin"></i> <span id="autoStatusText">ডাটা চেক করা হচ্ছে...</span>
                </div>
            </div>
            
            <div id="brushCard" class="card">
                <div class="card-header"><i class="fas fa-brush"></i><h3>ব্রাশ কন্ট্রোল</h3></div>
                <div class="manual-controls">
                    <div class="direction-buttons">
                        <button id="brushForwardBtn" class="btn-control success"><i class="fas fa-arrow-right"></i> ফরওয়ার্ড</button>
                        <button id="brushReverseBtn" class="btn-control warning"><i class="fas fa-arrow-left"></i> রিভার্স</button>
                        <button id="brushStopBtn" class="btn-control danger"><i class="fas fa-stop"></i> স্টপ</button>
                    </div>
                </div>
                <div class="mt-2">ব্রাশ: <strong id="brushStatusText">বন্ধ</strong></div>
                <div style="font-size:11px;color:#64748b;margin-top:8px;">
                    <i class="fas fa-info-circle"></i> Limit Switch চাপলে ESP32 নিজেই বন্ধ করবে
                </div>
            </div>
            
            <div id="pumpCard" class="card">
                <div class="card-header"><i class="fas fa-water-pump"></i><h3>পাম্প কন্ট্রোল</h3></div>
                <div class="pump-buttons">
                    <button id="pumpOnBtn" class="btn-control success"><i class="fas fa-play"></i> পাম্প চালু</button>
                    <button id="pumpOffBtn" class="btn-control danger"><i class="fas fa-stop"></i> পাম্প বন্ধ</button>
                </div>
                <div class="mt-2">পাম্প: <strong id="pumpStatusText">বন্ধ</strong></div>
            </div>
        </div>
    `;
    
    setupControlListeners();
    await loadCurrentControlStatus();
    setupControlStatusListeners();
    setupLastCommandListener();
    
    controlPanelLoaded = true;
    console.log("🎮 Control panel loaded. Mode:", currentModeState);
}

// ==================== Event Listeners ====================
function setupControlListeners() {
    document.getElementById('autoModeBtn')?.addEventListener('click', () => switchMode('auto'));
    document.getElementById('manualModeBtn')?.addEventListener('click', () => switchMode('manual'));
    document.getElementById('stopModeBtn')?.addEventListener('click', () => emergencyStop());
    
    document.getElementById('powerSolarBtn')?.addEventListener('click', () => setPowerSource('solar'));
    document.getElementById('powerBatteryBtn')?.addEventListener('click', () => setPowerSource('battery'));
    document.getElementById('powerGridBtn')?.addEventListener('click', () => setPowerSource('grid'));
    document.getElementById('powerAllOffBtn')?.addEventListener('click', () => setPowerSource('off'));
    
    document.getElementById('brushForwardBtn')?.addEventListener('click', () => sendBrushCommand('forward'));
    document.getElementById('brushReverseBtn')?.addEventListener('click', () => sendBrushCommand('reverse'));
    document.getElementById('brushStopBtn')?.addEventListener('click', () => sendBrushCommand('stop'));
    
    document.getElementById('pumpOnBtn')?.addEventListener('click', () => sendPumpCommand('on'));
    document.getElementById('pumpOffBtn')?.addEventListener('click', () => sendPumpCommand('off'));
}

// ==================== Last Command Listener ====================
function setupLastCommandListener() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const lastCommandRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/last_command`);
    
    onValue(lastCommandRef, (snapshot) => {
        const cmd = snapshot.val();
        if (cmd) updateLastCommandDisplay(cmd);
    });
}

function updateLastCommandDisplay(cmd) {
    const display = document.getElementById('lastCommandDisplay');
    const textEl = document.getElementById('lastCommandText');
    const timeEl = document.getElementById('lastCommandTime');
    
    if (!display || !textEl) return;
    
    display.style.display = 'flex';
    
    let displayText = '';
    
    if (cmd.action === 'brush_control') {
        const names = { forward: 'ফরওয়ার্ড', reverse: 'রিভার্স', stop: 'বন্ধ' };
        displayText = `ব্রাশ: ${names[cmd.command] || cmd.command}`;
    } 
    else if (cmd.action === 'pump_control') {
        displayText = `পাম্প: ${cmd.state === 'on' ? 'চালু' : 'বন্ধ'}`;
    } 
    else if (cmd.action === 'set_mode') {
        const modes = { auto: 'অটো', manual: 'ম্যানুয়াল', emergency: 'জরুরি বন্ধ' };
        displayText = `মোড: ${modes[cmd.mode] || cmd.mode}`;
    } 
    else if (cmd.action === 'set_power_source') {
        const sources = { solar: 'সোলার', battery: 'ব্যাটারি', grid: 'গ্রিড', off: 'অফ' };
        displayText = `সোর্স: ${sources[cmd.source] || cmd.source}`;
    } 
    else if (cmd.action === 'emergency_stop') {
        displayText = `জরুরি বন্ধ`;
    } 
    else if (cmd.action === 'cleaning_control') {
        const names = { start: 'ক্লিনিং শুরু', stop: 'ক্লিনিং বন্ধ' };
        displayText = names[cmd.command] || cmd.command;
    }
    else {
        displayText = cmd.action;
    }
    
    textEl.textContent = displayText;
    
    if (cmd.timestamp && timeEl) {
        const date = new Date(cmd.timestamp);
        const diffSec = Math.floor((Date.now() - date) / 1000);
        
        if (diffSec < 60) timeEl.textContent = `(${diffSec}s আগে)`;
        else if (diffSec < 3600) timeEl.textContent = `(${Math.floor(diffSec/60)}m আগে)`;
        else timeEl.textContent = `(${date.toLocaleTimeString('bn-BD', {hour:'2-digit', minute:'2-digit'})})`;
    }
}

// ==================== Status Listeners with Fix ====================
function setupControlStatusListeners() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    onValue(systemStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
            const modeChanged = (currentModeState !== status.mode);
            const oldMode = currentModeState;
            
            if (status.mode) currentModeState = status.mode;
            if (status.power_source) currentSourceState = status.power_source;
            
            updateControlStatusUI(status);
            
            if (window.updatePowerFlowBySource) {
                window.updatePowerFlowBySource(status.power_source);
            }
            
            // ⭐ v2.5 — Auto monitor only on external mode change
            if (controlPanelLoaded && modeChanged && status.mode === 'auto' && !isAutoModeActive) {
                console.log(`🎯 External auto mode (${oldMode} → auto). Starting monitor.`);
                startAutoMode();
                setTimeout(() => performAutoCheck(), 1500);
            }
            
            if (controlPanelLoaded && modeChanged && status.mode === 'manual' && isAutoModeActive) {
                console.log(`🛑 External manual mode (${oldMode} → manual). Stopping monitor.`);
                stopAutoMode();
            }
        }
    });
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) updateBrushPumpStatus(data);
    });
}

// ==================== Load Current Status ====================
async function loadCurrentControlStatus() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const snapshot = await get(statusRef);
        if (snapshot.exists()) {
            const status = snapshot.val();
            currentModeState = status.mode || 'manual';
            currentSourceState = status.power_source || 'grid';
            updateControlStatusUI(status);
            console.log(`📊 Loaded mode: ${currentModeState}, source: ${currentSourceState}`);
        } else {
            currentModeState = 'manual';
            currentSourceState = 'grid';
            updateControlStatusUI({ mode: 'manual', power_source: 'grid' });
        }
    } catch (error) {
        console.error("Error loading status:", error);
        updateControlStatusUI({ mode: 'manual', power_source: 'grid' });
    }
}

// ==================== UI Update ====================
function updateControlStatusUI(status) {
    const mode = status.mode || 'manual';
    currentModeState = mode;
    
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan) {
        if (mode === 'auto') {
            modeSpan.textContent = 'অটো';
            modeSpan.className = 'badge auto';
        } else if (mode === 'manual') {
            modeSpan.textContent = 'ম্যানুয়াল';
            modeSpan.className = 'badge manual';
        } else if (mode === 'emergency') {
            modeSpan.textContent = 'জরুরি বন্ধ';
            modeSpan.className = 'badge stop';
        }
    }
    
    const autoBtn = document.getElementById('autoModeBtn');
    const manualBtn = document.getElementById('manualModeBtn');
    const stopBtn = document.getElementById('stopModeBtn');
    
    if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
    if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
    if (stopBtn) stopBtn.classList.toggle('active', mode === 'emergency');
    
    const powerSourceSection = document.getElementById('powerSourceSection');
    const brushCard = document.getElementById('brushCard');
    const pumpCard = document.getElementById('pumpCard');
    const autoReasonDiv = document.getElementById('autoReason');
    const autoStatusDiv = document.getElementById('autoStatus');
    
    if (mode === 'manual') {
        if (powerSourceSection) powerSourceSection.classList.remove('hidden');
        if (brushCard) brushCard.classList.remove('hidden');
        if (pumpCard) pumpCard.classList.remove('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.add('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
    } else if (mode === 'auto') {
        if (powerSourceSection) powerSourceSection.classList.add('hidden');
        if (brushCard) brushCard.classList.add('hidden');
        if (pumpCard) pumpCard.classList.add('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.remove('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.remove('hidden');
        
        const autoReasonText = document.getElementById('autoReasonText');
        if (autoReasonText) {
            if (status.current_reason) {
                autoReasonText.innerHTML = status.current_reason;
            } else if (status.last_switch_reason) {
                autoReasonText.innerHTML = status.last_switch_reason;
            } else {
                autoReasonText.innerHTML = 'অটো মোড সক্রিয়';
            }
        }
    } else {
        if (powerSourceSection) powerSourceSection.classList.add('hidden');
        if (brushCard) brushCard.classList.add('hidden');
        if (pumpCard) pumpCard.classList.add('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.add('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
    }
    
    if (mode === 'manual') {
        const powerSource = status.power_source || 'grid';
        currentSourceState = powerSource;
        
        const solarBtn = document.getElementById('powerSolarBtn');
        const batteryBtn = document.getElementById('powerBatteryBtn');
        const gridBtn = document.getElementById('powerGridBtn');
        const offBtn = document.getElementById('powerAllOffBtn');
        
        [solarBtn, batteryBtn, gridBtn, offBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        if (powerSource === 'solar' && solarBtn) solarBtn.classList.add('active');
        else if (powerSource === 'battery' && batteryBtn) batteryBtn.classList.add('active');
        else if (powerSource === 'grid' && gridBtn) gridBtn.classList.add('active');
        else if (powerSource === 'off' && offBtn) offBtn.classList.add('active');
    }
}

function updateAutoStatus(message, type = 'info') {
    const statusText = document.getElementById('autoStatusText');
    const statusDiv = document.getElementById('autoStatus');
    
    if (!statusText || !statusDiv) return;
    
    statusText.textContent = message;
    statusDiv.classList.remove('hidden');
    
    if (type === 'success') statusText.style.color = '#10b981';
    else if (type === 'warning') statusText.style.color = '#f59e0b';
    else if (type === 'error') statusText.style.color = '#ef4444';
    else statusText.style.color = '#60a5fa';
}

function updateBrushPumpStatus(data) {
    if (currentModeState === 'auto' || currentModeState === 'emergency') return;
    
    const brushStatus = data.brush_status || 'stopped';
    const brushText = document.getElementById('brushStatusText');
    if (brushText) {
        if (brushStatus === 'forward') {
            brushText.textContent = 'ফরওয়ার্ড';
            brushText.style.color = '#10b981';
        } else if (brushStatus === 'reverse') {
            brushText.textContent = 'রিভার্স';
            brushText.style.color = '#f59e0b';
        } else {
            brushText.textContent = 'বন্ধ';
            brushText.style.color = '#ef4444';
        }
    }
    
    const pumpStatus = data.pump_status || 'off';
    const pumpText = document.getElementById('pumpStatusText');
    if (pumpText) {
        pumpText.textContent = pumpStatus === 'on' ? 'চালু' : 'বন্ধ';
        pumpText.style.color = pumpStatus === 'on' ? '#10b981' : '#ef4444';
    }
}

// ==================== Mode Switch ====================
async function switchMode(mode) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    if (commandInProgress) {
        console.log("⚠️ Command already in progress");
        return;
    }
    
    if (currentModeState === mode) {
        console.log(`Already in ${mode} mode`);
        return;
    }
    
    commandInProgress = true;
    
    try {
        const wasEmergency = (currentModeState === 'emergency');
        
        if (mode === 'auto' && wasEmergency) {
            console.log('🔄 Emergency → Auto: resetting to manual first');
            await pushCommand('set_mode', { mode: 'manual' });
            await waitForModeChange('manual', 1500);
        }
        
        currentModeState = mode;
        updateControlStatusUI({ 
            mode: mode, 
            power_source: currentSourceState 
        });
        
        await pushCommand('set_mode', { mode: mode });
        
        const confirmed = await waitForModeChange(mode, 2000);
        
        if (confirmed) {
            // ⭐ v2.5 — Auto monitor only on user click
            if (mode === 'auto') {
                if (!isAutoModeActive) {
                    await startAutoMode();
                    setTimeout(() => performAutoCheck(), 1500);
                    console.log("🎯 Auto monitor started (user click)");
                }
            } else if (mode === 'manual') {
                if (isAutoModeActive) {
                    stopAutoMode();
                    console.log("🛑 Auto monitor stopped (user click)");
                }
            }
            
            const modeNames = { auto: 'অটো', manual: 'ম্যানুয়াল' };
            window.showNotification(`${modeNames[mode]} মোড চালু হয়েছে ✅`, 'success');
        } else {
            console.warn("Mode change not confirmed");
            window.showNotification('ESP32 সাড়া দেয়নি — আবার চেষ্টা করুন', 'warning');
        }
        
    } catch (error) {
        console.error("Error switching mode:", error);
        window.showNotification('মোড পরিবর্তনে সমস্যা হয়েছে', 'error');
    } finally {
        commandInProgress = false;
    }
}

// ==================== Power Source (with Off Retry) ====================
async function setPowerSource(source) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    if (currentModeState !== 'manual') {
        window.showNotification('শুধু ম্যানুয়াল মোডে source পরিবর্তন করা যায়', 'warning');
        return;
    }
    
    if (commandInProgress) {
        console.log("⚠️ Command in progress");
        return;
    }
    
    if (currentSourceState === source) {
        console.log(`Already on ${source}`);
        return;
    }
    
    commandInProgress = true;
    
    try {
        currentSourceState = source;
        updateControlStatusUI({ mode: 'manual', power_source: source });
        
        // ⭐ v2.5 — Off requires 3 retries to ensure delivery
        const retries = (source === 'off') ? 3 : 1;
        const retryDelay = (source === 'off') ? 400 : 0;
        
        for (let i = 0; i < retries; i++) {
            await pushCommand('set_power_source', { 
                source: source,
                attempt: i + 1,
                total_attempts: retries
            });
            
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, retryDelay));
            }
        }
        
        const confirmed = await waitForPowerSource(source, 3000);
        
        const names = { solar: 'সোলার', battery: 'ব্যাটারি', grid: 'গ্রিড', off: 'অফ' };
        
        if (confirmed) {
            window.showNotification(`${names[source]} চালু হয়েছে ✅`, 'success');
        } else {
            console.warn("Source not confirmed — retrying");
            window.showNotification('ESP32 সাড়া দেয়নি — আবার চেষ্টা করুন', 'warning');
        }
        
    } catch (error) {
        console.error("Error setting power source:", error);
        window.showNotification('পাওয়ার সোর্স পরিবর্তনে সমস্যা', 'error');
    } finally {
        commandInProgress = false;
    }
}

// ==================== Emergency Stop ====================
async function emergencyStop() {
    if (!confirm('সিস্টেম জরুরি বন্ধ করতে চান?')) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    if (commandInProgress) return;
    commandInProgress = true;
    
    try {
        stopAutoMode();
        
        await pushCommand('emergency_stop', { reason: 'User initiated' });
        
        currentModeState = 'emergency';
        currentSourceState = 'off';
        
        updateControlStatusUI({ mode: 'emergency', power_source: 'off' });
        
        await waitForModeChange('emergency', 2000);
        
        window.showNotification('সিস্টেম জরুরি বন্ধ — আবার চালু করতে Auto বা Manual চাপুন', 'warning');
        
    } catch (error) {
        console.error("Error in emergency stop:", error);
        window.showNotification('জরুরি বন্ধে সমস্যা', 'error');
    } finally {
        commandInProgress = false;
    }
}

// ==================== Brush Command ====================
async function sendBrushCommand(command) {
    if (currentModeState !== 'manual') {
        window.showNotification('শুধু ম্যানুয়াল মোডে ব্রাশ কন্ট্রোল করা যাবে', 'warning');
        return;
    }
    
    try {
        await pushCommand('brush_control', { command: command });
        const names = { forward: 'ফরওয়ার্ড', reverse: 'রিভার্স', stop: 'বন্ধ' };
        window.showNotification(`ব্রাশ ${names[command] || command}`, 'success');
    } catch (error) {
        console.error("Error:", error);
    }
}

// ==================== Pump Command ====================
async function sendPumpCommand(state) {
    if (currentModeState !== 'manual') {
        window.showNotification('শুধু ম্যানুয়াল মোডে পাম্প কন্ট্রোল করা যাবে', 'warning');
        return;
    }
    
    try {
        await pushCommand('pump_control', { state: state });
        window.showNotification(`পাম্প ${state === 'on' ? 'চালু' : 'বন্ধ'}`, 'success');
    } catch (error) {
        console.error("Error:", error);
    }
}

// ==================== Auto Mode ====================
async function startAutoMode() {
    // ⭐ v2.5 — Guard: only if actually in auto mode
    if (currentModeState !== 'auto') {
        console.log("⚠️ Not in auto mode, skip monitor");
        return;
    }
    
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
    }
    
    isAutoModeActive = true;
    lastDataReceived = Date.now();
    updateAutoStatus('অটো মোড শুরু - ডাটা মনিটরিং...', 'info');
    
    autoCheckInterval = setInterval(() => {
        if (!isAutoModeActive) return;
        
        // ⭐ v2.5 — Double-check mode (prevent off→grid switch)
        if (currentModeState !== 'auto') {
            console.log("⚠️ Mode no longer auto, stopping monitor");
            stopAutoMode();
            return;
        }
        
        const now = Date.now();
        const timeSinceLastData = now - lastDataReceived;
        
        if (timeSinceLastData > DATA_TIMEOUT_MS) {
            // ⭐ Only auto-switch when actually in auto mode
            if (currentModeState === 'auto') {
                updateAutoStatus(`${Math.round(timeSinceLastData/1000)}সে ডাটা নেই - গ্রিড`, 'warning');
                switchToGridOnTimeout();
            }
        } else {
            performAutoCheck();
        }
    }, CHECK_INTERVAL_MS);
}

function stopAutoMode() {
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
    }
    isAutoModeActive = false;
    
    const autoStatusDiv = document.getElementById('autoStatus');
    if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
}

async function switchToGridOnTimeout() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId || !isAutoModeActive) return;
    if (currentModeState !== 'auto') return;   // ⭐ v2.5 extra guard
    
    try {
        await pushCommand('set_power_source', {
            source: 'grid',
            reason: 'Data timeout',
            auto_switch: true
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

async function performAutoCheck() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId || !isAutoModeActive) return;
    
    try {
        const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
        const dataSnapshot = await get(currentDataRef);
        const data = dataSnapshot.val();
        
        if (data) {
            lastDataReceived = Date.now();
            updateAutoStatus('ডাটা প্রাপ্ত', 'success');
        }
    } catch (error) {
        console.error("Auto check error:", error);
    }
}

// ==================== Global Exports ====================
window.pushCommand = pushCommand;
window.startAutoMode = startAutoMode;
window.stopAutoMode = stopAutoMode;
window.performAutoCheck = performAutoCheck;
window.switchMode = switchMode;
window.setPowerSource = setPowerSource;
window.emergencyStop = emergencyStop;
window.sendBrushCommand = sendBrushCommand;
window.sendPumpCommand = sendPumpCommand;
window.updateAutoStatus = updateAutoStatus;
window.waitForModeChange = waitForModeChange;
window.waitForPowerSource = waitForPowerSource;

console.log("✅ Control.js v2.5 - ESP32 v6.8.9 (Command persist + Auto bug + Off retry fixed)");