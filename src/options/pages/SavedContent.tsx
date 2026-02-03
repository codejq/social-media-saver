import React, { useState, useEffect } from 'react';
import { storage } from '@/lib/storage/indexeddb';
import type { SavedPost, PostFilter, PlatformType, SavedPostStatus } from '@/types';

const ITEMS_PER_PAGE = 12;

const platformColors: Record<PlatformType, string> = {
  facebook: 'bg-blue-100 text-blue-800',
  twitter: 'bg-sky-100 text-sky-800',
  linkedin: 'bg-indigo-100 text-indigo-800',
  instagram: 'bg-pink-100 text-pink-800',
  tiktok: 'bg-gray-900 text-white',
  reddit: 'bg-orange-100 text-orange-800',
  pinterest: 'bg-red-100 text-red-800',
};

const statusColors: Record<SavedPostStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  syncing: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  local: 'bg-gray-100 text-gray-800',
};

/** Pick the best available text from a post */
function getBestText(post: SavedPost): string {
  const md = post.content?.content?.markdown?.trim();
  if (md && md.length > 5) return md;
  const txt = post.content?.content?.text?.trim();
  if (txt && txt.length > 5) return txt;
  const html = post.content?.content?.html?.trim();
  if (html && html.length > 5) {
    // strip tags for preview
    return html.replace(/<[^>]*>/g, '').trim();
  }
  return '';
}

