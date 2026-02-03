import React, { useState, useEffect } from 'react';
import { useExtensionState } from './hooks/useExtensionState';
import QueueStatus from './components/QueueStatus';
import RecentActivity from './components/RecentActivity';
import Header from './components/Header';

type TabType = 'status' | 'recent' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const { queueStatus, recentPosts, isLoading, error, refresh } = useExtensionState();

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex flex-col bg-white min-h-[400px]">
      <Header />

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <TabButton
          active={activeTab === 'status'}
          onClick={() => setActiveTab('status')}
        >
          Status
        </TabButton>
        <TabButton
          active={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
        >
          Recent
        </TabButton>
        <TabButton
          active={false}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Saved
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {activeTab === 'status' && (
          <QueueStatus status={queueStatus} isLoading={isLoading} />
        )}

        {activeTab === 'recent' && (
          <RecentActivity posts={recentPosts} isLoading={isLoading} />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 text-center">
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-xs text-gray-500 hover:text-primary-600"
        >
          Settings
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-primary-600 border-b-2 border-primary-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}
