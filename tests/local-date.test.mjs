import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  clear() {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  querySelectorAll: () => [],
  getElementById: () => null,
};

const { daysUntil, today } = await import('../src/core/utils.js');
const Notifications = await import('../src/services/notifications.js');

test.beforeEach(() => storage.clear());

test('local calendar date wins over the previous UTC date at the midnight boundary', () => {
  const cairoAfterMidnight = {
    getFullYear: () => 2026,
    getMonth: () => 8,
    getDate: () => 4,
    toISOString: () => '2026-09-03T21:30:00.000Z',
  };

  assert.equal(cairoAfterMidnight.toISOString().slice(0, 10), '2026-09-03');
  assert.equal(today(cairoAfterMidnight), '2026-09-04');
  assert.equal(daysUntil('2026-09-03', cairoAfterMidnight), -1);
  assert.equal(daysUntil('2026-09-04', cairoAfterMidnight), 0);
  assert.equal(daysUntil('2026-09-05', cairoAfterMidnight), 1);
  assert.equal(daysUntil('2026-02-30', cairoAfterMidnight), null);
});

test('date-only defaults use the shared local calendar helper', () => {
  const sources = [
    readFileSync(new URL('../src/pages/expenses.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/pages/investments.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/services/notifications.js', import.meta.url), 'utf8'),
  ];

  for (const source of sources) {
    assert.doesNotMatch(source, /toISOString\(\)\.(?:split\('T'\)\[0\]|slice\(0,\s*10\))/);
  }
  assert.match(sources[0], /exp-date'[\s\S]*\|\| today\(\)/);
  assert.match(sources[1], /inv-start'[\s\S]*\|\| today\(\)/);
  assert.match(sources[2], /import \{[^}]*\btoday\b[^}]*\} from '\.\.\/core\/utils\.js'/);
});

test('notification deduplication uses the local day while preserving UTC timestamps', () => {
  const NativeDate = globalThis.Date;
  const boundaryInstant = '2026-09-03T21:30:00.000Z';

  class CairoBoundaryDate extends NativeDate {
    constructor(value) {
      super(value === undefined ? boundaryInstant : value);
    }

    getFullYear() { return 2026; }
    getMonth() { return 8; }
    getDate() { return 4; }
  }

  globalThis.Date = CairoBoundaryDate;
  try {
    const data = {
      type: 'system',
      title: 'Boundary notification',
      body: 'Local day regression',
      link: 'dashboard',
    };
    const first = Notifications.addNotification(data);
    const duplicate = Notifications.addNotification(data);

    assert.equal(first.createdAt, boundaryInstant);
    assert.equal(today(new Date(first.createdAt)), '2026-09-04');
    assert.equal(duplicate, null);
  } finally {
    globalThis.Date = NativeDate;
  }
});
