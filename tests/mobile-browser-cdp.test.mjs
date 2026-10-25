import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = process.env.CASHPILOT_CDP_PORT;
const baseUrl = process.env.CASHPILOT_BASE_URL || 'http://127.0.0.1:3000';
const mobileScreenshot = process.env.CASHPILOT_MOBILE_V2_SCREENSHOT || join(tmpdir(), 'cashpilot-mobile-v2.png');
const comparisonScreenshot = process.env.CASHPILOT_MOBILE_V2_COMPARISON_SCREENSHOT
  || join(tmpdir(), 'cashpilot-mobile-v2-comparison.png');
if (process.env.CASHPILOT_CDP_ISOLATED_PROFILE !== 'true') {
  throw new Error(
    'Refusing to seed localStorage without an explicitly disposable CDP browser profile.',
  );
}
if (!port) throw new Error('CASHPILOT_CDP_PORT is required');

const cdpEndpoint = 'http://127.0.0.1:' + port;
const origin = new URL(baseUrl).origin;

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
      const timer = setTimeout(() => reject(new Error('Timed out waiting for ' + method)), timeoutMs);
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

async function openTarget(url) {
  await retry(async () => (await fetch(cdpEndpoint + '/json/version')).ok, 10_000);
  const response = await fetch(cdpEndpoint + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!response.ok) throw new Error('Could not create a dedicated CDP target: ' + response.status);
  return { ...(await response.json()), createdByTest: true };
}

const mobileUrl = new URL('/mobile/index.html', baseUrl).href;
const target = await openTarget(mobileUrl);
const cdp = new CdpClient(target.webSocketDebuggerUrl);
const requests = [];
const exceptions = [];
let savedStorage = null;
let storageSeeded = false;

cdp.on('Network.requestWillBeSent', params => requests.push(params.request.url));
cdp.on('Runtime.exceptionThrown', params => exceptions.push(params.exceptionDetails.text));

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: '(async () => { ' + expression + ' })()',
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function navigate(url) {
  const expected = JSON.stringify(url);
  const loaded = cdp.waitFor('Page.loadEventFired');
  const result = await cdp.send('Page.navigate', { url });
  await loaded;
  if (result.errorText) throw new Error('Page navigation failed: ' + result.errorText);
  await retry(() => evaluate('return location.href === ' + expected + ' && document.readyState === "complete";'));
}

async function screenshot(filePath) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(filePath, Buffer.from(result.data, 'base64'));
}

