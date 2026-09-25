import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/login-form';
import { AuthProvider } from '@/context/auth-context';
import { apiClient, ApiClientError } from '@/lib/api-client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/login',
}));

describe('LoginForm (Fake DOM / Component Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderWithAuth = () => {
    return render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );
  };

  it('should render login form with email, password fields and submit button', () => {
    renderWithAuth();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  it('should validate empty fields before calling API', async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(apiClient.auth, 'login');

    renderWithAuth();

    // Submit without typing anything
    await user.click(screen.getByTestId('submit-button'));

    expect(loginSpy).not.toHaveBeenCalled();
    const alert = await screen.findByTestId('error-alert');
    expect(alert).toHaveTextContent(/email address is required/i);
  });

  it('should disable submit button and show loading indicator during submission', async () => {
    const user = userEvent.setup();

    // Mock unresolved promise to assert loading state
    let resolveLogin: (val: any) => void;
    vi.spyOn(apiClient.auth, 'login').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderWithAuth();

    await user.type(screen.getByLabelText(/email address/i), 'customer@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');

    const submitBtn = screen.getByTestId('submit-button');
    await user.click(submitBtn);

    // Verify button is disabled and spinner is displayed
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText(/signing in\.\.\./i)).toBeInTheDocument();

    // Resolve login to cleanup
    resolveLogin!({
      accessToken: 'test-jwt-token',
      user: {
        id: 'cust-1',
        email: 'customer@example.com',
        name: 'Customer Test',
        role: 'customer',
      },
    });

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('should display error alert banner when API responds with 401', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient.auth, 'login').mockRejectedValue(
      new ApiClientError('Unauthorized', 401)
    );

    renderWithAuth();

    await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPass123!');
    await user.click(screen.getByTestId('submit-button'));

    const alert = await screen.findByTestId('error-alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/invalid email or password/i);
  });

  it('should store JWT in localStorage and redirect upon successful authentication', async () => {
    const user = userEvent.setup();

    const mockResponse = {
      accessToken: 'jwt-customer-valid-token-123',
      user: {
        id: 'user-c-1',
        email: 'customer@example.com',
        name: 'Jane Customer',
        role: 'customer' as const,
      },
    };

    vi.spyOn(apiClient.auth, 'login').mockResolvedValue(mockResponse);

    renderWithAuth();

    await user.type(screen.getByLabelText(/email address/i), 'customer@example.com');
    await user.type(screen.getByLabelText(/password/i), 'CorrectPassword123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('jwt-customer-valid-token-123');
      expect(mockPush).toHaveBeenCalledWith('/customer/requests');
    });
  });

  it('should display session expired alert banner when stale token eviction occurs (ISSUE-007)', async () => {
    localStorage.setItem('auth_token', 'stale-token');
    vi.spyOn(apiClient.auth, 'getMe').mockRejectedValue(
      new ApiClientError('Unauthorized', 401)
    );

    renderWithAuth();

    const expiredAlert = await screen.findByTestId('session-expired-alert');
    expect(expiredAlert).toBeInTheDocument();
    expect(expiredAlert).toHaveTextContent(/your session has expired\. please sign in again\./i);
  });
});
