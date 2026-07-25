const fs = require('fs');
const path = require('path');

const componentsPath = path.join(__dirname, 'src', 'ui', 'components.js');
let comp = fs.readFileSync(componentsPath, 'utf8');

// Add import if missing
if (!comp.includes('core/i18n.js')) {
  comp = comp.replace(
    "import { formatCurrency, formatDate, daysUntil, svgIcon } from '../core/utils.js';",
    "import { formatCurrency, formatDate, daysUntil, svgIcon } from '../core/utils.js';\nimport { t } from '../core/i18n.js';"
  );
}

const compReps = [
  { search: />المتبقي</g, replace: '>${t(\'comp_remaining\')}<' },
  { search: />مدفوع</g, replace: '>${t(\'comp_paid\')}<' },
  { search: />الإجمالي:</g, replace: '>${t(\'comp_total\')}:<' },
  { search: />الأرباح:</g, replace: '>${t(\'comp_profits\')}:<' },
  { search: />العائد:</g, replace: '>${t(\'comp_roi\')}:<' },
  { search: />رأس المال:</g, replace: '>${t(\'comp_capital\')}:<' }
];

compReps.forEach(r => comp = comp.replace(r.search, r.replace));
fs.writeFileSync(componentsPath, comp, 'utf8');


const analyticsPath = path.join(__dirname, 'src', 'pages', 'analytics.js');
let ana = fs.readFileSync(analyticsPath, 'utf8');

if (!ana.includes('core/i18n.js')) {
  ana = ana.replace(
    "import { EXPENSE_CATEGORIES, MONTH_NAMES } from '../core/constants.js';",
    "import { EXPENSE_CATEGORIES, MONTH_NAMES } from '../core/constants.js';\nimport { t } from '../core/i18n.js';"
  );
}

// In drawFlowChart, labels are MONTH_NAMES[month-1] -> t(MONTH_NAMES[month-1])
ana = ana.replace(/MONTH_NAMES\[(.*?)\s*-\s*1\]/g, 't(MONTH_NAMES[$1 - 1])');

// In drawCategoryChart, labels are labels = sorted.map(...) -> we need to translate info.label
// We can just replace info.label with t(info.label)
ana = ana.replace(/info\.label/g, 't(info.label)');
ana = ana.replace(/catInfo\.label/g, 't(catInfo.label)');

fs.writeFileSync(analyticsPath, ana, 'utf8');

const budgetPath = path.join(__dirname, 'src', 'pages', 'budget.js');
let bud = fs.readFileSync(budgetPath, 'utf8');

if (!bud.includes('core/i18n.js')) {
  bud = bud.replace(
    "import { formatCurrency } from '../core/utils.js';",
    "import { formatCurrency } from '../core/utils.js';\nimport { t } from '../core/i18n.js';"
  );
}

bud = bud.replace(/cat\.label/g, 't(cat.label)');
fs.writeFileSync(budgetPath, bud, 'utf8');

const dashPath = path.join(__dirname, 'src', 'pages', 'dashboard.js');
let dash = fs.readFileSync(dashPath, 'utf8');

if (!dash.includes('core/i18n.js')) {
  dash = dash.replace(
    "import { MONTH_NAMES } from '../core/constants.js';",
    "import { MONTH_NAMES } from '../core/constants.js';\nimport { t } from '../core/i18n.js';"
  );
}
dash = dash.replace(/MONTH_NAMES\[([^\]]+)\]/g, 't(MONTH_NAMES[$1])');

fs.writeFileSync(dashPath, dash, 'utf8');

console.log('JS files updated');
