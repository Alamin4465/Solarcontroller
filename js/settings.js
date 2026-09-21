// js/settings.js - ESP32 v6.8.9 aligned defaults
// Battery SOC: Linear (11.0V = 0%, 13.7V = 100%)
// ✅ v2.2 — Priority loop aligned, safe number cast, warning banner

// ==================== ডিফল্ট সেটিংস ====================
const DEFAULT_CLEANING_SETTINGS = Object.freeze({
    duration: 30,
    interval: 6,
    cycles: 3,
    breakTime: 10
});

const DEFAULT_BATTERY_CUTOFF = Object.freeze({
    fullVoltage: 13.7,
    recoverVoltage: 13.0
});

const DEFAULT_THRESHOLDS = Object.freeze({
    SOLAR_MIN_VOLTAGE: 12.5,
    SOLAR_GOOD_VOLTAGE: 13.5,
    BATTERY_MIN_VOLTAGE: 11.8,
    BATTERY_CRITICAL_SOC: 25,
    BATTERY_GOOD_SOC: 40
});

const VALIDATION_RANGES = Object.freeze({
    SOLAR_MIN_VOLTAGE: { min: 10.0, max: 15.0 },
    SOLAR_GOOD_VOLTAGE: { min: 11.0, max: 16.0 },
    BATTERY_MIN_VOLTAGE: { min: 10.0, max: 14.0 },
    BATTERY_CRITICAL_SOC: { min: 0, max: 100 },
    BATTERY_GOOD_SOC: { min: 0, max: 100 },
    CLEANING_DURATION: { min: 5, max: 300 },
    CLEANING_CYCLES: { min: 1, max: 10 },
    CLEANING_BREAK: { min: 1, max: 30 },
    CLEANING_INTERVAL: { min: 1, max: 48 },
    BATTERY_FULL_V: { min: 12.5, max: 15.0 },
    BATTERY_RECOVER_V: { min: 11.5, max: 14.0 }
});

// ==================== Helpers ====================
function safeNumber(value, fallback = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? fallback : num;
}

function safeInt(value, fallback = 0) {
    const num = parseInt(value, 10);
    return isNaN(num) ? fallback : num;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// ==================== গ্লোবাল সেটিংস ====================
window.cleaningSettings = { ...DEFAULT_CLEANING_SETTINGS };
window.batteryCutoffSettings = { ...DEFAULT_BATTERY_CUTOFF };

if (!window.AUTO_THRESHOLDS) {
    window.AUTO_THRESHOLDS = {
        SOLAR_MIN_VOLTAGE: 12.5,
        SOLAR_GOOD_VOLTAGE: 13.5,
        BATTERY_MIN_VOLTAGE: 11.8,
        BATTERY_CRITICAL_SOC: 25,
        BATTERY_GOOD_SOC: 40,
        CHECK_INTERVAL: 5000
    };
}

// ==================== Setup ====================
export function setupSettings() {
    const settingsBtn = document.getElementById("settingsMenuBtn");
    const dropdown = document.getElementById("dropdown");

    if (settingsBtn) {
        const newSettingsBtn = settingsBtn.cloneNode(true);
        settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);

        newSettingsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            showSettingsPanel();
            if (dropdown) dropdown.style.display = "none";
        });
    }

    loadSettingsFromFirebase();
}

