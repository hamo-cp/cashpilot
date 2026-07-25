/**
 * @module pages/investments
 */
import { formatCurrency }                        from '../core/utils.js';
import { t } from '../core/i18n.js';
import * as Finance                              from '../services/finance.js';
import { Market }                                from '../services/market.js';
import { investmentCardHTML, emptyStateHTML }    from '../ui/components.js';
import { openModal }                             from '../ui/modal.js';
import * as Toast                                from '../ui/toast.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export async function renderInvestments() {
  const list         = Finance.getInvestments();
  const marketData   = await Market.fetchAllData();

  // Dynamic valuation based on live market data
  list.forEach(inv => {
    inv._liveCapital = inv.capital;
    inv._liveProfit = inv.profit || 0;
    const q = inv.quantity || 0;
    
    if (q > 0) {
      let livePrice = 0;
      if (inv.type === 'gold') {
        livePrice = marketData?.local?.gold24k || 0; // Assuming 24k default for gold
      } else if (inv.type === 'stocks') {
        const n = inv.name.toLowerCase();
        if (n.includes('comi') || n.includes('cib')) livePrice = marketData?.egx?.comi?.price || 0;
        if (n.includes('fwry') || n.includes('فوري')) livePrice = marketData?.egx?.fwry?.price || 0;
      }
      
      if (livePrice > 0) {
        inv._liveCapital = q * livePrice;
        inv._liveProfit = inv._liveCapital - inv.capital;
      }
    }
    
    inv._liveTotal = inv.capital + inv._liveProfit;
    inv._roi = (inv._liveProfit / inv.capital) * 100;
  });

  const totalCapital = list.reduce((sum, i) => sum + parseFloat(i.capital || 0), 0);
  const totalProfit  = list.reduce((sum, i) => sum + (i._liveProfit !== undefined ? i._liveProfit : parseFloat(i.profit || 0)), 0);

  set('inv-total-capital', formatCurrency(totalCapital));
  set('inv-total-profit',  formatCurrency(totalProfit));
  set('inv-count', list.length + ' استثمار');

  const container = document.getElementById('investments-list');
  if (list.length === 0) {
    container.innerHTML = emptyStateHTML('ic-trending-up', t('no_investments'), t('add_first_investment'));
  } else {
    // استخدم الكائن الأصلي بعد أن قمنا بحساب _roi و _liveProfit داخله مسبقاً
    container.innerHTML = list
      .map(inv => investmentCardHTML(inv))
      .join('');
  }

  // Render Market Ticker
  await renderMarketTicker();
}

