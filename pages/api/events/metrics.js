import axios from 'axios';
import { getPrivateApiKey } from '../../../lib/utils';

const METRIC_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const metricCache = {}; // accountId -> { metricIdToName, metricNameToId, allMetrics }

async function fetchAndCacheMetricsForAccount(accountId) {
  try {
    const privateApiKey = getPrivateApiKey(accountId);
    if (!privateApiKey) {
      console.error('No API key configured for metrics caching');
      return null;
    }

    const headers = {
      Authorization: `Klaviyo-API-Key ${privateApiKey}`,
      Accept: 'application/json',
      Revision: '2025-04-15',
    };
    const response = await axios.get('https://a.klaviyo.com/api/metrics?fields[metric]=name', { headers });
    const metrics = response.data.data || [];
    const metricIdToName = {};
    const metricNameToId = {};
    const allMetrics = [];
    
    for (const m of metrics) {
      metricIdToName[m.id] = m.attributes.name;
      metricNameToId[m.attributes.name] = m.id;
      allMetrics.push({ id: m.id, name: m.attributes.name });
    }
    
    const key = accountId || '__default__';
    metricCache[key] = { metricIdToName, metricNameToId, allMetrics, lastFetch: Date.now() };
    console.log(`[Klaviyo] Cached ${metrics.length} metrics for account ${key}`);
    return metricCache[key];
  } catch (err) {
    console.error('Error fetching Klaviyo metrics:', err.stack || err);
    return null;
  }
}

function getCachedMetrics(accountId) {
  const key = accountId || '__default__';
  const cached = metricCache[key];
  if (cached && Date.now() - cached.lastFetch < METRIC_REFRESH_INTERVAL) {
    return cached;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = req.query.account_id || req.query.accountId || null;

  try {
    let data = getCachedMetrics(accountId);
    if (!data) {
      data = await fetchAndCacheMetricsForAccount(accountId);
    }
    
    if (!data) {
      return res.status(500).json({
        error: 'No API key configured or failed to fetch metrics',
        metricIdToName: {},
        metricNameToId: {},
        allMetrics: []
      });
    }
    
    res.json({
      metricIdToName: data.metricIdToName,
      metricNameToId: data.metricNameToId,
      allMetrics: data.allMetrics
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: error.message,
      metricIdToName: {},
      metricNameToId: {},
      allMetrics: []
    });
  }
}
