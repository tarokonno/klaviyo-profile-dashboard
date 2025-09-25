import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
      console.log('GET request - Retrieved settings');
      
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        const { privateApiKey, ...safeSettings } = settings;
        res.status(200).json(safeSettings);
      } else {
        res.status(404).json({ error: 'No account settings found' });
      }
    } catch (error) {
      console.error('Error getting account settings:', error);
      res.status(500).json({ error: 'Failed to get account settings' });
    }
  } else if (req.method === 'POST') {
    try {
      const settings = req.body;
      console.log('POST request received - Body size:', JSON.stringify(settings).length, 'bytes');
      console.log('POST request - Settings received:', Object.keys(settings));
      console.log('Request headers size:', JSON.stringify(req.headers).length, 'bytes');
      
      const { privateApiKey, publicApiKey, accountName } = settings;
      
      console.log('Extracted settings:', {
        privateKeyLength: privateApiKey?.length || 0,
        publicKeyLength: publicApiKey?.length || 0,
        accountName: accountName
      });
      
      if (!privateApiKey || !publicApiKey) {
        return res.status(400).json({ error: 'Both private and public API keys are required' });
      }
      
      const settingsToSave = { privateApiKey, publicApiKey, accountName };
      const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
      
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(settingsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(settingsPath, JSON.stringify(settingsToSave, null, 2));
      
      const { privateApiKey: _, ...safeSettings } = settingsToSave;
      console.log('Settings saved successfully');
      res.status(200).json(safeSettings);
    } catch (error) {
      console.error('Error saving account settings:', error);
      res.status(500).json({ error: 'Failed to save account settings' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
      console.log('DELETE request - Clearing settings');
      
      if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
        console.log('Settings file deleted successfully');
      }
      
      res.status(200).json({ message: 'Account settings cleared successfully' });
    } catch (error) {
      console.error('Error clearing account settings:', error);
      res.status(500).json({ error: 'Failed to clear account settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 