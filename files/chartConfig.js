/**
 * @module charts/chartConfig
 * @description إعدادات Chart.js المشتركة وأوضاع الألوان.
 * كل الرسوم البيانية تستورد من هنا لضمان التناسق البصري.
 */

/** ألوان قياسية متوافقة مع Design System */
export const CHART_COLORS = Object.freeze({
  income:      '#22c55e',
  expenses:    '#ef4444',
  debts:       '#f59e0b',
  investments: '#8b5cf6',
  brand:       '#4f7cff',
});

/** لوحة ألوان للرسوم الدائرية */
export const PALETTE = Object.freeze([
  '#ef4444', '#4f7cff', '#22c55e', '#f59e0b',
  '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899',
]);

/**
 * إعدادات Grid وTicks مشتركة
 * @param {boolean} isDark
 */
export function gridConfig(isDark) {
  const gridColor = isDark ? 'hsla(0,0%,100%,0.04)' : 'hsla(0,0%,0%,0.05)';
  const tickColor = isDark ? '#4a5568' : '#94a3b8';
  return { gridColor, tickColor };
}

/**
 * إعدادات Legend المشتركة
 * @param {boolean} isDark
 */
export function legendConfig(isDark) {
  return {
    position: 'bottom',
    labels: {
      color:          isDark ? '#8492a6' : '#6b7280',
      font:           { family: 'Cairo', size: 11 },
      padding:        12,
      usePointStyle:  true,
    },
  };
}

/**
 * Tooltip callback للعملة
 * @param {Function} formatCurrency
 */
export function currencyTooltip(formatCurrency) {
  return {
    callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y ?? ctx.parsed)}` },
  };
}

/** إعداد Chart.js العام عند تحميل الصفحة */
export function applyGlobalDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = 'Cairo, sans-serif';
  Chart.defaults.color       = '#8492a6';
}
