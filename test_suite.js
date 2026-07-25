import fs from 'fs';
import * as Finance from './src/services/finance.js';
import { Market } from './src/services/market.js';
import { setLang, toggleLang, getLang, t } from './src/core/i18n.js';

// Mock localStorage and Document for testing
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() { this.data = {}; }
};

global.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  querySelectorAll: () => [],
  getElementById: () => ({ checked: false }),
};

async function runTests() {
  console.log('--- STARTING DEEP TESTS ---');
  
  // 1. Test i18n
  console.log('\\n1. Testing i18n & Translations');
  setLang('ar');
  console.log('Current Lang:', getLang());
  console.log('Translation for stat_key_metrics (AR):', t('stat_key_metrics'));
  toggleLang();
  console.log('Current Lang after toggle:', getLang());
  console.log('Translation for stat_key_metrics (EN):', t('stat_key_metrics'));
  
  // 2. Test Data Persistence & Calculations
  console.log('\\n2. Testing Finance Data & Analytics');
  
  // Add Income
  const inc1 = Finance.addIncome({ source: 'salary', amount: 15000, date: new Date().toISOString() });
  const inc2 = Finance.addIncome({ source: 'freelance', amount: 5000, date: new Date().toISOString() });
  
  // Add Expense
  Finance.addExpense({ category: 'food', amount: 800, date: new Date().toISOString() });
  Finance.addExpense({ category: 'entertainment', amount: 2000, date: new Date().toISOString() });
  Finance.addExpense({ category: 'other', amount: -500, date: new Date().toISOString() }); // Edge case: negative (should it be allowed?)
  
  // Add Debt
  const today = new Date();
  Finance.addDebt({ creditor: 'Bank', amount: 50000, paid: 1000, dueDate: today.toISOString().split('T')[0] });
  
  // Add Investment
  Finance.addInvestment({ type: 'gold', name: 'Gold Coins', capital: 10, profit: 0, startDate: today.toISOString() });
  
  const m = today.getMonth();
  const y = today.getFullYear();
  const summary = Finance.getMonthSummary(m, y);
  console.log('Month Summary:', summary);
  console.log('Health Score:', Finance.getFinancialHealthScore(summary));
  

  
  // 4. Test Market API
  console.log('\\n4. Testing Market API');
  const marketData = await Market.fetchAllData();
  if (marketData) {
    console.log('Market Data Fetched Successfully.');
    console.log('- USD/EGP:', marketData.usdEgp.price);
    console.log('- Gold 24k (EGP/g):', marketData.local.gold24k);
    console.log('- COMI.CA Price:', marketData.egx?.comi?.price);
  } else {
    console.log('Market Data FAILED to fetch.');
  }
  
  console.log('\\n--- TESTS COMPLETED ---');
}

runTests().catch(console.error);