try {
  await cdp.connect();
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Network.enable'),
    cdp.send('Log.enable'),
  ]);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await retry(() => evaluate('return document.readyState === "complete";'));
  savedStorage = await evaluate('return Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));');
  storageSeeded = true;

  const today = await evaluate('const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");');
  await evaluate(
    'localStorage.clear();'
      + 'localStorage.setItem("cashpilot_lang", "ar");'
      + 'localStorage.setItem("mz_income", JSON.stringify([{ id: "mobile-fixture-income", name: "Salary", amount: 10000, source: "salary", date: ' + JSON.stringify(today) + ' }]));'
      + 'localStorage.setItem("mz_expenses", JSON.stringify([{ id: "mobile-fixture-expense", name: "Groceries", amount: 500, category: "food", date: ' + JSON.stringify(today) + ' }]));'
      + 'localStorage.setItem("mz_debts", JSON.stringify([]));'
      + 'localStorage.setItem("mz_investments", JSON.stringify([]));'
      + 'localStorage.setItem("mz_subscriptions", JSON.stringify([]));'
      + 'localStorage.setItem("mz_budget", JSON.stringify({ food: 1000 }));'
      + 'localStorage.setItem("mz_settings", JSON.stringify({ theme: "dark", currency: "EGP" }));'
      + 'return true;',
  );

  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  const mobileRequestStart = requests.length;
  const reloaded = cdp.waitFor('Page.loadEventFired');
  await cdp.send('Page.reload', { ignoreCache: true });
  await reloaded;
  await retry(() => evaluate('return typeof window.App?.handleAndroidBack === "function" && Boolean(document.querySelector(".bottom-navigation"));'));

  const home = await evaluate(
    'return {'
      + 'heading: document.querySelector("#mobile-page-heading")?.textContent.trim(),'
      + 'lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.dataset.theme,'
      + 'tabs: [...document.querySelectorAll(".bottom-navigation .nav-item span")].map(item => item.textContent.trim()),'
      + 'rows: [...document.querySelectorAll(".transaction-name")].map(item => item.textContent.trim()),'
      + 'bridge: typeof window.App?.handleAndroidBack === "function",'
      + 'pwaController: typeof window.App?.navigateTo === "function"'
      + '};',
  );
  assert.equal(home.heading, 'الرئيسية', JSON.stringify(home));
  assert.equal(home.lang, 'ar');
  assert.equal(home.dir, 'rtl');
  assert.equal(home.theme, 'dark');
  assert.deepEqual(home.tabs, ['الرئيسية', 'المعاملات', 'الخطة', 'التحليلات', 'المزيد']);
  assert.deepEqual(home.rows.sort(), ['Groceries', 'Salary']);
  assert.equal(home.bridge, true);
  assert.equal(home.pwaController, false);
  await screenshot(mobileScreenshot);

  const recordSnapshot = await evaluate(
    'return Object.fromEntries(["mz_income", "mz_expenses", "mz_debts", "mz_investments", "mz_subscriptions", "mz_budget"]'
      + '.map(key => [key, localStorage.getItem(key)]));',
  );
  await evaluate('document.getElementById("mobile-quick-add").click(); return true;');
  const quickAdd = await evaluate(
    'return { notice: document.querySelector(".mobile-notice")?.textContent,'
      + 'income: localStorage.getItem("mz_income"), expenses: localStorage.getItem("mz_expenses") };',
  );
  assert.match(quickAdd.notice, /المرحلة التالية/);
  assert.equal(quickAdd.income, recordSnapshot.mz_income);
  assert.equal(quickAdd.expenses, recordSnapshot.mz_expenses);

  await evaluate('document.querySelector("[data-screen=activity]").click(); return true;');
  const searched = await evaluate(
    'const input = document.getElementById("activity-search"); input.value = "Groceries";'
      + 'input.dispatchEvent(new Event("input", { bubbles: true }));'
      + 'return [...document.querySelectorAll(".transaction-name")].map(item => item.textContent.trim());',
  );
  assert.deepEqual(searched, ['Groceries']);
  await evaluate(
    'const input = document.getElementById("activity-search"); input.value = "";'
      + 'input.dispatchEvent(new Event("input", { bubbles: true }));'
      + 'document.getElementById("filter-income").click(); return true;',
  );
  const filtered = await evaluate(
    'return { names: [...document.querySelectorAll(".transaction-name")].map(item => item.textContent.trim()),'
      + 'pressed: document.getElementById("filter-income").getAttribute("aria-pressed") };',
  );
  assert.deepEqual(filtered.names, ['Salary']);
  assert.equal(filtered.pressed, 'true');

  const backToHome = await evaluate(
    'const handled = window.App.handleAndroidBack(); return { handled, heading: document.querySelector("#mobile-page-heading")?.textContent.trim() };',
  );
  assert.deepEqual(backToHome, { handled: true, heading: 'الرئيسية' });
  assert.equal(await evaluate('return window.App.handleAndroidBack();'), false);

  await evaluate('document.querySelector("[data-screen=more]").click(); document.getElementById("mobile-language-toggle").click(); return true;');
  const english = await evaluate(
    'return { lang: document.documentElement.lang, dir: document.documentElement.dir,'
      + 'home: document.querySelector("[data-screen=home] span")?.textContent,'
      + 'tabs: document.querySelectorAll(".bottom-navigation .nav-item").length };',
  );
  assert.deepEqual(english, { lang: 'en', dir: 'ltr', home: 'Home', tabs: 5 });
  await evaluate('document.getElementById("mobile-theme-toggle").click(); return true;');
  assert.equal(await evaluate('return document.documentElement.dataset.theme;'), 'light');

  await evaluate('document.getElementById("mobile-language-toggle").click(); document.getElementById("mobile-theme-toggle").click(); document.querySelector("[data-screen=home]").click(); return true;');
  await screenshot(mobileScreenshot);
  assert.deepEqual(
    await evaluate('return Object.fromEntries(["mz_income", "mz_expenses", "mz_debts", "mz_investments", "mz_subscriptions", "mz_budget"].map(key => [key, localStorage.getItem(key)]));'),
    recordSnapshot,
  );
  const mobileRequests = requests.slice(mobileRequestStart);
  assert.ok(mobileRequests.every(url => new URL(url).origin === origin), JSON.stringify(mobileRequests));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const comparisonUrl = new URL('/docs/mobile-v2-comparison.html', baseUrl).href;
  await navigate(comparisonUrl);
  await retry(() => evaluate(
    'const frames = [...document.querySelectorAll("iframe")];'
      + 'return frames.length === 2 && frames.every(frame => frame.contentDocument?.readyState === "complete"'
      + ' && frame.contentDocument.body?.innerText.trim().length > 0'
      + ' && !frame.contentDocument.getElementById("welcomeScreen"));',
  ));
  await screenshot(comparisonScreenshot);

  assert.deepEqual(exceptions, [], JSON.stringify(exceptions));
  console.log(JSON.stringify({
    status: 'passed',
    home,
    activitySearch: searched,
    activityFilter: filtered.names,
    english,
    mobileScreenshot,
    comparisonScreenshot,
    mobileRequests: mobileRequests.length,
  }));
} finally {
  const cleanupErrors = [];
  if (storageSeeded && savedStorage) {
    try {
      const saved = JSON.stringify(savedStorage);
      await evaluate(
        'localStorage.clear(); const previous = ' + saved + ';'
          + 'for (const [key, value] of Object.entries(previous)) if (value !== null) localStorage.setItem(key, value);'
          + 'return true;',
      );
    } catch (error) {
      cleanupErrors.push(new Error('Unable to restore localStorage after the mobile CDP test.', { cause: error }));
    }
  }
  cdp.close();
  if (target.createdByTest) {
    try {
      const response = await fetch(cdpEndpoint + '/json/close/' + encodeURIComponent(target.id));
      if (!response.ok) {
        throw new Error('Could not close the CDP target created by this test: ' + response.status);
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Mobile CDP test cleanup failed.');
  }
}
