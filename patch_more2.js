const fs = require('fs');
const path = require('path');

// 1. Update index.html
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


// 2. Update dashboard.js
const dashPath = path.join(__dirname, 'src', 'pages', 'dashboard.js');
let dash = fs.readFileSync(dashPath, 'utf8');
dash = dash.replace(
  "hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور'", 
  "hour < 12 ? t('greeting_am') : hour < 18 ? t('greeting_pm') : t('greeting_eve')"
);
dash = dash.replace(
  "now.toLocaleDateString('ar-EG', {", 
  "now.toLocaleDateString(t('locale'), {"
);
dash = dash.replace(
  "v => formatPercent(v) + ' من الدخل'", 
  "v => formatPercent(v) + ' ' + t('dash_spend_rate')"
);
fs.writeFileSync(dashPath, dash, 'utf8');


// 3. Update charts.js
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

// 4. Update transactions.js
const txPath = path.join(__dirname, 'src', 'pages', 'transactions.js');
let tx = fs.readFileSync(txPath, 'utf8');
tx = tx.replace(
  /cat\.label/g,
  "t(cat.label)"
);
// Make sure t is imported in transactions.js if missing
if (!tx.includes('core/i18n.js') && tx.includes('t(')) {
  tx = "import { t } from '../core/i18n.js';\n" + tx;
}
fs.writeFileSync(txPath, tx, 'utf8');

console.log('Patch complete.');
