import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
      console.log('GET request - Retrieved settings for display');
      
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        // Return complete settings including private key for display
        res.status(200).json(settings);
      } else {
        res.status(404).json({ error: 'No account settings found' });
      }
    } catch (error) {
      console.error('Error getting account settings for display:', error);
      res.status(500).json({ error: 'Failed to get account settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 