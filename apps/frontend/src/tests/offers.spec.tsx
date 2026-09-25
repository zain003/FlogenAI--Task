import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfferList } from '@/components/offers/offer-list';
import { OfferCard } from '@/components/offers/offer-card';
import { SubmitOfferDialog } from '@/components/offers/submit-offer-dialog';
import { AuthContext, AuthContextType } from '@/context/auth-context';
import {
  apiClient,
  ApiClientError,
  OfferEntity,
} from '@/lib/api-client';

const mockPush = vi.fn();
let mockParams = { id: 'req-001' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/requests/req-001',
  useParams: () => mockParams,
}));

describe('FEAT-003-FE: Offers UI & Customer Acceptance Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockProviderAuth: AuthContextType = {
    user: {
      id: 'prov-101',
      email: 'provider@test.com',
      name: 'Bob Builder',
      role: 'provider',
    },
    token: 'provider-jwt-token',
    isLoading: false,
    isAuthenticated: true,
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const mockCustomerAuth: AuthContextType = {
    user: {
      id: 'cust-101',
      email: 'alice@test.com',
      name: 'Alice Customer',
      role: 'customer',
    },
    token: 'customer-jwt-token',
    isLoading: false,
    isAuthenticated: true,
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  const mockOffer1: OfferEntity = {
    id: 'off-001',
    requestId: 'req-001',
    providerId: 'prov-101',
    price: 250,
    message: 'Expert plumbing repair with 90-day warranty.',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  const mockOffer2: OfferEntity = {
    id: 'off-002',
    requestId: 'req-001',
    providerId: 'prov-102',
    price: 320,
    message: 'Can start this afternoon with all required parts in truck.',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  };

  // 1. should render submit offer button only for provider users
  it('should render submit offer button only for provider users', async () => {
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    // Render as Provider
    const { unmount } = render(
      <AuthContext.Provider value={mockProviderAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={false}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-submit-offer-button')).toBeDefined();
    });

    unmount();

    // Render as Customer
    render(
      <AuthContext.Provider value={mockCustomerAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={true}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('open-submit-offer-button')).toBeNull();
    });
  });

  // 2. should validate offer price is greater than 0 before submission
  it('should validate offer price is greater than 0 before submission', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const createOfferSpy = vi.spyOn(apiClient.offers, 'create');

    render(
      <SubmitOfferDialog
        requestId="req-001"
        requestTitle="Kitchen Pipe Leak"
        requestBudget={300}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    const priceInput = screen.getByLabelText(/Offer Price/i);
    const messageInput = screen.getByLabelText(/Proposal Message/i);
    const submitBtn = screen.getByRole('button', { name: /Send Offer/i });

    // Submit with empty price
    await user.type(messageInput, 'Valid proposal message here');
    await user.click(submitBtn);

    expect(
      screen.getByText(/Please enter a valid price greater than \$0.00/i),
    ).toBeDefined();
    expect(createOfferSpy).not.toHaveBeenCalled();

    // Submit with negative price
    await user.type(priceInput, '-50');
    await user.click(submitBtn);

    expect(
      screen.getByText(/Please enter a valid price greater than \$0.00/i),
    ).toBeDefined();
    expect(createOfferSpy).not.toHaveBeenCalled();
  });

  // 3. should validate proposal message length before submission
  it('should validate proposal message length before submission', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const createOfferSpy = vi.spyOn(apiClient.offers, 'create');

    render(
      <SubmitOfferDialog
        requestId="req-001"
        requestTitle="Kitchen Pipe Leak"
        requestBudget={300}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />,
    );

    const priceInput = screen.getByLabelText(/Offer Price/i);
    const messageInput = screen.getByLabelText(/Proposal Message/i);
    const submitBtn = screen.getByRole('button', { name: /Send Offer/i });

    await user.type(priceInput, '200');
    await user.type(messageInput, 'Hi');
    await user.click(submitBtn);

    expect(
      screen.getByText(/Proposal message must be at least 5 characters long/i),
    ).toBeDefined();
    expect(createOfferSpy).not.toHaveBeenCalled();
  });

  // 4. should submit valid offer and trigger onSuccess callback
  it('should submit valid offer and trigger onSuccess callback', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.spyOn(apiClient.offers, 'create').mockResolvedValue(mockOffer1);

    render(
      <SubmitOfferDialog
        requestId="req-001"
        requestTitle="Kitchen Pipe Leak"
        requestBudget={300}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    const priceInput = screen.getByLabelText(/Offer Price/i);
    const messageInput = screen.getByLabelText(/Proposal Message/i);
    const submitBtn = screen.getByRole('button', { name: /Send Offer/i });

    fireEvent.change(priceInput, { target: { value: '250' } });
    fireEvent.change(messageInput, {
      target: { value: 'Expert plumbing repair with 90-day warranty.' },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.offers.create).toHaveBeenCalledWith('req-001', {
        price: 250,
        message: 'Expert plumbing repair with 90-day warranty.',
      });
      expect(handleSuccess).toHaveBeenCalledWith(mockOffer1);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // 5. should render list of offers with price, provider name, and message
  it('should render list of offers with price, provider name, and message', async () => {
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer1, mockOffer2],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(
      <AuthContext.Provider value={mockCustomerAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={true}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('$250.00')).toBeDefined();
      expect(screen.getByText('$320.00')).toBeDefined();
      expect(
        screen.getByText('Expert plumbing repair with 90-day warranty.'),
      ).toBeDefined();
      expect(
        screen.getByText('Can start this afternoon with all required parts in truck.'),
      ).toBeDefined();
      expect(screen.getByText('Provider #ov-101')).toBeDefined();
      expect(screen.getByText('Provider #ov-102')).toBeDefined();
    });
  });

  // 6. should trigger accept offer mutation when customer clicks accept
  it('should trigger accept offer mutation when customer clicks accept', async () => {
    const user = userEvent.setup();
    const handleOfferAccepted = vi.fn();

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer1, mockOffer2],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    const acceptedResult: OfferEntity = {
      ...mockOffer1,
      status: 'ACCEPTED',
    };

    vi.spyOn(apiClient.offers, 'accept').mockResolvedValue({
      success: true,
      offer: acceptedResult,
      paymentPending: true,
    });

    render(
      <AuthContext.Provider value={mockCustomerAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={true}
          onOfferAccepted={handleOfferAccepted}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`accept-offer-button-${mockOffer1.id}`)).toBeDefined();
    });

    const acceptBtn1 = screen.getByTestId(`accept-offer-button-${mockOffer1.id}`);
    await user.click(acceptBtn1);

    await waitFor(() => {
      expect(apiClient.offers.accept).toHaveBeenCalledWith(mockOffer1.id);
      expect(handleOfferAccepted).toHaveBeenCalledWith(acceptedResult);
      // Status badge for accepted offer should now say Accepted
      expect(screen.getByTestId('offer-status-accepted')).toBeDefined();
      // Status badge for peer offer should now say Rejected
      expect(screen.getByTestId('offer-status-rejected')).toBeDefined();
      // Success message displayed
      expect(
        screen.getByText(/Offer accepted successfully!/i),
      ).toBeDefined();
    });
  });

  // 7. should disable accept buttons on all offers once one offer is accepted
  it('should disable accept buttons on all offers once one offer is accepted', async () => {
    const acceptedOffer: OfferEntity = {
      ...mockOffer1,
      status: 'ACCEPTED',
    };
    const rejectedOffer: OfferEntity = {
      ...mockOffer2,
      status: 'REJECTED',
    };

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [acceptedOffer, rejectedOffer],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(
      <AuthContext.Provider value={mockCustomerAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="ACCEPTED"
          isCustomerOwner={true}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      // No accept buttons should exist in the DOM once finalized
      expect(screen.queryByTestId(`accept-offer-button-${mockOffer1.id}`)).toBeNull();
      expect(screen.queryByTestId(`accept-offer-button-${mockOffer2.id}`)).toBeNull();
      expect(screen.getByText(/Winning Offer • Ready for Payment/i)).toBeDefined();
      expect(screen.getByText(/Offer not selected/i)).toBeDefined();
    });
  });

  // 8. Provider cannot see the Accept button
  it('should NOT render accept button for provider users', async () => {
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer1],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthContext.Provider value={mockProviderAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={false} // Provider does not own the request
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId(`accept-offer-button-${mockOffer1.id}`)).toBeNull();
      expect(screen.queryByText(/Accept Offer/i)).toBeNull();
    });
  });

  // 9. Edge case: Display error alert when acceptance fails with 409 conflict
  it('should display error alert when acceptance fails with 409 conflict', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer1],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    vi.spyOn(apiClient.offers, 'accept').mockRejectedValue(
      new ApiClientError(
        'Service request has already been accepted',
        409,
      ),
    );

    render(
      <AuthContext.Provider value={mockCustomerAuth}>
        <OfferList
          requestId="req-001"
          requestTitle="Kitchen Pipe Leak"
          requestBudget={300}
          requestStatus="OPEN"
          isCustomerOwner={true}
        />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`accept-offer-button-${mockOffer1.id}`)).toBeDefined();
    });

    const acceptBtn = screen.getByTestId(`accept-offer-button-${mockOffer1.id}`);
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          /This request has already been accepted or is currently locked by another operation./i,
        ),
      ).toBeDefined();
    });
  });
});
