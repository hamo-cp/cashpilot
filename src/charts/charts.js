import { t } from '../core/i18n.js';
/**
 * @module charts/charts
 * @description جميع دوال رسم الـ Charts — كل دالة تُنشئ أو تُحدّث chart واحد.
 * تستخدم Chart.js من window (CDN) عبر المتغير العالمي `Chart`.
 */

import { getCharts }           from '../core/state.js';
import { formatCurrency }      from '../core/utils.js';
import { EXPENSE_CATEGORIES }  from '../core/constants.js';
import {
  gridConfig, legendConfig, currencyTooltip,
  CHART_COLORS, PALETTE,
} from './chartConfig.js';

/** الحصول على وضع الثيم الحالي */
function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

/** تحقق من أن Chart.js محمّل */
function chartAvailable() {
  return typeof Chart !== 'undefined';
}

/** تدمير chart قديم إن وجد */
function destroyIfExists(key) {
  try {
    const charts = getCharts();
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  } catch { /* ignore destroy errors */ }
}

/* ════════════════════════════════════════
   Donut Chart — توزيع الأموال
   ════════════════════════════════════════ */
export function renderDonutChart(summary) {
  const ctx = document.getElementById('donutChart');
  if (!ctx || !chartAvailable()) return;

  destroyIfExists('donut');

  const isDark = isDarkMode();
  const total  = summary.expenses + summary.net + summary.debts + summary.investments;
  if (total <= 0) return;

  try {
    getCharts().donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [t('dash_expenses'), t('dash_saving_rate'), t('more_debts'), t('more_inv')],
      datasets: [{
        data: [
          Math.max(0, summary.expenses),
          Math.max(0, summary.net),
          Math.max(0, summary.debts),
          Math.max(0, summary.investments),
        ],
        backgroundColor: [
          CHART_COLORS.expenses,
          CHART_COLORS.income,
          CHART_COLORS.debts,
          CHART_COLORS.investments,
        ],
        borderColor:  isDark ? '#0b0f17' : '#ffffff',
        borderWidth:  3,
        hoverOffset:  6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '65%',
      plugins: {
        legend:  legendConfig(isDark),
        tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed)}` } },
      },
    },
  });
  } catch (err) {
    console.error('[Chart] donut render failed:', err);
  }
}

/* ════════════════════════════════════════
   Bar Chart — الإنفاق اليومي
   ════════════════════════════════════════ */
export function renderBarChart(dailyData) {
  const ctx = document.getElementById('barChart');
  if (!ctx || !chartAvailable()) return;

  destroyIfExists('bar');

  const isDark          = isDarkMode();
  const { gridColor, tickColor } = gridConfig(isDark);
  const labels          = Object.keys(dailyData).map(String);
  const data            = Object.values(dailyData);

  try {
  getCharts().bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           t('chart_daily_spend'),
        data,
        backgroundColor: 'hsla(0,84%,60%,0.5)',
        borderColor:     CHART_COLORS.expenses,
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: currencyTooltip(formatCurrency),
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: { color: tickColor, font: { size: 9 }, maxRotation: 0 },
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color:    tickColor,
            font:     { size: 10 },
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + t('abbr_k') : v,
          },
        },
      },
    },
  });
  } catch (err) {
    console.error('[Chart] bar render failed:', err);
  }
}

/* ════════════════════════════════════════
   Line Chart — تطور الرصيد
   ════════════════════════════════════════ */
export function renderLineChart(trend) {
  const ctx = document.getElementById('lineChart');
  if (!ctx || !chartAvailable()) return;

  destroyIfExists('line');

  const isDark                   = isDarkMode();
  const { gridColor, tickColor } = gridConfig(isDark);

  try {
  getCharts().line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label:                    t('balance'),
        data:                     trend.data,
        borderColor:              CHART_COLORS.brand,
        backgroundColor:          'hsla(224,100%,65%,0.06)',
        borderWidth:              2,
        pointRadius:              0,
        pointHoverRadius:         5,
        pointHoverBackgroundColor: CHART_COLORS.brand,
        fill:                     true,
        tension:                  0.4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend:  { display: false },
        tooltip: currencyTooltip(formatCurrency),
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: { color: tickColor, font: { size: 10 } },
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color:    tickColor,
            font:     { size: 10 },
            callback: (v) => v >= 1000 ? (v / 1000).toFixed(1) + t('abbr_k') : v,
          },
        },
      },
    },
  });
  } catch (err) {
    console.error('[Chart] line render failed:', err);
  }
}

/* ════════════════════════════════════════
   Category Donut — توزيع المصروفات
   ════════════════════════════════════════ */
export function renderCategoryChart(byCat) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx || !chartAvailable()) return;

  destroyIfExists('category');

  const entries = Object.entries(byCat).filter(([, v]) => v > 0);
  if (!entries.length) return;

  const isDark = isDarkMode();

  try {
  getCharts().category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => t((EXPENSE_CATEGORIES[k] || EXPENSE_CATEGORIES.other).label)),
      datasets: [{
        data:            entries.map(([, v]) => v),
        backgroundColor: PALETTE.slice(0, entries.length),
        borderColor:     isDark ? '#0b0f17' : '#ffffff',
        borderWidth:     2,
        hoverOffset:     4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '60%',
      plugins: {
        legend:  legendConfig(isDark),
        tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed)}` } },
      },
    },
  });
  } catch (err) {
    console.error('[Chart] category render failed:', err);
  }
}
