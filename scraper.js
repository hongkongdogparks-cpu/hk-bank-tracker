import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';
 
/**
 * scraper.js - DOM-Based Extraction with Per-Bank Custom Extractors
 *
 * Each bank gets a tailored in-browser extractor that targets its known HTML
 * structure. A generic table/text fallback handles unknown layouts.
 *
 * Debug: set env DUMP_HTML=1 to save rendered HTML to /tmp/debug_<bank>.html
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
// Shared browser-side helpers (serialised into page.evaluate)
// ─────────────────────────────────────────────────────────────
 
const TENOR_MAP_SRC = {
  '1個月': '1m', '一個月': '1m', '1-month': '1m', '1 month': '1m', '1month': '1m',
  '3個月': '3m', '三個月': '3m', '3-month': '3m', '3 month': '3m', '3month': '3m',
  '6個月': '6m', '六個月': '6m', '6-month': '6m', '6 month': '6m', '6month': '6m',
  '12個月': '12m', '十二個月': '12m', '1年': '12m', '一年': '12m',
  '12-month': '12m', '12 month': '12m', '12month': '12m',
};
 
// Injected as a string so page.evaluate can use it
const HELPERS_JS = `
const TENOR_MAP = ${JSON.stringify(TENOR_MAP_SRC)};
 
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
  for (const [key, val] of Object.entries(TENOR_MAP)) {
    if (t.includes(key)) return val;
  }
  return null;
}
 
function extractFromTables() {
  const results = [];
  for (const table of document.querySelectorAll('table')) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;
 
    const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c => c.innerText.trim());
    const headerTenors = headerCells.map(normalizeTenor);
    const hasTenorHeader = headerTenors.some(Boolean);
 
    if (hasTenorHeader) {
      for (let r = 1; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('th, td')).map(c => c.innerText.trim());
        for (let c = 0; c < cells.length; c++) {
          const tenor = headerTenors[c];
          if (!tenor) continue;
          const rate = parseRate(cells[c]);
          if (rate !== null) results.push({ tenor, rate, rowIdx: r });
        }
      }
    } else {
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim());
        if (cells.length < 2) continue;
        const tenor = normalizeTenor(cells[0]);
        if (!tenor) continue;
        for (let c = 1; c < cells.length; c++) {
          const rate = parseRate(cells[c]);
          if (rate !== null) { results.push({ tenor, rate, rowIdx: 0 }); break; }
        }
      }
    }
    if (results.length > 0) break;
  }
  return results;
}
 
function extractFromText() {
  const TENOR_PATTERNS = [
    { re: /1\\s*個月|1[\\s-]?month/i, key: '1m' },
    { re: /3\\s*個月|3[\\s-]?month/i, key: '3m' },
    { re: /6\\s*個月|6[\\s-]?month/i, key: '6m' },
    { re: /12\\s*個月|1\\s*年|12[\\s-]?month/i, key: '12m' },
  ];
  const lines = document.body.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { re, key } of TENOR_PATTERNS) {
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
// Per-bank custom extractors
// Each returns: { tierId: { '3m': 3.2, '6m': 2.8, ... }, ... }
// ─────────────────────────────────────────────────────────────
 
const EXTRACTORS = {
 
  // HSBC: Renders a table per tier section under heading tabs/accordions.
  // Tiers are identified by tab button text; each tab's panel has a <table>.
  hsbc: () => {
    eval(HELPERS_JS_PLACEHOLDER);
    const TIER_IDS = {
      '卓越理財尊尚': 'hsbc_elite',
      '卓越理財':     'hsbc_premier',
      'HSBC One':     'hsbc_one',
      'one':          'hsbc_one',
    };
 
    const results = {};
 
    // Strategy 1: find tab/accordion triggers, click each and read its table
    const triggers = Array.from(document.querySelectorAll('[role="tab"], .tab, .accordion-trigger, button'))
      .filter(el => {
        const txt = el.innerText.trim();
        return Object.keys(TIER_IDS).some(k => txt.includes(k));
      });
 
    if (triggers.length > 0) {
      for (const trigger of triggers) {
        trigger.click();
        const tierKey = Object.keys(TIER_IDS).find(k => trigger.innerText.includes(k));
        const tierId = TIER_IDS[tierKey];
        // Find the nearest table after trigger
        let el = trigger.parentElement;
        for (let i = 0; i < 5; i++) {
          const table = el && el.querySelector('table');
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'));
            const rates = {};
            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.innerText.trim());
              const tenor = normalizeTenor(cells[0]);
              if (tenor) {
                for (let c = 1; c < cells.length; c++) {
                  const rate = parseRate(cells[c]);
                  if (rate) { rates[tenor] = rate; break; }
                }
              }
            }
            if (Object.keys(rates).length > 0) { results[tierId] = rates; break; }
          }
          el = el && el.parentElement;
        }
      }
    }
 
    // Strategy 2: look for tier headings then nearby tables
    if (Object.keys(results).length === 0) {
      for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
        const allEls = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,th,td,div,span,p'));
        const heading = allEls.find(el => el.innerText.trim() === tierText || el.innerText.trim().includes(tierText));
        if (!heading) continue;
 
        let container = heading;
        for (let i = 0; i < 6; i++) {
          const table = container.querySelector('table');
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'));
            const rates = {};
            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
              const tenor = normalizeTenor(cells[0]);
              if (tenor) {
                for (let c = 1; c < cells.length; c++) {
                  const rate = parseRate(cells[c]);
                  if (rate) { rates[tenor] = rate; break; }
                }
              }
            }
            if (Object.keys(rates).length > 0) { results[tierId] = rates; break; }
          }
          container = container.parentElement || container;
          // Also try next sibling sections
          let sib = heading.nextElementSibling;
          for (let j = 0; j < 5 && sib; j++) {
            const t2 = sib.querySelector('table');
            if (t2) {
              const rows = Array.from(t2.querySelectorAll('tr'));
              const rates2 = {};
              for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
                const tenor = normalizeTenor(cells[0]);
                if (tenor) {
                  for (let c = 1; c < cells.length; c++) {
                    const rate = parseRate(cells[c]);
                    if (rate) { rates2[tenor] = rate; break; }
                  }
                }
              }
              if (Object.keys(rates2).length > 0) { results[tierId] = rates2; break; }
            }
            sib = sib.nextElementSibling;
          }
          if (results[tierId]) break;
        }
      }
    }
 
    // Strategy 3: generic fallback — assign same rates to all tiers
    if (Object.keys(results).length === 0) {
      const generic = {};
      const tableResults = extractFromTables();
      const textResults = extractFromText();
      const all = tableResults.length > 0 ? tableResults : textResults;
      for (const { tenor, rate } of all) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
      if (Object.keys(generic).length > 0) {
        for (const tierId of Object.values(TIER_IDS)) results[tierId] = generic;
      }
    }
 
    return results;
  },
 
  // Hang Seng: Similar tier structure. Prestige section has higher rates.
  hangseng: () => {
    eval(HELPERS_JS_PLACEHOLDER);
    const TIER_IDS = { '優越理財': 'hangseng_prestige', '港元': 'hangseng_standard' };
    const results = {};
 
    for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
      const allEls = Array.from(document.querySelectorAll('*'));
      const heading = allEls.find(el =>
        el.children.length === 0 &&
        (el.innerText || '').trim() === tierText
      );
      if (!heading) continue;
 
      let sib = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
      const rates = {};
      for (let i = 0; i < 8 && sib; i++) {
        const tableResults = [];
        const table = sib.querySelector('table') || (sib.tagName === 'TABLE' ? sib : null);
        if (table) {
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
            const tenor = normalizeTenor(cells[0]);
            if (tenor) {
              for (let c = 1; c < cells.length; c++) {
                const rate = parseRate(cells[c]);
                if (rate) { tableResults.push({ tenor, rate }); break; }
              }
            }
            // Also check header row → data row layout
            const headerCells = cells.map(normalizeTenor);
            if (headerCells.some(Boolean)) {
              const dataRows = rows.slice(1);
              for (const dr of dataRows) {
                const dc = Array.from(dr.querySelectorAll('td,th')).map(c => c.innerText.trim());
                for (let c = 0; c < dc.length; c++) {
                  const tenor2 = headerCells[c];
                  if (tenor2) {
                    const rate = parseRate(dc[c]);
                    if (rate) tableResults.push({ tenor: tenor2, rate });
                  }
                }
              }
            }
          }
          for (const { tenor, rate } of tableResults) {
            if (!rates[tenor] || rate > rates[tenor]) rates[tenor] = rate;
          }
        }
        if (Object.keys(rates).length > 0) break;
        sib = sib.nextElementSibling;
      }
      if (Object.keys(rates).length > 0) results[tierId] = rates;
    }
 
    // Fallback
    if (Object.keys(results).length === 0) {
      const generic = {};
      const all = extractFromTables().length > 0 ? extractFromTables() : extractFromText();
      for (const { tenor, rate } of all) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
      if (Object.keys(generic).length > 0) {
        results['hangseng_prestige'] = generic;
        results['hangseng_standard'] = generic;
      }
    }
 
    return results;
  },
 
  // BOC: Two tiers on the same page, typically in a tabbed layout.
  boc: () => {
    eval(HELPERS_JS_PLACEHOLDER);
    const results = {};
    const allText = document.body.innerText;
 
    // Find the two tier sections by looking for tier headings
    const TIER_IDS = { '中銀理財': 'boc_wealth', '一般': 'boc_standard' };
 
    for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
      const allEls = Array.from(document.querySelectorAll('*'));
      const heading = allEls.find(el =>
        el.children.length === 0 && (el.innerText || '').trim().includes(tierText)
      );
      if (!heading) continue;
 
      let el = heading;
      const rates = {};
      for (let i = 0; i < 6; i++) {
        const tables = (el.querySelectorAll ? Array.from(el.querySelectorAll('table')) : []);
        if (tables.length > 0) {
          for (const table of tables) {
            const rows = Array.from(table.querySelectorAll('tr'));
            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
              const tenor = normalizeTenor(cells[0]);
              if (tenor) {
                for (let c = 1; c < cells.length; c++) {
                  const rate = parseRate(cells[c]);
                  if (rate) { rates[tenor] = rate; break; }
                }
              }
            }
          }
          if (Object.keys(rates).length > 0) break;
        }
        el = el.parentElement;
      }
      if (Object.keys(rates).length > 0) results[tierId] = rates;
    }
 
    // Generic fallback
    if (Object.keys(results).length === 0) {
      const generic = {};
      const all = extractFromTables().length > 0 ? extractFromTables() : extractFromText();
      for (const { tenor, rate } of all) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
      if (Object.keys(generic).length > 0) {
        results['boc_wealth'] = generic;
        results['boc_standard'] = generic;
      }
    }
 
    return results;
  },
 
  // Citibank: Has currency tabs; rates differ by tier in a table.
  citi: () => {
    eval(HELPERS_JS_PLACEHOLDER);
    const results = {};
    const TIER_IDS = { 'Citigold': 'citi_gold', 'Citi Plus': 'citi_plus', 'Citi\u00a0Plus': 'citi_plus' };
 
    // Try to find tier columns in a single table (tiers as column groups)
    for (const table of document.querySelectorAll('table')) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;
 
      // Check if header row contains tier names
      const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c => c.innerText.trim());
      const tierColMap = {};
      headerCells.forEach((cell, i) => {
        for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
          if (cell.includes(tierText)) tierColMap[i] = tierId;
        }
      });
 
      if (Object.keys(tierColMap).length > 0) {
        for (let r = 1; r < rows.length; r++) {
          const cells = Array.from(rows[r].querySelectorAll('td, th')).map(c => c.innerText.trim());
          const tenor = normalizeTenor(cells[0]);
          if (!tenor) continue;
          for (const [colIdx, tierId] of Object.entries(tierColMap)) {
            const rate = parseRate(cells[parseInt(colIdx)]);
            if (rate !== null) {
              if (!results[tierId]) results[tierId] = {};
              results[tierId][tenor] = rate;
            }
          }
        }
        if (Object.keys(results).length > 0) break;
      }
    }
 
    // Fallback: section-per-tier
    if (Object.keys(results).length === 0) {
      for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
        const allEls = Array.from(document.querySelectorAll('*'));
        const heading = allEls.find(el =>
          el.children.length === 0 && (el.innerText || '').trim().includes(tierText)
        );
        if (!heading) continue;
        let sib = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
        const rates = {};
        for (let i = 0; i < 6 && sib; i++) {
          const t = sib.querySelector('table');
          if (t) {
            const rows = Array.from(t.querySelectorAll('tr'));
            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
              const tenor = normalizeTenor(cells[0]);
              if (tenor) {
                for (let c = 1; c < cells.length; c++) {
                  const rate = parseRate(cells[c]);
                  if (rate) { rates[tenor] = rate; break; }
                }
              }
            }
            if (Object.keys(rates).length > 0) break;
          }
          sib = sib.nextElementSibling;
        }
        if (Object.keys(rates).length > 0) results[tierId] = rates;
      }
    }
 
    // Generic fallback
    if (Object.keys(results).length === 0) {
      const generic = {};
      const all = extractFromTables().length > 0 ? extractFromTables() : extractFromText();
      for (const { tenor, rate } of all) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
      if (Object.keys(generic).length > 0) {
        results['citi_gold'] = generic;
        results['citi_plus'] = generic;
      }
    }
 
    return results;
  },
 
  // Standard Chartered: Priority banking vs standard, typically one table each.
  sc: () => {
    eval(HELPERS_JS_PLACEHOLDER);
    const results = {};
    const TIER_IDS = { '優先理財': 'sc_priority', '網上': 'sc_standard', 'Priority': 'sc_priority', 'Online': 'sc_standard' };
 
    for (const [tierText, tierId] of Object.entries(TIER_IDS)) {
      const allEls = Array.from(document.querySelectorAll('*'));
      const heading = allEls.find(el =>
        el.children.length === 0 && (el.innerText || '').trim().includes(tierText)
      );
      if (!heading) continue;
 
      const rates = {};
      let sib = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
      for (let i = 0; i < 8 && sib; i++) {
        const t = sib.querySelector('table') || (sib.tagName === 'TABLE' ? sib : null);
        if (t) {
          const rows = Array.from(t.querySelectorAll('tr'));
          const headerRow = rows[0] ? Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim()) : [];
          const headerTenors = headerRow.map(normalizeTenor);
          const hasTenorHeader = headerTenors.some(Boolean);
 
          for (let r = hasTenorHeader ? 1 : 0; r < rows.length; r++) {
            const cells = Array.from(rows[r].querySelectorAll('td,th')).map(c => c.innerText.trim());
            if (hasTenorHeader) {
              for (let c = 0; c < cells.length; c++) {
                const tenor = headerTenors[c];
                if (tenor) {
                  const rate = parseRate(cells[c]);
                  if (rate) rates[tenor] = rate;
                }
              }
            } else {
              const tenor = normalizeTenor(cells[0]);
              if (tenor) {
                for (let c = 1; c < cells.length; c++) {
                  const rate = parseRate(cells[c]);
                  if (rate) { rates[tenor] = rate; break; }
                }
              }
            }
          }
          if (Object.keys(rates).length > 0) break;
        }
        sib = sib.nextElementSibling;
      }
      if (Object.keys(rates).length > 0) results[tierId] = rates;
    }
 
    if (Object.keys(results).length === 0) {
      const generic = {};
      const all = extractFromTables().length > 0 ? extractFromTables() : extractFromText();
      for (const { tenor, rate } of all) {
        if (!generic[tenor] || rate > generic[tenor]) generic[tenor] = rate;
      }
      if (Object.keys(generic).length > 0) {
        results['sc_priority'] = generic;
        results['sc_standard'] = generic;
      }
    }
 
    return results;
  },
};
 
// Build eval-able extractor string by injecting helpers
function buildExtractorFn(extractorFn) {
  const helpersSrc = HELPERS_JS.replace(/HELPERS_JS_PLACEHOLDER/g, '');
  const fnSrc = extractorFn.toString();
  // Replace the eval(HELPERS_JS_PLACEHOLDER) sentinel with the actual helpers
  const injected = fnSrc.replace(/eval\(HELPERS_JS_PLACEHOLDER\);?/, helpersSrc);
  return new Function(`return (${injected})()`);
}
 
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
  console.log(`🔍 Scraping: ${task.bankName}  →  ${task.url}`);
 
  try {
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));
 
    // Auto-click HKD/港元 tab if present
    try {
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button, a, li, [role="tab"]'));
        const hkdTab = tabs.find(el => /港元|HKD/i.test(el.innerText || ''));
        if (hkdTab) { hkdTab.click(); }
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch (_) {}
 
    if (process.env.DUMP_HTML) {
      const html = await page.content();
      const { writeFileSync } = await import('fs');
      writeFileSync(`/tmp/debug_${task.bankName.replace(/\s/g, '_')}.html`, html);
      console.log(`   📄 HTML saved to /tmp/debug_${task.bankName.replace(/\s/g, '_')}.html`);
    }
 
    // Run the bank-specific extractor inside the browser context
    const extractorSrc = HELPERS_JS + '\n return (' + task.extractor.toString() + ')()';
    const tierRates = await page.evaluate(new Function(extractorSrc));
 
    if (!tierRates || Object.keys(tierRates).length === 0) {
      console.error(`   ❌ No rates extracted for ${task.bankName}`);
      return;
    }
 
    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
 
    for (const item of task.mapping) {
      const rates = tierRates[item.id];
      if (!rates || Object.keys(rates).length === 0) {
        console.warn(`   ⚠️  [${item.id}] No rates found for tier "${item.tier}"`);
        continue;
      }
      console.log(`   ✅ [${item.id}] 1M=${rates['1m'] ?? '-'}% | 3M=${rates['3m'] ?? '-'}% | 6M=${rates['6m'] ?? '-'}% | 12M=${rates['12m'] ?? '-'}%`);
      await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set(
        { id: item.id, rates: { HKD: rates }, lastUpdated: now },
        { merge: true }
      );
    }
 
  } catch (err) {
    console.error(`⚠️  ${task.bankName} failed: ${err.message}`);
    console.error(err.stack);
  } finally {
    await page.close();
  }
}
 
// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
 
async function runScraper() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900'],
  });
 
  const tasks = [
    {
      bankName: 'HSBC',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      extractor: EXTRACTORS.hsbc,
      mapping: [
        { id: 'hsbc_elite',   tier: '卓越理財尊尚' },
        { id: 'hsbc_premier', tier: '卓越理財' },
        { id: 'hsbc_one',     tier: 'HSBC One' },
      ],
    },
    {
      bankName: 'Hang Seng',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      extractor: EXTRACTORS.hangseng,
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財' },
        { id: 'hangseng_standard', tier: '港元' },
      ],
    },
    {
      bankName: 'BOC',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      extractor: EXTRACTORS.boc,
      mapping: [
        { id: 'boc_wealth',   tier: '中銀理財' },
        { id: 'boc_standard', tier: '一般' },
      ],
    },
    {
      bankName: 'Citibank',
      url: 'https://www.citibank.com.hk/zh/banking/time-deposit.html',
      extractor: EXTRACTORS.citi,
      mapping: [
        { id: 'citi_gold', tier: 'Citigold' },
        { id: 'citi_plus', tier: 'Citi Plus' },
      ],
    },
    {
      bankName: 'Standard Chartered',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      extractor: EXTRACTORS.sc,
      mapping: [
        { id: 'sc_priority', tier: '優先理財' },
        { id: 'sc_standard', tier: '網上' },
      ],
    },
  ];
 
  for (const task of tasks) await scrapeBank(browser, task);
 
  // Static virtual banks
  const vBanks = [
    { id: 'za',   r: { '3m': 4.0, '6m': 3.6 } },
    { id: 'paob', r: { '3m': 3.8, '6m': 3.6 } },
  ];
  const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
  for (const vb of vBanks) {
    await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${vb.id}`).set(
      { id: vb.id, rates: { HKD: vb.r }, lastUpdated: now },
      { merge: true }
    );
    console.log(`   ✅ [${vb.id}] static rates written`);
  }
 
  await browser.close();
  console.log('\n🎉 Scraper finished.\n');
}
 
runScraper();