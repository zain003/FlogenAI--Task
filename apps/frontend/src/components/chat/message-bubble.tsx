'use client';

import React from 'react';
import { MessageEntity } from '@/lib/api-client';

export interface MessageBubbleProps {
  message: MessageEntity;
  isOwn: boolean;
  senderLabel?: string;
}

export function MessageBubble({ message, isOwn, senderLabel }: MessageBubbleProps) {
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      data-testid={`message-bubble-${message.id}`}
      className={`flex w-full my-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        data-testid={isOwn ? 'own-message' : 'counterparty-message'}
        className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 shadow-sm transition-all duration-150 ${
          isOwn
            ? 'bg-indigo-600 text-white rounded-2xl rounded-br-xs'
            : 'bg-gray-800 text-gray-100 border border-gray-700/60 rounded-2xl rounded-bl-xs'
        }`}
      >
        {!isOwn && senderLabel && (
          <div
            data-testid="message-sender-label"
            className="text-[11px] font-medium text-indigo-400 mb-0.5"
          >
            {senderLabel}
          </div>
        )}
        <div
          data-testid="message-content"
          className="text-sm leading-relaxed break-words whitespace-pre-wrap selection:bg-indigo-800"
        >
          {message.content}
        </div>
        <div
          data-testid="message-time"
          className={`text-[10px] font-mono mt-1 text-right select-none ${
            isOwn ? 'text-indigo-200/80' : 'text-gray-400/80'
          }`}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
