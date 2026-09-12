// js/control.js - Auto + Manual (Cleaning Mode সম্পূর্ণ বাদ)
// ESP32 নিজেই Cleaning handle করবে

import { ref, onValue, get, push, update, set } from 'firebase/database';

// ==================== Helper: Push Command ====================
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
    
    console.log(`✅ Command: ${action}`, extraData);
    return newCommandRef.key;
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
    
    content.innerHTML = `
        <div class="control-grid">
            <!-- Power Control -->
            <div class="card">
                <div class="card-header"><i class="fas fa-bolt"></i><h3>পাওয়ার কন্ট্রোল মোড</h3></div>
                <div class="mode-buttons">
                    <button id="autoModeBtn" class="btn-mode"><i class="fas fa-robot"></i> অটো</button>
                    <button id="manualModeBtn" class="btn-mode"><i class="fas fa-hand"></i> ম্যানুয়াল</button>
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
            
            <!-- Brush Control -->
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
            
            <!-- Pump Control -->
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
        displayText = `🧹 ব্রাশ: ${names[cmd.command] || cmd.command}`;
    } 
    else if (cmd.action === 'pump_control') {
        displayText = `💧 পাম্প: ${cmd.state === 'on' ? 'চালু' : 'বন্ধ'}`;
    } 
    else if (cmd.action === 'set_mode') {
        const modes = { auto: 'অটো', manual: 'ম্যানুয়াল', stop: 'জরুরি বন্ধ' };
        displayText = `🎛️ মোড: ${modes[cmd.mode] || cmd.mode}`;
    } 
    else if (cmd.action === 'set_power_source') {
        const sources = { solar: 'সোলার', battery: 'ব্যাটারি', grid: 'গ্রিড', off: 'অফ' };
        displayText = `⚡ সোর্স: ${sources[cmd.source] || cmd.source}`;
    } 
    else if (cmd.action === 'emergency_stop') {
        displayText = `⛔ জরুরি বন্ধ`;
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

// ==================== Status Listeners ====================
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
            if (isAutoModeActive) {
                updateAutoStatus('ডাটা প্রাপ্ত - বিশ্লেষণ', 'success');
            }
        }
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
            updateControlStatusUI(status);
            if (status.mode === 'auto') {
                startAutoMode();
            }
        }
    } catch (error) {
        console.error("Error loading status:", error);
    }
}

// ==================== UI Update ====================
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
        } else if (mode === 'stop') {
            modeSpan.textContent = 'জরুরি বন্ধ';
            modeSpan.className = 'badge stop';
        }
    }
    
    const autoBtn = document.getElementById('autoModeBtn');
    const manualBtn = document.getElementById('manualModeBtn');
    const stopBtn = document.getElementById('stopModeBtn');
    
    if (autoBtn) autoBtn.classList.toggle('active', mode === 'auto');
    if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
    if (stopBtn) stopBtn.classList.toggle('active', mode === 'stop');
    
    const powerSourceSection = document.getElementById('powerSourceSection');
    const brushCard = document.getElementById('brushCard');
    const pumpCard = document.getElementById('pumpCard');
    const autoReasonDiv = document.getElementById('autoReason');
    const autoReasonText = document.getElementById('autoReasonText');
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
        
        if (status.last_switch_reason && autoReasonText) {
            autoReasonText.innerHTML = status.last_switch_reason;
        } else if (status.current_reason && autoReasonText) {
            autoReasonText.innerHTML = status.current_reason;
        } else if (autoReasonText) {
            autoReasonText.innerHTML = '🤖 অটো মোড সক্রিয় - পাওয়ার সোর্স মনিটরিং';
        }
        
        updateAutoStatus('সিস্টেম মনিটরিং চলছে...', 'info');
        
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
        statusDiv.querySelector('.fa-spin')?.classList.remove('fa-spin');
    } else if (type === 'warning') {
        statusText.style.color = '#f59e0b';
        statusDiv.querySelector('.fa-spin')?.classList.add('fa-spin');
    } else if (type === 'error') {
        statusText.style.color = '#ef4444';
        statusDiv.querySelector('.fa-spin')?.classList.remove('fa-spin');
    } else {
        statusText.style.color = '#60a5fa';
        statusDiv.querySelector('.fa-spin')?.classList.add('fa-spin');
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

// ==================== Mode Switch ====================
async function switchMode(mode) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    const statusSnapshot = await get(statusRef);
    const currentStatus = statusSnapshot.val() || {};
    const currentMode = currentStatus.mode || 'manual';
    
    if (currentMode === mode) {
        window.showNotification(`ইতিমধ্যে ${mode === 'auto' ? 'অটো' : 'ম্যানুয়াল'} মোডে আছেন`, 'info');
        return;
    }
    
    if (mode === 'auto' && currentMode === 'stop') {
        const confirmReset = confirm(`⚠️ সিস্টেম জরুরি বন্ধ অবস্থায় আছে। রিসেট করে অটো মোডে যেতে চান?`);
        if (!confirmReset) return;
        await resetFromEmergencyStop('auto');
        return;
    }
    
    if (mode === 'auto' && currentStatus.power_source === 'off') {
        window.showNotification('🔄 সিস্টেম রিসেট করে অটো মোডে যাচ্ছে...', 'info');
        await resetFromEmergencyStop('auto');
        return;
    }
    
    try {
        await pushCommand('set_mode', { mode: mode });
        
        if (mode === 'auto') {
            await startAutoMode();
            setTimeout(() => performAutoCheck(), 1500);
        } else {
            stopAutoMode();
            if (mode === 'manual') {
                await sendBrushCommand('stop');
            }
        }
        
        const modeNames = { auto: 'অটো', manual: 'ম্যানুয়াল', stop: 'জরুরি বন্ধ' };
        window.showNotification(`${modeNames[mode]} মোড চালু হয়েছে`, 'success');
        
        if (mode === 'stop') {
            await setPowerSourceOff('জরুরি বন্ধে সব পাওয়ার অফ');
        }
        
    } catch (error) {
        console.error("Error switching mode:", error);
        window.showNotification('মোড পরিবর্তনে সমস্যা হয়েছে', 'error');
    }
}

// ==================== Power Source ====================
async function setPowerSource(source) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    const statusSnapshot = await get(statusRef);
    const currentStatus = statusSnapshot.val() || {};
    const currentMode = currentStatus.mode || 'manual';
    const currentSource = currentStatus.power_source || 'grid';
    
    if (currentSource === source && currentMode !== 'stop') {
        await setPowerSourceOff('সোর্স অফ করা হয়েছে');
        return;
    }
    
    if (currentMode === 'stop') {
        window.showNotification('⚠️ সিস্টেম জরুরি বন্ধ অবস্থায় আছে। আগে রিসেট করুন।', 'warning');
        return;
    }
    
    if (currentMode === 'auto') {
        window.showNotification('⚠️ অটো মোডে পাওয়ার সোর্স পরিবর্তন করা যাবে না।', 'warning');
        return;
    }
    
    try {
        await pushCommand('set_power_source', { source: source });
        
        const names = { solar: '☀️ সোলার', battery: '🔋 ব্যাটারি', grid: '🏭 গ্রিড' };
        window.showNotification(`${names[source]} চালু করা হয়েছে`, 'success');
        
        await addControlAlert('info', `পাওয়ার সোর্স: ${names[source]}`);
        
    } catch (error) {
        console.error("Error setting power source:", error);
        window.showNotification('পাওয়ার সোর্স পরিবর্তনে সমস্যা', 'error');
    }
}

// ==================== All Off ====================
async function setPowerSourceOff(reason = 'ম্যানুয়ালি অফ') {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    try {
        await pushCommand('set_power_source', { source: 'off' });
        
        window.showNotification('⚡ সব পাওয়ার সোর্স বন্ধ', 'warning');
        await addControlAlert('warning', reason);
        
    } catch (error) {
        console.error("Error turning off power:", error);
    }
}

// ==================== Emergency Stop ====================
async function emergencyStop() {
    if (!confirm('⚠️ সিস্টেম জরুরি বন্ধ করতে চান? সব রিলে বন্ধ হবে।')) return;
    
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    try {
        stopAutoMode();
        await pushCommand('emergency_stop', { reason: 'User initiated' });
        
        window.showNotification('⛔ সিস্টেম জরুরি বন্ধ', 'error');
        await addControlAlert('error', 'সিস্টেম জরুরি বন্ধ করা হয়েছে');
        
    } catch (error) {
        console.error("Error in emergency stop:", error);
        window.showNotification('জরুরি বন্ধে সমস্যা', 'error');
    }
}

// ==================== Brush Command ====================
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
        console.error("Error sending brush command:", error);
        window.showNotification('ব্রাশ কমান্ড পাঠাতে সমস্যা', 'error');
    }
}

// ==================== Pump Command ====================
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
        console.error("Error sending pump command:", error);
        window.showNotification('পাম্প কমান্ড পাঠাতে সমস্যা', 'error');
    }
}

// ==================== Alert ====================
async function addControlAlert(type, message) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        const alertsRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/alerts`);
        const newAlertRef = push(alertsRef);
        await set(newAlertRef, { 
            type, 
            message, 
            timestamp: new Date().toLocaleTimeString(), 
            time: Date.now() 
        });
    } catch (error) {
        console.error("Error adding alert:", error);
    }
}

