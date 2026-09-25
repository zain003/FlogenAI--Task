'use client';

import React, { useEffect, useState, useCallback, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, AuthContext } from '@/context/auth-context';
import { CreateRequestForm } from '@/components/requests/create-request-form';
import { RequestCard } from '@/components/requests/request-card';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
} from '@/lib/api-client';
import {
  Inbox,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileQuestion,
  Layers,
} from 'lucide-react';

export default function CustomerRequestsPage() {
  const router = useRouter();
  const authContext = useContext(AuthContext);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side route protection
  useEffect(() => {
    if (!authContext || isAuthLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role === 'provider') {
      router.push('/provider/browse');
    }
  }, [authContext, isAuthLoading, isAuthenticated, user, router]);

  const fetchMyRequests = useCallback(async () => {
    if (authContext && (!isAuthenticated || user?.role !== 'customer')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.requests.getMyRequests();
      setRequests(response.data || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to fetch your service requests');
      }
    } finally {
      setIsLoading(false);
    }
  }, [authContext, isAuthenticated, user]);

  useEffect(() => {
    if (authContext && (isAuthLoading || !isAuthenticated || user?.role !== 'customer')) {
      return;
    }
    fetchMyRequests();
  }, [authContext, isAuthLoading, isAuthenticated, user, fetchMyRequests]);

  const handleRequestCreated = (newRequest: ServiceRequestEntity) => {
    setRequests((prev) => [newRequest, ...prev]);
  };

  if (authContext && (isAuthLoading || !isAuthenticated || user?.role !== 'customer')) {
    return (
      <div data-testid="auth-loading-screen" className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Verifying customer access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Layers className="h-4 w-4" />
            <span>Customer Portal</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            My Service Requests
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your posted service requests, review incoming offers, and track project status.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMyRequests}
          disabled={isLoading}
          aria-label="Refresh requests"
          className="inline-flex items-center space-x-2 rounded-lg border border-[#1f293d] bg-[#111827] px-3.5 py-2 text-xs font-medium text-gray-300 transition hover:border-gray-600 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Dual Pane Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Pane: Create Request Form */}
        <div className="lg:col-span-5">
          <div className="sticky top-24">
            <CreateRequestForm onRequestCreated={handleRequestCreated} />
          </div>
        </div>

        {/* Right Pane: Requests List */}
        <div className="lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-200">
              Your Requests{' '}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({requests.length})
              </span>
            </h2>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center space-x-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-[#1f293d] bg-[#111827] p-8 text-center">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                <p className="text-sm text-gray-400">Loading your service requests...</p>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div
              data-testid="empty-state"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1f293d] bg-[#111827]/50 p-12 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">No service requests found</h3>
              <p className="mt-1 max-w-sm text-sm text-gray-400">
                You haven&apos;t created any service requests yet. Fill in the form on the left to post your first job to providers.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  viewMode="customer"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
