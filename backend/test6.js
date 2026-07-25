import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    const searchUrl = `https://www.google.com/maps/search/pakistani+restaurant+in+dammam`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    
    const html = await page.evaluate(() => {
      const el = document.querySelector('div[role="feed"] > div > div[jsaction]');
      return el ? el.innerHTML : null;
    });
    
    console.log(html);
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }
}

test();
