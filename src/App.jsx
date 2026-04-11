import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import {
  TrendingUp, Search, ExternalLink, SortAsc,
  CalendarDays, Wallet, ShieldCheck,
  RefreshCw, WifiOff, Loader2, AlertCircle, Clock
} from 'lucide-react';
 
// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyALK4TY5etUnEvBTqfvH6d0O36Rt3UuYIM", // 💡 已根據您的截圖填入
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
    updated: '數據更新於',
    syncing: '數據實時監聽中',
    noResults: '沒有符合條件的銀行',
    authError: '數據庫連線失敗',
  },
  en: {
    title: 'HK FD Tracker',
    subtitle: 'Professional FD Monitor',
    fundNew: 'New Money', fundExt: 'Existing',
    all: 'All', trad: 'Traditional', virt: 'Virtual',
    searchPlace: 'Search bank or code…',
    sortRate: 'By Rate', sortCode: 'By Code',
    interestLabel: 'Est. Interest', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount (HKD)',
    notAvailable: 'N/A',
    loading: 'Connecting to cloud…',
    updated: 'Last updated at',
    syncing: 'Live syncing',
    noResults: 'No banks match',
    authError: 'Database Error',
  },
};
 
const INITIAL_BANKS = [
  { id: 'hsbc_elite',   name: '滙豐 卓越理財尊尚',     stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '尊尚特惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財',          stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 100000,  type: 'trad', fundType: 'new', offer: '卓越特惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one',     name: '滙豐 HSBC One / 一般',   stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border border-red-100' },
  { id: 'hangseng_prestige', name: '恒生 優越理財',     stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '特優利率', color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶',     stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', offer: '一般優惠', color: 'bg-green-100 text-green-800 border border-green-200' },
  { id: 'boc_wealth',   name: '中銀理財',               stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '理財晉級', color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般帳戶',           stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', offer: '手機銀行', color: 'bg-red-50 text-red-700 border border-red-100' },
  { id: 'citi_gold',    name: '花旗 Citigold',          stockCode: 'CITI', domain: 'citibank.com.hk', url: 'https://www.citibank.com.hk/zh/banking/time-deposit.html', rates: {}, minDeposit: 50000, type: 'trad', fundType: 'new', offer: '特惠利率', color: 'bg-blue-700 text-white shadow-lg' },
  { id: 'sc_priority',  name: '渣打 優先理財',           stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'za',           name: 'ZA Bank (眾安)',        stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: 'virt', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-800 border border-teal-100' },
  { id: 'paob',         name: '平安壹賬通',             stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-800 border border-orange-100' },
];
 
const TENOR_MONTHS = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 };
 
export default function App() {
  const [user, setUser]               = useState(null);
  const [lang, setLang]               = useState('zh_TW');
  const [tenor, setTenor]             = useState('3m');
  const [amount, setAmount]           = useState(1000000);
  const [fundSource, setFundSource]   = useState('new');
  const [filterType, setFilterType]   = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy]           = useState('stockCode');
  const [banks, setBanks]             = useState(INITIAL_BANKS);
  const [lastSync, setLastSync]       = useState(null);
  const [syncedIds, setSyncedIds]     = useState(new Set());
 
  const t = T[lang];
  const isLoading = user && syncedIds.size === 0;
 
  // ── Rule 3: Firebase Auth Pattern ──
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        console.log("✅ Auth Success");
      } catch (err) {
        console.error("❌ Auth Failed:", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);
 
  // ── Firestore Listeners ──
  useEffect(() => {
    if (!user || !db) return;
    
    console.log("🔌 開始監聽 Firestore...");
    const unsubs = INITIAL_BANKS.map(bank => {
      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(ref, snap => {
        if (snap.exists()) {
          const data = snap.data();
          console.log(`📥 收到數據 [${bank.id}]:`, data.rates?.HKD?.[tenor]);
          setBanks(prev => prev.map(b =>
            b.id === bank.id
              ? { ...b, rates: data.rates ?? {}, lastUpdated: data.lastUpdated }
              : b
          ));
          setSyncedIds(prev => new Set([...prev, bank.id]));
          if (data.lastUpdated) setLastSync(data.lastUpdated);
        }
      }, err => console.warn(`Snapshot Error [${bank.id}]:`, err));
    });
    return () => unsubs.forEach(u => u());
  }, [user]);
 
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
        if (a.type !== b.type) return a.type === 'trad' ? -1 : 1;
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        const ca = a.type === 'virt' ? 99999 : (parseInt(a.stockCode) || 99998);
        const cb = b.type === 'virt' ? 99999 : (parseInt(b.stockCode) || 99998);
        return ca - cb;
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, sortBy]);
 
  const calcInterest = (rate) => {
    if (!rate || !amount) return 0;
    return Math.floor(amount * (rate / 100) * (TENOR_MONTHS[tenor] || 0.25));
  };
 
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-10 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-8">
 
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
               {/* 💡 實時狀態小燈 */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${lastSync ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-600'}`}>
                <span className={`w-2 h-2 rounded-full bg-current ${lastSync ? 'animate-pulse' : ''}`}></span>
                {lastSync ? <>{t.updated}: {lastSync}</> : <><Loader2 className="w-3 h-3 animate-spin" />{t.syncing}…</>}
              </span>
              <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-full tracking-widest uppercase shadow-sm">Live Connection</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-3"><TrendingUp className="w-10 h-10 text-blue-600" />{t.title}</h1>
            <p className="text-slate-400 font-semibold">{t.subtitle}</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            {['zh_TW', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === l ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
            ))}
          </div>
        </header>
 
        <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-emerald-500" />{t.amountLabel}</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-slate-50 px-6 py-4 rounded-2xl text-3xl font-black outline-none border-none focus:ring-4 focus:ring-blue-100" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-blue-500" />存期 / Tenor</label>
            <div className="grid grid-cols-4 gap-2 h-[56px]">
              {['1m', '3m', '6m', '12m'].map(m => (
                <button key={m} onClick={() => setTenor(m)} className={`rounded-2xl text-sm font-black transition-all border-2 ${tenor === m ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{m.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </section>
 
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-semibold outline-none shadow-sm focus:border-blue-400 text-sm" />
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val)} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${filterType === val ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm font-black text-[11px] outline-none text-slate-600">
            <option value="stockCode">{t.sortCode}</option>
            <option value="rate">{t.sortRate}</option>
          </select>
        </div>
 
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="font-semibold">{t.loading}</p>
          </div>
        )}
 
        {!isLoading && (
          <div className="grid gap-4">
            {displayed.map(bank => {
              const rate = bank.rates?.HKD?.[tenor];
              const hasRate = rate != null;
              const interest = calcInterest(rate);
              const belowMin = amount < bank.minDeposit;
 
              return (
                <div key={bank.id} className={`bg-white rounded-3xl border border-slate-200 p-6 md:p-7 flex flex-wrap items-center justify-between gap-6 transition-all ${belowMin ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-xl group'}`}>
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center shrink-0">
                      <img src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{bank.name}</h3>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded">{bank.stockCode}</span>
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${bank.color}`}>{bank.offer}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{t.minDeposit}: HK${bank.minDeposit.toLocaleString()}</span>
                        {/* 💡 每張卡片的專屬更新時間 */}
                        {bank.lastUpdated && (
                          <span className="text-[10px] text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {bank.lastUpdated}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
 
                  <div className="flex items-center gap-8 ml-auto">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.rateLabel}</p>
                      <p className={`text-4xl font-black tabular-nums leading-none ${hasRate ? 'text-slate-900' : 'text-slate-200'}`}>
                        {hasRate ? `${rate.toFixed(2)}%` : t.notAvailable}
                      </p>
                    </div>
                    <div className="text-right min-w-[140px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.interestLabel}</p>
                      <p className={`text-2xl font-black tabular-nums leading-none ${hasRate ? 'text-emerald-600' : 'text-slate-200'}`}>
                        {hasRate ? `+HK$${interest.toLocaleString()}` : '─'}
                      </p>
                    </div>
                    <a href={bank.url} target="_blank" rel="noreferrer" className="p-4 rounded-2xl bg-slate-50 text-slate-300 hover:bg-blue-50 hover:text-blue-500 transition-all hidden sm:flex shrink-0"><ExternalLink className="w-5 h-5" /></a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
 
        <footer className="mt-16 p-8 bg-slate-900 rounded-3xl text-slate-500 text-xs border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm"><ShieldCheck className="w-5 h-5 text-blue-500" /> Market Compliance Notice</div>
          <p>• 數據由 GitHub Actions 雲端爬蟲自動提取。傳統銀行按上市編號排序（滙豐優先）。虛擬銀行列於列表末端。所有利率以銀行最終批核為準。</p>
        </footer>
      </div>
    </div>
  );
}