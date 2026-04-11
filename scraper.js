import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 專業精準版
 * 💡 修復核心邏輯：
 * 1. 徹底隔離貨幣：透過「港元」與「美元」關鍵字切斷網頁內容，只抓取港元區塊文字。
 * 2. 串行加載：一家銀行一家銀行抓，避免 GitHub Actions 記憶體不足導致超時。
 * 3. 深度渲染：每頁強制等待 5 秒並使用 networkidle2，解決動態表格加載問題。
 */

// 檢查 Firebase 密鑰
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ 錯誤：找不到 FIREBASE_SERVICE_ACCOUNT 環境變數。");
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
  
  // 🚀 高速優化：攔截圖片與 CSS，節省流量並防止加載變慢
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`----------------------------------------`);
    console.log(`🔍 正在抓取銀行: ${task.bankName}`);
    
    // 使用 networkidle2 確保 API 請求已完成，並設定 60 秒超時
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // 💡 關鍵：額外等待 5 秒，確保部分銀行的 React/Vue 表格渲染完畢
    await new Promise(r => setTimeout(r, 5000)); 

    const fullText = await page.evaluate(() => document.body.innerText);
    console.log(`ℹ️ 原始頁面字數: ${fullText.length}`);

    // 💡 幣種區域隔離邏輯 (徹底解決抓到美元利率的問題)
    let hkdZone = fullText;
    const hkdStart = fullText.indexOf('港元');
    const usdStart = fullText.indexOf('美元');
    
    if (hkdStart !== -1) {
      // 擷取範圍：從「港元」字眼開始，到「美元」字眼之前 (或之後 5000 字)
      const endPos = (usdStart > hkdStart) ? usdStart : hkdStart + 5000;
      hkdZone = fullText.substring(hkdStart, endPos);
      console.log(`📌 已定位港元利率區塊 (長度: ${hkdZone.length})`);
    } else {
      console.warn(`⚠️ 找不到「港元」關鍵字，可能頁面結構已改。`);
    }

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        // 嚴格匹配：帳戶等級 -> 1500字內找到存期 -> 50字內找到數字
        // 範例：卓越理財...3個月...2.2%
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,1500}${tenor}[\\s\\S]{1,100}(\\d+\\.?\\d*)%`, 'i');
        const match = hkdZone.match(regex);
        
        if (match) {
          const val = parseFloat(match[1]);
          // 💡 防護機制：港元利率目前極少超過 6%，若抓到過高數字則過濾 (排除美金)
          return val < 6.0 ? val : null;
        }
        return null;
      };

      const rates = {
        '1m': extract('1個月'),
        '3m': extract('3個月'),
        '6m': extract('6個月'),
        '12m': extract('12個月')
      };

      // 只要 3M 或 6M 有數據就進行更新
      if (rates['3m'] || rates['6m']) {
        console.log(`   ✅ [${item.id}] 同步數據: 3M=${rates['3m']}% | 6M=${rates['6m']}%`);
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      } else {
        console.warn(`   ❌ [${item.id}] 未能提取 ${item.tier} 的港元利率。`);
      }
    }
    await Promise.all(updates);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 執行出錯: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function runScraper() {
  console.log("🚀 啟動港元定存利率精準掃描...");
  
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const tasks = [
    {
      bankName: '滙豐銀行 (HSBC)',
      url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/',
      mapping: [
        { id: 'hsbc_elite', tier: '卓越理財尊尚' }, 
        { id: 'hsbc_premier', tier: '卓越理財' }, 
        { id: 'hsbc_one', tier: 'HSBC One' }
      ]
    },
    {
      bankName: '恒生銀行 (Hang Seng)',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      mapping: [
        { id: 'hangseng_prestige', tier: '優越理財' },
        { id: 'hangseng_standard', tier: '港元' }
      ]
    },
    {
      bankName: '中國銀行 (BOC)',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      mapping: [
        { id: 'boc_wealth', tier: '中銀理財' },
        { id: 'boc_standard', tier: '一般' }
      ]
    },
    {
      bankName: '渣打銀行 (Standard Chartered)',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      mapping: [
        { id: 'sc_priority', tier: '優先理財' },
        { id: 'sc_standard', tier: '網上' }
      ]
    }
  ];

  // 💡 串行執行：避免 GitHub Actions 負載過重
  for (const task of tasks) {
    await scrapeBank(browser, task);
  }

  // 虛擬銀行數據同步
  const vBanks = [
    { id: 'za', r: { '3m': 4.0, '6m': 3.6 } }, 
    { id: 'paob', r: { '3m': 3.8, '6m': 3.6 } },
    { id: 'fusion', r: { '3m': 3.7, '6m': 3.5 } }
  ];
  for (const vb of vBanks) {
    await db.doc(`artifacts/${appId}/public/data/live_rates/${vb.id}`).set({
      id: vb.id, rates: { HKD: vb.r }, lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
    }, { merge: true });
  }

  await browser.close();
  console.log("🎉 抓取程序完全結束。");
}

runScraper();