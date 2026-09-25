'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
  OfferEntity,
  formatCurrency,
  formatRelativeDate,
} from '@/lib/api-client';
import { RequestStatusBadge } from '@/components/requests/request-card';
import { OfferList } from '@/components/offers/offer-list';
import { PaymentModal } from '@/components/payments/payment-modal';
import { useAuth } from '@/context/auth-context';
import { useSocket } from '@/context/socket-context';
import {
  ArrowLeft,
  Clock,
  User,
  Shield,
  ShieldCheck,
  MessageSquare,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useSocket();
  const id = params?.id as string;

  const [request, setRequest] = useState<ServiceRequestEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOffer, setPaymentOffer] = useState<OfferEntity | null>(null);

  /**
   * ID of the most recently live-injected offer, cleared after animation window.
   * Used to apply a glow/highlight ring on the newly arrived offer card.
   */
  const [newlyArrivedOfferId, setNewlyArrivedOfferId] = useState<string | null>(null);

  /**
   * Live-injected offer queue. When the socket pushes `offer:created`, we
   * prepend it here. OfferList reads this as the initial seed via `liveOffers`
   * prop and deduplicates against its local state.
   */
  const [liveOffers, setLiveOffers] = useState<OfferEntity[]>([]);

  // ─── Acceptance handler syncs parent request status ──────────────────────

  const handleOfferAccepted = (acceptedOffer: OfferEntity): void => {
    setRequest((prev) =>
      prev
        ? {
            ...prev,
            status: 'ACCEPTED',
            acceptedOfferId: acceptedOffer.id,
          }
        : null,
    );
    setPaymentOffer(acceptedOffer);
  };

  const handleOpenPayment = (offer: OfferEntity): void => {
    setPaymentOffer(offer);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (): void => {
    setRequest((prev) =>
      prev
        ? {
            ...prev,
            status: 'PAID',
          }
        : null,
    );
    setIsPaymentModalOpen(false);
  };

  // ─── Initial data fetch ───────────────────────────────────────────────────

  const fetchRequestDetails = useCallback(async (): Promise<void> => {
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

  // ─── Real-time offer:created listener ────────────────────────────────────
  //
  // The backend joins every authenticated user to 'user:<userId>'.
  // When a provider submits an offer, the backend emits 'offer:created' to
  // the customer's private room. We listen here and prepend the new offer to
  // the list with a brief highlight animation.

  useEffect(() => {
    if (!socket || !id) return;

    const handleOfferCreated = (payload: {
      offer: OfferEntity;
      requestTitle: string;
    }): void => {
      if (!payload?.offer?.id) return;

      // Only inject if this event is for the currently viewed request
      if (payload.offer.requestId !== id) return;

      const incomingOffer = payload.offer;

      setLiveOffers((prev) => {
        // Idempotency: ignore duplicate socket deliveries for the same offer ID
        if (prev.some((o) => o.id === incomingOffer.id)) {
          return prev;
        }
        return [incomingOffer, ...prev];
      });

      // Trigger highlight animation for the newly arrived offer card
      setNewlyArrivedOfferId(incomingOffer.id);
      setTimeout(() => {
        setNewlyArrivedOfferId((current) =>
          current === incomingOffer.id ? null : current,
        );
      }, 4000);
    };

    socket.on('offer:created', handleOfferCreated);

    return () => {
      socket.off('offer:created', handleOfferCreated);
    };
  }, [socket, id]);

  // ─── Real-time offer:accepted listener ───────────────────────────────────
  //
  // If this page is also viewed by the winning provider (after acceptance),
  // update request status immediately on receiving 'offer:accepted'.

  useEffect(() => {
    if (!socket || !id) return;

    const handleOfferAccepted = (payload: {
      offer: OfferEntity;
      requestId: string;
    }): void => {
      if (!payload?.offer?.id) return;
      if (payload.requestId !== id) return;

      setRequest((prev) =>
        prev
          ? {
              ...prev,
              status: 'ACCEPTED',
              acceptedOfferId: payload.offer.id,
            }
          : null,
      );
    };

    socket.on('offer:accepted', handleOfferAccepted);

    return () => {
      socket.off('offer:accepted', handleOfferAccepted);
    };
  }, [socket, id]);

  // ─── Real-time payment:succeeded listener ─────────────────────────────────

  useEffect(() => {
    if (!socket || !id) return;

    const handlePaymentSucceeded = (payload: {
      requestId: string;
      amount: number;
    }): void => {
      if (!payload?.requestId || payload.requestId !== id) return;
      setRequest((prev) => (prev ? { ...prev, status: 'PAID' } : null));
      setIsPaymentModalOpen(false);
    };

    socket.on('payment:succeeded', handlePaymentSucceeded);

    return () => {
      socket.off('payment:succeeded', handlePaymentSucceeded);
    };
  }, [socket, id]);

  // ─── Loading state ────────────────────────────────────────────────────────

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
            <span>Project Scope &amp; Requirements</span>
          </h2>
          <div
            data-testid="request-detail-description"
            className="mt-3 whitespace-pre-line rounded-lg border border-[#1f293d] bg-[#090d16] p-5 text-sm leading-relaxed text-gray-300"
          >
            {request.description}
          </div>
        </div>
      </div>

      {/* Paid / Open Chat Banner (Trigger for FEAT-005 Real-time Chat) */}
      {request.status === 'PAID' && (
        <div
          data-testid="paid-chat-unlocked-banner"
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-[#111827] to-[#111827] p-5 shadow-lg"
        >
          <div className="flex items-center space-x-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white">
                  Payment Secured &amp; Escrowed
                </h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-emerald-300 border border-emerald-500/30">
                  Chat Unlocked
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-300">
                Funds are held in secure escrow. Direct real-time messaging between Customer and Provider is now active.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="open-chat-button"
            onClick={() => {
              router.push(`/chat/${id}`);
            }}
            className="inline-flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Open Chat</span>
          </button>
        </div>
      )}

      {/* Real-Time Offer Arrival Banner */}
      {newlyArrivedOfferId && (
        <div
          data-testid="live-offer-arrival-banner"
          className="mt-4 flex items-center space-x-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-xs font-medium text-indigo-300 animate-pulse"
        >
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span>A new offer just arrived in real time!</span>
        </div>
      )}

      {/* Offers Stream & Management */}
      <OfferList
        requestId={request.id}
        requestTitle={request.title}
        requestBudget={request.budget}
        requestStatus={request.status}
        isCustomerOwner={Boolean(user && user.id === request.customerId)}
        onOfferAccepted={handleOfferAccepted}
        onPayOffer={handleOpenPayment}
        liveOffers={liveOffers}
        highlightOfferId={newlyArrivedOfferId}
      />

      {/* Stripe Elements Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        offer={paymentOffer}
        requestId={request.id}
        requestTitle={request.title}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
