/**
 * @module pages/analytics
 */
import { getState }                          from '../core/state.js';
import { t } from '../core/i18n.js';
import { formatCurrency, formatPercent, animateValue } from '../core/utils.js';
import * as Finance                          from '../services/finance.js';
import { renderLineChart, renderCategoryChart } from '../charts/charts.js';

export function renderAnalytics() {
  const { filterMonth: m, filterYear: y } = getState();
  const summary = Finance.getMonthSummary(m, y);
  
  // Render Health Score
  const score = Finance.getFinancialHealthScore(summary);
  const scoreEl = document.getElementById('analytics-health-score');
  const pathEl = document.getElementById('health-score-path');
  const textEl = document.getElementById('analytics-health-text');
  
  if (scoreEl && pathEl && textEl) {
    animateValue(scoreEl, 0, score, 1500, v => v);
    
    // Reset path then animate
    pathEl.style.strokeDasharray = `0, 100`;
    setTimeout(() => {
      pathEl.style.strokeDasharray = `${score}, 100`;
    }, 100);

    let color = 'var(--color-positive)';
    let text = t('health_excellent');
    if (score < 50) {
       color = 'var(--color-negative)';
       text = t('health_critical');
    } else if (score < 80) {
       color = 'var(--color-warning)';
       text = t('health_good');
    }
    
    scoreEl.style.color = color;
    pathEl.style.stroke = color;
    textEl.textContent = text;
  }

  const rows = [
    {
      label: t('stat_total_inc'),
      numValue: summary.income,
      formatFn: formatCurrency,
      pct:   100,
      color: 'positive',
    },
    {
      label: t('stat_total_exp'),
      numValue: summary.expenses,
      formatFn: formatCurrency,
      pct:   summary.spendRate,
      color: 'negative',
    },
    {
      label: t('stat_net'),
      numValue: summary.net,
      formatFn: formatCurrency,
      pct:   Math.max(0, summary.savingRate),
      color: summary.net >= 0 ? 'positive' : 'negative',
    },
    {
      label: t('stat_total_debts'),
      numValue: summary.debts,
      formatFn: formatCurrency,
      pct:   summary.income > 0 ? Math.min(100, summary.debts / summary.income * 100) : 0,
      color: 'negative',
    },
    {
      label: t('stat_total_inv'),
      numValue: summary.investments,
      formatFn: formatCurrency,
      pct:   summary.income > 0 ? Math.min(100, summary.investments / summary.income * 100) : 0,
      color: 'brand',
    },
    {
      label: t('stat_saving_rate'),
      numValue: summary.savingRate,
      formatFn: formatPercent,
      pct:   Math.max(0, summary.savingRate),
      color: 'positive',
    },
    {
      label: t('stat_budget_commitment'),
      numValue: 100 - summary.budgetRate,
      formatFn: formatPercent,
      pct:   Math.max(0, 100 - summary.budgetRate),
      color: 'warning',
    },
  ];

  const container = document.getElementById('analytics-table');
  if (container) {
    container.innerHTML = rows.map((row, i) => `
      <div class="analytics-row fade-in stagger-enter" style="animation-delay: ${0.05 * i}s">
        <div class="analytics-label">${row.label}</div>
        <div class="analytics-value" id="analytics-row-val-${i}"
             style="color:var(--color-${row.color})">
          0
        </div>
        <div class="analytics-progress">
          <div class="progress-wrap" style="margin:0; background: var(--color-bg-input);">
            <div class="progress-bar"
                 style="background: var(--color-${row.color}); width:0; transition: width 1s var(--ease-out) ${0.1 * i}s; width:${Math.min(100, row.pct).toFixed(0)}%"></div>
          </div>
          <div class="analytics-pct" style="font-size:10px;color:var(--color-text-muted);text-align:center;margin-top:3px">
            ${row.pct.toFixed(0)}%
          </div>
        </div>
      </div>`).join('');
      
    // Animate values
    rows.forEach((row, i) => {
      const el = document.getElementById(`analytics-row-val-${i}`);
      if (el) {
        animateValue(el, 0, row.numValue, 1200 + (i * 100), row.formatFn);
      }
    });
  }

  renderLineChart(Finance.getBalanceTrend(m, y));
  renderCategoryChart(Finance.expensesByCategory(m, y));
}
