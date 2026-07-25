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
          // Google Maps sometimes hides phone numbers deep inside or separates them with invisible chars
          // Let's grab all text, clean it up, and look for anything resembling a phone number
          const cleanText = $(el).text().replace(/\u200E/g, '').replace(/\u200F/g, ''); // Remove bidirectional markers
          
          let phone = '';
          // This regex matches numbers like +9665..., 05..., 9200..., 01...
          const compactText = cleanText.replace(/[\s\-]/g, '');
          const phoneRegex = /(?:(?:\+|00)966|0)?5\d{8}|(?:01|02|03|04|06|07|08|09)\d{7}|9200\d{5}|800\d{6}/g;
          
          const phones = compactText.match(phoneRegex);
          if (phones) {
             const validPhones = phones
               .filter(p => {
                 const digitsOnly = p.replace(/\D/g, '');
                 return digitsOnly.length >= 8 && digitsOnly.length <= 15; 
               });
             if (validPhones.length > 0) {
               phone = validPhones[validPhones.length - 1]; 
             }
          }

          let rating = '';
          const ratingEl = $(el).find('span[role="img"][aria-label]');
          if (ratingEl.length > 0) {
             const aria = ratingEl.attr('aria-label');
             const match = aria.match(/([0-9\u0660-\u0669]+[\.,][0-9\u0660-\u0669]+)/);
             if (match) rating = match[1].replace(',', '.');
          }
          if (!rating) {
            const ratingRegex = /([0-9\u0660-\u0669]+[\.,][0-9\u0660-\u0669]+)\s*\([^)]+\)/;
            const ratingMatch = cleanText.match(ratingRegex);
            if (ratingMatch) {
              rating = ratingMatch[1].replace(',', '.');
            }
          }
          
          let url = $(el).find('a').attr('href');
          
          // Google Maps list item often has address fragments. We'll capture it if we can.
          
          items.push({
            name,
            phone: phone || 'N/A',
            rating: rating || 'N/A',
            city: query.split(/in /i)[1]?.trim() || 'Unknown',
            url: url || ''
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
    
    
    // Second pass: Fetch missing phone numbers by visiting place URLs
    const itemsToFetch = items.filter(item => item.phone === 'N/A' && item.url);
    const chunk = 5;
    for (let i = 0; i < itemsToFetch.length; i += chunk) {
      const batch = itemsToFetch.slice(i, i + chunk);
      const promises = batch.map(async (item) => {
        let p = null;
        try {
          p = await browser.newPage();
          // We only need domcontentloaded
          await p.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Extract phone via specific attributes first, fallback to innerText
          const phoneData = await p.evaluate(() => {
            const telLink = document.querySelector('a[href^="tel:"]');
            if (telLink) return telLink.href;
            
            const dataTel = document.querySelector('[data-item-id^="phone:tel:"]');
            if (dataTel) return dataTel.getAttribute('data-item-id');
            
            return document.body.innerText;
          });
          
          const compactText = phoneData.replace(/[\s\-]/g, '');
          // Strict regex: Saudi Mobile (05/9665), 9200, 800. Excludes landlines to prevent matching random IDs.
          const phoneRegex = /(?:(?:\+|00)966|0)?5\d{8}|9200\d{5}|800\d{6}/g;
          const match = compactText.match(phoneRegex);
          if (match) {
             const validPhones = match.filter(p => {
               const digitsOnly = p.replace(/\D/g, '');
               return digitsOnly.length >= 9 && digitsOnly.length <= 15;
             });
             if (validPhones.length > 0) {
               const mobile = validPhones.find(p => p.startsWith('05') || p.startsWith('+966') || p.startsWith('00966'));
               item.phone = mobile || validPhones[0]; 
             }
          }
        } catch (e) {
          // Ignore errors for individual pages to not break the batch
        } finally {
          if (p) await p.close().catch(()=>null);
        }
      });
      await Promise.all(promises);
    }
    
    await browser.close();
    
    // Remove the URL property before returning to frontend
    return items.slice(0, maxResults).map(item => ({
       name: item.name,
       phone: item.phone,
       rating: item.rating,
       city: item.city
    }));
    
  } catch (error) {
    await browser.close();
    console.error('Scraping error:', error);
    throw new Error('Failed to scrape leads');
  }
};
