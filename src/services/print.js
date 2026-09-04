/**
 * @module services/print
 * @description توليد تقرير شهري قابل للطباعة في نافذة جديدة.
 */

import { getState }               from '../core/state.js';
import { formatCurrency, formatPercent } from '../core/utils.js';
import { MONTH_NAMES }            from '../core/constants.js';
import { getMonthSummary }        from './finance.js';
import { getLang, t, tf }         from '../core/i18n.js';

export function printSummary() {
  const { filterMonth: m, filterYear: y } = getState();
  const s         = getMonthSummary(m, y);
  const lang      = getLang();
  const dir       = lang === 'ar' ? 'rtl' : 'ltr';
  const monthName = t(MONTH_NAMES[m - 1]);
  const dateStr   = new Date().toLocaleDateString(t('locale'));

  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(`
    <!DOCTYPE html>
    <html lang="${lang}" dir="${dir}">
    <head>
      <meta charset="UTF-8">
      <title>${tf('print_title', { month: monthName, year: y })}</title>
      <style>
        body  { font-family: Cairo, Arial, sans-serif; padding: 30px; color: #111; direction: ${dir}; }
        h1    { color: #3b6ef0; font-size: 22px; margin-bottom: 4px; }
        .sub  { color: #666; font-size: 13px; margin-bottom: 28px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 11px 12px; border-bottom: 1px solid #e2e8f0; text-align: start; }
        th    { background: #f0f4f8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .pos  { color: #16a34a; font-weight: 700; }
        .neg  { color: #dc2626; font-weight: 700; }
        .num  { font-family: monospace; font-size: 14px; font-weight: 700; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h1>${t('print_summary_title')}</h1>
      <div class="sub">${tf('print_period', { month: monthName, year: y, date: dateStr })}</div>
      <table>
        <thead><tr><th>${t('print_metric')}</th><th>${t('print_value')}</th></tr></thead>
        <tbody>
          <tr><td>${t('stat_total_inc')}</td>
              <td class="num pos">${formatCurrency(s.income)}</td></tr>
          <tr><td>${t('stat_total_exp')}</td>
              <td class="num neg">${formatCurrency(s.expenses)}</td></tr>
          <tr><td>${t('stat_net')}</td>
              <td class="num ${s.net >= 0 ? 'pos' : 'neg'}">${formatCurrency(s.net)}</td></tr>
          <tr><td>${t('stat_total_debts')}</td>
              <td class="num neg">${formatCurrency(s.debts)}</td></tr>
          <tr><td>${t('stat_total_inv')}</td>
              <td class="num pos">${formatCurrency(s.investments)}</td></tr>
          <tr><td>${t('stat_saving_rate')}</td>
              <td class="num">${formatPercent(s.savingRate)}</td></tr>
          <tr><td>${t('print_spend_rate')}</td>
              <td class="num">${formatPercent(s.spendRate)}</td></tr>
        </tbody>
      </table>
      <br>
      <button onclick="window.print()"
              style="padding:10px 20px;background:#3b6ef0;color:#fff;border:none;
                     border-radius:8px;cursor:pointer;font-size:14px;font-family:Cairo">
        ${t('print_action')}
      </button>
    </body>
    </html>
  `);
  w.document.close();
}
