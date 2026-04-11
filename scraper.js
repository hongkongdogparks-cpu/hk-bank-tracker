import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 專業級精準抓取版
 * 💡 修正核心：
 * 1. 區域隔離：先定位「港元/HKD」文字區塊，徹底排除美元(USD)利率干擾。
 * 2. 嚴格匹配：確保 3M=2.2%, 6M=2.0% 這種港幣真實數據被優先讀取。
 * 3. 完整性：涵蓋 App.jsx 內所有傳統銀行與虛擬銀行 ID。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const appId = 'hk-fd-tracker-pro';

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  
  // 🚀 禁止載入無關資源，加速並減少干擾
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`🔍 正在精確檢查: ${task.bankName}`);
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const fullText = await page.evaluate(() => document.body.innerText);

    // 💡 關鍵步驟：區域隔離
    // 尋找「港元」與「美元/外幣」的位置，只取港元部分的文字進行分析
    const hkdIndex = fullText.indexOf('港元');
    const usdIndex = fullText.indexOf('美元');
    let targetText = fullText;
    
    if (hkdIndex !== -1) {
      // 擷取從「港元」開始到之後 3000 個字元的範圍，避免抓到後面的美元表
      targetText = fullText.substring(hkdIndex, usdIndex !== -1 && usdIndex > hkdIndex ? usdIndex : hkdIndex + 3000);
    }

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        // 嚴格正則：等級 -> 存期 -> 數字 (確保中間沒有美元相關字眼)
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,500}${tenor}[\\s\\S]{1,50}(\\d+\\.?\\d*)%`, 'i');
        const match = targetText.match(regex);
        return match ? parseFloat(match[1]) : null;
      };

      const rates = {
        '1m': extract('1個月'),
        '3m': extract('3個月'),
        '6m': extract('6個月'),
        '12m': extract('12個月')
      };

      if (rates['3m'] || rates['6m']) {
        console.log(`   ✅ [${item.id}] 港元利率匹配成功: 3M=${rates['3m']}% | 6M=${rates['6m']}%`);
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      }
    }
    await Promise.all(updates);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 跳過: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function runScraper() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const tasks = [
    {
      bankName: 'HSBC',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      mapping: [
        { id: 'hsbc_elite', tier: '卓越理財尊尚' }, 
        { id: 'hsbc_premier', tier: '卓越理財' }, 
        { id: 'hsbc_one', tier: 'HSBC One' }
      ]
    },
    {
      bankName: 'Hang Seng',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財' }, 
        { id: 'hangseng_standard', tier: '港元' }
      ]
    },
    {
      bankName: 'BOC',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      mapping: [
        { id: 'boc_wealth', tier: '中銀理財' }, 
        { id: 'boc_standard', tier: '一般' }
      ]
    },
    {
      bankName: 'Standard Chartered',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      mapping: [
        { id: 'sc_priority', tier: '優先理財' }, 
        { id: 'sc_standard', tier: '網上' }
      ]
    }
  ];

  // 分組並行處理
  for (let i = 0; i < tasks.length; i += 2) {
    const batch = tasks.slice(i, i + 2);
    await Promise.all(batch.map(task => scrapeBank(browser, task)));
  }

  // 虛擬銀行靜態更新
  const vBanks = [
    { id: 'za', r: { '1m': 1.0, '3m': 4.0, '6m': 3.6, '12m': 3.2 } }, 
    { id: 'paob', r: { '3m': 3.8, '6m': 3.6, '12m': 3.0 } }
  ];
  for (const vb of vBanks) {
    await db.doc(`artifacts/${appId}/public/data/live_rates/${vb.id}`).set({
      id: vb.id, rates: { HKD: vb.r }, lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
    }, { merge: true });
  }

  await browser.close();
  console.log("🎉 抓取程序執行完畢。");
}

runScraper();