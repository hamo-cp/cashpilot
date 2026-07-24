/**
 * @module ui/modal
 * @description إدارة النوافذ المنبثقة — فتح، إغلاق، تأكيد الحذف.
 */

import { setState } from '../core/state.js';

/** فتح modal بمعرّفه */
export function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) overlay.classList.add('active');
}

/** إغلاق كل النوافذ المفتوحة */
export function closeModal() {
  document.querySelectorAll('.modal-overlay.active')
    .forEach(m => m.classList.remove('active'));
  setState({ editingId: null, editingType: null });
}

/** ربط أحداث الإغلاق على كل النوافذ */
export function bindModalEvents() {
  // إغلاق بالنقر على الخلفية
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  });

  // أزرار الإغلاق الصريحة
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
}

/* ── نافذة تأكيد الحذف ── */

/** فتح نافذة التأكيد وتخزين البيانات اللازمة للحذف */
export function openConfirm(type, id) {
  const dialog = document.getElementById('confirmDialog');
  if (!dialog) return;
  dialog.dataset.deleteType = type;
  dialog.dataset.deleteId   = id;
  dialog.classList.add('active');
}

/** إلغاء الحذف */
export function cancelConfirm() {
  const dialog = document.getElementById('confirmDialog');
  if (dialog) dialog.classList.remove('active');
}

/**
 * تنفيذ الحذف — تُستدعى من زر "نعم، احذف"
 * @param {Function} onDelete - callback(type, id)
 */
export function executeConfirm(onDelete) {
  const dialog = document.getElementById('confirmDialog');
  if (!dialog) return;
  const type = dialog.dataset.deleteType;
  const id   = dialog.dataset.deleteId;
  dialog.classList.remove('active');
  if (typeof onDelete === 'function') onDelete(type, id);
}
