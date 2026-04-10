import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { 
  TrendingUp, Search, Calculator, RefreshCw, Info, 
  Hash, Activity, ShieldCheck, Filter, SortAsc, Bell, Mail, MessageSquare, Clock
} from 'lucide-react';

// --- 全局配置 ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hk-fd-tracker-pro';

const INITIAL_BANKS = [
  // 傳統銀行
  { id: 'hsbc', name: '香港上海滙豐銀行', stockCode: '0005', domain: 'hsbc.com.hk', rates: { HKD: { '1m': 1.0, '3m': 3.4, '6m': 3.2, '12m': 3.0 }, USD: { '1m': 3.0, '3m': 4.5, '6m': 4.2, '12m': 4.0 } }, minDeposit: 10000, fundType: 'new', offer: '網上尊享', color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'hangseng', name: '恒生銀行', stockCode: '0011', domain: 'hangseng.com', rates: { HKD: { '1m': 1.2, '3m': 3.6, '6m': 3.4, '12m': 3.2 }, USD: { '1m': 3.2, '3m': 4.6, '6m': 4.4, '12m': 4.1 } }, minDeposit: 10000, fundType: 'new', offer: '特優年利率', color: 'bg-green-50 text-green-700 border-green-100' },
  { id: 'boc', name: '中國銀行 (香港)', stockCode: '2388', domain: 'bochk.com', rates: { HKD: { '3m': 3.3, '6m': 3.1, '12m': 3.0 }, USD: { '3m': 4.4, '6m': 4.1, '12m': 3.9 }, CNY: { '3m': 2.1, '6m': 2.1, '12m': 2.0 } }, minDeposit: 10000, fundType: 'new', offer: '全新資金', color: 'bg-red-50 text-red-700 border-red-100' },
  { id: 'sc', name: '渣打銀行', stockCode: '2888', domain: 'sc.com/hk', rates: { HKD: { '1m': 1.0, '3m': 3.4, '6m': 3.3, '12m': 3.2 }, USD: { '1m': 3.3, '3m': 4.7, '6m': 4.5, '12m': 4.2 } }, minDeposit: 10000, fundType: 'new', offer: '網上優惠', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'bea', name: '東亞銀行', stockCode: '0023', domain: 'hkbea.com', rates: { HKD: { '1m': 1.5, '3m': 3.7, '6m': 3.55, '12m': 3.4 } }, minDeposit: 20000, fundType: 'new', offer: '至尊理財', color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'icbc', name: '中國工商銀行 (亞洲)', stockCode: '1398', domain: 'icbcasia.com', rates: { HKD: { '1m': 1.8, '3m': 3.9, '6m': 3.7, '12m': 3.5 } }, minDeposit: 100000, fundType: 'new', offer: '全新資金', color: 'bg-red-50 text-red-800 border-red-100' },
  { id: 'ccb', name: '中國建設銀行 (亞洲)', stockCode: '0939', domain: 'asia.ccb.com', rates: { HKD: { '1m': 1.6, '3m': 3.8, '6m': 3.65, '12m': 3.45 } }, minDeposit: 100000, fundType: 'new', offer: '網上優惠', color: 'bg-blue-50 text-blue-800 border-blue-100' },
  { id: 'cncbi', name: '中信銀行 (國際)', stockCode: '0998', domain: 'cncbinternational.com', rates: { HKD: { '1m': 2.0, '3m': 4.1, '6m': 3.9, '12m': 3.7 }, USD: { '1m': 3.5, '3m': 4.9, '6m': 4.6, '12m': 4.3 } }, minDeposit: 10000, fundType: 'new', offer: '大富翁定存', color: 'bg-red-100 text-red-900 border-red-200' },
  { id: 'fubon', name: '富邦銀行', stockCode: '2881', domain: 'fubonbank.com.hk', rates: { HKD: { '1m': 2.2, '3m': 4.2, '6m': 4.0, '12m': 3.8 } }, minDeposit: 200000, fundType: 'new', offer: '特優定存', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'public', name: '大眾銀行', stockCode: '0626', domain: 'publicbank.com.hk', rates: { HKD: { '1m': 1.5, '3m': 3.75, '6m': 3.6, '12m': 3.5 } }, minDeposit: 10000, fundType: 'both', offer: '網上優惠', color: 'bg-yellow-50 text-yellow-800 border-yellow-100' },
  { id: 'citibank', name: '花旗銀行', stockCode: 'CITI', domain: 'citibank.com.hk', rates: { HKD: { '1m': 1.0, '3m': 3.5, '6m': 3.3 }, USD: { '1m': 3.0, '3m': 4.8 } }, minDeposit: 50000, fundType: 'new', offer: '全新客戶', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: 'dbs', name: '星展銀行', stockCode: 'DBS', domain: 'dbs.com.hk', rates: { HKD: { '1m': 1.1, '3m': 3.4, '6m': 3.2 } }, minDeposit: 50000, fundType: 'new', offer: '網上定存', color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'chonghing', name: '創興銀行', stockCode: '1111', domain: 'chbank.com', rates: { HKD: { '1m': 1.7, '3m': 3.85, '6m': 3.7 } }, minDeposit: 5000, fundType: 'new', offer: '雲利率', color: 'bg-red-50 text-red-800 border-red-100' },
  
  // 虛擬銀行
  { id: 'za', name: 'ZA Bank (眾安)', stockCode: 'VB01', domain: 'za.group', rates: { HKD: { '1m': 1.5, '3m': 4.0, '6m': 3.6, '12m': 3.2 }, USD: { '1m': 3.0, '3m': 5.0, '6m': 4.0 } }, minDeposit: 1, fundType: 'both', offer: '不限資金', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'airstar', name: '天星銀行', stockCode: 'VB03', domain: 'airstarbank.com', rates: { HKD: { '1m': 1.4, '3m': 3.9, '6m': 3.7, '12m': 3.4 } }, minDeposit: 1000, fundType: 'both', offer: '新客戶特優', color: 'bg-blue-50 text-blue-500 border-blue-100' },
  { id: 'paob', name: '平安壹賬通銀行', stockCode: 'VB05', domain: 'paob.com.hk', rates: { HKD: { '1m': 1.3, '3m': 3.8, '6m': 3.6, '12m': 3.5 } }, minDeposit: 100, fundType: 'both', offer: '保證回報', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'fusion', name: '富融銀行', stockCode: 'VB06', domain: 'fusionbank.com', rates: { HKD: { '1m': 1.45, '3m': 3.85, '6m': 3.7, '12m': 3.4 } }, minDeposit: 1, fundType: 'both', offer: '靈活提存', color: 'bg-purple-50 text-purple-700 border-purple-100' },
];

