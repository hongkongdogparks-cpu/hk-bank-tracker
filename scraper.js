import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js — URL-corrected, DOM-exact rewrite
 *
 * Root causes fixed based on real diagnostic output:
 *
 * HSBC     ✅ Was working — table.desktop exists, col 1 = HKD. Now targeted exactly.
 * HangSeng ❌ Old URL was 404. Fixed to /en-hk/personal/banking/rates/deposit-interest-rates/
 * BOC      ❌ Old URL was 404. Fixed to /en/deposits/promotion/timedeposits.html
 * Citi     ❌ Old URL was 404. Fixed to /english/personal-banking/interest-and-foreign-exchange-rates/
 * SC       ❌ Timed out on networkidle2. Fixed to domcontentloaded + 10s extra wait.
 *             New URL: /hk/deposits/online-time-deposit/
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT env var is missing.');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

// ─────────────────────────────────────────────────────────────
// Shared helpers injected into browser context
// ─────────────────────────────────────────────────────────────

const HELPERS = `
  function parseRate(text) {
    if (!text) return null;
    const m = text.match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v > 0.05 && v < 10) ? v : null;
  }

  function normalizeTenor(text) {
    if (!text) return null;
    const t = text.trim();
    if (/1\\s*個月|1[\\s\\-]?month/i.test(t))  return '1m';
    if (/3\\s*個月|3[\\s\\-]?month/i.test(t))  return '3m';
    if (/6\\s*個月|6[\\s\\-]?month/i.test(t))  return '6m';
    if (/12\\s*個月|1\\s*年|12[\\s\\-]?month/i.test(t)) return '12m';
    return null;
  }

  function extractAnyTable() {
    const results = [];
    for (const table of document.querySelectorAll('table')) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;
      const headerCells = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const headerTenors = headerCells.map(normalizeTenor);
      if (headerTenors.some(Boolean)) {
        for (let r = 1; r < rows.length; r++) {
          const cells = Array.from(rows[r].querySelectorAll('th,td')).map(c => c.innerText.trim());
          for (let c = 0; c < cells.length; c++) {
            const tenor = headerTenors[c];
            if (!tenor) continue;
            const rate = parseRate(cells[c]);
            if (rate !== null) results.push({ tenor, rate });
          }
        }
      } else {
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('th,td')).map(c => c.innerText.trim());
          if (cells.length < 2) continue;
          const tenor = normalizeTenor(cells[0]);
          if (!tenor) continue;
          for (let c = 1; c < cells.length; c++) {
            const rate = parseRate(cells[c]);
            if (rate !== null) { results.push({ tenor, rate }); break; }
          }
        }
      }
      if (results.length > 0) break;
    }
    return results;
  }

  function extractAnyText() {
    const PATTERNS = [
      { re: /1\\s*個月|1[\\s\\-]?month/i, key: '1m' },
      { re: /3\\s*個月|3[\\s\\-]?month/i, key: '3m' },
      { re: /6\\s*個月|6[\\s\\-]?month/i, key: '6m' },
      { re: /12\\s*個月|1\\s*年|12[\\s\\-]?month/i, key: '12m' },
    ];
    const lines = document.body.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    for (let i = 0; i < lines.length; i++) {
      for (const { re, key } of PATTERNS) {
        if (!re.test(lines[i])) continue;
        for (let j = i; j <= Math.min(i + 4, lines.length - 1); j++) {
          const m = lines[j].match(/(\\d+\\.?\\d*)\\s*%/);
          if (m) {
            const v = parseFloat(m[1]);
            if (v > 0.05 && v < 10) { results.push({ tenor: key, rate: v }); break; }
          }
        }
      }
    }
    return results;
  }
`;

// ─────────────────────────────────────────────────────────────
// Per-bank browser-side extractors
// ─────────────────────────────────────────────────────────────

