import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '@/context/socket-context';
import { AuthContext, AuthContextType } from '@/context/auth-context';
import { EventEmitter } from 'events';
import { io } from 'socket.io-client';

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

vi.mock('socket.io-client', () => {
  const ioMock = vi.fn().mockImplementation((url, options) => {
    return new MockSocket(url, options);
  });
  return {
    io: ioMock,
    default: ioMock,
  };
});

function Consumer() {
  const { isConnected, socket } = useSocket();
  return (
    <div>
      <div data-testid="is-connected">{isConnected ? 'connected' : 'disconnected'}</div>
      <div data-testid="has-socket">{socket ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('SocketContext & WebSocket URL Resolution (ISSUE-010)', () => {
  const originalSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  const originalWsUrl = process.env.NEXT_PUBLIC_WS_URL;

  const mockAuth: AuthContextType = {
    user: {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'customer',
    },
    token: 'test-jwt-token',
    isLoading: false,
    isAuthenticated: true,
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-jwt-token');
  });

  afterEach(() => {
    if (originalSocketUrl !== undefined) {
      process.env.NEXT_PUBLIC_SOCKET_URL = originalSocketUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SOCKET_URL;
    }

    if (originalWsUrl !== undefined) {
      process.env.NEXT_PUBLIC_WS_URL = originalWsUrl;
    } else {
      delete process.env.NEXT_PUBLIC_WS_URL;
    }
  });

  it('should prioritize NEXT_PUBLIC_SOCKET_URL when configured per infra contract', async () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_WS_URL = 'http://legacy-ws:3001';

    render(
      <AuthContext.Provider value={mockAuth}>
        <SocketProvider>
          <Consumer />
        </SocketProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        'http://localhost:8080',
        expect.objectContaining({
          auth: { token: 'test-jwt-token' },
          transports: ['websocket', 'polling'],
        }),
      );
    });
  });

  it('should fall back to NEXT_PUBLIC_WS_URL when NEXT_PUBLIC_SOCKET_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    process.env.NEXT_PUBLIC_WS_URL = 'http://fallback-ws:4000';

    render(
      <AuthContext.Provider value={mockAuth}>
        <SocketProvider>
          <Consumer />
        </SocketProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        'http://fallback-ws:4000',
        expect.objectContaining({
          auth: { token: 'test-jwt-token' },
        }),
      );
    });
  });

  it('should fall back to default http://localhost:3001 when neither env variable is set', async () => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;

    render(
      <AuthContext.Provider value={mockAuth}>
        <SocketProvider>
          <Consumer />
        </SocketProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.objectContaining({
          auth: { token: 'test-jwt-token' },
        }),
      );
    });
  });

  it('should not initialize socket connection when user is not authenticated', async () => {
    const unauth: AuthContextType = {
      ...mockAuth,
      user: null,
      token: null,
      isAuthenticated: false,
    };

    render(
      <AuthContext.Provider value={unauth}>
        <SocketProvider>
          <Consumer />
        </SocketProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('has-socket')).toHaveTextContent('no');
      expect(io).not.toHaveBeenCalled();
    });
  });
});
