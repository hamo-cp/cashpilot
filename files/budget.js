/**
 * @module pages/budget
 */
import { getState }           from '../core/state.js';
import { formatCurrency, svgIcon } from '../core/utils.js';
import { BUDGET_CATEGORIES }  from '../core/constants.js';
import * as Finance           from '../services/finance.js';

export function renderBudget() {
  const { filterMonth: m, filterYear: y } = getState();
  const budget = Finance.getBudget();
  const byCat  = Finance.expensesByCategory(m, y);

  // حقول الإدخال
  const inputsContainer = document.getElementById('budget-inputs');
  if (inputsContainer) {
    inputsContainer.innerHTML = BUDGET_CATEGORIES.map(cat => `
      <div class="budget-input-row">
        <span class="budget-input-icon">${svgIcon(cat.iconId)}</span>
        <span class="budget-input-label">${cat.label}</span>
        <input type="number" class="budget-input-field" id="budget-${cat.key}"
          value="${budget[cat.key] || ''}" placeholder="0"
          onchange="App.saveBudgetField('${cat.key}', this.value)" min="0" step="50">
      </div>`).join('');
  }

  // تقرير التقدم
  const reportContainer = document.getElementById('budget-report');
  if (reportContainer) {
    reportContainer.innerHTML = BUDGET_CATEGORIES.map(cat => {
      const budgeted  = parseFloat(budget[cat.key]) || 0;
      const spent     = byCat[cat.key] || 0;
      const remaining = budgeted - spent;
      const pct       = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
      const barColor  = pct >= 100 ? 'red' : pct >= 80 ? 'orange' : cat.color;
      const remainColor = remaining < 0
        ? 'var(--color-negative)'
        : remaining === 0 && budgeted === 0
          ? 'var(--color-text-muted)'
          : 'var(--color-positive)';

      return `
        <div class="budget-category">
          <div class="budget-category-header">
            <div class="budget-category-name">
              <span class="budget-category-icon">${svgIcon(cat.iconId)}</span>
              ${cat.label}
            </div>
            <div class="budget-category-amounts">
              ${budgeted > 0
                ? `<strong style="color:var(--color-brand)">${formatCurrency(spent)}</strong> / ${formatCurrency(budgeted)}`
                : `<span style="color:var(--color-text-muted)">لم تُحدد ميزانية</span>`}
            </div>
          </div>
          ${budgeted > 0 ? `
          <div class="progress-wrap">
            <div class="progress-bar progress-${barColor}" style="width:${pct.toFixed(0)}%"></div>
          </div>
          <div class="budget-status">
            <span>${pct.toFixed(0)}% مستخدم</span>
            <span style="color:${remainColor}">
              ${remaining >= 0
                ? 'متبقي ' + formatCurrency(remaining)
                : 'تجاوزت بـ ' + formatCurrency(Math.abs(remaining))}
            </span>
          </div>` : ''}
        </div>`;
    }).join('');
  }
}

export function saveBudgetField(key, value, onDone) {
  const budget  = Finance.getBudget();
  budget[key]   = parseFloat(value) || 0;
  Finance.setBudget(budget);
  setTimeout(() => onDone?.(), 50);
}
