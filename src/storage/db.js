/**
 * @module storage/db
 * @description LocalStorage adapter — كل تعامل مع التخزين يمر من هنا فقط.
 * الهدف: عزل طبقة البيانات بحيث يمكن استبدالها بـ IndexedDB أو API لاحقاً.
 */

export const KEYS = Object.freeze({
  INCOME:      'mz_income',
  EXPENSES:    'mz_expenses',
  DEBTS:       'mz_debts',
  INVESTMENTS:   'mz_investments',
  SUBSCRIPTIONS: 'mz_subscriptions',
  BUDGET:        'mz_budget',
  SETTINGS:      'mz_settings',
});

/** قراءة قيمة واحدة */
export function get(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/** كتابة قيمة واحدة — يُعيد false عند فشل الكتابة (localStorage full/blocked) */
export function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[DB] Failed to write key "${key}":`, err);
    return false;
  }
}

/** قراءة مصفوفة — مع تحقق من أن القيمة فعلاً array */
export function getArray(key) {
  const val = get(key);
  if (Array.isArray(val)) return val;
  if (val !== null) console.warn(`[DB] Key "${key}" expected array, got:`, typeof val);
  return [];
}

/** حفظ مصفوفة */
export function setArray(key, arr) {
  return set(key, arr);
}

/** تصدير جميع البيانات كـ JSON */
export function exportAll() {
  const data = {};
  Object.values(KEYS).forEach(k => { data[k] = get(k); });
  return data;
}

/** استيراد البيانات من JSON */
export function importAll(data) {
  Object.entries(data).forEach(([k, v]) => {
    if (v !== null && v !== undefined) set(k, v);
  });
}
