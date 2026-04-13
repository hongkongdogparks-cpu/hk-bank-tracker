import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc } from 'firebase/firestore';
import {
  TrendingUp, Search, ExternalLink, SortAsc,
  CalendarDays, Wallet, ShieldCheck,
  Clock, Activity, Database, ArrowUpRight, Globe, Smartphone, MousePointer2,
  AlertCircle, Scale, Info, MessageSquare
} from 'lucide-react';
 
// ── Firebase 初始化 ──
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyALK4TY5etUnEvBTqfvH6d0O36Rt3UuYIM", 
      authDomain: "hk-bank-tracker.firebaseapp.com",
      projectId: "hk-bank-tracker",
      storageBucket: "hk-bank-tracker.firebasestorage.app",
      messagingSenderId: "631669349028",
      appId: "1:631669349028:web:c417086999a022363ce431"
    };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'hk-fd-tracker-pro';

let app, auth, db;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.error('Firebase Initialization Failed:', e); }

// ── 多語言配置 ──
const T = {
  zh_TW: {
    title: '港元定存追蹤器',
    subtitle: '專業級實時利率監控 (2026)',
    all: '全部', trad: '傳統銀行', virt: '虛擬銀行',
    searchPlace: '搜尋銀行、代號或帳戶等級…',
    sortRate: '利率最高', sortCode: '銀行編號',
    interestLabel: '預計收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額',
    tenorLabel: '存期選擇', 
    contactBank: '聯繫銀行查詢專屬優惠',
    loading: '載入中', updated: '數據更新時間', syncing: '同步中',
    stock: '代號',
    newFund: '新資金', existingFund: '現有資金',
    online: '網上', mobile: '手機 App',
    lastUpdateBy: '最後 CSV 更新：',
    adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '本網站所載之一切利率數據及資訊僅供一般參考用途，不構成任何財務建議。利率可能隨時變動。實際利率及條款必須以銀行最終批核為準。',
    compliance: '合規披露'
  },
  en: {
    title: 'HK FD Tracker',
    subtitle: 'Professional FD Monitor (2026)',
    all: 'All', trad: 'Traditional', virt: 'Virtual',
    searchPlace: 'Search bank, code or tier…',
    sortRate: 'Highest Rate', sortCode: 'Bank Code',
    interestLabel: 'Est. Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount',
    tenorLabel: 'Select Tenor', 
    contactBank: 'Contact bank for exclusive offer',
    loading: 'Loading', updated: 'Updated', syncing: 'Live',
    stock: 'Code',
    newFund: 'New Fund', existingFund: 'Existing Fund',
    online: 'Online', mobile: 'Mobile App',
    lastUpdateBy: 'Last CSV Update: ',
    adLabel: 'ADVERTISEMENT',
    disclaimerTitle: 'Legal Disclaimer',
    disclaimerText: 'Information provided is for general reference only and does not constitute financial advice. Rates are subject to change. Final terms depend on bank approval.',
    compliance: 'Compliance'
  },
};
 