export default function SavedContent() {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformType | undefined>();
  const [statusFilter, setStatusFilter] = useState<SavedPostStatus | undefined>();
  const [selectedPost, setSelectedPost] = useState<SavedPost | null>(null);

  useEffect(() => {
    loadPosts();
  }, [currentPage, searchQuery, platformFilter, statusFilter]);

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPost(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      await storage.initialize();
      const filter: PostFilter = {
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
        search: searchQuery || undefined,
        platform: platformFilter,
        status: statusFilter,
      };
      const [fetchedPosts, count] = await Promise.all([
        storage.queryPosts(filter),
        storage.getPostCount(filter),
      ]);
      setPosts(fetchedPosts);
      setTotalCount(count);
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this saved post?')) return;
    try {
      await storage.deletePost(postId);
      if (selectedPost?.id === postId) setSelectedPost(null);
      loadPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getThumbnail = (post: SavedPost) => {
    const media = post.content?.media?.[0];
    return media ? media.thumbnailUrl || media.url : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saved Content</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalCount} {totalCount === 1 ? 'post' : 'posts'} saved
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by content or author..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={platformFilter || ''}
              onChange={(e) => { setPlatformFilter((e.target.value as PlatformType) || undefined); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="reddit">Reddit</option>
              <option value="pinterest">Pinterest</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter || ''}
              onChange={(e) => { setStatusFilter((e.target.value as SavedPostStatus) || undefined); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              <option value="local">Local</option>
              <option value="pending">Pending</option>
              <option value="syncing">Syncing</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No saved content</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || platformFilter || statusFilter ? 'Try adjusting your filters' : 'Start saving posts from social media!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const thumbnail = getThumbnail(post);
            const previewText = getBestText(post);

            return (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer"
              >
                {/* Thumbnail */}
                {thumbnail && (
                  <div className="relative h-48 bg-gray-100">
                    <img
                      src={thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {post.content?.media?.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        +{post.content.media.length - 1} more
                      </div>
                    )}
                  </div>
                )}

                {/* Card body */}
                <div className="p-4 space-y-2">
                  {/* Badges */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${platformColors[post.platform]}`}>
                      {post.platform}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[post.status]}`}>
                      {post.status}
                    </span>
                  </div>

                  {/* Author row */}
                  <div className="flex items-center gap-2">
                    {post.author?.avatarUrl && (
                      <img
                        src={post.author.avatarUrl}
                        alt={post.author.name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {post.author?.name || 'Unknown'}
                        {post.author?.verified && (
                          <svg className="inline w-4 h-4 ml-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </p>
                      {post.author?.username && (
                        <p className="text-xs text-gray-500 truncate">@{post.author.username}</p>
                      )}
                    </div>
                  </div>

                  {/* Content preview */}
                  {previewText && (
                    <p className="text-sm text-gray-600" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {previewText}
                    </p>
                  )}

                  {/* Footer: date + open hint */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-400">{formatDate(post.createdAt)}</p>
                    <p className="text-xs text-primary-500 font-medium">View details →</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
          </div>
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      {selectedPost && (
        <DetailModal post={selectedPost} onClose={() => setSelectedPost(null)} onDelete={handleDelete} formatDate={formatDate} />
      )}
    </div>
  );
}

/* ---------- Detail Modal ---------- */
function DetailModal({
  post,
  onClose,
  onDelete,
  formatDate,
}: {
  post: SavedPost;
  onClose: () => void;
  onDelete: (id: string) => void;
  formatDate: (d: Date) => string;
}) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const fullText = getBestText(post);
  const media = post.content?.media || [];
  const engagement = post.content?.metadata?.engagement || {};
  const hashtags = post.content?.metadata?.hashtags || [];
  const mentions = post.content?.metadata?.mentions || [];

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-60 overflow-y-auto"
      onClick={onClose}
    >
      {/* modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-90 hover:bg-gray-100 text-gray-600 shadow"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image gallery */}
        {media.length > 0 && (
          <div className="relative bg-gray-900">
            <img
              src={media[galleryIndex]?.thumbnailUrl || media[galleryIndex]?.url}
              alt=""
              className="w-full max-h-80 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* nav arrows */}
            {media.length > 1 && (
              <>
                <button
                  onClick={() => setGalleryIndex((i) => (i - 1 + media.length) % media.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  onClick={() => setGalleryIndex((i) => (i + 1) % media.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                {/* dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? 'bg-white' : 'bg-white bg-opacity-50'}`}
                    />
                  ))}
                </div>
              </>
            )}
            {/* media type badge */}
            <div className="absolute top-2 left-2">
              <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                {media[galleryIndex]?.type === 'video' ? 'Video' : `${galleryIndex + 1} / ${media.length}`}
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${platformColors[post.platform]}`}>
              {post.platform}
            </span>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[post.status]}`}>
              {post.status}
            </span>
            {post.content?.metadata?.isSponsored && (
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Sponsored</span>
            )}
          </div>

          {/* Author card */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            {post.author?.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt={post.author.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary-200 flex items-center justify-center text-primary-700 text-xl font-bold">
                {(post.author?.name || '?')[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 truncate">
                {post.author?.name || 'Unknown'}
                {post.author?.verified && (
                  <svg className="inline w-5 h-5 ml-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </p>
              {post.author?.username && <p className="text-sm text-gray-500">@{post.author.username}</p>}
              {post.author?.profileUrl && (
                <a href={post.author.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">
                  View Profile
                </a>
              )}
            </div>
          </div>

          {/* Post text content */}
          {fullText ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Post Content</p>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{fullText}</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400 italic">
              No text content captured
            </div>
          )}

          {/* Engagement + hashtags + mentions */}
          <div className="grid grid-cols-2 gap-4">
            {/* Engagement */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Engagement</p>
              <div className="space-y-1.5">
                {engagement.likes !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                    </svg>
                    <span className="font-semibold">{engagement.likes.toLocaleString()}</span> likes
                  </div>
                )}
                {engagement.comments !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">{engagement.comments.toLocaleString()}</span> comments
                  </div>
                )}
                {engagement.shares !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M15 8a3 3 0 10-2.977-2.494H7.7a3 3 0 00-2.977 2.494H2.3A3 3 0 105 12.83v.17a3 3 0 002.977-2.494h2.246A3 3 0 0013 12.83v.17a3 3 0 102.977-2.494H13.7a3 3 0 00-2.977 2.494H8.477a3 3 0 00-2.977-2.494v-.17a3 3 0 002.977-2.494h2.246A3 3 0 0013 10.83V11a3 3 0 102.977-2.494z" />
                    </svg>
                    <span className="font-semibold">{engagement.shares.toLocaleString()}</span> shares
                  </div>
                )}
                {engagement.likes === undefined && engagement.comments === undefined && engagement.shares === undefined && (
                  <p className="text-xs text-gray-400 italic">No engagement data</p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tags</p>
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {hashtags.map((tag) => (
                    <span key={tag} className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
              {mentions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {mentions.map((m) => (
                    <span key={m} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">@{m}</span>
                  ))}
                </div>
              )}
              {hashtags.length === 0 && mentions.length === 0 && (
                <p className="text-xs text-gray-400 italic">No tags</p>
              )}
            </div>
          </div>

          {/* Saved date + original post date */}
          <div className="flex gap-6 text-xs text-gray-500">
            <div>
              <span className="font-semibold text-gray-600">Saved:</span> {formatDate(post.createdAt)}
            </div>
            {post.content?.metadata?.timestamp && (
              <div>
                <span className="font-semibold text-gray-600">Posted:</span> {formatDate(post.content.metadata.timestamp)}
              </div>
            )}
          </div>

          {/* Actions footer */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
            >
              View Original Post
            </a>
            <button
              onClick={() => onDelete(post.id)}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
