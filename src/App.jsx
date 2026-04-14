import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Search, SortAsc, CalendarDays, Wallet, ShieldCheck,
  Clock, Activity, ArrowUpRight, Globe, Smartphone, MousePointer2,
  AlertCircle, Scale, Info, BookOpen, Lightbulb, CheckCircle2, 
  Calculator, Share2, ShieldAlert, Zap, Target, TrendingDown, Menu, X, Landmark, BellRing, CalendarPlus, GraduationCap, ExternalLink, ChevronDown, ChevronUp, Layers, HelpCircle, BadgePercent, Coins, Gift
} from 'lucide-react';

// ==========================================
// 💡 手動更新專區：修改這裡的日期與下方利率即可更新網頁
// ==========================================
const LAST_UPDATED_DATE = "2026-04-14 22:30"; 

// --- Translation Dictionary ---
const T = {
  zh_TW: {
    nav: { dashboard: '利率看板', knowledge: '新手教室', strategies: '賺息大師', glossary: '詞彙百科' },
    title: '港元定存追蹤器',
    subtitle: '專業級手動監控版 (2026)',
    all: '全部', trad: '傳統', virt: '虛擬',
    searchPlace: '搜尋銀行、代號或帳戶等級…',
    sortRate: '按利率', sortCode: '按編號',
    interestLabel: '預計收益', rateLabel: '年利率 p.a.',
    minDeposit: '起存額', amountLabel: '預計存款金額',
    tenorLabel: '存期', 
    contactBank: '聯繫查詢',
    syncing: '手動更新',
    lastUpdateBy: '最後更新：',
    adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '本站引用金管局 (HKMA) 及投委會 (IFEC) 資料以確保權威性。本網站所載資訊僅供參考，不構成任何財務建議。實際利率及條款以銀行最終批核為準。',
    compound: '複利預期 (1Y)',
    calendarBtn: '加入提醒',
    pushBtn: '訂閱通知',
    backToDash: '返回看板',
    exampleLabel: '💡 情境實例：',
    clickToExpand: '點擊展開案例分析',
    officialGuide: '官方指南',
    notAvailable: '暫無提供'
  },
  en: {
    nav: { dashboard: 'Rates', knowledge: 'Classroom', strategies: 'Yield Master', glossary: 'Glossary' },
    title: 'HK FD Tracker',
    subtitle: 'Pro Manual Version (2026)',
    all: 'All', trad: 'Trad', virt: 'Virt',
    searchPlace: 'Search bank, code or tier...',
    sortRate: 'By Rate', sortCode: 'By Code',
    interestLabel: 'Est. Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min. Dep', amountLabel: 'Deposit Amount',
    tenorLabel: 'Tenor', 
    contactBank: 'Contact Bank',
    syncing: 'Manual',
    lastUpdateBy: 'Updated: ',
    adLabel: 'ADVERTISEMENT',
    disclaimerTitle: 'Legal Disclaimer',
    disclaimerText: 'We reference HKMA and IFEC for authority standards. Data for reference only. No financial advice. Final terms depend on bank approval.',
    compound: 'Compound (1Y)',
    calendarBtn: 'Add to Calendar',
    pushBtn: 'Get Alerts',
    backToDash: 'Back to Dashboard',
    exampleLabel: '💡 Illustrative Example:',
    clickToExpand: 'Click to expand case study',
    officialGuide: 'Official Guide',
    notAvailable: 'N/A'
  },
};

