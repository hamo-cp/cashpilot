/**
 * @module ui/nav
 * @description منطق التنقل — bottom-nav، swipe، filters.
 */

import { getState, setState } from '../core/state.js';
import { SWIPE_PAGES }         from '../core/constants.js';
import { t }                   from '../core/i18n.js';

/** الصفحات الفرعية التي تنتمي لزر "المزيد" */
const MORE_CHILDREN = ['expenses', 'debts', 'investments', 'income', 'subscriptions', 'budget', 'notifications'];

/**
 * الانتقال لصفحة معينة وتحديث الـ DOM.
 * @param {string} page
 * @param {Function} renderPage - callback(page) لتحديث المحتوى
 */
export function navigateTo(page, renderPage) {
  setState({ currentPage: page });

  // تفعيل الصفحة المطلوبة
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // تحديث الـ bottom-nav
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    const btnPage    = btn.dataset.page;
    const isMoreChild = MORE_CHILDREN.includes(page);
    const isActive   = isMoreChild ? btnPage === 'more' : btnPage === page;
    btn.classList.toggle('active', isActive);
  });

  if (typeof renderPage === 'function') renderPage(page);

  // كل صفحة تبدأ من أعلى viewport؛ الـ main-content ليس scroll container مستقلاً.
  const scrollRoot = document.scrollingElement || document.documentElement;
  if (scrollRoot) {
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
  }
}

/** تركيز عنصر دون تحريك موضع الصفحة، مع fallback للمتصفحات الأقدم. */
export function focusElementSafely(element) {
  if (!element || typeof element.focus !== 'function') return null;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return element;
}

/** نقل التركيز إلى بداية وجهة SPA عند طلب ذلك صراحةً (مثل فتح إشعار). */
export function focusPageDestination(page, root = document) {
  const pageElement = root.getElementById(`page-${page}`);
  if (!pageElement) return null;

  const target = pageElement.querySelector('.page-title, .hero-title, .section-title, h1, h2')
    || pageElement;
  target.setAttribute?.('tabindex', '-1');
  target.classList?.add('navigation-focus-target');
  return focusElementSafely(target);
}

/** ربط أزرار bottom-nav وdata-page */
export function bindNavButtons(renderPage) {
  document.querySelectorAll('[data-page]').forEach(btn => {
    // استثناء زر المركز — له معالج خاص
    if (btn.classList.contains('fab-nav-center')) return;
    btn.addEventListener('click', () => navigateTo(btn.dataset.page, renderPage));
  });
}

/** ربط زر المركز (+ إضافة مصروف) */
export function bindCenterButton(onPress) {
  const centerBtn = document.querySelector('.fab-nav-center');
  if (!centerBtn) return;
  centerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof onPress === 'function') onPress();
  });
}

/** مزامنة الحالة البصرية والمعلنة لفلاتر المعاملات. */
export function syncFilterChipSelection(selectedChip, root = document) {
  root.querySelectorAll('.filter-chip').forEach(chip => {
    const selected = chip === selectedChip;
    chip.classList.toggle('active', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
}

/** إعداد فلتري الشهر والسنة */
export function setupFilters(onChange) {
  const now      = new Date();
  const monthSel = document.getElementById('filterMonth');
  const yearSel  = document.getElementById('filterYear');

  if (monthSel) {
    Array.from({ length: 12 }, (_, i) => `month_${i}`).forEach((key, i) => {
      const opt = new Option(t(key), i + 1);
      opt.dataset.i18n = key;
      if (i + 1 === now.getMonth() + 1) opt.selected = true;
      monthSel.add(opt);
    });
    monthSel.addEventListener('change', () => {
      setState({ filterMonth: parseInt(monthSel.value) });
      onChange?.();
    });
  }

  if (yearSel) {
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
      const opt = new Option(y, y);
      if (y === now.getFullYear()) opt.selected = true;
      yearSel.add(opt);
    }
    yearSel.addEventListener('change', () => {
      setState({ filterYear: parseInt(yearSel.value) });
      onChange?.();
    });
  }
}

/** Swipe gesture للتنقل على الموبايل */
export function bindSwipe(renderPage) {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (document.querySelector('.modal-overlay.active')) return;

    const dx  = e.changedTouches[0].clientX - touchStartX;
    const dy  = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 80) return;

    const cur = getState().currentPage;
    const idx = SWIPE_PAGES.indexOf(cur);
    if (idx === -1) return;

    if (dx > 0 && idx > 0) {
      navigateTo(SWIPE_PAGES[idx - 1], renderPage);
    } else if (dx < 0 && idx < SWIPE_PAGES.length - 1) {
      navigateTo(SWIPE_PAGES[idx + 1], renderPage);
    }
  }, { passive: true });
}
