const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // Dashboard
  { search: '>صافي الرصيد الشهري<', replace: ' data-i18n="dash_net_balance">صافي الرصيد الشهري<' },
  { search: '>الأصول<', replace: ' data-i18n="dash_assets">الأصول<' },
  { search: '>الالتزامات<', replace: ' data-i18n="dash_liabilities">الالتزامات<' },
  { search: '>الادخار<', replace: ' data-i18n="dash_saving_rate">الادخار<' },
  { search: '>التدفق النقدي هذا الشهر<', replace: ' data-i18n="dash_cash_flow">التدفق النقدي هذا الشهر<' },
  { search: '>دخل<', replace: ' data-i18n="dash_income">دخل<' },
  { search: '>مصروفات<', replace: ' data-i18n="dash_expenses">مصروفات<' },
  { search: '>من الدخل<', replace: ' data-i18n="dash_spend_rate">من الدخل<' },
  { search: '>نصيحة ذكية<', replace: ' data-i18n="dash_smart_tip">نصيحة ذكية<' },
  { search: '>المبلغ الآمن للإنفاق اليومي<', replace: ' data-i18n="dash_safe_spend">المبلغ الآمن للإنفاق اليومي<' },
  { search: '>لا توجد بيانات كافية لإعطاء نصيحة هذا الشهر.<', replace: ' data-i18n="dash_no_data">لا توجد بيانات كافية لإعطاء نصيحة هذا الشهر.<' },

  // Empty states
  { search: '>لا توجد معاملات<', replace: ' data-i18n="empty_tx">لا توجد معاملات<' },
  { search: '>أضف دخل أو مصروف لتبدأ تتبع أموالك.<', replace: ' data-i18n="empty_tx_sub">أضف دخل أو مصروف لتبدأ تتبع أموالك.<' },
  { search: '>لا توجد ديون<', replace: ' data-i18n="empty_debts">لا توجد ديون<' },
  { search: '>رائع! ليس لديك أي التزامات مالية حالياً.<', replace: ' data-i18n="empty_debts_sub">رائع! ليس لديك أي التزامات مالية حالياً.<' },
  { search: '>لا توجد استثمارات<', replace: ' data-i18n="empty_inv">لا توجد استثمارات<' },
  { search: '>ابدأ الاستثمار لزيادة ثروتك للمستقبل.<', replace: ' data-i18n="empty_inv_sub">ابدأ الاستثمار لزيادة ثروتك للمستقبل.<' },

  // Nav
  { search: '>الرئيسية<', replace: ' data-i18n="nav_home">الرئيسية<' },
  { search: '>المعاملات<', replace: ' data-i18n="nav_transactions">المعاملات<' },
  { search: '>التحليلات<', replace: ' data-i18n="nav_analytics">التحليلات<' },
  { search: '>المزيد<', replace: ' data-i18n="nav_more">المزيد<' },
  { search: '>إضافة<', replace: ' data-i18n="add">إضافة<' },

  // More Page
  { search: '>الديون<', replace: ' data-i18n="more_debts">الديون<' },
  { search: '>تتبع ديونك والأقساط المستحقة<', replace: ' data-i18n="more_debts_sub">تتبع ديونك والأقساط المستحقة<' },
  { search: '>الاستثمارات<', replace: ' data-i18n="more_inv">الاستثمارات<' },
  { search: '>إدارة أصولك ومتابعة العوائد<', replace: ' data-i18n="more_inv_sub">إدارة أصولك ومتابعة العوائد<' },
  { search: '>الميزانية<', replace: ' data-i18n="more_budget">الميزانية<' },
  { search: '>خطط لمصروفاتك الشهرية بدقة<', replace: ' data-i18n="more_budget_sub">خطط لمصروفاتك الشهرية بدقة<' },
  { search: '>إعدادات النظام<', replace: ' data-i18n="more_settings">إعدادات النظام<' },
  { search: '>تبديل المظهر<', replace: ' data-i18n="more_theme">تبديل المظهر<' },
  { search: '>الوضع الليلي / النهاري<', replace: ' data-i18n="more_theme_sub">الوضع الليلي / النهاري<' },
  { search: '>تصدير البيانات<', replace: ' data-i18n="more_export">تصدير البيانات<' },
  { search: '>حفظ نسخة احتياطية (JSON)<', replace: ' data-i18n="more_export_sub">حفظ نسخة احتياطية (JSON)<' },
  { search: '>استيراد البيانات<', replace: ' data-i18n="more_import">استيراد البيانات<' },
  { search: '>استعادة نسخة احتياطية (JSON)<', replace: ' data-i18n="more_import_sub">استعادة نسخة احتياطية (JSON)<' },
  { search: '>طباعة التقرير<', replace: ' data-i18n="more_print">طباعة التقرير<' },
  { search: '>طباعة ملخص الشهر الحالي<', replace: ' data-i18n="more_print_sub">طباعة ملخص الشهر الحالي<' },
  { search: '>منطقة الخطر<', replace: ' data-i18n="more_danger">منطقة الخطر<' },
  { search: '>مسح جميع البيانات<', replace: ' data-i18n="more_clear">مسح جميع البيانات<' },
  { search: '>هذا الإجراء لا يمكن التراجع عنه!<', replace: ' data-i18n="more_clear_sub">هذا الإجراء لا يمكن التراجع عنه!<' },

  // General text
  { search: '>المبلغ<', replace: ' data-i18n="amount">المبلغ<' },
  { search: '>التاريخ<', replace: ' data-i18n="date">التاريخ<' },
  { search: '>النوع<', replace: ' data-i18n="type">النوع<' },
  { search: '>إلغاء<', replace: ' data-i18n="cancel">إلغاء<' },
  { search: '>حفظ<', replace: ' data-i18n="save">حفظ<' },

  // Attributes
  { search: 'title="تثبيت التطبيق"', replace: 'data-i18n-title="nav_home"' }, // placeholder logic
  { search: 'title="إخفاء الأرقام"', replace: 'data-i18n-title="nav_home"' }, // placeholder
];

replacements.forEach(r => {
  html = html.split(r.search).join(r.replace);
});

fs.writeFileSync(filePath, html, 'utf8');
console.log('HTML updated successfully');
