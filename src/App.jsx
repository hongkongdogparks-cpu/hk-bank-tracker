import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import {
  TrendingUp, Search, ExternalLink, SortAsc,
  CalendarDays, Wallet, ShieldCheck,
  Clock, Activity, Database, ArrowUpRight, Globe, Smartphone, MousePointer2
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
} catch (e) { console.error(e); }
 
const APP_ID = 'hk-fd-tracker-pro'; 
 
// ── Translation Config ──────────────────────────────────────────
const T = {
  zh_TW: {
    title: '港元定存追蹤器',
    subtitle: '專業級實時利率監控',
    all: '全部', trad: '傳統銀行', virt: '虛擬銀行',
    searchPlace: '搜尋銀行、代號或帳戶…',
    sortRate: '利率最高', sortCode: '銀行編號',
    interestLabel: '預計收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '存款金額',
    tenorLabel: '存期選擇', notAvailable: 'N/A', 
    loading: '載入中', updated: '更新於', syncing: '同步中',
    stock: '代號',
    newFund: '新資金', existingFund: '現有資金',
    online: '網上', mobile: '手機 App',
    lastUpdateBy: '最後更新時間：',
    adLabel: '贊助商內容'
  },
  en: {
    title: 'HK FD Tracker',
    subtitle: 'Professional FD Monitor',
    all: 'All', trad: 'Traditional', virt: 'Virtual',
    searchPlace: 'Search bank, code or tier…',
    sortRate: 'Highest Rate', sortCode: 'Bank Code',
    interestLabel: 'Est. Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Amount',
    tenorLabel: 'Select Tenor', notAvailable: 'N/A', 
    loading: 'Loading', updated: 'Update', syncing: 'Live',
    stock: 'Code',
    newFund: 'New Fund', existingFund: 'Existing Fund',
    online: 'Online', mobile: 'Mobile App',
    lastUpdateBy: 'Last update by: ',
    adLabel: 'ADVERTISEMENT'
  },
};
 
