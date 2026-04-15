import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Search, SortAsc, CalendarDays, Wallet, ShieldCheck,
  ArrowUpRight, AlertCircle, Scale, BookOpen, CheckCircle2, 
  Calculator, ShieldAlert, Zap, CalendarPlus, GraduationCap, 
  ExternalLink, ChevronDown, ChevronUp, Layers, HelpCircle, Gift,
  Coins, BadgePercent, Activity, Clock, Smartphone, Target, Repeat, Globe, Users,
  BellRing, X, MousePointer2, Landmark, Check, Phone, RefreshCcw, Share2, Copy, Mail,
  ArrowDownAZ, MessageCircle, Link2
} from 'lucide-react';

// --- Global Date Constants ---
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

// --- Glossary Data ---
const GLOSSARY_DATA = [
  { 
    id: 'pa', 
    term_zh: '年利率 (Per Annum)', 
    term_en: 'Per Annum (p.a.)', 
    zh_desc: '以一年為基準計算的利息百分比。所有持牌銀行均須遵守 HKMA 《銀行營運守則》進行利率披露。', 
    en_desc: 'Standardized annual interest rate. Authorized Institutions must follow the HKMA Code of Banking Practice for disclosure.', 
    zh_ex: '標示 4% p.a. 代表存入 100 萬後，3 個月收息約 1 萬。', 
    en_ex: 'A 4% p.a. rate earns ~$10k on $1M principal over 3 months.' 
  },
  { 
    id: 'apy', 
    term_zh: '實際年回報 (APY)', 
    term_en: 'Annual Percentage Yield', 
    zh_desc: '考慮到複利效應後的真實年化收益率。詳情參閱 HKMA 關於有效年利率 (APR) 的指引。', 
    en_desc: 'The real rate of return including compound interest. Refer to HKMA guidelines on Annualised Percentage Rates (APR).', 
    zh_ex: '若每月派息並滾存，APY 會略高於標示的 p.a.。', 
    en_ex: 'Compounding monthly results in a higher APY than the quoted p.a.' 
  },
  { 
    id: 'hibor', 
    term_zh: 'HIBOR (同業拆息)', 
    term_en: 'HIBOR', 
    zh_desc: '香港銀行同業拆息，由財資市場公會 (TMA) 每日公佈，是本地貸款與存款定價的重要基準。', 
    en_desc: 'Hong Kong Interbank Offered Rate. Published daily by the TMA; it is a key benchmark for HKD pricing.', 
    zh_ex: '當 1M HIBOR 升至 5%，銀行通常會調高定存息以吸引資金。', 
    en_ex: 'Banks often hike FD rates when 1M HIBOR hits 5%.' 
  },
  { 
    id: 'dps', 
    term_zh: '存款保障計劃 (DPS)', 
    term_en: 'Deposit Protection (DPS)', 
    zh_desc: '根據法例，保障每名存款人在每家銀行最高獲賠 80 萬港幣。詳見香港存款保障委員會 (dps.org.hk)。', 
    en_desc: 'Statutory protection up to HKD 800,000 per depositor per bank. Managed by the HKDPB (dps.org.hk).', 
    zh_ex: '即使銀行結業，政府保證賠付首 80 萬本金及利息。', 
    en_ex: 'Statutory guarantee for the first 800k of your deposit.' 
  },
  { 
    id: 'base_rate', 
    term_zh: '基本利率 (Base Rate)', 
    term_en: 'Base Rate', 
    zh_desc: 'HKMA 用作計算貼現窗交易的貼現率。通常隨美國聯邦基金利率調整。詳見 HKMA 貨幣政策。', 
    en_desc: 'The base for determining the Discount Rate at HKMA. Usually follows the US Fed funds rate.', 
    zh_ex: '聯儲局加息後，HKMA 通常會立即同步上調基本利率。', 
    en_ex: 'HKMA adjusts the Base Rate in tandem with US Fed hikes.' 
  },
  { 
    id: 'lcr', 
    term_zh: '流動性覆蓋比率 (LCR)', 
    term_en: 'Liquidity Coverage Ratio', 
    zh_desc: '銀行須持有充足流動資產以應付 30 天壓力期。受 HKMA 《流動性規則》監管。', 
    en_desc: 'Requirement for banks to hold liquid assets for 30-day stress. Governed by HKMA Banking Rules.', 
    zh_ex: '季結時銀行為符合 LCR 要求，往往會大幅加息「搶錢」。', 
    en_ex: 'Banks hike rates at quarter-ends to meet LCR requirements.' 
  },
  { 
    id: 'linked_exchange', 
    term_zh: '聯繫匯率制度', 
    term_en: 'Linked Exchange Rate', 
    zh_desc: '將港元匯率固定在 7.75 至 7.85 兌 1 美元的範圍。詳見 HKMA 聯繫匯率簡介。', 
    en_desc: 'The system anchoring HKD to USD within 7.75-7.85. See HKMA Linked Exchange Rate System.', 
    zh_ex: '聯匯制度令港元利率大致跟隨美元利率走勢。', 
    en_ex: 'HKD rates generally follow USD trends due to the peg.' 
  },
  { 
    id: 'ncd', 
    term_zh: '可轉讓存款證 (NCD)', 
    term_en: 'Negotiable CD', 
    zh_desc: '可在二級市場買賣的定存產品，流動性高於一般定存。受持牌銀行發行。', 
    en_desc: 'A certificate of deposit that can be traded in secondary markets, issued by Authorized Institutions.', 
    zh_ex: '如需現款，可將 NCD 賣給其他投資者而毋須斷單罰息。', 
    en_ex: 'Sell your NCD to others if you need cash before maturity.' 
  },
  { 
    id: 'chats', 
    term_zh: '大額結算 (CHATS)', 
    term_en: 'CHATS', 
    zh_desc: '香港銀行同業即時支付系統，處理大額及具時效性的轉賬。由 HKICL 營運。', 
    en_desc: 'The RTGS system in HK for high-value interbank settlements. Operated by HKICL.', 
    zh_ex: '轉賬超過 100 萬時，CHATS 比 FPS 更適合處理大額結算。', 
    en_ex: 'Preferred for transfers >$1M upon deposit maturity.' 
  },
  { 
    id: 'mmf', 
    term_zh: '貨幣市場基金 (MMF)', 
    term_en: 'Money Market Fund', 
    zh_desc: '投資於短期債務工具的基金，追求流動性及利息。受 SFC 證監會監管。', 
    en_desc: 'Funds investing in short-term debt instruments. Governed by the SFC in Hong Kong.', 
    zh_ex: 'MMF 提供近似定存的息率，但資金到賬只需 T+0 或 T+1。', 
    en_ex: 'MMF offers FD-like yields with much higher liquidity.' 
  },
  { 
    id: 'capital_adequacy', 
    term_zh: '資本充足比率 (CAR)', 
    term_en: 'Capital Adequacy Ratio', 
    zh_desc: '衡量銀行資本與風險加權資產的比率。HKMA 根據《巴塞爾協定三》設定最低要求。', 
    en_desc: 'Measures bank capital against risk-weighted assets. Set by HKMA under Basel III standards.', 
    zh_ex: '高 CAR 代表銀行更穩健，但也可能限制其高息吸金的額度。', 
    en_ex: 'A high CAR indicates a safer bank with stronger buffers.' 
  },
  { 
    id: 'floating_rate', 
    term_zh: '浮動利率', 
    term_en: 'Floating Rate', 
    zh_desc: '隨基準利率（如 HIBOR 或 P-Rate）變動的利率。詳見 TMA 基準利率說明。', 
    en_desc: 'Interest rates that adjust with benchmarks like HIBOR. See TMA Benchmark references.', 
    zh_ex: '浮息存款可讓你在加息週期自動獲得更高回報。', 
    en_ex: 'Floating rate deposits increase your yield automatically during hikes.' 
  },
  { 
    id: 'p_rate', 
    term_zh: '最優惠利率 (P-Rate)', 
    term_en: 'Prime Rate', 
    zh_desc: '銀行自定的貸款基準利率，亦影響儲蓄利率。不同銀行有「大細 P」之分。', 
    en_desc: 'The benchmark lending rate set by individual banks, affecting savings rates too.', 
    zh_ex: '當銀行上調 P-Rate 時，通常代表低息環境結束。', 
    en_ex: 'A Prime Rate hike usually signals the end of low-interest eras.' 
  },
  { 
    id: 'new_fund_reset', 
    term_zh: '資金冷卻期', 
    term_en: 'Cooling-off Period', 
    zh_desc: '資金離開銀行後須存放於他行一段時間，才可再次定義為「新資金」。', 
    en_desc: 'The time funds must stay outside a bank to be considered "New Funds" again.', 
    zh_ex: '通常為 7 至 14 天。預先規劃冷卻期可最大化利息收入。', 
    en_ex: 'Properly planning this reset maximizes your yield.' 
  },
  { 
    id: 'tenor', 
    term_zh: '存款期 (Tenor)', 
    term_en: 'Tenor', 
    zh_desc: '定存合約的期限。銀行通常提供 1M, 3M, 6M, 12M 等標準期限。', 
    en_desc: 'The time duration of a deposit contract (e.g., 3-month or 12-month).', 
    zh_ex: '長存期通常提供較高息率，但會犧牲資金流動性。', 
    en_ex: 'Longer tenors usually offer higher yields but lock your cash.' 
  },
  { 
    id: 'effective_rate', 
    term_zh: '有效利率', 
    term_en: 'Effective Interest Rate', 
    zh_desc: '扣除行政費、換匯成本及考慮複利後的真實利息。建議使用 HKMA 計算器。', 
    en_desc: 'The true yield after fees, FX costs, and compounding. Check HKMA calculators.', 
    zh_ex: '10% 迎新息如果上限只有 1 萬港元，有效利率其實不高。', 
    en_ex: 'High promo rates on small caps result in low effective returns.' 
  },
  { 
    id: 'early_withdrawal', 
    term_zh: '提早提取罰息', 
    term_en: 'Early Withdrawal Penalty', 
    zh_desc: '未到期提取存款的處罰，通常包括沒收利息及扣除行政費。受銀行服務細則約束。', 
    en_desc: 'Penalties for breaking a deposit before maturity, often forfeiting all interest.', 
    zh_ex: '斷單可能導致拿回的金額少於本金，務必保留備用金。', 
    en_ex: 'Breaking an FD early can result in a loss of principal.' 
  },
  { 
    id: 'trb', 
    term_zh: '綜合總餘額 (TRB)', 
    term_en: 'Total Relationship Balance', 
    zh_desc: '你在銀行的總資產價值，包括存款、基金及保險，決定你的戶口等級。', 
    en_desc: 'The total value of assets held with a bank, determining your membership tier.', 
    zh_ex: '達標 TRB 可獲豁免月費並享受 VIP 專屬高息。', 
    en_ex: 'Meeting TRB levels unlocks VIP rates and waives fees.' 
  },
  { 
    id: 'fps', 
    term_zh: '轉數快 (FPS)', 
    term_en: 'Faster Payment System', 
    zh_desc: '香港即時小額轉賬系統，支援 24/7 跨行轉賬。詳見 HKMA 轉數快介紹。', 
    en_desc: 'HK\'s 24/7 instant transfer system for smaller amounts. See HKMA FPS site.', 
    zh_ex: '每日轉賬上限通常為 1 萬至 100 萬，視乎個人設定。', 
    en_ex: 'Daily limits vary between 10k to 1M depending on settings.' 
  },
  { 
    id: 'stale_rate', 
    term_zh: '牌照利率 (Board Rate)', 
    term_en: 'Board Rate', 
    zh_desc: '銀行基礎掛牌利率，通常極低。定存到期後若無指令，通常按此率續期。', 
    en_desc: 'Default base rate without promotions. Applies to auto-renewals on maturity.', 
    zh_ex: '牌照息通常僅為 0.1%，務必手動設置到期指示。', 
    en_ex: 'Board rates are often as low as 0.1%; avoid auto-rollovers.' 
  }
];

