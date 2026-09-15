// js/profile.js - শুধু JavaScript (CSS style.css এ থাকবে)

import { updatePassword, updateProfile, sendEmailVerification, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { ref, get, update } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

// ==================== প্রোফাইল লোড ====================
export async function loadProfile() {
    const content = document.getElementById("content");
    if (!content) return;
    
    const currentUser = window.currentUser;
    const currentUserId = window.currentUserId;
    const currentDeviceId = window.currentDeviceId;
    const database = window.database;
    
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }
    
    content.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    
    try {
        let userData = {};
        
        if (database && currentUserId) {
            const userRef = ref(database, `Users/${currentUserId}`);
            const userSnapshot = await get(userRef);
            if (userSnapshot.exists()) userData = userSnapshot.val();
        }
        
        renderProfile(content, currentUser, currentUserId, currentDeviceId, userData);
        setupProfileEventListeners(currentUser, currentUserId, currentDeviceId, userData);
        
    } catch (error) {
        console.error("Error loading profile:", error);
        content.innerHTML = `<div class="error-card"><i class="fas fa-exclamation-triangle"></i><p>প্রোফাইল লোড করতে ব্যর্থ হয়েছে: ${error.message}</p><button onclick="location.reload()">পুনরায় চেষ্টা করুন</button></div>`;
    }
}

// ==================== প্রোফাইল রেন্ডার ====================
function renderProfile(content, currentUser, currentUserId, currentDeviceId, userData) {
    const email = currentUser.email || "";
    const emailVerified = currentUser.emailVerified;
    const userName = userData.user_name || currentUser.displayName || email.split('@')[0];
    const userDob = userData.dob || "";
    const createdAt = userData.created_at ? new Date(userData.created_at).toLocaleString("bn-BD") : "অজানা";
    
    content.innerHTML = `
        <div class="profile-container">
            <div class="profile-card">
                
                <div class="info-section">
                    <div class="section-label">ইমেইল</div>
                    <div class="section-value">${escapeHtml(email)}</div>
                </div>
                
                <div class="info-section">
                    <div class="section-label">নাম</div>
                    <div class="section-value" id="displayName">${escapeHtml(userName)}</div>
                    <button class="edit-link" id="editNameBtn">নাম পরিবর্তন</button>
                </div>
                
                <div class="info-section">
                    <div class="section-label">জন্ম তারিখ</div>
                    <div class="section-value" id="displayDob">${userDob || "সেট করা নেই"}</div>
                    <button class="edit-link" id="editDobBtn">জন্ম তারিখ পরিবর্তন</button>
                </div>
                
                <div class="info-section">
                    <div class="section-label">ইউজার আইডি</div>
                    <div class="section-value user-id">${escapeHtml(currentUserId || "N/A")}</div>
                </div>
                
                <div class="info-section">
                    <div class="section-label">ডিভাইস আইডি</div>
                    <div class="section-value device-id">${escapeHtml(currentDeviceId || "N/A")}</div>
                </div>
                
                <div class="info-section">
                    <div class="section-label">অ্যাকাউন্ট তৈরি</div>
                    <div class="section-value">${createdAt}</div>
                </div>
                
                <div class="info-section">
                    <div class="section-label">ইমেইল ভেরিফাইড</div>
                    <div class="section-value">
                        ${emailVerified ? '<span class="verified">✓ হ্যাঁ</span>' : '<span class="not-verified">✖ না</span>'}
                    </div>
                    ${!emailVerified ? '<button class="verify-link" id="sendVerifyEmailBtn">ভেরিফিকেশন ইমেইল পাঠান</button>' : ''}
                </div>
                
                <div class="password-section">
                    <button class="password-btn" id="changePasswordBtn">
                        <i class="fas fa-key"></i> পাসওয়ার্ড পরিবর্তন করুন
                    </button>
                </div>
                
            </div>
        </div>
        
        <!-- নাম পরিবর্তন মোডাল -->
        <div id="editNameModal" class="modal">
            <div class="modal-content">
                <h3><i class="fas fa-edit"></i> নাম পরিবর্তন</h3>
                <input type="text" id="editName" placeholder="আপনার নতুন নাম" value="${escapeHtml(userName)}">
                <div class="modal-buttons">
                    <button class="save-btn" id="saveNameBtn">সংরক্ষণ</button>
                    <button class="cancel-btn" id="cancelNameBtn">বাতিল</button>
                </div>
            </div>
        </div>
        
        <!-- জন্ম তারিখ পরিবর্তন মোডাল -->
        <div id="editDobModal" class="modal">
            <div class="modal-content">
                <h3><i class="fas fa-calendar-alt"></i> জন্ম তারিখ পরিবর্তন</h3>
                <input type="date" id="editDob" value="${userDob}">
                <div class="modal-buttons">
                    <button class="save-btn" id="saveDobBtn">সংরক্ষণ</button>
                    <button class="cancel-btn" id="cancelDobBtn">বাতিল</button>
                </div>
            </div>
        </div>
        
        <!-- পাসওয়ার্ড পরিবর্তন মোডাল -->
        <div id="passwordModal" class="modal">
            <div class="modal-content">
                <h3><i class="fas fa-key"></i> পাসওয়ার্ড পরিবর্তন</h3>
                <input type="password" id="currentPassword" placeholder="বর্তমান পাসওয়ার্ড">
                <input type="password" id="newPassword" placeholder="নতুন পাসওয়ার্ড">
                <input type="password" id="confirmPassword" placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন">
                <div class="modal-buttons">
                    <button class="save-btn" id="savePasswordBtn">আপডেট</button>
                    <button class="cancel-btn" id="cancelPasswordBtn">বাতিল</button>
                </div>
            </div>
        </div>
    `;
}

