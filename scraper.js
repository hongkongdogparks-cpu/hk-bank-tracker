import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js — Definitive 2026 edition
 *
 * Per-bank strategy based on real page inspection:
 *
 * HSBC      → table.desktop, rows=tenors, col 1 = HKD              ✅ server-side HTML
 * BOC       → table with "HKD" section, tier rows (Private/Enrich)  ✅ server-side HTML
 * Citi      → table with Citigold/Citi Priority tier columns         ✅ server-side HTML
 * Hang Seng → JS widget; table rendered empty until JS runs          ⚠️  needs Puppeteer + wait
 * SC        → JS rendered; rates injected after load                 ⚠️  needs Puppeteer + long wait
 * BEA/ICBC/CCB/Public → best-effort generic table + text fallback
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT missing'); process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

// ─── Shared in-browser helpers ────────────────────────────────────────────────
const HELPERS = `
  function parseRate(text) {
    if (!text) return null;
    const m = String(text).match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v > 0.4 && v < 10) ? v : null;
  }
  function normalizeTenor(text) {
    if (!text) return null;
    const t = String(text).trim();
    if (/1\\s*個月|1[\\s\\-]?month/i.test(t))              return '1m';
    if (/3\\s*個月|3[\\s\\-]?month/i.test(t))              return '3m';
    if (/6\\s*個月|6[\\s\\-]?month/i.test(t))              return '6m';
    if (/12\\s*個月|1\\s*年|12[\\s\\-]?month|1[\\s\\-]?year/i.test(t)) return '12m';
    return null;
  }
  // Generic: scan all tables, return [{tenor, rate}]
  function genericTable() {
    const out = [];
    for (const tbl of document.querySelectorAll('table')) {
      const rows = Array.from(tbl.querySelectorAll('tr'));
      if (rows.length < 2) continue;
      const hdr = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const hdrT = hdr.map(normalizeTenor);
      if (hdrT.some(Boolean)) {
        for (let r = 1; r < rows.length; r++) {
          const cells = Array.from(rows[r].querySelectorAll('th,td')).map(c => c.innerText.trim());
          hdrT.forEach((tenor, ci) => {
            if (!tenor) return;
            const rate = parseRate(cells[ci]);
            if (rate !== null) out.push({ tenor, rate });
          });
        }
      } else {
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('th,td')).map(c => c.innerText.trim());
          if (cells.length < 2) continue;
          const tenor = normalizeTenor(cells[0]);
          if (!tenor) continue;
          for (let ci = 1; ci < cells.length; ci++) {
            const rate = parseRate(cells[ci]);
            if (rate !== null) { out.push({ tenor, rate }); break; }
          }
        }
      }
      if (out.length) break;
    }
    return out;
  }
  // Generic text scan fallback
  function genericText() {
    const PATS = [
      { re: /1\\s*個月|1[\\s\\-]?month/i, key: '1m' },
      { re: /3\\s*個月|3[\\s\\-]?month/i, key: '3m' },
      { re: /6\\s*個月|6[\\s\\-]?month/i, key: '6m' },
      { re: /12\\s*個月|1\\s*年|12[\\s\\-]?month/i, key: '12m' },
    ];
    const lines = document.body.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      for (const { re, key } of PATS) {
        if (!re.test(lines[i])) continue;
        for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
          const rate = parseRate(lines[j]);
          if (rate !== null) { out.push({ tenor: key, rate }); break; }
        }
      }
    }
    return out;
  }
`;

// ─── Per-bank extractors (evaluated inside browser) ──────────────────────────

