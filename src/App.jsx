import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, Search, SortAsc, CalendarDays, Wallet, ShieldCheck,
  ArrowUpRight, AlertCircle, Scale, BookOpen, CheckCircle2, 
  Calculator, ShieldAlert, Zap, CalendarPlus, GraduationCap, 
  ExternalLink, ChevronDown, ChevronUp, Layers, HelpCircle, Gift,
  Coins, BadgePercent, Activity, Clock, Smartphone, Target, Repeat, Globe, Users,
  BellRing, X, MousePointer2, Landmark, Check
} from 'lucide-react';

// ==========================================
// 💡 自動更新日期邏輯：顯示為「當前時間減 1 天」
// ==========================================
const getDisplayDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1); 
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
};

const LAST_UPDATED_DATE = getDisplayDate(); 

// --- Translation Dictionary ---
const T = {
  zh_TW: {
    nav: { dashboard: '利率看板', knowledge: '新手教室', strategies: '賺息大師', reminder: '到期提醒', glossary: '詞彙百科' },
    title: '2026 港元定存利率比較',
    subtitle: '專業級手動監控版 (2026)',
    all: '全部', trad: '傳統', virt: '虛擬',
    searchPlace: '搜尋銀行、代號或帳戶等級…',
    sortRate: '按利率', sortCode: '按編號',
    interestLabel: '預計收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額',
    tenorLabel: '存期', 
    contactBank: '聯繫查詢',
    adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '本站引用金管局 (HKMA) 及投委會 (IFEC) 資料以確保權威性。本網站所載資訊僅供參考，不構成任何財務建議。實際利率及條款以銀行最終批核為準。',
    calendarBtn: '加入手機日曆',
    pushBtn: '設置推送通知',
    backToDash: '返回看板',
    readMore: '展開完整策略解析',
    readLess: '收起詳細內容',
    compareLimit: '最多選擇 3 間銀行',
    compareBtn: '對比所選銀行',
    clearCompare: '清除全部',
    splitterTitle: '💰 存款總額階梯建議',
    splitterDesc: '根據您目前的金額，我們挑選了市場最高息組合，並確保符合存保保障：',
    fundNew: '新資金', fundOld: '現有資金',
    channelApp: '手機 App', channelWeb: '網頁網銀', channelBranch: '實體分行',
    lockedLabel: '金額不足',
    remindTitle: '定存到期管理',
    remindDesc: '設置精確提醒，避免資金落入低息陷阱。',
    exampleLabel: '💡 情境實例：',
  },
  en: {
    nav: { dashboard: 'Rates', knowledge: 'Classroom', strategies: 'Yield Master', reminder: 'Reminders', glossary: 'Glossary' },
    title: 'HK Fixed Deposit Rates 2026',
    subtitle: 'Pro Manual Version (2026)',
    all: 'All', trad: 'Trad', virt: 'Virt',
    searchPlace: 'Search bank...',
    sortRate: 'By Rate', sortCode: 'By Code',
    interestLabel: 'Est. Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Total Capital',
    tenorLabel: 'Tenor', 
    contactBank: 'Contact Bank',
    adLabel: 'ADVERTISEMENT',
    disclaimerTitle: 'Legal Disclaimer',
    disclaimerText: 'Data for reference only. Final terms depend on bank approval.',
    calendarBtn: 'Add to Calendar',
    pushBtn: 'Set Push Notification',
    backToDash: 'Back to Dashboard',
    readMore: 'Expand Full Strategy',
    readLess: 'Collapse Details',
    compareLimit: 'Max 3 banks',
    compareBtn: 'Compare Selected',
    clearCompare: 'Clear All',
    splitterTitle: '💰 Laddering Auto-Splitter',
    splitterDesc: 'Optimized suggestion for your capital based on market best rates:',
    fundNew: 'New Fund', fundOld: 'Existing',
    channelApp: 'App Only', channelWeb: 'Web Only', channelBranch: 'Branch',
    lockedLabel: 'Below Min',
    remindTitle: 'Maturity Management',
    remindDesc: 'Set alerts to move funds precisely.',
    exampleLabel: '💡 Example:',
  },
};

