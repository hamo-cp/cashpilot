import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

class FakeClassList {
  constructor(...names) { this.names = new Set(names); }
  add(name) { this.names.add(name); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    if (force) this.names.add(name);
    else this.names.delete(name);
  }
}

function sensitiveElement(text, ariaHidden = null) {
  const attributes = new Map();
  if (ariaHidden !== null) attributes.set('aria-hidden', ariaHidden);
  return {
    id: '',
    textContent: text,
    classList: new FakeClassList(),
    hasAttribute: name => attributes.has(name),
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: name => attributes.delete(name),
  };
}

const values = [
  sensitiveElement('12,000 EGP'),
  sensitiveElement('40%', 'false'),
];
const budgetInputs = sensitiveElement('5000');
budgetInputs.id = 'budget-inputs';
values.push(budgetInputs);
const buttonAttributes = new Map();
let clickHandler = null;
const privacyButton = {
  dataset: {},
  setAttribute(name, value) { buttonAttributes.set(name, String(value)); },
  addEventListener(type, handler) {
    assert.equal(type, 'click');
    clickHandler = handler;
  },
};
const useAttributes = new Map();
const privacyIcon = {
  querySelector: selector => selector === 'use'
    ? { setAttribute: (name, value) => useAttributes.set(name, value) }
    : null,
};
const body = { classList: new FakeClassList() };
const root = {
  body,
  documentElement: { lang: 'ar', dir: 'rtl' },
  getElementById(id) {
    if (id === 'privacyBtn') return privacyButton;
    if (id === 'privacyIcon') return privacyIcon;
    return null;
  },
  querySelectorAll(selector) {
    if (selector.startsWith('[data-i18n')) return [];
    return values;
  },
};

globalThis.document = root;
globalThis.localStorage = { getItem: () => null, setItem() {} };

const { setLang } = await import('../src/core/i18n.js');
const {
  PRIVACY_SENSITIVE_SELECTOR,
  bindPrivacyMode,
  setPrivacyMode,
  syncPrivacyMode,
} = await import('../src/ui/privacy.js');

test.beforeEach(() => {
  body.classList = new FakeClassList();
  values.splice(2);
  values.push(budgetInputs);
  values[0].removeAttribute('aria-hidden');
  values[1].setAttribute('aria-hidden', 'false');
  budgetInputs.removeAttribute('aria-hidden');
  budgetInputs.removeAttribute('inert');
  values.forEach(value => { value.classList = new FakeClassList(); });
  buttonAttributes.clear();
  useAttributes.clear();
  privacyButton.dataset = {};
  clickHandler = null;
  setLang('ar');
});

test('privacy mode removes passive financial displays from the accessibility tree without changing data', () => {
  const originalText = values.map(value => value.textContent);
  bindPrivacyMode(root);
  clickHandler();

  assert.equal(body.classList.contains('privacy-mode'), true);
  assert.deepEqual(values.map(value => value.getAttribute('aria-hidden')), ['true', 'true', 'true']);
  assert.ok(values.every(value => value.classList.contains('privacy-sensitive')));
  assert.deepEqual(values.map(value => value.textContent), originalText, 'privacy mode must not rewrite financial data');
  assert.equal(buttonAttributes.get('aria-pressed'), 'true');
  assert.equal(buttonAttributes.get('aria-label'), 'الخصوصية المالية');
  assert.equal(buttonAttributes.get('title'), 'إظهار القيم المالية');
  assert.equal(privacyButton.dataset.i18nAriaLabel, 'privacy_mode');
  assert.equal(useAttributes.get('href'), '#ic-eye-off');
  assert.equal(budgetInputs.hasAttribute('inert'), true, 'passive budget editor must not remain focusable');

  const dynamicValue = sensitiveElement('250 EGP');
  values.push(dynamicValue);
  syncPrivacyMode(root);
  assert.equal(dynamicValue.getAttribute('aria-hidden'), 'true', 'newly rendered values must inherit privacy mode');

  setPrivacyMode(false, root);
  assert.equal(body.classList.contains('privacy-mode'), false);
  assert.equal(values[0].getAttribute('aria-hidden'), null);
  assert.equal(values[1].getAttribute('aria-hidden'), 'false', 'pre-existing ARIA state must be restored');
  assert.equal(dynamicValue.getAttribute('aria-hidden'), null);
  assert.equal(budgetInputs.hasAttribute('inert'), false);
  assert.equal(buttonAttributes.get('aria-pressed'), 'false');
  assert.equal(buttonAttributes.get('aria-label'), 'الخصوصية المالية');
  assert.equal(buttonAttributes.get('title'), 'إخفاء القيم المالية');
  assert.equal(useAttributes.get('href'), '#ic-eye');
});

test('privacy control label follows the current language and selector covers passive bypasses', () => {
  setLang('en');
  setPrivacyMode(true, root);
  assert.equal(buttonAttributes.get('aria-label'), 'Financial privacy');
  assert.equal(buttonAttributes.get('title'), 'Show financial values');

  for (const selector of [
    '.subscription-amount',
    '.investment-quantity',
    '.budget-status',
    '#budget-inputs',
    '.notif-item-body',
    '#analytics-health-text',
    '#health-score-path',
    '#donutChart',
    '#categoryChart',
  ]) {
    assert.ok(PRIVACY_SENSITIVE_SELECTOR.includes(selector), `missing privacy surface: ${selector}`);
  }
  assert.equal(
    PRIVACY_SENSITIVE_SELECTOR.split(',').some(selector => /^input(?:\b|\[)/.test(selector.trim())),
    false,
    'explicit edit controls stay usable',
  );
  assert.equal(PRIVACY_SENSITIVE_SELECTOR.includes('.market-card-price'), false, 'public market prices stay visible');

  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /body\.privacy-mode \.privacy-sensitive\s*\{/);
  assert.match(css, /body\.privacy-mode canvas\.privacy-sensitive[\s\S]*pointer-events:\s*none/);
  const serviceWorker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.ok(serviceWorker.includes("'./src/ui/privacy.js'"));
});
