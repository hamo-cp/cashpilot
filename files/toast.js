/**
 * @module ui/toast
 * @description نظام الإشعارات العائمة (Toast notifications).
 * مستقل تماماً — لا يعتمد على أي وحدة أخرى.
 */

const ICONS     = { success: '✓', error: '✕', info: 'i', warning: '!' };
const MAX_TOASTS = 3;
let _lastMsg  = '';
let _lastTime = 0;

/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms
 */
export function show(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // منع تكرار نفس الرسالة خلال 800ms (حماية من double-submit)
  const now = Date.now();
  if (message === _lastMsg && now - _lastTime < 800) return;
  _lastMsg  = message;
  _lastTime = now;

  // إزالة أقدم toast عند تجاوز الحد
  while (container.children.length >= MAX_TOASTS) {
    container.firstChild?.remove();
  }

  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${ICONS[type] || ''}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
