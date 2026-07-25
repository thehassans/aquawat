import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const scrapeGoogleMaps = async (query, maxResults = 30, onProgress = null) => {
  const emit = (data) => {
    if (onProgress) {
      try { onProgress(data); } catch (e) {}
    }
  };
  
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
    let previousItemCount = 0;
    let unchangedCount = 0;
    
    // Scroll and extract (max ~200 loops for up to 1000 items)
    emit({ type: 'status', message: `Initializing search for "${query}"...` });
    
    for (let i = 0; i < 200; i++) {
      emit({ type: 'status', message: `Scrolling feed... Found ${items.length} initial items.` });
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
          
          let url = $(el).find('a.hfpxzc').attr('href') || $(el).find('a[href*="/maps/place/"]').attr('href') || $(el).find('a').attr('href');
          
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

      // Scroll the feed fully to the bottom to trigger next page load
      const currentItemCount = await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) {
          // Find all items
          const itemElements = feed.querySelectorAll('div[jsaction]');
          if (itemElements.length > 0) {
            // Scroll last item into view
            itemElements[itemElements.length - 1].scrollIntoView({ block: "end" });
            
            // Also attempt to scroll the scrollable parent
            let current = feed;
            while (current && current !== document.body) {
                if (current.scrollHeight > current.clientHeight) {
                    current.scrollBy(0, 5000);
                    break;
                }
                current = current.parentElement;
            }
          }
          return itemElements.length;
        }
        return 0;
      });
      
      // Wait for network loading
      await delay(2500); 
      
      if (currentItemCount === previousItemCount) {
        unchangedCount++;
        // Retry a few times in case of slow network or lazy loading
        if (unchangedCount >= 4) {
          break; // Reached bottom truly
        }
      } else {
        unchangedCount = 0;
      }
      previousItemCount = currentItemCount;
    }
    
    
    // Second pass: Fetch missing phone numbers by visiting place URLs
    const itemsToFetch = items.filter(item => item.phone === 'N/A' && item.url);
    const completeItems = items.filter(item => item.phone !== 'N/A' || !item.url);
    
    // Emit the items that already have everything
    completeItems.forEach(item => {
      emit({ type: 'lead', lead: { name: item.name, phone: item.phone, rating: item.rating, city: item.city } });
    });
    
    emit({ type: 'status', message: `Deep scraping ${itemsToFetch.length} profiles for phone numbers...` });
    
    let processedDeep = 0;
    const chunk = 5;
    for (let i = 0; i < itemsToFetch.length; i += chunk) {
      const batch = itemsToFetch.slice(i, i + chunk);
      const promises = batch.map(async (item) => {
        let p = null;
        try {
          p = await browser.newPage();
          // We only need domcontentloaded
          await p.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Wait for the place name to render, indicating the SPA has loaded the data
          await p.waitForSelector('h1', { timeout: 5000 }).catch(() => null);
          await new Promise(r => setTimeout(r, 1000)); // Brief pause for React to render the info pane
          
          // Extract phone via specific attributes first, fallback to innerText
          const phoneData = await p.evaluate(() => {
            const telLink = document.querySelector('a[href^="tel:"]');
            if (telLink) return telLink.href.replace('tel:', '');
            
            const dataTel = document.querySelector('[data-item-id^="phone:tel:"]');
            if (dataTel) return dataTel.getAttribute('data-item-id').replace('phone:tel:', '');
            
            const phoneBtn = Array.from(document.querySelectorAll('button')).find(b => {
              const label = b.getAttribute('aria-label');
              return label && (label.toLowerCase().includes('phone') || label.includes('هاتف'));
            });
            if (phoneBtn) {
              const textDiv = phoneBtn.querySelector('.fontBodyMedium');
              if (textDiv) return textDiv.innerText;
              return phoneBtn.getAttribute('aria-label');
            }
            
            return null;
          });
          
          if (phoneData) {
             const compact = phoneData.replace(/[\s\-\+]/g, '');
             if (compact.length >= 8 && compact.length <= 15) {
                // If it's 05..., keep it. If it's 9665... format it.
                item.phone = phoneData.trim();
             }
          } else {
             // Fallback to searching the innerText
             const text = await p.evaluate(() => document.body.innerText);
             const compactText = text.replace(/[\s\-\(\)\.]/g, '');
             // Regex for Saudi Mobile, Landlines (01x - 07x), and Toll-free
             const phoneRegex = /(?:(?:\+|00)?966|0)?(?:5\d{8}|[1-9]\d{8}|9200\d{5}|800\d{6})/g;
             const match = compactText.match(phoneRegex);
             if (match) {
                item.phone = match[0];
             }
          }
          
          emit({ type: 'lead', lead: { name: item.name, phone: item.phone, rating: item.rating, city: item.city } });
        } catch (e) {
          // Ignore errors for individual pages to not break the batch
          emit({ type: 'lead', lead: { name: item.name, phone: item.phone || 'N/A', rating: item.rating, city: item.city } });
        } finally {
          processedDeep++;
          emit({ type: 'status', message: `Deep scraping ${processedDeep}/${itemsToFetch.length} profiles...` });
          if (p) await p.close().catch(()=>null);
        }
      });
      await Promise.all(promises);
    }
    
    await browser.close();
    emit({ type: 'status', message: `Scraping complete!` });
    
    // Remove the URL property before returning to frontend for the standard final return (if needed)
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
