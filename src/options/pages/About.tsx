import React from 'react';

export default function AboutPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">About</h1>
        <p className="text-gray-500 mt-1">Information about Social Media Saver</p>
      </div>

      <div className="space-y-6">
        {/* Version Info */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="currentColor">
                  <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Social Media Saver</h2>
                <p className="text-gray-500">Version 1.0.0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Description</h2>
          </div>
          <div className="card-body text-gray-600 space-y-4">
            <p>
              Social Media Saver is a browser extension that helps you save and archive
              content from social media platforms to your personal website, local storage,
              or file system.
            </p>
            <p>
              Built with privacy in mind, all your data stays on your device unless you
              explicitly configure external publishing destinations.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Features</h2>
          </div>
          <div className="card-body">
            <ul className="space-y-3">
              <FeatureItem>
                Save posts from Facebook, Twitter/X, LinkedIn, Instagram, and more
              </FeatureItem>
              <FeatureItem>
                Publish to WordPress, Drupal, or any custom REST API
              </FeatureItem>
              <FeatureItem>
                Download media (images, videos, GIFs) locally
              </FeatureItem>
              <FeatureItem>
                Background sync with automatic retry on failure
              </FeatureItem>
              <FeatureItem>
                Export content as HTML or Markdown
              </FeatureItem>
              <FeatureItem>
                Privacy-focused with optional metadata stripping
              </FeatureItem>
            </ul>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Supported Platforms</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-4 gap-4">
              <PlatformBadge name="Facebook" icon="F" />
              <PlatformBadge name="Twitter/X" icon="X" />
              <PlatformBadge name="LinkedIn" icon="in" />
              <PlatformBadge name="Instagram" icon="Ig" />
              <PlatformBadge name="TikTok" icon="Tk" soon />
              <PlatformBadge name="Reddit" icon="R" soon />
              <PlatformBadge name="Pinterest" icon="P" soon />
            </div>
          </div>
        </div>

        {/* Publishing Protocols */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Publishing Protocols</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>WordPress REST API</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>WordPress XML-RPC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Drupal JSON:API</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Micropub (W3C)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Custom REST API</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Webhooks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Links</h2>
          </div>
          <div className="card-body space-y-3">
            <a
              href="https://github.com/your-repo/social-media-saver"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-primary-600 hover:text-primary-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub Repository</span>
            </a>
            <a
              href="https://github.com/your-repo/social-media-saver/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-primary-600 hover:text-primary-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Report an Issue</span>
            </a>
          </div>
        </div>

        {/* Credits */}
        <div className="card">
          <div className="card-body text-center text-sm text-gray-500">
            <p>Made with care for content preservation</p>
            <p className="mt-1">Released under MIT License</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-gray-600">{children}</span>
    </li>
  );
}

function PlatformBadge({ name, icon, soon }: { name: string; icon: string; soon?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-lg ${soon ? 'opacity-50' : ''}`}>
      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600">
        {icon}
      </div>
      <span className="text-xs text-gray-600">{name}</span>
      {soon && <span className="text-xs text-gray-400">Coming soon</span>}
    </div>
  );
}