// ── 銀行初始設定 (根據擴展表) ──
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: { zh: '滙豐 卓越理財尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 卓越尊尚客戶', en: 'New Funds, Elite' }, color: 'bg-rose-600' },
  { id: 'hsbc_premier', name: { zh: '滙豐 卓越理財', en: 'HSBC Premier' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 卓越理財客戶', en: 'New Funds, Premier' }, color: 'bg-rose-500' },
  { id: 'hsbc_one', name: { zh: '滙豐 HSBC One / 其他', en: 'HSBC One / Others' }, stockCode: '0005', domain: 'hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 網上辦理', en: 'New Funds, Online' }, color: 'bg-rose-400' },
  { id: 'hangseng_prestige', name: { zh: '恒生 優越理財', en: 'Hang Seng Prestige' }, stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 網上特惠', en: 'New Funds, Online' }, color: 'bg-emerald-600' },
  { id: 'hangseng_standard', name: { zh: '恒生 一般帳戶', en: 'Hang Seng Integrated' }, stockCode: '0011', domain: 'hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 指定渠道', en: 'New Funds' }, color: 'bg-emerald-500' },
  { id: 'boc_wealth', name: { zh: '中銀理財', en: 'BOC Wealth Mgt' }, stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 手機銀行', en: 'New Funds, Mobile' }, color: 'bg-red-700' },
  { id: 'boc_standard', name: { zh: '中銀 一般客戶', en: 'BOC Personal' }, stockCode: '2388', domain: 'bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 手機銀行', en: 'New Funds, Mobile' }, color: 'bg-red-600' },
  { id: 'sc_priority', name: { zh: '渣打 優先理財', en: 'SC Priority' }, stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 網上辦理', en: 'New Funds, Online' }, color: 'bg-blue-600' },
  { id: 'sc_standard', name: { zh: '渣打 一般客戶', en: 'SC Standard' }, stockCode: '2888', domain: 'sc.com', url: 'https://www.sc.com/hk/deposits/online-time-deposit/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金, 網上辦理', en: 'New Funds, Online' }, color: 'bg-blue-500' },
  { id: 'bea_supreme', name: { zh: '東亞 至尊理財', en: 'BEA SupremeGold' }, stockCode: '0023', domain: 'hkbea.com', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', rates: {}, minDeposit: 100000, type: 'trad', conditions: { zh: '新客戶特惠利率', en: 'New Customer' }, color: 'bg-amber-600' },
  { id: 'dahsing_vip', name: { zh: '大新 VIP 銀行', en: 'Dah Sing VIP' }, stockCode: '2356', domain: 'dahsing.com', url: 'https://www.dahsing.com/html/en/personal/deposit/time_deposit_promotion.html', rates: {}, minDeposit: 100000, type: 'trad', conditions: { zh: '新資金, 指定金額', en: 'New Funds' }, color: 'bg-blue-900' },
  { id: 'dahsing_you', name: { zh: '大新 YOU 銀行', en: 'Dah Sing YOU' }, stockCode: '2356', domain: 'dahsing.com', url: 'https://www.dahsing.com/html/en/personal/deposit/time_deposit_promotion.html', rates: {}, minDeposit: 100000, type: 'trad', conditions: { zh: '新資金, 指定金額', en: 'New Funds' }, color: 'bg-blue-800' },
  { id: 'icbc_elite', name: { zh: '工銀 理財金', en: 'ICBC Elite' }, stockCode: '1398', domain: 'icbcasia.com', url: 'https://www.icbcasia.com/hk/tc/personal/latest-promotion/online-time-deposit.html', rates: {}, minDeposit: 3000000, type: 'trad', conditions: { zh: '網上特惠利率', en: 'Online Special' }, color: 'bg-red-800' },
  { id: 'nanyang_board', name: { zh: '南商 牌照利率', en: 'Nanyang Board' }, stockCode: 'NCB', domain: 'ncb.com.hk', url: 'https://www.ncb.com.hk/nanyang_bank/eng/html/14ac.html', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '標準牌照利率', en: 'Standard Rate' }, color: 'bg-red-900' },
  { id: 'citic_board', name: { zh: '信銀 牌照利率', en: 'CITIC Board' }, stockCode: '0998', domain: 'cncbinternational.com', url: 'https://www.cncbinternational.com/rate-table/time_deposit_rate_en.html', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '標準牌照利率', en: 'Standard Rate' }, color: 'bg-red-600' },
  { id: 'za', name: { zh: '眾安 ZA Bank', en: 'ZA Bank' }, stockCode: 'VB01', domain: 'za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '實時特惠', en: 'Live Rates' }, color: 'bg-teal-600' },
  { id: 'fusion', name: { zh: '富融 Fusion', en: 'Fusion Bank' }, stockCode: 'VB02', domain: 'fusionbank.com', url: 'https://www.fusionbank.com/deposit.html?lang=tc', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '不限新舊資金', en: 'No Fund Limit' }, color: 'bg-purple-600' },
  { id: 'mox', name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'mox.com', url: 'https://mox.com/zh/promotions/time-deposit/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: 'Mox 定存專享', en: 'Mox Fixed Deposit' }, color: 'bg-black' },
  { id: 'paob', name: { zh: '平安 PAOB', en: 'PAOB' }, stockCode: 'VB05', domain: 'paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', conditions: { zh: '保證回報', en: 'Guaranteed' }, color: 'bg-orange-500' },
  { id: 'livi', name: { zh: 'Livi Bank', en: 'Livi Bank' }, stockCode: 'VB03', domain: 'livibank.com', url: 'https://www.livibank.com/features/livisave.html', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '活期+ 額外收益', en: 'Bonus Yield' }, color: 'bg-blue-600' },
  { id: 'airstar', name: { zh: '天星 Airstar', en: 'Airstar Bank' }, stockCode: 'VB08', domain: 'airstarbank.com', url: 'https://www.airstarbank.com/en-hk/hkprime.html', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '星級定存', en: 'Star Deposit' }, color: 'bg-indigo-600' },
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
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { console.warn('Auth fallback'); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const ratesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'live_rates');
    const unsubscribe = onSnapshot(ratesCollection, (snapshot) => {
      const liveData = {};
      snapshot.forEach(docSnap => { liveData[docSnap.id] = docSnap.data(); });
      setBanks(prev => prev.map(bank => {
        if (liveData[bank.id]) {
          return { ...bank, rates: liveData[bank.id].rates ?? {}, lastUpdated: liveData[bank.id].lastUpdated };
        }
        return bank;
      }));
      setSyncedCount(snapshot.size);
      let latestTime = null;
      snapshot.forEach(docSnap => {
        const time = docSnap.data().lastUpdated;
        if (!latestTime || (time && time > latestTime)) latestTime = time;
      });
      if (latestTime) setLastSync(latestTime);
    });
    return () => unsubscribe();
  }, [user]);

  const sortedBanks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return banks
      .filter(b => {
        const matchStr = (b.name.zh + b.name.en + b.stockCode).toLowerCase();
        if (q && !matchStr.includes(q)) return false;
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
    return Math.floor(amount * (Number(rate) / 100) * m);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased pb-20">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg"><TrendingUp size={24} /></div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">{t.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${syncedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{syncedCount > 0 ? t.syncing : 'Connecting'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {['zh_TW', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-9 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-wrap gap-8 items-end">
              <div className="space-y-2 flex-1 min-w-[240px]">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Wallet size={14} className="text-blue-500" /> {t.amountLabel}</label>
                <div className="flex items-center border-b-2 border-slate-100 focus-within:border-blue-500 transition-colors pb-1">
                  <span className="text-2xl font-black text-slate-300 mr-2">HK$</span>
                  <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-4xl font-black outline-none tabular-nums" />
                </div>
              </div>
              <div className="space-y-2 w-full md:w-auto">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CalendarDays size={14} className="text-blue-500" /> {t.tenorLabel}</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl gap-1">
                  {['3m', '6m', '12m'].map(m => (
                    <button key={m} onClick={() => setTenor(m)} className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" />
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

            <div className="grid gap-3">
              {sortedBanks.map(bank => {
                const r = bank.rates?.HKD?.[tenor];
                const hasR = r != null && r > 0;
                const belowMin = amount < bank.minDeposit;
                return (
                  <div key={bank.id} className={`group bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4 transition-all hover:shadow-lg hover:border-blue-200 ${belowMin ? 'opacity-40 grayscale' : ''}`}>
                    <div className={`w-1.5 h-12 rounded-full ${bank.color} opacity-80 transition-opacity`}></div>
                    <div className="flex items-center gap-4 min-w-[320px] flex-1">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 p-2 border border-slate-100 flex items-center justify-center shrink-0">
                        <img src={`https://www.google.com/s2/favicons?sz=64&domain=${bank.domain}`} className="w-full h-full object-contain" alt="" onError={e => e.target.style.display = 'none'} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-lg tracking-tight text-slate-800">{bank.name[lK]}</h3>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded uppercase tracking-tighter">{bank.stockCode}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-400 font-bold text-[9px] uppercase">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{bank.conditions[lK]}</span>
                          <span className="flex items-center gap-1"><ShieldCheck size={11} /> {t.minDeposit}: HK${bank.minDeposit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 md:gap-12 ml-auto">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.rateLabel}</p>
                        {hasR ? (
                          <p className="text-3xl font-black tabular-nums leading-none text-slate-900">{Number(r).toFixed(2)}%</p>
                        ) : (
                          <p className="text-[10px] font-bold text-blue-500 flex items-center gap-1"><MessageSquare size={12} /> {t.contactBank}</p>
                        )}
                      </div>
                      <div className="text-right min-w-[140px]">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.interestLabel}</p>
                        <p className={`text-2xl font-black tabular-nums leading-none ${hasR ? 'text-emerald-500' : 'text-slate-100'}`}>{hasR ? `+${calcInt(r).toLocaleString()}` : '--'}</p>
                      </div>
                      <a href={bank.url} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0"><ArrowUpRight size={20} /></a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex items-center justify-center min-h-[120px]">
              <div className="text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">{t.adLabel}</p>
                <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Banner Ad Slot</div>
              </div>
            </div>

            <footer className="mt-12 p-10 bg-white rounded-3xl border border-slate-200 space-y-8 relative overflow-hidden text-slate-500">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-slate-900 rotate-12"><Scale size={160} /></div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3 text-slate-900 font-black uppercase tracking-widest text-sm"><AlertCircle size={20} className="text-blue-600" /> {t.disclaimerTitle}</div>
                <p className="text-[11px] font-medium leading-relaxed max-w-4xl border-l-4 border-slate-100 pl-4">{t.disclaimerText}</p>
                <div className="grid md:grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                  <p>• {t.lastUpdateBy}{lastSync || t.notAvailable}</p>
                  <p>• {t.compliance}: V2.8 Stable • Licensed bank data monitor</p>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">
                <span>&copy; 2026 HK FD Tracker Pro.</span>
                <span className="flex items-center gap-1"><ShieldCheck size={10} /> Data Integrity Verified</span>
              </div>
            </footer>
          </div>

          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex flex-col items-center min-h-[600px] shadow-sm">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">{t.adLabel}</p>
                <div className="w-full flex-1 bg-slate-50 rounded border border-slate-100 flex items-center justify-center text-center p-4">
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">Vertical Skyscraper<br/>(300x600)</span>
                </div>
              </div>
              <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-100">
                <Info size={24} className="mb-4" />
                <h4 className="font-black text-sm uppercase tracking-widest mb-2">Pro Tip</h4>
                <p className="text-xs font-bold leading-relaxed opacity-90 uppercase">Check if you qualify for "New Capital" to lock in high yields.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}