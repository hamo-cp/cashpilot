/**
 * @module pages/subscriptions
 */
import { esc, formatCurrency, formatDate, svgIcon } from '../core/utils.js';
import * as Finance from '../services/finance.js';
import { setState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { openModal } from '../ui/modal.js';
import * as Toast from '../ui/toast.js';
import { BACKUP_LIMITS } from '../services/backup.js';

export const SUBSCRIPTION_LIMITS = Object.freeze({
  maxRecords: BACKUP_LIMITS.maxRecords,
  maxAmount: BACKUP_LIMITS.maxAmount,
  maxNameLength: 200,
});

function isValidDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

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
  list.innerHTML = subs.map(subscriptionItemHTML).join('');
}

export function subscriptionItemHTML(sub) {
  return `
    <div class="card p-16 fade-in" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,152,0,0.15);color:#ff9800;display:flex;align-items:center;justify-content:center;">
          <svg class="icon" viewBox="0 0 24 24"><use href="#ic-clock"/></svg>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:4px;">${esc(sub.name)}</div>
          <div style="font-size:12px;color:var(--color-text-muted);">
            ${t('subscription_renewal')}: ${formatDate(sub.dueDate)}
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="subscription-amount" style="font-weight:bold;color:var(--color-brand);margin-bottom:4px;">
          ${formatCurrency(sub.amount)}
        </div>
        <div style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="btn btn-ghost" style="padding:4px;color:var(--color-text-muted);" title="${esc(t('edit'))}" aria-label="${esc(t('edit'))}"
                  data-app-action="edit" data-item-type="subscription" data-item-id="${esc(sub.id)}">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><use href="#ic-edit"/></svg>
          </button>
          <button class="btn btn-ghost" style="padding:4px;color:var(--color-negative);" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}"
                  data-app-action="delete" data-item-type="subscription" data-item-id="${esc(sub.id)}">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><use href="#ic-trash"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function openSubscriptionModal(id = null) {
  const form = {
    name: document.getElementById('sub-name'),
    amount: document.getElementById('sub-amount'),
    due: document.getElementById('sub-due'),
  };
  Object.values(form).forEach(field => field?.removeAttribute?.('aria-invalid'));
  
  if (id) {
    const sub = Finance.getSubscriptions().find(s => s.id === id);
    if (!sub) return;
    form.name.value = sub.name;
    form.amount.value = sub.amount;
    form.due.value = sub.dueDate;
    setState({ editingId: id });
  } else {
    form.name.value = '';
    form.amount.value = '';
    form.due.value = '';
    setState({ editingId: null });
  }
  openModal('subscriptionModal');
}

export function saveSubscription(editingId, onDone) {
  const form = {
    name: document.getElementById('sub-name'),
    amount: document.getElementById('sub-amount'),
    due: document.getElementById('sub-due'),
  };
  const name = form.name.value.trim();
  const amount = Number(form.amount.value);
  const due = form.due.value;
  const invalidFields = [];

  Object.values(form).forEach(field => field.removeAttribute?.('aria-invalid'));
  if (!name || name.length > SUBSCRIPTION_LIMITS.maxNameLength) invalidFields.push(form.name);
  if (!Number.isFinite(amount) || amount <= 0 || amount > SUBSCRIPTION_LIMITS.maxAmount) {
    invalidFields.push(form.amount);
  }
  if (!isValidDateInput(due)) invalidFields.push(form.due);
  const recordLimitReached = !editingId
    && Finance.getSubscriptions().length >= SUBSCRIPTION_LIMITS.maxRecords;
  
  if (invalidFields.length > 0 || recordLimitReached) {
    invalidFields.forEach(field => field.setAttribute?.('aria-invalid', 'true'));
    Toast.show(t('toast_invalid'), 'error');
    if (invalidFields[0]) {
      try {
        invalidFields[0].focus({ preventScroll: true });
      } catch {
        invalidFields[0].focus?.();
      }
    }
    return false;
  }
  
  const data = { name, amount, dueDate: due };
  
  if (editingId) {
    Finance.updateSubscription(editingId, data);
  } else {
    Finance.addSubscription(data);
  }
  
  onDone?.();
  return true;
}
