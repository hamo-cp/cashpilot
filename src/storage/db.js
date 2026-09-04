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

/**
 * يستورد المفاتيح الرسمية فقط، ويحاول استعادة القيم السابقة عند فشل التخزين.
 * تكشف النتيجة صراحةً إن تعذر استكمال الاستعادة وبقيت حالة جزئية محتملة.
 */
export function importAll(data) {
  const failure = (reason, failedKeys = []) => ({
    ok: false,
    reason,
    rollbackFailed: failedKeys.length > 0,
    failedKeys,
  });

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return failure('invalid_input');
  }

  const allowed = new Set(Object.values(KEYS));
  const suppliedKeys = Object.keys(data);
  if (suppliedKeys.some(key => !allowed.has(key))) return failure('invalid_input');

  const entries = suppliedKeys.map(key => [key, data[key]]);
  let previous = new Map();

  try {
    previous = new Map(entries.map(([key]) => [key, localStorage.getItem(key)]));
    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
    return { ok: true, reason: null, rollbackFailed: false, failedKeys: [] };
  } catch (error) {
    const failedKeys = [];
    for (const [key, rawValue] of previous) {
      try {
        if (rawValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, rawValue);
      } catch (rollbackError) {
        failedKeys.push(key);
        console.error(`[DB] Import rollback failed for key "${key}":`, rollbackError);
      }
    }
    console.error('[DB] Import failed:', error);
    return failure(failedKeys.length > 0 ? 'rollback_failed' : 'write_failed', failedKeys);
  }
}
