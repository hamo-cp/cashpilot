/**
 * @module pages/transactions
 */
import { getState, setState }        from '../core/state.js';
import { t } from '../core/i18n.js';
import { formatDate }                from '../core/utils.js';
import * as Finance                  from '../services/finance.js';
import { txItemHTML, emptyStateHTML } from '../ui/components.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderTransactions() {
  const { filterMonth: m, filterYear: y, searchQuery } = getState();
  const all = Finance.searchTransactions(searchQuery, m, y);

  set('tx-count', `${t('count_label')}: ${all.length}`);

  const container = document.getElementById('transactions-list');
  if (!container) return;

  if (!all.length) {
    container.innerHTML = emptyStateHTML('ic-search', t('empty_tx'), t('empty_tx_search_sub'));
    return;
  }

  // تجميع حسب التاريخ
  const grouped = {};
  all.forEach(tx => {
    const key = tx.date || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  });

  container.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => (b ? new Date(b).getTime() : 0) - (a ? new Date(a).getTime() : 0))
    .map(([date, txs]) => `
      <div class="tx-date-header">${date ? formatDate(date) : t('date_unspecified')}</div>
      ${txs.map(txItemHTML).join('')}
    `).join('');
}

/** فلترة بالنوع أو الفئة — تُستدعى من filterTx() في index.html */
export function filterTransactions(type) {
  const { filterMonth: m, filterYear: y, searchQuery } = getState();
  let all = Finance.searchTransactions(searchQuery, m, y);

  if (type !== 'all') {
    all = all.filter(tx => {
      if (type === 'income')  return tx.type === 'income';
      if (type === 'expense') return tx.type === 'expense';
      return tx.category === type;
    });
  }

  const container = document.getElementById('transactions-list');
  if (!container) return;

  if (!all.length) {
    container.innerHTML = emptyStateHTML('ic-search', t('empty_tx'), t('empty_tx_filter_sub'));
  } else {
    container.innerHTML = all.map(txItemHTML).join('');
  }

  const countEl = document.getElementById('tx-count');
  if (countEl) countEl.textContent = `${t('count_label')}: ${all.length}`;
}

/** ربط حقل البحث */
export function bindSearchInput() {
  const input = document.getElementById('tx-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    setState({ searchQuery: e.target.value });
    renderTransactions();
  });
}
