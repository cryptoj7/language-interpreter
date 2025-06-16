'use client';

import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { startConversation } from '../lib/store';
import InterpreterDemo from '../components/InterpreterDemo';
import RealtimeInterpreter from '../components/RealtimeInterpreter';

export default function Home() {
  const dispatch = useDispatch();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useRealtimeAPI, setUseRealtimeAPI] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    initializeConversation();
  }, [dispatch]);

  const initializeConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });
      
      const data = await response.json();
      const newConversationId = data.conversation.id;
      
      setConversationId(newConversationId);
      dispatch(startConversation(newConversationId));
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndConversation = async () => {
    if (!conversationId) return;
    
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'end', 
          conversationId 
        })
      });
      
      if (response.ok) {
        // Redirect to history page
        window.location.href = '/history';
      }
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  const navigateToHistory = () => {
    window.location.href = '/history';
  };

  const navigateToAdmin = () => {
    window.location.href = '/admin';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Initializing Medical Interpreter...</p>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">Failed to initialize conversation</p>
          <button 
            onClick={initializeConversation}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Left side - Logo and Mode */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl font-bold">🏥</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Medical Interpreter</h1>
                  <p className="text-xs text-gray-500 font-medium">Real-time Translation System</p>
                </div>
              </div>
              
              {/* Mode Badge */}
              <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm border ${
                useRealtimeAPI 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200' 
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-blue-200'
              }`}>
                {useRealtimeAPI ? '🚀 Realtime API' : '🎤 Demo Mode'}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setUseRealtimeAPI(!useRealtimeAPI)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
              >
                {useRealtimeAPI ? '🎤 Switch to Demo' : '🚀 Switch to Realtime'}
              </button>
              
              <button
                onClick={navigateToAdmin}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
              >
                <span className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>Admin</span>
                </span>
              </button>
              
              <button
                onClick={navigateToHistory}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
              >
                <span className="flex items-center space-x-2">
                  <span>📋</span>
                  <span>History</span>
                </span>
              </button>
              
              <button
                onClick={handleEndConversation}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 font-semibold text-sm shadow-lg hover:shadow-xl"
              >
                <span className="flex items-center space-x-2">
                  <span>🔚</span>
                  <span>End Session</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {useRealtimeAPI ? (
          <RealtimeInterpreter conversationId={conversationId} />
        ) : (
          <InterpreterDemo conversationId={conversationId} />
        )}
      </main>

      {/* Instructions Panel */}
      {showInstructions && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg max-w-sm border border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold">
              {useRealtimeAPI ? '🚀 Realtime API Instructions:' : '🎯 Demo Instructions:'}
            </h3>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2 -mt-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {useRealtimeAPI ? (
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Click "Connect & Start Recording" to begin</li>
              <li>• <strong>Real-time translation</strong> with OpenAI</li>
              <li>• Automatic language detection (Spanish=Patient, English=Doctor)</li>
              <li>• AI automatically detects medical actions</li>
              <li>• WebRTC connection for low latency</li>
              <li>• Professional medical terminology</li>
            </ul>
          ) : (
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Allow microphone access when prompted</li>
              <li>• <strong>Speak naturally</strong> - language auto-detected!</li>
              <li>• English = Doctor, Spanish = Patient (automatic)</li>
              <li>• Click "Start Recording" to begin</li>
              <li>• Say "repeat that" to replay last statement</li>
              <li>• Mention appointments or labs to test actions</li>
              <li>• Audio queue prevents overlapping speech</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
