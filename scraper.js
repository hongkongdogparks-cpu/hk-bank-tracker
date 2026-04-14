import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 修復版
 * 解決路徑段數錯誤與 GitHub Action 超時問題
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ 缺失環境變數: FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

// 獲取並扁平化 APP_ID，防止路徑段數變成偶數
const rawAppId = process.env.APP_ID || 'hk-fd-tracker-pro';
const APP_ID = rawAppId.replace(/\//g, '_'); 

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 備援抓取地址 (當官網改版無法解析時使用)
const FALLBACK_URL = "https://hk.ulifestyle.com.hk/topic/detail/20053976/%E9%A6%99%E6%B8%AF%E9%8A%80%E8%A1%8C%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E5%AD%98%E6%AC%BE%E5%88%A9%E7%8E%87%E6%AF%94%E8%BC%83-%E6%9C%80%E6%96%B0%E6%B8%AF%E5%85%83%E5%AE%9A%E6%9C%9F%E9%AB%98%E6%81%AF%E4%B9%8B%E9%81%B8-%E6%AF%8F%E6%97%A5%E6%9B%B4%E6%96%B0/6";

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

async function scrapeBank(browser, task, failedSet) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 抓取中: ${task.bankName}`);
  try {
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 8000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const data = {};
      mapping.forEach(m => { data[m.id] = extractByText(m.tier); });
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
        console.warn(`   ❌ [${item.id}] 解析失敗`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️ ${task.bankName} 發生錯誤: ${err.message}`);
    task.mapping.forEach(m => failedSet.add(m.id));
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const failedBankIds = new Set();

  const tasks = [
    { bankName: 'HSBC', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }] },
    { bankName: 'Hang Seng', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', mapping: [{ id: 'hangseng_prestige_online', tier: '優越理財' }] },
    { bankName: 'BOC', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', mapping: [{ id: 'boc_wealth', tier: '中銀理財' }] },
    { bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit', mapping: [{ id: 'za_new', tier: '新客戶' }] }
  ];

  for (const t of tasks) await scrapeBank(browser, t, failedBankIds);
  
  await browser.close();
  console.log('\n🎉 抓取任務結束。');
  process.exit(0);
}

run();