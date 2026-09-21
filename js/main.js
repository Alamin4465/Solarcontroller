// js/main.js - Multiple ESP32 Support
// ✅ ESP32 v6.8.9 ALIGNED — Priority loop + Fast lookup
// ✅ v13.2 — Direct user lookup (fast, low Firebase cost)
// ✅ Fixed: login.html auth flow, onAuthStateChanged integration

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, update, push, onValue, goOnline, goOffline } from "firebase/database";

import { loadDashboard } from './dashboard.js';
import { loadControl } from './control.js';
import { loadAnalysis } from './analysis.js';
import { setupSettings } from './settings.js';
import { loadProfile } from './profile.js';

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

let currentUser = null;
let currentUserId = null;
let currentDeviceId = null;
let deviceManager = null;
let userDevices = {};

// ==================== ID GENERATION (ESP32 ALIGNED) ====================
function generateUserIdFromEmail(email) {
    if (!email || !email.includes('@')) return "SolarController_Unknown";
    let emailPrefix = email.substring(0, email.indexOf('@'));
    if (emailPrefix.length > 0) {
        const firstChar = emailPrefix.charAt(0).toUpperCase();
        emailPrefix = firstChar + emailPrefix.slice(1);
    }
    return `SolarController_${emailPrefix}`;
}

function generateDeviceIdFromEmail(email) {
    if (!email || !email.includes('@')) return "ESP32_Solar_Unknown";
    let emailPrefix = email.substring(0, email.indexOf('@'));
    if (emailPrefix.length > 0) {
        const firstChar = emailPrefix.charAt(0).toUpperCase();
        emailPrefix = firstChar + emailPrefix.slice(1);
    }
    return `ESP32_Solar_${emailPrefix}`;
}

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

