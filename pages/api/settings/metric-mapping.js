import fs from 'fs';
import path from 'path';

// Function to get saved metric mapping from server storage
function getMetricMapping() {
  try {
    const mappingPath = path.join(process.cwd(), 'data', 'metric-mapping.json');
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(mappingPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Check if mapping file exists
    if (fs.existsSync(mappingPath)) {
      const mappingData = fs.readFileSync(mappingPath, 'utf8');
      return JSON.parse(mappingData);
    }
  } catch (error) {
    console.error('Error reading metric mapping:', error);
  }
  
  return null;
}

// Function to save metric mapping
function saveMetricMapping(mapping) {
  try {
    const mappingPath = path.join(process.cwd(), 'data', 'metric-mapping.json');
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(mappingPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving metric mapping:', error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get metric mapping
    try {
      const mapping = getMetricMapping();
      if (mapping) {
        res.status(200).json(mapping);
      } else {
        res.status(404).json({ error: 'No metric mapping found' });
      }
    } catch (error) {
      console.error('Error getting metric mapping:', error);
      res.status(500).json({ error: 'Failed to get metric mapping' });
    }
  } else if (req.method === 'POST') {
    // Save metric mapping
    try {
      const mapping = req.body;
      
      // Validate mapping object
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ error: 'Invalid metric mapping data' });
      }
      
      // Save the mapping
      const success = saveMetricMapping(mapping);
      
      if (success) {
        res.status(200).json(mapping);
      } else {
        res.status(500).json({ error: 'Failed to save metric mapping' });
      }
    } catch (error) {
      console.error('Error saving metric mapping:', error);
      res.status(500).json({ error: 'Failed to save metric mapping' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 