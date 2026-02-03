import type { ExtensionSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { logger } from '@/lib/utils/logger';

/**
 * Chrome storage wrapper for sync-able settings
 */
export class ChromeStorage {
  private static readonly SETTINGS_KEY = 'extensionSettings';
  private static readonly SYNC_ENABLED_KEY = 'syncEnabled';

  /**
   * Get settings from storage
   */
  static async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...result[this.SETTINGS_KEY] };
    } catch (error) {
      logger.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to storage
   */
  static async saveSettings(settings: ExtensionSettings): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.SETTINGS_KEY]: settings });
      logger.debug('Settings saved');
    } catch (error) {
      logger.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Update partial settings
   */
  static async updateSettings(updates: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    await this.saveSettings(updated);
  }

  /**
   * Get a specific setting value
   */
  static async getSetting<K extends keyof ExtensionSettings>(
    key: K
  ): Promise<ExtensionSettings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }

  /**
   * Set a specific setting value
   */
  static async setSetting<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
  ): Promise<void> {
    await this.updateSettings({ [key]: value } as Partial<ExtensionSettings>);
  }

  /**
   * Get arbitrary data from local storage
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      logger.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Set arbitrary data to local storage
   */
  static async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      logger.error(`Failed to set ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove data from storage
   */
  static async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      logger.error(`Failed to remove ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get storage usage info
   */
  static async getUsage(): Promise<{ bytesInUse: number; quota: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return {
        bytesInUse,
        quota: chrome.storage.local.QUOTA_BYTES || 10485760, // 10MB default
      };
    } catch {
      return { bytesInUse: 0, quota: 10485760 };
    }
  }

  /**
   * Listen for storage changes
   */
  static onChanged(
    callback: (changes: Record<string, chrome.storage.StorageChange>) => void
  ): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }

  /**
   * Listen for settings changes specifically
   */
  static onSettingsChanged(
    callback: (newSettings: ExtensionSettings, oldSettings: ExtensionSettings) => void
  ): void {
    this.onChanged((changes) => {
      if (changes[this.SETTINGS_KEY]) {
        const newValue = { ...DEFAULT_SETTINGS, ...changes[this.SETTINGS_KEY].newValue };
        const oldValue = { ...DEFAULT_SETTINGS, ...changes[this.SETTINGS_KEY].oldValue };
        callback(newValue, oldValue);
      }
    });
  }
}

export default ChromeStorage;