const T = {
  zh_TW: {
    nav: { dashboard: '利率看板', knowledge: '新手教室', strategies: '賺息大師', reminder: '到期提醒', glossary: '詞彙百科' },
    title: '港元定存比較',
    subtitle: '專業級手動監控版',
    all: '全部', trad: '傳統銀行', virt: '虛擬銀行',
    searchPlace: '搜尋銀行、代號或帳戶等級…',
    sortRate: '按利率', sortCode: '按編號', sortName: '按名稱',
    interestLabel: '回報', rateLabel: '年利率 p.a.',
    minDeposit: '起存', amountLabel: '預計存款金額',
    tenorLabel: '存期', bankTypeLabel: '銀行類型',
    tenorOptions: { all: '全部', '1m': '一個月', '3m': '三個月', '6m': '六個月', '12m': '十二個月' },
    fundOptions: { all: '全部', new: '新資金', old: '現有資金' },
    channelOptions: { all: '全部', app: '手機 App', web: '網上銀行', branch: '實體分行' },
    contactBank: '聯繫查詢', adLabel: '贊助商內容',
    disclaimerTitle: '法律免責聲明與風險披露',
    disclaimerText: '1. 資訊準確性: 本平台（「Hong Kong Fixed Deposit Rates Tracker」）所載之所有港元定期存款利率、條款及優惠資訊，均由人工從各銀行官網及公開渠道收集。儘管我們力求資訊準確及及時，惟利率市場變化迅速，本平台無法保證所有資訊均為即時更新或完全無誤。所有資料僅供參考。2. 非財務建議聲明: 本平台提供之資訊並不構成任何形式的投資建議、財務建議或要約。在作出任何財務決定前，用戶應自行諮詢專業財務顧問，並根據個人的財務狀況、投資目標及風險承受能力作出判斷。3. 銀行最終決定權: 實際利率、起存金額、新資金定義及優惠資格，均受各銀行最終條款及細則約束。銀行保留隨時更改利率或終止優惠之權利，而毋須另行通知。一切資訊以銀行最終批核為準。4. 風險披露: 提早提取風險：定期存款屬合約性質。若用戶在到期日前提取存款，銀行通常會沒收所有利息，並可能按市場利率收取手續費，這可能導致本金損失。匯率風險：若涉及外幣兌換（例如將美元兌換成港元作定存），匯率波動及買賣差價可能侵蝕，甚至超過利息收益。5. 存款保障計劃限制: 香港存款保障計劃為每位存款人在每家參與銀行提供最高 80 萬港元保障，包括本金及利息。用戶應注意，超出此限額之存款，在銀行結業時可能無法獲得全額賠付。6. 責任限制: 本平台及其營運者對於因使用或無法使用本平台資訊而產生之任何直接或間接損失，包括但不限於利潤損失或交易損失，概不承擔任何法律責任。',
    calendarBtn: '加入行事曆', pushBtn: '設置推送通知',
    backToDash: '返回看板', readMore: '展開完整解析', readLess: '收起詳細內容',
    compareBtn: '對比',
    splitterTitle: '💰 存款總額階梯建議 (DPS 強化安全版)',
    splitterDesc: '系統已自動為不同存期分配「不重複」銀行。點擊 X 可更換您沒有戶口的銀行：',
    fundAll: '資金來源', channelAll: '申請渠道',
    lockedLabel: '金額不足', exampleLabel: '💡 情境實例：', mythLabel: '🚫 常見迷思：', callCS: '聯繫熱線',
    dpsWarning: '已分散不同銀行以最大化保障',
    resetLadder: '重設建議', noAcc: '不合適 / 沒有戶口',
    remindBankLabel: '存入銀行', remindAmtLabel: '存款金額 (HK$)',
    remindRateLabel: '定存年利率 (%)', remindDateLabel: '到期日期',
    remindPlaceholder: '輸入或選擇銀行...',
    shareTitle: '分享此工具', copyLink: '複製連結', copySuccess: '連結已複製',
    shareMsg: '港元定存利率比較工具 - 幫你搵出全港最高息！',
    usefulLinks: '常用連結', inquiryEmail: '查詢電郵',
    seoDesc: {
        dashboard: '全港最齊港元定期存款利率比較，涵蓋滙豐、中銀、眾安等最新高息優惠。',
        knowledge: '定期存款入門教室：教你識別匯率陷阱、新資金定義與存保保障。',
        strategies: '賺息大師進階策略：階梯式定存、利差套利術與資金冷卻期全攻略。',
        reminder: '定存到期提醒工具：一鍵加入日曆，絕不錯過搬錢高息時機。',
        glossary: '金融理財詞彙百科：專業解釋年利率、複利、存保計劃。'
    },
    stratLabels: {
        hopper: '搬錢行事曆', arbitrage: '利差套利', sprint: '季結衝刺',
        tasks: '任務加息', pooling: '家族資金池', reinvest: '真複利',
        cd_play: '存款證', carry: '聯繫匯率', ladder_pro: '流動性階梯', sop: '防呆 SOP'
    }
  },
  en: {
    nav: { dashboard: 'Rates', knowledge: 'Classroom', strategies: 'Yield Master', reminder: 'Reminders', glossary: 'Glossary' },
    title: 'HKD FD Rate Tracker',
    subtitle: 'Pro Manual Version',
    all: 'All', trad: 'Trad', virt: 'Virt',
    searchPlace: 'Search...',
    sortRate: 'By Rate', sortCode: 'By Code', sortName: 'By Name',
    interestLabel: 'Return', rateLabel: 'Rate p.a.',
    minDeposit: 'Min', amountLabel: 'Deposit Amount',
    tenorLabel: 'Tenor', bankTypeLabel: 'Bank Type',
    tenorOptions: { all: 'All', '1m': '1M', '3m': '3M', '6m': '6M', '12m': '12M' },
    fundOptions: { all: 'All', new: 'New', old: 'Existing' },
    channelOptions: { all: 'All', app: 'App', web: 'Web', branch: 'Branch' },
    contactBank: 'Contact', adLabel: 'ADVERTISEMENT',
    disclaimerTitle: 'Disclaimer',
    disclaimerText: '1.	Accuracy of Information: All HKD time deposit rates, terms, and promotional information published on this platform (“Hong Kong Fixed Deposit Rates Tracker”) are manually collected from official bank websites and publicly available sources. While we strive to keep the information accurate and timely, the interest rate market changes rapidly, and this platform cannot guarantee that all information is updated in real time or is entirely free from error. All information is provided for reference only. 2. No Financial Advice: The information provided on this platform does not constitute any form of investment advice, financial advice, recommendation, or solicitation. Before making any financial decision, users should consult a qualified professional financial adviser and make their own judgment based on their personal financial situation, investment objectives, and risk tolerance. 3. Bank Discretion and Final Terms: Actual interest rates, minimum deposit requirements, definitions of new funds, and eligibility for promotional offers are subject to the final terms and conditions of the relevant banks. Banks reserve the right to change interest rates or withdraw promotions at any time without prior notice. All information is subject to the bank’s final approval and determination. 4. Risk Disclosure: Early Withdrawal Risk: Time deposits are contractual products. If a user withdraws funds before the maturity date, the bank will usually forfeit all accrued interest and may also charge administrative fees or impose penalties based on prevailing market conditions, which may result in a loss of principal. Exchange Rate Risk: If foreign currency conversion is involved, such as converting U.S. dollars into Hong Kong dollars for a deposit placement, exchange rate fluctuations and bid-ask spreads may reduce or even exceed the interest earned. 5. Deposit Protection Scheme Limitations: The Hong Kong Deposit Protection Scheme provides protection of up to HKD 800,000 per depositor per member bank, including both principal and interest. Users should note that any deposit amount exceeding this limit may not be fully reimbursed in the event of a bank failure. 6. Limitation of Liability: This platform and its operators shall not be liable for any direct or indirect loss arising from the use of, or inability to use, the information on this platform, including but not limited to loss of profit, loss of opportunity, or transaction-related loss.',
    calendarBtn: 'Calendar', pushBtn: 'Push',
    backToDash: 'Dashboard', readMore: 'Read More', readLess: 'Read Less',
    compareBtn: 'Compare',
    splitterTitle: '💰 Ladder Suggestion (DPS Safe Pro)',
    splitterDesc: 'Unique bank allocation. Click X to skip banks:',
    fundAll: 'Funds', channelAll: 'Channel',
    lockedLabel: 'Below Min', exampleLabel: '💡 Example:', mythLabel: '🚫 Myth:', callCS: 'Call Support',
    dpsWarning: 'Allocated across unique banks',
    resetLadder: 'Reset', noAcc: 'No Account',
    remindBankLabel: 'Bank', remindAmtLabel: 'Amount',
    remindRateLabel: 'Rate', remindDateLabel: 'Date',
    remindPlaceholder: 'Select Bank...',
    shareTitle: 'Share Tool', copyLink: 'Copy', copySuccess: 'Copied',
    shareMsg: 'Best HKD FD Rates - Find the highest yields!',
    usefulLinks: 'Useful Links', inquiryEmail: 'Inquiry',
    seoDesc: { dashboard: 'Rates', knowledge: 'Classroom', strategies: 'Master', reminder: 'Reminders', glossary: 'Glossary' },
    stratLabels: {
        hopper: 'Hopper', arbitrage: 'Arbitrage', sprint: 'Sprint',
        tasks: 'Tasks', pooling: 'Pooling', reinvest: 'Reinvest',
        cd_play: 'CDs', carry: 'Carry', ladder_pro: 'Ladder Pro', sop: 'SOP'
    }
  }
};

