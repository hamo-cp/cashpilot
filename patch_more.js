const fs = require('fs');
const path = require('path');

// 1. Update i18n.js
const i18nPath = path.join(__dirname, 'src', 'core', 'i18n.js');
let i18n = fs.readFileSync(i18nPath, 'utf8');

const arAdds = `
    // Dashboard & New Keys
    greeting_am: 'صباح الخير',
    greeting_pm: 'مساء الخير',
    greeting_eve: 'مساء النور',
    stat_health: 'مؤشر الصحة المالية',
    stat_key_metrics: 'المؤشرات الرئيسية',
    stat_smart_analytics: 'التحليلات الذكية',
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
    dash_spend_rate: 'من الدخل',
  },
  en: {`;

const enAdds = `
    // Dashboard & New Keys
    greeting_am: 'Good Morning',
    greeting_pm: 'Good Afternoon',
    greeting_eve: 'Good Evening',
    stat_health: 'Financial Health',
    stat_key_metrics: 'Key Metrics',
    stat_smart_analytics: 'Smart Analytics',
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
    dash_spend_rate: 'of income',
  }
};`;

i18n = i18n.replace('  },\n  en: {', arAdds);
i18n = i18n.replace('  }\n};', enAdds);
fs.writeFileSync(i18nPath, i18n, 'utf8');

// 2. Update index.html
const indexHtmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const htmlReplacements = [
  { search: '>مؤشر الصحة المالية<', replace: ' data-i18n="stat_health">مؤشر الصحة المالية<' },
  { search: '>المؤشرات الرئيسية<', replace: ' data-i18n="stat_key_metrics">المؤشرات الرئيسية<' },
  { search: '>التحليلات الذكية<', replace: ' data-i18n="stat_smart_analytics">التحليلات الذكية<' },
  { search: '>توزيع الأموال<', replace: ' data-i18n="dash_money_dist">توزيع الأموال<' },
  { search: '>آخر المعاملات<', replace: ' data-i18n="dash_recent_tx">آخر المعاملات<' },
  { search: '>عرض الكل<', replace: ' data-i18n="dash_view_all">عرض الكل<' },
  { search: 'placeholder="ابحث في المعاملات..."', replace: 'data-i18n-placeholder="tx_search_placeholder" placeholder="ابحث في المعاملات..."' },
  { search: 'onclick="filterTx(\'all\', this)">الكل<', replace: 'onclick="filterTx(\'all\', this)" data-i18n="tx_all">الكل<' },
  { search: 'onclick="filterTx(\'income\', this)">الدخل<', replace: 'onclick="filterTx(\'income\', this)" data-i18n="tx_income">الدخل<' },
  { search: 'onclick="filterTx(\'expense\', this)">المصروفات<', replace: 'onclick="filterTx(\'expense\', this)" data-i18n="tx_expenses">المصروفات<' },
  { search: '>استثمار<', replace: ' data-i18n="more_inv">استثمار<' },
  { search: '>ديون<', replace: ' data-i18n="more_debts">ديون<' },
  { search: '>مصروف<', replace: ' data-i18n="dash_expenses">مصروف<' },
];

htmlReplacements.forEach(r => {
  html = html.split(r.search).join(r.replace);
});
fs.writeFileSync(indexHtmlPath, html, 'utf8');


// 3. Update dashboard.js
const dashPath = path.join(__dirname, 'src', 'pages', 'dashboard.js');
let dash = fs.readFileSync(dashPath, 'utf8');
dash = dash.replace(
  "hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'", 
  "hour < 12 ? t('greeting_am') : hour < 18 ? t('greeting_pm') : t('greeting_eve')"
);
dash = dash.replace(
  "now.toLocaleDateString('ar-EG', {", 
  "now.toLocaleDateString(t('locale') || 'ar-EG', {"
);
dash = dash.replace(
  "v => formatPercent(v) + ' من الدخل'", 
  "v => formatPercent(v) + ' ' + t('dash_spend_rate')"
);
fs.writeFileSync(dashPath, dash, 'utf8');


// 4. Update charts.js
const chartsPath = path.join(__dirname, 'src', 'charts', 'charts.js');
let charts = fs.readFileSync(chartsPath, 'utf8');
if (!charts.includes('core/i18n.js')) {
  charts = "import { t } from '../core/i18n.js';\n" + charts;
}
charts = charts.replace(
  "['المصروفات', 'الادخار', 'الديون', 'الاستثمارات']",
  "[t('dash_expenses'), t('dash_saving_rate'), t('more_debts'), t('more_inv')]"
);
charts = charts.replace("'الإنفاق اليومي'", "t('chart_daily_spend')");
charts = charts.replace(/ \+ 'ك'/g, " + t('abbr_k')");
charts = charts.replace("'الرصيد'", "t('balance')");
charts = charts.replace(
  "labels: entries.map(([k]) => (EXPENSE_CATEGORIES[k] || EXPENSE_CATEGORIES.other).label),",
  "labels: entries.map(([k]) => t((EXPENSE_CATEGORIES[k] || EXPENSE_CATEGORIES.other).label)),"
);
fs.writeFileSync(chartsPath, charts, 'utf8');


// 5. Update transactions.js
const txPath = path.join(__dirname, 'src', 'pages', 'transactions.js');
let tx = fs.readFileSync(txPath, 'utf8');
// Fix missing filter category translation
tx = tx.replace(
  "let catsHTML = ''",
  "let catsHTML = ''" // Do nothing for now
);
tx = tx.replace(
  "<div class=\"filter-chip\"",
  "<div class=\"filter-chip\""
);
// We will replace categories by mapping them in the html string
tx = tx.replace(
  /cat.label/g,
  "t(cat.label)"
);
fs.writeFileSync(txPath, tx, 'utf8');


console.log('Second patch complete.');
