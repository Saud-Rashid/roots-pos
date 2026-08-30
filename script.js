/* ============================================================
   ROOTS POS — MAIN APP LOGIC
   Depends on: storage.js, security.js, (optional) sheets-sync.js
   ============================================================ */

// Global POS State (user panel)
let selectedItem = null;
let quantity = '0';

// ============================================================
// USER PANEL (index.html)
// ============================================================
if (document.getElementById('user-item-grid')) {
    checkAndRunDailyReset();
    renderCategoryBar();
    renderUserMenu();
    renderBusinessDayBadge();
    setInterval(() => {
        if (checkAndRunDailyReset()) {
            renderUserMenu();
            renderBusinessDayBadge();
        }
    }, 30000);
}

function renderBusinessDayBadge() {
    const el = document.getElementById('biz-day-badge');
    if (!el) return;
    el.innerText = `Business Day: ${formatDate(getCurrentBusinessDay())}`;
}

function renderCategoryBar() {
    const bar = document.getElementById('category-bar-container');
    if (!bar) return;
    const cats = getAllCategories();
    const labels = { all: 'All' };
    cats.forEach(c => { if (!labels[c]) labels[c] = c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); });

    let html = `<button class="cat-btn active" onclick="filterCategory('all', this)">All</button>`;
    cats.forEach(c => {
        html += `<button class="cat-btn" onclick="filterCategory('${c}', this)">${labels[c]}</button>`;
    });
    bar.innerHTML = html;
}

function renderUserMenu() {
    const grid = document.getElementById('user-item-grid');
    grid.innerHTML = '';
    if (menuData.length === 0) {
        grid.innerHTML = `<div class="empty-state">এখনো কোনো আইটেম যোগ করা হয়নি। Admin Panel থেকে আইটেম যোগ করুন।</div>`;
        return;
    }
    menuData.forEach(item => {
        grid.innerHTML += `
            <div class="item-card" data-category="${item.category}" onclick="selectItem(this, '${item.id}')">
                <div class="icon-wrapper"><i class="fa-solid fa-glass-water"></i></div>
                <h4>${escapeHTML(item.name)}</h4>
                <span>${escapeHTML(item.category)}</span>
            </div>
        `;
    });
}

function filterCategory(category, btnElement) {
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    document.querySelectorAll('.item-card').forEach(item => {
        item.style.display = (category === 'all' || item.getAttribute('data-category') === category) ? 'block' : 'none';
    });
}

function selectItem(element, id) {
    document.querySelectorAll('.item-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    selectedItem = menuData.find(item => item.id === id);
    document.getElementById('selected-item-label').innerText = `Selected: ${selectedItem.name}`;
    clearDisplay();
    openQuantityScreen();
}

function openQuantityScreen() {
    const screen = document.getElementById('quantity-screen');
    if (!screen) return;
    screen.classList.add('is-open');
    screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('quantity-screen-open');
}

function closeQuantityScreen() {
    const screen = document.getElementById('quantity-screen');
    if (!screen) return;
    screen.classList.remove('is-open');
    screen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('quantity-screen-open');
}

function appendNum(num) {
    quantity = (quantity === '0') ? num : quantity + num;
    updateDisplay();
}

function clearDisplay() { quantity = '0'; updateDisplay(); }
function deleteLast() { quantity = quantity.length > 1 ? quantity.slice(0, -1) : '0'; updateDisplay(); }
function updateDisplay() { document.getElementById('quantity-display').innerText = quantity; }

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeQuantityScreen();
});

