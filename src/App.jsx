import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import {
  TrendingUp, Search, ExternalLink, SortAsc,
  CalendarDays, Wallet, ShieldCheck,
  RefreshCw, WifiOff, Loader2
} from 'lucide-react';
 
// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "",
  authDomain: "hk-bank-tracker.firebaseapp.com",
  projectId: "hk-bank-tracker",
  storageBucket: "hk-bank-tracker.firebasestorage.app",
  messagingSenderId: "631669349028",
  appId: "1:631669349028:web:c417086999a022363ce431"
};
 
let app, auth, db;
try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error('Firebase init error:', e);
}
 
const APP_ID = 'hk-fd-tracker-pro';
 
// ── i18n ─────────────────────────────────────────────────────
const T = {
  zh_TW: {
    title: '香港定期存款追蹤器',
    subtitle: '專業級定存利率監控系統',
    fundNew: '全新資金', fundExt: '現有資金',
    all: '全部', trad: '傳統大行', virt: '虛擬銀行',
    searchPlace: '搜尋銀行或股票編號…',
    sortRate: '按利率排序', sortCode: '按編號排序',
    interestLabel: '預計利息收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額 (HKD)',
    notAvailable: '暫無提供',
    loading: '連接雲端數據中…',
    noData: '等待爬蟲更新…',
    updated: '更新於',
    syncing: '數據同步中',
    noResults: '沒有符合條件的銀行',
    below_min: '低於最低存款額',
  },
  en: {
    title: 'HK FD Tracker',
    subtitle: 'Professional Fixed Deposit Monitor',
    fundNew: 'New Money', fundExt: 'Existing',
    all: 'All', trad: 'Traditional', virt: 'Virtual',
    searchPlace: 'Search bank or code…',
    sortRate: 'By Rate', sortCode: 'By Code',
    interestLabel: 'Est. Interest', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount (HKD)',
    notAvailable: 'N/A',
    loading: 'Connecting to cloud…',
    noData: 'Awaiting scraper update…',
    updated: 'Updated',
    syncing: 'Syncing',
    noResults: 'No banks match your filters',
    below_min: 'Below minimum deposit',
  },
};
 
