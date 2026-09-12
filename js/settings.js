// js/settings.js - সম্পূর্ণ Settings (Auto Threshold + Cleaning + Remote + History)
// Battery SOC: Linear (11.0V = 0%, 13.7V = 100%)
// Battery Full: 13.7V | Recover: 13.0V | Min: 11.5V

// ==================== ডিফল্ট ক্লিনিং সেটিংস ====================
const DEFAULT_CLEANING_SETTINGS = {
    duration: 30,        // সেকেন্ড
    interval: 6,         // ঘণ্টা
    cycles: 3,           // সংখ্যা
    breakTime: 10        // সেকেন্ড
};

// ✅ ডিফল্ট Battery Cutoff (নতুন)
const DEFAULT_BATTERY_CUTOFF = {
    fullVoltage: 13.7,
    recoverVoltage: 13.0
};

// ✅ ডিফল্ট Thresholds (নতুন)
const DEFAULT_THRESHOLDS = {
    SOLAR_MIN_VOLTAGE: 12.5,
    SOLAR_GOOD_VOLTAGE: 13.0,
    BATTERY_MIN_VOLTAGE: 11.5,
    BATTERY_CRITICAL_SOC: 25,
    BATTERY_GOOD_SOC: 40
};

// গ্লোবাল সেটিংস অবজেক্ট
window.cleaningSettings = { ...DEFAULT_CLEANING_SETTINGS };
window.batteryCutoffSettings = { ...DEFAULT_BATTERY_CUTOFF };

// ==================== Setup ফাংশন ====================
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

// ==================== Firebase থেকে সেটিংস লোড ====================
function loadSettingsFromFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) {
        console.log("⏳ Waiting for device selection...");
        return;
    }

    const settingsRef = window.ref(database, 
        `Devices/${currentUserId}/${currentDeviceId}/data/settings`);

    window.get(settingsRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                
                // ✅ Auto Mode Thresholds লোড
                if (settings.auto_mode_thresholds) {
                    const thresholds = settings.auto_mode_thresholds;
                    if (window.AUTO_THRESHOLDS) {
                        window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE = thresholds.SOLAR_MIN_VOLTAGE || 12.5;
                        window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE = thresholds.SOLAR_GOOD_VOLTAGE || 13.0;
                        window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE = thresholds.BATTERY_MIN_VOLTAGE || 11.5;    // ✅ 11.5
                        window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC = thresholds.BATTERY_CRITICAL_SOC || 25;
                        window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC = thresholds.BATTERY_GOOD_SOC || 40;
                    }
                    console.log("✅ Thresholds loaded:", thresholds);
                }

                // ✅ Cleaning Settings লোড
                if (settings.cleaning) {
                    const cleaning = settings.cleaning;
                    window.cleaningSettings = {
                        duration: cleaning.duration || 30,
                        interval: cleaning.interval || 6,
                        cycles: cleaning.cycles || 3,
                        breakTime: cleaning.breakTime || 10
                    };
                    console.log("✅ Cleaning settings loaded:", window.cleaningSettings);
                    
                    if (window.updateCleaningSettingsDisplay) {
                        window.updateCleaningSettingsDisplay();
                    }
                }

                // ✅ Battery Cutoff Settings লোড (নতুন value)
                if (settings.battery_cutoff) {
                    window.batteryCutoffSettings = {
                        fullVoltage: settings.battery_cutoff.full_voltage || 13.7,        // ✅ 13.7
                        recoverVoltage: settings.battery_cutoff.recover_voltage || 13.0  // ✅ 13.0
                    };
                    console.log("✅ Battery cutoff loaded:", window.batteryCutoffSettings);
                }
            } else {
                console.log("📝 No settings found, saving defaults...");
                saveDefaultSettingsToFirebase();
            }
        })
        .catch((error) => {
            console.error("Error loading settings:", error);
        });
}