// ==================== Firebase থেকে লোড ====================
function loadSettingsFromFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) {
        console.log("⏳ Waiting for device selection...");
        return;
    }

    const settingsRef = window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings`);

    window.get(settingsRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                
                if (settings.auto_mode_thresholds) {
                    const t = settings.auto_mode_thresholds;
                    if (window.AUTO_THRESHOLDS) {
                        window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE = safeNumber(t.SOLAR_MIN_VOLTAGE, 12.5);
                        window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE = safeNumber(t.SOLAR_GOOD_VOLTAGE, 13.5);
                        window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE = safeNumber(t.BATTERY_MIN_VOLTAGE, 11.8);
                        window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC = safeInt(t.BATTERY_CRITICAL_SOC, 25);
                        window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC = safeInt(t.BATTERY_GOOD_SOC, 40);
                    }
                    console.log("✅ Thresholds loaded");
                }

                if (settings.cleaning) {
                    window.cleaningSettings = {
                        duration: safeInt(settings.cleaning.duration, 30),
                        interval: safeInt(settings.cleaning.interval, 6),
                        cycles: safeInt(settings.cleaning.cycles, 3),
                        breakTime: safeInt(settings.cleaning.breakTime, 10)
                    };
                    console.log("✅ Cleaning settings loaded");
                }

                if (settings.battery_cutoff) {
                    window.batteryCutoffSettings = {
                        fullVoltage: safeNumber(settings.battery_cutoff.full_voltage, 13.7),
                        recoverVoltage: safeNumber(settings.battery_cutoff.recover_voltage, 13.0)
                    };
                    console.log("✅ Battery cutoff loaded");
                }
            } else {
                console.log("📝 Saving defaults...");
                saveDefaultSettingsToFirebase();
            }
        })
        .catch((error) => console.error("Error loading settings:", error));
}

function saveDefaultSettingsToFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) return;

    const settingsRef = window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings`);
    const defaultSettings = {
        auto_mode_thresholds: {
            SOLAR_MIN_VOLTAGE: 12.5, SOLAR_GOOD_VOLTAGE: 13.5,
            BATTERY_MIN_VOLTAGE: 11.8, BATTERY_CRITICAL_SOC: 25,
            BATTERY_GOOD_SOC: 40, last_updated: Date.now()
        },
        cleaning: {
            duration: 30, interval: 6, cycles: 3, breakTime: 10, last_updated: Date.now()
        },
        battery_cutoff: {
            full_voltage: 13.7, recover_voltage: 13.0, last_updated: Date.now()
        }
    };

    window.set(settingsRef, defaultSettings)
        .then(() => console.log("✅ Default settings saved"))
        .catch((error) => console.error("Error:", error));
}

