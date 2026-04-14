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
    lastUpdateBy: '數據更新：',
    adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '本站引用金管局 (HKMA) 及投委會 (IFEC) 資料以確保權威性。本網站所載資訊僅供參考，不構成財務建議。實際利率及條款以銀行最終批核為準。',
    compound: '複利預期 (1Y)',
    calendarBtn: '加入提醒',
    pushBtn: '訂閱通知',
    backToDash: '返回看板',
    exampleLabel: '💡 情境實例：',
    clickToExpand: '點擊展開教學案例',
    officialGuide: '官方指南'
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
    disclaimerText: 'We reference HKMA and IFEC for authority standards. Data for reference only. No financial advice. Final terms depend on bank approval.',
    compound: 'Compound (1Y)',
    calendarBtn: 'Remind Me',
    pushBtn: 'Get Alerts',
    backToDash: 'Back to Dashboard',
    exampleLabel: '💡 Illustrative Example:',
    clickToExpand: 'Click to expand case study',
    officialGuide: 'Official Guide'
  },
};

// ── Financial Glossary Data ──
const GLOSSARY_DATA = [
  { term_zh: '年利率 (Per Annum)', term_en: 'Per Annum (p.a.)', zh_desc: '以一年為基準計算的利息百分比。', en_desc: 'Standardized annual interest rate applied to deposits.', link: 'https://www.ifec.org.hk/sid/tc/money-management/savings/time-deposits.shtml', zh_ex: '標示 4% p.a. 代表存入 100 萬後，3 個月收息 1 萬 (1M * 4% / 4)。', en_ex: '4% p.a. earns $10k on $1M principal for a 3-month term.' },
  { term_zh: '新資金 (New Funds)', term_en: 'New Funds', zh_desc: '銀行定義為比起某特定參考日新增的結餘。', en_desc: 'Incremental balance increase compared to a specific date.', link: null, zh_ex: '原本有 10 萬，額外存入 20 萬，這 20 萬才享有高息優惠。', en_ex: 'Only the net increase in your balance qualifies for promo rates.' },
  { term_zh: '流動性 (Liquidity)', term_en: 'Liquidity', zh_desc: '資產轉化為現金的速度與成本。', en_desc: 'The ease of converting assets into cash without loss.', link: null, zh_ex: '若將所有錢放 12M 定存，急用錢時提早提取會損失所有利息，這即是流動性處罰。', en_ex: 'Emergency early withdrawal from an FD usually wipes out all interest profit.' },
  { term_zh: '牌照利率 (Board Rate)', term_en: 'Board Rate', zh_desc: '銀行基礎掛牌利率，通常極低（如 0.1%）。', en_desc: 'Standard base rate without any promotional offers.', link: null, zh_ex: '4% 到期後自動續存可能降至 0.1%，收益縮水 40 倍。', en_ex: 'Auto-rollover often reverts to 0.1%, a 40x drop from promo rates.' },
  { term_zh: '存款保障計劃 (DPS)', term_en: 'Deposit Protection Scheme (DPS)', zh_desc: '法例保障銀行倒閉時最高賠付 80 萬港元。', en_desc: 'Statutory protection up to HKD 800,000 per bank.', link: 'https://www.dps.org.hk/tc/index.html', zh_ex: '在虛擬銀行存 50 萬，即使該行結業，政府保證賠付。', en_ex: 'If an HK bank fails, the government guarantees repayment up to 800k.' },
  { term_zh: '大額即時結算 (CHATS)', term_en: 'CHATS (RTGS)', zh_desc: '用於銀行間大額資金即時清算的系統。', en_desc: 'Real-time settlement for high-value interbank transfers.', link: 'https://www.hkicl.com.hk/chi/services/rtgs_systems/hong_kong_dollar_rtgs_system.php', zh_ex: '轉帳 200 萬以上時，可用 CHATS 在數小時內安全入賬。', en_ex: 'Use CHATS for large sums (>1M) that exceed daily FPS limits.' },
  { term_zh: '轉數快 (FPS)', term_en: 'Faster Payment System (FPS)', zh_desc: '香港即時跨行轉賬系統。', en_desc: 'HK\'s 24/7 instant interbank transfer system.', link: 'https://www.fps.hk/tc/', zh_ex: '定存到期後，可用 FPS 免費轉帳到他行獲取高息。', en_ex: 'Move funds between banks instantly for free to catch new rates.' },
  { term_zh: '複利 (Compound Interest)', term_en: 'Compound Interest', zh_desc: '利息併入本金滾動計算。', en_desc: 'Interest calculated on both principal and accumulated interest.', link: 'https://www.ifec.org.hk/sid/tc/money-management/compound-interest.shtml', zh_ex: '到期後將利息併入本金重新存入，下期收益變大。', en_ex: 'Reinvesting interest quarterly compounds your future returns.' },
];
 
