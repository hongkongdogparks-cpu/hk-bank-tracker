import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 終極穩定版 (官網優先 + U Lifestyle 備援)
 * 💡 策略：
 * 1. 首先嘗試從各大銀行官網抓取最即時數據。
 * 2. 若官網抓取失敗，則啟動 Fallback 機制，前往 U Lifestyle 匯總頁提取數據。
 * 3. 確保數據不留白，提供 100% 可用率。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT 缺失');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

const FALLBACK_URL = "https://hk.ulifestyle.com.hk/topic/detail/20053976/%E9%A6%99%E6%B8%AF%E9%8A%80%E8%A1%8C%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E5%AD%98%E6%AC%BE%E5%88%A9%E7%8E%87%E6%AF%94%E8%BC%83-%E6%9C%80%E6%96%B0%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E高%81%AF%E4%B9%8B%E9%81%B8-%E6%AF%8F%E6%97%A5%E6%9B%B4%E6%96%B0/6";

// ── 注入瀏覽器的智慧解析引擎 ─────────────────────────────────────

const HELPERS = `
  const TENOR_MAP = {
    '1m': [/1\\s*個月/i, /1\\s*month/i, /1\\s*m/i],
    '3m': [/3\\s*個月/i, /3\\s*month/i, /3\\s*m/i],
    '6m': [/6\\s*個月/i, /6\\s*month/i, /6\\s*m/i],
    '12m': [/12\\s*個月/i, /1\\s*年/i, /12\\s*month/i, /1\\s*year/i, /12\\s*m/i]
  };

  function parseRate(text) {
    if (!text) return null;
    const clean = text.replace(/\\s/g, '');
    const m = clean.match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v >= 0.001 && v < 15) ? v : null;
  }

  function normalizeTenor(text) {
    if (!text) return null;
    const t = text.trim();
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      if (regexes.some(re => re.test(t))) return key;
    }
    return null;
  }

  function deepTableParser(targetTier) {
    const finalRates = {};
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;
      const firstRow = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const headerTenors = firstRow.map(normalizeTenor);
      if (headerTenors.some(Boolean)) {
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td,th')).map(c => c.innerText.trim());
          if (cells[0].toLowerCase().includes(targetTier.toLowerCase()) || targetTier.toLowerCase().includes(cells[0].toLowerCase()) || targetTier === 'Global') {
            headerTenors.forEach((tenor, idx) => {
              if (tenor && cells[idx]) {
                const r = parseRate(cells[idx]);
                if (r !== null) finalRates[tenor] = r;
              }
            });
          }
        }
      }
      if (Object.keys(finalRates).length === 0) {
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
          const firstCellTenor = normalizeTenor(cells[0]);
          if (firstCellTenor) {
            for (let j = cells.length - 1; j >= 1; j--) {
              const r = parseRate(cells[j]);
              if (r !== null) { if (!finalRates[firstCellTenor] || r > finalRates[firstCellTenor]) finalRates[firstCellTenor] = r; break; }
            }
          }
        });
      }
      if (Object.keys(finalRates).length > 0) break;
    }
    return finalRates;
  }

  function textRegionScanner(tierName) {
    const body = document.body.innerText.replace(/\\s+/g, ' ');
    const idx = body.toLowerCase().indexOf(tierName.toLowerCase());
    if (idx === -1) return {};
    const block = body.substring(idx, idx + 5000);
    const results = {};
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      for (const re of regexes) {
        const match = block.match(new RegExp(re.source, 'i'));
        if (match) {
          const area = block.substring(match.index, match.index + 500);
          const r = parseRate(area);
          if (r !== null) { results[key] = r; break; }
        }
      }
    }
    return results;
  }
`;

// ── Fallback 解析引擎 (針對 U Lifestyle) ──────────────────────────

