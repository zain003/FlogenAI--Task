import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CustomerRequestsPage from '@/app/customer/requests/page';
import ProviderBrowsePage from '@/app/provider/browse/page';
import { AuthProvider } from '@/context/auth-context';
import { SocketProvider } from '@/context/socket-context';
import { apiClient } from '@/lib/api-client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('ISSUE-005: Client-Side Route Protection & Role Redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should redirect unauthenticated visitor on /customer/requests to /login', async () => {
    render(
      <AuthProvider>
        <CustomerRequestsPage />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should redirect provider visiting /customer/requests to /provider/browse', async () => {
    localStorage.setItem('auth_token', 'prov-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-101',
      email: 'provider@market.com',
      name: 'Provider User',
      role: 'provider',
    });

    render(
      <AuthProvider>
        <CustomerRequestsPage />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/provider/browse');
    });
  });

  it('should redirect unauthenticated visitor on /provider/browse to /login', async () => {
    render(
      <AuthProvider>
        <SocketProvider>
          <ProviderBrowsePage />
        </SocketProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should redirect customer visiting /provider/browse to /customer/requests', async () => {
    localStorage.setItem('auth_token', 'cust-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-101',
      email: 'customer@market.com',
      name: 'Customer User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <ProviderBrowsePage />
        </SocketProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/customer/requests');
    });
  });
});
