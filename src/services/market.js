/**
 * Market Service - src/services/market.js
 * Fetches market prices and accepts only a bounded numeric schema before data
 * reaches storage, valuation logic, or the DOM.
 */

const CACHE_KEY = 'cashpilot_market_cache_v2';
const CACHE_DURATION = 60 * 60 * 1000;
const PARTIAL_CACHE_DURATION = 5 * 60 * 1000;
const MAX_STALE_DURATION = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 10_000;
const MAX_PRICE = 1_000_000_000_000;
const BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
const TROY_OZ_GRAMS = 31.1034768;
const EGX_KEYS = Object.freeze(['comi', 'fwry']);
let inFlightMarketRequest = null;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_PRICE
    ? value
    : null;
}

function signedNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_PRICE
    ? value
    : fallback;
}

function normalizeQuote(value, symbol = '') {
  if (!isObject(value)) return null;
  const price = positiveNumber(value.price);
  if (price === null) return null;

  const quote = {
    price,
    change: signedNumber(value.change),
    changePercent: signedNumber(value.changePercent),
  };
  const previousClose = positiveNumber(value.prevClose);
  if (previousClose !== null) quote.prevClose = previousClose;
  if (symbol) quote.symbol = symbol;
  return quote;
}

function normalizeEgxKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(key => EGX_KEYS.includes(key)))];
}

/**
 * Reconstruct a known, inert market-data shape. Strings, objects, arrays,
 * non-finite numbers, negative prices, and extreme values are rejected.
 */
export function normalizeMarketData(value, { stale = false } = {}) {
  if (!isObject(value) || !isObject(value.local)) return null;

  const usdEgp = normalizeQuote(value.usdEgp);
  const globalGold = normalizeQuote(value.globalGold);
  const globalSilver = normalizeQuote(value.globalSilver);
  const gold24k = positiveNumber(value.local.gold24k);
  const gold21k = positiveNumber(value.local.gold21k);
  const silver = positiveNumber(value.local.silver);
  if (!usdEgp || !globalGold || !globalSilver || gold24k === null || gold21k === null || silver === null) {
    return null;
  }

  const egx = {};
  if (isObject(value.egx)) {
    const comi = normalizeQuote(value.egx.comi, 'COMI.CA');
    const fwry = normalizeQuote(value.egx.fwry, 'FWRY.CA');
    if (comi) egx.comi = comi;
    if (fwry) egx.fwry = fwry;
  }

  const egxFetchedAt = {};
  if (isObject(value.egxFetchedAt)) {
    for (const key of EGX_KEYS) {
      const timestamp = value.egxFetchedAt[key];
      if (
        egx[key]
        && typeof timestamp === 'number'
        && Number.isFinite(timestamp)
        && timestamp > 0
        && timestamp <= Date.now()
        && !Number.isNaN(new Date(timestamp).getTime())
      ) {
        egxFetchedAt[key] = timestamp;
      }
    }
  }

  const fetchedAt = typeof value.fetchedAt === 'string' && value.fetchedAt.length <= 80
    ? value.fetchedAt
    : '—';

  const unavailableEgx = [...new Set([
    ...normalizeEgxKeys(value.unavailableEgx),
    ...EGX_KEYS.filter(key => !egx[key]),
  ])];
  const staleEgx = normalizeEgxKeys(value.staleEgx).filter(key => Boolean(egx[key]));
  const partial = value._partial === true || unavailableEgx.length > 0;

  return {
    usdEgp,
    globalGold,
    globalSilver,
    local: { gold24k, gold21k, silver },
    egx,
    ...(Object.keys(egxFetchedAt).length > 0 ? { egxFetchedAt } : {}),
    fetchedAt,
    ...(partial ? { _partial: true, unavailableEgx } : {}),
    ...(staleEgx.length > 0 ? { staleEgx } : {}),
    ...(stale || value._stale === true ? { _stale: true } : {}),
  };
}

class MarketRequestError extends Error {
  constructor(status) {
    super(`Market request failed with status ${status}`);
    this.name = 'MarketRequestError';
    this.status = status;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new MarketRequestError(response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function readCachedMarket({ allowStale = false, markStale = false } = {}) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!isObject(cached) || typeof cached.timestamp !== 'number' || !Number.isFinite(cached.timestamp)) return null;

    const age = Date.now() - cached.timestamp;
    if (age < 0 || age > MAX_STALE_DURATION) return null;

    const normalized = normalizeMarketData(cached.data);
    if (!normalized) return null;
    const partial = normalized._partial === true;
    const freshnessWindow = partial ? PARTIAL_CACHE_DURATION : CACHE_DURATION;
    if (!allowStale && age >= freshnessWindow) return null;

    const refreshFailed = typeof cached.refreshFailedAt === 'number'
      && Number.isFinite(cached.refreshFailedAt)
      && cached.refreshFailedAt >= cached.timestamp
      && cached.refreshFailedAt <= Date.now();
    const data = normalizeMarketData(cached.data, {
      stale: markStale || refreshFailed || age >= CACHE_DURATION,
    });
    return data ? { timestamp: cached.timestamp, data } : null;
  } catch {
    return null;
  }
}

function cacheMarketData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Market data remains usable for the current render when storage is blocked.
  }
}

function markCachedRefreshFailure() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!isObject(cached) || typeof cached.timestamp !== 'number' || !isObject(cached.data)) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...cached,
      refreshFailedAt: Date.now(),
    }));
  } catch {
    // The in-memory fallback still reports stale for the current render.
  }
}

