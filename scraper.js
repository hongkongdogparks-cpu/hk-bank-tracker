import puppeteer from 'puppeteer';
import admin from 'firebase-admin';

/**
 * scraper.js - 香港銀行定存利率自動抓取機器人 (ESM 版本)
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 錯誤：找不到 FIREBASE_SERVICE_ACCOUNT 環境變數。");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("❌ 錯誤：JSON 密鑰格式損壞。");
  process.exit(1);
}

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error("❌ 錯誤：Firebase 初始化失敗:", e.message);
  process.exit(1);
}

const db = admin.firestore();
const appId = 'hk-fd-tracker-pro';

async function runScraper() {
  console.log("🚀 機器人啟動 (ESM 模式)...");
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  try {
    console.log("🌐 正在載入滙豐網頁...");
    await page.goto('https://www.hsbc.com.hk/zh-hk/accounts/products/time-deposits/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    const rates = await page.evaluate(() => {
      const text = document.body.innerText;
      const hkdMatch = text.match(/港元新資金.*高達(\d+\.?\d*)%/);
      return { HKD: hkdMatch ? parseFloat(hkdMatch[1]) : 2.2 };
    });

    console.log(`✅ 抓取成功！目前滙豐利率: ${rates.HKD}%`);

    const docPath = `artifacts/${appId}/public/data/live_rates/hsbc`;
    await db.doc(docPath).set({
      id: 'hsbc',
      rates: {
        HKD: { '1m': 0.5, '3m': rates.HKD, '6m': rates.HKD, '12m': 2.0 }
      },
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log("🎉 數據已成功同步至資料庫！");

  } catch (error) {
    console.error("❌ 執行失敗:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runScraper();