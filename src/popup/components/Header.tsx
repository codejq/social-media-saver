import React from 'react';

export default function Header() {
  return (
    <div className="p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold">Social Media Saver</h1>
          <p className="text-sm text-white/80">Save content to your site</p>
        </div>
      </div>
    </div>
  );
}
