import * as Finance from '../services/finance.js';
import { esc } from '../core/utils.js';
import { getLang, setLang } from '../core/i18n.js';
import { getMobileCopy } from './copy.js';
import {
  formatPeriodLabel,
  getActivityViewModel,
  getCurrentPeriod,
  getHomeViewModel,
  shiftPeriod,
  MOBILE_SCREENS,
} from './model.js';
import { handleMobileBack } from './navigation.js';
import { formatMobileAmount, renderTransactionRows } from './view.js';

const root = document.getElementById('app');
const state = {
  screen: 'home',
  period: getCurrentPeriod(),
  query: '',
  filter: 'all',
  notice: '',
};

const ICONS = Object.freeze({
  home: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  activity: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1"/><circle cx="17" cy="12" r="1"/><circle cx="9" cy="19" r="1"/></svg>',
  plan: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16"/><path d="M8 16v-4m4 4V8m4 8v-6m4 6V5"/></svg>',
  insights: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>',
  more: '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  previous: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  moon: '<svg class="setting-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>',
  sun: '<svg class="setting-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>',
  settings: '<svg class="placeholder-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4L17 17.4a1.7 1.7 0 0 1-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 1-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 1-1.2-2.9h-.2a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 1 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 1 2.9-1.2v-.2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 1 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 1 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 1-1.2 2.9Z"/></svg>',
});

function localeFor(language) {
  return language === 'en' ? 'en-US' : 'ar-EG';
}

function currentTheme() {
  return Finance.getSettings()?.theme === 'light' ? 'light' : 'dark';
}

function synchronizeDocumentPreferences(language) {
  document.documentElement.lang = language === 'en' ? 'en' : 'ar';
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dataset.theme = currentTheme();
}

function renderPeriodControl(copy, locale) {
  return [
    '<div class="period-control" aria-label="', esc(copy.monthlyOverview), '">',
    '<button class="period-button period-previous" id="period-previous" type="button" data-action="previous-month" aria-label="', esc(copy.previousMonth), '">', ICONS.previous, '</button>',
    '<span class="period-label" aria-live="polite">', esc(formatPeriodLabel(state.period, locale)), '</span>',
    '<button class="period-button period-next" id="period-next" type="button" data-action="next-month" aria-label="', esc(copy.nextMonth), '">', ICONS.next, '</button>',
    '</div>',
  ].join('');
}

function renderEmptyState(title, body) {
  return [
    '<div class="empty-state"><h2>', esc(title), '</h2>',
    '<p>', esc(body), '</p></div>',
  ].join('');
}

function renderRowsOrEmpty(records, copy, locale, emptyTitle, emptyBody) {
  if (records.length === 0) return renderEmptyState(emptyTitle, emptyBody);
  return '<div class="transaction-list">' + renderTransactionRows(records, { locale, copy }) + '</div>';
}

function renderHome(copy, locale) {
  const model = getHomeViewModel(Finance, state.period);
  const summary = model.summary;
  const budgetTotal = Number(summary.budgetTotal);
  const budgetRate = Number(summary.budgetRate);
  const percentage = Number.isFinite(budgetRate) ? Math.max(0, budgetRate) : 0;
  const fill = Math.min(100, percentage);
  const percentageLabel = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(percentage) + '%';
  const budget = Number.isFinite(budgetTotal) && budgetTotal > 0
    ? [
      '<div class="budget-summary"><span>', esc(copy.budgetProgress), '</span>',
      '<strong>', esc(percentageLabel), '</strong></div>',
      '<div class="progress-track" role="progressbar" aria-label="', esc(copy.budgetProgress),
      '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="', String(Math.round(fill)),
      '" aria-valuetext="', esc(String(Math.round(percentage)) + '%'), '">',
      '<span class="progress-fill" style="width:', String(fill), '%"></span></div>',
    ].join('')
    : '<p class="muted-note">' + esc(copy.budgetNotSet) + '</p>';

  return [
    '<main class="screen-content">',
    '<p class="screen-kicker">', esc(copy.appSubtitle), '</p>',
    '<h1 id="mobile-page-heading" class="screen-heading" tabindex="-1">', esc(copy.home), '</h1>',
    renderPeriodControl(copy, locale),
    '<section class="overview-card" aria-labelledby="overview-title">',
    '<p id="overview-title" class="screen-kicker">', esc(copy.monthlyOverview), '</p>',
    '<span class="net-value"><bdi dir="ltr">', esc(formatMobileAmount(summary.net)), '</bdi></span>',
    '<span class="net-caption">', esc(copy.netThisMonth), '</span>',
    '</section>',
    '<section class="metric-grid" aria-label="', esc(copy.monthlyOverview), '">',
    '<article class="metric-card"><span class="metric-label">', esc(copy.income), '</span>',
    '<bdi class="metric-value" dir="ltr">', esc(formatMobileAmount(summary.income)), '</bdi></article>',
    '<article class="metric-card"><span class="metric-label">', esc(copy.expenses), '</span>',
    '<bdi class="metric-value" dir="ltr">', esc(formatMobileAmount(summary.expenses)), '</bdi></article>',
    '</section>',
    '<section class="section-card" aria-labelledby="budget-title">',
    '<div class="section-heading-row"><h2 id="budget-title" class="section-title">', esc(copy.budgetSignal), '</h2></div>',
    budget,
    '</section>',
    '<section class="section-card" aria-labelledby="recent-title">',
    '<div class="section-heading-row"><h2 id="recent-title" class="section-title">', esc(copy.recentActivity), '</h2>',
    '<button class="text-button" type="button" data-screen="activity">', esc(copy.seeActivity), '</button></div>',
    renderRowsOrEmpty(model.recent, copy, locale, copy.emptyTitle, copy.emptyBody),
    '</section>',
    '</main>',
  ].join('');
}

