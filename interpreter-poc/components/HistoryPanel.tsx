'use client';

import React, { useEffect, useState } from 'react';
import SummaryCard from './SummaryCard';

interface Conversation {
  id: string;
  createdAt: string;
  summary?: string;
  actions?: string;
  status: string;
  utterances: Array<{
    id: string;
    role: string;
    text: string;
    originalLang: string;
    timestamp: string;
  }>;
}

export default function HistoryPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const data = await response.json();
      setConversations(data.conversations);
    } catch (err) {
      setError('Failed to load conversation history');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-300 rounded p-4 text-red-700">
          <h3 className="font-semibold mb-2">Error Loading History</h3>
          <p>{error}</p>
          <button 
            onClick={fetchConversations}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const completedConversations = conversations.filter(conv => conv.status === 'completed');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conversation History</h1>
        <p className="text-gray-600">
          Review past medical interpreter sessions and their summaries.
        </p>
      </div>

      {completedConversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.451L3 21l2.451-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
          <p className="text-gray-600 mb-4">Start your first medical interpreter session to see summaries here.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Start New Session
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {completedConversations.map((conversation) => (
            <SummaryCard
              key={conversation.id}
              conversationId={conversation.id}
              summary={conversation.summary || 'No summary available'}
              actions={conversation.actions ? JSON.parse(conversation.actions) : []}
              createdAt={new Date(conversation.createdAt)}
            />
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          Start New Interpreter Session
        </button>
      </div>
    </div>
  );
} 