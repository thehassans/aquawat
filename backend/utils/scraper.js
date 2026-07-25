import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const scrapeGoogleMaps = async (query, maxResults = 30) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Go to google maps search directly
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the results pane to load
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => null);
    
    let items = [];
    let previousHeight = 0;
    
    // Scroll and extract (max ~200 loops for up to 1000 items)
    for (let i = 0; i < 200; i++) {
      // Extract current HTML of the feed
      const html = await page.content();
      const $ = cheerio.load(html);
      
      const elements = $('div[role="feed"] > div > div[jsaction]');
      
      elements.each((_, el) => {
        const titleEl = $(el).find('.fontHeadlineSmall');
        const name = titleEl.text().trim();
        
        if (name && !items.find(item => item.name === name)) {
          // Attempt to extract other details.
          const bodyText = $(el).text();
          
          let phone = '';
          // Extract text differently to avoid missing spaces, but bodyText is okay if we use a flexible regex
          // Match standard formats, Saudi formats: 05xxxxxxx, 01xxxxxxx, 9200xxxxx, +9665xxxxx, etc.
          // Since Google Maps sometimes spaces numbers out, we remove all non-digits to test length.
          const phoneRegex = /(?:\+?\d{1,4}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{0,4}/g;
          const phones = bodyText.match(phoneRegex);
          if (phones) {
             const validPhones = phones
               .map(p => p.trim())
               .filter(p => {
                 const digitsOnly = p.replace(/\D/g, '');
                 return digitsOnly.length >= 9 && digitsOnly.length <= 15;
               });
             if (validPhones.length > 0) {
               // Google usually puts the phone number last or near the end of the text match
               phone = validPhones[validPhones.length - 1]; 
             }
          }

          let rating = '';
          const ratingRegex = /(\d\.\d)\s*\(\d+\)/;
          const ratingMatch = bodyText.match(ratingRegex);
          if (ratingMatch) {
            rating = ratingMatch[1];
          }
          
          // Google Maps list item often has address fragments. We'll capture it if we can.
          
          items.push({
            name,
            phone: phone || 'N/A',
            rating: rating || 'N/A',
            city: query.split(/in /i)[1]?.trim() || 'Unknown'
          });
        }
      });
      
      if (items.length >= maxResults) break;

      // Scroll the feed down
      const newHeight = await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) {
          feed.scrollBy(0, 1000);
          return feed.scrollHeight;
        }
        return 0;
      });
      
      await delay(1500); // wait for network loading
      if (newHeight === previousHeight) break; // Reached bottom
      previousHeight = newHeight;
    }
    
    await browser.close();
    return items.slice(0, maxResults);
    
  } catch (error) {
    await browser.close();
    console.error('Scraping error:', error);
    throw new Error('Failed to scrape leads');
  }
};
