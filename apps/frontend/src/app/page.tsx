import React from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, ShieldCheck, Activity, Users, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Background Gradient Orbs */}
      <div
        className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl opacity-30 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#6366f1] to-[#10b981]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300">
            <Zap className="h-3.5 w-3.5 text-indigo-400" />
            <span>High-Throughput Real-Time Marketplace</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Real-Time Service Exchange with{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
              Zero-Race Integrity
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-gray-300">
            Connect customers and service providers instantly. Features millisecond-latency offer dispatch, distributed Redis mutex protection against double-acceptance, and cryptographic Stripe payment guarantees.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-5">
            <Link
              href="/register"
              id="hero-register-btn"
              className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span>Get Started Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              id="hero-login-btn"
              className="rounded-lg border border-[#1f293d] bg-[#111827] px-6 py-3.5 text-base font-semibold text-gray-200 transition hover:border-gray-600 hover:text-white"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-[#1f293d] bg-[#111827]/80 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <Activity className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Live Event Synchronization</h2>
            <p className="mt-2 text-sm text-gray-400">
              Socket.IO clusters linked via Redis Pub/Sub ensure requests, bids, and chat messages broadcast across backend nodes in milliseconds.
            </p>
          </div>

          <div className="rounded-xl border border-[#1f293d] bg-[#111827]/80 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Deterministic Concurrency</h2>
            <p className="mt-2 text-sm text-gray-400">
              Distributed Redis locking and atomic MongoDB mutations physically eliminate double-acceptances under high concurrency.
            </p>
          </div>

          <div className="rounded-xl border border-[#1f293d] bg-[#111827]/80 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Strict Role Isolation</h2>
            <p className="mt-2 text-sm text-gray-400">
              End-to-end RBAC guards for Customers and Providers, cryptographically signed JWTs, and secure Stripe webhook idempotency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