// HSBC: table.desktop, rows = tenors, find HKD column dynamically.
// All three tiers share same rate page.
const EX_HSBC = `(function() {
  ${HELPERS}
  const tbl = Array.from(document.querySelectorAll('table'))
    .find(t => (t.className || '').includes('desktop'))
    || document.querySelector('table');
  if (!tbl) return {};
  const rows = Array.from(tbl.querySelectorAll('tr'));
  const hdr  = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
  let hkdCol = hdr.findIndex(c => /港元|HKD/i.test(c));
  if (hkdCol < 0) hkdCol = 1;
  const rates = {};
  for (let r = 1; r < rows.length; r++) {
    const cells = Array.from(rows[r].querySelectorAll('th,td')).map(c => c.innerText.trim());
    const tenor = normalizeTenor(cells[0]);
    if (!tenor) continue;
    const rate = parseRate(cells[hkdCol]);
    if (rate !== null) rates[tenor] = rate;
  }
  if (!Object.keys(rates).length) return {};
  return { hsbc_elite: rates, hsbc_premier: rates, hsbc_one: rates };
})()`;

// BOC: server-side HTML. The first table has:
//   Header: [Currency | Integrated Account Services | 3-month | 6-month | 12-month | Channel]
//   Row: [HKD | Private Wealth / Wealth Management | 2.10% | 1.90% | - | ...]
//   Row: [    | Enrich Banking / i-Free Banking...  | 2.10% | 1.90% | - | ...]
// Strategy: find the first row where "HKD" appears and tenor cols by header.
const EX_BOC = `(function() {
  ${HELPERS}
  const rates = {};
  for (const tbl of document.querySelectorAll('table')) {
    const rows = Array.from(tbl.querySelectorAll('tr'));
    if (rows.length < 2) continue;
    const hdr = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
    // Map tenor column indices from header
    const t3  = hdr.findIndex(h => /3.month|3個月/i.test(h));
    const t6  = hdr.findIndex(h => /6.month|6個月/i.test(h));
    const t12 = hdr.findIndex(h => /12.month|12個月/i.test(h));
    if (t3 < 0 && t6 < 0) continue; // not a rate table
    let inHKD = false;
    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('th,td')).map(c => c.innerText.trim());
      if (cells[0] === 'HKD' || /^hkd$/i.test(cells[0])) inHKD = true;
      if (!inHKD) continue;
      // Stop when we hit a different currency
      if (cells[0] && cells[0] !== 'HKD' && !/^\\s*$/.test(cells[0]) && !/private|wealth|enrich|i-free|other/i.test(cells[0])) break;
      const isWealth = /private|wealth/i.test(cells.join(' '));
      const tier = isWealth ? 'boc_wealth' : 'boc_standard';
      if (!rates[tier]) rates[tier] = {};
      if (t3  >= 0 && cells[t3])  { const v = parseRate(cells[t3]);  if (v) rates[tier]['3m']  = v; }
      if (t6  >= 0 && cells[t6])  { const v = parseRate(cells[t6]);  if (v) rates[tier]['6m']  = v; }
      if (t12 >= 0 && cells[t12]) { const v = parseRate(cells[t12]); if (v) rates[tier]['12m'] = v; }
    }
    if (Object.keys(rates).length) break;
  }
  // Fallback: same rates for both tiers
  if (!Object.keys(rates).length) {
    const g = {};
    for (const { tenor, rate } of genericTable()) { if (!g[tenor]) g[tenor] = rate; }
    if (Object.keys(g).length) { rates.boc_wealth = g; rates.boc_standard = g; }
  }
  return rates;
})()`;

