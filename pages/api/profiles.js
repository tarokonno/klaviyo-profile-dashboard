import axios from 'axios';
import { getPrivateApiKey } from '../../lib/utils';

function extractCursor(nextUrl) {
  try {
    const url = new URL(nextUrl);
    // Try both possible parameter names for robustness
    return url.searchParams.get('page[cursor]') || url.searchParams.get('page_cursor');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the private API key from saved settings
  const privateApiKey = getPrivateApiKey();
  
  if (!privateApiKey) {
    return res.status(500).json({ 
      error: 'No API key configured. Please set up your API keys in Settings.',
      data: [],
      nextCursor: null,
      total: null
    });
  }

  const headers = {
    Authorization: `Klaviyo-API-Key ${privateApiKey}`,
    Accept: 'application/json',
    Revision: '2025-04-15',
  };
  const page_size = req.query.page_size ? parseInt(req.query.page_size, 10) : 25;
  const page_cursor = req.query.page_cursor || null;
  const search = req.query.search || null;
  
  try {
    const params = {
      // Always request subscriptions and predictive_analytics fields
      'additional-fields[profile]': 'subscriptions,predictive_analytics',
      page_size,
    };
    if (page_cursor) {
      params.page_cursor = page_cursor;
    }
    if (search) {
      params.filter = `equals(email,\"${search}\")`;
    }
    console.log('Requesting Klaviyo profiles page', { headers, params });
    const response = await axios.get(
      'https://a.klaviyo.com/api/profiles',
      { headers, params }
    );
    const data = response.data;
    const nextCursor = data.links && data.links.next ? extractCursor(data.links.next) : null;
    const prevCursor = data.links && data.links.prev ? extractCursor(data.links.prev) : null;
    const total = data.meta && data.meta.total ? data.meta.total : null;
    console.log('Klaviyo API links:', data.links);
    console.log('Backend nextCursor:', nextCursor, 'prevCursor:', prevCursor);
    console.log(`Fetched ${data.data.length} profiles on this page. nextCursor:`, nextCursor);
    res.json({
      data: data.data,
      nextCursor,
      prevCursor,
      total,
    });
  } catch (err) {
    console.error('Error fetching Klaviyo profiles:', err.stack || err);
    if (err.response) {
      console.error('Klaviyo error response:', err.response.data);
      res.status(err.response.status).json({ error: err.toString(), klaviyo: err.response.data });
    } else {
      res.status(500).json({ error: err.toString() });
    }
  }
} 