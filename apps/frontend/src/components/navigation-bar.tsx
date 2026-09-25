'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useSocket } from '@/context/socket-context';
import { LogOut, User as UserIcon, Shield, Radio, Menu, X } from 'lucide-react';

export function NavigationBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { isConnected } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  return (
    <header ref={menuRef} className="sticky top-0 z-50 w-full border-b border-[#1f293d] bg-[#111827]/90 backdrop-blur-md">
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

        {/* Dynamic Navigation Links (Desktop) */}
        {isAuthenticated && (
          <nav className="hidden items-center space-x-5 sm:flex">
            {user?.role === 'customer' && (
              <Link
                href="/customer/requests"
                data-testid="nav-customer-requests"
                className="text-xs font-medium text-gray-300 transition hover:text-indigo-400"
              >
                My Requests
              </Link>
            )}
            {user?.role === 'provider' && (
              <Link
                href="/provider/browse"
                data-testid="nav-provider-browse"
                className="text-xs font-medium text-gray-300 transition hover:text-emerald-400"
              >
                Browse Marketplace
              </Link>
            )}
          </nav>
        )}

        {/* Live Status & User Area */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Socket.IO Connection Pill Indicator */}
          <div
            data-testid="live-sync-indicator"
            className={`flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
              isConnected
                ? 'border border-emerald-900/60 bg-emerald-950/40 text-emerald-400'
                : 'border border-gray-700/60 bg-gray-800/40 text-gray-400'
            }`}
            title={isConnected ? 'Real-Time Engine Online' : 'Live Sync Connecting...'}
          >
            <Radio
              className={`h-3.5 w-3.5 ${
                isConnected ? 'animate-pulse text-emerald-400' : 'text-gray-500'
              }`}
            />
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
                <span className="hidden xs:inline">Logout</span>
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

          {/* Mobile Menu Hamburger Button */}
          {isAuthenticated && (
            <button
              type="button"
              data-testid="mobile-menu-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-gray-800/80 text-gray-300 transition hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isAuthenticated && mobileMenuOpen && (
        <div
          data-testid="mobile-nav-menu"
          className="border-t border-[#1f293d] bg-[#111827] px-4 py-3 sm:hidden"
        >
          <div className="flex flex-col space-y-2">
            {user?.role === 'customer' && (
              <Link
                href="/customer/requests"
                data-testid="mobile-nav-customer-requests"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800 hover:text-indigo-400"
              >
                My Requests
              </Link>
            )}
            {user?.role === 'provider' && (
              <Link
                href="/provider/browse"
                data-testid="mobile-nav-provider-browse"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800 hover:text-emerald-400"
              >
                Browse Marketplace
              </Link>
            )}
            <div className="border-t border-gray-800 pt-2">
              <div className="px-3 py-1 text-xs text-gray-400">
                Signed in as <span className="font-semibold text-gray-200">{user?.name || user?.email}</span> ({user?.role})
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
