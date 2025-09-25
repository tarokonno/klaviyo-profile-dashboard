import axios from 'axios';
import { getPrivateApiKey } from '../../../lib/utils';

const METRIC_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
let metricIdToName = {};
let metricNameToId = {};
let allMetrics = [];

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
    allMetrics = [];
    
    for (const m of metrics) {
      metricIdToName[m.id] = m.attributes.name;
      metricNameToId[m.attributes.name] = m.id;
      allMetrics.push({
        id: m.id,
        name: m.attributes.name
      });
    }
    console.log(`[Klaviyo] Cached ${metrics.length} metrics.`);
    console.log(`[Klaviyo] allMetrics array length: ${allMetrics.length}`);
  } catch (err) {
    console.error('Error fetching Klaviyo metrics:', err.stack || err);
  }
}

// Initial fetch and periodic refresh
let isInitialized = false;

async function initializeMetrics() {
  await fetchAndCacheMetrics();
  isInitialized = true;
}

initializeMetrics();
setInterval(fetchAndCacheMetrics, METRIC_REFRESH_INTERVAL);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Wait for initial metrics to be loaded
    if (!isInitialized) {
      console.log('Waiting for metrics to initialize...');
      await initializeMetrics();
    }
    
    console.log(`Returning metrics: ${allMetrics.length} metrics available`);
    res.json({
      metricIdToName,
      metricNameToId,
      allMetrics
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
} 