// Citi: server-side HTML. Table has tier columns Citigold / Citi Priority.
// Target: "Highest Time Deposit Rate" section table, or the new-to-bank table.
// We look for the table that has tenor rows (3-month etc) with rate values.
const EX_CITI = `(function() {
  ${HELPERS}
  const rates = {};
  for (const tbl of document.querySelectorAll('table')) {
    const rows = Array.from(tbl.querySelectorAll('tr'));
    if (rows.length < 2) continue;
    const hdr = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
    // Check for tier columns
    const goldCol     = hdr.findIndex(h => /citigold private|citigold/i.test(h));
    const priorityCol = hdr.findIndex(h => /citi\\s*(priority|plus)/i.test(h));
    if (goldCol >= 0 || priorityCol >= 0) {
      for (let r = 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td,th')).map(c => c.innerText.trim());
        const tenor = normalizeTenor(cells[0]);
        if (!tenor) continue;
        if (goldCol >= 0) {
          const v = parseRate(cells[goldCol]);
          if (v) { if (!rates.citi_gold) rates.citi_gold = {}; rates.citi_gold[tenor] = v; }
        }
        if (priorityCol >= 0) {
          const v = parseRate(cells[priorityCol]);
          if (v) { if (!rates.citi_plus) rates.citi_plus = {}; rates.citi_plus[tenor] = v; }
        }
      }
      if (Object.keys(rates).length) break;
    }
    // Check for tenor rows with rates (generic rate table)
    const hasHKD   = hdr.some(h => /HKD|港元/i.test(h));
    const hasTenor = rows.slice(1).some(row => {
      const txt = Array.from(row.querySelectorAll('td,th'))[0]?.innerText || '';
      return normalizeTenor(txt);
    });
    if (hasHKD && hasTenor) {
      const hkdCol = hdr.findIndex(h => /HKD|港元/i.test(h));
      for (let r = 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td,th')).map(c => c.innerText.trim());
        const tenor = normalizeTenor(cells[0]);
        if (!tenor) continue;
        const v = parseRate(cells[hkdCol >= 0 ? hkdCol : 1]);
        if (v) { if (!rates.citi_gold) rates.citi_gold = {}; rates.citi_gold[tenor] = v; }
      }
      if (Object.keys(rates).length) {
        rates.citi_plus = rates.citi_gold;
        break;
      }
    }
  }
  // Fallback
  if (!Object.keys(rates).length) {
    const g = {};
    for (const { tenor, rate } of genericTable()) { if (!g[tenor]) g[tenor] = rate; }
    if (!Object.keys(g).length) for (const { tenor, rate } of genericText()) { if (!g[tenor]) g[tenor] = rate; }
    if (Object.keys(g).length) { rates.citi_gold = g; rates.citi_plus = g; }
  }
  return rates;
})()`;

// Hang Seng: JS-rendered. After wait, target the "HKD Time deposit interest rates" section.
// Table structure: | Tenor | Interest rate |
// Both tiers get same board rate.
const EX_HANGSENG = `(function() {
  ${HELPERS}
  const rates = {};
  const g = {};
  // Look specifically for the HKD time deposit table (after the heading)
  const headings = Array.from(document.querySelectorAll('h2,h3,h4'));
  const hkdHeading = headings.find(h => /HKD Time deposit|港元定期/i.test(h.innerText));
  if (hkdHeading) {
    let el = hkdHeading.nextElementSibling;
    for (let i = 0; i < 6 && el; i++) {
      const tbl = el.tagName === 'TABLE' ? el : el.querySelector('table');
      if (tbl) {
        const rows = Array.from(tbl.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('th,td')).map(c => c.innerText.trim());
          const tenor = normalizeTenor(cells[0]);
          if (!tenor) continue;
          for (let ci = 1; ci < cells.length; ci++) {
            const v = parseRate(cells[ci]);
            if (v) { g[tenor] = v; break; }
          }
        }
        if (Object.keys(g).length) break;
      }
      el = el.nextElementSibling;
    }
  }
  // Generic fallback
  if (!Object.keys(g).length) {
    for (const { tenor, rate } of genericTable()) { if (!g[tenor]) g[tenor] = rate; }
  }
  if (!Object.keys(g).length) {
    for (const { tenor, rate } of genericText()) { if (!g[tenor]) g[tenor] = rate; }
  }
  if (Object.keys(g).length) {
    rates.hangseng_prestige = g;
    rates.hangseng_standard = g;
  }
  return rates;
})()`;