// ==================== DIRECT USER LOOKUP ====================
async function getExistingUserByEmail(email) {
    try {
        const userId = generateUserIdFromEmail(email);
        const userRef = ref(database, `Users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.email === email) return { userId, userData };
        }
        return null;
    } catch (error) {
        console.error("Error finding user:", error);
        return null;
    }
}

async function getUserDevices(userId) {
    try {
        const devicesRef = ref(database, `Devices/${userId}`);
        const snapshot = await get(devicesRef);
        if (snapshot.exists()) return snapshot.val();
        return {};
    } catch (error) {
        console.error("Error getting devices:", error);
        return {};
    }
}

// ==================== Data Structure ====================
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
                    SOLAR_MIN_VOLTAGE: 12.5, SOLAR_GOOD_VOLTAGE: 13.5,
                    BATTERY_MIN_VOLTAGE: 11.8, BATTERY_CRITICAL_SOC: 25,
                    BATTERY_GOOD_SOC: 40, last_updated: Date.now()
                },
                cleaning: {
                    duration: 30, interval: 6, cycles: 3,
                    breakTime: 10, last_updated: Date.now()
                },
                battery_cutoff: {
                    full_voltage: 13.7, recover_voltage: 13.0,
                    last_updated: Date.now()
                }
            },
            last_command: {}, alerts: [], history: [], commands: {}
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

// ==================== DEVICE MANAGER ====================
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
            this.currentUserId = generateUserIdFromEmail(this.userEmail);
            this.currentDeviceId = generateDeviceIdFromEmail(this.userEmail);
            
            console.log("✅ User ID:", this.currentUserId);
            console.log("✅ Device ID:", this.currentDeviceId);
            
            userDevices = await getUserDevices(this.currentUserId);
            console.log("📱 Devices found:", Object.keys(userDevices).length);
            
            await this.createOrLoadUser();
            await this.createOrLoadDevice();
            
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            await ensureDataStructure(devicePath);
            
            window.currentUserId = this.currentUserId;
            window.currentDeviceId = this.currentDeviceId;
            window.currentUser = user;
            window.userEmail = this.userEmail;
            window.userName = this.userName;
            window.userDevices = userDevices;
            
            console.log("✅ Initialized:", { userId: this.currentUserId, deviceId: this.currentDeviceId });
            return true;
        } catch (error) {
            console.error("DeviceManager error:", error);
            showNotification('সিস্টেম ইনিশিয়ালাইজ সমস্যা: ' + error.message, 'error');
            return false;
        }
    }
    
    formatDisplayName(email) {
        let username = email.split('@')[0];
        if (username.length > 0) return username.charAt(0).toUpperCase() + username.slice(1);
        return "User";
    }

    async createOrLoadUser() {
        try {
            const userRef = ref(database, `Users/${this.currentUserId}`);
            const snapshot = await get(userRef);
            
            if (!snapshot.exists()) {
                await set(userRef, {
                    user_name: this.userName, email: this.userEmail,
                    created_at: Date.now(), last_login: Date.now(), status: 'active'
                });
                showNotification(`ইউজার তৈরি হয়েছে`, 'success');
            } else {
                await update(userRef, { last_login: Date.now() });
                showNotification(`স্বাগতম, ${this.userName}!`, 'success');
            }
            return true;
        } catch (error) { console.error("User error:", error); return false; }
    }

    async createOrLoadDevice() {
        try {
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            const deviceRef = ref(database, devicePath);
            
            const deviceInfo = {
                device_name: userDevices[this.currentDeviceId]?.device_name || "Solar Controller",
                user_id: this.currentUserId, user_email: this.userEmail,
                created_at: userDevices[this.currentDeviceId]?.created_at || Date.now(),
                last_updated: Date.now(), status: 'active'
            };
            
            const snapshot = await get(deviceRef);
            if (!snapshot.exists()) {
                await set(deviceRef, deviceInfo);
                console.log("✅ Device created");
            } else {
                await update(deviceRef, { last_updated: Date.now() });
            }
            return true;
        } catch (error) { console.error("Device error:", error); return false; }
    }

    getCurrentDeviceId() { return this.currentDeviceId; }
    getCurrentUserId() { return this.currentUserId; }
    cleanup() { console.log("🧹 Cleaned up"); }
}

// ==================== DEVICE SWITCHER UI ====================
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
        html += `<div class="no-devices"><i class="fas fa-inbox"></i><p>কোনো ডিভাইস নেই</p></div>`;
    } else {
        deviceIds.forEach(deviceId => {
            const device = userDevices[deviceId];
            const isActive = deviceId === window.currentDeviceId;
            html += `
                <div class="device-card ${isActive ? 'active' : ''}" data-device-id="${deviceId}">
                    <div class="device-icon"><i class="fas fa-microchip"></i></div>
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
    document.querySelectorAll('.device-card').forEach(card => {
        card.addEventListener('click', () => window.switchDevice(card.dataset.deviceId));
    });
};

window.switchDevice = function(deviceId) {
    if (!deviceId || !userDevices[deviceId]) return;
    localStorage.setItem('selectedDeviceId', deviceId);
    window.currentDeviceId = deviceId;
    showNotification('ডিভাইস পরিবর্তন হচ্ছে...', 'info');
    setTimeout(() => window.location.reload(), 800);
};

window.addNewDevice = function() {
    const content = document.getElementById("content");
    if (!content) return;
    const autoDeviceId = window.currentDeviceId || '';
    
    content.innerHTML = `
        <div class="add-device-container">
            <div class="add-device-header">
                <i class="fas fa-plus-circle"></i>
                <h2>নতুন ডিভাইস যোগ করুন</h2>
            </div>
            <div class="add-device-form">
                <div class="form-group">
                    <label>প্রজেক্টের নাম</label>
                    <input type="text" id="newDeviceName" placeholder="যেমন: ঘরের সোলার সিস্টেম">
                </div>
                <div class="form-group">
                    <label>ESP32 Device ID</label>
                    <input type="text" id="newDeviceId" placeholder="ESP32_Solar_XXXX" value="${autoDeviceId}">
                </div>
                <div class="button-group">
                    <button class="btn-cancel" onclick="window.showDeviceSelector()">বাতিল</button>
                    <button class="btn-save" onclick="window.saveNewDevice()">সংরক্ষণ</button>
                </div>
            </div>
        </div>
    `;
};

window.saveNewDevice = async function() {
    const deviceName = document.getElementById('newDeviceName')?.value?.trim();
    const deviceId = document.getElementById('newDeviceId')?.value?.trim();
    
    if (!deviceName || !deviceId) { showNotification('সব তথ্য দিন', 'error'); return; }
    
    try {
        const devicePath = `Devices/${window.currentUserId}/${deviceId}`;
        const deviceRef = ref(database, devicePath);
        const snapshot = await get(deviceRef);
        if (snapshot.exists() && userDevices[deviceId]) {
            showNotification('এই Device ID আগেই যোগ আছে', 'warning');
            return;
        }
        
        await set(deviceRef, {
            device_name: deviceName, user_id: window.currentUserId,
            user_email: window.userEmail, created_at: Date.now(), status: 'active'
        });
        await ensureDataStructure(devicePath);
        userDevices[deviceId] = { device_name: deviceName, created_at: Date.now() };
        showNotification('ডিভাইস যোগ হয়েছে ✅', 'success');
        setTimeout(() => window.switchDevice(deviceId), 1000);
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
    console.log("🔥 Auth:", user ? user.email : "No user");
    
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
                
                if (Object.keys(userDevices).length > 1) {
                    setTimeout(() => { hideAuthLoadingScreen(); window.showDeviceSelector(); }, 300);
                } else {
                    if (typeof setupSettings === 'function') setupSettings();
                    setTimeout(() => { hideAuthLoadingScreen(); navigateTo("dashboard"); }, 300);
                }
            } else {
                updateAuthStatus("❌ Initialization failed", true);
            }
        } catch (error) {
            console.error("❌ Init error:", error);
            showNotification("সিস্টেম ইনিশিয়ালাইজ ব্যর্থ: " + error.message, "error");
        }
    } else {
        console.log("🔒 No user, redirecting...");
        const currentPage = window.location.pathname;
        if (!currentPage.includes("login.html")) {
            setTimeout(() => { window.location.href = "login.html"; }, 800);
        }
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
    
    document.addEventListener("click", () => { if (dropdown) dropdown.style.display = "none"; });
    
    document.getElementById("deviceMenuBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.showDeviceSelector();
    });
    
    document.getElementById("profileMenuBtn")?.addEventListener("click", (e) => { 
        e.preventDefault(); navigateTo("profile"); 
    });
    document.getElementById("settingsMenuBtn")?.addEventListener("click", (e) => { 
        e.preventDefault(); navigateTo("settings"); 
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

console.log("✅ Main.js v13.2 - ESP32 v6.8.9 ALIGNED (Priority loop + Fast lookup)");