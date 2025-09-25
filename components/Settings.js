import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableDropdown from './SearchableDropdown';

export default function Settings({ onBack, activeTab = 'account' }) {
  const [allMetrics, setAllMetrics] = useState([]);
  const [metricMapping, setMetricMapping] = useState({
    received: '',
    opened: '',
    clicked: '',
    placedOrder: '',
    productsOrdered: '',
    smsReceived: '',
    smsClicked: '',
  });
  const [loading, setLoading] = useState(true);
  const [activeTabState, setActiveTabState] = useState(activeTab);
  const [accountSettings, setAccountSettings] = useState({
    privateApiKey: '',
    publicApiKey: '',
    accountName: ''
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [savedAccountSettings, setSavedAccountSettings] = useState(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearConfirmStep, setClearConfirmStep] = useState('confirm'); // 'confirm' or 'success'
  
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        // First load account settings
        await loadAccountSettings();
        
        // If metrics tab is active, load metrics immediately
        if (activeTab === 'metrics') {
          await loadMetrics();
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing settings:', error);
        setLoading(false);
      }
    };

    initializeSettings();
  }, [activeTab]);

  // Load metrics when switching to metrics tab
  const handleTabChange = (tab) => {
    setActiveTabState(tab);
    if (tab === 'metrics') {
      loadMetrics();
    }
  };

  // Load saved account settings from server only
  const loadAccountSettings = async () => {
    try {
      const serverResponse = await axios.get('/api/account-settings-display');
      if (serverResponse.data) {
        // Store the complete saved settings (including private key for display)
        setSavedAccountSettings(serverResponse.data);
        
        // Don't populate the private API key field for security (input stays empty)
        setAccountSettings({
          privateApiKey: '', // Keep empty for security
          publicApiKey: serverResponse.data.publicApiKey || '',
          accountName: serverResponse.data.accountName || '',
        });
      }
    } catch (error) {
      console.error('Error loading account settings:', error);
    }
  };

  // Load metrics separately
  const loadMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await axios.get('/api/events/metrics');
      const data = res.data;
      setAllMetrics(data.allMetrics || []);
      
      // Load saved mapping from server only
      try {
        const mappingResponse = await axios.get('/api/settings/metric-mapping');
        if (mappingResponse.data) {
          setMetricMapping(mappingResponse.data);
        }
      } catch (error) {
        console.error('Error loading metric mapping:', error);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Save metric mapping to server
      await axios.post('/api/settings/metric-mapping', metricMapping);
      alert('Settings saved!');
    } catch (error) {
      console.error('Error saving metric mapping:', error);
      alert('Error saving settings. Please try again.');
    }
  };

  const handleChange = (field, value) => {
    setMetricMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccountChange = (field, value) => {
    setAccountSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClearAccountSettings = async () => {
    try {
      // Delete the settings file
      await axios.delete('/api/account-settings');
      setSavedAccountSettings(null);
      setAccountSettings({
        privateApiKey: '',
        publicApiKey: '',
        accountName: ''
      });
      setClearConfirmStep('success');
    } catch (error) {
      console.error('Error clearing account settings:', error);
      alert('Error clearing account settings. Please try again.');
    }
  };

  const handleSaveAccountSettings = async () => {
    // Validate required fields
    if (!accountSettings.privateApiKey.trim() || !accountSettings.publicApiKey.trim()) {
      setAccountError('Both Private API Key and Public API Key are required.');
      return;
    }

    setSavingAccount(true);
    setAccountError('');

    try {
      // Call Klaviyo API to get account details
      const response = await axios.get('/api/account', {
        params: {
          publicKey: accountSettings.publicApiKey,
          privateKey: accountSettings.privateApiKey
        }
      });

      // Check for the correct response structure: response.data.data.attributes
      if (response.data && response.data.data && response.data.data.attributes && response.data.data.attributes.contact_information) {
        const organizationName = response.data.data.attributes.contact_information.organization_name;
        
        console.log('Account validation successful, organization name:', organizationName);
        
        setAccountSettings(prev => ({
          ...prev,
          accountName: organizationName
        }));
        
        // Save to server only - never to localStorage
        try {
          // Test with simple endpoint first
          console.log('Testing simple endpoint...');
          const testData = {
            privateApiKey: accountSettings.privateApiKey,
            publicApiKey: accountSettings.publicApiKey,
            accountName: organizationName
          };
          
          try {
            const testResponse = await axios.post('/api/test-save', testData);
            console.log('Test endpoint successful:', testResponse.data);
          } catch (testError) {
            console.error('Test endpoint failed:', testError.response?.status, testError.response?.data);
          }
          
          // Try the simplest approach first - just send everything normally
          const saveData = {
            privateApiKey: accountSettings.privateApiKey,
            publicApiKey: accountSettings.publicApiKey,
            accountName: organizationName
          };
          
          console.log('Sending complete save data:', {
            privateKeyLength: accountSettings.privateApiKey?.length || 0,
            publicKeyLength: accountSettings.publicApiKey?.length || 0,
            accountName: organizationName,
            totalSize: JSON.stringify(saveData).length + ' bytes'
          });
          
          try {
            const saveResponse = await axios.post('/api/account-settings', saveData);
            console.log('Settings saved successfully:', saveResponse.status);
          } catch (saveError) {
            console.error('Error saving settings:', saveError.response?.status, saveError.response?.data);
            console.error('Full error:', saveError);
            throw saveError;
          }
          
        } catch (saveError) {
          console.error('Error saving settings:', saveError.response?.status, saveError.response?.data);
          console.error('Full error:', saveError);
          throw saveError;
        }
        
        // Clear the private API key field for security
        setAccountSettings(prev => ({
          ...prev,
          privateApiKey: ''
        }));
        
        // Reload saved settings to show the read-only view
        await loadAccountSettings();
        
        // Show success modal
        setShowSuccessModal(true);
      } else {
        setAccountError('Unable to retrieve account information. Please check your API keys.');
      }
    } catch (error) {
      console.error('Error saving account settings:', error);
      setAccountError('Error saving account settings. Please check your API keys and try again.');
    } finally {
      setSavingAccount(false);
    }
  };

  // Convert metrics to dropdown options format
  const getMetricOptions = () => {
    return allMetrics
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, id }) => ({
        value: id,
        label: `${name} (${id})`
      }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('account')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTabState === 'account'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Account Settings
          </button>
          <button
            onClick={() => handleTabChange('metrics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTabState === 'metrics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Metric Settings
          </button>
        </nav>
      </div>

      {/* Account Settings Tab */}
      {activeTabState === 'account' && (
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
          
          {accountError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {accountError}
            </div>
          )}
          
          <div className="space-y-4">
            {/* Display Saved Settings */}
            {savedAccountSettings ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-md font-semibold mb-3 text-green-800">Saved API Keys</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">Account Name</label>
                    <div className="text-sm text-green-800 bg-white px-3 py-2 rounded border">
                      {savedAccountSettings.accountName || 'Not set'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">Public API Key</label>
                    <div className="text-sm text-green-800 bg-white px-3 py-2 rounded border font-mono">
                      {savedAccountSettings.publicApiKey || 'Not set'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">Private API Key</label>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-green-800 bg-white px-3 py-2 rounded border font-mono flex-1">
                        {showPrivateKey 
                          ? (savedAccountSettings.privateApiKey || 'Not set')
                          : '••••••••••••••••••••••••••••••••••••••••'
                        }
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        {showPrivateKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  ✅ Your API keys are saved and being used by the dashboard
                </p>
                
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClearConfirmModal(true);
                      setClearConfirmStep('confirm');
                    }}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Clear Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSettings({
                        privateApiKey: savedAccountSettings.privateApiKey || '',
                        publicApiKey: savedAccountSettings.publicApiKey || '',
                        accountName: savedAccountSettings.accountName || ''
                      });
                      setSavedAccountSettings(null);
                    }}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit Settings
                  </button>
                </div>
              </div>
            ) : (
              /* Input fields for new settings */
              <>
                <div>
                  <label className="block font-medium mb-1">Private API Key *</label>
                  <input 
                    type="password" 
                    value={accountSettings.privateApiKey}
                    onChange={(e) => handleAccountChange('privateApiKey', e.target.value)}
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Enter your private API key"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">Required for accessing Klaviyo data</p>
                </div>
                
                <div>
                  <label className="block font-medium mb-1">Public API Key *</label>
                  <input 
                    type="password" 
                    value={accountSettings.publicApiKey}
                    onChange={(e) => handleAccountChange('publicApiKey', e.target.value)}
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Enter your public API key"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">Required for account information</p>
                </div>
                
                <div>
                  <label className="block font-medium mb-1">Account Name</label>
                  <input 
                    type="text" 
                    value={accountSettings.accountName}
                    className="border rounded px-3 py-2 w-full bg-gray-50"
                    placeholder="Will be populated automatically when API keys are saved"
                    readOnly
                  />
                  <p className="text-sm text-gray-500 mt-1">Auto-populated from your Klaviyo account</p>
                </div>
                
                <button 
                  type="button" 
                  onClick={handleSaveAccountSettings}
                  disabled={savingAccount}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingAccount ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Account Settings'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Metric Settings Tab */}
      {activeTabState === 'metrics' && (
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Metric Settings for Summary Cards</h2>
          
          {loadingMetrics ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                </svg>
                <span className="text-gray-600">Loading metrics...</span>
              </div>
            </div>
          ) : allMetrics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No metrics available. Please check your API keys.</p>
              <button
                onClick={loadMetrics}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry Loading Metrics
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Email Metrics Section */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-md font-semibold mb-3 text-gray-700 border-b pb-2">Email Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <SearchableDropdown
                    label="Emails Received"
                    value={metricMapping.received}
                    onChange={(value) => handleChange('received', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
                <div>
                  <SearchableDropdown
                    label="Emails Opened"
                    value={metricMapping.opened}
                    onChange={(value) => handleChange('opened', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
                <div>
                  <SearchableDropdown
                    label="Emails Clicked"
                    value={metricMapping.clicked}
                    onChange={(value) => handleChange('clicked', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
              </div>
            </div>
            
            {/* SMS Metrics Section */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-md font-semibold mb-3 text-gray-700 border-b pb-2">SMS Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <SearchableDropdown
                    label="SMS Received"
                    value={metricMapping.smsReceived}
                    onChange={(value) => handleChange('smsReceived', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
                <div>
                  <SearchableDropdown
                    label="SMS Clicked"
                    value={metricMapping.smsClicked}
                    onChange={(value) => handleChange('smsClicked', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
              </div>
            </div>
            
            {/* Order Metrics Section */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-md font-semibold mb-3 text-gray-700 border-b pb-2">Order Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <SearchableDropdown
                    label="Orders Placed"
                    value={metricMapping.placedOrder}
                    onChange={(value) => handleChange('placedOrder', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
                <div>
                  <SearchableDropdown
                    label="Products Ordered"
                    value={metricMapping.productsOrdered}
                    onChange={(value) => handleChange('productsOrdered', value)}
                    options={getMetricOptions()}
                    placeholder="-- Select Metric --"
                    searchPlaceholder="Search metrics..."
                  />
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Mapping
            </button>
          </form>
          )}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Success!</h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Your account settings have been saved successfully. Your API keys are now being used by the dashboard.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Settings Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            {clearConfirmStep === 'confirm' ? (
              <>
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Clear Account Settings?</h3>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    This will permanently delete your API keys and account settings. You will need to re-enter your API keys to use the dashboard.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAccountSettings}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Clear Settings
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Settings Cleared!</h3>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Your account settings have been cleared successfully. You will need to re-enter your API keys to use the dashboard.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClearConfirmModal(false);
                      setClearConfirmStep('confirm');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 