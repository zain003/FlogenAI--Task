'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  OfferEntity,
  OfferStatus,
  RequestStatus,
  formatCurrency,
  formatRelativeDate,
} from '@/lib/api-client';
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Loader2,
  MessageSquare,
  User,
  XCircle,
} from 'lucide-react';

export interface OfferCardProps {
  offer: OfferEntity;
  isCustomerOwner: boolean;
  requestStatus: RequestStatus;
  onAccept: (offerId: string) => Promise<void>;
  onPay?: (offer: OfferEntity) => void;
  isAccepting?: boolean;
  disabled?: boolean;
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  switch (status) {
    case 'ACCEPTED':
      return (
        <span
          data-testid={`offer-status-${status.toLowerCase()}`}
          className="inline-flex items-center space-x-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 shadow-sm"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Accepted</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span
          data-testid={`offer-status-${status.toLowerCase()}`}
          className="inline-flex items-center space-x-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400"
        >
          <XCircle className="h-3.5 w-3.5" />
          <span>Rejected</span>
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span
          data-testid={`offer-status-${status.toLowerCase()}`}
          className="inline-flex items-center space-x-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Pending Review</span>
        </span>
      );
  }
}

export function OfferCard({
  offer,
  isCustomerOwner,
  requestStatus,
  onAccept,
  onPay,
  isAccepting = false,
  disabled = false,
}: OfferCardProps) {
  const router = useRouter();
  const isAccepted = offer.status === 'ACCEPTED';
  const isRejected = offer.status === 'REJECTED';
  const isPending = offer.status === 'PENDING';

  // Only the customer who owns the request can accept a pending offer while the request is OPEN
  const canAccept =
    isCustomerOwner && requestStatus === 'OPEN' && isPending && !disabled;

  return (
    <div
      data-testid={`offer-card-${offer.id}`}
      className={`relative overflow-hidden rounded-xl border p-5 transition-all sm:p-6 ${
        isAccepted
          ? 'border-emerald-500/40 bg-emerald-950/15 shadow-lg shadow-emerald-950/20'
          : isRejected
            ? 'border-[#1f293d]/50 bg-[#111827]/40 opacity-70'
            : 'border-[#1f293d] bg-[#111827] hover:border-gray-700'
      }`}
    >
      {/* Top Header: Provider Info & Price */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <OfferStatusBadge status={offer.status} />
            <span className="text-xs text-gray-500">ID: {offer.id.slice(-6)}</span>
          </div>

          <div className="flex items-center space-x-2 pt-1 text-xs text-gray-400">
            <User className="h-3.5 w-3.5 text-gray-500" />
            <span data-testid="offer-provider-name" className="font-medium text-gray-300">
              Provider #{offer.providerId.slice(-6)}
            </span>
            <span className="text-gray-600">•</span>
            <span>{formatRelativeDate(offer.createdAt)}</span>
          </div>
        </div>

        {/* Offer Price Callout */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Offered Price
          </div>
          <div
            data-testid="offer-price"
            className="font-mono text-xl font-bold text-white sm:text-2xl"
          >
            {formatCurrency(offer.price)}
          </div>
        </div>
      </div>

      {/* Proposal Message */}
      <div className="mt-4">
        <p
          data-testid="offer-message"
          className="whitespace-pre-line text-sm leading-relaxed text-gray-300"
        >
          {offer.message}
        </p>
      </div>

      {/* Action Footer (Visible only for Customer Owner when applicable) */}
      {isCustomerOwner && (
        <div className="mt-5 flex items-center justify-between border-t border-[#1f293d] pt-4">
          <div className="text-xs text-gray-500">
            {isAccepted && (
              <span className="font-medium text-emerald-400">
                Winning Offer • Ready for Payment
              </span>
            )}
            {isRejected && (
              <span className="text-gray-500">
                Offer not selected
              </span>
            )}
            {isPending && requestStatus === 'OPEN' && (
              <span className="text-gray-400">
                Accepting this offer will reject all competing bids.
              </span>
            )}
            {isPending && requestStatus !== 'OPEN' && (
              <span className="text-gray-500">
                Request already finalized
              </span>
            )}
          </div>

          {canAccept && (
            <button
              type="button"
              data-testid={`accept-offer-button-${offer.id}`}
              disabled={disabled || isAccepting}
              onClick={() => onAccept(offer.id)}
              className="inline-flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Accepting...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Accept Offer</span>
                </>
              )}
            </button>
          )}

          {isAccepted && requestStatus === 'ACCEPTED' && onPay && (
            <button
              type="button"
              data-testid={`pay-offer-button-${offer.id}`}
              onClick={() => onPay(offer)}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <CreditCard className="h-4 w-4" />
              <span>Proceed to Payment</span>
            </button>
          )}
        </div>
      )}

      {/* Provider Action Footer for Winning Accepted Offer */}
      {!isCustomerOwner && isAccepted && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1f293d] pt-4">
          <div className="text-xs text-emerald-400 font-medium flex items-center space-x-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {requestStatus === 'PAID'
                ? 'Winning Proposal • Escrow Payment Confirmed'
                : 'Winning Proposal • Accepted by Customer'}
            </span>
          </div>

          {(requestStatus === 'PAID' || requestStatus === 'ACCEPTED') && (
            <button
              type="button"
              data-testid={`provider-chat-button-${offer.id}`}
              onClick={() => router.push(`/chat/${offer.requestId}`)}
              className="inline-flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Open Chat</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
