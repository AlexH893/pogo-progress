const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3 });
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle0' });
  
  const layout = await page.evaluate(() => {
    return {
      mainContent: document.querySelector('.main-content')?.getBoundingClientRect().toJSON(),
      dashboardGrid: document.querySelector('.dashboard-grid')?.getBoundingClientRect().toJSON(),
      leftCol: document.querySelector('.left-col')?.getBoundingClientRect().toJSON(),
      appUpload: document.querySelector('app-upload')?.getBoundingClientRect().toJSON()
    };
  });
  
  console.log(JSON.stringify(layout, null, 2));
  await browser.close();
})();
