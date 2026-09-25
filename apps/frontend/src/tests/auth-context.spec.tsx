import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { apiClient, ApiClientError } from '@/lib/api-client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

function ConsumerComponent() {
  const { user, token, isAuthenticated, isLoading, sessionExpired, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user ? user.email : 'no-user'}</div>
      <div data-testid="token-val">{token || 'no-token'}</div>
      <div data-testid="session-expired">{sessionExpired ? 'expired' : 'active'}</div>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
}

describe('AuthContext (Session & Token Lifecycle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with logged-out state when no token in localStorage', async () => {
    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('ready');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(screen.getByTestId('token-val')).toHaveTextContent('no-token');
    });
  });

  it('should restore authenticated session when valid token exists in localStorage', async () => {
    localStorage.setItem('auth_token', 'valid-stored-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'user-restore-1',
      email: 'restored@example.com',
      name: 'Restored User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('ready');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('restored@example.com');
      expect(screen.getByTestId('token-val')).toHaveTextContent('valid-stored-token');
    });
  });

  it('should clear token and reset state when stored token is expired or invalid', async () => {
    localStorage.setItem('auth_token', 'expired-or-malformed-token');

    vi.spyOn(apiClient.auth, 'getMe').mockRejectedValue(
      new ApiClientError('Unauthorized', 401)
    );

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('ready');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
      expect(screen.getByTestId('session-expired')).toHaveTextContent('expired');
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/login?reason=expired');
    });
  });

  it('should clear token and redirect to /login upon logout', async () => {
    const user = userEvent.setup();
    localStorage.setItem('auth_token', 'active-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'user-active-1',
      email: 'active@example.com',
      name: 'Active User',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Click logout
    await user.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