async function renderMarketTicker() {
  const tickerEl = document.getElementById('market-ticker');
  if (!tickerEl) return;

  // Since we already fetched in renderInvestments, we can use cached data directly to avoid double fetching
  tickerEl.innerHTML = '<div style="color:var(--color-text-muted); padding: 12px; font-size: 13px; display:flex; align-items:center; gap:8px;"><span style="display:inline-block;width:14px;height:14px;border:2px solid var(--color-brand);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> جاري جلب الأسعار...</div>';
  const marketData = await Market.fetchAllData();
  if (!marketData) {
    tickerEl.innerHTML = '<div style="color:var(--color-negative); padding: 12px; font-size: 13px;">فشل في جلب الأسعار ⚠️</div>';
    return;
  }

  const cards = [
    {
      title: '🥇 ذهب عيار 24',
      price: marketData.local?.gold24k,
      suffix: 'ج.م/جرام',
      changePct: 0,
    },
    {
      title: '🥇 ذهب عيار 21',
      price: marketData.local?.gold21k,
      suffix: 'ج.م/جرام',
      changePct: 0,
    },
    {
      title: '🥈 الفضة',
      price: marketData.local?.silver,
      suffix: 'ج.م/جرام',
      changePct: 0,
    },
    {
      title: '💵 الدولار',
      price: marketData.usdEgp?.price,
      suffix: 'ج.م',
      changePct: marketData.usdEgp?.changePercent || 0,
    },
    ...(marketData.egx?.comi ? [{
      title: '📈 CIB (COMI)',
      price: marketData.egx.comi.price,
      suffix: 'ج.م',
      changePct: marketData.egx.comi.changePercent || 0,
    }] : []),
    ...(marketData.egx?.fwry ? [{
      title: '📈 فوري (FWRY)',
      price: marketData.egx.fwry.price,
      suffix: 'ج.م',
      changePct: marketData.egx.fwry.changePercent || 0,
    }] : []),
  ];

  let html = `<div style="width:100%;font-size:10px;color:var(--color-text-muted);text-align:left;padding:0 4px 6px;display:flex;align-items:center;gap:4px;">
    <span>⏱</span> آخر تحديث: ${marketData.fetchedAt || '—'}
    ${marketData._stale ? ' · <span style="color:var(--color-warning)">بيانات مخزنة</span>' : ''}
    <button onclick="App.refreshMarket()" style="margin-inline-start:auto;background:none;border:1px solid var(--color-border);border-radius:6px;padding:2px 8px;font-size:10px;color:var(--color-brand);cursor:pointer;">تحديث ↻</button>
  </div>`;

  for (const card of cards) {
    if (!card.price) continue;

    const priceFormatted = card.price.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
    const change = card.changePct || 0;
    const isUp = change >= 0;
    const changeClass = isUp ? 'up' : 'down';
    const icon = isUp ? '▲' : '▼';

    html += `
      <div class="market-card">
        <div class="market-card-title">${card.title}</div>
        <div class="market-card-price">${priceFormatted} <span style="font-size:10px;font-weight:400;opacity:0.7">${card.suffix}</span></div>
        <div class="market-card-change ${changeClass}">${icon} ${Math.abs(change).toFixed(2)}%</div>
      </div>
    `;
  }

  tickerEl.innerHTML = html;
}

export function openInvestmentModal(editId = null) {
  const item  = editId ? Finance.getInvestments().find(i => i.id === editId) : null;
  const modal = document.getElementById('investmentModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('inv-name').value    = item?.name      || '';
  document.getElementById('inv-type').value    = item?.type      || 'stocks';
  document.getElementById('inv-capital').value = item?.capital   || '';
  document.getElementById('inv-quantity').value = item?.quantity || '';
  document.getElementById('inv-profit').value  = item?.profit    || '0';
  document.getElementById('inv-start').value   = item?.startDate || new Date().toISOString().split('T')[0];

  openModal('investmentModal');
  return editId;
}

export function saveInvestment(editingId, onDone) {
  const nameEl    = document.getElementById('inv-name');
  const capitalEl = document.getElementById('inv-capital');
  const profitEl  = document.getElementById('inv-profit');

  const name      = nameEl?.value.trim()     || '';
  const type      = document.getElementById('inv-type')?.value;
  const capital   = parseFloat(capitalEl?.value);
  const quantityEl = document.getElementById('inv-quantity');
  const quantity  = parseFloat(quantityEl?.value) || 0;
  const profit    = parseFloat(profitEl?.value) || 0;
  const startDate = document.getElementById('inv-start')?.value || '';

  if (!name)                         return Toast.show('أدخل اسم الاستثمار', 'error');
  if (name.length > 100)             return Toast.show(t('toast_invalid'), 'error');
  if (!capitalEl?.value.trim())      return Toast.show('أدخل رأس المال', 'error');
  if (isNaN(capital) || capital <= 0) return Toast.show('رأس المال يجب أن يكون رقماً موجباً', 'error');
  if (capital > 999_999_999)         return Toast.show('القيمة كبيرة جداً', 'error');
  if (isNaN(profit))                 return Toast.show('قيمة الربح/الخسارة غير صحيحة', 'error');

  const data = { name, type, capital, quantity, profit, startDate };

  if (editingId) {
    Finance.updateInvestment(editingId, data);
    Toast.show('تم تعديل الاستثمار', 'success');
  } else {
    Finance.addInvestment(data);
    Toast.show('تم إضافة الاستثمار', 'success');
  }
  onDone?.();
}

export async function refreshMarket() {
  await Market.fetchAllData(true);
  await renderInvestments();
}
