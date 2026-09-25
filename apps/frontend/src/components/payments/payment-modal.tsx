'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import {
  apiClient,
  ApiClientError,
  OfferEntity,
  formatCurrency,
} from '@/lib/api-client';
import { getStripe } from '@/lib/stripe-client';
import { StripeCheckoutForm } from './stripe-checkout-form';
import {
  AlertCircle,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: OfferEntity | null;
  requestId: string;
  requestTitle: string;
  onPaymentSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  offer,
  requestId,
  requestTitle,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number>(0);
  const [isLoadingIntent, setIsLoadingIntent] = useState<boolean>(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  // ─── Initialize PaymentIntent from Backend ────────────────────────────────

  const initPaymentIntent = useCallback(async () => {
    if (!offer?.id) return;

    setIsLoadingIntent(true);
    setIntentError(null);

    try {
      const response = await apiClient.payments.createIntent({
        offerId: offer.id,
      });
      setClientSecret(response.clientSecret);
      setAmountCents(response.amount);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setIntentError(err.message || 'Failed to initialize payment');
      } else {
        setIntentError('Could not connect to payment processor. Please try again.');
      }
    } finally {
      setIsLoadingIntent(false);
    }
  }, [offer?.id]);

  useEffect(() => {
    if (isOpen && offer?.id) {
      initPaymentIntent();
    } else {
      setClientSecret(null);
      setIntentError(null);
      setIsLoadingIntent(false);
    }
  }, [isOpen, offer?.id, initPaymentIntent]);

  // ─── Escape Key Closes Modal ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !offer) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      data-testid="payment-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-lg rounded-2xl border border-[#1f293d] bg-[#111827] p-6 shadow-2xl transition-all sm:p-8 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f293d] pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="payment-modal-title"
                className="text-lg font-bold text-white sm:text-xl"
              >
                Complete Payment
              </h2>
              <p className="text-xs text-gray-400">
                Secure escrow checkout for accepted proposal
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-payment-modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Price & Service Summary Breakdown */}
        <div className="mt-5 rounded-xl border border-[#1f293d] bg-[#090d16] p-4 text-xs space-y-2.5">
          <div className="flex items-center justify-between text-gray-400">
            <span>Service Request:</span>
            <span className="font-medium text-gray-200 truncate max-w-[220px]">
              {requestTitle}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <span>Provider:</span>
            <span className="font-mono text-gray-300">
              #{offer.providerId.slice(-6)}
            </span>
          </div>

          <div className="border-t border-[#1f293d] pt-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              Total Amount:
            </span>
            <span
              data-testid="payment-modal-price"
              className="font-mono text-lg font-bold text-emerald-400"
            >
              {formatCurrency(offer.price)}
            </span>
          </div>
        </div>

        {/* Dynamic Payment State Container */}
        <div className="mt-6">
          {isLoadingIntent ? (
            <div
              data-testid="payment-intent-loading"
              className="flex flex-col items-center justify-center py-10 space-y-3 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-xs text-gray-400">
                Initializing secure Stripe checkout...
              </p>
            </div>
          ) : intentError ? (
            <div className="space-y-4 py-4">
              <div
                role="alert"
                className="flex items-start space-x-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p>{intentError}</p>
              </div>
              <button
                type="button"
                onClick={initPaymentIntent}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-gray-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-gray-700 transition"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Payment Setup</span>
              </button>
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={getStripe()}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#6366f1',
                    colorBackground: '#090d16',
                    colorText: '#f9fafb',
                    colorDanger: '#ef4444',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <StripeCheckoutForm
                clientSecret={clientSecret}
                amount={amountCents || Math.round(offer.price * 100)}
                onSuccess={() => {
                  if (onPaymentSuccess) {
                    onPaymentSuccess();
                  }
                }}
              />
            </Elements>
          ) : null}
        </div>

        {/* Modal Footer Trust Seal */}
        <div className="mt-6 flex items-center justify-center space-x-2 border-t border-[#1f293d] pt-4 text-center text-xs text-gray-500">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>FlogenAI Escrow Protection: Funds released upon job completion</span>
        </div>
      </div>
    </div>
  );
}
