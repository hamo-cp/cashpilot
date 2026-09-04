/**
 * @module services/backup
 * @description تصدير البيانات JSON واستيرادها — Backup & Restore.
 */

import * as DB    from '../storage/db.js';
import { today, uid }  from '../core/utils.js';
import {
  BUDGET_CATEGORIES, EXPENSE_CATEGORIES, INCOME_SOURCES, INVESTMENT_TYPES,
} from '../core/constants.js';
import * as Toast from '../ui/toast.js';
import { t, tf } from '../core/i18n.js';

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

  Toast.show(t('backup_export_success'), 'success');
}

const CURRENT_KEYS = Object.freeze(Object.values(DB.KEYS));
const LEGACY_KEYS = Object.freeze(CURRENT_KEYS.filter(key => key !== DB.KEYS.SUBSCRIPTIONS));
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_RECORDS = 10_000;
const MAX_AMOUNT = 999_999_999;
const MAX_TEXT = MAX_BACKUP_BYTES;

export const BACKUP_LIMITS = Object.freeze({
  maxBytes: MAX_BACKUP_BYTES,
  maxRecords: MAX_RECORDS,
  maxAmount: MAX_AMOUNT,
  // Any string in an accepted UTF-8 backup is no longer than the whole file.
  maxTextLength: MAX_TEXT,
});

export class BackupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function fail(message) {
  throw new BackupValidationError(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertKnownFields(record, allowedFields, label) {
  if (!isPlainObject(record)) fail(tf('backup_invalid_record', { label }));
  const unknown = Object.keys(record).find(key => !allowedFields.includes(key));
  if (unknown) fail(tf('backup_unknown_field', { label, field: unknown }));
}

function text(value, label, { required = true, max = MAX_TEXT } = {}) {
  if (value === undefined || value === null) {
    if (!required) return '';
    fail(tf('backup_text_missing', { label }));
  }
  if (typeof value !== 'string') fail(tf('backup_invalid_type', { label }));
  if (value.length > max) fail(tf('backup_text_too_long', { label }));
  if (required && value.trim().length === 0) fail(tf('backup_empty_field', { label }));
  return value;
}

function number(value, label, { min = 0, max = MAX_AMOUNT } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(tf('backup_invalid_number', { label }));
  }
  return value;
}

function date(value, label, { required = false } = {}) {
  if ((value === undefined || value === null || value === '') && !required) return '';
  if (typeof value !== 'string' || value.length > 40) fail(tf('backup_invalid_date', { label }));
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) fail(tf('backup_invalid_date', { label }));
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    fail(tf('backup_invalid_date', { label }));
  }
  return value;
}

function enumValue(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(tf('backup_invalid_choice', { label }));
  return value;
}

function recordId(record, seenIds, collection, index) {
  const incoming = text(record.id, `${collection}.id`);
  if (seenIds.has(incoming)) fail(tf('backup_duplicate_id', { label: collection }));
  seenIds.add(incoming);
  return `import_${collection}_${index}_${uid()}`;
}

function createdAt(record, label) {
  return record.createdAt === undefined ? undefined : date(record.createdAt, `${label}.createdAt`);
}

const incomeFields = ['id', 'name', 'amount', 'source', 'date', 'notes', 'createdAt'];
function normalizeIncome(record, seenIds, index) {
  assertKnownFields(record, incomeFields, t('collection_income'));
  const result = {
    id: recordId(record, seenIds, 'income', index),
    name: text(record.name, 'income.name'),
    amount: number(record.amount, 'income.amount', { min: Number.EPSILON }),
    source: enumValue(record.source, Object.keys(INCOME_SOURCES), 'income.source'),
    date: date(record.date, 'income.date', { required: true }),
    notes: text(record.notes, 'income.notes', { required: false }),
  };
  const created = createdAt(record, 'income');
  if (created !== undefined) result.createdAt = created;
  return result;
}

const expenseFields = ['id', 'name', 'amount', 'category', 'date', 'notes', 'createdAt'];
function normalizeExpense(record, seenIds, index) {
  assertKnownFields(record, expenseFields, t('collection_expenses'));
  const result = {
    id: recordId(record, seenIds, 'expense', index),
    name: text(record.name, 'expense.name'),
    amount: number(record.amount, 'expense.amount', { min: Number.EPSILON }),
    category: enumValue(record.category, Object.keys(EXPENSE_CATEGORIES), 'expense.category'),
    date: date(record.date, 'expense.date', { required: true }),
    notes: text(record.notes, 'expense.notes', { required: false }),
  };
  const created = createdAt(record, 'expense');
  if (created !== undefined) result.createdAt = created;
  return result;
}

const debtFields = ['id', 'creditor', 'amount', 'paid', 'dueDate', 'notes', 'createdAt'];
function normalizeDebt(record, seenIds, index) {
  assertKnownFields(record, debtFields, t('collection_debts'));
  const amount = number(record.amount, 'debt.amount', { min: Number.EPSILON });
  const result = {
    id: recordId(record, seenIds, 'debt', index),
    creditor: text(record.creditor, 'debt.creditor'),
    amount,
    paid: number(record.paid ?? 0, 'debt.paid', { max: amount }),
    dueDate: date(record.dueDate, 'debt.dueDate'),
    notes: text(record.notes, 'debt.notes', { required: false }),
  };
  const created = createdAt(record, 'debt');
  if (created !== undefined) result.createdAt = created;
  return result;
}

