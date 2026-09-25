'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RequestCard } from '@/components/requests/request-card';
import { useSocket } from '@/context/socket-context';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
} from '@/lib/api-client';
import {
  Briefcase,
  Loader2,
  RefreshCw,
  AlertCircle,
  Inbox,
  Filter,
  Radio,
  Sparkles,
} from 'lucide-react';

export default function ProviderBrowsePage() {
  const { socket, isConnected } = useSocket();
  const [requests, setRequests] = useState<ServiceRequestEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newlyArrivedId, setNewlyArrivedId] = useState<string | null>(null);

  // ─── Initial fetch ────────────────────────────────────────────────────────

  const fetchOpenRequests = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.requests.getAll({ status: 'OPEN' });
      setRequests(response.data || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to fetch open marketplace requests');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpenRequests();
  }, [fetchOpenRequests]);

  // ─── Real-time listener: request:created ─────────────────────────────────
  //
  // Providers are in the 'providers' room. New customer requests are broadcast
  // here so they appear at the top of the feed without a page refresh.

  useEffect(() => {
    if (!socket) return;

    const handleRequestCreated = (payload: {
      request: ServiceRequestEntity;
    }): void => {
      if (!payload?.request?.id) return;

      const newReq = payload.request;

      setRequests((prev) => {
        // Idempotency: deduplicate incoming requests by ID
        if (prev.some((req) => req.id === newReq.id)) {
          return prev;
        }
        return [newReq, ...prev];
      });

      // Visual highlight animation for newly arrived request
      setNewlyArrivedId(newReq.id);
      setTimeout(() => {
        setNewlyArrivedId((current) => (current === newReq.id ? null : current));
      }, 4000);
    };

    socket.on('request:created', handleRequestCreated);

    return () => {
      socket.off('request:created', handleRequestCreated);
    };
  }, [socket]);

  // ─── Real-time listener: request:closed ──────────────────────────────────
  //
  // When a customer accepts an offer, the backend emits `request:closed` to the
  // 'providers' room. We update the matching request's status to 'ACCEPTED' in
  // local state so providers can see it is no longer available — without removing
  // it from the list (they may still want to view the details).

  useEffect(() => {
    if (!socket) return;

    const handleRequestClosed = (payload: { requestId: string }): void => {
      if (!payload?.requestId) return;

      setRequests((prev) =>
        prev.map((req) =>
          req.id === payload.requestId
            ? { ...req, status: 'ACCEPTED' }
            : req,
        ),
      );
    };

    socket.on('request:closed', handleRequestClosed);

    return () => {
      socket.off('request:closed', handleRequestClosed);
    };
  }, [socket]);

  // ─── Reconnect handler ────────────────────────────────────────────────────
  //
  // Re-fetch the full feed on socket reconnect to reconcile any missed events.

  useEffect(() => {
    if (!socket) return;

    const handleReconnect = (): void => {
      fetchOpenRequests();
    };

    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, fetchOpenRequests]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Briefcase className="h-4 w-4" />
            <span>Provider Marketplace</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Open Service Requests
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Explore live customer requests, inspect job requirements, and submit competitive bids.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Real-time sync pill */}
          <div
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              isConnected
                ? 'border border-emerald-900/60 bg-emerald-950/40 text-emerald-400'
                : 'border border-gray-700/60 bg-gray-800/40 text-gray-400'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${isConnected ? 'animate-pulse text-emerald-400' : 'text-gray-500'}`} />
            <span>{isConnected ? 'Real-Time Feed Live' : 'Connecting Stream...'}</span>
          </div>

          <button
            type="button"
            onClick={fetchOpenRequests}
            disabled={isLoading}
            aria-label="Refresh marketplace"
            className="inline-flex items-center space-x-2 rounded-lg border border-[#1f293d] bg-[#111827] px-3.5 py-2 text-xs font-medium text-gray-300 transition hover:border-gray-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Subheader / Status Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <Filter className="h-3.5 w-3.5 text-gray-500" />
          <span>Showing Status:</span>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400">
            OPEN
          </span>
          <span className="text-gray-500">•</span>
          <span>{requests.length} available jobs</span>
        </div>

        {newlyArrivedId && (
          <div
            data-testid="new-request-alert"
            className="flex items-center space-x-1.5 text-xs font-medium text-emerald-400 animate-pulse"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>New request just arrived in real time!</span>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center space-x-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Feed Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#1f293d] bg-[#111827] p-8 text-center">
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-gray-400">Scanning marketplace for open requests...</p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1f293d] bg-[#111827]/50 p-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 text-gray-400">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-white">No service requests found</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-400">
            There are currently no open service requests available. Check back soon or refresh to see new customer postings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => (
            <div
              key={request.id}
              data-testid={`request-card-${request.id}`}
              className={`transition-all duration-500 ${
                request.id === newlyArrivedId
                  ? 'ring-2 ring-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20'
                  : ''
              }`}
            >
              <RequestCard request={request} viewMode="provider" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
