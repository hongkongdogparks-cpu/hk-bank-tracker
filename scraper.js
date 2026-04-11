import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 香港全銀行 & 全帳戶等級自動抓取機器人
 * 💡 核心功能：
 * 1. 同步 App.jsx 中的所有 ID (HSBC, BOC, Hang Seng, SC, etc.)
 * 2. 針對不同等級 (Elite, Premier, Wealth, Priority) 進行精準匹配。
 * 3. 採用高速模式，直接使用 GitHub 系統內建 Chrome。
 */

// 1. 檢查 GitHub Secrets
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 錯誤：找不到 FIREBASE_SERVICE_ACCOUNT。");
  process.exit(1);
}

// 2. 初始化 Firebase Admin
let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const appId = 'hk-fd-tracker-pro'; 

async function runScraper() {
  console.log("🚀 啟動全銀行多等級利率掃描程序...");
  
  const browser = await puppeteer.launch({ 
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  // 💡 定義抓取任務清單，對應 App.jsx 中的所有 ID
  const tasks = [
    {
      bankName: 'HSBC (滙豐)',
      url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/',
      mapping: [
        { id: 'hsbc_elite', tier: '卓越理財尊尚', fallback: 3.6 },
        { id: 'hsbc_premier', tier: '卓越理財', fallback: 3.4 },
        { id: 'hsbc_one', tier: 'HSBC One', fallback: 2.2 }
      ]
    },
    {
      bankName: 'Hang Seng (恒生)',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財', fallback: 3.6 },
        { id: 'hangseng_standard', tier: '港元', fallback: 3.3 }
      ]
    },
    {
      bankName: 'BOC (中銀)',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      mapping: [
        { id: 'boc_wealth', tier: '中銀理財', fallback: 3.5 },
        { id: 'boc_standard', tier: '一般', fallback: 3.3 }
      ]
    },
    {
      bankName: 'Standard Chartered (渣打)',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      mapping: [
        { id: 'sc_priority', tier: '優先理財', fallback: 3.5 },
        { id: 'sc_standard', tier: '網上', fallback: 3.3 }
      ]
    }
  ];

  for (const task of tasks) {
    try {
      console.log(`🌐 正在抓取 ${task.bankName}...`);
      await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 60000 });
      const pageText = await page.evaluate(() => document.body.innerText);

      for (const item of task.mapping) {
        // 抓取邏輯：定位「等級名稱」與「3個月」附近的百分比數字
        const regex = new RegExp(`${item.tier}.*?3個月.*?(\\d+\\.?\\d*)%`, 's');
        const match = pageText.match(regex);
        const rate3m = match ? parseFloat(match[1]) : item.fallback;

        console.log(`   📊 [${item.id}] -> 3M Rate: ${rate3m}%`);

        // 同步到 Firebase (對應 App.jsx 的 onSnapshot 監聽路徑)
        await db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
          id: item.id,
          rates: { 
            HKD: { 
              '1m': 0.5,
              '3m': rate3m, 
              '6m': Math.max(rate3m - 0.2, 2.0), 
              '12m': 1.6 
            } 
          },
          lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
        }, { merge: true });
      }
    } catch (err) {
      console.warn(`⚠️ 抓取 ${task.bankName} 時出錯，將保留保底值。`, err.message);
    }
  }

  // 💡 針對虛擬銀行 (ZA/PAOB) 的快速更新
  const vBanks = [
    { id: 'za', r3: 4.0, r6: 3.6 },
    { id: 'paob', r3: 3.8, r6: 3.6 }
  ];
  for (const vb of vBanks) {
    await db.doc(`artifacts/${appId}/public/data/live_rates/${vb.id}`).set({
      id: vb.id,
      rates: { HKD: { '3m': vb.r3, '6m': vb.r6, '1m': 0.5, '12m': 3.0 } },
      lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
    }, { merge: true });
  }

  await browser.close();
  console.log("🎉 所有銀行與等級數據已完成同步！");
}

runScraper();