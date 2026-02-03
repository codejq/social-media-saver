import type { ExtensionMessage, MessageResponse } from '@/types';
import { logger } from './logger';

/**
 * Send a message to the background service worker
 */
export async function sendToBackground<T = unknown>(
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as MessageResponse<T>;
  } catch (error) {
    logger.error('Failed to send message to background:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a message to a specific tab's content script
 */
export async function sendToTab<T = unknown>(
  tabId: number,
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as MessageResponse<T>;
  } catch (error) {
    logger.error(`Failed to send message to tab ${tabId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Broadcast a message to all tabs with matching URLs
 */
export async function broadcastToTabs(
  message: ExtensionMessage,
  urlPatterns?: string[]
): Promise<void> {
  try {
    const queryOptions: chrome.tabs.QueryInfo = urlPatterns
      ? { url: urlPatterns }
      : {};

    const tabs = await chrome.tabs.query(queryOptions);

    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch {
          // Tab might not have content script loaded
        }
      }
    }
  } catch (error) {
    logger.error('Failed to broadcast message:', error);
  }
}

/**
 * Message handler type - uses any for flexibility with different message payloads
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageHandler = (
  message: any,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<any>>;

/**
 * Create a message listener with handler map
 */
export function createMessageListener(
  handlers: Record<string, MessageHandler>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers[message.type];

    if (handler) {
      handler(message, sender)
        .then(sendResponse)
        .catch(error => {
          logger.error(`Error handling message ${message.type}:`, error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });

      // Return true to indicate async response
      return true;
    }

    logger.warn(`No handler for message type: ${message.type}`);
    return false;
  });
}

/**
 * Wait for extension to be ready
 */
export function onExtensionReady(callback: () => void): void {
  if (document.readyState === 'complete') {
    callback();
  } else {
    window.addEventListener('load', callback);
  }
}
