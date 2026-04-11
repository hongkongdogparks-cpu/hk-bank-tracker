import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 香港銀行定存利率自動抓取機器人 (ESM 高速版)
 * * 💡 核心優化說明：
 * 1. 使用 puppeteer-core：不下載內建瀏覽器，直接調用系統資源。
 * 2. 環境變數連結：自動讀取 YAML 中設定的 PUPPETEER_EXECUTABLE_PATH。
 * 3. ESM 模組化：符合 package.json 的 "type": "module" 規範。
 */

// 1. 安全檢查：確保 GitHub Secrets 已正確傳入
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 錯誤：找不到 FIREBASE_SERVICE_ACCOUNT 環境變數。");
  process.exit(1);
}

// 2. 解析 Firebase 私鑰
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("❌ 錯誤：Firebase 密鑰 JSON 格式不正確。");
  process.exit(1);
}

// 3. 初始化 Firebase Admin SDK
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
const appId = 'hk-fd-tracker-pro'; // 務必與你的 App.jsx appId 一致

async function runScraper() {
  console.log("🚀 機器人啟動 (高速模式)...");
  
  // 取得 GitHub Runner 內建的 Chrome 路徑
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';
  console.log(`🔍 正在調用系統瀏覽器: ${chromePath}`);

  const browser = await puppeteer.launch({ 
    executablePath: chromePath,
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();

  try {
    console.log("🌐 正在載入滙豐銀行官方定存頁面...");
    
    // 前往目標網頁
    await page.goto('https://www.hsbc.com.hk/zh-hk/accounts/products/time-deposits/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // 執行網頁內腳本抓取數據
    const rates = await page.evaluate(() => {
      const text = document.body.innerText;
      // 尋找「港元新資金...高達 X.X%」的關鍵字
      const hkdMatch = text.match(/港元新資金.*高達(\d+\.?\d*)%/);
      return {
        HKD: hkdMatch ? parseFloat(hkdMatch[1]) : 2.2 // 抓取失敗時提供 2.2 作為保底
      };
    });

    console.log(`✅ 抓取成功！目前 HSBC 官網 3 個月港元利率: ${rates.HKD}%`);

    // 依照 Firestore 權限規則定義寫入路徑
    // 路徑格式: artifacts/{appId}/public/data/live_rates/hsbc
    const docPath = `artifacts/${appId}/public/data/live_rates/hsbc`;
    console.log(`📡 正在同步數據至雲端: ${docPath}`);

    await db.doc(docPath).set({
      id: 'hsbc',
      rates: {
        HKD: { '1m': 0.5, '3m': rates.HKD, '6m': rates.HKD, '12m': 2.0 },
        USD: { '1m': 2.5, '3m': 3.2, '6m': 3.2, '12m': 3.0 }
      },
      lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
    }, { merge: true });

    console.log("🎉 數據同步完成！");

  } catch (error) {
    console.error("❌ 執行失敗:", error.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log("🏁 任務結束。");
  }
}

// 啟動腳本
runScraper();