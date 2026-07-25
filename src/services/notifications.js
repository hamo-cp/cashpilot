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
import { t }          from '../core/i18n.js';
import * as Finance   from './finance.js';
import { runSmartEngine } from './smart-engine.js';

/* ══════════════════════════════════════
   Constants
══════════════════════════════════════ */
const NOTIF_KEY       = 'mz_notifications';
const LAST_CHECK_KEY  = 'mz_notif_last_check';
const PERMISSION_KEY  = 'mz_notif_permission_asked';
const MAX_NOTIFS      = 50; // أقصى عدد للإشعارات المحفوظة

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86_400_000);
}

/* ══════════════════════════════════════
   CRUD — الإشعارات المحفوظة
══════════════════════════════════════ */

/** جلب جميع الإشعارات (الأحدث أولاً) */
export function getNotifications() {
  const raw = DB.get(NOTIF_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** عدد الإشعارات غير المقروءة */
export function getUnreadCount() {
  return getNotifications().filter(n => !n.read).length;
}

/** إضافة إشعار جديد */
export function addNotification(data) {
  const notifs = DB.get(NOTIF_KEY) || [];
  const notif = {
    id:        uid(),
    type:      data.type      || 'system',
    title:     data.title     || '',
    body:      data.body      || '',
    icon:      data.icon      || 'ic-bell',
    severity:  data.severity  || 'info',
    read:      false,
    createdAt: new Date().toISOString(),
    link:      data.link      || null,
  };

  // تجنب تكرار نفس الإشعار في نفس اليوم (بناءً على type + link)
  const todayStr = today();
  const duplicate = notifs.find(n =>
    n.type === notif.type &&
    n.link === notif.link &&
    n.createdAt.startsWith(todayStr)
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
  const notifs = DB.get(NOTIF_KEY) || [];
  const idx = notifs.findIndex(n => n.id === id);
  if (idx !== -1) {
    notifs[idx].read = true;
    DB.set(NOTIF_KEY, notifs);
  }
}

/** تعليم جميع الإشعارات كمقروءة */
export function markAllRead() {
  const notifs = DB.get(NOTIF_KEY) || [];
  notifs.forEach(n => { n.read = true; });
  DB.set(NOTIF_KEY, notifs);
}

/** حذف جميع الإشعارات */
export function clearNotifications() {
  DB.set(NOTIF_KEY, []);
}

/** حذف إشعار واحد */
export function deleteNotification(id) {
  const notifs = DB.get(NOTIF_KEY) || [];
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
    const greet = hour < 12
      ? (t('greeting_am') || 'صباح الخير')
      : hour < 18
        ? (t('greeting_pm') || 'مساء الخير')
        : (t('greeting_eve') || 'مساء النور');

    addNotification({
      type:     'system',
      title:    greet + ' 👋',
      body:     t('notif_daily_summary') || 'افتح التطبيق لمراجعة وضعك المالي اليوم.',
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

  return `
    <div class="notif-item ${notif.read ? '' : 'unread'}" 
         onclick="App.openNotif('${notif.id}', '${notif.link || ''}')"
         id="notif-item-${notif.id}">
      <div class="notif-item-dot" style="background:${severityColor}"></div>
      <div class="notif-item-content">
        <div class="notif-item-title">${notif.title}</div>
        <div class="notif-item-body">${notif.body}</div>
        <div class="notif-item-time">${timeAgo}</div>
      </div>
      <button class="notif-item-delete" onclick="event.stopPropagation();App.deleteNotif('${notif.id}')" title="حذف">
        <svg class="icon icon-xs" viewBox="0 0 24 24"><use href="#ic-x"/></svg>
      </button>
    </div>`;
}

/** تحويل وقت الإشعار إلى صيغة نسبية */
function formatTimeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)    return t('notif_just_now')   || 'الآن';
  if (mins < 60)   return `${t('notif_mins_ago') || 'منذ'} ${mins} ${t('notif_mins') || 'د'}`;
  if (hours < 24)  return `${t('notif_hours_ago') || 'منذ'} ${hours} ${t('notif_hours') || 'س'}`;
  return `${t('notif_days_ago') || 'منذ'} ${days} ${t('notif_days') || 'أيام'}`;
}
