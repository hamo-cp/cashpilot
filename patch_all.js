const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getJsFiles(file));
    } else if (file.endsWith('.js') && !file.endsWith('i18n.js') && !file.endsWith('constants.js')) {
      results.push(file);
    }
  });
  return results;
}

const jsFiles = getJsFiles(srcDir);

// Define precise replacements
const replacements = [
  // Analytics
  { search: "'إجمالي الدخل'", replace: "t('stat_total_inc')" },
  { search: "'إجمالي المصروفات'", replace: "t('stat_total_exp')" },
  { search: "'صافي الرصيد'", replace: "t('stat_net')" },
  { search: "'إجمالي الديون'", replace: "t('stat_total_debts')" },
  { search: "'إجمالي الاستثمارات'", replace: "t('stat_total_inv')" },
  { search: "'نسبة الادخار'", replace: "t('stat_saving_rate')" },
  { search: "'الالتزام بالميزانية'", replace: "t('stat_budget_commitment')" },
  { search: "'تطور الرصيد خلال الشهر'", replace: "t('stat_chart_flow')" },
  { search: "'توزيع المصروفات على الفئات'", replace: "t('stat_chart_cat')" },
  { search: "'حالة مالية ممتازة 🌟'", replace: "t('health_excellent')" },
  { search: "'حالة حرجة - تحتاج لتقليل النفقات ⚠️'", replace: "t('health_critical')" },
  { search: "'حالة جيدة - يمكن تحسين المدخرات 👍'", replace: "t('health_good')" },

  // Transactions
  { search: "' معاملة'", replace: "' ' + t('nav_transactions')" },
  { search: "'لا توجد نتائج'", replace: "t('empty_tx')" },
  { search: "'لم يتم العثور على معاملات مطابقة'", replace: "t('empty_tx_sub')" },
  { search: "'بدون تاريخ'", replace: "t('date') + ' ?'" }, // Fallback

  // Toasts across pages (Debts, Expenses, Income, Investments, Budget)
  { search: "'يرجى إدخال اسم الدائن'", replace: "t('toast_invalid')" },
  { search: "'الاسم طويل جداً'", replace: "t('toast_invalid')" },
  { search: "'يرجى إدخال المبلغ'", replace: "t('toast_invalid')" },
  { search: "'المبلغ غير صالح أو أقل من الصفر'", replace: "t('toast_invalid')" },
  { search: "'المبلغ كبير جداً'", replace: "t('toast_invalid')" },
  { search: "'المبلغ المدفوع لا يمكن أن يكون سالباً'", replace: "t('toast_invalid')" },
  { search: "'المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الدين'", replace: "t('toast_invalid')" },
  { search: "'تم إضافة الدين بنجاح'", replace: "t('toast_added')" },
  { search: "'تم تعديل الدين بنجاح'", replace: "t('toast_updated')" },
  { search: "'يرجى إدخال اسم المصروف'", replace: "t('toast_invalid')" },
  { search: "'الاسم طويل جداً (100 حرف كحد أقصى)'", replace: "t('toast_invalid')" },
  { search: "'يرجى اختيار التاريخ'", replace: "t('toast_invalid')" },
  { search: "'تم إضافة المصروف بنجاح'", replace: "t('toast_added')" },
  { search: "'تم تعديل المصروف بنجاح'", replace: "t('toast_updated')" },
  { search: "'يرجى إدخال مصدر الدخل'", replace: "t('toast_invalid')" },
  { search: "'تم إضافة الدخل بنجاح'", replace: "t('toast_added')" },
  { search: "'تم تعديل الدخل بنجاح'", replace: "t('toast_updated')" },
  { search: "'يرجى إدخال اسم الاستثمار'", replace: "t('toast_invalid')" },
  { search: "'قيمة العائد/الخسارة غير صالحة'", replace: "t('toast_invalid')" },
  { search: "'تم إضافة الاستثمار بنجاح'", replace: "t('toast_added')" },
  { search: "'تم تعديل الاستثمار بنجاح'", replace: "t('toast_updated')" },
  { search: "'تم حفظ الميزانية'", replace: "t('toast_updated')" },

  // Modals & Confirmation (Modal.js)
  { search: "'حفظ'", replace: "t('save')" },
  { search: "'تعديل'", replace: "t('edit')" },
  { search: "'تأكيد الحذف'", replace: "t('warning')" },
  { search: "'هل أنت متأكد من مسح جميع البيانات؟'", replace: "t('more_clear_sub')" },
  { search: "'هل أنت متأكد من أنك تريد حذف هذا العنصر؟'", replace: "t('confirm_delete')" },
  { search: "'هل أنت متأكد أنك تريد حذف هذا العنصر؟'", replace: "t('confirm_delete')" },

  // Main UI components labels which I might have missed (components.js)
  { search: "'تعديل'", replace: "t('edit')" },
  { search: "'حذف'", replace: "t('delete')" },

];

jsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Make sure t is imported if we are about to use it
  let needsImport = false;
  replacements.forEach(r => {
    if (content.includes(r.search)) {
      needsImport = true;
      content = content.split(r.search).join(r.replace);
    }
  });

  if (needsImport && !content.includes('import { t }')) {
    // Add import statement at top, finding depth based on path
    const depth = file.split(path.sep).length - srcDir.split(path.sep).length;
    let importPath = '../core/i18n.js';
    if (depth === 1) importPath = './core/i18n.js';
    if (depth > 2) importPath = '../../core/i18n.js';
    
    // insert right after first import
    const firstImportIndex = content.indexOf('import ');
    if (firstImportIndex !== -1) {
      const endOfImport = content.indexOf('\n', firstImportIndex);
      content = content.slice(0, endOfImport + 1) + `import { t } from '${importPath}';\n` + content.slice(endOfImport + 1);
    } else {
      content = `import { t } from '${importPath}';\n` + content;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', path.basename(file));
  }
});

// Extra fix for index.html placeholders
const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/placeholder="(\d+)"/g, 'placeholder="0"'); // ignore
const htmlReps = [
  { search: 'placeholder="أدخل مبلغ الدخل"', replace: 'data-i18n-placeholder="label_total_amount" placeholder="المبلغ"' },
  { search: 'placeholder="أدخل مبلغ المصروف"', replace: 'data-i18n-placeholder="label_total_amount" placeholder="المبلغ"' },
  { search: 'placeholder="ملاحظات (اختياري)"', replace: 'data-i18n-placeholder="label_notes" placeholder="ملاحظات"' },
  { search: 'placeholder="مثال: شراء قهوة"', replace: 'data-i18n-placeholder="label_notes" placeholder="ملاحظات"' },
  { search: 'placeholder="مثال: راتب إضافي"', replace: 'data-i18n-placeholder="label_notes" placeholder="ملاحظات"' },
  { search: 'placeholder="مثال: شراء سيارة"', replace: 'data-i18n-placeholder="label_notes" placeholder="ملاحظات"' },
  { search: 'placeholder="مثال: أسهم أبل"', replace: 'data-i18n-placeholder="label_notes" placeholder="ملاحظات"' },
];
htmlReps.forEach(r => {
  html = html.split(r.search).join(r.replace);
});
fs.writeFileSync(indexPath, html, 'utf8');

console.log('All JS + HTML patched!');
