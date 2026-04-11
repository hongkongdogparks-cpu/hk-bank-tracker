import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

/**
 * diagnose.js - Run this ONCE to dump what each bank page actually contains.
 * 
 * Usage (add to scraper.yml as a manual step or run locally):
 *   node diagnose.js
 *
 * Outputs /tmp/diag_<bank>.txt with:
 *   - Page title
 *   - All <table> structures found
 *   - First 5000 chars of innerText
 *   - All elements containing % (rate candidates)
 */

const BANKS = [
  { name: 'HSBC',     url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/' },
  { name: 'HangSeng', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/' },
  { name: 'BOC',      url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html' },
  { name: 'Citi',     url: 'https://www.citibank.com.hk/zh/banking/time-deposit.html' },
  { name: 'SC',       url: 'https://www.sc.com/hk/zh/save/time-deposits/' },
];

async function diagnose(browser, bank) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  console.log(`\n🔍 Diagnosing: ${bank.name}`);

  try {
    await page.goto(bank.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 6000));

    // Try clicking HKD tab
    try {
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button, a, li, [role="tab"]'));
        const hkdTab = tabs.find(el => /港元|HKD/i.test(el.innerText || ''));
        if (hkdTab) { hkdTab.click(); console.log('Clicked HKD tab'); }
      });
      await new Promise(r => setTimeout(r, 2000));
    } catch (_) {}

    const diag = await page.evaluate(() => {
      const out = [];

      // 1. Page title
      out.push('=== PAGE TITLE ===');
      out.push(document.title);

      // 2. All tables
      out.push('\n=== TABLES FOUND ===');
      const tables = document.querySelectorAll('table');
      out.push(`Total tables: ${tables.length}`);
      tables.forEach((table, i) => {
        out.push(`\n--- Table #${i + 1} ---`);
        const rows = table.querySelectorAll('tr');
        Array.from(rows).slice(0, 10).forEach((row, ri) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim().replace(/\n/g, ' ').substring(0, 40));
          out.push(`  Row ${ri}: [${cells.join(' | ')}]`);
        });
        if (rows.length > 10) out.push(`  ... (${rows.length} rows total)`);
      });

      // 3. Elements containing %
      out.push('\n=== ELEMENTS WITH % (rate candidates) ===');
      const allEls = Array.from(document.querySelectorAll('*'));
      const rateEls = allEls.filter(el => {
        if (el.children.length > 0) return false; // leaf nodes only
        const txt = el.innerText || '';
        return /\d+\.?\d*\s*%/.test(txt) && txt.length < 20;
      });
      out.push(`Found ${rateEls.length} rate-like elements`);
      rateEls.slice(0, 30).forEach(el => {
        const path = [el.tagName, el.className.substring(0, 30), el.id].filter(Boolean).join('.');
        out.push(`  ${path}: "${el.innerText.trim()}"`);
      });

      // 4. Elements containing tenor keywords
      out.push('\n=== TENOR KEYWORDS FOUND ===');
      const tenorEls = allEls.filter(el => {
        if (el.children.length > 0) return false;
        const txt = el.innerText || '';
        return /個月|month|1年/i.test(txt) && txt.length < 30;
      });
      out.push(`Found ${tenorEls.length} tenor-like elements`);
      tenorEls.slice(0, 20).forEach(el => {
        const path = [el.tagName, el.className.substring(0, 30), el.id].filter(Boolean).join('.');
        out.push(`  ${path}: "${el.innerText.trim()}"`);
      });

      // 5. First 4000 chars of body text
      out.push('\n=== BODY TEXT (first 4000 chars) ===');
      out.push(document.body.innerText.substring(0, 4000));

      // 6. Check for iframes
      out.push('\n=== IFRAMES ===');
      const iframes = document.querySelectorAll('iframe');
      out.push(`Total iframes: ${iframes.length}`);
      iframes.forEach((f, i) => out.push(`  iframe #${i}: src="${f.src}"`));

      return out.join('\n');
    });

    const filename = `/tmp/diag_${bank.name}.txt`;
    writeFileSync(filename, diag);
    console.log(`   ✅ Saved to ${filename}`);

  } catch (err) {
    console.error(`   ❌ ${bank.name} failed: ${err.message}`);
    writeFileSync(`/tmp/diag_${bank.name}.txt`, `ERROR: ${err.message}\n${err.stack}`);
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900'],
  });

  for (const bank of BANKS) await diagnose(browser, bank);

  await browser.close();
  console.log('\n✅ Diagnosis complete. Check /tmp/diag_*.txt files.');
  console.log('Upload them as GitHub Actions artifacts to inspect.');
}

run();
