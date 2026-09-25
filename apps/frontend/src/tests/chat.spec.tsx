import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWindow } from '@/components/chat/chat-window';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ChatInput } from '@/components/chat/chat-input';
import {
  apiClient,
  ConversationEntity,
  MessageEntity,
} from '@/lib/api-client';

// Mock scrollIntoView for DOM environment
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock Auth Context
const mockUser = {
  id: 'cust-001',
  email: 'customer@test.com',
  name: 'John Customer',
  role: 'customer' as const,
};

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'mock-jwt-token',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock Socket Context
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
const mockSocketEmit = vi.fn();

const mockSocket = {
  on: mockSocketOn,
  off: mockSocketOff,
  emit: mockSocketEmit,
  connected: true,
};

vi.mock('@/context/socket-context', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
  SocketProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe('FEAT-005-FE: Real-Time Chat Interface (Fake DOM Tests)', () => {
  const mockConversation: ConversationEntity = {
    id: 'conv-12345',
    requestId: 'req-99999',
    customerId: 'cust-001',
    providerId: 'prov-002',
    createdAt: '2026-09-25T15:00:00.000Z',
  };

  const mockHistoricalMessages: MessageEntity[] = [
    {
      id: 'msg-001',
      conversationId: 'conv-12345',
      senderId: 'cust-001',
      content: 'Hello, what time can you arrive today?',
      createdAt: '2026-09-25T15:01:00.000Z',
    },
    {
      id: 'msg-002',
      conversationId: 'conv-12345',
      senderId: 'prov-002',
      content: 'Hi! I have the replacement valve and will arrive in 20 minutes.',
      createdAt: '2026-09-25T15:02:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(apiClient.conversations, 'getByRequestId').mockResolvedValue(
      mockConversation,
    );

    vi.spyOn(apiClient.conversations, 'getMessages').mockResolvedValue({
      data: mockHistoricalMessages,
      pagination: {
        page: 1,
        limit: 50,
        total: 2,
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

  // TEST 1 from Spec: should render chat window with message history and input box
  it('should render chat window with message history and input box', async () => {
    render(
      <ChatWindow
        requestId="req-99999"
        counterpartyName="Emergency Plumber"
        requestTitle="Kitchen Sink Pipe Leak"
      />,
    );

    // Verify header and titles render
    expect(
      screen.getByTestId('chat-counterparty-name'),
    ).toHaveTextContent('Emergency Plumber');
    expect(screen.getByTestId('chat-request-title')).toHaveTextContent(
      'Kitchen Sink Pipe Leak',
    );

    // Verify connection status badge renders
    expect(screen.getByTestId('chat-connection-status')).toHaveTextContent('Live');

    // Wait for messages to load from API
    await waitFor(() => {
      expect(screen.getByText('Hello, what time can you arrive today?')).toBeInTheDocument();
      expect(
        screen.getByText('Hi! I have the replacement valve and will arrive in 20 minutes.'),
      ).toBeInTheDocument();
    });

    // Verify input box and send button exist
    expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument();
  });

  // TEST 2 from Spec: should display own messages aligned to right and counterparty messages to left
  it('should display own messages aligned to right and counterparty messages to left', async () => {
    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    // Customer own message (cust-001 === user.id)
    const ownBubble = screen.getByTestId('message-bubble-msg-001');
    expect(ownBubble).toHaveClass('justify-end');
    const ownContent = ownBubble.querySelector('[data-testid="own-message"]');
    expect(ownContent).toBeInTheDocument();
    expect(ownContent).toHaveClass('bg-indigo-600');

    // Provider counterparty message (prov-002 !== user.id)
    const counterpartyBubble = screen.getByTestId('message-bubble-msg-002');
    expect(counterpartyBubble).toHaveClass('justify-start');
    const counterpartyContent = counterpartyBubble.querySelector(
      '[data-testid="counterparty-message"]',
    );
    expect(counterpartyContent).toBeInTheDocument();
    expect(counterpartyContent).toHaveClass('bg-gray-800');
  });

  // TEST 3 from Spec: should clear input field after sending a message
  it('should clear input field after sending a message', async () => {
    const user = userEvent.setup();

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    const input = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('chat-send-button');

    // Type a message
    await user.type(input, 'Great, see you soon!');
    expect(input.value).toBe('Great, see you soon!');

    // Click send button
    await user.click(sendButton);

    // Verify API called
    await waitFor(() => {
      expect(apiClient.conversations.sendMessage).toHaveBeenCalledWith(
        'conv-12345',
        'Great, see you soon!',
      );
    });

    // Input must be cleared immediately
    expect(input.value).toBe('');

    // Message must appear in message stream
    expect(screen.getByText('Great, see you soon!')).toBeInTheDocument();
  });

  // TEST 4 from Spec: should prevent sending empty or whitespace-only messages
  it('should prevent sending empty or whitespace-only messages', async () => {
    const user = userEvent.setup();

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    const input = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('chat-send-button');

    // Initially empty: button disabled
    expect(sendButton).toBeDisabled();

    // Type only whitespace
    await user.type(input, '     ');
    expect(sendButton).toBeDisabled();

    // Press Enter with only whitespace
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    // API should not have been called
    expect(apiClient.conversations.sendMessage).not.toHaveBeenCalled();
  });

  // TEST 5 from Spec: should auto-scroll to bottom when new message arrives
  it('should auto-scroll to bottom when new message arrives', async () => {
    const scrollMock = vi.fn();
    Element.prototype.scrollIntoView = scrollMock;

    let socketCallback: (payload: { message: MessageEntity }) => void = () => {};
    mockSocketOn.mockImplementation((event: string, cb: any) => {
      if (event === 'message:new') {
        socketCallback = cb;
      }
    });

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    // Socket joins conversation room
    expect(mockSocketEmit).toHaveBeenCalledWith('conversation:join', {
      conversationId: 'conv-12345',
    });

    // Simulate incoming new message event from socket
    act(() => {
      socketCallback({
        message: {
          id: 'msg-003',
          conversationId: 'conv-12345',
          senderId: 'prov-002',
          content: 'I have arrived outside the building.',
          createdAt: new Date().toISOString(),
        },
      });
    });

    // Verify new message rendered in stream
    await waitFor(() => {
      expect(
        screen.getByText('I have arrived outside the building.'),
      ).toBeInTheDocument();
    });

    // Verify auto-scroll was triggered
    expect(scrollMock).toHaveBeenCalled();
  });

  // Additional Edge Case 1: Empty state display
  it('should display empty state when conversation has no messages', async () => {
    vi.spyOn(apiClient.conversations, 'getMessages').mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    });

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument();
      expect(
        screen.getByText('No messages yet. Say hello to start the conversation.'),
      ).toBeInTheDocument();
    });
  });

  // Additional Edge Case 2: Wrap long text without breaking layout
  it('should wrap long messages without spaces cleanly with break-words', () => {
    const longString = 'SuperLongWordWithoutAnySpaces'.repeat(5);
    const longMessage: MessageEntity = {
      id: 'msg-long',
      conversationId: 'conv-12345',
      senderId: 'cust-001',
      content: longString,
      createdAt: new Date().toISOString(),
    };

    render(<MessageBubble message={longMessage} isOwn={true} />);

    const contentDiv = screen.getByTestId('message-content');
    expect(contentDiv).toHaveClass('break-words');
    expect(contentDiv).toHaveTextContent(longString);
  });

  // Additional Edge Case 3: Enter key sends message, Shift+Enter creates newline
  it('should send on Enter and allow Shift+Enter without sending', async () => {
    const user = userEvent.setup();

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    const input = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;

    // Type text and hit Shift+Enter
    await user.type(input, 'Line 1');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // Should NOT submit on Shift+Enter
    expect(apiClient.conversations.sendMessage).not.toHaveBeenCalled();

    // Hit Enter without Shift
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(apiClient.conversations.sendMessage).toHaveBeenCalledWith(
        'conv-12345',
        'Line 1',
      );
    });
  });

  // Additional Edge Case 4: Displays error alert when sending fails
  it('should display error alert when message sending fails', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient.conversations, 'sendMessage').mockRejectedValueOnce(
      new Error('Network error: Unable to reach server'),
    );

    render(
      <ChatWindow
        requestId="req-99999"
        conversation={mockConversation}
        initialMessages={mockHistoricalMessages}
      />,
    );

    const input = screen.getByTestId('chat-input-textarea');
    const sendButton = screen.getByTestId('chat-send-button');

    await user.type(input, 'Failing message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('chat-error-alert')).toBeInTheDocument();
      expect(
        screen.getByText('Network error: Unable to reach server'),
      ).toBeInTheDocument();
    });
  });
});