// HSBC: Diagnostic confirmed table.desktop structure:
//   Row 0: [存款期 | 港元 | 美元 | 人民幣 | ...]
//   Row 1: [3個月  | 2.20% | ...]
//   Row 2: [6個月  | 2.00% | ...]
//   Row 3: [12個月 | 不適用 | ...]
// HKD is column 1. All HSBC tiers share same rate on this page.
const EXTRACTOR_HSBC = `(function() {
  ${HELPERS}
  const results = {};

  const desktopTables = Array.from(document.querySelectorAll('table')).filter(t =>
    (t.className || '').includes('desktop')
  );
  const table = desktopTables[0] || document.querySelector('table');

  if (!table) {
    const generic = {};
    for (const { tenor, rate } of extractAnyText()) {
      if (!generic[tenor]) generic[tenor] = rate;
    }
    if (Object.keys(generic).length > 0) {
      results['hsbc_elite'] = results['hsbc_premier'] = results['hsbc_one'] = generic;
    }
    return results;
  }

  const rows = Array.from(table.querySelectorAll('tr'));
  const headerCells = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
  // Find HKD column — header contains '港元' or 'HKD'
  let hkdCol = headerCells.findIndex(c => c.includes('港元') || c.includes('HKD'));
  if (hkdCol < 0) hkdCol = 1; // safe default

  const rates = {};
  for (let r = 1; r < rows.length; r++) {
    const cells = Array.from(rows[r].querySelectorAll('th,td')).map(c => c.innerText.trim());
    const tenor = normalizeTenor(cells[0]);
    if (!tenor) continue;
    const rate = parseRate(cells[hkdCol]);
    if (rate !== null) rates[tenor] = rate;
  }

  if (Object.keys(rates).length > 0) {
    results['hsbc_elite'] = results['hsbc_premier'] = results['hsbc_one'] = rates;
  }
  return results;
})()`;

// Hang Seng: New URL — rate widget, try table then text fallback
const EXTRACTOR_HANGSENG = `(function() {
  ${HELPERS}
  const results = {};
  const generic = {};

  for (const { tenor, rate } of extractAnyTable()) {
    if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
  }
  if (Object.keys(generic).length === 0) {
    for (const { tenor, rate } of extractAnyText()) {
      if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
    }
  }
  if (Object.keys(generic).length > 0) {
    results['hangseng_prestige'] = generic;
    results['hangseng_standard'] = generic;
  }
  return results;
})()`;

// BOC: New URL — promotional page, table or text
const EXTRACTOR_BOC = `(function() {
  ${HELPERS}
  const results = {};
  const generic = {};

  for (const { tenor, rate } of extractAnyTable()) {
    if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
  }
  if (Object.keys(generic).length === 0) {
    for (const { tenor, rate } of extractAnyText()) {
      if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
    }
  }
  if (Object.keys(generic).length > 0) {
    results['boc_wealth']   = generic;
    results['boc_standard'] = generic;
  }
  return results;
})()`;

// Citibank: New URL — rates page, try tier columns first, then generic
const EXTRACTOR_CITI = `(function() {
  ${HELPERS}
  const results = {};

  // Try to find tier-split columns
  for (const table of document.querySelectorAll('table')) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;
    const headers = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
    const tierCols = {};
    headers.forEach((h, i) => {
      if (/citigold/i.test(h))     tierCols[i] = 'citi_gold';
      else if (/citi.?plus|priority/i.test(h)) tierCols[i] = 'citi_plus';
    });

    if (Object.keys(tierCols).length > 0) {
      for (let r = 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td,th')).map(c => c.innerText.trim());
        const tenor = normalizeTenor(cells[0]);
        if (!tenor) continue;
        for (const [idx, tierId] of Object.entries(tierCols)) {
          const rate = parseRate(cells[parseInt(idx)]);
          if (rate !== null) {
            if (!results[tierId]) results[tierId] = {};
            results[tierId][tenor] = rate;
          }
        }
      }
      if (Object.keys(results).length > 0) break;
    }
  }

  // Generic fallback
  if (Object.keys(results).length === 0) {
    const generic = {};
    for (const { tenor, rate } of extractAnyTable()) {
      if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
    }
    if (Object.keys(generic).length === 0) {
      for (const { tenor, rate } of extractAnyText()) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
    }
    if (Object.keys(generic).length > 0) {
      results['citi_gold'] = generic;
      results['citi_plus'] = generic;
    }
  }
  return results;
})()`;

// SC: New URL, domcontentloaded — generic extraction
const EXTRACTOR_SC = `(function() {
  ${HELPERS}
  const results = {};
  const generic = {};

  for (const { tenor, rate } of extractAnyTable()) {
    if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
  }
  if (Object.keys(generic).length === 0) {
    for (const { tenor, rate } of extractAnyText()) {
      if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
    }
  }
  if (Object.keys(generic).length > 0) {
    results['sc_priority'] = generic;
    results['sc_standard'] = generic;
  }
  return results;
})()`;

