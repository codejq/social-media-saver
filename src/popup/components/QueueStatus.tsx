import React from 'react';
import type { QueueStatus as QueueStatusType } from '@/types';

interface Props {
  status: QueueStatusType | null;
  isLoading: boolean;
}

export default function QueueStatus({ status, isLoading }: Props) {
  if (isLoading && !status) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-12 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center text-gray-500 py-8">
        Unable to load status
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          label="Pending"
          value={status.pending}
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatusCard
          label="Processing"
          value={status.processing}
          color="blue"
          icon={
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatusCard
          label="Completed"
          value={status.completed}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatusCard
          label="Failed"
          value={status.failed}
          color="red"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        />
      </div>

      {/* Progress Bar */}
      {status.total > 0 && (
        <div className="bg-gray-100 rounded-lg p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-medium">{status.progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Sync Controls */}
      <SyncControls status={status} />

      {/* Empty State */}
      {status.total === 0 && (
        <div className="text-center py-6 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">No items in queue</p>
          <p className="text-xs text-gray-400 mt-1">Save content from social media to get started</p>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'yellow' | 'blue' | 'green' | 'red';
  icon: React.ReactNode;
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function SyncControls({ status }: { status: QueueStatusType }) {
  const handlePauseResume = async () => {
    if (status.isPaused) {
      await chrome.runtime.sendMessage({ type: 'RESUME_SYNC', payload: null });
    } else {
      await chrome.runtime.sendMessage({ type: 'PAUSE_SYNC', payload: null });
    }
  };

  const handleRetryAll = async () => {
    await chrome.runtime.sendMessage({ type: 'RETRY_ALL_FAILED', payload: null });
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handlePauseResume}
        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
          status.isPaused
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {status.isPaused ? 'Resume Sync' : 'Pause Sync'}
      </button>

      {status.failed > 0 && (
        <button
          onClick={handleRetryAll}
          className="flex-1 py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
        >
          Retry Failed ({status.failed})
        </button>
      )}
    </div>
  );
}
