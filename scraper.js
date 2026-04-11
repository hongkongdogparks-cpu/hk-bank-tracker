import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 高速並行抓取版
 * 💡 優化點：
 * 1. 資源攔截：不載入圖片、CSS、字體，僅抓取純文字。
 * 2. 並行處理：使用 Promise.all 同時抓取多家銀行。
 * 3. 快速導航：使用 'domcontentloaded' 代替 'networkidle2'。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 找不到 Firebase 憑證");
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
  
  // 🚀 高速優化：攔截不必要的請求
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`🔍 正在抓取: ${task.bankName}`);
    // 使用 domcontentloaded 縮短等待時間
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 等待核心內容出現（最多等 5 秒）
    await page.waitForSelector('body', { timeout: 5000 });
    const text = await page.evaluate(() => document.body.innerText);

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,500}${tenor}[\\s\\S]{1,100}(\\d+\\.?\\d*)%`, 'i');
        const match = text.match(regex);
        return match ? parseFloat(match[1]) : null;
      };

      const rates = {
        '1m': extract('1個月'),
        '3m': extract('3個月'),
        '6m': extract('6個月'),
        '12m': extract('12個月')
      };

      if (rates['3m'] || rates['6m']) {
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
    console.log(`✅ ${task.bankName} 同步完成`);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 失敗: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function runScraper() {
  const startTime = Date.now();
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const tasks = [
    {
      bankName: 'HSBC',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }, { id: 'hsbc_one', tier: 'HSBC One' }]
    },
    {
      bankName: 'Hang Seng',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      mapping: [{ id: 'hangseng_prestige', tier: '優越理財' }, { id: 'hangseng_standard', tier: '港元' }]
    },
    {
      bankName: 'BOC',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      mapping: [{ id: 'boc_wealth', tier: '中銀理財' }, { id: 'boc_standard', tier: '一般' }]
    }
  ];

  // 💡 並行執行所有抓取任務
  await Promise.all(tasks.map(task => scrapeBank(browser, task)));

  await browser.close();
  console.log(`🎉 總耗時: ${((Date.now() - startTime) / 1000).toFixed(2)} 秒`);
}

runScraper();