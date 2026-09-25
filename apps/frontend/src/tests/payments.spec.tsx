import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentModal } from '@/components/payments/payment-modal';
import { StripeCheckoutForm } from '@/components/payments/stripe-checkout-form';
import { apiClient, OfferEntity } from '@/lib/api-client';

// Mock Stripe React & JS libraries
const mockConfirmCardPayment = vi.fn();
const mockGetElement = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements-container">{children}</div>
  ),
  CardElement: () => (
    <div data-testid="stripe-card-element-input">
      <input data-testid="mock-card-number-input" aria-label="Card number" />
    </div>
  ),
  useStripe: () => ({
    confirmCardPayment: mockConfirmCardPayment,
  }),
  useElements: () => ({
    getElement: mockGetElement.mockReturnValue({}),
  }),
}));

vi.mock('@/lib/stripe-client', () => ({
  getStripe: vi.fn().mockResolvedValue({}),
}));

describe('FEAT-004-FE: Stripe Payment Integration & Checkout UI', () => {
  const mockOffer: OfferEntity = {
    id: 'off-payment-101',
    requestId: 'req-001',
    providerId: 'prov-202',
    price: 250,
    message: 'I can complete the electrical diagnostics and panel replacement.',
    status: 'ACCEPTED',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TEST 1 from Spec: should render payment modal with offer price and Stripe Elements container
  it('should render payment modal with offer price and Stripe Elements container', async () => {
    vi.spyOn(apiClient.payments, 'createIntent').mockResolvedValue({
      clientSecret: 'pi_test_123_secret_456',
      paymentIntentId: 'pi_test_123',
      amount: 25000,
      currency: 'usd',
    });

    render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        offer={mockOffer}
        requestId="req-001"
        requestTitle="Emergency Electrical Diagnostics"
        onPaymentSuccess={vi.fn()}
      />,
    );

    // Initial loading indicator while intent is requested
    expect(screen.getByTestId('payment-intent-loading')).toBeInTheDocument();

    // After backend responds with clientSecret
    await waitFor(() => {
      expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
      expect(screen.getByTestId('payment-modal-price')).toHaveTextContent('$250.00');
      expect(screen.getByText('Emergency Electrical Diagnostics')).toBeInTheDocument();
      expect(screen.getByTestId('stripe-elements-container')).toBeInTheDocument();
      expect(screen.getByTestId('stripe-card-element')).toBeInTheDocument();
      expect(screen.getByTestId('pay-button')).toBeInTheDocument();
    });

    expect(apiClient.payments.createIntent).toHaveBeenCalledWith({
      offerId: mockOffer.id,
    });
  });

  // TEST 2 from Spec: should disable pay button while processing Stripe payment
  it('should disable pay button while processing Stripe payment', async () => {
    // Return a promise that does not immediately resolve to simulate in-flight payment
    let resolvePayment: any;
    mockConfirmCardPayment.mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve;
      }),
    );

    render(
      <StripeCheckoutForm
        clientSecret="pi_test_123_secret_456"
        amount={25000}
        onSuccess={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const payButton = screen.getByTestId('pay-button');
    expect(payButton).toBeEnabled();
    expect(payButton).toHaveTextContent('Pay $250.00');

    // Click pay
    fireEvent.submit(payButton.closest('form')!);

    // During processing: button is disabled and shows spinner
    await waitFor(() => {
      expect(payButton).toBeDisabled();
      expect(screen.getByText(/Processing Secure Payment/i)).toBeInTheDocument();
    });

    // Resolve payment to clean up
    await act(async () => {
      resolvePayment({ paymentIntent: { status: 'succeeded' } });
    });
  });

  // TEST 3 from Spec: should display error alert when card confirmation returns error
  it('should display error alert when card confirmation returns error', async () => {
    const mockOnError = vi.fn();
    mockConfirmCardPayment.mockResolvedValue({
      error: {
        message: 'Your card was declined. Insufficient funds.',
      },
    });

    render(
      <StripeCheckoutForm
        clientSecret="pi_test_123_secret_456"
        amount={25000}
        onSuccess={vi.fn()}
        onError={mockOnError}
      />,
    );

    const payButton = screen.getByTestId('pay-button');
    fireEvent.submit(payButton.closest('form')!);

    await waitFor(() => {
      const errorAlert = screen.getByTestId('payment-error-alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent('Your card was declined. Insufficient funds.');
    });

    expect(mockOnError).toHaveBeenCalledWith('Your card was declined. Insufficient funds.');

    // Button should be re-enabled after error
    expect(screen.getByTestId('pay-button')).toBeEnabled();
  });

  // TEST 4 from Spec: should display payment success confirmation when Stripe confirms payment
  it('should display payment success confirmation when Stripe confirms payment', async () => {
    const mockOnSuccess = vi.fn();
    mockConfirmCardPayment.mockResolvedValue({
      paymentIntent: {
        id: 'pi_test_123',
        status: 'succeeded',
      },
    });

    render(
      <StripeCheckoutForm
        clientSecret="pi_test_123_secret_456"
        amount={25000}
        onSuccess={mockOnSuccess}
      />,
    );

    const payButton = screen.getByTestId('pay-button');
    fireEvent.submit(payButton.closest('form')!);

    await waitFor(() => {
      const successConfirmation = screen.getByTestId('payment-success-confirmation');
      expect(successConfirmation).toBeInTheDocument();
      expect(screen.getByText('Payment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  // Additional Edge Case 1: Close modal when Close button is clicked or Escape pressed
  it('should close payment modal when close button is clicked or Escape key is pressed', async () => {
    const mockOnClose = vi.fn();
    vi.spyOn(apiClient.payments, 'createIntent').mockResolvedValue({
      clientSecret: 'pi_test_123_secret_456',
      paymentIntentId: 'pi_test_123',
      amount: 25000,
      currency: 'usd',
    });

    render(
      <PaymentModal
        isOpen={true}
        onClose={mockOnClose}
        offer={mockOffer}
        requestId="req-001"
        requestTitle="Emergency Electrical Diagnostics"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('close-payment-modal')).toBeInTheDocument();
    });

    // Click close button
    fireEvent.click(screen.getByTestId('close-payment-modal'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  // Additional Edge Case 2: Display error and retry button when backend create-intent fails
  it('should display error message and retry button when create-intent fails', async () => {
    const spyCreateIntent = vi
      .spyOn(apiClient.payments, 'createIntent')
      .mockRejectedValue(new Error('Network error'));

    render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        offer={mockOffer}
        requestId="req-001"
        requestTitle="Emergency Electrical Diagnostics"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText('Could not connect to payment processor. Please try again.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Retry Payment Setup')).toBeInTheDocument();
    });

    // Clicking retry calls createIntent again
    await act(async () => {
      fireEvent.click(screen.getByText('Retry Payment Setup'));
    });
    expect(spyCreateIntent).toHaveBeenCalledTimes(2);
  });
});
