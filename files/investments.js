/**
 * @module pages/investments
 */
import { formatCurrency }                        from '../core/utils.js';
import * as Finance                              from '../services/finance.js';
import { investmentCardHTML, emptyStateHTML }    from '../ui/components.js';
import { openModal }                             from '../ui/modal.js';
import * as Toast                                from '../ui/toast.js';

function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

export function renderInvestments() {
  const list         = Finance.getInvestments();
  const totalCapital = Finance.totalInvestments();
  const totalProfit  = Finance.totalInvestmentProfit();

  set('inv-total-capital', formatCurrency(totalCapital));
  set('inv-total-profit',  formatCurrency(totalProfit));
  set('inv-count', list.length + ' استثمار');

  const container = document.getElementById('investments-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = emptyStateHTML('ic-trending-up', 'لا توجد استثمارات', 'أضف استثماراتك لمتابعة عوائدها');
    return;
  }

  // نحسب ROI مسبقاً ونضيفه كخاصية مؤقتة
  container.innerHTML = list
    .map(inv => investmentCardHTML({ ...inv, _roi: Finance.calcROI(inv) }))
    .join('');
}

export function openInvestmentModal(editId = null) {
  const item  = editId ? Finance.getInvestments().find(i => i.id === editId) : null;
  const modal = document.getElementById('investmentModal');
  if (!modal) return;

  modal.querySelector('.modal-title').dataset.editMode = editId ? '1' : '0';
  document.getElementById('inv-name').value    = item?.name      || '';
  document.getElementById('inv-type').value    = item?.type      || 'stocks';
  document.getElementById('inv-capital').value = item?.capital   || '';
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
  const profit    = parseFloat(profitEl?.value) || 0;
  const startDate = document.getElementById('inv-start')?.value || '';

  if (!name)                         return Toast.show('أدخل اسم الاستثمار', 'error');
  if (name.length > 100)             return Toast.show('الاسم طويل جداً', 'error');
  if (!capitalEl?.value.trim())      return Toast.show('أدخل رأس المال', 'error');
  if (isNaN(capital) || capital <= 0) return Toast.show('رأس المال يجب أن يكون رقماً موجباً', 'error');
  if (capital > 999_999_999)         return Toast.show('القيمة كبيرة جداً', 'error');
  if (isNaN(profit))                 return Toast.show('قيمة الربح/الخسارة غير صحيحة', 'error');

  const data = { name, type, capital, profit, startDate };

  if (editingId) {
    Finance.updateInvestment(editingId, data);
    Toast.show('تم تعديل الاستثمار', 'success');
  } else {
    Finance.addInvestment(data);
    Toast.show('تم إضافة الاستثمار', 'success');
  }
  onDone?.();
}
