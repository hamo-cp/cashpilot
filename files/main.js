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

import { applyGlobalDefaults }         from './charts/chartConfig.js';
import { seedIfEmpty }                  from './services/demo.js';
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
import * as Toast                        from './ui/toast.js';
import { filterTransactions,
         bindSearchInput,
         renderTransactions }          from './pages/transactions.js';

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
         saveInvestment }     from './pages/investments.js';
import { renderBudget,
         saveBudgetField }    from './pages/budget.js';
import { renderAnalytics }    from './pages/analytics.js';
import * as Finance           from './services/finance.js';

/* ════════════════════════════════════════
   renderPage — router مركزي
   ════════════════════════════════════════ */
function renderPage(page) {
  switch (page) {
    case 'dashboard':    renderDashboard();                        break;
    case 'income':       renderIncome();                           break;
    case 'expenses':     renderExpenses();                         break;
    case 'debts':        renderDebts();                            break;
    case 'investments':  renderInvestments();                      break;
    case 'budget':       renderBudget();  animateProgressBars();   break;
    case 'analytics':    renderAnalytics(); animateProgressBars(); break;
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
    case 'income':     Finance.deleteIncome(id);     break;
    case 'expense':    Finance.deleteExpense(id);    break;
    case 'debt':       Finance.deleteDebt(id);       break;
    case 'investment': Finance.deleteInvestment(id); break;
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
    Toast.show('تم تغيير المظهر', 'info');
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
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) {
      btn.style.display = 'flex';
      btn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt       = null;
          btn.style.display    = 'none';
        });
      });
    }
  });
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
  openIncomeModal:     (id) => { setState({ editingId: id || null }); openIncomeModal(id); },
  openExpenseModal:    (id) => { setState({ editingId: id || null }); openExpenseModal(id); },
  openDebtModal:       (id) => { setState({ editingId: id || null }); openDebtModal(id); },
  openInvestmentModal: (id) => { setState({ editingId: id || null }); openInvestmentModal(id); },
  closeModal,

  // Save — محمية من double-submit
  saveIncome:     withSaveGuard(() => saveIncome(getState().editingId,     () => { closeModal(); renderPage('income');      })),
  saveExpense:    withSaveGuard(() => saveExpense(getState().editingId,    () => { closeModal(); renderPage('expenses');   })),
  saveDebt:       withSaveGuard(() => saveDebt(getState().editingId,       () => { closeModal(); renderPage('debts');      })),
  saveInvestment: withSaveGuard(() => saveInvestment(getState().editingId, () => { closeModal(); renderPage('investments'); })),

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
    Toast.show('تم تغيير المظهر', 'info');
  },

  // Print
  printSummary,

  // Export/Import
  exportData,
};

/* ════════════════════════════════════════
   Bootstrap — يعمل عند تحميل DOM
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Defensive: إخفاء splash screen دائماً حتى عند crash
  const _emergencyHide = setTimeout(() => {
    document.getElementById('welcomeScreen')?.remove();
  }, 5000);

  try {
    // 1. Chart.js defaults
    applyGlobalDefaults();

    // 2. Demo data
    seedIfEmpty();

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
