import fs from 'fs';
import admin from 'firebase-admin';

/**
 * csv_updater.js - 2026 終極加速與修復版
 * 💡 改進點：
 * 1. 使用 WriteBatch 批次處理，解決逐條寫入慢的問題。
 * 2. 加入 admin.app().delete() 徹底釋放連線，解決 GitHub Action 掛機問題。
 * 3. 強化錯誤捕捉與路徑校準。
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ 錯誤: 找不到環境變數 FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const APP_ID = 'hk-fd-tracker-pro';

async function sync() {
  console.log('🎬 準備啟動同步程序...');
  
  try {
    const file = './rates.csv';
    if (!fs.existsSync(file)) {
      throw new Error('找不到 rates.csv 檔案，請確認檔案已 Push 到根目錄');
    }

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('id,')); // 過濾標題與空行
    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

    console.log(`📊 偵測到 ${lines.length} 筆銀行數據，開始準備批次寫入...`);

    // 💡 使用 Firestore 批次寫入功能，效率最高
    const batch = db.batch();
    let updateCount = 0;

    for (const line of lines) {
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

      const docRef = db.doc(`artifacts/${APP_ID}/public/data/live_rates/${id}`);
      batch.set(docRef, { id, rates, lastUpdated: `CSV: ${now}` }, { merge: true });
      updateCount++;
    }

    console.log(`📡 正在發送批次數據至 Firebase (共 ${updateCount} 筆)...`);
    await batch.commit();
    console.log('✅ Firebase 數據更新成功！');

    // 💡 關鍵步驟：先刪除 App 釋放 Socket，再退出程序
    await admin.app().delete();
    console.log('🔌 Firebase 連線已優雅斷開。');
    
    console.log('\n🎉 所有任務已完成，GitHub Action 應該會立刻變綠。');
    process.exit(0);

  } catch (err) {
    console.error('❌ 同步失敗:', err.message);
    process.exit(1);
  }
}

sync();