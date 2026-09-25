'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { ApiClientError, UserRole } from '@/lib/api-client';
import { Lock, Mail, User as UserIcon, Loader2, AlertCircle, ShoppingBag, Briefcase } from 'lucide-react';

export function RegisterForm() {
  const { register } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Name must be at least 2 characters long.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      // AuthProvider handles redirection based on role
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setErrorMessage('An account with this email already exists. Please log in instead.');
        } else if (err.statusCode === 400) {
          setErrorMessage(err.message || 'Please check your registration details and try again.');
        } else {
          setErrorMessage(err.message || 'Registration failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-[#1f293d] bg-[#111827] p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Your Account</h1>
        <p className="mt-1 text-sm text-gray-400">
          Join the marketplace as a Customer or Service Provider
        </p>
      </div>

      {/* Role Selection Toggle */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
          I want to join as:
        </label>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Account role selection">
          <button
            type="button"
            data-testid="role-customer-btn"
            onClick={() => setRole('customer')}
            disabled={isSubmitting}
            aria-pressed={role === 'customer'}
            className={`flex items-center justify-center space-x-2 rounded-lg border p-3 text-sm font-medium transition ${
              role === 'customer'
                ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-sm ring-1 ring-indigo-500'
                : 'border-[#1f293d] bg-[#090d16] text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
            <span>Customer</span>
          </button>

          <button
            type="button"
            data-testid="role-provider-btn"
            onClick={() => setRole('provider')}
            disabled={isSubmitting}
            aria-pressed={role === 'provider'}
            className={`flex items-center justify-center space-x-2 rounded-lg border p-3 text-sm font-medium transition ${
              role === 'provider'
                ? 'border-amber-500 bg-amber-500/20 text-white shadow-sm ring-1 ring-amber-500'
                : 'border-[#1f293d] bg-[#090d16] text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            <Briefcase className="h-4 w-4 text-amber-400" />
            <span>Provider</span>
          </button>
        </div>
      </div>

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
        {/* Full Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
            Full Name
          </label>
          <div className="relative mt-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <UserIcon className="h-4 w-4 text-gray-500" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              disabled={isSubmitting}
              className="block w-full rounded-md border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Email Address */}
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
              placeholder="alex@example.com"
              disabled={isSubmitting}
              className="block w-full rounded-md border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
            Password (min. 8 characters)
          </label>
          <div className="relative mt-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-gray-500" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              className="block w-full rounded-md border border-[#1f293d] bg-[#090d16] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Submit Button with Loading Indicator */}
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit-button"
          className="mt-2 flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
              <span>Creating Account...</span>
            </>
          ) : (
            <span>Register as {role === 'customer' ? 'Customer' : 'Provider'}</span>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="mt-6 border-t border-[#1f293d] pt-4 text-center text-xs text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
