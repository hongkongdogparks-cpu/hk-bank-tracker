import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, Search, ExternalLink, SortAsc, 
  Building2, CalendarDays, Wallet, ShieldCheck,
  RefreshCw, ChevronRight
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "", // 執行環境自動注入
  authDomain: "hk-bank-tracker.firebaseapp.com",
  projectId: "hk-bank-tracker",
  storageBucket: "hk-bank-tracker.firebasestorage.app",
  messagingSenderId: "631669349028",
  appId: "1:631669349028:web:c417086999a022363ce431"
};

let app, auth, db;
try {
  if (!getApps().length) { app = initializeApp(firebaseConfig); } 
  else { app = getApps()[0]; }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.error(e); }

const appId = 'hk-fd-tracker-pro';

const INITIAL_BANKS = [
  // --- 傳統大行 ---
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '尊尚特惠', color: 'bg-red-900 text-white' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/premier-elite/offers/time-deposit-rate/', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '卓越特惠', color: 'bg-red-700 text-white' },
  { id: 'hsbc_one', name: '滙豐 HSBC One / 一般', stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-100 text-red-800' },
  { id: 'hangseng_prestige', name: '恒生 優越理財', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '特優利率', color: 'bg-green-800 text-white' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶', stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '一般優惠', color: 'bg-green-100 text-green-800' },
  { id: 'boc_wealth', name: '中銀理財', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '理財晉級', color: 'bg-red-800 text-white' },
  { id: 'boc_standard', name: '中銀 一般帳戶', stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/zh/deposits/promotions/timedeposit.html', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '手機銀行', color: 'bg-red-100 text-red-800' },
  { id: 'sc_priority', name: '渣打 優先理財', stockCode: '2888', domain: 'sc.com/hk', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '優先理財', color: 'bg-blue-800 text-white' },
  { id: 'sc_standard', name: '渣打 一般帳戶', stockCode: '2888', domain: 'sc.com/hk', url: 'https://www.sc.com/hk/zh/save/time-deposits/', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上特惠', color: 'bg-blue-100 text-blue-800' },
  { id: 'bea_supreme', name: '東亞 至尊理財', stockCode: '0023', domain: 'hkbea.com', url: 'https://www.hkbea.com/html/zh/bea-personal-banking-deposit-time-deposit-offers.html', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '至尊理財', color: 'bg-red-700 text-white' },
  { id: 'icbc_elite', name: '工銀亞洲 理財金', stockCode: '1398', domain: 'icbcasia.com', url: 'https://www.icbcasia.com/tc/personal/deposits/index.html', rates: {}, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '理財尊享', color: 'bg-red-700 text-white' },
  { id: 'ccb_prestige', name: '建行亞洲 貴賓理財', stockCode: '0939', domain: 'asia.ccb.com', url: 'https://www.asia.ccb.com/hongkong_tc/personal/banking/deposits/index.html', rates: {}, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '貴賓尊享', color: 'bg-blue-900 text-white' },
  { id: 'public_online', name: '大眾銀行 網上定存', stockCode: '0626', domain: 'publicbank.com.hk', url: 'https://www.publicbank.com.hk/zh-hant/personalbanking/deposits/timedeposit', rates: {}, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-100 text-red-800' },

  // --- 虛擬銀行 ---
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-800' },
  { id: 'paob', name: '平安壹賬通', stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: '虛擬', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-800' },
  { id: 'fusion', name: '富融銀行 (Fusion)', stockCode: 'VB02', domain: 'fusionbank.com', url: 'https://www.fusionbank.com/', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '靈活存', color: 'bg-purple-50 text-purple-800' },
  { id: 'livi', name: 'Livi Bank', stockCode: 'VB03', domain: 'livibank.com', url: 'https://www.livibank.com/', rates: {}, minDeposit: 1, type: '虛擬', fundType: 'both', offer: 'liviSave', color: 'bg-blue-50 text-blue-800' },
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

  const t = {
    zh_TW: { title: "港元定存追蹤器", trad: "傳統大行", virt: "虛擬銀行", notAvailable: "暫無提供", updated: "雲端更新" },
    en: { title: "HKD FD Tracker", trad: "Traditional", virt: "Virtual", notAvailable: "N/A", updated: "Cloud Sync" }
  }[lang];

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.warn);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubscribes = banks.map(bank => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rates', bank.id);
      return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, rates: data.rates || b.rates } : b));
          if (data.lastUpdated) setLastSync(data.lastUpdated);
        }
      });
    });
    return () => unsubscribes.forEach(u => u());
  }, [user]);

  const processedBanks = useMemo(() => {
    return banks
      .filter(b => {
        const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.stockCode.includes(searchQuery);
        const matchesType = filterType === '全部' || (filterType === t.trad ? b.type === '傳統' : b.type === '虛擬');
        const matchesFund = b.fundType === 'both' || b.fundType === fundSource;
        return matchesSearch && matchesType && matchesFund;
      })
      .sort((a, b) => {
        const typePriority = { '傳統': 1, '虛擬': 2 };
        if (typePriority[a.type] !== typePriority[b.type]) return typePriority[a.type] - typePriority[b.type];
        if (sortBy === 'rate') {
          return ((b.rates['HKD']?.[tenor]) || 0) - ((a.rates['HKD']?.[tenor]) || 0);
        }
        const codeA = a.type === '虛擬' ? 99999 : parseInt(a.stockCode);
        const codeB = b.type === '虛擬' ? 99999 : parseInt(b.stockCode);
        return codeA - codeB;
      });
  }, [banks, tenor, searchQuery, filterType, fundSource, sortBy, t]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase">
              <RefreshCw className={`w-3 h-3 ${!lastSync ? 'animate-spin' : ''}`} />
              {lastSync ? `Updated: ${lastSync}` : 'Syncing...'}
            </span>
            <h1 className="text-5xl font-black tracking-tighter flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-blue-600" /> {t.title}
            </h1>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            {['zh_TW', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${lang === l ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
            ))}
          </div>
        </header>

        <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Wallet className="w-4 h-4" /> 預計存款金額 (HKD)</label>
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-slate-50 px-6 py-4 rounded-2xl text-3xl font-black outline-none border-none focus:ring-4 focus:ring-blue-100" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CalendarDays className="w-4 h-4" /> 選擇存期</label>
              <div className="flex gap-2">
                {['1m', '3m', '6m', '12m'].map(m => (
                  <button key={m} onClick={() => setTenor(m)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all border ${tenor === m ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input type="text" placeholder="搜尋銀行或編號..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none shadow-sm focus:border-blue-500" />
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {[t.all, t.trad, t.virt].map(type => (
              <button key={type} onClick={() => setFilterType(type)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${filterType === type ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>{type}</button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {processedBanks.map(bank => {
            const rate = bank.rates['HKD']?.[tenor];
            const hasRate = rate !== undefined && rate !== null;
            const interest = hasRate ? Math.floor(amount * (rate / 100) * ({'1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1}[tenor])).toLocaleString() : null;

            return (
              <div key={bank.id} className={`bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-wrap items-center justify-between hover:shadow-xl transition-all ${amount < bank.minDeposit ? 'opacity-30 grayscale' : ''}`}>
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border p-2 flex items-center justify-center">
                    <img src={`https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`} className="w-full h-full object-contain opacity-80" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">{bank.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{bank.stockCode}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase ${bank.color}`}>{bank.offer}</span>
                      <span className="text-[10px] font-black text-slate-400">起存: ${bank.minDeposit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-12 mt-6 md:mt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">年利率 p.a.</p>
                    <p className={`text-4xl font-black ${hasRate ? 'text-slate-900' : 'text-slate-200'}`}>{hasRate ? `${rate.toFixed(2)}%` : 'N/A'}</p>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">利息收益</p>
                    <p className={`text-3xl font-black ${hasRate ? 'text-emerald-600' : 'text-slate-200'}`}>{hasRate ? `+$${interest}` : '---'}</p>
                  </div>
                  <a href={bank.url} target="_blank" rel="noreferrer" className="p-4 bg-slate-50 text-slate-300 rounded-xl hover:text-blue-600 transition-colors"><ExternalLink className="w-6 h-6" /></a>
                </div>
              </div>
            );
          })}
        </div>
        
        <footer className="p-10 bg-slate-900 rounded-[2.5rem] text-slate-500 text-xs border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3 text-white font-black mb-4 uppercase tracking-widest"><ShieldCheck className="w-5 h-5 text-blue-500" /> 市場數據聲明</div>
          <p>• 本追蹤器數據每天早上 08:00 (HKT) 自動從各大銀行官網提取最新港元定存利率。若顯示 N/A 代表該等級帳戶目前暫無此存期的特優年利率。實際利率請以銀行最終批核為準。</p>
        </footer>
      </div>
    </div>
  );
}