// --- Financial Glossary (20 Terms) ---
const GLOSSARY_DATA = [
  { id: 'pa', term_zh: '年利率 (Per Annum)', term_en: 'Per Annum (p.a.)', zh_desc: '以一年為基準計算的利息百分比。', en_desc: 'Standardized annual interest rate applied to deposits.', link: 'https://www.ifec.org.hk/sid/tc/money-management/savings/time-deposits.shtml', zh_ex: '即使存期只有 3 個月，標示 4% p.a. 代表存入 100 萬後，3 個月收息 1 萬 (1M * 4% / 4)。', en_ex: 'A 3M term with 4% p.a. earns $10k on $1M principal.' },
  { id: 'newfunds', term_zh: '新資金 (New Funds)', term_en: 'New Funds', zh_desc: '銀行定義為比起某特定參考日新增的結餘。', en_desc: 'Incremental balance increase compared to a specific date.', link: null, zh_ex: '原本有 10 萬，額外存入 20 萬，這 20 萬才享有高息優惠。', en_ex: 'Only fresh capital from other banks qualifies for promos.' },
  { id: 'liq', term_zh: '流動性 (Liquidity)', term_en: 'Liquidity', zh_desc: '資產轉化為現金的速度與成本。', en_desc: 'Ease of converting assets to cash without loss.', link: null, zh_ex: '全放定存，急用錢時提早提取會損失利息，這就是流動性風險。', en_ex: 'Emergency early withdrawal usually wipes out your entire interest profit.' },
  { id: 'board', term_zh: '牌照利率 (Board Rate)', term_en: 'Board Rate', zh_desc: '銀行基礎掛牌利率，通常極低（如 0.1%）。', en_desc: 'Standard base rate without any promotional offers.', link: null, zh_ex: '4% 到期後自動續存可能降至 0.1%，收益縮水 40 倍。', en_ex: 'Default rate for rollovers, often 40x lower than promo rates.' },
  { id: 'dps', term_zh: '存款保障計劃 (DPS)', term_en: 'Deposit Protection Scheme (DPS)', zh_desc: '法例保障每人每行最高獲賠 80 萬港元。', en_desc: 'Statutory protection up to HKD 800,000 per bank.', link: 'https://www.dps.org.hk/tc/index.html', zh_ex: '即使銀行結業，政府保證賠付首 80 萬本金。', en_ex: 'Government guarantee per bank in case of bank failure.' },
  { id: 'fps', term_zh: '轉數快 (FPS)', term_en: 'Faster Payment System (FPS)', zh_desc: '香港即時跨行轉賬系統。', en_desc: 'HK\'s 24/7 instant interbank transfer system.', link: 'https://www.fps.hk/tc/', zh_ex: '定存到期後，可用 FPS 免費即時轉帳到他行獲取新資金高息。', en_ex: 'Move funds instantly for zero cost between banks.' },
  { id: 'chats', term_zh: '大額即時結算 (CHATS)', term_en: 'CHATS (RTGS)', zh_desc: '用於大額資金即時清算的系統。', en_desc: 'Real-time settlement for high-value transfers (>1M).', link: 'https://www.hkicl.com.hk/chi/services/rtgs_systems/hong_kong_dollar_rtgs_system.php', zh_ex: '移轉 200 萬以上本金時，可用 CHATS 在數小時內安全入賬。', en_ex: 'Use CHATS for large sums exceeding daily FPS limits.' },
  { id: 'echeck', term_zh: '電子支票 (E-Check)', term_en: 'E-Check', zh_desc: '支票的電子版本，具法律效力。', en_desc: 'Digital version of a legal cheque.', link: 'https://www.hkicl.com.hk/chi/services/e_check/introduction.php', zh_ex: '想 0 手續費轉移 500 萬大額且不趕時間，可簽發電子支票。', en_ex: 'Issue an E-Check for free large-sum movements.' },
  { id: 'comp', term_zh: '複利 (Compound Interest)', term_en: 'Compound Interest', zh_desc: '俗稱「利滾利」。將利息併入下期本金計算。', en_desc: 'Interest calculated on principal plus accumulated interest.', link: 'https://www.ifec.org.hk/sid/tc/money-management/compound-interest.shtml', zh_ex: '到期後將利息併入本金重新存入，下期收息基數變大。', en_ex: 'Reinvesting quarterly interest compounds your future returns.' },
  { id: 'spread', term_zh: '換匯點差 (FX Spread)', term_en: 'FX Spread', zh_desc: '銀行買入價與賣出價的差距。', en_desc: 'The difference between buy and sell prices.', link: null, zh_ex: '市場價 7.80，銀行買入美金收 7.82，0.02 即是隱形成本。', en_ex: 'Hidden cost when converting HKD to USD for deposits.' },
  { id: 'aum', term_zh: '資產管理規模 (AUM)', term_en: 'Asset Under Management (AUM)', zh_desc: '你在該銀行持有的總資產總和。', en_desc: 'Total assets held with a specific bank.', link: null, zh_ex: '資產滿 100 萬可獲取卓越理財高息。', en_ex: 'Total balance determining your eligibility for premium tiers.' },
  { id: 'peg', term_zh: '聯繫匯率 (Linked Exchange Rate)', term_en: 'Linked Exchange Rate', zh_desc: '港元掛鉤美元制度 (7.75-7.85)。', en_desc: 'HKD peg to the USD.', link: 'https://www.hkma.gov.hk/chi/key-functions/monetary-stability/linked-exchange-rate-system/', zh_ex: '即便美息劇震，港元也會維持在窄幅內。', en_ex: 'System maintaining HKD stability against USD.' },
  { id: 'tenor', term_zh: '存期 (Tenor)', term_en: 'Tenor', zh_desc: '資金鎖定的預設時間長度。', en_desc: 'The pre-set length of a deposit term.', link: null, zh_ex: '選擇 6M Tenor 代表資金將被鎖定半年。', en_ex: 'e.g. 3 Months, 6 Months, etc.' },
  { id: 'cool', term_zh: '冷卻期 (Cool-down Period)', term_en: 'Cool-down Period', zh_desc: '搬錢離開後重獲新資金資格所需時間。', en_desc: 'Time needed outside a bank to reset "New Fund" status.', link: null, zh_ex: '搬走錢 14 天後再搬回，通常可獲新資金優惠。', en_ex: 'Usually 14-30 days of absence required.' },
  { id: 'early', term_zh: '提早提取 (Early Withdrawal)', term_en: 'Early Withdrawal', zh_desc: '定存未到期前強行取款。', en_desc: 'Withdrawing funds before the term expires.', link: null, zh_ex: '原存一年，半年時取出，銀行有權扣除所有利息。', en_ex: 'Often results in total loss of accrued interest.' },
  { id: 'cd', term_zh: '存款證 (CD)', term_en: 'Certificate of Deposit (CD)', zh_desc: '可轉讓的金融存款工具。', en_desc: 'Negotiable financial instrument.', link: null, zh_ex: '未到期但可在二級市場賣出變現。', en_ex: 'Similar to a deposit but tradable.' },
  { id: 'rollover', term_zh: '自動續期 (Rollover)', term_en: 'Rollover', zh_desc: '到期後自動以掛牌利率續存的選項。', en_desc: 'Automatic renewal at low base rates.', link: null, zh_ex: '忘記手動處理，4% 利息會瞬間變 0.1%。', en_ex: 'Novices often lose interest profit by not disabling this.' },
  { id: 'tiered', term_zh: '階梯計息 (Tiered Rate)', term_en: 'Tiered Rate', zh_desc: '本金越多，利率越高的計息方式。', en_desc: 'Interest increases with deposit volume.', link: null, zh_ex: '首 10 萬給 3%，超過的部分給 4%。', en_ex: 'Higher volumes earn higher edge-rates.' },
  { id: 'ifec', term_zh: '投委會 (IFEC)', term_en: 'IFEC', zh_desc: '香港理財教育官方非牟利機構。', en_desc: 'HK non-profit for financial education.', link: 'https://www.ifec.org.hk/', zh_ex: '提供中立定存建議與理財計算機。', en_ex: 'Official source for unbiased money management data.' },
  { id: 'hkma', term_zh: '金管局 (HKMA)', term_en: 'HKMA', zh_desc: '香港銀行業最高監管機構。', en_desc: 'HK central banking regulator.', link: 'https://www.hkma.gov.hk/', zh_ex: '虛銀執照均由金管局發出。', en_ex: 'Ensures all HK banks follow safety regulations.' },
];
 
