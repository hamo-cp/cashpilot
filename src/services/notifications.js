/**
 * @module services/notifications
 * @description نظام الإشعارات الشامل — مركز الإشعارات الداخلي + إشعارات النظام الأصلية.
 *
 * المسؤوليات:
 *  1. تخزين وإدارة الإشعارات في localStorage
 *  2. طلب إذن الإشعارات الأصلية من المتصفح/النظام
 *  3. إرسال إشعارات أصلية عبر Service Worker
 *  4. المحرك الذكي: فحص الديون والميزانية عند كل فتح للتطبيق
 */

import * as DB        from '../storage/db.js';
import { t, tf }      from '../core/i18n.js';
import { esc, formatCurrency, today } from '../core/utils.js';
import * as Finance   from './finance.js';
import { runSmartEngine } from './smart-engine.js';

/* ══════════════════════════════════════
   Constants
══════════════════════════════════════ */
const NOTIF_KEY       = 'mz_notifications';
const LAST_CHECK_KEY  = 'mz_notif_last_check';
const PERMISSION_KEY  = 'mz_notif_permission_asked';
const MAX_NOTIFS      = 50; // أقصى عدد للإشعارات المحفوظة
const NOTIFICATION_TYPES = new Set(['debt_due', 'budget_warning', 'budget_over', 'insight', 'system']);
const NOTIFICATION_SEVERITIES = new Set(['info', 'warning', 'danger', 'success']);
const NOTIFICATION_LINKS = new Set(['dashboard', 'income', 'expenses', 'debts', 'investments', 'subscriptions', 'budget', 'analytics', 'transactions', 'more']);

/* ══════════════════════════════════════
   Types & Helpers
══════════════════════════════════════ */

/**
 * @typedef {Object} Notification
 * @property {string}  id
 * @property {string}  type      - 'debt_due'|'budget_warning'|'budget_over'|'insight'|'system'
 * @property {string}  title
 * @property {string}  body
 * @property {string}  icon      - اسم أيقونة SVG
 * @property {string}  severity  - 'info'|'warning'|'danger'|'success'
 * @property {boolean} read
 * @property {string}  createdAt - ISO string
 * @property {string|null} link  - اسم الصفحة للانتقال إليها عند النقر
 */

function uid() {
  return 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function normalizeMessageParams(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 20).flatMap(([key, param]) => {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) return [];
    if (typeof param === 'number' && Number.isFinite(param)) return [[key, param]];
    if (typeof param === 'string') return [[key, param.slice(0, 1_000)]];
    return [];
  }));
}

function messageKey(value) {
  const key = String(value || '');
  return /^[a-z0-9_]{1,100}$/.test(key) ? key : '';
}

function displayMessageParams(params) {
  const currencyParams = new Set(['amount', 'spent', 'limit', 'remaining']);
  const output = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'categoryKey') {
      const translationKey = messageKey(value);
      output.category = translationKey ? t(translationKey) : '';
    } else {
      output[key] = currencyParams.has(key) && typeof value === 'number'
        ? formatCurrency(value)
        : value;
    }
  }
  return output;
}

function normalizeNotification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const createdAt = new Date(value.createdAt);
  const titleKey = messageKey(value.titleKey);
  const bodyKey = messageKey(value.bodyKey);
  const params = normalizeMessageParams(value.params);
  return {
    id:        String(value.id || uid()).slice(0, 100),
    type:      NOTIFICATION_TYPES.has(value.type) ? value.type : 'system',
    title:     String(value.title ?? '').slice(0, 200),
    body:      String(value.body ?? '').slice(0, 1000),
    ...(titleKey ? { titleKey } : {}),
    ...(bodyKey ? { bodyKey } : {}),
    ...((titleKey || bodyKey) ? { params } : {}),
    icon:      /^ic-[a-z0-9-]+$/.test(String(value.icon || '')) ? String(value.icon) : 'ic-bell',
    severity:  NOTIFICATION_SEVERITIES.has(value.severity) ? value.severity : 'info',
    read:      value.read === true,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
    link:      NOTIFICATION_LINKS.has(value.link) ? value.link : null,
  };
}

