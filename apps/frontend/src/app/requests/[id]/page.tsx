'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
  formatCurrency,
  formatRelativeDate,
} from '@/lib/api-client';
import { RequestStatusBadge } from '@/components/requests/request-card';
import { OfferList } from '@/components/offers/offer-list';
import { useAuth } from '@/context/auth-context';
import {
  ArrowLeft,
  DollarSign,
  Clock,
  User,
  Shield,
  Layers,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [request, setRequest] = useState<ServiceRequestEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleOfferAccepted = (acceptedOffer: any) => {
    setRequest((prev) =>
      prev
        ? {
            ...prev,
            status: 'ACCEPTED',
            acceptedOfferId: acceptedOffer.id,
          }
        : null,
    );
  };

  const fetchRequestDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.requests.getById(id);
      setRequest(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load service request details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  if (isLoading) {
    return (
      <div className="mx-auto flex h-[60vh] max-w-4xl items-center justify-center px-4">
        <div className="flex flex-col items-center space-y-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-gray-400">Loading service request details...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">Request Not Found</h2>
          <p className="mt-1 text-sm text-rose-300">
            {error || `Unable to locate service request with ID "${id}"`}
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center space-x-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Go Back</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center space-x-2 text-sm text-gray-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Request Summary Card */}
      <div className="rounded-xl border border-[#1f293d] bg-[#111827] p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <RequestStatusBadge status={request.status} />
              <span className="text-xs text-gray-500">ID: {request.id}</span>
            </div>
            <h1
              data-testid="request-detail-title"
              className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              {request.title}
            </h1>
          </div>

          {/* Budget Display */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-right">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-400">
              Budget (USD)
            </div>
            <div
              data-testid="request-detail-budget"
              className="font-mono text-2xl font-black text-emerald-400"
            >
              {formatCurrency(request.budget)}
            </div>
          </div>
        </div>

        {/* Metadata Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-6 border-y border-[#1f293d] py-3 text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>Posted: {formatRelativeDate(request.createdAt)}</span>
          </div>

          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-gray-500" />
            <span>Customer ID: {request.customerId}</span>
          </div>

          {request.acceptedOfferId && (
            <div className="flex items-center space-x-2 text-amber-400">
              <Shield className="h-4 w-4" />
              <span>Accepted Offer: {request.acceptedOfferId}</span>
            </div>
          )}
        </div>

        {/* Full Description */}
        <div className="mt-6">
          <h2 className="flex items-center space-x-2 text-sm font-semibold text-gray-200">
            <FileText className="h-4 w-4 text-indigo-400" />
            <span>Project Scope & Requirements</span>
          </h2>
          <div
            data-testid="request-detail-description"
            className="mt-3 whitespace-pre-line rounded-lg border border-[#1f293d] bg-[#090d16] p-5 text-sm leading-relaxed text-gray-300"
          >
            {request.description}
          </div>
        </div>
      </div>

      {/* Offers Stream & Management */}
      <OfferList
        requestId={request.id}
        requestTitle={request.title}
        requestBudget={request.budget}
        requestStatus={request.status}
        isCustomerOwner={Boolean(user && user.id === request.customerId)}
        onOfferAccepted={handleOfferAccepted}
      />
    </div>
  );
}