const BankLogo = ({ bank }) => {
  const [error, setError] = useState(false);
  const logoUrl = `https://www.google.com/s2/favicons?sz=128&domain=${bank.domain}`;
  if (error || !bank.domain) return <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg font-black text-slate-300">{bank.name.charAt(0)}</div>;
  return (
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
      <img src={logoUrl} alt={bank.name} className="w-full h-full object-contain" onError={() => setError(true)}/>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState('HKD');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(100000);
  const [fundSource, setFundSource] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate'); 
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hkmaRate, setHkmaRate] = useState(3.25);
  const [banks] = useState(INITIAL_BANKS);
  
  // 實時時間狀態
  const [currentTime, setCurrentTime] = useState(new Date());

  // 提醒功能狀態
  const [alertTarget, setAlertTarget] = useState(5.0);
  const [alertContact, setAlertContact] = useState('');
  const [alertType, setAlertType] = useState('email'); // email or sms
  const [isAlertSaved, setIsAlertSaved] = useState(false);

  // 更新時間的 Effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Auth Error"); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const handleSaveAlert = async (e) => {
    e.preventDefault();
    if (!user || !alertContact) return;
    
    try {
      const alertRef = collection(db, 'artifacts', appId, 'users', user.uid, 'alerts');
      await addDoc(alertRef, {
        targetRate: alertTarget,
        contact: alertContact,
        type: alertType,
        currency,
        tenor,
        createdAt: new Date().toISOString()
      });
      setIsAlertSaved(true);
      setTimeout(() => setIsAlertSaved(false), 3000);
    } catch (err) {
      console.error("Save alert failed", err);
    }
  };

  const refreshAllData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("https://opendata.hkma.gov.hk/api/v1/statistics/banking/retail-banking/interest-rates?limit=1");
      if (response.ok) {
        const data = await response.json();
        if (data.result?.records?.length > 0) setHkmaRate(parseFloat(data.result.records[0].time_deposit_3m_hkd || 3.25));
      }
    } catch (e) { console.warn("API error"); } finally { setIsSyncing(false); }
  };

  const sortedBanks = useMemo(() => {
    return banks
      .filter(bank => {
        const hasRate = bank.rates[currency] && bank.rates[currency][tenor];
        const normalizedSearch = searchQuery.toLowerCase();
        const nameMatch = bank.name.toLowerCase().includes(normalizedSearch) || bank.stockCode.includes(searchQuery);
        const matchesFund = bank.fundType === 'both' || bank.fundType === fundSource;
        const meetsMin = !eligibleOnly || amount >= bank.minDeposit;
        return hasRate && nameMatch && matchesFund && meetsMin;
      })
      .sort((a, b) => {
        if (sortBy === 'stockCode') return (parseInt(a.stockCode) || 9999) - (parseInt(b.stockCode) || 9999);
        if (sortBy === 'minDeposit') return a.minDeposit - b.minDeposit;
        return b.rates[currency][tenor] - a.rates[currency][tenor];
      });
  }, [tenor, searchQuery, fundSource, currency, banks, sortBy, eligibleOnly, amount]);

  const calculateInterest = (rate) => {
    const tMap = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 };
    const res = amount * (rate / 100) * tMap[tenor];
    return isNaN(res) ? "0" : res.toLocaleString('zh-HK', { maximumFractionDigits: 0 });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans p-3 md:p-8">
      {/* 頂部導航 */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-blue-600 w-6 h-6 md:w-8 md:h-8" />
            <h1 className="text-lg md:text-xl font-black tracking-tighter">香港定存追蹤器</h1>
          </div>
          <div className="md:hidden flex items-center gap-2 text-slate-500 font-mono text-[10px]">
            <Clock className="w-3 h-3" />
            {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Clock className="w-4 h-4 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">系統實時時間</span>
            <span className="text-xs font-black text-slate-700 leading-none">
              {currentTime.getFullYear()}年{currentTime.getMonth() + 1}月{currentTime.getDate()}日 {currentTime.toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
          <div className="flex flex-col text-right">
            <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">HKMA 市場均值</span>
            <span className="text-sm md:text-lg font-black text-blue-600 leading-none">{hkmaRate.toFixed(2)}%</span>
          </div>
          <button onClick={refreshAllData} className="p-2 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm border border-slate-100">
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左側：控制中心 */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xs font-black mb-6 flex items-center gap-2 text-slate-600"><Calculator className="w-4 h-4 text-blue-500" /> 利息計算設定</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">選擇幣種</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['HKD', 'USD', 'CNY'].map(c => (
                    <button key={c} onClick={() => setCurrency(c)} className={`py-1.5 rounded-lg text-[10px] font-black transition-all border ${currency === c ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">資金來源</label>
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  {['new', 'existing'].map(s => (
                    <button key={s} onClick={() => setFundSource(s)} className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all ${fundSource === s ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{s === 'new' ? '全新資金' : '現有資金'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">存款期</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['1m', '3m', '6m', '12m'].map(t => (
                    <button key={t} onClick={() => setTenor(t)} className={`py-1.5 rounded-lg text-[10px] font-black transition-all border ${tenor === t ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>{t.replace('m', '個月')}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">存款金額</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">{currency === 'CNY' ? '¥' : '$'}</div>
                  <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border-none rounded-lg outline-none font-mono text-base font-black focus:ring-2 focus:ring-blue-100 transition-all shadow-inner" />
                </div>
              </div>
            </div>
          </div>

          {/* 利率提醒區塊 */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl shadow-lg text-white">
            <h2 className="text-xs font-black mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> 利率提醒設定</h2>
            <form onSubmit={handleSaveAlert} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">目標利率 (%)</label>
                <input 
                  type="number" step="0.1" 
                  value={alertTarget} onChange={(e) => setAlertTarget(e.target.value)}
                  className="w-full bg-white/10 border-none rounded-lg px-3 py-2 text-sm font-black focus:ring-2 focus:ring-yellow-400 outline-none" 
                  placeholder="例如 5.0"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">通知方式</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAlertType('email')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${alertType === 'email' ? 'bg-white text-slate-900 border-white' : 'border-white/20 text-white/60'}`}><Mail className="w-3 h-3" /> 電郵</button>
                  <button type="button" onClick={() => setAlertType('sms')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${alertType === 'sms' ? 'bg-white text-slate-900 border-white' : 'border-white/20 text-white/60'}`}><MessageSquare className="w-3 h-3" /> 短訊</button>
                </div>
              </div>
              <input 
                type={alertType === 'email' ? 'email' : 'tel'} 
                value={alertContact} onChange={(e) => setAlertContact(e.target.value)}
                placeholder={alertType === 'email' ? '輸入您的電郵地址' : '輸入您的手機號碼'}
                className="w-full bg-white/10 border-none rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-yellow-400 outline-none placeholder:text-white/30"
                required
              />
              <button 
                type="submit"
                disabled={isAlertSaved}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${isAlertSaved ? 'bg-green-500 text-white' : 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'}`}
              >
                {isAlertSaved ? '已成功設定！' : '開始追蹤利率'}
              </button>
            </form>
          </div>
        </div>

        {/* 右側：列表 */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="relative flex-1 group w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500" />
                <input type="text" placeholder="搜尋銀行或上市編號..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl outline-none text-xs font-bold shadow-inner" />
              </div>
              <div className="flex items-center gap-2 border-l pl-3 whitespace-nowrap">
                <SortAsc className="w-4 h-4 text-blue-500 shrink-0" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer">
                  <option value="rate">按年利率排序</option>
                  <option value="stockCode">按上市編號</option>
                  <option value="minDeposit">按最低存款</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500">符合金額</span>
                <button onClick={() => setEligibleOnly(!eligibleOnly)} className={`w-8 h-4 rounded-full transition-all relative ${eligibleOnly ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${eligibleOnly ? 'left-4.5' : 'left-0.5'}`}></div></button>
              </div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">共 {sortedBanks.length} 間</div>
            </div>
          </div>

          <div className="space-y-3">
            {sortedBanks.map((bank) => (
              <div key={bank.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between hover:border-blue-400 transition-all group shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                  <BankLogo bank={bank} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-900 text-sm md:text-base tracking-tight leading-none">{bank.name}</h3>
                      <span className="text-[8px] md:text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-black">{bank.stockCode}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-md font-black border ${bank.color}`}>{bank.offer}</span>
                      <span className={`text-[8px] md:text-[9px] px-2 py-0.5 rounded-md font-bold bg-slate-50 text-slate-400`}>起存: {currency} {bank.minDeposit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-8 items-center mt-4 md:mt-0 pt-4 md:pt-0 border-t border-slate-50 md:border-t-0 justify-between md:justify-end">
                  <div className="text-right">
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase mb-0.5 tracking-widest">年利率 p.a.</p>
                    <p className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">{bank.rates[currency][tenor]?.toFixed(2) || 'N/A'}%</p>
                  </div>
                  <div className="text-right min-w-[90px]">
                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase mb-0.5 tracking-widest">預計利息</p>
                    <p className="text-lg md:text-xl font-black text-green-600 tabular-nums">+{currency} {calculateInterest(bank.rates[currency][tenor])}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-slate-900 rounded-2xl relative overflow-hidden">
            <div className="flex gap-3 items-start mb-2">
               <Info className="w-4 h-4 text-blue-500 shrink-0" />
               <h4 className="text-white font-black text-xs">數據聲明</h4>
            </div>
            <p className="text-[9px] text-slate-400 leading-relaxed font-medium">數據源自 HKMA Open API 及銀行官網。利率僅供參考，請以銀行合約為準。提醒功能之通知可能會受網路環境影響延遲。</p>
          </div>
        </div>
      </div>
    </div>
  );
}