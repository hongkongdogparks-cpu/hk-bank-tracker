import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import {
  TrendingUp, Search, ExternalLink, SortAsc,
  CalendarDays, Wallet, ShieldCheck,
  Clock, Activity, Database
} from 'lucide-react';
 
// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyALK4TY5etUnEvBTqfvH6d0O36Rt3UuYIM", 
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
} catch (e) { console.error('Firebase init error:', e); }
 
const APP_ID = 'hk-fd-tracker-pro'; 
 
const T = {
  zh_TW: {
    title: '香港定期存款追蹤器',
    subtitle: '專業級定存利率監控系統',
    all: '全部銀行', trad: '傳統大行', virt: '虛擬銀行',
    searchPlace: '搜尋銀行、編號或帳戶等級…',
    sortRate: '按利率排序', sortCode: '按編號排序',
    interestLabel: '預計利息收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額 (HKD)',
    notAvailable: '暫無提供', loading: '連接數據中…', updated: '數據更新', syncing: '實時同步中'
  },
  en: {
    title: 'HK FD Tracker Pro',
    subtitle: 'Professional FD Monitor',
    all: 'All Banks', trad: 'Traditional', virt: 'Virtual',
    searchPlace: 'Search bank, code or tier…',
    sortRate: 'By Rate', sortCode: 'By Code',
    interestLabel: 'Est. Interest', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount (HKD)',
    notAvailable: 'N/A', loading: 'Connecting...', updated: 'Updated', syncing: 'Live Syncing'
  },
};
 
