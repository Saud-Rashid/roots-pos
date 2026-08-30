/* ============================================================
   ROOTS POS — OPTIONAL FREE CLOUD SYNC (Google Sheets)
   ------------------------------------------------------------
   Fully optional. If no sync URL is configured, the app just
   runs on localStorage only (still works perfectly, but data
   stays on this one device/browser).

   Once the admin pastes a Google Apps Script Web App URL
   (see SETUP_GUIDE.md for the 10-minute setup), every change
   is pushed to a private Google Sheet automatically. This is
   permanent, free forever, and works across every device that
   opens this same web app URL — no paid tier, ever.
   ============================================================ */

let syncDebounceTimer = null;
let isSyncing = false;
const LAST_SYNC_TIME_KEY = 'roots_last_cloud_sync_time';
const savedLastSyncTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
let lastSyncStatus = savedLastSyncTime
    ? { ok: true, time: new Date(savedLastSyncTime), message: 'Synced' }
    : { ok: null, time: null, message: '' };

function setSyncStatus(status) {
    lastSyncStatus = status;
    if (status.ok === true && status.time) {
        localStorage.setItem(LAST_SYNC_TIME_KEY, status.time.toISOString());
    }
}

function getSyncUrl() {
    return normalizeSyncUrl(localStorage.getItem(STORAGE_KEYS.SYNC_URL) || '');
}

function setSyncUrl(url) {
    const normalizedUrl = normalizeSyncUrl(url);
    localStorage.setItem(STORAGE_KEYS.SYNC_URL, normalizedUrl);
    return normalizedUrl;
}

function clearSyncUrl() {
    localStorage.removeItem(STORAGE_KEYS.SYNC_URL);
}

function normalizeSyncUrl(url) {
    const cleaned = String(url || '').trim().replace(/\/$/, '');
    const isAppsScriptWebApp = /^https:\/\/script\.google\.com\/macros\/s\//i.test(cleaned);
    if (isAppsScriptWebApp && !/\/(exec|dev)(?:[?#]|$)/i.test(cleaned)) return cleaned + '/exec';
    return cleaned;
}

// Apps Script ContentService redirects its response to a Google-hosted URL.
// A static site cannot reliably read that cross-origin response, but a simple
// no-cors POST is still delivered to the deployed Apps Script web app.
function postToCloud(url, payload) {
    return fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        // This supports deployments restricted to signed-in Google accounts.
        // The POS browser must be logged into an account allowed by the deployment.
        credentials: 'include',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
}

// Debounced push — called automatically whenever data changes (via storage.js's queueCloudSync)
window.__rootsCloudSyncTrigger = function () {
    const url = getSyncUrl();
    if (!url) return;
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => pushStateToCloud(url), 1500);
};

async function pushStateToCloud(url) {
    if (isSyncing) return;
    isSyncing = true;
    try {
        const payload = {
            action: 'saveState',
            payload: {
                menuData,
                salesHistory,
                currentBusinessDay: getCurrentBusinessDay(),
                updatedAt: new Date().toISOString()
            }
        };
        await postToCloud(url, payload);
        setSyncStatus({ ok: true, time: new Date(), message: 'Synced' });
    } catch (err) {
        setSyncStatus({ ok: false, time: new Date(), message: err.message });
    } finally {
        isSyncing = false;
        if (typeof window.__onSyncStatusChange === 'function') window.__onSyncStatusChange(lastSyncStatus);
    }
}

// Pull the latest saved state down from the cloud (used for "Restore from Cloud")
async function pullStateFromCloud() {
    const url = getSyncUrl();
    if (!url) return { success: false, error: 'No sync URL configured' };
    try {
        const res = await fetch(url, { method: 'GET' });
        const json = await res.json();
        if (!json.success || !json.data) return { success: false, error: 'No cloud backup found yet' };
        return { success: true, data: json.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Pushes ONE compact row (date, sales, cost, profit) into the correct monthly
// cycle sheet (10th → 9th, named after the cycle's start month, e.g. "July 2026").
// The Apps Script side upserts by date, so calling this more than once for the
// same date safely overwrites rather than duplicating.
async function pushDailySummaryToCloud(dateStr, totalSales, totalCost, netProfit) {
    const url = getSyncUrl();
    if (!url) return;
    try {
        await postToCloud(url, {
            action: 'appendDailySummary',
            payload: { date: dateStr, totalSales, totalCost, netProfit }
        });
    } catch (err) {
        console.warn('Monthly summary sync skipped (offline?):', err.message);
    }
}

// One-time helper: pushes every day already sitting in local salesHistory up to
// the monthly cloud sheets. Useful the first time cloud sync is turned on, so
// past days aren't left out of the "July 2026"-style sheets.
async function backfillHistoryToCloud(onProgress) {
    const url = getSyncUrl();
    if (!url) return { success: false, error: 'No sync URL configured' };
    const days = [...salesHistory].reverse(); // oldest first, so sheets fill in order
    for (let i = 0; i < days.length; i++) {
        const h = days[i];
        await pushDailySummaryToCloud(h.date, h.totalSales, h.totalCost, h.totalProfit);
        if (typeof onProgress === 'function') onProgress(i + 1, days.length);
        await new Promise(r => setTimeout(r, 300)); // gentle pace, avoids hammering Apps Script
    }
    return { success: true, count: days.length };
}

// Best-effort per-order audit trail row in the "OrderLog" sheet tab (non-blocking, never fails the sale)
async function logOrderToCloud(itemName, quantity, price) {
    const url = getSyncUrl();
    if (!url) return;
    try {
        await postToCloud(url, {
            action: 'logOrder',
            payload: { businessDate: getCurrentBusinessDay(), itemName, quantity, price }
        });
    } catch (err) {
        console.warn('Order audit-log sync skipped (offline?):', err.message);
    }
}

async function testSyncConnection(url) {
    try {
        // A test must send real state, not a no-op ping. This creates/updates
        // the State, Menu, and Sales History tabs in a working deployment.
        await pushStateToCloud(url);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------- Server-Side Password Protection ----------
// Sends only a SHA-256 hash (never the raw password) and lets the Apps Script
// server do the actual comparison + rate-limit tracking — see security.js.
async function verifyPasswordOnServer(url, hash) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verifyPassword', payload: { hash } })
    });
    const json = await res.json();
    if (json.error === 'Unknown action') {
        return { success: false, unsupported: true };
    }
    if (json.lockedOut) {
        const minutesLeft = json.lockUntil
            ? Math.max(1, Math.ceil((new Date(json.lockUntil) - Date.now()) / 60000))
            : LOCKOUT_MINUTES;
        return { success: false, lockedOut: true, minutesLeft };
    }
    return { success: !!json.success, lockedOut: false, unsupported: false };
}

async function setPasswordOnServer(url, hash) {
    await postToCloud(url, { action: 'setPassword', payload: { hash } });
}