function submitOrder() {
    if (!selectedItem) return alert('⚠️ দয়া করে একটি আইটেম সিলেক্ট করুন!');
    if (quantity === '0') return alert('⚠️ কমপক্ষে ১টি গ্লাস সিলেক্ট করুন!');

    // Safety: in case the 6AM cutoff passed while this page was sitting open
    if (checkAndRunDailyReset()) {
        renderUserMenu();
        renderBusinessDayBadge();
        selectedItem = null;
        document.getElementById('selected-item-label').innerText = 'Please Select Item';
        clearDisplay();
        alert('🕕 Business day reset হয়ে গেছে (6:00 AM পার হয়েছে)। আবার আইটেম সিলেক্ট করুন।');
        return;
    }

    const qty = parseInt(quantity);
    selectedItem.sold += qty;
    saveMenu();

    if (typeof logOrderToCloud === 'function') {
        logOrderToCloud(selectedItem.name, qty, selectedItem.price);
    }

    alert(`✅ অর্ডার সফল হয়েছে!\n\n🍹 Item: ${selectedItem.name}\n🥤 Quantity: ${quantity} Glasses`);
    clearDisplay();
    closeQuantityScreen();
}

// ============================================================
// ADMIN PANEL (admin.html)
// ============================================================
if (document.getElementById('admin-menu-table')) {
    initAdminPanel();
}

async function initAdminPanel() {
    await guardAdminPage();
    checkAndRunDailyReset();
    renderDashboard();
    renderAdminTable();
    renderHistoryCalendar();
    loadSyncSettingsUI();

    setInterval(updateResetCountdown, 1000);
    updateResetCountdown();

    setInterval(() => {
        if (checkAndRunDailyReset()) {
            renderDashboard();
            renderAdminTable();
            renderHistoryCalendar();
        }
    }, 30000);
}

// ---------- Tabs ----------
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.getElementById('tabbtn-' + tabName).classList.add('active');
}

// ---------- Dashboard ----------
function renderDashboard() {
    let totalGlasses = 0, totalSales = 0, totalCost = 0;
    menuData.forEach(item => {
        totalGlasses += item.sold;
        totalSales += item.sold * item.price;
        totalCost += item.sold * item.cost;
    });
    document.getElementById('total-glass-count').innerText = totalGlasses;
    document.getElementById('total-sales-amount').innerText = totalSales;
    document.getElementById('total-cost-amount').innerText = totalCost;
    document.getElementById('net-profit-amount').innerText = totalSales - totalCost;

    const bizDayEl = document.getElementById('current-business-day');
    if (bizDayEl) bizDayEl.innerText = formatDate(getCurrentBusinessDay());
}

function updateResetCountdown() {
    const el = document.getElementById('next-reset-countdown');
    if (!el) return;
    const now = new Date();
    const next = getNextResetTime(now);
    const diffMs = next - now;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    el.innerText = `${h}h ${m}m ${s}s`;
}

