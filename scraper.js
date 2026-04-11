import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, Search, Calculator, RefreshCw, Info, ExternalLink, Sparkles, 
  ArrowUpDown, Zap, Globe, Bell, Activity, ShieldCheck, Filter, SortAsc, 
  CheckCircle2, Building2, CalendarDays, Wallet
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "placeholder",
  authDomain: "placeholder",
  projectId: "placeholder",
  appId: "placeholder"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'hk-fd-tracker-pro';

const translations = {
  zh_TW: {
    title: "香港定期存款追蹤器",
    subtitle: "專業級定存利率監控系統",
    fundNew: "全新資金",
    fundExt: "現有資金",
    tenor: "存期",
    fundSource: "資金",
    bankType: "類型",
    all: "全部",
    trad: "傳統大行",
    virt: "虛擬銀行",
    searchPlace: "搜尋銀行或上市編號...",
    sortRate: "按利率排序",
    sortCode: "按上市編號",
    eligibleOnly: "符合金額",
    updated: "雲端同步",
    marketAvg: "市場均值",
    interestLabel: "預計利息",
    rateLabel: "年利率 p.a.",
    minDeposit: "起存額",
    amountLabel: "預計存款金額",
    notAvailable: "暫無提供"
  },
  en: {
    title: "HK Deposit Tracker",
    subtitle: "Professional FD Monitoring System",
    fundNew: "New Money",
    fundExt: "Existing",
    tenor: "Tenor",
    fundSource: "Fund",
    bankType: "Type",
    all: "All",
    trad: "Traditional",
    virt: "Virtual",
    searchPlace: "Search bank...",
    sortRate: "By Interest",
    sortCode: "By Code",
    eligibleOnly: "Eligible Only",
    updated: "Cloud Sync",
    marketAvg: "Market Avg",
    interestLabel: "Est. Interest",
    rateLabel: "Rate p.a.",
    minDeposit: "Min. Dep",
    amountLabel: "Deposit Amount",
    notAvailable: "N/A"
  }
};

