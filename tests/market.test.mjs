import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  clear() { this.data.clear(); }
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.disabled = false;
    this.listeners = new Map();
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
const elements = new Map([
  ['market-ticker', new FakeElement()],
  ['inv-total-capital', { textContent: '' }],
  ['inv-total-profit', { textContent: '' }],
  ['inv-count', { textContent: '' }],
  ['investments-list', { innerHTML: '' }],
]);
let refreshControl = null;
globalThis.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  getElementById: id => elements.get(id) || null,
  createElement: tag => new FakeElement(tag),
  querySelector: selector => selector === '.market-refresh' ? refreshControl : null,
  querySelectorAll: () => [],
};

const i18n = await import('../src/core/i18n.js');
const { Market, normalizeMarketData } = await import('../src/services/market.js');
const { refreshMarket, renderMarketTicker } = await import('../src/pages/investments.js');
const { investmentCardHTML } = await import('../src/ui/components.js');

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const cacheKey = 'cashpilot_market_cache_v2';
let now = 1_800_000_000_000;
let requests = [];
let egxMode = { comi: 200, fwry: 200 };
let coreFailure = false;

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function quoteBody(symbol, price) {
  return {
    chart: {
      result: [{ meta: { symbol, regularMarketPrice: price, previousClose: price - 1 } }],
    },
  };
}

function installFetchMock() {
  globalThis.fetch = async urlValue => {
    const url = String(urlValue);
    requests.push(url);
    if (coreFailure && /\/xau\.json$/.test(url)) throw new Error('network unavailable');
    if (/\/xau\.json$/.test(url)) return response(200, { xau: { usd: 2400, egp: 120000 } });
    if (/\/xag\.json$/.test(url)) return response(200, { xag: { usd: 28, egp: 1400 } });
    if (/\/usd\.json$/.test(url)) return response(200, { usd: { egp: 50 } });
    if (url.includes('COMI.CA')) {
      return egxMode.comi === 200
        ? response(200, quoteBody('COMI.CA', 75))
        : response(egxMode.comi, {});
    }
    if (url.includes('FWRY.CA')) {
      return egxMode.fwry === 200
        ? response(200, quoteBody('FWRY.CA', 6.5))
        : response(egxMode.fwry, {});
    }
    throw new Error(`Unexpected market URL: ${url}`);
  };
}

function fullMarket(overrides = {}) {
  return normalizeMarketData({
    usdEgp: { price: 50, change: 0, changePercent: 0 },
    globalGold: { price: 2400, change: 0, changePercent: 0 },
    globalSilver: { price: 28, change: 0, changePercent: 0 },
    local: { gold24k: 3858, gold21k: 3376, silver: 45 },
    egx: {
      comi: { price: 75, prevClose: 74, change: 1, changePercent: 1.35 },
      fwry: { price: 6.5, prevClose: 5.5, change: 1, changePercent: 18.18 },
    },
    fetchedAt: '2026-09-04T08:00:00.000Z',
    ...overrides,
  });
}

test.beforeEach(() => {
  storage.clear();
  requests = [];
  egxMode = { comi: 200, fwry: 200 };
  coreFailure = false;
  now = 1_800_000_000_000;
  Date.now = () => now;
  installFetchMock();
  i18n.setLang('en');
  elements.set('market-ticker', new FakeElement());
  refreshControl = null;
});

test.after(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
});

test('403 quotes produce an explicit partial result and a shorter cache window', async () => {
  egxMode = { comi: 403, fwry: 403 };
  const partial = await Market.fetchAllData();
  assert.equal(partial._partial, true);
  assert.deepEqual(partial.unavailableEgx, ['comi', 'fwry']);
  assert.deepEqual(partial.egx, {});
  assert.equal(requests.filter(url => url.includes('COMI.CA')).length, 1);
  assert.equal(requests.filter(url => url.includes('FWRY.CA')).length, 1);

  const requestCount = requests.length;
  assert.deepEqual(await Market.fetchAllData(), partial);
  assert.equal(requests.length, requestCount, 'fresh partial cache should avoid immediate repeated 403s');

  now += 5 * 60 * 1000 + 1;
  egxMode = { comi: 200, fwry: 200 };
  const recovered = await Market.fetchAllData();
  assert.equal(recovered._partial, undefined);
  assert.ok(recovered.egx.comi && recovered.egx.fwry);
  assert.ok(requests.length > requestCount, 'partial cache must retry sooner than the full cache window');
});

test('a partial refresh retains the last valid quote and marks its provenance', async () => {
  const complete = await Market.fetchAllData();
  assert.equal(complete.egx.comi.price, 75);

  egxMode = { comi: 403, fwry: 200 };
  const partial = await Market.fetchAllData(true);
  assert.equal(partial._partial, true);
  assert.deepEqual(partial.unavailableEgx, ['comi']);
  assert.deepEqual(partial.staleEgx, ['comi']);
  assert.equal(partial.egx.comi.price, 75);
  assert.equal(partial.egx.fwry.price, 6.5);

  const cached = JSON.parse(storage.getItem(cacheKey));
  assert.equal(cached.data.egx.comi.price, 75, 'partial data must not downgrade the last valid quote');
  assert.deepEqual(cached.data.staleEgx, ['comi']);
});

