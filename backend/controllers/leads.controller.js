import { scrapeGoogleMaps } from '../utils/scraper.js';

export const scrapeLeads = async (req, res) => {
  try {
    const { query, maxResults } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const leads = await scrapeGoogleMaps(query, maxResults || 30);
    
    res.json({ success: true, count: leads.length, data: leads });
  } catch (error) {
    console.error('Scrape leads error:', error);
    res.status(500).json({ success: false, message: 'Failed to scrape leads', error: error.message });
  }
};
