'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  apiClient,
  ApiClientError,
  OfferEntity,
  RequestStatus,
} from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { OfferCard } from './offer-card';
import { SubmitOfferDialog } from './submit-offer-dialog';
import {
  AlertCircle,
  CheckCircle,
  DollarSign,
  Loader2,
  MessageSquare,
  PlusCircle,
  Radio,
  Sparkles,
} from 'lucide-react';

export interface OfferListProps {
  requestId: string;
  requestTitle: string;
  requestBudget: number;
  requestStatus: RequestStatus;
  isCustomerOwner: boolean;
  onOfferAccepted?: (offer: OfferEntity) => void;
  /**
   * Live offers injected by the parent page from `offer:created` socket events.
   * OfferList deduplicates these against its own fetched state.
   */
  liveOffers?: OfferEntity[];
  /**
   * Offer ID to apply a highlight animation ring.
   * Set by parent when a new offer arrives in real time.
   */
  highlightOfferId?: string | null;
}

export function OfferList({
  requestId,
  requestTitle,
  requestBudget,
  requestStatus,
  isCustomerOwner,
  onOfferAccepted,
  liveOffers = [],
  highlightOfferId = null,
}: OfferListProps) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<OfferEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  const isProvider = user?.role === 'provider';
  const hasAcceptedOffer =
    requestStatus !== 'OPEN' || offers.some((o) => o.status === 'ACCEPTED');

  // ─── Initial fetch ────────────────────────────────────────────────────────

  const fetchOffers = useCallback(async (): Promise<void> => {
    if (!requestId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.offers.getByRequestId(requestId, {
        page: 1,
        limit: 50,
      });
      setOffers(res.data || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load offers for this request');
      }
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // ─── Merge live socket-pushed offers into local state ────────────────────
  //
  // When the parent page receives `offer:created` via Socket.IO, it updates
  // `liveOffers`. We merge those into our local list and deduplicate by ID.

  useEffect(() => {
    if (!liveOffers || liveOffers.length === 0) return;

    setOffers((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const newIncoming = liveOffers.filter((o) => !existingIds.has(o.id));
      if (newIncoming.length === 0) return prev;
      // Prepend new live offers so they appear at the top of the stream
      return [...newIncoming, ...prev];
    });
  }, [liveOffers]);

  // ─── Provider submission success handler ─────────────────────────────────

  const handleOfferCreated = (newOffer: OfferEntity): void => {
    setOffers((prev) => [newOffer, ...prev]);
    setSuccessBanner('Your offer has been submitted successfully!');
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // ─── Customer acceptance with concurrency protection ─────────────────────

  const handleAcceptOffer = async (offerId: string): Promise<void> => {
    // Prevent double-clicks immediately
    if (acceptingId || hasAcceptedOffer) return;

    setAcceptingId(offerId);
    setError(null);
    setSuccessBanner(null);

    try {
      const res = await apiClient.offers.accept(offerId);

      // Instant optimistic UI update: winning offer → ACCEPTED, peers → REJECTED
      setOffers((prev) =>
        prev.map((o) => {
          if (o.id === offerId) {
            return { ...o, status: 'ACCEPTED' };
          }
          return { ...o, status: 'REJECTED' };
        }),
      );

      setSuccessBanner(
        'Offer accepted successfully! The selected provider has been notified. Proceed to payment to secure this job.',
      );

      if (onOfferAccepted) {
        onOfferAccepted(res.offer);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setError(
            'This request has already been accepted or is currently locked by another operation.',
          );
        } else {
          setError(err.message || 'Failed to accept offer.');
        }
      } else {
        setError('An unexpected network error occurred while accepting the offer.');
      }
    } finally {
      setAcceptingId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-8 rounded-xl border border-[#1f293d] bg-[#111827] p-6 shadow-xl sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1f293d] pb-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white sm:text-xl">
              Incoming Offers &amp; Proposals
            </h2>
            <p className="text-xs text-gray-400">
              {offers.length === 1
                ? '1 offer received'
                : `${offers.length} offers received`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live stream indicator — visible when socket delivers a new offer */}
          {highlightOfferId && (
            <div
              data-testid="offer-live-indicator"
              className="flex items-center space-x-1.5 text-xs font-medium text-indigo-300 animate-pulse"
            >
              <Radio className="h-3.5 w-3.5 text-indigo-400" />
              <span>New offer live!</span>
            </div>
          )}

          {/* Provider "Submit Offer" Button */}
          {isProvider && requestStatus === 'OPEN' && (
            <button
              type="button"
              data-testid="open-submit-offer-button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Submit Offer</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {successBanner && (
        <div
          role="status"
          className="mt-4 flex items-start space-x-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300"
        >
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p>{successBanner}</p>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start space-x-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {/* Content Stream */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            <p className="mt-2 text-xs text-gray-400">Fetching offers...</p>
          </div>
        ) : offers.length === 0 ? (
          /* Empty State */
          <div
            data-testid="no-offers-empty-state"
            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#1f293d] bg-[#090d16]/50 p-10 text-center"
          >
            <Sparkles className="h-8 w-8 text-indigo-400/70" />
            <h3 className="mt-3 text-sm font-semibold text-gray-200">
              No Offers Submitted Yet
            </h3>
            <p className="mt-1 max-w-sm text-xs text-gray-400">
              {isProvider && requestStatus === 'OPEN'
                ? 'Be the first provider to submit a proposal for this service request.'
                : 'Verified service providers will appear here once they review the scope and submit pricing.'}
            </p>
            {isProvider && requestStatus === 'OPEN' && (
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="mt-4 inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-500"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Submit First Offer</span>
              </button>
            )}
          </div>
        ) : (
          /* List of Offers */
          <div data-testid="offers-list" className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`transition-all duration-500 ${
                  offer.id === highlightOfferId
                    ? 'ring-2 ring-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20'
                    : ''
                }`}
              >
                <OfferCard
                  offer={offer}
                  isCustomerOwner={isCustomerOwner}
                  requestStatus={requestStatus}
                  onAccept={handleAcceptOffer}
                  isAccepting={acceptingId === offer.id}
                  disabled={Boolean(acceptingId) || hasAcceptedOffer}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Offer Dialog Modal */}
      <SubmitOfferDialog
        requestId={requestId}
        requestTitle={requestTitle}
        requestBudget={requestBudget}
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={handleOfferCreated}
      />
    </div>
  );
}
