/**
 * @module services/print
 * @description توليد تقرير شهري قابل للطباعة في نافذة جديدة.
 */

import { getState }               from '../core/state.js';
import { formatCurrency, formatPercent } from '../core/utils.js';
import { MONTH_NAMES }            from '../core/constants.js';
import { getMonthSummary }        from './finance.js';

export function printSummary() {
  const { filterMonth: m, filterYear: y } = getState();
  const s         = getMonthSummary(m, y);
  const monthName = MONTH_NAMES[m - 1];
  const dateStr   = new Date().toLocaleDateString('ar-EG');

  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير ميزانيتي — ${monthName} ${y}</title>
      <style>
        body  { font-family: Cairo, sans-serif; padding: 30px; color: #111; direction: rtl; }
        h1    { color: #3b6ef0; font-size: 22px; margin-bottom: 4px; }
        .sub  { color: #666; font-size: 13px; margin-bottom: 28px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 11px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; }
        th    { background: #f0f4f8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .pos  { color: #16a34a; font-weight: 700; }
        .neg  { color: #dc2626; font-weight: 700; }
        .num  { font-family: monospace; font-size: 14px; font-weight: 700; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h1>ملخص ميزانيتي</h1>
      <div class="sub">تقرير شهر ${monthName} ${y} · تاريخ الطباعة: ${dateStr}</div>
      <table>
        <thead><tr><th>المؤشر</th><th>القيمة</th></tr></thead>
        <tbody>
          <tr><td>إجمالي الدخل</td>
              <td class="num pos">${formatCurrency(s.income)}</td></tr>
          <tr><td>إجمالي المصروفات</td>
              <td class="num neg">${formatCurrency(s.expenses)}</td></tr>
          <tr><td>صافي الرصيد</td>
              <td class="num ${s.net >= 0 ? 'pos' : 'neg'}">${formatCurrency(s.net)}</td></tr>
          <tr><td>إجمالي الديون</td>
              <td class="num neg">${formatCurrency(s.debts)}</td></tr>
          <tr><td>إجمالي الاستثمارات</td>
              <td class="num pos">${formatCurrency(s.investments)}</td></tr>
          <tr><td>نسبة الادخار</td>
              <td class="num">${formatPercent(s.savingRate)}</td></tr>
          <tr><td>نسبة الإنفاق</td>
              <td class="num">${formatPercent(s.spendRate)}</td></tr>
        </tbody>
      </table>
      <br>
      <button onclick="window.print()"
              style="padding:10px 20px;background:#3b6ef0;color:#fff;border:none;
                     border-radius:8px;cursor:pointer;font-size:14px;font-family:Cairo">
        طباعة
      </button>
    </body>
    </html>
  `);
  w.document.close();
}
