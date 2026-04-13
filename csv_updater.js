import fs from 'fs';
import admin from 'firebase-admin';

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

async function sync() {
  try {
    const file = './rates.csv';
    if (!fs.existsSync(file)) {
      console.error('❌ 找不到 rates.csv');
      process.exit(1);
    }

    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

    console.log(`🚀 開始同步 CSV 數據 (${lines.length - 1} 間銀行)...`);

    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length < 5) continue;
      
      const [id, m1, m3, m6, m12] = parts.map(s => s.trim());
      if (!id) continue;

      const rates = {
        HKD: {
          '1m': parseFloat(m1) > 0 ? parseFloat(m1) : null,
          '3m': parseFloat(m3) > 0 ? parseFloat(m3) : null,
          '6m': parseFloat(m6) > 0 ? parseFloat(m6) : null,
          '12m': parseFloat(m12) > 0 ? parseFloat(m12) : null
        }
      };

      await db.doc(`artifacts/${APP_ID}/public/data/live_rates/${id}`).set({
        id, rates, lastUpdated: `CSV: ${now}`
      }, { merge: true });
      console.log(`   ✅ [${id}] 同步成功`);
    }

    console.log('\n🎉 所有數據已成功推送到 Firestore！');
    // 💡 關鍵：強制結束 Node 程序，否則 GitHub Action 會一直轉圈圈
    process.exit(0);
  } catch (err) {
    console.error('❌ 執行出錯:', err);
    process.exit(1);
  }
}

sync();