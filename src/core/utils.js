/**
 * @module core/utils
 * @description دوال مساعدة مشتركة — تنسيق، تواريخ، معرّفات.
 * لا تعتمد على أي وحدة أخرى في المشروع.
 */
import { getLang, t } from './i18n.js';

/** توليد معرف فريد */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** تنسيق العملة بالجنيه المصري */
export function formatCurrency(amount, decimals = 0) {
  const num = parseFloat(amount) || 0;
  const locale = getLang() === 'ar' ? 'ar-EG' : 'en-US';
  return num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + ' ' + t('currency');
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
  const locale = getLang() === 'ar' ? 'ar-EG' : 'en-US';
  return d.toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** تاريخ التقويم المحلي بصيغة YYYY-MM-DD. */
export function today(date = new Date()) {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** عدد الأيام المتبقية حتى تاريخ معيّن (سالب = متأخر) */
export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const targetDay = Date.UTC(year, month - 1, day);
  const parsed = new Date(targetDay);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;

  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (targetDay - currentDay) / 86_400_000;
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
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** توليد SVG icon من الـ sprite */
export function svgIcon(id, cls = 'icon-sm') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24"><use href="#${id}"/></svg>`;
}

/** تحريك رقم متصاعداً (عداد الأرقام) */
export function animateValue(obj, start, end, duration, formatFn = val => val) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // ease out effect
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.floor(easeProgress * (end - start) + start);
    obj.textContent = formatFn(currentVal);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = formatFn(end);
    }
  };
  window.requestAnimationFrame(step);
}
