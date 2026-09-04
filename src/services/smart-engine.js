/**
 * @module services/smart-engine
 * @description محرك التحليل المالي الذكي.
 * يقوم بتحليل سلوك المستخدم وإصدار نصائح وتنبيهات مخصصة
 * بناءً على إعدادات المستخدم وتفضيلاته.
 */

import * as Finance from './finance.js';
import * as Notif   from './notifications.js';
import * as DB      from '../storage/db.js';
import { today, daysUntil } from '../core/utils.js';
import { BUDGET_CATEGORIES } from '../core/constants.js';

// مفتاح لحفظ تاريخ آخر تحليل ذكي لمنع التكرار المزعج (أسبوعي مثلاً)
const LAST_SMART_ANALYSIS = 'mz_last_smart_analysis';

/**
 * دالة جلب إعدادات الإشعارات لضمان احترام تفضيلات المستخدم
 */
function getNotifSettings() {
  const settings = DB.get(DB.KEYS.SETTINGS) || {};
  return {
    smartBudget:   settings.notifSmartBudget   !== false, // مفعل افتراضياً
    smartDebts:    settings.notifSmartDebts    !== false, // مفعل افتراضياً
    smartInsights: settings.notifSmartInsights !== false, // مفعل افتراضياً
    weeklySummary: settings.notifWeeklySummary !== false, // مفعل افتراضياً
  };
}

/**
 * المحرك الرئيسي — يُستدعى من notifications.runSmartTriggers
 */
export function runSmartEngine() {
  const now      = new Date();
  const month    = now.getMonth() + 1;
  const year     = now.getFullYear();
  const summary  = Finance.getMonthSummary(month, year);
  const prefs    = getNotifSettings();

  // 1. فحص الديون (تعمل دائماً يومياً إذا كانت مفعلة)
  if (prefs.smartDebts) {
    analyzeDebts();
  }

  // 2. فحص الميزانية الفورية (تعمل دائماً إذا مفعلة)
  if (prefs.smartBudget && summary.income > 0) {
    analyzeBudget(summary, month, year);
  }

  // 3. فحص الاشتراكات الشهرية
  analyzeSubscriptions();

  // 4. فحص الرؤى والنصائح الأسبوعية (Insights)
  // لا نريد إزعاج المستخدم بنصائح يومية، نكتفي بمرة كل 3 أيام أو أسبوع
  const lastAnalysis = localStorage.getItem(LAST_SMART_ANALYSIS);
  if (!lastAnalysis || daysUntil(lastAnalysis) <= -3) { // مر 3 أيام
    if (prefs.smartInsights) {
      analyzeInsights(summary);
    }
    if (prefs.weeklySummary && now.getDay() === 5) { // كل يوم جمعة
      generateWeeklySummary(summary);
    }
    localStorage.setItem(LAST_SMART_ANALYSIS, today());
  }
}

/**
 * تحليل الديون المستحقة والخطرة
 */
function analyzeDebts() {
  const debts = Finance.getDebts();
  let totalDebtAmount = 0;

  debts.forEach(debt => {
    if (debt.paid >= debt.amount) return; // مسدد
    totalDebtAmount += (debt.amount - debt.paid);

    if (!debt.dueDate) return;
    const days = daysUntil(debt.dueDate);

    if (days === 0) {
      Notif.addNotification({
        type:     'debt_due',
        titleKey: 'smart_debt_due_today_title',
        bodyKey:  'smart_debt_due_today_body',
        params:   { creditor: debt.creditor, amount: debt.amount - debt.paid },
        icon:     'ic-landmark',
        severity: 'danger',
        link:     'debts',
      }, { link: 'debts', tag: 'debt-' + debt.id });
    } else if (days > 0 && days <= 3) {
      Notif.addNotification({
        type:     'debt_due',
        titleKey: 'smart_debt_due_soon_title',
        bodyKey:  'smart_debt_due_soon_body',
        params:   { creditor: debt.creditor, days },
        icon:     'ic-landmark',
        severity: 'warning',
        link:     'debts',
      }, { link: 'debts', tag: 'debt-soon-' + debt.id });
    }
  });

  // تحليل خطورة الديون
  const monthIncome = Finance.getMonthSummary(new Date().getMonth() + 1, new Date().getFullYear()).income;
  if (monthIncome > 0 && totalDebtAmount > monthIncome * 0.5) {
    Notif.addNotification({
      type:     'insight',
      titleKey: 'smart_debt_high_title',
      bodyKey:  'smart_debt_high_body',
      icon:     'ic-alert',
      severity: 'danger',
      link:     'debts',
    });
  }
}

/**
 * تحليل الميزانية ومعدل الإنفاق الفوري والميزانيات المخصصة
 */
