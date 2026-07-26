/**
 * @module ai-advisor
 * @description Handles Gemini API integration via Vercel Backend Proxy for financial insights
 */
import { getState } from '../core/state.js';
import { getSettings } from './finance.js';

/**
 * Builds a prompt based on current financial state
 */
function buildPrompt() {
  const state = getState();
  const tx = state.transactions || [];
  
  const income = tx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = tx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // Get top 3 expense categories
  const categories = {};
  tx.filter(t => t.type === 'expense').forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
  });
  
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `${cat}: ${amt}`)
    .join('، ');

  const currentMonth = new Date().toLocaleString('ar', { month: 'long', year: 'numeric' });

  return `
أنت مستشار مالي ذكي وخبير في إدارة الميزانيات الشخصية. 
مهمتك هي قراءة الأرقام التالية وإعطاء 3 نصائح مالية (Insights) عملية ومباشرة ومختصرة جداً لمستخدم تطبيق "ميزانيتي".

البيانات المالية الحالية للمستخدم (${currentMonth}):
- إجمالي الدخل: ${income}
- إجمالي المصروفات: ${expenses}
- أكبر 3 فئات تم الصرف عليها: ${sortedCategories || 'لا يوجد بعد'}

القواعد الصارمة:
1. اكتب باللغة العربية فقط.
2. استخدم لغة احترافية، لطيفة، ومحفزة.
3. وجه رسالتك مباشرة للمستخدم (مثال: "استمر في هذا الأداء..." أو "حاول تقليل نفقات...").
4. لا تقم بشرح الأرقام بل أعطِ الاستنتاج والنصيحة مباشرة.
5. إذا كان الصرف يتجاوز الدخل، أعطِ تحذيراً لطيفاً وضع خطة سريعة.
6. إذا كان هناك فائض ممتاز، انصحه بالاستثمار أو الادخار.
7. نسق النص باستخدام Markdown فقط (استخدم ** للخط العريض، وضع قائمة نقطية للنصائح).
`;
}

export async function generateInsights() {
  const prompt = buildPrompt();
  
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'API_ERROR' }));
      console.error('[AI] Proxy API Error:', errorData);
      throw new Error(errorData.error || 'API_ERROR');
    }

    const data = await response.json();
    if (data.text) {
      return data.text;
    }
    throw new Error('INVALID_RESPONSE');
    
  } catch (err) {
    console.error('[AI] Failed to generate insights:', err);
    throw err;
  }
}
