import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(name) {
    this.names.add(name);
  }

  remove(name) {
    this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }

  toggle(name, force) {
    if (force) this.names.add(name);
    else this.names.delete(name);
  }
}

const expenseHeading = {
  attributes: {},
  classList: new FakeClassList(),
  setAttribute(name, value) { this.attributes[name] = value; },
  focus(options) {
    this.focusOptions = options;
    document.activeElement = this;
  },
};
const expensesPage = {
  id: 'page-expenses',
  classList: new FakeClassList(),
  querySelector: () => expenseHeading,
};
const dashboardPage = { id: 'page-dashboard', classList: new FakeClassList('active') };
const expensesNav = { dataset: { page: 'expenses' }, classList: new FakeClassList('bottom-nav-item', 'fab-nav-center', 'active') };
const moreNav = { dataset: { page: 'more' }, classList: new FakeClassList('bottom-nav-item') };
const retainedFocus = { id: 'navigation-trigger' };

globalThis.document = {
  activeElement: retainedFocus,
  scrollingElement: { scrollTop: 480, scrollLeft: 12 },
  documentElement: { scrollTop: 480, scrollLeft: 12 },
  getElementById(id) {
    return [expensesPage, dashboardPage].find(page => page.id === id) || null;
  },
  querySelectorAll(selector) {
    if (selector === '.page') return [dashboardPage, expensesPage];
    if (selector === '.bottom-nav-item') return [expensesNav, moreNav];
    return [];
  },
};

const { bindCenterButton, focusPageDestination, navigateTo } = await import('../src/ui/nav.js');

test.beforeEach(() => {
  dashboardPage.classList = new FakeClassList('active');
  expensesPage.classList = new FakeClassList();
  expensesNav.classList = new FakeClassList('bottom-nav-item', 'fab-nav-center', 'active');
  moreNav.classList = new FakeClassList('bottom-nav-item');
  document.activeElement = retainedFocus;
  document.scrollingElement.scrollTop = 480;
  document.scrollingElement.scrollLeft = 12;
  expenseHeading.attributes = {};
  expenseHeading.classList = new FakeClassList();
  expenseHeading.focusOptions = null;
});

test('More exposes a visible desktop route to expense management', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(
    html,
    /<button class="more-nav-item" id="moreExpensesBtn" onclick="App\.navigateTo\('expenses'\)">/,
  );
  assert.match(html, /data-i18n="more_expenses">المصروفات</);
  assert.match(html, /data-i18n="more_expenses_sub">إدارة وتعديل المصروفات المسجلة</);
});

test('expense management activates its page and only the More navigation item', () => {
  let renderedPage = null;
  navigateTo('expenses', page => { renderedPage = page; });

  assert.equal(expensesPage.classList.contains('active'), true);
  assert.equal(dashboardPage.classList.contains('active'), false);
  assert.equal(moreNav.classList.contains('active'), true);
  assert.equal(expensesNav.classList.contains('active'), false);
  assert.equal(renderedPage, 'expenses');
  assert.equal(document.scrollingElement.scrollTop, 0);
  assert.equal(document.scrollingElement.scrollLeft, 0);
  assert.equal(document.activeElement, retainedFocus, 'ordinary navigation must not steal focus');
});

test('explicit destination focus targets the new page heading without scrolling it', () => {
  const focused = focusPageDestination('expenses');

  assert.equal(focused, expenseHeading);
  assert.equal(document.activeElement, expenseHeading);
  assert.equal(expenseHeading.attributes.tabindex, '-1');
  assert.equal(expenseHeading.classList.contains('navigation-focus-target'), true);
  assert.deepEqual(expenseHeading.focusOptions, { preventScroll: true });
});

test('the center button keeps its quick-add callback contract', () => {
  let clickHandler = null;
  let presses = 0;
  let propagationStopped = false;
  const centerButton = {
    addEventListener(type, handler) {
      assert.equal(type, 'click');
      clickHandler = handler;
    },
  };
  const originalQuerySelector = document.querySelector;
  document.querySelector = selector => selector === '.fab-nav-center' ? centerButton : null;

  try {
    bindCenterButton(() => { presses += 1; });
    clickHandler({ stopPropagation: () => { propagationStopped = true; } });
  } finally {
    document.querySelector = originalQuerySelector;
  }

  assert.equal(presses, 1);
  assert.equal(propagationStopped, true);
});
