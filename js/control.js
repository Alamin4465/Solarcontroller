// js/control.js - Manual button সবসময় দেখা যাবে

import { ref, onValue, get, push, update, set } from 'firebase/database';

async function pushCommand(action, extraData = {}) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    const currentUser = window.currentUser;
    
    if (!database || !currentUserId || !currentDeviceId) {
        throw new Error('Missing user/device');
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
    
    console.log(`Command: ${action}`, extraData);
    return newCommandRef.key;
}

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
}

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

function setupLastCommandListener() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const lastCommandRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/last_command`);
    
    onValue(lastCommandRef, (snapshot) => {
        const cmd = snapshot.val();
        if (cmd) {
            updateLastCommandDisplay(cmd);
        }
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
        const modes = { auto: 'অটো', manual: 'ম্যানুয়াল', stop: 'জরুরি বন্ধ' };
        displayText = `মোড: ${modes[cmd.mode] || cmd.mode}`;
    } 
    else if (cmd.action === 'set_power_source') {
        const sources = { solar: 'সোলার', battery: 'ব্যাটারি', grid: 'গ্রিড', off: 'অফ' };
        displayText = `সোর্স: ${sources[cmd.source] || cmd.source}`;
    } 
    else if (cmd.action === 'emergency_stop') {
        displayText = `জরুরি বন্ধ`;
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

function setupControlStatusListeners() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const systemStatusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    onValue(systemStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
            updateControlStatusUI(status);
            if (window.updatePowerFlowBySource) {
                window.updatePowerFlowBySource(status.power_source);
            }
            
            if (status.mode === 'auto' && !isAutoModeActive) {
                startAutoMode();
            } else if (status.mode !== 'auto' && isAutoModeActive) {
                stopAutoMode();
            }
        }
    });
    
    const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
    onValue(currentDataRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateBrushPumpStatus(data);
        }
    });
}

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
            updateControlStatusUI(status);
            if (status.mode === 'auto') {
                startAutoMode();
            }
        } else {
            updateControlStatusUI({ mode: 'manual', power_source: 'grid' });
        }
    } catch (error) {
        console.error("Error loading status:", error);
        updateControlStatusUI({ mode: 'manual', power_source: 'grid' });
    }
}

function updateControlStatusUI(status) {
    const mode = status.mode || 'manual';
    
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan) {
        if (mode === 'auto') {
            modeSpan.textContent = 'অটো';
            modeSpan.className = 'badge auto';
        } else if (mode === 'manual') {
            modeSpan.textContent = 'ম্যানুয়াল';
            modeSpan.className = 'badge manual';
        } else if (mode === 'stop' || mode === 'emergency') {
            modeSpan.textContent = 'জরুরি বন্ধ';
            modeSpan.className = 'badge stop';
        }
    }
    
    const autoBtn = document.getElementById('autoModeBtn');
    const manualBtn = document.getElementById('manualModeBtn');
    const stopBtn = document.getElementById('stopModeBtn');
    
    if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
    if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
    if (stopBtn) stopBtn.classList.toggle('active', mode === 'stop' || mode === 'emergency');
    
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
            if (status.last_switch_reason) {
                autoReasonText.innerHTML = status.last_switch_reason;
            } else if (status.current_reason) {
                autoReasonText.innerHTML = status.current_reason;
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
    
    if (type === 'success') {
        statusText.style.color = '#10b981';
    } else if (type === 'warning') {
        statusText.style.color = '#f59e0b';
    } else if (type === 'error') {
        statusText.style.color = '#ef4444';
    } else {
        statusText.style.color = '#60a5fa';
    }
}

function updateBrushPumpStatus(data) {
    const modeSpan = document.getElementById('currentModeStatus');
    const currentMode = modeSpan?.textContent || 'ম্যানুয়াল';
    
    if (currentMode === 'অটো' || currentMode === 'জরুরি বন্ধ') {
        return;
    }
    
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

async function switchMode(mode) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    // ✅ UI immediately update
    updateControlStatusUI({ mode: mode, power_source: 'grid' });
    
    try {
        await pushCommand('set_mode', { mode: mode });
        
        if (mode === 'auto') {
            await startAutoMode();
        } else {
            stopAutoMode();
        }
        
        const modeNames = { auto: 'অটো', manual: 'ম্যানুয়াল', stop: 'জরুরি বন্ধ' };
        window.showNotification(`${modeNames[mode]} মোড চালু হয়েছে`, 'success');
        
    } catch (error) {
        console.error("Error switching mode:", error);
        window.showNotification('মোড পরিবর্তনে সমস্যা হয়েছে', 'error');
    }
}

async function setPowerSource(source) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    try {
        await pushCommand('set_power_source', { source: source });
        
        const names = { solar: 'সোলার', battery: 'ব্যাটারি', grid: 'গ্রিড' };
        window.showNotification(`${names[source]} চালু করা হয়েছে`, 'success');
        
        // ✅ UI update
        updateControlStatusUI({ mode: 'manual', power_source: source });
        
    } catch (error) {
        console.error("Error setting power source:", error);
    }
}

async function setPowerSourceOff(reason = 'ম্যানুয়ালি অফ') {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        await pushCommand('set_power_source', { source: 'off' });
        window.showNotification('সব পাওয়ার সোর্স বন্ধ', 'warning');
    } catch (error) {
        console.error("Error turning off power:", error);
    }
}

async function emergencyStop() {
    if (!confirm('সিস্টেম জরুরি বন্ধ করতে চান?')) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        stopAutoMode();
        await pushCommand('emergency_stop', { reason: 'User initiated' });
        
        // ✅ UI update
        updateControlStatusUI({ mode: 'emergency', power_source: 'off' });
        
        window.showNotification('সিস্টেম জরুরি বন্ধ', 'error');
        
    } catch (error) {
        console.error("Error in emergency stop:", error);
    }
}

async function sendBrushCommand(command) {
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan?.textContent === 'অটো' || modeSpan?.textContent === 'জরুরি বন্ধ') {
        window.showNotification('অটো বা স্টপ মোডে ব্রাশ কন্ট্রোল করা যাবে না', 'warning');
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

async function sendPumpCommand(state) {
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan?.textContent === 'অটো' || modeSpan?.textContent === 'জরুরি বন্ধ') {
        window.showNotification('অটো বা স্টপ মোডে পাম্প কন্ট্রোল করা যাবে না', 'warning');
        return;
    }
    
    try {
        await pushCommand('pump_control', { state: state });
        window.showNotification(`পাম্প ${state === 'on' ? 'চালু' : 'বন্ধ'}`, 'success');
    } catch (error) {
        console.error("Error:", error);
    }
}

let isAutoModeActive = false;
let autoCheckInterval = null;
let lastDataReceived = 0;
const DATA_TIMEOUT_MS = 15000;
const CHECK_INTERVAL_MS = 5000;

async function startAutoMode() {
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
    }
    
    isAutoModeActive = true;
    lastDataReceived = Date.now();
    updateAutoStatus('অটো মোড শুরু...', 'info');
    
    autoCheckInterval = setInterval(() => {
        if (isAutoModeActive) {
            const now = Date.now();
            if (now - lastDataReceived > DATA_TIMEOUT_MS) {
                updateAutoStatus('ডাটা টাইমআউট', 'warning');
            } else {
                performAutoCheck();
            }
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

window.pushCommand = pushCommand;
window.startAutoMode = startAutoMode;
window.stopAutoMode = stopAutoMode;
window.performAutoCheck = performAutoCheck;
window.switchMode = switchMode;
window.setPowerSource = setPowerSource;
window.setPowerSourceOff = setPowerSourceOff;
window.emergencyStop = emergencyStop;
window.sendBrushCommand = sendBrushCommand;
window.sendPumpCommand = sendPumpCommand;
window.updateAutoStatus = updateAutoStatus;

console.log("Control.js - Manual button fix");