// ==================== ইভেন্ট লিসেনার ====================
function setupProfileEventListeners(currentUser, currentUserId, currentDeviceId, userData) {
    // নাম পরিবর্তন
    const editNameBtn = document.getElementById("editNameBtn");
    const editNameModal = document.getElementById("editNameModal");
    const cancelNameBtn = document.getElementById("cancelNameBtn");
    const saveNameBtn = document.getElementById("saveNameBtn");
    
    if (editNameBtn) {
        editNameBtn.onclick = () => { if (editNameModal) editNameModal.style.display = "flex"; };
    }
    if (cancelNameBtn) {
        cancelNameBtn.onclick = () => { if (editNameModal) editNameModal.style.display = "none"; };
    }
    if (saveNameBtn) {
        saveNameBtn.onclick = async () => {
            const newName = document.getElementById("editName")?.value;
            if (newName && newName.trim()) {
                await updateUserName(currentUser, currentUserId, newName.trim());
            }
            if (editNameModal) editNameModal.style.display = "none";
        };
    }
    
    // জন্ম তারিখ পরিবর্তন
    const editDobBtn = document.getElementById("editDobBtn");
    const editDobModal = document.getElementById("editDobModal");
    const cancelDobBtn = document.getElementById("cancelDobBtn");
    const saveDobBtn = document.getElementById("saveDobBtn");
    
    if (editDobBtn) {
        editDobBtn.onclick = () => { if (editDobModal) editDobModal.style.display = "flex"; };
    }
    if (cancelDobBtn) {
        cancelDobBtn.onclick = () => { if (editDobModal) editDobModal.style.display = "none"; };
    }
    if (saveDobBtn) {
        saveDobBtn.onclick = async () => {
            const newDob = document.getElementById("editDob")?.value;
            await updateUserDob(currentUserId, newDob);
            if (editDobModal) editDobModal.style.display = "none";
        };
    }
    
    // ইমেইল ভেরিফিকেশন
    const sendVerifyBtn = document.getElementById("sendVerifyEmailBtn");
    if (sendVerifyBtn) {
        sendVerifyBtn.onclick = async () => {
            await sendVerificationEmail(currentUser);
        };
    }
    
    // পাসওয়ার্ড পরিবর্তন
    const passwordBtn = document.getElementById("changePasswordBtn");
    const passwordModal = document.getElementById("passwordModal");
    const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
    const savePasswordBtn = document.getElementById("savePasswordBtn");
    
    if (passwordBtn) {
        passwordBtn.onclick = () => { if (passwordModal) passwordModal.style.display = "flex"; };
    }
    if (cancelPasswordBtn) {
        cancelPasswordBtn.onclick = () => {
            if (passwordModal) passwordModal.style.display = "none";
            clearPasswordFields();
        };
    }
    if (savePasswordBtn) {
        savePasswordBtn.onclick = async () => {
            const currentPassword = document.getElementById("currentPassword")?.value;
            const newPassword = document.getElementById("newPassword")?.value;
            const confirmPassword = document.getElementById("confirmPassword")?.value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                window.showNotification("সব ফিল্ড পূরণ করুন!", "error");
                return;
            }
            if (newPassword !== confirmPassword) {
                window.showNotification("নতুন পাসওয়ার্ড মেলে না!", "error");
                return;
            }
            if (newPassword.length < 6) {
                window.showNotification("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!", "error");
                return;
            }
            
            await changeUserPassword(currentUser, currentPassword, newPassword);
            if (passwordModal) passwordModal.style.display = "none";
            clearPasswordFields();
        };
    }
    
    // মোডালের বাইরে ক্লিক বন্ধ
    window.onclick = (event) => {
        const modals = ["editNameModal", "editDobModal", "passwordModal"];
        modals.forEach(id => {
            const modal = document.getElementById(id);
            if (event.target === modal && modal) modal.style.display = "none";
        });
    };
}

