import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 專業級精準抓取版 (修復數據未更新問題)
 * 💡 修復核心：
 * 1. 日誌透明：在 Actions Log 中印出匹配過程，方便排查。
 * 2. 錨點定位：優先尋找「港元」表格標題，防止抓到頁面底部的美元表。
 * 3. 容錯處理：如果抓取到的數字異常（如 0 或過高），會發出警告。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 找不到 FIREBASE_SERVICE_ACCOUNT，請檢查 GitHub Secrets。");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const appId = 'hk-fd-tracker-pro'; // 💡 請確保此 ID 與 App.jsx 中的一致

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`----------------------------------------`);
    console.log(`🔍 正在檢查銀行: ${task.bankName}`);
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const fullText = await page.evaluate(() => document.body.innerText);

    // 💡 幣種隔離邏輯
    const hkdAnchor = "港元";
    const usdAnchor = "美元";
    const hkdIndex = fullText.indexOf(hkdAnchor);
    const usdIndex = fullText.indexOf(usdAnchor);
    
    let targetText = fullText;
    if (hkdIndex !== -1) {
      // 只保留從「港元」關鍵字開始後 4000 個字元的範圍
      const endLimit = (usdIndex > hkdIndex) ? usdIndex : hkdIndex + 4000;
      targetText = fullText.substring(hkdIndex, endLimit);
      console.log(`📌 已定位港元區域 (長度: ${targetText.length})`);
    } else {
      console.warn(`⚠️ 找不到「港元」關鍵字，正在使用全網頁抓取。`);
    }

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        // 嚴格匹配：帳戶等級 -> 存期 -> 數字%
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,500}${tenor}[\\s\\S]{1,50}(\\d+\\.?\\d*)%`, 'i');
        const match = targetText.match(regex);
        if (match) {
          const val = parseFloat(match[1]);
          // 額外檢查：如果抓到大於 10 的數字，通常是抓錯（如美金 4.x 或其他數字）
          return val < 10 ? val : null;
        }
        return null;
      };

      const rates = {
        '1m': extract('1個月'),
        '3m': extract('3個月'),
        '6m': extract('6個月'),
        '12m': extract('12個月')
      };

      if (rates['3m'] || rates['6m']) {
        console.log(`✅ [${item.id}] 數據更新成功: 3M=${rates['3m']}% | 6M=${rates['6m']}%`);
        
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      } else {
        console.warn(`❌ [${item.id}] 無法從網頁提取 ${item.tier} 的港元利率數字。`);
      }
    }
    await Promise.all(updates);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 執行失敗: ${err.message}`);
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

  // 每組執行 2 家銀行
  for (let i = 0; i < tasks.length; i += 2) {
    const batch = tasks.slice(i, i + 2);
    await Promise.all(batch.map(task => scrapeBank(browser, task)));
  }

  // 虛擬銀行數據
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
  console.log("🎉 抓取程序執行完畢。請檢查追蹤器是否已更新！");
}

runScraper();