// ==================== মেইন সেটিংস প্যানেল ====================
function showSettingsPanel() {
    const content = document.getElementById("content");
    if (!content) return;

    content.innerHTML = `
        <div class="settings-container">
            <div class="settings-header">
                <i class="fas fa-cog"></i>
                <h2>সিস্টেম সেটিংস</h2>
                <p>আপনার সিস্টেম কাস্টমাইজ করুন</p>
            </div>
            
            <div class="settings-buttons-grid">
                <div class="settings-btn-card" data-setting="threshold">
                    <div class="settings-btn-icon"><i class="fas fa-sliders-h"></i></div>
                    <div class="settings-btn-info">
                        <h3>অটো মোড থ্রেশহোল্ড</h3>
                        <p>ভোল্টেজ ও SOC এর লিমিট সেট করুন</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </div>
                
                <div class="settings-btn-card" data-setting="cleaning">
                    <div class="settings-btn-icon"><i class="fas fa-brush"></i></div>
                    <div class="settings-btn-info">
                        <h3>অটো ক্লিনিং সেটিংস</h3>
                        <p>ব্রাশের সময়, সাইকেল ও ব্যবধান সেট করুন</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </div>
                
                <div class="settings-btn-card" data-setting="battery">
                    <div class="settings-btn-icon"><i class="fas fa-battery-full"></i></div>
                    <div class="settings-btn-info">
                        <h3>ব্যাটারি কাটঅফ সেটিংস</h3>
                        <p>ফুল (13.7V) ও রিকভার (13.0V) ভোল্টেজ</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </div>
                
                <div class="settings-btn-card" data-setting="remote">
                    <div class="settings-btn-icon"><i class="fas fa-wifi"></i></div>
                    <div class="settings-btn-info">
                        <h3>রিমোট কনফিগারেশন</h3>
                        <p>ওয়াইফাই ও ডিভাইস সেটিংস পরিবর্তন</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </div>
                
                <div class="settings-btn-card" data-setting="history">
                    <div class="settings-btn-icon"><i class="fas fa-history"></i></div>
                    <div class="settings-btn-info">
                        <h3>হিস্ট্রি ক্লিয়ার</h3>
                        <p>পুরনো ডাটা ডিলিট করুন</p>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.settings-btn-card').forEach(btn => {
        btn.addEventListener('click', () => showSettingPanel(btn.dataset.setting));
    });
}

function showSettingPanel(setting) {
    const content = document.getElementById("content");
    if (!content) return;

    if (setting === 'threshold') showThresholdPanel(content);
    else if (setting === 'cleaning') showCleaningPanel(content);
    else if (setting === 'battery') showBatteryCutoffPanel(content);
    else if (setting === 'remote') showRemotePanel(content);
    else if (setting === 'history') showHistoryPanel(content);
}

// ==================== Thresholds Panel ====================
function showThresholdPanel(content) {
    const thresholds = getCurrentThresholds();

    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-sliders-h"></i> অটো মোড থ্রেশহোল্ড</h2>
            </div>
            <div class="panel-body">
                <div class="threshold-section">
                    <div class="threshold-card">
                        <div class="threshold-header">
                            <i class="fas fa-sun"></i>
                            <h3>সোলার প্যানেল সেটিংস</h3>
                        </div>
                        <div class="threshold-item">
                            <label>সোলার মিনিমাম ভোল্টেজ: <span id="solarMinLabel">${safeNumber(thresholds.SOLAR_MIN_VOLTAGE).toFixed(1)}V</span></label>
                            <input type="range" id="solarMinVoltage" min="10" max="15" step="0.1" value="${safeNumber(thresholds.SOLAR_MIN_VOLTAGE)}">
                            <small>এই ভোল্টেজের কম হলে সোলার থেকে সুইচ করবে (recommended: 12.5V)</small>
                        </div>
                        <div class="threshold-item">
                            <label>সোলার গুড ভোল্টেজ: <span id="solarGoodLabel">${safeNumber(thresholds.SOLAR_GOOD_VOLTAGE).toFixed(1)}V</span></label>
                            <input type="range" id="solarGoodVoltage" min="11" max="16" step="0.1" value="${safeNumber(thresholds.SOLAR_GOOD_VOLTAGE)}">
                            <small>এই ভোল্টেজের বেশি হলে সোলারে সুইচ করবে (recommended: 13.5V)</small>
                        </div>
                    </div>
                    
                    <div class="threshold-card">
                        <div class="threshold-header">
                            <i class="fas fa-car-battery"></i>
                            <h3>ব্যাটারি সেটিংস</h3>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি মিনিমাম ভোল্টেজ: <span id="batteryMinLabel">${safeNumber(thresholds.BATTERY_MIN_VOLTAGE).toFixed(1)}V</span></label>
                            <input type="range" id="batteryMinVoltage" min="10" max="14" step="0.1" value="${safeNumber(thresholds.BATTERY_MIN_VOLTAGE)}">
                            <small>এই ভোল্টেজের কম হলে ব্যাটারি থেকে সুইচ করবে (recommended: 11.8V)</small>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি ক্রিটিক্যাল SOC: <span id="batteryCriticalLabel">${safeInt(thresholds.BATTERY_CRITICAL_SOC)}%</span></label>
                            <input type="range" id="batteryCriticalSOC" min="0" max="100" value="${safeInt(thresholds.BATTERY_CRITICAL_SOC)}">
                            <small>এই SOC এর কম হলে ব্যাটারি ব্যবহার করবে না</small>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি গুড SOC: <span id="batteryGoodLabel">${safeInt(thresholds.BATTERY_GOOD_SOC)}%</span></label>
                            <input type="range" id="batteryGoodSOC" min="0" max="100" value="${safeInt(thresholds.BATTERY_GOOD_SOC)}">
                            <small>এই SOC এর বেশি হলে ব্যাটারি চালু করবে</small>
                        </div>
                    </div>
                </div>
                
                <button id="saveThresholdsBtn" class="save-settings-btn">
                    <i class="fas fa-save"></i> থ্রেশহোল্ড সংরক্ষণ
                </button>
            </div>
        </div>
    `;

    const bindLive = (id, labelId, isFloat = true) => {
        const el = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (el && label) {
            el.addEventListener('input', (e) => {
                const val = isFloat ? safeNumber(e.target.value).toFixed(1) : safeInt(e.target.value);
                label.textContent = val + (isFloat ? 'V' : '%');
            });
        }
    };

    bindLive('solarMinVoltage', 'solarMinLabel', true);
    bindLive('solarGoodVoltage', 'solarGoodLabel', true);
    bindLive('batteryMinVoltage', 'batteryMinLabel', true);
    bindLive('batteryCriticalSOC', 'batteryCriticalLabel', false);
    bindLive('batteryGoodSOC', 'batteryGoodLabel', false);

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('saveThresholdsBtn')?.addEventListener('click', saveThresholdsToFirebase);
}

