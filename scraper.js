import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 專業級精準抓取版 (2026 穩定優化版)
 * 💡 修復核心：
 * 1. 延遲加載：增加等待時間，確保 JavaScript 渲染的利率表完全出現。
 * 2. 嚴格隔離：強制要求數字附近必須緊貼「港元/HKD」關鍵字，解決誤抓 USD 問題。
 * 3. 診斷日誌：輸出更多調試信息到 GitHub Actions。
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

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  
  // 禁止載入媒體資源以加速
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log(`----------------------------------------`);
    console.log(`🔍 正在檢查銀行: ${task.bankName}`);
    
    // 💡 增加等待時間至 networkidle2 並額外等待，確保動態表格加載
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000)); 

    const fullText = await page.evaluate(() => document.body.innerText);
    console.log(`ℹ️ 頁面原始文字長度: ${fullText.length}`);

    // 💡 幣種區域精確切片 (HSBC 專用優化)
    let targetText = fullText;
    const hkdIndex = fullText.indexOf('港元');
    const usdIndex = fullText.indexOf('美元');
    
    if (hkdIndex !== -1) {
      const endPos = (usdIndex > hkdIndex) ? usdIndex : hkdIndex + 5000;
      targetText = fullText.substring(hkdIndex, endPos);
      console.log(`📌 已鎖定港元利率區塊 (長度: ${targetText.length})`);
    }

    const updates = [];
    for (const item of task.mapping) {
      const extract = (tenor) => {
        /**
         * 💡 精準正則邏輯：
         * 1. 找到帳戶等級 (tier)
         * 2. 在之後的 1000 字內找到存期 (tenor)
         * 3. 關鍵：在數字之前的 20 字內必須出現 港元/HKD
         * 4. 排除 3.4% 以上的美元利率
         */
        const regex = new RegExp(`${item.tier}[\\s\\S]{1,1000}${tenor}[\\s\\S]{1,100}(港元|HKD)[\\s\\S]{1,20}(\\d+\\.?\\d*)%`, 'i');
        const match = targetText.match(regex);
        
        if (match) {
          const val = parseFloat(match[2]);
          // 匯豐港元 3M 應在 2.0-2.5 之間，若抓到 3.0 以上則極大可能是美元
          if (task.bankName === 'HSBC' && val > 3.0) return null;
          return val;
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
        console.log(`✅ [${item.id}] 匹配成功! 3M=${rates['3m']}% | 6M=${rates['6m']}%`);
        updates.push(
          db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
            id: item.id,
            rates: { HKD: rates },
            lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
          }, { merge: true })
        );
      } else {
        console.warn(`❌ [${item.id}] 未能提取港元利率 (可能因貨幣過濾或查無數據)`);
      }
    }
    await Promise.all(updates);
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 抓取出錯: ${err.message}`);
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

  // 並行執行
  for (let i = 0; i < tasks.length; i += 2) {
    const batch = tasks.slice(i, i + 2);
    await Promise.all(batch.map(task => scrapeBank(browser, task)));
  }

  // 虛擬銀行靜態更新
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
  console.log("🎉 抓取程序執行完畢。請刷新追蹤器網頁查看正確數據。");
}

runScraper();