// --- Initial Bank Data ---
const INITIAL_BANKS = [
  { id: 'airstar', rates: { HKD: { '1m': 1.4, '3m': 2.1, '6m': 2.4, '12m': 2.7 } }, name: { zh: '天星', en: 'Airstar Bank' }, stockCode: 'VB01', domain: 'www.airstarbank.com', url: 'https://www.airstarbank.com/zh-hk/deposit.html', minDeposit: 1, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-blue-500', cs: '37181818' },
  { id: 'ant_retail', rates: { HKD: { '1m': 1.5, '3m': 1.8, '6m': 2.2, '12m': 2.5 } }, name: { zh: '螞蟻', en: 'Ant Bank' }, stockCode: 'VB02', domain: 'www.antbank.hk', url: 'https://www.antbank.hk/rates', minDeposit: 1, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-blue-950', cs: '23211888' },
  { id: 'bocom_hk_pref', rates: { HKD: { '1m': 2.5, '3m': 2.75, '6m': 2.75, '12m': 3.00 } }, name: { zh: '交通', en: 'Bank of Comm' }, stockCode: '3328', domain: 'www.hk.bankcomm.com', url: 'https://www.hk.bankcomm.com/hk/shtml/hk/en/2005742/2005763/2005764/list.shtml', minDeposit: 500000, type: 'trad', fundType: 'new', channel: 'web', color: 'bg-blue-800', cs: '22395559' },
  { id: 'bea_supremegold', rates: { HKD: { '1m': 1.5, '3m': 2.0, '6m': 2.2, '12m': 2.3 } }, name: { zh: '東亞 顯卓理財', en: 'BEA SupremeGold' }, stockCode: '0023', domain: 'www.hkbea.com', url: 'https://www.hkbea.com/html/zh/bea-personal-banking-supremegold-time-deposit.html', minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'any', color: 'bg-amber-600', cs: '22111333' },
  { id: 'bea_supreme', rates: { HKD: { '1m': 1.4, '3m': 1.95, '6m': 2.15, '12m': 2.25 } }, name: { zh: '東亞 至尊理財', en: 'BEA Supreme' }, stockCode: '0023', domain: 'www.hkbea.com', url: 'https://www.hkbea.com', minDeposit: 10000, type: 'trad', fundType: 'old', channel: 'any', color: 'bg-amber-500', cs: '22111333' },
  { id: 'bea_goal', rates: { HKD: { '1m': 1.4, '3m': 1.95, '6m': 2.15, '12m': 2.25 } }, name: { zh: '東亞 GOAL', en: 'BEA GOAL' }, stockCode: '0023', domain: 'www.hkbea.com', url: 'https://www.hkbea.com', minDeposit: 10000, type: 'trad', fundType: 'old', channel: 'any', color: 'bg-amber-400', cs: '22111888' },
  { id: 'boc', rates: { HKD: { '1m': 1.0, '3m': 1.25, '6m': 1.25, '12m': 1.5 } }, name: { zh: '中銀香港', en: 'BOC HK' }, stockCode: '2388', domain: 'www.bochk.com', url: 'https://www.bochk.com/tc/investment/rates/deposit.html', minDeposit: 1, type: 'trad', fundType: 'new', channel: 'branch', color: 'bg-red-800', cs: '39882388' },
  { id: 'ccb', rates: { HKD: { '1m': null, '3m': 2.2, '6m': null, '12m': null } }, name: { zh: '建行 (亞洲)', en: 'CCB (Asia)' }, stockCode: '0939', domain: 'www.asia.ccb.com', url: 'https://www.asia.ccb.com/hongkong/personal/accounts/dep_rates.html', minDeposit: 1000000, type: 'trad', fundType: 'new', channel: 'branch', color: 'bg-red-700', cs: '27353333' },
  { id: 'citi', rates: { HKD: { '1m': null, '3m': null, '6m': null, '12m': null } }, name: { zh: '花旗', en: 'CitiBank' }, stockCode: 'US:C', domain: 'www.citibank.com.hk', url: 'https://www.citibank.com.hk', minDeposit: 50000, type: 'trad', fundType: 'new', channel: 'web', color: 'bg-blue-700', cs: '28600333' },
  { id: 'dbs_treasures_new', rates: { HKD: { '1m': 1.4, '3m': 2.1, '6m': 1.95, '12m': 1.95 } }, name: { zh: '星展 豐盛(新)', en: 'DBS Treasures (N)' }, stockCode: 'D05.SI', domain: 'www.dbs.com.hk', url: 'https://www.dbs.com.hk/personal/promotion/OnlineTD-promo', minDeposit: 50000, type: 'trad', fundType: 'new', channel: 'web', color: 'bg-red-900', cs: '22908888' },
  { id: 'dbs_treasures_old', rates: { HKD: { '1m': 1.4, '3m': 2.1, '6m': 1.95, '12m': 1.95 } }, name: { zh: '星展 豐盛(現)', en: 'DBS Treasures (E)' }, stockCode: 'D05.SI', domain: 'www.dbs.com.hk', url: 'https://www.dbs.com.hk/personal/promotion/OnlineTD-promo', minDeposit: 50000, type: 'trad', fundType: 'old', channel: 'web', color: 'bg-red-800', cs: '22908888' },
  { id: 'fubon_500k', rates: { HKD: { '1m': 0.27, '3m': 2.35, '6m': 2.35, '12m': 2.5 } }, name: { zh: '富邦 (50萬)', en: 'Fubon (500k)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk/zh_hk/personal/deposit/time-deposit.html', minDeposit: 500000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-red-500', cs: '25668181' },
  { id: 'fubon_200k', rates: { HKD: { '1m': 0.27, '3m': 1.15, '6m': 1.15, '12m': 1.3 } }, name: { zh: '富邦 (20萬)', en: 'Fubon (200k)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk', minDeposit: 200000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-red-400', cs: '25668181' },
  { id: 'fubon_50k', rates: { HKD: { '1m': 0.75, '3m': 0.27, '6m': 0.27, '12m': 0.5 } }, name: { zh: '富邦 (5萬)', en: 'Fubon (50k)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk', minDeposit: 50000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-red-300', cs: '25668181' },
  { id: 'fubon_10k', rates: { HKD: { '1m': 1.95, '3m': 0.27, '6m': 0.27, '12m': 0.4 } }, name: { zh: '富邦 (1萬)', en: 'Fubon (10k)' }, stockCode: '0636', domain: 'www.fubonbank.com.hk', url: 'https://www.fubonbank.com.hk', minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-red-200', cs: '25668181' },
  { id: 'hangseng_perfer', rates: { HKD: { '1m': null, '3m': 2.2, '6m': 2.2, '12m': 2.2 } }, name: { zh: '恒生 優進理財', en: 'Hang Seng Preferred' }, stockCode: '0011', domain: 'www.hangseng.com', url: 'https://www.hangseng.com', minDeposit: 10000, type: 'trad', fundType: 'old', channel: 'any', color: 'bg-emerald-700', cs: '28220228' },
  { id: 'hsbc_premier_elite', rates: { HKD: { '1m': null, '3m': 2.2, '6m': 2.0, '12m': null } }, name: { zh: '滙豐 卓越尊尚', en: 'HSBC Premier Elite' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-rose-600', cs: '22333322' },
  { id: 'hsbc_elite', rates: { HKD: { '1m': null, '3m': 2.2, '6m': 2.0, '12m': null } }, name: { zh: '滙豐 卓越', en: 'HSBC Premier' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk/zh-hk/accounts/offers/deposits/', minDeposit: 10000, type: 'trad', fundType: 'new', channel: 'app', color: 'bg-rose-600', cs: '22333322' },
  { id: 'hsbc_one', rates: { HKD: { '1m': null, '3m': 2.2, '6m': 2.0, '12m': null } }, name: { zh: '滙豐 One', en: 'HSBC One' }, stockCode: '0005', domain: 'www.hsbc.com.hk', url: 'https://www.hsbc.com.hk', minDeposit: 10000, type: 'trad', fundType: 'old', channel: 'any', color: 'bg-rose-400', cs: '22333000' },
  { id: 'icbc_3m', rates: { HKD: { '1m': 1.6, '3m': 2.25, '6m': 2.25, '12m': 2.25 } }, name: { zh: '工銀 300萬+', en: 'ICBC 3M+' }, stockCode: '1398', domain: 'www.icbcasia.com', url: 'https://www.icbcasia.com', minDeposit: 3000000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-red-950', cs: '21895588' },
  { id: 'icbc_80k', rates: { HKD: { '1m': 1.5, '3m': 2.25, '6m': 2.25, '12m': 2.25 } }, name: { zh: '工銀 80萬+', en: 'ICBC 80K+' }, stockCode: '1398', domain: 'www.icbcasia.com', url: 'https://www.icbcasia.com', minDeposit: 800000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-red-900', cs: '21895588' },
  { id: 'icbc_50k', rates: { HKD: { '1m': 1.4, '3m': 2.10, '6m': 2.10, '12m': 2.10 } }, name: { zh: '工銀 50萬+', en: 'ICBC 50K+' }, stockCode: '1398', domain: 'www.icbcasia.com', url: 'https://www.icbcasia.com', minDeposit: 50000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-red-800', cs: '21895588' },
  { id: 'livi_50k', rates: { HKD: { '1m': 1.2, '3m': 2.0, '6m': 2.0, '12m': 2.0 } }, name: { zh: '理慧 (5萬+)', en: 'Livi (50k+)' }, stockCode: 'VB03', domain: 'www.livibank.com', url: 'https://www.livibank.com/zh_HK/features/livisave.html', minDeposit: 50000, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-blue-600', cs: '29833338' },
  { id: 'livi_500', rates: { HKD: { '1m': 0.5, '3m': 1.10, '6m': 1.3, '12m': 1.6 } }, name: { zh: '理慧 (500+)', en: 'Livi (500+)' }, stockCode: 'VB03', domain: 'www.livibank.com', url: 'https://www.livibank.com/zh_HK/features/livisave.html', minDeposit: 500, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-blue-400', cs: '29833338' },
  { id: 'mox_all', rates: { HKD: { '1m': null, '3m': 2.1, '6m': 2.2, '12m': 2.3 } }, name: { zh: 'Mox Bank', en: 'Mox Bank' }, stockCode: 'VB04', domain: 'www.mox.com', url: 'https://mox.com/zh/save/time-deposit/', minDeposit: 1, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-black', cs: '28088818' },
  { id: 'nanyang', rates: { HKD: { '1m': null, '3m': 1.0, '6m': 1.0, '12m': 1.0 } }, name: { zh: '南洋商業', en: 'Nan Yang' }, stockCode: 'NCB', domain: 'www.ncb.com.hk', url: 'https://www.ncb.com.hk/nanyang_bank/eng/html/14ac.html', minDeposit: 1, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-green-700', cs: '26222633' },
  { id: 'public_1', rates: { HKD: { '1m': 1.7, '3m': 1.95, '6m': 2.0, '12m': 2.2 } }, name: { zh: '大眾 (1+)', en: 'Public (1+)' }, stockCode: '0626', domain: 'www.publicbank.com.hk', url: 'https://www.publicbank.com.hk', minDeposit: 1, type: 'trad', fundType: 'old', channel: 'branch', color: 'bg-blue-800', cs: '81070818' },
  { id: 'public_10k', rates: { HKD: { '1m': 1.75, '3m': 2.0, '6m': 2.05, '12m': 2.25 } }, name: { zh: '大眾 (10萬+)', en: 'Public (10k+)' }, stockCode: '0626', domain: 'www.publicbank.com.hk', url: 'https://www.publicbank.com.hk', minDeposit: 100000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-blue-700', cs: '81070818' },
  { id: 'public_50k', rates: { HKD: { '1m': 1.8, '3m': 2.05, '6m': 2.10, '12m': 2.30 } }, name: { zh: '大眾 (50萬+)', en: 'Public (500k+)' }, stockCode: '0626', domain: 'www.publicbank.com.hk', url: 'https://www.publicbank.com.hk', minDeposit: 500000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-blue-600', cs: '81070818' },
  { id: 'sc', rates: { HKD: { '1m': null, '3m': 2.05, '6m': 1.95, '12m': 1.95 } }, name: { zh: '渣打銀行', en: 'Standard Chartered' }, stockCode: '2888', domain: 'www.sc.com', url: 'https://www.sc.com/hk/zh/deposits/online-time-deposit/', minDeposit: 10000, type: 'trad', fundType: 'old', channel: 'app/mob', color: 'bg-green-600', cs: '28868888' },
  { id: 'welab', rates: { HKD: { '1m': 0.5, '3m': 2.0, '6m': 2.24, '12m': 2.25 } }, name: { zh: '匯立 WeLab', en: 'WeLab Bank' }, stockCode: 'VB05', domain: 'www.welab.bank', url: 'https://www.welab.bank/en/feature/gosave_2/', minDeposit: 1, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-purple-600', cs: '38986988' },
  { id: 'za_new', rates: { HKD: { '1m': 0.1, '3m': 0.51, '6m': 1.61, '12m': 2.01 } }, name: { zh: '眾安 ZA Bank', en: 'ZA Bank' }, stockCode: 'VB06', domain: 'bank.za.group', url: 'https://bank.za.group/hk/deposit', minDeposit: 1, type: 'virt', fundType: 'new', channel: 'app', color: 'bg-teal-600', cs: '36653665' },
];

// --- Static Components ---
const BankLogo = ({ domain, id }) => (
  <img 
    src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} 
    className="w-8 h-8 rounded-lg border shadow-sm bg-white p-0.5 shrink-0" 
    alt="Logo" 
    onError={(e) => { e.target.src = "https://www.google.com/s2/favicons?sz=64&domain=hkma.gov.hk"; }}
  />
);

const RestrictionTag = ({ type, value, t }) => {
  const config = {
    fundType: { new: { label: t.fundOptions.new, icon: Zap, color: 'bg-orange-100 text-orange-600' }, old: { label: t.fundOptions.old, icon: Repeat, color: 'bg-blue-100 text-blue-600' } },
    channel: { app: { label: t.channelOptions.app, icon: Smartphone, color: 'bg-purple-100 text-purple-600' }, web: { label: t.channelOptions.web, icon: Globe, color: 'bg-teal-100 text-teal-600' }, branch: { label: t.channelOptions.branch, icon: Landmark, color: 'bg-slate-100 text-slate-600' }, any: { label: 'Any', icon: Check, color: 'bg-slate-50 text-slate-400' }, 'app/mob': { label: 'Mobile', icon: Smartphone, color: 'bg-purple-100 text-purple-600' } }
  };
  const item = config[type][value]; if (!item) return null;
  const Icon = item.icon;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${item.color}`}><Icon size={8} /> {item.label}</span>;
};

const InfoCard = ({ id, icon: Icon, title, scenario, points, description, bgColor, accentColor, isExpandable, fullContent, t, isExpanded, onToggle, isMyth }) => (
  <article id={id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm mb-6 transition-all hover:border-slate-300">
    <header className={`${bgColor} p-6 text-white flex items-center gap-4`}><Icon size={24} /><h2 className="text-xl font-black">{title}</h2></header>
    <div className="p-7 space-y-5">
      {scenario && <div className="bg-blue-50/50 p-4 rounded-2xl border-l-4 border-blue-400 italic text-[13px] text-slate-600"><strong>{isMyth ? t.mythLabel : t.exampleLabel}</strong> {scenario}</div>}
      <div className="flex flex-wrap gap-2">{points.map((p, i) => (<span key={i} className="bg-slate-50 p-2 px-3 rounded-xl flex items-center gap-2 text-[11px] font-black text-slate-700 shadow-sm border border-slate-100"><CheckCircle2 size={14} className={accentColor}/> {p}</span>))}</div>
      <p className="text-[14px] text-slate-600 leading-relaxed font-medium">{description}</p>
      {isExpandable && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <button onClick={onToggle} className={`flex items-center gap-2 font-black text-[12px] ${accentColor}`}>{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {isExpanded ? t.readLess : t.readMore}</button>
          {isExpanded && <div className="mt-4 p-6 bg-slate-50 rounded-2xl text-[14px] text-slate-700 leading-loose animate-in slide-in-from-top-2 shadow-inner border border-slate-100 whitespace-pre-wrap">{fullContent}</div>}
        </div>
      )}
    </div>
  </article>
);

// --- New Ad Placeholder Component ---
const AdSensePlaceholder = ({ type, className = "" }) => (
  <div className={`bg-slate-50 border border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center text-slate-400 p-4 overflow-hidden ${className}`}>
    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Advertisement</span>
    <div className="flex flex-col items-center text-center gap-1">
      <BadgePercent size={20} className="opacity-30" />
      <span className="text-[9px] font-bold">Google AdSense Slot</span>
      <span className="text-[8px] opacity-40">
        {type === 'sidebar' ? '300 x 600 Skyscraper' : 'Responsive Leaderboard'}
      </span>
    </div>
  </div>
);

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [lang, setLang] = useState('zh_TW');
  const [tenor, setTenor] = useState('3m');
  const [amount, setAmount] = useState(1000000);
  const [filterType, setFilterType] = useState('all');
  const [fundFilter, setFundFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rate'); 
  const [expandedStrategies, setExpandedStrategies] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [excludedBankIds, setExcludedBankIds] = useState(new Set()); 
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Reminder State
  const [remindAmt, setRemindAmt] = useState(1000000);
  const [remindBank, setRemindBank] = useState("");
  const [remindDate, setRemindDate] = useState("");
  const [remindRate, setRemindRate] = useState(4.0);
  const [expandedTerm, setExpandedTerm] = useState(null);

  const t = T[lang];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = useMemo(() => {
    return currentTime.toLocaleString(lang === 'zh_TW' ? 'zh-HK' : 'en-HK', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long', hour12: false
    });
  }, [currentTime, lang]);

  useEffect(() => {
    const pageTitle = `${t.title} - ${t.nav[currentPage]} | ${t.subtitle}`;
    document.title = pageTitle;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.name = 'description'; document.head.appendChild(metaDesc); }
    metaDesc.content = t.seoDesc[currentPage];
    document.documentElement.lang = lang === 'zh_TW' ? 'zh-Hant-HK' : 'en-HK';
  }, [lang, currentPage, t]);

  const reminderBankList = useMemo(() => {
    const seenNames = new Set();
    const list = [];
    INITIAL_BANKS.forEach(b => {
      const name = lang === 'zh_TW' ? b.name.zh : b.name.en;
      const cleanName = name.replace(/\s*\([\d萬\+一-龥k\+]*\)/g, '').trim();
      if (!seenNames.has(cleanName)) { seenNames.add(cleanName); list.push(cleanName); }
    });
    return list.sort();
  }, [lang]);

  const ladderSuggestion = useMemo(() => {
    const slots = ['1m', '3m', '6m', '12m'];
    const tranche = amount / slots.length;
    const selected = {};
    const usedInThisCalculation = new Set(); 
    slots.forEach(s => {
      const candidates = INITIAL_BANKS
        .filter(b => tranche >= b.minDeposit && b.rates.HKD[s] !== null && !excludedBankIds.has(b.id) && !usedInThisCalculation.has(b.id)) 
        .sort((a, b) => (b.rates.HKD[s] || 0) - (a.rates.HKD[s] || 0));
      const best = candidates[0];
      if (best) { selected[s] = best; usedInThisCalculation.add(best.id); } 
      else {
        const fallback = INITIAL_BANKS.filter(b => tranche >= b.minDeposit && b.rates.HKD[s] !== null && !excludedBankIds.has(b.id)).sort((a, b) => (b.rates.HKD[s] || 0) - (a.rates.HKD[s] || 0))[0];
        if (fallback) selected[s] = fallback;
      }
    });
    return selected;
  }, [amount, excludedBankIds]);

  const displayRows = useMemo(() => {
    let rows = [];
    const q = searchQuery.toLowerCase();
    INITIAL_BANKS.forEach(bank => {
        const name = lang === 'zh_TW' ? bank.name.zh : bank.name.en;
        if (!name.toLowerCase().includes(q) && !bank.stockCode.toLowerCase().includes(q)) return;
        if (filterType !== 'all' && bank.type !== filterType) return;
        if (fundFilter !== 'all' && bank.fundType !== fundFilter) return;
        if (channelFilter !== 'all' && bank.channel !== channelFilter && bank.channel !== 'any' && !(bank.channel === 'app/mob' && channelFilter === 'app')) return;

        if (tenor === 'all') {
            Object.entries(bank.rates.HKD).forEach(([tnr, rate]) => { if (rate !== null) rows.push({ ...bank, currentTenor: tnr, currentRate: rate }); });
        } else {
            const r = bank.rates.HKD[tenor]; if (r !== null) rows.push({ ...bank, currentTenor: tenor, currentRate: r });
        }
    });
    return rows.sort((a, b) => {
        if (sortBy === 'rate') return b.currentRate - a.currentRate;
        if (sortBy === 'code') return a.stockCode.localeCompare(b.stockCode);
        return (lang === 'zh_TW' ? a.name.zh : a.name.en).localeCompare(lang === 'zh_TW' ? b.name.zh : b.name.en);
    });
  }, [tenor, searchQuery, filterType, fundFilter, channelFilter, sortBy, lang]);

  const calcReturn = (rate, amt = amount, tnr) => {
    if (!rate || !amt) return 0;
    const m = { '1m': 1/12, '3m': 0.25, '6m': 0.5, '12m': 1 }[tnr];
    return Math.floor(amt * (rate / 100) * m);
  };

  const handleShare = (p) => {
    const url = window.location.href;
    if (p === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(t.shareMsg + ' ' + url)}`);
    else if (p === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    else if (p === 'email') window.open(`mailto:?subject=${encodeURIComponent(t.title)}&body=${encodeURIComponent(t.shareMsg + ' ' + url)}`);
    else if (p === 'wechat' || p === 'copy') { 
        const el = document.createElement('textarea'); el.value = t.shareMsg + ' ' + url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        alert(t.copySuccess);
    }
    setIsShareOpen(false);
  };

  // --- Content Generators ---
  const knowledgeContent = [
    { id: 'fx', icon: Coins, label: lang === 'zh_TW' ? '匯率陷阱' : 'FX Trap', color: 'bg-amber-500', title: lang === 'zh_TW' ? '匯率陷阱 (FX Trap)' : 'Exchange Rate Trap', scenario: lang === 'zh_TW' ? '「美金定存息有 5 厘，港元得 4 厘，梗係換晒美金去存啦！」' : 'USD rates are 5%, HKD is 4%, let\'s swap all to USD!', points: lang === 'zh_TW' ? ['買賣價差損耗', '匯價波動風險', '隱形成本計算'] : ['Spread Costs', 'FX Volatility', 'Hidden Costs'], desc: lang === 'zh_TW' ? '外幣高息往往伴隨著換匯損耗。如果存期過短，賺到的利息差可能連換匯點差都不夠支付。' : 'High foreign yields often come with exchange spread costs.', full: lang === 'zh_TW' ? '銀行買賣美金的差價（Spread）通常在 50-100 點子之間。這意味著當你將港元換成美金，再在到期後換回港元，本金已經損耗了約 0.6%-1%。如果你只存 3 個月，額外的 1% 年息（即 0.25% 實際利息）完全無法彌補這部分的換匯成本。除非您本身持有外幣現金，否則「為加息而換匯」在短期內通常是虧損的。' : 'Bank spreads consume up to 1% of principal. Gains are often net negative.' },
    { id: 'myth', icon: BadgePercent, label: lang === 'zh_TW' ? '利率迷思' : 'Rate Myth', color: 'bg-indigo-500', title: lang === 'zh_TW' ? '利率迷思 (Myth Buster)' : 'Rate Myths', isMyth: true, scenario: lang === 'zh_TW' ? '看到廣告標題寫著「10% 特高定存息」，滿心歡喜準備投入 100 萬。' : 'Ad says 10% interest! I have $1M ready to go.', points: lang === 'zh_TW' ? ['上限門檻限制', '階梯派息陷阱', '產品捆綁銷售'] : ['Deposit Caps', 'Tiered Payouts', 'Bundled Sales'], desc: lang === 'zh_TW' ? '超高利率通常附帶嚴苛條件，如僅限首 1 萬元、需購買保險，或採用平均利率極低的階梯計息。' : 'Ultra-high rates always have strings attached.', full: lang === 'zh_TW' ? '市場上常見的 10% 利率，往往只適用於開戶首星期的「首 1 萬港元」，實際利息僅約 20 元。另一種陷阱是階梯式派息：第一個月 1%，最後一個月才給 10%，平均年利率（Effective Rate）其實只有 4% 左右。務必確認「最高存款限額」與「行政費」。' : 'Ad rates apply to small caps. Effective yield is usually ~4%.' },
    { id: 'newfund', icon: Activity, label: lang === 'zh_TW' ? '新資金' : 'New Fund', color: 'bg-blue-500', title: lang === 'zh_TW' ? '新資金判定邏輯' : 'New Fund Rules', scenario: lang === 'zh_TW' ? '「我琴日先開咗張 100 萬定存，今日到期拎番出黎再存，應該算新資金啦？」' : 'I just finished a $1M FD today. If I open a new one tomorrow, it counts as new funds, right?', points: lang === 'zh_TW' ? ['總結餘對比法', '特定參考日期', '搬錢冷卻期'] : ['Balance Growth', 'Reference Date', 'Cooling-off'], desc: lang === 'zh_TW' ? '新資金是指在銀行內淨增加的資產。單純在同一銀行內「舊轉新」並不符合定義。' : 'New funds represent a net increase in your total balance.', full: lang === 'zh_TW' ? '銀行通常以「今日總結餘」減去「上月底參考日結餘」作為新資金標準。如果你將 100 萬從 A 行轉去 B 行，B 行會視為新資金；但如果你在 A 行內到期續存，結餘沒有增加，就只能享受極低的「現有資金」利率。專業操作是準備多個銀行戶口，到期後將錢轉出，等待下一個參考日後再轉回。' : 'Internal transfers do not count. Pro-savers rotate between 2-3 banks.' },
    { id: 'early', icon: ShieldAlert, label: lang === 'zh_TW' ? '提早提取' : 'Early Break', color: 'bg-red-500', title: lang === 'zh_TW' ? '提早提取的代價' : 'Withdrawal Penalty', scenario: lang === 'zh_TW' ? '存了 12 個月定存後第 6 個月急需用錢，心想：「大不了沒收這半年的利息吧。」' : 'I\'ll just lose the interest if I break it early.', points: lang === 'zh_TW' ? ['利息全額沒收', '行政手續費', '本金損耗風險'] : ['Interest Loss', 'Admin Fees', 'Principal Risk'], desc: lang === 'zh_TW' ? '提早提取除了沒收利息，銀行還有權收取基於拆息計算的手續費，可能導致本金損失。' : 'Breaking an FD is a contract breach with severe financial penalties.', full: lang === 'zh_TW' ? '罰金往往基於當前的 HIBOR 拆息計算。如果你存入時利率是 4%，現在市場升到 5%，銀行因為要填補你撤走的這筆錢而產生了額外成本，這筆「利差損失」會從你的本金中扣除。在極端情況下，你拿回的錢會少於當初存入的本金。' : 'If market rates rose, replacement costs are deducted from principal.' },
    { id: 'dps_pro', icon: ShieldCheck, label: lang === 'zh_TW' ? '存保疊加' : 'DPS Multi', color: 'bg-emerald-500', title: lang === 'zh_TW' ? '存保疊加策略' : 'DPS Stacking', scenario: lang === 'zh_TW' ? '「我有 240 萬現金，全部存入大型銀行最穩陣？」' : 'Is it safer to put $2.4M in one major bank?', points: lang === 'zh_TW' ? ['每人每行計', '政府法例保障', '虛擬銀行受保'] : ['Per Bank Limit', 'Legal Guarantee', 'VBs Covered'], desc: lang === 'zh_TW' ? 'DPS 保障每人在每間銀行最高 80 萬。透過分散銀行，可以將保障額度無限疊加。' : 'DPS covers 800k per person per bank.', full: lang === 'zh_TW' ? '這是風險管理的最高原則。由於 80 萬保障額是以「每間銀行」獨立計算，您可以將資金平均分在不同集團的銀行。這樣一旦銀行結業，您的本金連利息依然受到全額賠付保障。' : 'Spread 2.4M across 3 banks for 100% protection.' },
    { id: 'ladder_101', icon: Layers, label: lang === 'zh_TW' ? '階梯存法' : 'Laddering', color: 'bg-teal-500', title: lang === 'zh_TW' ? '階梯式存法' : 'Laddering Strategy', scenario: lang === 'zh_TW' ? '「我應存一年鎖定高息，定係存三個月等加息好？」' : 'One year for high rates or 3 months for hikes?', points: lang === 'zh_TW' ? ['流動性平衡', '長短息結合', '動態利率追蹤'] : ['Liquidity', 'Term Mixing', 'Tracking'], desc: lang === 'zh_TW' ? '透過時間差，讓你同時享有長期的特高利率，又保留了定期提款的靈活性。' : 'Balancing yield and accessibility.', full: lang === 'zh_TW' ? '將資金拆成四份，分別存入 3, 6, 9, 12 個月。當第一份到期時，再續存 12 個月。最終你會擁有四筆 12 個月單，且每 3 個月就有一筆錢到期。' : 'Stagger maturities to ensure quarterly cash availability.' },
    { id: 'fees_101', icon: Scale, label: lang === 'zh_TW' ? '管理費' : 'Fees', color: 'bg-slate-600', title: lang === 'zh_TW' ? '戶口等級與管理費' : 'Tier Account Fees', scenario: lang === 'zh_TW' ? '升級到「卓越理財」收 5 厘息，定存到期後就把錢搬走。' : 'Upgraded for high rates but forgot the monthly fee.', points: lang === 'zh_TW' ? ['低餘額附加費', '呆帳收費', '隱形成本侵蝕'] : ['Low Balance Fee', 'Dormancy', 'Hidden Costs'], desc: lang === 'zh_TW' ? '高端理財戶口通常有資產門檻。如果定存到期結餘不足，管理費會吃掉利息。' : 'Monthly fees can quickly wipe out interest profit.', full: lang === 'zh_TW' ? '某些帳戶月費高達 400 元。務必確保在提取定存後，該戶口仍能達標或及時降級，否則一年利息可能全交回銀行。' : 'Ensure you meet TRB requirements after withdrawal.' },
    { id: 'mmf_101', icon: Wallet, label: lang === 'zh_TW' ? '貨幣基金' : 'MMF', color: 'bg-rose-500', title: lang === 'zh_TW' ? '貨幣基金 vs 定存' : 'MMF vs FD', scenario: lang === 'zh_TW' ? '「想隨時買股票，但又想啲錢有息收？」' : 'I want liquidity and yield simultaneously.', points: lang === 'zh_TW' ? ['T+0 贖回', '每日計息', '非存保保障'] : ['Fast Redemption', 'Daily Yield', 'No DPS'], desc: lang === 'zh_TW' ? '貨幣市場基金是「隨買隨賣」的現金替代品。流動性極高。' : 'Instant liquidity Cash alternatives.', full: lang === 'zh_TW' ? '雖然利率與 1 個月定存接近，但它不保本且不受 DPS 保護。適合存放 7 天內可能動用的待命資金。' : 'Investment products tracking market rates.' },
    { id: 'hibor_101', icon: TrendingUp, label: lang === 'zh_TW' ? 'HIBOR' : 'HIBOR', color: 'bg-cyan-600', title: lang === 'zh_TW' ? 'HIBOR 與利息連動' : 'HIBOR Trends', scenario: lang === 'zh_TW' ? '「點解呢個禮拜間間銀行都加定存息？」' : 'Why are all banks raising rates this week?', points: lang === 'zh_TW' ? ['拆息趨勢導向', '季結搶錢月份', '預判手段'] : ['Benchmark Link', 'Quarterly Spikes', 'Prediction'], desc: lang === 'zh_TW' ? 'HIBOR 反映了銀行借錢的批發價。拆息上升，定存息也會隨後上調。' : 'HIBOR measures interbank borrowing costs.', full: lang === 'zh_TW' ? '觀察 1 個月 HIBOR 走勢是預判定存息最好的方法。特別是每年的 6 月 and 12 月年結，銀行會大幅調高利率美化報表。' : 'Track HIBOR to time your next placement.' },
    { id: 'rollover_101', icon: Clock, label: lang === 'zh_TW' ? '續期陷阱' : 'Rollover', color: 'bg-orange-600', title: lang === 'zh_TW' ? '自動續期的陷阱' : 'Rollover Trap', scenario: lang === 'zh_TW' ? '「懶得去整，由得佢自動續存算啦。」' : 'I\'ll just let it auto-renew, too much hassle.', points: lang === 'zh_TW' ? ['默認牌照利率', '手動操作必要', '閒置成本'] : ['Default Rate', 'Manual Renewal', 'Idle Cost'], desc: lang === 'zh_TW' ? '自動續期通常按極低的牌照利率計息。正確做法是到期轉回儲蓄再重新配置。' : 'Auto-renewals revert to baseline rates, 30x lower than promos.', full: lang === 'zh_TW' ? '銀行吸引你的是推廣利率（4.2%），續期則是牌照利率（0.1%）。務必選擇「到期後本息存入儲蓄戶口」。' : 'Always credit back to savings and re-shop.' }
  ];

  const strategiesContent = [
    { 
        id: 'hopper', 
        icon: CalendarPlus, 
        key: 'hopper', 
        label: lang === 'zh_TW' ? '搬錢行事曆' : 'Cooling-off Calendar', 
        color: 'bg-sky-500', 
        title: lang === 'zh_TW' ? '搬錢行事曆' : 'Cooling-off Calendar', 
        scenario: lang === 'zh_TW' ? '「我有 100 萬放在 A 銀行很久了，續期竟然只有 0.1%，點樣可以變返做『新資金』？」' : '“My $1M has been in Bank A for ages. The renewal is only 0.1%. How do I qualify for the high ‘New Fund’ rates again?”', 
        points: lang === 'zh_TW' ? ['新資金重置', '無縫銜接高息', '三行循環法'] : ['Reset Status', 'Seamless Flow', '3-Bank Rotation'], 
        desc: lang === 'zh_TW' ? '透過有序地移動資金，確保每一筆定存都符合銀行的「新資金」定義，以獲取較高的優惠利率。' : 'Move funds in a planned sequence to reset new-funds status and capture better promotional rates.', 
        full: lang === 'zh_TW' ? '絕大部分銀行的高息定存只適用於「新資金」。如果到期後直接在原銀行續存，利率通常會回落至牌價息。較有效的做法是建立一個搬錢時間表：在定存到期前兩天先準備另一家銀行戶口，到期當日立即透過轉數快或轉賬把本息轉走。由於不少銀行以 7 至 14 天作為參考窗口，只要資金離開一段時間後再流入，便有機會重新被視為新資金。若同時維持兩至三家主要銀行戶口，便可形成循環，提高整體定存回報。' : 'Most high-yield time deposit offers are limited to new funds. If you simply renew at the same bank on maturity, the rate usually falls back to the board rate. A more effective approach is to create a transfer calendar: prepare another bank account two days before maturity, then move the principal and interest out immediately on the maturity date through FPS or bank transfer. Since many banks apply a 7- to 14-day reference window, funds that leave and return later may qualify again as new funds. With two or three core bank accounts in rotation, savers can repeatedly access stronger promotional rates.' 
    },
    { 
        id: 'arbitrage', 
        icon: Zap, 
        key: 'arbitrage', 
        label: lang === 'zh_TW' ? '利差套利術' : 'Rate Arbitrage', 
        color: 'bg-yellow-500', 
        title: lang === 'zh_TW' ? '利差套利術' : 'Rate Arbitrage', 
        scenario: lang === 'zh_TW' ? '「銀行稅貸息率 1.8%，而定存息有 4%，即係可以『借錢生息』？」' : '“The tax loan rate is 1.8%, but deposits are paying 4%. Can I literally make money using the bank’s own cash?”', 
        points: lang === 'zh_TW' ? ['低息稅貸獲取', '高息定存套利', '現金流精確對沖'] : ['Cheap Tax Loans', 'Lump Sum Arbitrage', 'Cashflow Hedging'], 
        desc: lang === 'zh_TW' ? '利用銀行提供的極低息貸款獲取本金，投入高於貸款成本的定存單獲取純回報。' : 'Use low-interest personal or tax loans to fund high-yield FDs and earn the spread.', 
        full: lang === 'zh_TW' ? '這在每年的稅貸季節最為常見。若銀行提供低息貸款，而市場定存利率更高，兩者之間便形成可計算的利差收益。關鍵不在於單看利差，而在於管理每月還款壓力。由於貸款通常按月攤還，而定存多數到期才派息，若現金流安排不當，便可能出現流動性壓力。因此較穩妥的做法，是以穩定收入支付每月供款，或選擇按月派息產品來對沖資金流出。' : 'This is most common during tax-loan season. If a bank offers a low APR loan while market deposit rates are higher, the spread becomes a calculable gain. The real issue is not the spread itself, but cashflow management. Loans are usually repaid monthly, while many deposits pay only at maturity. If liquidity is not planned well, the strategy can create repayment pressure. A safer structure is to use stable monthly income for installments, or to choose products with monthly interest payouts to offset the outflow.' 
    },
    { 
        id: 'sprint', 
        icon: Target, 
        key: 'sprint', 
        label: lang === 'zh_TW' ? '季結衝刺策略' : 'Quarter-End Sprint', 
        color: 'bg-red-500', 
        title: lang === 'zh_TW' ? '季結衝刺策略' : 'Quarter-End Sprint', 
        scenario: lang === 'zh_TW' ? '「點解去到 6 月同 12 月底，銀行啲定存息會突然跳升 1 厘嘅？」' : '“Why do deposit rates suddenly spike by 1% in late June and late December every year?”', 
        points: lang === 'zh_TW' ? ['美化資產負債表', '半年結/年結快閃', '短年期極高息'] : ['Window Dressing', 'Quarterly Peaks', 'Flash Promo Timing'], 
        desc: lang === 'zh_TW' ? '銀行在每季末為了美化存款額度，往往推出只維持數天的快閃加息。' : 'Banks often raise rates sharply at quarter-end to improve their reported deposit base.', 
        full: lang === 'zh_TW' ? '這種現象常見於季度末、半年結或年結前後。銀行為了在結算時點前吸納更多存款，可能在最後一週推出限時高息優惠。這些優惠通常時間短、名額有限，有時更只限指定渠道或分行。對存戶而言，重點不是天天觀察，而是在關鍵月份的最後一週提高敏感度，並預先保留可隨時調動的資金。這是一種對時點要求很高的策略，執行速度往往比預測更重要。' : 'This often happens around quarter-end, half-year-end, or year-end. Banks may launch short-lived promotional rates in the final week to attract more deposits before reporting dates. These offers are usually brief, limited in quota, and sometimes restricted to certain channels or branches. For savers, the objective is not constant monitoring, but heightened attention during the final week of key months while keeping part of the portfolio liquid and ready to move. It is a timing strategy in which execution speed often matters more than forecasting.' 
    },
    { 
        id: 'tasks', 
        icon: Gift, 
        key: 'tasks', 
        label: lang === 'zh_TW' ? '任務加息最大化' : 'Quest Mastery', 
        color: 'bg-purple-500', 
        title: lang === 'zh_TW' ? '任務加息最大化' : 'Quest Mastery', 
        scenario: lang === 'zh_TW' ? '「虛擬銀行基礎息得 1%，點樣可以疊加『加息券』玩到廣告寫嘅 6%？」' : '“The base rate is only 1%. How do I stack ‘interest coupons’ to actually get that 6% advertised?”', 
        points: lang === 'zh_TW' ? ['消費任務觸發', '多重加息券並用', '存額上限分析'] : ['Spending Triggers', 'Coupon Stacking', 'Cap Analysis'], 
        desc: lang === 'zh_TW' ? '虛擬銀行經常透過任務和加息券設計高息機制，善用規則組合可明顯提升實際回報。' : 'Virtual banks often use tasks and coupons to build promotional yields, and careful sequencing can improve realized returns.', 
        full: lang === 'zh_TW' ? '虛擬銀行的最高利率通常並非單一固定利率，而是由基礎利率、任務回贈和優惠券疊加而成。要拿到最高回報，關鍵是先完成指定任務，例如簽賬、設定自動轉賬或維持結餘，再在優惠條件正式生效後存入資金。真正需要計算的是適用金額上限與有效期限，而不是只看宣傳中的最高年利率。這類產品通常較適合中小額資金，因為高息部分往往只適用於首幾萬或十幾萬港元。' : 'The headline yield offered by virtual banks is usually not a single rate, but a combination of base interest, task-based bonuses, and promotional coupons. To maximize return, the saver should complete the required actions first, such as spending, setting up autopay, or maintaining balances, and only then place funds after the boosted conditions become active. What must be calculated is the eligible balance cap and the duration of the bonus, rather than focusing only on the advertised top rate. These products are usually more suitable for small and medium balances because the highest yield often applies only to the first portion of deposits.' 
    },
    { 
        id: 'pooling', 
        icon: Users, 
        key: 'pooling', 
        label: lang === 'zh_TW' ? '家族資金池' : 'Yield Pooling', 
        color: 'bg-indigo-500', 
        title: lang === 'zh_TW' ? '家族資金池' : 'Yield Pooling', 
        scenario: lang === 'zh_TW' ? '「我得 10 萬，但我想享有 100 萬理財戶口先有嘅特高利率，有冇辦法？」' : '“I only have $100k, but I want the premium rates reserved for $1M account holders. Is there a way?”', 
        points: lang === 'zh_TW' ? ['AUM 共享效應', '聯名戶口優勢', '資產動態騰挪'] : ['Shared TRB', 'Joint Account Power', 'Wealth Shifting'], 
        desc: lang === 'zh_TW' ? '集合家族成員資金達到高端理財門檻，讓更多成員共享高層級客戶優惠。' : 'Pool family assets to reach premium banking thresholds and share relationship-tier benefits.', 
        full: lang === 'zh_TW' ? '不少傳統銀行容許聯名戶口或家庭關係下的資產共同計算，從而達到較高的總資產門檻。這代表即使個別成員名下資金不多，只要家庭整體資產達標，仍可能享有 Premier 或 Prestige 等高端客戶待遇，進一步開立較高息的定存產品。這種做法反映出，定存策略不只是個人決策，也可以是家庭資源配置的一部分。' : 'Many traditional banks allow assets in joint accounts or family-linked relationships to be counted together toward premium thresholds. This means that even if one individual holds only a modest balance, the household may still qualify for Premier or Prestige status if the combined assets are large enough. That status can then unlock better deposit offers. The broader lesson is that deposit strategy is not always an individual decision; it can also be structured at the household level.' 
    },
    { 
        id: 'reinvest', 
        icon: Repeat, 
        key: 'reinvest', 
        label: lang === 'zh_TW' ? '真複利循環' : 'Compound Loop', 
        color: 'bg-green-500', 
        title: lang === 'zh_TW' ? '真複利循環' : 'Compound Loop', 
        scenario: lang === 'zh_TW' ? '「點解我每個月收咗利息唔應該放喺儲蓄戶口，而係要『利滾利』？」' : '“Why should I immediately move my monthly interest out of savings to earn ‘interest on interest’?”', 
        points: lang === 'zh_TW' ? ['每月派息選項', 'MMF 滾存利滾利', '提升 APY 收益'] : ['Monthly Payouts', 'MMF Sweep', 'APY Optimization'], 
        desc: lang === 'zh_TW' ? '將定存派發的利息及早再投入其他可生息工具，可逐步提高實際年化回報。' : 'Reinvest interest as early as possible into another yield-bearing instrument to lift effective annual return.', 
        full: lang === 'zh_TW' ? '若定存產品容許按月派息，而不是等到期一次過收取，便可更早取得現金流。這些利息若只停留在低息活期戶口，複利效果非常有限；若即時轉入貨幣市場基金或其他短期生息工具，便能讓利息繼續產生利息。單次金額可能不大，但在較長時間 and 較大本金下，這種再投資會明顯提高實際 APY。這也是理解複利最具體的方法之一。' : 'If a deposit allows monthly interest payouts rather than a single payment at maturity, the saver gains earlier access to cashflow. If that interest simply sits in a low-yield savings account, the compounding effect is minimal. But if it is promptly swept into a money market fund or another short-term yield product, the interest itself begins to earn return. Each monthly amount may seem small, but over time and on larger principals, this reinvestment can materially increase effective APY. It is one of the clearest practical illustrations of compounding.' 
    },
    { 
        id: 'cd_play', 
        icon: Layers, 
        key: 'cd_play', 
        label: lang === 'zh_TW' ? '存款證戰術' : 'CD Strategy', 
        color: 'bg-cyan-500', 
        title: lang === 'zh_TW' ? '存款證戰術' : 'CD Strategy', 
        scenario: lang === 'zh_TW' ? '「想鎖定兩年高息，但驚中間要用錢，存款證 (CD) 可以點樣幫到我？」' : '“I want to lock in rates for 2 years but I’m scared I might need the cash. How do Certificates of Deposit help?”', 
        points: lang === 'zh_TW' ? ['二級市場流動性', '鎖定降息溢價', '靈活轉讓機制'] : ['Secondary Liquidity', 'Locking Premiums', 'Transferability'], 
        desc: lang === 'zh_TW' ? '利用可轉讓存款證的市場流動性，在利率下行時捕捉價格溢價。' : 'Use negotiable CDs to capture price premiums when market rates fall.', 
        full: lang === 'zh_TW' ? '傳統定存通常只能持有到期，若提前終止往往要承受罰息甚至損失部分收益。但可轉讓存款證不同，它本身具有市場交易屬性。若你在高利率時鎖定較長期的高息 CD，而之後市場利率下降，該 CD 的票息便相對吸引，可能在二級市場產生溢價。如此一來，投資者便不必死守到期，也可透過轉讓提早實現部分未來收益。' : 'Traditional fixed deposits are usually held to maturity, and early breakage often leads to penalties or lost interest. Negotiable certificates of deposit are different because they can have secondary-market value. If an investor locks in a relatively high long-term yield and market rates later fall, that CD becomes more attractive than newly issued instruments and may trade at a premium. As a result, the holder may realize future value earlier through sale rather than being forced to wait until maturity.' 
    },
    { 
        id: 'carry', 
        icon: Globe, 
        key: 'carry', 
        label: lang === 'zh_TW' ? '聯繫匯率套利' : 'FX Carry Trade', 
        color: 'bg-amber-500', 
        title: lang === 'zh_TW' ? '聯繫匯率套利' : 'FX Carry Trade', 
        scenario: lang === 'zh_TW' ? '「既然港美掛鉤，點樣可以利用美元高息路徑賺取額外 1% 嘅利差？」' : '“Since HKD is pegged to USD, how can I capture that extra 1% yield spread through dollar-path deposits?”', 
        points: lang === 'zh_TW' ? ['港美利差監控', '券商低成本換匯', '風險調整回報'] : ['Interest Differential', 'Low-cost FX', 'Risk-adjusted Return'], 
        desc: lang === 'zh_TW' ? '當美金利率顯著高於港元時，可透過低成本換匯路徑提高存款收益，但仍須考慮匯率與交易成本。' : 'When USD rates are much higher than HKD rates, low-cost conversion routes may improve yield, subject to FX and transaction costs.', 
        full: lang === 'zh_TW' ? '這個策略的核心不是單看美元利率較高，而是比較利差、換匯點差與匯率風險後的淨結果。若直接透過零售銀行換匯，買賣價差可能已侵蝕大部分收益，因此不少人會改用成本較低的券商渠道處理兌換，再把資金轉回銀行存款。雖然聯繫匯率制度令港元兌美元波動相對有限，但這不代表完全沒有風險。真正值得關注的是，扣除成本與風險後，額外利差是否仍然足以支持操作。' : 'The key is not simply that USD rates may be higher, but whether the extra yield remains attractive after conversion spreads and exchange-rate risk are considered. If funds are converted through retail banks, the bid-ask spread may already consume much of the gain, which is why some savers prefer lower-cost broker routes before placing deposits back with a bank. Although the HKD-USD peg reduces exchange-rate volatility, it does not eliminate all risk. The relevant question is whether the net spread remains worthwhile after costs and uncertainty are taken into account.' 
    },
    { 
        id: 'ladder_pro', 
        icon: TrendingUp, 
        key: 'ladder_pro', 
        label: lang === 'zh_TW' ? '流動性階梯模型' : 'Liquidity Ladder', 
        color: 'bg-emerald-500', 
        title: lang === 'zh_TW' ? '流動性階梯模型' : 'Liquidity Ladder', 
        scenario: lang === 'zh_TW' ? '「我有 200 萬，應該全部存入最高息嘅一年期，定係分開四份等錢隨時用得？」' : '“I have $2M. Should I put it all in a 1-year term for max yield, or split it into 4 parts for constant cash access?”', 
        points: lang === 'zh_TW' ? ['5-15-30-50 配置', '動態資產分配', '收益流動平衡'] : ['5-15-30-50 Model', 'Dynamic Allocation', 'Balance Management'], 
        desc: lang === 'zh_TW' ? '透過分段到期與多層配置，同時兼顧收益、流動性與再投資彈性。' : 'Use staggered maturities and layered allocation to balance yield, liquidity, and reinvestment flexibility.', 
        full: lang === 'zh_TW' ? '把所有資金一次過鎖在最長存期，雖然可能拿到當下最高利率，但也會失去面對市場變化的彈性。較穩健的做法是把資金分成不同部分，例如保留一部分現金和貨幣基金作流動性，再把其餘資金配置到短、中、長期定存。這樣一來，市場一旦出現更吸引的利率，總會有部分資金在短期內到期可供重新部署。階梯模型的價值不在追求單點最高回報，而在於把收益與靈活性一併納入管理。' : 'Locking all funds into the longest tenor may maximize today’s quoted rate, but it also removes flexibility when market conditions change. A more robust approach is to divide capital into several layers, keeping some in cash or money market funds for liquidity while placing the rest across short-, medium-, and long-term deposits. This ensures that some funds mature regularly and can be redeployed when more attractive opportunities appear. The value of the ladder is not chasing a single peak rate, but managing return and flexibility together.' 
    },
    { 
        id: 'sop', 
        icon: Clock, 
        key: 'sop', 
        label: lang === 'zh_TW' ? '防呆 SOP 清單' : 'Maturity SOP', 
        color: 'bg-slate-500', 
        title: lang === 'zh_TW' ? '防呆 SOP 清單' : 'Maturity SOP', 
        scenario: lang === 'zh_TW' ? '「定存聽日到期，我應該點樣做先可以確保一蚊利息空窗期都冇？」' : '“My deposit matures tomorrow. What exactly should I do to ensure zero ‘interest-free’ gaps?”', 
        points: lang === 'zh_TW' ? ['預先開立戶口', 'FPS 限額檢查', '日曆精確管理'] : ['Pre-opening Accounts', 'Limit Checks', 'Precision Scheduling'], 
        desc: lang === 'zh_TW' ? '建立標準流程可減少資金空窗期與操作失誤，讓到期日成為高效轉換日。' : 'A standard process reduces idle days and operational mistakes, turning maturity day into an efficient rollover event.', 
        full: lang === 'zh_TW' ? '許多定存回報流失並不是因為選錯銀行，而是因為執行過程出現失誤，例如忘記取消自動續期、未檢查 FPS 限額、或到期當天才開始尋找下一個去向。建立一套簡單而固定的 SOP，可以把整個流程前移，例如提早幾天確認目標銀行、檢查轉賬設定、安排提醒，並在到期日即時完成轉賬與新存單開立。這樣做的效果，是盡量縮短甚至消除零息空窗期。' : 'A large share of lost deposit return comes not from choosing the wrong bank, but from execution mistakes, such as forgetting to disable auto-renewal, failing to check FPS transfer limits, or only deciding on the next placement on maturity day. A simple and repeatable SOP shifts the work forward: confirm the destination bank a few days early, verify transfer settings, set reminders, and complete the rollover promptly on the maturity date. The result is a shorter, or even eliminated, zero-interest gap.' 
    }
];

  // --- Views ---
  const dashboardView = (
    <div className="space-y-4 animate-in fade-in">
      <section className="bg-blue-600 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Landmark size={120}/></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black tracking-tight">{t.splitterTitle}</h2><div className="flex items-center gap-2">{excludedBankIds.size > 0 && (<button onClick={() => setExcludedBankIds(new Set())} className="bg-white/10 hover:bg-white/30 px-3 py-1.5 rounded-lg text-[9px] font-black border border-white/20"><RefreshCcw size={10} className="inline mr-1"/> {t.resetLadder}</button>)}<span className="bg-white/20 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.dpsWarning}</span></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['1m', '3m', '6m', '12m'].map(tn => {
              const b = ladderSuggestion[tn]; if (!b) return null;
              const name = lang === 'zh_TW' ? b.name.zh : b.name.en;
              return (
                <div key={tn} className="group/card bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 relative">
                  <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-all cursor-pointer" onClick={() => setExcludedBankIds(prev => { const n = new Set(prev); n.add(b.id); return n; })}><X size={14} /></div>
                  <p className="text-[8px] font-black text-blue-200 uppercase mb-1">{tn.toUpperCase()} {t.bestReturn}</p>
                  <div className="flex items-center gap-2 mb-1"><BankLogo domain={b.domain} id={b.id} /><span className="font-black text-[11px] truncate">{name}</span></div>
                  <p className="text-xl font-black">{b.rates.HKD[tn]}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><Wallet size={20}/></div>
          <div className="flex-1 flex items-center border-b-2 border-slate-100 focus-within:border-blue-500 pb-1 transition-all"><span className="text-xl font-black text-slate-300 mr-2">HK$</span><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-transparent text-3xl font-black outline-none" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t.tenorLabel}</label><div className="flex bg-slate-50 p-1 rounded-xl gap-1">{Object.keys(t.tenorOptions).map(m => (<button key={m} onClick={() => setTenor(m)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black ${tenor === m ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>{t.tenorOptions[m]}</button>))}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t.fundAll}</label><div className="flex bg-slate-50 p-1 rounded-xl gap-1">{Object.keys(t.fundOptions).map(v => (<button key={v} onClick={() => setFundFilter(v)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black ${fundFilter === v ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400'}`}>{t.fundOptions[v]}</button>))}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t.channelAll}</label><div className="flex bg-slate-50 p-1 rounded-xl gap-1">{Object.keys(t.channelOptions).map(v => (<button key={v} onClick={() => setChannelFilter(v)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black ${channelFilter === v ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'}`}>{t.channelOptions[v]}</button>))}</div></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t.bankTypeLabel}</label><div className="flex bg-slate-50 p-1 rounded-xl gap-1">{[['all', t.all], ['trad', t.trad], ['virt', t.virt]].map(([v, l]) => (<button key={v} onClick={() => setFilterType(v)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black ${filterType === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>{l}</button>))}</div></div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder={t.searchPlace} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none text-[12px] shadow-sm" /></div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm gap-1">
              <button onClick={() => setSortBy('rate')} className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 ${sortBy === 'rate' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><SortAsc size={12}/> {t.sortRate}</button>
              <button onClick={() => setSortBy('code')} className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 ${sortBy === 'code' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><BadgePercent size={12}/> {t.sortCode}</button>
              <button onClick={() => setSortBy('name')} className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 ${sortBy === 'name' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><ArrowDownAZ size={12}/> {t.sortName}</button>
          </div>
          {compareIds.length > 0 && <button onClick={() => setIsCompareOpen(true)} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[12px] shadow-lg animate-pulse">{t.compareBtn} ({compareIds.length}/3)</button>}
      </div>

      <div className="space-y-1.5">
        {displayRows.map((row, idx) => {
          const r = row.currentRate; const belowMin = amount < row.minDeposit; const isSelected = compareIds.includes(row.id);
          const name = lang === 'zh_TW' ? row.name.zh : row.name.en;
          return (<article key={`${row.id}-${row.currentTenor}-${idx}`} className={`group bg-white rounded-xl border transition-all ${belowMin ? 'opacity-40 grayscale border-slate-50' : 'border-slate-200 hover:border-blue-300 shadow-sm'}`}>
              <div className="p-2 px-4 flex flex-nowrap items-center gap-4">
                <button disabled={belowMin} onClick={() => { if (isSelected) setCompareIds(compareIds.filter(id => id !== row.id)); else if (compareIds.length < 3) setCompareIds([...compareIds, row.id]); }} className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>{isSelected && <Check size={10}/>}</button>
                <div className={`w-1 h-8 rounded-full ${row.color} shrink-0`}></div>
                <div className="flex items-center gap-3 min-w-[200px] flex-1">
                  <BankLogo domain={row.domain} id={row.id} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-[13px] text-slate-800 truncate max-w-[110px]">{name}</h3>
                        <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow-sm whitespace-nowrap">{row.currentTenor.toUpperCase()}</span>
                    </div>
                    <div className="flex gap-1 items-center"><RestrictionTag type="fundType" value={row.fundType} t={t} /><RestrictionTag type="channel" value={row.channel} t={t} /></div>
                  </div>
                </div>
                <div className="hidden md:block text-slate-300 font-bold text-[9px] w-12 text-center shrink-0">{row.stockCode}</div>
                <div className="flex items-center gap-6 md:gap-10 shrink-0 ml-auto">
                    <div className="w-16 text-right leading-tight"><p className="text-[15px] font-black text-slate-900">{r.toFixed(3)}%</p></div>
                    <div className="w-24 text-right">{belowMin ? <span className="text-red-400 text-[9px] font-black uppercase leading-none block truncate"><AlertCircle size={9} className="inline mr-0.5"/> {t.lockedLabel}</span> : <p className="text-[14px] font-black text-emerald-500">+{calcReturn(r, amount, row.currentTenor).toLocaleString()}</p>}</div>
                    <div className="flex gap-1">
                        <a href={`tel:${row.cs}`} className="p-2 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-colors"><Phone size={14} /></a>
                        <a href={row.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 transition-colors"><ArrowUpRight size={14} /></a>
                    </div>
                </div>
              </div>
          </article>);
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans antialiased pb-20 selection:bg-blue-100">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
              <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-md"><TrendingUp size={22} /></div>
              <div className="space-y-0.5">
                  <h1 className="text-[18px] font-black tracking-tighter leading-none">{t.title}</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formattedTime}</p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl font-black text-[10px] uppercase tracking-widest">
              {Object.keys(t.nav).map(page => (<button key={page} onClick={() => setCurrentPage(page)} className={`px-4 py-2 rounded-lg transition-all ${currentPage === page ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.nav[page]}</button>))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div onClick={() => setIsShareOpen(!isShareOpen)} className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer"><Share2 size={18} /></div>
              {isShareOpen && (
                <div className="absolute top-12 right-0 bg-white border border-slate-200 shadow-2xl rounded-[2rem] p-5 min-w-[240px] animate-in zoom-in-95 z-[60]">
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest text-center">{t.shareTitle}</p>
                    <div className="grid grid-cols-1 gap-2">
                        <button onClick={() => handleShare('whatsapp')} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-2xl transition-colors text-[13px] font-black text-slate-700 text-left"><Smartphone size={16} className="text-emerald-500" /> WhatsApp</button>
                        <button onClick={() => handleShare('wechat')} className="flex items-center gap-3 w-full p-3 hover:bg-emerald-50 rounded-2xl transition-colors text-[13px] font-black text-slate-700 text-left"><MessageCircle size={16} className="text-emerald-600" /> WeChat</button>
                        <button onClick={() => handleShare('facebook')} className="flex items-center gap-3 w-full p-3 hover:bg-blue-50 rounded-2xl transition-colors text-[13px] font-black text-slate-700 text-left"><Globe size={16} className="text-blue-600" /> Facebook</button>
                        <button onClick={() => handleShare('email')} className="flex items-center gap-3 w-full p-3 hover:bg-red-50 rounded-2xl transition-colors text-[13px] font-black text-slate-700 text-left"><Mail size={16} className="text-red-500" /> Email</button>
                        <button onClick={() => handleShare('copy')} className="flex items-center gap-3 w-full p-3 hover:bg-slate-50 rounded-2xl transition-colors text-[13px] font-black text-slate-700 text-left"><Link2 size={16} className="text-slate-400" /> {t.copyLink}</button>
                    </div>
                </div>
              )}
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {['zh_TW', 'en'].map(l => (<button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{l === 'zh_TW' ? '繁' : 'EN'}</button>))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container with Sidebar logic */}
      <main className="max-w-[1600px] mx-auto px-6 pt-6 flex flex-col lg:flex-row gap-8">
        
        {/* Left Content Area (Responsive) */}
        <div className="flex-1 min-w-0">
          <div className="lg:hidden flex overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar font-black text-[10px] uppercase tracking-widest">
              {Object.keys(t.nav).map(page => (<button key={page} onClick={() => setCurrentPage(page)} className={`whitespace-nowrap px-5 py-2.5 rounded-full border-2 ${currentPage === page ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>{t.nav[page]}</button>))}
          </div>

          {currentPage === 'dashboard' && dashboardView}
          
          {currentPage === 'reminder' && (
            <div className="space-y-6 pb-16 animate-in fade-in">
              <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative shadow-lg"><BellRing className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" /><h2 className="text-3xl font-black mb-2 tracking-tighter">{t.nav.reminder}</h2><p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest opacity-80">{t.seoDesc.reminder}</p></section>
              <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.remindBankLabel}</label><input list="banks" placeholder={t.remindPlaceholder} value={remindBank} onChange={e => setRemindBank(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /><datalist id="banks">{reminderBankList.map(name => <option key={name} value={name} />)}</datalist></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.remindAmtLabel}</label><input type="number" value={remindAmt} onChange={e => setRemindAmt(Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.remindRateLabel}</label><input type="number" step="0.01" value={remindRate} onChange={e => setRemindRate(Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.remindDateLabel}</label><input type="date" value={remindDate} onChange={e => setRemindDate(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <a href={`https://www.google.com/calendar/render?action=TEMPLATE&text=💰+${t.nav.reminder}：${remindBank || 'Bank'}&details=${t.remindAmtLabel}：HK$${remindAmt.toLocaleString()}%0A${t.remindRateLabel}：${remindRate}%25&dates=${remindDate ? new Date(remindDate).toISOString().replace(/-|:|\\.\\d\\d\\d/g, "") : ""}/${remindDate ? new Date(remindDate).toISOString().replace(/-|:|\\.\\d\\d\\d/g, "") : ""}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white p-5 rounded-3xl font-black text-sm shadow-lg hover:bg-blue-700 transition-all"><CalendarPlus size={20} /> {t.calendarBtn}</a>
                  <button onClick={() => alert('Push Alert Set')} className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white p-5 rounded-3xl font-black text-sm shadow-lg hover:bg-slate-800 transition-all"><BellRing size={20} /> {t.pushBtn}</button>
                </div>
              </section>
            </div>
          )}

          {currentPage === 'knowledge' && (
            <div className="space-y-6 pb-16 animate-in fade-in">
              <section className="bg-blue-600 rounded-[2.5rem] p-10 text-white relative shadow-lg"><HelpCircle className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" /><h2 className="text-3xl font-black mb-2 tracking-tighter">{lang === 'zh_TW' ? '定期存款 101 入門課' : 'Fixed Deposit 101'}</h2><p className="text-blue-100 text-[12px] font-bold uppercase tracking-widest opacity-80">Everything you need to know.</p></section>
              <nav className="sticky top-14 z-40 px-6 py-4 bg-[#FDFDFF]/90 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar -mx-6"><div className="flex gap-3 min-w-max">{knowledgeContent.map(topic => (<button key={topic.id} onClick={() => document.getElementById(topic.id)?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"> {topic.label}</button>)) }</div></nav>
              <div className="mt-8">{knowledgeContent.map(item => (<InfoCard key={item.id} id={item.id} icon={item.icon} title={item.title} scenario={item.scenario} points={item.points} description={item.desc} bgColor="bg-blue-600" accentColor="text-blue-600" t={t} isExpanded={expandedStrategies[item.id]} onToggle={() => setExpandedStrategies(prev => ({...prev, [item.id]: !prev[item.id]}))} isExpandable={true} fullContent={item.full} isMyth={item.isMyth} />))}</div>
              <button onClick={() => setCurrentPage('dashboard')} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[14px] hover:bg-slate-800 transition-all">{t.backToDash}</button>
            </div>
          )}

          {currentPage === 'strategies' && (
  <div className="space-y-6 pb-16 animate-in fade-in">
    {/* Header Section */}
    <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative shadow-xl overflow-hidden">
      <Zap className="absolute top-0 right-0 p-10 opacity-10 rotate-12 w-48 h-48" />
      <div className="relative z-10">
        <h2 className="text-3xl font-black mb-2 tracking-tighter">
          {lang === 'zh_TW' ? '賺息大師：專業獲利系統' : 'Yield Master Pro'}
        </h2>
        <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest opacity-80">
          Advanced strategies to maximize your cash returns.
        </p>
      </div>
    </section>

    {/* Anchor Navigation */}
    <nav className="sticky top-14 z-40 px-6 py-4 bg-[#FDFDFF]/90 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar -mx-6">
      <div className="flex gap-3 min-w-max">
        {strategiesContent.map(s => (
          <button 
            key={s.id} 
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })} 
            className="px-4 py-2 bg-white border border-slate-200 rounded-full text-[11px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
          > 
            {t.stratLabels[s.key] || s.label}
          </button>
        ))}
      </div>
    </nav>

    {/* Content Cards */}
    <div className="mt-8">
      {strategiesContent.map((s, i) => (
        <InfoCard 
          key={s.id} 
          id={s.id} 
          icon={s.icon} 
          title={s.title} 
          scenario={s.scenario} 
          points={s.points} 
          description={s.desc} 
          isExpandable={true} 
          fullContent={s.full} 
          t={t} 
          isExpanded={expandedStrategies[s.id]} 
          onToggle={() => setExpandedStrategies(prev => ({...prev, [s.id]: !prev[s.id]}))} 
          // Alternating colors between Indigo and Emerald for a "Professional" feel
          bgColor={i % 2 === 0 ? "bg-indigo-600" : "bg-emerald-600"} 
          accentColor={i % 2 === 0 ? "text-indigo-600" : "text-emerald-600"} 
        />
      ))}
    </div>

    {/* Call to Action / Back Button */}
    <button 
      onClick={() => setCurrentPage('dashboard')} 
      className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[14px] hover:bg-slate-800 transition-all shadow-lg"
    >
      {t.backToDash}
    </button>
  </div>
)}

          {currentPage === 'glossary' && (
            <div className="space-y-6 pb-16 animate-in fade-in">
              <div className="bg-slate-100 rounded-[2.5rem] p-10 flex items-center justify-between shadow-inner"><h2 className="text-3xl font-black text-blue-800 tracking-tighter">{lang === 'zh_TW' ? '金融詞彙百科' : 'Financial Glossary'}</h2><GraduationCap size={64} className="text-slate-300 hidden md:block" /></div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {GLOSSARY_DATA.map((item, i) => (
                  <article key={item.id} className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-blue-400 transition-all group shadow-sm">
                    <button onClick={() => setExpandedTerm(expandedTerm === i ? null : i)} className="w-full text-left focus:outline-none">
                      <div className="flex items-center justify-between mb-2"><h3 className="font-black text-blue-600 text-[16px]">{lang === 'zh_TW' ? item.term_zh : item.term_en}</h3>{expandedTerm === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                      <p className="text-[13px] text-slate-500 font-bold leading-relaxed">{lang === 'zh_TW' ? item.zh_desc : item.en_desc}</p>
                      {expandedTerm === i && <div className="mt-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-1"><p className="text-[10px] font-black text-slate-400 mb-2 uppercase">{t.exampleLabel}</p><p className="text-[13px] text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl leading-relaxed">{lang === 'zh_TW' ? item.zh_ex : item.en_ex}</p></div>}
                    </button>
                  </article>
                ))}
              </div>
              <button onClick={() => setCurrentPage('dashboard')} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[14px] hover:bg-slate-800 transition-all">{t.backToDash}</button>
            </div>
          )}

          {/* Bottom Ad Slot */}
          <AdSensePlaceholder type="bottom" className="w-full h-24 sm:h-32 mt-8 mb-4" />

          <footer className="mt-4 p-10 bg-white rounded-[2.5rem] border border-slate-200 text-slate-500 text-[12px]">
              <div className="space-y-6">
                  <div className="flex items-center gap-4 text-slate-900 font-black uppercase text-base"><AlertCircle size={24} className="text-blue-600" /> {t.disclaimerTitle}</div>
                  <p className="border-l-4 border-slate-50 pl-6 leading-relaxed">{t.disclaimerText}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-4 text-slate-400 font-bold">
                      <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-500" /> {t.manualRetrieved}本站利率數據由人工收集。The rate data on this site is collected manually.</span>
                      <div className="flex items-center gap-2"><Mail size={16} className="text-blue-500" /> {t.inquiryEmail}: hongkongrates@gmail.com</div>
                  </div>
              </div>
              <div className="pt-8 mt-8 border-t flex flex-col gap-4">
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{t.usefulLinks}</p>
                  <div className="flex flex-wrap gap-4 items-center">
                      <a href="https://www.ifec.org.hk/" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl transition-all text-[11px] font-black"><ExternalLink size={12}/> IFEC 投委會</a>
                      <a href="https://www.hkma.gov.hk/" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl transition-all text-[11px] font-black"><ExternalLink size={12}/> HKMA 金管局</a>
                      <a href="https://www.dps.org.hk/" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl transition-all text-[11px] font-black"><ExternalLink size={12}/> DPS 存保會</a>
                  </div>
                  <div className="flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest pt-2">
                      <span className="ml-auto">Update: {LAST_UPDATED_DATE}</span>
                  </div>
              </div>
          </footer>
        </div>

        {/* Right-Side Ad Column (Desktop Only) */}
        <aside className="hidden lg:block w-[300px] shrink-0">
          <div className="sticky top-24 space-y-6">
            <AdSensePlaceholder type="sidebar" className="w-full h-[600px]" />
            
            {/* Optional support/promo box to fill space */}
            <div className="p-6 bg-slate-900 rounded-3xl text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Pro Tip</p>
              <p className="text-[13px] font-bold leading-relaxed opacity-90">
                Check our "Yield Master" section for advanced laddering strategies to protect your savings up to HK$2.4M.
              </p>
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}