/**
 * @module services/smart-engine
 * @description محرك التحليل المالي الذكي.
 * يقوم بتحليل سلوك المستخدم وإصدار نصائح وتنبيهات مخصصة
 * بناءً على إعدادات المستخدم وتفضيلاته.
 */

import * as Finance from './finance.js';
import * as Notif   from './notifications.js';
import * as DB      from '../storage/db.js';
import { today, daysUntil, formatCurrency } from '../core/utils.js';

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
        title:    '⚠️ دين مستحق اليوم',
        body:     `الدين لصالح: ${debt.creditor} بقيمة ${formatCurrency(debt.amount - debt.paid)} مستحق اليوم!`,
        icon:     'ic-landmark',
        severity: 'danger',
        link:     'debts',
      }, { link: 'debts', tag: 'debt-' + debt.id });
    } else if (days > 0 && days <= 3) {
      Notif.addNotification({
        type:     'debt_due',
        title:    '📅 اقترب موعد سداد دين',
        body:     `تذكير: لديك دين لصالح ${debt.creditor} يستحق خلال ${days} أيام.`,
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
      title:    '🚨 تحذير: مستوى ديون مرتفع',
      body:     'ديونك الحالية تتجاوز 50% من دخلك الشهري. حاول التركيز على سداد الديون قبل زيادة النفقات الترفيهية.',
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
      title:    '🔴 ميزانية مخترقة!',
      body:     'لقد تجاوزت إنفاقك حد الدخل المتاح لهذا الشهر. كل قرش تنفقه الآن يعتبر عجزاً.',
      icon:     'ic-alert',
      severity: 'danger',
      link:     'budget',
    }, { link: 'budget', tag: 'budget-over' });
  } else if (spendRate >= 85) {
    Notif.addNotification({
      type:     'budget_warning',
      title:    '🟡 إنذار ميزانية عامة',
      body:     `أنفقت ${spendRate.toFixed(0)}% من دخلك. حاول تقنين المصروفات حتى نهاية الشهر.`,
      icon:     'ic-alert',
      severity: 'warning',
      link:     'budget',
    }, { link: 'budget', tag: 'budget-warn' });
  }

  // فحص الميزانيات المخصصة لكل فئة
  const categoryLimits = Finance.getBudget();
  const categorySpent = Finance.expensesByCategory(month, year);
  const BUDGET_CATEGORIES = [
    { key: 'food', label: 'الطعام' },
    { key: 'transport', label: 'المواصلات' },
    { key: 'education', label: 'التعليم' },
    { key: 'health', label: 'الصحة' },
    { key: 'entertainment', label: 'الترفيه' },
    { key: 'shopping', label: 'التسوق' },
    { key: 'bills', label: 'الفواتير' },
    { key: 'internet', label: 'الإنترنت' }
  ];

  BUDGET_CATEGORIES.forEach(cat => {
    const limit = parseFloat(categoryLimits[cat.key]) || 0;
    const spent = categorySpent[cat.key] || 0;
    
    if (limit > 0) {
      const pct = (spent / limit) * 100;
      if (pct >= 100) {
        Notif.addNotification({
          type:     'budget_over',
          title:    `🔴 تجاوزت ميزانية ${cat.label}`,
          body:     `لقد تجاوزت الميزانية المخصصة لـ (${cat.label}). أنفقت ${formatCurrency(spent)} من أصل ${formatCurrency(limit)}.`,
          icon:     'ic-alert',
          severity: 'danger',
          link:     'budget',
        }, { link: 'budget', tag: `budget-over-${cat.key}` });
      } else if (pct >= 85) {
        Notif.addNotification({
          type:     'budget_warning',
          title:    `🟡 اقتربت من حد ${cat.label}`,
          body:     `استهلكت ${pct.toFixed(0)}% من ميزانية ${cat.label}. المتبقي ${formatCurrency(limit - spent)} فقط!`,
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
        title:    '🔔 تجديد اشتراك اليوم',
        body:     `اشتراكك في (${sub.name}) يستحق التجديد اليوم بقيمة ${formatCurrency(sub.amount)}.`,
        icon:     'ic-clock',
        severity: 'danger',
        link:     'subscriptions',
      }, { link: 'subscriptions', tag: 'sub-due-' + sub.id });
    } else if (diffDays > 0 && diffDays <= 3) {
      Notif.addNotification({
        type:     'system',
        title:    '📅 اقترب تجديد اشتراك',
        body:     `تذكير: اشتراك (${sub.name}) يتجدد خلال ${diffDays} أيام بقيمة ${formatCurrency(sub.amount)}.`,
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
      title:    '💡 نصيحة ذكية: قاعدة 50/30/20',
      body:     `فائضك الحالي هو ${savingRate.toFixed(1)}%. الخبراء ينصحون بادخار أو استثمار 20% على الأقل من الدخل لضمان مستقبل مالي مستقر.`,
      icon:     'ic-trending-up',
      severity: 'info',
      link:     'analytics',
    });
  } else if (savingRate >= 20) {
    Notif.addNotification({
      type:     'insight',
      title:    '🌟 أداء مالي ممتاز!',
      body:     `أنت بطل! لقد وفرت ${savingRate.toFixed(1)}% من دخلك. أنت على الطريق الصحيح للحرية المالية.`,
      icon:     'ic-star',
      severity: 'success',
      link:     'analytics',
    });
  }

  // التشجيع على الاستثمار إذا كان هناك مدخرات جيدة ولكن لا يوجد استثمارات
  if (savingRate > 15 && investmentsTotal === 0) {
    Notif.addNotification({
      type:     'insight',
      title:    '📈 اجعل أموالك تعمل لأجلك',
      body:     'رائع أنك تدخر! لكن هل فكرت في الاستثمار؟ الاستثمار يحمي أموالك من التضخم ويضاعف ثروتك بمرور الوقت.',
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
    title:    '📊 ملخصك الأسبوعي',
    body:     `أنفقت هذا الشهر إجمالي ${formatCurrency(summary.expenses)}. اضغط هنا لرؤية تحليلاتك والتصنيفات التي استهلكت ميزانيتك.`,
    icon:     'ic-pie-chart',
    severity: 'info',
    link:     'analytics',
  });
}
