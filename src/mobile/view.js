import { esc, formatCurrency } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { formatLocalDate } from './model.js';

export function renderTransactionRows(records, { locale = 'en-US', copy }) {
  return records.map(record => {
    const type = record.type === 'income' ? 'income' : 'expense';
    const title = String(record.name || copy.untitled);
    const categoryKey = type === 'income'
      ? 'inc_' + String(record.source || 'other')
      : 'cat_' + String(record.category || 'other');
    const category = t(categoryKey);
    const date = formatLocalDate(record.date, locale);
    const amount = Number(record.amount);
    const amountText = Number.isFinite(amount) && amount >= 0 ? formatCurrency(amount) : '—';
    const sign = type === 'income' ? '+' : '−';
    const typeLabel = type === 'income' ? copy.incomeFilter : copy.expenseFilter;
    const marker = type === 'income' ? '+' : '−';

    return [
      '<article class="transaction-row" data-kind="', type, '">',
      '<span class="transaction-marker transaction-marker--', type, '" aria-hidden="true">', marker, '</span>',
      '<span class="transaction-main">',
      '<span class="transaction-name">', esc(title), '</span>',
      '<span class="transaction-meta"><span>', esc(category), '</span><span aria-hidden="true"> · </span><time datetime="', esc(record.date || ''), '">', esc(date), '</time></span>',
      '<span class="sr-only">', esc(typeLabel), '</span>',
      '</span>',
      '<bdi class="transaction-amount transaction-amount--', type, '" dir="ltr">', sign, esc(amountText), '</bdi>',
      '</article>',
    ].join('');
  }).join('');
}

export function formatMobileAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? formatCurrency(amount) : '—';
}
