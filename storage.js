/* ============================================================
   ROOTS POS — STORAGE & DAILY RESET ENGINE
   ------------------------------------------------------------
   Business Day Rule:
   A "business day" runs from 6:00 AM to 5:59:59 AM the next
   calendar day. Anything sold in that window belongs to the
   business day that STARTED at that 6:00 AM.

   Example: A sale made at 2:00 AM on Aug 26 belongs to the
   business day "Aug 25" (because Aug 25's 6AM-to-6AM window
   is still open until 6:00 AM on Aug 26).
   ============================================================ */

const RESET_HOUR = 6; // 6:00 AM cutoff — change this single number to shift the reset time

const STORAGE_KEYS = {
    MENU: 'roots_menu',
    HISTORY: 'roots_sales_history',
    CURRENT_BIZ_DAY: 'roots_current_business_day',
    SYNC_URL: 'roots_sheets_sync_url',
    SYNC_LOG: 'roots_pending_sync_queue'
};

const defaultMenu = [
    { id: '1', name: 'Mint Lemonade', category: 'lemonades', cost: 10, price: 30, sold: 0 },
    { id: '2', name: 'Mint Slushy', category: 'lemonades', cost: 15, price: 40, sold: 0 },
    { id: '3', name: 'Pineapple Mint', category: 'lemonades', cost: 20, price: 50, sold: 0 },
    { id: '4', name: 'Strawberry Lemonade', category: 'lemonades', cost: 20, price: 50, sold: 0 },
    { id: '5', name: 'Brazilian Lemonade', category: 'lemonades', cost: 25, price: 60, sold: 0 },
    { id: '6', name: 'Coconut Chiller', category: 'specials', cost: 50, price: 130, sold: 0 },
    { id: '7', name: 'Classic Boba', category: 'specials', cost: 45, price: 120, sold: 0 },
    { id: '8', name: 'Ice Lassi', category: 'lassi-mojito', cost: 20, price: 50, sold: 0 },
    { id: '9', name: 'Blue Lagoon', category: 'lassi-mojito', cost: 30, price: 80, sold: 0 },
    { id: '10', name: 'Vanilla Cream', category: 'coffee-smoothies', cost: 30, price: 70, sold: 0 },
    { id: '11', name: 'Choco Craze', category: 'coffee-smoothies', cost: 32, price: 75, sold: 0 },
    { id: '12', name: 'Oreo Dream', category: 'coffee-smoothies', cost: 35, price: 80, sold: 0 },
    { id: '13', name: 'Kitkat Crunch', category: 'coffee-smoothies', cost: 40, price: 85, sold: 0 },
    { id: '14', name: 'Chocolate Cold Coffee', category: 'coffee-smoothies', cost: 35, price: 80, sold: 0 },
    { id: '15', name: 'Banana Shake', category: 'coffee-smoothies', cost: 20, price: 50, sold: 0 },
    { id: '16', name: 'Fruity Nut Shake', category: 'coffee-smoothies', cost: 45, price: 100, sold: 0 },
    { id: '17', name: 'Dragon Shake', category: 'coffee-smoothies', cost: 35, price: 80, sold: 0 },
    { id: '18', name: 'Orange Juice', category: 'fresh-juice', cost: 25, price: 50, sold: 0 },
    { id: '19', name: 'Watermelon Juice', category: 'fresh-juice', cost: 20, price: 50, sold: 0 }
];

// ---------- Core Load/Save ----------
let menuData = JSON.parse(localStorage.getItem(STORAGE_KEYS.MENU)) || defaultMenu;
let salesHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];

function saveMenu() {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuData));
    queueCloudSync();
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(salesHistory));
    queueCloudSync();
}

// ---------- Business Day Math ----------
// Returns 'YYYY-MM-DD' representing which business day a given moment belongs to.
function getBusinessDateString(d = new Date()) {
    const shifted = new Date(d);
    if (shifted.getHours() < RESET_HOUR) {
        shifted.setDate(shifted.getDate() - 1);
    }
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, '0');
    const day = String(shifted.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Returns the exact Date object for the NEXT upcoming 6:00 AM cutoff.
function getNextResetTime(now = new Date()) {
    const next = new Date(now);
    next.setHours(RESET_HOUR, 0, 0, 0);
    if (now >= next) next.setDate(next.getDate() + 1);
    return next;
}

function getCurrentBusinessDay() {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_BIZ_DAY) || getBusinessDateString();
}

