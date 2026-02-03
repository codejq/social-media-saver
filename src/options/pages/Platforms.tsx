import React, { useState, useEffect } from 'react';
import type { ExtensionSettings, PlatformType } from '@/types';

const PLATFORMS: { id: PlatformType; name: string; icon: string }[] = [
  { id: 'facebook', name: 'Facebook', icon: 'F' },
  { id: 'twitter', name: 'Twitter / X', icon: 'X' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in' },
  { id: 'instagram', name: 'Instagram', icon: 'Ig' },
  { id: 'tiktok', name: 'TikTok', icon: 'Tk' },
  { id: 'reddit', name: 'Reddit', icon: 'R' },
  { id: 'pinterest', name: 'Pinterest', icon: 'P' },
];

export default function PlatformsPage() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS',
        payload: null,
      });
      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlatformSetting = async (
    platform: PlatformType,
    key: string,
    value: boolean
  ) => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      platforms: {
        ...settings.platforms,
        [platform]: {
          ...settings.platforms[platform],
          [key]: value,
        },
      },
    };

    setSettings(updatedSettings);

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { platforms: updatedSettings.platforms },
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="card-body">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 mt-1">Configure which platforms to monitor and how to handle their content</p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map((platform) => {
          const platformSettings = settings?.platforms[platform.id];

          return (
            <div key={platform.id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                      platformSettings?.enabled
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                      <p className="text-sm text-gray-500">
                        {platformSettings?.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => updatePlatformSetting(
                      platform.id,
                      'enabled',
                      !platformSettings?.enabled
                    )}
                    className={`toggle ${platformSettings?.enabled ? 'toggle-on' : 'toggle-off'}`}
                  >
                    <span className="toggle-dot" />
                  </button>
                </div>

                {platformSettings?.enabled && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                    <ToggleOption
                      label="Auto-detect posts"
                      description="Automatically find posts on page load"
                      checked={platformSettings?.autoDetect ?? true}
                      onChange={(checked) => updatePlatformSetting(platform.id, 'autoDetect', checked)}
                    />
                    <ToggleOption
                      label="Show save button"
                      description="Display save button on posts"
                      checked={platformSettings?.showButton ?? true}
                      onChange={(checked) => updatePlatformSetting(platform.id, 'showButton', checked)}
                    />
                    <ToggleOption
                      label="Extract media"
                      description="Download images and videos"
                      checked={platformSettings?.extractMedia ?? true}
                      onChange={(checked) => updatePlatformSetting(platform.id, 'extractMedia', checked)}
                    />
                    <ToggleOption
                      label="Extract comments"
                      description="Include top comments (if available)"
                      checked={platformSettings?.extractComments ?? false}
                      onChange={(checked) => updatePlatformSetting(platform.id, 'extractComments', checked)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        onClick={() => onChange(!checked)}
        className={`toggle mt-0.5 ${checked ? 'toggle-on' : 'toggle-off'}`}
      >
        <span className="toggle-dot" />
      </button>
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </div>
  );
}
