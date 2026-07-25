import { scrapeGoogleMaps } from '../utils/scraper.js';

export const scrapeLeads = async (req, res) => {
  try {
    const { query, maxResults } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    
    // Flush the headers immediately
    res.flushHeaders();
    
    const onProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Scrape and stream
    await scrapeGoogleMaps(query, maxResults || 30, onProgress);
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Scrape leads error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to scrape leads', error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};
