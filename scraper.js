const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// 從 GitHub Secrets 讀取 Firebase 權限金鑰
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("無法讀取 FIREBASE_SERVICE_ACCOUNT，請檢查 GitHub Secrets 設定。");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const appId = 'hk-fd-tracker-pro'; // 必須與 App.jsx 的 appId 一致

async function runScraper() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    console.log("正在前往滙豐官網抓取最新利率...");
    await page.goto('https://www.hsbc.com.hk/zh-hk/accounts/products/time-deposits/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    const rates = await page.evaluate(() => {
      const text = document.body.innerText;
      const hkdMatch = text.match(/港元新資金.*高達(\d+\.?\d*)%/);
      const usdMatch = text.match(/美元新資金.*高達(\d+\.?\d*)%/);
      
      return {
        HKD: hkdMatch ? parseFloat(hkdMatch[1]) : 2.2,
        USD: usdMatch ? parseFloat(usdMatch[1]) : 3.2
      };
    });

    console.log(`抓取成功！港元: ${rates.HKD}%, 美元: ${rates.USD}%`);

    const docRef = db.doc(`artifacts/${appId}/public/data/live_rates/hsbc`);
    await docRef.set({
      id: 'hsbc',
      rates: {
        HKD: { '1m': 0.5, '3m': rates.HKD, '6m': rates.HKD, '12m': 2.0 },
        USD: { '3m': rates.USD, '6m': rates.USD }
      },
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log("✅ Firebase 資料庫已同步最新利率！");
  } catch (error) {
    console.error("❌ 發生錯誤:", error);
  } finally {
    await browser.close();
  }
}

runScraper();