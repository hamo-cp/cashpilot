/**
 * @module pages/analytics
 */
import { getState }                          from '../core/state.js';
import { formatCurrency, formatPercent }     from '../core/utils.js';
import * as Finance                          from '../services/finance.js';
import { renderLineChart, renderCategoryChart } from '../charts/charts.js';

export function renderAnalytics() {
  const { filterMonth: m, filterYear: y } = getState();
  const summary = Finance.getMonthSummary(m, y);

  const rows = [
    {
      label: 'إجمالي الدخل',
      value: formatCurrency(summary.income),
      pct:   100,
      color: 'green',
    },
    {
      label: 'إجمالي المصروفات',
      value: formatCurrency(summary.expenses),
      pct:   summary.spendRate,
      color: 'red',
    },
    {
      label: 'صافي الرصيد',
      value: formatCurrency(summary.net),
      pct:   Math.max(0, summary.savingRate),
      color: summary.net >= 0 ? 'green' : 'red',
    },
    {
      label: 'إجمالي الديون',
      value: formatCurrency(summary.debts),
      pct:   summary.income > 0 ? Math.min(100, summary.debts / summary.income * 100) : 0,
      color: 'red',
    },
    {
      label: 'إجمالي الاستثمارات',
      value: formatCurrency(summary.investments),
      pct:   summary.income > 0 ? Math.min(100, summary.investments / summary.income * 100) : 0,
      color: 'purple',
    },
    {
      label: 'نسبة الادخار',
      value: formatPercent(summary.savingRate),
      pct:   Math.max(0, summary.savingRate),
      color: 'cyan',
    },
    {
      label: 'الالتزام بالميزانية',
      value: formatPercent(100 - summary.budgetRate),
      pct:   Math.max(0, 100 - summary.budgetRate),
      color: 'gold',
    },
  ];

  const container = document.getElementById('analytics-table');
  if (container) {
    container.innerHTML = rows.map(row => `
      <div class="analytics-row fade-in">
        <div class="analytics-label">${row.label}</div>
        <div class="analytics-value"
             style="color:var(--color-${row.color === 'cyan' ? 'brand' : row.color === 'gold' ? 'warning' : row.color})">
          ${row.value}
        </div>
        <div class="analytics-progress">
          <div class="progress-wrap" style="margin:0">
            <div class="progress-bar progress-${row.color}"
                 style="width:${Math.min(100, row.pct).toFixed(0)}%"></div>
          </div>
          <div style="font-size:10px;color:var(--color-text-muted);text-align:center;margin-top:3px">
            ${row.pct.toFixed(0)}%
          </div>
        </div>
      </div>`).join('');
  }

  renderLineChart(Finance.getBalanceTrend(m, y));
  renderCategoryChart(Finance.expensesByCategory(m, y));
}
