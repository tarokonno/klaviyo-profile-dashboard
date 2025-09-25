import { useState } from 'react';

export default function Header({ currentPage, onNavigate }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">Klaviyo Profile Dashboard</h1>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-8">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                currentPage === 'dashboard'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onNavigate('settings', 'account')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                currentPage === 'settings'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
} 