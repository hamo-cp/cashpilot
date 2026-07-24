/**
 * @module services/backup
 * @description تصدير البيانات JSON واستيرادها — Backup & Restore.
 */

import * as DB    from '../storage/db.js';
import { today }  from '../core/utils.js';
import * as Toast from '../ui/toast.js';

export function exportData() {
  const data = DB.exportAll();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `cashpilot-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Toast.show('تم تصدير البيانات', 'success');
}

/** المفاتيح المتوقعة في ملف الاستيراد */
const EXPECTED_KEYS = ['mz_income', 'mz_expenses', 'mz_debts', 'mz_investments', 'mz_budget', 'mz_settings'];

export function importData(event, onSuccess) {
  const file = event.target.files[0];
  if (!file) return;

  // حد حجم الملف: 5MB
  if (file.size > 5 * 1024 * 1024) {
    Toast.show('الملف كبير جداً (الحد 5MB)', 'error');
    event.target.value = '';
    return;
  }

  const reader  = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // التحقق من أن البيانات كائن وليست array أو قيمة بدائية
      if (typeof data !== 'object' || Array.isArray(data) || data === null) {
        Toast.show('صيغة الملف غير صحيحة', 'error');
        return;
      }

      // التحقق من وجود مفتاح واحد على الأقل من المفاتيح المعروفة
      const hasKnownKey = EXPECTED_KEYS.some(k => k in data);
      if (!hasKnownKey) {
        Toast.show('الملف لا يبدو نسخة احتياطية من CashPilot', 'warning');
        return;
      }

      // التحقق من أن مصفوفات البيانات سليمة
      for (const k of ['mz_income', 'mz_expenses', 'mz_debts', 'mz_investments']) {
        if (k in data && !Array.isArray(data[k])) {
          Toast.show(`بيانات تالفة في الملف (${k})`, 'error');
          return;
        }
      }

      DB.importAll(data);
      Toast.show('تم استيراد البيانات بنجاح', 'success');
      onSuccess?.();
    } catch {
      Toast.show('الملف غير صالح أو تالف', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