function renderActivity(copy, locale) {
  const model = getActivityViewModel(Finance, {
    period: state.period,
    query: state.query,
    type: state.filter,
  });
  const hasActiveFilter = state.query.trim() || state.filter !== 'all';
  const emptyTitle = hasActiveFilter ? copy.noResultsTitle : copy.emptyTitle;
  const emptyBody = hasActiveFilter ? copy.noResults : copy.emptyActivity;
  const filters = [
    ['all', copy.all],
    ['income', copy.incomeFilter],
    ['expense', copy.expenseFilter],
  ].map(([value, label]) => [
    '<button class="filter-chip" id="filter-', value, '" type="button" data-action="filter" data-filter="', value,
    '" aria-pressed="', String(state.filter === value), '">', esc(label), '</button>',
  ].join('')).join('');

  return [
    '<main class="screen-content">',
    '<p class="screen-kicker">', esc(copy.appSubtitle), '</p>',
    '<h1 id="mobile-page-heading" class="screen-heading" tabindex="-1">', esc(copy.activity), '</h1>',
    '<div class="activity-period">', renderPeriodControl(copy, locale), '</div>',
    '<div class="activity-tools">',
    '<label class="search-field"><span class="sr-only">', esc(copy.searchLabel), '</span>',
    '<input id="activity-search" type="search" inputmode="search" autocomplete="off" value="', esc(state.query),
    '" placeholder="', esc(copy.searchPlaceholder), '"></label>',
    '<div class="filter-row" role="group" aria-label="', esc(copy.activity), '">', filters, '</div>',
    '</div>',
    '<section class="activity-list-card" aria-label="', esc(copy.activity), '">',
    renderRowsOrEmpty(model.transactions, copy, locale, emptyTitle, emptyBody),
    '</section>',
    '</main>',
  ].join('');
}

function renderPlaceholder(copy, screen) {
  const description = screen === 'plan'
    ? copy.planSoon
    : screen === 'insights'
      ? copy.insightsSoon
      : copy.toolsSoon;
  const title = copy[screen];
  return [
    '<main class="screen-content">',
    '<p class="screen-kicker">', esc(copy.appSubtitle), '</p>',
    '<h1 id="mobile-page-heading" class="screen-heading" tabindex="-1">', esc(title), '</h1>',
    '<section class="placeholder-card">',
    ICONS.settings,
    '<p>', esc(description), '</p>',
    '</section>',
    screen === 'more' ? renderPreferences(copy) : '',
    '</main>',
  ].join('');
}

function renderPreferences(copy) {
  const language = getLang();
  const theme = currentTheme();
  const themeLabel = theme === 'light' ? copy.themeLight : copy.themeDark;
  const themeIcon = theme === 'light' ? ICONS.sun : ICONS.moon;
  const languageAction = language === 'ar' ? copy.switchToEnglish : copy.switchToArabic;

  return [
    '<section class="section-card" aria-labelledby="preferences-title">',
    '<h2 id="preferences-title" class="section-title">', esc(copy.preferences), '</h2>',
    '<div class="setting-list">',
    '<button class="setting-row" id="mobile-language-toggle" type="button" data-action="language">',
    '<span class="setting-copy"><strong>', esc(copy.language), '</strong>',
    '<small>', esc(language === 'ar' ? 'العربية' : 'English'), '</small></span>',
    '<span class="setting-value">', esc(languageAction), '</span></button>',
    '<button class="setting-row" id="mobile-theme-toggle" type="button" data-action="theme" aria-label="', esc(copy.changeTheme), '">',
    '<span class="setting-copy"><strong>', esc(copy.theme), '</strong>',
    '<small>', themeIcon, ' ', esc(themeLabel), '</small></span>',
    '<span class="setting-value">', esc(theme === 'light' ? copy.themeDark : copy.themeLight), '</span></button>',
    '</div>',
    '</section>',
  ].join('');
}

function renderBottomNavigation(copy) {
  return [
    '<nav class="bottom-navigation" aria-label="', esc(copy.navigation), '">',
    MOBILE_SCREENS.map(screen => [
      '<button class="nav-item" type="button" data-screen="', screen, '"',
      state.screen === screen ? ' aria-current="page"' : '',
      ' aria-label="', esc(copy[screen]), '">',
      ICONS[screen],
      '<span>', esc(copy[screen]), '</span></button>',
    ].join('')).join(''),
    '</nav>',
  ].join('');
}

