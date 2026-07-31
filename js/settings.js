// js/settings.js - সেটিংস মডিউল (শুধু Firebase, localStorage বাদ)

// ==================== ক্লিনিং সেটিংস ====================
// ডিফল্ট সেটিংস (Firebase থেকে লোড না হলে এই মান ব্যবহার হবে)
const DEFAULT_CLEANING_SETTINGS = {
    duration: 30,        // সেকেন্ড (প্রতি সাইকেল কতক্ষণ চলবে)
    interval: 6,         // ঘণ্টা (কত ঘণ্টা পর পর ক্লিনিং হবে)
    cycles: 3,           // সংখ্যা (প্রতি সেশনে কত সাইকেল চলবে)
    breakTime: 10        // সেকেন্ড (সাইকেলের মধ্যে বিরতি)
};

// গ্লোবাল সেটিংস অবজেক্ট
window.cleaningSettings = { ...DEFAULT_CLEANING_SETTINGS };

// ==================== সেটআপ ফাংশন ====================
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

    // Firebase থেকে সেটিংস লোড করুন
    loadSettingsFromFirebase();
}

// ==================== Firebase থেকে সেটিংস লোড ====================
function loadSettingsFromFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) {
        console.log("⏳ Waiting for device selection to load settings...");
        return;
    }

    // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/settings/
    const settingsRef = window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings`);

    window.get(settingsRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const settings = snapshot.val();
                
                // থ্রেশহোল্ড সেটিংস লোড করুন
                if (settings.auto_mode_thresholds) {
                    const thresholds = settings.auto_mode_thresholds;
                    if (window.AUTO_THRESHOLDS) {
                        window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE = thresholds.SOLAR_MIN_VOLTAGE || 12.5;
                        window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE = thresholds.SOLAR_GOOD_VOLTAGE || 13.0;
                        window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE = thresholds.BATTERY_MIN_VOLTAGE || 11.8;
                        window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC = thresholds.BATTERY_CRITICAL_SOC || 25;
                        window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC = thresholds.BATTERY_GOOD_SOC || 40;
                    }
                    console.log("✅ Thresholds loaded from Firebase:", thresholds);
                }

                // ক্লিনিং সেটিংস লোড করুন
                if (settings.cleaning) {
                    const cleaning = settings.cleaning;
                    window.cleaningSettings = {
                        duration: cleaning.duration || 30,
                        interval: cleaning.interval || 6,
                        cycles: cleaning.cycles || 3,
                        breakTime: cleaning.breakTime || 10
                    };
                    console.log("✅ Cleaning settings loaded from Firebase:", window.cleaningSettings);
                    
                    // UI আপডেট করুন
                    if (window.updateCleaningSettingsDisplay) {
                        window.updateCleaningSettingsDisplay();
                    }
                }
            } else {
                // Firebase এ ডাটা নেই, ডিফল্ট সেটিংস সেভ করুন
                console.log("📝 No settings found in Firebase, saving defaults...");
                saveDefaultSettingsToFirebase();
            }
        })
        .catch((error) => {
            console.error("Error loading settings from Firebase:", error);
        });
}

// ==================== ডিফল্ট সেটিংস সেভ ====================
function saveDefaultSettingsToFirebase() {
    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) return;

    // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/settings/
    const settingsRef = window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings`);

    const defaultSettings = {
        auto_mode_thresholds: {
            SOLAR_MIN_VOLTAGE: 12.5,
            SOLAR_GOOD_VOLTAGE: 13.0,
            BATTERY_MIN_VOLTAGE: 11.8,
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
        }
    };

    window.set(settingsRef, defaultSettings)
        .then(() => {
            console.log("✅ Default settings saved to Firebase");
        })
        .catch((error) => {
            console.error("Error saving default settings:", error);
        });
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
                
                <div class="settings-btn-card" data-setting="remote">
                    <div class="settings-btn-icon"><i class="fas fa-wifi"></i></div>
                    <div class="settings-btn-info">
                        <h3>রিমোট কনফিগারেশন</h3>
                        <p>ওয়াইফাই ও ডিভাইস সেটিংস পরিবর্তন করুন</p>
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
    else if (setting === 'remote') showRemotePanel(content);
    else if (setting === 'history') showHistoryPanel(content);
}

