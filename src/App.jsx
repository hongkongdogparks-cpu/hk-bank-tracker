import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc } from 'firebase/firestore';
import {
  TrendingUp, Search, SortAsc, CalendarDays, Wallet, ShieldCheck,
  Clock, Activity, ArrowUpRight, Globe, Smartphone, MousePointer2,
  AlertCircle, Scale, Info, BookOpen, Lightbulb, CheckCircle2, 
  Calculator, Share2, ShieldAlert, Zap, Target, TrendingDown, Menu, X, Landmark, BellRing, CalendarPlus, GraduationCap, ExternalLink, ChevronDown, ChevronUp, Layers, HelpCircle, BadgePercent
} from 'lucide-react';
 
// ── Firebase Configuration ──
const firebaseConfig = {
  apiKey: "AIzaSyALK4TY5etUnEvBTqfvH6d0O36Rt3UuYIM", 
  authDomain: "hk-bank-tracker.firebaseapp.com",
  projectId: "hk-bank-tracker",
  storageBucket: "hk-bank-tracker.firebasestorage.app",
  messagingSenderId: "631669349028",
  appId: "1:631669349028:web:c417086999a022363ce431"
};

const appId = 'hk-fd-tracker-pro';

let app, auth, db;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) { console.error('Firebase Setup Error'); }

// ── Translation Dictionary ──
const T = {
  zh_TW: {
    nav: { dashboard: '利率看板', knowledge: '新手教室', strategies: '賺息大師', glossary: '詞彙百科' },
    title: '港元定存追蹤器',
    subtitle: '專業級實時利率監控 (2026)',
    all: '全部', trad: '傳統', virt: '虛擬',
    searchPlace: '搜尋銀行、編號或帳戶等級…',
    sortRate: '利率最高', sortCode: '銀行編號',
    interestLabel: '預計收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額',
    tenorLabel: '存期', 
    contactBank: '聯繫查詢',
    syncing: '實時同步',
    lastUpdateBy: '數據更新時間：',
    adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '本站引用金管局 (HKMA) 及投委會 (IFEC) 資料以確保權威性。本網站所載資訊僅供參考，不構成財務建議。',
    compound: '複利預期 (1Y)',
    calendarBtn: '加入提醒',
    pushBtn: '訂閱高息',
    backToDash: '返回看板',
    exampleLabel: '💡 情境實例：',
    clickToExpand: '點擊展開教學案例',
    officialGuide: '官方指南',
    seoDesc: '全港最快、最齊的港元定期存款利率比較工具。'
  },
  en: {
    nav: { dashboard: 'Rates', knowledge: 'Classroom', strategies: 'Yield Master', glossary: 'Glossary' },
    title: 'HK FD Tracker',
    subtitle: 'Professional FD Monitor (2026)',
    all: 'All', trad: 'Trad', virt: 'Virt',
    searchPlace: 'Search bank, code or tier...',
    sortRate: 'Highest Rate', sortCode: 'Bank Code',
    interestLabel: 'Est. Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount',
    tenorLabel: 'Tenor', 
    contactBank: 'Contact Bank',
    syncing: 'Live',
    lastUpdateBy: 'Updated: ',
    adLabel: 'ADVERTISEMENT',
    disclaimerTitle: 'Legal Disclaimer',
    disclaimerText: 'We reference HKMA and IFEC for E-E-A-T authority standards. No financial advice.',
    compound: 'Compound (1Y)',
    calendarBtn: 'Remind Me',
    pushBtn: 'Get Alerts',
    backToDash: 'Back to Dashboard',
    exampleLabel: '💡 Illustrative Example:',
    clickToExpand: 'Click to expand case study',
    officialGuide: 'Official Guide',
    seoDesc: 'Real-time HKD Fixed Deposit rates tracker.'
  },
};

