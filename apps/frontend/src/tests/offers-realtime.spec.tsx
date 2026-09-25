import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import ProviderBrowsePage from '@/app/provider/browse/page';
import RequestDetailPage from '@/app/requests/[id]/page';
import { AuthProvider } from '@/context/auth-context';
import { SocketProvider } from '@/context/socket-context';
import { apiClient, ServiceRequestEntity, OfferEntity } from '@/lib/api-client';
import { EventEmitter } from 'events';

// ─── Navigation mocks ─────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockParams = { id: 'req-int-001' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: mockBack,
  }),
  usePathname: () => '/provider/browse',
  useParams: () => mockParams,
}));

// ─── Socket.IO mock ───────────────────────────────────────────────────────────

class MockSocket extends EventEmitter {
  public connected = true;
  public auth: any;
  public id = 'mock-socket-int-456';

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

// ─── Test Data ────────────────────────────────────────────────────────────────

const mockOpenRequest: ServiceRequestEntity = {
  id: 'req-int-001',
  title: 'Emergency Boiler Replacement',
  description: 'Residential boiler needs urgent replacement before winter.',
  budget: 1800,
  status: 'OPEN',
  customerId: 'cust-int-101',
  createdAt: new Date().toISOString(),
};

const mockLiveOffer: OfferEntity = {
  id: 'offer-live-001',
  requestId: 'req-int-001',
  providerId: 'prov-int-777',
  price: 1650,
  message: 'Can complete within 48 hours including all parts and labour.',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Shared render helper ─────────────────────────────────────────────────────

function renderWithProviders(component: React.ReactElement) {
  return render(
    <AuthProvider>
      <SocketProvider>{component}</SocketProvider>
    </AuthProvider>,
  );
}

/**
 * Waits until the activeMockSocket is created AND React has had time to
 * flush all pending state updates and re-run the socket useEffect hooks
 * in child components so listeners are registered before we emit events.
 */
async function waitForSocketReady(): Promise<void> {
  await waitFor(() => {
    expect(activeMockSocket).not.toBeNull();
  });
  // Allow React's async rendering pipeline to flush state updates and
  // re-run useEffect hooks that depend on [socket], registering listeners
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FEAT-003-INT: Real-Time Offer Events & Acceptance Broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    activeMockSocket = null;
  });

  // ─── Test 1: offer:created → customer request detail page ─────────────────

  it('should emit offer:created to customer personal room when offer is posted and update request detail live', async () => {
    localStorage.setItem('auth_token', 'valid-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-int-101',
      email: 'customer@test.com',
      name: 'Alice',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockOpenRequest);

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    renderWithProviders(<RequestDetailPage />);

    // Wait for initial request details to load
    await waitFor(() => {
      expect(screen.getByTestId('request-detail-title')).toHaveTextContent(
        'Emergency Boiler Replacement',
      );
    });

    // Wait for socket connection and listener registration
    await waitForSocketReady();

    // Simulate backend emitting offer:created to customer's private room
    act(() => {
      activeMockSocket?.emit('offer:created', {
        offer: mockLiveOffer,
        requestTitle: 'Emergency Boiler Replacement',
      });
    });

    // Live arrival banner should appear
    await waitFor(() => {
      expect(screen.getByTestId('live-offer-arrival-banner')).toBeInTheDocument();
      expect(screen.getByTestId('live-offer-arrival-banner')).toHaveTextContent(
        /new offer just arrived/i,
      );
    });

    // The live offer indicator in OfferList header appears
    await waitFor(() => {
      expect(screen.getByTestId('offer-live-indicator')).toBeInTheDocument();
    });
  });

  // ─── Test 2: offer:accepted → request status updates to ACCEPTED ──────────

  it('should update request status badge to ACCEPTED when offer:accepted socket event is received', async () => {
    localStorage.setItem('auth_token', 'valid-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-int-101',
      email: 'customer@test.com',
      name: 'Alice',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockOpenRequest);

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [mockLiveOffer],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    renderWithProviders(<RequestDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('request-detail-title')).toBeInTheDocument();
      // Initially OPEN
      expect(screen.getByTestId('request-status')).toHaveTextContent('OPEN');
    });

    await waitForSocketReady();

    // Simulate offer:accepted event for this request
    act(() => {
      activeMockSocket?.emit('offer:accepted', {
        offer: { ...mockLiveOffer, status: 'ACCEPTED' },
        requestId: 'req-int-001',
      });
    });

    // Request status badge should update to ACCEPTED
    await waitFor(() => {
      expect(screen.getByTestId('request-status')).toHaveTextContent('ACCEPTED');
    });
  });

  // ─── Test 3: request:closed → providers feed marks request closed ─────────

  it('should broadcast request:closed to providers room and mark request as ACCEPTED in provider feed', async () => {
    localStorage.setItem('auth_token', 'valid-provider-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-int-777',
      email: 'provider@test.com',
      name: 'Bob Builder',
      role: 'provider',
    });

    vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [mockOpenRequest],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    renderWithProviders(<ProviderBrowsePage />);

    // Initial state: request appears in feed
    await waitFor(() => {
      expect(screen.getByText('Emergency Boiler Replacement')).toBeInTheDocument();
    });

    await waitForSocketReady();

    // Simulate backend emitting request:closed to providers room
    act(() => {
      activeMockSocket?.emit('request:closed', {
        requestId: 'req-int-001',
      });
    });

    // Provider feed should reflect the request status update (ACCEPTED badge)
    await waitFor(() => {
      // RequestCard should display ACCEPTED badge now
      const acceptedBadge = screen.getByTestId('request-status');
      expect(acceptedBadge).toHaveTextContent('ACCEPTED');
    });
  });

  // ─── Test 4: offer:created idempotency ────────────────────────────────────

  it('should deduplicate duplicate offer:created socket events — identical offer ID is a no-op', async () => {
    localStorage.setItem('auth_token', 'valid-customer-token');

    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'cust-int-101',
      email: 'customer@test.com',
      name: 'Alice',
      role: 'customer',
    });

    vi.spyOn(apiClient.requests, 'getById').mockResolvedValue(mockOpenRequest);

    vi.spyOn(apiClient.offers, 'getByRequestId').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    renderWithProviders(<RequestDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('request-detail-title')).toBeInTheDocument();
    });

    await waitForSocketReady();

    // Emit the same offer:created event twice
    act(() => {
      activeMockSocket?.emit('offer:created', {
        offer: mockLiveOffer,
        requestTitle: 'Emergency Boiler Replacement',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-offer-arrival-banner')).toBeInTheDocument();
    });

    act(() => {
      activeMockSocket?.emit('offer:created', {
        offer: mockLiveOffer,
        requestTitle: 'Emergency Boiler Replacement',
      });
    });

    // Banner should appear exactly once (not duplicated)
    const banners = screen.getAllByTestId('live-offer-arrival-banner');
    expect(banners).toHaveLength(1);
  });
});