const INITIAL_BANKS = [
  // --- 滙豐銀行 (HSBC) ---
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '1m': null, '3m': 3.6, '6m': 3.4, '12m': 1.6 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '尊尚特惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '1m': null, '3m': 3.4, '6m': 3.1, '12m': 1.6 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '卓越特惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one', name: '滙豐 HSBC One / 一般', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '1m': null, '3m': 2.2, '6m': 2.0, '12m': 1.6 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },
  
  // --- 恒生銀行 (Hang Seng) ---
  { id: 'hangseng_prestige', name: '恒生 優越理財', stockCode: '0011', domain: 'hangseng.com', rates: { HKD: { '1m': null, '3m': 3.6, '6m': 3.4, '12m': 2.0 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '特優利率', color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶', stockCode: '0011', domain: 'hangseng.com', rates: { HKD: { '1m': null, '3m': 3.3, '6m': 3.1 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-green-50 text-green-700 border-green-100' },

  // --- 中國銀行 (BOC) ---
  { id: 'boc_wealth', name: '中銀理財', stockCode: '2388', domain: 'bochk.com', rates: { HKD: { '1m': null, '3m': 3.5, '6m': 3.3 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '理財晉級', color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般帳戶', stockCode: '2388', domain: 'bochk.com', rates: { HKD: { '1m': null, '3m': 3.3, '6m': 3.1 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '手機銀行', color: 'bg-red-50 text-red-600 border-red-100' },

  // --- 渣打銀行 (Standard Chartered) ---
  { id: 'sc_priority', name: '渣打 優先理財', stockCode: '2888', domain: 'sc.com/hk', rates: { HKD: { '1m': null, '3m': 3.5, '6m': 3.5 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'sc_standard', name: '渣打 一般帳戶', stockCode: '2888', domain: 'sc.com/hk', rates: { HKD: { '1m': null, '3m': 3.3, '6m': 3.3 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上特優', color: 'bg-blue-50 text-blue-700 border-blue-100' },

  // --- 東亞銀行 (BEA) ---
  { id: 'bea_supreme', name: '東亞 至尊理財', stockCode: '0023', domain: 'hkbea.com', rates: { HKD: { '3m': 3.7, '6m': 3.5 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '至尊理財', color: 'bg-red-800 text-white' },
  { id: 'bea_standard', name: '東亞 一般帳戶', stockCode: '0023', domain: 'hkbea.com', rates: { HKD: { '3m': 3.4, '6m': 3.2 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },

  // --- 工銀亞洲 (ICBC Asia) ---
  { id: 'icbc_elite', name: '工銀亞洲 綜合帳戶/理財', stockCode: '1398', domain: 'icbcasia.com', rates: { HKD: { '3m': 3.8, '6m': 3.5 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '網上特惠', color: 'bg-red-700 text-white' },
  { id: 'icbc_standard', name: '工銀亞洲 一般帳戶', stockCode: '1398', domain: 'icbcasia.com', rates: { HKD: { '3m': 3.5, '6m': 3.3 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '標準優惠', color: 'bg-red-50 text-red-700 border-red-100' },

  // --- 建行亞洲 (CCB Asia) ---
  { id: 'ccb_prestige', name: '建行亞洲 貴賓理財', stockCode: '000939', domain: 'asia.ccb.com', rates: { HKD: { '3m': 3.9, '6m': 3.7 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '貴賓尊享', color: 'bg-blue-900 text-white' },
  { id: 'ccb_online', name: '建行亞洲 網上優惠', stockCode: '000939', domain: 'asia.ccb.com', rates: { HKD: { '3m': 3.8, '6m': 3.6 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '網上尊享', color: 'bg-blue-50 text-blue-700 border-blue-100' },

  // --- 其他大行 ---
  { id: 'public_online', name: '大眾銀行 網上定存', stockCode: '0626', domain: 'publicbank.com.hk', rates: { HKD: { '3m': 3.75, '6m': 3.5 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },

  // --- 虛擬銀行 ---
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', rates: { HKD: { '1m': 1.0, '3m': 4.0, '6m': 3.6, '12m': 3.2 } }, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'paob', name: '平安壹賬通', stockCode: 'VB05', domain: 'paob.com.hk', rates: { HKD: { '3m': 3.8, '6m': 3.6, '12m': 3.0 } }, minDeposit: 100, type: '虛擬', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-700 border-orange-100' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('zh_TW');
  const [currency] = useState('HKD');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [fundSource, setFundSource] = useState('new');
  const [filterType, setFilterType] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [lastSyncTime, setLastSyncTime] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribes = banks.map(bank => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, rates: data.rates || b.rates, lastUpdated: data.lastUpdated } : b));
          if (data.lastUpdated) setLastSyncTime(data.lastUpdated);
        }
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user]);

  const sortedBanks = useMemo(() => {
    return banks
      .filter(bank => {
        const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === '全部' || (filterType === t.trad ? bank.type === '傳統' : bank.type === '虛擬');
        const matchesFund = bank.fundType === 'both' || bank.fundType === fundSource;
        const meetsMin = !eligibleOnly || amount >= bank.minDeposit;
        return matchesSearch && matchesType && matchesFund && meetsMin;
      })
      .sort((a, b) => {
        const rateA = (a.rates[currency] && a.rates[currency][tenor]) || 0;
        const rateB = (b.rates[currency] && b.rates[currency][tenor]) || 0;
        if (sortBy === 'rate') return rateB - rateA;
        return parseInt(a.stockCode.replace(/\D/g,'')) - parseInt(b.stockCode.replace(/\D/g,''));
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, eligibleOnly, amount, sortBy, t]);

  const calculateInterest = (rate) => {
    if (!rate) return "---";
    const tMap = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 };
    return Math.floor(amount * (rate / 100) * tMap[tenor]).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-lg shadow-blue-200">Live API</span>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.updated}: {lastSyncTime || '--:--'}</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter flex items-center gap-4 text-slate-900">
              <TrendingUp className="w-12 h-12 text-blue-600" />
              {t.title}
            </h1>
            <p className="text-slate-500 font-bold mt-2 text-lg opacity-80">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100">
             <button onClick={() => setLang('zh_TW')} className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${lang === 'zh_TW' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>繁</button>
             <button onClick={() => setLang('en')} className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>EN</button>
          </div>
        </div>

        {/* Amount Input Large */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 mb-10">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">{t.amountLabel} (HKD)</label>
          <div className="flex items-center gap-6">
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(Number(e.target.value))} 
              className="flex-1 bg-slate-50 px-8 py-5 rounded-[2rem] text-4xl font-black outline-none focus:ring-4 focus:ring-blue-100 transition-all border-none"
            />
            <div className="hidden md:flex flex-col items-end">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Market Benchmark</p>
              <p className="text-2xl font-black text-blue-600">3.25%</p>
            </div>
          </div>
        </div>

        {/* Combined Search & Filter Bar */}
        <div className="sticky top-4 z-50 space-y-4 mb-10">
          <div className="bg-white/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
              <input 
                type="text" 
                placeholder={t.searchPlace} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full pl-16 pr-8 py-4 bg-slate-100 border-none rounded-[1.8rem] font-bold outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-4 px-4 border-l border-slate-200">
              <SortAsc className="w-5 h-5 text-blue-500" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-black text-sm outline-none cursor-pointer">
                <option value="rate">{t.sortRate}</option>
                <option value="stockCode">{t.sortCode}</option>
              </select>
              <div className="w-px h-6 bg-slate-100" />
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={eligibleOnly} onChange={() => setEligibleOnly(!eligibleOnly)} className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-xs font-black text-slate-500 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{t.eligibleOnly}</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="bg-white p-2 rounded-[1.8rem] border border-slate-200 shadow-sm flex items-center gap-1">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.tenor}</span>
              </div>
              {['1m', '3m', '6m', '12m'].map(m => (
                <button key={m} onClick={() => setTenor(m)} className={`px-5 py-2 rounded-2xl text-[11px] font-black transition-all ${tenor === m ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}>{m === '1m' ? '1個月' : m === '3m' ? '3個月' : m === '6m' ? '6個月' : '12個月'}</button>
              ))}
            </div>

            <div className="bg-white p-2 rounded-[1.8rem] border border-slate-200 shadow-sm flex items-center gap-1">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.fundSource}</span>
              </div>
              <button onClick={() => setFundSource('new')} className={`px-5 py-2 rounded-2xl text-[11px] font-black transition-all ${fundSource === 'new' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}>{t.fundNew}</button>
              <button onClick={() => setFundSource('existing')} className={`px-5 py-2 rounded-2xl text-[11px] font-black transition-all ${fundSource === 'existing' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}>{t.fundExt}</button>
            </div>

            <div className="bg-white p-2 rounded-[1.8rem] border border-slate-200 shadow-sm flex items-center gap-1">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <Building2 className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.bankType}</span>
              </div>
              {[t.all, t.trad, t.virt].map(type => (
                <button key={type} onClick={() => setFilterType(type)} className={`px-5 py-2 rounded-2xl text-[11px] font-black transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-500'}`}>{type}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Bank Results List */}
        <div className="space-y-4">
          {sortedBanks.map(bank => {
            const currentRate = bank.rates[currency] && bank.rates[currency][tenor];
            const isAvailable = currentRate !== null && currentRate !== undefined;

            return (
              <div key={bank.id} className={`bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-wrap items-center justify-between hover:shadow-2xl hover:border-blue-300 transition-all group ${amount < bank.minDeposit ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 p-2 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                     <img src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} alt={bank.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-black tracking-tight text-slate-900">{bank.name}</h3>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-lg uppercase">{bank.stockCode}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${bank.color}`}>{bank.offer}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">{t.minDeposit}: ${bank.minDeposit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-12 mt-8 md:mt-0 w-full md:w-auto justify-between md:justify-end border-t border-slate-50 md:border-t-0 pt-6 md:pt-0">
                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.rateLabel}</p>
                    <p className={`text-4xl font-black tabular-nums ${isAvailable ? 'text-slate-900' : 'text-slate-300 text-xl'}`}>
                      {isAvailable ? `${currentRate.toFixed(2)}%` : t.notAvailable}
                    </p>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.interestLabel}</p>
                    <p className={`text-3xl font-black tabular-nums ${isAvailable ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {isAvailable ? `+HKD ${calculateInterest(currentRate)}` : "---"}
                    </p>
                  </div>
                  <button className="hidden sm:flex p-5 bg-slate-50 text-slate-300 rounded-[1.8rem] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <ExternalLink className="w-6 h-6" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-16 p-10 bg-slate-900 rounded-[3.5rem] text-slate-400 text-xs leading-relaxed border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3 text-white font-black mb-4 uppercase tracking-[0.2em]">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            Important Market Notice
          </div>
          <p>• 本系統數據連動 GitHub Actions 雲端自動化爬蟲，每小時從各銀行官網及特優利率頁面提取即時數據。</p>
          <p className="mt-2">• 上市編號排序政策：列表按港交所編號排序，滙豐 (0005) 排在首位。虛擬銀行則列於列表末端。</p>
          <p className="mt-2 text-blue-400/60 italic">* 所有年利率僅供參考，實際利率以銀行最後批核為準。</p>
        </div>

      </div>
    </div>
  );
}