const investmentFields = ['id', 'name', 'type', 'capital', 'quantity', 'profit', 'startDate', 'createdAt'];
function normalizeInvestment(record, seenIds, index) {
  assertKnownFields(record, investmentFields, t('collection_investments'));
  const result = {
    id: recordId(record, seenIds, 'investment', index),
    name: text(record.name, 'investment.name'),
    type: enumValue(record.type, Object.keys(INVESTMENT_TYPES), 'investment.type'),
    capital: number(record.capital, 'investment.capital', { min: Number.EPSILON }),
    quantity: number(record.quantity ?? 0, 'investment.quantity'),
    profit: number(record.profit ?? 0, 'investment.profit', { min: -MAX_AMOUNT }),
    startDate: date(record.startDate, 'investment.startDate'),
  };
  const created = createdAt(record, 'investment');
  if (created !== undefined) result.createdAt = created;
  return result;
}

const subscriptionFields = ['id', 'name', 'amount', 'dueDate', 'createdAt'];
function normalizeSubscription(record, seenIds, index) {
  assertKnownFields(record, subscriptionFields, t('collection_subscriptions'));
  const result = {
    id: recordId(record, seenIds, 'subscription', index),
    name: text(record.name, 'subscription.name'),
    amount: number(record.amount, 'subscription.amount', { min: Number.EPSILON }),
    dueDate: date(record.dueDate, 'subscription.dueDate', { required: true }),
  };
  const created = createdAt(record, 'subscription');
  if (created !== undefined) result.createdAt = created;
  return result;
}

function normalizeCollection(value, key, normalizer) {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_RECORDS) fail(tf('backup_invalid_collection', { label: key }));
  const seenIds = new Set();
  return value.map((record, index) => normalizer(record, seenIds, index));
}

function normalizeBudget(value) {
  if (value === null) return null;
  const allowed = BUDGET_CATEGORIES.map(category => category.key);
  assertKnownFields(value, allowed, t('collection_budget'));
  return Object.fromEntries(allowed.map(key => [key, number(value[key] ?? 0, `budget.${key}`)]));
}

function normalizeSettings(value) {
  if (value === null) return null;
  const allowed = ['theme', 'currency', 'notifSmartBudget', 'notifSmartDebts', 'notifSmartInsights', 'notifWeeklySummary'];
  assertKnownFields(value, allowed, t('collection_settings'));
  const settings = {
    theme: enumValue(value.theme ?? 'dark', ['dark', 'light'], 'settings.theme'),
    currency: enumValue(value.currency ?? 'EGP', ['EGP'], 'settings.currency'),
  };
  for (const key of allowed.slice(2)) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'boolean') fail(tf('backup_invalid_boolean', { label: `settings.${key}` }));
      settings[key] = value[key];
    }
  }
  return settings;
}

function sameKeys(actual, expected) {
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function assertBackupSize(data) {
  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    fail(t('backup_invalid_format'));
  }
  if (new TextEncoder().encode(serialized).byteLength > BACKUP_LIMITS.maxBytes) {
    fail(t('backup_too_large'));
  }
}

/** Validate the entire backup before the first storage write and reconstruct safe records. */
export function validateAndNormalizeBackup(data) {
  if (!isPlainObject(data)) fail(t('backup_invalid_format'));
  assertBackupSize(data);
  const keys = Object.keys(data).sort();
  const current = [...CURRENT_KEYS].sort();
  const legacy = [...LEGACY_KEYS].sort();
  if (!sameKeys(keys, current) && !sameKeys(keys, legacy)) {
    fail(t('backup_keys_invalid'));
  }

  const normalized = {
    [DB.KEYS.INCOME]: normalizeCollection(data[DB.KEYS.INCOME], DB.KEYS.INCOME, normalizeIncome),
    [DB.KEYS.EXPENSES]: normalizeCollection(data[DB.KEYS.EXPENSES], DB.KEYS.EXPENSES, normalizeExpense),
    [DB.KEYS.DEBTS]: normalizeCollection(data[DB.KEYS.DEBTS], DB.KEYS.DEBTS, normalizeDebt),
    [DB.KEYS.INVESTMENTS]: normalizeCollection(data[DB.KEYS.INVESTMENTS], DB.KEYS.INVESTMENTS, normalizeInvestment),
    [DB.KEYS.SUBSCRIPTIONS]: keys.includes(DB.KEYS.SUBSCRIPTIONS)
      ? normalizeCollection(data[DB.KEYS.SUBSCRIPTIONS], DB.KEYS.SUBSCRIPTIONS, normalizeSubscription)
      : null,
    [DB.KEYS.BUDGET]: normalizeBudget(data[DB.KEYS.BUDGET]),
    [DB.KEYS.SETTINGS]: normalizeSettings(data[DB.KEYS.SETTINGS]),
  };
  return normalized;
}

export function importData(event, onSuccess) {
  const file = event.target.files[0];
  if (!file) return;

  // حد حجم الملف: 5MB
  if (file.size > BACKUP_LIMITS.maxBytes) {
    Toast.show(t('backup_too_large'), 'error');
    event.target.value = '';
    return;
  }

  const reader  = new FileReader();
  reader.onload = (e) => {
    try {
      const data = validateAndNormalizeBackup(JSON.parse(e.target.result));
      const result = DB.importAll(data);
      if (!result.ok) {
        if (result.rollbackFailed) {
          Toast.show(
            t('backup_rollback_failed'),
            'error',
            8_000,
          );
          return;
        }
        Toast.show(t('backup_import_failed'), 'error');
        return;
      }
      Toast.show(t('backup_import_success'), 'success');
      onSuccess?.();
    } catch (error) {
      Toast.show(error instanceof BackupValidationError ? error.message : t('backup_invalid_file'), 'error');
    }
  };
  reader.onerror = () => Toast.show(t('backup_read_failed'), 'error');
  reader.readAsText(file);
  event.target.value = '';
}