// SC: JS-rendered. Rates appear as text after JS hydration.
// Target rate table or text patterns. Both tiers get same online rate.
const EX_SC = `(function() {
  ${HELPERS}
  const rates = {};
  const g = {};
  // SC page often renders rates in a styled table or dl/dt list
  // Try table first, then text scan
  for (const { tenor, rate } of genericTable()) { if (!g[tenor] || rate > g[tenor]) g[tenor] = rate; }
  if (!Object.keys(g).length) {
    for (const { tenor, rate } of genericText()) { if (!g[tenor] || rate > g[tenor]) g[tenor] = rate; }
  }
  if (Object.keys(g).length) {
    rates.sc_priority = g;
    rates.sc_standard = g;
  }
  return rates;
})()`;

// Generic extractor for BEA / ICBC / CCB / Public Bank
// Returns { [id]: rates }
function makeGenericExtractor(ids) {
  return `(function() {
    ${HELPERS}
    const g = {};
    for (const { tenor, rate } of genericTable()) { if (!g[tenor] || rate > g[tenor]) g[tenor] = rate; }
    if (!Object.keys(g).length) {
      for (const { tenor, rate } of genericText()) { if (!g[tenor] || rate > g[tenor]) g[tenor] = rate; }
    }
    if (!Object.keys(g).length) return {};
    return ${JSON.stringify(ids)}.reduce((acc, id) => { acc[id] = g; return acc; }, {});
  })()`;
}

