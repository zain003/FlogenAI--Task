'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message... (Press Enter to send, Shift+Enter for newline)',
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && !disabled && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSend) return;

    const messageToSend = trimmed;
    // Clear input field immediately per spec requirement
    setContent('');
    setIsSubmitting(true);

    try {
      await onSendMessage(messageToSend);
    } finally {
      setIsSubmitting(false);
      // Re-focus the textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-3 bg-gray-900 border-t border-gray-800">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1 relative">
          <label htmlFor="chat-message-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-message-input"
            ref={textareaRef}
            data-testid="chat-input-textarea"
            rows={1}
            value={content}
            disabled={disabled || isSubmitting}
            placeholder={placeholder}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full resize-none bg-gray-950 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all max-h-32 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          data-testid="chat-send-button"
          disabled={!canSend}
          aria-label="Send message"
          className="inline-flex items-center justify-center p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:active:scale-100 disabled:cursor-not-allowed shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