// ==================== থ্রেশহোল্ড প্যানেল ====================
function showThresholdPanel(content) {
    // Firebase থেকে বর্তমান থ্রেশহোল্ড লোড করুন
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
                            <small>এই ভোল্টেজের কম হলে ব্যাটারি থেকে সুইচ করবে</small>
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

    // ইভেন্ট লিসেনার
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

// ==================== বর্তমান থ্রেশহোল্ড পাওয়া ====================
function getCurrentThresholds() {
    if (window.AUTO_THRESHOLDS) {
        return {
            SOLAR_MIN_VOLTAGE: window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE || 12.5,
            SOLAR_GOOD_VOLTAGE: window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE || 13.0,
            BATTERY_MIN_VOLTAGE: window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE || 11.8,
            BATTERY_CRITICAL_SOC: window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC || 25,
            BATTERY_GOOD_SOC: window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC || 40
        };
    }
    return {
        SOLAR_MIN_VOLTAGE: 12.5,
        SOLAR_GOOD_VOLTAGE: 13.0,
        BATTERY_MIN_VOLTAGE: 11.8,
        BATTERY_CRITICAL_SOC: 25,
        BATTERY_GOOD_SOC: 40
    };
}

// ==================== থ্রেশহোল্ড সেভ ====================
function saveThresholdsToFirebase() {
    const solarMin = parseFloat(document.getElementById('solarMinVoltage')?.value || 12.5);
    const solarGood = parseFloat(document.getElementById('solarGoodVoltage')?.value || 13.0);
    const batteryMin = parseFloat(document.getElementById('batteryMinVoltage')?.value || 11.8);
    const batteryCritical = parseInt(document.getElementById('batteryCriticalSOC')?.value || 25);
    const batteryGood = parseInt(document.getElementById('batteryGoodSOC')?.value || 40);

    // ভ্যালিডেশন
    if (solarMin >= solarGood) {
        if (window.showNotification) window.showNotification('সোলার মিন ভোল্টেজ গুড ভোল্টেজ থেকে কম হতে হবে!', 'error');
        return;
    }

    if (batteryCritical >= batteryGood) {
        if (window.showNotification) window.showNotification('ক্রিটিক্যাল SOC গুড SOC থেকে কম হতে হবে!', 'error');
        return;
    }

    if (batteryMin > 13.5) {
        if (window.showNotification) window.showNotification('ব্যাটারি মিন ভোল্টেজ 13.5V এর বেশি হতে পারে না!', 'error');
        return;
    }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) {
        if (window.showNotification) window.showNotification('ডিভাইস সিলেক্ট করুন!', 'error');
        return;
    }

    // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/settings/auto_mode_thresholds
    const updates = {
        SOLAR_MIN_VOLTAGE: solarMin,
        SOLAR_GOOD_VOLTAGE: solarGood,
        BATTERY_MIN_VOLTAGE: batteryMin,
        BATTERY_CRITICAL_SOC: batteryCritical,
        BATTERY_GOOD_SOC: batteryGood,
        last_updated: Date.now()
    };

    window.update(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings/auto_mode_thresholds`), updates)
        .then(() => {
            // কন্ট্রোলারের থ্রেশহোল্ড আপডেট করুন
            if (window.AUTO_THRESHOLDS) {
                window.AUTO_THRESHOLDS.SOLAR_MIN_VOLTAGE = solarMin;
                window.AUTO_THRESHOLDS.SOLAR_GOOD_VOLTAGE = solarGood;
                window.AUTO_THRESHOLDS.BATTERY_MIN_VOLTAGE = batteryMin;
                window.AUTO_THRESHOLDS.BATTERY_CRITICAL_SOC = batteryCritical;
                window.AUTO_THRESHOLDS.BATTERY_GOOD_SOC = batteryGood;
            }
            
            if (window.showNotification) window.showNotification('থ্রেশহোল্ড সংরক্ষণ করা হয়েছে ✅', 'success');
        })
        .catch((error) => {
            console.error("Error saving thresholds:", error);
            if (window.showNotification) window.showNotification('সংরক্ষণ করতে সমস্যা হয়েছে ❌', 'error');
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
                            <small>প্রতি সাইকেল কত সেকেন্ড ব্রাশ চলবে</small>
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
                            <small>দুই সাইকেলের মধ্যে কত সেকেন্ড বিরতি</small>
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
                            <p>${settings.duration}সে × ${settings.cycles} সাইকেল, ${settings.interval} ঘণ্টা পর, ${settings.breakTime}সে বিরতি</p>
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

    // ভ্যালিডেশন
    if (duration < 5 || duration > 300) {
        if (window.showNotification) window.showNotification('সাইকেল সময় 5-300 সেকেন্ডের মধ্যে হতে হবে!', 'error');
        return;
    }

    if (cycles < 1 || cycles > 10) {
        if (window.showNotification) window.showNotification('সাইকেল সংখ্যা 1-10 এর মধ্যে হতে হবে!', 'error');
        return;
    }

    if (breakTime < 1 || breakTime > 30) {
        if (window.showNotification) window.showNotification('বিরতি 1-30 সেকেন্ডের মধ্যে হতে হবে!', 'error');
        return;
    }

    if (interval < 1 || interval > 48) {
        if (window.showNotification) window.showNotification('ব্যবধান 1-48 ঘণ্টার মধ্যে হতে হবে!', 'error');
        return;
    }

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (!database || !currentUserId || !currentDeviceId) {
        if (window.showNotification) window.showNotification('ডিভাইস সিলেক্ট করুন!', 'error');
        return;
    }

    // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/settings/cleaning
    const updates = {
        duration: duration,
        cycles: cycles,
        breakTime: breakTime,
        interval: interval,
        last_updated: Date.now()
    };

    window.update(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/settings/cleaning`), updates)
        .then(() => {
            // গ্লোবাল সেটিংস আপডেট
            window.cleaningSettings = {
                duration: duration,
                cycles: cycles,
                breakTime: breakTime,
                interval: interval
            };

            // UI আপডেট
            if (window.updateCleaningSettingsDisplay) {
                window.updateCleaningSettingsDisplay();
            }
            
            if (window.showNotification) window.showNotification('ক্লিনিং সেটিংস সংরক্ষণ করা হয়েছে ✅', 'success');
        })
        .catch((error) => {
            console.error("Error saving cleaning settings:", error);
            if (window.showNotification) window.showNotification('সংরক্ষণ করতে সমস্যা হয়েছে ❌', 'error');
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
                            <p>ফ্যাক্টরি রিসেট করলে:</p>
                            <ul>
                                <li>✓ ESP32 এর ওয়াইফাই সেটিংস রিসেট হবে (AP মোডে যাবে)</li>
                                <li>✓ ESP32 এর ডিভাইস আইডি রিসেট হবে</li>
                                <li>✗ Firebase ডাটা অপরিবর্তিত থাকবে</li>
                            </ul>
                        </div>
                    </div>
                    <button id="factoryResetBtn" class="remote-btn danger">
                        <i class="fas fa-exclamation-triangle"></i> শুধু ESP32 ফ্যাক্টরি রিসেট
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
        if (window.showNotification) window.showNotification('ওয়াইফাই SSID দিন', 'error');
        return;
    }

    if (!confirm(`ESP32 তে ওয়াইফাই পরিবর্তন কমান্ড পাঠাবেন?\nSSID: ${ssid}`)) return;

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    const currentUser = window.currentUser;

    if (database && currentUserId && currentDeviceId) {
        // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/commands
        const command = {
            action: 'wifi_config',
            command: 'change_wifi',
            ssid: ssid,
            password: password || '',
            timestamp: Date.now(),
            userId: currentUser?.uid,
            userEmail: currentUser?.email,
            deviceId: currentDeviceId
        };

        window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
            .then(() => {
                if (window.showNotification) window.showNotification('ওয়াইফাই পরিবর্তন কমান্ড পাঠানো হয়েছে', 'success');
                document.getElementById('wifiSSID').value = '';
                document.getElementById('wifiPassword').value = '';
            })
            .catch(() => {
                if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
            });
    }
}

