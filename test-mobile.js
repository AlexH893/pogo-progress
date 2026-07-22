const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  
  await page.goto('http://localhost:4200');
  
  // Wait a moment for rendering
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: '/Users/alexhaefner/.gemini/antigravity-ide/brain/79dfa61c-0ed6-49b0-967d-1dc80f61f0a3/scratch/mobile_test.png', fullPage: true });
  
  // Also get some dimensions
  const dims = await page.evaluate(() => {
    const main = document.querySelector('.main-content');
    const nav = document.querySelector('.nav-pill');
    const header = document.querySelector('.home__header');
    return {
      main: main ? main.getBoundingClientRect() : null,
      nav: nav ? nav.getBoundingClientRect() : null,
      header: header ? header.getBoundingClientRect() : null,
      bodyWidth: document.body.clientWidth,
      windowWidth: window.innerWidth
    };
  });
  console.log(JSON.stringify(dims, null, 2));
  
  await browser.close();
})();
