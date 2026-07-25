

async function testSources() {
  const urls = [
    'https://api.nav.com.eg/api/v1/gold-prices',
    'https://egypt.gold-price-today.com/api',
    'https://isagha.com/api/v1/gold',
    // We can also just fetch HTML from a popular site and scrape it using regex
    'https://corsproxy.io/?' + encodeURIComponent('https://egypt.gold-price-today.com/')
  ];

  for (const url of urls) {
    console.log(`Testing ${url}...`);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      
      const text = await res.text();
      console.log(`[${res.status}] length: ${text.length}`);
      if (text.length > 0) {
        console.log(text.substring(0, 100).replace(/\\n/g, ' '));
      }
    } catch (e) {
      console.log(`Failed: ${e.message}`);
    }
  }
}

testSources();
