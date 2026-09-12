// js/main.js - Multiple ESP32 Support (এক User, একাধিক Device)

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, update, push, onValue, goOnline, goOffline } from "firebase/database";

// Import page loaders
import { loadDashboard } from './dashboard.js';
import { loadControl } from './control.js';
import { loadAnalysis } from './analysis.js';
import { setupSettings } from './settings.js';
import { loadProfile } from './profile.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBP9zk3Y8wBBCfvnRKmcExMP-uIbINuTwc",
    authDomain: "solar-panel-c798c.firebaseapp.com",
    databaseURL: "https://solar-panel-c798c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "solar-panel-c798c",
    storageBucket: "solar-panel-c798c.firebasestorage.app",
    messagingSenderId: "619952775462",
    appId: "1:619952775462:web:f7c42fef5b7178c42c21e7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

window.database = database;
window.auth = auth;
window.ref = ref;
window.set = set;
window.get = get;
window.update = update;
window.push = push;
window.onValue = onValue;
window.signOut = signOut;

// Global Variables
let currentUser = null;
let currentUserId = null;
let currentDeviceId = null;
let deviceManager = null;
let userDevices = {};   // ✅ সব device list

// ==================== AUTH LOADING SCREEN ====================
function initAuthLoadingScreen() {
    const authCheckingDiv = document.getElementById("authChecking");
    if (!authCheckingDiv) return;
    const appContainer = document.getElementById("app") || document.querySelector(".container");
    if (appContainer) appContainer.style.display = "none";
}

function hideAuthLoadingScreen() {
    const authCheckingDiv = document.getElementById("authChecking");
    if (authCheckingDiv) {
        authCheckingDiv.style.opacity = '0';
        setTimeout(() => {
            authCheckingDiv.style.display = 'none';
            const appContainer = document.getElementById("app") || document.querySelector(".container");
            if (appContainer) appContainer.style.display = "";
        }, 500);
    }
}

function updateAuthStatus(message, isError = false) {
    const authStatusEl = document.getElementById("authStatus");
    if (authStatusEl) {
        authStatusEl.innerHTML = message;
        authStatusEl.style.color = isError ? "#ffcccc" : "";
    }
}

function showNotification(message, type = "info") {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove("show"), 3000);
    } else {
        alert(message);
    }
    console.log(`[${type}] ${message}`);
}
window.showNotification = showNotification;

// ==================== আইডি জেনারেশন ====================
function generateUserIdFromName(userName) {
    let cleanName = userName.trim().replace(/\s+/g, '_');
    cleanName = cleanName.replace(/[^a-zA-Z0-9_]/g, '');
    return `SolarController_${cleanName}`;
}

// ✅ Device ID জেনারেশন (Project Name দিয়ে)
function generateDeviceId(projectName, email) {
    const cleanEmail = email.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
        hash = ((hash << 5) - hash) + cleanEmail.charCodeAt(i);
        hash = hash & hash;
    }
    
    // Project name + Email hash
    let cleanProject = projectName.trim().replace(/\s+/g, '_');
    cleanProject = cleanProject.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15);
    
    const projectHash = Math.abs(hash).toString(16).substring(0, 4).toUpperCase();
    const timeHash = Date.now().toString(36).substring(-4).toUpperCase();
    
    return `ESP32_${cleanProject}_${projectHash}${timeHash}`;
}

