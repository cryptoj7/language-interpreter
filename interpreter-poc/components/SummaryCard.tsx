'use client';

import React from 'react';

interface SummaryCardProps {
  summary: string;
  actions: string[];
  createdAt: Date;
  conversationId: string;
}

export default function SummaryCard({ summary, actions, createdAt, conversationId }: SummaryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Conversation Summary
        </h3>
        <span className="text-sm text-gray-500">
          {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">Clinical Summary:</h4>
        <p className="text-gray-600 leading-relaxed">{summary}</p>
      </div>
      
      {actions && actions.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Detected Actions:</h4>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div 
                key={index}
                className="flex items-center p-2 bg-blue-50 border border-blue-200 rounded"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-blue-800 text-sm">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">ID: {conversationId}</span>
        <button 
          onClick={() => window.location.href = `/history/${conversationId}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Details →
        </button>
      </div>
    </div>
  );
} 