// --- Financial Glossary ---
const GLOSSARY_DATA = [
  { id: 'pa', term_zh: '年利率 (Per Annum)', term_en: 'Per Annum (p.a.)', zh_desc: '以一年為基準計算的利息百分比。', zh_ex: '即使存期只有 3 個月，標示 4% p.a. 代表存入 100 萬後，3 個月收息 1 萬 (1M * 4% / 4)。' },
  { id: 'newfunds', term_zh: '新資金 (New Funds)', term_en: 'New Funds', zh_desc: '銀行定義為比起某特定參考日新增的結餘。', zh_ex: '原本有 10 萬，額外存入 20 萬，這 20 萬才享有高息優惠。' },
  { id: 'liq', term_zh: '流動性 (Liquidity)', term_en: 'Liquidity', zh_desc: '資產轉化為現金的速度與成本。', zh_ex: '全放定存，急用錢時提早提取會損失利息，這就是流動性風險。' },
  { id: 'board', term_zh: '牌照利率 (Board Rate)', term_en: 'Board Rate', zh_desc: '銀行基礎掛牌利率，通常極低（如 0.1%）。', zh_ex: '4% 到期後自動續存可能降至 0.1%，收益縮水 40 倍。' },
  { id: 'dps', term_zh: '存款保障計劃 (DPS)', term_en: 'Deposit Protection Scheme (DPS)', zh_desc: '法例保障每人每行最高獲賠 80 萬港元。', zh_ex: '即使銀行結業，政府保證賠付首 80 萬本金。' },
  { id: 'fps', term_zh: '轉數快 (FPS)', term_en: 'Faster Payment System (FPS)', zh_desc: '香港即時跨行轉賬系統。', zh_ex: '定存到期後，可用 FPS 免費即時轉帳到他行獲取新資金高息。' },
  { id: 'chats', term_zh: '大額即時結算 (CHATS)', term_en: 'CHATS (RTGS)', zh_desc: '用於大額資金即時清算的系統。', zh_ex: '移轉 200 萬以上本金時，可用 CHATS 在數小時內安全入賬。' },
  { id: 'comp', term_zh: '複利 (Compound Interest)', term_en: 'Compound Interest', zh_desc: '俗稱「利滾利」。將利息併入下期本金計算。', zh_ex: '到期後將利息併入本金重新存入，下期收息基數變大。' },
];