// ==================== ডিফল্ট সেটিংস সেভ ====================
function saveDefaultSettingsToFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) return;

    const settingsRef = window.ref(database, 
        `Devices/${currentUserId}/${currentDeviceId}/data/settings`);

    const defaultSettings = {
        auto_mode_thresholds: {
            SOLAR_MIN_VOLTAGE: 12.5,
            SOLAR_GOOD_VOLTAGE: 13.0,
            BATTERY_MIN_VOLTAGE: 11.5,             // ✅ 11.5
            BATTERY_CRITICAL_SOC: 25,
            BATTERY_GOOD_SOC: 40,
            last_updated: Date.now()
        },
        cleaning: {
            duration: 30,
            interval: 6,
            cycles: 3,
            breakTime: 10,
            last_updated: Date.now()
        },
        battery_cutoff: {
            full_voltage: 13.7,                    // ✅ 13.7
            recover_voltage: 13.0,                 // ✅ 13.0
            last_updated: Date.now()
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
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            showSettingPanel(setting);
        });
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

// ==================== থ্রেশহোল্ড প্যানেল ====================
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
                            <label>সোলার মিনিমাম ভোল্টেজ: <span id="solarMinLabel">${thresholds.SOLAR_MIN_VOLTAGE.toFixed(1)}V</span></label>
                            <input type="range" id="solarMinVoltage" min="10" max="15" step="0.1" value="${thresholds.SOLAR_MIN_VOLTAGE}">
                            <small>এই ভোল্টেজের কম হলে সোলার থেকে সুইচ করবে</small>
                        </div>
                        <div class="threshold-item">
                            <label>সোলার গুড ভোল্টেজ: <span id="solarGoodLabel">${thresholds.SOLAR_GOOD_VOLTAGE.toFixed(1)}V</span></label>
                            <input type="range" id="solarGoodVoltage" min="11" max="16" step="0.1" value="${thresholds.SOLAR_GOOD_VOLTAGE}">
                            <small>এই ভোল্টেজের বেশি হলে সোলারে সুইচ করবে</small>
                        </div>
                    </div>
                    
                    <div class="threshold-card">
                        <div class="threshold-header">
                            <i class="fas fa-car-battery"></i>
                            <h3>ব্যাটারি সেটিংস</h3>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি মিনিমাম ভোল্টেজ: <span id="batteryMinLabel">${thresholds.BATTERY_MIN_VOLTAGE.toFixed(1)}V</span></label>
                            <input type="range" id="batteryMinVoltage" min="10" max="14" step="0.1" value="${thresholds.BATTERY_MIN_VOLTAGE}">
                            <small>এই ভোল্টেজের কম হলে ব্যাটারি থেকে সুইচ করবে (recommended: 11.5V)</small>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি ক্রিটিক্যাল SOC: <span id="batteryCriticalLabel">${thresholds.BATTERY_CRITICAL_SOC}%</span></label>
                            <input type="range" id="batteryCriticalSOC" min="0" max="100" value="${thresholds.BATTERY_CRITICAL_SOC}">
                            <small>এই SOC এর কম হলে ব্যাটারি ব্যবহার করবে না</small>
                        </div>
                        <div class="threshold-item">
                            <label>ব্যাটারি গুড SOC: <span id="batteryGoodLabel">${thresholds.BATTERY_GOOD_SOC}%</span></label>
                            <input type="range" id="batteryGoodSOC" min="0" max="100" value="${thresholds.BATTERY_GOOD_SOC}">
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

    const solarMin = document.getElementById('solarMinVoltage');
    const solarMinLabel = document.getElementById('solarMinLabel');
    if (solarMin && solarMinLabel) {
        solarMin.addEventListener('input', (e) => {
            solarMinLabel.textContent = parseFloat(e.target.value).toFixed(1) + 'V';
        });
    }

    const solarGood = document.getElementById('solarGoodVoltage');
    const solarGoodLabel = document.getElementById('solarGoodLabel');
    if (solarGood && solarGoodLabel) {
        solarGood.addEventListener('input', (e) => {
            solarGoodLabel.textContent = parseFloat(e.target.value).toFixed(1) + 'V';
        });
    }

    const batteryMin = document.getElementById('batteryMinVoltage');
    const batteryMinLabel = document.getElementById('batteryMinLabel');
    if (batteryMin && batteryMinLabel) {
        batteryMin.addEventListener('input', (e) => {
            batteryMinLabel.textContent = parseFloat(e.target.value).toFixed(1) + 'V';
        });
    }

    const batteryCritical = document.getElementById('batteryCriticalSOC');
    const batteryCriticalLabel = document.getElementById('batteryCriticalLabel');
    if (batteryCritical && batteryCriticalLabel) {
        batteryCritical.addEventListener('input', (e) => {
            batteryCriticalLabel.textContent = e.target.value + '%';
        });
    }

    const batteryGood = document.getElementById('batteryGoodSOC');
    const batteryGoodLabel = document.getElementById('batteryGoodLabel');
    if (batteryGood && batteryGoodLabel) {
        batteryGood.addEventListener('input', (e) => {
            batteryGoodLabel.textContent = e.target.value + '%';
        });
    }

    document.getElementById('backBtn')?.addEventListener('click', () => showSettingsPanel());
    document.getElementById('saveThresholdsBtn')?.addEventListener('click', saveThresholdsToFirebase);
}