function getCurrentThresholds() {
    if (window.AUTO_THRESHOLDS) {
        return {
            SOLAR_MIN_VOLTAGE: safeNumber(window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE, 12.5),
            SOLAR_GOOD_VOLTAGE: safeNumber(window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE, 13.5),
            BATTERY_MIN_VOLTAGE: safeNumber(window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE, 11.8),
            BATTERY_CRITICAL_SOC: safeInt(window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC, 25),
            BATTERY_GOOD_SOC: safeInt(window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC, 40)
        };
    }
    return { ...DEFAULT_THRESHOLDS };
}

function saveThresholdsToFirebase() {
    const solarMin = safeNumber(document.getElementById('solarMinVoltage')?.value, 12.5);
    const solarGood = safeNumber(document.getElementById('solarGoodVoltage')?.value, 13.5);
    const batteryMin = safeNumber(document.getElementById('batteryMinVoltage')?.value, 11.8);
    const batteryCritical = safeInt(document.getElementById('batteryCriticalSOC')?.value, 25);
    const batteryGood = safeInt(document.getElementById('batteryGoodSOC')?.value, 40);

    if (solarMin >= solarGood) {
        window.showNotification('সোলার মিন ভোল্টেজ গুড ভোল্টেজ থেকে কম হতে হবে!', 'error');
        return;
    }
    if (batteryCritical >= batteryGood) {
        window.showNotification('ক্রিটিক্যাল SOC গুড SOC থেকে কম হতে হবে!', 'error');
        return;
    }
    if (batteryMin > 13.5) {
        window.showNotification('ব্যাটারি মিন ভোল্টেজ 13.5V এর বেশি হতে পারে না!', 'error');
        return;
    }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন!', 'error');
        return;
    }

    const updates = {
        SOLAR_MIN_VOLTAGE: solarMin, SOLAR_GOOD_VOLTAGE: solarGood,
        BATTERY_MIN_VOLTAGE: batteryMin, BATTERY_CRITICAL_SOC: batteryCritical,
        BATTERY_GOOD_SOC: batteryGood, last_updated: Date.now()
    };

    window.update(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings/auto_mode_thresholds`), updates)
        .then(() => {
            if (window.AUTO_THRESHOLDS) {
                Object.assign(window.AUTO_THRESHOLDS, updates);
            }
            if (window.pushCommand) {
                window.pushCommand('set_thresholds', {
                    SOLAR_MIN_VOLTAGE: solarMin, SOLAR_GOOD_VOLTAGE: solarGood,
                    BATTERY_MIN_VOLTAGE: batteryMin
                });
            }
            window.showNotification('থ্রেশহোল্ড সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== Cleaning Panel ====================
function showCleaningPanel(content) {
    const settings = window.cleaningSettings || DEFAULT_CLEANING_SETTINGS;

    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-brush"></i> অটো ক্লিনিং সেটিংস</h2>
            </div>
            <div class="panel-body">
                <div class="cleaning-settings-card">
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-clock"></i> সাইকেল সময় (সেকেন্ড)
                            <input type="number" id="cleanDuration" value="${safeInt(settings.duration, 30)}" min="5" max="300">
                            <small>প্রতি সাইকেলে পানির সময়</small>
                        </label>
                    </div>
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-redo-alt"></i> সাইকেল সংখ্যা
                            <input type="number" id="cleanCycles" value="${safeInt(settings.cycles, 3)}" min="1" max="10">
                            <small>প্রতি সেশনে কতটি সাইকেল চলবে</small>
                        </label>
                    </div>
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-pause"></i> সাইকেলের মধ্যে বিরতি (সেকেন্ড)
                            <input type="number" id="cleanBreakTime" value="${safeInt(settings.breakTime, 10)}" min="1" max="30">
                            <small>দুই সাইকেলের মধ্যে বিরতি</small>
                        </label>
                    </div>
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-calendar-alt"></i> ক্লিনিং ব্যবধান (ঘণ্টা)
                            <input type="number" id="cleanInterval" value="${safeInt(settings.interval, 6)}" min="1" max="48">
                            <small>কত ঘণ্টা পর পর ক্লিনিং শুরু হবে</small>
                        </label>
                    </div>
                    <div class="cleaning-info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>বর্তমান সেটিংস:</strong>
                            <p>${safeInt(settings.duration, 30)}সে × ${safeInt(settings.cycles, 3)} সাইকেল, ${safeInt(settings.interval, 6)}ঘণ্টা পর, ${safeInt(settings.breakTime, 10)}সে বিরতি</p>
                        </div>
                    </div>
                </div>
                
                <button id="saveCleaningSettingsBtn" class="save-settings-btn">
                    <i class="fas fa-save"></i> ক্লিনিং সেটিংস সংরক্ষণ
                </button>
            </div>
        </div>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('saveCleaningSettingsBtn')?.addEventListener('click', saveCleaningSettingsToFirebase);
}

function saveCleaningSettingsToFirebase() {
    const duration = safeInt(document.getElementById('cleanDuration')?.value, 30);
    const cycles = safeInt(document.getElementById('cleanCycles')?.value, 3);
    const breakTime = safeInt(document.getElementById('cleanBreakTime')?.value, 10);
    const interval = safeInt(document.getElementById('cleanInterval')?.value, 6);

    if (duration < 5 || duration > 300) { window.showNotification('সাইকেল সময় 5-300 সেকেন্ড হতে হবে!', 'error'); return; }
    if (cycles < 1 || cycles > 10) { window.showNotification('সাইকেল সংখ্যা 1-10 হতে হবে!', 'error'); return; }
    if (breakTime < 1 || breakTime > 30) { window.showNotification('বিরতি 1-30 সেকেন্ড হতে হবে!', 'error'); return; }
    if (interval < 1 || interval > 48) { window.showNotification('ব্যবধান 1-48 ঘণ্টা হতে হবে!', 'error'); return; }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) {
        window.showNotification('ডিভাইস সিলেক্ট করুন!', 'error');
        return;
    }

    const updates = { duration, cycles, breakTime, interval, last_updated: Date.now() };

    window.update(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings/cleaning`), updates)
        .then(() => {
            window.cleaningSettings = { duration, cycles, breakTime, interval };
            if (window.pushCommand) {
                window.pushCommand('set_cleaning_settings', {
                    interval_hours: interval, cycles: cycles,
                    water_time: duration, break_time: breakTime
                });
            }
            window.showNotification('ক্লিনিং সেটিংস সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== Battery Cutoff Panel ====================
function showBatteryCutoffPanel(content) {
    const settings = window.batteryCutoffSettings || DEFAULT_BATTERY_CUTOFF;

    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-battery-full"></i> ব্যাটারি কাটঅফ সেটিংস</h2>
            </div>
            <div class="panel-body">
                <div class="cleaning-settings-card">
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-battery-full"></i> ফুল ভোল্টেজ (V)
                            <input type="number" id="batteryFullVoltage" value="${safeNumber(settings.fullVoltage, 13.7)}" min="12.5" max="15" step="0.1">
                            <small>এই ভোল্টেজে চার্জিং বন্ধ হবে (recommended: 13.7V)</small>
                        </label>
                    </div>
                    <div class="cleaning-setting-item">
                        <label><i class="fas fa-battery-half"></i> রিকভার ভোল্টেজ (V)
                            <input type="number" id="batteryRecoverVoltage" value="${safeNumber(settings.recoverVoltage, 13.0)}" min="11.5" max="14" step="0.1">
                            <small>এই ভোল্টেজে চার্জিং আবার চালু হবে (recommended: 13.0V)</small>
                        </label>
                    </div>
                    <div class="cleaning-info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>বর্তমান:</strong>
                            <p>ফুল: ${safeNumber(settings.fullVoltage, 13.7)}V | রিকভার: ${safeNumber(settings.recoverVoltage, 13.0)}V</p>
                            <p style="font-size: 11px; color: #94a3b8; margin-top: 5px;">SOC Formula: 11.0V = 0% | 13.7V = 100%</p>
                        </div>
                    </div>
                </div>
                <button id="saveBatteryCutoffBtn" class="save-settings-btn">
                    <i class="fas fa-save"></i> কাটঅফ সংরক্ষণ
                </button>
            </div>
        </div>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('saveBatteryCutoffBtn')?.addEventListener('click', saveBatteryCutoffToFirebase);
}

function saveBatteryCutoffToFirebase() {
    const fullV = safeNumber(document.getElementById('batteryFullVoltage')?.value, 13.7);
    const recoverV = safeNumber(document.getElementById('batteryRecoverVoltage')?.value, 13.0);

    if (fullV <= recoverV) {
        window.showNotification('ফুল ভোল্টেজ রিকভার থেকে বেশি হতে হবে!', 'error');
        return;
    }
    if (fullV < 12.5 || fullV > 15.0) { window.showNotification('ফুল ভোল্টেজ 12.5V-15V হতে হবে!', 'error'); return; }
    if (recoverV < 11.5 || recoverV > 14.0) { window.showNotification('রিকভার ভোল্টেজ 11.5V-14V হতে হবে!', 'error'); return; }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    if (!database || !currentUserId || !currentDeviceId) return;

    const updates = { full_voltage: fullV, recover_voltage: recoverV, last_updated: Date.now() };

    window.update(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings/battery_cutoff`), updates)
        .then(() => {
            window.batteryCutoffSettings = { fullVoltage: fullV, recoverVoltage: recoverV };
            if (window.pushCommand) {
                window.pushCommand('set_battery_cutoff', { full_voltage: fullV, recover_voltage: recoverV });
            }
            window.showNotification('ব্যাটারি কাটঅফ সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== Remote Panel (with warning) ====================
function showRemotePanel(content) {
    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-wifi"></i> রিমোট কনফিগারেশন</h2>
            </div>
            
            <div class="panel-body">
                <div class="info-card" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 20px; padding: 15px; border-radius: 10px;">
                    <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 20px;"></i>
                    <div style="margin-top: 8px;">
                        <h3 style="color: #f59e0b; font-size: 14px; margin-bottom: 4px;">⚠️ ESP32 v6.8.9 — এখনো support করে না</h3>
                        <p style="font-size: 12px; color: #cbd5e1;">নিচের কমান্ডগুলো ESP32 তে পাঠালে সেগুলো ignore হবে। ভবিষ্যতে যোগ করা হবে।</p>
                    </div>
                </div>
                
                <div class="remote-section">
                    <h3><i class="fas fa-wifi"></i> ওয়াইফাই সেটিংস</h3>
                    <div class="input-group">
                        <label>নতুন ওয়াইফাই SSID</label>
                        <input type="text" id="wifiSSID" placeholder="ওয়াইফাই নাম দিন" maxlength="32">
                    </div>
                    <div class="input-group">
                        <label>ওয়াইফাই পাসওয়ার্ড</label>
                        <input type="password" id="wifiPassword" placeholder="পাসওয়ার্ড দিন" maxlength="64">
                    </div>
                    <div class="button-group">
                        <button id="changeWifiBtn" class="remote-btn primary">
                            <i class="fas fa-paper-plane"></i> ওয়াইফাই পরিবর্তন
                        </button>
                        <button id="resetWifiBtn" class="remote-btn warning">
                            <i class="fas fa-sync-alt"></i> ওয়াইফাই রিসেট
                        </button>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                <div class="remote-section">
                    <h3><i class="fas fa-exchange-alt"></i> ডিভাইস ট্রান্সফার</h3>
                    <div class="input-group">
                        <label>নতুন মালিকের ইমেইল</label>
                        <input type="email" id="newDeviceEmail" placeholder="নতুন ইমেইল ঠিকানা">
                    </div>
                    <div class="button-group">
                        <button id="changeDeviceBtn" class="remote-btn primary">
                            <i class="fas fa-exchange-alt"></i> ডিভাইস ট্রান্সফার
                        </button>
                        <button id="restartDeviceBtn" class="remote-btn warning">
                            <i class="fas fa-power-off"></i> ডিভাইস রিস্টার্ট
                        </button>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                <div class="remote-section danger-section">
                    <h3><i class="fas fa-industry"></i> ESP32 ফ্যাক্টরি রিসেট</h3>
                    <div class="warning-box">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>
                            <strong>শুধু ESP32 ডিভাইস রিসেট হবে!</strong>
                            <ul>
                                <li>✓ ESP32 এর ওয়াইফাই সেটিংস রিসেট হবে</li>
                                <li>✓ ডিভাইস এপি মোডে যাবে</li>
                                <li>✗ Firebase ডাটা থাকবে</li>
                            </ul>
                        </div>
                    </div>
                    <button id="factoryResetBtn" class="remote-btn danger">
                        <i class="fas fa-exclamation-triangle"></i> ESP32 ফ্যাক্টরি রিসেট
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('changeWifiBtn')?.addEventListener('click', () => window.showNotification('⚠️ এই feature ESP32 এ এখনো যোগ হয়নি', 'warning'));
    document.getElementById('resetWifiBtn')?.addEventListener('click', () => window.showNotification('⚠️ এই feature ESP32 এ এখনো যোগ হয়নি', 'warning'));
    document.getElementById('changeDeviceBtn')?.addEventListener('click', () => window.showNotification('⚠️ এই feature ESP32 এ এখনো যোগ হয়নি', 'warning'));
    document.getElementById('restartDeviceBtn')?.addEventListener('click', () => window.showNotification('⚠️ এই feature ESP32 এ এখনো যোগ হয়নি', 'warning'));
    document.getElementById('factoryResetBtn')?.addEventListener('click', () => window.showNotification('⚠️ এই feature ESP32 এ এখনো যোগ হয়নি', 'warning'));
}

// ==================== History Panel ====================
function showHistoryPanel(content) {
    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-history"></i> হিস্ট্রি ক্লিয়ার</h2>
            </div>
            <div class="panel-body">
                <div class="info-card">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <h3>ডাটা ডিলিট সম্পর্কে সতর্কতা</h3>
                        <p>ডাটা ডিলিট করলে তা পুনরুদ্ধার করা যাবে না।</p>
                    </div>
                </div>
                
                <div class="history-options">
                    <div class="history-option" data-option="all">
                        <i class="fas fa-trash-alt"></i>
                        <span>সব ডাটা ডিলিট</span>
                    </div>
                    <div class="history-option" data-option="7">
                        <i class="fas fa-calendar-week"></i>
                        <span>৭ দিনের পুরনো ডাটা</span>
                    </div>
                    <div class="history-option" data-option="30">
                        <i class="fas fa-calendar-alt"></i>
                        <span>৩০ দিনের পুরনো ডাটা</span>
                    </div>
                    <div class="history-option" data-option="90">
                        <i class="fas fa-calendar"></i>
                        <span>৯০ দিনের পুরনো ডাটা</span>
                    </div>
                </div>
                
                <div class="warning-box">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>সতর্কতা: ডাটা ডিলিট করার পর আর ফিরিয়ে আনা যাবে না!</span>
                </div>
                
                <button id="clearHistoryBtn" class="danger-btn">
                    <i class="fas fa-trash-alt"></i> ডাটা ডিলিট করুন
                </button>
            </div>
        </div>
    `;

    let selectedOption = 'all';
    document.querySelectorAll('.history-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.history-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedOption = opt.dataset.option;
        });
    });
    document.querySelector('.history-option')?.classList.add('selected');

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
        if (!confirm(`⚠️ ${selectedOption === 'all' ? 'সব ডাটা' : selectedOption + ' দিনের পুরনো ডাটা'} ডিলিট করবেন?`)) return;
        
        const database = window.database;
        const currentUserId = window.currentUserId;
        const currentDeviceId = window.currentDeviceId;
        
        try {
            if (selectedOption === 'all') {
                await window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/history`), null);
                window.showNotification('সব ডাটা ডিলিট হয়েছে ✅', 'success');
            } else {
                const days = parseInt(selectedOption);
                const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
                const historyRef = window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/history`);
                const snapshot = await window.get(historyRef);
                
                if (snapshot.exists()) {
                    const updates = {};
                    Object.entries(snapshot.val()).forEach(([key, val]) => {
                        if (val.timestamp < cutoff) updates[key] = null;
                    });
                    await window.update(historyRef, updates);
                    window.showNotification(`${days} দিনের পুরনো ডাটা ডিলিট হয়েছে ✅`, 'success');
                }
            }
        } catch (error) {
            console.error("Clear history error:", error);
            window.showNotification('ডিলিটে সমস্যা ❌', 'error');
        }
    });
}