// ── Bank Definitions ─────────────────────────────────────────
// rates are always populated from Firestore; defaults shown as {} intentionally
const INITIAL_BANKS = [
  // HSBC
  { id: 'hsbc_elite',   name: '滙豐 卓越理財尊尚',     stockCode: '0005', domain: 'hsbc.com.hk',       url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '尊尚特惠',  color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財',          stockCode: '0005', domain: 'hsbc.com.hk',       url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 100000,  type: 'trad', fundType: 'new', offer: '卓越特惠',  color: 'bg-red-700 text-white' },
  { id: 'hsbc_one',     name: '滙豐 HSBC One',          stockCode: '0005', domain: 'hsbc.com.hk',       url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/',               rates: {}, minDeposit: 10000,   type: 'trad', fundType: 'new', offer: '網上優惠',  color: 'bg-red-50 text-red-700 border border-red-100' },
  // Hang Seng
  { id: 'hangseng_prestige', name: '恒生 優越理財',     stockCode: '0011', domain: 'hangseng.com',      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '特優利率',  color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶',     stockCode: '0011', domain: 'hangseng.com',      url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000,   type: 'trad', fundType: 'new', offer: '一般優惠',  color: 'bg-green-100 text-green-800 border border-green-200' },
  // BOC
  { id: 'boc_wealth',   name: '中銀理財',               stockCode: '2388', domain: 'bochk.com',         url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',         rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '理財晉級',  color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般帳戶',           stockCode: '2388', domain: 'bochk.com',         url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html',         rates: {}, minDeposit: 10000,   type: 'trad', fundType: 'new', offer: '手機銀行',  color: 'bg-red-50 text-red-700 border border-red-100' },
  // SC
  { id: 'sc_priority',  name: '渣打 優先理財',           stockCode: '2888', domain: 'sc.com',            url: 'https://www.sc.com/hk/zh/save/time-deposits/',                          rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '優先理財',  color: 'bg-blue-800 text-white' },
  { id: 'sc_standard',  name: '渣打 一般帳戶',           stockCode: '2888', domain: 'sc.com',            url: 'https://www.sc.com/hk/zh/save/time-deposits/',                          rates: {}, minDeposit: 10000,   type: 'trad', fundType: 'new', offer: '網上特惠',  color: 'bg-blue-50 text-blue-700 border border-blue-100' },
  // BEA
  { id: 'bea_supreme',  name: '東亞 至尊理財',           stockCode: '0023', domain: 'hkbea.com',         url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html', rates: {}, minDeposit: 100000, type: 'trad', fundType: 'new', offer: '至尊理財', color: 'bg-red-800 text-white' },
  // ICBC
  { id: 'icbc_elite',   name: '工銀亞洲 理財金',         stockCode: '1398', domain: 'icbcasia.com',      url: 'https://www.icbcasia.com/tc/personal/deposits/index.html',              rates: {}, minDeposit: 100000,  type: 'trad', fundType: 'new', offer: '理財尊享',  color: 'bg-red-700 text-white' },
  // CCB
  { id: 'ccb_prestige', name: '建行亞洲 貴賓理財',       stockCode: '0939', domain: 'asia.ccb.com',      url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '貴賓尊享', color: 'bg-blue-900 text-white' },
  // Public Bank
  { id: 'public_online', name: '大眾銀行 網上定存',      stockCode: '0626', domain: 'publicbank.com.hk', url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-800 border border-red-100' },
  // Virtual banks
  { id: 'za',     name: 'ZA Bank (眾安)',     stockCode: 'VB01', domain: 'za.group',        url: 'https://bank.za.group/hk/deposit',      rates: {}, minDeposit: 1,   type: 'virt', fundType: 'both', offer: '不限資金',  color: 'bg-teal-50 text-teal-800 border border-teal-100' },
  { id: 'paob',   name: '平安壹賬通',          stockCode: 'VB05', domain: 'paob.com.hk',     url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', fundType: 'both', offer: '保證回報',  color: 'bg-orange-50 text-orange-800 border border-orange-100' },
  { id: 'fusion', name: '富融銀行 (Fusion)',   stockCode: 'VB02', domain: 'fusionbank.com',  url: 'https://www.fusionbank.com/',             rates: {}, minDeposit: 1,   type: 'virt', fundType: 'both', offer: '靈活存',   color: 'bg-purple-50 text-purple-800 border border-purple-100' },
  { id: 'livi',   name: 'Livi Bank',          stockCode: 'VB03', domain: 'livibank.com',    url: 'https://www.livibank.com/',               rates: {}, minDeposit: 1,   type: 'virt', fundType: 'both', offer: 'liviSave', color: 'bg-blue-50 text-blue-800 border border-blue-100' },
];
 
// ── Helpers ───────────────────────────────────────────────────
const TENOR_MONTHS = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 };
 
function calcInterest(amount, rate, tenor) {
  if (!rate || !amount) return null;
  return Math.floor(amount * (rate / 100) * (TENOR_MONTHS[tenor] ?? 0.25));
}
 
// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang]               = useState('zh_TW');
  const [tenor, setTenor]             = useState('3m');
  const [amount, setAmount]           = useState(1000000);
  const [fundSource, setFundSource]   = useState('new');
  const [filterType, setFilterType]   = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy]           = useState('stockCode');
  const [banks, setBanks]             = useState(INITIAL_BANKS);
  const [lastSync, setLastSync]       = useState(null);
  const [authReady, setAuthReady]     = useState(false);
  const [syncedIds, setSyncedIds]     = useState(new Set());
 
  const t = T[lang];
  const isLoading = authReady && syncedIds.size === 0;
 
  // ── Firebase auth ──
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, user => {
      if (user) setAuthReady(true);
    });
    signInAnonymously(auth).catch(console.error);
    return unsub;
  }, []);
 
  // ── Firestore live listeners ──
  useEffect(() => {
    if (!authReady || !db) return;
    const unsubs = INITIAL_BANKS.map(bank => {
      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(ref, snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        setBanks(prev => prev.map(b =>
          b.id === bank.id
            ? { ...b, rates: data.rates ?? b.rates, lastUpdated: data.lastUpdated }
            : b
        ));
        setSyncedIds(prev => new Set([...prev, bank.id]));
        if (data.lastUpdated) setLastSync(data.lastUpdated);
      }, err => console.warn(`Snapshot error [${bank.id}]:`, err));
    });
    return () => unsubs.forEach(u => u());
  }, [authReady]);
 
  // ── Filtered + sorted banks ──
  const displayed = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return banks
      .filter(b => {
        if (q && !b.name.toLowerCase().includes(q) && !b.stockCode.toLowerCase().includes(q)) return false;
        if (filterType === 'trad' && b.type !== 'trad') return false;
        if (filterType === 'virt' && b.type !== 'virt') return false;
        if (fundSource === 'new' && b.fundType === 'ext') return false;
        if (fundSource === 'ext' && b.fundType === 'new') return false;
        return true;
      })
      .sort((a, b) => {
        // Always trad before virt
        if (a.type !== b.type) return a.type === 'trad' ? -1 : 1;
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        const ca = a.type === 'virt' ? 99999 : parseInt(a.stockCode, 10);
        const cb = b.type === 'virt' ? 99999 : parseInt(b.stockCode, 10);
        return ca - cb;
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, sortBy]);
 
  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-10 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-8">
 
        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="space-y-2">
            {/* Sync badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${lastSync ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-600'}`}>
              {lastSync
                ? <><RefreshCw className="w-3 h-3" />{t.updated}: {lastSync}</>
                : <><Loader2 className="w-3 h-3 animate-spin" />{t.syncing}…</>
              }
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-blue-600" />
              {t.title}
            </h1>
            <p className="text-slate-400 font-semibold">{t.subtitle}</p>
          </div>
 
          {/* Language toggle */}
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            {(['zh_TW', 'en']).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === l ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                {l === 'zh_TW' ? '繁' : 'EN'}
              </button>
            ))}
          </div>
        </header>
 
        {/* ── Input Card ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />{t.amountLabel}
              </label>
              <input
                type="number" min="0" value={amount}
                onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-50 px-6 py-4 rounded-2xl text-3xl font-black outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
            {/* Tenor */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />存期 / Tenor
              </label>
              <div className="grid grid-cols-4 gap-2 h-[56px]">
                {['1m', '3m', '6m', '12m'].map(m => (
                  <button key={m} onClick={() => setTenor(m)}
                    className={`rounded-2xl text-sm font-black transition-all border-2 ${tenor === m ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
 
          {/* Fund source toggle */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">資金來源 / Fund Source</label>
            <div className="flex gap-2">
              {[['new', t.fundNew], ['ext', t.fundExt], ['both', t.all]].map(([val, label]) => (
                <button key={val} onClick={() => setFundSource(val)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${fundSource === val ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>
 
        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder={t.searchPlace} value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-semibold outline-none shadow-sm focus:border-blue-400 transition-all text-sm" />
          </div>
 
          {/* Type filter */}
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${filterType === val ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
 
          {/* Sort */}
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <SortAsc className="w-4 h-4 text-blue-500 shrink-0" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-transparent font-black text-[11px] outline-none cursor-pointer text-slate-600">
              <option value="stockCode">{t.sortCode}</option>
              <option value="rate">{t.sortRate}</option>
            </select>
          </div>
        </div>
 
        {/* ── Loading state ── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="font-semibold">{t.loading}</p>
          </div>
        )}
 
        {/* ── No results ── */}
        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <WifiOff className="w-8 h-8" />
            <p className="font-semibold">{t.noResults}</p>
          </div>
        )}
 
        {/* ── Bank cards ── */}
        {!isLoading && (
          <div className="grid gap-4">
            {displayed.map(bank => {
              const rate = bank.rates?.HKD?.[tenor];
              const hasRate = rate != null;
              const interest = calcInterest(amount, rate, tenor);
              const belowMin = amount < bank.minDeposit;
              const noData = !hasRate && syncedIds.has(bank.id);
 
              return (
                <div key={bank.id}
                  className={`bg-white rounded-3xl border border-slate-200 p-6 md:p-7 flex flex-wrap items-center justify-between gap-6 transition-all
                    ${belowMin ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-xl hover:-translate-y-0.5'}`}>
 
                  {/* Left: identity */}
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 p-1.5 shrink-0 flex items-center justify-center">
                      <img
                        src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`}
                        className="w-full h-full object-contain opacity-80"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black text-slate-900 leading-tight">{bank.name}</h3>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded shrink-0">{bank.stockCode}</span>
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${bank.color}`}>{bank.offer}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {t.minDeposit}: HK${bank.minDeposit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
 
                  {/* Right: rate + interest + link */}
                  <div className="flex items-center gap-8 ml-auto">
                    {/* Rate */}
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.rateLabel}</p>
                      <p className={`text-4xl font-black tabular-nums leading-none ${hasRate ? 'text-slate-900' : 'text-slate-200'}`}>
                        {hasRate ? `${rate.toFixed(2)}%` : (noData ? t.notAvailable : <Loader2 className="w-6 h-6 animate-spin inline text-slate-300" />)}
                      </p>
                    </div>
                    {/* Interest */}
                    <div className="text-right min-w-[140px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.interestLabel}</p>
                      <p className={`text-2xl font-black tabular-nums leading-none ${hasRate ? 'text-emerald-600' : 'text-slate-200'}`}>
                        {hasRate ? `+HK$${interest?.toLocaleString()}` : '─'}
                      </p>
                    </div>
                    {/* External link */}
                    <a href={bank.url} target="_blank" rel="noreferrer"
                      className="p-4 rounded-2xl bg-slate-50 text-slate-300 hover:bg-blue-50 hover:text-blue-500 transition-all hidden sm:flex shrink-0">
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
 
        {/* ── Footer ── */}
        <footer className="mt-16 p-8 md:p-10 bg-slate-900 rounded-3xl text-slate-500 text-xs border border-slate-800 space-y-6">
          <div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Market Compliance Notice
          </div>
          <div className="grid md:grid-cols-2 gap-6 leading-relaxed">
            <div className="space-y-2">
              <p>• 數據由 GitHub Actions 每天早上 08:00 HKT 自動從各銀行官方網站提取。</p>
              <p>• 傳統銀行按港交所上市編號排序，虛擬銀行顯示於列表底端。</p>
            </div>
            <div className="space-y-2">
              <p>• 所有年利率僅供參考，不構成任何投資建議。實際利率以銀行最終批核為準。</p>
              <p className="text-blue-400 font-bold">* 建議點擊右側連結前往官方頁面驗證最新利率。</p>
            </div>
          </div>
        </footer>
 
      </div>
    </div>
  );
}
 