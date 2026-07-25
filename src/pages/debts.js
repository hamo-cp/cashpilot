/**
 * @module pages/debts
 */
import { formatCurrency }              from '../core/utils.js';
import { t } from '../core/i18n.js';
import * as Finance                    from '../services/finance.js';
import { debtCardHTML, emptyStateHTML } from '../ui/components.js';
import { openModal }                   from '../ui/modal.js';
import * as Toast                      from '../ui/toast.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderDebts() {
  const list  = Finance.getDebts();
  const total = Finance.totalDebts();

  set('debts-total', formatCurrency(total));
  set('debts-count', list.length + ' دين');

  const container = document.getElementById('debts-list');
  if (!container) return;

  container.innerHTML = list.length
    ? list.map(debtCardHTML).join('')
    : emptyStateHTML('ic-target', 'لا توجد ديون مسجلة', 'ممتاز! يمكنك إضافة أي ديون لمتابعتها');
}

export function openDebtModal(editId = null) {
  const item  = editId ? Finance.getDebts().find(i => i.id === editId) : null;
  const modal = document.getElementById('debtModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('debt-creditor').value = item?.creditor || '';
  document.getElementById('debt-amount').value   = item?.amount   || '';
  document.getElementById('debt-paid').value     = item?.paid     || '0';
  document.getElementById('debt-due').value      = item?.dueDate  || '';
  document.getElementById('debt-notes').value    = item?.notes    || '';

  openModal('debtModal');
  return editId;
}

export function saveDebt(editingId, onDone) {
  const creditorEl = document.getElementById('debt-creditor');
  const amountEl   = document.getElementById('debt-amount');
  const paidEl     = document.getElementById('debt-paid');

  const creditor = creditorEl?.value.trim()  || '';
  const amount   = parseFloat(amountEl?.value);
  const paid     = parseFloat(paidEl?.value) || 0;
  const dueDate  = document.getElementById('debt-due')?.value   || '';
  const notes    = document.getElementById('debt-notes')?.value.trim() || '';

  if (!creditor)                     return Toast.show('أدخل اسم الدائن', 'error');
  if (creditor.length > 100)         return Toast.show(t('toast_invalid'), 'error');
  if (!amountEl?.value.trim())       return Toast.show('أدخل قيمة الدين', 'error');
  if (isNaN(amount) || amount <= 0)  return Toast.show('قيمة الدين يجب أن تكون رقماً موجباً', 'error');
  if (amount > 999_999_999)          return Toast.show('القيمة كبيرة جداً', 'error');
  if (paid < 0)                      return Toast.show(t('toast_invalid'), 'error');
  if (paid > amount)                 return Toast.show(t('toast_invalid'), 'error');

  const data = { creditor, amount, paid, dueDate, notes };

  if (editingId) {
    Finance.updateDebt(editingId, data);
    Toast.show('تم تعديل الدين', 'success');
  } else {
    Finance.addDebt(data);
    Toast.show('تم إضافة الدين', 'success');
  }
  onDone?.();
}
