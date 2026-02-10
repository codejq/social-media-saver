import React, { useState, useEffect, useRef } from 'react';

const DRAFT_KEY = 'quicksave_draft';

interface Draft {
  title: string;
  text: string;
  imageInput: string;
  imageUrls: string[];
}

function getStore() {
  try {
    return chrome.storage.session ?? chrome.storage.local;
  } catch {
    return chrome.storage.local;
  }
}

function persistDraft(draft: Draft) {
  try {
    getStore().set({ [DRAFT_KEY]: draft });
  } catch {
    // Ignore storage errors
  }
}

function loadDraft(): Promise<Draft | undefined> {
  return new Promise((resolve) => {
    try {
      getStore().get(DRAFT_KEY, (result) => {
        resolve(result?.[DRAFT_KEY] as Draft | undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

function removeDraft() {
  try {
    getStore().remove(DRAFT_KEY);
  } catch {
    // Ignore
  }
}

interface QuickSaveProps {
  onSaved?: () => void;
}

export default function QuickSave({ onSaved }: QuickSaveProps) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const loaded = useRef(false);

  // Restore draft and get current tab URL on mount
  useEffect(() => {
    loadDraft().then((draft) => {
      if (draft) {
        setTitle(draft.title);
        setText(draft.text);
        setImageInput(draft.imageInput);
        setImageUrls(draft.imageUrls);
      }
      loaded.current = true;
    });

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setSourceUrl(tabs[0].url);
      }
    });
  }, []);

  // Persist draft on every change (after initial load)
  useEffect(() => {
    if (!loaded.current) return;
    persistDraft({ title, text, imageInput, imageUrls });
  }, [title, text, imageInput, imageUrls]);

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setMessage({ type: 'error', text: 'Please enter a valid URL' });
      return;
    }
    if (imageUrls.includes(url)) return;
    setImageUrls((prev) => [...prev, url]);
    setImageInput('');
    setMessage(null);
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() && !text.trim()) {
      setMessage({ type: 'error', text: 'Please enter a title or some text' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_CUSTOM_CONTENT',
        payload: {
          title: title.trim(),
          text: text.trim(),
          imageUrls,
          sourceUrl: sourceUrl || undefined,
        },
      });

      if (response?.success) {
        setMessage({ type: 'success', text: 'Content saved!' });
        setTitle('');
        setText('');
        setImageUrls([]);
        setImageInput('');
        removeDraft();
        onSaved?.();
      } else {
        setMessage({ type: 'error', text: response?.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save content',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Save text and images from any website, even unsupported ones.
      </p>

      {/* Source URL indicator */}
      {sourceUrl && (
        <div className="text-xs text-gray-400 truncate">
          From: {sourceUrl}
        </div>
      )}

      {/* Title */}
      <div>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Text content */}
      <div>
        <textarea
          placeholder="Paste or type content here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Image URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Paste image URL..."
          value={imageInput}
          onChange={(e) => setImageInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addImage()}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={addImage}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {/* Image list */}
      {imageUrls.length > 0 && (
        <div className="space-y-1">
          {imageUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
              <img
                src={url}
                alt=""
                className="w-8 h-8 object-cover rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="flex-1 truncate text-gray-600">{url}</span>
              <button
                onClick={() => removeImage(i)}
                className="text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || (!title.trim() && !text.trim())}
        className="w-full py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Content'}
      </button>
    </div>
  );
}
