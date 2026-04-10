name: Daily Rates Update

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    # 設定超時時間，防止機器人無限期卡住（例如網路問題）
    timeout-minutes: 15 
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Scraper Dependencies
        # 💡 精簡優化：不要安裝整個專案，只安裝爬蟲需要的兩個核心工具
        # 這會比之前的 npm install 快上數倍
        run: npm install puppeteer firebase-admin

      - name: Run Scraper
        run: node scraper.js
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}