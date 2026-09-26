'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ServiceRequestEntity,
  RequestStatus,
  formatCurrency,
  formatRelativeDate,
} from '@/lib/api-client';
import { Clock, DollarSign, ArrowRight, MessageSquare } from 'lucide-react';

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const getBadgeStyle = () => {
    switch (status) {
      case 'OPEN':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
      case 'ACCEPTED':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
      case 'PAID':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
      case 'COMPLETED':
        return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400';
      case 'CANCELLED':
        return 'border-rose-500/40 bg-rose-500/10 text-rose-400';
      default:
        return 'border-gray-500/40 bg-gray-500/10 text-gray-400';
    }
  };

  return (
    <span
      data-testid="request-status"
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${getBadgeStyle()}`}
    >
      {status}
    </span>
  );
}

export interface RequestCardProps {
  request: ServiceRequestEntity;
  viewMode?: 'customer' | 'provider';
  onClick?: () => void;
}

export function RequestCard({ request, viewMode = 'provider', onClick }: RequestCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/requests/${request.id}`);
    }
  };

  const isPaid = request.status === 'PAID';
  const isAccepted = request.status === 'ACCEPTED';

  return (
    <div
      data-testid="request-card"
      onClick={handleCardClick}
      className="group relative flex flex-col justify-between rounded-lg border border-[#1f293d] bg-[#111827] p-5 shadow-sm transition duration-150 hover:border-indigo-500/50 hover:bg-[#151e32] cursor-pointer"
    >
      <div>
        {/* Header: Title and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <h3
            data-testid="request-title"
            className="text-base font-semibold text-gray-100 transition group-hover:text-indigo-300 line-clamp-1"
          >
            {request.title}
          </h3>
          <RequestStatusBadge status={request.status} />
        </div>

        {/* Description clamped */}
        <p
          data-testid="request-description"
          className="mt-2.5 text-sm text-gray-400 line-clamp-2"
        >
          {request.description}
        </p>
      </div>

      {/* Footer: Budget, Date, and Action */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1f293d] pt-4">
        <div className="flex items-center space-x-4 text-xs text-gray-400">
          <div className="flex items-center font-mono text-base font-bold text-emerald-400">
            <span data-testid="request-budget">{formatCurrency(request.budget)}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Clock className="h-3.5 w-3.5 text-gray-500" />
            <span>{formatRelativeDate(request.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isPaid && (
            <button
              type="button"
              data-testid="request-chat-button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/chat/${request.id}`);
              }}
              className="inline-flex items-center space-x-1.5 rounded-md border border-emerald-500/50 bg-emerald-600/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Open Chat</span>
            </button>
          )}

          <button
            type="button"
            data-testid="request-action-button"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="inline-flex items-center space-x-1.5 rounded-md border border-gray-700 bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-indigo-500 hover:bg-indigo-600 hover:text-white cursor-pointer"
          >
            <span>
              {isPaid
                ? 'View Details'
                : isAccepted
                  ? 'View Accepted'
                  : viewMode === 'provider'
                    ? 'View / Make Offer'
                    : 'View Offers'}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
