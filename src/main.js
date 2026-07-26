/**
 * @module main
 * @description نقطة الدخل الرئيسية للتطبيق.
 *
 * المسؤوليات:
 *  1. تهيئة Chart.js defaults
 *  2. بذر البيانات التجريبية (مرة واحدة)
 *  3. تطبيق الثيم المحفوظ
 *  4. ربط التنقل والأحداث العامة
 *  5. تسجيل Service Worker
 *  6. تعريض App للـ window (لنداءات onclick في HTML)
 */

import { getLang, setLang, toggleLang, translatePage, t } from './core/i18n.js';
import { applyGlobalDefaults }         from './charts/chartConfig.js';
import { getSettings, saveSettings }   from './services/finance.js';
import { exportData, importData }       from './services/backup.js';
import { printSummary }                 from './services/print.js';
import { getState, setState }           from './core/state.js';
import { navigateTo, bindNavButtons,
         bindCenterButton, setupFilters,
         bindSwipe }                    from './ui/nav.js';
import { bindModalEvents, openModal,
         closeModal, openConfirm,
         cancelConfirm, executeConfirm } from './ui/modal.js';
import * as Toast                          from './ui/toast.js';
import { filterTransactions,
         bindSearchInput,
         renderTransactions }          from './pages/transactions.js';
import * as Notif                       from './services/notifications.js';
import { generateInsights }             from './services/ai-advisor.js';

// Pages
import { renderDashboard }    from './pages/dashboard.js';
import { renderIncome,
         openIncomeModal,
         saveIncome }         from './pages/income.js';
import { renderExpenses,
         openExpenseModal,
         saveExpense }        from './pages/expenses.js';
import { renderDebts,
         openDebtModal,
         saveDebt }           from './pages/debts.js';
import { renderInvestments,
         openInvestmentModal,
         saveInvestment,
         refreshMarket }     from './pages/investments.js';
import { renderSubscriptions,
         openSubscriptionModal,
         saveSubscription }   from './pages/subscriptions.js';
import { renderBudget,
         saveBudgetField }    from './pages/budget.js';
import { renderAnalytics }    from './pages/analytics.js';
import * as Finance           from './services/finance.js';

/* ════════════════════════════════════════
   renderPage — router مركزي
   ════════════════════════════════════════ */
function renderPage(page) {
  switch (page) {
    case 'dashboard':     renderDashboard();                        break;
    case 'income':        renderIncome();                           break;
    case 'expenses':      renderExpenses();                         break;
    case 'debts':         renderDebts();                            break;
    case 'investments':   renderInvestments().catch(console.error);  break;
    case 'subscriptions': renderSubscriptions();                    break;
    case 'budget':        renderBudget();  animateProgressBars();   break;
    case 'analytics':     renderAnalytics(); animateProgressBars(); break;
    case 'transactions': renderTransactions();                    break;
    case 'more':         /* static — no render */ syncMorePage();  break;
  }
}

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */
function animateProgressBars() {
  setTimeout(() => {
    document.querySelectorAll('.progress-bar')
      .forEach(bar => bar.classList.add('animated'));
  }, 100);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'dark');
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.querySelector('use').setAttribute('href', theme === 'light' ? '#ic-moon' : '#ic-sun');
  }
}

function syncMorePage() {
  const settings   = getSettings();
  const isDark     = settings.theme !== 'light';
  const toggle     = document.getElementById('moreThemeToggle');
  const label      = document.getElementById('moreThemeLabel');
  const moreIcon   = document.getElementById('moreThemeIcon');
  if (toggle) toggle.classList.toggle('active', !isDark);
  if (label)  label.textContent = isDark ? 'الوضع الداكن' : 'الوضع الفاتح';
  if (moreIcon) moreIcon.querySelector('use')
    .setAttribute('href', isDark ? '#ic-moon' : '#ic-sun');
}

function handleDelete(type, id) {
  switch (type) {
    case 'income':       Finance.deleteIncome(id);       break;
    case 'expense':      Finance.deleteExpense(id);      break;
    case 'debt':         Finance.deleteDebt(id);         break;
    case 'investment':   Finance.deleteInvestment(id);   break;
    case 'subscription': Finance.deleteSubscription(id); break;
  }
  Toast.show('تم الحذف', 'success');
  renderPage(getState().currentPage);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('[App] SW registered'))
      .catch(err => console.warn('[App] SW failed:', err));
  }
}

