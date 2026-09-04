import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { setLang } = await import('../src/core/i18n.js');
const {
  findNotificationOpenControl,
  focusNotificationOpenControl,
  notificationControlAfterDelete,
  notifItemHTML,
} = await import('../src/services/notifications.js');
const { syncFilterChipSelection } = await import('../src/ui/nav.js');

test('transaction filters are native toggle buttons with one selected state', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tags = [...html.matchAll(/<(button|div)\b[^>]*class="filter-chip(?: active)?"[^>]*>/g)]
    .map(match => ({ tag: match[1], source: match[0] }));

  assert.equal(tags.length, 7);
  assert.ok(tags.every(item => item.tag === 'button'));
  assert.ok(tags.every(item => /\btype="button"/.test(item.source)));
  assert.ok(tags.every(item => /\bdata-filter="[^"]+"/.test(item.source)));
  assert.equal(new Set(tags.map(item => item.source.match(/data-filter="([^"]+)"/)[1])).size, 7);
  assert.equal(tags.filter(item => /aria-pressed="true"/.test(item.source)).length, 1);
  assert.equal(tags.filter(item => /aria-pressed="false"/.test(item.source)).length, 6);
});

test('filter selection keeps active and aria-pressed states synchronized', () => {
  const chip = () => ({
    active: false,
    attributes: {},
    classList: {
      toggle(name, enabled) {
        if (name === 'active') this.owner.active = enabled;
      },
      owner: null,
    },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const chips = [chip(), chip(), chip()];
  chips.forEach(item => { item.classList.owner = item; });
  const root = { querySelectorAll: () => chips };

  syncFilterChipSelection(chips[1], root);

  assert.deepEqual(chips.map(item => item.active), [false, true, false]);
  assert.deepEqual(chips.map(item => item.attributes['aria-pressed']), ['false', 'true', 'false']);
});

test('notification renderer emits sibling native actions with localized names', () => {
  const notification = {
    id: 'notice-1',
    title: 'موعد القسط',
    body: 'تفاصيل الإشعار',
    severity: 'warning',
    read: false,
    createdAt: new Date().toISOString(),
    link: 'debts',
  };

  setLang('ar');
  const arabic = notifItemHTML(notification);
  const wrapper = arabic.match(/<div class="notif-item[^>]*>/)?.[0] || '';
  const openStart = arabic.indexOf('class="notif-item-open"');
  const openEnd = arabic.indexOf('</button>', openStart);
  const deleteStart = arabic.indexOf('class="notif-item-delete"');

  assert.doesNotMatch(wrapper, /data-app-action=/);
  assert.match(arabic, /<button type="button" class="notif-item-open" data-app-action="open-notification"/);
  assert.match(arabic, /<button type="button" class="notif-item-delete" data-app-action="delete-notification"/);
  assert.ok(openStart !== -1 && openEnd !== -1 && deleteStart > openEnd, 'notification actions must be siblings');
  assert.match(arabic, /aria-label="حذف: موعد القسط"/);

  setLang('en');
  const english = notifItemHTML(notification);
  assert.match(english, /aria-label="Delete: موعد القسط"/);
  assert.match(english, /title="Delete"/);
  setLang('ar');
});

test('notification controls are found by inert dataset ids instead of selector interpolation', () => {
  const hostileId = 'notice"]:not(*)';
  let focused = null;
  const controls = [
    { dataset: { itemId: 'other' }, focus() { focused = this; } },
    { dataset: { itemId: hostileId }, focus(options) { this.focusOptions = options; focused = this; } },
  ];
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-app-action='open-notification']");
      return controls;
    },
  };

  assert.equal(findNotificationOpenControl(hostileId, root), controls[1]);
  assert.equal(findNotificationOpenControl('missing', root), null);
  assert.equal(focusNotificationOpenControl(hostileId, root), controls[1]);
  assert.equal(focused, controls[1]);
  assert.deepEqual(controls[1].focusOptions, { preventScroll: true });
  assert.equal(notificationControlAfterDelete(controls, 0), controls[0]);
  assert.equal(notificationControlAfterDelete(controls, 1), controls[1]);
  assert.equal(notificationControlAfterDelete([controls[0]], 1), controls[0]);
  assert.equal(notificationControlAfterDelete([], 0), null);
});

test('keyboard focus remains visible for filters and both notification actions', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.filter-chip:focus-visible\s*\{/);
  assert.match(css, /\.notif-item-open:focus-visible[\s\S]*\.notif-item-delete:focus-visible/);
  assert.match(css, /\.notif-item:focus-within \.notif-item-delete\s*\{\s*opacity:\s*1/);
  assert.match(css, /@media \(hover: none\)[\s\S]*\.notif-item-delete\s*\{\s*opacity:\s*1/);
});
