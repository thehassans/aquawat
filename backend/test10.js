import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  try {
    const url = "https://www.google.com/maps/place/Khyber+Restaurant+-+Dammam/@26.4357,50.1136,15z";
    // Just domcontentloaded
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    let textFast = await page.evaluate(() => document.body.innerText);
    console.log("Length at domcontentloaded:", textFast.length);
    
    // Wait for the h1 element
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => null);
    
    let textSlow = await page.evaluate(() => document.body.innerText);
    console.log("Length after h1:", textSlow.length);
    
    // Extract phone
    const phoneData = await page.evaluate(() => {
      const btn = document.querySelector('button[data-tooltip*="phone" i]');
      if (btn) return btn.innerText;
      
      const telLink = document.querySelector('a[href^="tel:"]');
      if (telLink) return telLink.href;
      
      const dataTel = document.querySelector('[data-item-id^="phone:tel:"]');
      if (dataTel) return dataTel.getAttribute('data-item-id');
      
      return document.body.innerText;
    });
    
    console.log("Extracted phoneData:", phoneData.substring(0, 100));
    
  } finally {
    await browser.close();
  }
}
test();