// ==================== Auto Mode ====================
let isAutoModeActive = false;
let autoCheckInterval = null;
let dataTimeout = null;
let lastDataReceived = 0;
const DATA_TIMEOUT_MS = 15000;
const CHECK_INTERVAL_MS = 5000;

// ✅ Thresholds (Battery Min 11.5V - নতুন SOC এর সাথে মিল)
const AUTO_THRESHOLDS = {
    SOLAR_MIN_VOLTAGE: 12.5,
    SOLAR_GOOD_VOLTAGE: 13.0,
    BATTERY_MIN_VOLTAGE: 11.5,       // ✅ 11.8 → 11.5
    BATTERY_CRITICAL_SOC: 25,
    BATTERY_GOOD_SOC: 40,
    CHECK_INTERVAL: 5000
};

async function startAutoMode() {
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
    }
    if (dataTimeout) {
        clearTimeout(dataTimeout);
        dataTimeout = null;
    }
    
    isAutoModeActive = true;
    lastDataReceived = Date.now();
    console.log("🤖 Auto mode started");
    updateAutoStatus('অটো মোড শুরু - ডাটা মনিটরিং...', 'info');
    
    autoCheckInterval = setInterval(() => {
        if (isAutoModeActive) {
            const now = Date.now();
            const timeSinceLastData = now - lastDataReceived;
            
            if (timeSinceLastData > DATA_TIMEOUT_MS) {
                updateAutoStatus(`⚠️ ${Math.round(timeSinceLastData/1000)}সে ডাটা নেই - গ্রিড`, 'warning');
                switchToGridOnTimeout();
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
    if (dataTimeout) {
        clearTimeout(dataTimeout);
        dataTimeout = null;
    }
    isAutoModeActive = false;
    console.log("🛑 Auto mode stopped");
    
    const autoStatusDiv = document.getElementById('autoStatus');
    if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
}

// ==================== Timeout Switch ====================
async function switchToGridOnTimeout() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId || !isAutoModeActive) return;
    
    try {
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const statusSnapshot = await get(statusRef);
        const currentStatus = statusSnapshot.val() || {};
        const currentSource = currentStatus.power_source || 'grid';
        
        if (currentSource === 'grid') {
            updateAutoStatus('✅ গ্রিডে - অপেক্ষা', 'success');
            return;
        }
        
        console.log('⏰ Timeout - Grid switch');
        updateAutoStatus('⏰ ডাটা টাইমআউট - গ্রিড', 'warning');
        
        await pushCommand('set_power_source', {
            source: 'grid',
            reason: 'Data timeout',
            auto_switch: true
        });
        
        await addControlAlert('warning', `ডাটা টাইমআউট - গ্রিড`);
        
    } catch (error) {
        console.error("Error switching to grid on timeout:", error);
    }
}

// ==================== Auto Check ====================
async function performAutoCheck() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId || !isAutoModeActive) {
        if (isAutoModeActive) stopAutoMode();
        return;
    }
    
    try {
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const statusSnapshot = await get(statusRef);
        const currentStatus = statusSnapshot.val() || {};
        const currentMode = currentStatus.mode || 'manual';
        
        if (currentMode !== 'auto') {
            if (isAutoModeActive) stopAutoMode();
            return;
        }
        
        const currentDataRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/current_data`);
        const dataSnapshot = await get(currentDataRef);
        const data = dataSnapshot.val();
        
        if (!data) {
            const timeSinceLastData = Date.now() - lastDataReceived;
            if (timeSinceLastData > DATA_TIMEOUT_MS) {
                updateAutoStatus(`⏰ ${Math.round(timeSinceLastData/1000)}সে ডাটা নেই`, 'warning');
            }
            return;
        }
        
        lastDataReceived = Date.now();
        updateAutoStatus('✅ ডাটা প্রাপ্ত', 'success');
        
        const solarVoltage = parseFloat(data.solar_voltage) || 0;
        const batteryVoltage = parseFloat(data.battery_voltage) || 0;
        const batterySOC = parseFloat(data.battery_soc) || 0;
        const currentSource = currentStatus.power_source || 'grid';
        
        let targetSource = null;
        let reason = '';
        let shouldSwitch = false;
        
        if (currentSource === 'grid') {
            if (solarVoltage >= AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE) {
                targetSource = 'solar';
                reason = `☀️ সোলার ভালো (${solarVoltage.toFixed(1)}V) → সোলার`;
                shouldSwitch = true;
            } 
            else if (batterySOC >= AUTO_THRESHOLDS.BATTERY_GOOD_SOC && batteryVoltage >= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                targetSource = 'battery';
                reason = `🔋 ব্যাটারি (${batterySOC.toFixed(0)}%) → ব্যাটারি`;
                shouldSwitch = true;
            }
            else {
                reason = `🏭 গ্রিড (☀️${solarVoltage.toFixed(1)}V, 🔋${batterySOC.toFixed(0)}%)`;
                updateAutoStatus(reason, 'info');
            }
        } 
        else if (currentSource === 'solar') {
            if (solarVoltage < AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE) {
                if (batterySOC >= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC && batteryVoltage >= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                    targetSource = 'battery';
                    reason = `☀️ সোলার কম → 🔋 ব্যাটারি (${batterySOC.toFixed(0)}%)`;
                    shouldSwitch = true;
                } 
                else {
                    targetSource = 'grid';
                    reason = `☀️ সোলার কম + 🔋 কম → 🏭 গ্রিড`;
                    shouldSwitch = true;
                }
            } 
            else if (batterySOC <= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC) {
                targetSource = 'grid';
                reason = `🔋 কম (${batterySOC.toFixed(0)}%) → 🏭 গ্রিড`;
                shouldSwitch = true;
            }
            else {
                reason = `☀️ সোলার (${solarVoltage.toFixed(1)}V, 🔋${batterySOC.toFixed(0)}%)`;
                updateAutoStatus(reason, 'info');
            }
        } 
        else if (currentSource === 'battery') {
            if (solarVoltage >= AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE) {
                targetSource = 'solar';
                reason = `☀️ সোলার ভালো → সোলার`;
                shouldSwitch = true;
            } 
            else if (batterySOC <= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC || batteryVoltage <= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                targetSource = 'grid';
                reason = `🔋 কম → 🏭 গ্রিড`;
                shouldSwitch = true;
            }
            else {
                reason = `🔋 ব্যাটারি (${batterySOC.toFixed(0)}%)`;
                updateAutoStatus(reason, 'info');
            }
        }
        
        const autoReasonDiv = document.getElementById('autoReason');
        const autoReasonText = document.getElementById('autoReasonText');
        
        if (autoReasonDiv && autoReasonText && reason) {
            autoReasonDiv.classList.remove('hidden');
            autoReasonText.innerHTML = reason;
        }
        
        if (shouldSwitch && targetSource && targetSource !== currentSource) {
            await executeAutoSwitch(targetSource, reason);
        }
        
    } catch (error) {
        console.error("❌ Auto check error:", error);
        updateAutoStatus('❌ চেক সমস্যা', 'error');
    }
}

// ==================== Auto Switch ====================
async function executeAutoSwitch(targetSource, reason) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const now = Date.now();
    if (window.lastAutoSwitchTime && (now - window.lastAutoSwitchTime) < 10000) {
        console.log("⏳ Cooldown");
        updateAutoStatus('⏳ সুইচ কুলডাউন', 'warning');
        return;
    }
    window.lastAutoSwitchTime = now;
    
    try {
        updateAutoStatus(`🔄 ${targetSource} এ সুইচ...`, 'info');
        
        await pushCommand('set_power_source', {
            source: targetSource,
            reason: reason,
            auto_switch: true
        });
        
        const sourceNames = { solar: '☀️ সোলার', battery: '🔋 ব্যাটারি', grid: '🏭 গ্রিড' };
        window.showNotification(`🔄 অটো: ${sourceNames[targetSource]}`, 'info');
        updateAutoStatus(`✅ ${sourceNames[targetSource]}`, 'success');
        
        const autoReasonDiv = document.getElementById('autoReason');
        const autoReasonText = document.getElementById('autoReasonText');
        if (autoReasonDiv && autoReasonText) {
            autoReasonDiv.classList.remove('hidden');
            autoReasonText.innerHTML = reason;
        }
        
        if (window.updatePowerFlowBySource) {
            window.updatePowerFlowBySource(targetSource);
        }
        
    } catch (error) {
        console.error("❌ Auto switch error:", error);
        updateAutoStatus('❌ সুইচ সমস্যা', 'error');
    }
}

// ==================== Reset from Emergency ====================
async function resetFromEmergencyStop(targetMode) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    window.showNotification('🔄 সিস্টেম রিসেট...', 'info');
    
    try {
        await pushCommand('reset_system', {
            mode: targetMode,
            emergency_reset: true
        });
        
        if (isAutoModeActive) stopAutoMode();
        
        if (targetMode === 'auto') {
            setTimeout(async () => {
                await startAutoMode();
                setTimeout(() => performAutoCheck(), 1000);
                window.showNotification('✅ অটো মোডে রিসেট', 'success');
            }, 500);
        } else {
            window.showNotification('✅ ম্যানুয়াল মোডে রিসেট', 'success');
        }
        
    } catch (error) {
        console.error("Error resetting:", error);
        window.showNotification('❌ রিসেট সমস্যা', 'error');
    }
}

// ==================== Helper ====================
function forceAutoCheck() {
    if (isAutoModeActive) {
        console.log("🔄 Force auto check...");
        lastDataReceived = 0;
        performAutoCheck();
    }
}

// ==================== Global Exports ====================
window.pushCommand = pushCommand;
window.startAutoMode = startAutoMode;
window.stopAutoMode = stopAutoMode;
window.performAutoCheck = performAutoCheck;
window.forceAutoCheck = forceAutoCheck;
window.resetFromEmergencyStop = resetFromEmergencyStop;
window.addControlAlert = addControlAlert;
window.switchMode = switchMode;
window.setPowerSource = setPowerSource;
window.setPowerSourceOff = setPowerSourceOff;
window.emergencyStop = emergencyStop;
window.sendBrushCommand = sendBrushCommand;
window.sendPumpCommand = sendPumpCommand;
window.updateAutoStatus = updateAutoStatus;

console.log("✅ Control.js - Cleaning Mode সম্পূর্ণ বাদ, ESP32 handle করবে");