import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import ProviderBrowsePage from '@/app/provider/browse/page';
import { AuthProvider } from '@/context/auth-context';
import { SocketProvider } from '@/context/socket-context';
import { apiClient, ServiceRequestEntity } from '@/lib/api-client';
import { EventEmitter } from 'events';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/provider/browse',
}));

// Mock socket.io-client
class MockSocket extends EventEmitter {
  public connected = true;
  public auth: any;
  public id = 'mock-socket-id-123';

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

describe('FEAT-002-INT: Real-Time Request Broadcast (Provider Live Feed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    activeMockSocket = null;
  });

  const mockInitialRequest: ServiceRequestEntity = {
    id: 'req-init-1',
    title: 'Initial Electrical Inspection',
    description: 'Residential electrical panel safety inspection.',
    budget: 200,
    status: 'OPEN',
    customerId: 'cust-1',
    createdAt: new Date().toISOString(),
  };

  const mockLiveRequest: ServiceRequestEntity = {
    id: 'req-live-999',
    title: 'Live Sump Pump Installation',
    description: 'Basement flooding emergency requiring heavy-duty pump installation.',
    budget: 750,
    status: 'OPEN',
    customerId: 'cust-2',
    createdAt: new Date().toISOString(),
  };

  // Test 5: should update provider UI feed when request:created event is received
  it('should update provider UI feed when request:created event is received in real time', async () => {
    localStorage.setItem('auth_token', 'valid-provider-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-101',
      email: 'provider@example.com',
      name: 'Provider Pro',
      role: 'provider',
    });

    vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [mockInitialRequest],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <ProviderBrowsePage />
        </SocketProvider>
      </AuthProvider>
    );

    // Initial render displays initial request
    await waitFor(() => {
      expect(screen.getByText('Initial Electrical Inspection')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    // Wait until socket is connected and provider page attached listener
    await waitFor(() => {
      expect(screen.getByText('Real-Time Feed Live')).toBeInTheDocument();
      expect(activeMockSocket).not.toBeNull();
      expect(activeMockSocket?.auth?.token).toBe('valid-provider-token');
    });

    // Simulate backend emitting request:created over Socket.IO
    act(() => {
      activeMockSocket?.emit('request:created', { request: mockLiveRequest });
    });

    // Provider feed updates immediately without page refresh
    await waitFor(() => {
      expect(screen.getByText('Live Sump Pump Installation')).toBeInTheDocument();
      expect(screen.getByText('$750.00')).toBeInTheDocument();
      expect(screen.getByTestId('new-request-alert')).toHaveTextContent(/new request just arrived/i);
    });

    // Verify total requests in list is now 2
    expect(screen.getByText('2 available jobs')).toBeInTheDocument();
  });

  it('should deduplicate incoming real-time requests with same ID (idempotency)', async () => {
    localStorage.setItem('auth_token', 'valid-provider-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-101',
      email: 'provider@example.com',
      name: 'Provider Pro',
      role: 'provider',
    });

    vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <ProviderBrowsePage />
        </SocketProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('Real-Time Feed Live')).toBeInTheDocument();
    });

    // Emit the same event twice consecutively
    act(() => {
      activeMockSocket?.emit('request:created', { request: mockLiveRequest });
    });

    await waitFor(() => {
      expect(screen.getByText('Live Sump Pump Installation')).toBeInTheDocument();
    });

    act(() => {
      activeMockSocket?.emit('request:created', { request: mockLiveRequest });
    });

    // Should only have 1 instance of the card
    const titles = screen.getAllByText('Live Sump Pump Installation');
    expect(titles).toHaveLength(1);
    expect(screen.getByText('1 available jobs')).toBeInTheDocument();
  });

  it('should re-fetch open requests upon socket reconnect to catch missed items', async () => {
    localStorage.setItem('auth_token', 'valid-provider-token');
    vi.spyOn(apiClient.auth, 'getMe').mockResolvedValue({
      id: 'prov-101',
      email: 'provider@example.com',
      name: 'Provider Pro',
      role: 'provider',
    });

    const getAllSpy = vi.spyOn(apiClient.requests, 'getAll').mockResolvedValue({
      data: [mockInitialRequest],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <AuthProvider>
        <SocketProvider>
          <ProviderBrowsePage />
        </SocketProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getAllSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Real-Time Feed Live')).toBeInTheDocument();
    });

    // Trigger reconnect event on socket
    act(() => {
      activeMockSocket?.emit('reconnect');
    });

    await waitFor(() => {
      expect(getAllSpy).toHaveBeenCalledTimes(2);
    });
  });
});
