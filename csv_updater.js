import fs from 'fs';
import admin from 'firebase-admin';

/**
 * csv_updater.js
 * 💡 邏輯：讀取專案根目錄的 rates.csv，解析後直接同步至 Firestore。
 * 優點：100% 準確，不受銀行網頁改版影響。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ 缺失環境變數: FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

async function updateFromCSV() {
  const filePath = './rates.csv';
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ 找不到 rates.csv 檔案');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  // 跳過標頭行 (id,1m,3m,6m,12m)
  const dataRows = lines.slice(1);
  const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

  console.log(`🚀 開始從 CSV 更新 ${dataRows.length} 間銀行數據...`);

  for (const row of dataRows) {
    const [id, m1, m3, m6, m12] = row.split(',').map(s => s.trim());
    
    if (!id) continue;

    const rates = {
      HKD: {
        '1m': m1 !== '0.0' ? parseFloat(m1) : null,
        '3m': m3 !== '0.0' ? parseFloat(m3) : null,
        '6m': m6 !== '0.0' ? parseFloat(m6) : null,
        '12m': m12 !== '0.0' ? parseFloat(m12) : null
      }
    };

    try {
      await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${id}`).set({
        id,
        rates,
        lastUpdated: `CSV: ${now}`
      }, { merge: true });
      console.log(`   ✅ [${id}] 已更新`);
    } catch (err) {
      console.error(`   ❌ [${id}] 更新失敗: ${err.message}`);
    }
  }

  console.log('\n🎉 CSV 同步程序結束。');
}

updateFromCSV();