// ── Glossary Data ──
const GLOSSARY_DATA = [
  { term_zh: '年利率 (Per Annum)', term_en: 'Per Annum (p.a.)', zh_desc: '以一年為基準計算的利息百分比。', en_desc: 'Standardized annual interest rate.', link: 'https://www.ifec.org.hk/sid/tc/money-management/savings/time-deposits.shtml', zh_ex: '標示 4% p.a. 代表存入 100 萬後，3 個月收息 1 萬 (1M * 4% / 4)。', en_ex: 'A 3M term with 4% p.a. earns $10k on $1M principal.' },
  { term_zh: '新資金 (New Funds)', term_en: 'New Funds', zh_desc: '比起某特定參考日新增的結餘。', en_desc: 'Incremental balance increase.', link: null, zh_ex: '若原本有 10 萬，存入額外 20 萬，這 20 萬才享有高息優惠。', en_ex: 'Only fresh capital from other banks qualifies.' },
  { term_zh: '流動性 (Liquidity)', term_en: 'Liquidity', zh_desc: '資產轉化為現金的速度與成本。', en_desc: 'Ease of converting to cash.', link: null, zh_ex: '全放定存，急用錢時提早提取會損失所有利息，這就是流動性處罰。', en_ex: 'Emergency early withdrawal wipes out interest.' },
  { term_zh: '牌照利率 (Board Rate)', term_en: 'Board Rate', zh_desc: '銀行基礎掛牌利率，通常極低（如 0.1%）。', en_desc: 'Base rate without promos.', link: null, zh_ex: '自動續存往往採用 0.1%，利息收益可能縮水 40 倍。', en_ex: 'Rollover uses ~0.1% instead of promo rates.' },
  { term_zh: '存款保障計劃 (DPS)', term_en: 'Deposit Protection Scheme (DPS)', zh_desc: '法例保障每位存款人最高獲賠 80 萬。', en_desc: 'Protection up to 800k HKD.', link: 'https://www.dps.org.hk/tc/index.html', zh_ex: '即使銀行結業，政府保證賠付首 80 萬。', en_ex: 'Statutory safety per bank.' },
  { term_zh: '轉數快 (FPS)', term_en: 'Faster Payment System (FPS)', zh_desc: '香港即時跨行轉賬系統。', en_desc: 'HK\'s 24/7 transfer system.', link: 'https://www.fps.hk/tc/', zh_ex: '定存到期後，可用 FPS 免費即時轉帳到他行。', en_ex: 'Move funds instantly for free.' },
];

