import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { publicKey, privateKey } = req.query;

  if (!publicKey) {
    return res.status(400).json({ error: 'Public API key is required' });
  }

  if (!privateKey) {
    return res.status(400).json({ error: 'Private API key is required' });
  }

  try {
    // Use Klaviyo's actual Get Account API
    // The public key is used as the account ID, and private key in Authorization header
    const response = await axios.get(`https://a.klaviyo.com/api/accounts/${publicKey}`, {
      headers: {
        'Authorization': `Klaviyo-API-Key ${privateKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'revision': '2024-10-15'
      }
    });

    // Return the actual account data from Klaviyo
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error validating API keys:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    } else if (error.response?.status === 403) {
      return res.status(403).json({ error: 'API key does not have required permissions' });
    } else if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Account not found. Please check your public API key.' });
    } else {
      return res.status(500).json({ error: 'Failed to validate API keys' });
    }
  }
} 