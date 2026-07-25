/**
 * Market Service - src/services/market.js
 * Fetches real-time prices for Gold, Silver, USD/EGP and EGX Stocks.
 * Uses the free, CORS-compatible fawazahmed0 currency API via jsDelivr CDN.
 * Gold price is calculated in EGP/gram for 24k and 21k.
 */

const CACHE_KEY      = 'cashpilot_market_cache_v2';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Base URL for fawazahmed0 currency API (CORS-friendly, no proxy needed)
const BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';

// 1 Troy Ounce in grams
const TROY_OZ_GRAMS = 31.1034768;

export const Market = {
  /**
   * Fetch a specific currency's rates against all others.
   * @param {string} base - Base currency code (e.g. 'xau', 'xag', 'usd')
   */
  async fetchRates(base) {
    const url = `${BASE_URL}/${base.toLowerCase()}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${base} rates`);
    const data = await response.json();
    return data[base.toLowerCase()];
  },

  /**
   * Fetch all required market data, with caching.
   * @param {boolean} force - Force refresh even if cache is valid
   */
  async fetchAllData(force = false) {
    // 1. Check localStorage cache first
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && !force && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
      }
    } catch (e) { /* ignore parse errors */ }

    try {
      // 2. Fetch gold (XAU) and silver (XAG) rates (relative to 1 troy oz)
      //    and USD/EGP rate concurrently
      const [goldRates, silverRates, usdRates] = await Promise.all([
        this.fetchRates('xau'),  // 1 troy oz of gold in all currencies
        this.fetchRates('xag'),  // 1 troy oz of silver in all currencies
        this.fetchRates('usd'),  // 1 USD in all currencies
      ]);

      // 3. Calculate prices
      const goldPriceUSD   = goldRates?.usd   || 0;  // Price of 1 oz gold in USD
      const goldPriceEGP   = goldRates?.egp   || 0;  // Price of 1 oz gold in EGP
      const silverPriceUSD = silverRates?.usd || 0;
      const silverPriceEGP = silverRates?.egp || 0;
      const usdToEGP       = usdRates?.egp    || 0;

      // Calculate EGP per gram
      const gold24kPerGramEGP = goldPriceEGP   / TROY_OZ_GRAMS;
      const gold21kPerGramEGP = gold24kPerGramEGP * (21 / 24);
      const silverPerGramEGP  = silverPriceEGP / TROY_OZ_GRAMS;

      // 4. Fetch EGX stocks via a separate open proxy
      //    Using a public finance data proxy for EGX (Yahoo Finance symbols)
      const egxData = await this.fetchEGXStocks();

      const marketData = {
        usdEgp: {
          price: usdToEGP,
          change: 0,
          changePercent: 0,
        },
        globalGold: {
          price: goldPriceUSD,
          priceEGP: goldPriceEGP,
          change: 0,
          changePercent: 0,
        },
        globalSilver: {
          price: silverPriceUSD,
          priceEGP: silverPriceEGP,
          change: 0,
          changePercent: 0,
        },
        local: {
          gold24k: gold24kPerGramEGP,
          gold21k: gold21kPerGramEGP,
          silver: silverPerGramEGP,
        },
        egx: egxData,
        fetchedAt: new Date().toLocaleTimeString('ar-EG'),
      };

      // 5. Cache the result
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: marketData,
      }));

      return marketData;
    } catch (error) {
      console.error('[Market] Failed to fetch market data:', error);
      // Return cached data even if expired, as fallback
      try {
        const old = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (old?.data) return { ...old.data, _stale: true };
      } catch (e) { /* ignore */ }
      return null;
    }
  },

  /**
   * Fetch EGX stock prices via Yahoo Finance through cors.sh proxy
   * Symbols: COMI.CA (CIB), FWRY.CA (Fawry)
   */
  async fetchEGXStocks() {
    // Try an alternative free cors proxy for Yahoo Finance
    const symbols = ['COMI.CA', 'FWRY.CA'];
    const result = {};

    for (const symbol of symbols) {
      try {
        const key = symbol.replace('.CA', '').toLowerCase();
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        // Use corsproxy.io as it's more reliable
        const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('bad response');
        const data = await response.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (meta) {
          result[key] = {
            price: meta.regularMarketPrice,
            prevClose: meta.previousClose,
            change: meta.regularMarketPrice - meta.previousClose,
            changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
            symbol,
          };
        }
      } catch (e) {
        console.warn(`[Market] Could not fetch ${symbol}:`, e.message);
      }
    }

    return result;
  }
};