test('repeated partial refreshes cannot extend an old quote beyond seven days', async () => {
  const startedAt = now;
  await Market.fetchAllData();
  egxMode = { comi: 403, fwry: 200 };

  for (let day = 1; day <= 7; day += 1) {
    now = startedAt + day * 24 * 60 * 60 * 1000;
    const partial = await Market.fetchAllData(true);
    assert.equal(partial.egx.comi.price, 75);
    assert.equal(partial.egxFetchedAt.comi, startedAt);
  }

  now = startedAt + 7 * 24 * 60 * 60 * 1000 + 1;
  const expired = await Market.fetchAllData(true);
  assert.equal(expired.egx.comi, undefined);
  assert.equal(expired.egxFetchedAt?.comi, undefined);
  assert.deepEqual(expired.unavailableEgx, ['comi']);
});

test('legacy cache missing an expected ticker is treated as short-lived partial data', async () => {
  const legacy = fullMarket();
  delete legacy.egx.fwry;
  delete legacy._partial;
  delete legacy.unavailableEgx;
  storage.setItem(cacheKey, JSON.stringify({ timestamp: now - 10 * 60 * 1000, data: legacy }));

  const result = await Market.fetchAllData();
  assert.ok(result.egx.comi && result.egx.fwry);
  assert.ok(requests.length > 0, 'legacy partial cache older than five minutes must refresh');
});

test('a forced full failure exposes even a fresh fallback as stale', async () => {
  await Market.fetchAllData();
  coreFailure = true;
  const fallback = await Market.fetchAllData(true);
  assert.equal(fallback._stale, true);

  const nextRender = await Market.fetchAllData();
  assert.equal(nextRender._stale, true, 'failed refresh provenance must persist until a later success');

  coreFailure = false;
  const recovered = await Market.fetchAllData(true);
  assert.equal(recovered._stale, undefined);
  assert.equal(JSON.parse(storage.getItem(cacheKey)).refreshFailedAt, undefined);

  now += 7 * 24 * 60 * 60 * 1000 + 1;
  coreFailure = true;
  assert.equal(await Market.fetchAllData(true), null);
});

test('market UI reports partial and cached quotes, and full failure retains Refresh', () => {
  const partial = fullMarket({
    _partial: true,
    unavailableEgx: ['comi'],
    staleEgx: ['comi'],
  });
  renderMarketTicker(partial);
  const ticker = elements.get('market-ticker');
  const text = JSON.stringify(ticker);
  assert.match(text, /Some stock prices are currently unavailable: CIB \(COMI\)/);
  assert.match(text, /CIB \(COMI\) · cached quote/);
  assert.ok(ticker.children.some(child => child.className === 'market-cards'));

  renderMarketTicker(null);
  const failedTicker = elements.get('market-ticker');
  assert.match(JSON.stringify(failedTicker), /Could not load market prices/);
  assert.ok(failedTicker.children.some(child => child.className === 'market-refresh'));

  const holding = investmentCardHTML({
    id: 'inv-1', name: 'CIB', type: 'stocks', capital: 100,
    quantity: 2, profit: 0, startDate: '2026-09-01', _marketStatus: 'unavailable',
  });
  assert.match(holding, /Live price unavailable; showing the stored value/);
});

test('out-of-range or future per-quote timestamps cannot crash cached quote rendering', () => {
  const invalidTimestamp = fullMarket({
    _partial: true,
    unavailableEgx: ['comi'],
    staleEgx: ['comi'],
    egxFetchedAt: { comi: 1e20, fwry: now + 60_000 },
  });
  assert.equal(invalidTimestamp.egxFetchedAt, undefined);
  assert.doesNotThrow(() => renderMarketTicker(invalidTimestamp));
  assert.match(JSON.stringify(elements.get('market-ticker')), /CIB \(COMI\) · cached quote/);
});

test('concurrent Refresh calls share one forced fetch and one returned result', async () => {
  const originalFetchAll = Market.fetchAllData;
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  Market.fetchAllData = async force => {
    assert.equal(force, true);
    calls += 1;
    await gate;
    return fullMarket();
  };
  refreshControl = { disabled: false, textContent: '' };

  try {
    const first = refreshMarket();
    const second = refreshMarket();
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
  } finally {
    Market.fetchAllData = originalFetchAll;
  }
});

test('normal and forced service requests are serialized so an older request cannot overwrite Refresh', async () => {
  const originalFetchRates = Market.fetchRates;
  const originalFetchEgx = Market.fetchEGXStocks;
  let batch = 0;
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });

  Market.fetchRates = async base => {
    if (base === 'xau') batch += 1;
    const currentBatch = batch;
    if (currentBatch === 1) await firstGate;
    if (base === 'xau') return { usd: 2400, egp: 120000 };
    if (base === 'xag') return { usd: 28, egp: 1400 };
    return { egp: 50 };
  };
  Market.fetchEGXStocks = async () => ({
    quotes: {
      comi: { price: 75, prevClose: 74, change: 1, changePercent: 1.35, symbol: 'COMI.CA' },
      fwry: { price: 6.5, prevClose: 5.5, change: 1, changePercent: 18.18, symbol: 'FWRY.CA' },
    },
    unavailable: [],
  });

  try {
    const normal = Market.fetchAllData();
    await Promise.resolve();
    const forced = Market.fetchAllData(true);
    await Promise.resolve();
    assert.equal(batch, 1, 'forced request must wait for the current normal request');
    releaseFirst();
    await normal;
    await forced;
    assert.equal(batch, 2);
  } finally {
    Market.fetchRates = originalFetchRates;
    Market.fetchEGXStocks = originalFetchEgx;
  }
});
