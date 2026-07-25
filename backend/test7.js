import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  try {
    await page.goto("https://www.google.com/maps/search/pakistani+restaurant+in+dammam", { waitUntil: 'networkidle2' });
    await page.waitForSelector('div[role="feed"]');
    
    // Get text of first result
    const result = await page.evaluate(() => {
      const el = document.querySelector('div[role="feed"] > div > div[jsaction]');
      if (!el) return null;
      return {
        text: el.innerText,
        html: el.innerHTML
      };
    });
    
    console.log("Text:", result?.text);
    console.log("HTML slice:", result?.html.substring(0, 500));
  } finally {
    await browser.close();
  }
}
test();
