/**
 * @module core/utils
 * @description دوال مساعدة مشتركة — تنسيق، تواريخ، معرّفات.
 * لا تعتمد على أي وحدة أخرى في المشروع.
 */

/** توليد معرف فريد */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** تنسيق العملة بالجنيه المصري */
export function formatCurrency(amount, decimals = 0) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + ' ج.م';
}

/** تنسيق النسبة المئوية */
export function formatPercent(value) {
  const num = parseFloat(value) || 0;
  return num.toFixed(1) + '%';
}

/** تنسيق التاريخ للعرض */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** اليوم الحالي بصيغة YYYY-MM-DD */
export function today() {
  return new Date().toISOString().split('T')[0];
}

/** عدد الأيام المتبقية حتى تاريخ معيّن (سالب = متأخر) */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** مطابقة سجل مع فترة زمنية (شهر + سنة) */
export function matchPeriod(dateStr, month, year) {
  if (!month && !year) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const matchMonth = month ? (d.getMonth() + 1) === parseInt(month) : true;
  const matchYear  = year  ? d.getFullYear()    === parseInt(year)  : true;
  return matchMonth && matchYear;
}

/** تهريب HTML لمنع XSS */
export function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** توليد SVG icon من الـ sprite */
export function svgIcon(id, cls = 'icon-sm') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24"><use href="#${id}"/></svg>`;
}
