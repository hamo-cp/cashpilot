/**
 * @module pages/income
 */
import { getState }                          from '../core/state.js';
import { t } from '../core/i18n.js';
import { formatCurrency, formatDate, matchPeriod, today } from '../core/utils.js';
import * as Finance                          from '../services/finance.js';
import { incomeItemHTML, emptyStateHTML }    from '../ui/components.js';
import { openModal }                         from '../ui/modal.js';
import * as Toast                            from '../ui/toast.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderIncome() {
  const { filterMonth: m, filterYear: y } = getState();
  const list  = Finance.getIncome().filter(i => matchPeriod(i.date, m, y));
  const total = list.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  set('income-total', formatCurrency(total));
  set('income-count', String(list.length));

  const container = document.getElementById('income-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = emptyStateHTML('ic-dollar', t('empty_income'), t('empty_income_sub'));
    return;
  }
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(incomeItemHTML).join('');
}

export function openIncomeModal(editId = null) {
  const item  = editId ? Finance.getIncome().find(i => i.id === editId) : null;
  const modal = document.getElementById('incomeModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('inc-name').value   = item?.name   || '';
  document.getElementById('inc-amount').value = item?.amount || '';
  document.getElementById('inc-source').value = item?.source || 'salary';
  document.getElementById('inc-date').value   = item?.date   || today();
  document.getElementById('inc-notes').value  = item?.notes  || '';

  openModal('incomeModal');
  return editId; // returns editId so caller can store it
}

export function saveIncome(editingId, onDone) {
  const nameEl   = document.getElementById('inc-name');
  const amountEl = document.getElementById('inc-amount');
  const dateEl   = document.getElementById('inc-date');

  const name   = nameEl?.value.trim()    || '';
  const amount = parseFloat(amountEl?.value);
  const source = document.getElementById('inc-source')?.value;
  const date   = dateEl?.value           || '';
  const notes  = document.getElementById('inc-notes')?.value.trim() || '';

  if (!name)                        return Toast.show(t('income_name_required'), 'error');
  if (name.length > 100)            return Toast.show(t('toast_invalid'), 'error');
  if (!amountEl?.value.trim())      return Toast.show(t('amount_required'), 'error');
  if (isNaN(amount) || amount <= 0) return Toast.show(t('amount_positive'), 'error');
  if (amount > 999_999_999)         return Toast.show(t('toast_invalid'), 'error');
  if (!date)                        return Toast.show(t('date_input_required'), 'error');

  const data = { name, amount, source, date, notes };

  if (editingId) {
    Finance.updateIncome(editingId, data);
    Toast.show(t('toast_updated'), 'success');
  } else {
    Finance.addIncome(data);
    Toast.show(t('toast_added'), 'success');
  }
  onDone?.();
}
