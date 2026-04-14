import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 修復超時與路徑錯誤版
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT is missing');
  process.exit(1);
}

// 扁平化處理 appId，解決路徑段數為偶數導致的 Firebase 報錯
const rawAppId = process.env.APP_ID || 'hk-fd-tracker-pro';
const appId = rawAppId.replace(/\//g, '_'); 

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  try {
    console.log(`🔍 Processing: ${task.bankName}`);
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // 簡單延遲確保動態內容加載
    await new Promise(r => setTimeout(r, 5000));

    const rates = await page.evaluate(() => {
      const results = {};
      const bodyText = document.body.innerText;
      
      const findRate = (regex) => {
        const match = bodyText.match(regex);
        return match ? parseFloat(match[1]) : null;
      };

      // 簡易抓取邏輯 (可根據具體銀行頁面結構擴展)
      results['3m'] = findRate(/3\s*個月.*?(\d+\.\d+)%/i);
      results['6m'] = findRate(/6\s*個月.*?(\d+\.\d+)%/i);
      results['12m'] = findRate(/12\s*個月.*?(\d+\.\d+)%/i);
      
      return results;
    });

    if (Object.values(rates).some(v => v !== null)) {
      const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
      const docRef = db.doc(`artifacts/${appId}/public/data/live_rates/${task.id}`);
      await docRef.set({
        id: task.id,
        rates: { HKD: rates },
        lastUpdated: `Live: ${now}`
      }, { merge: true });
      console.log(`   ✅ Synced: ${task.id}`);
    }
  } catch (err) {
    console.error(`   ⚠️ Failed: ${task.bankName} - ${err.message}`);
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const tasks = [
    { id: 'hsbc_premier', bankName: 'HSBC', url: 'https://www.hsbc.com.hk/zh-hk/premier/offers/time-deposit-rate/' },
    { id: 'za_new', bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit' }
  ];

  for (const t of tasks) await scrapeBank(browser, t);

  await browser.close();
  console.log('🎉 Scraper completed successfully.');
  process.exit(0); // 強制退出確保 Action 結束
}

run();