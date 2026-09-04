import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = process.env.CASHPILOT_CDP_PORT;
const baseUrl = process.env.CASHPILOT_BASE_URL || 'http://127.0.0.1:3000';
const desktopScreenshot = process.env.CASHPILOT_DESKTOP_SCREENSHOT || join(tmpdir(), 'cashpilot-desktop.png');
const mobileScreenshot = process.env.CASHPILOT_MOBILE_SCREENSHOT || join(tmpdir(), 'cashpilot-mobile.png');
if (!port) throw new Error('CASHPILOT_CDP_PORT is required');
const cdpEndpoint = `http://127.0.0.1:${port}`;

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  waitFor(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const listener = params => {
        clearTimeout(timer);
        const listeners = this.listeners.get(method) || [];
        this.listeners.set(method, listeners.filter(item => item !== listener));
        resolve(params);
      };
      this.on(method, listener);
    });
  }

  close() {
    this.socket?.close();
  }
}

async function retry(fn, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Timed out waiting for browser condition');
}

async function openTarget() {
  await retry(async () => (await fetch(`${cdpEndpoint}/json/version`)).ok, 10_000);
  const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create a dedicated CDP target: ${response.status}`);
  return { ...(await response.json()), createdByTest: true };
}

const target = await openTarget();
const cdp = new CdpClient(target.webSocketDebuggerUrl);

const requests = [];
const failedResponses = [];
const consoleErrors = [];
cdp.on('Network.requestWillBeSent', params => requests.push(params.request.url));
cdp.on('Network.responseReceived', params => {
  if (params.response.status >= 400) {
    failedResponses.push({ status: params.response.status, url: params.response.url });
  }
});
cdp.on('Runtime.exceptionThrown', params => consoleErrors.push(params.exceptionDetails.text));
cdp.on('Runtime.consoleAPICalled', params => {
  if (params.type === 'error') consoleErrors.push(params.args.map(arg => arg.value || arg.description || '').join(' '));
});
cdp.on('Log.entryAdded', params => {
  if (params.entry.level === 'error') consoleErrors.push(params.entry.text);
});

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function navigate(url = baseUrl) {
  const expectedOrigin = new URL(url).origin;
  const loaded = cdp.waitFor('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  await retry(() => evaluate(`
    return location.origin === ${JSON.stringify(expectedOrigin)}
      && typeof window.App?.navigateTo === 'function';
  `));
}

async function waitForCurrentApp() {
  const expectedOrigin = new URL(baseUrl).origin;
  await retry(() => evaluate(`
    return document.readyState === 'complete'
      && location.origin === ${JSON.stringify(expectedOrigin)}
      && typeof window.App?.navigateTo === 'function';
  `));
}

async function screenshot(path) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

async function waitForAnalyticsCanvases() {
  await retry(() => evaluate(`
    const page = document.getElementById('page-analytics');
    const canvases = ['lineChart', 'categoryChart'].map(id => document.getElementById(id));
    return Boolean(
      page?.classList.contains('active')
      && typeof Chart === 'function'
      && typeof Chart.getChart === 'function'
      && canvases.every(canvas => {
        const rect = canvas?.getBoundingClientRect();
        return canvas
          && canvas.width > 0
          && canvas.height > 0
          && rect.width > 0
          && rect.height > 0
          && Boolean(Chart.getChart(canvas));
      })
    );
  `));
}

async function waitForTwoAnimationFrames() {
  await evaluate(`
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return true;
  `);
}

async function visibleArabicLeaks() {
  return evaluate(`
    const pattern = /[\\u0600-\\u06FF]/;
    const roots = [...document.querySelectorAll(
      '.top-nav, .bottom-nav, .page.active, .modal-overlay.active, .confirm-dialog.active, #toastContainer, #offlineBanner'
    )];
    const leaks = [];
    for (const root of roots) {
      const text = root.innerText || '';
      if (pattern.test(text)) {
        leaks.push({ kind: 'text', root: root.id || root.className, value: text.match(/[\\u0600-\\u06FF][^\\n]{0,120}/)?.[0] });
      }
      for (const element of [root, ...root.querySelectorAll('[placeholder], [title], [aria-label], option')]) {
        for (const attribute of ['placeholder', 'title', 'aria-label']) {
          const value = element.getAttribute?.(attribute);
          if (value && pattern.test(value)) leaks.push({ kind: attribute, element: element.id || element.tagName, value });
        }
        if (element.tagName === 'OPTION' && pattern.test(element.textContent || '')) {
          leaks.push({ kind: 'option', value: element.textContent });
        }
      }
    }
    for (const [kind, value] of [
      ['document.title', document.title],
      ['meta.description', document.querySelector('meta[name="description"]')?.content || ''],
    ]) {
      if (pattern.test(value)) leaks.push({ kind, value });
    }
    return leaks;
  `);
}

function accessibleStrings(nodes) {
  return nodes
    .filter(node => node.ignored !== true)
    .flatMap(node => [node.name?.value, node.value?.value, node.description?.value])
    .filter(value => typeof value === 'string');
}

function assertContainedHeader(layout) {
  assert.equal(layout.innerWidth, 320, JSON.stringify(layout));
  assert.ok(layout.scrollWidth <= layout.clientWidth, JSON.stringify(layout));
  assert.ok(layout.navScrollWidth <= layout.navClientWidth, JSON.stringify(layout));
  assert.deepEqual(layout.overlaps, [], JSON.stringify(layout));
  assert.ok(layout.children.every(child => child.left >= -0.5 && child.right <= layout.innerWidth + 0.5), JSON.stringify(layout));
}

try {
  await cdp.connect();
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Network.enable'),
    cdp.send('Log.enable'),
    cdp.send('Accessibility.enable'),
  ]);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate();
  await evaluate(`
    localStorage.clear();
    sessionStorage.clear();
    return true;
  `);
  await navigate();
  await retry(() => evaluate("return !document.getElementById('welcomeScreen');"), 6_000);

  const identity = await evaluate(`
    return {
      url: location.href,
      title: document.title,
      meaningful: document.body.textContent.includes('ميزانيتي'),
      welcomeGone: !document.getElementById('welcomeScreen'),
      aiButtonGone: !document.getElementById(['ai', 'GenerateBtn'].join('')),
      aiMethodGone: typeof App[['generate', 'AIInsights'].join('')] === 'undefined',
      chartLocal: typeof Chart === 'function',
    };
  `);
  assert.equal(identity.url.replace(/\/$/, ''), baseUrl.replace(/\/$/, ''));
  assert.equal(identity.title, 'ميزانيتي — مدير الميزانية الشخصية');
  assert.equal(identity.meaningful, true);
  assert.equal(identity.welcomeGone, true);
  assert.equal(identity.aiButtonGone, true);
  assert.equal(identity.aiMethodGone, true);
  assert.equal(identity.chartLocal, true);

  await evaluate(`
    App.openIncomeModal();
    document.getElementById('inc-name').value = 'Salary';
    document.getElementById('inc-amount').value = '10000';
    document.getElementById('inc-source').value = 'salary';
    document.getElementById('inc-date').value = new Date().toISOString().slice(0, 10);
    document.querySelector('#incomeModal .btn-success').click();
  `);
  await new Promise(resolve => setTimeout(resolve, 700));

  await evaluate(`
    App.openExpenseModal();
    document.getElementById('exp-name').value = 'Food';
    document.getElementById('exp-amount').value = '500';
    document.getElementById('exp-category').value = 'food';
    document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
    document.querySelector('#expenseModal .btn-danger').click();
  `);
  await new Promise(resolve => setTimeout(resolve, 700));

  await evaluate(`
    App.navigateTo('subscriptions');
    App.openSubscriptionModal();
    document.getElementById('sub-name').value = 'Streaming';
    document.getElementById('sub-amount').value = '200';
    document.getElementById('sub-due').value = '2026-09-10';
    document.querySelector('#subscriptionModal .btn-primary').click();
  `);
  await new Promise(resolve => setTimeout(resolve, 250));
  const subscriptionCreateState = await retry(() => evaluate(`
    let subscriptions;
    let storageError;
    try { subscriptions = JSON.parse(localStorage.getItem('mz_subscriptions') || '[]'); }
    catch (error) { storageError = error.toString(); }
    const state = {
      url: location.href,
      origin: location.origin,
      baseURI: document.baseURI,
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      visible: document.getElementById('subs-list').textContent,
      emptyVisible: getComputedStyle(document.getElementById('subs-empty')).display,
      modalActive: document.getElementById('subscriptionModal').classList.contains('active'),
      subscriptions,
      storageError,
    };
    if (subscriptions?.length === 1 && state.visible.includes('Streaming')) return state;
    throw new Error('Subscription creation not complete: ' + JSON.stringify(state));
  `));
  assert.equal(
    subscriptionCreateState.visible.includes('Streaming'),
    true,
    JSON.stringify({ subscriptionCreateState, consoleErrors }),
  );
  assert.equal(subscriptionCreateState.emptyVisible, 'none');
  assert.equal(subscriptionCreateState.modalActive, false);
  assert.equal(subscriptionCreateState.storageError, undefined);
  assert.equal(subscriptionCreateState.subscriptions.length, 1);
  const [createdSubscription] = subscriptionCreateState.subscriptions;
  assert.equal(typeof createdSubscription.id, 'string');
  assert.notEqual(createdSubscription.id, '');
  assert.equal(createdSubscription.name, 'Streaming');
  assert.equal(createdSubscription.amount, 200);
  assert.equal(createdSubscription.dueDate, '2026-09-10');
  await new Promise(resolve => setTimeout(resolve, 700));

  await evaluate(`
    const editButton = [...document.querySelectorAll('[data-app-action="edit"][data-item-type="subscription"]')]
      .find(button => button.dataset.itemId === ${JSON.stringify(createdSubscription.id)});
    if (!editButton) throw new Error('Created subscription edit control was not rendered');
    editButton.click();
    return true;
  `);
  const subscriptionPrefillState = await retry(() => evaluate(`
    const modal = document.getElementById('subscriptionModal');
    if (!modal.classList.contains('active')) return null;
    return {
      modalActive: true,
      name: document.getElementById('sub-name').value,
      amount: document.getElementById('sub-amount').value,
      dueDate: document.getElementById('sub-due').value,
    };
  `));
  assert.deepEqual(subscriptionPrefillState, {
    modalActive: true,
    name: 'Streaming',
    amount: '200',
    dueDate: '2026-09-10',
  });

  await evaluate(`
    document.getElementById('sub-name').value = 'Streaming Plus';
    document.getElementById('sub-amount').value = '250';
    document.querySelector('#subscriptionModal .btn-primary').click();
    return true;
  `);
  const subscriptionEditState = await retry(() => evaluate(`
    const subscriptions = JSON.parse(localStorage.getItem('mz_subscriptions') || '[]');
    const modalActive = document.getElementById('subscriptionModal').classList.contains('active');
    const visibleRecords = document.querySelectorAll('#subs-list > .card');
    if (
      modalActive
      || subscriptions.length !== 1
      || subscriptions[0]?.name !== 'Streaming Plus'
      || !document.getElementById('subs-list').textContent.includes('Streaming Plus')
    ) return null;
    return {
      subscriptions,
      visibleRecordCount: visibleRecords.length,
      editButtonIds: [...document.querySelectorAll('[data-app-action="edit"][data-item-type="subscription"]')]
        .map(button => button.dataset.itemId),
    };
  `));
  assert.equal(subscriptionEditState.subscriptions.length, 1);
  assert.equal(subscriptionEditState.subscriptions[0].id, createdSubscription.id);
  assert.equal(subscriptionEditState.subscriptions[0].name, 'Streaming Plus');
  assert.equal(subscriptionEditState.subscriptions[0].amount, 250);
  assert.equal(subscriptionEditState.subscriptions[0].dueDate, '2026-09-10');
  assert.equal(subscriptionEditState.visibleRecordCount, 1);
  assert.deepEqual(subscriptionEditState.editButtonIds, [createdSubscription.id]);

  const exploit = '<img id="cp-injected" src=x onerror="window.__cpXss=1">';
  const inertState = await evaluate(`
    const exploit = ${JSON.stringify(exploit)};
    localStorage.setItem('mz_subscriptions', JSON.stringify([{
      id: "x');window.__cpXss=1;//",
      name: exploit,
      amount: 50,
      dueDate: '2026-09-12',
    }]));
    localStorage.setItem('mz_notifications', JSON.stringify([{
      id: "x');window.__cpXss=1;//",
      type: 'system',
      title: exploit,
      body: exploit,
      severity: 'info',
      read: false,
      createdAt: new Date().toISOString(),
      link: 'dashboard',
    }]));
    App.navigateTo('subscriptions');
    const subscriptionText = document.getElementById('subs-list').textContent;
    App.navigateTo('notifications');
    return {
      injectedElement: Boolean(document.getElementById('cp-injected')),
      executed: window.__cpXss,
      literalTextPreserved: subscriptionText.includes('<img id="cp-injected"'),
      inlineDynamicHandlers: document.querySelectorAll('[data-item-id][onclick]').length,
    };
  `);
  assert.equal(inertState.injectedElement, false);
  assert.equal(inertState.executed, undefined);
  assert.equal(inertState.literalTextPreserved, true);
  assert.equal(inertState.inlineDynamicHandlers, 0);

  const maliciousFetchedAt = '<img id=cp-market-x src=x onerror=window.__cpMarketXss=true>';
  await evaluate(`
    window.__cpMarketXss = false;
    localStorage.setItem('cashpilot_market_cache_v2', JSON.stringify({
      timestamp: Date.now(),
      data: {
        usdEgp: { price: 49, change: 0, changePercent: 0 },
        globalGold: { price: 2400, change: 0, changePercent: 0 },
        globalSilver: { price: 28, change: 0, changePercent: 0 },
        local: { gold24k: 3800, gold21k: 3325, silver: 44 },
        egx: {
          comi: { price: 75, prevClose: 74, change: 1, changePercent: 1.35 },
          fwry: { price: 6.25, prevClose: 6.5, change: -0.25, changePercent: -3.85 },
        },
        fetchedAt: ${JSON.stringify(maliciousFetchedAt)},
      },
    }));
    document.getElementById('market-ticker')?.replaceChildren();
    App.navigateTo('dashboard');
  `);
  await retry(() => evaluate("return document.querySelector('#donutChart').width > 0;"));
  await evaluate("App.navigateTo('expenses'); return true;");
  await retry(() => evaluate("return document.querySelector('#barChart').width > 0;"));
  await evaluate("App.navigateTo('analytics'); return true;");
  await retry(() => evaluate("return document.querySelector('#lineChart').width > 0 && document.querySelector('#categoryChart').width > 0;"));
  await evaluate("App.navigateTo('investments'); return true;");
  await retry(() => evaluate("return document.querySelectorAll('#market-ticker .market-card').length === 6;"));

  const marketSafe = await evaluate(`
    return {
      cards: document.querySelectorAll('#market-ticker .market-card').length,
      titles: [...document.querySelectorAll('#market-ticker .market-card-title')].map(element => element.textContent),
      fetchedAtLiteral: document.querySelector('#market-ticker .market-meta')?.textContent.includes(${JSON.stringify(maliciousFetchedAt)}),
      completeCards: [...document.querySelectorAll('#market-ticker .market-card')].every(card =>
        card.querySelector('.market-card-title')
        && card.querySelector('.market-card-price')
        && card.querySelector('.market-card-change')
      ),
      injected: Boolean(document.querySelector('#market-ticker script, #market-ticker img, #market-ticker [onerror], #market-ticker [onload]')),
      executed: window.__cpMarketXss,
    };
  `);
  assert.equal(marketSafe.cards, 6);
  assert.deepEqual(marketSafe.titles, [
    '🥇 ذهب عيار 24',
    '🥇 ذهب عيار 21',
    '🥈 الفضة',
    '💵 الدولار',
    'CIB (COMI)',
    'FWRY',
  ]);
  assert.equal(marketSafe.fetchedAtLiteral, true);
  assert.equal(marketSafe.completeCards, true);
  assert.equal(marketSafe.injected, false);
  assert.equal(marketSafe.executed, false);

  await evaluate(`
    document.getElementById('moreLangBtn').click();
    return true;
  `);
  const englishIdentity = await retry(() => evaluate(`
    return document.documentElement.lang === 'en'
      ? { lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title }
      : null;
  `));
  assert.deepEqual(englishIdentity, {
    lang: 'en',
    dir: 'ltr',
    title: 'Mizanity — Personal Finance Manager',
  });

  for (const page of [
    'dashboard', 'income', 'expenses', 'debts', 'investments', 'budget',
    'analytics', 'transactions', 'more', 'notifications', 'subscriptions',
  ]) {
    await evaluate(`App.navigateTo(${JSON.stringify(page)}); return true;`);
    if (page === 'investments') {
      await retry(() => evaluate("return document.querySelectorAll('#market-ticker .market-card').length >= 4;"));
    }
    await waitForTwoAnimationFrames();
    assert.deepEqual(await visibleArabicLeaks(), [], `Arabic leaked from English page: ${page}`);
  }

  await evaluate(`
    document.getElementById('moreLangBtn').click();
    App.navigateTo('dashboard');
    return true;
  `);
  await new Promise(resolve => setTimeout(resolve, 1_300));
  const privacyBefore = await evaluate(`
    return {
      value: document.getElementById('dash-net-balance').textContent,
      incomeStorage: localStorage.getItem('mz_income'),
      expenseStorage: localStorage.getItem('mz_expenses'),
    };
  `);
  const axBefore = accessibleStrings((await cdp.send('Accessibility.getFullAXTree')).nodes);
  assert.ok(axBefore.some(value => value.includes(privacyBefore.value)), JSON.stringify({ privacyBefore, axBefore }));

  await evaluate(`document.getElementById('privacyBtn').click(); return true;`);
  const privacyHidden = await evaluate(`
    return {
      value: document.getElementById('dash-net-balance').textContent,
      ariaHidden: document.getElementById('dash-net-balance').getAttribute('aria-hidden'),
      chartHidden: document.getElementById('donutChart').getAttribute('aria-hidden'),
      pressed: document.getElementById('privacyBtn').getAttribute('aria-pressed'),
      incomeStorage: localStorage.getItem('mz_income'),
      expenseStorage: localStorage.getItem('mz_expenses'),
    };
  `);
  const axHidden = accessibleStrings((await cdp.send('Accessibility.getFullAXTree')).nodes);
  assert.equal(privacyHidden.value, privacyBefore.value);
  assert.equal(privacyHidden.ariaHidden, 'true');
  assert.equal(privacyHidden.chartHidden, 'true');
  assert.equal(privacyHidden.pressed, 'true');
  assert.equal(privacyHidden.incomeStorage, privacyBefore.incomeStorage);
  assert.equal(privacyHidden.expenseStorage, privacyBefore.expenseStorage);
  assert.equal(axHidden.some(value => value.includes(privacyBefore.value)), false, JSON.stringify({ privacyHidden, axHidden }));

  await evaluate(`document.getElementById('privacyBtn').click(); return true;`);
  const privacyRestored = await evaluate(`
    return {
      ariaHidden: document.getElementById('dash-net-balance').getAttribute('aria-hidden'),
      pressed: document.getElementById('privacyBtn').getAttribute('aria-pressed'),
    };
  `);
  const axRestored = accessibleStrings((await cdp.send('Accessibility.getFullAXTree')).nodes);
  assert.equal(privacyRestored.ariaHidden, null);
  assert.equal(privacyRestored.pressed, 'false');
  assert.ok(axRestored.some(value => value.includes(privacyBefore.value)), JSON.stringify({ privacyRestored, axRestored }));

  const removedProviderHost = new RegExp(['generative', 'language\\.googleapis\\.com'].join(''), 'i');
  assert.equal(requests.some(url => removedProviderHost.test(url)), false);
  assert.equal(requests.some(url => /cdn\.jsdelivr\.net\/npm\/chart\.js/i.test(url)), false);
  assert.equal(requests.some(url => /fonts\.googleapis\.com/i.test(url)), false);

  await retry(() => evaluate('return navigator.serviceWorker.ready.then(() => true);'), 20_000);
  await navigate();
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await navigate();
  await retry(() => evaluate("return !document.getElementById('welcomeScreen');"), 6_000);
  const offlineState = await evaluate(`
    const chartScript = document.querySelector('script[src*="vendor/chart.js-4.4.0/chart.umd.js"]');
    return {
      app: Boolean(window.App),
      meaningful: document.body.textContent.includes('ميزانيتي'),
      welcomeGone: !document.getElementById('welcomeScreen'),
      overlay: Boolean(document.querySelector('#webpack-dev-server-client-overlay, vite-error-overlay, nextjs-portal')),
      chartLocal: typeof Chart === 'function'
        && Chart.version === '4.4.0'
        && Boolean(chartScript)
        && new URL(chartScript.src, location.href).origin === location.origin,
      chartSource: chartScript?.src || '',
    };
  `);
  assert.equal(offlineState.app, true);
  assert.equal(offlineState.meaningful, true);
  assert.equal(offlineState.welcomeGone, true);
  assert.equal(offlineState.overlay, false);
  assert.equal(offlineState.chartLocal, true, JSON.stringify(offlineState));
  assert.match(offlineState.chartSource, /\/vendor\/chart\.js-4\.4\.0\/chart\.umd\.js$/);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  await evaluate("App.navigateTo('analytics'); return true;");
  await waitForAnalyticsCanvases();
  await waitForTwoAnimationFrames();
  await screenshot(desktopScreenshot);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitForAnalyticsCanvases();
  await waitForTwoAnimationFrames();
  const mobileLayout = await evaluate(`
    const root = document.documentElement;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    return {
      innerWidth: window.innerWidth,
      viewportWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      analyticsActive: document.getElementById('page-analytics')?.classList.contains('active'),
      mobileMediaMatches: matchMedia('(max-width: 400px)').matches,
    };
  `);
  assert.equal(mobileLayout.innerWidth, 390, JSON.stringify(mobileLayout));
  assert.ok(Math.abs(mobileLayout.viewportWidth - 390) <= 1, JSON.stringify(mobileLayout));
  assert.equal(mobileLayout.analyticsActive, true);
  assert.equal(mobileLayout.mobileMediaMatches, true);
  assert.ok(mobileLayout.scrollWidth <= mobileLayout.clientWidth, JSON.stringify(mobileLayout));
  assert.ok(mobileLayout.bodyScrollWidth <= mobileLayout.clientWidth, JSON.stringify(mobileLayout));
  await waitForTwoAnimationFrames();
  await screenshot(mobileScreenshot);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 568,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(`
    document.getElementById('moreLangBtn').click();
    window.dispatchEvent(new Event('appinstalled'));
    return true;
  `);
  await waitForTwoAnimationFrames();
  const installInitiallyHidden = await evaluate(`return document.getElementById('installBtn').hidden;`);
  assert.equal(installInitiallyHidden, true);

  await evaluate(`
    window.__installPromptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', {
      value: async () => { window.__installPromptCalls += 1; },
    });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
    return true;
  `);
  const header320 = await evaluate(`
    const root = document.documentElement;
    const nav = document.querySelector('.top-nav');
    const children = [...nav.children]
      .filter(element => getComputedStyle(element).display !== 'none')
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { id: element.id, className: element.className, left: rect.left, right: rect.right };
      });
    const overlaps = [];
    for (let left = 0; left < children.length; left += 1) {
      for (let right = left + 1; right < children.length; right += 1) {
        if (Math.min(children[left].right, children[right].right) - Math.max(children[left].left, children[right].left) > 0.5) {
          overlaps.push([left, right]);
        }
      }
    }
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      navClientWidth: nav.clientWidth,
      navScrollWidth: nav.scrollWidth,
      children,
      overlaps,
      installVisible: !document.getElementById('installBtn').hidden,
      lang: root.lang,
      dir: root.dir,
    };
  `);
  assert.equal(header320.installVisible, true, JSON.stringify(header320));
  assert.equal(header320.lang, 'en');
  assert.equal(header320.dir, 'ltr');
  assertContainedHeader(header320);

  const dismissedInstall = await evaluate(`
    const button = document.getElementById('installBtn');
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    button.click();
    return {
      hidden: button.hidden,
      disabled: button.disabled,
      promptCalls: window.__installPromptCalls,
    };
  `);
  assert.deepEqual(dismissedInstall, { hidden: true, disabled: false, promptCalls: 1 });

  const installedState = await evaluate(`
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', {
      value: async () => { window.__installPromptCalls += 1; },
    });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
    window.dispatchEvent(new Event('appinstalled'));
    const button = document.getElementById('installBtn');
    button.click();
    return { hidden: button.hidden, promptCalls: window.__installPromptCalls };
  `);
  assert.deepEqual(installedState, { hidden: true, promptCalls: 1 });
  await evaluate(`document.getElementById('moreLangBtn').click(); return true;`);
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  assert.deepEqual(consoleErrors, [], JSON.stringify({ consoleErrors, failedResponses }));
  console.log(JSON.stringify({
    status: 'passed',
    url: identity.url,
    title: identity.title,
    desktopScreenshot,
    mobileScreenshot,
    mobileViewport: mobileLayout,
    requests: requests.length,
    consoleErrors: consoleErrors.length,
  }));
} finally {
  cdp.close();
  if (target.createdByTest) {
    const response = await fetch(`${cdpEndpoint}/json/close/${encodeURIComponent(target.id)}`);
    if (!response.ok) throw new Error(`Could not close the CDP target created by this test: ${response.status}`);
  }
}
