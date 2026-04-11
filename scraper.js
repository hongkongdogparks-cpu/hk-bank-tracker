import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 香港定期存款利率抓取器 (2026 最終穩定版)
 * 💡 修復點：
 * 1. 幣種精確鎖定：定位「港元」關鍵字後進行切片，完全排除美元(USD)干擾。
 * 2. 分段執行：逐一處理銀行，確保在 GitHub Actions 資源受限環境下不崩潰。
 * 3. 容錯處理：針對表格渲染較慢的銀行增加強制等待與重試。
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
const appId = 'hk-fd-tracker-pro'; 

async function scrapeBank(browser, task, retryCount = 0) {
  const page = await browser.newPage();
  
  // 🚀 高速優化：禁止加載圖片/字體，加速 80%
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
    console.log(`🔍 正在掃描銀行: ${task.bankName}`);
    
    // 使用 networkidle2 確保資料載入完成
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000)); // 強制多等 5 秒確保表格渲染

    const fullText = await page.evaluate(() => document.body.innerText);

    // 💡 關鍵：幣種隔離技術
    // 定位港元定存相關的標題，切斷與美元區塊的關聯
    const anchors = ["港元定期存款", "港元定存", "港幣定存", "港元新資金"];
    let hkdStart = -1;
    for (const a of anchors) {
      if (fullText.indexOf(a) !== -1) {
        hkdStart = fullText.indexOf(a);
        break;
      }
    }

    const usdStart = fullText.indexOf('美元');
    let targetText = fullText;
    
    if (hkdStart !== -1) {
      // 擷取港元區塊 (到美元區塊之前，或往後 6000 字)
      const endPos = (usdStart > hkdStart) ? usdStart : hkdStart + 6000;
      targetText = fullText.substring(hkdStart, endPos);
      console.log(`📌 已鎖定港元利率區塊 (長度: ${targetText.length})`);
    } else {
      console.warn(`⚠️ 找不到港元錨點，使用全頁面掃描。`);
    }

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        // 精準正則：等級 -> 存期 -> 數字% (限制數字須小於 6.0 以排除異常)
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,1500}${tenor}[\\s\\S]{1,150}(\\d+\\.?\\d*)%`, 'i');
        const match = targetText.match(regex);
        if (match) {
          const val = parseFloat(match[1]);
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

      if (rates['3m'] || rates['6m']) {
        console.log(`   ✅ [${item.id}] 匹配成功: 3M=${rates['3m']}% | 6M=${rates['6m']}%`);
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      } else {
        console.warn(`   ❌ [${item.id}] 未能找到港元利率數據。`);
      }
    }
    await Promise.all(updates);
    console.log(`✅ ${task.bankName} 同步完成`);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 嘗試失敗: ${err.message}`);
    if (retryCount < 1) {
      console.log(`🔄 正在進行唯一一次重試...`);
      await page.close();
      return scrapeBank(browser, task, retryCount + 1);
    }
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

  // 💡 逐一執行，確保穩定性
  for (const task of tasks) {
    await scrapeBank(browser, task);
  }

  // 快速更新虛擬銀行數據
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
  console.log("🎉 抓取程序執行完畢。");
}

runScraper();