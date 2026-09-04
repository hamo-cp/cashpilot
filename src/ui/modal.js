/**
 * @module ui/modal
 * @description إدارة النوافذ المنبثقة — فتح، إغلاق، تأكيد الحذف.
 */

import { setState } from '../core/state.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const dialogStack = [];
const dialogOpeners = new WeakMap();
const boundOverlays = new WeakSet();
const boundCloseButtons = new WeakSet();
const boundDocuments = new WeakSet();

function dialogPanel(root) {
  return root?.querySelector('.modal, .confirm-box') || root;
}

function focusElement(element) {
  if (!element || typeof element.focus !== 'function') return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function focusableElements(root) {
  return [...dialogPanel(root).querySelectorAll(FOCUSABLE_SELECTOR)];
}

function activateDialog(root) {
  if (!root || root.classList.contains('active')) return;

  dialogOpeners.set(root, document.activeElement);
  root.classList.add('active');
  dialogStack.push(root);

  const panel = dialogPanel(root);
  const initial = panel.querySelector('[data-modal-initial-focus]')
    || focusableElements(root)[0]
    || panel;
  focusElement(initial);
}

function removeFromStack(root) {
  const index = dialogStack.lastIndexOf(root);
  if (index !== -1) dialogStack.splice(index, 1);
}

function isRestorable(element, closingRoots) {
  return Boolean(
    element
    && typeof element.focus === 'function'
    && element.isConnected !== false
    && !closingRoots.some(root => root.contains(element)),
  );
}

function closeDialogs(roots, restoreFocus = true) {
  const closingRoots = [...new Set(roots)].filter(root => root?.classList.contains('active'));
  if (closingRoots.length === 0) return;

  const orderedRoots = [
    ...dialogStack.filter(root => closingRoots.includes(root)),
    ...closingRoots.filter(root => !dialogStack.includes(root)),
  ];
  const returnTarget = orderedRoots
    .map(root => dialogOpeners.get(root))
    .find(element => isRestorable(element, closingRoots));

  closingRoots.forEach(root => root.classList.remove('active'));
  closingRoots.forEach(root => {
    removeFromStack(root);
    dialogOpeners.delete(root);
  });

  if (restoreFocus) focusElement(returnTarget);
}

function topDialog() {
  for (let index = dialogStack.length - 1; index >= 0; index -= 1) {
    const root = dialogStack[index];
    if (root.classList.contains('active')) return root;
    dialogStack.splice(index, 1);
  }
  return null;
}

function handleDialogKeydown(event) {
  const root = topDialog();
  if (!root) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (root.classList.contains('confirm-dialog')) cancelConfirm();
    else closeModal(root.id);
    return;
  }

  if (event.key !== 'Tab') return;

  const panel = dialogPanel(root);
  const items = focusableElements(root);
  if (items.length === 0) {
    event.preventDefault();
    focusElement(panel);
    return;
  }

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const activeIndex = items.indexOf(active);

  if (activeIndex === -1 || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
    event.preventDefault();
    focusElement(event.shiftKey ? last : first);
  }
}

/** فتح modal بمعرّفه */
export function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  activateDialog(overlay);
}

/** إغلاق كل النوافذ المفتوحة */
export function closeModal(modalId = null) {
  const overlays = modalId
    ? [document.getElementById(modalId)].filter(overlay => overlay?.classList.contains('modal-overlay'))
    : [...document.querySelectorAll('.modal-overlay.active')];
  closeDialogs(overlays);
  setState({ editingId: null, editingType: null });
}

/** ربط أحداث الإغلاق على كل النوافذ */
export function bindModalEvents() {
  // إغلاق بالنقر على الخلفية
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    if (boundOverlays.has(overlay)) return;
    boundOverlays.add(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // أزرار الإغلاق الصريحة
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    if (boundCloseButtons.has(btn)) return;
    boundCloseButtons.add(btn);
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id);
    });
  });

  if (!boundDocuments.has(document)) {
    boundDocuments.add(document);
    document.addEventListener('keydown', handleDialogKeydown);
  }
}

/* ── نافذة تأكيد الحذف ── */

/** فتح نافذة التأكيد وتخزين البيانات اللازمة للحذف */
export function openConfirm(type, id) {
  const dialog = document.getElementById('confirmDialog');
  if (!dialog) return;
  dialog.dataset.deleteType = type;
  dialog.dataset.deleteId   = id;
  activateDialog(dialog);
}

/** إلغاء الحذف */
export function cancelConfirm() {
  const dialog = document.getElementById('confirmDialog');
  closeDialogs(dialog ? [dialog] : []);
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
  closeDialogs([dialog]);
  if (typeof onDelete === 'function') onDelete(type, id);
}
