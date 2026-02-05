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
  const [accountForm, setAccountForm] = useState({
    privateApiKey: '',
    publicApiKey: '',
    accountName: ''
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [metricsAccountId, setMetricsAccountId] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearConfirmStep, setClearConfirmStep] = useState('confirm'); // 'confirm' or 'success'
  
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const accts = await loadAccountSettings();
        if (activeTab === 'metrics' && accts.length > 0) {
          setMetricsAccountId(accts[0].id);
          await loadMetrics(accts[0].id);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error initializing settings:', error);
        setLoading(false);
      }
    };

    initializeSettings();
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTabState(tab);
    if (tab === 'metrics' && savedAccounts.length > 0) {
      const id = metricsAccountId || savedAccounts[0]?.id;
      if (id) {
        setMetricsAccountId(id);
        loadMetrics(id);
      }
    }
  };

  const loadAccountSettings = async () => {
    try {
      const serverResponse = await axios.get('/api/account-settings');
      const accts = serverResponse.data?.accounts || [];
      setSavedAccounts(accts);
      setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: '' });
      setShowAddAccountModal(false);
      setShowEditModal(null);
      return accts;
    } catch (error) {
      console.error('Error loading account settings:', error);
      setSavedAccounts([]);
      return [];
    }
  };

  // Load metrics for selected account
  const loadMetrics = async (accountId = null) => {
    try {
      setLoadingMetrics(true);
      const url = accountId ? `/api/events/metrics?account_id=${encodeURIComponent(accountId)}` : '/api/events/metrics';
      const res = await axios.get(url);
      setAllMetrics((res.data?.allMetrics || []));
      if (accountId) {
        const mapRes = await axios.get(`/api/settings/metric-mapping?account_id=${encodeURIComponent(accountId)}`);
        const m = mapRes.data?.mapping || mapRes.data || {};
        setMetricMapping({
          received: m.received || '',
          opened: m.opened || '',
          clicked: m.clicked || '',
          placedOrder: m.placedOrder || '',
          productsOrdered: m.productsOrdered || '',
          smsReceived: m.smsReceived || '',
          smsClicked: m.smsClicked || '',
        });
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!metricsAccountId) {
      alert('Please select an account first.');
      return;
    }
    try {
      await axios.post('/api/settings/metric-mapping', {
        account_id: metricsAccountId,
        mapping: metricMapping,
      });
      alert('Metric settings saved for this account!');
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

  const setAccountFormField = (field, value) => {
    setAccountForm(prev => ({ ...prev, [field]: value }));
  };

  const handleClearAccountSettings = async () => {
    try {
      await axios.delete('/api/account-settings');
      setSavedAccounts([]);
      setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: '' });
      setShowAddAccountModal(false);
      setShowEditModal(null);
      setClearConfirmStep('success');
    } catch (error) {
      console.error('Error clearing account settings:', error);
      alert('Error clearing account settings. Please try again.');
    }
  };

  const handleAddAccount = async () => {
    if (!accountForm.privateApiKey.trim() || !accountForm.publicApiKey.trim()) {
      setAccountError('Both Private API Key and Public API Key are required.');
      return;
    }
    setSavingAccount(true);
    setAccountError('');
    try {
      const response = await axios.get('/api/account', {
        params: { publicKey: accountForm.publicApiKey, privateKey: accountForm.privateApiKey }
      });
      const orgName = response.data?.data?.attributes?.contact_information?.organization_name || '';
      await axios.post('/api/account-settings', {
        action: 'add',
        account: { privateApiKey: accountForm.privateApiKey, publicApiKey: accountForm.publicApiKey, accountName: orgName }
      });
      setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: '' });
      setShowAddAccountModal(false);
      await loadAccountSettings();
      setShowSuccessModal(true);
    } catch (error) {
      setAccountError(error.response?.data?.error || 'Please check your API keys and try again.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleUpdateAccount = async () => {
    const acc = showEditModal;
    if (!acc) return;
    const newName = accountForm.accountName?.trim();
    const newPrivate = accountForm.privateApiKey?.trim();
    const newPublic = accountForm.publicApiKey?.trim();
    if (!newName && !newPrivate && !newPublic) {
      setShowEditModal(null);
      return;
    }
    setSavingAccount(true);
    setAccountError('');
    try {
      if (newPrivate && newPublic) {
        const response = await axios.get('/api/account', {
          params: { publicKey: newPublic, privateKey: newPrivate }
        });
        const orgName = response.data?.data?.attributes?.contact_information?.organization_name || newName || acc.accountName;
        await axios.post('/api/account-settings', {
          action: 'update',
          account: { id: acc.id, privateApiKey: newPrivate, publicApiKey: newPublic, accountName: orgName }
        });
      } else if (newName !== undefined) {
        await axios.post('/api/account-settings', {
          action: 'update',
          account: { id: acc.id, accountName: newName || acc.accountName }
        });
      }
      setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: '' });
      setShowEditModal(null);
      await loadAccountSettings();
      setShowSuccessModal(true);
    } catch (error) {
      setAccountError(error.response?.data?.error || 'Failed to update account.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('Remove this Klaviyo account? You will need to re-add it to access its data.')) return;
    try {
      await axios.post('/api/account-settings', { action: 'delete', account: { id: accountId } });
      await loadAccountSettings();
      setShowViewModal(prev => prev?.id === accountId ? null : prev);
      setShowEditModal(prev => prev?.id === accountId ? null : prev);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove account.');
    }
  };

  const openEditModal = (acc) => {
    setShowEditModal(acc);
    setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: acc.accountName || '' });
    setAccountError('');
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
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Account Settings</h2>
            <button
              type="button"
              onClick={() => { setShowAddAccountModal(true); setAccountError(''); setAccountForm({ privateApiKey: '', publicApiKey: '', accountName: '' }); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Account
            </button>
          </div>

          {savedAccounts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-4">No Klaviyo accounts connected yet.</p>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add your first account
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Account Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Public API Key</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {savedAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{acc.accountName || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">{acc.publicApiKey ? `${acc.publicApiKey.slice(0, 12)}...` : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setShowViewModal(acc)} className="text-blue-600 hover:underline mr-4">View</button>
                          <button onClick={() => openEditModal(acc)} className="text-blue-600 hover:underline mr-4">Edit</button>
                          <button onClick={() => handleDeleteAccount(acc.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => { setShowClearConfirmModal(true); setClearConfirmStep('confirm'); }}
                className="mt-4 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                Clear all accounts
              </button>
            </>
          )}

          {/* Add Account Modal */}
          {showAddAccountModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Add Klaviyo Account</h3>
                {accountError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{accountError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Private API Key *</label>
                    <input type="password" value={accountForm.privateApiKey} onChange={(e) => setAccountFormField('privateApiKey', e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="pk_..." required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Public API Key *</label>
                    <input type="password" value={accountForm.publicApiKey} onChange={(e) => setAccountFormField('publicApiKey', e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Pe..." required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Account Name</label>
                    <input type="text" value={accountForm.accountName} className="border rounded px-3 py-2 w-full bg-gray-50" placeholder="Auto-filled after validation" readOnly />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => { setShowAddAccountModal(false); setAccountError(''); }} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={handleAddAccount} disabled={savingAccount} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {savingAccount ? 'Adding...' : 'Add Account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Account Modal */}
          {showViewModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Account Details</h3>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-gray-500">Account Name</dt><dd className="font-medium">{showViewModal.accountName || '—'}</dd></div>
                  <div><dt className="text-gray-500">Public API Key</dt><dd className="font-mono break-all">{showViewModal.publicApiKey || '—'}</dd></div>
                </dl>
                <div className="flex justify-end mt-6">
                  <button type="button" onClick={() => setShowViewModal(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Account Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Edit Account</h3>
                {accountError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">{accountError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Account Name</label>
                    <input type="text" value={accountForm.accountName} onChange={(e) => setAccountFormField('accountName', e.target.value)} className="border rounded px-3 py-2 w-full" />
                  </div>
                  <p className="text-xs text-gray-500">To update API keys, enter new values below. Leave blank to keep current.</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">New Private API Key</label>
                    <input type="password" value={accountForm.privateApiKey} onChange={(e) => setAccountFormField('privateApiKey', e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Leave blank to keep" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">New Public API Key</label>
                    <input type="password" value={accountForm.publicApiKey} onChange={(e) => setAccountFormField('publicApiKey', e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="Leave blank to keep" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => { setShowEditModal(null); setAccountError(''); }} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={handleUpdateAccount} disabled={savingAccount} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                    {savingAccount ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metric Settings Tab */}
      {activeTabState === 'metrics' && (
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Metric Settings for Summary Cards</h2>
          
          {savedAccounts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Add at least one Klaviyo account in Account Settings first.</p>
            </div>
          ) : (
          <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select account to configure metrics</label>
            <select
              value={metricsAccountId || savedAccounts[0]?.id || ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setMetricsAccountId(id);
                if (id) loadMetrics(id);
              }}
              className="border border-gray-300 rounded-lg px-4 py-2 min-w-[240px]"
            >
              {savedAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.accountName || acc.publicApiKey || acc.id}</option>
              ))}
            </select>
          </div>
          
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
              Save Mapping for {savedAccounts.find(a => a.id === metricsAccountId)?.accountName || 'Account'}
            </button>
          </form>
          )}
          </>
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