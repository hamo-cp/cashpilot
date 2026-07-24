/**
 * @module core/constants
 * @description ثوابت التطبيق — فئات المصروفات، مصادر الدخل، أنواع الاستثمارات.
 * مرجع واحد لكل الثوابت — تعديل مكان واحد يؤثر على كل التطبيق.
 */

/** فئات المصروفات مع أيقونات Lucide وألوان CSS */
export const EXPENSE_CATEGORIES = Object.freeze({
  food:          { label: 'الطعام',          iconId: 'ic-food',     color: 'orange' },
  transport:     { label: 'المواصلات',       iconId: 'ic-car',      color: 'cyan'   },
  education:     { label: 'الدراسة',         iconId: 'ic-book',     color: 'purple' },
  internet:      { label: 'إنترنت واتصالات', iconId: 'ic-wifi',     color: 'cyan'   },
  health:        { label: 'الصحة',           iconId: 'ic-health',   color: 'red'    },
  entertainment: { label: 'الترفيه',         iconId: 'ic-game',     color: 'purple' },
  shopping:      { label: 'التسوق',          iconId: 'ic-shopping', color: 'gold'   },
  bills:         { label: 'فواتير',          iconId: 'ic-bills',    color: 'orange' },
  other:         { label: 'أخرى',            iconId: 'ic-other',    color: 'cyan'   },
});

/** مصادر الدخل */
export const INCOME_SOURCES = Object.freeze({
  salary:    { label: 'الراتب',        iconId: 'ic-briefcase', color: 'green' },
  freelance: { label: 'عمل حر',        iconId: 'ic-cpu',       color: 'cyan'  },
  business:  { label: 'أرباح مشاريع', iconId: 'ic-layers',    color: 'gold'  },
  other:     { label: 'أخرى',          iconId: 'ic-dollar',    color: 'green' },
});

/** أنواع الاستثمارات */
export const INVESTMENT_TYPES = Object.freeze({
  stocks:     { label: 'أسهم',         iconId: 'ic-bar-chart' },
  gold:       { label: 'ذهب',          iconId: 'ic-coins'     },
  realEstate: { label: 'عقارات',       iconId: 'ic-building'  },
  crypto:     { label: 'عملات رقمية', iconId: 'ic-activity'  },
  savings:    { label: 'توفير',        iconId: 'ic-piggy'     },
  other:      { label: 'أخرى',         iconId: 'ic-briefcase' },
});

/** ترتيب صفحات التنقل بالسحب */
export const SWIPE_PAGES = Object.freeze([
  'dashboard', 'transactions', 'expenses',
  'analytics', 'more', 'income', 'debts',
  'investments', 'budget',
]);

/** أسماء الأشهر بالعربية */
export const MONTH_NAMES = Object.freeze([
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
]);

/** فئات الميزانية الشهرية */
export const BUDGET_CATEGORIES = Object.freeze([
  { key: 'food',          iconId: 'ic-food',     label: 'الطعام',    color: 'orange' },
  { key: 'transport',     iconId: 'ic-car',      label: 'المواصلات', color: 'cyan'   },
  { key: 'education',     iconId: 'ic-book',     label: 'الدراسة',   color: 'purple' },
  { key: 'entertainment', iconId: 'ic-game',     label: 'الترفيه',   color: 'purple' },
  { key: 'shopping',      iconId: 'ic-shopping', label: 'التسوق',    color: 'gold'   },
  { key: 'health',        iconId: 'ic-health',   label: 'الصحة',     color: 'red'    },
  { key: 'bills',         iconId: 'ic-bills',    label: 'الفواتير',  color: 'orange' },
  { key: 'internet',      iconId: 'ic-wifi',     label: 'الإنترنت',  color: 'cyan'   },
]);
