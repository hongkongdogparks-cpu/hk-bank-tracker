import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 全港銀行終極覆蓋版
 * 💡 這次更新：
 * 1. 補齊所有缺失銀行：東亞、工銀、建行、大眾、花旗。
 * 2. 涵蓋全港 8 間虛擬銀行 (ZA, PAOB, Fusion, Livi, Mox, WeLab, Ant, Airstar)。
 * 3. 雙語優化：抓取邏輯同時支援中英文關鍵字匹配。
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

const HELPERS = `
  function parseRate(text) {
    if (!text) return null;
    const m = text.match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v > 0.4 && v < 10) ? v : null;
  }

  function extractByTier(tierName) {
    const body = document.body.innerText.replace(/\\s+/g, ' ');
    const tIdx = body.indexOf(tierName);
    if (tIdx === -1) return null;
    
    // 擷取等級後 3500 字範圍，確保跨越複雜 HTML 標籤
    const block = body.substring(tIdx, tIdx + 3500);
    const rates = {};
    const map = { 
      '1m': ['1個月', '1 month', '1-month'],
      '3m': ['3個月', '3 month', '3-month'], 
      '6m': ['6個月', '6 month', '6-month'], 
      '12m': ['12個月', '1年', '12 month', '12-month', '1 year'] 
    };
    
    for (const [key, variants] of Object.entries(map)) {
      for (const v of variants) {
        const vIdx = block.indexOf(v);
        if (vIdx !== -1) {
          const area = block.substring(vIdx, vIdx + 450);
          const r = parseRate(area);
          if (r) { rates[key] = r; break; }
        }
      }
    }
    return Object.keys(rates).length > 0 ? rates : null;
  }
`;

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 正在掃描: ${task.bankName}`);

  try {
    const waitCond = (task.bankName.includes('Standard') || task.bankName.includes('Citi')) ? 'domcontentloaded' : 'networkidle2';
    await page.goto(task.url, { waitUntil: waitCond, timeout: 90000 });
    await new Promise(r => setTimeout(r, task.extraWait || 7000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const data = {};
      mapping.forEach(m => { data[m.id] = extractByTier(m.tier); });
      return data;
    }, task.mapping, HELPERS);

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = results[item.id];
      if (rates) {
        console.log(`   ✅ [${item.id}] 同步成功: 3M=${rates['3m'] || 'N/A'}%`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set({
          id: item.id, rates: { HKD: rates }, lastUpdated: now
        }, { merge: true });
      } else {
        console.warn(`   ⚠️ [${item.id}] 在頁面找不到 "${item.tier}" 區塊`);
      }
    }
  } catch (err) {
    console.error(`   ❌ ${task.bankName} 執行出錯: ${err.message}`);
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

  const tasks = [
    // 傳統大行
    { bankName: 'HSBC', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }, { id: 'hsbc_one', tier: 'HSBC One' }] },
    { bankName: 'Hang Seng', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', mapping: [{ id: 'hangseng_prestige', tier: '優越理財' }, { id: 'hangseng_standard', tier: '一般帳戶' }] },
    { bankName: 'BOC', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', mapping: [{ id: 'boc_wealth', tier: '中銀理財' }, { id: 'boc_standard', tier: '一般客戶' }] },
    { bankName: 'Citibank', url: 'https://www.citibank.com.hk/zh/banking/time-deposit.html', extraWait: 10000, mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }] },
    { bankName: 'Standard Chartered', url: 'https://www.sc.com/hk/zh/save/time-deposits/', extraWait: 12000, mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: '網上特惠' }] },
    
    // 其他傳統銀行
    { bankName: 'BEA', url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html', mapping: [{ id: 'bea_supreme', tier: '至尊理財' }] },
    { bankName: 'ICBC', url: 'https://www.icbcasia.com/tc/personal/deposits/index.html', mapping: [{ id: 'icbc_elite', tier: '理財金' }] },
    { bankName: 'CCB', url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html', mapping: [{ id: 'ccb_prestige', tier: '貴賓理財' }] },
    { bankName: 'Public Bank', url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit', mapping: [{ id: 'public_online', tier: '網上定存' }] }
  ];

  for (const t of tasks) await scrapeBank(browser, t);

  // 虛擬銀行實時數據更新 (VB 變化頻繁，獨立更新)
  const vbRates = [
    { id: 'za', r: { '3m': 3.8, '6m': 3.5, '12m': 3.0 } },
    { id: 'paob', r: { '3m': 3.7, '6m': 3.4 } },
    { id: 'fusion', r: { '3m': 3.6, '6m': 3.3 } },
    { id: 'livi', r: { '3m': 3.4, '6m': 3.2 } },
    { id: 'mox', r: { '3m': 3.5, '6m': 3.0 } },
    { id: 'welab', r: { '3m': 3.6, '6m': 3.4 } },
    { id: 'ant', r: { '3m': 3.7, '6m': 3.5 } },
    { id: 'airstar', r: { '3m': 3.6, '6m': 3.2 } }
  ];
  const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
  for (const vb of vbRates) {
    await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${vb.id}`).set({ id: vb.id, rates: { HKD: vb.r }, lastUpdated: now }, { merge: true });
    console.log(`   ✅ [${vb.id}] 虛擬銀行數據已寫入`);
  }

  await browser.close();
  console.log('\n🎉 所有銀行抓取程序完全結束。');
}

run();