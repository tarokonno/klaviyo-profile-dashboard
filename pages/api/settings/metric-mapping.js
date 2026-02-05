import fs from 'fs';
import path from 'path';

const MAPPING_KEYS = ['received', 'opened', 'clicked', 'placedOrder', 'productsOrdered', 'smsReceived', 'smsClicked'];

function getMetricMapping() {
  try {
    const mappingPath = path.join(process.cwd(), 'data', 'metric-mapping.json');
    const dataDir = path.dirname(mappingPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(mappingPath)) {
      const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      // Migrate legacy flat format to byAccount
      if (data.byAccount) return data;
      const hasLegacy = MAPPING_KEYS.some(k => data[k] !== undefined);
      if (hasLegacy) {
        const legacy = {};
        MAPPING_KEYS.forEach(k => { if (data[k]) legacy[k] = data[k]; });
        return { byAccount: { __default__: legacy } };
      }
      return { byAccount: {} };
    }
  } catch (error) {
    console.error('Error reading metric mapping:', error);
  }
  return { byAccount: {} };
}

function saveMetricMapping(data) {
  try {
    const mappingPath = path.join(process.cwd(), 'data', 'metric-mapping.json');
    const dataDir = path.dirname(mappingPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(mappingPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving metric mapping:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const data = getMetricMapping();
      const accountId = req.query.account_id || req.query.accountId;
      if (accountId) {
        const mapping = data.byAccount?.[accountId] || data.byAccount?.__default__ || {};
        return res.status(200).json({ mapping });
      }
      res.status(200).json(data);
    } catch (error) {
      console.error('Error getting metric mapping:', error);
      res.status(500).json({ error: 'Failed to get metric mapping' });
    }
  } else if (req.method === 'POST') {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid metric mapping data' });
      }
      const data = getMetricMapping();
      if (body.account_id && body.mapping) {
        const accId = body.account_id;
        if (!data.byAccount) data.byAccount = {};
        data.byAccount[accId] = body.mapping;
      } else if (body.byAccount && typeof body.byAccount === 'object') {
        data.byAccount = body.byAccount;
      } else {
        return res.status(400).json({ error: 'Provide account_id and mapping, or byAccount' });
      }
      if (saveMetricMapping(data)) {
        res.status(200).json(data);
      } else {
        res.status(500).json({ error: 'Failed to save' });
      }
    } catch (error) {
      console.error('Error saving metric mapping:', error);
      res.status(500).json({ error: 'Failed to save metric mapping' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
