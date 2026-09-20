const { scrapeProduct } = require('../services/scraper');

async function runHeadedTest() {
  const targetUrl = process.argv[2] || 'https://demo.inelabteamdev.com/';
  console.log('====================================================');
  console.log('   PLAYWRIGHT HEADED SCRAPER TEST RUNNER (INE)   ');
  console.log('====================================================');
  console.log(`Target URL : ${targetUrl}`);
  console.log('Headless   : FALSE (Browser window will open)');
  console.log('SlowMo     : 100ms per step');
  console.log('----------------------------------------------------');

  try {
    const result = await scrapeProduct(targetUrl, true);
    console.log('\n✅ [SCRAPE SUCCESSFUL]');
    console.log('Result Data:', JSON.stringify(result, null, 2));
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [SCRAPE FAILED]');
    console.error('Error Details:', err.message);
    console.log('====================================================');
    process.exit(1);
  }
}

runHeadedTest();
