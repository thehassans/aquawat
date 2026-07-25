import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  try {
    const url = "https://www.google.com/maps/place/Khyber+Restaurant+-+Dammam/@26.4357,50.1136,15z";
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for the panel to load
    await page.waitForSelector('h1', { timeout: 15000 });
    
    const phone = await page.evaluate(() => {
      const telEl = document.querySelector('[data-item-id^="phone:tel:"]');
      if (telEl) return telEl.getAttribute('data-item-id');
      
      const btn = document.querySelector('button[data-tooltip*="phone" i]');
      if (btn) return btn.innerText;
      
      return null;
    });
    
    console.log("Phone:", phone);
    
    // Also log all data-item-id attributes to see what we have
    const items = await page.evaluate(() => {
       return Array.from(document.querySelectorAll('[data-item-id]')).map(el => el.getAttribute('data-item-id'));
    });
    console.log("Data Item IDs:", items);
  } finally {
    await browser.close();
  }
}
test();
