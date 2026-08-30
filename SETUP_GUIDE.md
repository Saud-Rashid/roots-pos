# ROOTS POS — Setup & Feature Guide

সম্পূর্ণ **Free of Cost**। কোথাও কোনো payment বা credit card লাগবে না।

---

## ১. App চালু করবেন কীভাবে

সবচেয়ে সহজ: `index.html` ফাইলে ডাবল-ক্লিক করলেই ব্রাউজারে খুলে যাবে। কাজ করার জন্য কোনো internet বা server লাগবে না (Google Sheets sync চালু না করলে)।

**সব ডিভাইস থেকে access করতে চাইলে** (মোবাইল, ল্যাপটপ, একাধিক কাউন্টার) — ফ্রি তে হোস্ট করুন:
- [GitHub Pages](https://pages.github.com/) — সম্পূর্ণ ফ্রি, কখনো টাকা লাগে না, নিজের একটা ওয়েবসাইট লিংক পাবেন (যেমন `yourname.github.io/roots-pos`)।
- চারটা ফাইল (`index.html`, `admin.html`, `style.css`, `script.js`, `storage.js`, `security.js`, `sheets-sync.js`) একটা GitHub repository তে আপলোড করে Settings → Pages থেকে চালু করলেই হয়ে যাবে।

---

## ২. Daily Auto-Reset System (6:00 AM cutoff)

- প্রতিদিন **সকাল ৬:০০ টায়** আগের দিনের বিক্রির ডাটা automatic **History**-তে জমা হয়ে যাবে এবং counter নতুন করে ০ থেকে শুরু হবে।
- অর্থাৎ Business Day চলে **আজ সকাল ৬টা থেকে পরদিন সকাল ৫:৫৯টা** পর্যন্ত (রাত ১২টায় reset হয় না — এটা রেস্টুরেন্ট/শপ এর real business day অনুযায়ী)।
- Reset হওয়ার জন্য পেজ খোলা রাখা লাগবে না — যখনই কেউ পরের দিন পেজ ওপেন করবে বা Admin Panel-এ ঢুকবে, app নিজে থেকেই check করে reset করে নেবে। আবার পেজ যদি সারারাত খোলা থাকে, প্রতি ৩০ সেকেন্ডে check হয়, তাই সকাল ৬টার সাথে সাথেই reset হয়ে যাবে।
- Reset হওয়ার সময়টা বদলাতে চাইলে `storage.js` ফাইলের শুরুতে `RESET_HOUR = 6` লাইনটা বদলে দিলেই হবে (যেমন 7 করলে সকাল ৭টায় reset হবে)।
- **Dashboard ট্যাবে** সবসময় দেখা যাবে এখন কোন Business Day চলছে, এবং পরের reset হতে কত সময় বাকি (live countdown)।
- জরুরি প্রয়োজনে **Pricing & Items ট্যাবের "Manual Reset Override"** বাটন দিয়ে হাতে করেও যেকোনো সময় reset করা যাবে।

---

## ৩. Security — সৎ কথা (Honest Note)

আগে পাসওয়ার্ড plain text এ localStorage-এ থাকত — DevTools খুলে ১ সেকেন্ডে দেখা যেত। এখন **SHA-256 hash** আকারে থাকে, তাই DevTools/Inspect দিয়ে আসল পাসওয়ার্ড আর সরাসরি দেখা যাবে না।

**কিন্তু সত্যি কথা**: এটা একটা static front-end app (কোনো server নেই), তাই client-side এ যেকোনো password protection-ই একজন খুবই দক্ষ/ইচ্ছুক ব্যক্তি টেকনিক্যালি bypass করার চেষ্টা করতে পারে (এটা এই ধরনের যেকোনো ফ্রি static app-এর সীমাবদ্ধতা, ROOTS POS-এর নির্দিষ্ট সমস্যা না)। এটাকে "সম্পূর্ণ অভেদ্য" বানাতে হলে সত্যিকারের server-side login লাগবে (যেমন Firebase Authentication — এটাও ফ্রি, কিন্তু আলাদা একটা বড় কাজ, দরকার হলে বলবেন করে দিব)।

**যা এখন আছে (যথেষ্ট practical protection)**:
- Password কোথাও plain text এ save হয় না
- ৬০ মিনিট inactive থাকলে auto-logout (session expire)
- Change Password ফিচার — Backup & Sync ট্যাবে

---

## ৪. Permanent Data Storage — কীভাবে কাজ করে

তিন স্তরের protection, সবগুলোই free:

1. **Browser Storage (সবসময় সক্রিয়)** — প্রতিটা sale/change সাথে সাথেই এই ডিভাইসে সেভ হয়। কয়েক বছরের ডাটা রাখার মতো জায়গা যথেষ্ট আছে।
2. **Local JSON Backup (recommended, weekly)** — Backup & Sync ট্যাব থেকে এক ক্লিকে পুরো ডাটার একটা `.json` ফাইল ডাউনলোড হবে। এই ফাইল Google Drive/Pendrive এ রেখে দিলে ডিভাইস হারিয়ে গেলেও/নষ্ট হলেও ডাটা ফেরত আনা যাবে (Restore বাটন দিয়ে)।
3. **Google Sheets Cloud Sync (optional কিন্তু recommended)** — সব ডিভাইসে auto-sync হবে, এবং এটা **কোনোদিন paid হবে না** (নিচে ধাপ ৫ দেখুন)। এটাই Firebase-এর মতো "একটা সময় পর টাকা লাগবে" সমস্যাটার সমাধান — Google Sheets/Apps Script ছোট ব্যবসার এই পরিমাণ ডাটার জন্য চিরকাল ফ্রি, কোনো billing account লাগেই না।

---

## ৫. Google Sheets Cloud Sync — Setup (একবারই করতে হবে, ~১০ মিনিট)

### ধাপ ১: একটা নতুন Google Sheet বানান
[sheets.google.com](https://sheets.google.com) এ গিয়ে নতুন একটা blank spreadsheet খুলুন। নাম দিন যেমন "ROOTS POS Data"।

### ধাপ ২: Apps Script খুলুন
Sheet-এর মধ্যে উপরে **Extensions → Apps Script** এ ক্লিক করুন। একটা নতুন ট্যাব খুলবে, `Code.gs` নামের একটা খালি ফাইল থাকবে — ভিতরের সব কোড মুছে নিচের কোডটা পুরোটা paste করে দিন:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Server-side admin password storage and rate limiting.
    if (data.action === 'setPassword') {
      var newHash = data.payload && data.payload.hash;
      if (!newHash) return jsonOut({ success: false, error: 'Password hash missing' });
      var props = PropertiesService.getScriptProperties();
      props.setProperty('roots_admin_pass_hash', newHash);
      props.deleteProperty('roots_admin_login_attempts');
      props.deleteProperty('roots_admin_lock_until');
      return jsonOut({ success: true });
    }

    if (data.action === 'verifyPassword') {
      var props = PropertiesService.getScriptProperties();
      var lockUntil = parseInt(props.getProperty('roots_admin_lock_until') || '0', 10);
      if (lockUntil && Date.now() < lockUntil) {
        return jsonOut({ success: false, lockedOut: true, lockUntil: lockUntil });
      }

      var storedHash = props.getProperty('roots_admin_pass_hash');
      var isCorrect = !!storedHash && data.payload && data.payload.hash === storedHash;
      if (isCorrect) {
        props.deleteProperty('roots_admin_login_attempts');
        props.deleteProperty('roots_admin_lock_until');
        return jsonOut({ success: true });
      }

      var attempts = parseInt(props.getProperty('roots_admin_login_attempts') || '0', 10) + 1;
      if (attempts >= 5) {
        var newLockUntil = Date.now() + (5 * 60 * 1000);
        props.setProperty('roots_admin_lock_until', String(newLockUntil));
        props.deleteProperty('roots_admin_login_attempts');
        return jsonOut({ success: false, lockedOut: true, lockUntil: newLockUntil });
      }
      props.setProperty('roots_admin_login_attempts', String(attempts));
      return jsonOut({ success: false });
    }

    if (data.action === 'saveState') {
      var sheet = ss.getSheetByName('State') || ss.insertSheet('State');
      sheet.getRange(1, 1).setValue(JSON.stringify(data.payload));
      sheet.getRange(1, 2).setValue(new Date().toISOString());
      return jsonOut({ success: true });
    }

    if (data.action === 'logOrder') {
      var log = ss.getSheetByName('OrderLog') || ss.insertSheet('OrderLog');
      if (log.getLastRow() === 0) {
        log.appendRow(['Timestamp', 'Business Date', 'Item', 'Quantity', 'Price', 'Total']);
      }
      log.appendRow([
        new Date().toISOString(),
        data.payload.businessDate,
        data.payload.itemName,
        data.payload.quantity,
        data.payload.price,
        data.payload.quantity * data.payload.price
      ]);
      return jsonOut({ success: true });
    }

    // One compact row per business day: Date | Total Sales | Total Making Cost | Net Profit
    // Grouped into monthly cycles running the 10th of a month through the 9th of
    // the next, in a sheet tab named after the cycle's starting month (e.g. "July 2026").
    if (data.action === 'appendDailySummary') {
      var p = data.payload; // { date: 'YYYY-MM-DD', totalSales, totalCost, netProfit }
      var sheetName = getCycleSheetName(p.date);
      var sumSheet = ss.getSheetByName(sheetName);
      if (!sumSheet) {
        sumSheet = ss.insertSheet(sheetName);
        sumSheet.appendRow(['Date', 'Total Sales (TK)', 'Total Making Cost (TK)', 'Net Profit (TK)']);
        sumSheet.setFrozenRows(1);
      }

      // Upsert by date — if this date's row already exists (e.g. a manual reset
      // ran twice), overwrite it instead of creating a duplicate row.
      var lastRow = sumSheet.getLastRow();
      var rowIndex = -1;
      if (lastRow > 1) {
        var existingDates = sumSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < existingDates.length; i++) {
          if (existingDates[i][0] === p.date) { rowIndex = i + 2; break; }
        }
      }
      var rowValues = [p.date, p.totalSales, p.totalCost, p.netProfit];
      if (rowIndex > 0) {
        sumSheet.getRange(rowIndex, 1, 1, 4).setValues([rowValues]);
      } else {
        sumSheet.appendRow(rowValues);
      }
      return jsonOut({ success: true, sheet: sheetName });
    }

    return jsonOut({ success: false, error: 'Unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('State');
  if (!sheet || sheet.getLastRow() === 0) {
    return jsonOut({ success: true, data: null });
  }
  var json = sheet.getRange(1, 1).getValue();
  return jsonOut({ success: true, data: json ? JSON.parse(json) : null });
}

// A date from the 10th onward belongs to that month's cycle sheet.
// A date from the 1st–9th belongs to the PREVIOUS month's cycle sheet
// (since that cycle started on the 10th of the previous month).
function getCycleSheetName(dateStr) {
  var parts = dateStr.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10); // 1-12
  var day = parseInt(parts[2], 10);

  var cycleMonth = month;
  var cycleYear = year;
  if (day < 10) {
    cycleMonth -= 1;
    if (cycleMonth < 1) { cycleMonth = 12; cycleYear -= 1; }
  }
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return monthNames[cycleMonth - 1] + ' ' + cycleYear;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

উপরে বাম দিকে project-এর নাম দিয়ে **Save** করুন (Ctrl+S / ফ্লপি আইকন)।

> **আগে থেকেই deploy করা থাকলে**: শুধু কোড বদলে Save করলেই হবে না — **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** করতে হবে, তবেই লাইভ Web App URL-এ নতুন কোড কাজ করবে। URL টা একই থাকবে, admin panel-এ আবার বসাতে হবে না।

### ধাপ ৩: Deploy করুন
1. উপরে ডান দিকে নীল **Deploy** বাটনে ক্লিক করুন → **New deployment**
2. Gear icon (⚙️) এ ক্লিক করে Type থেকে **Web app** সিলেক্ট করুন
3. Settings:
   - **Execute as**: Me (আপনার একাউন্ট)
   - **Who has access**: Anyone. If Google only shows **Anyone with Google account**, select it and keep the POS browser signed in to a Google account.
4. **Deploy** এ ক্লিক করুন
5. প্রথমবার একটা permission popup আসবে — নিজের Google account সিলেক্ট করে **Advanced → Go to [project name] (unsafe) → Allow** এ ক্লিক করুন (এটা Google এর নিজস্ব safety warning, এখানে সম্পূর্ণ safe কারণ এটা আপনার নিজেরই script)
6. একটা **Web app URL** পাবেন — এটা কপি করুন (এমন দেখতে: `https://script.google.com/macros/s/AKfycb.../exec`)

### ধাপ ৪: Admin Panel-এ URL বসান
Admin Panel → **Backup & Sync ট্যাব** → "Free Cloud Sync" সেকশনে URL টা পেস্ট করে **Save** চাপুন, তারপর **Test** চেপে নিশ্চিত হোন connection কাজ করছে।

এরপর থেকে প্রতিটা sale/price change automatic ভাবে আপনার Google Sheet-এ সেভ হবে। অন্য কোনো ডিভাইস থেকেও একই URL বসিয়ে **"Restore Latest From Cloud"** চাপলে সব ডাটা সিঙ্ক হয়ে যাবে।

> **কেন এটা কখনো paid হবে না**: এটা কোনো database service না, একটা সাধারণ Google Sheet + একটা free script। Google Sheets-এর ফ্রি সীমা প্রায় ১ কোটি cell পর্যন্ত — একটা ছোট দোকানের বছরের পর বছরের ডাটার জন্যও এটা কখনো শেষ হবে না, এবং কোনো billing/credit card সংযুক্ত করারও দরকার নেই।

---

## ৬. Admin Panel — সম্পূর্ণ Feature List

| ট্যাব | ফিচার |
|---|---|
| **Dashboard** | Live business-day clock, next reset countdown, Total Glass/Sales/Cost/Profit, Excel export (today) |
| **Pricing & Items** | নতুন item add, item এর নাম/category/cost/price ইনলাইন এডিট, item delete, প্রতিটার sold/sales/profit দেখা, manual reset override |
| **Sales History** | Month-view calendar — যেদিন বিক্রি হয়েছে সেগুলো হাইলাইট, ক্লিক করলে সেই দিনের পুরো breakdown, সেই দিনের আলাদা Excel export |
| **Backup & Sync** | Password change, একক-ক্লিক JSON backup export/restore, Google Sheets cloud sync setup, cloud থেকে restore |

**User Panel (index.html)**-এ যা আপডেট হয়েছে:
- Category বাটনগুলো এখন automatic — নতুন category যোগ করলে সাথে সাথেই এখানে বাটন চলে আসবে (আগে হার্ডকোড করা ছিল)
- হেডারে বর্তমান Business Day দেখা যাবে

---

## ৭. যদি কখনো সমস্যা হয়

- **"সব ডাটা মুছে গেছে"** → Backup & Sync ট্যাব থেকে সবচেয়ে সাম্প্রতিক `.json` backup ফাইল দিয়ে Restore করুন, অথবা cloud sync চালু থাকলে "Restore Latest From Cloud" চাপুন।
- **Password ভুলে গেছেন** → ব্রাউজারের DevTools Console এ গিয়ে লিখুন: `localStorage.removeItem('roots_admin_pass_hash')` — এতে পাসওয়ার্ড রিসেট হয়ে ডিফল্ট `admin123` এ ফিরে যাবে।
- **Google Sheets sync কাজ করছে না** → ধাপ ৩ আবার চেক করুন, বিশেষ করে "Who has access: Anyone" ঠিক আছে কিনা।
