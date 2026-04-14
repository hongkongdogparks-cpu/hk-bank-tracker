import fs from 'fs';
import admin from 'firebase-admin';

/**
 * csv_updater.js - 2026 修復版
 * 解決路徑段數錯誤（奇數/偶數段）與 GitHub Action 超時問題
 */

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ 缺失環境變數: FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

// 獲取並扁平化 APP_ID，確保 Firestore 集合路徑維持奇數段 (artifacts/ID/public/data/live_rates)
const rawAppId = process.env.APP_ID || 'hk-fd-tracker-pro';
const APP_ID = rawAppId.replace(/\//g, '_'); 

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function sync() {
  console.log(`🎬 啟動同步程序 (AppID: ${APP_ID})...`);
  
  // 自動搜尋 rates.csv 可能的位置
  const possiblePaths = ['./rates.csv', './src/rates.csv', 'rates.csv'];
  let filePath = possiblePaths.find(p => fs.existsSync(p));

  if (!filePath) {
    console.error('❌ 找不到 rates.csv，請檢查檔案是否放置在根目錄');
    console.log('📁 當前目錄內容:', fs.readdirSync('.'));
    process.exit(1);
  }

  try {
    console.log(`📖 讀取檔案: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 過濾空行並跳過標題行 (id,1m,3m,6m,12m)
    const lines = content.split(/\r?\n/).filter(l => l.trim() && !l.toLowerCase().startsWith('id,'));

    if (lines.length === 0) {
      console.warn('⚠️ CSV 檔案中沒有有效數據');
      process.exit(0);
    }

    const batch = db.batch();
    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

    for (const line of lines) {
      // 處理可能的引號包裹
      const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 5) continue;
      
      const [id, m1, m3, m6, m12] = parts;
      if (!id) continue;

      const rates = {
        HKD: {
          '1m': parseFloat(m1) > 0 ? parseFloat(m1) : null,
          '3m': parseFloat(m3) > 0 ? parseFloat(m3) : null,
          '6m': parseFloat(m6) > 0 ? parseFloat(m6) : null,
          '12m': parseFloat(m12) > 0 ? parseFloat(m12) : null
        }
      };

      // 構建路徑：artifacts (1) -> APP_ID (2) -> public (3) -> data (4) -> live_rates (5)
      // 這是正確的 Collection Reference (5 段，奇數)
      const docRef = db.doc(`artifacts/${APP_ID}/public/data/live_rates/${id}`);
      batch.set(docRef, { id, rates, lastUpdated: `CSV: ${now}` }, { merge: true });
    }

    console.log(`📡 正在推送 ${lines.length} 筆數據到 Firebase...`);
    await batch.commit();
    console.log('✅ 同步成功！數據已存入 Firestore。');
    
    // 重要：徹底釋放連線與資源，防止 GitHub Action 因掛起連線而超時
    await admin.app().delete();
    console.log('🔌 Firebase 連線已安全中斷。');
    process.exit(0);
  } catch (err) {
    console.error('❌ 同步失敗:', err.message);
    process.exit(1);
  }
}

sync();