// 💡 INITIAL_BANKS 必須與 rates.csv 中的 ID 完全對應
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', offer: '新資金優惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', offer: '新資金優惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one', name: '滙豐 HSBC One', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', offer: '網上優惠', color: 'bg-red-50 text-red-700 border border-red-100' },
  { id: 'hangseng_prestige', name: '恒生 優越理財', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: {}, minDeposit: 10000, type: 'trad', offer: '新資金特惠', color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: {}, minDeposit: 10000, type: 'trad', offer: '一般優惠', color: 'bg-green-100 text-green-800 border' },
  { id: 'boc_wealth', name: '中銀理財', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 1000000, type: 'trad', offer: '特選客戶', color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般客戶', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 10000, type: 'trad', offer: '掛牌利率', color: 'bg-red-50 text-red-700 border' },
  { id: 'citi_gold', name: '花旗 Citigold', stockCode: 'US:C', domain: 'citibank.com.hk', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', rates: {}, minDeposit: 50000, type: 'trad', offer: '新客戶優惠', color: 'bg-blue-700 text-white shadow-lg' },
  { id: 'sc_priority', name: '渣打 優先理財', stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 1000000, type: 'trad', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'sc_standard', name: '渣打 一般客戶', stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 1, type: 'trad', offer: '網上優惠', color: 'bg-blue-50 text-blue-700 border border-blue-100' },
  { id: 'bea_supreme', name: '東亞 至尊理財', stockCode: '0023', domain: 'hkbea.com', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', rates: {}, minDeposit: 100000, type: 'trad', offer: '新客戶特惠', color: 'bg-red-800 text-white' },
  { id: 'icbc_elite', name: '工銀亞洲 理財金', stockCode: '1398', domain: 'icbcasia.com', url: 'https://www.icbcasia.com/hk/tc/personal/latest-promotion/online-time-deposit.html', rates: {}, minDeposit: 3000000, type: 'trad', offer: 'Wealth Mgt', color: 'bg-red-700 text-white' },
  { id: 'ccb_prestige', name: '建行亞洲 貴賓理財', stockCode: '0939', domain: 'asia.ccb.com', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', rates: {}, minDeposit: 1000000, type: 'trad', offer: '掛牌利率', color: 'bg-blue-900 text-white' },
  { id: 'public_online', name: '大眾銀行 網上定存', stockCode: '0626', domain: 'publicbank.com.hk', url: 'https://www.publicbank.com.hk/en/usefultools/rates/depositinterestrates', rates: {}, minDeposit: 10000, type: 'trad', offer: 'Board Rate', color: 'bg-red-50 text-red-800 border border-red-100' },
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: 'virt', offer: '活期+定期', color: 'bg-teal-600 text-white' },
  { id: 'fusion', name: '富融 Fusion', stockCode: 'VB02', domain: 'fusionbank.com', url: 'https://www.fusionbank.com/deposit.html?lang=tc', rates: {}, minDeposit: 1000000, type: 'virt', offer: '階梯利率', color: 'bg-purple-600 text-white' },
  { id: 'mox', name: 'Mox Bank', stockCode: 'VB04', domain: 'mox.com', url: 'https://mox.com/zh/promotions/time-deposit/', rates: {}, minDeposit: 1, type: 'virt', offer: 'Mox定存', color: 'bg-black text-white' },
  { id: 'paob', name: '平安壹賬通 PAOB', stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', offer: '保證回報', color: 'bg-orange-50 text-orange-800 border' },
  { id: 'livi', name: 'Livi Bank', stockCode: 'VB03', domain: 'livibank.com', url: 'https://www.livibank.com/features/livisave.html', rates: {}, minDeposit: 1, type: 'virt', offer: 'liviSave', color: 'bg-blue-600 text-white' },
  { id: 'airstar', name: '天星 Airstar', stockCode: 'VB08', domain: 'airstarbank.com', url: 'https://www.airstarbank.com/en-hk/hkprime.html', rates: {}, minDeposit: 1, type: 'virt', offer: '星級定存', color: 'bg-indigo-600 text-white' },
];
 
export default function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('stockCode');
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [lastSync, setLastSync] = useState(null);
  const [syncedCount, setSyncedCount] = useState(0);
 
  const t = T[lang];
 
  // 匿名登入
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, u => {
      if (u) {
        setUser(u);
        console.log("✅ Firebase Auth: Success");
      } else {
        signInAnonymously(auth).catch(err => console.error("❌ Auth Error:", err));
      }
    });
    return () => unsub();
  }, []);
 
  // 實時數據監聽
  useEffect(() => {
    if (!user || !db) return;
    
    console.log("🔌 Initializing Listeners...");
    const unsubs = INITIAL_BANKS.map(bank => {
      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(ref, snap => {
        if (snap.exists()) {
          const data = snap.data();
          setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, rates: data.rates ?? {}, lastUpdated: data.lastUpdated } : b));
          setSyncedCount(prev => prev + 1);
          if (data.lastUpdated) setLastSync(data.lastUpdated);
        }
      }, err => {
        console.error(`❌ Snapshot Error for ${bank.id}:`, err.message);
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user]);
 
  const displayed = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return banks
      .filter(b => {
        if (q && !b.name.toLowerCase().includes(q) && !b.stockCode.toLowerCase().includes(q)) return false;
        if (filterType !== 'all' && b.type !== filterType) return false;
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
  }, [banks, tenor, searchQuery, filterType, sortBy]);
 
  const interest = (rate) => {
    if (!rate || !amount) return 0;
    const m = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 }[tenor];
    return Math.floor(amount * (rate / 100) * m);
  };
 
  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 p-4 md:p-10 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${syncedCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                <span className={`w-2 h-2 rounded-full bg-current ${syncedCount > 0 ? 'animate-pulse' : ''}`}></span>
                {syncedCount > 0 ? t.syncing : 'Connecting...'}
              </span>
              <span className="flex items-center gap-1 bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-md tracking-tighter uppercase shadow-sm"><Database className="w-3 h-3" /> Firestore Linked</span>
              {lastSync && <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter"><Clock className="w-3 h-3 inline mr-1" /> {lastSync}</span>}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter flex items-center gap-4 text-slate-900"><TrendingUp className="w-12 h-12 text-blue-600" /> {t.title}</h1>
            <p className="text-slate-400 font-bold text-xl opacity-80 leading-none">{t.subtitle}</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
            {['zh_TW', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${lang === l ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
            ))}
          </div>
        </header>

        <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-10 shadow-sm grid md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> {t.amountLabel}</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-slate-50 px-8 py-5 rounded-3xl text-5xl font-black outline-none border-none focus:ring-8 focus:ring-blue-50 transition-all" />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-500" /> 存期 / Tenor</label>
            <div className="grid grid-cols-4 gap-2 h-full pb-2">
              {['1m', '3m', '6m', '12m'].map(m => (
                <button key={m} onClick={() => setTenor(m)} className={`rounded-2xl text-sm font-black transition-all border-2 ${tenor === m ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{m.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </section>
 
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[2rem] font-bold outline-none shadow-sm focus:border-blue-500 transition-all text-lg" />
          </div>
          <div className="flex bg-white p-1.5 rounded-[1.8rem] border border-slate-200 shadow-sm shrink-0">
            {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val)} className={`px-7 py-3 rounded-2xl text-xs font-black transition-all ${filterType === val ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
          <div className="bg-white p-1.5 rounded-[1.8rem] border border-slate-200 shadow-sm flex items-center gap-2 px-4 shrink-0">
            <SortAsc className="w-4 h-4 text-blue-500" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-600 uppercase">
              <option value="stockCode">Code</option>
              <option value="rate">Rate</option>
            </select>
          </div>
        </div>
 
        <div className="grid gap-6">
          {displayed.map(bank => {
            const r = bank.rates?.HKD?.[tenor];
            const hasR = r != null && r > 0;
            const belowMin = amount < bank.minDeposit;
            return (
              <div key={bank.id} className={`bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-10 flex flex-wrap items-center justify-between gap-8 transition-all ${belowMin ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-2xl hover:-translate-y-1 group'}`}>
                <div className="flex items-center gap-8 min-0">
                  <div className="w-20 h-20 rounded-[1.8rem] bg-slate-50 border border-slate-100 p-3 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                    <img src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{bank.name}</h3>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded tracking-widest uppercase">{bank.stockCode}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${bank.color}`}>{bank.offer}</span>
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-full uppercase border">Min: HK${bank.minDeposit.toLocaleString()}</span>
                      {bank.lastUpdated && <span className="text-[10px] text-slate-300 flex items-center gap-1 font-bold ml-2 uppercase"><Activity className="w-3 h-3 text-emerald-400" /> {bank.lastUpdated}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-12 ml-auto">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t.rateLabel}</p>
                    <p className={`text-5xl font-black tabular-nums leading-none tracking-tighter ${hasR ? 'text-slate-900' : 'text-slate-100'}`}>{hasR ? `${r.toFixed(3)}%` : t.notAvailable}</p>
                  </div>
                  <div className="text-right min-w-[160px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t.interestLabel}</p>
                    <p className={`text-3xl font-black tabular-nums leading-none ${hasR ? 'text-emerald-600' : 'text-slate-100'}`}>{hasR ? `+HK$${interest(r).toLocaleString()}` : '─'}</p>
                  </div>
                  <a href={bank.url} target="_blank" rel="noreferrer" className="p-6 rounded-[1.8rem] bg-slate-50 text-slate-300 hover:bg-blue-50 hover:text-blue-500 transition-all hidden lg:flex shrink-0 shadow-sm"><ExternalLink className="w-6 h-6" /></a>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-20 p-12 bg-slate-900 rounded-[3rem] text-slate-500 text-xs border border-slate-800 space-y-4 shadow-2xl">
          <div className="flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm"><ShieldCheck className="w-5 h-5 text-blue-500" /> Market Compliance Notice</div>
          <p>• 數據根據用戶提供之最新利率表（CSV）同步更新，確保 100% 準確對齊。點擊右側外部連結可直達各銀行官網驗證。實際利率以銀行最後批核為準。</p>
        </footer>
      </div>
    </div>
  );
}