/**
 * @module ui/components
 * @description مكونات HTML المتكررة — تُعيد strings جاهزة للإدراج في DOM.
 * كل دالة هنا pure function: input → HTML string.
 */

import { esc, svgIcon, formatCurrency, formatDate, formatPercent, daysUntil } from '../core/utils.js';
import { EXPENSE_CATEGORIES, INCOME_SOURCES, INVESTMENT_TYPES }               from '../core/constants.js';

/** تحويل اسم اللون لـ CSS variable key */
function colorKey(color) {
  if (color === 'cyan') return 'brand';
  if (color === 'gold') return 'warning';
  return color;
}

/* ── Transaction item ── */
export function txItemHTML(tx) {
  const isIncome = tx.type === 'income';
  const cat      = isIncome
    ? (INCOME_SOURCES[tx.source]         || INCOME_SOURCES.other)
    : (EXPENSE_CATEGORIES[tx.category]   || EXPENSE_CATEGORIES.other);

  const ck      = colorKey(cat.color);
  const iconSvg = svgIcon(cat.iconId);

  return `
    <div class="transaction-item">
      <div class="transaction-icon"
           style="background:var(--color-${ck}-dim);color:var(--color-${ck})">${iconSvg}</div>
      <div class="transaction-info">
        <div class="transaction-name">${esc(tx.name)}</div>
        <div class="transaction-meta">${cat.label} · ${formatDate(tx.date)}</div>
      </div>
      <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
        ${isIncome ? '+' : '−'}${formatCurrency(tx.amount)}
      </div>
    </div>`;
}

/* ── Income list item (with actions) ── */
export function incomeItemHTML(item) {
  const src = INCOME_SOURCES[item.source] || INCOME_SOURCES.other;
  const ck  = colorKey(src.color);
  return `
    <div class="transaction-item fade-in">
      <div class="transaction-icon"
           style="background:var(--color-${ck}-dim);color:var(--color-${ck})">${svgIcon(src.iconId)}</div>
      <div class="transaction-info">
        <div class="transaction-name">${esc(item.name)}</div>
        <div class="transaction-meta">${src.label} · ${formatDate(item.date)}</div>
        ${item.notes ? `<div class="transaction-meta">${esc(item.notes)}</div>` : ''}
      </div>
      <div class="transaction-amount income">${formatCurrency(item.amount)}</div>
      <div class="transaction-actions">
        <button class="btn btn-ghost btn-icon btn-sm"
                onclick="App.openIncomeModal('${item.id}')" title="تعديل">
          ${svgIcon('ic-edit')}
        </button>
        <button class="btn btn-danger btn-icon btn-sm"
                onclick="App.confirmDelete('income','${item.id}')" title="حذف">
          ${svgIcon('ic-trash')}
        </button>
      </div>
    </div>`;
}

/* ── Expense list item (with actions) ── */
export function expenseItemHTML(item) {
  const cat = EXPENSE_CATEGORIES[item.category] || EXPENSE_CATEGORIES.other;
  const ck  = colorKey(cat.color);
  return `
    <div class="transaction-item fade-in">
      <div class="transaction-icon"
           style="background:var(--color-${ck}-dim);color:var(--color-${ck})">${svgIcon(cat.iconId)}</div>
      <div class="transaction-info">
        <div class="transaction-name">${esc(item.name)}</div>
        <div class="transaction-meta">${cat.label} · ${formatDate(item.date)}</div>
      </div>
      <div class="transaction-amount expense">−${formatCurrency(item.amount)}</div>
      <div class="transaction-actions">
        <button class="btn btn-ghost btn-icon btn-sm"
                onclick="App.openExpenseModal('${item.id}')" title="تعديل">
          ${svgIcon('ic-edit')}
        </button>
        <button class="btn btn-danger btn-icon btn-sm"
                onclick="App.confirmDelete('expense','${item.id}')" title="حذف">
          ${svgIcon('ic-trash')}
        </button>
      </div>
    </div>`;
}