// ── Bank Configuration Matching CSV Selection ──
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: { zh: '滙豐 卓越尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '尊尚客戶', en: 'Elite Tier' }, color: 'bg-rose-600' },
  { id: 'hsbc_premier', name: { zh: '滙豐 卓越理財', en: 'HSBC Premier' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '卓越客戶', en: 'Premier Tier' }, color: 'bg-rose-500' },
  { id: 'hsbc_one', name: { zh: '滙豐 HSBC One', en: 'HSBC One' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '網上辦理', en: 'Online Only' }, color: 'bg-rose-400' },
  { id: 'hsbc_others', name: { zh: '滙豐 其他', en: 'HSBC Others' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '一般儲蓄', en: 'Standard' }, color: 'bg-rose-300' },
  { id: 'hangseng_priv', name: { zh: '恒生 優越私人理財', en: 'Hang Seng Prestige Private' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '私人理財', en: 'Private Banking' }, color: 'bg-emerald-700' },
  { id: 'hangseng_prestige_online', name: { zh: '恒生 優越理財 (網上)', en: 'Hang Seng Prestige (Online)' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金網上', en: 'New Funds' }, color: 'bg-emerald-600' },
  { id: 'hangseng_preferred_online', name: { zh: '恒生 優進理財 (網上)', en: 'Hang Seng Preferred (Online)' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '網上專享', en: 'Online Only' }, color: 'bg-emerald-500' },
  { id: 'boc_wealth', name: { zh: '中銀理財', en: 'BOC Wealth Mgt' }, stockCode: '2388', domain: 'www.bochk.com', url: 'https://www.bochk.com/', rates: {}, minDeposit: 1000000, type: 'trad', conditions: { zh: '高端客戶', en: 'Wealth Tier' }, color: 'bg-red-800' },
  { id: 'boc_enrich', name: { zh: '中銀 智盈/自在理財', en: 'BOC Enrich / i-Free' }, stockCode: '2388', domain: 'www.bochk.com', url: 'https://www.bochk.com/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '一般理財', en: 'Standard' }, color: 'bg-red-600' },
  { id: 'bea_supreme_new', name: { zh: '東亞 至尊理財 (新資金)', en: 'BEA SupremeGold (New)' }, stockCode: '0023', domain: 'www.hkbea.com', url: 'https://www.hkbea.com/', rates: {}, minDeposit: 100000, type: 'trad', conditions: { zh: '新客戶', en: 'New Client' }, color: 'bg-amber-600' },
  { id: 'icbc_wise_gold', name: { zh: '工銀 理財金/e-Age', en: 'ICBC Wise Gold' }, stockCode: '1398', domain: 'www.icbcasia.com', url: 'https://www.icbcasia.com/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '網上特惠', en: 'Online Promo' }, color: 'bg-red-700' },
  { id: 'citibank_citigold_new', name: { zh: '花旗 New Citigold', en: 'Citi Citigold (New)' }, stockCode: 'US:C', domain: 'www.citibank.com.hk', url: 'https://www.citibank.com.hk/', rates: {}, minDeposit: 50000, type: 'trad', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-blue-700' },
  { id: 'sc_priority', name: { zh: '渣打 優先理財', en: 'SC Priority' }, stockCode: '2888', domain: 'www.sc.com', url: 'https://www.sc.com/hk/', rates: {}, minDeposit: 1000000, type: 'trad', conditions: { zh: '網上專享', en: 'Online Only' }, color: 'bg-blue-600' },
  { id: 'za_new', name: { zh: '眾安 ZA Bank (新客戶)', en: 'ZA Bank (New)' }, stockCode: 'VB01', domain: 'bank.za.group', url: 'https://bank.za.group/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '開戶獎賞', en: 'New Reward' }, color: 'bg-teal-600' },
  { id: 'za_existing', name: { zh: '眾安 ZA Bank (現有)', en: 'ZA Bank (Existing)' }, stockCode: 'VB01', domain: 'bank.za.group', url: 'https://bank.za.group/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '現有客戶', en: 'Existing' }, color: 'bg-teal-500' },
  { id: 'mox_all', name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'www.mox.com', url: 'https://mox.com/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '所有客戶', en: 'All Clients' }, color: 'bg-black' },
  { id: 'livi_high', name: { zh: 'livi bank (5萬+)', en: 'livi bank (>50k)' }, stockCode: 'VB03', domain: 'www.livibank.com', url: 'https://www.livibank.com/', rates: {}, minDeposit: 50000, type: 'virt', conditions: { zh: '高額特惠', en: 'High Tier' }, color: 'bg-blue-600' },
  { id: 'fubon_new', name: { zh: '富邦銀行 (新客戶)', en: 'Fubon Bank (New)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk/', rates: {}, minDeposit: 500000, type: 'trad', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-red-500' },
  { id: 'ocbc_retail', name: { zh: '華僑銀行', en: 'OCBC Bank' }, stockCode: '0606', domain: 'www.ocbc.com.hk', url: 'https://www.ocbc.com.hk/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '零售定存', en: 'Retail FD' }, color: 'bg-red-600' },
  { id: 'ant_retail', name: { zh: '螞蟻銀行', en: 'Ant Bank' }, stockCode: 'VB07', domain: 'www.antbank.hk', url: 'https://www.antbank.hk/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '零售定存', en: 'Retail' }, color: 'bg-blue-900' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [isCompound, setIsCompound] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate');
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [lastSync, setLastSync] = useState(null);
  const [user, setUser] = useState(null);
  const [expandedTerm, setExpandedTerm] = useState(null);

  const t = T[lang];

  // 1. 動態 SEO 與驗證優先邏輯
  useEffect(() => {
    document.title = `${t.title} | ${t.subtitle}`;
    if (!auth) return;
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error('Auth issue'); }
    };
    init();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, [lang, t]);

  // 2. Firestore 數據監聽
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
      .filter(b => (b.name[lang === 'zh_TW' ? 'zh' : 'en'] + b.stockCode).toLowerCase().includes(q))
      .filter(b => filterType === 'all' || b.type === filterType)
      .sort((a, b) => {
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        return a.stockCode.localeCompare(b.stockCode);
      });
  }, [banks, tenor, searchQuery, filterType, sortBy, lang]);
 
  const calcReturn = (rate) => {
    if (!rate || !amount) return 0;
    const n = Number(rate) / 100;
    if (isCompound) {
      const times = { '3m': 4, '6m': 2, '12m': 1 }[tenor];
      return Math.floor(amount * (Math.pow(1 + n / times, times) - 1));
    } else {
      const m = { '3m': 0.25, '6m': 0.5, '12m': 1 }[tenor];
      return Math.floor(amount * n * m);
    }
  };

  const InfoSection = ({ icon: Icon, title, points, description, bgColor, accentColor, link, linkText }) => (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
      <div className={`${bgColor} p-4 text-white flex items-center gap-3`}>
        <Icon size={18} />
        <h2 className="text-base font-black">{title}</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {points.map((p, i) => (
            <div key={i} className="flex-1 min-w-[110px] bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={12} className={`${accentColor} shrink-0`} />
              <div className="text-[8px] font-black text-slate-800 leading-tight uppercase">{p}</div>
            </div>
          ))}
        </div>
        <div className="prose prose-slate max-w-none text-slate-600 text-[11px] leading-relaxed border-l-4 border-slate-100 pl-4">
          {description}
          {link && (
            <a href={link} target="_blank" className={`inline-flex items-center gap-1 mt-2 font-black ${accentColor.replace('text', 'hover:text')} underline decoration-1 underline-offset-2`}>
              {linkText} <ExternalLink size={8}/>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  const Classroom = () => {
    const c = lang === 'zh_TW' ? {
      h1: '定期存款 101 入門課',
      t1: '什麼是定存？', t1p: ['把錢租給銀行', '固定利息收益', '保本理財基石'],
      t1d: '定存是將資金鎖定一段特定時間，銀行則以此換取固定利率。這是 100% 保本理財的最佳起點。',
      t2: '虛擬銀行安全嗎？', t2p: ['金管局持牌', 'DPS 80萬保障', '監管一致'],
      t2d: '虛銀與傳統銀行一樣受金管局監管，並享有存款保障計劃每人每行最高 80 萬港元的法定保障。',
    } : {
      h1: 'Fixed Deposit 101',
      t1: 'What is FD?', t1p: ['Rent Cash', 'Fixed Interest', 'Capital Safe'],
      t1d: 'FD is renting your money to the bank for a fixed tenor in exchange for guaranteed interest. Safe-haven asset.',
      t2: 'Are Virtual Banks Safe?', t2p: ['Licensed', 'DPS (800k HKD)', 'HKMA Regulated'],
      t2d: 'Regulated by HKMA with HKD 800,000 statutory protection via DPS per bank.',
    };
    return (
      <div className="space-y-4 pb-16">
        <section className="bg-blue-600 rounded-[2rem] p-8 text-white relative overflow-hidden">
          <HelpCircle className="absolute top-0 right-0 p-8 opacity-10 rotate-12 w-40 h-40" />
          <h2 className="text-2xl font-black mb-1 tracking-tighter">{c.h1}</h2>
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Financial education starts from zero.</p>
        </section>
        <InfoSection icon={BookOpen} title={c.t1} bgColor="bg-blue-500" accentColor="text-blue-500" points={c.t1p} description={c.t1d} />
        <InfoSection icon={ShieldAlert} title={c.t2} bgColor="bg-slate-800" accentColor="text-slate-800" points={c.t2p} description={c.t2d} link="https://www.hkma.gov.hk/chi/smart-consumers/virtual-banks/" linkText={t.officialGuide} />
      </div>
    );
  };

  const YieldMaster = () => {
    const getCalendarLink = () => {
      const end = new Date(); end.setMonth(end.getMonth() + 3);
      const iso = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=💰+定存到期提醒&details=立刻回網站查看最新利率：https://hk-bank-tracker.firebaseapp.com&dates=${iso(end)}/${iso(end)}`;
    };

    const c = lang === 'zh_TW' ? {
      lDesc: '策略：將 30 萬拆成 3 份。每 3 個月您都有一筆錢到期。到期後續期為新的 12M。最終狀態：您每年享有 12M 的最高長息，但每 3 個月就有資金解鎖。',
      rTitle: '拒絕牌照利率 (Stop Rollover)',
      rDesc: '為什麼你必須設置提醒？銀行獲取利潤的一大來源，正是利用客戶對日期的「遺忘」。定存到期若無指令，預設會進入「自動轉展」，這時採用的往往是極低的「牌照利率」（通常僅 0.1%），收益縮水近 40 倍。這本質上是銀行在收割使用者的健忘。設置提醒，你可以在當天搬錢獲取「新資金」高息，利潤能增加 10 倍以上。'
    } : {
      lDesc: 'Strategy: Split $300k into 3 parts. Rollover it into a new 12M bucket every 3 months. Result: You earn top 12M yields while maintaining quarterly liquidity.',
      rTitle: 'Stop the Rollover Trap',
      rDesc: 'Why you absolutely need reminders? Banks profit heavily from user forgetfulness. By default, funds rollover at the miserable ~0.1% Board Rate—40x lower than promo rates. Setting an alert allows you to reclaim control and transfer funds to re-qualify for "New Fund" promos on maturity day.'
    };

    return (
      <div className="space-y-6 pb-16">
        <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
           <div className="flex items-center gap-2 text-teal-600 mb-4 pb-2 border-b">
              <Layers size={20} />
              <h3 className="text-lg font-black">{lang === 'zh_TW' ? '階梯式定存法 (The Ladder)' : 'The FD Ladder Strategy'}</h3>
           </div>
           <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex flex-col gap-1 items-center font-black">
                 <div className="w-12 h-6 bg-teal-100 rounded flex items-center justify-center text-[7px]">3M</div>
                 <div className="w-12 h-10 bg-teal-300 rounded flex items-center justify-center text-[7px]">6M</div>
                 <div className="w-12 h-16 bg-teal-600 rounded text-white flex items-center justify-center text-[7px]">12M</div>
              </div>
              <div className="space-y-3 flex-1">
                 <h4 className="font-black text-slate-800 text-base">{lang === 'zh_TW' ? '實測範例：HK$300,000 本金佈局' : 'Case Study: HK$300,000 Capital'}</h4>
                 <p className="text-[10px] text-slate-500 leading-relaxed font-medium italic">{c.lDesc}</p>
              </div>
           </div>
        </section>

        <section className="bg-orange-50 border border-orange-100 p-8 rounded-[2.5rem] shadow-sm">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-orange-200 pb-6 mb-6 text-orange-900">
              <div className="flex items-center gap-5">
                <CalendarPlus size={36} />
                <div className="space-y-1">
                   <h4 className="font-black text-xl">{c.rTitle}</h4>
                   <p className="text-[10px] font-bold uppercase tracking-widest">一鍵同步手機日曆</p>
                </div>
              </div>
              <a href={getCalendarLink()} target="_blank" className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-orange-700 transition-all flex items-center gap-2 active:scale-95"><CalendarPlus size={20}/> {t.calendarBtn}</a>
           </div>
           <p className="text-[11px] font-medium leading-relaxed text-orange-800">{c.rDesc}</p>
        </section>
      </div>
    );
  };

  const GlossaryPage = () => (
    <div className="space-y-4 pb-16">
      <div className="bg-slate-100 rounded-[2rem] p-8 flex items-center justify-between shadow-inner">
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter">金融詞彙百科 (Glossary)</h2>
        <GraduationCap size={48} className="text-slate-300 hidden md:block" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {GLOSSARY_DATA.map((item, i) => (
          <div key={i} className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-blue-400 transition-all group shadow-sm">
            <button onClick={() => setExpandedTerm(expandedTerm === i ? null : i)} className="w-full text-left focus:outline-none">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-blue-600 text-[13px] tracking-tight">{lang === 'zh_TW' ? `${item.term_zh} (${item.term_en})` : item.term_en}</span>
                {expandedTerm === i ? <ChevronUp size={12} className="text-slate-300" /> : <ChevronDown size={12} className="text-slate-300" />}
              </div>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{lang === 'zh_TW' ? item.zh_desc : item.en_desc}</p>
            </button>
            {expandedTerm === i && (
              <div className="mt-3 pt-3 border-t border-slate-50 animate-in slide-in-from-top-1">
                <p className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">{t.exampleLabel}</p>
                <p className="text-[10px] text-slate-600 font-medium bg-slate-50 p-2.5 rounded-lg shadow-inner">{lang === 'zh_TW' ? item.zh_ex : item.en_ex}</p>
                {item.link && (
                  <a href={item.link} target="_blank" className="inline-flex items-center gap-1 mt-3 text-[8px] font-black text-indigo-500 hover:text-indigo-600 uppercase border-b">{t.officialGuide} <ExternalLink size={8}/></a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans antialiased pb-20 selection:bg-blue-100">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => setCurrentPage('dashboard')}>
              <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md group-hover:rotate-12 transition-transform"><TrendingUp size={14} /></div>
              <h1 className="text-[14px] font-black tracking-tighter leading-none hidden sm:block">{t.title}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg font-black text-[8px] uppercase tracking-widest">
              {Object.keys(t.nav).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`px-2.5 py-1.5 rounded-md transition-all ${currentPage === page ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.nav[page]}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md">
              {['zh_TW', 'en'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 rounded-[4px] text-[8px] font-black transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-4">
        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto gap-1 mb-4 pb-1 no-scrollbar font-black text-[8px] uppercase tracking-widest">
          {Object.keys(t.nav).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)} className={`whitespace-nowrap px-4 py-2 rounded-full border ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>{t.nav[page]}</button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-9">
            {currentPage === 'dashboard' && (
              <div className="space-y-3">
                <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-wrap gap-6 items-center shadow-sm">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5 mb-1"><Wallet size={12} className="text-blue-500" /> {t.amountLabel}</label>
                    <div className="flex items-center border-b-2 border-slate-50 focus-within:border-blue-500 transition-colors">
                      <span className="text-lg font-black text-slate-300 mr-2">HK$</span>
                      <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-3xl font-black outline-none tabular-nums tracking-tighter" />
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <label className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5 mb-2"><CalendarDays size={12} className="text-blue-500" /> {t.tenorLabel}</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                      {['1m', '3m', '6m', '12m'].map(m => (
                        <button key={m} onClick={() => setTenor(m)} className={`px-8 py-2 rounded-lg text-xs font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{m.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5">
                   <div className="flex flex-wrap gap-2 items-center mb-1">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                      <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg font-bold outline-none text-[9px] shadow-sm" />
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                      {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (
                        <button key={v} onClick={() => setFilterType(v)} className={`px-4 py-1.5 text-[8px] font-black rounded-md transition-all ${filterType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>{l}</button>
                      ))}
                    </div>
                    <button onClick={() => setIsCompound(!isCompound)} className={`p-2 rounded-lg border transition-all ${isCompound ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}><Calculator size={14} /></button>
                  </div>

                  {sortedBanks.map(bank => {
                    const r = bank.rates?.HKD?.[tenor];
                    const hasR = r != null && r > 0;
                    const belowMin = amount < bank.minDeposit;
                    return (
                      <div key={bank.id} className={`group bg-white rounded-2xl border border-slate-200 p-2.5 px-4 flex flex-wrap items-center gap-3 transition-all hover:shadow-lg hover:border-blue-200 ${belowMin ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className={`w-1 h-8 rounded-full ${bank.color} opacity-80 transition-opacity`}></div>
                        <div className="flex items-center gap-3 min-w-[280px] flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 p-1.5 border border-slate-100 flex items-center justify-center shrink-0">
                            <img src={`https://www.google.com/s2/favicons?sz=64&domain=${bank.domain}`} className="w-full h-full object-contain" alt="" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-sm tracking-tight text-slate-800">{lang === 'zh_TW' ? bank.name.zh : bank.name.en}</h3>
                              <span className="text-[7px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md uppercase">{bank.stockCode}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-slate-400 font-bold text-[7px] uppercase">
                              <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{lang === 'zh_TW' ? bank.conditions.zh : bank.conditions.en}</span>
                              <span className="flex items-center gap-1"><ShieldCheck size={8} /> Min: HK${bank.minDeposit.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 md:gap-10 ml-auto">
                          <div className="text-right">
                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.rateLabel}</p>
                            <p className={`text-xl font-black tabular-nums leading-none text-slate-900`}>{hasR ? `${r.toFixed(3)}%` : t.notAvailable}</p>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{t.interestLabel}</p>
                            <p className={`text-lg font-black tabular-nums leading-none ${hasR ? 'text-emerald-500' : 'text-slate-100'}`}>{hasR ? `+${calcReturn(r).toLocaleString()}` : '--'}</p>
                          </div>
                          <a href={bank.url} target="_blank" rel="noreferrer" className="p-2.5 bg-slate-50 text-slate-300 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm shrink-0"><ArrowUpRight size={14} /></a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentPage === 'knowledge' && <Classroom />}
            {currentPage === 'strategies' && <YieldMaster />}
            {currentPage === 'glossary' && <GlossaryPage />}

            <footer className="mt-12 p-8 bg-white rounded-[2rem] border border-slate-200 text-slate-500 text-xs">
              <div className="flex items-center gap-3 text-slate-900 font-black uppercase tracking-widest mb-4">
                <AlertCircle size={20} className="text-blue-600" /> {t.disclaimerTitle}
              </div>
              <p className="text-[9px] font-semibold leading-relaxed border-l-4 border-slate-50 pl-4 mb-6">{t.disclaimerText}</p>
              <div className="pt-6 border-t border-slate-50 flex flex-wrap gap-6 justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
                <div className="flex gap-4">
                  <a href="https://www.ifec.org.hk/" target="_blank" className="hover:text-blue-500">IFEC</a>
                  <a href="https://www.hkma.gov.hk/" target="_blank" className="hover:text-blue-500">HKMA</a>
                  <a href="https://www.dps.org.hk/" target="_blank" className="hover:text-blue-500">DPS</a>
                </div>
                <span>V9.5 Prod Ready • {t.lastUpdateBy}{lastSync || 'N/A'}</span>
              </div>
            </footer>
          </div>

          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-16 space-y-6">
              <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex flex-col items-center min-h-[500px] shadow-sm text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">{t.adLabel}</p>
                <div className="w-full flex-1 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-center p-4">
                  <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">AdSense Skyscraper</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}