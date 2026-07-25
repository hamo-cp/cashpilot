/**
 * @module core/constants
 * @description ثوابت التطبيق — فئات المصروفات، مصادر الدخل، أنواع الاستثمارات.
 */

export const EXPENSE_CATEGORIES = Object.freeze({
  food:          { label: 'cat_food',          iconId: 'ic-food',     color: 'orange' },
  transport:     { label: 'cat_transport',     iconId: 'ic-car',      color: 'cyan'   },
  education:     { label: 'cat_education',     iconId: 'ic-book',     color: 'purple' },
  internet:      { label: 'cat_internet',      iconId: 'ic-wifi',     color: 'cyan'   },
  health:        { label: 'cat_health',        iconId: 'ic-health',   color: 'red'    },
  entertainment: { label: 'cat_entertainment', iconId: 'ic-game',     color: 'purple' },
  shopping:      { label: 'cat_shopping',      iconId: 'ic-shopping', color: 'gold'   },
  bills:         { label: 'cat_bills',         iconId: 'ic-bills',    color: 'orange' },
  other:         { label: 'cat_other',         iconId: 'ic-other',    color: 'cyan'   },
});

export const INCOME_SOURCES = Object.freeze({
  salary:    { label: 'inc_salary',    iconId: 'ic-briefcase', color: 'green' },
  freelance: { label: 'inc_freelance', iconId: 'ic-cpu',       color: 'cyan'  },
  business:  { label: 'inc_business',  iconId: 'ic-layers',    color: 'gold'  },
  other:     { label: 'inc_other',     iconId: 'ic-dollar',    color: 'green' },
});

export const INVESTMENT_TYPES = Object.freeze({
  stocks:     { label: 'inv_stocks',     iconId: 'ic-bar-chart' },
  gold:       { label: 'inv_gold',       iconId: 'ic-coins'     },
  realEstate: { label: 'inv_realEstate', iconId: 'ic-building'  },
  crypto:     { label: 'inv_crypto',     iconId: 'ic-activity'  },
  savings:    { label: 'inv_savings',    iconId: 'ic-piggy'     },
  other:      { label: 'inv_other',      iconId: 'ic-briefcase' },
});

export const SWIPE_PAGES = Object.freeze([
  'dashboard', 'transactions', 'expenses',
  'analytics', 'more', 'income', 'debts',
  'investments', 'budget',
]);

export const MONTH_NAMES = Object.freeze([
  'month_0', 'month_1', 'month_2', 'month_3', 'month_4', 'month_5',
  'month_6', 'month_7', 'month_8', 'month_9', 'month_10', 'month_11'
]);

export const BUDGET_CATEGORIES = Object.freeze([
  { key: 'food',          iconId: 'ic-food',     label: 'cat_food',          color: 'orange' },
  { key: 'transport',     iconId: 'ic-car',      label: 'cat_transport',     color: 'cyan'   },
  { key: 'education',     iconId: 'ic-book',     label: 'cat_education',     color: 'purple' },
  { key: 'entertainment', iconId: 'ic-game',     label: 'cat_entertainment', color: 'purple' },
  { key: 'shopping',      iconId: 'ic-shopping', label: 'cat_shopping',      color: 'gold'   },
  { key: 'health',        iconId: 'ic-health',   label: 'cat_health',        color: 'red'    },
  { key: 'bills',         iconId: 'ic-bills',    label: 'cat_bills',         color: 'orange' },
  { key: 'internet',      iconId: 'ic-wifi',     label: 'cat_internet',      color: 'cyan'   },
]);
