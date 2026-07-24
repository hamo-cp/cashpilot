/**
 * @module services/demo
 * @description بيانات تجريبية تُضاف عند أول تشغيل فقط.
 * تُستدعى مرة واحدة من main.js.
 */

import * as Finance from './finance.js';

export function seedIfEmpty() {
  const hasData = Finance.getIncome().length > 0 || Finance.getExpenses().length > 0;
  if (hasData) return;

  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const day = (d) => `${y}-${m}-${String(d).padStart(2, '0')}`;

  // دخل
  Finance.addIncome({ name: 'الراتب الشهري',      amount: 12000, source: 'salary',    date: day(1),  notes: 'راتب يونيو' });
  Finance.addIncome({ name: 'مشروع فري لانس',      amount: 2500,  source: 'freelance', date: day(8),  notes: 'تصميم موقع' });
  Finance.addIncome({ name: 'أرباح مشروع صغير',   amount: 800,   source: 'business',  date: day(15), notes: '' });

  // مصروفات
  Finance.addExpense({ name: 'سوبر ماركت كارفور', amount: 850,  category: 'food',          date: day(2)  });
  Finance.addExpense({ name: 'مطعم الغداء',        amount: 120,  category: 'food',          date: day(4)  });
  Finance.addExpense({ name: 'وقود السيارة',       amount: 400,  category: 'transport',     date: day(3)  });
  Finance.addExpense({ name: 'اشتراك المترو',      amount: 150,  category: 'transport',     date: day(1)  });
  Finance.addExpense({ name: 'رسوم دراسية',        amount: 1200, category: 'education',     date: day(5)  });
  Finance.addExpense({ name: 'اشتراك فودافون',     amount: 200,  category: 'internet',      date: day(6)  });
  Finance.addExpense({ name: 'صيدلية',             amount: 180,  category: 'health',        date: day(9)  });
  Finance.addExpense({ name: 'سينما',              amount: 300,  category: 'entertainment', date: day(11) });
  Finance.addExpense({ name: 'ملابس',              amount: 650,  category: 'shopping',      date: day(13) });
  Finance.addExpense({ name: 'فاتورة كهرباء',     amount: 320,  category: 'bills',         date: day(7)  });
  Finance.addExpense({ name: 'فاتورة غاز',        amount: 90,   category: 'bills',         date: day(7)  });
  Finance.addExpense({ name: 'نت بيتي - WE',      amount: 150,  category: 'internet',      date: day(10) });
  Finance.addExpense({ name: 'أكل بره',           amount: 220,  category: 'food',          date: day(16) });
  Finance.addExpense({ name: 'جراج',              amount: 100,  category: 'transport',     date: day(18) });

  // ديون
  Finance.addDebt({
    creditor: 'بنك QNB — قرض شخصي',
    amount: 25000, paid: 8000,
    dueDate: `${y}-${m}-28`,
    notes: 'قسط شهري 2000 ج.م',
  });
  Finance.addDebt({
    creditor: 'أحمد — دين شخصي',
    amount: 3000, paid: 1000,
    dueDate: `${y}-${String(now.getMonth() + 2).padStart(2, '0')}-15`,
    notes: '',
  });

  // استثمارات
  Finance.addInvestment({ name: 'أسهم CIB',            type: 'stocks',  capital: 15000, profit: 2200, startDate: `${y - 1}-01-15` });
  Finance.addInvestment({ name: 'ذهب 21 عيار',        type: 'gold',    capital: 10000, profit: 3500, startDate: `${y - 1}-06-01` });
  Finance.addInvestment({ name: 'شهادة CIB 3 سنوات',  type: 'savings', capital: 20000, profit: 4600, startDate: `${y - 1}-09-01` });

  // ميزانية
  Finance.setBudget({
    food: 2000, transport: 800, education: 1500,
    entertainment: 500, shopping: 1000,
    health: 400, bills: 600, internet: 400,
  });

  console.log('[Demo] بيانات تجريبية أُضيفت بنجاح');
}