// ==================== নাম আপডেট ====================
async function updateUserName(currentUser, currentUserId, newName) {
    try {
        if (currentUser && newName) {
            await updateProfile(currentUser, { displayName: newName });
        }
        
        if (window.database && currentUserId) {
            await update(ref(window.database, `Users/${currentUserId}`), {
                user_name: newName,
                last_updated: Date.now()
            });
            
            if (window.deviceManager) {
                await window.deviceManager.updateUserProfile(newName, null);
            }
            
            window.showNotification("নাম আপডেট হয়েছে!", "success");
            
            const displayName = document.getElementById("displayName");
            if (displayName) displayName.textContent = newName;
            
            window.userName = newName;
        }
    } catch (error) {
        window.showNotification(`ত্রুটি: ${error.message}`, "error");
    }
}

// ==================== জন্ম তারিখ আপডেট ====================
async function updateUserDob(currentUserId, newDob) {
    try {
        if (window.database && currentUserId) {
            await update(ref(window.database, `Users/${currentUserId}`), {
                dob: newDob,
                last_updated: Date.now()
            });
            
            window.showNotification("জন্ম তারিখ আপডেট হয়েছে!", "success");
            
            const displayDob = document.getElementById("displayDob");
            if (displayDob) displayDob.textContent = newDob || "সেট করা নেই";
        }
    } catch (error) {
        window.showNotification(`ত্রুটি: ${error.message}`, "error");
    }
}

// ==================== ভেরিফিকেশন ইমেইল পাঠান ====================
async function sendVerificationEmail(currentUser) {
    try {
        await sendEmailVerification(currentUser);
        window.showNotification("ভেরিফিকেশন ইমেইল পাঠানো হয়েছে! আপনার ইমেইল চেক করুন।", "success");
    } catch (error) {
        console.error("Error sending verification:", error);
        let errorMessage = "ভেরিফিকেশন ইমেইল পাঠাতে ব্যর্থ হয়েছে!";
        if (error.code === 'auth/too-many-requests') {
            errorMessage = "অনেকবার চেষ্টা করেছেন। কিছুক্ষণ পর আবার চেষ্টা করুন।";
        }
        window.showNotification(errorMessage, "error");
    }
}

// ==================== পাসওয়ার্ড পরিবর্তন ====================
async function changeUserPassword(currentUser, currentPassword, newPassword) {
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        window.showNotification("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!", "success");
        
        setTimeout(async () => {
            window.showNotification("দয়া করে নতুন পাসওয়ার্ড দিয়ে আবার লগইন করুন", "warning");
            if (window.signOut) await window.signOut(window.auth);
            window.location.href = "login.html";
        }, 3000);
    } catch (error) {
        let errorMessage = "পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ হয়েছে!";
        if (error.code === 'auth/wrong-password') errorMessage = "বর্তমান পাসওয়ার্ড ভুল!";
        else if (error.code === 'auth/weak-password') errorMessage = "পাসওয়ার্ড খুব সহজ! কমপক্ষে ৬ অক্ষর দিন।";
        else if (error.code === 'auth/requires-recent-login') errorMessage = "দয়া করে পুনরায় লগইন করে আবার চেষ্টা করুন।";
        window.showNotification(errorMessage, "error");
    }
}

function clearPasswordFields() {
    const fields = ["currentPassword", "newPassword", "confirmPassword"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}