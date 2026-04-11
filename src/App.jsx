import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, Search, Calculator, RefreshCw, Info, ExternalLink, Sparkles, 
  ArrowUpDown, Zap, Globe, Bell, Filter, SortAsc, Activity, ShieldCheck
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'hk-bank-tracker';

const INITIAL_BANKS = [
  // --- 滙豐銀行 (HSBC) ---
  { id: 'hsbc_elite', name: '滙豐 卓越理財尊尚', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '3m': 3.6, '6m': 3.4 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '尊尚特優', color: 'bg-red-900 text-white border-red-900' },
  { id: 'hsbc_premier', name: '滙豐 卓越理財', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '3m': 3.4, '6m': 3.1 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '卓越特優', color: 'bg-red-700 text-white border-red-700' },
  { id: 'hsbc_one', name: '滙豐 HSBC One / 一般', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '3m': 2.2, '6m': 2.0 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上新資金', color: 'bg-red-50 text-red-700 border-red-100' },
  
  // --- 恒生銀行 (Hang Seng) ---
  { id: 'hangseng_prestige', name: '恒生 卓越理財 (Prestige)', stockCode: '0011', domain: 'hangseng.com', rates: { HKD: { '3m': 3.6, '6m': 3.4 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '特優年利率', color: 'bg-green-800 text-white border-green-800' },
  { id: 'hangseng_standard', name: '恒生 一般帳戶', stockCode: '0011', domain: 'hangseng.com', rates: { HKD: { '3m': 3.3, '6m': 3.1 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-green-50 text-green-700 border-green-100' },
  
  // --- 中國銀行 (BOC) ---
  { id: 'boc_wealth', name: '中銀理財 (Wealth Management)', stockCode: '2388', domain: 'bochk.com', rates: { HKD: { '3m': 3.5, '6m': 3.3 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '理財晉級優惠', color: 'bg-red-800 text-white border-red-800' },
  { id: 'boc_standard', name: '中銀 一般帳戶', stockCode: '2388', domain: 'bochk.com', rates: { HKD: { '3m': 3.3, '6m': 3.1 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '手機銀行優惠', color: 'bg-red-50 text-red-600 border-red-100' },

  // --- 渣打銀行 (Standard Chartered) ---
  { id: 'sc_priority', name: '渣打 優先理財 (Priority)', stockCode: '2888', domain: 'sc.com/hk', rates: { HKD: { '3m': 3.5, '6m': 3.5 } }, minDeposit: 1000000, type: '傳統', fundType: 'new', offer: '優先理財專享', color: 'bg-blue-800 text-white border-blue-800' },
  { id: 'sc_standard', name: '渣打 一般帳戶', stockCode: '2888', domain: 'sc.com/hk', rates: { HKD: { '3m': 3.3, '6m': 3.3 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上特優', color: 'bg-blue-50 text-blue-700 border-blue-100' },

  // --- 其他傳統銀行 (BEA, ICBC, CCB, Public) ---
  { id: 'bea_supreme', name: '東亞 至尊理財 (Supreme)', stockCode: '0023', domain: 'hkbea.com', rates: { HKD: { '3m': 3.7, '6m': 3.5 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '至尊理財專享', color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'icbc_elite', name: '工銀亞洲 綜合帳戶', stockCode: '1398', domain: 'icbcasia.com', rates: { HKD: { '3m': 3.8, '6m': 3.5 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '網上特惠', color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'ccb_online', name: '建行亞洲 網上優惠', stockCode: '0939', domain: 'asia.ccb.com', rates: { HKD: { '3m': 3.8, '6m': 3.6 } }, minDeposit: 100000, type: '傳統', fundType: 'new', offer: '網上尊享', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'public_online', name: '大眾銀行 網上定存', stockCode: '0626', domain: 'publicbank.com.hk', rates: { HKD: { '3m': 3.75, '6m': 3.5 } }, minDeposit: 10000, type: '傳統', fundType: 'new', offer: '網上優惠', color: 'bg-red-50 text-red-700 border-red-100' },
  
  // --- 虛擬銀行 (Virtual Banks) ---
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', rates: { HKD: { '3m': 4.0, '6m': 3.6 } }, minDeposit: 1, type: '虛擬', fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'paob', name: '平安壹賬通', stockCode: 'VB05', domain: 'paob.com.hk', rates: { HKD: { '3m': 3.8, '6m': 3.6 } }, minDeposit: 100, type: '虛擬', fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-700 border-orange-100' },
];

const BankLogo = ({ bank }) => {
  const logoUrl = `https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`;
  return (
    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner p-1">
      <img src={logoUrl} alt={bank.name} className="w-full h-full object-contain" />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currency] = useState('HKD');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000); // 💡 預設改為 100 萬，方便看到高級帳戶
  const [fundSource, setFundSource] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [banks, setBanks] = useState(INITIAL_BANKS);

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
          const cloudData = snapshot.data();
          setBanks(prev => prev.map(b => 
            b.id === bank.id ? { ...b, rates: cloudData.rates || b.rates, lastUpdated: cloudData.lastUpdated } : b
          ));
          if (cloudData.lastUpdated) setLastSyncTime(cloudData.lastUpdated);
        }
      }, (err) => console.warn(`無法獲取 ${bank.id} 的更新`, err));
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  const sortedBanks = useMemo(() => {
    return banks
      .filter(bank => {
        const hasRate = bank.rates[currency] && bank.rates[currency][tenor];
        const matchesSearch = bank.name.includes(searchQuery) || bank.stockCode.includes(searchQuery);
        const matchesFund = bank.fundType === 'both' || bank.fundType === fundSource;
        const meetsMin = !eligibleOnly || amount >= bank.minDeposit;
        return hasRate && matchesSearch && matchesFund && meetsMin;
      })
      .sort((a, b) => {
        if (sortBy === 'rate') return b.rates[currency][tenor] - a.rates[currency][tenor];
        return parseInt(a.stockCode) - parseInt(b.stockCode);
      });
  }, [banks, currency, tenor, searchQuery, fundSource, eligibleOnly, amount, sortBy]);

  const calculateInterest = (rate) => {
    const tMap = { '3m': 0.25, '6m': 0.5, '12m': 1 };
    return Math.floor(amount * (rate / 100) * tMap[tenor]).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black flex items-center gap-3 tracking-tighter">
              <TrendingUp className="text-blue-600 w-10 h-10" />
              香港定期存款追蹤器
            </h1>
            <p className="text-slate-500 font-bold mt-2">帳戶等級細分版 (連動 GitHub Actions 爬蟲)</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-4 px-6 rounded-3xl flex items-center gap-4">
            <Activity className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">最後同步</p>
              <p className="text-lg font-black text-emerald-900">{lastSyncTime.split(' ')[1] || "--:--"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左側：控制台 */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-blue-500" />
                利息計算設定
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">1. 資金來源</label>
                  <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                    <button onClick={() => setFundSource('new')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${fundSource === 'new' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>全新資金</button>
                    <button onClick={() => setFundSource('existing')} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${fundSource === 'existing' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>現有資金</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">2. 存款金額 (HKD)</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-black text-2xl focus:ring-4 focus:ring-blue-100 transition-all" />
                  <p className="text-[10px] text-slate-400 mt-2 font-bold italic">* 超過 100 萬可顯示更多高級帳戶利率</p>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">3. 存款期限</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['3m', '6m'].map(m => (
                      <button key={m} onClick={() => setTenor(m)} className={`py-3 rounded-xl text-sm font-black transition-all ${tenor === m ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{m === '3m' ? '3個月' : '6個月'}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：銀行列表 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input type="text" placeholder="搜尋銀行或等級..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-2 bg-slate-50 rounded-xl border-none outline-none font-bold" />
              </div>
              <div className="flex items-center gap-4">
                <SortAsc className="w-5 h-5 text-blue-500" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-sm font-black outline-none cursor-pointer">
                  <option value="rate">年利率 (最高)</option>
                  <option value="stockCode">編號</option>
                </select>
                <div className="h-4 w-px bg-slate-200 mx-2" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={eligibleOnly} onChange={() => setEligibleOnly(!eligibleOnly)} className="rounded text-blue-600" />
                  <span className="text-xs font-bold text-slate-500">符合金額</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {sortedBanks.map(bank => (
                <div key={bank.id} className={`bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-wrap items-center justify-between hover:shadow-lg transition-all group ${amount < bank.minDeposit ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-6">
                    <BankLogo bank={bank} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-xl text-slate-800 tracking-tight">{bank.name}</h4>
                        <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded-lg">{bank.stockCode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${bank.color}`}>{bank.offer}</span>
                        <span className="text-[10px] text-slate-400 font-bold">起存: ${bank.minDeposit.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-10 mt-6 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">年利率</p>
                      <p className="text-3xl font-black text-slate-900">{bank.rates[currency][tenor].toFixed(2)}%</p>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">預計利息</p>
                      <p className="text-2xl font-black text-emerald-600">+HKD {calculateInterest(bank.rates[currency][tenor])}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 底部說明 */}
            <div className="mt-10 p-8 bg-slate-900 rounded-[2.5rem] text-slate-400 text-[10px] leading-relaxed">
              <div className="flex items-center gap-2 text-white font-black mb-3 text-xs uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                帳戶等級與存款門檻說明
              </div>
              <p>• 本列表已根據各銀行不同等級（尊尚、卓越、標準）細分顯示。高級帳戶通常享有更高利率，但要求更高的平均每日結餘。</p>
              <p className="mt-2">• 如果你的「存款金額」低於銀行的最低要求，該銀行項目將自動變為灰色並移動至列表底部。</p>
              <p className="mt-2">• 數據連動：本系統每小時自動從 GitHub 爬蟲同步最新利率數據。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}