// ==================== থ্রেশহোল্ড সেভ ====================
function getCurrentThresholds() {
    if (window.AUTO_THRESHOLDS) {
        return {
            SOLAR_MIN_VOLTAGE: window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE || 12.5,
            SOLAR_GOOD_VOLTAGE: window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE || 13.0,
            BATTERY_MIN_VOLTAGE: window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE || 11.5,    // ✅ 11.5
            BATTERY_CRITICAL_SOC: window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC || 25,
            BATTERY_GOOD_SOC: window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC || 40
        };
    }
    return { ...DEFAULT_THRESHOLDS };
}

function saveThresholdsToFirebase() {
    const solarMin = parseFloat(document.getElementById('solarMinVoltage')?.value || 12.5);
    const solarGood = parseFloat(document.getElementById('solarGoodVoltage')?.value || 13.0);
    const batteryMin = parseFloat(document.getElementById('batteryMinVoltage')?.value || 11.5);   // ✅ 11.5
    const batteryCritical = parseInt(document.getElementById('batteryCriticalSOC')?.value || 25);
    const batteryGood = parseInt(document.getElementById('batteryGoodSOC')?.value || 40);

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
        SOLAR_MIN_VOLTAGE: solarMin,
        SOLAR_GOOD_VOLTAGE: solarGood,
        BATTERY_MIN_VOLTAGE: batteryMin,
        BATTERY_CRITICAL_SOC: batteryCritical,
        BATTERY_GOOD_SOC: batteryGood,
        last_updated: Date.now()
    };

    window.update(window.ref(database, 
        `Devices/${currentUserId}/${currentDeviceId}/data/settings/auto_mode_thresholds`), updates)
        .then(() => {
            if (window.AUTO_THRESHOLDS) {
                window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE = solarMin;
                window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE = solarGood;
                window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE = batteryMin;
                window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC = batteryCritical;
                window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC = batteryGood;
            }
            
            if (window.pushCommand) {
                window.pushCommand('set_thresholds', {
                    SOLAR_MIN_VOLTAGE: solarMin,
                    SOLAR_GOOD_VOLTAGE: solarGood,
                    BATTERY_MIN_VOLTAGE: batteryMin,
                    BATTERY_CRITICAL_SOC: batteryCritical,
                    BATTERY_GOOD_SOC: batteryGood
                });
            }
            
            window.showNotification('থ্রেশহোল্ড সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== ক্লিনিং সেটিংস প্যানেল ====================
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
                        <label>
                            <i class="fas fa-clock"></i> সাইকেল সময় (সেকেন্ড)
                            <input type="number" id="cleanDuration" value="${settings.duration}" min="5" max="300">
                            <small>প্রতি সাইকেলে পানির সময়</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-setting-item">
                        <label>
                            <i class="fas fa-redo-alt"></i> সাইকেল সংখ্যা
                            <input type="number" id="cleanCycles" value="${settings.cycles}" min="1" max="10">
                            <small>প্রতি সেশনে কতটি সাইকেল চলবে</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-setting-item">
                        <label>
                            <i class="fas fa-pause"></i> সাইকেলের মধ্যে বিরতি (সেকেন্ড)
                            <input type="number" id="cleanBreakTime" value="${settings.breakTime}" min="1" max="30">
                            <small>দুই সাইকেলের মধ্যে বিরতি</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-setting-item">
                        <label>
                            <i class="fas fa-calendar-alt"></i> ক্লিনিং ব্যবধান (ঘণ্টা)
                            <input type="number" id="cleanInterval" value="${settings.interval}" min="1" max="48">
                            <small>কত ঘণ্টা পর পর ক্লিনিং শুরু হবে</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>বর্তমান সেটিংস:</strong>
                            <p>${settings.duration}সে × ${settings.cycles} সাইকেল, ${settings.interval}ঘণ্টা পর, ${settings.breakTime}সে বিরতি</p>
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

// ==================== ক্লিনিং সেটিংস সেভ ====================
function saveCleaningSettingsToFirebase() {
    const duration = parseInt(document.getElementById('cleanDuration')?.value || 30);
    const cycles = parseInt(document.getElementById('cleanCycles')?.value || 3);
    const breakTime = parseInt(document.getElementById('cleanBreakTime')?.value || 10);
    const interval = parseInt(document.getElementById('cleanInterval')?.value || 6);

    if (duration < 5 || duration > 300) {
        window.showNotification('সাইকেল সময় 5-300 সেকেন্ডের মধ্যে হতে হবে!', 'error');
        return;
    }
    if (cycles < 1 || cycles > 10) {
        window.showNotification('সাইকেল সংখ্যা 1-10 এর মধ্যে হতে হবে!', 'error');
        return;
    }
    if (breakTime < 1 || breakTime > 30) {
        window.showNotification('বিরতি 1-30 সেকেন্ডের মধ্যে হতে হবে!', 'error');
        return;
    }
    if (interval < 1 || interval > 48) {
        window.showNotification('ব্যবধান 1-48 ঘণ্টার মধ্যে হতে হবে!', 'error');
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
        duration: duration,
        cycles: cycles,
        breakTime: breakTime,
        interval: interval,
        last_updated: Date.now()
    };

    window.update(window.ref(database, 
        `Devices/${currentUserId}/${currentDeviceId}/data/settings/cleaning`), updates)
        .then(() => {
            window.cleaningSettings = {
                duration: duration,
                cycles: cycles,
                breakTime: breakTime,
                interval: interval
            };

            if (window.pushCommand) {
                window.pushCommand('set_cleaning_settings', {
                    interval_hours: interval,
                    cycles: cycles,
                    water_time: duration,
                    break_time: breakTime
                });
            }

            if (window.updateCleaningSettingsDisplay) {
                window.updateCleaningSettingsDisplay();
            }
            
            window.showNotification('ক্লিনিং সেটিংস সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== ব্যাটারি কাটঅফ প্যানেল (নতুন 13.7V/13.0V) ====================
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
                        <label>
                            <i class="fas fa-battery-full"></i> ফুল ভোল্টেজ (V)
                            <input type="number" id="batteryFullVoltage" value="${settings.fullVoltage}" min="12.5" max="15" step="0.1">
                            <small>এই ভোল্টেজে চার্জিং বন্ধ হবে (recommended: 13.7V)</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-setting-item">
                        <label>
                            <i class="fas fa-battery-half"></i> রিকভার ভোল্টেজ (V)
                            <input type="number" id="batteryRecoverVoltage" value="${settings.recoverVoltage}" min="11.5" max="14" step="0.1">
                            <small>এই ভোল্টেজে চার্জিং আবার চালু হবে (recommended: 13.0V)</small>
                        </label>
                    </div>
                    
                    <div class="cleaning-info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>বর্তমান:</strong>
                            <p>ফুল: ${settings.fullVoltage}V | রিকভার: ${settings.recoverVoltage}V</p>
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
    const fullV = parseFloat(document.getElementById('batteryFullVoltage')?.value || 13.7);      // ✅ 13.7
    const recoverV = parseFloat(document.getElementById('batteryRecoverVoltage')?.value || 13.0); // ✅ 13.0

    if (fullV <= recoverV) {
        window.showNotification('ফুল ভোল্টেজ রিকভার থেকে বেশি হতে হবে!', 'error');
        return;
    }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) return;

    const updates = {
        full_voltage: fullV,
        recover_voltage: recoverV,
        last_updated: Date.now()
    };

    window.update(window.ref(database, 
        `Devices/${currentUserId}/${currentDeviceId}/data/settings/battery_cutoff`), updates)
        .then(() => {
            window.batteryCutoffSettings = {
                fullVoltage: fullV,
                recoverVoltage: recoverV
            };
            
            if (window.pushCommand) {
                window.pushCommand('set_battery_cutoff', {
                    full_voltage: fullV,
                    recover_voltage: recoverV
                });
            }
            
            window.showNotification('ব্যাটারি কাটঅফ সংরক্ষণ ✅', 'success');
        })
        .catch((error) => {
            console.error("Error:", error);
            window.showNotification('সংরক্ষণে সমস্যা ❌', 'error');
        });
}

// ==================== রিমোট কনফিগারেশন প্যানেল ====================
function showRemotePanel(content) {
    content.innerHTML = `
        <div class="settings-panel">
            <div class="panel-header">
                <button class="back-btn" id="backBtn"><i class="fas fa-arrow-left"></i></button>
                <h2><i class="fas fa-wifi"></i> রিমোট কনফিগারেশন</h2>
            </div>
            
            <div class="panel-body">
                <div class="remote-section">
                    <h3><i class="fas fa-wifi"></i> ওয়াইফাই সেটিংস</h3>
                    <div class="input-group">
                        <label>নতুন ওয়াইফাই SSID</label>
                        <input type="text" id="wifiSSID" placeholder="ওয়াইফাই নাম দিন">
                    </div>
                    <div class="input-group">
                        <label>ওয়াইফাই পাসওয়ার্ড</label>
                        <input type="password" id="wifiPassword" placeholder="পাসওয়ার্ড দিন">
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
    document.getElementById('changeWifiBtn')?.addEventListener('click', changeWiFi);
    document.getElementById('resetWifiBtn')?.addEventListener('click', resetWiFi);
    document.getElementById('changeDeviceBtn')?.addEventListener('click', changeDevice);
    document.getElementById('restartDeviceBtn')?.addEventListener('click', restartDevice);
    document.getElementById('factoryResetBtn')?.addEventListener('click', esp32FactoryReset);
}

// ==================== রিমোট ফাংশন ====================
function changeWiFi() {
    const ssid = document.getElementById('wifiSSID')?.value;
    const password = document.getElementById('wifiPassword')?.value;

    if (!ssid) {
        window.showNotification('ওয়াইফাই SSID দিন', 'error');
        return;
    }

    if (!confirm(`ESP32 তে ওয়াইফাই পরিবর্তন কমান্ড পাঠাবেন?\nSSID: ${ssid}`)) return;

    if (window.pushCommand) {
        window.pushCommand('wifi_config', {
            command: 'change_wifi',
            ssid: ssid,
            password: password || ''
        }).then(() => {
            window.showNotification('ওয়াইফাই কমান্ড পাঠানো হয়েছে', 'success');
            document.getElementById('wifiSSID').value = '';
            document.getElementById('wifiPassword').value = '';
        }).catch(() => {
            window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error');
        });
    }
}

function resetWiFi() {
    if (!confirm('ESP32 এর ওয়াইফাই রিসেট করবেন?')) return;

    if (window.pushCommand) {
        window.pushCommand('wifi_config', { command: 'reset_wifi' })
            .then(() => window.showNotification('ওয়াইফাই রিসেট কমান্ড পাঠানো', 'warning'))
            .catch(() => window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error'));
    }
}

function changeDevice() {
    const newEmail = document.getElementById('newDeviceEmail')?.value;

    if (!newEmail || !newEmail.includes('@')) {
        window.showNotification('সঠিক ইমেইল দিন', 'error');
        return;
    }

    if (!confirm(`ডিভাইস ট্রান্সফার করবেন?\nনতুন মালিক: ${newEmail}`)) return;

    if (window.pushCommand) {
        window.pushCommand('device_config', {
            command: 'change_device',
            new_email: newEmail
        }).then(() => {
            window.showNotification('ডিভাইস ট্রান্সফার কমান্ড পাঠানো', 'success');
            setTimeout(() => {
                if (confirm('লগআউট করতে চান?')) {
                    window.location.href = 'login.html';
                }
            }, 2000);
        }).catch(() => window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error'));
    }
}

function restartDevice() {
    if (!confirm('ESP32 ডিভাইস রিস্টার্ট করবেন?')) return;

    if (window.pushCommand) {
        window.pushCommand('system_config', { command: 'restart' })
            .then(() => window.showNotification('রিস্টার্ট কমান্ড পাঠানো', 'info'))
            .catch(() => window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error'));
    }
}

function esp32FactoryReset() {
    if (!confirm('⚠️ শুধু ESP32 ফ্যাক্টরি রিসেট করবেন?\n\n✓ ওয়াইফাই সেটিংস রিসেট হবে\n✓ ডিভাইস এপি মোডে যাবে\n✗ Firebase ডাটা থাকবে')) return;

    if (window.pushCommand) {
        window.pushCommand('system_config', {
            command: 'factory_reset',
            reset_type: 'esp32_only'
        }).then(() => window.showNotification('ESP32 ফ্যাক্টরি রিসেট কমান্ড পাঠানো', 'warning'))
          .catch(() => window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error'));
    }
}

// ==================== হিস্ট্রি ক্লিয়ার প্যানেল ====================
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
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
        if (confirm(`⚠️ ${selectedOption === 'all' ? 'সব ডাটা' : selectedOption + ' দিনের পুরনো ডাটা'} ডিলিট করবেন?`)) {
            if (window.pushCommand) {
                window.pushCommand('history_clear', {
                    command: 'clear_history',
                    option: selectedOption
                }).then(() => window.showNotification('হিস্ট্রি ক্লিয়ার কমান্ড পাঠানো', 'warning'))
                  .catch(() => window.showNotification('কমান্ড পাঠাতে সমস্যা', 'error'));
            }
        }
    });
}

// ==================== ইউটিলিটি ====================
function updateCleaningSettings(newSettings) {
    window.cleaningSettings = {
        ...window.cleaningSettings,
        ...newSettings
    };
    
    if (window.updateCleaningSettingsDisplay) {
        window.updateCleaningSettingsDisplay();
    }
    console.log('✅ Cleaning settings updated:', window.cleaningSettings);
}

function getCleaningSettingsDisplay() {
    const settings = window.cleaningSettings;
    return `${settings.duration}সে × ${settings.cycles} সাইকেল, ${settings.interval}ঘণ্টা পর, ${settings.breakTime}সে বিরতি`;
}

function reloadSettingsFromFirebase() {
    loadSettingsFromFirebase();
}

// ==================== গ্লোবাল এক্সপোর্ট ====================
window.updateCleaningSettings = updateCleaningSettings;
window.getCleaningSettingsDisplay = getCleaningSettingsDisplay;
window.reloadSettingsFromFirebase = reloadSettingsFromFirebase;
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

console.log('✅ Settings.js loaded - SOC Linear (11.0-13.7V)');