async function scrapeFallbackSource(browser, failedBankIds) {
  if (failedBankIds.length === 0) return;
  console.log(`\n🚨 啟動 Fallback 機制: 嘗試從 U Lifestyle 補全 ${failedBankIds.length} 間銀行數據...`);
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  
  try {
    await page.goto(FALLBACK_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // 別名表：將 U Lifestyle 上的文字對應到系統 ID
    const aliasMap = {
      'hsbc_elite': '匯豐', 'hsbc_premier': '匯豐', 'hsbc_one': 'HSBC One',
      'hangseng_prestige': '恒生', 'hangseng_standard': '恒生',
      'boc_wealth': '中銀', 'boc_standard': '中銀',
      'sc_priority': '渣打', 'sc_standard': '渣打',
      'citi_gold': '花旗', 'citi_plus': '花旗',
      'bea_supreme': '東亞', 'icbc_elite': '工銀', 'ccb_prestige': '建行',
      'za': 'ZA Bank', 'fusion': '富融', 'mox': 'Mox', 'paob': '平安壹賬通',
      'livi': 'Livi', 'welab': 'WeLab', 'ant': '螞蟻', 'airstar': '天星'
    };

    for (const bankId of failedBankIds) {
      const searchTerm = aliasMap[bankId];
      if (!searchTerm) continue;

      const rates = await page.evaluate((term, helpers) => {
        eval(helpers);
        return textRegionScanner(term);
      }, searchTerm, HELPERS);

      if (rates && Object.keys(rates).length > 0) {
        console.log(`   💡 [${bankId}] 已通過 Fallback 補全數據`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${bankId}`).set({
          id: bankId, rates: { HKD: rates }, lastUpdated: `Fallback: ${new Date().toLocaleString('zh-HK')}`
        }, { merge: true });
      }
    }
  } catch (err) {
    console.error(`   ⚠️ Fallback 抓取失敗: ${err.message}`);
  } finally {
    await page.close();
  }
}

// ── 主抓取邏輯 ─────────────────────────────────────────────

async function scrapeBank(browser, task, failedSet) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 掃描官網: ${task.bankName}`);

  try {
    const waitCond = (task.url.includes('sc.com') || task.url.includes('citibank')) ? 'domcontentloaded' : 'networkidle2';
    await page.goto(task.url, { waitUntil: waitCond, timeout: 70000 });
    await new Promise(r => setTimeout(r, task.extraWait || 8000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const data = {};
      mapping.forEach(m => {
        let rates = deepTableParser(m.tier);
        if (!rates || Object.keys(rates).length === 0) rates = textRegionScanner(m.tier);
        data[m.id] = rates;
      });
      return data;
    }, task.mapping, HELPERS);

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = results[item.id];
      if (rates && Object.keys(rates).length > 0) {
        console.log(`   ✅ [${item.id}] 官網同步成功`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set({
          id: item.id, rates: { HKD: rates }, lastUpdated: now
        }, { merge: true });
      } else {
        failedSet.add(item.id);
        console.warn(`   ❌ [${item.id}] 官網提取失敗，加入 Fallback 隊列`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️ ${task.bankName} 官網超時: ${err.message}`);
    task.mapping.forEach(m => failedSet.add(m.id));
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1200']
  });

  const failedBankIds = new Set();

  const tasks = [
    { bankName: 'HSBC Premier', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }] },
    { bankName: 'HSBC One', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', mapping: [{ id: 'hsbc_one', tier: 'HSBC One' }] },
    { bankName: 'BOC', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', mapping: [{ id: 'boc_wealth', tier: 'Global' }, { id: 'boc_standard', tier: 'Global' }] },
    { bankName: 'Citibank', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', extraWait: 12000, mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }] },
    { bankName: 'Standard Chartered', url: 'https://www.sc.com/hk/zh/deposits/board-rates/', extraWait: 15000, mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: 'Global' }] },
    { bankName: 'BEA', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', mapping: [{ id: 'bea_supreme', tier: 'SupremeGold' }] },
    { bankName: 'ICBC', url: 'https://www.icbcasia.com/hk/en/personal/latest-promotion/online-time-deposit.html', mapping: [{ id: 'icbc_elite', tier: 'Elite' }] },
    { bankName: 'CCB', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', mapping: [{ id: 'ccb_prestige', tier: 'Prestige' }] },
    { bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit', mapping: [{ id: 'za', tier: '港元' }] },
    { bankName: 'Fusion Bank', url: 'https://www.fusionbank.com/rate.html?lang=tc', mapping: [{ id: 'fusion', tier: 'HKD' }] },
    { bankName: 'PAOB', url: 'https://www.paob.com.hk/tc/deposit.html', mapping: [{ id: 'paob', tier: '個人客戶' }] }
  ];

  // 1. 嘗試官網抓取
  for (const t of tasks) await scrapeBank(browser, t, failedBankIds);

  // 2. 針對失敗的銀行執行 Fallback (U Lifestyle)
  await scrapeFallbackSource(browser, Array.from(failedBankIds));

  await browser.close();
  console.log('\n🎉 所有抓取與補全任務結束。');
}

run();