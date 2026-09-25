import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import RequestDetailPage from '@/app/requests/[id]/page';
import { AuthProvider } from '@/context/auth-context';
import { SocketProvider } from '@/context/socket-context';
import { apiClient, ServiceRequestEntity, OfferEntity } from '@/lib/api-client';
import { EventEmitter } from 'events';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'req-reconcile-101' }),
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/requests/req-reconcile-101',
}));

// Mock Stripe React & JS
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardElement: () => <div>Mock Card Element</div>,
  useStripe: () => ({ confirmCardPayment: vi.fn() }),
  useElements: () => ({ getElement: vi.fn() }),
}));

vi.mock('@/lib/stripe-client', () => ({
  getStripe: vi.fn().mockResolvedValue({}),
}));

class MockSocket extends EventEmitter {
  public connected = true;
  public auth: any;
  public id = 'mock-reconcile-socket-id';

  constructor(public url: string, public options: any) {
    super();
    this.auth = options?.auth;
  }

  connect() {
    this.connected = true;
    this.emit('connect');
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect');
    return this;
  }
}

let activeMockSocket: MockSocket | null = null;

vi.mock('socket.io-client', () => ({
  io: vi.fn().mockImplementation((url, options) => {
    activeMockSocket = new MockSocket(url, options);
    return activeMockSocket;
  }),
}));

describe('FEAT-004-INT: Real-Time Payment Reconciliation & Chat Unlock', () => {
  const mockAcceptedRequest: ServiceRequestEntity = {
    id: 'req-reconcile-101',
    title: 'Commercial HVAC System Overhaul',
    description: 'Replace rooftop air compressor and calibrate air handlers.',
    budget: 3500,
    status: 'ACCEPTED',
    acceptedOfferId: 'off-hvac-1',
    customerId: 'cust-101',
    createdAt: new Date().toISOString(),
  };

  const mockOffer: OfferEntity = {
    id: 'off-hvac-1',
    requestId: 'req-reconcile-101',
    providerId: 'prov-202',
    price: 3500,
    message: 'Licensed HVAC technician ready with equipment.',
    status: 'ACCEPTED',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    activeMockSocket = null;
  });

  // TEST 1: Socket.IO payment:succeeded transitions request to PAID and renders Chat Unlock Banner
  it('should transition request to PAID and display Chat Unlocked banner upon payment:succeeded', async () => {
    localStorage.setItem('auth_token', 'mock-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-101',
      email: 'customer@example.com',
      name: 'Customer HVAC',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockAcceptedRequest);
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <RequestDetailPage />
        </SocketProvider>
      </AuthProvider>,
    );

    // Initial state: Request is in ACCEPTED status, awaiting payment
    await waitFor(() => {
      expect(screen.getByTestId('request-detail-title')).toHaveTextContent(
        'Commercial HVAC System Overhaul',
      );
      expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
      expect(screen.queryByTestId('paid-chat-unlocked-banner')).not.toBeInTheDocument();
    });

    // Wait for socket to register listener
    await waitFor(() => {
      expect(activeMockSocket).not.toBeNull();
      expect(activeMockSocket?.listenerCount('payment:succeeded')).toBeGreaterThan(0);
    });

    // Emit payment:succeeded event from backend/Stripe webhook reconciler
    act(() => {
      activeMockSocket?.emit('payment:succeeded', {
        requestId: 'req-reconcile-101',
        amount: 350000,
      });
    });

    // Request updates in real time to PAID
    await waitFor(() => {
      expect(screen.getByText('PAID')).toBeInTheDocument();
      expect(screen.getByTestId('paid-chat-unlocked-banner')).toBeInTheDocument();
      expect(screen.getByText('Payment Secured & Escrowed')).toBeInTheDocument();
      expect(screen.getByText('Chat Unlocked')).toBeInTheDocument();
      expect(screen.getByTestId('open-chat-button')).toBeInTheDocument();
    });
  });

  // TEST 2: Duplicate payment:succeeded events are idempotent
  it('should idempotently handle duplicate payment:succeeded events without crashing or duplicate banners', async () => {
    localStorage.setItem('auth_token', 'mock-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-101',
      email: 'customer@example.com',
      name: 'Customer HVAC',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockAcceptedRequest);
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <RequestDetailPage />
        </SocketProvider>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(activeMockSocket).not.toBeNull();
      expect(activeMockSocket?.listenerCount('payment:succeeded')).toBeGreaterThan(0);
    });

    // Fire event twice consecutively
    act(() => {
      activeMockSocket?.emit('payment:succeeded', {
        requestId: 'req-reconcile-101',
        amount: 350000,
      });
      activeMockSocket?.emit('payment:succeeded', {
        requestId: 'req-reconcile-101',
        amount: 350000,
      });
    });

    await waitFor(() => {
      const banners = screen.getAllByTestId('paid-chat-unlocked-banner');
      expect(banners).toHaveLength(1);
      expect(screen.getByText('PAID')).toBeInTheDocument();
    });
  });

  // TEST 3: Should ignore payment:succeeded events for different request IDs
  it('should ignore payment:succeeded events for a different request ID', async () => {
    localStorage.setItem('auth_token', 'mock-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-101',
      email: 'customer@example.com',
      name: 'Customer HVAC',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockAcceptedRequest);
    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockOffer],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <RequestDetailPage />
        </SocketProvider>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(activeMockSocket).not.toBeNull();
      expect(activeMockSocket?.listenerCount('payment:succeeded')).toBeGreaterThan(0);
    });

    // Fire event for a DIFFERENT request ID
    act(() => {
      activeMockSocket?.emit('payment:succeeded', {
        requestId: 'different-req-999',
        amount: 50000,
      });
    });

    // Status remains ACCEPTED, no chat banner
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.queryByTestId('paid-chat-unlocked-banner')).not.toBeInTheDocument();
  });
});
