import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/components/auth/register-form';
import { AuthProvider } from '@/context/auth-context';
import { apiClient, ApiClientError } from '@/lib/api-client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/register',
}));

describe('RegisterForm (Fake DOM / Component Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderWithAuth = () => {
    return render(
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>
    );
  };

  it('should render registration form with name, email, password fields and role toggle', () => {
    renderWithAuth();

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByTestId('role-customer-btn')).toBeInTheDocument();
    expect(screen.getByTestId('role-provider-btn')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  it('should switch form role between customer and provider on register page', async () => {
    const user = userEvent.setup();
    renderWithAuth();

    const customerBtn = screen.getByTestId('role-customer-btn');
    const providerBtn = screen.getByTestId('role-provider-btn');
    const submitBtn = screen.getByTestId('submit-button');

    // Default role is customer
    expect(customerBtn).toHaveAttribute('aria-pressed', 'true');
    expect(providerBtn).toHaveAttribute('aria-pressed', 'false');
    expect(submitBtn).toHaveTextContent(/register as customer/i);

    // Switch to provider
    await user.click(providerBtn);

    expect(customerBtn).toHaveAttribute('aria-pressed', 'false');
    expect(providerBtn).toHaveAttribute('aria-pressed', 'true');
    expect(submitBtn).toHaveTextContent(/register as provider/i);

    // Switch back to customer
    await user.click(customerBtn);
    expect(customerBtn).toHaveAttribute('aria-pressed', 'true');
    expect(submitBtn).toHaveTextContent(/register as customer/i);
  });

  it('should validate short name, invalid email, or short password before calling API', async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(apiClient.auth, 'register');

    renderWithAuth();

    // 1. Empty / 1 character name
    await user.type(screen.getByLabelText(/full name/i), 'A');
    await user.click(screen.getByTestId('submit-button'));
    expect(registerSpy).not.toHaveBeenCalled();
    let alert = await screen.findByTestId('error-alert');
    expect(alert).toHaveTextContent(/name must be at least 2 characters/i);

    // 2. Invalid email
    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), 'Alex Doe');
    await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
    await user.click(screen.getByTestId('submit-button'));
    expect(registerSpy).not.toHaveBeenCalled();
    alert = await screen.findByTestId('error-alert');
    expect(alert).toHaveTextContent(/valid email/i);

    // 3. Short password (< 8 chars)
    await user.clear(screen.getByLabelText(/email address/i));
    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByTestId('submit-button'));
    expect(registerSpy).not.toHaveBeenCalled();
    alert = await screen.findByTestId('error-alert');
    expect(alert).toHaveTextContent(/password must be at least 8 characters/i);
  });

  it('should disable submit button and show loading indicator during submission', async () => {
    const user = userEvent.setup();

    let resolveRegister: (val: any) => void;
    vi.spyOn(apiClient.auth, 'register').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    renderWithAuth();

    await user.type(screen.getByLabelText(/full name/i), 'Sam Builder');
    await user.type(screen.getByLabelText(/email address/i), 'sam@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecurePassword123!');

    const submitBtn = screen.getByTestId('submit-button');
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText(/creating account\.\.\./i)).toBeInTheDocument();

    resolveRegister!({
      accessToken: 'test-token',
      user: {
        id: 'user-1',
        email: 'sam@example.com',
        name: 'Sam Builder',
        role: 'customer',
      },
    });

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('should display error alert banner when API responds with 409', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient.auth, 'register').mockRejectedValue(
      new ApiClientError('An account with this email already exists', 409)
    );

    renderWithAuth();

    await user.type(screen.getByLabelText(/full name/i), 'Duplicate User');
    await user.type(screen.getByLabelText(/email address/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
    await user.click(screen.getByTestId('submit-button'));

    const alert = await screen.findByTestId('error-alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/already exists/i);
  });

  it('should register provider and redirect to /provider/browse with stored JWT', async () => {
    const user = userEvent.setup();

    const mockResponse = {
      accessToken: 'jwt-provider-token-xyz',
      user: {
        id: 'user-p-1',
        email: 'provider@example.com',
        name: 'Bob Handyman',
        role: 'provider' as const,
      },
    };

    const registerSpy = vi.spyOn(apiClient.auth, 'register').mockResolvedValue(mockResponse);

    renderWithAuth();

    // Select provider role
    await user.click(screen.getByTestId('role-provider-btn'));

    await user.type(screen.getByLabelText(/full name/i), 'Bob Handyman');
    await user.type(screen.getByLabelText(/email address/i), 'provider@example.com');
    await user.type(screen.getByLabelText(/password/i), 'ProviderSecure123!');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        name: 'Bob Handyman',
        email: 'provider@example.com',
        password: 'ProviderSecure123!',
        role: 'provider',
      });
      expect(localStorage.getItem('auth_token')).toBe('jwt-provider-token-xyz');
      expect(mockPush).toHaveBeenCalledWith('/provider/browse');
    });
  });
});
