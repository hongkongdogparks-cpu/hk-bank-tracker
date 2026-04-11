import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, Search, ExternalLink, SortAsc, 
  Building2, CalendarDays, Wallet, ShieldCheck,
  RefreshCw, AlertCircle
} from 'lucide-react';

// --- Firebase 配置 ---
// ⚠️ apiKey 留空，執行環境將自動注入
const firebaseConfig = {
  apiKey: "", 
  authDomain: "hk-bank-tracker.firebaseapp.com",
  projectId: "hk-bank-tracker",
  storageBucket: "hk-bank-tracker.firebasestorage.app",
  messagingSenderId: "631669349028",
  appId: "1:631669349028:web:c417086999a022363ce431"
};

// 安全初始化 Firebase
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

const appId = 'hk-fd-tracker-pro'; // 💡 與 scraper.js 一致

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
    searchPlace: "Search bank or code...",
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

// 💡 初始狀態完全不設預設利率，由爬蟲提供
const INITIAL_BANKS = [
  // --- 傳統大行 (HSBC) ---
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '尊尚特惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '卓越特惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one', name: '滙豐 HSBC One / 一般', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },
  
  // --- 恒生 (Hang Seng) ---
  { id: 'hangseng_prestige', name: '恒生 優越理財', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '特優利率', color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '一般優惠', color: 'bg-green-100 text-green-800 border-green-200' },

  // --- 中銀 (BOC) ---
  { id: 'boc_wealth', name: '中銀理財', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '理財晉級', color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般帳戶', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '手機銀行', color: 'bg-red-50 text-red-700 border-red-100' },

  // --- 渣打 (SC) ---
  { id: 'sc_priority', name: '渣打 優先理財', stockCode: '2888', domain: 'sc.com/hk', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'sc_standard', name: '渣打 一般帳戶', stockCode: '2888', domain: 'sc.com/hk', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上特惠', color: 'bg-blue-50 text-blue-700 border-blue-100' },

  // --- 其他主要大行 ---
  { id: 'bea_supreme', name: '東亞 至尊理財', stockCode: '0023', domain: 'hkbea.com', url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '至尊理財', color: 'bg-red-800 text-white' },
  { id: 'icbc_elite', name: '工銀亞洲 理財金', stockCode: '1398', domain: 'icbcasia.com', url: 'https://www.icbcasia.com/tc/personal/deposits/index.html', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '理財尊享', color: 'bg-red-700 text-white' },
  { id: 'ccb_prestige', name: '建行亞洲 貴賓理財', stockCode: '0939', domain: 'asia.ccb.com', url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '貴賓尊享', color: 'bg-blue-900 text-white' },
  { id: 'public_online', name: '大眾銀行 網上定存', stockCode: '0626', domain: 'publicbank.com.hk', url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-800 border-red-100' },

  // --- 虛擬銀行 (VB) ---
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-800 border-teal-100' },
  { id: 'paob', name: '平安壹賬通', stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: '虛擬', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-800 border-orange-100' },
  { id: 'fusion', name: '富融銀行 (Fusion)', stockCode: 'VB02', domain: 'fusionbank.com', url: 'https://www.fusionbank.com/', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '靈活存', color: 'bg-purple-50 text-purple-800 border-purple-100' },
  { id: 'livi', name: 'Livi Bank', stockCode: 'VB03', domain: 'livibank.com', url: 'https://www.livibank.com/', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: 'liviSave', color: 'bg-blue-50 text-blue-800 border-blue-100' },
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

  // Firebase 匿名登入
  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 監聽實時數據更新
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

  // 排序與篩選
  const processedBanks = useMemo(() => {
    const typePriority = { '傳統': 1, '虛擬': 2 };

    return banks
      .filter(bank => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = bank.name.toLowerCase().includes(query) || bank.stockCode.toLowerCase().includes(query);
        const matchesType = filterType === '全部' || (filterType === t.trad ? bank.type === '傳統' : bank.type === '虛擬');
        const matchesFund = bank.fundType === 'both' || bank.fundType === fundSource;
        return matchesSearch && matchesType && matchesFund;
      })
      .sort((a, b) => {
        // 首先按銀行類別 (傳統優先)
        const priorityA = typePriority[a.type] || 3;
        const priorityB = typePriority[b.type] || 3;
        if (priorityA !== priorityB) return priorityA - priorityB;

        // 次之按選擇的排序方式
        if (sortBy === 'rate') {
          const rA = (a.rates['HKD'] && a.rates['HKD'][tenor]) || 0;
          const rB = (b.rates['HKD'] && b.rates['HKD'][tenor]) || 0;
          return rB - rA;
        } else {
          // 編號排序：虛擬銀行被賦予 99999 確保在最後
          const codeA = a.type === '虛擬' ? 99999 : parseInt(a.stockCode);
          const codeB = b.type === '虛擬' ? 99999 : parseInt(b.stockCode);
          return codeA - codeB;
        }
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, sortBy, t]);

  const getInterest = (rate) => {
    if (!rate) return null;
    const tMap = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 };
    return Math.floor(amount * (rate / 100) * tMap[tenor]).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-200">
              <RefreshCw className={`w-3 h-3 ${!lastSync ? 'animate-spin' : ''}`} />
              {lastSync ? `Updated: ${lastSync}` : t.syncStatus}
            </span>
            <h1 className="text-5xl font-black tracking-tighter flex items-center gap-3">
              <TrendingUp className="w-12 h-12 text-blue-600" />
              {t.title}
            </h1>
            <p className="text-slate-500 font-bold text-lg opacity-70">{t.subtitle}</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
            {['zh_TW', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${lang === l ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
            ))}
          </div>
        </header>

        {/* Input Card */}
        <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" /> {t.amountLabel} (HKD)
              </label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
                className="w-full bg-slate-50 px-8 py-5 rounded-3xl text-4xl font-black outline-none border-none focus:ring-4 focus:ring-blue-100 transition-all" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" /> 選擇存期
              </label>
              <div className="flex gap-2 h-full pb-1">
                {['1m', '3m', '6m', '12m'].map(m => (
                  <button key={m} onClick={() => setTenor(m)} className={`flex-1 rounded-2xl text-xs font-black transition-all border-2 ${tenor === m ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input 
              type="text" 
              placeholder={t.searchPlace} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full pl-16 pr-8 py-4 bg-white border border-slate-200 rounded-[2rem] font-bold outline-none shadow-sm focus:border-blue-500 transition-all" 
            />
          </div>
          <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
            {[t.all, t.trad, t.virt].map(type => (
              <button key={type} onClick={() => setFilterType(type)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${filterType === type ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{type}</button>
            ))}
          </div>
          <div className="bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-blue-500 ml-3" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent font-black text-[11px] outline-none cursor-pointer pr-4">
              <option value="stockCode">{t.sortCode}</option>
              <option value="rate">{t.sortRate}</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="grid gap-5">
          {processedBanks.map(bank => {
            const rate = bank.rates['HKD']?.[tenor];
            const hasRate = rate !== undefined && rate !== null;
            const interest = getInterest(rate);

            return (
              <div 
                key={bank.id} 
                className={`bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-wrap items-center justify-between hover:shadow-2xl transition-all group ${amount < bank.minDeposit ? 'opacity-30 grayscale pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 p-2 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <img src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} className="w-full h-full object-contain opacity-80" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{bank.name}</h3>
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase">{bank.stockCode}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${bank.color}`}>{bank.offer}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">起存額: ${bank.minDeposit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-12 mt-8 md:mt-0 w-full md:w-auto pt-8 md:pt-0 border-t md:border-t-0 border-slate-50">
                  <div className="text-right flex-1 md:flex-none">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{t.rateLabel}</p>
                    <p className={`text-4xl font-black tabular-nums ${hasRate ? 'text-slate-900' : 'text-slate-200'}`}>
                      {hasRate ? `${rate.toFixed(2)}%` : t.notAvailable}
                    </p>
                  </div>
                  <div className="text-right min-w-[140px] md:min-w-[180px] flex-1 md:flex-none">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{t.interestLabel}</p>
                    <p className={`text-3xl font-black tabular-nums ${hasRate ? 'text-emerald-600' : 'text-slate-200'}`}>
                      {hasRate ? `+HKD ${interest}` : '---'}
                    </p>
                  </div>
                  <a 
                    href={bank.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="p-5 bg-slate-50 text-slate-300 rounded-[1.8rem] hover:bg-blue-50 hover:text-blue-600 transition-all hidden sm:flex"
                  >
                    <ExternalLink className="w-6 h-6" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="mt-20 p-12 bg-slate-900 rounded-[3.5rem] text-slate-400 text-xs border border-slate-800 shadow-2xl space-y-8">
          <div className="flex items-center gap-3 text-white font-black uppercase tracking-[0.3em]">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
            Market Compliance Notice
          </div>
          <div className="grid md:grid-cols-2 gap-12 opacity-80">
            <div className="space-y-4">
              <p>• 本系統數據由 GitHub Actions 雲端爬蟲於每天早上 08:00 (HKT) 自動從銀行官方網站提取。</p>
              <p>• 傳統銀行（按港交所上市編號排序）具有顯示優先權，虛擬銀行被歸類於列表底端。</p>
            </div>
            <div className="space-y-4">
              <p>• 所有年利率僅供參考，不構成任何投資建議。實際利率及起存額以銀行最終批核為準。</p>
              <p className="text-blue-400 italic font-bold">* 建議點擊卡片右側外部連結跳轉至官方頁面進行最終驗證。</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}