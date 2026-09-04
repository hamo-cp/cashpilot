/**
 * @module pages/investments
 */
import { formatCurrency, today }              from '../core/utils.js';
import { getLang, t, tf }                     from '../core/i18n.js';
import * as Finance                           from '../services/finance.js';
import { Market }                             from '../services/market.js';
import { investmentCardHTML, emptyStateHTML } from '../ui/components.js';
import { openModal }                          from '../ui/modal.js';
import * as Toast                             from '../ui/toast.js';

function set(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createRefreshButton() {
  const refresh = createElement('button', 'market-refresh', t('market_refresh'));
  refresh.type = 'button';
  refresh.addEventListener('click', () => refreshMarket());
  return refresh;
}

function formatFetchedAt(value, locale) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? (value || '—')
    : parsed.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

let marketRefreshPromise = null;

export async function renderInvestments(providedMarketData) {
  const list = Finance.getInvestments();
  const marketData = arguments.length > 0 ? providedMarketData : await Market.fetchAllData();

  list.forEach(inv => {
    const capital = Number(inv.capital) || 0;
    const storedProfit = Number(inv.profit) || 0;
    inv._liveCapital = capital;
    inv._liveProfit = storedProfit;
    inv._marketStatus = '';

    const quantity = Number(inv.quantity) || 0;
    if (quantity > 0) {
      let livePrice = 0;
      if (inv.type === 'gold') {
        livePrice = marketData?.local?.gold24k || 0;
        if (marketData?._stale) inv._marketStatus = 'cached';
        else if (!marketData) inv._marketStatus = 'unavailable';
      } else if (inv.type === 'stocks') {
        const name = String(inv.name || '').toLowerCase();
        const stockKey = name.includes('comi') || name.includes('cib')
          ? 'comi'
          : name.includes('fwry') || name.includes('فوري') ? 'fwry' : '';
        if (stockKey) {
          livePrice = marketData?.egx?.[stockKey]?.price || 0;
          if (marketData?._stale || marketData?.staleEgx?.includes(stockKey)) inv._marketStatus = 'cached';
          else if (marketData?.unavailableEgx?.includes(stockKey) || !marketData) {
            inv._marketStatus = 'unavailable';
          }
        }
      }

      if (typeof livePrice === 'number' && Number.isFinite(livePrice) && livePrice > 0) {
        inv._liveCapital = quantity * livePrice;
        inv._liveProfit = inv._liveCapital - capital;
      }
    }

    inv._liveTotal = capital + inv._liveProfit;
    inv._roi = capital > 0 ? (inv._liveProfit / capital) * 100 : 0;
  });

  const totalCapital = list.reduce((sum, item) => sum + (Number(item.capital) || 0), 0);
  const totalProfit = list.reduce((sum, item) => sum + (Number(item._liveProfit) || 0), 0);

  set('inv-total-capital', formatCurrency(totalCapital));
  set('inv-total-profit', formatCurrency(totalProfit));
  set('inv-count', String(list.length));

  const container = document.getElementById('investments-list');
  if (container) {
    container.innerHTML = list.length
      ? list.map(investmentCardHTML).join('')
      : emptyStateHTML('ic-trending-up', t('empty_inv'), t('empty_inv_sub'));
  }

  renderMarketTicker(marketData);
}

export function renderMarketTicker(marketData) {
  const ticker = document.getElementById('market-ticker');
  if (!ticker) return;
  ticker.replaceChildren();

  if (!marketData) {
    const error = createElement('div', 'market-status', t('market_error'));
    error.style.color = 'var(--color-negative)';
    ticker.appendChild(error);
    ticker.appendChild(createRefreshButton());
    return;
  }

  const locale = getLang() === 'ar' ? 'ar-EG' : 'en-US';
  const metadata = createElement('div', 'market-meta');
  const updated = createElement('span', '', `⏱ ${t('market_updated')}: ${formatFetchedAt(marketData.fetchedAt, locale)}`);
  metadata.appendChild(updated);
  if (marketData._stale) {
    const stale = createElement('span', 'market-stale', ` · ${t('market_stale')}`);
    metadata.appendChild(stale);
  }

  metadata.appendChild(createRefreshButton());
  ticker.appendChild(metadata);

  if (marketData._partial) {
    const symbols = (marketData.unavailableEgx || [])
      .map(key => key === 'comi' ? 'CIB (COMI)' : key.toUpperCase())
      .join(', ');
    const partial = createElement('div', 'market-status market-partial', tf('market_partial', { symbols }));
    partial.style.color = 'var(--color-warning)';
    ticker.appendChild(partial);
  }

  const cards = [
    { key: '', title: t('market_gold_24'), price: marketData.local.gold24k, suffix: t('market_per_gram'), change: 0 },
    { key: '', title: t('market_gold_21'), price: marketData.local.gold21k, suffix: t('market_per_gram'), change: 0 },
    { key: '', title: t('market_silver'), price: marketData.local.silver, suffix: t('market_per_gram'), change: 0 },
    { key: '', title: t('market_usd'), price: marketData.usdEgp.price, suffix: t('currency'), change: marketData.usdEgp.changePercent },
    ...(marketData.egx.comi
      ? [{ key: 'comi', title: 'CIB (COMI)', price: marketData.egx.comi.price, suffix: t('currency'), change: marketData.egx.comi.changePercent }]
      : []),
    ...(marketData.egx.fwry
      ? [{ key: 'fwry', title: 'FWRY', price: marketData.egx.fwry.price, suffix: t('currency'), change: marketData.egx.fwry.changePercent }]
      : []),
  ];

  const cardsContainer = createElement('div', 'market-cards');
  ticker.appendChild(cardsContainer);

  for (const card of cards) {
    if (typeof card.price !== 'number' || !Number.isFinite(card.price) || card.price <= 0) continue;
    const change = typeof card.change === 'number' && Number.isFinite(card.change) ? card.change : 0;
    const isUp = change >= 0;

    const element = createElement('div', 'market-card');
    const cached = card.key && (marketData._stale || marketData.staleEgx?.includes(card.key));
    const cachedAt = cached ? marketData.egxFetchedAt?.[card.key] : null;
    const cachedLabel = cachedAt
      ? tf('market_quote_cached_at', { time: formatFetchedAt(cachedAt, locale) })
      : t('market_quote_cached');
    element.appendChild(createElement(
      'div',
      'market-card-title',
      cached ? `${card.title} · ${cachedLabel}` : card.title,
    ));

    const price = createElement('div', 'market-card-price', card.price.toLocaleString(locale, { maximumFractionDigits: 2 }));
    price.appendChild(createElement('span', 'market-card-suffix', ` ${card.suffix}`));
    element.appendChild(price);

    element.appendChild(createElement(
      'div',
      `market-card-change ${isUp ? 'up' : 'down'}`,
      `${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`,
    ));
    cardsContainer.appendChild(element);
  }
}

export function openInvestmentModal(editId = null) {
  const item = editId ? Finance.getInvestments().find(inv => inv.id === editId) : null;
  const modal = document.getElementById('investmentModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('inv-name').value = item?.name || '';
  document.getElementById('inv-type').value = item?.type || 'stocks';
  document.getElementById('inv-capital').value = item?.capital || '';
  document.getElementById('inv-quantity').value = item?.quantity || '';
  document.getElementById('inv-profit').value = item?.profit || '0';
  document.getElementById('inv-start').value = item?.startDate || today();

  openModal('investmentModal');
  return editId;
}

export function saveInvestment(editingId, onDone) {
  const nameEl = document.getElementById('inv-name');
  const capitalEl = document.getElementById('inv-capital');
  const profitEl = document.getElementById('inv-profit');

  const name = nameEl?.value.trim() || '';
  const type = document.getElementById('inv-type')?.value;
  const capital = parseFloat(capitalEl?.value);
  const quantity = parseFloat(document.getElementById('inv-quantity')?.value) || 0;
  const profit = parseFloat(profitEl?.value) || 0;
  const startDate = document.getElementById('inv-start')?.value || '';

  if (!name || name.length > 100) return Toast.show(t('toast_invalid'), 'error');
  if (!capitalEl?.value.trim() || !Number.isFinite(capital) || capital <= 0 || capital > 999_999_999) {
    return Toast.show(t('toast_invalid'), 'error');
  }
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 999_999_999) {
    return Toast.show(t('toast_invalid'), 'error');
  }
  if (!Number.isFinite(profit) || Math.abs(profit) > 999_999_999) {
    return Toast.show(t('toast_invalid'), 'error');
  }

  const data = { name, type, capital, quantity, profit, startDate };
  if (editingId) {
    Finance.updateInvestment(editingId, data);
    Toast.show(t('toast_updated'), 'success');
  } else {
    Finance.addInvestment(data);
    Toast.show(t('toast_added'), 'success');
  }
  onDone?.();
}

export async function refreshMarket() {
  if (marketRefreshPromise) return marketRefreshPromise;

  marketRefreshPromise = (async () => {
    const button = document.querySelector('.market-refresh');
    const restoreFocus = button && document.activeElement === button;
    if (button) {
      button.disabled = true;
      button.textContent = t('market_refreshing');
    }
    const marketData = await Market.fetchAllData(true);
    await renderInvestments(marketData);
    if (restoreFocus) {
      const nextButton = document.querySelector('.market-refresh');
      try {
        nextButton?.focus({ preventScroll: true });
      } catch {
        nextButton?.focus();
      }
    }
    return marketData;
  })();

  try {
    return await marketRefreshPromise;
  } finally {
    marketRefreshPromise = null;
  }
}
