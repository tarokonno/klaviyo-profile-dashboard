import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableDropdown from './SearchableDropdown';

export default function ActivityLog({ profile, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEventIndex, setExpandedEventIndex] = useState(null);
  const [eventNameFilter, setEventNameFilter] = useState('');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [metricMap, setMetricMap] = useState({});
  const [isClosing, setIsClosing] = useState(false);
  const [profileStats, setProfileStats] = useState({
    lastReceived: '',
    lastOpened: '',
    lastClicked: '',
    lastOrderPlaced: '',
    lastReceivedCount: 0,
    lastOpenedCount: 0,
    lastClickedCount: 0,
    lastOrderPlacedCount: 0,
    lastOrderPlacedValue: 0,
    lastReceivedCampaignName: '',
    lastOrderPlacedName: '',
    lastOrderPlacedItems: '',
    // SMS stats
    lastSMSReceived: '',
    lastSMSClicked: '',
    lastSMSReceivedCount: 0,
    lastSMSClickedCount: 0,
    lastSMSReceivedCampaignName: '',
    loading: true,
    hasMappings: false
  });

  useEffect(() => {
    if (!profile || !profile.id) return;
    
    // Reset loading state when profile changes
    setLoading(true);
    setError('');
    
    const loadEvents = async () => {
      try {
        let url = `/api/events?profile_id=${profile.id}&page_size=50`;
        if (profile.accountId) url += `&account_id=${encodeURIComponent(profile.accountId)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.error('Error loading events:', data.error);
          setError(data.error);
          setLoading(false);
          return;
        }
        
        const allEvents = data.data || [];
        const allIncluded = data.included || [];
        
        setEvents(allEvents);
        setLoading(false);
        
        // Build metric map
        const map = {};
        (allIncluded || []).forEach(m => {
          if (m.type === 'metric' && m.id && m.attributes && m.attributes.name) {
            map[m.id] = m.attributes.name;
          }
        });
        setMetricMap(map);
      } catch (error) {
        console.error('Error loading events:', error);
        setLoading(false);
        setError('Failed to load events');
      }
    };
    
    loadEvents();
  }, [profile]);
  
  useEffect(() => {
    if (!profile || !profile.id) return;
    
    // Reset loading state when profile changes
    setProfileStats(prev => ({ ...prev, loading: true, error: '' }));
    
    const loadProfileStats = async () => {
      try {
        // Load metric mapping for this profile's account
        const mappingUrl = profile.accountId
          ? `/api/settings/metric-mapping?account_id=${encodeURIComponent(profile.accountId)}`
          : '/api/settings/metric-mapping';
        const mappingResponse = await fetch(mappingUrl);
        let mapping = {};
        
        if (mappingResponse.ok) {
          const mappingData = await mappingResponse.json();
          mapping = mappingData.mapping || (profile.accountId ? mappingData.byAccount?.[profile.accountId] : mappingData.byAccount?.__default__) || {};
        } else {
          // If no mapping exists, use empty object (will be filled with defaults)
          console.log('No metric mapping found, using defaults');
        }
        
        // Set default mappings if none exist
        const hasAnyMappings = Object.values(mapping).some(val => val);
        
        if (!hasAnyMappings) {
          // Set default mappings
          mapping.received = 'JhfQMM'; // Received Email
          mapping.opened = 'QhyxVR';   // Opened Email
          mapping.clicked = 'KxhW33';  // Clicked Email
          mapping.placedOrder = 'PhqdJM'; // Placed Order
          mapping.smsReceived = 'JhfQMM'; // SMS Received (using email metric for now)
          mapping.smsClicked = 'KxhW33';  // SMS Clicked (using email metric for now)
        }
        
        // Update hasMappings flag
        const finalHasMappings = Object.values(mapping).some(val => val);
        
        const stats = {
          lastReceived: '',
          lastReceivedCount: 0,
          lastReceivedCampaignName: '',
          lastOpened: '',
          lastOpenedCount: 0,
          lastClicked: '',
          lastClickedCount: 0,
          lastOrderPlaced: '',
          lastOrderPlacedCount: 0,
          lastOrderPlacedName: '',
          lastOrderPlacedItems: '',
          lastOrderPlacedValue: '',
          lastSMSReceived: '',
          lastSMSReceivedCount: 0,
          lastSMSReceivedCampaignName: '',
          lastSMSClicked: '',
          lastSMSClickedCount: 0
        };
        
        // Load events for each mapped metric ID separately.
        // Metric IDs are account-specific - if a metric doesn't exist in an account (e.g. TK shopify vs DEMO),
        // Klaviyo returns 400. We treat errors as "no events" rather than failing the whole load.
        const eventsByMetric = {};
        const accountParam = profile.accountId ? `&account_id=${encodeURIComponent(profile.accountId)}` : '';

        const fetchEventsForMetric = async (metricId) => {
          try {
            const res = await fetch(`/api/events?profile_id=${profile.id}&metric_id=${metricId}&page_size=10${accountParam}`);
            const data = await res.json();
            if (data.error || !res.ok) {
              console.warn(`Metric ${metricId} not available for this account:`, data.error || res.status);
              return [];
            }
            return data.data || [];
          } catch (e) {
            console.warn(`Error fetching events for metric ${metricId}:`, e);
            return [];
          }
        };

        if (mapping.received) eventsByMetric[mapping.received] = await fetchEventsForMetric(mapping.received);
        if (mapping.opened) eventsByMetric[mapping.opened] = await fetchEventsForMetric(mapping.opened);
        if (mapping.clicked) eventsByMetric[mapping.clicked] = await fetchEventsForMetric(mapping.clicked);
        if (mapping.placedOrder) eventsByMetric[mapping.placedOrder] = await fetchEventsForMetric(mapping.placedOrder);
        if (mapping.smsReceived) eventsByMetric[mapping.smsReceived] = await fetchEventsForMetric(mapping.smsReceived);
        if (mapping.smsClicked) eventsByMetric[mapping.smsClicked] = await fetchEventsForMetric(mapping.smsClicked);
        
        // Get stats for each metric type
        if (mapping.received && eventsByMetric[mapping.received]) {
          const events = eventsByMetric[mapping.received];
          if (events.length > 0) {
            const latestEvent = events[0]; // Events are sorted by date desc
            stats.lastReceived = latestEvent.attributes?.datetime || '';
            stats.lastReceivedCount = events.length;
            
            // Try to get campaign name
            if (latestEvent.attributes?.event_properties) {
              stats.lastReceivedCampaignName = latestEvent.attributes.event_properties['Campaign Name'] || 
                                            latestEvent.attributes.event_properties['campaign_name'] || 
                                            latestEvent.attributes.event_properties['campaign'] ||
                                            latestEvent.attributes.event_properties['Campaign'] ||
                                            latestEvent.attributes.event_properties['Email Campaign'] ||
                                            latestEvent.attributes.event_properties['email_campaign'] ||
                                            latestEvent.attributes.event_properties['Email Name'] ||
                                            latestEvent.attributes.event_properties['email_name'] ||
                                            latestEvent.attributes.event_properties['Subject'] || 'N/A';
            }
          }
        }
        
        if (mapping.opened && eventsByMetric[mapping.opened]) {
          const events = eventsByMetric[mapping.opened];
          if (events.length > 0) {
            stats.lastOpened = events[0].attributes?.datetime || '';
            stats.lastOpenedCount = events.length;
          }
        }
        
        if (mapping.clicked && eventsByMetric[mapping.clicked]) {
          const events = eventsByMetric[mapping.clicked];
          if (events.length > 0) {
            stats.lastClicked = events[0].attributes?.datetime || '';
            stats.lastClickedCount = events.length;
          }
        }
        
        if (mapping.placedOrder && eventsByMetric[mapping.placedOrder]) {
          const events = eventsByMetric[mapping.placedOrder];
          if (events.length > 0) {
            const latestEvent = events[0];
            stats.lastOrderPlaced = latestEvent.attributes?.datetime || '';
            stats.lastOrderPlacedCount = events.length;
            
            // Try to get order details
            if (latestEvent.attributes?.event_properties) {
              stats.lastOrderPlacedName = latestEvent.attributes.event_properties['Order Name'] || 
                                        latestEvent.attributes.event_properties['order_name'] || 
                                        latestEvent.attributes.event_properties['order'] ||
                                        latestEvent.attributes.event_properties['Order'] ||
                                        latestEvent.attributes.event_properties['Order ID'] ||
                                        latestEvent.attributes.event_properties['order_id'] || 'N/A';
              
              // Try to get product details
              const items = latestEvent.attributes.event_properties['Items'] || 
                           latestEvent.attributes.event_properties['items'] ||
                           latestEvent.attributes.event_properties['Products'] ||
                           latestEvent.attributes.event_properties['products'] ||
                           latestEvent.attributes.event_properties['$extra']?.line_items?.map(item => item.title) || [];
              
              if (Array.isArray(items) && items.length > 0) {
                stats.lastOrderPlacedItems = items.join(', ');
              } else if (typeof items === 'string') {
                stats.lastOrderPlacedItems = items;
              } else {
                stats.lastOrderPlacedItems = 'N/A';
              }
              
              // Try to get order value
              stats.lastOrderPlacedValue = latestEvent.attributes.event_properties['$value'] || 
                                         latestEvent.attributes.event_properties['value'] ||
                                         latestEvent.attributes.event_properties['Order Value'] ||
                                         latestEvent.attributes.event_properties['order_value'] || 'N/A';
            }
          }
        }
        
        if (mapping.smsReceived && eventsByMetric[mapping.smsReceived]) {
          const events = eventsByMetric[mapping.smsReceived];
          if (events.length > 0) {
            const latestEvent = events[0];
            stats.lastSMSReceived = latestEvent.attributes?.datetime || '';
            stats.lastSMSReceivedCount = events.length;
            
            // Try to get campaign name
            if (latestEvent.attributes?.event_properties) {
              stats.lastSMSReceivedCampaignName = latestEvent.attributes.event_properties['Message Name'] || 
                                                latestEvent.attributes.event_properties['message_name'] || 
                                                latestEvent.attributes.event_properties['Message'] ||
                                                latestEvent.attributes.event_properties['message'] ||
                                                latestEvent.attributes.event_properties['SMS Name'] ||
                                                latestEvent.attributes.event_properties['sms_name'] ||
                                                latestEvent.attributes.event_properties['Campaign Name'] || 
                                                latestEvent.attributes.event_properties['campaign_name'] || 'N/A';
            }
          }
        }
        
        if (mapping.smsClicked && eventsByMetric[mapping.smsClicked]) {
          const events = eventsByMetric[mapping.smsClicked];
          if (events.length > 0) {
            stats.lastSMSClicked = events[0].attributes?.datetime || '';
            stats.lastSMSClickedCount = events.length;
          }
        }
        
        setProfileStats({
          ...stats,
          hasMappings: finalHasMappings,
          loading: false
        });
      } catch (error) {
        console.error('Error loading profile stats:', error);
        setProfileStats(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load profile stats'
        }));
      }
    };
    
    loadProfileStats();
  }, [profile]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const formatDateDDMMMYYYYTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return 'N/A';
    const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date}, ${time}`;
  };

  // Filter events
  let filteredEvents = events;
  
  if (eventNameFilter) {
    filteredEvents = filteredEvents.filter(e => {
      const metricId = e.relationships?.metric?.data?.id || e.metric_id;
      return metricId === eventNameFilter;
    });
  }
  if (eventDateFrom) {
    filteredEvents = filteredEvents.filter(e => {
      const eventDate = e.attributes?.datetime || e.datetime || e.timestamp;
      if (!eventDate) return false;
      const eventDateObj = new Date(eventDate);
      const filterDateObj = new Date(eventDateFrom);
      return eventDateObj >= filterDateObj;
    });
  }
  if (eventDateTo) {
    filteredEvents = filteredEvents.filter(e => {
      const eventDate = e.attributes?.datetime || e.datetime || e.timestamp;
      if (!eventDate) return false;
      const eventDateObj = new Date(eventDate);
      const filterDateObj = new Date(eventDateTo);
      // Set the filter date to end of day for inclusive comparison
      filterDateObj.setHours(23, 59, 59, 999);
      return eventDateObj <= filterDateObj;
    });
  }

  const totalEvents = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
  const pagedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const clearFilters = () => {
    setEventNameFilter('');
    setEventDateFrom('');
    setEventDateTo('');
    setCurrentPage(1);
    setExpandedEventIndex(null);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match the animation duration
  };

  // Convert metric map to dropdown options format
  const getMetricOptions = () => {
    return Object.entries(metricMap)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({
        value: id,
        label: `${name} (${id})`
      }));
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-40 animate-fade-in"
        onClick={handleClose}
      />
      
      {/* Side Panel */}
      <aside className={`fixed top-0 right-0 w-full md:w-1/2 h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Activity Log</h2>
          </div>
          <div className="flex flex-col items-end text-sm">
            {profile.accountName && (
              <span className="text-gray-500 mb-1">Account: {profile.accountName}</span>
            )}
            <span className="text-gray-500">{profile.email}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Email Summary Card */}
            <div className="rounded-lg shadow flex flex-col items-center min-h-[200px]" style={{ background: '#2563eb' }}>
              <div className="w-full rounded-t-lg py-2 px-4 text-lg font-bold text-white text-center" style={{ background: '#2563eb' }}>
                Email
              </div>
              <div className="bg-white w-full flex-1 rounded-b-lg p-4 flex flex-col items-center">
                {profileStats.loading ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                    </svg>
                    <span className="text-gray-500">Loading...</span>
                  </div>
                ) : profileStats.error ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-500 text-center text-sm">API Error</span>
                    <span className="text-red-400 text-center text-xs">{profileStats.error}</span>
                  </div>
                ) : !profileStats.hasMappings ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-500 text-center text-sm">No email metrics found</span>
                    <span className="text-gray-400 text-center text-xs">Check Settings to configure metrics</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center w-full border-b border-gray-200 pb-4 mb-4">
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Received:</span>
                        <span>{profileStats.lastReceivedCount}</span>
                      </div>
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Opened:</span>
                        <span>{profileStats.lastOpenedCount}</span>
                      </div>
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Clicked:</span>
                        <span>{profileStats.lastClickedCount}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center w-full">
                      <div className="flex flex-row justify-between w-full mb-2 items-center">
                        <span className="font-semibold text-gray-700">Last Campaign:</span>
                        <span>
                          {profileStats.lastReceived ? (
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono border border-blue-200">
                              {formatDateDDMMMYYYYTime(profileStats.lastReceived)}
                            </span>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex flex-row w-full mb-2">
                        <span className="text-gray-800 text-sm w-full text-left font-mono truncate">
                          {profileStats.lastReceivedCampaignName || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SMS Summary Card */}
            <div className="rounded-lg shadow flex flex-col items-center min-h-[200px]" style={{ background: '#059669' }}>
              <div className="w-full rounded-t-lg py-2 px-4 text-lg font-bold text-white text-center" style={{ background: '#059669' }}>
                SMS
              </div>
              <div className="bg-white w-full flex-1 rounded-b-lg p-4 flex flex-col items-center">
                {profileStats.loading ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="animate-spin h-8 w-8 text-green-600 mb-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                    </svg>
                    <span className="text-gray-500">Loading...</span>
                  </div>
                ) : profileStats.error ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-500 text-center text-sm">API Error</span>
                    <span className="text-red-400 text-center text-xs">{profileStats.error}</span>
                  </div>
                ) : !profileStats.hasMappings ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-500 text-center text-sm">No SMS metrics found</span>
                    <span className="text-gray-400 text-center text-xs">Check Settings to configure metrics</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center w-full border-b border-gray-200 pb-4 mb-4">
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Received:</span>
                        <span>{profileStats.lastSMSReceivedCount}</span>
                      </div>
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Clicked:</span>
                        <span>{profileStats.lastSMSClickedCount}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center w-full">
                      <div className="flex flex-row justify-between w-full mb-2 items-center">
                        <span className="font-semibold text-gray-700">Last Campaign:</span>
                        <span>
                          {profileStats.lastSMSReceived ? (
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-mono border border-green-200">
                              {formatDateDDMMMYYYYTime(profileStats.lastSMSReceived)}
                            </span>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex flex-row w-full mb-2">
                        <span className="text-gray-800 text-sm w-full text-left font-mono truncate">
                          {profileStats.lastSMSReceivedCampaignName || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Orders Summary Card */}
            <div className="rounded-lg shadow flex flex-col items-center min-h-[200px]" style={{ background: '#2563eb' }}>
              <div className="w-full rounded-t-lg py-2 px-4 text-lg font-bold text-white text-center" style={{ background: '#2563eb' }}>
                Orders
              </div>
              <div className="bg-white w-full flex-1 rounded-b-lg p-4 flex flex-col items-center">
                {profileStats.loading ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                    </svg>
                    <span className="text-gray-500">Loading...</span>
                  </div>
                ) : profileStats.error ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-500 text-center text-sm">API Error</span>
                    <span className="text-red-400 text-center text-xs">{profileStats.error}</span>
                  </div>
                ) : !profileStats.hasMappings ? (
                  <div className="flex flex-col items-center justify-center h-24">
                    <svg className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-500 text-center text-sm">No order metrics found</span>
                    <span className="text-gray-400 text-center text-xs">Check Settings to configure metrics</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center w-full border-b border-gray-200 pb-4 mb-4">
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Total Order Count:</span>
                        <span>{profileStats.lastOrderPlacedCount}</span>
                      </div>
                      <div className="flex flex-row justify-between w-full mb-2">
                        <span className="font-semibold text-gray-700">Total Order Value:</span>
                        <span>
                          {typeof profileStats.lastOrderPlacedValue === 'number' 
                            ? profileStats.lastOrderPlacedValue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
                            : '$0.00'
                          }
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center w-full">
                      <div className="flex flex-row justify-between w-full mb-2 items-center">
                        <span className="font-semibold text-gray-700">Last Order:</span>
                        <span>
                          {profileStats.lastOrderPlaced ? (
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono border border-blue-200">
                              {formatDateDDMMMYYYYTime(profileStats.lastOrderPlaced)}
                            </span>
                          ) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex flex-row w-full mb-2 flex-wrap gap-1">
                        {profileStats.lastOrderPlacedItems && Array.isArray(profileStats.lastOrderPlacedItems) && profileStats.lastOrderPlacedItems.length > 0
                          ? profileStats.lastOrderPlacedItems.map((item, idx) => (
                              <span key={idx} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono border border-blue-200">
                                {item}
                              </span>
                            ))
                          : (typeof profileStats.lastOrderPlacedItems === 'string' && profileStats.lastOrderPlacedItems && profileStats.lastOrderPlacedItems !== 'N/A'
                            ? <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono border border-blue-200">
                                {profileStats.lastOrderPlacedItems}
                              </span>
                            : <span className="text-gray-400">N/A</span>)
                        }
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-2">All Activities</h3>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-48">
              <SearchableDropdown
                label="Event Name"
                value={eventNameFilter}
                onChange={setEventNameFilter}
                options={[
                  { value: '', label: 'All' },
                  ...getMetricOptions()
                ]}
                placeholder="All"
                searchPlaceholder="Search events..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">From</label>
              <input 
                type="date" 
                value={eventDateFrom}
                onChange={(e) => setEventDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">To</label>
              <input 
                type="date" 
                value={eventDateTo}
                onChange={(e) => setEventDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Page Size</label>
              <select 
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <button 
              onClick={clearFilters}
              className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Clear
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg shadow mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48">
                <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <circle className="opacity-75" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="15" fill="none" />
                </svg>
                <div className="text-blue-700 font-medium">Loading events...</div>
              </div>
            ) : (
              <table className="min-w-full bg-white divide-y divide-gray-200 rounded-lg shadow-lg">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Event Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {pagedEvents.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-gray-400">No events found</td>
                    </tr>
                  ) : (
                    pagedEvents.map((event, i) => (
                      <React.Fragment key={i}>
                        <tr 
                          className="hover:bg-blue-50 transition cursor-pointer"
                          onClick={() => setExpandedEventIndex(expandedEventIndex === i ? null : i)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center gap-2">
                            <button className="focus:outline-none" style={{ background: 'none', border: 'none', padding: 0, marginRight: '6px' }}>
                              {expandedEventIndex === i ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                                </svg>
                              )}
                            </button>
                            {(() => {
                              const metricId = event.relationships?.metric?.data?.id || event.metric_id;
                              const metricName = metricMap[metricId] || event.metricName || event.name || event.metricId || 'Unknown Event';
                              return metricName;
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {event.attributes && event.attributes.datetime 
                              ? new Date(event.attributes.datetime).toLocaleString() 
                              : (event.datetime 
                                ? new Date(event.datetime).toLocaleString() 
                                : (event.timestamp 
                                  ? new Date(event.timestamp).toLocaleString() 
                                  : ''))
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right"></td>
                        </tr>
                        {expandedEventIndex === i && (
                          <tr className="expanded-row">
                            <td colSpan="3" className="bg-blue-50 px-8 py-4 text-sm text-gray-800">
                              <div className="mb-2">
                                <span className="font-semibold text-gray-700">Datetime:</span> {
                                  event.attributes && event.attributes.datetime 
                                    ? new Date(event.attributes.datetime).toLocaleString() 
                                    : 'N/A'
                                }
                              </div>
                              <div className="mb-2">
                                <span className="font-semibold text-gray-700">Event Properties:</span>
                                <div>
                                  {(() => {
                                    const props = event.attributes?.event_properties || event.event_properties || event.properties || {};
                                    if (!props || Object.keys(props).length === 0) {
                                      return <span className="text-gray-500 ml-2">No event properties</span>;
                                    }
                                    
                                    const alwaysTopLevel = ['$event_id', '$value', 'datetime'];
                                    let topLevel = [];
                                    let objects = [];
                                    
                                    for (const [k, v] of Object.entries(props)) {
                                      if (alwaysTopLevel.includes(k)) {
                                        topLevel.push([k, v]);
                                      } else if (Array.isArray(v) || v === null || ['string','number','boolean'].includes(typeof v)) {
                                        topLevel.push([k, v]);
                                      } else if (typeof v === 'object') {
                                        objects.push([k, v]);
                                      }
                                    }
                                    
                                    return (
                                      <div>
                                        {topLevel.length > 0 && (
                                          <ul className="ml-2 mt-1 space-y-1">
                                            {topLevel.map(([k, v]) => (
                                              <li key={k}>
                                                <span className="font-mono text-blue-700">{k}</span>: <span className="text-gray-800">
                                                  {v === null ? 'null' : Array.isArray(v) ? JSON.stringify(v) : v}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        {objects.length > 0 && (
                                          <ul className="ml-2 mt-1 space-y-1">
                                            {objects.map(([k, v], objIdx) => (
                                              <li key={k} className="relative">
                                                <span className="font-mono text-blue-700 ml-4">{k}</span>:
                                                <div className="bg-gray-100 rounded p-4 overflow-x-auto text-xs mt-1 ml-4">
                                                  {JSON.stringify(v, null, 2)}
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 mb-2 gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
              <label className="text-sm font-medium text-gray-700">Page Size</label>
              <select 
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="mx-2 text-gray-700">
                Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
              </span>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || pagedEvents.length === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
} 