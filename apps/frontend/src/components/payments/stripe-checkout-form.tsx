'use client';

import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { formatCurrency } from '@/lib/api-client';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface StripeCheckoutFormProps {
  clientSecret: string;
  amount: number; // in cents
  onSuccess: () => void;
  onError?: (message: string) => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#f9fafb',
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: '15px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#6b7280',
      },
      iconColor: '#818cf8',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
};

export function StripeCheckoutForm({
  clientSecret,
  amount,
  onSuccess,
  onError,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setErrorMessage('Card input is not available.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        const message =
          result.error.message ||
          'Payment confirmation failed. Please verify your card details.';
        setErrorMessage(message);
        if (onError) onError(message);
        setIsProcessing(false);
      } else if (
        result.paymentIntent &&
        (result.paymentIntent.status === 'succeeded' ||
          result.paymentIntent.status === 'processing')
      ) {
        setIsSuccess(true);
        setIsProcessing(false);
        onSuccess();
      } else {
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected payment error occurred.';
      setErrorMessage(message);
      if (onError) onError(message);
      setIsProcessing(false);
    }
  };

  const formattedDollars = formatCurrency(amount / 100);

  if (isSuccess) {
    return (
      <div
        data-testid="payment-success-confirmation"
        role="status"
        className="flex flex-col items-center justify-center space-y-3 py-6 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-8 w-8 animate-bounce" />
        </div>
        <h3 className="text-lg font-bold text-white">Payment Confirmed!</h3>
        <p className="max-w-sm text-xs text-gray-300">
          Your payment of <span className="font-semibold text-emerald-400">{formattedDollars}</span> has been processed successfully. The service request status is updated to Paid.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Test Mode Helper Callout */}
      <div className="flex items-center space-x-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-300">
        <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
        <span>
          <strong className="font-semibold">Stripe Test Mode:</strong> Use test card <code className="font-mono text-white">4242 4242 4242 4242</code> with any future expiration date.
        </span>
      </div>

      {/* Card Input Container */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-300">
          Card Details
        </label>
        <div
          data-testid="stripe-card-element"
          className="rounded-lg border border-[#1f293d] bg-[#090d16] p-3.5 shadow-inner transition focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
        >
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          data-testid="payment-error-alert"
          role="alert"
          className="flex items-start space-x-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Pay Submit Button */}
      <button
        type="submit"
        data-testid="pay-button"
        disabled={isProcessing || !stripe}
        className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111827] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing Secure Payment...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Pay {formattedDollars}</span>
          </>
        )}
      </button>

      {/* Security Disclaimer */}
      <p className="flex items-center justify-center space-x-1.5 text-center text-[11px] text-gray-500">
        <CreditCard className="h-3 w-3" />
        <span>End-to-end encrypted with Stripe • PCI Service Provider Level 1</span>
      </p>
    </form>
  );
}
