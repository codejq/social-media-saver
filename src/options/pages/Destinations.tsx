import React, { useState, useEffect } from 'react';
import type { Destination, DestinationType } from '@/types';

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDestinations();
  }, []);

  const loadDestinations = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DESTINATIONS',
        payload: null,
      });
      if (response.success) {
        setDestinations(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load destinations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this destination?')) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_DESTINATION',
        payload: { id },
      });
      await loadDestinations();
    } catch (error) {
      console.error('Failed to delete destination:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Clear other defaults
      for (const dest of destinations) {
        if (dest.isDefault) {
          await chrome.runtime.sendMessage({
            type: 'UPDATE_DESTINATION',
            payload: { id: dest.id, updates: { isDefault: false } },
          });
        }
      }
      // Set new default
      await chrome.runtime.sendMessage({
        type: 'UPDATE_DESTINATION',
        payload: { id, updates: { isDefault: true } },
      });
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { defaultDestination: id },
      });
      await loadDestinations();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publishing Destinations</h1>
          <p className="text-gray-500 mt-1">Configure where your saved content is published</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Destination
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="card-body">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No destinations configured</h3>
            <p className="text-gray-500 mb-4">Add a destination to start publishing your saved content</p>
            <button onClick={() => setIsAdding(true)} className="btn btn-primary">
              Add Your First Destination
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {destinations.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              onEdit={() => setEditingId(dest.id)}
              onDelete={() => handleDelete(dest.id)}
              onSetDefault={() => handleSetDefault(dest.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(isAdding || editingId) && (
        <DestinationModal
          destination={editingId ? destinations.find((d) => d.id === editingId) : undefined}
          onClose={() => {
            setIsAdding(false);
            setEditingId(null);
          }}
          onSave={() => {
            setIsAdding(false);
            setEditingId(null);
            loadDestinations();
          }}
        />
      )}
    </div>
  );
}

function DestinationCard({
  destination,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  destination: Destination;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const typeLabels: Record<DestinationType, string> = {
    'wordpress-xmlrpc': 'WordPress (XML-RPC)',
    'wordpress-rest': 'WordPress (REST API)',
    'drupal-jsonapi': 'Drupal (JSON:API)',
    'micropub': 'Micropub',
    'activitypub': 'ActivityPub',
    'custom-rest': 'Custom REST API',
    'webhook': 'Webhook',
    'local-indexeddb': 'Local Storage',
    'local-filesystem': 'Local Files',
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              destination.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{destination.name}</h3>
                {destination.isDefault && (
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{typeLabels[destination.type]}</p>
              {destination.config.siteUrl && (
                <p className="text-xs text-gray-400 mt-1">{destination.config.siteUrl}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!destination.isDefault && (
              <button
                onClick={onSetDefault}
                className="p-2 text-gray-400 hover:text-primary-600 rounded-lg transition-colors"
                title="Set as default"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-primary-600 rounded-lg transition-colors"
              title="Edit"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
              title="Delete"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Published:</span>
            <span className="ml-1 font-medium">{destination.stats.totalPublished}</span>
          </div>
          <div>
            <span className="text-gray-500">Failed:</span>
            <span className="ml-1 font-medium text-red-600">{destination.stats.failedCount}</span>
          </div>
          {destination.lastSync && (
            <div>
              <span className="text-gray-500">Last sync:</span>
              <span className="ml-1">{new Date(destination.lastSync).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DestinationModal({
  destination,
  onClose,
  onSave,
}: {
  destination?: Destination;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: destination?.name || '',
    type: destination?.type || 'local-indexeddb' as DestinationType,
    enabled: destination?.enabled ?? true,
    siteUrl: destination?.config.siteUrl || '',
    username: '',
    password: '',
    token: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        enabled: formData.enabled,
        config: {
          siteUrl: formData.siteUrl,
          authType: formData.type === 'local-indexeddb' || formData.type === 'local-filesystem'
            ? 'none' as const
            : formData.token ? 'bearer' as const : 'basic' as const,
          username: formData.username,
          password: formData.password,
          token: formData.token,
        },
      };

      if (destination) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_DESTINATION',
          payload: { id: destination.id, updates: payload },
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'ADD_DESTINATION',
          payload,
        });
      }

      onSave();
    } catch (error) {
      console.error('Failed to save destination:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsAuth = !['local-indexeddb', 'local-filesystem'].includes(formData.type);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">
            {destination ? 'Edit Destination' : 'Add Destination'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My WordPress Site"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as DestinationType })}
            >
              <option value="local-indexeddb">Local Storage (IndexedDB)</option>
              <option value="local-filesystem">Local Files</option>
              <option value="wordpress-rest">WordPress (REST API)</option>
              <option value="wordpress-xmlrpc">WordPress (XML-RPC)</option>
              <option value="drupal-jsonapi">Drupal (JSON:API)</option>
              <option value="micropub">Micropub</option>
              <option value="custom-rest">Custom REST API</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>

          {needsAuth && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
                <input
                  type="url"
                  value={formData.siteUrl}
                  onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                  placeholder="https://mysite.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Token (alternative to username/password)
                </label>
                <input
                  type="password"
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  placeholder="Bearer token"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
              className={`toggle ${formData.enabled ? 'toggle-on' : 'toggle-off'}`}
            >
              <span className="toggle-dot" />
            </button>
            <span className="text-sm text-gray-700">Enabled</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
