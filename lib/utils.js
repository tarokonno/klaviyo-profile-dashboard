import fs from 'fs';
import path from 'path';

// Normalize settings to always have accounts array (migrate from legacy single-account format)
function normalizeAccountSettings(settings) {
  if (!settings) return { accounts: [] };
  if (settings.accounts && Array.isArray(settings.accounts)) {
    return settings;
  }
  // Legacy format: single account with privateApiKey, publicApiKey, accountName
  if (settings.privateApiKey && settings.publicApiKey) {
    return {
      accounts: [{
        id: settings.publicApiKey,
        publicApiKey: settings.publicApiKey,
        privateApiKey: settings.privateApiKey,
        accountName: settings.accountName || ''
      }]
    };
  }
  return { accounts: [] };
}

// Function to get account settings from server storage
export function getAccountSettings() {
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(settingsPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Check if settings file exists
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const raw = JSON.parse(settingsData);
      return normalizeAccountSettings(raw);
    }
  } catch (error) {
    console.error('Error reading account settings:', error);
  }
  
  return { accounts: [] };
}

// Function to save account settings
export function saveAccountSettings(settings) {
  try {
    console.log('Saving account settings...');
    const settingsPath = path.join(process.cwd(), 'data', 'account-settings.json');
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(settingsPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Account settings saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving account settings:', error);
    return false;
  }
}

// Get all accounts (safe - no private keys)
export function getAllAccounts() {
  const settings = getAccountSettings();
  return (settings.accounts || []).map(({ id, publicApiKey, accountName }) => ({
    id,
    publicApiKey,
    accountName: accountName || publicApiKey || id
  }));
}

// Get private API key for a specific account (by id/publicApiKey) or first account
export function getPrivateApiKey(accountId = null) {
  const settings = getAccountSettings();
  const accounts = settings.accounts || [];
  
  if (accounts.length === 0) {
    return process.env.KLAVIYO_API_KEY || null;
  }
  
  if (accountId) {
    const account = accounts.find(a => a.id === accountId || a.publicApiKey === accountId);
    if (account?.privateApiKey) return account.privateApiKey;
  }
  
  // Default to first account
  return accounts[0]?.privateApiKey || process.env.KLAVIYO_API_KEY || null;
}

// Get account by id
export function getAccountById(accountId) {
  const settings = getAccountSettings();
  return (settings.accounts || []).find(a => a.id === accountId || a.publicApiKey === accountId) || null;
} 