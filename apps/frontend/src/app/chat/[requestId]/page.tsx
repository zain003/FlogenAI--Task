'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ServiceRequestEntity } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';
import { ChatWindow } from '@/components/chat/chat-window';
import { RequestStatusBadge } from '@/components/requests/request-card';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const requestId = params?.requestId as string;

  const [request, setRequest] = useState<ServiceRequestEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      if (!requestId) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.requests.getById(requestId);
        if (!isMounted) return;
        setRequest(data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load request details.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRequest();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/requests/${requestId}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Request</span>
          </Link>
          {request && (
            <div className="hidden sm:flex items-center gap-2 border-l border-gray-800 pl-4">
              <span className="text-sm font-semibold text-gray-200 truncate max-w-sm">
                {request.title}
              </span>
              <RequestStatusBadge status={request.status} />
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 font-mono">
          Request: {requestId ? requestId.slice(-8) : ''}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-3 sm:p-6 max-w-5xl w-full mx-auto flex flex-col h-[calc(100vh-65px)]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm">Initializing secure chat session...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 max-w-md mx-auto text-center px-4">
            <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              Unable to Open Chat
            </h2>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => router.push(`/requests/${requestId}`)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-200 transition"
            >
              Return to Request
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ChatWindow
              requestId={requestId}
              requestTitle={request?.title}
              counterpartyName={
                user?.role === 'customer' ? 'Service Provider' : 'Customer'
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
