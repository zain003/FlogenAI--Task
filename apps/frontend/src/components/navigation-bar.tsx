'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { LogOut, User as UserIcon, Shield, Radio } from 'lucide-react';

export function NavigationBar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1f293d] bg-[#111827]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl font-bold tracking-tight text-white transition hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-black text-white shadow-md">
              F
            </div>
            <span>
              Flogen<span className="text-indigo-400">AI</span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-gray-700 bg-gray-800/80 px-2.5 py-0.5 text-xs font-medium text-gray-300 md:inline-block">
            Marketplace
          </span>
        </div>

        {/* Live Status & User Area */}
        <div className="flex items-center space-x-4">
          {/* Socket.IO Connection Pill Indicator */}
          <div
            className="flex items-center space-x-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400"
            title="Real-Time Engine Online"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            <span className="hidden sm:inline">Live Sync</span>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              {/* Role Badge */}
              <div
                data-testid="role-badge"
                className={`flex items-center space-x-1 rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                  user.role === 'customer'
                    ? 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                    : 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                <Shield className="h-3 w-3" />
                <span>{user.role}</span>
              </div>

              {/* User Email / Name */}
              <div className="hidden items-center space-x-1.5 text-sm text-gray-300 md:flex">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="max-w-[150px] truncate" title={user.email}>
                  {user.name || user.email}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                data-testid="logout-button"
                className="flex items-center space-x-1.5 rounded-md border border-gray-700 bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                data-testid="nav-login-link"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:text-white"
              >
                Log In
              </Link>
              <Link
                href="/register"
                data-testid="nav-register-link"
                className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
