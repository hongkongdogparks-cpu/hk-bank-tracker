import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 全港銀行終極抓取版 (修正版)
 * 💡 修復重點：
 * 1. 支援 ZA Bank 的「橫向存期」表格（存期在首行）。
 * 2. 支援 Fusion Bank 的「縱向存期」表格（存期在首列）。
 * 3. 加入所有 8 間虛擬銀行的抓取路徑。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT 缺失');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

// ── 注入瀏覽器的智慧解析引擎 ─────────────────────────────────────

const HELPERS = `
  const TENOR_MAP = {
    '1m': [/1\\s*個月/i, /1\\s*month/i, /1\\s*m/i],
    '3m': [/3\\s*個月/i, /3\\s*month/i, /3\\s*m/i],
    '6m': [/6\\s*個月/i, /6\\s*month/i, /6\\s*m/i],
    '12m': [/12\\s*個月/i, /1\\s*年/i, /12\\s*month/i, /1\\s*year/i, /12\\s*m/i]
  };

  function parseRate(text) {
    if (!text) return null;
    const m = text.match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v >= 0.01 && v < 15) ? v : null;
  }

  function normalizeTenor(text) {
    if (!text) return null;
    const t = text.trim();
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      if (regexes.some(re => re.test(t))) return key;
    }
    return null;
  }

  // 💡 多樣化表格解析核心
  function extractAnyTable(targetLabel) {
    const results = {};
    for (const table of document.querySelectorAll('table')) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) continue;

      // 檢查是否為橫向表格 (如 ZA Bank: 存期在首行)
      const headerCells = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const headerTenors = headerCells.map(normalizeTenor);
      
      if (headerTenors.some(Boolean)) {
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td,th')).map(c => c.innerText.trim());
          if (cells[0].includes(targetLabel) || targetLabel.includes(cells[0])) {
            headerTenors.forEach((tenor, idx) => {
              if (tenor && cells[idx]) {
                const r = parseRate(cells[idx]);
                if (r !== null) results[tenor] = r;
              }
            });
          }
        }
      }

      // 檢查是否為縱向表格 (如 Fusion Bank: 存期在首列)
      if (Object.keys(results).length === 0) {
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
          if (cells.length < 2) continue;
          const tenor = normalizeTenor(cells[0]);
          if (tenor) {
            // 在該行中尋找最高利率 (處理階梯利率)
            let maxRate = 0;
            for (let j = 1; j < cells.length; j++) {
              const r = parseRate(cells[j]);
              if (r && r > maxRate) maxRate = r;
            }
            if (maxRate > 0) results[tenor] = maxRate;
          }
        }
      }
      
      if (Object.keys(results).length > 0) break;
    }
    return results;
  }

  // 💡 備用語音/文字掃描器
  function extractByText(tierName) {
    const body = document.body.innerText.replace(/\\s+/g, ' ');
    const tierRegex = new RegExp(tierName, 'i');
    const match = body.match(tierRegex);
    if (!match) return null;
    const block = body.substring(match.index, match.index + 4000);
    const rates = {};
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      for (const re of regexes) {
        const tMatch = block.match(new RegExp(re.source, 'i'));
        if (tMatch) {
          const area = block.substring(tMatch.index, tMatch.index + 500);
          const r = parseRate(area);
          if (r !== null) { rates[key] = r; break; }
        }
      }
    }
    return Object.keys(rates).length > 0 ? rates : null;
  }
`;

// ── 抓取執行邏輯 ─────────────────────────────────────────────

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 正在抓取: ${task.bankName}`);

  try {
    const waitCond = task.bankName.includes('Standard') || task.bankName.includes('Fusion') ? 'domcontentloaded' : 'networkidle2';
    await page.goto(task.url, { waitUntil: waitCond, timeout: 95000 });
    await new Promise(r => setTimeout(r, task.extraWait || 9000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const data = {};
      mapping.forEach(m => {
        // 先嘗試智慧表格解析，這能處理 ZA 和 Fusion 的結構
        const tableData = extractAnyTable(m.tier);
        if (tableData && Object.keys(tableData).length > 0) {
          data[m.id] = tableData;
        } else {
          // 失敗則回退到文字區域掃描
          data[m.id] = extractByText(m.tier);
        }
      });
      return data;
    }, task.mapping, HELPERS);

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = results[item.id];
      if (rates && Object.keys(rates).length > 0) {
        console.log(`   ✅ [${item.id}] 同步成功: 3M=${rates['3m'] || '--'}% | 6M=${rates['6m'] || '--'}% | 12M=${rates['12m'] || '--'}%`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set({
          id: item.id, rates: { HKD: rates }, lastUpdated: now
        }, { merge: true });
      } else {
        console.warn(`   ❌ [${item.id}] 無法從頁面提取數據`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️ ${task.bankName} 出錯: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1200']
  });

  const tasks = [
    // --- 傳統大行 ---
    { bankName: 'HSBC Premier', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }] },
    { bankName: 'HSBC One', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', mapping: [{ id: 'hsbc_one', tier: 'HSBC One' }] },
    { bankName: 'Hang Seng', url: 'https://www.hangseng.com/zh-hk/personal/banking/rates/deposit-interest-rates/', mapping: [{ id: 'hangseng_prestige', tier: '優越理財' }, { id: 'hangseng_standard', tier: '一般帳戶' }] },
    { bankName: 'BOC', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', mapping: [{ id: 'boc_wealth', tier: '中銀理財' }, { id: 'boc_standard', tier: '一般客戶' }] },
    { bankName: 'Citibank', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', extraWait: 12000, mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }] },
    { bankName: 'Standard Chartered', url: 'https://www.sc.com/hk/zh/deposits/board-rates/', extraWait: 12000, mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: '網上特惠' }] },
    
    // --- 虛擬銀行補完 ---
    { bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit', mapping: [{ id: 'za', tier: '港元' }] },
    { bankName: 'Fusion Bank', url: 'https://www.fusionbank.com/rate.html?lang=tc', extraWait: 10000, mapping: [{ id: 'fusion', tier: 'HKD' }] },
    { bankName: 'Mox Bank', url: 'https://mox.com/zh/promotions/time-deposit/', mapping: [{ id: 'mox', tier: 'Mox定存' }] },
    { bankName: 'Livi Bank', url: 'https://www.livibank.com/zh_HK/rates.html', mapping: [{ id: 'livi', tier: '定期存款' }] },
    { bankName: 'WeLab Bank', url: 'https://www.welab.bank/zh/rates/', mapping: [{ id: 'welab', tier: '定期存款' }] },
    { bankName: 'Ant Bank', url: 'https://www.antbank.hk/rates', mapping: [{ id: 'ant', tier: '定期存款' }] },
    { bankName: 'PAOB', url: 'https://www.paob.com.hk/tc/deposit.html', mapping: [{ id: 'paob', tier: '個人客戶' }] },
    { bankName: 'Airstar Bank', url: 'https://www.airstarbank.com/zh-hk/deposit.html', mapping: [{ id: 'airstar', tier: '定期存款利率' }] }
  ];

  for (const t of tasks) await scrapeBank(browser, t);

  await browser.close();
  console.log('\n🎉 全港 15+ 銀行 (含所有虛擬銀行) 抓取任務完成。');
}

run();