import { getAllAccounts } from '../../lib/utils';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const accounts = getAllAccounts();
      // For backward compatibility, also return first account as legacy format
      const first = accounts[0];
      res.status(200).json({
        accounts,
        // Legacy shape for components that expect single account
        accountName: first?.accountName,
        publicApiKey: first?.publicApiKey,
        privateApiKey: undefined, // Never expose private key in display
      });
    } catch (error) {
      console.error('Error getting account settings for display:', error);
      res.status(500).json({ error: 'Failed to get account settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
