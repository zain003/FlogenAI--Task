import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationBar } from '@/components/navigation-bar';
import { AuthProvider } from '@/context/auth-context';
import { apiClient } from '@/lib/api-client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('NavigationBar (Dynamic Auth & Role Indicator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render brand logo, live sync indicator, and auth links when logged out', async () => {
    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/flogen/i)).toBeInTheDocument();
      expect(screen.getByText(/live sync/i)).toBeInTheDocument();
      expect(screen.getByTestId('nav-login-link')).toBeInTheDocument();
      expect(screen.getByTestId('nav-register-link')).toBeInTheDocument();
      expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
    });
  });

  it('should render customer role badge, email, and logout button when authenticated as customer', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-id',
      email: 'customer@market.com',
      name: 'Customer User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role-badge')).toHaveTextContent(/customer/i);
      expect(screen.getByText('Customer User')).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      expect(screen.queryByTestId('nav-login-link')).not.toBeInTheDocument();
    });
  });

  it('should render provider role badge when authenticated as provider', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-id',
      email: 'provider@market.com',
      name: 'Provider Pro',
      role: 'provider',
    });

    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role-badge')).toHaveTextContent(/provider/i);
      expect(screen.getByText('Provider Pro')).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    });
  });

  it('should invoke logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('auth_token', 'valid-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-id',
      email: 'customer@market.com',
      name: 'Customer User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    const logoutBtn = await screen.findByTestId('logout-button');
    await user.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('nav-login-link')).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should toggle mobile menu and render customer links when customer clicks mobile toggle', async () => {
    const user = userEvent.setup();
    localStorage.setItem('auth_token', 'valid-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-id',
      email: 'customer@market.com',
      name: 'Customer User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    const toggleBtn = await screen.findByTestId('mobile-menu-toggle');
    expect(screen.queryByTestId('mobile-nav-menu')).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav-customer-requests')).toBeInTheDocument();

    // Clicking the link closes the mobile menu
    await user.click(screen.getByTestId('mobile-nav-customer-requests'));
    expect(screen.queryByTestId('mobile-nav-menu')).not.toBeInTheDocument();
  });

  it('should render provider links in mobile menu and close on Escape key', async () => {
    const user = userEvent.setup();
    localStorage.setItem('auth_token', 'valid-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-id',
      email: 'provider@market.com',
      name: 'Provider Pro',
      role: 'provider',
    });

    render(
      <AuthProvider>
        <NavigationBar />
      </AuthProvider>
    );

    const toggleBtn = await screen.findByTestId('mobile-menu-toggle');
    await user.click(toggleBtn);

    expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav-provider-browse')).toBeInTheDocument();

    // Press Escape key to close
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('mobile-nav-menu')).not.toBeInTheDocument();
  });
});
