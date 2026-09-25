'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  apiClient,
  ConversationEntity,
  MessageEntity,
} from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { useSocket } from '@/context/socket-context';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

export interface ChatWindowProps {
  requestId: string;
  conversation?: ConversationEntity;
  initialMessages?: MessageEntity[];
  counterpartyName?: string;
  requestTitle?: string;
}

export function ChatWindow({
  requestId,
  conversation: propConversation,
  initialMessages = [],
  counterpartyName,
  requestTitle,
}: ChatWindowProps) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversation, setConversation] = useState<ConversationEntity | null>(
    propConversation || null,
  );
  const [messages, setMessages] = useState<MessageEntity[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(!propConversation && initialMessages.length === 0);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  // Fetch or resolve conversation if not provided via props
  useEffect(() => {
    let isMounted = true;

    // If both conversation and initial messages are provided via props, avoid network re-fetch
    if (propConversation && initialMessages.length > 0) {
      setConversation(propConversation);
      setMessages(initialMessages);
      setIsLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
      return;
    }

    async function loadConversationAndMessages() {
      if (!requestId) return;

      try {
        setIsLoading(true);
        setError(null);

        // 1. Resolve conversation
        let conv = propConversation;
        if (!conv) {
          conv = await apiClient.conversations.getByRequestId(requestId);
        }

        if (!isMounted) return;
        setConversation(conv);

        // 2. Fetch historical messages
        if (conv?.id) {
          const res = await apiClient.conversations.getMessages(conv.id, {
            page: 1,
            limit: 50,
          });

          if (!isMounted) return;
          // Reverse messages because backend returns { createdAt: -1 } (newest first)
          // Chat display needs chronological order (oldest at top, newest at bottom)
          const chronological = [...res.data].reverse();
          setMessages(chronological);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err?.message || 'Failed to load conversation messages. Please retry.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
          // Initial scroll to bottom
          setTimeout(() => scrollToBottom(false), 50);
        }
      }
    }

    loadConversationAndMessages();

    return () => {
      isMounted = false;
    };
  }, [requestId, propConversation, initialMessages, scrollToBottom]);

  // Real-time Socket.IO room join and message subscription
  useEffect(() => {
    if (!socket || !conversation?.id) return;

    // Join room for this conversation
    socket.emit('conversation:join', { conversationId: conversation.id });

    const handleNewMessage = (payload: { message: MessageEntity }) => {
      if (
        payload?.message &&
        payload.message.conversationId === conversation.id
      ) {
        setMessages((prev) => {
          // Deduplicate by message ID
          if (prev.some((m) => m.id === payload.message.id)) {
            return prev;
          }
          return [...prev, payload.message];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, conversation?.id, scrollToBottom]);

  // Auto-scroll when messages length updates
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  // Send message handler
  const handleSendMessage = async (content: string) => {
    if (!conversation?.id) {
      setError('Cannot send message: conversation is not initialized.');
      return;
    }

    try {
      // Send message via API client
      const sentMessage = await apiClient.conversations.sendMessage(
        conversation.id,
        content,
      );

      // Append sent message to local stream immediately with deduplication
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMessage.id)) {
          return prev;
        }
        return [...prev, sentMessage];
      });

      setTimeout(() => scrollToBottom(true), 50);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message. Please retry.');
    }
  };

  return (
    <div
      data-testid="chat-window"
      className="flex flex-col h-full w-full bg-gray-950 rounded-2xl border border-gray-800 shadow-xl overflow-hidden"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3
              data-testid="chat-counterparty-name"
              className="text-sm font-semibold text-gray-100 flex items-center gap-2"
            >
              {counterpartyName || 'Marketplace Chat'}
            </h3>
            {requestTitle && (
              <p
                data-testid="chat-request-title"
                className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md"
              >
                {requestTitle}
              </p>
            )}
          </div>
        </div>

        {/* Live connection badge */}
        <div
          data-testid="chat-connection-status"
          className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-950 border border-gray-800"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                : 'bg-gray-600'
            }`}
          />
          <span className="text-gray-300">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div
          data-testid="chat-error-alert"
          className="flex items-center justify-between px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="hover:text-rose-200 ml-2 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages Stream Container */}
      <div
        ref={messagesContainerRef}
        data-testid="chat-messages-container"
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-1 scroll-smooth"
      >
        {isLoading ? (
          <div
            data-testid="chat-loading-indicator"
            className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 text-sm py-12"
          >
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div
            data-testid="chat-empty-state"
            className="flex flex-col items-center justify-center h-full text-center py-16 px-4"
          >
            <div className="p-3 rounded-full bg-gray-900 border border-gray-800 text-gray-400 mb-3">
              <MessageSquare className="w-6 h-6 text-indigo-400/80" />
            </div>
            <p className="text-sm font-medium text-gray-300">
              No messages yet. Say hello to start the conversation.
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Messages sent here are secure and private between the customer and provider.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = user?.id ? message.senderId === user.id : false;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                senderLabel={isOwn ? undefined : counterpartyName}
              />
            );
          })
        )}
        <div ref={messagesEndRef} data-testid="chat-messages-end" />
      </div>

      {/* Message Input Box */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading || !conversation}
      />
    </div>
  );
}