async function fetchAllDataOnce(service, force) {
  if (!force) {
    const cached = readCachedMarket();
    if (cached) return cached.data;
  }

  try {
    const [goldRates, silverRates, usdRates] = await Promise.all([
      service.fetchRates('xau'),
      service.fetchRates('xag'),
      service.fetchRates('usd'),
    ]);

    const goldPriceUSD = positiveNumber(goldRates.usd);
    const goldPriceEGP = positiveNumber(goldRates.egp);
    const silverPriceUSD = positiveNumber(silverRates.usd);
    const silverPriceEGP = positiveNumber(silverRates.egp);
    const usdToEGP = positiveNumber(usdRates.egp);
    if ([goldPriceUSD, goldPriceEGP, silverPriceUSD, silverPriceEGP, usdToEGP].some(value => value === null)) {
      throw new Error('Invalid currency market response');
    }

    const egxResult = await service.fetchEGXStocks();
    const previousCache = readCachedMarket({ allowStale: true });
    const egxData = { ...egxResult.quotes };
    const staleEgx = [];
    const requestTimestamp = Date.now();
    const egxFetchedAt = Object.fromEntries(
      Object.keys(egxResult.quotes).map(key => [key, requestTimestamp]),
    );

    for (const key of egxResult.unavailable) {
      const previousTimestamp = previousCache?.data?.egxFetchedAt?.[key] ?? previousCache?.timestamp;
      const previousAge = requestTimestamp - previousTimestamp;
      if (
        !egxData[key]
        && previousCache?.data?.egx?.[key]
        && Number.isFinite(previousTimestamp)
        && previousAge >= 0
        && previousAge <= MAX_STALE_DURATION
      ) {
        egxData[key] = previousCache.data.egx[key];
        egxFetchedAt[key] = previousTimestamp;
        staleEgx.push(key);
      }
    }

    const candidate = {
      usdEgp: { price: usdToEGP, change: 0, changePercent: 0 },
      globalGold: { price: goldPriceUSD, priceEGP: goldPriceEGP, change: 0, changePercent: 0 },
      globalSilver: { price: silverPriceUSD, priceEGP: silverPriceEGP, change: 0, changePercent: 0 },
      local: {
        gold24k: goldPriceEGP / TROY_OZ_GRAMS,
        gold21k: (goldPriceEGP / TROY_OZ_GRAMS) * (21 / 24),
        silver: silverPriceEGP / TROY_OZ_GRAMS,
      },
      egx: egxData,
      egxFetchedAt,
      fetchedAt: new Date().toISOString(),
      ...(egxResult.unavailable.length > 0
        ? { _partial: true, unavailableEgx: egxResult.unavailable }
        : {}),
      ...(staleEgx.length > 0 ? { staleEgx } : {}),
    };

    const marketData = normalizeMarketData(candidate);
    if (!marketData) throw new Error('Normalized market data was invalid');
    cacheMarketData(marketData);
    return marketData;
  } catch (error) {
    console.error('[Market] Failed to fetch market data:', error);
    const fallback = readCachedMarket({ allowStale: true, markStale: true })?.data || null;
    if (fallback) markCachedRefreshFailure();
    return fallback;
  }
}

export const Market = {
  async fetchRates(base) {
    const normalizedBase = String(base).toLowerCase();
    if (!['xau', 'xag', 'usd'].includes(normalizedBase)) throw new Error('Unsupported market base');
    const data = await fetchJson(`${BASE_URL}/${normalizedBase}.json`);
    const rates = data?.[normalizedBase];
    if (!isObject(rates)) throw new Error(`Invalid ${normalizedBase} market response`);
    return rates;
  },

  async fetchAllData(force = false) {
    while (inFlightMarketRequest) {
      if (!force || inFlightMarketRequest.force) return inFlightMarketRequest.promise;
      await inFlightMarketRequest.promise;
    }

    const request = { force: Boolean(force), promise: null };
    request.promise = fetchAllDataOnce(this, force).finally(() => {
      if (inFlightMarketRequest === request) inFlightMarketRequest = null;
    });
    inFlightMarketRequest = request;
    return request.promise;
  },

  async fetchEGXStocks() {
    const quotes = {};
    const unavailable = [];
    for (const symbol of ['COMI.CA', 'FWRY.CA']) {
      const key = symbol.replace('.CA', '').toLowerCase();
      try {
        const upstream = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const data = await fetchJson(`https://corsproxy.io/?${encodeURIComponent(upstream)}`);
        const meta = data?.chart?.result?.[0]?.meta;
        if (!isObject(meta)) {
          unavailable.push(key);
          continue;
        }

        const price = positiveNumber(meta.regularMarketPrice);
        const previousClose = positiveNumber(meta.previousClose);
        if (price === null || previousClose === null) {
          unavailable.push(key);
          continue;
        }

        quotes[key] = {
          price,
          prevClose: previousClose,
          change: price - previousClose,
          changePercent: ((price - previousClose) / previousClose) * 100,
          symbol,
        };
      } catch (error) {
        unavailable.push(key);
        if (error instanceof MarketRequestError && error.status === 403) {
          console.info(`[Market] ${symbol} is currently unavailable (${error.status})`);
        } else {
          console.warn(`[Market] Could not fetch ${symbol}:`, error.message);
        }
      }
    }
    return { quotes, unavailable };
  },
};
