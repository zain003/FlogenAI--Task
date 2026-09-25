'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isExpired =
    sessionExpired ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('reason') === 'expired');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    if (sessionExpired) clearSessionExpired();

    // Client-side validation before network dispatch
    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
      });
      // AuthProvider handles redirection based on role
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setErrorMessage('Invalid email or password. Please verify your credentials.');
        } else if (err.statusCode === 429) {
          setErrorMessage('Too many login attempts. Please wait a minute and try again.');
        } else {
          setErrorMessage(err.message || 'Authentication failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during login.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-[#1f293d] bg-[#111827] p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Welcome Back</h1>
        <p className="mt-1 text-sm text-gray-400">
          Sign in to access your real-time marketplace dashboard
        </p>
      </div>

      {/* Session Expired Informational Alert Banner */}
      {isExpired && !errorMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="session-expired-alert"
          className="mb-5 flex items-start space-x-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1 font-medium">Your session has expired. Please sign in again.</div>
        </div>
      )}

      {/* Prominent Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="error-alert"
          className="mb-5 flex items-start space-x-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
            Email Address
          </label>
          <div className="relative mt-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-gray-500" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              className="block w-full rounded-md border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
            Password
          </label>
          <div className="relative mt-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-gray-500" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className="block w-full rounded-md border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Submit Button with Loading Spinner */}
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit-button"
          className="mt-2 flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
              <span>Signing In...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="mt-6 border-t border-[#1f293d] pt-4 text-center text-xs text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}