function resetWiFi() {
    if (!confirm('ESP32 এর ওয়াইফাই রিসেট করবেন? ডিভাইস এপি মোডে যাবে।')) return;

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (database && currentUserId && currentDeviceId) {
        const command = {
            action: 'wifi_config',
            command: 'reset_wifi',
            timestamp: Date.now()
        };

        window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
            .then(() => {
                if (window.showNotification) window.showNotification('ওয়াইফাই রিসেট কমান্ড পাঠানো হয়েছে', 'warning');
            })
            .catch(() => {
                if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
            });
    }
}

function changeDevice() {
    const newEmail = document.getElementById('newDeviceEmail')?.value;

    if (!newEmail || !newEmail.includes('@')) {
        if (window.showNotification) window.showNotification('সঠিক ইমেইল দিন', 'error');
        return;
    }

    if (!confirm(`ডিভাইস ট্রান্সফার করবেন?\nনতুন মালিক: ${newEmail}`)) return;

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (database && currentUserId && currentDeviceId) {
        const command = {
            action: 'device_config',
            command: 'change_device',
            new_email: newEmail,
            timestamp: Date.now()
        };

        window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
            .then(() => {
                if (window.showNotification) window.showNotification('ডিভাইস ট্রান্সফার কমান্ড পাঠানো হয়েছে', 'success');
                setTimeout(() => {
                    if (confirm('লগআউট করতে চান? ডিভাইস ট্রান্সফারের পর লগআউট করা প্রয়োজন।')) {
                        window.location.href = 'login.html';
                    }
                }, 2000);
            })
            .catch(() => {
                if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
            });
    }
}

