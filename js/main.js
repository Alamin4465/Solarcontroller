// js/main.js - ডাটা স্ট্রাকচার ঠিক করা সংস্করণ
// ডাটাবেস স্ট্রাকচার: 
//   Users/{userId}/ 
//   Devices/{userId}/{deviceId}/data/...

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Export to window for compatibility
window.firebaseModules = {
    app, auth, database, ref, set, get, update, push, onValue,
    onAuthStateChanged, signOut, goOnline, goOffline
};

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

// ==================== আইডি জেনারেশন (পুরনো ফরম্যাটের সাথে ম্যাচ) ====================
function generateUserIdFromName(userName) {
    let cleanName = userName.trim().replace(/\s+/g, '_');
    cleanName = cleanName.replace(/[^a-zA-Z0-9_]/g, '');
    return `SolarController_${cleanName}`;
}

function generateDeviceIdFromNameAndEmail(userName, email) {
    const cleanEmail = email.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
        hash = ((hash << 5) - hash) + cleanEmail.charCodeAt(i);
        hash = hash & hash;
    }
    const hashHex = Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
    
    let cleanName = userName.trim().replace(/\s+/g, '_');
    cleanName = cleanName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15);
    
    return `ESP32_${cleanName}_${hashHex}`;
}

// ==================== বিদ্যমান ডাটা খোঁজা ====================
async function getExistingUserByEmail(email) {
    try {
        const usersRef = ref(database, 'Users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (const [userId, userData] of Object.entries(users)) {
                if (userData && userData.email === email) {
                    console.log("Found existing user:", userId);
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

async function getExistingDeviceByUserId(userId) {
    try {
        const devicesRef = ref(database, `Devices/${userId}`);
        const snapshot = await get(devicesRef);
        
        if (snapshot.exists()) {
            const devices = snapshot.val();
            const deviceIds = Object.keys(devices);
            if (deviceIds.length > 0) {
                const deviceId = deviceIds[0];
                console.log("Found existing device:", deviceId);
                return { deviceId, deviceData: devices[deviceId] };
            }
        }
        return null;
    } catch (error) {
        console.error("Error finding device:", error);
        return null;
    }
}

// ==================== ডাটা স্ট্রাকচার চেক এবং রিপেয়ার ====================
async function ensureDataStructure(devicePath, deviceId, userId, userEmail, userName) {
    try {
        const dataPath = `${devicePath}/data`;
        const dataRef = ref(database, dataPath);
        const dataSnapshot = await get(dataRef);
        
        const defaultData = {
            current_data: {
                solar_voltage: 13.5,
                solar_current: 2.5,
                battery_voltage: 12.8,
                battery_current: 1.2,
                battery_soc: 75,
                load_voltage: 12.6,
                load_current: 1.8,
                dust_level: 45,
                efficiency: 85,
                brush_status: 'stopped',
                pump_status: 'off',
                timestamp: Date.now()
            },
            system_status: {
                mode: 'manual',
                power_source: 'grid',
                brush_mode: 'auto',
                last_updated: Date.now(),
                auto_mode_running: false,
                current_reason: 'সিস্টেম স্টার্ট'
            },
            settings: {
                auto_mode_thresholds: {
                    SOLAR_MIN_VOLTAGE: 12.5,
                    SOLAR_GOOD_VOLTAGE: 13.0,
                    BATTERY_MIN_VOLTAGE: 11.8,
                    BATTERY_CRITICAL_SOC: 25,
                    BATTERY_GOOD_SOC: 40
                }
            },
            alerts: [],
            history: [],
            commands: {}
        };
        
        if (!dataSnapshot.exists()) {
            console.log("⚠️ Data object missing! Creating data structure...");
            await set(dataRef, defaultData);
            console.log("✅ Data structure created successfully");
            showNotification('ডিভাইস ডাটা স্ট্রাকচার তৈরি করা হয়েছে', 'success');
            return true;
        } else {
            // চেক করুন সব প্রয়োজনীয় ফিল্ড আছে কিনা
            const existingData = dataSnapshot.val();
            let needsUpdate = false;
            
            if (!existingData.current_data) {
                existingData.current_data = defaultData.current_data;
                needsUpdate = true;
            }
            if (!existingData.system_status) {
                existingData.system_status = defaultData.system_status;
                needsUpdate = true;
            }
            if (!existingData.settings) {
                existingData.settings = defaultData.settings;
                needsUpdate = true;
            }
            if (!existingData.alerts) {
                existingData.alerts = [];
                needsUpdate = true;
            }
            if (!existingData.history) {
                existingData.history = [];
                needsUpdate = true;
            }
            if (!existingData.commands) {
                existingData.commands = {};
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await set(dataRef, existingData);
                console.log("✅ Missing data fields added");
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
        this.currentDeviceId = null;
        this.currentUserId = null;
        this.userEmail = null;
        this.userName = null;
        this.userDob = null;
    }

    async initialize(user, userData = {}) {
        if (!user || !database) {
            console.error("User or database not available");
            return false;
        }

        try {
            this.userEmail = user.email;
            this.userName = userData.userName || user.displayName || this.formatDisplayName(this.userEmail);
            this.userDob = userData.dob || "";
            
            // খুঁজে দেখুন এই ইমেইলে আগের কোন ইউজার আছে কিনা
            const existingUser = await getExistingUserByEmail(this.userEmail);
            
            if (existingUser) {
                this.currentUserId = existingUser.userId;
                if (existingUser.userData.user_name) {
                    this.userName = existingUser.userData.user_name;
                }
                console.log("✅ Using existing user ID:", this.currentUserId);
            } else {
                this.currentUserId = generateUserIdFromName(this.userName);
                console.log("✅ Generated new user ID:", this.currentUserId);
            }
            
            // এই ইউজারের অধীনে ডিভাইস খুঁজুন
            const existingDevice = await getExistingDeviceByUserId(this.currentUserId);
            
            if (existingDevice) {
                this.currentDeviceId = existingDevice.deviceId;
                console.log("✅ Using existing device ID:", this.currentDeviceId);
            } else {
                this.currentDeviceId = generateDeviceIdFromNameAndEmail(this.userName, this.userEmail);
                console.log("✅ Generated new device ID:", this.currentDeviceId);
            }
            
            console.log("Final IDs:", {
                userId: this.currentUserId,
                deviceId: this.currentDeviceId
            });
            
            // ইউজার তৈরি/আপডেট
            const userCreated = await this.createOrLoadUser(existingUser);
            if (!userCreated) return false;
            
            // ডিভাইস তৈরি/আপডেট
            const deviceCreated = await this.createOrLoadDevice(existingDevice);
            if (!deviceCreated) return false;
            
            // ডাটা স্ট্রাকচার চেক এবং রিপেয়ার
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            await ensureDataStructure(devicePath, this.currentDeviceId, this.currentUserId, this.userEmail, this.userName);
            
            // গ্লোবাল ভেরিয়েবল সেট
            window.currentUserId = this.currentUserId;
            window.currentDeviceId = this.currentDeviceId;
            window.currentUser = user;
            window.userEmail = this.userEmail;
            window.userName = this.userName;
            
            console.log("✅ DeviceManager initialized successfully");
            return true;
            
        } catch (error) {
            console.error("DeviceManager initialization error:", error);
            showNotification('সিস্টেম ইনিশিয়ালাইজ করতে সমস্যা হয়েছে: ' + error.message, 'error');
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
            const userPath = `Users/${this.currentUserId}`;
            const userRef = ref(database, userPath);
            
            if (!existingUser) {
                const snapshot = await get(userRef);
                
                if (!snapshot.exists()) {
                    const userData = {
                        user_name: this.userName,
                        email: this.userEmail,
                        device_id: this.currentDeviceId,
                        created_at: Date.now(),
                        last_login: Date.now(),
                        status: 'active'
                    };
                    if (this.userDob) userData.dob = this.userDob;
                    
                    await set(userRef, userData);
                    console.log("✅ User created");
                    showNotification(`ইউজার তৈরি হয়েছে`, 'success');
                } else {
                    await update(userRef, {
                        last_login: Date.now(),
                        status: 'active',
                        device_id: this.currentDeviceId
                    });
                    console.log("✅ User updated");
                    showNotification(`স্বাগতম, ${this.userName}!`, 'success');
                }
            } else {
                await update(userRef, {
                    last_login: Date.now(),
                    status: 'active'
                });
                console.log("✅ Existing user updated");
                showNotification(`স্বাগতম, ${this.userName}!`, 'success');
            }
            return true;
            
        } catch (error) {
            console.error("User error:", error);
            return false;
        }
    }

    async createOrLoadDevice(existingDevice = null) {
        try {
            const devicePath = `Devices/${this.currentUserId}/${this.currentDeviceId}`;
            const deviceRef = ref(database, devicePath);
            
            const deviceInfo = {
                device_name: `${this.userName} এর সোলার কন্ট্রোলার`,
                user_id: this.currentUserId,
                user_email: this.userEmail,
                device_info: {
                    type: 'ESP32_SOLAR_CONTROLLER',
                    model: 'SOLAR_001',
                    version: '1.0.0'
                }
            };
            
            if (!existingDevice) {
                const snapshot = await get(deviceRef);
                
                if (!snapshot.exists()) {
                    await set(deviceRef, {
                        ...deviceInfo,
                        created_at: Date.now(),
                        status: 'active',
                        last_updated: Date.now()
                    });
                    console.log("✅ Device created");
                    showNotification(`ডিভাইস তৈরি হয়েছে`, 'success');
                } else {
                    await update(deviceRef, {
                        last_updated: Date.now(),
                        status: 'active'
                    });
                    console.log("✅ Device updated");
                }
            } else {
                await update(deviceRef, {
                    last_updated: Date.now(),
                    status: 'active'
                });
                console.log("✅ Existing device updated");
            }
            return true;
            
        } catch (error) {
            console.error("Device error:", error);
            return false;
        }
    }

    getCurrentDeviceId() { return this.currentDeviceId; }
    getCurrentUserId() { return this.currentUserId; }
    
    async updateUserProfile(userName, dob) {
        try {
            const userRef = ref(database, `Users/${this.currentUserId}`);
            const updates = {};
            if (userName && userName.trim() !== "") {
                updates.user_name = userName.trim();
                this.userName = userName.trim();
            }
            if (dob !== undefined) {
                updates.dob = dob;
                this.userDob = dob;
            }
            updates.last_updated = Date.now();
            await update(userRef, updates);
            showNotification('প্রোফাইল আপডেট করা হয়েছে', 'success');
            return true;
        } catch (error) { 
            console.error("Profile update error:", error);
            showNotification('প্রোফাইল আপডেট করতে ব্যর্থ হয়েছে', 'error');
            return false;
        }
    }
    
    cleanup() { 
        console.log("🧹 Device Manager cleaned up");
    }
}

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
    console.log("Auth state changed:", user ? user.email : "No user");
    
    if (user) {
        currentUser = user;
        updateAuthStatus(`✅ স্বাগতম, ${user.email.split('@')[0]}!`);
        
        try {
            deviceManager = new DeviceManager();
            
            const urlParams = new URLSearchParams(window.location.search);
            const userName = urlParams.get('userName') || user.displayName || "";
            const userDob = urlParams.get('dob') || "";
            
            const userData = {
                userName: userName,
                dob: userDob
            };
            
            const success = await deviceManager.initialize(user, userData);
            
            if (success) {
                currentDeviceId = deviceManager.getCurrentDeviceId();
                currentUserId = deviceManager.getCurrentUserId();
                
                window.deviceManager = deviceManager;
                window.currentDeviceId = currentDeviceId;
                window.currentUserId = currentUserId;
                window.currentUserEmail = user.email;
                
                if (typeof setupSettings === 'function') {
                    setupSettings();
                }
                
                setTimeout(() => {
                    hideAuthLoadingScreen();
                    navigateTo("dashboard");
                }, 500);
            } else {
                updateAuthStatus("❌ ইউজার ইনিশিয়ালাইজ করতে ব্যর্থ হয়েছে।", true);
                showNotification("ইউজার ইনিশিয়ালাইজ করতে ব্যর্থ হয়েছে", "error");
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
        } catch (error) {
            console.error("Initialization error:", error);
            updateAuthStatus("❌ সিস্টেম ইনিশিয়ালাইজ করতে ব্যর্থ হয়েছে।", true);
            showNotification("সিস্টেম ইনিশিয়ালাইজ করতে ব্যর্থ হয়েছে: " + error.message, "error");
        }
    } else {
        console.log("User signed out, redirecting to login...");
        setTimeout(() => { 
            window.location.href = "login.html"; 
        }, 1500);
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
            if (deviceManager) deviceManager.cleanup();
            await signOut(auth);
            window.location.href = "login.html";
        }
    });
});

// ==================== CLOCK UPDATE ====================
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById("time");
    const dateEl = document.getElementById("date");
    if (timeEl) timeEl.textContent = now.toLocaleTimeString("bn-BD", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}
setInterval(updateClock, 1000);
updateClock();

if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/Solarcontroller/sw.js');
}

window.addEventListener('online', () => showNotification('ইন্টারনেট সংযোগ পুনরুদ্ধার হয়েছে', 'success'));
window.addEventListener('offline', () => showNotification('ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়েছে', 'error'));

console.log("✅ Solar Smart Controller v11.1.0 initialized - Fixed data structure");