// ── Initial Bank Data (Global Standards) ──
const INITIAL_BANKS = [
  { id: 'hsbc_elite', name: { zh: '滙豐 卓越尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-rose-600' },
  { id: 'hsbc_premier', name: { zh: '滙豐 卓越理財', en: 'HSBC Premier' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-rose-500' },
  { id: 'hsbc_one', name: { zh: '滙豐 HSBC One', en: 'HSBC One' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/accounts/offers/deposits/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '網上辦理', en: 'Online Only' }, color: 'bg-rose-400' },
  { id: 'hangseng_prestige', name: { zh: '恒生 優越理財', en: 'Hang Seng Prestige' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/zh-hk/personal/banking/time-deposit-offers/', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '網上特惠', en: 'Online Special' }, color: 'bg-emerald-600' },
  { id: 'boc_wealth', name: { zh: '中銀理財', en: 'BOC Wealth Mgt' }, stockCode: '2388', domain: 'www.bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: {}, minDeposit: 10000, type: 'trad', conditions: { zh: '手機銀行', en: 'Mobile App' }, color: 'bg-red-700' },
  { id: 'za', name: { zh: '眾安 ZA Bank', en: 'ZA Bank' }, stockCode: 'VB01', domain: 'bank.za.group', url: 'https://bank.za.group/hk/deposit', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '實時', en: 'Live' }, color: 'bg-teal-600' },
  { id: 'mox', name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'www.mox.com', url: 'https://mox.com/zh/promotions/time-deposit/', rates: {}, minDeposit: 1, type: 'virt', conditions: { zh: '專享', en: 'Promo' }, color: 'bg-black' },
  { id: 'paob', name: { zh: '平安 PAOB', en: 'PAOB' }, stockCode: 'VB05', domain: 'www.paob.com.hk', url: 'https://www.paob.com.hk/tc/deposit.html', rates: {}, minDeposit: 100, type: 'virt', conditions: { zh: '保證', en: 'Guaranteed' }, color: 'bg-orange-500' },
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
  const [syncedCount, setSyncedCount] = useState(0);
  const [user, setUser] = useState(null);
  const [expandedTerm, setExpandedTerm] = useState(null);

  const t = T[lang];
  const lK = lang === 'zh_TW' ? 'zh' : 'en';

  useEffect(() => {
    if (!auth) return;
    const handleAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error('Auth issue...'); }
    };
    handleAuth();
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
    }, (err) => console.log('Firestore connecting...'));
    return () => unsubscribe();
  }, [user]);

  const sortedBanks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return banks
      .filter(b => (b.name.zh + b.name.en + b.stockCode).toLowerCase().includes(q))
      .filter(b => filterType === 'all' || b.type === filterType)
      .sort((a, b) => {
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        return a.stockCode.localeCompare(b.stockCode);
      });
  }, [banks, tenor, searchQuery, filterType, sortBy]);
 
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
    const content = lang === 'zh_TW' ? {
      header: '定期存款 101 入門課',
      sub: '零基礎理財，從這裏開始。',
      topic1Title: '什麼是定存？(基本概念)',
      topic1Points: ['把錢租給銀行', '固定利息收益', '保本理財第一步'],
      topic1Desc: '定存簡單來說就是「把錢租給銀行」。你承諾在特定時間內不動用這筆錢，銀行則以此換取固定利率。這是 100% 保本理財的最佳起點。',
      topic2Title: '安全防線：虛擬銀行可靠嗎？',
      topic2Points: ['金管局持牌', 'DPS 保障 (80 萬)', '監管標準一致'],
      topic2Desc: '香港 8 間虛擬銀行皆獲金管局發牌。它們都是存款保障委員會成員，為每位存款人提供法定保障。安全性與傳統銀行無異。',
    } : {
      header: 'Fixed Deposit 101',
      sub: 'Financial education starts from zero.',
      topic1Title: 'What is Fixed Deposit? (The Basics)',
      topic1Points: ['Rent Cash to Bank', 'Fixed Interest Gains', 'Capital Protection'],
      topic1Desc: 'FD is essentially renting your money to the bank for a fixed tenor in exchange for guaranteed interest. It is a low-risk, safe-haven asset.',
      topic2Title: 'Security: Are Virtual Banks Safe?',
      topic2Points: ['Fully Licensed', 'DPS (800k HKD)', 'HKMA Regulated'],
      topic2Desc: 'All 8 virtual banks in HK are licensed by HKMA. They offer statutory protection up to HKD 800,000 per depositor via DPS.',
    };

    return (
      <div className="space-y-5 pb-16">
        <section className="bg-blue-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><HelpCircle size={140} /></div>
          <h2 className="text-2xl font-black mb-1 tracking-tighter">{content.header}</h2>
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">{content.sub}</p>
        </section>
        <InfoSection icon={BookOpen} title={content.topic1Title} bgColor="bg-blue-500" accentColor="text-blue-500" points={content.topic1Points} description={content.topic1Desc} />
        <InfoSection icon={ShieldAlert} title={content.topic2Title} bgColor="bg-slate-800" accentColor="text-slate-800" points={content.topic2Points} description={content.topic2Desc} link="https://www.hkma.gov.hk/chi/smart-consumers/virtual-banks/" linkText={t.officialGuide} />
      </div>
    );
  };

  const YieldMaster = () => {
    const getCalendarLink = () => {
      const end = new Date(); end.setMonth(end.getMonth() + 3);
      const iso = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=💰+定存到期提醒&details=立刻回網站查看最新利率：https://hk-bank-tracker.firebaseapp.com&dates=${iso(end)}/${iso(end)}`;
    };

    const content = lang === 'zh_TW' ? {
      header: '賺盡利息：致富大攻略',
      ladderDesc: '策略：將 30 萬拆成 3 份。每 3 個月您都有一筆錢到期。到期後續期為新的 12M。最終狀態：您每年享有 12M 的最高長息，但每 3 個月就有資金解鎖可用。',
      rolloverTitle: '拒絕牌照利率 (Stop Rollover)',
      rolloverDesc: '為什麼你需要提醒？銀行預設會在你定存到期後，按當時極低的「牌照利率」（通常僅 0.1%）自動續期。這是一場對使用者「健忘」與「惰性」的利潤收割。正確做法是設為「本息入賬」，並利用本站工具將日期存入日曆。到期當天重新掃描全港最高息，搬錢重新獲得「新資金」資格，利潤能增加 10 倍以上。',
      rolloverPoints: ['利潤收割陷阱', '記憶力對抗', '搬錢獲取高息']
    } : {
      header: 'Wealth Hacks: Yield Master',
      ladderDesc: 'Strategy: Split $300k into 3 parts. Every 3 months, a portion matures. Rollover it into a new 12M bucket. Result: Maximize long-term yields with quarterly liquidity.',
      rolloverTitle: 'Stop the Rollover Trap',
      rolloverDesc: 'Why you need reminders? Banks default to auto-renewing your funds at the miserable ~0.1% Board Rate. This is a harvest of user forgetfulness. By setting a calendar alert and manually re-scanning the market on maturity, you can transfer funds to re-qualify for "New Fund" promos, boosting your net return by over 10x.',
      rolloverPoints: ['Profit Harvest Trap', 'Combat Forgetfulness', 'New Fund Re-qualification']
    };

    return (
      <div className="space-y-6 pb-16">
        <section className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Zap size={140} /></div>
          <h2 className="text-3xl font-black mb-1 tracking-tighter">{content.header}</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Capital optimization hacks.</p>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
           <div className="flex items-center gap-2 text-teal-600 mb-4 pb-2 border-b border-slate-50">
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
                 <h4 className="font-black text-slate-800 text-base underline decoration-teal-200">{lang === 'zh_TW' ? '實測範例：HK$300,000 本金佈局' : 'Case Study: HK$300,000 Capital'}</h4>
                 <p className="text-[10px] text-slate-500 leading-relaxed font-medium italic">{content.ladderDesc}</p>
              </div>
           </div>
        </section>

        <section className="bg-orange-50 border border-orange-100 p-8 rounded-[2.5rem] shadow-sm">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-orange-200 pb-6 mb-6 text-orange-900">
              <div className="flex items-center gap-5">
                <CalendarPlus size={36} />
                <div className="space-y-1">
                   <h4 className="font-black text-xl">{content.rolloverTitle}</h4>
                   <p className="text-[10px] font-bold uppercase tracking-widest">一鍵同步手機日曆</p>
                </div>
              </div>
              <a href={getCalendarLink()} target="_blank" className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg active:scale-95"><CalendarPlus size={20}/> {t.calendarBtn}</a>
           </div>
           <InfoSection icon={ShieldAlert} title={lang === 'zh_TW' ? '詳細解析' : 'Deep Dive'} bgColor="bg-orange-600" accentColor="text-orange-600" points={content.rolloverPoints} description={content.rolloverDesc} />
        </section>
      </div>
    );
  };

  const GlossaryPage = () => (
    <div className="space-y-6 pb-16">
      <div className="bg-slate-100 rounded-[2rem] p-8 flex items-center justify-between shadow-inner">
        <div>
           <h2 className="text-2xl font-black text-slate-900 tracking-tighter">金融詞彙百科 (Glossary)</h2>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-[8px] mt-1">Bilingual terms with case studies.</p>
        </div>
        <GraduationCap size={48} className="text-slate-300 hidden md:block" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {GLOSSARY_DATA.map((item, i) => (
          <div key={i} className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-blue-400 transition-all group shadow-sm">
            <button onClick={() => setExpandedTerm(expandedTerm === i ? null : i)} className="w-full text-left focus:outline-none">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-blue-600 text-[13px] tracking-tight">
                  {lang === 'zh_TW' ? `${item.term_zh} (${item.term_en})` : item.term_en}
                </span>
                {expandedTerm === i ? <ChevronUp size={12} className="text-slate-300" /> : <ChevronDown size={12} className="text-slate-300" />}
              </div>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{lang === 'zh_TW' ? item.zh_desc : item.en_desc}</p>
            </button>
            {expandedTerm === i && (
              <div className="mt-3 pt-3 border-t border-slate-50 animate-in slide-in-from-top-1">
                <p className="text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">{t.exampleLabel}</p>
                <p className="text-[10px] text-slate-600 font-medium bg-slate-50 p-2.5 rounded-lg shadow-inner">
                  {lang === 'zh_TW' ? item.zh_ex : item.en_ex}
                </p>
                {item.link && (
                  <a href={item.link} target="_blank" className="inline-flex items-center gap-1 mt-3 text-[8px] font-black text-indigo-500 hover:text-indigo-600 uppercase border-b border-indigo-50 pb-0.5">{t.officialGuide} <ExternalLink size={8}/></a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setCurrentPage('dashboard')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg active:scale-95">{t.backToDash}</button>
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
        <div className="md:hidden flex overflow-x-auto gap-1 mb-4 pb-1 no-scrollbar font-black text-[8px] uppercase tracking-widest">
          {Object.keys(t.nav).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)} className={`whitespace-nowrap px-4 py-2 rounded-full border ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>{t.nav[page]}</button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-9">
            {currentPage === 'dashboard' && (
              <div className="space-y-3">
                <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-wrap gap-6 items-center animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Wallet size={12} className="text-blue-500" /> {t.amountLabel}</label>
                    <div className="flex items-center border-b-2 border-slate-50 focus-within:border-blue-500 transition-colors pb-1">
                      <span className="text-lg font-black text-slate-300 mr-2">HK$</span>
                      <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-3xl font-black outline-none tabular-nums tracking-tighter" />
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><CalendarDays size={12} className="text-blue-500" /> {t.tenorLabel}</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                      {['3m', '6m', '12m'].map(m => (
                        <button key={m} onClick={() => setTenor(m)} className={`px-8 py-2 rounded-lg text-xs font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{m.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5">
                   <div className="flex flex-wrap gap-2 items-center mb-1">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                      <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-50 transition-all text-[9px] shadow-sm" />
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                      {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (
                        <button key={v} onClick={() => setFilterType(v)} className={`px-4 py-1.5 text-[8px] font-black rounded-md transition-all ${filterType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>{l}</button>
                      ))}
                    </div>
                    <button onClick={() => setIsCompound(!isCompound)} className={`p-2 rounded-lg border transition-all ${isCompound ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}><Calculator size={14} /></button>
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
                            {hasR ? (
                              <p className="text-xl font-black tabular-nums leading-none text-slate-900">{Number(r).toFixed(2)}%</p>
                            ) : (
                              <p className="text-[8px] font-black text-blue-500 uppercase border border-blue-50 px-1.5 py-0.5 rounded-md">{t.contactBank}</p>
                            )}
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

            <footer className="mt-12 p-8 bg-white rounded-[2rem] border border-slate-200 space-y-6 relative overflow-hidden text-slate-500 text-xs">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-slate-900 rotate-12"><Scale size={140} /></div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3 text-slate-900 font-black uppercase tracking-widest text-sm">
                  <AlertCircle size={20} className="text-blue-600" /> {t.disclaimerTitle}
                </div>
                <p className="text-[9px] font-semibold text-slate-400 leading-relaxed max-w-4xl border-l-4 border-slate-50 pl-6">
                  {t.disclaimerText}
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-x-10 gap-y-4 justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">
                <div className="flex gap-6 items-center">
                  <a href="https://www.ifec.org.hk/" target="_blank" className="hover:text-blue-500 transition-colors">IFEC 投委會</a>
                  <a href="https://www.hkma.gov.hk/" target="_blank" className="hover:text-blue-500 transition-colors">HKMA 金管局</a>
                  <a href="https://www.dps.org.hk/" target="_blank" className="hover:text-blue-500 transition-colors">DPS 存保會</a>
                </div>
                <span className="flex items-center gap-2 font-bold uppercase tracking-widest">V8.5 GitHub Ready • {t.lastUpdateBy}{lastSync || 'N/A'}</span>
              </div>
            </footer>
          </div>

          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-16 space-y-6">
              <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-4 flex flex-col items-center min-h-[500px] shadow-sm text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">{t.adLabel}</p>
                <div className="w-full flex-1 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-center p-4">
                  <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">AdSense Skyscraper Area</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}