function screenMarkup(copy, locale) {
  if (state.screen === 'home') return renderHome(copy, locale);
  if (state.screen === 'activity') return renderActivity(copy, locale);
  return renderPlaceholder(copy, state.screen);
}

function render(options = {}) {
  if (!root) return;
  const language = getLang();
  const copy = getMobileCopy(language);
  const locale = localeFor(language);
  const priorSearch = options.restoreSearch ? document.getElementById('activity-search') : null;
  const searchSelection = priorSearch
    ? { start: priorSearch.selectionStart, end: priorSearch.selectionEnd }
    : null;

  synchronizeDocumentPreferences(language);
  root.innerHTML = [
    '<div class="mobile-shell">',
    '<header class="mobile-header">',
    '<div class="brand-lockup"><span class="brand-mark" aria-hidden="true">CP</span>',
    '<span><span class="brand-name">CashPilot</span><span class="brand-subtitle">', esc(copy.appSubtitle), '</span></span></div>',
    '<button class="quick-add" id="mobile-quick-add" type="button" data-action="quick-add" aria-label="', esc(copy.add), '">',
    ICONS.add, '<span>', esc(copy.add), '</span></button>',
    '</header>',
    screenMarkup(copy, locale),
    state.notice
      ? '<div class="mobile-notice" role="status" aria-live="polite" aria-atomic="true">' + esc(state.notice) + '</div>'
      : '<span class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>',
    renderBottomNavigation(copy),
    '</div>',
  ].join('');

  if (options.focusId) {
    const target = document.getElementById(options.focusId);
    if (target && root.contains(target)) target.focus({ preventScroll: true });
  } else if (searchSelection) {
    const input = document.getElementById('activity-search');
    if (input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(searchSelection.start, searchSelection.end);
    }
  }
}

function navigateHome() {
  state.screen = 'home';
  state.query = '';
  state.filter = 'all';
  state.notice = '';
  render({ focusId: 'mobile-page-heading' });
}

function handleBack() {
  return handleMobileBack(state.screen, navigateHome);
}

function handleClick(event) {
  const target = event.target?.closest?.('button[data-screen], button[data-action]');
  if (!target || !root.contains(target)) return;

  if (target.dataset.screen && MOBILE_SCREENS.includes(target.dataset.screen)) {
    state.screen = target.dataset.screen;
    state.notice = '';
    render({ focusId: 'mobile-page-heading' });
    return;
  }

  const action = target.dataset.action;
  if (action === 'quick-add') {
    state.notice = getMobileCopy(getLang()).addLater;
    render({ focusId: 'mobile-quick-add' });
  } else if (action === 'previous-month' || action === 'next-month') {
    state.period = shiftPeriod(state.period, action === 'previous-month' ? -1 : 1);
    state.notice = '';
    render({ focusId: target.id });
  } else if (action === 'filter') {
    state.filter = target.dataset.filter || 'all';
    state.notice = '';
    render({ focusId: target.id });
  } else if (action === 'language') {
    const nextLanguage = getLang() === 'ar' ? 'en' : 'ar';
    setLang(nextLanguage);
    state.notice = getMobileCopy(nextLanguage).languageChanged;
    render({ focusId: 'mobile-language-toggle' });
  } else if (action === 'theme') {
    const nextTheme = currentTheme() === 'dark' ? 'light' : 'dark';
    Finance.saveSettings({ theme: nextTheme });
    state.notice = Finance.getSettings()?.theme === nextTheme
      ? ''
      : getMobileCopy(getLang()).themeSaveFailed;
    render({ focusId: 'mobile-theme-toggle' });
  } else if (action === 'retry') {
    state.notice = '';
    render();
  }
}

function handleInput(event) {
  if (event.target?.id !== 'activity-search') return;
  state.query = event.target.value;
  render({ restoreSearch: true });
}

function renderError() {
  const copy = getMobileCopy(getLang());
  root.innerHTML = [
    '<main class="screen-content"><section class="placeholder-card">',
    '<h1 id="mobile-page-heading" class="screen-heading" tabindex="-1">', esc(copy.contentError), '</h1>',
    '<button class="text-button" type="button" data-action="retry">', esc(copy.retry), '</button>',
    '</section></main>',
  ].join('');
}

root?.addEventListener('click', event => {
  try {
    handleClick(event);
  } catch (error) {
    console.error('[CashPilot Mobile] Screen action failed:', error);
    state.notice = getMobileCopy(getLang()).contentError;
    renderError();
  }
});

root?.addEventListener('input', event => {
  try {
    handleInput(event);
  } catch (error) {
    console.error('[CashPilot Mobile] Search failed:', error);
    renderError();
  }
});

if (globalThis.window) {
  globalThis.window.App = Object.assign(globalThis.window.App || {}, {
    handleAndroidBack: handleBack,
  });
}

try {
  render();
} catch (error) {
  console.error('[CashPilot Mobile] Initial render failed:', error);
  renderError();
}
