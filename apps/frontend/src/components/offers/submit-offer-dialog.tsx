'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  apiClient,
  ApiClientError,
  CreateOfferDto,
  OfferEntity,
  formatCurrency,
} from '@/lib/api-client';
import { X, DollarSign, MessageSquare, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export interface SubmitOfferDialogProps {
  requestId: string;
  requestTitle: string;
  requestBudget: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (offer: OfferEntity) => void;
}

export function SubmitOfferDialog({
  requestId,
  requestTitle,
  requestBudget,
  isOpen,
  onClose,
  onSuccess,
}: SubmitOfferDialogProps) {
  const [price, setPrice] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ price?: string; message?: string }>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Focus trap & ESC key handling for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus the price input
    const timer = setTimeout(() => {
      priceInputRef.current?.focus();
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  const prevIsOpen = useRef(isOpen);
  // Reset form when opened
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setPrice('');
      setMessage('');
      setError(null);
      setValidationErrors({});
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: { price?: string; message?: string } = {};
    const parsedPrice = parseFloat(price);

    if (!price || isNaN(parsedPrice) || parsedPrice < 1) {
      errors.price = 'Please enter a valid price of at least $1.00';
    }

    if (!message || message.trim().length < 5) {
      errors.message = 'Proposal message must be at least 5 characters long';
    } else if (message.trim().length > 1000) {
      errors.message = 'Proposal message cannot exceed 1000 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    const dto: CreateOfferDto = {
      price: parseFloat(price),
      message: message.trim(),
    };

    try {
      const createdOffer = await apiClient.offers.create(requestId, dto);
      onSuccess(createdOffer);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || 'Failed to submit offer. Please try again.');
      } else {
        setError('An unexpected network error occurred while submitting your offer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-offer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-xl border border-[#1f293d] bg-[#111827] p-6 shadow-2xl sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#1f293d] pb-4">
          <div>
            <h2
              id="submit-offer-title"
              className="text-lg font-bold text-white sm:text-xl"
            >
              Submit Service Offer
            </h2>
            <p className="mt-1 line-clamp-1 text-xs text-gray-400">
              For: <span className="font-medium text-gray-200">{requestTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Budget Reference Box */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs">
          <span className="text-gray-400">Client's Estimated Budget:</span>
          <span className="font-mono font-bold text-emerald-400">
            {formatCurrency(requestBudget)}
          </span>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start space-x-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Offer Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Price Input */}
          <div>
            <label
              htmlFor="offer-price"
              className="block text-xs font-medium text-gray-300"
            >
              Offer Price (USD) <span className="text-rose-400">*</span>
            </label>
            <div className="relative mt-1.5 rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <DollarSign className="h-4 w-4 text-gray-500" />
              </div>
              <input
                ref={priceInputRef}
                id="offer-price"
                name="price"
                type="number"
                step="0.01"
                min="1.00"
                placeholder="250.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-lg border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 font-mono text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {validationErrors.price && (
              <p className="mt-1 text-xs text-rose-400">{validationErrors.price}</p>
            )}
          </div>

          {/* Proposal Message Input */}
          <div>
            <label
              htmlFor="offer-message"
              className="block text-xs font-medium text-gray-300"
            >
              Proposal Message & Timeline <span className="text-rose-400">*</span>
            </label>
            <div className="relative mt-1.5">
              <textarea
                id="offer-message"
                name="message"
                rows={4}
                placeholder="Describe your solution, availability, and warranty for this service..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-lg border border-[#1f293d] bg-[#090d16] p-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>
                {validationErrors.message ? (
                  <span className="text-rose-400">{validationErrors.message}</span>
                ) : (
                  'Minimum 5 characters'
                )}
              </span>
              <span>{message.length}/1000</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end space-x-3 border-t border-[#1f293d] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-[#1f293d] bg-transparent px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoading ? 'Submitting Offer...' : 'Send Offer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