// --- Initial Bank Data (Updated based on latest CSV) ---
const INITIAL_BANKS = [
{ id: 'hsbc_elite', name: { zh: '滙豐 卓越尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: { HKD: { '3m': 2.2, '6m': 2.0, '12m': null } }, minDeposit: 10000, type: 'trad', conditions: { zh: '新資金優惠', en: 'New Funds' }, color: 'bg-rose-600' },
  { id: 'hsbc_premier', name: { zh: '滙豐 卓越理財', en: 'HSBC Premier' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: { HKD: { '3m': 2.1, '6m': 1.9, '12m': null } }, minDeposit: 10000, type: 'trad', conditions: { zh: '卓越理財客戶', en: 'Premier' }, color: 'bg-rose-500' },
  { id: 'hsbc_one', name: { zh: '滙豐 HSBC One', en: 'HSBC One' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', rates: { HKD: { '3m': 2.0, '6m': 1.8, '12m': null } }, minDeposit: 10000, type: 'trad', conditions: { zh: '網上辦理', en: 'Online Only' }, color: 'bg-rose-400' },
  { id: 'hangseng_priv', name: { zh: '恒生 優越私人理財', en: 'Hang Seng Prestige Private' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: { HKD: { '3m': 2.0, '6m': 1.9, '12m': null } }, minDeposit: 10000, type: 'trad', conditions: { zh: '私人理財客戶', en: 'Private Banking' }, color: 'bg-emerald-700' },
  { id: 'hangseng_prestige', name: { zh: '恒生 優越理財', en: 'Hang Seng Prestige' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com/en-hk/personal/banking/rates/deposit-interest-rates/', rates: { HKD: { '3m': 2.0, '6m': 1.9, '12m': null } }, minDeposit: 10000, type: 'trad', conditions: { zh: '網上專享', en: 'Online Only' }, color: 'bg-emerald-600' },
  { id: 'boc_wealth', name: { zh: '中銀理財 Private Wealth', en: 'BOC Private Wealth' }, stockCode: '2388', domain: 'www.bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', rates: { HKD: { '3m': 2.1, '6m': 1.9, '12m': null } }, minDeposit: 1000000, type: 'trad', conditions: { zh: '高端客戶', en: 'Wealth Tier' }, color: 'bg-red-800' },
  { id: 'bea_supreme', name: { zh: '東亞 至尊理財', en: 'BEA SupremeGold' }, stockCode: '0023', domain: 'www.hkbea.com', url: 'https://www.hkbea.com/html/en/bea-personal-banking-supremegold-time-deposit.html', rates: { HKD: { '3m': 2.0, '6m': 2.2, '12m': 2.3 } }, minDeposit: 100000, type: 'trad', conditions: { zh: '高端客戶', en: 'SupremeGold' }, color: 'bg-amber-600' },
  { id: 'icbc_wise_gold', name: { zh: '工銀 理財金', en: 'ICBC Wise Gold' }, stockCode: '1398', domain: 'www.icbcasia.com', url: 'https://www.icbcasia.com/hk/tc/personal/latest-promotion/online-time-deposit.html', rates: { HKD: { '3m': 2.25, '6m': 2.25, '12m': 2.25 } }, minDeposit: 10000, type: 'trad', conditions: { zh: '網上特惠', en: 'Online Special' }, color: 'bg-red-700' },
  { id: 'citi_gold_new', name: { zh: '花旗 New Citigold', en: 'Citi New Citigold' }, stockCode: 'US:C', domain: 'www.citibank.com.hk', url: 'https://www.citibank.com.hk/english/personal-banking/interest-and-foreign-exchange-rates/', rates: { HKD: { '3m': 2.9, '6m': null, '12m': null } }, minDeposit: 50000, type: 'trad', conditions: { zh: '新開戶', en: 'New Client' }, color: 'bg-blue-700' },
  { id: 'dbs_treasures', name: { zh: '星展豐盛理財', en: 'DBS Treasures' }, stockCode: 'D05.SI', domain: 'www.dbs.com.hk', url: 'https://www.dbs.com.hk/personal/promotion/OnlineTD-promo', rates: { HKD: { '3m': 2.1, '6m': 1.95, '12m': 1.95 } }, minDeposit: 50000, type: 'trad', conditions: { zh: '網上定存', en: 'Online' }, color: 'bg-red-800' },
  { id: 'bocom_hk_pref', name: { zh: '交通銀行 優息定存', en: 'Bank of Comm' }, stockCode: '3328', domain: 'www.hk.bankcomm.com', url: 'https://www.hk.bankcomm.com/hk/shtml/hk/en/2005742/2005763/2005764/list.shtml', rates: { HKD: { '3m': 2.75, '6m': 2.75, '12m': 3.00 } }, minDeposit: 500000, type: 'trad', conditions: { zh: '50萬以上', en: '500k+' }, color: 'bg-blue-800' },
  { id: 'za_new', name: { zh: '眾安 ZA Bank (新)', en: 'ZA Bank (New)' }, stockCode: 'VB01', domain: 'bank.za.group', url: 'https://bank.za.group/hk/deposit', rates: { HKD: { '3m': 0.51, '6m': 1.61, '12m': 2.01 } }, minDeposit: 1, type: 'virt', conditions: { zh: '開戶獎賞', en: 'New Reward' }, color: 'bg-teal-600' },
  { id: 'mox_all', name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'www.mox.com', url: 'https://mox.com/', rates: { HKD: { '3m': 2.1, '6m': 2.2, '12m': 2.3 } }, minDeposit: 1, type: 'virt', conditions: { zh: '所有客戶', en: 'All Clients' }, color: 'bg-black' },
  { id: 'livi_high', name: { zh: 'livi (5萬+)', en: 'livi (>50k)' }, stockCode: 'VB03', domain: 'www.livibank.com', url: 'https://www.livibank.com/features/livisave.html', rates: { HKD: { '3m': 2.0, '6m': 2.0, '12m': 2.0 } }, minDeposit: 50000, type: 'virt', conditions: { zh: '高息存額', en: 'High Tier' }, color: 'bg-blue-600' },
  { id: 'fubon_new', name: { zh: '富邦銀行 (新)', en: 'Fubon (New)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk/', rates: { HKD: { '3m': 2.05, '6m': 2.05, '12m': 2.2 } }, minDeposit: 500000, type: 'trad', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-red-500' },
  { id: 'ant_retail', name: { zh: '螞蟻 Ant Bank', en: 'Ant Bank' }, stockCode: 'VB07', domain: 'www.antbank.hk', url: 'https://www.antbank.hk/rates?lang=en_us', rates: { HKD: { '3m': 1.8, '6m': 2.2, '12m': 2.5 } }, minDeposit: 1, type: 'virt', conditions: { zh: '新資金', en: 'New Funds' }, color: 'bg-blue-950' },
  { id: 'welab_bank', name: { zh: 'WeLab Bank', en: 'WeLab Bank' }, stockCode: 'VB08', domain: 'www.welab.bank', url: 'https://www.welab.bank/en/feature/gosave_2/', rates: { HKD: { '3m': 2.2, '6m': 2.4, '12m': 2.25 } }, minDeposit: 10, type: 'virt', conditions: { zh: 'GoSave 2.0', en: 'GoSave 2.0' }, color: 'bg-purple-600' },
  { id: 'ncb_hk_500k', name: { zh: '南洋商業銀行', en: 'Nanyang Commercial Bank' }, stockCode: 'NCB', domain: 'www.ncb.com.hk', url: 'https://www.ncb.com.hk/nanyang_bank/eng/html/14ac.html', rates: { HKD: { '3m': 1.00, '6m': 1.00, '12m': 1.00 } }, minDeposit: 500000, type: 'trad', conditions: { zh: '50萬或以上', en: '500k+' }, color: 'bg-green-700' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [isCompound, setIsCompound] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate'); // Re-added sort state
  const [banks, setBanks] = useState(INITIAL_BANKS);
  const [expandedTerm, setExpandedTerm] = useState(null);

  const t = T[lang];

  useEffect(() => {
    document.title = `${t.title} | ${t.subtitle}`;
  }, [lang, t]);

  const sortedBanks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...banks]
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
  }, [banks, tenor, searchQuery, filterType, sortBy, lang]);
 
  const calcReturn = (rate) => {
    if (!rate || !amount) return 0;
    const n = Number(rate) / 100;
    if (isCompound) {
      const times = { '1m': 12, '3m': 4, '6m': 2, '12m': 1 }[tenor];
      return Math.floor(amount * (Math.pow(1 + n / times, times) - 1));
    } else {
      const m = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 }[tenor];
      return Math.floor(amount * n * m);
    }
  };

  const InfoSection = ({ icon: Icon, title, points, description, bgColor, accentColor, link, linkText }) => (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
      <div className={`${bgColor} p-6 text-white flex items-center gap-4`}>
        <Icon size={24} />
        <h2 className="text-xl font-black">{title}</h2>
      </div>
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
          {description}
          {link && (
            <a href={link} target="_blank" className={`inline-flex items-center gap-2 mt-4 font-black ${accentColor.replace('text', 'hover:text')} underline decoration-2 underline-offset-4`}>
              {linkText} <ExternalLink size={14}/>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  const Classroom = () => {
    const c = lang === 'zh_TW' ? {
      h1: '定期存款 101 入門課',
      t1: '什麼是定存？', t1p: ['租錢給銀行', '固定利息收益', '保本理財基石'],
      t1d: '定存是將資金鎖定一段存期，銀行則以此換取固定利率。這是 100% 保本理財的最佳起點。',
      t2: '虛擬銀行安全嗎？', t2p: ['金管局持牌', 'DPS 80萬保障', '監管標準一致'],
      t2d: '虛銀與傳統銀行一樣受金管局監管，並享有存款保障計劃每人每行最高 80 萬港元的保障。',
      t3: '利率迷思', t3p: ['資產門檻 (AUM)', '新資金定義', 'App 專享'],
      t3d: '高利率通常附帶條件：帳戶等級、新資金（需由他行轉入）或渠道限制。',
      t4: '匯率陷阱', t4p: ['點差損耗', '短存不利', '隱形成本'],
      t4d: '美金高息誘人，但 0.6% 的來回換匯點差可能在 3 個月內吞噬 60% 的額外利息利潤。'
    } : {
      h1: 'Fixed Deposit 101',
      t1: 'What is FD?', t1p: ['Rent Cash', 'Fixed Interest', 'Capital Safe'],
      t1d: 'FD is renting your money to the bank for a fixed tenor in exchange for guaranteed interest.',
      t2: 'Are Virtual Banks Safe?', t2p: ['Licensed', 'DPS (800k HKD)', 'HKMA Regulated'],
      t2d: 'Regulated by HKMA with statutory protection up to HKD 800,000 per bank.',
      t3: 'Rate Mystery', t3p: ['AUM Limits', 'New Funds', 'Mobile Only'],
      t3d: 'Top rates often require specific account tiers or fresh capital from other banks.',
      t4: 'FX Risk', t4p: ['FX Spread', 'Short Term', 'Hidden Costs'],
      t4d: 'USD spreads can eat up to 60% of your yield advantage on a 3-month term.'
    };
    return (
      <div className="space-y-6 pb-16 animate-in fade-in duration-300">
        <section className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-lg">
          <HelpCircle className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
          <h2 className="text-3xl font-black mb-2 tracking-tighter">{c.h1}</h2>
          <p className="text-blue-100 text-[12px] font-bold uppercase tracking-widest">Education starts from zero.</p>
        </section>
        <InfoSection icon={BookOpen} title={c.t1} bgColor="bg-blue-500" accentColor="text-blue-500" points={c.t1p} description={c.t1d} />
        <InfoSection icon={ShieldAlert} title={c.t2} bgColor="bg-slate-800" accentColor="text-slate-800" points={c.t2p} description={c.t2d} link="https://www.hkma.gov.hk/chi/smart-consumers/virtual-banks/" linkText={t.officialGuide} />
        <InfoSection icon={BadgePercent} title={c.t3} bgColor="bg-indigo-600" accentColor="text-indigo-600" points={c.t3p} description={c.t3d} />
        <InfoSection icon={Globe} title={c.t4} bgColor="bg-rose-600" accentColor="text-rose-600" points={c.t4p} description={c.t4d} />
      </div>
    );
  };

  const YieldMaster = () => {
    const getCalendarLink = () => {
      const end = new Date(); end.setMonth(end.getMonth() + 3);
      const iso = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=💰+定存到期提醒&details=立刻回網站查看最新利率：https://hk-bank-tracker.vercel.app&dates=${iso(end)}/${iso(end)}`;
    };

    const c = lang === 'zh_TW' ? {
      h1: '賺盡利息：致富大攻略',
      l1: '階梯式定存法 (The Ladder)',
      ld: '策略：將 30 萬拆成 3 份。每 3 個月您都有一筆錢到期。到期後續期為新的 12M。最終狀態：您每年享有 12M 的最高長息，但每 3 個月就有資金解鎖可用。',
      r1: '拒絕牌照利率 (Stop Rollover)',
      rd: '為什麼必須設置提醒？銀行利用客戶遺忘日期，預設進入自動轉展，利率低至 0.1%（比推廣息低 40 倍）。設置提醒，到期搬錢獲新資金資格，利潤翻倍。',
      hTitle: '定存跳槽技巧 (Bank Hopping)',
      hDesc: '最高年利率僅限「新資金」。A 銀定存到期變回舊資金後，應立即透過轉數快 (FPS) 或 CHATS 搬往 B 銀。B 銀會視此為新資金並給予高息。循環此法可保證資金永久處於高息狀態。',
      bTitle: '任務加息 (Bonus Boosters)',
      bDesc: '許多虛擬銀行提供「加息券」任務：例如消費滿 500 元、推薦好友或使用特定扣帳卡支付。善用這些任務，能讓 3% 的基礎利率瞬間提升至 4.5% 甚至更高。'
    } : {
      h1: 'Wealth Hacks: Yield Master',
      l1: 'The FD Ladder Strategy',
      ld: 'Split capital into tranches. Rollover into 12M every 3 months. Reach max yield with liquidity.',
      r1: 'Stop the Rollover Trap',
      rd: 'Banks profit from forgetfulness. Default Board Rate (~0.1%) is a 40x drop. Set reminders to reclaim control.',
      hTitle: 'Bank Hopping',
      hDesc: 'New Funds define your yield. When Bank A expires, transfer immediately via FPS or CHATS to Bank B for "New Fund" promos. Cycle back after 14-30 days.',
      bTitle: 'Bonus Boosters',
      bDesc: 'Complete mini-tasks (e.g. refer-a-friend, spending goals) to unlock rate booster coupons that add +1% or +2% to your base yield.'
    };

    return (
      <div className="space-y-8 pb-16 animate-in fade-in duration-300">
        <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl">
          <Zap className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
          <h2 className="text-4xl font-black mb-2 tracking-tighter">{c.h1}</h2>
          <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest">Maximize your cash returns.</p>
        </section>

        <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
           <div className="flex items-center gap-3 text-teal-600 mb-6 pb-3 border-b">
              <Layers size={24} />
              <h3 className="text-2xl font-black">{c.l1}</h3>
           </div>
           <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="flex flex-col gap-2 items-center font-black shrink-0">
                 <div className="w-14 h-7 bg-teal-100 rounded flex items-center justify-center text-[10px]">3M</div>
                 <div className="w-14 h-12 bg-teal-300 rounded flex items-center justify-center text-[10px]">6M</div>
                 <div className="w-14 h-20 bg-teal-600 rounded text-white flex items-center justify-center text-[10px]">12M</div>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium italic">{c.ld}</p>
           </div>
        </section>

        <InfoSection icon={TrendingUp} title={c.hTitle} bgColor="bg-indigo-600" accentColor="text-indigo-600" points={['轉數快 (FPS)', '大額 (CHATS)', '冷卻期重置']} description={c.hDesc} />
        <InfoSection icon={Gift} title={c.bTitle} bgColor="bg-amber-600" accentColor="text-amber-600" points={['推薦獎賞', '消費任務', '限時加息券']} description={c.bDesc} />

        <section className="bg-orange-50 border border-orange-100 p-10 rounded-[2.5rem] shadow-sm">
           <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-orange-200 pb-8 mb-8 text-orange-900">
              <div className="flex items-center gap-6">
                <CalendarPlus size={48} />
                <div className="space-y-2">
                   <h4 className="font-black text-2xl">{c.r1}</h4>
                   <p className="text-[12px] font-bold uppercase tracking-widest">一鍵同步手機日曆</p>
                </div>
              </div>
              <a href={getCalendarLink()} target="_blank" className="bg-orange-600 text-white px-12 py-5 rounded-2xl font-black text-base hover:bg-orange-700 transition-all shadow-lg active:scale-95"><CalendarPlus size={24}/> {t.calendarBtn}</a>
           </div>
           <p className="text-[14px] font-medium leading-relaxed text-orange-800">{c.rd}</p>
        </section>
      </div>
    );
  };

  const GlossaryPage = () => (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      <div className="bg-slate-100 rounded-[2.5rem] p-10 flex items-center justify-between shadow-inner">
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">金融詞彙百科 (Glossary)</h2>
        <GraduationCap size={64} className="text-slate-300 hidden md:block" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {GLOSSARY_DATA.map((item, i) => (
          <div key={item.id} className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-blue-400 transition-all group shadow-sm">
            <button onClick={() => setExpandedTerm(expandedTerm === i ? null : i)} className="w-full text-left focus:outline-none">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-blue-600 text-[16px] tracking-tight">
                  {lang === 'zh_TW' ? `${item.term_zh} (${item.term_en})` : item.term_en}
                </span>
                {expandedTerm === i ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
              </div>
              <p className="text-[13px] text-slate-500 font-bold leading-relaxed">{lang === 'zh_TW' ? item.zh_desc : item.en_desc}</p>
            </button>
            {expandedTerm === i && (
              <div className="mt-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-1">
                <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{t.exampleLabel}</p>
                <p className="text-[13px] text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl shadow-inner leading-relaxed">{lang === 'zh_TW' ? item.zh_ex : item.en_ex}</p>
                {item.link && (
                  <a href={item.link} target="_blank" className="inline-flex items-center gap-2 mt-4 text-[11px] font-black text-indigo-500 hover:text-indigo-600 uppercase border-b-2 border-transparent hover:border-indigo-100">{t.officialGuide} <ExternalLink size={12}/></a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setCurrentPage('dashboard')} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[14px] hover:bg-slate-800 transition-all shadow-lg active:scale-95">{t.backToDash}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans antialiased pb-20 selection:bg-blue-100">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setCurrentPage('dashboard')}>
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md group-hover:rotate-12 transition-transform"><TrendingUp size={20} /></div>
              <h1 className="text-[18px] font-black tracking-tighter leading-none hidden sm:block">{t.title}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-black text-[10px] uppercase tracking-widest">
              {Object.keys(t.nav).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg transition-all ${currentPage === page ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.nav[page]}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {['zh_TW', 'en'].map(l => (
                <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-6">
        <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-1 no-scrollbar font-black text-[10px] uppercase tracking-widest">
          {Object.keys(t.nav).map(page => (
            <button key={page} onClick={() => setCurrentPage(page)} className={`whitespace-nowrap px-5 py-2.5 rounded-full border-2 ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>{t.nav[page]}</button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-9">
            {currentPage === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-wrap gap-10 items-center shadow-sm">
                  <div className="flex-1 min-w-[220px]">
                    <label className="text-[12px] font-black text-slate-400 uppercase flex items-center gap-2 mb-2 tracking-widest"><Wallet size={16} className="text-blue-500" /> {t.amountLabel}</label>
                    <div className="flex items-center border-b-4 border-slate-50 focus-within:border-blue-500 transition-colors pb-2">
                      <span className="text-2xl font-black text-slate-300 mr-3">HK$</span>
                      <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-4xl font-black outline-none tabular-nums tracking-tighter" />
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <label className="text-[12px] font-black text-slate-400 uppercase flex items-center gap-2 mb-3 tracking-widest"><CalendarDays size={16} className="text-blue-500" /> {t.tenorLabel}</label>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-2">
                      {['1m', '3m', '6m', '12m'].map(m => (
                        <button key={m} onClick={() => setTenor(m)} className={`px-10 py-3 rounded-xl text-sm font-black transition-all ${tenor === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{m.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                   <div className="flex flex-wrap gap-3 items-center mb-2">
                    <div className="relative flex-1 min-w-[280px]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold outline-none text-[13px] shadow-sm focus:ring-4 focus:ring-blue-50" />
                    </div>
                    
                    {/* Re-added Sort Functionality */}
                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm gap-1">
                      <button onClick={() => setSortBy('rate')} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all flex items-center gap-2 ${sortBy === 'rate' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><SortAsc size={14}/> {t.sortRate}</button>
                      <button onClick={() => setSortBy('code')} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all ${sortBy === 'code' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>{t.sortCode}</button>
                    </div>

                    <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                      {[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (
                        <button key={v} onClick={() => setFilterType(v)} className={`px-5 py-2 text-[11px] font-black rounded-xl transition-all ${filterType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>{l}</button>
                      ))}
                    </div>
                    <button onClick={() => setIsCompound(!isCompound)} className={`p-3 rounded-2xl border transition-all ${isCompound ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-600'}`}><Calculator size={18} /></button>
                  </div>

                  {sortedBanks.map(bank => {
                    const r = bank.rates?.HKD?.[tenor];
                    const hasR = r != null && r > 0;
                    const belowMin = amount < bank.minDeposit;
                    return (
                      <div key={bank.id} className={`group bg-white rounded-3xl border border-slate-200 p-4 px-6 flex flex-wrap items-center gap-6 transition-all hover:shadow-xl hover:border-blue-300 ${belowMin ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className={`w-1.5 h-12 rounded-full ${bank.color} opacity-80 transition-opacity`}></div>
                        <div className="flex items-center gap-5 min-w-[320px] flex-1">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 p-2 border border-slate-100 flex items-center justify-center shrink-0 shadow-inner">
                            <img src={`https://www.google.com/s2/favicons?sz=64&domain=${bank.domain}`} className="w-full h-full object-contain" alt="" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-black text-[17px] tracking-tight text-slate-800">{lang === 'zh_TW' ? bank.name.zh : bank.name.en}</h3>
                              <span className="text-[11px] font-black px-2 py-1 bg-slate-100 text-slate-400 rounded-lg uppercase">{bank.stockCode}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                              <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 text-blue-500">{lang === 'zh_TW' ? bank.conditions.zh : bank.conditions.en}</span>
                              <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> Min: HK${bank.minDeposit.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8 md:gap-14 ml-auto">
                          <div className="text-right">
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.rateLabel}</p>
                            {hasR ? (
                              <p className="text-3xl font-black tabular-nums leading-none text-slate-900">{r.toFixed(3)}%</p>
                            ) : (
                              <p className="text-[11px] font-black text-blue-500 uppercase border-2 border-blue-50 px-3 py-1 rounded-xl">{t.contactBank}</p>
                            )}
                          </div>
                          <div className="text-right min-w-[130px]">
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.interestLabel}</p>
                            <p className={`text-2xl font-black tabular-nums leading-none ${hasR ? 'text-emerald-500' : 'text-slate-100'}`}>{hasR ? `+${calcReturn(r).toLocaleString()}` : '--'}</p>
                          </div>
                          <a href={bank.url} target="_blank" rel="noreferrer" className="p-4 bg-slate-50 text-slate-300 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm shrink-0"><ArrowUpRight size={20} /></a>
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

            <footer className="mt-12 p-10 bg-white rounded-[2.5rem] border border-slate-200 text-slate-500 text-[13px]">
              <div className="absolute top-0 right-0 p-10 opacity-[0.02] text-slate-900 rotate-12"><Scale size={200} /></div>
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4 text-slate-900 font-black uppercase tracking-widest text-base">
                  <AlertCircle size={24} className="text-blue-600" /> {t.disclaimerTitle}
                </div>
                <p className="text-[12px] font-semibold text-slate-400 leading-relaxed max-w-4xl border-l-4 border-slate-50 pl-8">
                  {t.disclaimerText}
                </p>
              </div>
              <div className="pt-8 mt-8 border-t border-slate-100 flex flex-wrap gap-x-12 gap-y-6 justify-between items-center text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">
                <div className="flex gap-8 items-center">
                  <a href="https://www.ifec.org.hk/" target="_blank" className="hover:text-blue-500 transition-colors">IFEC 投委會</a>
                  <a href="https://www.hkma.gov.hk/" target="_blank" className="hover:text-blue-500 transition-colors">HKMA 金管局</a>
                  <a href="https://www.dps.org.hk/" target="_blank" className="hover:text-blue-500 transition-colors">DPS 存保會</a>
                </div>
                <span className="flex items-center gap-3 font-bold uppercase tracking-widest">V12.0 Final Layout • {LAST_UPDATED_DATE} Update</span>
              </div>
            </footer>
          </div>

          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-8">
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-[2.5rem] p-6 flex flex-col items-center min-h-[600px] shadow-sm text-center">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">{t.adLabel}</p>
                <div className="w-full flex-1 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center p-6">
                  <span className="text-[12px] text-slate-300 font-black uppercase tracking-widest leading-relaxed">AdSense Vertical Skyscraper</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}