// ─────────────────────────────────────────────────────────────
// Core scrape function
// ─────────────────────────────────────────────────────────────

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🔍 ${task.bankName}  →  ${task.url}`);

  try {
    await page.goto(task.url, {
      waitUntil: task.waitUntil || 'networkidle2',
      timeout: 70000,
    });
    await new Promise(r => setTimeout(r, task.extraWait ?? 5000));

    // Auto-click HKD / 港元 tab if present
    try {
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button, a, li, [role="tab"]'));
        const hkdTab = tabs.find(el => /港元|HKD/i.test(el.innerText || ''));
        if (hkdTab) hkdTab.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch (_) {}

    if (process.env.DUMP_HTML) {
      const { writeFileSync } = await import('fs');
      writeFileSync(`/tmp/debug_${task.bankName.replace(/\s/g, '_')}.html`, await page.content());
    }

    const tierRates = await page.evaluate(task.extractor);

    if (!tierRates || Object.keys(tierRates).length === 0) {
      console.error(`   ❌ No rates extracted`);
      return;
    }

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = tierRates[item.id];
      if (!rates || Object.keys(rates).length === 0) {
        console.warn(`   ⚠️  [${item.id}] No rates for "${item.tier}"`);
        continue;
      }
      console.log(`   ✅ [${item.id}] 1M=${rates['1m'] ?? '─'}% 3M=${rates['3m'] ?? '─'}% 6M=${rates['6m'] ?? '─'}% 12M=${rates['12m'] ?? '─'}%`);
      await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set(
        { id: item.id, rates: { HKD: rates }, lastUpdated: now },
        { merge: true }
      );
    }

  } catch (err) {
    console.error(`   ⚠️  ${task.bankName} failed: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function runScraper() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900'],
  });

  const tasks = [
    {
      bankName: 'HSBC',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      waitUntil: 'networkidle2',
      extraWait: 4000,
      extractor: EXTRACTOR_HSBC,
      mapping: [
        { id: 'hsbc_elite',   tier: '卓越理財尊尚' },
        { id: 'hsbc_premier', tier: '卓越理財' },
        { id: 'hsbc_one',     tier: 'HSBC One' },
      ],
    },
    {
      bankName: 'Hang Seng',
      url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/',
      waitUntil: 'networkidle2',
      extraWait: 8000,
      extractor: EXTRACTOR_HANGSENG,
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財' },
        { id: 'hangseng_standard', tier: '港元' },
      ],
    },
    {
      bankName: 'BOC',
      url: 'https://www.bochk.com/en/deposits/promotion/timedeposits.html',
      waitUntil: 'networkidle2',
      extraWait: 5000,
      extractor: EXTRACTOR_BOC,
      mapping: [
        { id: 'boc_wealth',   tier: '中銀理財' },
        { id: 'boc_standard', tier: '一般' },
      ],
    },
    {
      bankName: 'Citibank',
      url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/',
      waitUntil: 'networkidle2',
      extraWait: 5000,
      extractor: EXTRACTOR_CITI,
      mapping: [
        { id: 'citi_gold', tier: 'Citigold' },
        { id: 'citi_plus', tier: 'Citi Plus' },
      ],
    },
    {
      bankName: 'Standard Chartered',
      url: 'https://www.sc.com/hk/deposits/online-time-deposit/',
      waitUntil: 'domcontentloaded', // SC blocks on networkidle2
      extraWait: 10000,
      extractor: EXTRACTOR_SC,
      mapping: [
        { id: 'sc_priority', tier: '優先理財' },
        { id: 'sc_standard', tier: '網上' },
      ],
    },
  ];

  for (const task of tasks) await scrapeBank(browser, task);

  // Static virtual banks
  const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
  for (const vb of [{ id: 'za', r: { '3m': 4.0, '6m': 3.6 } }, { id: 'paob', r: { '3m': 3.8, '6m': 3.6 } }]) {
    await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${vb.id}`).set(
      { id: vb.id, rates: { HKD: vb.r }, lastUpdated: now },
      { merge: true }
    );
    console.log(`\n   ✅ [${vb.id}] static rates written`);
  }

  await browser.close();
  console.log('\n🎉 Scraper finished.\n');
}

runScraper();