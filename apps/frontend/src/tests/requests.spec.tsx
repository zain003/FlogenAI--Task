import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRequestForm } from '@/components/requests/create-request-form';
import { RequestCard } from '@/components/requests/request-card';
import CustomerRequestsPage from '@/app/customer/requests/page';
import ProviderBrowsePage from '@/app/provider/browse/page';
import RequestDetailPage from '@/app/requests/[id]/page';
import { AuthProvider } from '@/context/auth-context';
import {
  apiClient,
  ApiClientError,
  ServiceRequestEntity,
  formatCurrency,
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
  usePathname: () => '/customer/requests',
  useParams: () => mockParams,
}));

describe('FEAT-002-FE: Service Requests UI & Feeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockOpenRequest: ServiceRequestEntity = {
    id: 'req-001',
    title: 'Emergency Plumbing Repair',
    description: 'Leaking pipe under kitchen sink requiring immediate pipe replacement and sealing.',
    budget: 150,
    status: 'OPEN',
    customerId: 'cust-101',
    createdAt: new Date().toISOString(),
  };

  const mockAcceptedRequest: ServiceRequestEntity = {
    id: 'req-002',
    title: 'Electrical Panel Upgrade',
    description: 'Upgrade residential 100A panel to 200A breaker box with city permit inspection.',
    budget: 850.5,
    status: 'ACCEPTED',
    customerId: 'cust-101',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  };

  // Test 1: should render create request form with title, description, budget inputs
  it('should render create request form with title, description, budget inputs', () => {
    render(<CreateRequestForm />);

    expect(screen.getByRole('heading', { name: /create service request/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/service title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget/i)).toBeInTheDocument();
    expect(screen.getByTestId('create-request-submit-button')).toBeInTheDocument();
  });

  // Test 2: should validate budget is a positive number before submitting
  it('should validate budget is at least $1.00 before submitting', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(apiClient.requests, 'create');

    render(<CreateRequestForm />);

    await user.type(screen.getByLabelText(/service title/i), 'Fix Kitchen Sink');
    await user.type(screen.getByLabelText(/description/i), 'Comprehensive pipe repair under the sink.');

    // 1. Submit with zero budget
    await user.type(screen.getByLabelText(/budget/i), '0');
    await user.click(screen.getByTestId('create-request-submit-button'));

    expect(createSpy).not.toHaveBeenCalled();
    let budgetError = await screen.findByTestId('budget-error');
    expect(budgetError).toHaveTextContent(/at least \$1\.00/i);

    // 2. Submit with negative budget
    await user.clear(screen.getByLabelText(/budget/i));
    await user.type(screen.getByLabelText(/budget/i), '-50');
    await user.click(screen.getByTestId('create-request-submit-button'));

    expect(createSpy).not.toHaveBeenCalled();
    budgetError = await screen.findByTestId('budget-error');
    expect(budgetError).toHaveTextContent(/at least \$1\.00/i);

    // 3. Submit with sub-dollar budget (ISSUE-006)
    await user.clear(screen.getByLabelText(/budget/i));
    await user.type(screen.getByLabelText(/budget/i), '0.75');
    await user.click(screen.getByTestId('create-request-submit-button'));

    expect(createSpy).not.toHaveBeenCalled();
    budgetError = await screen.findByTestId('budget-error');
    expect(budgetError).toHaveTextContent(/at least \$1\.00/i);
  });

  // Test 3: should render list of open requests with title and budget formatted as USD
  it('should render list of open requests with title and budget formatted as USD', () => {
    render(<RequestCard request={mockOpenRequest} viewMode="provider" />);

    expect(screen.getByTestId('request-title')).toHaveTextContent('Emergency Plumbing Repair');
    expect(screen.getByTestId('request-budget')).toHaveTextContent('$150.00');
    expect(screen.getByTestId('request-status')).toHaveTextContent('OPEN');

    // Also verify decimal formatting on another card
    const { unmount } = render(<RequestCard request={mockAcceptedRequest} viewMode="customer" />);
    expect(screen.getAllByTestId('request-budget')[1]).toHaveTextContent('$850.50');
    expect(screen.getAllByTestId('request-status')[1]).toHaveTextContent('ACCEPTED');
    unmount();
  });

  // Test 4: should display empty state message when no requests exist
  it('should display empty state message when no requests exist', async () => {
    vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    render(<ProviderBrowsePage />);

    const emptyMessage = await screen.findByTestId('empty-state');
    expect(emptyMessage).toBeInTheDocument();
    expect(emptyMessage).toHaveTextContent(/no service requests found/i);
  });

  // Test 5: should navigate to request detail page upon clicking request card
  it('should navigate to request detail page upon clicking request card', async () => {
    const user = userEvent.setup();

    render(<RequestCard request={mockOpenRequest} viewMode="provider" />);

    const actionBtn = screen.getByTestId('request-action-button');
    expect(actionBtn).toBeInTheDocument();
    await user.click(actionBtn);

    expect(mockPush).toHaveBeenCalledWith('/requests/req-001');
  });

  // Acceptance Criteria: Submitting valid request form calls POST /api/requests and immediately appends new request to customer list
  it('should submit valid request form and immediately append new request to customer list', async () => {
    const user = userEvent.setup();

    // Mock initial getMyRequests returning empty list
    vi.spyOn(apiClient.requests, 'getMyRequests').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    // Mock successful create
    const createdRequest: ServiceRequestEntity = {
      id: 'req-new-999',
      title: 'Full HVAC Inspection',
      description: 'Annual heat pump and AC comprehensive inspection before summer.',
      budget: 250,
      status: 'OPEN',
      customerId: 'cust-101',
      createdAt: new Date().toISOString(),
    };
    vi.spyOn(apiClient.requests, 'create').mockResolvedValue(createdRequest);

    // Mock authenticated customer
    localStorage.setItem('auth_token', 'cust-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-101',
      email: 'customer@test.com',
      name: 'Customer Test',
      role: 'customer',
    });

    render(
      <AuthProvider>
        <CustomerRequestsPage />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    // Fill the create form
    await user.type(screen.getByLabelText(/service title/i), 'Full HVAC Inspection');
    await user.type(
      screen.getByLabelText(/description/i),
      'Annual heat pump and AC comprehensive inspection before summer.'
    );
    await user.type(screen.getByLabelText(/budget/i), '250');

    // Submit form
    await user.click(screen.getByTestId('create-request-submit-button'));

    // Verify API called with proper DTO
    await waitFor(() => {
      expect(apiClient.requests.create).toHaveBeenCalledWith({
        title: 'Full HVAC Inspection',
        description: 'Annual heat pump and AC comprehensive inspection before summer.',
        budget: 250,
      });
    });

    // Verify new request is immediately rendered in the customer list without full page refresh
    await waitFor(() => {
      expect(screen.getByText('Full HVAC Inspection')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });
  });

  // Acceptance Criteria: Provider browse page displays all open requests with formatted budget
  it('should display all open requests with formatted budget on provider browse page', async () => {
    vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [mockOpenRequest],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(<ProviderBrowsePage />);

    await waitFor(() => {
      expect(screen.getByText('Emergency Plumbing Repair')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
    });
  });

  // Request Detail Page: Render summary, full description, metadata, and offers placeholder
  it('should render request detail page with full description, formatted budget, and offers placeholder', async () => {
    mockParams = { id: 'req-001' };
    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockOpenRequest);

    render(<RequestDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('request-detail-title')).toHaveTextContent('Emergency Plumbing Repair');
      expect(screen.getByTestId('request-detail-budget')).toHaveTextContent('$150.00');
      expect(screen.getByTestId('request-detail-description')).toHaveTextContent(
        'Leaking pipe under kitchen sink requiring immediate pipe replacement and sealing.'
      );
      expect(screen.getByText(/incoming offers & proposals/i)).toBeInTheDocument();
    });
  });

  // Request Detail Page: Error handling on 404 / API failure
  it('should display error message on detail page when request is not found', async () => {
    mockParams = { id: 'non-existent-id' };
    vi.spyOn(apiClient.requests, 'getById').mockRejectedValue(
      new ApiClientError('Service request not found', 404)
    );

    render(<RequestDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /request not found/i })).toBeInTheDocument();
      expect(screen.getByText('Service request not found')).toBeInTheDocument();
    });
  });

  // Edge Case: Currency formatting helper handles integers, decimals, NaN cleanly
  it('should format currency correctly for edge cases', () => {
    expect(formatCurrency(150)).toBe('$150.00');
    expect(formatCurrency(850.5)).toBe('$850.50');
    expect(formatCurrency(1234.99)).toBe('$1,234.99');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(NaN)).toBe('$0.00');
  });
});

