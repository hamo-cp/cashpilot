/**
 * @module ui/nav
 * @description منطق التنقل — bottom-nav، swipe، filters.
 */

import { getState, setState } from '../core/state.js';
import { SWIPE_PAGES }         from '../core/constants.js';

/** الصفحات الفرعية التي تنتمي لزر "المزيد" */
const MORE_CHILDREN = ['debts', 'investments', 'income'];

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
    const isActive   = btnPage === page || (isMoreChild && btnPage === 'more');
    btn.classList.toggle('active', isActive);
  });

  if (typeof renderPage === 'function') renderPage(page);
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

/** إعداد فلتري الشهر والسنة */
export function setupFilters(onChange) {
  const now      = new Date();
  const monthSel = document.getElementById('filterMonth');
  const yearSel  = document.getElementById('filterYear');

  if (monthSel) {
    const months = [
      'يناير','فبراير','مارس','أبريل','مايو','يونيو',
      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
    ];
    months.forEach((m, i) => {
      const opt = new Option(m, i + 1);
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
