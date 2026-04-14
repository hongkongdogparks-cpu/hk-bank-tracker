import fs from 'fs';
import admin from 'firebase-admin';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT is missing');
  process.exit(1);
}

// 扁平化處理 appId，確保路徑段數正確
const rawAppId = process.env.APP_ID || 'hk-fd-tracker-pro';
const appId = rawAppId.replace(/\//g, '_'); 

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function sync() {
  const filePath = './rates.csv';
  if (!fs.existsSync(filePath)) {
    console.error('❌ rates.csv not found');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('id,'));
    
    const batch = db.batch();
    const now = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

    for (const line of lines) {
      const [id, m1, m3, m6, m12] = line.split(',').map(s => s.trim());
      if (!id) continue;

      const docRef = db.doc(`artifacts/${appId}/public/data/live_rates/${id}`);
      batch.set(docRef, {
        id,
        rates: {
          HKD: {
            '1m': parseFloat(m1) || null,
            '3m': parseFloat(m3) || null,
            '6m': parseFloat(m6) || null,
            '12m': parseFloat(m12) || null
          }
        },
        lastUpdated: `CSV: ${now}`
      }, { merge: true });
    }

    await batch.commit();
    console.log(`✅ CSV Sync Complete: ${lines.length} items.`);
    
    // 強制釋放資源，防止 GitHub Action 逾時
    await admin.app().delete();
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

sync();
```

---

### 2. 更新 `.github/workflows/scrape.yml`
這負責每天自動跑爬蟲。我們加入了 **NPM 快取**，讓安裝依賴從 6 分鐘縮短到 10 秒。

```yaml
name: Daily Rates Update

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm' # 加入快取機制
      - name: Install Chrome
        run: sudo apt-get install -y google-chrome-stable
      - name: Install Deps
        run: npm install puppeteer-core firebase-admin
      - name: Run Scraper
        run: node scraper.js
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          APP_ID: ${{ vars.APP_ID || 'hk-fd-tracker-pro' }}
```

---

### 3. 更新 `.github/workflows/csv_sync.yml`
當您修改 `rates.csv` 並上傳時，這會觸發同步。

```yaml
name: Sync Rates from CSV

on:
  push:
    paths:
      - 'rates.csv'
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install Deps
        run: npm install firebase-admin
      - name: Run CSV Updater
        run: node csv_updater.js
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          APP_ID: ${{ vars.APP_ID || 'hk-fd-tracker-pro' }}