import puppeteer from 'puppeteer-core';
import admin from 'firebase-admin';

/**
 * scraper.js - 2026 全港銀行終極修復版
 * 💡 修復重點：
 * 1. 針對 ZA (橫向)、Fusion (縱向)、BOC (高精度) 表格進行專項邏輯重寫。
 * 2. 強化「表格自動識別」功能，掃描所有 table 元素並尋找存期/利率對。
 * 3. 補齊全港 8 間虛擬銀行，確保數據不遺漏。
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

const HELPERS = `
  const TENOR_MAP = {
    '1m': [/1\\s*個月/i, /1\\s*month/i, /1\\s*m/i],
    '3m': [/3\\s*個月/i, /3\\s*month/i, /3\\s*m/i],
    '6m': [/6\\s*個月/i, /6\\s*month/i, /6\\s*m/i],
    '12m': [/12\\s*個月/i, /1\\s*年/i, /12\\s*month/i, /1\\s*year/i, /12\\s*m/i]
  };

  function parseRate(text) {
    if (!text) return null;
    const clean = text.replace(/\\s/g, '');
    const m = clean.match(/(\\d+\\.?\\d*)\\s*%/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v >= 0.001 && v < 15) ? v : null;
  }

  function normalizeTenor(text) {
    if (!text) return null;
    const t = text.trim();
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      if (regexes.some(re => re.test(t))) return key;
    }
    return null;
  }

  // 💡 強化版表格解析器：自動搜尋頁面內所有可能的數據
  function autoExtractTables() {
    const allData = {};
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) return;

      // 測試模式 A: 橫向 (Header 是存期，如 ZA)
      const firstRow = Array.from(rows[0].querySelectorAll('th,td')).map(c => c.innerText.trim());
      const headerTenors = firstRow.map(normalizeTenor);
      
      if (headerTenors.some(Boolean)) {
        rows.slice(1).forEach(row => {
          const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
          const label = cells[0] || 'Unknown';
          const rates = {};
          headerTenors.forEach((tenor, idx) => {
            if (tenor && cells[idx]) {
              const r = parseRate(cells[idx]);
              if (r !== null) rates[tenor] = r;
            }
          });
          if (Object.keys(rates).length > 0) allData[label] = rates;
        });
      }

      // 測試模式 B: 縱向 (第一列是存期，如 Fusion, BOC)
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td,th')).map(c => c.innerText.trim());
        const tenor = normalizeTenor(cells[0]);
        if (tenor) {
          // 在該行中尋找看起來像利率的數字
          for (let i = 1; i < cells.length; i++) {
            const r = parseRate(cells[i]);
            if (r !== null) {
              if (!allData['Global']) allData['Global'] = {};
              // 如果有多個金額階梯，取最高值
              if (!allData['Global'][tenor] || r > allData['Global'][tenor]) {
                allData['Global'][tenor] = r;
              }
            }
          }
        }
      });
    });
    return allData;
  }

  // 💡 備用文字掃描器
  function extractByText(tierName) {
    const body = document.body.innerText.replace(/\\s+/g, ' ');
    const tierIdx = body.toLowerCase().indexOf(tierName.toLowerCase());
    if (tierIdx === -1) return null;
    
    const block = body.substring(tierIdx, tierIdx + 5000);
    const rates = {};
    for (const [key, regexes] of Object.entries(TENOR_MAP)) {
      for (const re of regexes) {
        const m = block.match(new RegExp(re.source, 'i'));
        if (m) {
          const area = block.substring(m.index, m.index + 500);
          const r = parseRate(area);
          if (r !== null) { rates[key] = r; break; }
        }
      }
    }
    return rates;
  }
`;

async function scrapeBank(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  
  console.log(`\n🔍 正在抓取: ${task.bankName}`);

  try {
    const waitCond = task.waitUntil || 'networkidle2';
    await page.goto(task.url, { waitUntil: waitCond, timeout: 95000 });
    await new Promise(r => setTimeout(r, task.extraWait || 10000));

    const results = await page.evaluate((mapping, helpers) => {
      eval(helpers);
      const tableData = autoExtractTables();
      const final = {};
      
      mapping.forEach(m => {
        // 優先從表格數據中匹配標籤
        let found = null;
        for (const [label, rates] of Object.entries(tableData)) {
          if (label.toLowerCase().includes(m.tier.toLowerCase()) || m.tier.toLowerCase().includes(label.toLowerCase()) || label === 'Global') {
            found = rates;
            if (label !== 'Global') break; // 優先匹配精確標籤
          }
        }
        
        // 如果表格沒抓到，嘗試全文掃描
        if (!found || Object.keys(found).length === 0) {
          found = extractByText(m.tier);
        }
        final[m.id] = found;
      });
      return final;
    }, task.mapping, HELPERS);

    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
    for (const item of task.mapping) {
      const rates = results[item.id];
      if (rates && Object.keys(rates).length > 0) {
        const out = Object.entries(rates).map(([k,v]) => `${k.toUpperCase()}=${v}%`).join(' | ');
        console.log(`   ✅ [${item.id}] 同步成功: ${out}`);
        await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${item.id}`).set({
          id: item.id, rates: { HKD: rates }, lastUpdated: now
        }, { merge: true });
      } else {
        console.warn(`   ❌ [${item.id}] 無法從頁面提取數據 (${item.tier})`);
      }
    }
  } catch (err) {
    console.error(`   ⚠️ ${task.bankName} 失敗: ${err.message}`);
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
    { bankName: 'HSBC Premier', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', mapping: [{ id: 'hsbc_elite', tier: '卓越理財尊尚' }, { id: 'hsbc_premier', tier: '卓越理財' }] },
    { bankName: 'HSBC One', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', mapping: [{ id: 'hsbc_one', tier: 'HSBC One' }] },
    { bankName: 'Hang Seng', url: 'https://www.hangseng.com/zh-hk/personal/banking/rates/deposit-interest-rates/', mapping: [{ id: 'hangseng_prestige', tier: '優越理財' }, { id: 'hangseng_standard', tier: '一般帳戶' }] },
    { bankName: 'BOC', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', mapping: [{ id: 'boc_wealth', tier: '港元' }, { id: 'boc_standard', tier: '港元' }] },
    { bankName: 'Citibank', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', extraWait: 12000, mapping: [{ id: 'citi_gold', tier: 'Citigold' }, { id: 'citi_plus', tier: 'Citi Plus' }] },
    { bankName: 'Standard Chartered', url: 'https://www.sc.com/hk/zh/deposits/board-rates/', extraWait: 12000, mapping: [{ id: 'sc_priority', tier: '優先理財' }, { id: 'sc_standard', tier: '網上特惠' }] },
    { bankName: 'BEA', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', mapping: [{ id: 'bea_supreme', tier: 'SupremeGold' }] },
    { bankName: 'ICBC', url: 'https://www.icbcasia.com/hk/en/personal/latest-promotion/online-time-deposit.html', mapping: [{ id: 'icbc_elite', tier: 'Elite' }] },
    { bankName: 'CCB', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', mapping: [{ id: 'ccb_prestige', tier: 'Prestige' }] },
    
    // --- 虛擬銀行 ---
    { bankName: 'ZA Bank', url: 'https://bank.za.group/hk/deposit', mapping: [{ id: 'za', tier: '港元' }] },
    { bankName: 'Fusion Bank', url: 'https://www.fusionbank.com/rate.html?lang=tc', mapping: [{ id: 'fusion', tier: 'HKD' }] },
    { bankName: 'Mox Bank', url: 'https://mox.com/zh/promotions/time-deposit/', mapping: [{ id: 'mox', tier: 'Mox定存' }] },
    { bankName: 'PAOB', url: 'https://www.paob.com.hk/tc/deposit.html', mapping: [{ id: 'paob', tier: '個人客戶' }] },
    { bankName: 'Livi Bank', url: 'https://www.livibank.com/zh_HK/rates.html', mapping: [{ id: 'livi', tier: '定期存款' }] },
    { bankName: 'WeLab Bank', url: 'https://www.welab.bank/zh/rates/', mapping: [{ id: 'welab', tier: '定期存款' }] },
    { bankName: 'Ant Bank', url: 'https://www.antbank.hk/rates', mapping: [{ id: 'ant', tier: '定期存款' }] },
    { bankName: 'Airstar Bank', url: 'https://www.airstarbank.com/zh-hk/deposit.html', mapping: [{ id: 'airstar', tier: '定期存款利率' }] }
  ];

  for (const t of tasks) await scrapeBank(browser, t);
  await browser.close();
  console.log('\n🎉 全港 15+ 銀行同步完成。');
}

run();