// ── Bank Configuration ──────────────────────────────────────────
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: { zh: '滙豐 卓越理財尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-rose-600' },
  { id: 'hsbc_premier', name: { zh: '滙豐 卓越理財', en: 'HSBC Premier' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-rose-500' },
  { id: 'hsbc_one', name: { zh: '滙豐 HSBC One', en: 'HSBC One' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-rose-400' },
  { id: 'hangseng_prestige', name: { zh: '恒生 優越理財', en: 'Hang Seng Prestige' }, stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-emerald-600' },
  { id: 'hangseng_standard', name: { zh: '恒生 一般帳戶', en: 'Hang Seng Integrated' }, stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'existing', channel: 'online', color: 'bg-emerald-500' },
  { id: 'boc_wealth', name: { zh: '中銀理財', en: 'BOC Wealth Mgt' }, stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', channel: 'mobile', color: 'bg-red-700' },
  { id: 'boc_standard', name: { zh: '中銀 一般客戶', en: 'BOC Personal' }, stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'existing', channel: 'mobile', color: 'bg-red-600' },
  { id: 'citi_gold', name: { zh: '花旗 Citigold', en: 'Citi Citigold' }, stockCode: 'US:C', domain: 'citibank.com.hk', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', rates: {}, minDeposit: 50000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-blue-800' },
  { id: 'sc_priority', name: { zh: '渣打 優先理財', en: 'SC Priority' }, stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-blue-600' },
  { id: 'sc_standard', name: { zh: '渣打 一般客戶', en: 'SC Standard' }, stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 1, type: 'trad', fundType: 'existing', channel: 'online', color: 'bg-blue-500' },
  { id: 'bea_supreme', name: { zh: '東亞 至尊理財', en: 'BEA SupremeGold' }, stockCode: '0023', domain: 'hkbea.com', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', rates: {}, minDeposit: 100000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-amber-600' },
  { id: 'icbc_elite', name: { zh: '工銀 理財金', en: 'ICBC Elite' }, stockCode: '1398', domain: 'icbcasia.com', url: 'https://www.icbcasia.com/hk/tc/personal/latest-promotion/online-time-deposit.html', rates: {}, minDeposit: 3000000, type: 'trad', fundType: 'new', channel: 'online', color: 'bg-red-800' },
  { id: 'ccb_prestige', name: { zh: '建行 貴賓理財', en: 'CCB Prestige' }, stockCode: '0939', domain: 'asia.ccb.com', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', rates: {}, minDeposit: 1000000, type: 'trad', fundType: 'existing', channel: 'online', color: 'bg-blue-900' },
  { id: 'public_online', name: { zh: '大眾 網上定存', en: 'Public Bank' }, stockCode: '0626', domain: 'publicbank.com.hk', url: 'https://www.publicbank.com.hk/en/usefultools/rates/depositinterestrates', rates: {}, minDeposit: 10000, type: 'trad', fundType: 'existing', channel: 'online', color: 'bg-orange-600' },
  { id: 'za', name: { zh: '眾安 ZA Bank', en: 'ZA Bank' }, stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: 'virt', fundType: 'existing', channel: 'mobile', color: 'bg-teal-600' },
  { id: 'fusion', name: { zh: '富融 Fusion', en: 'Fusion Bank' }, stockCode: 'VB02', domain: 'fusionbank.com', url: 'https://www.fusionbank.com/deposit.html?lang=tc', rates: {}, minDeposit: 1, type: 'virt', fundType: 'existing', channel: 'mobile', color: 'bg-purple-600' },
  { id: 'mox', name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'mox.com', url: 'https://mox.com/zh/promotions/time-deposit/', rates: {}, minDeposit: 1, type: 'virt', fundType: 'existing', channel: 'mobile', color: 'bg-black' },
  { id: 'paob', name: { zh: '平安 PAOB', en: 'PAOB' }, stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', fundType: 'existing', channel: 'mobile', color: 'bg-orange-500' },
];
 
export default function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [lastSync, setLastSync] = useState(null);
  const [syncedCount, setSyncedCount] = useState(0);
 
  const t = T[lang];
  const lK = lang === 'zh_TW' ? 'zh' : 'en';
 
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, u => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return () => unsubscribe();
  }, []);
 
  useEffect(() => {
    if (!user || !db) return;
    const unsubs = INITIAL_BANKS.map(bank => {
      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(ref, snap => {
        if (snap.exists()) {
          const data = snap.data();
          setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, rates: data.rates ?? {}, lastUpdated: data.lastUpdated } : b));
          setSyncedCount(prev => prev + 1);
          if (data.lastUpdated) setLastSync(data.lastUpdated);
        }
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user]);
 
  const sortedBanks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return banks
      .filter(b => {
        const nameMatch = b.name.zh.toLowerCase().includes(q) || b.name.en.toLowerCase().includes(q);
        const codeMatch = b.stockCode.toLowerCase().includes(q);
        if (q && !nameMatch && !codeMatch) return false;
        if (filterType !== 'all' && b.type !== filterType) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        return a.stockCode.localeCompare(b.stockCode);
      });
  }, [banks, tenor, searchQuery, filterType, sortBy]);
 
  const calcInt = (rate) => {
    if (!rate || !amount) return 0;
    const m = { '3m': 0.25, '6m': 0.5, '12m': 1 }[tenor];
    return Math.floor(amount * (rate / 100) * m);
  };
 
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased pb-20">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">{t.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${syncedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.syncing}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {['zh_TW', 'en'].map(l => (
              <button 
                key={l} 
                onClick={() => setLang(l)} 
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
              >
                {l === 'zh_TW' ? '繁' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            
            {/* Dashboard Controls */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap gap-8 items-end">
              <div className="space-y-2 flex-1 min-w-[240px]">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Wallet size={14} className="text-blue-500" /> {t.amountLabel}
                </label>
                <div className="flex items-center border-b-2 border-slate-100 focus-within:border-blue-500 transition-colors pb-1">
                  <span className="text-2xl font-black text-slate-300 mr-2">HK$</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(Number(e.target.value))} 
                    className="w-full bg-transparent text-4xl font-black outline-none tabular-nums" 
                  />
                </div>
              </div>

              <div className="space-y-2 w-full md:w-auto">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CalendarDays size={14} className="text-blue-500" /> {t.tenorLabel}
                </label>
                <div className="flex bg-slate-50 p-1 rounded-2xl gap-1">
                  {['3m', '6m', '12m'].map(m => (
                    <button 
                      key={m} 
                      onClick={() => setTenor(m)} 
                      className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder={t.searchPlace} 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" 
                />
              </div>
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (
                  <button key={v} onClick={() => setFilterType(v)} className={`px-6 py-2 text-xs font-black rounded-xl transition-all ${filterType === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>{l}</button>
                ))}
              </div>
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm items-center px-4 gap-3">
                <SortAsc size={16} className="text-blue-500" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent text-xs font-black outline-none cursor-pointer text-slate-600 uppercase">
                  <option value="rate">{t.sortRate}</option>
                  <option value="stock">{t.sortCode}</option>
                </select>
              </div>
            </div>

            {/* Compact Bank List */}
            <div className="grid gap-3">
              {sortedBanks.map(bank => {
                const r = bank.rates?.HKD?.[tenor];
                const hasR = r != null && r > 0;
                const belowMin = amount < bank.minDeposit;

                return (
                  <div 
                    key={bank.id} 
                    className={`group bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4 transition-all hover:shadow-lg hover:border-blue-200 ${belowMin ? 'opacity-40 grayscale' : ''}`}
                  >
                    <div className={`w-1.5 h-12 rounded-full ${bank.color} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                    
                    <div className="flex items-center gap-4 min-w-[320px] flex-1">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 p-2 border border-slate-100 flex items-center justify-center shrink-0">
                        <img 
                          src={`https://www.google.com/s2/favicons?sz=64&domain=${bank.domain}`} 
                          className="w-full h-full object-contain" 
                          alt=""
                          onError={e => e.target.style.display = 'none'} 
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-lg tracking-tight text-slate-800">{bank.name[lK]}</h3>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded uppercase tracking-tighter">{bank.stockCode}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase ${bank.fundType === 'new' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {bank.fundType === 'new' ? t.newFund : t.existingFund}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1 uppercase">
                            {bank.channel === 'mobile' ? <Smartphone size={10} /> : <MousePointer2 size={10} />}
                            {bank.channel === 'mobile' ? t.mobile : t.online}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase ml-1">
                            <ShieldCheck size={11} className="text-slate-300" /> {t.minDeposit}: HK${bank.minDeposit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 md:gap-12 ml-auto">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.rateLabel}</p>
                        <p className={`text-3xl font-black tabular-nums leading-none ${hasR ? 'text-slate-900' : 'text-slate-100'}`}>
                          {hasR ? `${r.toFixed(3)}%` : '--'}
                        </p>
                      </div>
                      <div className="text-right min-w-[140px]">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.interestLabel}</p>
                        <p className={`text-2xl font-black tabular-nums leading-none ${hasR ? 'text-emerald-500' : 'text-slate-100'}`}>
                          {hasR ? `+${calcInt(r).toLocaleString()}` : '--'}
                        </p>
                      </div>
                      <a href={bank.url} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0">
                        <ArrowUpRight size={20} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Ad Slot */}
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex items-center justify-center min-h-[120px]">
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">{t.adLabel}</p>
                <div className="w-full h-full bg-slate-50 rounded animate-pulse flex items-center justify-center">
                   {/* Place AdSense Code Snippet Here */}
                   <span className="text-xs text-slate-300 font-medium">Responsive Banner Ad Slot</span>
                </div>
              </div>
            </div>

            {/* Updated Footer */}
            <footer className="mt-12 p-10 bg-white rounded-3xl border border-slate-200 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-slate-900 rotate-12">
                <ShieldCheck size={160} />
              </div>
              <div className="flex items-center gap-3 text-slate-900 font-black uppercase tracking-widest text-sm">
                <ShieldCheck size={20} className="text-blue-500" /> 
                Compliance & Transparency
              </div>
              <div className="grid md:grid-cols-2 gap-8 text-xs font-bold text-slate-400 leading-relaxed uppercase">
                <p>• {t.lastUpdateBy}{lastSync || t.notAvailable}</p>
                <p>• {lang === 'zh_TW' ? '新資金優惠通常要求存款金額需為過去一段時間內的新增結餘。' : 'New fund offers typically require the amount to be fresh balance.'}</p>
              </div>
              <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                <span>Powered by HK FD Tracker Pro</span>
                <span>Est. 2026</span>
              </div>
            </footer>
          </div>

          {/* Right Sidebar Ad Slot */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex flex-col items-center min-h-[600px] shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">{t.adLabel}</p>
                <div className="w-full flex-1 bg-slate-50 rounded border border-slate-100 flex items-center justify-center text-center p-4">
                  {/* Place AdSense Skyscraper Code Snippet Here */}
                  <span className="text-xs text-slate-300 font-medium leading-relaxed">
                    Vertical Skyscraper Ad Slot<br/>
                    (300x600)
                  </span>
                </div>
              </div>
              
              {/* Optional: Small Info Box below sidebar ad */}
              <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-100">
                <Info size={24} className="mb-4" />
                <h4 className="font-black text-sm uppercase tracking-widest mb-2">Pro Tip</h4>
                <p className="text-xs font-bold leading-relaxed opacity-90 uppercase">
                  Always check if you qualify for "New Fund" status to unlock the highest rates.
                </p>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}