function hideWelcomeScreen() {
  const ws = document.getElementById('welcomeScreen');
  if (!ws) return;
  // حماية دفاعية: يُخفى دائماً بعد 3 ثوانٍ كحد أقصى
  const forceHide = setTimeout(() => {
    ws.style.opacity    = '0';
    ws.style.transition = 'opacity 0.3s';
    setTimeout(() => ws.remove(), 300);
  }, 3000);
  setTimeout(() => {
    clearTimeout(forceHide);
    ws.style.opacity    = '0';
    ws.style.transition = 'opacity 0.5s';
    setTimeout(() => ws.remove(), 500);
  }, 1200);
}

function bindNetworkWatcher() {
  function showBanner() {
    if (document.getElementById('offlineBanner')) return;
    const b       = document.createElement('div');
    b.id          = 'offlineBanner';
    b.className   = 'offline-banner';
    b.textContent = 'لا يوجد اتصال بالإنترنت — التطبيق يعمل بشكل كامل';
    document.body.appendChild(b);
  }
  function hideBanner() {
    document.getElementById('offlineBanner')?.remove();
  }
  window.addEventListener('offline', showBanner);
  window.addEventListener('online',  hideBanner);
  if (!navigator.onLine) showBanner();
}

function bindMorePageEvents() {
  // Theme toggle
  document.getElementById('moreThemeBtn')?.addEventListener('click', () => {
    const current  = getSettings().theme || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    saveSettings({ theme: newTheme });
    applyTheme(newTheme);
    syncMorePage();
    Toast.show(t('toast_theme'), 'info');
  });

  document.getElementById('moreLangBtn')?.addEventListener('click', () => {
    const newLang = toggleLang();
    Toast.show(t('toast_lang'));
    translatePage();
    renderPage(getState().currentPage);
  });

  // Export
  document.getElementById('moreExportBtn')?.addEventListener('click', exportData);

  // Import
  document.getElementById('moreImportBtn')?.addEventListener('click', () => {
    document.getElementById('importFile')?.click();
  });
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    importData(e, () => renderPage(getState().currentPage));
  });

  // Print
  document.getElementById('morePrintBtn')?.addEventListener('click', printSummary);
}

function bindPWAInstall() {
  let deferredPrompt;
  const btn = document.getElementById('installBtn');
  if (!btn) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.style.display = 'flex';
  });

  btn.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          btn.style.display = 'none';
        }
        deferredPrompt = null;
      });
    }
  });
}

/* ════════════════════════════════════════
   Notification Page & Settings — وظائف نظام الإشعارات
   ════════════════════════════════════════ */

function refreshNotifUI() {
  const count  = Notif.getUnreadCount();
  const badge  = document.getElementById('notif-badge');
  const list   = document.getElementById('notif-list');
  const empty  = document.getElementById('notif-empty');
  const notifs = Notif.getNotifications();

  // تحديث شارة العدد
  if (badge) {
    badge.textContent    = count > 9 ? '9+' : count;
    badge.style.display  = count > 0 ? 'block' : 'none';
  }

  // تحديث نافذة الإعدادات
  const pushBtn = document.getElementById('togglePushBtn');
  const status = Notif.getPermissionStatus();
  if (pushBtn) {
    if (status === 'granted') {
      pushBtn.textContent = 'مفعل ✅';
      pushBtn.classList.add('active');
    } else if (status === 'denied') {
      pushBtn.textContent = 'محظور ❌';
      pushBtn.classList.remove('active');
    } else {
      pushBtn.textContent = 'تفعيل';
      pushBtn.classList.remove('active');
    }
  }

  // مزامنة حالة الأزرار (Toggles) مع الإعدادات
  const settings = getSettings();
  const toggleSmartBudget   = document.getElementById('toggleSmartBudget');
  const toggleSmartDebts    = document.getElementById('toggleSmartDebts');
  const toggleSmartInsights = document.getElementById('toggleSmartInsights');
  const toggleWeeklySummary = document.getElementById('toggleWeeklySummary');
  
  if (toggleSmartBudget)   toggleSmartBudget.checked   = settings.notifSmartBudget   !== false;
  if (toggleSmartDebts)    toggleSmartDebts.checked    = settings.notifSmartDebts    !== false;
  if (toggleSmartInsights) toggleSmartInsights.checked = settings.notifSmartInsights !== false;
  if (toggleWeeklySummary) toggleWeeklySummary.checked = settings.notifWeeklySummary !== false;

  if (!list || !empty) return;

  if (notifs.length === 0) {
    list.innerHTML  = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    list.innerHTML = notifs.map(Notif.notifItemHTML).join('');
  }
}

