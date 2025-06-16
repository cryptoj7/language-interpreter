'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ConversationDetail {
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

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.id as string;
  
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }
      const data = await response.json();
      setConversation(data.conversation);
    } catch (err) {
      setError('Failed to load conversation');
      console.error('Error fetching conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-300 rounded p-4 text-red-700">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error || 'Conversation not found'}</p>
          <button 
            onClick={() => window.location.href = '/history'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const actions = conversation.actions ? JSON.parse(conversation.actions) : [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Conversation Details</h1>
          <button 
            onClick={() => window.location.href = '/history'}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to History
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{new Date(conversation.createdAt).toLocaleDateString()}</span>
          <span>{new Date(conversation.createdAt).toLocaleTimeString()}</span>
          <span className={`px-2 py-1 rounded text-xs ${
            conversation.status === 'completed' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {conversation.status}
          </span>
        </div>
      </div>

      {/* Summary Section */}
      {conversation.summary && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Clinical Summary</h3>
          <p className="text-blue-800">{conversation.summary}</p>
        </div>
      )}

      {/* Actions Section */}
      {actions.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-900 mb-2">Detected Actions</h3>
          <div className="space-y-2">
            {actions.map((action: string, index: number) => (
              <div key={index} className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-yellow-800">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Transcript */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Full Transcript</h3>
        <div className="space-y-4">
          {conversation.utterances.map((utterance) => (
            <div
              key={utterance.id}
              className={`p-4 rounded-lg ${
                utterance.role === 'doctor' 
                  ? 'bg-blue-50 border-l-4 border-blue-500' 
                  : utterance.role === 'patient'
                  ? 'bg-green-50 border-l-4 border-green-500'
                  : 'bg-gray-50 border-l-4 border-gray-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {utterance.role === 'doctor' ? 'Doctor' : 
                     utterance.role === 'patient' ? 'Patient' : 'System'}
                  </span>
                  <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded">
                    {utterance.originalLang === 'en' ? 'English' : 'Spanish'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(utterance.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-800">{utterance.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex justify-center">
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