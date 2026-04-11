import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, Search, ExternalLink, SortAsc, 
  Building2, CalendarDays, Wallet, ShieldCheck,
  AlertCircle, RefreshCw
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "", 
  authDomain: "hk-bank-tracker.firebaseapp.com",
  projectId: "hk-bank-tracker",
  storageBucket: "hk-bank-tracker.firebasestorage.app",
  messagingSenderId: "631669349028",
  appId: "1:631669349028:web:c417086999a022363ce431"
};

// 安全初始化
let app, auth, db;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Init Error:", error);
}

const appId = 'hk-fd-tracker-pro';

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
    searchPlace: "搜尋銀行名稱或上市編號...",
    sortRate: "按利率排序",
    sortCode: "按編號排序",
    interestLabel: "預計利息收益",
    rateLabel: "年利率 p.a.",
    minDeposit: "起存額",
    amountLabel: "預計存款金額",
    notAvailable: "暫無提供",
    syncStatus: "雲端數據同步中"
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
    searchPlace: "Search bank or stock code...",
    sortRate: "By Rate",
    sortCode: "By Code",
    interestLabel: "Est. Interest",
    rateLabel: "Rate p.a.",
    minDeposit: "Min. Dep",
    amountLabel: "Deposit Amount",
    notAvailable: "N/A",
    syncStatus: "Cloud Syncing"
  }
};

