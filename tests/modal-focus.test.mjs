import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let fakeDocument;

class FakeClassList {
  constructor(names = []) {
    this.names = new Set(names);
  }

  add(name) { this.names.add(name); }
  remove(name) { this.names.delete(name); }
  contains(name) { return this.names.has(name); }
}

class FakeElement {
  constructor({ id = '', classes = [], focusable = false, attributes = {} } = {}) {
    this.id = id;
    this.classList = new FakeClassList(classes);
    this.focusable = focusable;
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.listeners = new Map();
    this.isConnected = true;
  }

  append(...children) {
    children.forEach(child => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  descendants() {
    return this.children.flatMap(child => [child, ...child.descendants()]);
  }

  matches(selector) {
    if (selector === '.modal-overlay') return this.classList.contains('modal-overlay');
    if (selector === '.confirm-dialog') return this.classList.contains('confirm-dialog');
    if (selector === '.modal-close-btn') return this.classList.contains('modal-close-btn');
    if (selector === '[data-modal-initial-focus]') return this.attributes.has('data-modal-initial-focus');
    return false;
  }

  querySelector(selector) {
    const nodes = this.descendants();
    if (selector === '.modal, .confirm-box') {
      return nodes.find(node => node.classList.contains('modal') || node.classList.contains('confirm-box')) || null;
    }
    if (selector === '[data-modal-initial-focus]') {
      return nodes.find(node => node.matches(selector)) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector.includes('button:not([disabled])')) {
      return this.descendants().filter(node => node.focusable);
    }
    return this.descendants().filter(node => node.matches(selector));
  }

  contains(element) {
    return element === this || this.descendants().includes(element);
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  focus() {
    fakeDocument.activeElement = this;
  }
}

function createDocument(roots, activeElement) {
  const listeners = new Map();
  const allNodes = roots.flatMap(root => [root, ...root.descendants()]);

  return {
    activeElement,
    getElementById(id) {
      return allNodes.find(node => node.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '.modal-overlay') {
        return roots.filter(root => root.classList.contains('modal-overlay'));
      }
      if (selector === '.modal-overlay.active') {
        return roots.filter(root => root.classList.contains('modal-overlay') && root.classList.contains('active'));
      }
      if (selector === '.modal-close-btn') {
        return allNodes.filter(node => node.classList.contains('modal-close-btn'));
      }
      return [];
    },
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatchKey(key, shiftKey = false) {
      const event = {
        key,
        shiftKey,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
      };
      (listeners.get('keydown') || []).forEach(listener => listener(event));
      return event;
    },
  };
}

const launcher = new FakeElement({ id: 'launcher', focusable: true });
const subscriptionRoot = new FakeElement({ id: 'subscriptionModal', classes: ['modal-overlay'] });
const subscriptionPanel = new FakeElement({ classes: ['modal'] });
const firstInput = new FakeElement({ id: 'sub-name', focusable: true });
const deleteTrigger = new FakeElement({ id: 'delete-trigger', focusable: true });
const closeButton = new FakeElement({ classes: ['modal-close-btn'], focusable: true });
subscriptionPanel.append(firstInput, deleteTrigger, closeButton);
subscriptionRoot.append(subscriptionPanel);

const otherRoot = new FakeElement({ id: 'incomeModal', classes: ['modal-overlay'] });
const otherPanel = new FakeElement({ classes: ['modal'] });
const otherInput = new FakeElement({ id: 'inc-name', focusable: true });
otherPanel.append(otherInput);
otherRoot.append(otherPanel);

const confirmRoot = new FakeElement({ id: 'confirmDialog', classes: ['confirm-dialog'] });
const confirmPanel = new FakeElement({ classes: ['confirm-box'] });
const destructiveButton = new FakeElement({ id: 'confirm-delete', focusable: true });
const cancelButton = new FakeElement({
  id: 'confirm-cancel',
  focusable: true,
  attributes: { 'data-modal-initial-focus': '' },
});
confirmPanel.append(destructiveButton, cancelButton);
confirmRoot.append(confirmPanel);

fakeDocument = createDocument([subscriptionRoot, otherRoot, confirmRoot], launcher);
globalThis.document = fakeDocument;

const Modal = await import('../src/ui/modal.js');
const { getState, setState } = await import('../src/core/state.js');

test('modal focus is trapped, stacked Escape is safe, and focus returns to the opener', () => {
  Modal.bindModalEvents();

  launcher.focus();
  Modal.openModal('subscriptionModal');
  assert.equal(fakeDocument.activeElement, firstInput, 'opening focuses the first form field');

  Modal.openModal('subscriptionModal');
  Modal.closeModal('subscriptionModal');
  assert.equal(fakeDocument.activeElement, launcher, 'duplicate open does not replace the original opener');

  Modal.openModal('subscriptionModal');
  closeButton.focus();
  const forward = fakeDocument.dispatchKey('Tab');
  assert.equal(forward.defaultPrevented, true);
  assert.equal(fakeDocument.activeElement, firstInput, 'Tab wraps from last to first');

  const backward = fakeDocument.dispatchKey('Tab', true);
  assert.equal(backward.defaultPrevented, true);
  assert.equal(fakeDocument.activeElement, closeButton, 'Shift+Tab wraps from first to last');

  launcher.focus();
  fakeDocument.dispatchKey('Tab');
  assert.equal(fakeDocument.activeElement, firstInput, 'focus outside an active dialog is returned inside');

  deleteTrigger.focus();
  Modal.openConfirm('subscription', 'sub-1');
  assert.equal(fakeDocument.activeElement, cancelButton, 'confirmation initially focuses the safe action');
  assert.equal(confirmRoot.dataset.deleteType, 'subscription');
  assert.equal(confirmRoot.dataset.deleteId, 'sub-1');

  const firstEscape = fakeDocument.dispatchKey('Escape');
  assert.equal(firstEscape.defaultPrevented, true);
  assert.equal(firstEscape.propagationStopped, true);
  assert.equal(confirmRoot.classList.contains('active'), false);
  assert.equal(subscriptionRoot.classList.contains('active'), true, 'Escape closes only the top dialog');
  assert.equal(fakeDocument.activeElement, deleteTrigger);

  setState({ editingId: 'sub-1', editingType: 'subscription' });
  fakeDocument.dispatchKey('Escape');
  assert.equal(subscriptionRoot.classList.contains('active'), false);
  assert.equal(fakeDocument.activeElement, launcher);
  assert.equal(getState().editingId, null);
  assert.equal(getState().editingType, null);

  Modal.openModal('subscriptionModal');
  Modal.openModal('incomeModal');
  Modal.closeModal();
  assert.equal(subscriptionRoot.classList.contains('active'), false);
  assert.equal(otherRoot.classList.contains('active'), false);
  assert.equal(fakeDocument.activeElement, launcher, 'closing all modals restores focus outside them');
});

test('modal markup exposes names and keeps destructive confirmation from initial focus', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(
    (html.match(/class="modal" role="dialog" aria-modal="true" aria-labelledby="[^"]+" tabindex="-1"/g) || []).length,
    6,
  );
  for (const id of [
    'incomeModal-title',
    'expenseModal-title',
    'debtModal-title',
    'investmentModal-title',
    'subscriptionModal-title',
    'notifSettingsModal-title',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing modal title: ${id}`);
  }
  assert.match(
    html,
    /class="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirmDialog-title" aria-describedby="confirmDialog-description" tabindex="-1"/,
  );
  assert.match(html, /data-modal-initial-focus onclick="App\.cancelDelete\(\)"/);
});
