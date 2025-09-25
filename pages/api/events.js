import axios from 'axios';
import { getPrivateApiKey } from '../../lib/utils';

// Helper to extract the page cursor from a Klaviyo next link
function extractCursor(nextUrl) {
  try {
    const url = new URL(nextUrl);
    // Try both possible parameter names for robustness
    return url.searchParams.get('page[cursor]') || url.searchParams.get('page_cursor');
  } catch {
    return null;
  }
}

const METRIC_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
let metricIdToName = {};
let metricNameToId = {};

async function fetchAndCacheMetrics() {
  try {
    const privateApiKey = getPrivateApiKey();
    if (!privateApiKey) {
      console.error('No API key configured for metrics caching');
      return;
    }

    const headers = {
      Authorization: `Klaviyo-API-Key ${privateApiKey}`,
      Accept: 'application/json',
      Revision: '2025-04-15',
    };
    const response = await axios.get('https://a.klaviyo.com/api/metrics?fields[metric]=name', { headers });
    const metrics = response.data.data || [];
    metricIdToName = {};
    metricNameToId = {};
    for (const m of metrics) {
      metricIdToName[m.id] = m.attributes.name;
      metricNameToId[m.attributes.name] = m.id;
    }
    console.log(`[Klaviyo] Cached ${metrics.length} metrics.`);
  } catch (err) {
    console.error('Error fetching Klaviyo metrics:', err.stack || err);
  }
}

// Initial fetch and periodic refresh
fetchAndCacheMetrics();
setInterval(fetchAndCacheMetrics, METRIC_REFRESH_INTERVAL);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile_id, metric_id, metric_name } = req.query;
  
  // Get the private API key from saved settings
  const privateApiKey = getPrivateApiKey();
  
  if (!privateApiKey) {
    console.error('No API key configured for events');
    return res.status(500).json({ 
      error: 'No API key configured. Please set up your API keys in Settings.',
      data: [],
      included: []
    });
  }
  
  // profile_id is now optional
  const headers = {
    Authorization: `Klaviyo-API-Key ${privateApiKey}`,
    Accept: 'application/json',
    Revision: '2025-04-15',
  };
  // Start with all query params from frontend
  const params = { ...req.query };
  // Always set page_size to 100 unless overridden
  params.page_size = params.page_size || 100;
  // Build filter string as before
  let filter = [];
  if (profile_id) filter.push(`equals(profile_id,\"${profile_id}\")`);
  let effectiveMetricId = metric_id;
  if (!effectiveMetricId && metric_name && metricNameToId[metric_name]) {
    effectiveMetricId = metricNameToId[metric_name];
  }
  if (effectiveMetricId) filter.push(`equals(metric_id,\"${effectiveMetricId}\")`);
  if (filter.length > 0) params.filter = filter.join(',');
  // If include is not set, default to 'metric'
  if (!params.include) params.include = 'metric';
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
  let allEvents = [];
  let allIncluded = [];
  let nextCursor = null;
  let pageCount = 0;
  
  try {
    do {
      if (nextCursor) params.page_cursor = nextCursor;
      console.log('Requesting Klaviyo events page', pageCount + 1, { headers, params });
      const response = await axios.get(
        'https://a.klaviyo.com/api/events',
        {
          headers,
          params
        }
      );
      const data = response.data;
      allEvents = allEvents.concat(data.data || []);
      if (data.included) {
        allIncluded = allIncluded.concat(data.included);
      }
      nextCursor = data.links && data.links.next ? extractCursor(data.links.next) : null;
      pageCount++;
    } while (nextCursor && (!limit || allEvents.length < limit));
    
    // Apply limit if specified
    if (limit && allEvents.length > limit) {
      allEvents = allEvents.slice(0, limit);
    }
    
    res.json({
      data: allEvents,
      included: allIncluded,
      pageCount
    });
  } catch (err) {
    console.error('Error fetching Klaviyo events:', err.stack || err);
    if (err.response) {
      console.error('Klaviyo error response:', err.response.data);
      res.status(err.response.status).json({ error: err.toString(), klaviyo: err.response.data });
    } else {
      res.status(500).json({ error: err.toString() });
    }
  }
} 