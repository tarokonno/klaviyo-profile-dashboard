import { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Settings from '../components/Settings';
import ActivityLog from '../components/ActivityLog';

export default function Dashboard() {
  // State management
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [totalProfiles, setTotalProfiles] = useState(null);
  const [currentCursor, setCurrentCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [metricMapping, setMetricMapping] = useState({
    received: null,
    opened: null,
    clicked: null,
    placedOrder: null,
  });
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [accountCursors, setAccountCursors] = useState({});
  const [accountNextCursors, setAccountNextCursors] = useState({});
  const [multiAccountCursorStack, setMultiAccountCursorStack] = useState([]);

  // Navigation state
  const [currentView, setCurrentView] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('account');

  // Load metric mapping from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('metricMapping');
      if (saved) {
        setMetricMapping(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading metric mapping:', error);
    }
  }, []);

  // Load accounts and default to all selected
  useEffect(() => {
    axios.get('/api/account-settings')
      .then(res => {
        const accts = res.data?.accounts || [];
        setAccounts(accts);
        if (accts.length > 0 && selectedAccountIds.length === 0) {
          setSelectedAccountIds(accts.map(a => a.id));
        }
      })
      .catch(() => setAccounts([]));
  }, [currentView]);

  // Fetch profiles function - supports single or multi-account
  const fetchProfilesPage = async ({ page_size = 25, page_cursor = null, cursors = null, search = '' } = {}) => {
    const ids = selectedAccountIds;
    if (ids.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (ids.length === 1) {
        // Single account - use existing logic
        let url = `/api/profiles?page_size=${page_size}`;
        url += `&account_id=${encodeURIComponent(ids[0])}`;
        if (page_cursor) url += `&page_cursor=${encodeURIComponent(page_cursor)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        url += '&additional-fields[profile]=subscriptions,predictive_analytics';

        const res = await axios.get(url);
        const data = res.data;

        const processedProfiles = (data.data || []).map(profile => {
          const pa = profile.attributes?.predictive_analytics || {};
          return {
            id: profile.id,
            email: profile.attributes?.email,
            phone_number: profile.attributes?.phone_number || '',
            subscriptions: profile.attributes?.subscriptions,
            totalValue: pa.historic_clv || null,
            totalOrders: pa.historic_number_of_orders || null,
            accountId: profile._accountId || ids[0],
            accountName: profile._accountName || null,
          };
        });

        setProfiles(processedProfiles);
        setNextCursor(data.nextCursor || null);
        setAccountNextCursors({ [ids[0]]: data.nextCursor || null });
        setTotalProfiles(data.total || null);
      } else {
        // Multi-account - fetch from each in parallel and merge
        const perAccountSize = Math.max(10, Math.ceil(page_size / ids.length));
        const fetches = ids.map(accId => {
          const cursor = cursors?.[accId] || page_cursor;
          let url = `/api/profiles?page_size=${perAccountSize}&account_id=${encodeURIComponent(accId)}`;
          if (cursor) url += `&page_cursor=${encodeURIComponent(cursor)}`;
          if (search) url += `&search=${encodeURIComponent(search)}`;
          url += '&additional-fields[profile]=subscriptions,predictive_analytics';
          return axios.get(url).then(r => ({ accountId: accId, data: r.data }));
        });

        const results = await Promise.all(fetches);
        const nextCursors = {};
        let total = 0;
        const allProfiles = [];

        results.forEach(({ accountId, data }) => {
          nextCursors[accountId] = data.nextCursor || null;
          total += data.total || 0;
          const account = accounts.find(a => a.id === accountId);
          const accountName = account?.accountName || account?.publicApiKey || accountId;
          (data.data || []).forEach(profile => {
            const pa = profile.attributes?.predictive_analytics || {};
            allProfiles.push({
              id: profile.id,
              email: profile.attributes?.email,
              phone_number: profile.attributes?.phone_number || '',
              subscriptions: profile.attributes?.subscriptions,
              totalValue: pa.historic_clv || null,
              totalOrders: pa.historic_number_of_orders || null,
              accountId,
              accountName,
            });
          });
        });

        // Sort merged profiles by email
        allProfiles.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

        setProfiles(allProfiles);
        setAccountNextCursors(nextCursors);
        setNextCursor(Object.values(nextCursors).some(c => c) ? 'multi' : null);
        setTotalProfiles(total);
      }

      setLoading(false);
      setErrorMsg('');
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to load profiles');
    }
  };

  // Initial load and when accounts selection changes
  useEffect(() => {
    if (currentView === 'dashboard' && selectedAccountIds.length > 0) {
      const cursors = selectedAccountIds.length > 1 ? accountCursors : null;
      fetchProfilesPage({ page_size: pageSize, cursors, page_cursor: selectedAccountIds.length === 1 ? currentCursor : null });
    }
  }, [currentView, selectedAccountIds, accounts.length]);

  const ids = selectedAccountIds;
  const isMultiAccount = ids.length > 1;
  const hasNextPage = isMultiAccount ? Object.values(accountNextCursors).some(c => c) : !!nextCursor;
  const hasPrevPage = isMultiAccount ? multiAccountCursorStack.length > 0 : cursorStack.length > 0;

  // Search handler
  const handleSearch = () => {
    setCursorStack([]);
    setMultiAccountCursorStack([]);
    setCurrentCursor(null);
    setAccountCursors({});
    setCurrentPage(1);
    fetchProfilesPage({ page_size: pageSize, search: searchQuery });
  };

  // Clear handler
  const handleClear = () => {
    setSearchQuery('');
    setPageSize(25);
    setCurrentPage(1);
    setCursorStack([]);
    setMultiAccountCursorStack([]);
    setCurrentCursor(null);
    setAccountCursors({});
    fetchProfilesPage({ page_size: 25, page_cursor: null, search: '' });
  };

  // Pagination handlers
  const goToNextPage = () => {
    if (isMultiAccount) {
      if (!Object.values(accountNextCursors).some(c => c)) return;
      setMultiAccountCursorStack([...multiAccountCursorStack, { ...accountCursors }]);
      setAccountCursors(accountNextCursors);
      setCurrentPage(currentPage + 1);
      fetchProfilesPage({ page_size: pageSize, cursors: accountNextCursors, search: searchQuery });
    } else {
      if (!nextCursor) return;
      const newStack = [...cursorStack, currentCursor];
      setCursorStack(newStack);
      setCurrentCursor(nextCursor);
      setCurrentPage(currentPage + 1);
      fetchProfilesPage({ page_size: pageSize, page_cursor: nextCursor, search: searchQuery });
    }
  };

  const goToPrevPage = () => {
    if (isMultiAccount) {
      if (multiAccountCursorStack.length === 0) return;
      const newStack = [...multiAccountCursorStack];
      const prevCursors = newStack.pop();
      setMultiAccountCursorStack(newStack);
      setAccountCursors(prevCursors);
      setCurrentPage(currentPage - 1);
      fetchProfilesPage({ page_size: pageSize, cursors: prevCursors, search: searchQuery });
    } else {
      if (cursorStack.length === 0) return;
      const newStack = [...cursorStack];
      const prevCursor = newStack.pop();
      setCursorStack(newStack);
      setCurrentCursor(prevCursor);
      setCurrentPage(currentPage - 1);
      fetchProfilesPage({ page_size: pageSize, page_cursor: prevCursor, search: searchQuery });
    }
  };

  // Page size handler
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setCursorStack([]);
    setMultiAccountCursorStack([]);
    setAccountCursors({});
    fetchProfilesPage({ page_size: newSize, search: searchQuery });
  };

  const toggleAccountSelection = (accountId) => {
    setSelectedAccountIds(prev => {
      const next = prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId];
      return next;
    });
    setCursorStack([]);
    setMultiAccountCursorStack([]);
    setAccountCursors({});
    setCurrentPage(1);
  };

  // Get consent status and badge class
  const getConsentStatus = (profile) => {
    let consent = profile.subscriptions && profile.subscriptions.email && profile.subscriptions.email.marketing && profile.subscriptions.email.marketing.consent
      ? profile.subscriptions.email.marketing.consent
      : 'Unknown';
    
    const suppression = profile.subscriptions && profile.subscriptions.email && profile.subscriptions.email.marketing && profile.subscriptions.email.marketing.suppression;
    if (
      suppression && (
        (Array.isArray(suppression) && suppression.some(s => s && s.reason === 'USER_SUPPRESSED')) ||
        (!Array.isArray(suppression) && suppression.reason === 'USER_SUPPRESSED')
      )
    ) {
      consent = 'SUPPRESSED';
    }
    
    let badgeClass = 'bg-gray-100 text-gray-800';
    if (consent === 'SUBSCRIBED') badgeClass = 'bg-green-100 text-green-800';
    else if (consent === 'UNSUBSCRIBED' || consent === 'SUPPRESSED' || consent === 'Suppressed') badgeClass = 'bg-red-100 text-red-800';
    else if (consent === 'NEVER_SUBSCRIBED') badgeClass = 'bg-yellow-100 text-yellow-800';
    else if (consent === 'PENDING') badgeClass = 'bg-blue-100 text-blue-800';
    
    return { consent, badgeClass };
  };

  const getSMSConsentStatus = (profile) => {
    const smsConsent = profile.subscriptions && profile.subscriptions.sms && profile.subscriptions.sms.marketing && profile.subscriptions.sms.marketing.consent
      ? profile.subscriptions.sms.marketing.consent
      : 'Unknown';
    
    let smsBadgeClass = 'bg-gray-100 text-gray-800';
    if (smsConsent === 'SUBSCRIBED') smsBadgeClass = 'bg-green-100 text-green-800';
    else if (smsConsent === 'UNSUBSCRIBED' || smsConsent === 'SUPPRESSED') smsBadgeClass = 'bg-red-100 text-red-800';
    else if (smsConsent === 'NEVER_SUBSCRIBED') smsBadgeClass = 'bg-yellow-100 text-yellow-800';
    else if (smsConsent === 'PENDING') smsBadgeClass = 'bg-blue-100 text-blue-800';
    
    return { smsConsent, smsBadgeClass };
  };

  // Navigation handler
  const handleNavigate = (view, tab = null) => {
    setCurrentView(view);
    if (tab) {
      setSettingsTab(tab);
    }
  };

  // Render settings view
  if (currentView === 'settings') {
    return (
      <div>
        <Header currentPage="settings" onNavigate={handleNavigate} />
        <Settings 
          onBack={() => handleNavigate('dashboard')} 
          activeTab={settingsTab} 
        />
      </div>
    );
  }

  // Render dashboard view
  return (
    <div>
      <Header currentPage="dashboard" onNavigate={handleNavigate} />
      
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Search Section */}
        <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-2 w-full">
            {accounts.length > 1 && (
              <div className="flex flex-wrap items-center gap-3 mb-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Accounts</span>
                <div className="flex flex-wrap gap-4">
                  {accounts.map(acc => (
                    <label key={acc.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(acc.id)}
                        onChange={() => toggleAccountSelection(acc.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{acc.accountName || acc.publicApiKey || acc.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full">
              <div className="flex gap-2 items-center w-full sm:w-auto">
                <input 
                  type="text" 
                  className="border rounded px-3 py-2 w-64" 
                  placeholder="Search by exact email address" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSearch();
                    }
                  }}
                  disabled={loading}
                />
                <button 
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-3 py-2 bg-blue-600 text-white rounded"
                >
                  Search
                </button>
                <button 
                  onClick={handleClear}
                  className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded"
                >
                  Clear
                </button>
              </div>
              <div className="flex gap-2 items-center justify-end w-full sm:w-auto mt-2 sm:mt-0">
                <label htmlFor="page-size-select" className="text-sm font-medium text-gray-700">Page Size</label>
                <select 
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <button 
                  onClick={goToPrevPage}
                  disabled={!hasPrevPage || loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="mx-2 text-gray-700">Page <span className="font-semibold">{currentPage}</span></span>
                <button 
                  onClick={goToNextPage}
                  disabled={!hasNextPage || loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg shadow-lg bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-50">
              <tr>
                {(accounts.length > 1 || ids.length > 1) && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Account</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SMS Consent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email Consent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Orders</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Activity Log</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={(accounts.length > 1 || ids.length > 1) ? 8 : 7} className="py-16">
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                      </svg>
                    </div>
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={(accounts.length > 1 || ids.length > 1) ? 8 : 7} className="py-16 text-center text-red-600">{errorMsg}</td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={(accounts.length > 1 || ids.length > 1) ? 8 : 7} className="py-16 text-center text-gray-400">No profiles found</td>
                </tr>
              ) : (
                profiles.map((profile, idx) => {
                  const { consent, badgeClass } = getConsentStatus(profile);
                  const { smsConsent, smsBadgeClass } = getSMSConsentStatus(profile);
                  
                  return (
                    <tr key={`${profile.accountId}-${profile.id}`} className="hover:bg-blue-50 transition">
                      {(accounts.length > 1 || ids.length > 1) && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {profile.accountName || '—'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a 
                          href={`https://www.klaviyo.com/profile/${profile.id}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 hover:underline"
                        >
                          {profile.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {profile.phone_number || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${smsBadgeClass}`}>
                          {smsConsent}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                          {consent}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {profile.totalValue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {profile.totalOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => {
                            setSelectedProfile(profile);
                            setShowActivityLog(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                        >
                          View log 
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 ml-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Conditionally render ActivityLog as slide-out modal */}
        {showActivityLog && selectedProfile && (
          <ActivityLog profile={selectedProfile} onClose={() => setShowActivityLog(false)} />
        )}
      </div>
    </div>
  );
} 