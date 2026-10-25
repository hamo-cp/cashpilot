export const MOBILE_SCREENS = Object.freeze([
  'home',
  'activity',
  'plan',
  'insights',
  'more',
]);

export function getCurrentPeriod(now = new Date()) {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function normalizePeriod(period, now = new Date()) {
  const month = Number(period?.month);
  const year = Number(period?.year);
  if (Number.isInteger(month) && month >= 1 && month <= 12
      && Number.isInteger(year) && year >= 1900 && year <= 9999) {
    return { month, year };
  }
  return getCurrentPeriod(now);
}

export function shiftPeriod(period, offset) {
  const current = normalizePeriod(period);
  const shifted = new Date(current.year, current.month - 1 + Number(offset || 0), 1);
  return { month: shifted.getMonth() + 1, year: shifted.getFullYear() };
}

export function getHomeViewModel(finance, period, limit = 4) {
  const selected = normalizePeriod(period);
  const recentLimit = Number.isInteger(limit) ? Math.max(0, limit) : 4;
  return {
    ...selected,
    summary: finance.getMonthSummary(selected.month, selected.year),
    recent: finance.searchTransactions('', selected.month, selected.year).slice(0, recentLimit),
  };
}

export function getActivityViewModel(finance, options = {}) {
  const selected = normalizePeriod(options.period, options.now);
  const query = String(options.query ?? '');
  const type = options.type === 'income' || options.type === 'expense'
    ? options.type
    : 'all';
  const matches = finance.searchTransactions(query, selected.month, selected.year);
  return {
    ...selected,
    type,
    query,
    transactions: type === 'all' ? matches : matches.filter(item => item.type === type),
  };
}

export function formatLocalDate(value, locale = 'en-US') {
  if (typeof value !== 'string' || value.length === 0) return '—';

  const dateOnly = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  let date;
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return '—';
    }
  } else {
    date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatPeriodLabel(period, locale = 'en-US') {
  const selected = normalizePeriod(period);
  const date = new Date(selected.year, selected.month - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