// ─── Core scrape function ─────────────────────────────────────────────────────
async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🔍 ${task.bankName}  →  ${task.url}`);

  try {
    await page.goto(task.url, { waitUntil: task.waitUntil || 'networkidle2', timeout: 75000 });
    await new Promise(r => setTimeout(r, task.extraWait ?? 5000));

    // Auto-click HKD / 港元 tab
    try {
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('button,a,li,[role="tab"]'))
          .find(e => /港元|HKD/i.test(e.innerText || ''));
        if (el) el.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch (_) {}

    if (process.env.DUMP_HTML) {
      const { writeFileSync } = await import('fs');
      writeFileSync(`/tmp/debug_${task.bankName.replace(/\W/g, '_')}.html`, await page.content());
      console.log(`   📄 HTML dumped`);
    }

    const tierRates = await page.evaluate(task.extractor);

    if (!tierRates || !Object.keys(tierRates).length) {
      console.error(`   ❌ No rates extracted`);
      return;
    }

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = tierRates[item.id];
      if (!rates || !Object.keys(rates).length) {
        console.warn(`   ⚠️  [${item.id}] no rates`);
        continue;
      }
      console.log(`   ✅ [${item.id}] 1M=${rates['1m']??'─'}% 3M=${rates['3m']??'─'}% 6M=${rates['6m']??'─'}% 12M=${rates['12m']??'─'}%`);
      await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set(
        { id: item.id, rates: { HKD: rates }, lastUpdated: now }, { merge: true }
      );
    }
  } catch (err) {
    console.error(`   ⚠️  ${task.bankName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900'],
  });

  const tasks = [
    // ── Tier 1 banks ──────────────────────────────────────────────────────────
    {
      bankName: 'HSBC',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      waitUntil: 'networkidle2', extraWait: 4000,
      extractor: EX_HSBC,
      mapping: [
        { id: 'hsbc_elite',   tier: '卓越理財尊尚' },
        { id: 'hsbc_premier', tier: '卓越理財' },
        { id: 'hsbc_one',     tier: 'HSBC One' },
      ],
    },
    {
      bankName: 'Hang Seng',
      // JS-rendered widget; needs Puppeteer + long wait
      url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/',
      waitUntil: 'networkidle2', extraWait: 10000,
      extractor: EX_HANGSENG,
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財' },
        { id: 'hangseng_standard', tier: '港元' },
      ],
    },
    {
      bankName: 'BOC',
      // ✅ Server-side HTML table — no JS needed
      url: 'https://www.bochk.com/en/deposits/promotion/timedeposits.html',
      waitUntil: 'networkidle2', extraWait: 3000,
      extractor: EX_BOC,
      mapping: [
        { id: 'boc_wealth',   tier: 'Private Wealth' },
        { id: 'boc_standard', tier: 'Other' },
      ],
    },
    {
      bankName: 'Citibank',
      // ✅ Server-side HTML table — Citigold/Citi Priority columns
      url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/',
      waitUntil: 'networkidle2', extraWait: 3000,
      extractor: EX_CITI,
      mapping: [
        { id: 'citi_gold', tier: 'Citigold' },
        { id: 'citi_plus', tier: 'Citi Priority' },
      ],
    },
    {
      bankName: 'Standard Chartered',
      // JS-rendered; use domcontentloaded + long wait
      url: 'https://www.sc.com/hk/deposits/online-time-deposit/',
      waitUntil: 'domcontentloaded', extraWait: 12000,
      extractor: EX_SC,
      mapping: [
        { id: 'sc_priority', tier: 'Priority Banking' },
        { id: 'sc_standard', tier: 'Online' },
      ],
    },
    // ── Other traditional banks ───────────────────────────────────────────────
    {
      bankName: 'BEA',
      url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html',
      waitUntil: 'networkidle2', extraWait: 5000,
      extractor: makeGenericExtractor(['bea_supreme']),
      mapping: [{ id: 'bea_supreme', tier: '至尊理財' }],
    },
    {
      bankName: 'ICBC Asia',
      url: 'https://www.icbcasia.com/tc/personal/deposits/index.html',
      waitUntil: 'networkidle2', extraWait: 5000,
      extractor: makeGenericExtractor(['icbc_elite']),
      mapping: [{ id: 'icbc_elite', tier: '理財金' }],
    },
    {
      bankName: 'CCB Asia',
      url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html',
      waitUntil: 'networkidle2', extraWait: 5000,
      extractor: makeGenericExtractor(['ccb_prestige']),
      mapping: [{ id: 'ccb_prestige', tier: '貴賓理財' }],
    },
    {
      bankName: 'Public Bank',
      url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit',
      waitUntil: 'networkidle2', extraWait: 5000,
      extractor: makeGenericExtractor(['public_online']),
      mapping: [{ id: 'public_online', tier: '網上定存' }],
    },
  ];

  for (const task of tasks) await scrapeBank(browser, task);

  // ── Virtual banks (static — update these manually when rates change) ─────────
  // Check each bank's app/website monthly and update here.
  const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
  const virtualBanks = [
    { id: 'za',      r: { '1m': 3.5, '3m': 3.8, '6m': 3.5, '12m': 3.0 } }, // za.group
    { id: 'paob',    r: { '3m': 3.7, '6m': 3.4 } },                          // paob.com.hk
    { id: 'fusion',  r: { '3m': 3.6, '6m': 3.3 } },                          // fusionbank.com
    { id: 'livi',    r: { '1m': 2.4, '3m': 3.4, '6m': 3.2 } },               // livibank.com
    { id: 'mox',     r: { '3m': 3.5, '6m': 3.0 } },                          // mox.bank
    { id: 'welab',   r: { '3m': 3.6, '6m': 3.4 } },                          // welab.bank
    { id: 'ant',     r: { '3m': 3.7, '6m': 3.5 } },                          // antbank.com
    { id: 'airstar', r: { '3m': 3.6, '6m': 3.2, '12m': 2.85 } },             // airstarbank.com
  ];
  for (const vb of virtualBanks) {
    await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${vb.id}`).set(
      { id: vb.id, rates: { HKD: vb.r }, lastUpdated: now }, { merge: true }
    );
    console.log(`   ✅ [${vb.id}] static VB rates written`);
  }

  await browser.close();
  console.log('\n🎉 Done.\n');
}

run();