// ==================== বিদ্যমান Data খোঁজা ====================
async function getExistingUserByEmail(email) {
    try {
        const usersRef = ref(database, 'Users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (const [userId, userData] of Object.entries(users)) {
                if (userData && userData.email === email) {
                    return { userId, userData };
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Error finding user:", error);
        return null;
    }
}

// ✅ সব Device list আনা
async function getUserDevices(userId) {
    try {
        const devicesRef = ref(database, `Devices/${userId}`);
        const snapshot = await get(devicesRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return {};
    } catch (error) {
        console.error("Error getting devices:", error);
        return {};
    }
}

// ==================== ডাটা স্ট্রাকচার ====================
async function ensureDataStructure(devicePath) {
    try {
        const dataPath = `${devicePath}/data`;
        const dataRef = ref(database, dataPath);
        const dataSnapshot = await get(dataRef);
        
        const defaultData = {
            current_data: {
                solar_voltage: 0, solar_current: 0,
                battery_voltage: 0, battery_current: 0,
                battery_soc: 0, load_voltage: 0, load_current: 0,
                brush_status: 'stopped', pump_status: 'off',
                cleaning_status: 'inactive', timestamp: Date.now()
            },
            system_status: {
                mode: 'manual', power_source: 'grid',
                last_updated: Date.now(), auto_mode_running: false,
                current_reason: 'সিস্টেম স্টার্ট'
            },
            settings: {
                auto_mode_thresholds: {
                    SOLAR_MIN_VOLTAGE: 12.5, SOLAR_GOOD_VOLTAGE: 13.0,
                    BATTERY_MIN_VOLTAGE: 11.8, BATTERY_CRITICAL_SOC: 25,
                    BATTERY_GOOD_SOC: 40, last_updated: Date.now()
                },
                cleaning: {
                    duration: 30, interval: 6, cycles: 3,
                    breakTime: 10, last_updated: Date.now()
                },
                battery_cutoff: {
                    full_voltage: 14.0, recover_voltage: 13.3,
                    last_updated: Date.now()
                }
            },
            last_command: {},
            alerts: [],
            history: [],
            commands: {}
        };
        
        if (!dataSnapshot.exists()) {
            await set(dataRef, defaultData);
            console.log("✅ Data structure created");
            return true;
        } else {
            const existingData = dataSnapshot.val();
            let needsUpdate = false;
            
            if (!existingData.current_data) { existingData.current_data = defaultData.current_data; needsUpdate = true; }
            if (!existingData.system_status) { existingData.system_status = defaultData.system_status; needsUpdate = true; }
            if (!existingData.alerts) { existingData.alerts = []; needsUpdate = true; }
            if (!existingData.history) { existingData.history = []; needsUpdate = true; }
            if (!existingData.commands) { existingData.commands = {}; needsUpdate = true; }
            if (!existingData.last_command) { existingData.last_command = {}; needsUpdate = true; }
            
            if (!existingData.settings) {
                existingData.settings = defaultData.settings;
                needsUpdate = true;
            } else {
                if (!existingData.settings.auto_mode_thresholds) { existingData.settings.auto_mode_thresholds = defaultData.settings.auto_mode_thresholds; needsUpdate = true; }
                if (!existingData.settings.cleaning) { existingData.settings.cleaning = defaultData.settings.cleaning; needsUpdate = true; }
                if (!existingData.settings.battery_cutoff) { existingData.settings.battery_cutoff = defaultData.settings.battery_cutoff; needsUpdate = true; }
            }
            
            if (existingData.current_data) {
                const cd = existingData.current_data;
                if (cd.load_current === undefined) { cd.load_current = cd.battery_current || 0; needsUpdate = true; }
                if (cd.brush_status === undefined) { cd.brush_status = 'stopped'; needsUpdate = true; }
                if (cd.pump_status === undefined) { cd.pump_status = 'off'; needsUpdate = true; }
                if (cd.cleaning_status === undefined) { cd.cleaning_status = 'inactive'; needsUpdate = true; }
                if (cd.dust_level !== undefined) { delete cd.dust_level; needsUpdate = true; }
                if (cd.efficiency !== undefined) { delete cd.efficiency; needsUpdate = true; }
            }
            
            if (needsUpdate) {
                await set(dataRef, existingData);
                console.log("✅ Data structure updated");
            }
            return true;
        }
    } catch (error) {
        console.error("Error ensuring data structure:", error);
        return false;
    }
}

// ==================== DEVICE MANAGER CLASS ====================
class DeviceManager {
    constructor() {
        this.currentUserId = null;
        this.currentDeviceId = null;
        this.userEmail = null;
        this.userName = null;
    }

    async initialize(user, userData = {}) {
        if (!user || !database) return false;

        try {
            this.userEmail = user.email;
            this.userName = userData.userName || user.displayName || this.formatDisplayName(this.userEmail);
            
            // ✅ User খুঁজুন অথবা তৈরি করুন
            const existingUser = await getExistingUserByEmail(this.userEmail);
            
            if (existingUser) {
                this.currentUserId = existingUser.userId;
                if (existingUser.userData.user_name) {
                    this.userName = existingUser.userData.user_name;
                }
                console.log("✅ Existing user:", this.currentUserId);
            } else {
                this.currentUserId = generateUserIdFromName(this.userName);
                console.log("✅ New user:", this.currentUserId);
            }
            
            // ✅ সব device list আনা
            userDevices = await getUserDevices(this.currentUserId);
            console.log("📱 Devices found:", Object.keys(userDevices).length);
            
            // ✅ যদি কোনো device না থাকে → নতুন তৈরি
            // ✅ যদি device থাকে → user সিলেক্ট করবে
            let deviceId = null;
            const deviceIds = Object.keys(userDevices);
            
            if (deviceIds.length === 0) {
                // প্রথম device তৈরি
                deviceId = generateDeviceId("Solar_Project_1", this.userEmail);
                console.log("✅ First device created:", deviceId);
                userDevices[deviceId] = { device_name: "Solar Project 1", created_at: Date.now() };
            } else {
                // আগের device save করুন
                deviceId = localStorage.getItem('selectedDeviceId');
                
                if (!deviceId || !userDevices[deviceId]) {
                    deviceId = deviceIds[0];   // Default → প্রথম device
                }
            }
            
            this.currentDeviceId = deviceId;
            
            // User তৈরি/আপডেট
            await this.createOrLoadUser(existingUser);
            
            // Device তৈরি/আপডেট
            await this.createOrLoadDevice();
            
            // Data structure
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            await ensureDataStructure(devicePath);
            
            // Global set
            window.currentUserId = this.currentUserId;
            window.currentDeviceId = this.currentDeviceId;
            window.currentUser = user;
            window.userEmail = this.userEmail;
            window.userName = this.userName;
            window.userDevices = userDevices;   // ✅ সব device list global
            
            console.log("✅ Initialized:", {
                userId: this.currentUserId,
                deviceId: this.currentDeviceId,
                totalDevices: deviceIds.length
            });
            
            return true;
            
        } catch (error) {
            console.error("DeviceManager error:", error);
            showNotification('সিস্টেম ইনিশিয়ালাইজ সমস্যা: ' + error.message, 'error');
            return false;
        }
    }
    
    formatDisplayName(email) {
        let username = email.split('@')[0];
        if (username.length > 0) {
            return username.charAt(0).toUpperCase() + username.slice(1);
        }
        return "User";
    }

    async createOrLoadUser(existingUser = null) {
        try {
            const userRef = ref(database, `Users/${this.currentUserId}`);
            
            if (!existingUser) {
                const userData = {
                    user_name: this.userName,
                    email: this.userEmail,
                    created_at: Date.now(),
                    last_login: Date.now(),
                    status: 'active'
                };
                
                const snapshot = await get(userRef);
                if (!snapshot.exists()) {
                    await set(userRef, userData);
                    showNotification(`ইউজার তৈরি হয়েছে`, 'success');
                } else {
                    await update(userRef, { last_login: Date.now() });
                    showNotification(`স্বাগতম, ${this.userName}!`, 'success');
                }
            } else {
                await update(userRef, { last_login: Date.now() });
                showNotification(`স্বাগতম, ${this.userName}!`, 'success');
            }
            return true;
        } catch (error) {
            console.error("User error:", error);
            return false;
        }
    }

    async createOrLoadDevice() {
        try {
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            const deviceRef = ref(database, devicePath);
            
            const deviceInfo = {
                device_name: userDevices[this.currentDeviceId]?.device_name || "Solar Project",
                user_id: this.currentUserId,
                user_email: this.userEmail,
                created_at: userDevices[this.currentDeviceId]?.created_at || Date.now(),
                last_updated: Date.now(),
                status: 'active'
            };
            
            const snapshot = await get(deviceRef);
            if (!snapshot.exists()) {
                await set(deviceRef, deviceInfo);
                console.log("✅ Device created");
            } else {
                await update(deviceRef, { last_updated: Date.now() });
            }
            return true;
        } catch (error) {
            console.error("Device error:", error);
            return false;
        }
    }

    getCurrentDeviceId() { return this.currentDeviceId; }
    getCurrentUserId() { return this.currentUserId; }
    
    cleanup() { console.log("🧹 Cleaned up"); }
}

// ==================== ✅ DEVICE SWITCHER UI ====================
window.showDeviceSelector = function() {
    const content = document.getElementById("content");
    if (!content) return;
    
    const deviceIds = Object.keys(userDevices);
    
    let html = `
        <div class="device-selector-container">
            <div class="device-selector-header">
                <i class="fas fa-microchip"></i>
                <h2>আপনার ডিভাইস সমূহ</h2>
                <p>যে ডিভাইস কন্ট্রোল করতে চান সেটা সিলেক্ট করুন</p>
            </div>
            
            <div class="device-list">
    `;
    
    if (deviceIds.length === 0) {
        html += `
            <div class="no-devices">
                <i class="fas fa-inbox"></i>
                <p>কোনো ডিভাইস নেই</p>
                <p style="font-size: 12px; color: #64748b;">ESP32 যোগ করতে নিচের বাটন চাপুন</p>
            </div>
        `;
    } else {
        deviceIds.forEach(deviceId => {
            const device = userDevices[deviceId];
            const isActive = deviceId === window.currentDeviceId;
            
            html += `
                <div class="device-card ${isActive ? 'active' : ''}" data-device-id="${deviceId}">
                    <div class="device-icon">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <div class="device-info">
                        <div class="device-name">${device.device_name || deviceId}</div>
                        <div class="device-id">${deviceId.substring(0, 30)}...</div>
                        <div class="device-status">${isActive ? '✅ সক্রিয়' : '🔘 নিষ্ক্রিয়'}</div>
                    </div>
                    ${isActive ? '<i class="fas fa-check-circle device-check"></i>' : ''}
                </div>
            `;
        });
    }
    
    html += `
            </div>
            
            <button class="add-device-btn" onclick="window.addNewDevice()">
                <i class="fas fa-plus"></i> নতুন ডিভাইস যোগ করুন
            </button>
        </div>
    `;
    
    content.innerHTML = html;
    
    // Device select click
    document.querySelectorAll('.device-card').forEach(card => {
        card.addEventListener('click', () => {
            const deviceId = card.dataset.deviceId;
            window.switchDevice(deviceId);
        });
    });
};

// ==================== ✅ Switch Device ====================
window.switchDevice = function(deviceId) {
    if (!deviceId || !userDevices[deviceId]) return;
    
    // Save
    localStorage.setItem('selectedDeviceId', deviceId);
    
    // Update global
    window.currentDeviceId = deviceId;
    
    // Reload page
    showNotification('ডিভাইস পরিবর্তন হচ্ছে...', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 800);
};

// ==================== ✅ Add New Device ====================
window.addNewDevice = function() {
    const content = document.getElementById("content");
    if (!content) return;
    
    content.innerHTML = `
        <div class="add-device-container">
            <div class="add-device-header">
                <i class="fas fa-plus-circle"></i>
                <h2>নতুন ডিভাইস যোগ করুন</h2>
                <p>ESP32 এর জন্য একটা নাম দিন</p>
            </div>
            
            <div class="add-device-form">
                <div class="form-group">
                    <label>প্রজেক্টের নাম</label>
                    <input type="text" id="newDeviceName" placeholder="যেমন: ঘরের সোলার সিস্টেম">
                    <small>এই নাম দিয়ে আপনি ডিভাইস চিনবেন</small>
                </div>
                
                <div class="form-group">
                    <label>ESP32 Device ID (ESP32 থেকে)</label>
                    <input type="text" id="newDeviceId" placeholder="ESP32_XXXX (ESP32 Serial Monitor দেখুন)">
                    <small>ESP32 এর Serial Monitor এ "Device ID: xxx" দেখুন</small>
                </div>
                
                <div class="button-group">
                    <button class="btn-cancel" onclick="window.showDeviceSelector()">বাতিল</button>
                    <button class="btn-save" onclick="window.saveNewDevice()">সংরক্ষণ</button>
                </div>
            </div>
        </div>
    `;
};

// ==================== ✅ Save New Device ====================
window.saveNewDevice = async function() {
    const deviceName = document.getElementById('newDeviceName')?.value?.trim();
    const deviceId = document.getElementById('newDeviceId')?.value?.trim();
    
    if (!deviceName) {
        showNotification('ডিভাইসের নাম দিন', 'error');
        return;
    }
    
    if (!deviceId) {
        showNotification('Device ID দিন', 'error');
        return;
    }
    
    // Save to Firebase
    try {
        const devicePath = `Devices/${window.currentUserId}/${deviceId}`;
        const deviceRef = ref(database, devicePath);
        
        const snapshot = await get(deviceRef);
        if (snapshot.exists()) {
            showNotification('এই Device ID আগেই যোগ আছে', 'warning');
            return;
        }
        
        // Create device
        await set(deviceRef, {
            device_name: deviceName,
            user_id: window.currentUserId,
            user_email: window.userEmail,
            created_at: Date.now(),
            status: 'active'
        });
        
        // Create data structure
        await ensureDataStructure(devicePath);
        
        // Update local list
        userDevices[deviceId] = { device_name: deviceName, created_at: Date.now() };
        
        showNotification('ডিভাইস যোগ হয়েছে ✅', 'success');
        
        // Switch to new device
        setTimeout(() => {
            window.switchDevice(deviceId);
        }, 1000);
        
    } catch (error) {
        console.error("Add device error:", error);
        showNotification('ডিভাইস যোগ করতে সমস্যা ❌', 'error');
    }
};

// ==================== Navigation ====================
function navigateTo(page) {
    const buttons = document.querySelectorAll(".nav-btn");
    const indicator = document.querySelector(".indicator");

    buttons.forEach(btn => btn.classList.remove("active"));

    const targetBtn = document.querySelector(`[data-page="${page}"]`);
    if (targetBtn) {
        targetBtn.classList.add("active");
        if (indicator) {
            indicator.style.width = targetBtn.offsetWidth + "px";
            indicator.style.left = targetBtn.offsetLeft + "px";
        }
    }

    const dropdown = document.getElementById("dropdown");
    if (dropdown) dropdown.style.display = "none";

    switch(page) {
        case "dashboard": loadDashboard(); break;
        case "control": loadControl(); break;
        case "analysis": loadAnalysis(); break;
        case "profile": loadProfile(); break;
        default: loadDashboard();
    }
}

window.navigateTo = navigateTo;

// ==================== AUTH STATE OBSERVER ====================
onAuthStateChanged(auth, async (user) => {
    console.log("Auth state:", user ? user.email : "No user");
    
    if (user) {
        currentUser = user;
        updateAuthStatus(`✅ স্বাগতম, ${user.email.split('@')[0]}!`);
        
        try {
            deviceManager = new DeviceManager();
            
            const urlParams = new URLSearchParams(window.location.search);
            const userName = urlParams.get('userName') || user.displayName || "";
            
            const userData = { userName: userName };
            
            const success = await deviceManager.initialize(user, userData);
            
            if (success) {
                currentDeviceId = deviceManager.getCurrentDeviceId();
                currentUserId = deviceManager.getCurrentUserId();
                
                window.deviceManager = deviceManager;
                window.currentDeviceId = currentDeviceId;
                window.currentUserId = currentUserId;
                window.currentUserEmail = user.email;
                
                // ✅ যদি ১টার বেশি device থাকে → selector দেখান
                if (Object.keys(userDevices).length > 1) {
                    setTimeout(() => {
                        hideAuthLoadingScreen();
                        window.showDeviceSelector();
                    }, 500);
                } else {
                    // ১টি device → সরাসরি dashboard
                    if (typeof setupSettings === 'function') setupSettings();
                    setTimeout(() => {
                        hideAuthLoadingScreen();
                        navigateTo("dashboard");
                    }, 500);
                }
            }
        } catch (error) {
            console.error("Initialization error:", error);
            showNotification("সিস্টেম ইনিশিয়ালাইজ ব্যর্থ: " + error.message, "error");
        }
    } else {
        setTimeout(() => window.location.href = "login.html", 1500);
    }
});

// ==================== EVENT LISTENERS ====================
document.addEventListener("DOMContentLoaded", () => {
    initAuthLoadingScreen();
    
    if (!document.getElementById("toast")) {
        const toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const page = this.getAttribute("data-page");
            if (page) navigateTo(page);
        });
    });
    
    const menuBtn = document.getElementById("menuBtn");
    const dropdown = document.getElementById("dropdown");
    if (menuBtn && dropdown) {
        menuBtn.addEventListener("click", (e) => { 
            e.stopPropagation(); 
            dropdown.style.display = dropdown.style.display === "block" ? "none" : "block"; 
        });
    }
    
    document.addEventListener("click", () => { 
        if (dropdown) dropdown.style.display = "none"; 
    });
    
    // ✅ Device Selector Menu
    document.getElementById("deviceMenuBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.showDeviceSelector();
    });
    
    document.getElementById("profileMenuBtn")?.addEventListener("click", (e) => { 
        e.preventDefault();
        navigateTo("profile"); 
    });
    document.getElementById("settingsMenuBtn")?.addEventListener("click", (e) => { 
        e.preventDefault();
        navigateTo("settings"); 
    });
    document.getElementById("logoutMenuBtn")?.addEventListener("click", async () => {
        if (confirm("লগআউট করবেন?")) {
            localStorage.removeItem('selectedDeviceId');
            if (deviceManager) deviceManager.cleanup();
            await signOut(auth);
            window.location.href = "login.html";
        }
    });
});

// ==================== CLOCK ====================
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById("time");
    const dateEl = document.getElementById("date");
    if (timeEl) timeEl.textContent = now.toLocaleTimeString("bn-BD", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}
setInterval(updateClock, 1000);
updateClock();

console.log("✅ Main.js v12.0 - Multiple ESP32 Support");