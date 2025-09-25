import fs from 'fs';
import path from 'path';

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
      return JSON.parse(settingsData);
    }
  } catch (error) {
    console.error('Error reading account settings:', error);
  }
  
  return null;
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

// Function to get the private API key
export function getPrivateApiKey() {
  const settings = getAccountSettings();
  console.log('Retrieved account settings:', settings ? 'Found' : 'Not found');
  if (settings?.privateApiKey) {
    console.log('Using saved private API key');
    return settings.privateApiKey;
  } else {
    console.log('Using environment variable API key');
    return process.env.KLAVIYO_API_KEY;
  }
} 