function analyzeBudget(summary, month, year) {
  const spendRate = summary.spendRate;
  
  // تحذير الميزانية الإجمالية
  if (spendRate >= 100) {
    Notif.addNotification({
      type:     'budget_over',
      titleKey: 'smart_budget_over_title',
      bodyKey:  'smart_budget_over_body',
      icon:     'ic-alert',
      severity: 'danger',
      link:     'budget',
    }, { link: 'budget', tag: 'budget-over' });
  } else if (spendRate >= 85) {
    Notif.addNotification({
      type:     'budget_warning',
      titleKey: 'smart_budget_warn_title',
      bodyKey:  'smart_budget_warn_body',
      params:   { rate: spendRate.toFixed(0) },
      icon:     'ic-alert',
      severity: 'warning',
      link:     'budget',
    }, { link: 'budget', tag: 'budget-warn' });
  }

  // فحص الميزانيات المخصصة لكل فئة
  const categoryLimits = Finance.getBudget();
  const categorySpent = Finance.expensesByCategory(month, year);
  BUDGET_CATEGORIES.forEach(cat => {
    const limit = parseFloat(categoryLimits[cat.key]) || 0;
    const spent = categorySpent[cat.key] || 0;
    
    if (limit > 0) {
      const pct = (spent / limit) * 100;
      if (pct >= 100) {
        Notif.addNotification({
          type:     'budget_over',
          titleKey: 'smart_category_over_title',
          bodyKey:  'smart_category_over_body',
          params:   { categoryKey: cat.label, spent, limit },
          icon:     'ic-alert',
          severity: 'danger',
          link:     'budget',
        }, { link: 'budget', tag: `budget-over-${cat.key}` });
      } else if (pct >= 85) {
        Notif.addNotification({
          type:     'budget_warning',
          titleKey: 'smart_category_warn_title',
          bodyKey:  'smart_category_warn_body',
          params:   { categoryKey: cat.label, rate: pct.toFixed(0), remaining: limit - spent },
          icon:     'ic-alert',
          severity: 'warning',
          link:     'budget',
        }, { link: 'budget', tag: `budget-warn-${cat.key}` });
      }
    }
  });
}

/**
 * تحليل الاشتراكات الدورية
 */
function analyzeSubscriptions() {
  const subs = Finance.getSubscriptions();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  subs.forEach(sub => {
    if (!sub.dueDate) return;
    
    // Convert YYYY-MM-DD to just the day of the month for recurring logic
    // Or just assume the subscription is monthly on that day
    const dueDay = parseInt(sub.dueDate.split('-')[2]);
    const todayDate = new Date();
    
    // Construct the next due date
    let nextDue = new Date(currentYear, currentMonth - 1, dueDay);
    if (nextDue < todayDate && nextDue.getDate() !== todayDate.getDate()) {
      // If it already passed this month, the next due date is next month
      nextDue = new Date(currentYear, currentMonth, dueDay);
    }

    const diffTime = nextDue - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      Notif.addNotification({
        type:     'system',
        titleKey: 'smart_subscription_due_title',
        bodyKey:  'smart_subscription_due_body',
        params:   { name: sub.name, amount: Number(sub.amount) || 0 },
        icon:     'ic-clock',
        severity: 'danger',
        link:     'subscriptions',
      }, { link: 'subscriptions', tag: 'sub-due-' + sub.id });
    } else if (diffDays > 0 && diffDays <= 3) {
      Notif.addNotification({
        type:     'system',
        titleKey: 'smart_subscription_soon_title',
        bodyKey:  'smart_subscription_soon_body',
        params:   { name: sub.name, days: diffDays, amount: Number(sub.amount) || 0 },
        icon:     'ic-clock',
        severity: 'warning',
        link:     'subscriptions',
      }, { link: 'subscriptions', tag: 'sub-soon-' + sub.id });
    }
  });
}

/**
 * تحليل الرؤى والنصائح (Insights)
 * تطبيق قاعدة 50/30/20، والتشجيع على الاستثمار
 */
function analyzeInsights(summary) {
  if (summary.income === 0) return;

  const savingRate = summary.savingRate; // الفائض (الدخل - المصروفات)
  const investmentsTotal = Finance.getInvestments().reduce((sum, i) => sum + parseFloat(i.capital), 0);

  // قاعدة 20% ادخار/استثمار
  if (savingRate < 20 && savingRate > 0) {
    Notif.addNotification({
      type:     'insight',
      titleKey: 'smart_saving_tip_title',
      bodyKey:  'smart_saving_tip_body',
      params:   { rate: savingRate.toFixed(1) },
      icon:     'ic-trending-up',
      severity: 'info',
      link:     'analytics',
    });
  } else if (savingRate >= 20) {
    Notif.addNotification({
      type:     'insight',
      titleKey: 'smart_saving_success_title',
      bodyKey:  'smart_saving_success_body',
      params:   { rate: savingRate.toFixed(1) },
      icon:     'ic-star',
      severity: 'success',
      link:     'analytics',
    });
  }

  // التشجيع على الاستثمار إذا كان هناك مدخرات جيدة ولكن لا يوجد استثمارات
  if (savingRate > 15 && investmentsTotal === 0) {
    Notif.addNotification({
      type:     'insight',
      titleKey: 'smart_invest_tip_title',
      bodyKey:  'smart_invest_tip_body',
      icon:     'ic-trending-up',
      severity: 'info',
      link:     'investments',
    });
  }
}

/**
 * توليد ملخص أسبوعي
 */
function generateWeeklySummary(summary) {
  Notif.addNotification({
    type:     'insight',
    titleKey: 'smart_weekly_title',
    bodyKey:  'smart_weekly_body',
    params:   { amount: summary.expenses },
    icon:     'ic-pie-chart',
    severity: 'info',
    link:     'analytics',
  });
}
