import { getAccountSettings, saveAccountSettings, getAllAccounts } from '../../lib/utils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const accounts = getAllAccounts();
      res.status(200).json({ accounts });
    } catch (error) {
      console.error('Error getting account settings:', error);
      res.status(500).json({ error: 'Failed to get account settings' });
    }
  } else if (req.method === 'POST') {
    try {
      const { action, account } = req.body;
      
      if (action === 'add') {
        const { privateApiKey, publicApiKey, accountName } = account || {};
        if (!privateApiKey || !publicApiKey) {
          return res.status(400).json({ error: 'Both private and public API keys are required' });
        }
        
        const settings = getAccountSettings();
        const accounts = settings.accounts || [];
        const id = publicApiKey;
        
        if (accounts.some(a => a.id === id || a.publicApiKey === publicApiKey)) {
          return res.status(400).json({ error: 'An account with this public API key already exists' });
        }
        
        accounts.push({ id, publicApiKey, privateApiKey, accountName: accountName || '' });
        saveAccountSettings({ accounts });
        const { privateApiKey: _, ...safeAccount } = accounts[accounts.length - 1];
        return res.status(200).json({ account: safeAccount });
      }
      
      if (action === 'update') {
        const { id, privateApiKey, publicApiKey, accountName } = account || {};
        if (!id) return res.status(400).json({ error: 'Account id is required' });
        
        const settings = getAccountSettings();
        const accounts = settings.accounts || [];
        const idx = accounts.findIndex(a => a.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Account not found' });
        
        if (privateApiKey) accounts[idx].privateApiKey = privateApiKey;
        if (publicApiKey) {
          accounts[idx].publicApiKey = publicApiKey;
          accounts[idx].id = publicApiKey;
        }
        if (accountName !== undefined) accounts[idx].accountName = accountName;
        saveAccountSettings({ accounts });
        const { privateApiKey: _, ...safeAccount } = accounts[idx];
        return res.status(200).json({ account: safeAccount });
      }
      
      if (action === 'delete') {
        const { id } = account || req.body;
        if (!id) return res.status(400).json({ error: 'Account id is required' });
        
        const settings = getAccountSettings();
        const accounts = (settings.accounts || []).filter(a => a.id !== id && a.publicApiKey !== id);
        if (accounts.length === settings.accounts?.length) {
          return res.status(404).json({ error: 'Account not found' });
        }
        saveAccountSettings({ accounts });
        return res.status(200).json({ message: 'Account removed' });
      }
      
      return res.status(400).json({ error: 'Invalid action. Use add, update, or delete.' });
    } catch (error) {
      console.error('Error saving account settings:', error);
      res.status(500).json({ error: 'Failed to save account settings' });
    }
  } else if (req.method === 'DELETE') {
    try {
      saveAccountSettings({ accounts: [] });
      res.status(200).json({ message: 'All account settings cleared successfully' });
    } catch (error) {
      console.error('Error clearing account settings:', error);
      res.status(500).json({ error: 'Failed to clear account settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