function bindNotifPage() {
  document.getElementById('notifMarkAllBtn')?.addEventListener('click', () => {
    Notif.markAllRead();
    refreshNotifUI();
  });
  document.getElementById('notifClearBtn')?.addEventListener('click', () => {
    Notif.clearNotifications();
    refreshNotifUI();
  });
}
/** عرض توست لطيف لطلب إذن الإشعارات (3 ثواني بعد الفتح) */
function promptNotifPermission() {
  if (Notif.wasPermissionAsked()) return;
  if (Notif.getPermissionStatus() !== 'default') return;

  setTimeout(() => {
    const toast = document.createElement('div');
    toast.className = 'notif-prompt-toast';
    toast.style.cssText = `
      position:fixed; bottom:80px; inset-inline-start:50%; transform:translateX(-50%);
      background:var(--color-bg-card); border:1px solid var(--color-border);
      border-radius:16px; padding:14px 18px; z-index:9999;
      box-shadow:0 8px 32px rgba(0,0,0,0.4); max-width:300px; width:90%;
      animation:slideUp 0.3s var(--ease-out);
    `;
    toast.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);margin-bottom:6px">
        ${t('notif_prompt_title')}
      </div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">
        ${t('notif_prompt_body')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="notif-prompt-later" style="background:none;border:1px solid var(--color-border);color:var(--color-text-muted);padding:6px 14px;border-radius:8px;cursor:pointer;font-family:var(--font-main);font-size:12px">${t('notif_prompt_later')}</button>
        <button id="notif-prompt-enable" style="background:var(--color-brand);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-family:var(--font-main);font-size:12px;font-weight:700">${t('notif_prompt_enable')}</button>
      </div>
    `;
    document.body.appendChild(toast);

    document.getElementById('notif-prompt-later')?.addEventListener('click', () => {
      localStorage.setItem('mz_notif_permission_asked', '1');
      toast.remove();
    });
    document.getElementById('notif-prompt-enable')?.addEventListener('click', async () => {
      toast.remove();
      const result = await Notif.requestNativePermission();
      const msg = result === 'granted'
        ? t('notif_permission_granted')
        : t('notif_permission_denied');
      Toast.show(msg, result === 'granted' ? 'success' : 'error');
      refreshNotifUI();
    });
  }, 3500);
}

/* ════════════════════════════════════════
   App — واجهة عامة للـ onclick في HTML
   ════════════════════════════════════════ */
/* ── حماية double-submit ── */
let _saving = false;
function withSaveGuard(fn) {
  return () => {
    if (_saving) return;
    _saving = true;
    try { fn(); } finally {
      setTimeout(() => { _saving = false; }, 600);
    }
  };
}

export const App = {
  // التنقل
  navigateTo: (page) => navigateTo(page, renderPage),

  // Modals
  openIncomeModal:     (id) => { setState({ editingId: id || null }); openIncomeModal(id); openModal('incomeModal'); },
  openExpenseModal:    (id) => { setState({ editingId: id || null }); openExpenseModal(id); openModal('expenseModal'); },
  openDebtModal:       (id) => { setState({ editingId: id || null }); openDebtModal(id); openModal('debtModal'); },
  openInvestmentModal: (id) => { setState({ editingId: id || null }); openInvestmentModal(id); openModal('investmentModal'); },
  refreshMarket,
  openSubscriptionModal: (id) => { setState({ editingId: id || null }); openSubscriptionModal(id); openModal('subscriptionModal'); },
  openModal,
  closeModal,
  // AI Advisor
  generateAIInsights: async () => {
    const btn = document.getElementById('aiGenerateBtn');
    const resultDiv = document.getElementById('aiInsightsResult');
    if (!btn || !resultDiv) return;

    try {
      btn.disabled = true;
      btn.innerHTML = 'جاري التحليل <svg class="icon icon-sm spin"><use href="#ic-refresh"/></svg>';
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<div style="text-align:center; padding:10px;">جاري التواصل مع الذكاء الاصطناعي...</div>';

      const insights = await generateInsights();
      
      // Simple markdown parser for **bold** and \n lists
      const html = insights
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

      resultDiv.innerHTML = html;
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:var(--color-danger);">سبب الخطأ: ${err.message}</div>`;
      Toast.show('خطأ في الاتصال', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'اطلب نصيحة';
    }
  },

  // Save — محمية من double-submit
  saveIncome:     withSaveGuard(() => saveIncome(getState().editingId,     () => { closeModal(); renderPage(getState().currentPage); })),
  saveExpense:    withSaveGuard(() => saveExpense(getState().editingId,    () => { closeModal(); renderPage(getState().currentPage); })),
  saveDebt:       withSaveGuard(() => saveDebt(getState().editingId,       () => { closeModal(); renderPage(getState().currentPage); })),
  saveInvestment: withSaveGuard(() => saveInvestment(getState().editingId, () => { closeModal(); renderPage(getState().currentPage); })),
  saveSubscription: withSaveGuard(() => saveSubscription(getState().editingId, () => { closeModal(); renderPage(getState().currentPage); })),

  // Delete
  confirmDelete:  (type, id) => openConfirm(type, id),
  cancelDelete:   () => cancelConfirm(),
  executeDelete:  () => executeConfirm(handleDelete),

  // Budget
  saveBudgetField: (key, value) => saveBudgetField(key, value, () => renderPage('budget')),

  // Theme (legacy — يُستدعى من قِبل syncThemeIcon في HTML)
  toggleTheme() {
    const current  = getSettings().theme || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    saveSettings({ theme: newTheme });
    applyTheme(newTheme);
    Toast.show(t('toast_theme'), 'info');
  },

  // Print
  printSummary,

  // Export/Import
  exportData,

  // Notifications
  async togglePushNotifications() {
    const current = Notif.getPermissionStatus();
    if (current === 'granted') {
      Toast.show('الإشعارات مفعلة بالفعل', 'success');
    } else if (current === 'denied') {
      Toast.show('الرجاء السماح بالإشعارات من إعدادات المتصفح', 'error');
    } else {
      const result = await Notif.requestNativePermission();
      Toast.show(result === 'granted' ? 'تم التفعيل بنجاح' : 'تم الرفض', result === 'granted' ? 'success' : 'error');
    }
    refreshNotifUI();
  },
  saveNotifSettings() {
    const smartBudget   = document.getElementById('toggleSmartBudget')?.checked;
    const smartDebts    = document.getElementById('toggleSmartDebts')?.checked;
    const smartInsights = document.getElementById('toggleSmartInsights')?.checked;
    const weeklySummary = document.getElementById('toggleWeeklySummary')?.checked;

    saveSettings({
      notifSmartBudget:   smartBudget,
      notifSmartDebts:    smartDebts,
      notifSmartInsights: smartInsights,
      notifWeeklySummary: weeklySummary,
    });
    Toast.show('تم حفظ إعدادات الإشعارات', 'success');
  },
  openNotif(id, link) {
    Notif.markRead(id);
    refreshNotifUI();
    if (link) navigateTo(link, renderPage);
  },
  deleteNotif(id) {
    Notif.deleteNotification(id);
    refreshNotifUI();
  },
};

/* ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const _emergencyHide = setTimeout(() => {
    document.getElementById('welcomeScreen')?.remove();
  }, 5000);

  try {
    // 0. Language
    translatePage();

    // 1. Chart.js defaults
    applyGlobalDefaults();

    // Privacy Toggle
    document.getElementById('privacyBtn')?.addEventListener('click', () => {
      document.body.classList.toggle('privacy-mode');
      const icon = document.getElementById('privacyIcon');
      if (icon) {
        if (document.body.classList.contains('privacy-mode')) {
          icon.innerHTML = '<use href="#ic-eye-off"/>';
        } else {
          icon.innerHTML = '<use href="#ic-eye"/>';
        }
      }
    });

    // 3. Theme
    const { theme } = getSettings();
    applyTheme(theme);

    // 4. Navigation
    bindNavButtons(renderPage);
    bindCenterButton(() => App.openExpenseModal());
    setupFilters(() => renderPage(getState().currentPage));
    bindSwipe(renderPage);

    // 5. Modals & search
    bindModalEvents();
    bindSearchInput();

    // 6. More page
    bindMorePageEvents();

    // 7. PWA & SW
    bindPWAInstall();
    registerServiceWorker();

    // 8. Network
    bindNetworkWatcher();

    // 9. First render
    navigateTo('dashboard', renderPage);

    // 10. Welcome screen
    hideWelcomeScreen();

    // 11. filterTx global
    window.filterTx = (type, btn) => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      filterTransactions(type);
    };

    // 12. Notifications
    bindNotifPage();
    refreshNotifUI();
    promptNotifPermission();
    // تشغيل المحرك الذكي (2 ثانية بعد تحميل التطبيق)
    setTimeout(async () => {
      await Notif.runSmartTriggers();
      refreshNotifUI();
    }, 2000);

    // 13. استماع للتنقل من إشعارات الخلفية
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE_TO' && event.data.page) {
        navigateTo(event.data.page, renderPage);
      }
    });

    console.log(
      '%cميزانيتي v1.0',
      'color:#4f7cff;font-family:Cairo;font-size:16px;font-weight:700',
    );
  } catch (err) {
    console.error('[App] Boot error:', err);
    document.getElementById('welcomeScreen')?.remove();
  } finally {
    clearTimeout(_emergencyHide);
  }
});

/* تعريض App للـ window ليُستخدم في onclick attributes */
window.App = App;
