/**
 * @module core/i18n
 */

const DICTIONARY = {
  ar: {
    // Categories
    cat_food: 'الطعام',
    cat_transport: 'المواصلات',
    cat_education: 'الدراسة',
    cat_internet: 'إنترنت واتصالات',
    cat_health: 'الصحة',
    cat_entertainment: 'الترفيه',
    cat_shopping: 'التسوق',
    cat_bills: 'فواتير',
    cat_other: 'أخرى',
    
    // Income Sources
    inc_salary: 'الراتب',
    inc_freelance: 'عمل حر',
    inc_business: 'أرباح مشاريع',
    inc_other: 'أخرى',

    // Investment Types
    inv_stocks: 'أسهم',
    inv_gold: 'ذهب',
    inv_realEstate: 'عقارات',
    inv_crypto: 'عملات رقمية',
    inv_savings: 'توفير',
    inv_other: 'أخرى',

    // Month Names
    month_0: 'يناير', month_1: 'فبراير', month_2: 'مارس', month_3: 'أبريل',
    month_4: 'مايو', month_5: 'يونيو', month_6: 'يوليو', month_7: 'أغسطس',
    month_8: 'سبتمبر', month_9: 'أكتوبر', month_10: 'نوفمبر', month_11: 'ديسمبر',

    // General Words
    currency: 'ج.م',
    date: 'التاريخ',
    amount: 'المبلغ',
    type: 'النوع',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    delete: 'حذف',
    yes: 'نعم',
    no: 'لا',
    add: 'إضافة',
    close: 'إغلاق',
    warning: 'تنبيه',
    confirm_delete: 'هل أنت متأكد من حذف هذا العنصر؟',

    // App Navigation
    nav_home: 'الرئيسية',
    nav_transactions: 'المعاملات',
    nav_analytics: 'التحليلات',
    nav_more: 'المزيد',

    // Dashboard & New Keys
    locale: 'ar-EG',
    greeting_am: 'صباح الخير',
    greeting_pm: 'مساء الخير',
    greeting_eve: 'مساء النور',
    dash_money_dist: 'توزيع الأموال',
    dash_recent_tx: 'آخر المعاملات',
    dash_view_all: 'عرض الكل',
    tx_search_placeholder: 'ابحث في المعاملات...',
    tx_all: 'الكل',
    tx_income: 'الدخل',
    tx_expenses: 'المصروفات',
    abbr_k: 'ك',
    chart_daily_spend: 'الإنفاق اليومي',
    balance: 'الرصيد',
    dash_net_balance: 'صافي الرصيد الشهري',
    dash_assets: 'الأصول',
    dash_liabilities: 'الالتزامات',
    dash_saving_rate: 'الادخار',
    dash_cash_flow: 'التدفق النقدي هذا الشهر',
    dash_income: 'دخل',
    dash_expenses: 'مصروفات',
    dash_spend_rate: 'من الدخل',
    dash_safe_spend: 'المبلغ الآمن للإنفاق اليومي',
    dash_smart_tip: 'نصيحة ذكية',
    dash_no_data: 'لا توجد بيانات كافية لإعطاء نصيحة هذا الشهر.',
    tip_no_data: 'لا توجد بيانات كافية لهذا الشهر. ابدأ بإضافة الدخل والمصروفات!',
    tip_budget_over: 'لقد تجاوزت الميزانية المحددة! راجع نفقاتك لتقليل العجز.',
    tip_excellent: 'أداؤك متميز! أنت تدخر جزءاً كبيراً من دخلك هذا الشهر.',
    tip_warning: 'احترس: معدل إنفاقك مرتفع جداً وقد لا يتبقى لك رصيد كافٍ.',
    tip_high_spend: 'الجزء الأكبر من أموالك ذهب إلى "__CAT__". تأكد أنه ضمن خطتك.',
    tip_good: 'توزيع أموالك يبدو متوازناً. استمر في متابعة ميزانيتك!',

    // Empty States
    empty_tx: 'لا توجد معاملات',
    empty_tx_sub: 'أضف دخل أو مصروف لتبدأ تتبع أموالك.',
    empty_debts: 'لا توجد ديون',
    empty_debts_sub: 'رائع! ليس لديك أي التزامات مالية حالياً.',
    empty_inv: 'لا توجد استثمارات',
    empty_inv_sub: 'ابدأ الاستثمار لزيادة ثروتك للمستقبل.',

    // Components
    comp_remaining: 'المتبقي',
    comp_paid: 'مدفوع',
    comp_roi: 'العائد',
    comp_capital: 'رأس المال',
    comp_profits: 'الأرباح',
    comp_total: 'الإجمالي',

    // Analytics
    stat_total_inc: 'إجمالي الدخل',
    stat_total_exp: 'إجمالي المصروفات',
    stat_net: 'صافي الرصيد',
    stat_total_debts: 'إجمالي الديون',
    stat_total_inv: 'إجمالي الاستثمارات',
    stat_saving_rate: 'نسبة الادخار',
    stat_budget_commitment: 'الالتزام بالميزانية',
    stat_health: 'مؤشر الصحة المالية',
    stat_chart_flow: 'تطور الرصيد خلال الشهر',
    stat_chart_cat: 'توزيع المصروفات على الفئات',
    stat_key_metrics: 'المقاييس المالية الرئيسية',
    health_excellent: 'حالة مالية ممتازة 🌟',
    health_critical: 'حالة حرجة - تحتاج لتقليل النفقات ⚠️',
    health_good: 'حالة جيدة - يمكن تحسين المدخرات 👍',

    // Budget
    budget_title: 'الميزانية الشهرية',
    budget_spent: 'مصروف',
    budget_remaining: 'متبقي',
    budget_over: 'تجاوز',

    // More Page
    more_debts: 'الديون',
    more_debts_sub: 'تتبع ديونك والأقساط المستحقة',
    more_inv: 'الاستثمارات',
    more_inv_sub: 'إدارة أصولك ومتابعة العوائد',
    more_budget: 'الميزانية',
    more_budget_sub: 'خطط لمصروفاتك الشهرية بدقة',
    more_settings: 'إعدادات النظام',
    more_theme: 'تبديل المظهر',
    more_theme_sub: 'الوضع الليلي / النهاري',
    more_lang: 'تغيير اللغة',
    more_lang_sub: 'التحويل للإنجليزية',
    more_export: 'تصدير البيانات',
    more_export_sub: 'حفظ نسخة احتياطية (JSON)',
    more_import: 'استيراد البيانات',
    more_import_sub: 'استعادة نسخة احتياطية (JSON)',
    more_print: 'طباعة التقرير',
    more_print_sub: 'طباعة ملخص الشهر الحالي',
    more_danger: 'منطقة الخطر',
    more_clear: 'مسح جميع البيانات',
    more_clear_sub: 'هذا الإجراء لا يمكن التراجع عنه!',

    // Toasts
    toast_added: 'تمت الإضافة بنجاح',
    toast_updated: 'تم التحديث بنجاح',
    toast_deleted: 'تم الحذف',
    toast_cleared: 'تم مسح جميع البيانات',
    toast_error: 'حدث خطأ ما',
    toast_lang: 'تم تغيير اللغة إلى العربية',
    toast_theme: 'تم تغيير المظهر',
    toast_invalid: 'يرجى إدخال بيانات صحيحة',

    // AI Advisor
    ai_advisor_title: 'المستشار المالي الذكي',
    ai_advisor_desc: 'تكوين ذكاء Gemini الاصطناعي',
    ai_generate_btn: 'اطلب نصيحة',
    ai_generating: 'جاري التحليل',
    ai_error_conn: 'حدث خطأ أثناء الاتصال بالخادم. تأكد من صحة المفتاح.',

    // Modals & Labels
    label_category: 'الفئة',
    label_notes: 'ملاحظات',
    label_source: 'المصدر',
    label_name: 'الاسم',
    label_total_amount: 'المبلغ الإجمالي',
    label_paid_amount: 'المبلغ المدفوع',
    label_due_date: 'تاريخ الاستحقاق',
    label_capital: 'رأس المال المستثمر',
    label_current_value: 'القيمة الحالية',

    // Extra components
    comp_debt_total: 'إجمالي الدين',
    comp_debt_rem: 'المبلغ المتبقي',
    comp_debt_paid: 'المدفوع',
    comp_debt_ratio: 'نسبة السداد',
    
    // Welcome Screen
    welcome_title: 'ميزانيتي',
    welcome_sub: 'إدارة أموالك بذكاء',
    welcome_loading: 'جاري التحميل...',

    // Notifications
    notif_title: 'الإشعارات',
    notif_mark_all: 'تعليم الكل كمقروء',
    notif_empty: 'لا توجد إشعارات',
    notif_clear_all: 'حذف الكل',
    notif_settings: 'إعدادات الإشعارات',
    notif_settings_sub: 'تفعيل تنبيهات الهاتف',
    notif_allow: 'تفعيل الإشعارات',
    notif_allow_sub: 'اسمح بإرسال تنبيهات عن الديون والميزانية حتى حين إغلاق التطبيق',
    notif_permission_granted: 'تم تفعيل الإشعارات بنجاح ✅',
    notif_permission_denied: 'تم رفض الإشعارات. يمكنك تغيير ذلك من إعدادات المتصفح',
    notif_debt_today_title: '⚠️ دين مستحق اليوم',
    notif_debt_soon_title: '📅 دين مستحق قريباً',
    notif_days_left: 'باقي',
    notif_days: 'أيام',
    notif_budget_over_title: '🔴 تجاوزت ميزانيتك!',
    notif_budget_over_body: 'لقد تجاوزت إنفاقك حد الدخل هذا الشهر. راجع مصروفاتك.',
    notif_budget_warn_title: '🟡 تنبيه: ميزانية مرتفعة',
    notif_budget_warn_body: 'أنفقت',
    notif_of_income: 'من دخلك هذا الشهر.',
    notif_saving_great_title: '🌟 أداء ادخار ممتاز!',
    notif_saving_great_body: 'ادخرت',
    notif_daily_summary: 'افتح التطبيق لمراجعة وضعك المالي اليوم.',
    notif_just_now: 'الآن',
    notif_mins_ago: 'منذ',
    notif_mins: 'د',
    notif_hours_ago: 'منذ',
    notif_hours: 'س',
    notif_days_ago: 'منذ',
    notif_prompt_title: '🔔 ابقَ على اطلاع',
    notif_prompt_body: 'هل تريد تلقي تنبيهات عن الديون والميزانية؟',
    notif_prompt_enable: 'تفعيل',
    notif_prompt_later: 'لاحقاً',
  },
  en: {
    // Categories
    cat_food: 'Food',
    cat_transport: 'Transport',
    cat_education: 'Education',
    cat_internet: 'Internet & Comms',
    cat_health: 'Health',
    cat_entertainment: 'Entertainment',
    cat_shopping: 'Shopping',
    cat_bills: 'Bills',
    cat_other: 'Other',

    // Income Sources
    inc_salary: 'Salary',
    inc_freelance: 'Freelance',
    inc_business: 'Business',
    inc_other: 'Other',

    // Investment Types
    inv_stocks: 'Stocks',
    inv_gold: 'Gold',
    inv_realEstate: 'Real Estate',
    inv_crypto: 'Crypto',
    inv_savings: 'Savings',
    inv_other: 'Other',

    // Month Names
    month_0: 'January', month_1: 'February', month_2: 'March', month_3: 'April',
    month_4: 'May', month_5: 'June', month_6: 'July', month_7: 'August',
    month_8: 'September', month_9: 'October', month_10: 'November', month_11: 'December',

    // General Words
    currency: 'EGP',
    date: 'Date',
    amount: 'Amount',
    type: 'Type',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    yes: 'Yes',
    no: 'No',
    add: 'Add',
    close: 'Close',
    warning: 'Warning',
    confirm_delete: 'Are you sure you want to delete this item?',

    // App Navigation
    nav_home: 'Home',
    nav_transactions: 'Transactions',
    nav_analytics: 'Analytics',
    nav_more: 'More',

    // Dashboard
    locale: 'en-US',
    greeting_am: 'Good Morning',
    greeting_pm: 'Good Afternoon',
    greeting_eve: 'Good Evening',
    dash_money_dist: 'Money Distribution',
    dash_recent_tx: 'Recent Transactions',
    dash_view_all: 'View All',
    tx_search_placeholder: 'Search transactions...',
    tx_all: 'All',
    tx_income: 'Income',
    tx_expenses: 'Expenses',
    abbr_k: 'k',
    chart_daily_spend: 'Daily Spending',
    balance: 'Balance',
    dash_net_balance: 'Net Monthly Balance',
    dash_assets: 'Assets',
    dash_liabilities: 'Liabilities',
    dash_saving_rate: 'Savings',
    dash_cash_flow: 'Cash Flow this Month',
    dash_income: 'Income',
    dash_expenses: 'Expenses',
    dash_spend_rate: 'of income',
    dash_safe_spend: 'Safe Daily Spending',
    dash_smart_tip: 'Smart Tip',
    dash_no_data: 'Not enough data to give a tip this month.',
    tip_no_data: 'Not enough data for this month. Start by adding income and expenses!',
    tip_budget_over: 'You have exceeded your budget! Try to reduce your expenses.',
    tip_excellent: 'Excellent performance! You are saving a large part of your income this month.',
    tip_warning: 'Warning: Your spending rate is very high and you may not have enough balance.',
    tip_high_spend: 'The largest part of your money went to "__CAT__". Make sure it is within your plan.',
    tip_good: 'Your money distribution looks balanced. Keep tracking your budget!',

    // Empty States
    empty_tx: 'No transactions',
    empty_tx_sub: 'Add an income or expense to start tracking your money.',
    empty_debts: 'No debts',
    empty_debts_sub: 'Great! You currently have no financial obligations.',
    empty_inv: 'No investments',
    empty_inv_sub: 'Start investing to grow your wealth for the future.',

    // Components
    comp_remaining: 'Remaining',
    comp_paid: 'Paid',
    comp_roi: 'ROI',
    comp_capital: 'Capital',
    comp_profits: 'Profits',
    comp_total: 'Total',

    // Analytics
    stat_total_inc: 'Total Income',
    stat_total_exp: 'Total Expenses',
    stat_net: 'Net Balance',
    stat_total_debts: 'Total Debts',
    stat_total_inv: 'Total Investments',
    stat_saving_rate: 'Saving Rate',
    stat_budget_commitment: 'Budget Commitment',
    stat_health: 'Financial Health Score',
    stat_chart_flow: 'Balance Evolution (Month)',
    stat_chart_cat: 'Expenses by Category',
    stat_key_metrics: 'Key Financial Metrics',
    health_excellent: 'Excellent financial health 🌟',
    health_critical: 'Critical - You need to reduce expenses ⚠️',
    health_good: 'Good - Savings can be improved 👍',

    // Budget
    budget_title: 'Monthly Budget',
    budget_spent: 'Spent',
    budget_remaining: 'Left',
    budget_over: 'Over',

    // More Page
    more_debts: 'Debts',
    more_debts_sub: 'Track debts and dues',
    more_inv: 'Investments',
    more_inv_sub: 'Manage assets and track returns',
    more_budget: 'Budget',
    more_budget_sub: 'Plan your monthly expenses',
    more_settings: 'System Settings',
    more_theme: 'Toggle Theme',
    more_theme_sub: 'Dark / Light mode',
    more_lang: 'Change Language',
    more_lang_sub: 'Switch to Arabic',
    more_export: 'Export Data',
    more_export_sub: 'Save backup (JSON)',
    more_import: 'Import Data',
    more_import_sub: 'Restore backup (JSON)',
    more_print: 'Print Report',
    more_print_sub: 'Print current month summary',
    more_danger: 'Danger Zone',
    more_clear: 'Clear all data',
    more_clear_sub: 'This action cannot be undone!',

    // Toasts
    toast_added: 'Added successfully',
    toast_updated: 'Updated successfully',
    toast_deleted: 'Deleted',
    toast_cleared: 'All data cleared',
    toast_error: 'An error occurred',
    toast_lang: 'Language changed to English',
    toast_theme: 'Theme changed',
    toast_invalid: 'Please enter valid data',

    // AI Advisor
    ai_advisor_title: 'AI Financial Advisor',
    ai_advisor_desc: 'Configure Gemini AI',
    ai_generate_btn: 'Generate Insights',
    ai_generating: 'Analyzing',
    ai_settings_title: '🤖 AI Advisor Settings',
    ai_settings_privacy: 'For your privacy, we don\'t send data to our servers. Please enter your <strong>Google Gemini API Key</strong>.',
    ai_save_key: 'Save Key',
    ai_get_key: 'Get a free key here',
    ai_error_conn: 'Connection error. Check your API key.',

    // Modals & Labels
    label_category: 'Category',
    label_notes: 'Notes',
    label_source: 'Source',
    label_name: 'Name',
    label_total_amount: 'Total Amount',
    label_paid_amount: 'Paid Amount',
    label_due_date: 'Due Date',
    label_capital: 'Invested Capital',
    label_current_value: 'Current Value',

    // Extra components
    comp_debt_total: 'Total Debt',
    comp_debt_rem: 'Remaining',
    comp_debt_paid: 'Paid',
    comp_debt_ratio: 'Payment Ratio',
    
    // Welcome Screen
    welcome_title: 'Mizanity',
    welcome_sub: 'Manage your money smartly',
    welcome_loading: 'Loading...',

    // Notifications
    notif_title: 'Notifications',
    notif_mark_all: 'Mark all read',
    notif_empty: 'No notifications',
    notif_clear_all: 'Clear all',
    notif_settings: 'Notification Settings',
    notif_settings_sub: 'Enable phone alerts',
    notif_allow: 'Enable Notifications',
    notif_allow_sub: 'Allow alerts for debts and budget even when the app is closed',
    notif_permission_granted: 'Notifications enabled successfully ✅',
    notif_permission_denied: 'Notifications denied. You can change this in browser settings.',
    notif_debt_today_title: '⚠️ Debt Due Today',
    notif_debt_soon_title: '📅 Debt Due Soon',
    notif_days_left: 'Left',
    notif_days: 'days',
    notif_budget_over_title: '🔴 Budget Exceeded!',
    notif_budget_over_body: 'Your spending has exceeded your income this month. Review your expenses.',
    notif_budget_warn_title: '🟡 Warning: High Budget Usage',
    notif_budget_warn_body: 'You have spent',
    notif_of_income: 'of your income this month.',
    notif_saving_great_title: '🌟 Great Savings Rate!',
    notif_saving_great_body: 'You saved',
    notif_daily_summary: 'Open the app to review your financial status today.',
    notif_just_now: 'Just now',
    notif_mins_ago: '',
    notif_mins: 'm ago',
    notif_hours_ago: '',
    notif_hours: 'h ago',
    notif_days_ago: '',
    notif_prompt_title: '🔔 Stay Informed',
    notif_prompt_body: 'Would you like to receive alerts about debts and budget?',
    notif_prompt_enable: 'Enable',
    notif_prompt_later: 'Later',
  }
};

let currentLang = localStorage.getItem('cashpilot_lang') || 'ar';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('cashpilot_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  translatePage();
}

export function toggleLang() {
  setLang(currentLang === 'ar' ? 'en' : 'ar');
  return currentLang;
}

export function t(key) {
  if (!DICTIONARY[currentLang]) return key;
  return DICTIONARY[currentLang][key] || key;
}

export function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
}

// Initial setup
document.documentElement.lang = currentLang;
document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
