import React, { useState, useEffect } from 'react';
import type { ExtensionSettings } from '@/types';

export default function AdvancedPage() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: null }),
      ]);

      if (settingsResponse.success) {
        setSettings(settingsResponse.data);
      }

      // Get storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async <K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
  ) => {
    if (!settings) return;

    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { [key]: value },
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const updateContentRule = async (key: string, value: boolean | number) => {
    if (!settings) return;

    const updatedRules = { ...settings.contentRules, [key]: value };
    await updateSetting('contentRules', updatedRules);
  };

  const updatePrivacySetting = async (key: string, value: boolean) => {
    if (!settings) return;

    const updatedPrivacy = { ...settings.privacy, [key]: value };
    await updateSetting('privacy', updatedPrivacy);
  };

  const handleExport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
        payload: null,
      });

      if (response.success) {
        const data = JSON.stringify(response.data, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `social-media-saver-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const response = await chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          payload: data,
        });
        if (response.success) {
          alert('Data imported successfully');
          loadData();
        } else {
          alert(`Import failed: ${response.error}`);
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Import failed: invalid JSON file');
      }
    };
    input.click();
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_DATA',
        payload: null,
      });
      if (response.success) {
        alert('Data cleared successfully');
        loadData();
      } else {
        alert(`Failed to clear data: ${response.error}`);
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-40 bg-gray-200 rounded-xl"></div>
      <div className="h-40 bg-gray-200 rounded-xl"></div>
    </div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Advanced Settings</h1>
        <p className="text-gray-500 mt-1">Configure content processing, privacy, and storage options</p>
      </div>

      <div className="space-y-6">
        {/* Sync Settings */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Sync Settings</h2>
          </div>
          <div className="card-body space-y-4">
            <ToggleOption
              label="Background sync"
              description="Automatically sync content in the background"
              checked={settings?.backgroundSync ?? true}
              onChange={(checked) => updateSetting('backgroundSync', checked)}
            />
            <ToggleOption
              label="Notifications"
              description="Show notifications for sync status"
              checked={settings?.notifications ?? true}
              onChange={(checked) => updateSetting('notifications', checked)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sync interval (minutes)
              </label>
              <select
                value={settings?.syncInterval || 5}
                onChange={(e) => updateSetting('syncInterval', parseInt(e.target.value))}
                className="w-full max-w-xs"
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Processing */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Content Processing</h2>
          </div>
          <div className="card-body space-y-4">
            <ToggleOption
              label="Strip tracking parameters"
              description="Remove UTM and other tracking parameters from URLs"
              checked={settings?.contentRules.stripTracking ?? true}
              onChange={(checked) => updateContentRule('stripTracking', checked)}
            />
            <ToggleOption
              label="Convert to Markdown"
              description="Convert HTML content to Markdown format"
              checked={settings?.contentRules.convertToMarkdown ?? false}
              onChange={(checked) => updateContentRule('convertToMarkdown', checked)}
            />
            <ToggleOption
              label="Download media"
              description="Download images and videos locally"
              checked={settings?.contentRules.downloadMedia ?? true}
              onChange={(checked) => updateContentRule('downloadMedia', checked)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max media size (MB)
              </label>
              <select
                value={settings?.contentRules.maxMediaSize || 50}
                onChange={(e) => updateContentRule('maxMediaSize', parseInt(e.target.value))}
                className="w-full max-w-xs"
              >
                <option value={10}>10 MB</option>
                <option value={25}>25 MB</option>
                <option value={50}>50 MB</option>
                <option value={100}>100 MB</option>
                <option value={250}>250 MB</option>
              </select>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Privacy</h2>
          </div>
          <div className="card-body space-y-4">
            <ToggleOption
              label="Remove location data"
              description="Strip location metadata from saved content"
              checked={settings?.privacy.removeLocation ?? false}
              onChange={(checked) => updatePrivacySetting('removeLocation', checked)}
            />
            <ToggleOption
              label="Anonymize author"
              description="Remove author information from saved content"
              checked={settings?.privacy.anonymizeAuthor ?? false}
              onChange={(checked) => updatePrivacySetting('anonymizeAuthor', checked)}
            />
            <ToggleOption
              label="Strip metadata"
              description="Remove all extra metadata (timestamps, engagement, etc.)"
              checked={settings?.privacy.stripMetadata ?? false}
              onChange={(checked) => updatePrivacySetting('stripMetadata', checked)}
            />
          </div>
        </div>

        {/* Storage */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Storage</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Storage used</span>
                <span className="font-medium">
                  {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all"
                  style={{ width: `${(storageUsage.usage / storageUsage.quota) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleExport} className="btn btn-secondary">
                Export Data
              </button>
              <button onClick={handleImport} className="btn btn-secondary">
                Import Data
              </button>
              <button onClick={handleClearData} className="btn btn-danger">
                Clear All Data
              </button>
            </div>
          </div>
        </div>
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
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`toggle ${checked ? 'toggle-on' : 'toggle-off'}`}
      >
        <span className="toggle-dot" />
      </button>
    </div>
  );
}
