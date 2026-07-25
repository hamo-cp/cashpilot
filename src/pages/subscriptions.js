/**
 * @module pages/subscriptions
 */
import { formatCurrency, formatDate, svgIcon } from '../core/utils.js';
import * as Finance from '../services/finance.js';
import { getState, setState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { closeModal, openModal } from '../ui/modal.js';

export function renderSubscriptions() {
  const subs = Finance.getSubscriptions();
  const list = document.getElementById('subs-list');
  const empty = document.getElementById('subs-empty');
  
  if (!list || !empty) return;

  if (subs.length === 0) {
    list.innerHTML = '';
    list.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = subs.map(sub => `
    <div class="card p-16 fade-in" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,152,0,0.15);color:#ff9800;display:flex;align-items:center;justify-content:center;">
          <svg class="icon" viewBox="0 0 24 24"><use href="#ic-clock"/></svg>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:4px;">${sub.name}</div>
          <div style="font-size:12px;color:var(--color-text-muted);">
            تجديد: ${formatDate(sub.dueDate)}
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:bold;color:var(--color-brand);margin-bottom:4px;">
          ${formatCurrency(sub.amount)}
        </div>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="btn btn-ghost" style="padding:4px;color:var(--color-text-muted);" onclick="App.openSubscriptionModal('${sub.id}')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><use href="#ic-edit"/></svg>
          </button>
          <button class="btn btn-ghost" style="padding:4px;color:var(--color-negative);" onclick="App.confirmDelete('subscription', '${sub.id}')">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><use href="#ic-trash"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

export function openSubscriptionModal(id = null) {
  const form = {
    name: document.getElementById('sub-name'),
    amount: document.getElementById('sub-amount'),
    due: document.getElementById('sub-due'),
  };
  
  if (id) {
    const sub = Finance.getSubscriptions().find(s => s.id === id);
    if (!sub) return;
    form.name.value = sub.name;
    form.amount.value = sub.amount;
    form.due.value = sub.dueDate;
    setState({ editId: id });
  } else {
    form.name.value = '';
    form.amount.value = '';
    form.due.value = '';
    setState({ editId: null });
  }
  openModal('subscriptionModal');
}

export function saveSubscription(onDone) {
  const name = document.getElementById('sub-name').value.trim();
  const amount = parseFloat(document.getElementById('sub-amount').value);
  const due = document.getElementById('sub-due').value;
  
  if (!name || isNaN(amount) || amount <= 0 || !due) {
    return false; // Error handled by UI layer (Toast)
  }
  
  const { editId } = getState();
  const data = { name, amount, dueDate: due };
  
  if (editId) {
    Finance.updateSubscription(editId, data);
  } else {
    Finance.addSubscription(data);
  }
  
  closeModal('subscriptionModal');
  renderSubscriptions();
  if (onDone) onDone();
  return true;
}