// ---------- Daily Auto-Reset ----------
// Call this on page load AND on an interval. If the business day has rolled
// over since we last checked, archive the old day into history and zero the counters.
function checkAndRunDailyReset() {
    const storedDay = localStorage.getItem(STORAGE_KEYS.CURRENT_BIZ_DAY);
    const todaysBizDay = getBusinessDateString();

    if (storedDay === null) {
        // First ever run on this device — just initialize, nothing to archive.
        localStorage.setItem(STORAGE_KEYS.CURRENT_BIZ_DAY, todaysBizDay);
        return false;
    }

    if (storedDay !== todaysBizDay) {
        archiveBusinessDay(storedDay);
        menuData.forEach(item => item.sold = 0);
        saveMenu();
        localStorage.setItem(STORAGE_KEYS.CURRENT_BIZ_DAY, todaysBizDay);
        return true; // a reset happened
    }
    return false;
}

function archiveBusinessDay(dateStr) {
    // Don't create duplicate/empty entries
    const totalGlasses = menuData.reduce((s, i) => s + i.sold, 0);
    if (totalGlasses === 0) return;

    const items = menuData.map(i => ({
        id: i.id, name: i.name, category: i.category,
        cost: i.cost, price: i.price, sold: i.sold
    }));
    const totalSales = items.reduce((s, i) => s + i.sold * i.price, 0);
    const totalCost = items.reduce((s, i) => s + i.sold * i.cost, 0);

    // Replace an existing entry for the same day if present (safety, shouldn't normally happen)
    salesHistory = salesHistory.filter(h => h.date !== dateStr);
    salesHistory.unshift({
        date: dateStr,
        items,
        totalGlasses,
        totalSales,
        totalCost,
        totalProfit: totalSales - totalCost,
        archivedAt: new Date().toISOString()
    });
    saveHistory();

    // Push the compact one-line summary (date, sales, cost, profit) to the
    // monthly cloud sheet, if cloud sync is configured (see sheets-sync.js).
    if (typeof pushDailySummaryToCloud === 'function') {
        pushDailySummaryToCloud(dateStr, totalSales, totalCost, totalSales - totalCost);
    }
}

// ---------- Manual Override Reset (kept for admin convenience) ----------
function manualResetToday() {
    const today = getBusinessDateString();
    archiveBusinessDay(today);
    menuData.forEach(item => item.sold = 0);
    saveMenu();
    localStorage.setItem(STORAGE_KEYS.CURRENT_BIZ_DAY, today);
}

// ---------- Item Management ----------
function addMenuItem({ name, category, cost, price }) {
    const id = 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    menuData.push({ id, name, category, cost: parseFloat(cost) || 0, price: parseFloat(price) || 0, sold: 0 });
    saveMenu();
}

function deleteMenuItem(id) {
    menuData = menuData.filter(i => i.id !== id);
    saveMenu();
}

function updateMenuItem(id, field, value) {
    const item = menuData.find(i => i.id === id);
    if (!item) return;
    if (field === 'cost' || field === 'price') item[field] = parseFloat(value) || 0;
    else item[field] = value;
    saveMenu();
}

function getAllCategories() {
    return [...new Set(menuData.map(i => i.category))];
}

// ---------- Backup / Restore ----------
function exportBackupJSON() {
    const backup = {
        exportedAt: new Date().toISOString(),
        app: 'ROOTS_POS',
        version: 1,
        menuData,
        salesHistory,
        currentBusinessDay: getCurrentBusinessDay()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROOTS_Backup_${getBusinessDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function restoreFromBackupFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.menuData) throw new Error('Invalid backup file');
            menuData = data.menuData;
            salesHistory = data.salesHistory || [];
            saveMenu();
            saveHistory();
            if (data.currentBusinessDay) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_BIZ_DAY, data.currentBusinessDay);
            }
            onDone(true);
        } catch (err) {
            onDone(false, err.message);
        }
    };
    reader.readAsText(file);
}

// Cloud sync hook — implemented in sheets-sync.js if that file is loaded.
function queueCloudSync() {
    if (typeof window.__rootsCloudSyncTrigger === 'function') {
        window.__rootsCloudSyncTrigger();
    }
}