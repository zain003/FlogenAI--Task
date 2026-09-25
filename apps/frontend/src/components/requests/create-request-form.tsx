'use client';

import React, { useState } from 'react';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
} from '@/lib/api-client';
import { PlusCircle, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface CreateRequestFormProps {
  onRequestCreated?: (newRequest: ServiceRequestEntity) => void;
  className?: string;
}

export function CreateRequestForm({ onRequestCreated, className = '' }: CreateRequestFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    budget?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: { title?: string; description?: string; budget?: string } = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errors.title = 'Service title is required';
    } else if (trimmedTitle.length < 3 || trimmedTitle.length > 100) {
      errors.title = 'Title must be between 3 and 100 characters';
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = 'Description is required';
    } else if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) {
      errors.description = 'Description must be between 10 and 2000 characters';
    }

    const parsedBudget = parseFloat(budget);
    if (!budget || budget.trim() === '') {
      errors.budget = 'Budget is required';
    } else if (isNaN(parsedBudget) || parsedBudget <= 0) {
      errors.budget = 'Budget must be a positive number greater than 0';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await apiClient.requests.create({
        title: title.trim(),
        description: description.trim(),
        budget: parseFloat(budget),
      });

      setTitle('');
      setDescription('');
      setBudget('');
      setFieldErrors({});
      setSuccessMessage('Service request published successfully!');

      if (onRequestCreated) {
        onRequestCreated(created);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred while creating your request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-[#1f293d] bg-[#111827] p-6 shadow-xl ${className}`}
      data-testid="create-request-form-container"
    >
      <div className="mb-5 flex items-center space-x-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
          <PlusCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Create Service Request</h2>
          <p className="text-xs text-gray-400">
            Publish your job requirements to connect with verified service providers.
          </p>
        </div>
      </div>

      {apiError && (
        <div
          data-testid="error-alert"
          role="alert"
          className="mb-4 flex items-center space-x-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{apiError}</span>
        </div>
      )}

      {successMessage && (
        <div
          data-testid="success-alert"
          role="status"
          className="mb-4 flex items-center space-x-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} data-testid="create-request-form" className="space-y-4">
        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-xs font-medium text-gray-300">
            Service Title <span className="text-indigo-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            data-testid="request-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            placeholder="e.g., Emergency Plumbing or Electrical Inspection"
            aria-invalid={!!fieldErrors.title}
            aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            className={`mt-1.5 w-full rounded-md border bg-[#090d16] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition ${
              fieldErrors.title
                ? 'border-rose-500 focus:ring-rose-500/40'
                : 'border-[#1f293d] focus:border-indigo-500 focus:ring-indigo-500/30'
            }`}
          />
          {fieldErrors.title && (
            <p id="title-error" data-testid="title-error" className="mt-1 text-xs text-rose-400">
              {fieldErrors.title}
            </p>
          )}
        </div>

        {/* Description Field */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-300">
            Description <span className="text-indigo-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            data-testid="request-description-input"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (fieldErrors.description) {
                setFieldErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="Detailed scope of work, timeline requirements, and any special considerations..."
            aria-invalid={!!fieldErrors.description}
            aria-describedby={fieldErrors.description ? 'description-error' : undefined}
            className={`mt-1.5 w-full rounded-md border bg-[#090d16] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition ${
              fieldErrors.description
                ? 'border-rose-500 focus:ring-rose-500/40'
                : 'border-[#1f293d] focus:border-indigo-500 focus:ring-indigo-500/30'
            }`}
          />
          {fieldErrors.description && (
            <p
              id="description-error"
              data-testid="description-error"
              className="mt-1 text-xs text-rose-400"
            >
              {fieldErrors.description}
            </p>
          )}
        </div>

        {/* Budget Field */}
        <div>
          <label htmlFor="budget" className="block text-xs font-medium text-gray-300">
            Budget (USD) <span className="text-indigo-400">*</span>
          </label>
          <div className="relative mt-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 font-mono">
              $
            </div>
            <input
              id="budget"
              name="budget"
              type="number"
              step="0.01"
              min="0.01"
              data-testid="request-budget-input"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                if (fieldErrors.budget) {
                  setFieldErrors((prev) => ({ ...prev, budget: undefined }));
                }
              }}
              placeholder="150.00"
              aria-invalid={!!fieldErrors.budget}
              aria-describedby={fieldErrors.budget ? 'budget-error' : undefined}
              className={`w-full rounded-md border bg-[#090d16] pl-8 pr-3.5 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition ${
                fieldErrors.budget
                  ? 'border-rose-500 focus:ring-rose-500/40'
                  : 'border-[#1f293d] focus:border-indigo-500 focus:ring-indigo-500/30'
              }`}
            />
          </div>
          {fieldErrors.budget && (
            <p id="budget-error" data-testid="budget-error" className="mt-1 text-xs text-rose-400">
              {fieldErrors.budget}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="create-request-submit-button"
          className="flex w-full items-center justify-center space-x-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 data-testid="loading-spinner" className="h-4 w-4 animate-spin text-white" />
              <span>Publishing Request...</span>
            </>
          ) : (
            <span>Publish Request</span>
          )}
        </button>
      </form>
    </div>
  );
}