// ==================== Exports ====================
window.updateCleaningSettings = function(newSettings) {
    window.cleaningSettings = { ...window.cleaningSettings, ...newSettings };
};
window.getCleaningSettingsDisplay = function() {
    const s = window.cleaningSettings;
    return `${s.duration}সে × ${s.cycles} সাইকেল, ${s.interval}ঘণ্টা পর, ${s.breakTime}সে বিরতি`;
};
window.reloadSettingsFromFirebase = loadSettingsFromFirebase;
window.loadSettingsFromFirebase = loadSettingsFromFirebase;
window.showSettingsPanel = showSettingsPanel;
window.showThresholdPanel = showThresholdPanel;
window.showCleaningPanel = showCleaningPanel;
window.showBatteryCutoffPanel = showBatteryCutoffPanel;
window.showRemotePanel = showRemotePanel;
window.showHistoryPanel = showHistoryPanel;
window.DEFAULT_CLEANING_SETTINGS = DEFAULT_CLEANING_SETTINGS;
window.DEFAULT_BATTERY_CUTOFF = DEFAULT_BATTERY_CUTOFF;
window.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;
window.VALIDATION_RANGES = VALIDATION_RANGES;
window.safeNumber = safeNumber;
window.safeInt = safeInt;

console.log('✅ Settings.js v2.2 - ESP32 v6.8.9 (Priority loop + Safe cast)');