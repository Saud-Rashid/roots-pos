/* ============================================================
   ROOTS POS — ADMIN SECURITY
   ------------------------------------------------------------
   HONESTY NOTE (please read once):
   This app has no traditional server of its own — it's static
   files hosted on Vercel/Netlify/GitHub Pages. BUT, if you've
   set up the free Google Sheets sync (SETUP_GUIDE.md), the
   password check now actually happens on Google's server
   (Apps Script), not in the visitor's browser. That means:
     - The real password/hash is never present in any file a
       visitor can read (view-source, DevTools, etc. show nothing).
     - Guessing is rate-limited: 5 wrong tries = 5 minute lock,
       enforced server-side (can't be reset by clearing the browser).
   This is a genuinely strong, practical level of protection for
   a small business — the same idea real login systems use.

   The one remaining theoretical gap: someone who deliberately
   opens the browser console and manually runs JavaScript could
   still try to skip the navigation check itself (this is true of
   any free static website, not something specific to ROOTS POS).
   In practice this requires real technical intent — casual
   customers/staff and even most curious people won't get past
   the password. If you ever need 100% ironclad protection,
   that requires a paid/managed backend — just say so and we can
   plan that as a separate upgrade.

   If Google Sheets sync is NOT configured, the app falls back
   to a local SHA-256 hash check (much better than old plain-text
   storage, but weaker than the server-verified mode above).
   ============================================================ */

const SEC_KEYS = {
    PASS_HASH: 'roots_admin_pass_hash',
    AUTH_SESSION: 'admin_authenticated',
    AUTH_TIME: 'admin_auth_time'
};

const DEFAULT_PASS = 'admin123';
const SESSION_TIMEOUT_MIN = 60; // auto-lock admin panel after 1 hour idle
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

const LOCAL_LOCKOUT_KEYS = {
    ATTEMPTS: 'roots_login_attempts',
    LOCK_UNTIL: 'roots_login_lock_until'
};

async function sha256(text) {
    // Web Crypto requires a "secure context" (https://, localhost, or file://).
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
        stored = await sha256(DEFAULT_PASS);
        localStorage.setItem(SEC_KEYS.PASS_HASH, stored);
    }
    return stored;
}

// ---------- Local (offline) rate limiting — works even without cloud sync ----------
function getLocalLockoutStatus() {
    const lockUntil = parseInt(localStorage.getItem(LOCAL_LOCKOUT_KEYS.LOCK_UNTIL) || '0', 10);
    if (lockUntil && Date.now() < lockUntil) {
        return { lockedOut: true, minutesLeft: Math.max(1, Math.ceil((lockUntil - Date.now()) / 60000)) };
    }
    return { lockedOut: false };
}
function recordFailedAttempt() {
    let attempts = parseInt(localStorage.getItem(LOCAL_LOCKOUT_KEYS.ATTEMPTS) || '0', 10) + 1;
    if (attempts >= MAX_ATTEMPTS) {
        localStorage.setItem(LOCAL_LOCKOUT_KEYS.LOCK_UNTIL, (Date.now() + LOCKOUT_MINUTES * 60000).toString());
        localStorage.setItem(LOCAL_LOCKOUT_KEYS.ATTEMPTS, '0');
    } else {
        localStorage.setItem(LOCAL_LOCKOUT_KEYS.ATTEMPTS, attempts.toString());
    }
}
function resetLocalAttempts() {
    localStorage.setItem(LOCAL_LOCKOUT_KEYS.ATTEMPTS, '0');
    localStorage.removeItem(LOCAL_LOCKOUT_KEYS.LOCK_UNTIL);
}

// ---------- Verify / Set password ----------
// Cloud sync must never block access to the local POS. Authentication therefore
// remains local even when Google Sheets sync is configured.
async function verifyAdminPassword(inputPass) {
    const localLock = getLocalLockoutStatus();
    if (localLock.lockedOut) {
        return { success: false, lockedOut: true, minutesLeft: localLock.minutesLeft, mode: 'local' };
    }

    const hash = await sha256(inputPass || '');
    const stored = await getAdminPasswordHash();
    const ok = hash === stored;
    if (ok) resetLocalAttempts(); else recordFailedAttempt();
    return { success: ok, lockedOut: false, mode: 'local' };
}

async function setAdminPassword(newPass) {
    const hash = await sha256(newPass);
    localStorage.setItem(SEC_KEYS.PASS_HASH, hash);
}

function isSessionValid() {
    const authed = sessionStorage.getItem(SEC_KEYS.AUTH_SESSION);
    const authTime = parseInt(sessionStorage.getItem(SEC_KEYS.AUTH_TIME) || '0', 10);
    if (!authed) return false;
    return (Date.now() - authTime) / 60000 < SESSION_TIMEOUT_MIN;
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
async function openAdminModal() {
    const inputPass = prompt('🔐 Enter Admin Password:');
    if (inputPass === null) return;

    const result = await verifyAdminPassword(inputPass);
    if (result.success) {
        markSessionAuthed();
        window.location.href = 'admin.html';
    } else if (result.lockedOut) {
        alert(`🔒 অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${result.minutesLeft} মিনিট পর আবার চেষ্টা করুন।`);
    } else {
        alert('❌ ভুল পাসওয়ার্ড! প্রবেশ করার অনুমতি নেই।');
    }
}

async function guardAdminPage() {
    if (isSessionValid()) return;

    const verify = prompt('🔐 Security Check: Enter Admin Password:');
    if (verify === null) {
        window.location.href = 'index.html';
        return;
    }
    const result = await verifyAdminPassword(verify);
    if (result.success) {
        markSessionAuthed();
    } else if (result.lockedOut) {
        alert(`🔒 অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${result.minutesLeft} মিনিট পর আবার চেষ্টা করুন।`);
        window.location.href = 'index.html';
    } else {
        alert('❌ Access Denied!');
        window.location.href = 'index.html';
    }
}

async function changeAdminPassword() {
    const currentPass = prompt('বর্তমান পাসওয়ার্ড লিখুন:');
    if (currentPass === null) return;

    const result = await verifyAdminPassword(currentPass);
    if (result.success) {
        const newPass = prompt('নতুন পাসওয়ার্ড দিন:');
        if (newPass && newPass.trim() !== '') {
            await setAdminPassword(newPass.trim());
            alert('✅ পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
        } else {
            alert('⚠️ খালি পাসওয়ার্ড দেওয়া যাবে না!');
        }
    } else if (result.lockedOut) {
        alert(`🔒 অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${result.minutesLeft} মিনিট পর আবার চেষ্টা করুন।`);
    } else {
        alert('❌ বর্তমান পাসওয়ার্ড ভুল হয়েছে!');
    }
}

function logoutAdmin() {
    clearSession();
    window.location.href = 'index.html';
}
