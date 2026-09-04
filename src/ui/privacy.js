/**
 * @module ui/privacy
 * @description إخفاء العروض المالية الشخصية بصريًا ومن Accessibility Tree دون تغيير البيانات.
 */

import { t } from '../core/i18n.js';

export const PRIVACY_SENSITIVE_SELECTOR = [
  '.hero-balance',
  '.nw-value',
  '.cf-amount',
  '.cf-progress-wrap',
  '.stat-value',
  '.transaction-amount',
  '.debt-amount-value',
  '.investment-detail-value',
  '.investment-roi',
  '.investment-quantity',
  '.budget-category-amounts',
  '.budget-category-amount',
  '.budget-status',
  '#budget-inputs',
  '.analytics-value',
  '.analytics-pct',
  '.progress-wrap',
  '.subscription-amount',
  '.notif-item-body',
  '#analytics-health-score',
  '#analytics-health-text',
  '#health-score-path',
  '#dash-spend-rate',
  '#dash-net',
  '#dash-safe-spend',
  '#dash-smart-insight',
  '#donutChart',
  '#barChart',
  '#lineChart',
  '#categoryChart',
].join(',');

const previousAriaHidden = new WeakMap();
const previousInert = new WeakMap();
const boundButtons = new WeakSet();
const observers = new WeakMap();

function setSensitiveState(element, hidden) {
  element.classList?.add('privacy-sensitive');
  if (hidden) {
    if (!previousAriaHidden.has(element)) {
      previousAriaHidden.set(
        element,
        element.hasAttribute?.('aria-hidden') ? element.getAttribute('aria-hidden') : null,
      );
    }
    element.setAttribute?.('aria-hidden', 'true');
    if (element.id === 'budget-inputs') {
      if (!previousInert.has(element)) {
        previousInert.set(element, element.hasAttribute?.('inert') === true);
      }
      element.setAttribute?.('inert', '');
    }
    return;
  }

  if (!previousAriaHidden.has(element)) return;
  const previous = previousAriaHidden.get(element);
  if (previous === null) element.removeAttribute?.('aria-hidden');
  else element.setAttribute?.('aria-hidden', previous);
  previousAriaHidden.delete(element);

  if (element.id === 'budget-inputs' && previousInert.has(element)) {
    if (!previousInert.get(element)) element.removeAttribute?.('inert');
    previousInert.delete(element);
  }
}

function syncControl(hidden, root) {
  const button = root.getElementById?.('privacyBtn');
  const icon = root.getElementById?.('privacyIcon');
  const actionKey = hidden ? 'privacy_show' : 'privacy_hide';

  if (button) {
    button.setAttribute('aria-pressed', String(hidden));
    button.setAttribute('aria-label', t('privacy_mode'));
    button.setAttribute('title', t(actionKey));
    if (button.dataset) {
      button.dataset.i18nAriaLabel = 'privacy_mode';
      button.dataset.i18nTitle = actionKey;
    }
  }
  icon?.querySelector?.('use')?.setAttribute('href', hidden ? '#ic-eye-off' : '#ic-eye');
}

export function syncPrivacyMode(root = document) {
  const hidden = root.body?.classList?.contains('privacy-mode') === true;
  root.querySelectorAll(PRIVACY_SENSITIVE_SELECTOR)
    .forEach(element => setSensitiveState(element, hidden));
  syncControl(hidden, root);
  return hidden;
}

export function setPrivacyMode(hidden, root = document) {
  root.body?.classList?.toggle('privacy-mode', Boolean(hidden));
  return syncPrivacyMode(root);
}

export function bindPrivacyMode(root = document) {
  const button = root.getElementById?.('privacyBtn');
  if (button && !boundButtons.has(button)) {
    boundButtons.add(button);
    button.addEventListener('click', () => {
      const hidden = !root.body.classList.contains('privacy-mode');
      setPrivacyMode(hidden, root);
    });
  }

  if (root.body && typeof globalThis.MutationObserver === 'function' && !observers.has(root)) {
    const observer = new MutationObserver(() => {
      if (root.body.classList.contains('privacy-mode')) syncPrivacyMode(root);
    });
    observer.observe(root.body, { childList: true, subtree: true });
    observers.set(root, observer);
  }

  syncPrivacyMode(root);
}
