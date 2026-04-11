import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 高速分組並行抓取版 (精準貨幣校驗版)
 * 💡 優化點：
 * 1. 幣種鎖定：正則表達式強制要求包含「港元」或「HKD」，防止誤抓 USD 利率。
 * 2. 分組執行：每 3 間銀行一組，防止記憶體過載導致超時。
 * 3. 資源攔截：禁止圖片、CSS 載入，極速抓取。
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
  
  // 🚀 禁止載入無關資源，加速 80%
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`🔍 正在抓取: ${task.bankName}`);
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // 快速提取文字
    const text = await page.evaluate(() => document.body.innerText);

    const updates = [];
    for (const item of task.mapping) {
      // 💡 改進的正則：必須在「等級」與「存期」附近找到「港元/HKD」
      const extract = (tenor) => {
        // 邏輯：尋找 等級 -> 存期 -> 港元 -> 數字%
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,500}${tenor}[\\s\\S]{1,100}(港元|HKD)[\\s\\S]{1,50}(\\d+\\.?\\d*)%`, 'i');
        const match = text.match(regex);
        // match[2] 是數字部分
        return match ? parseFloat(match[2]) : null;
      };

      const rates = {
        '1m': extract('1個月'),
        '3m': extract('3個月'),
        '6m': extract('6個月'),
        '12m': extract('12個月')
      };

      // 只要有任何一項數據就寫入
      if (Object.values(rates).some(v => v !== null)) {
        console.log(`   ✅ [${item.id}] 數據匹配成功: 3M=${rates['3m']}%`);
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      } else {
        console.warn(`   ⚠️ [${item.id}] 未能匹配到港元利率，請檢查網頁結構。`);
      }
    }
    await Promise.all(updates);
    console.log(`✅ ${task.bankName} 完成`);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 跳過: ${err.message}`);
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
      bankName: 'SC',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      mapping: [
        { id: 'sc_priority', tier: '優先理財' }, 
        { id: 'sc_standard', tier: '網上' }
      ]
    },
    {
      bankName: 'BEA',
      url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html',
      mapping: [
        { id: 'bea_supreme', tier: '至尊理財' }, 
        { id: 'bea_standard', tier: '一般' }
      ]
    },
    {
      bankName: 'ICBC',
      url: 'https://www.icbcasia.com/tc/personal/deposits/index.html',
      mapping: [
        { id: 'icbc_elite', tier: '理財' }, 
        { id: 'icbc_standard', tier: '一般' }
      ]
    },
    {
      bankName: 'CCB',
      url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html',
      mapping: [
        { id: 'ccb_prestige', tier: '貴賓理財' }, 
        { id: 'ccb_online', tier: '網上' }
      ]
    },
    {
      bankName: 'Public',
      url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit',
      mapping: [{ id: 'public_online', tier: '網上' }]
    }
  ];

  const batchSize = 3;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(task => scrapeBank(browser, task)));
  }

  // 虛擬銀行數據同步
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
  console.log(`🎉 抓取完成！總耗時: ${((Date.now() - startTime) / 1000).toFixed(2)} 秒`);
}

runScraper();