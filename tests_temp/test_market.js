const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // click "المزيد" then "الاستثمارات"
  await page.evaluate(() => {
    App.navigateTo('investments');
  });

  // wait 5 seconds for fetch to complete
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: 'market_test.png', fullPage: true });
  console.log('Screenshot saved to market_test.png');
  
  await browser.close();
}
run();
