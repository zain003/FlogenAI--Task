import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWindow } from '@/components/chat/chat-window';
import { apiClient, ConversationEntity, MessageEntity } from '@/lib/api-client';
import { EventEmitter } from 'events';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mockUser = {
  id: 'cust-101',
  email: 'customer@test.com',
  name: 'Alice Customer',
  role: 'customer' as const,
};

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'valid-jwt',
    isAuthenticated: true,
  }),
}));

// Real EventEmitter mock for socket
class MockSocket extends EventEmitter {
  public connected = true;
  public id = 'mock-chat-socket-99';
}

let activeSocket: MockSocket;

vi.mock('@/context/socket-context', () => ({
  useSocket: () => ({
    socket: activeSocket,
    isConnected: true,
  }),
}));

describe('FEAT-005-INT: Real-Time Chat Gateway & Room Authorization (Frontend)', () => {
  const mockConversation: ConversationEntity = {
    id: 'conv-realtime-888',
    requestId: 'req-realtime-111',
    customerId: 'cust-101',
    providerId: 'prov-202',
    createdAt: '2026-09-25T15:00:00.000Z',
  };

  const initialMessages: MessageEntity[] = [
    {
      id: 'msg-seed-1',
      conversationId: 'conv-realtime-888',
      senderId: 'cust-101',
      content: 'Initial seeded message',
      createdAt: '2026-09-25T15:01:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    activeSocket = new MockSocket();
    vi.spyOn(activeSocket, 'emit');

    vi.spyOn(apiClient.conversations, 'getByRequestId').mockResolvedValue(
      mockConversation,
    );

    vi.spyOn(apiClient.conversations, 'getMessages').mockResolvedValue({
      data: initialMessages,
      pagination: {
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      },
    });

    vi.spyOn(apiClient.conversations, 'sendMessage').mockImplementation(
      async (convId, content) => ({
        id: `msg-${Date.now()}`,
        conversationId: convId,
        senderId: mockUser.id,
        content,
        createdAt: new Date().toISOString(),
      }),
    );
  });

  it('should emit conversation:join when conversation is resolved', async () => {
    render(
      <ChatWindow
        requestId="req-realtime-111"
        conversation={mockConversation}
        initialMessages={initialMessages}
      />,
    );

    expect(activeSocket.emit).toHaveBeenCalledWith('conversation:join', {
      conversationId: 'conv-realtime-888',
    });
  });

  it('should append incoming message:new from socket to chat stream without duplicate', async () => {
    render(
      <ChatWindow
        requestId="req-realtime-111"
        conversation={mockConversation}
        initialMessages={initialMessages}
      />,
    );

    // Initial message is displayed
    expect(screen.getByText('Initial seeded message')).toBeInTheDocument();

    const incomingMessage: MessageEntity = {
      id: 'msg-incoming-999',
      conversationId: 'conv-realtime-888',
      senderId: 'prov-202',
      content: 'Live incoming message from provider',
      createdAt: new Date().toISOString(),
    };

    // Simulate socket event from server
    act(() => {
      activeSocket.emit('message:new', { message: incomingMessage });
    });

    await waitFor(() => {
      expect(
        screen.getByText('Live incoming message from provider'),
      ).toBeInTheDocument();
    });

    // Simulate duplicate event delivery (idempotency check)
    act(() => {
      activeSocket.emit('message:new', { message: incomingMessage });
    });

    const rendered = screen.getAllByText('Live incoming message from provider');
    expect(rendered.length).toBe(1);
  });

  it('should display Live status indicator when socket is connected', async () => {
    render(
      <ChatWindow
        requestId="req-realtime-111"
        conversation={mockConversation}
        initialMessages={initialMessages}
      />,
    );

    const statusBadge = screen.getByTestId('chat-connection-status');
    expect(statusBadge).toHaveTextContent('Live');
  });
});