/* ── Debt card ── */
export function debtCardHTML(debt) {
  const amount    = parseFloat(debt.amount) || 0;
  const paid      = parseFloat(debt.paid)   || 0;
  const remaining = Math.max(0, amount - paid);
  const paidPct   = amount > 0 ? (paid / amount * 100) : 0;
  const days      = daysUntil(debt.dueDate);

  let statusClass = '';
  let statusBadge = '';
  if (days !== null) {
    if (days < 0) {
      statusClass = 'overdue';
      statusBadge = `<span class="badge badge-red">${svgIcon('ic-alert')} متأخر ${Math.abs(days)} يوم</span>`;
    } else if (days <= 7) {
      statusClass = 'warning';
      statusBadge = `<span class="badge badge-orange">${svgIcon('ic-alert')} متبقي ${days} أيام</span>`;
    } else {
      statusBadge = `<span class="badge badge-cyan">متبقي ${days} يوم</span>`;
    }
  }

  return `
    <div class="debt-card ${statusClass} fade-in">
      <div class="debt-header">
        <div>
          <div class="debt-name" style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--color-text-muted)">${svgIcon('ic-landmark')}</span>
            ${esc(debt.creditor)}
          </div>
          <div class="debt-due">
            ${debt.dueDate ? 'الاستحقاق: ' + formatDate(debt.dueDate) : 'بدون استحقاق'}
          </div>
        </div>
        <div style="text-align:left">
          ${statusBadge}
          <div style="margin-top:6px;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-ghost btn-icon btn-sm"
                    onclick="App.openDebtModal('${debt.id}')" title="تعديل">
              ${svgIcon('ic-edit')}
            </button>
            <button class="btn btn-danger btn-icon btn-sm"
                    onclick="App.confirmDelete('debt','${debt.id}')" title="حذف">
              ${svgIcon('ic-trash')}
            </button>
          </div>
        </div>
      </div>
      <div class="debt-amounts">
        <div class="debt-amount-item">
          <div class="debt-amount-label">إجمالي الدين</div>
          <div class="debt-amount-value" style="color:var(--color-negative)">${formatCurrency(amount)}</div>
        </div>
        <div class="debt-amount-item">
          <div class="debt-amount-label">المبلغ المتبقي</div>
          <div class="debt-amount-value" style="color:var(--color-warning)">${formatCurrency(remaining)}</div>
        </div>
        <div class="debt-amount-item">
          <div class="debt-amount-label">المدفوع</div>
          <div class="debt-amount-value" style="color:var(--color-positive)">${formatCurrency(paid)}</div>
        </div>
        <div class="debt-amount-item">
          <div class="debt-amount-label">نسبة السداد</div>
          <div class="debt-amount-value" style="color:var(--color-brand)">${formatPercent(paidPct)}</div>
        </div>
      </div>
      <div class="progress-wrap" style="height:6px;margin-top:4px">
        <div class="progress-bar progress-green" style="width:${paidPct.toFixed(0)}%"></div>
      </div>
    </div>`;
}

/* ── Investment card ── */
export function investmentCardHTML(inv) {
  const roi    = inv._roi ?? 0;
  const profit = parseFloat(inv.profit) || 0;
  const type   = INVESTMENT_TYPES[inv.type] || INVESTMENT_TYPES.other;

  return `
    <div class="investment-card fade-in">
      <div class="investment-header">
        <div>
          <div class="investment-name" style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--color-text-muted)">${svgIcon(type.iconId)}</span>
            ${esc(inv.name)}
          </div>
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:3px">
            ${type.label} · ${formatDate(inv.startDate)}
          </div>
        </div>
        <div style="text-align:left">
          <div class="investment-roi ${roi >= 0 ? 'positive' : 'negative'}">
            ${roi >= 0 ? '+' : ''}${formatPercent(roi)}
          </div>
          <div style="font-size:11px;color:var(--color-text-muted)">العائد</div>
        </div>
      </div>
      <div class="investment-details">
        <div class="investment-detail">
          <div class="investment-detail-label">رأس المال</div>
          <div class="investment-detail-value" style="color:var(--color-brand)">${formatCurrency(inv.capital)}</div>
        </div>
        <div class="investment-detail">
          <div class="investment-detail-label">الأرباح</div>
          <div class="investment-detail-value"
               style="color:${profit >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}">
            ${formatCurrency(profit)}
          </div>
        </div>
        <div class="investment-detail">
          <div class="investment-detail-label">الإجمالي</div>
          <div class="investment-detail-value" style="color:var(--color-warning)">
            ${formatCurrency((parseFloat(inv.capital) || 0) + profit)}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="App.openInvestmentModal('${inv.id}')">
          ${svgIcon('ic-edit')} تعديل
        </button>
        <button class="btn btn-danger btn-sm" onclick="App.confirmDelete('investment','${inv.id}')">
          ${svgIcon('ic-trash')} حذف
        </button>
      </div>
    </div>`;
}

/* ── Empty state ── */
export function emptyStateHTML(iconId, title, text) {
  return `
    <div class="empty-state">
      <div class="empty-icon">
        <svg class="icon icon-lg" viewBox="0 0 24 24"><use href="#${iconId}"/></svg>
      </div>
      <div class="empty-title">${title}</div>
      <div class="empty-text">${text}</div>
    </div>`;
}

/* ── Category summary row (expenses page) ── */
export function categorySummaryHTML(cat, amt, pct) {
  const info = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.other;
  const ck   = colorKey(info.color);
  return `
    <div class="budget-category" style="padding:10px 0">
      <div class="budget-category-header">
        <div class="budget-category-name">
          <span class="budget-category-icon" style="color:var(--color-${ck})">${svgIcon(info.iconId)}</span>
          ${info.label}
        </div>
        <div style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--color-${ck})">
          ${formatCurrency(amt)}
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar progress-${info.color}" style="width:${pct.toFixed(0)}%"></div>
      </div>
      <div class="budget-status"><span>${pct.toFixed(1)}% من المصروفات</span></div>
    </div>`;
}
