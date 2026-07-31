// js/control.js - অটো মোডে ব্রাশ অটো কন্ট্রোল সহ (UI তে লুকানো থাকলেও কাজ করবে)

// ==================== Firebase Imports ====================
import { ref, onValue, get, push, update, set } from 'firebase/database';

// ==================== ইউটিলিটি: কমান্ড বিল্ডার ====================
function buildCommand(action, extraData = {}) {
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    const currentUser = window.currentUser;
    
    return {
        action: action,
        ...extraData,
        timestamp: Date.now(),
        user_id: currentUserId,
        user_email: currentUser?.email || '',
        device_id: currentDeviceId
    };
}

// ==================== ক্লিনিং সেটিংস লোডার ====================
function getCleaningSettings() {
    const defaultSettings = {
        duration: 30,
        interval: 6,
        cycles: 3,
        breakTime: 10
    };
    
    if (window.cleaningSettings) {
        return {
            ...defaultSettings,
            ...window.cleaningSettings
        };
    }
    
    return defaultSettings;
}

// ==================== মেইন কন্ট্রোল লোডার ====================
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
                <div id="autoReason" class="auto-reason hidden">
                    <i class="fas fa-info-circle"></i> <span id="autoReasonText"></span>
                </div>
                <div id="autoStatus" class="auto-status hidden">
                    <i class="fas fa-sync-alt fa-spin"></i> <span id="autoStatusText">ডাটা চেক করা হচ্ছে...</span>
                </div>
                <!-- অটো ব্রাশ স্ট্যাটাস (UI তে লুকানো) -->
                <div id="autoBrushStatus" class="auto-brush-status hidden">
                    <i class="fas fa-brush"></i> <span id="autoBrushStatusText">ব্রাশ: নিষ্ক্রিয়</span>
                </div>
            </div>
            
            <!-- Brush Control - শুধু ম্যানুয়াল মোডে দেখাবে -->
            <div id="brushCard" class="card">
                <div class="card-header"><i class="fas fa-brush"></i><h3>ব্রাশ কন্ট্রোল</h3></div>
                <div class="brush-mode">
                    <span class="brush-mode-label"><i class="fas fa-info-circle"></i> ব্রাশ মোড: <strong id="brushModeText">ম্যানুয়াল</strong></span>
                </div>
                <div id="manualBrushControls" class="manual-controls">
                    <div class="direction-buttons">
                        <button id="brushForwardBtn" class="btn-control success"><i class="fas fa-arrow-right"></i> ফরওয়ার্ড</button>
                        <button id="brushReverseBtn" class="btn-control warning"><i class="fas fa-arrow-left"></i> রিভার্স</button>
                        <button id="brushStopBtn" class="btn-control danger"><i class="fas fa-stop"></i> স্টপ</button>
                    </div>
                </div>
                <div class="mt-2">ব্রাশ: <strong id="brushStatusText">বন্ধ</strong></div>
            </div>
            
            <!-- Pump Control - শুধু ম্যানুয়াল মোডে দেখাবে -->
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
}

// ==================== ইভেন্ট লিসেনার সেটআপ ====================
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

// ==================== স্ট্যাটাস লিসেনার ====================
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
                updateAutoStatus('ডাটা প্রাপ্ত - বিশ্লেষণ করা হচ্ছে...', 'success');
                // অটো ব্রাশ স্ট্যাটাস আপডেট
                updateAutoBrushStatus(data);
            }
        }
    });
}

// ==================== কারেন্ট স্ট্যাটাস লোড ====================
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

