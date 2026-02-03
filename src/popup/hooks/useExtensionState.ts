import { useState, useEffect, useCallback } from 'react';
import type { QueueStatus, SavedPost } from '@/types';

interface ExtensionState {
  queueStatus: QueueStatus | null;
  recentPosts: SavedPost[];
  isLoading: boolean;
  error: string | null;
}

const initialState: ExtensionState = {
  queueStatus: null,
  recentPosts: [],
  isLoading: true,
  error: null,
};

export function useExtensionState() {
  const [state, setState] = useState<ExtensionState>(initialState);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_QUEUE_STATUS',
        payload: null,
      });

      if (response.success) {
        setState((prev) => ({ ...prev, queueStatus: response.data }));
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    }
  }, []);

  const fetchRecentPosts = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_POSTS',
        payload: { limit: 10 },
      });

      if (response.success) {
        setState((prev) => ({ ...prev, recentPosts: response.data || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch recent posts:', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await Promise.all([fetchQueueStatus(), fetchRecentPosts()]);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [fetchQueueStatus, fetchRecentPosts]);

  const pauseSync = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'PAUSE_SYNC', payload: null });
      await fetchQueueStatus();
    } catch (error) {
      console.error('Failed to pause sync:', error);
    }
  }, [fetchQueueStatus]);

  const resumeSync = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'RESUME_SYNC', payload: null });
      await fetchQueueStatus();
    } catch (error) {
      console.error('Failed to resume sync:', error);
    }
  }, [fetchQueueStatus]);

  const retryFailed = useCallback(async (itemId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'RETRY_FAILED',
        payload: { itemId },
      });
      await refresh();
    } catch (error) {
      console.error('Failed to retry item:', error);
    }
  }, [refresh]);

  const retryAllFailed = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'RETRY_ALL_FAILED',
        payload: null,
      });
      await refresh();
    } catch (error) {
      console.error('Failed to retry all failed items:', error);
    }
  }, [refresh]);

  const deletePost = useCallback(async (postId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_POST',
        payload: { id: postId },
      });
      await refresh();
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  }, [refresh]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    pauseSync,
    resumeSync,
    retryFailed,
    retryAllFailed,
    deletePost,
  };
}
