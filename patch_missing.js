const fs = require('fs');
const path = require('path');

// 1. Update index.html
const indexHtmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const htmlReplacements = [
  { search: '>ميزانيتي<', replace: ' data-i18n="welcome_title">ميزانيتي<' },
  { search: '>إدارة أموالك بذكاء<', replace: ' data-i18n="welcome_sub">إدارة أموالك بذكاء<' },
  { search: '>جاري التحميل...<', replace: ' data-i18n="welcome_loading">جاري التحميل...<' },
  { search: '>الفئة<', replace: ' data-i18n="label_category">الفئة<' },
  { search: '>المصدر<', replace: ' data-i18n="label_source">المصدر<' },
  { search: '>ملاحظات<', replace: ' data-i18n="label_notes">ملاحظات<' },
  { search: '>الاسم<', replace: ' data-i18n="label_name">الاسم<' },
  { search: '>المبلغ الإجمالي<', replace: ' data-i18n="label_total_amount">المبلغ الإجمالي<' },
  { search: '>المبلغ المدفوع<', replace: ' data-i18n="label_paid_amount">المبلغ المدفوع<' },
  { search: '>تاريخ الاستحقاق<', replace: ' data-i18n="label_due_date">تاريخ الاستحقاق<' },
  { search: '>رأس المال المستثمر<', replace: ' data-i18n="label_capital">رأس المال المستثمر<' },
  { search: '>القيمة الحالية<', replace: ' data-i18n="label_current_value">القيمة الحالية<' }
];

htmlReplacements.forEach(r => {
  html = html.split(r.search).join(r.replace);
});
fs.writeFileSync(indexHtmlPath, html, 'utf8');


// 2. Update components.js
const compPath = path.join(__dirname, 'src', 'ui', 'components.js');
let comp = fs.readFileSync(compPath, 'utf8');
const compReplacements = [
  { search: '>إجمالي الدين<', replace: '>${t(\'comp_debt_total\')}<' },
  { search: '>المبلغ المتبقي<', replace: '>${t(\'comp_debt_rem\')}<' },
  { search: '>المدفوع<', replace: '>${t(\'comp_debt_paid\')}<' },
  { search: '>نسبة السداد<', replace: '>${t(\'comp_debt_ratio\')}<' },
  { search: 'تعديل', replace: '${t(\'edit\')}' },
  { search: 'حذف', replace: '${t(\'delete\')}' },
  { search: '>رأس المال<', replace: '>${t(\'comp_capital\')}<' },
  { search: '>الأرباح<', replace: '>${t(\'comp_profits\')}<' },
  { search: '>الإجمالي<', replace: '>${t(\'comp_total\')}<' },
];
compReplacements.forEach(r => {
  comp = comp.split(r.search).join(r.replace);
});
fs.writeFileSync(compPath, comp, 'utf8');


// 3. Update main.js (Toasts, etc)
const mainPath = path.join(__dirname, 'src', 'main.js');
let main = fs.readFileSync(mainPath, 'utf8');
const mainReps = [
  { search: "'تم تغيير المظهر'", replace: "t('toast_theme')" },
  { search: "'تم مسح البيانات'", replace: "t('toast_cleared')" },
  { search: "'تم التغيير'", replace: "t('toast_updated')" }
];
mainReps.forEach(r => {
  main = main.split(r.search).join(r.replace);
});
fs.writeFileSync(mainPath, main, 'utf8');


console.log('Patch complete.');
