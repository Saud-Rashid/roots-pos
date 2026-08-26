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
let lastSyncStatus = { ok: null, time: null, message: '' };

function getSyncUrl() {
    return localStorage.getItem(STORAGE_KEYS.SYNC_URL) || '';
}

function setSyncUrl(url) {
    localStorage.setItem(STORAGE_KEYS.SYNC_URL, url.trim());
}

function clearSyncUrl() {
    localStorage.removeItem(STORAGE_KEYS.SYNC_URL);
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
        // text/plain avoids a CORS preflight, which Apps Script web apps don't handle
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        lastSyncStatus = { ok: true, time: new Date(), message: 'Synced' };
    } catch (err) {
        lastSyncStatus = { ok: false, time: new Date(), message: err.message };
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
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'appendDailySummary',
                payload: { date: dateStr, totalSales, totalCost, netProfit }
            })
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
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'logOrder',
                payload: { businessDate: getCurrentBusinessDay(), itemName, quantity, price }
            })
        });
    } catch (err) {
        console.warn('Order audit-log sync skipped (offline?):', err.message);
    }
}

async function testSyncConnection(url) {
    try {
        const res = await fetch(url, { method: 'GET' });
        const json = await res.json();
        return { success: true, hasData: !!json.data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