// ==================== UI আপডেট ফাংশন ====================
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
    const autoBrushStatusDiv = document.getElementById('autoBrushStatus');
    
    if (mode === 'manual') {
        if (powerSourceSection) powerSourceSection.classList.remove('hidden');
        if (brushCard) brushCard.classList.remove('hidden');
        if (pumpCard) pumpCard.classList.remove('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.add('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
        if (autoBrushStatusDiv) autoBrushStatusDiv.classList.add('hidden');
        
        const brushModeText = document.getElementById('brushModeText');
        if (brushModeText) {
            brushModeText.textContent = 'ম্যানুয়াল';
            brushModeText.style.color = '#f59e0b';
        }
        
    } else if (mode === 'auto') {
        if (powerSourceSection) powerSourceSection.classList.add('hidden');
        if (brushCard) brushCard.classList.add('hidden');
        if (pumpCard) pumpCard.classList.add('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.remove('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.remove('hidden');
        if (autoBrushStatusDiv) autoBrushStatusDiv.classList.remove('hidden');
        
        if (status.last_switch_reason && autoReasonText) {
            autoReasonText.innerHTML = status.last_switch_reason;
        } else if (status.current_reason && autoReasonText) {
            autoReasonText.innerHTML = status.current_reason;
        } else if (autoReasonText) {
            autoReasonText.innerHTML = '🤖 অটো মোড সক্রিয় - ব্রাশ স্বয়ংক্রিয়ভাবে কাজ করছে';
        }
        
        updateAutoStatus('সিস্টেম মনিটরিং চলছে...', 'info');
        
    } else {
        if (powerSourceSection) powerSourceSection.classList.add('hidden');
        if (brushCard) brushCard.classList.add('hidden');
        if (pumpCard) pumpCard.classList.add('hidden');
        if (autoReasonDiv) autoReasonDiv.classList.add('hidden');
        if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
        if (autoBrushStatusDiv) autoBrushStatusDiv.classList.add('hidden');
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

function updateAutoBrushStatus(data) {
    const statusText = document.getElementById('autoBrushStatusText');
    const statusDiv = document.getElementById('autoBrushStatus');
    
    if (!statusText || !statusDiv) return;
    
    const brushStatus = data.brush_status || 'stopped';
    const cleaningStatus = data.cleaning_status || 'inactive';
    
    let status = '';
    let color = '';
    
    if (cleaningStatus === 'active') {
        if (brushStatus === 'forward') {
            status = '🔄 ফরওয়ার্ড চলছে';
            color = '#10b981';
        } else if (brushStatus === 'reverse') {
            status = '🔄 রিভার্স চলছে';
            color = '#f59e0b';
        } else {
            status = '⏸ ব্রাশ বিরতি';
            color = '#60a5fa';
        }
    } else if (cleaningStatus === 'paused') {
        status = '⏸ বিরতিতে';
        color = '#f59e0b';
    } else {
        status = '⏹ নিষ্ক্রিয়';
        color = '#6b7280';
    }
    
    statusText.textContent = `🧹 ${status}`;
    statusText.style.color = color;
    statusDiv.classList.remove('hidden');
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

// ==================== মোড স্যুইচ ====================
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
        const confirmReset = confirm(`⚠️ সিস্টেম জরুরি বন্ধ অবস্থায় আছে। রিসেট করে অটো মোডে যেতে চান?`);
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
        const command = buildCommand('set_mode', { mode });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        const brushMode = (mode === 'auto') ? 'auto' : 'manual';
        const brushCommand = buildCommand('brush_control', {
            command: mode === 'auto' ? 'auto_mode' : 'manual_mode',
            mode: brushMode
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), brushCommand);
        
        await update(statusRef, { 
            mode: mode, 
            brush_mode: brushMode,
            last_updated: Date.now(),
            auto_mode_running: (mode === 'auto')
        });
        
        if (mode === 'auto') {
            await startAutoMode();
            setTimeout(async () => {
                await startCleaning();
                performAutoCheck();
            }, 1500);
        } else {
            stopAutoMode();
            if (mode === 'manual') {
                await update(statusRef, { power_source: 'grid' });
                await sendBrushCommand('stop');
            }
        }
        
        const modeNames = { auto: 'অটো', manual: 'ম্যানুয়াল', stop: 'জরুরি বন্ধ' };
        window.showNotification(`${modeNames[mode]} মোড চালু হয়েছে${mode === 'auto' ? ' - ব্রাশ স্বয়ংক্রিয়' : ''}`, 'success');
        
        if (mode === 'stop') {
            await setPowerSourceOff('জরুরি বন্ধে সব পাওয়ার অফ');
        }
        
        const updatedStatus = { 
            mode: mode, 
            power_source: currentStatus.power_source || 'grid',
            brush_mode: (mode === 'auto') ? 'auto' : 'manual'
        };
        updateControlStatusUI(updatedStatus);
        
    } catch (error) {
        console.error("Error switching mode:", error);
        window.showNotification('মোড পরিবর্তনে সমস্যা হয়েছে', 'error');
    }
}

// ==================== পাওয়ার সোর্স টগল ====================
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
        await setPowerSourceOff('সোর্স অফ করা হয়েছে');
        return;
    }
    
    if (currentMode === 'stop') {
        window.showNotification('⚠️ সিস্টেম জরুরি বন্ধ অবস্থায় আছে। আগে রিসেট করুন।', 'warning');
        return;
    }
    
    if (currentMode === 'auto') {
        window.showNotification('⚠️ অটো মোডে পাওয়ার সোর্স পরিবর্তন করা যাবে না। ম্যানুয়াল মোডে সুইচ করুন।', 'warning');
        return;
    }
    
    let relay1 = false, relay2 = false, relay3 = false;
    if (source === 'solar') relay1 = true;
    else if (source === 'battery') relay2 = true;
    else if (source === 'grid') relay3 = true;
    
    try {
        const command = buildCommand('set_power_source', {
            source: source,
            relays: { relay1, relay2, relay3 },
            toggle: true
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        await update(statusRef, { 
            power_source: source, 
            last_updated: Date.now(),
            source_changed_by: 'manual'
        });
        
        const names = { solar: '☀️ সোলার', battery: '🔋 ব্যাটারি', grid: '🏭 গ্রিড' };
        window.showNotification(`${names[source]} চালু করা হয়েছে`, 'success');
        
        updateControlStatusUI({ 
            mode: 'manual', 
            power_source: source, 
            brush_mode: currentStatus.brush_mode || 'manual' 
        });
        
        if (window.updatePowerFlowBySource) {
            window.updatePowerFlowBySource(source);
        }
        
        await addControlAlert('info', `পাওয়ার সোর্স পরিবর্তন: ${names[source]}`);
        
    } catch (error) {
        console.error("Error setting power source:", error);
        window.showNotification('পাওয়ার সোর্স পরিবর্তনে সমস্যা হয়েছে', 'error');
    }
}

// ==================== সব পাওয়ার অফ ====================
async function setPowerSourceOff(reason = 'ম্যানুয়ালি অফ করা হয়েছে') {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
    
    try {
        const command = buildCommand('set_power_source', {
            source: 'off',
            relays: { relay1: false, relay2: false, relay3: false },
            toggle: true
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        await update(statusRef, { 
            power_source: 'off', 
            last_updated: Date.now(),
            source_changed_by: 'manual'
        });
        
        window.showNotification('⚡ সব পাওয়ার সোর্স বন্ধ করা হয়েছে', 'warning');
        
        const statusSnapshot = await get(statusRef);
        const currentStatus = statusSnapshot.val() || {};
        updateControlStatusUI({ 
            mode: 'manual', 
            power_source: 'off', 
            brush_mode: currentStatus.brush_mode || 'manual' 
        });
        
        await addControlAlert('warning', reason);
        
    } catch (error) {
        console.error("Error turning off power:", error);
        window.showNotification('পাওয়ার অফ করতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== জরুরি বন্ধ ====================
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
        
        const command = buildCommand('emergency_stop', {
            relays: { relay1: false, relay2: false, relay3: false },
            reason: 'User initiated emergency stop'
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        await update(statusRef, { 
            mode: 'stop', 
            power_source: 'off', 
            last_updated: Date.now(),
            auto_mode_running: false,
            brush_mode: 'manual',
            current_reason: 'জরুরি বন্ধ করা হয়েছে'
        });
        
        window.showNotification('⛔ সিস্টেম জরুরি বন্ধ করা হয়েছে', 'error');
        await addControlAlert('error', 'সিস্টেম জরুরি বন্ধ করা হয়েছে');
        updateControlStatusUI({ mode: 'stop', power_source: 'off', brush_mode: 'manual' });
        
    } catch (error) {
        console.error("Error in emergency stop:", error);
        window.showNotification('জরুরি বন্ধ করতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== ব্রাশ কমান্ড ====================
async function sendBrushCommand(command) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan?.textContent === 'অটো' || modeSpan?.textContent === 'জরুরি বন্ধ') {
        window.showNotification('অটো বা স্টপ মোডে ব্রাশ কন্ট্রোল করা যাবে না', 'warning');
        return;
    }
    
    try {
        const cmd = buildCommand('brush_control', { command });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), cmd);
        
        const names = { forward: 'ফরওয়ার্ড', reverse: 'রিভার্স', stop: 'বন্ধ' };
        window.showNotification(`ব্রাশ ${names[command] || command}`, 'success');
    } catch (error) {
        console.error("Error sending brush command:", error);
        window.showNotification('ব্রাশ কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== পাম্প কমান্ড ====================
async function sendPumpCommand(state) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const modeSpan = document.getElementById('currentModeStatus');
    if (modeSpan?.textContent === 'অটো' || modeSpan?.textContent === 'জরুরি বন্ধ') {
        window.showNotification('অটো বা স্টপ মোডে পাম্প কন্ট্রোল করা যাবে না', 'warning');
        return;
    }
    
    try {
        const command = buildCommand('pump_control', { state });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        window.showNotification(`পাম্প ${state === 'on' ? 'চালু' : 'বন্ধ'} করা হয়েছে`, 'success');
    } catch (error) {
        console.error("Error sending pump command:", error);
        window.showNotification('পাম্প কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== ক্লিনিং কমান্ড ====================
async function startCleaning() {
    const settings = getCleaningSettings();
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        const command = buildCommand('cleaning_control', {
            mode: 'start',
            duration: settings.duration,
            interval: settings.interval,
            cycles: settings.cycles,
            breakTime: settings.breakTime
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        console.log(`🧹 Auto cleaning started: ${settings.duration}s × ${settings.cycles} cycles`);
        
        // অটো ব্রাশ স্ট্যাটাস আপডেট
        const statusText = document.getElementById('autoBrushStatusText');
        if (statusText) {
            statusText.textContent = '🧹 ক্লিনিং শুরু - ব্রাশ চলছে';
            statusText.style.color = '#10b981';
        }
        
    } catch (error) {
        console.error("Error starting cleaning:", error);
    }
}

async function stopCleaning() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    try {
        const command = buildCommand('cleaning_control', { mode: 'stop' });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        console.log('⏹ Auto cleaning stopped');
        
        const statusText = document.getElementById('autoBrushStatusText');
        if (statusText) {
            statusText.textContent = '⏹ ক্লিনিং বন্ধ';
            statusText.style.color = '#ef4444';
        }
        
    } catch (error) {
        console.error("Error stopping cleaning:", error);
    }
}

// ==================== অ্যালার্ট ====================
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

// ==================== স্মার্ট অটো মোড ====================
let isAutoModeActive = false;
let autoCheckInterval = null;
let cleaningInterval = null;
let dataTimeout = null;
let lastDataReceived = 0;
const DATA_TIMEOUT_MS = 15000;
const CHECK_INTERVAL_MS = 5000;

const AUTO_THRESHOLDS = {
    SOLAR_MIN_VOLTAGE: 12.5,
    SOLAR_GOOD_VOLTAGE: 13.0,
    BATTERY_MIN_VOLTAGE: 11.8,
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
    console.log("🤖 Smart auto mode started with brush control");
    updateAutoStatus('অটো মোড শুরু - ডাটা মনিটরিং চলছে...', 'info');
    
    // অটো ব্রাশ স্ট্যাটাস দেখান
    const autoBrushDiv = document.getElementById('autoBrushStatus');
    if (autoBrushDiv) {
        autoBrushDiv.classList.remove('hidden');
    }
    
    // অটো ক্লিনিং শুরু
    const settings = getCleaningSettings();
    const intervalMs = settings.interval * 60 * 60 * 1000;
    
    setTimeout(async () => {
        if (isAutoModeActive) {
            await startCleaning();
            performAutoCheck();
        }
    }, 1500);
    
    // রেগুলার চেক ইন্টারভাল
    autoCheckInterval = setInterval(() => {
        if (isAutoModeActive) {
            const now = Date.now();
            const timeSinceLastData = now - lastDataReceived;
            
            if (timeSinceLastData > DATA_TIMEOUT_MS) {
                updateAutoStatus(`⚠️ ${Math.round(timeSinceLastData/1000)}সেকেন্ড ডাটা পাওয়া যায়নি - গ্রিড মোডে`, 'warning');
                switchToGridOnTimeout();
            } else {
                performAutoCheck();
            }
        }
    }, CHECK_INTERVAL_MS);
    
    // ক্লিনিং ইন্টারভাল
    if (cleaningInterval) {
        clearInterval(cleaningInterval);
        cleaningInterval = null;
    }
    
    cleaningInterval = setInterval(() => {
        if (isAutoModeActive) {
            console.log('🧹 Scheduled cleaning starting...');
            startCleaning();
        }
    }, intervalMs);
}

function stopAutoMode() {
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
    }
    if (cleaningInterval) {
        clearInterval(cleaningInterval);
        cleaningInterval = null;
    }
    if (dataTimeout) {
        clearTimeout(dataTimeout);
        dataTimeout = null;
    }
    isAutoModeActive = false;
    console.log("🛑 Auto mode stopped");
    
    stopCleaning();
    
    const autoStatusDiv = document.getElementById('autoStatus');
    if (autoStatusDiv) autoStatusDiv.classList.add('hidden');
    
    const autoBrushDiv = document.getElementById('autoBrushStatus');
    if (autoBrushDiv) autoBrushDiv.classList.add('hidden');
}

// ==================== টাইমআউট হলে গ্রিডে সুইচ ====================
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
            updateAutoStatus('✅ গ্রিড মোডে রয়েছে - ডাটা আসার অপেক্ষায়', 'success');
            return;
        }
        
        console.log('⏰ Data timeout - Switching to grid');
        updateAutoStatus('⏰ ডাটা টাইমআউট - গ্রিডে সুইচ করা হচ্ছে...', 'warning');
        
        const command = buildCommand('set_power_source', {
            source: 'grid',
            relays: { relay1: false, relay2: false, relay3: true },
            reason: 'Data timeout - switching to grid',
            auto_switch: true
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        await update(statusRef, {
            power_source: 'grid',
            last_updated: Date.now(),
            current_reason: `⏰ ${Math.round((Date.now() - lastDataReceived)/1000)}সেকেন্ড ডাটা পাওয়া যায়নি - গ্রিডে সুইচ`
        });
        
        const autoReasonText = document.getElementById('autoReasonText');
        if (autoReasonText) {
            autoReasonText.innerHTML = `⏰ ডাটা টাইমআউট - গ্রিডে সুইচ করা হয়েছে`;
        }
        
        await addControlAlert('warning', `ডাটা টাইমআউট - গ্রিডে সুইচ`);
        
    } catch (error) {
        console.error("Error switching to grid on timeout:", error);
    }
}

// ==================== অটো চেক ====================
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
                updateAutoStatus(`⏰ ${Math.round(timeSinceLastData/1000)}সেকেন্ড ডাটা পাওয়া যায়নি`, 'warning');
            }
            return;
        }
        
        lastDataReceived = Date.now();
        updateAutoStatus('✅ ডাটা প্রাপ্ত - বিশ্লেষণ করা হচ্ছে...', 'success');
        
        const solarVoltage = parseFloat(data.solar_voltage) || 0;
        const batteryVoltage = parseFloat(data.battery_voltage) || 0;
        const batterySOC = parseFloat(data.battery_soc) || 0;
        const currentSource = currentStatus.power_source || 'grid';
        
        let targetSource = null;
        let reason = '';
        let shouldSwitch = false;
        
        // ========== স্মার্ট সুইচিং লজিক ==========
        
        if (currentSource === 'grid') {
            if (solarVoltage >= AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE) {
                targetSource = 'solar';
                reason = `☀️ সোলার ভালো (${solarVoltage.toFixed(1)}V) → সোলার চালু`;
                shouldSwitch = true;
            } 
            else if (batterySOC >= AUTO_THRESHOLDS.BATTERY_GOOD_SOC && batteryVoltage >= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                targetSource = 'battery';
                reason = `🔋 ব্যাটারি ভালো (${batterySOC.toFixed(0)}%, ${batteryVoltage.toFixed(1)}V) → ব্যাটারি চালু`;
                shouldSwitch = true;
            }
            else {
                reason = `🏭 গ্রিড চলছে (সোলার: ${solarVoltage.toFixed(1)}V, ব্যাটারি: ${batterySOC.toFixed(0)}%)`;
                updateAutoStatus(reason, 'info');
            }
        } 
        else if (currentSource === 'solar') {
            const isSolarGood = solarVoltage >= AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE;
            
            if (!isSolarGood) {
                if (batterySOC >= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC && batteryVoltage >= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                    targetSource = 'battery';
                    reason = `☀️ সোলার কম (${solarVoltage.toFixed(1)}V) → 🔋 ব্যাটারি চালু (${batterySOC.toFixed(0)}%)`;
                    shouldSwitch = true;
                } 
                else {
                    targetSource = 'grid';
                    reason = `☀️ সোলার কম (${solarVoltage.toFixed(1)}V) ও 🔋 ব্যাটারি কম (${batterySOC.toFixed(0)}%) → 🏭 গ্রিড চালু`;
                    shouldSwitch = true;
                }
            } 
            else if (batterySOC <= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC) {
                targetSource = 'grid';
                reason = `🔋 ব্যাটারি কম (${batterySOC.toFixed(0)}%) → 🏭 গ্রিড চালু`;
                shouldSwitch = true;
            }
            else {
                reason = `☀️ সোলার চলছে (${solarVoltage.toFixed(1)}V, ব্যাটারি: ${batterySOC.toFixed(0)}%)`;
                updateAutoStatus(reason, 'info');
            }
        } 
        else if (currentSource === 'battery') {
            if (solarVoltage >= AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE) {
                targetSource = 'solar';
                reason = `☀️ সোলার ভালো (${solarVoltage.toFixed(1)}V) → সোলার চালু`;
                shouldSwitch = true;
            } 
            else if (batterySOC <= AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC || batteryVoltage <= AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE) {
                targetSource = 'grid';
                reason = `🔋 ব্যাটারি কম (${batterySOC.toFixed(0)}%, ${batteryVoltage.toFixed(1)}V) → 🏭 গ্রিড চালু`;
                shouldSwitch = true;
            }
            else {
                reason = `🔋 ব্যাটারি চলছে (${batterySOC.toFixed(0)}%, ${batteryVoltage.toFixed(1)}V)`;
                updateAutoStatus(reason, 'info');
            }
        }
        
        const autoReasonDiv = document.getElementById('autoReason');
        const autoReasonText = document.getElementById('autoReasonText');
        
        if (autoReasonDiv && autoReasonText && reason) {
            autoReasonDiv.classList.remove('hidden');
            autoReasonText.innerHTML = reason;
            await update(statusRef, { current_reason: reason });
        }
        
        if (shouldSwitch && targetSource && targetSource !== currentSource) {
            await executeAutoSwitch(targetSource, reason);
        }
        
    } catch (error) {
        console.error("❌ Auto check error:", error);
        updateAutoStatus('❌ চেক করতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== অটো সুইচ ====================
async function executeAutoSwitch(targetSource, reason) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) return;
    
    const now = Date.now();
    if (window.lastAutoSwitchTime && (now - window.lastAutoSwitchTime) < 10000) {
        console.log("⏳ Auto switch cooldown active");
        updateAutoStatus('⏳ সুইচ কুলডাউন - অপেক্ষা করুন', 'warning');
        return;
    }
    window.lastAutoSwitchTime = now;
    
    let relay1 = false, relay2 = false, relay3 = false;
    if (targetSource === 'solar') relay1 = true;
    else if (targetSource === 'battery') relay2 = true;
    else if (targetSource === 'grid') relay3 = true;
    
    try {
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        const statusSnapshot = await get(statusRef);
        const currentSource = statusSnapshot.val()?.power_source || 'unknown';
        
        updateAutoStatus(`🔄 ${targetSource} এ সুইচ করা হচ্ছে...`, 'info');
        
        const command = buildCommand('set_power_source', {
            source: targetSource,
            relays: { relay1, relay2, relay3 },
            reason: reason,
            auto_switch: true
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command);
        
        await update(statusRef, {
            power_source: targetSource,
            last_updated: now,
            last_switch_reason: reason,
            current_reason: reason,
            last_auto_switch: {
                from: currentSource,
                to: targetSource,
                reason: reason,
                time: now
            }
        });
        
        const sourceNames = { solar: '☀️ সোলার', battery: '🔋 ব্যাটারি', grid: '🏭 গ্রিড' };
        window.showNotification(`🔄 অটো সুইচ: ${sourceNames[targetSource]}`, 'info');
        updateAutoStatus(`✅ ${sourceNames[targetSource]} এ সুইচ করা হয়েছে`, 'success');
        
        const autoReasonDiv = document.getElementById('autoReason');
        const autoReasonText = document.getElementById('autoReasonText');
        if (autoReasonDiv && autoReasonText) {
            autoReasonDiv.classList.remove('hidden');
            autoReasonText.innerHTML = reason;
        }
        
        if (window.updatePowerFlowBySource) {
            window.updatePowerFlowBySource(targetSource);
        }
        
        await addControlAlert('info', `অটো সুইচ: ${reason}`);
        
    } catch (error) {
        console.error("❌ Auto switch error:", error);
        updateAutoStatus('❌ সুইচ করতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== সিস্টেম রিসেট ====================
async function resetFromEmergencyStop(targetMode) {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন', 'error');
        return;
    }
    
    window.showNotification('🔄 সিস্টেম রিসেট করা হচ্ছে...', 'info');
    
    try {
        const statusRef = ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/system_status`);
        
        const brushMode = (targetMode === 'auto') ? 'auto' : 'manual';
        const updateData = {
            mode: targetMode,
            power_source: 'grid',
            brush_mode: brushMode,
            last_updated: Date.now(),
            auto_mode_running: (targetMode === 'auto'),
            current_reason: targetMode === 'auto' ? 'ইমার্জেন্সি স্টপ থেকে রিসেট করে অটো মোড চালু' : 'ইমার্জেন্সি স্টপ থেকে রিসেট করে ম্যানুয়াল মোড চালু'
        };
        
        await update(statusRef, updateData);
        
        const resetCommand = buildCommand('reset_system', {
            mode: targetMode,
            emergency_reset: true,
            reason: `Reset from emergency stop to ${targetMode} mode`
        });
        await set(ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), resetCommand);
        
        if (isAutoModeActive) {
            stopAutoMode();
        }
        
        if (targetMode === 'auto') {
            setTimeout(async () => {
                await startAutoMode();
                setTimeout(() => performAutoCheck(), 1000);
                window.showNotification('✅ অটো মোডে রিসেট সম্পূর্ণ - ব্রাশ স্বয়ংক্রিয়', 'success');
            }, 500);
        } else {
            window.showNotification('✅ ম্যানুয়াল মোডে রিসেট সম্পূর্ণ', 'success');
        }
        
        await addControlAlert('info', `সিস্টেম রিসেট করা হয়েছে (${targetMode} মোড)`);
        
        const updatedStatus = { 
            mode: targetMode, 
            power_source: 'grid',
            brush_mode: brushMode,
            current_reason: updateData.current_reason
        };
        updateControlStatusUI(updatedStatus);
        
    } catch (error) {
        console.error("Error resetting from emergency stop:", error);
        window.showNotification('❌ সিস্টেম রিসেট করতে সমস্যা হয়েছে', 'error');
    }
}

// ==================== হেল্পার ফাংশন ====================
function forceAutoCheck() {
    if (isAutoModeActive) {
        console.log("🔄 Forcing auto check...");
        lastDataReceived = 0;
        performAutoCheck();
    } else {
        console.log("❌ Auto mode is not active");
    }
}

// ==================== গ্লোবাল এক্সপোর্ট ====================
window.startAutoMode = startAutoMode;
window.stopAutoMode = stopAutoMode;
window.performAutoCheck = performAutoCheck;
window.forceAutoCheck = forceAutoCheck;
window.resetFromEmergencyStop = resetFromEmergencyStop;
window.addControlAlert = addControlAlert;
window.buildCommand = buildCommand;
window.switchMode = switchMode;
window.setPowerSource = setPowerSource;
window.setPowerSourceOff = setPowerSourceOff;
window.emergencyStop = emergencyStop;
window.getCleaningSettings = getCleaningSettings;
window.startCleaning = startCleaning;
window.stopCleaning = stopCleaning;
window.sendBrushCommand = sendBrushCommand;
window.sendPumpCommand = sendPumpCommand;
window.updateAutoStatus = updateAutoStatus;
window.updateAutoBrushStatus = updateAutoBrushStatus;

console.log("✅ Control.js loaded - Auto mode with brush control fully integrated");