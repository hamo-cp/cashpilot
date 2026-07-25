const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting PWA Tests...');
  const browser = await puppeteer.launch({ 
    headless: true,
    channel: 'chrome' // Try using the installed system chrome if it exists
  });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push('Page Error: ' + err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const location = msg.location();
      errors.push(`Console Error: ${msg.text()} at ${location.url}:${location.lineNumber}`);
    }
  });

  const delay = ms => new Promise(r => setTimeout(r, ms));

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully.');

    // 1. Clear storage and reload to ensure clean state
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    console.log('Storage cleared and reloaded.');

    // Wait for app to initialize
    await delay(1000);

    // 2. Add Income (Valid)
    console.log('Testing Add Income...');
    await page.evaluate(() => App.openIncomeModal());
    await page.waitForSelector('#incomeModal.active', { visible: true });
    await page.type('#inc-name', 'راتب شهري');
    await page.type('#inc-amount', '10000');
    await page.click('#incomeModal .btn-success'); // save button
    await delay(500);

    // 3. Add Income (Extreme/Edge Case: negative)
    console.log('Testing Edge Cases (Negative Income)...');
    await page.evaluate(() => App.openIncomeModal());
    await page.waitForSelector('#incomeModal.active', { visible: true });
    await page.type('#inc-name', 'خطأ سالب');
    await page.type('#inc-amount', '-500');
    await page.click('#incomeModal .btn-success');
    await delay(500);

    // 4. Test Custom Budgets
    console.log('Testing Custom Budgets...');
    // We can evaluate directly to avoid complex navigation for the test
    await page.evaluate(() => App.navigateTo('budget'));
    await delay(500);
    
    // Check if budget inputs exist
    const budgetInputsExist = await page.$('#budget-inputs');
    if (!budgetInputsExist) {
        errors.push('Budget inputs container not found on budget page.');
    } else {
        await page.evaluate(() => {
            const input = document.querySelector('#budget-food');
            if (input) {
                input.value = 1000;
                input.dispatchEvent(new Event('change'));
            }
        });
    }

    // 5. Test Smart Engine Alert (Trigger by spending > 100% of Food budget)
    console.log('Testing Smart Engine Alerts...');
    await page.evaluate(() => App.openExpenseModal());
    await page.waitForSelector('#expenseModal.active', { visible: true });
    await page.type('#exp-name', 'عشاء كبير');
    await page.type('#exp-amount', '1200'); // Exceeds 1000
    // Select food category
    await page.select('#exp-category', 'food');
    await page.click('#expenseModal .btn-danger');
    await delay(1000); // wait for smart engine

    // Navigate to notifications page to view them
    await page.evaluate(() => App.navigateTo('notifications'));
    await delay(500);

    // Check if notification appeared
    const notifications = await page.$$eval('.notif-item', items => items.map(i => i.innerText));
    if (notifications.length === 0) {
      errors.push('Smart Engine did not trigger a notification when budget was exceeded.');
    }

    // 6. Test Subscriptions
    console.log('Testing Subscriptions...');
    await page.evaluate(() => App.navigateTo('subscriptions'));
    await delay(500);
    await page.evaluate(() => App.openSubscriptionModal());
    await page.waitForSelector('#subscriptionModal.active', { visible: true });
    await page.type('#sub-name', 'Netflix');
    await page.type('#sub-amount', '200');
    
    // Set date to today
    const today = new Date().toISOString().split('T')[0];
    await page.evaluate((dateStr) => {
        document.querySelector('#sub-due').value = dateStr;
    }, today);
    
    await page.click('#subscriptionModal .btn-primary');
    await delay(500);

    // 7. Check Analytics Rendering
    console.log('Testing Analytics Page...');
    await page.evaluate(() => App.navigateTo('analytics'));
    await delay(1000);
    const canvasExists = await page.$('#expensesChart');
    if (!canvasExists) {
        errors.push('Analytics Chart canvas not found.');
    }

  } catch (err) {
    console.error('Test script crashed:', err);
    errors.push('Crashed: ' + err.toString());
  } finally {
    await browser.close();
  }

  console.log('\n--- TEST REPORT ---');
  if (errors.length > 0) {
    console.log('FAILED! Found ' + errors.length + ' errors:');
    errors.forEach(e => console.log(' - ' + e));
  } else {
    console.log('PASSED! No errors or glitches found.');
  }
})();
