import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 全港銀行終極同步版
 * 💡 功能亮點：
 * 1. 採用用戶提供的精確 URL 集合。
 * 2. 支援 ZA 的橫向表格（存期在首行）與 BOC/Fusion 的縱向表格（存期在首列）。
 * 3. 內置 U Lifestyle Fallback 備援機制，確保官網改版時數據不中斷。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ 缺失環境變數: FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

const FALLBACK_URL = "https://hk.ulifestyle.com.hk/topic/detail/20053976/%E9%A6%99%E6%B8%AF%E9%8A%80%E8%A1%8C%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E5%AD%98%E6%AC%BE%E5%88%A9%E7%8E%87%E6%AF%94%E8%BC%83-%E6%9C%80%E6%96%B0%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E9%AB%98%E6%81%AF%E4%B9%8B%E9%81%B8-%E6%AF%8F%E6%97%A5%E6%9B%B4%E6%96%B0/6";

// ── 注入瀏覽器的解析引擎 ───────────────────────────────────────

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

  function extractAnyTable(targetLabel) {
    const results = {};
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;
      
      const fullText = table.innerText;
      if (targetLabel && !fullText.includes(targetLabel)) continue;

      const firstRow = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const headerTenors = firstRow.map(normalizeTenor);
      
      if (headerTenors.some(Boolean)) {
        // 模式 A: 存期在首行 (如 ZA)
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td,th')).map(c => c.innerText.trim());
          if (cells[0].includes(targetLabel) || targetLabel.includes(cells[0])) {
            headerTenors.forEach((tenor, idx) => {
              if (tenor && cells[idx]) {
                const r = parseRate(cells[idx]);
                if (r !== null) results[tenor] = r;
              }
            });
          }
        }
      } else {
        // 模式 B: 存期在第一列 (如 BOC, Fusion)
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
          const tenor = normalizeTenor(cells[0]);
          if (tenor) {
            for (let j = cells.length - 1; j >= 1; j--) {
              const r = parseRate(cells[j]);
              if (r !== null) { results[tenor] = r; break; }
            }
          }
        }
      }
      if (Object.keys(results).length > 0) break;
    }
    return results;
  }

  function extractByText(tierName) {
    const body = document.body.innerText.replace(/\\s+/g, ' ');
    const tierIdx = body.toLowerCase().indexOf(tierName.toLowerCase());
    if (tierIdx === -1) return {};
    const block = body.substring(tierIdx, tierIdx + 6000);
    const rates = {};
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      for (const re of regexes) {
        const m = block.match(new RegExp(re.source, 'i'));
        if (m) {
          const area = block.substring(m.index, m.index + 600);
          const r = parseRate(area);
          if (r !== null) { rates[key] = r; break; }
        }
      }
    }
    return rates;
  }
`;

// ── 核心功能函數 ──────────────────────────────────────────────

async function scrapeBank(browser, task, failedSet) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 正在抓取官網: ${task.bankName}`);
  try {
    const waitCond = (task.bankName.includes('SCB') || task.bankName.includes('Citi')) ? 'domcontentloaded' : 'networkidle2';
    await page.goto(task.url, { waitUntil: waitCond, timeout: 95000 });
    await new Promise(r => setTimeout(r, task.extraWait || 10000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const data = {};
      mapping.forEach(m => {
        let rates = extractAnyTable(m.tier);
        if (!rates || Object.keys(rates).length === 0) rates = extractByText(m.tier);
        data[m.id] = rates;
      });
      return data;
    }, task.mapping, HELPERS);

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = results[item.id];
      if (rates && Object.keys(rates).length > 0) {
        console.log(`   ✅ [${item.id}] 同步成功`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set({
          id: item.id, rates: { HKD: rates }, lastUpdated: now
        }, { merge: true });
      } else {
        failedSet.add(item.id);
        console.warn(`   ❌ [${item.id}] 提取失敗，加入 Fallback 隊列`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️ ${task.bankName} 出錯: ${err.message}`);
    task.mapping.forEach(m => failedSet.add(m.id));
  } finally {
    await page.close();
  }
}

async function scrapeFallback(browser, failedIds) {
  if (failedIds.length === 0) return;
  console.log(`\n🚨 啟動 Fallback: 嘗試從 U Lifestyle 補全 ${failedIds.length} 間銀行數據...`);
  const page = await browser.newPage();
  try {
    await page.goto(FALLBACK_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    const aliasMap = {
      'hsbc_elite': '匯豐', 'hsbc_premier': '匯豐', 'hsbc_one': 'HSBC One',
      'boc_wealth': '中銀', 'boc_standard': '中銀', 'citi_gold': '花旗',
      'za': 'ZA Bank', 'fusion': '富融', 'livi': 'Livi', 'airstar': '天星', 'paob': '平安'
    };
    for (const id of failedIds) {
      const term = aliasMap[id];
      if (!term) continue;
      const rates = await page.evaluate((t, h) => { eval(h); return extractByText(t); }, term, HELPERS);
      if (rates && Object.keys(rates).length > 0) {
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${id}`).set({
          id, rates: { HKD: rates }, lastUpdated: `Fallback: ${new Date().toLocaleString('zh-HK')}`
        }, { merge: true });
        console.log(`   💡 [${id}] 通過 Fallback 成功補全`);
      }
    }
  } catch (e) { console.error(e); } finally { await page.close(); }
}

// ── 執行主流程 ───────────────────────────────────────────────

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
    { bankName: 'BOC', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', mapping: [{ id: 'boc_wealth', tier: '定期存款' }, { id: 'boc_standard', tier: '定期存款' }] },
    { bankName: 'Citibank', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }] },
    { bankName: 'Standard Chartered', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', extraWait: 15000, mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: '網上特惠' }] },
    { bankName: 'BEA', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', mapping: [{ id: 'bea_supreme', tier: 'SupremeGold' }] },
    { bankName: 'ICBC', url: 'https://www.icbcasia.com/hk/tc/personal/latest-promotion/online-time-deposit.html', mapping: [{ id: 'icbc_elite', tier: '理財金' }] },
    { bankName: 'CCB', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', mapping: [{ id: 'ccb_prestige', tier: 'Prestige' }] },
    { bankName: 'Public Bank', url: 'https://www.publicbank.com.hk/en/usefultools/rates/depositinterestrates', mapping: [{ id: 'public_online', tier: 'Board Rate' }] },
    { bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit', mapping: [{ id: 'za', tier: '港元' }] },
    { bankName: 'Fusion Bank', url: 'https://www.fusionbank.com/deposit.html?lang=tc', mapping: [{ id: 'fusion', tier: 'HKD' }] },
    { bankName: 'Livi Bank', url: 'https://www.livibank.com/features/livisave.html', mapping: [{ id: 'livi', tier: '定期存款' }] },
    { bankName: 'Airstar Bank', url: 'https://www.airstarbank.com/en-hk/hkprime.html', mapping: [{ id: 'airstar', tier: 'Fixed Deposit' }] }
  ];

  for (const t of tasks) await scrapeBank(browser, t, failedBankIds);
  await scrapeFallback(browser, Array.from(failedBankIds));

  await browser.close();
  console.log('\n🎉 所有銀行抓取任務完全結束。');
}

run();