/* ══════════════════════════════════════
   CRUD — الإشعارات المحفوظة
══════════════════════════════════════ */

/** جلب جميع الإشعارات (الأحدث أولاً) */
export function getNotifications() {
  const raw = DB.get(NOTIF_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeNotification).filter(Boolean)
    .map(notif => {
      const params = displayMessageParams(notif.params || {});
      return {
        ...notif,
        title: notif.titleKey ? tf(notif.titleKey, params) : notif.title,
        body: notif.bodyKey ? tf(notif.bodyKey, params) : notif.body,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** عدد الإشعارات غير المقروءة */
export function getUnreadCount() {
  return getNotifications().filter(n => !n.read).length;
}

/** إضافة إشعار جديد */
export function addNotification(data) {
  const notifs = getNotifications();
  const params = normalizeMessageParams(data.params);
  const displayParams = displayMessageParams(params);
  const notif = normalizeNotification({
    id:        uid(),
    type:      data.type      || 'system',
    title:     data.title ?? (data.titleKey ? tf(data.titleKey, displayParams) : ''),
    body:      data.body ?? (data.bodyKey ? tf(data.bodyKey, displayParams) : ''),
    titleKey:  data.titleKey,
    bodyKey:   data.bodyKey,
    params,
    icon:      data.icon      || 'ic-bell',
    severity:  data.severity  || 'info',
    read:      false,
    createdAt: new Date().toISOString(),
    link:      data.link      || null,
  });

  // تجنب تكرار نفس الإشعار في نفس اليوم (بناءً على type + link)
  const todayStr = today();
  const duplicate = notifs.find(n =>
    n.type === notif.type &&
    n.link === notif.link &&
    today(new Date(n.createdAt)) === todayStr
  );
  if (duplicate) return null;

  notifs.unshift(notif);
  // احتفظ بآخر MAX_NOTIFS إشعار فقط
  if (notifs.length > MAX_NOTIFS) notifs.length = MAX_NOTIFS;
  DB.set(NOTIF_KEY, notifs);
  return notif;
}

/** تعليم إشعار واحد كمقروء */
export function markRead(id) {
  const notifs = getNotifications();
  const idx = notifs.findIndex(n => n.id === id);
  if (idx !== -1) {
    notifs[idx].read = true;
    DB.set(NOTIF_KEY, notifs);
  }
}

/** تعليم جميع الإشعارات كمقروءة */
export function markAllRead() {
  const notifs = getNotifications();
  notifs.forEach(n => { n.read = true; });
  DB.set(NOTIF_KEY, notifs);
}

/** حذف جميع الإشعارات */
export function clearNotifications() {
  DB.set(NOTIF_KEY, []);
}

/** حذف إشعار واحد */
export function deleteNotification(id) {
  const notifs = getNotifications();
  DB.set(NOTIF_KEY, notifs.filter(n => n.id !== id));
}

/* ══════════════════════════════════════
   Native Notifications — إشعارات النظام
══════════════════════════════════════ */

/** هل الإشعارات الأصلية مدعومة؟ */
function nativeSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/** الحالة الحالية للإذن */
export function getPermissionStatus() {
  if (!nativeSupported()) return 'unsupported';
  return Notification.permission; // 'default'|'granted'|'denied'
}

/** هل سبق سؤال المستخدم؟ */
export function wasPermissionAsked() {
  return localStorage.getItem(PERMISSION_KEY) === '1';
}

/**
 * طلب إذن إشعارات النظام من المستخدم
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestNativePermission() {
  if (!nativeSupported()) return 'unsupported';
  localStorage.setItem(PERMISSION_KEY, '1');
  const result = await Notification.requestPermission();
  return result;
}

/**
 * إرسال إشعار أصلي عبر Service Worker (يظهر حتى في الخلفية)
 * @param {string} title
 * @param {string} body
 * @param {Object} options - link, tag
 */
export async function sendNativeNotification(title, body, options = {}) {
  if (!nativeSupported() || Notification.permission !== 'granted') return;

  try {
    const swReg = await navigator.serviceWorker.ready;
    swReg.showNotification(title, {
      body,
      icon:  './files/icon-192.png',
      badge: './files/icon-192-maskable.png',
      tag:   options.tag || 'cashpilot-notif',
      data:  { link: options.link || null },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    });
  } catch (err) {
    // Fallback: إشعار مباشر إن كان SW غير متاح
    try {
      new Notification(title, { body, icon: './files/icon-192.png' });
    } catch { /* silent */ }
  }
}

/* ══════════════════════════════════════
   Smart Trigger Engine — المحرك الذكي
══════════════════════════════════════ */

/**
 * المحرك الرئيسي — يُشغَّل عند فتح التطبيق
 * يفحص البيانات المالية ويولّد إشعارات ذكية
 */
export async function runSmartTriggers() {
  // تشغيل المحرك الذكي الجديد
  runSmartEngine();

  // إشعار ترحيبي يومي (مرة واحدة كل 24 ساعة)
  const now = new Date();
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  if (lastCheck !== today()) {
    localStorage.setItem(LAST_CHECK_KEY, today());

    const hour = now.getHours();
    const titleKey = hour < 12
      ? 'notif_greeting_am_title'
      : hour < 18 ? 'notif_greeting_pm_title' : 'notif_greeting_eve_title';

    addNotification({
      type:     'system',
      titleKey,
      bodyKey:  'notif_daily_summary',
      icon:     'ic-home',
      severity: 'info',
      link:     'dashboard',
    });
  }
}

/* ══════════════════════════════════════
   UI Helpers
══════════════════════════════════════ */

/** إنشاء HTML لكارت إشعار واحد */
export function notifItemHTML(notif) {
  const severityColor = {
    danger:  'var(--color-negative)',
    warning: 'var(--color-warning)',
    success: 'var(--color-positive)',
    info:    'var(--color-brand)',
  }[notif.severity] || 'var(--color-brand)';

  const timeAgo = formatTimeAgo(notif.createdAt);
  const deleteLabel = t('delete');

  return `
    <div class="notif-item ${notif.read ? '' : 'unread'}" id="notif-item-${esc(notif.id)}">
      <button type="button" class="notif-item-open" data-app-action="open-notification"
              data-item-id="${esc(notif.id)}" data-link="${esc(notif.link || '')}">
        <span class="notif-item-dot" aria-hidden="true" style="background:${severityColor}"></span>
        <span class="notif-item-content">
          <span class="notif-item-title">${esc(notif.title)}</span>
          <span class="notif-item-body">${esc(notif.body)}</span>
          <span class="notif-item-time">${esc(timeAgo)}</span>
        </span>
      </button>
      <button type="button" class="notif-item-delete" data-app-action="delete-notification"
              data-item-id="${esc(notif.id)}" aria-label="${esc(`${deleteLabel}: ${notif.title}`)}"
              title="${esc(deleteLabel)}">
        <svg class="icon icon-xs" viewBox="0 0 24 24"><use href="#ic-x"/></svg>
      </button>
    </div>`;
}

/** إيجاد زر فتح إشعار بمقارنة dataset، دون إدخال المعرّف داخل CSS selector. */
export function findNotificationOpenControl(id, root = document) {
  return [...root.querySelectorAll("[data-app-action='open-notification']")]
    .find(control => control.dataset.itemId === id) || null;
}

/** إعادة التركيز إلى نسخة زر الإشعار التي أُنشئت بعد تحديث القائمة. */
export function focusNotificationOpenControl(id, root = document) {
  const control = findNotificationOpenControl(id, root);
  if (!control || typeof control.focus !== 'function') return null;
  try {
    control.focus({ preventScroll: true });
  } catch {
    control.focus();
  }
  return control;
}

/** اختيار الإشعار التالي، أو السابق عند حذف آخر عنصر. */
export function notificationControlAfterDelete(controls, deletedIndex) {
  if (controls.length === 0) return null;
  const index = deletedIndex < 0 ? 0 : Math.min(deletedIndex, controls.length - 1);
  return controls[index] || null;
}

/** تحويل وقت الإشعار إلى صيغة نسبية */
function formatTimeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return t('notif_just_now');
  if (mins < 60)  return tf('notif_time_minutes', { count: mins });
  if (hours < 24) return tf('notif_time_hours', { count: hours });
  return tf('notif_time_days', { count: days });
}