// ---------- Pricing & Items Tab ----------
function renderAdminTable() {
    const tbody = document.getElementById('admin-menu-table');
    tbody.innerHTML = '';

    menuData.forEach(item => {
        const itemSales = item.sold * item.price;
        const itemCost = item.sold * item.cost;
        const itemProfit = itemSales - itemCost;

        tbody.innerHTML += `
            <tr>
                <td data-label="Name"><input type="text" class="name-input" value="${escapeAttr(item.name)}" onchange="updateMenuItem('${item.id}','name', this.value); renderUserMenuIfOpen();"></td>
                <td data-label="Category"><input type="text" class="cat-input" value="${escapeAttr(item.category)}" onchange="updateMenuItem('${item.id}','category', this.value); renderUserMenuIfOpen(); renderCategoryBarIfOpen();"></td>
                <td data-label="Cost"><input type="number" value="${item.cost}" onchange="updateMenuItem('${item.id}','cost', this.value); renderDashboard(); renderAdminTable();"> TK</td>
                <td data-label="Price"><input type="number" value="${item.price}" onchange="updateMenuItem('${item.id}','price', this.value); renderDashboard(); renderAdminTable();"> TK</td>
                <td data-label="Sold"><span class="badge">${item.sold}</span></td>
                <td data-label="Sales">${itemSales} TK</td>
                <td data-label="Profit" style="color: var(--accent); font-weight: 600;">+${itemProfit} TK</td>
                <td class="no-label"><button class="btn-icon-danger" onclick="handleDeleteItem('${item.id}', '${escapeAttr(item.name)}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });
}

function renderUserMenuIfOpen() { if (document.getElementById('user-item-grid')) renderUserMenu(); }
function renderCategoryBarIfOpen() { if (document.getElementById('category-bar-container')) renderCategoryBar(); }

function handleAddItem() {
    const name = document.getElementById('new-item-name').value.trim();
    const category = document.getElementById('new-item-category').value.trim().toLowerCase().replace(/\s+/g, '-');
    const cost = document.getElementById('new-item-cost').value;
    const price = document.getElementById('new-item-price').value;

    if (!name || !category || !cost || !price) {
        alert('⚠️ সব ফিল্ড পূরণ করুন (Name, Category, Cost, Price)!');
        return;
    }
    addMenuItem({ name, category, cost, price });
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-category').value = '';
    document.getElementById('new-item-cost').value = '';
    document.getElementById('new-item-price').value = '';
    renderAdminTable();
    renderDashboard();
    refreshCategoryDatalist();
    alert(`✅ "${name}" মেনুতে যোগ করা হয়েছে!`);
}

function handleDeleteItem(id, name) {
    if (confirm(`⚠️ "${name}" মেনু থেকে ডিলিট করতে চান? এটি Undo করা যাবে না।`)) {
        deleteMenuItem(id);
        renderAdminTable();
        renderDashboard();
    }
}

function refreshCategoryDatalist() {
    const dl = document.getElementById('category-suggestions');
    if (!dl) return;
    dl.innerHTML = getAllCategories().map(c => `<option value="${c}">`).join('');
}

function resetDayData() {
    if (confirm('⚠️ আপনি কি এখনই ম্যানুয়ালি আজকের সব সেলের ডাটা রিসেট করতে চান?\n\n(মনে রাখবেন: প্রতিদিন সকাল ৬:০০ টায় এটি এমনিতেই automatic reset হয়ে যায় — এই বাটনটি শুধু জরুরি প্রয়োজনে ম্যানুয়াল override এর জন্য।)')) {
        manualResetToday();
        renderAdminTable();
        renderDashboard();
        renderHistoryCalendar();
    }
}

// ---------- Sales History Calendar Tab ----------
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth(); // 0-indexed

function renderHistoryCalendar() {
    const grid = document.getElementById('history-calendar-grid');
    const label = document.getElementById('history-calendar-label');
    if (!grid) return;

    const historyByDate = {};
    salesHistory.forEach(h => { historyByDate[h.date] = h; });

    const firstDay = new Date(calViewYear, calViewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    label.innerText = `${monthNames[calViewMonth]} ${calViewYear}`;

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-weekday">${d}</div>`).join('');
    for (let i = 0; i < startWeekday; i++) html += `<div class="cal-cell empty"></div>`;

    const todayBizDay = getCurrentBusinessDay();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calViewYear}-${String(calViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const entry = historyByDate[dateStr];
        const isToday = dateStr === todayBizDay;
        html += `
            <div class="cal-cell ${entry ? 'has-data' : ''} ${isToday ? 'is-today' : ''}" onclick="${entry ? `showHistoryDetail('${dateStr}')` : ''}">
                <span class="cal-daynum">${d}</span>
                ${entry ? `<span class="cal-sales">${entry.totalSales} TK</span>` : ''}
            </div>
        `;
    }
    grid.innerHTML = html;
}

function changeCalendarMonth(delta) {
    calViewMonth += delta;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    renderHistoryCalendar();
}

function showHistoryDetail(dateStr) {
    const entry = salesHistory.find(h => h.date === dateStr);
    const panel = document.getElementById('history-detail-panel');
    if (!entry || !panel) return;

    let rows = entry.items.filter(i => i.sold > 0).map(i => `
        <tr>
            <td data-label="Item">${escapeHTML(i.name)}</td>
            <td data-label="Sold">${i.sold}</td>
            <td data-label="Sales">${i.sold * i.price} TK</td>
            <td data-label="Profit" style="color: var(--accent);">+${(i.sold * i.price) - (i.sold * i.cost)} TK</td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div class="history-detail-header">
            <h4>${formatDate(dateStr)}</h4>
            <button class="admin-link-btn" onclick="exportHistoryDay('${dateStr}')"><i class="fa-solid fa-file-excel"></i> Export This Day</button>
        </div>
        <div class="stats-grid" style="padding: 15px 0;">
            <div class="stat-card"><i class="fa-solid fa-wine-glass stat-icon"></i><div><h4>Glasses</h4><span>${entry.totalGlasses}</span></div></div>
            <div class="stat-card"><i class="fa-solid fa-sack-dollar stat-icon"></i><div><h4>Sales</h4><span>${entry.totalSales} TK</span></div></div>
            <div class="stat-card"><i class="fa-solid fa-hand-holding-dollar stat-icon"></i><div><h4>Cost</h4><span>${entry.totalCost} TK</span></div></div>
            <div class="stat-card profit-card"><i class="fa-solid fa-chart-pie stat-icon"></i><div><h4>Profit</h4><span>${entry.totalProfit} TK</span></div></div>
        </div>
        <div class="table-responsive">
            <table><thead><tr><th>Item</th><th>Sold</th><th>Sales</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
    `;
    panel.style.display = 'block';
}

function exportHistoryDay(dateStr) {
    const entry = salesHistory.find(h => h.date === dateStr);
    if (!entry) return;
    const excelData = entry.items.map(i => ({
        'Item Name': i.name, 'Category': i.category, 'Cost Price (TK)': i.cost, 'Selling Price (TK)': i.price,
        'Glasses Sold': i.sold, 'Total Sales (TK)': i.sold * i.price, 'Total Cost (TK)': i.sold * i.cost,
        'Net Profit (TK)': (i.sold * i.price) - (i.sold * i.cost)
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, dateStr);
    XLSX.writeFile(workbook, `ROOTS_Sales_${dateStr}.xlsx`);
}

// ---------- Excel Export (today, live) ----------
function exportToExcel() {
    const excelData = menuData.map(item => ({
        'Item Name': item.name, 'Category': item.category, 'Cost Price (TK)': item.cost, 'Selling Price (TK)': item.price,
        'Glasses Sold': item.sold, 'Total Sales (TK)': item.sold * item.price, 'Total Cost (TK)': item.sold * item.cost,
        'Net Profit (TK)': (item.sold * item.price) - (item.sold * item.cost)
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Sales Report');
    XLSX.writeFile(workbook, `ROOTS_Sales_Report_${getCurrentBusinessDay()}.xlsx`);
}

// ---------- Backup & Sync Tab ----------
function handleExportBackup() {
    exportBackupJSON();
}

function handleRestoreFileSelected(input) {
    const file = input.files[0];
    if (!file) return;
    if (!confirm('⚠️ Backup file থেকে restore করলে বর্তমান সব ডাটা replace হয়ে যাবে। আপনি কি নিশ্চিত?')) {
        input.value = '';
        return;
    }
    restoreFromBackupFile(file, (success, err) => {
        if (success) {
            alert('✅ Backup সফলভাবে Restore হয়েছে!');
            renderDashboard();
            renderAdminTable();
            renderHistoryCalendar();
            refreshCategoryDatalist();
        } else {
            alert('❌ Restore ব্যর্থ হয়েছে: ' + err);
        }
        input.value = '';
    });
}

function loadSyncSettingsUI() {
    const input = document.getElementById('sync-url-input');
    if (!input) return;
    input.value = getSyncUrl();
    updateSyncStatusUI();
    window.__onSyncStatusChange = updateSyncStatusUI;
}

function updateSyncStatusUI() {
    const el = document.getElementById('sync-status-text');
    if (!el) return;
    const url = getSyncUrl();
    if (!url) {
        el.innerHTML = `<span class="dot dot-gray"></span> Local Only (cloud sync off)`;
        return;
    }
    if (lastSyncStatus.ok === true) {
        el.innerHTML = `<span class="dot dot-green"></span> Synced ✓ (${lastSyncStatus.time.toLocaleTimeString()})`;
    } else if (lastSyncStatus.ok === false) {
        el.innerHTML = `<span class="dot dot-red"></span> Sync Error: ${escapeHTML(lastSyncStatus.message)}`;
    } else {
        el.innerHTML = `<span class="dot dot-gray"></span> Cloud sync configured, not yet synced`;
    }
}

async function handleSaveSyncUrl() {
    const url = document.getElementById('sync-url-input').value.trim();
    if (!url) {
        clearSyncUrl();
        updateSyncStatusUI();
        alert('☁️ Cloud sync বন্ধ করা হয়েছে। Local storage এ ডাটা থাকবে (password check ও local এ ফিরে যাবে)।');
        return;
    }
    const savedUrl = setSyncUrl(url);
    document.getElementById('sync-url-input').value = savedUrl;
    // Push the current local password hash up so the server becomes the source of truth —
    // otherwise the server's default ("admin123") could mismatch a password already changed locally.
    try {
        const currentHash = await getAdminPasswordHash();
        await setPasswordOnServer(savedUrl, currentHash);
    } catch (err) {
        console.warn('Password not yet pushed to server (will retry on next change):', err.message);
    }
    updateSyncStatusUI();
    alert('✅ Sync URL সেভ হয়েছে! এখন থেকে সব ডাটা cloud এ sync হবে, এবং password check ও server-side (অনেক বেশি secure) হয়ে গেছে।');
    await pushStateToCloud(savedUrl);
    updateSyncStatusUI();
}

async function handleTestSyncConnection() {
    const url = document.getElementById('sync-url-input').value.trim();
    if (!url) return alert('⚠️ আগে একটি Web App URL লিখুন।');
    const statusEl = document.getElementById('sync-status-text');
    statusEl.innerHTML = `<span class="dot dot-gray"></span> Testing...`;
    const result = await testSyncConnection(url);
    if (result.success) {
        alert('✅ Current menu ও sales data sync করার request পাঠানো হয়েছে। Google Sheet refresh করে State, Menu ও Sales History tab দেখুন।');
    } else {
        alert('❌ Connection ব্যর্থ: ' + result.error + '\n\nSETUP_GUIDE.md অনুযায়ী Apps Script deploy করা আছে কিনা check করুন।');
    }
    updateSyncStatusUI();
}

async function handleBackfillHistory() {
    if (!getSyncUrl()) return alert('⚠️ আগে Sync URL সেভ করুন।');
    if (salesHistory.length === 0) return alert('এখনো কোনো পুরনো দিনের history নেই।');
    if (!confirm(`${salesHistory.length}টা দিনের হিসাব মাসিক Sheet-এ পাঠানো হবে। এগোতে চান?`)) return;

    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    const result = await backfillHistoryToCloud((done, total) => {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing ${done}/${total}...`;
    });
    btn.innerHTML = originalText;
    if (result.success) {
        alert(`✅ ${result.count}টা দিনের হিসাব মাসিক Sheet-এ পাঠানো হয়েছে!`);
    } else {
        alert('❌ ' + result.error);
    }
}

async function handlePullFromCloud() {
    if (!confirm('⚠️ Cloud থেকে ডাটা আনলে এই ডিভাইসের বর্তমান ডাটা replace হয়ে যাবে। এগোতে চান?')) return;
    const result = await pullStateFromCloud();
    if (!result.success) {
        alert('❌ ' + result.error);
        return;
    }
    menuData = result.data.menuData || menuData;
    salesHistory = result.data.salesHistory || salesHistory;
    saveMenu();
    saveHistory();
    if (result.data.currentBusinessDay) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_BIZ_DAY, result.data.currentBusinessDay);
    }
    renderDashboard();
    renderAdminTable();
    renderHistoryCalendar();
    alert('✅ Cloud থেকে ডাটা সফলভাবে Restore হয়েছে!');
}

// ---------- Utilities ----------
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
}