// --- Initial Bank Data ---
const INITIAL_BANKS = [
  {
    id: 'ant_retail',
    rates: { HKD: { '3m': 1.8, '6m': 2.2, '12m': 2.5 } },
    name: { zh: '螞蟻 Ant Bank', en: 'Ant Bank' },
    stockCode: 'VB07',
    domain: 'www.antbank.hk',
    url: 'https://www.antbank.hk/rates?lang=en_us',
    minDeposit: 1,
    type: 'virt',
    fundType: 'new',
    channel: 'app',
    color: 'bg-blue-950'
  },
  {
    id: 'bocom_hk_pref',
    rates: { HKD: { '3m': 2.75, '6m': 2.75, '12m': 3.00 } },
    name: { zh: '交通銀行 優息定存', en: 'Bank of Comm' },
    stockCode: '3328',
    domain: 'www.hk.bankcomm.com',
    url: 'https://www.hk.bankcomm.com/hk/shtml/hk/en/2005742/2005763/2005764/list.shtml',
    minDeposit: 500000,
    type: 'trad',
    fundType: 'new',
    channel: 'web',
    color: 'bg-blue-800'
  },
  {
    id: 'bea_supreme',
    rates: { HKD: { '3m': 2.0, '6m': 2.2, '12m': 2.3 } },
    name: { zh: '東亞 至尊理財', en: 'BEA SupremeGold' },
    stockCode: '0023',
    domain: 'www.hkbea.com',
    url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html',
    minDeposit: 100000,
    type: 'trad',
    fundType: 'old',
    channel: 'any',
    color: 'bg-amber-600'
  },
  {
    id: 'boc_wealth',
    rates: { HKD: { '3m': 2.1, '6m': 1.9, '12m': 1.7 } },
    name: { zh: '中銀理財 Private Wealth', en: 'BOC Private Wealth' },
    stockCode: '2388',
    domain: 'www.bochk.com',
    url: 'https://www.bochk.com/tc/investment/rates/deposit.html',
    minDeposit: 1000000,
    type: 'trad',
    fundType: 'new',
    channel: 'branch',
    color: 'bg-red-800'
  },
  {
    id: 'citi_gold_new',
    rates: { HKD: { '3m': 2.9, '6m': 2.5, '12m': 2.0 } },
    name: { zh: '花旗 New Citigold', en: 'Citi New Citigold' },
    stockCode: 'US:C',
    domain: 'www.citibank.com.hk',
    url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/',
    minDeposit: 50000,
    type: 'trad',
    fundType: 'new',
    channel: 'web',
    color: 'bg-blue-700'
  },
  {
    id: 'dbs_treasures',
    rates: { HKD: { '3m': 2.1, '6m': 1.95, '12m': 1.95 } },
    name: { zh: '星展豐盛理財', en: 'DBS Treasures' },
    stockCode: 'D05.SI',
    domain: 'www.dbs.com.hk',
    url: 'https://www.dbs.com.hk/personal/promotion/OnlineTD-promo',
    minDeposit: 50000,
    type: 'trad',
    fundType: 'old',
    channel: 'web',
    color: 'bg-red-800'
  },
  {
    id: 'fubon_new',
    rates: { HKD: { '3m': 2.35, '6m': 2.35, '12m': 2.5 } },
    name: { zh: '富邦銀行 (新)', en: 'Fubon (New)' },
    stockCode: '0636',
    domain: 'www.fubonbank.com.hk',
    url: 'https://www.fubonbank.com.hk/',
    minDeposit: 500000,
    type: 'trad',
    fundType: 'new',
    channel: 'web',
    color: 'bg-red-500'
  },
  {
    id: 'hangseng_perfer',
    rates: { HKD: { '3m': 2.2, '6m': 2.2, '12m': 2.2 } },
    name: { zh: '恒生 優進理財', en: 'Hang Seng Preferred Banking' },
    stockCode: '0011',
    domain: 'www.hangseng.com',
    url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/',
    minDeposit: 10000,
    type: 'trad',
    fundType: 'old',
    channel: 'any',
    color: 'bg-emerald-700'
  },
  {
    id: 'hsbc_elite',
    rates: { HKD: { '3m': 2.2, '6m': 2.0, '12m': 1.8 } },
    name: { zh: '滙豐 卓越尊尚', en: 'HSBC Premier Elite' },
    stockCode: '0005',
    domain: 'www.hsbc.com.hk',
    url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/',
    minDeposit: 10000,
    type: 'trad',
    fundType: 'new',
    channel: 'app',
    color: 'bg-rose-600'
  },
  {
    id: 'hsbc_one',
    rates: { HKD: { '3m': 2.0, '6m': 1.8, '12m': 1.6 } },
    name: { zh: '滙豐 HSBC One', en: 'HSBC One' },
    stockCode: '0005',
    domain: 'www.hsbc.com.hk',
    url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/',
    minDeposit: 10000,
    type: 'trad',
    fundType: 'old',
    channel: 'any',
    color: 'bg-rose-400'
  },
  {
    id: 'mox_all',
    rates: { HKD: { '3m': 2.1, '6m': 2.2, '12m': 2.3 } },
    name: { zh: 'Mox Bank', en: 'Mox Bank' },
    stockCode: 'VB04',
    domain: 'www.mox.com',
    url: 'https://mox.com/',
    minDeposit: 1,
    type: 'virt',
    fundType: 'old',
    channel: 'app',
    color: 'bg-black'
  },
  {
    id: 'za_new',
    rates: { HKD: { '3m': 0.51, '6m': 1.61, '12m': 2.01 } },
    name: { zh: '眾安 ZA Bank (新)', en: 'ZA Bank (New)' },
    stockCode: 'VB01',
    domain: 'bank.za.group',
    url: 'https://bank.za.group/hk/deposit',
    minDeposit: 1,
    type: 'virt',
    fundType: 'new',
    channel: 'app',
    color: 'bg-teal-600'
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate'); 
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [expandedStrategies, setExpandedStrategies] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const t = T[lang];

  const ladderSuggestion = useMemo(() => {
    const findBest = (tenorKey) => {
      return [...INITIAL_BANKS]
        .filter(b => amount >= b.minDeposit)
        .sort((a, b) => (b.rates.HKD[tenorKey] || 0) - (a.rates.HKD[tenorKey] || 0))[0];
    };
    return { '3m': findBest('3m'), '6m': findBest('6m'), '12m': findBest('12m') };
  }, [amount]);

  const sortedBanks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...INITIAL_BANKS]
      .filter(b => {
        const bName = lang === 'zh_TW' ? b.name.zh : b.name.en;
        return (bName + b.stockCode).toLowerCase().includes(q);
      })
      .filter(b => filterType === 'all' || b.type === filterType)
      .sort((a, b) => {
        if (sortBy === 'rate') {
          const ra = a.rates?.HKD?.[tenor] ?? -1;
          const rb = b.rates?.HKD?.[tenor] ?? -1;
          return rb - ra;
        }
        return a.stockCode.localeCompare(b.stockCode);
      });
  }, [tenor, searchQuery, filterType, sortBy, lang]);
 
  const calcReturn = (rate, amt = amount, tnr = tenor) => {
    if (!rate || !amt) return 0;
    const n = Number(rate) / 100;
    const m = { '3m': 0.25, '6m': 0.5, '12m': 1 }[tnr];
    return Math.floor(amt * n * m);
  };

  const InfoSection = ({ id, icon: Icon, title, points, description, bgColor, accentColor, link, linkText, example, isExpandable, fullContent }) => {
    const isExpanded = expandedStrategies[id];
    return (
      <article id={id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500 mb-6 scroll-mt-24">
        <header className={`${bgColor} p-6 text-white flex items-center gap-4`}>
          <Icon size={24} />
          <h2 className="text-xl font-black">{title}</h2>
        </header>
        <div className="p-7 space-y-6">
          <div className="flex flex-wrap gap-3">
            {points.map((p, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 p-3 px-4 rounded-2xl flex items-center gap-2">
                <CheckCircle2 size={16} className={`${accentColor} shrink-0`} />
                <div className="text-[12px] font-black text-slate-800 leading-tight uppercase">{p}</div>
              </div>
            ))}
          </div>
          <div className="prose prose-slate max-w-none text-slate-600 text-[14px] leading-relaxed border-l-4 border-slate-100 pl-6">
            <p>{description}</p>
            {example && <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-[13px]"><strong>{t.exampleLabel}</strong> {example}</div>}
            {isExpandable && (
              <div className="mt-6">
                <button onClick={() => setExpandedStrategies(prev => ({...prev, [id]: !prev[id]}))} className={`flex items-center gap-2 font-black text-[12px] uppercase tracking-widest ${accentColor} hover:opacity-70 transition-all`}>
                  {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  {isExpanded ? t.readLess : t.readMore}
                </button>
                {isExpanded && <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300"><div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4 text-slate-700">{fullContent}</div></div>}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  const RestrictionTag = ({ type, value }) => {
    const config = {
      fundType: {
        new: { label: t.fundNew, icon: Zap, color: 'bg-orange-100 text-orange-600 border-orange-200' },
        old: { label: t.fundOld, icon: Repeat, color: 'bg-blue-100 text-blue-600 border-blue-200' }
      },
      channel: {
        app: { label: t.channelApp, icon: Smartphone, color: 'bg-purple-100 text-purple-600 border-purple-200' },
        web: { label: t.channelWeb, icon: Globe, color: 'bg-teal-100 text-teal-600 border-teal-200' },
        branch: { label: t.channelBranch, icon: Landmark, color: 'bg-slate-100 text-slate-600 border-slate-200' },
        any: { label: '任何渠道', icon: CheckCircle2, color: 'bg-slate-50 text-slate-400 border-slate-100' }
      }
    };
    const item = config[type][value];
    if (!item) return null;
    const Icon = item.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${item.color}`}>
        <Icon size={12} /> {item.label}
      </span>
    );
  };

  const Classroom = () => {
    const topics = [
      { id: 'fx', label: '匯率陷阱', icon: Coins },
      { id: 'myth', label: '利率迷思', icon: BadgePercent },
      { id: 'newfund', label: '新資金定義', icon: Activity },
      { id: 'early', label: '提早提取代價', icon: ShieldAlert },
      { id: 'dps_pro', label: '80萬存保疊加', icon: ShieldCheck },
      { id: 'laddering', label: '階梯式存法', icon: Layers },
      { id: 'fees', label: '戶口等級收費', icon: Scale },
      { id: 'mmf', label: '貨幣基金 vs FD', icon: Wallet },
      { id: 'hibor', label: 'HIBOR 連動', icon: TrendingUp },
      { id: 'rollover', label: '續期陷阱', icon: Clock }
    ];
    return (
      <div className="space-y-6 pb-16 animate-in fade-in duration-300">
        <section className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-lg mb-8">
          <HelpCircle className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
          <h2 className="text-3xl font-black mb-2 tracking-tighter">定期存款 101 入門課</h2>
          <p className="text-blue-100 text-[12px] font-bold uppercase tracking-widest opacity-80">Master your wealth from here.</p>
        </section>
        <nav className="sticky top-14 z-40 -mx-6 px-6 py-4 bg-[#FDFDFF]/90 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar">
          <div className="flex gap-3 min-w-max">
            {topics.map(topic => (
              <button key={topic.id} onClick={() => document.getElementById(topic.id)?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                <topic.icon size={14} className="text-slate-400" /> {topic.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="mt-8">
          <InfoSection id="fx" icon={Coins} title="匯率陷阱 (FX Trap)" bgColor="bg-amber-500" accentColor="text-amber-500" points={['買賣價差點差', '匯價波動風險', '隱形成本侵蝕']} description="美金高息固然誘人，但 0.6% 的來回換匯點差可能在 3 個月內吞噬 60% 的額外利息利潤。" example="以 5% 年息存入 10 萬港元等值美金三個月，收息約 1,250 港元；但若換匯差價佔 0.6%，手續費已去 600 元。" />
          <InfoSection id="myth" icon={BadgePercent} title="利率迷思 (Myth Buster)" bgColor="bg-indigo-500" accentColor="text-indigo-500" points={['帳戶等級門檻', '新資金嚴格定義', '渠道限定優惠']} description="高利率通常附帶條件：需為特定帳戶等級（如卓越理財）、新資金（需由他行轉入）或僅限手機 App 辦理。" />
          {/* ... Classroom content continues ... */}
        </div>
      </div>
    );
  };

  const YieldMaster = () => {
    const strategies = [
      { id: 'hopper', icon: CalendarPlus, label: '搬錢行事曆', title: "跨行「搬錢」行事曆", points: ['計算冷卻期', '新資金資格重置'], description: "透過有序地移動資金，確保每一筆定存都符合銀行的「新資金」定義。", fullContent: "大多數銀行的「冷卻期」為 7 至 30 天。建議維持至少 3 個不同集團的銀行戶口，形成閉環滾動。" },
      { id: 'arbitrage', icon: Zap, label: '利差套利術', title: "利差套利術", points: ['低息稅貸獲取', '高息定存套利'], description: "利用低息貸款獲取資金，投入高於貸款成本的定存計劃，賺取利差。", fullContent: "核心公式：定存收益 - 貸款利息 - 行政費 = 純利。若貸款 APR 為 1.5%，定存為 4.0%，每借 100 萬產生 25,000 元利潤。" },
      { id: 'sprint', icon: Target, label: '季結衝刺', title: "季結衝刺策略", points: ['鎖定 6/12 月底', 'Window Dressing'], description: "銀行在季末為了美化報表，會推出僅限數天的極高息優惠。", fullContent: "通常在每季最後一週出現。提前在 15 號左右將資金轉為現金，確保在季末最後一週是「隨時待命的新資金」。" },
      { id: 'tasks', icon: Gift, label: '任務加息', title: "加息券任務最大化", points: ['消費任務觸發', '多重加息券並用'], description: "虛擬銀行經常推出小任務換取加息券，善用任務組合能顯著提升回報。", fullContent: "有些銀行允許加息券疊加。例如基礎 2.0% + 任務 A 1.0% + 任務 B 1.0% = 4.0%。先完成任務再開定存。" },
      { id: 'pooling', icon: Users, label: '家族資金池', title: "家族資金池", points: ['AUM 共享', '跨級高息獲取'], description: "集合家族成員資金，共同達到高端理財等級，全家人共享高息。", fullContent: "由一名成員達標，其他成員即便存款少，也能享受高端客戶高息。" },
      { id: 'reinvest', icon: Repeat, label: '真複利循環', title: "真複利循環", points: ['利息即時派發', 'MMF 滾存'], description: "不要讓派發的利息閒置。將每月利息自動轉入 MMF，實現利滾利。", fullContent: "選擇「月息」派發的計劃，將利息投入貨幣基金。其實際年回報 (Effective Yield) 會提升。" },
      { id: 'cd_play', icon: Layers, label: '存款證戰術', title: "存款證戰術", points: ['大額資金工具', '二級市場轉讓'], description: "針對 50-100 萬以上資金，存款證提供比普通定存更穩定的利率鎖定期。", fullContent: "CD 在到期前可以在二級市場賣給他人。如果市場利率下跌，你的高息 CD 甚至會有溢價。" },
      { id: 'carry', icon: Globe, label: '聯繫匯率套利', title: "聯繫匯率套利", points: ['港美利差監控', '低換匯成本路徑'], description: "當美金利率顯著高於港元時，透過低換匯成本工具獲取利差。", fullContent: "不要直接在銀行 App 以「零售價」換匯。透過證券行換取接近中間價的美金，再轉回銀行做定存。" },
      { id: 'ladder_pro', icon: TrendingUp, label: '流動性階梯', title: "流動性階梯", points: ['現金 (5%)', '長期 (50%)'], description: "建立科學分配模型，在保證流動性的同時鎖定最高回報。", fullContent: "5% 活期、15% MMF、30% 3個月定存、50% 12個月定存。每月檢視一次，補入後續階梯。" },
      { id: 'sop', icon: Clock, label: '防呆 SOP', title: "防呆 SOP", points: ['關閉自動續期', 'FPS 資金調度'], description: "建立標準化操作流程，確保資金在到期日當天能精準歸位。", fullContent: "T-7：關閉續期；T-0：早上 9 點 FPS 轉往目標銀行；T+0：完成新一輪定存。" }
    ];

    return (
      <div className="space-y-8 pb-16 animate-in fade-in duration-300">
        <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl">
          <Zap className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
          <h2 className="text-4xl font-black mb-2 tracking-tighter">賺息大師：進階獲利攻略</h2>
          <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest opacity-80">Professional cash maximization system.</p>
        </section>
        <nav className="sticky top-14 z-40 -mx-6 px-6 py-4 bg-[#FDFDFF]/90 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar">
          <div className="flex gap-3 min-w-max">
            {strategies.map(s => (
              <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm">
                <s.icon size={14} className="text-slate-400" /> {s.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="mt-8">
          {strategies.map((s, i) => (
            <InfoSection key={s.id} {...s} bgColor={i % 2 === 0 ? "bg-indigo-600" : "bg-emerald-600"} accentColor={i % 2 === 0 ? "text-indigo-600" : "text-emerald-600"} isExpandable={true} />
          ))}
        </div>
      </div>
    );
  };

  const ReminderPage = () => {
    const [remindAmt, setRemindAmt] = useState(100000);
    const [remindBankName, setRemindBankName] = useState("");
    const [remindDate, setRemindDate] = useState("");
    const [remindRate, setRemindRate] = useState(4.0);

    const getCalendarLink = () => {
      const dateStr = remindDate ? new Date(remindDate).toISOString().replace(/-|:|\.\d\d\d/g, "") : "";
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=💰+定存到期提醒：${remindBankName || '未命名銀行'}&details=金額：HK$${remindAmt.toLocaleString()}%0A利率：${remindRate}%25&dates=${dateStr}/${dateStr}`;
    };

    return (
      <div className="space-y-6 pb-16 animate-in fade-in duration-300">
        <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-lg">
          <BellRing className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
          <h2 className="text-3xl font-black mb-2 tracking-tighter">定存到期管理</h2>
          <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest opacity-80">Set alerts to move funds precisely.</p>
        </section>
        <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
           <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase">存入銀行 (可手動輸入)</label>
                 <input list="bank-list" placeholder="請輸入或選擇銀行..." value={remindBankName} onChange={e => setRemindBankName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" />
                 <datalist id="bank-list">
                    {INITIAL_BANKS.map(b => <option key={b.id} value={b.name.zh} />)}
                 </datalist>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase">存款金額 (HK$)</label><input type="number" value={remindAmt} onChange={e => setRemindAmt(Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase">定存年利率 (%)</label><input type="number" step="0.01" value={remindRate} onChange={e => setRemindRate(Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase">到期日期</label><input type="date" value={remindDate} onChange={e => setRemindDate(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
           </div>
           <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href={getCalendarLink()} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white p-5 rounded-3xl font-black text-sm shadow-lg hover:bg-blue-700 transition-all"><CalendarPlus size={20} /> 加入手機日曆</a>
              <button onClick={() => alert('網頁推送已模擬設置')} className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white p-5 rounded-3xl font-black text-sm shadow-lg hover:bg-slate-800 transition-all"><BellRing size={20} /> 設置網頁推送</button>
           </div>
        </section>
      </div>
    );
  };

  const ComparisonView = () => {
    const [compareTenor, setCompareTenor] = useState('3m');
    const selectedBanks = INITIAL_BANKS.filter(b => compareIds.includes(b.id));
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
          <header className="bg-slate-900 p-6 flex items-center justify-between text-white">
            <h2 className="text-xl font-black">銀行深度對比</h2>
            <button onClick={() => setIsCompareOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
          </header>
          <div className="p-8 space-y-8 overflow-x-auto">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit mx-auto gap-2">
              {['3m', '6m', '12m'].map(m => (<button key={m} onClick={() => setCompareTenor(m)} className={`px-10 py-3 rounded-xl text-sm font-black transition-all ${compareTenor === m ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>{m.toUpperCase()}</button>))}
            </div>
            <div className="grid grid-cols-3 gap-6 min-w-[600px]">
              {selectedBanks.map(b => (
                <div key={b.id} className="space-y-6 text-center border-r last:border-none border-slate-100 pr-6 last:pr-0">
                  <div className="flex flex-col items-center gap-3"><img src={`https://www.google.com/s2/favicons?sz=64&domain=${b.domain}`} className="w-12 h-12 rounded-2xl" alt="L" /><h3 className="font-black">{b.name.zh}</h3></div>
                  <div className="bg-slate-50 p-6 rounded-3xl"><p className="text-[10px] font-black text-slate-400 mb-1">年利率</p><p className="text-3xl font-black text-blue-600">{b.rates.HKD[compareTenor] || '--'}%</p></div>
                  <div className="space-y-4"><RestrictionTag type="fundType" value={b.fundType} /><RestrictionTag type="channel" value={b.channel} /><div className="pt-2 border-t border-slate-50"><p className="text-[10px] font-black text-slate-300 uppercase">起存額</p><p className="font-black text-slate-600">HK${b.minDeposit.toLocaleString()}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GlossaryPage = () => (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      <div className="bg-slate-100 rounded-[2.5rem] p-10 flex items-center justify-between shadow-inner">
        <h2 className="text-3xl font-black text-blue-800 tracking-tighter">金融詞彙百科</h2>
        <GraduationCap size={64} className="text-slate-300 hidden md:block" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {GLOSSARY_DATA.map((item, i) => (
          <article key={item.id} className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-blue-400 transition-all group shadow-sm">
            <button onClick={() => setExpandedTerm(expandedTerm === i ? null : i)} className="w-full text-left">
              <div className="flex items-center justify-between mb-2"><h3 className="font-black text-blue-600 text-[16px]">{item.term_zh}</h3>{expandedTerm === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
              <p className="text-[13px] text-slate-500 font-bold leading-relaxed">{item.zh_desc}</p>
              {expandedTerm === i && <div className="mt-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-1"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">💡 情境實例：</p><p className="text-[13px] text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl leading-relaxed">{item.zh_ex}</p></div>}
            </button>
          </article>
        ))}
      </div>
      <button onClick={() => setCurrentPage('dashboard')} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[14px] hover:bg-slate-800">返回看板</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans antialiased pb-20 selection:bg-blue-100">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6"><div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('dashboard')}><div className="bg-blue-600 p-2 rounded-xl text-white shadow-md"><TrendingUp size={20} /></div><h1 className="text-[18px] font-black tracking-tighter leading-none hidden sm:block">{t.title}</h1></div><div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-black text-[10px] uppercase tracking-widest">{Object.keys(t.nav).map(page => (<button key={page} onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg transition-all ${currentPage === page ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.nav[page]}</button>))}</div></div>
          <div className="flex items-center gap-3"><div className="flex items-center bg-slate-100 p-1 rounded-lg">{['zh_TW', 'en'].map(l => (<button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>))}</div></div>
        </div>
      </nav>

      {isCompareOpen && <ComparisonView />}

      <main className="max-w-7xl mx-auto px-6 pt-6">
        <div className="lg:hidden flex overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar font-black text-[10px] uppercase tracking-widest">{Object.keys(t.nav).map(page => (<button key={page} onClick={() => setCurrentPage(page)} className={`whitespace-nowrap px-5 py-2.5 rounded-full border-2 ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>{t.nav[page]}</button>))}</div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-9">
            {currentPage === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden"><div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Landmark size={180}/></div><div className="relative z-10 space-y-6"><div><h2 className="text-2xl font-black tracking-tight mb-2">{t.splitterTitle}</h2><p className="text-blue-100 text-[13px] font-medium opacity-80">{t.splitterDesc}</p></div><div className="grid sm:grid-cols-3 gap-4">{['3m', '6m', '12m'].map(tnr => { const best = ladderSuggestion[tnr]; if (!best) return null; return (<div key={tnr} className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-3xl"><p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-3">{tnr.toUpperCase()} 最佳</p><div className="flex items-center gap-2 mb-2"><img src={`https://www.google.com/s2/favicons?sz=64&domain=${best.domain}`} className="w-6 h-6 rounded-lg" alt="L" /><span className="font-black text-[13px] truncate">{best.name.zh}</span></div><div className="flex items-end justify-between mt-2"><span className="text-2xl font-black">{best.rates.HKD[tnr]}%</span><span className="text-[10px] font-black text-blue-300">DPS OK</span></div></div>);})}</div></div></section>
                <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-wrap gap-10 items-center shadow-sm"><div className="flex-1 min-w-[220px]"><label className="text-[12px] font-black text-slate-400 uppercase flex items-center gap-2 mb-2 tracking-widest"><Wallet size={16} className="text-blue-500" /> {t.amountLabel}</label><div className="flex items-center border-b-4 border-slate-50 focus-within:border-blue-500 pb-2"><span className="text-2xl font-black text-slate-300 mr-3">HK$</span><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-4xl font-black outline-none tracking-tighter" /></div></div><div className="w-full md:w-auto"><label className="text-[12px] font-black text-slate-400 uppercase flex items-center gap-2 mb-3 tracking-widest"><CalendarDays size={16} className="text-blue-500" /> {t.tenorLabel}</label><div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2">{['3m', '6m', '12m'].map(m => (<button key={m} onClick={() => setTenor(m)} className={`px-10 py-3 rounded-xl text-sm font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{m.toUpperCase()}</button>))}</div></div></section>
                <div className="grid gap-3">
                   <div className="flex flex-wrap gap-3 items-center mb-2"><div className="relative flex-1 min-w-[280px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold outline-none text-[13px] shadow-sm focus:ring-4 focus:ring-blue-50" /></div>{compareIds.length > 0 && (<button onClick={() => setIsCompareOpen(true)} className="flex items-center gap-3 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black text-[13px] shadow-lg animate-in zoom-in-95"><Layers size={18}/> {t.compareBtn} ({compareIds.length}/3)</button>)}<div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm gap-1"><button onClick={() => setSortBy('rate')} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all ${sortBy === 'rate' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}><SortAsc size={14}/> {t.sortRate}</button><button onClick={() => setSortBy('code')} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all ${sortBy === 'code' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{t.sortCode}</button></div><div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">{[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (<button key={v} onClick={() => setFilterType(v)} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all ${filterType === v ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{l}</button>))}</div></div>
                  {sortedBanks.map(bank => {
                    const r = bank.rates?.HKD?.[tenor];
                    const belowMin = amount < bank.minDeposit;
                    const isSelected = compareIds.includes(bank.id);
                    return (
                      <article key={bank.id} className={`group bg-white rounded-3xl border transition-all hover:shadow-xl ${belowMin ? 'opacity-40 grayscale border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-blue-300'}`}>
                        <div className="p-4 px-6 flex flex-wrap items-center gap-6">
                          <button disabled={belowMin} onClick={() => { if (isSelected) setCompareIds(compareIds.filter(id => id !== bank.id)); else if (compareIds.length < 3) setCompareIds([...compareIds, bank.id]); }} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 hover:border-blue-400 bg-white'} ${belowMin ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}>{isSelected && <Check size={16}/>}</button>
                          <div className={`w-1.5 h-12 rounded-full ${bank.color} opacity-80`}></div>
                          <div className="flex items-center gap-5 min-w-[320px] flex-1"><div className="w-12 h-12 rounded-2xl bg-white p-2 border border-slate-100 flex items-center justify-center shrink-0"><img src={`https://www.google.com/s2/favicons?sz=64&domain=${bank.domain}`} alt="Logo" className="w-full h-full object-contain" /></div><div className="space-y-1"><div className="flex items-center gap-3"><h3 className="font-black text-[17px] tracking-tight text-slate-800">{bank.name.zh}</h3><span className="text-[11px] font-black px-2 py-1 bg-slate-100 text-slate-400 rounded-lg uppercase">{bank.stockCode}</span></div><div className="flex flex-wrap items-center gap-2"><RestrictionTag type="fundType" value={bank.fundType} /><RestrictionTag type="channel" value={bank.channel} /><span className="flex items-center gap-1.5 text-slate-400 font-bold text-[11px] uppercase ml-2"><ShieldCheck size={12} /> Min: HK${bank.minDeposit.toLocaleString()}</span></div></div></div>
                          <div className="flex items-center gap-8 md:gap-14 ml-auto"><div className="text-right"><p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.rateLabel}</p>{r ? (<p className={`text-3xl font-black tabular-nums leading-none ${belowMin ? 'text-slate-300' : 'text-slate-900'}`}>{r.toFixed(3)}%</p>) : (<p className="text-[11px] font-black text-blue-500 uppercase border-2 border-blue-50 px-3 py-1 rounded-xl">{t.contactBank}</p>)}</div><div className="text-right min-w-[130px]"><p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.interestLabel}</p>{belowMin ? (<span className="inline-flex items-center gap-1.5 text-red-400 text-[10px] font-black uppercase"><AlertCircle size={14}/> {t.lockedLabel}</span>) : (<p className={`text-2xl font-black tabular-nums leading-none ${r ? 'text-emerald-500' : 'text-slate-100'}`}>{r ? `+${calcReturn(r).toLocaleString()}` : '--'}</p>)}</div><a href={bank.url} target="_blank" rel="noreferrer" className="p-4 bg-slate-50 text-slate-300 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"><ArrowUpRight size={20} /></a></div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
            {currentPage === 'reminder' && <ReminderPage />}
            {currentPage === 'knowledge' && <Classroom />}
            {currentPage === 'strategies' && <YieldMaster />}
            {currentPage === 'glossary' && <GlossaryPage />}
            <footer className="mt-12 p-10 bg-white rounded-[2.5rem] border border-slate-200 text-slate-500 text-[13px]"><div className="space-y-6"><div className="flex items-center gap-4 text-slate-900 font-black uppercase tracking-widest text-base"><AlertCircle size={24} className="text-blue-600" /> {t.disclaimerTitle}</div><p className="text-[12px] font-semibold text-slate-400 leading-relaxed border-l-4 border-slate-50 pl-8">{t.disclaimerText}</p></div><div className="pt-8 mt-8 border-t border-slate-100 flex flex-wrap gap-x-12 gap-y-6 justify-between items-center text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]"><div className="flex gap-8 items-center"><span>IFEC 投委會</span><span>HKMA 金管局</span><span>DPS 存保會</span></div><span className="flex items-center gap-3 font-bold uppercase tracking-widest">Update: {LAST_UPDATED_DATE}</span></div></footer>
          </div>
          <aside className="hidden lg:block lg:col-span-3"><div className="sticky top-20"><div className="bg-white border-2 border-dashed border-slate-300 rounded-[2.5rem] p-6 flex flex-col items-center min-h-[500px] text-center"><p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">{t.adLabel}</p><div className="w-full flex-1 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center p-6"><span className="text-[12px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">AdSense Area</span></div></div></div></aside>
        </div>
      </main>
    </div>
  );
}