// 💡 關鍵改動：移除了所有預設利率 (rates: {})，確保顯示 N/A 直到爬蟲抓到數據
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '尊尚特惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '卓越特惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one', name: '滙豐 HSBC One / 一般', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'hangseng_prestige', name: '恒生 優越理財', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '特優利率', color: 'bg-green-800 text-white' },
  { id: 'boc_wealth', name: '中銀理財', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '理財晉級', color: 'bg-red-800 text-white' },
  { id: 'sc_priority', name: '渣打 優先理財', stockCode: '2888', domain: 'sc.com/hk', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'paob', name: '平安壹賬通', stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: '虛擬', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-700 border-orange-100' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [fundSource, setFundSource] = useState('new');
  const [filterType, setFilterType] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('stockCode'); 
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [lastSync, setLastSync] = useState("");

  const t = translations[lang];

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.warn);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubscribes = banks.map(bank => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setBanks(prev => prev.map(b => b.id === bank.id ? { 
            ...b, 
            rates: data.rates || b.rates, 
            lastSync: data.lastUpdated 
          } : b));
          if (data.lastUpdated) setLastSync(data.lastUpdated);
        }
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user]);

  const processedBanks = useMemo(() => {
    const typePriority = { '傳統': 1, '虛擬': 2 };

    return banks
      .filter(bank => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = bank.name.toLowerCase().includes(query) || bank.stockCode.includes(query);
        const matchesType = filterType === '全部' || (filterType === t.trad ? bank.type === '傳統' : bank.type === '虛擬');
        const matchesFund = bank.fundType === 'both' || bank.fundType === fundSource;
        return matchesSearch && matchesType && matchesFund;
      })
      .sort((a, b) => {
        const priorityA = typePriority[a.type] || 3;
        const priorityB = typePriority[b.type] || 3;
        if (priorityA !== priorityB) return priorityA - priorityB;

        if (sortBy === 'rate') {
          const rA = (a.rates['HKD'] && a.rates['HKD'][tenor]) || 0;
          const rB = (b.rates['HKD'] && b.rates['HKD'][tenor]) || 0;
          return rB - rA;
        } else {
          const codeA = a.type === '虛擬' ? 99999 : parseInt(a.stockCode);
          const codeB = b.type === '虛擬' ? 99999 : parseInt(b.stockCode);
          return codeA - codeB;
        }
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, sortBy, t]);

  const getInterest = (rate) => {
    if (!rate) return null;
    const tenorMap = { '1m': 1/12, '3m': 1/4, '6m': 1/2, '12m': 1 };
    return Math.floor(amount * (rate / 100) * tenorMap[tenor]).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans p-4 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter">
                <RefreshCw className={`w-3 h-3 ${!lastSync ? 'animate-spin' : ''}`} />
                {lastSync ? `LAST SYNC: ${lastSync}` : t.syncStatus}
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter flex items-center gap-4">
              <TrendingUp className="w-12 h-12 text-blue-600" />
              {t.title}
            </h1>
            <p className="text-slate-500 font-bold text-lg">{t.subtitle}</p>
          </div>
          <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <button onClick={() => setLang('zh_TW')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === 'zh_TW' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>繁</button>
            <button onClick={() => setLang('en')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>EN</button>
          </div>
        </header>

        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 mb-10">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">{t.amountLabel} (HKD)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(Number(e.target.value))} 
            className="w-full bg-slate-50 px-8 py-5 rounded-3xl text-4xl font-black outline-none border-none focus:ring-4 focus:ring-blue-100 transition-all" 
          />
        </section>

        <div className="sticky top-4 z-50 space-y-4 mb-10">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-[2rem] border border-slate-200 shadow-xl flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                type="text" 
                placeholder={t.searchPlace} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full pl-14 pr-6 py-4 bg-slate-100 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <div className="flex items-center gap-4 px-4 border-l border-slate-200">
              <SortAsc className="w-5 h-5 text-blue-500" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-black text-sm outline-none cursor-pointer">
                <option value="stockCode">{t.sortCode}</option>
                <option value="rate">{t.sortRate}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 shadow-sm">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.tenor}</span>
              </div>
              {['1m', '3m', '6m', '12m'].map(m => (
                <button 
                  key={m} 
                  onClick={() => setTenor(m)} 
                  className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${tenor === m ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 shadow-sm">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.fundSource}</span>
              </div>
              <button onClick={() => setFundSource('new')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${fundSource === 'new' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{t.fundNew}</button>
              <button onClick={() => setFundSource('existing')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${fundSource === 'existing' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{t.fundExt}</button>
            </div>

            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 shadow-sm">
              <div className="px-3 py-1 flex items-center gap-2 border-r border-slate-100 mr-1">
                <Building2 className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase">{t.bankType}</span>
              </div>
              {[t.all, t.trad, t.virt].map(type => (
                <button 
                  key={type} 
                  onClick={() => setFilterType(type)} 
                  className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${filterType === type ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {processedBanks.map(bank => {
            const currentRate = bank.rates['HKD'] && bank.rates['HKD'][tenor];
            const isAvailable = currentRate !== null && currentRate !== undefined;
            const interest = getInterest(currentRate);

            return (
              <div 
                key={bank.id} 
                className={`bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 flex flex-wrap items-center justify-between hover:shadow-xl transition-all group ${amount < bank.minDeposit ? 'opacity-40 grayscale pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                     <img 
                      src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} 
                      alt={bank.name} 
                      className="w-full h-full object-contain" 
                      onError={(e) => { e.target.src = "https://www.gstatic.com/images/branding/product/1x/generic_bank_64dp.png"}}
                     />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                      {bank.name}
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md uppercase">{bank.stockCode}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase ${bank.color}`}>{bank.offer}</span>
                      <span className="text-[10px] font-black text-slate-400">起存: ${bank.minDeposit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-12 mt-6 md:mt-0 w-full md:w-auto pt-6 md:pt-0 border-t md:border-t-0 border-slate-50">
                  <div className="text-right flex-1 md:flex-none">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.rateLabel}</p>
                    <p className={`text-3xl md:text-4xl font-black tabular-nums ${isAvailable ? 'text-slate-900' : 'text-slate-200'}`}>
                      {isAvailable ? `${currentRate.toFixed(2)}%` : t.notAvailable}
                    </p>
                  </div>
                  <div className="text-right min-w-[120px] md:min-w-[150px] flex-1 md:flex-none">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{t.interestLabel}</p>
                    <p className={`text-2xl md:text-3xl font-black tabular-nums ${isAvailable ? 'text-emerald-600' : 'text-slate-200'}`}>
                      {isAvailable ? `+HKD ${interest}` : "---"}
                    </p>
                  </div>
                  <a 
                    href={bank.url || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-4 bg-slate-50 text-slate-300 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all hidden sm:flex"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-16 p-10 bg-slate-900 rounded-[2.5rem] text-slate-400 text-xs leading-relaxed border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3 text-white font-black mb-6 uppercase tracking-[0.2em]">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            Market Compliance & Notice
          </div>
          <div className="grid md:grid-cols-2 gap-8 opacity-80">
            <div className="space-y-3">
              <p>• 系統數據自動與 GitHub Actions 雲端爬蟲同步，提取即時官網數據。</p>
              <p>• 數據區塊若顯示 N/A 代表當前存期暫無最新港元利率，請參考其他存期。</p>
            </div>
            <div className="space-y-3">
              <p>• 所有年利率僅供參考，實際利率及起存額以銀行最終批核與官網公告為準。</p>
              <p className="text-blue-400 italic font-bold">* 建議點擊右側外部連結跳轉至官網核實最新優惠。</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}