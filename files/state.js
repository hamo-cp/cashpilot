/**
 * @module core/state
 * @description حالة التطبيق المركزية — single source of truth.
 * كل الصفحات تقرأ من هنا وتكتب إليها عبر setters.
 */

/** الحالة الداخلية */
const _state = {
  currentPage:  'dashboard',
  filterMonth:  new Date().getMonth() + 1,
  filterYear:   new Date().getFullYear(),
  editingId:    null,
  editingType:  null,
  searchQuery:  '',
  charts:       {},  // مراجع كائنات Chart.js النشطة
};

/** قراءة الحالة (read-only snapshot) */
export function getState() {
  return { ..._state };
}

/** تحديث حقل واحد أو أكثر */
export function setState(updates) {
  Object.assign(_state, updates);
}

/** وصول مباشر للـ charts (مرجع حقيقي للتعديل) */
export function getCharts() {
  return _state.charts;
}