function restartDevice() {
    if (!confirm('ESP32 ডিভাইস রিস্টার্ট করবেন?')) return;

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (database && currentUserId && currentDeviceId) {
        const command = {
            action: 'system_config',
            command: 'restart',
            timestamp: Date.now()
        };

        window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
            .then(() => {
                if (window.showNotification) window.showNotification('রিস্টার্ট কমান্ড পাঠানো হয়েছে', 'info');
            })
            .catch(() => {
                if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
            });
    }
}

function esp32FactoryReset() {
    if (!confirm('⚠️ শুধু ESP32 ফ্যাক্টরি রিসেট করবেন?\n\nযা হবে:\n✓ ওয়াইফাই সেটিংস রিসেট হবে\n✓ ডিভাইস এপি মোডে যাবে\n\nযা হবে না:\n✗ Firebase ডাটা থাকবে\n\nআপনি কি নিশ্চিত?')) return;

    const database = window.database;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;

    if (database && currentUserId && currentDeviceId) {
        const command = {
            action: 'system_config',
            command: 'factory_reset',
            confirm: true,
            reset_type: 'esp32_only',
            timestamp: Date.now()
        };

        window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
            .then(() => {
                if (window.showNotification) window.showNotification('ESP32 ফ্যাক্টরি রিসেট কমান্ড পাঠানো হয়েছে', 'warning');
            })
            .catch(() => {
                if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
            });
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
                        <i class="fas fa-calendar-month"></i>
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
            const database = window.database;
            const currentUserId = window.currentUserId;
            const currentDeviceId = window.currentDeviceId;

            if (database && currentUserId && currentDeviceId) {
                // ✅ সঠিক পাথ: Devices/{userId}/{deviceId}/data/commands
                const command = {
                    action: 'history_clear',
                    command: 'clear_history',
                    option: selectedOption,
                    timestamp: Date.now()
                };

                window.set(window.ref(database, `Devices/${currentUserId}/${currentDeviceId}/data/commands`), command)
                    .then(() => {
                        if (window.showNotification) window.showNotification('হিস্ট্রি ক্লিয়ার কমান্ড পাঠানো হয়েছে', 'warning');
                    })
                    .catch(() => {
                        if (window.showNotification) window.showNotification('কমান্ড পাঠাতে সমস্যা হয়েছে', 'error');
                    });
            }
        }
    });
}

// ==================== ইউটিলিটি ফাংশন ====================
// ক্লিনিং সেটিংস আপডেট ফাংশন
function updateCleaningSettings(newSettings) {
    window.cleaningSettings = {
        ...window.cleaningSettings,
        ...newSettings
    };
    
    // UI আপডেট
    if (window.updateCleaningSettingsDisplay) {
        window.updateCleaningSettingsDisplay();
    }
    
    console.log('✅ Cleaning settings updated:', window.cleaningSettings);
}

// ক্লিনিং সেটিংস ডিসপ্লে স্ট্রিং
function getCleaningSettingsDisplay() {
    const settings = window.cleaningSettings;
    return `${settings.duration}সে × ${settings.cycles} সাইকেল, ${settings.interval}ঘণ্টা পর, ${settings.breakTime}সে বিরতি`;
}

// Firebase থেকে সেটিংস রিলোড
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
window.showRemotePanel = showRemotePanel;
window.showHistoryPanel = showHistoryPanel;
window.DEFAULT_CLEANING_SETTINGS = DEFAULT_CLEANING_SETTINGS;

console.log('✅ Settings.js loaded - Firebase only (no localStorage)');