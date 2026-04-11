import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 最終修復版
 * 💡 策略：使用「近距離尋找」取代「單一正則」。
 * 只要在【帳戶等級】附近出現【存期】，並在存期附近出現【數字%】，即視為匹配。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
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
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  try {
    console.log(`----------------------------------------`);
    console.log(`🔍 正在掃描銀行: ${task.bankName}`);
    
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 6000)); 

    const fullText = await page.evaluate(() => document.body.innerText);

    // 💡 幣種預處理：尋找港元區塊
    const hkdIndex = fullText.indexOf('港元');
    const usdIndex = fullText.indexOf('美元');
    const targetText = (hkdIndex !== -1) ? fullText.substring(hkdIndex, usdIndex > hkdIndex ? usdIndex : hkdIndex + 8000) : fullText;

    console.log(`ℹ️ 目標區塊字數: ${targetText.length}`);

    for (const item of task.mapping) {
      const rates = {};
      const tenors = ['3個月', '6個月', '12個月', '1個月'];
      
      const tierIndex = targetText.indexOf(item.tier);
      if (tierIndex === -1) {
        console.warn(`   ❌ 找不到等級: ${item.tier}`);
        continue;
      }

      // 在等級後 2500 字內尋找利率
      const tierBlock = targetText.substring(tierIndex, tierIndex + 2500);

      tenors.forEach(tenor => {
        const tKey = tenor.replace('個月', 'm');
        const tenorIndex = tierBlock.indexOf(tenor);
        
        if (tenorIndex !== -1) {
          // 在存期後 300 字內尋找第一個 % 數字
          const rateBlock = tierBlock.substring(tenorIndex, tenorIndex + 300);
          const rateMatch = rateBlock.match(/(\d+\.?\d*)\s*%/);
          
          if (rateMatch) {
            const val = parseFloat(rateMatch[1]);
            if (val > 0.1 && val < 6.0) {
              rates[tKey] = val;
            }
          }
        }
      });

      if (Object.keys(rates).length > 0) {
        console.log(`   ✅ [${item.id}] 匹配成功: 3M=${rates['3m'] || 'N/A'}% | 6M=${rates['6m'] || 'N/A'}%`);
        await db.doc(`artifacts/${appId}/public/data/live_rates/${item.id}`).set({
          id: item.id,
          rates: { HKD: rates },
          lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
        }, { merge: true });
      } else {
        console.warn(`   ❌ [${item.id}] 未能在 ${item.tier} 附近找到任何利率數字。`);
      }
    }
  } catch (err) {
    console.error(`⚠️ ${task.bankName} 失敗: ${err.message}`);
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
      mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }, { id: 'hsbc_one', tier: 'HSBC One' }]
    },
    {
      bankName: 'Hang Seng',
      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/',
      mapping: [{ id: 'hangseng_prestige', tier: '優越理財' }, { id: 'hangseng_standard', tier: '港元' }]
    },
    {
      bankName: 'BOC',
      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',
      mapping: [{ id: 'boc_wealth', tier: '中銀理財' }, { id: 'boc_standard', tier: '一般' }]
    },
    {
      bankName: 'Citibank',
      url: 'https://www.citibank.com.hk/zh/banking/time-deposit.html',
      mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }]
    },
    {
      bankName: 'SC',
      url: 'https://www.sc.com/hk/zh/save/time-deposits/',
      mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: '網上' }]
    }
  ];

  for (const task of tasks) await scrapeBank(browser, task);

  // 靜態同步虛擬銀行
  const vBanks = [{ id: 'za', r: { '3m': 4.0, '6m': 3.6 } }, { id: 'paob', r: { '3m': 3.8, '6m': 3.6 } }];
  for (const vb of vBanks) {
    await db.doc(`artifacts/${appId}/public/data/live_rates/${vb.id}`).set({
      id: vb.id, rates: { HKD: vb.r }, lastUpdated: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
    }, { merge: true });
  }

  await browser.close();
  console.log("🎉 抓取程序完全結束。");
}

runScraper();