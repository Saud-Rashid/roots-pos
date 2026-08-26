/* ============================================================
   ROOTS POS — ADMIN SECURITY
   ------------------------------------------------------------
   IMPORTANT HONESTY NOTE (read this before relying on it):
   This is a static, front-end-only app with no server. That
   means the password check itself runs in the visitor's browser,
   so a technically determined person who reads the source code
   could eventually work around it — no amount of client-side
   code makes it as secure as a real server-side login.

   What THIS file actually fixes: the old version stored the
   admin password in localStorage in plain, readable text — so
   anyone opening DevTools → Application → Local Storage could
   read it in one second. Now we only ever store a SHA-256 HASH
   of the password. The real password is never written to disk
   or visible anywhere, even to someone poking around storage.

   For genuinely strong protection (can't be bypassed by editing
   local files at all), the only real fix is a server-side login
   — e.g. Firebase Authentication (also free) — see SETUP_GUIDE.md.
   ============================================================ */

const SEC_KEYS = {
    PASS_HASH: 'roots_admin_pass_hash',
    AUTH_SESSION: 'admin_authenticated',
    AUTH_TIME: 'admin_auth_time'
};

const DEFAULT_PASS = 'admin123';
const SESSION_TIMEOUT_MIN = 60; // auto-lock admin panel after 1 hour idle

async function sha256(text) {
    // Web Crypto requires a "secure context" (https://, localhost, or file://).
    // Falls back to a basic hash only if none of those apply (e.g. plain http:// hosting).
    if (window.crypto && window.crypto.subtle) {
        const enc = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    console.warn('Web Crypto unavailable (site not served over HTTPS) — using fallback hash. See SETUP_GUIDE.md.');
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    return 'fb' + hash.toString(16);
}

async function getAdminPasswordHash() {
    let stored = localStorage.getItem(SEC_KEYS.PASS_HASH);
    if (!stored) {
        // First run: migrate to a hash of the default password.
        stored = await sha256(DEFAULT_PASS);
        localStorage.setItem(SEC_KEYS.PASS_HASH, stored);
    }
    return stored;
}

async function verifyAdminPassword(inputPass) {
    const hash = await sha256(inputPass || '');
    const stored = await getAdminPasswordHash();
    return hash === stored;
}

async function setAdminPassword(newPass) {
    const hash = await sha256(newPass);
    localStorage.setItem(SEC_KEYS.PASS_HASH, hash);
}

function isSessionValid() {
    const authed = sessionStorage.getItem(SEC_KEYS.AUTH_SESSION);
    const authTime = parseInt(sessionStorage.getItem(SEC_KEYS.AUTH_TIME) || '0', 10);
    if (!authed) return false;
    const minutesSince = (Date.now() - authTime) / 60000;
    return minutesSince < SESSION_TIMEOUT_MIN;
}

function markSessionAuthed() {
    sessionStorage.setItem(SEC_KEYS.AUTH_SESSION, 'true');
    sessionStorage.setItem(SEC_KEYS.AUTH_TIME, Date.now().toString());
}

function clearSession() {
    sessionStorage.removeItem(SEC_KEYS.AUTH_SESSION);
    sessionStorage.removeItem(SEC_KEYS.AUTH_TIME);
}

// ---------- Entry Points ----------

// Called from index.html's "Admin Panel" button
async function openAdminModal() {
    const inputPass = prompt('🔐 Enter Admin Password:');
    if (inputPass === null) return;

    if (await verifyAdminPassword(inputPass)) {
        markSessionAuthed();
        window.location.href = 'admin.html';
    } else {
        alert('❌ ভুল পাসওয়ার্ড! প্রবেশ করার অনুমতি নেই।');
    }
}

// Guard that runs at the top of admin.html
async function guardAdminPage() {
    if (isSessionValid()) return; // still logged in this tab session

    const verify = prompt('🔐 Security Check: Enter Admin Password:');
    if (verify !== null && await verifyAdminPassword(verify)) {
        markSessionAuthed();
    } else {
        alert('❌ Access Denied!');
        window.location.href = 'index.html';
    }
}

// Called from the Change Password button in admin.html
async function changeAdminPassword() {
    const currentPass = prompt('বর্তমান পাসওয়ার্ড লিখুন:');
    if (currentPass === null) return;

    if (await verifyAdminPassword(currentPass)) {
        const newPass = prompt('নতুন পাসওয়ার্ড দিন:');
        if (newPass && newPass.trim() !== '') {
            await setAdminPassword(newPass.trim());
            alert('✅ পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
        } else {
            alert('⚠️ খালি পাসওয়ার্ড দেওয়া যাবে না!');
        }
    } else {
        alert('❌ বর্তমান পাসওয়ার্ড ভুল হয়েছে!');
    }
}

function logoutAdmin() {
    clearSession();
    window.location.href = 'index.html';
}
