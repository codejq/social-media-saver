import React, { useState, useEffect } from 'react';
import SavedContentPage from './pages/SavedContent';
import DestinationsPage from './pages/Destinations';
import PlatformsPage from './pages/Platforms';
import AdvancedPage from './pages/Advanced';
import AboutPage from './pages/About';

type PageType = 'saved' | 'destinations' | 'platforms' | 'advanced' | 'about';

export default function App() {
  const [activePage, setActivePage] = useState<PageType>('saved');

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Social Media Saver</h1>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3">
          <NavItem
            active={activePage === 'saved'}
            onClick={() => setActivePage('saved')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          >
            Saved Content
          </NavItem>
          <NavItem
            active={activePage === 'destinations'}
            onClick={() => setActivePage('destinations')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            }
          >
            Destinations
          </NavItem>
          <NavItem
            active={activePage === 'platforms'}
            onClick={() => setActivePage('platforms')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            }
          >
            Platforms
          </NavItem>
          <NavItem
            active={activePage === 'advanced'}
            onClick={() => setActivePage('advanced')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          >
            Advanced
          </NavItem>
          <NavItem
            active={activePage === 'about'}
            onClick={() => setActivePage('about')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            About
          </NavItem>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Made with care for content preservation
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className={`${activePage === 'saved' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto p-8`}>
          {activePage === 'saved' && <SavedContentPage />}
          {activePage === 'destinations' && <DestinationsPage />}
          {activePage === 'platforms' && <PlatformsPage />}
          {activePage === 'advanced' && <AdvancedPage />}
          {activePage === 'about' && <AboutPage />}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
        active
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="font-medium">{children}</span>
    </button>
  );
}
