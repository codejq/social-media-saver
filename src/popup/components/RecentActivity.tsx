import React from 'react';
import type { SavedPost } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  posts: SavedPost[];
  isLoading: boolean;
}

export default function RecentActivity({ posts, isLoading }: Props) {
  if (isLoading && posts.length === 0) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm">No saved content yet</p>
        <p className="text-xs text-gray-400 mt-1">Visit social media sites to save posts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fadeIn">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: SavedPost }) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    syncing: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    local: 'bg-gray-100 text-gray-700',
  };

  const platformIcons: Record<string, string> = {
    facebook: 'F',
    twitter: 'X',
    linkedin: 'in',
    instagram: 'Ig',
    tiktok: 'Tk',
    reddit: 'R',
    pinterest: 'P',
  };

  const handleOpenPost = () => {
    if (post.publishedUrl) {
      chrome.tabs.create({ url: post.publishedUrl });
    } else if (post.url) {
      chrome.tabs.create({ url: post.url });
    }
  };

  const handleDelete = async () => {
    await chrome.runtime.sendMessage({
      type: 'DELETE_POST',
      payload: { id: post.id },
    });
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-start gap-3">
        {/* Platform Icon */}
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 font-bold text-gray-600">
          {platformIcons[post.platform] || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {post.author.name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[post.status]}`}>
              {post.status}
            </span>
          </div>

          <p className="text-xs text-gray-600 line-clamp-2">
            {post.content.content.text.slice(0, 100)}
            {post.content.content.text.length > 100 ? '...' : ''}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span>{post.platform}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleOpenPost}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded transition-colors"
            title={post.publishedUrl ? 'View published' : 'View original'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error message */}
      {post.status === 'failed' && post.error && (
        <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">
          {post.error}
        </div>
      )}
    </div>
  );
}
