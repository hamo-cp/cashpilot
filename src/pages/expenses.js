/**
 * @module pages/expenses
 */
import { getState }                        from '../core/state.js';
import { formatCurrency, matchPeriod }     from '../core/utils.js';
import * as Finance                        from '../services/finance.js';
import { expenseItemHTML, emptyStateHTML, categorySummaryHTML } from '../ui/components.js';
import { renderBarChart }                  from '../charts/charts.js';
import { openModal }                       from '../ui/modal.js';
import * as Toast                          from '../ui/toast.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderExpenses() {
  const { filterMonth: m, filterYear: y } = getState();
  const list  = Finance.getExpenses().filter(i => matchPeriod(i.date, m, y));
  const total = list.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  set('exp-total', formatCurrency(total));
  set('exp-count', list.length + ' عملية');

  // Category summary
  const catSummary = document.getElementById('exp-categories-summary');
  if (catSummary) {
    const byCat  = Finance.expensesByCategory(m, y);
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
    catSummary.innerHTML = sorted.length
      ? sorted.map(([cat, amt]) => {
          const pct = total > 0 ? (amt / total * 100) : 0;
          return categorySummaryHTML(cat, amt, pct);
        }).join('')
      : '<p class="text-muted" style="padding:12px 0;text-align:center">لا توجد بيانات</p>';
  }

  // List
  const container = document.getElementById('expenses-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = emptyStateHTML('ic-shopping', 'لا توجد مصروفات', 'اضغط + لتسجيل مصروف جديد');
    return;
  }
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(expenseItemHTML).join('');

  renderBarChart(Finance.dailyExpenses(m, y));
}

export function openExpenseModal(editId = null) {
  const item  = editId ? Finance.getExpenses().find(i => i.id === editId) : null;
  const modal = document.getElementById('expenseModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('exp-name').value     = item?.name     || '';
  document.getElementById('exp-amount').value   = item?.amount   || '';
  document.getElementById('exp-category').value = item?.category || 'food';
  document.getElementById('exp-date').value     = item?.date     || new Date().toISOString().split('T')[0];
  document.getElementById('exp-notes').value    = item?.notes    || '';

  openModal('expenseModal');
  return editId;
}

export function saveExpense(editingId, onDone) {
  const nameEl     = document.getElementById('exp-name');
  const amountEl   = document.getElementById('exp-amount');
  const dateEl     = document.getElementById('exp-date');

  const name     = nameEl?.value.trim()     || '';
  const amount   = parseFloat(amountEl?.value);
  const category = document.getElementById('exp-category')?.value;
  const date     = dateEl?.value            || '';
  const notes    = document.getElementById('exp-notes')?.value.trim() || '';

  if (!name)                        return Toast.show('أدخل اسم المصروف', 'error');
  if (name.length > 100)            return Toast.show('الاسم طويل جداً (100 حرف كحد أقصى)', 'error');
  if (!amountEl?.value.trim())      return Toast.show('أدخل المبلغ', 'error');
  if (isNaN(amount) || amount <= 0) return Toast.show('المبلغ يجب أن يكون رقماً موجباً', 'error');
  if (amount > 999_999_999)         return Toast.show('المبلغ كبير جداً', 'error');
  if (!date)                        return Toast.show('أدخل التاريخ', 'error');

  const data = { name, amount, category, date, notes };

  if (editingId) {
    Finance.updateExpense(editingId, data);
    Toast.show('تم تعديل المصروف', 'success');
  } else {
    Finance.addExpense(data);
    Toast.show('تم تسجيل المصروف', 'success');
  }
  onDone?.();
}
