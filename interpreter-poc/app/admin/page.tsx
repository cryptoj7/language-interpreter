'use client';

import React, { useEffect, useState } from 'react';

interface Action {
  id: string;
  conversationId: string;
  actionType: string;
  parameters: string;
  status: string;
  webhookUrl: string | null;
  webhookStatus: number | null;
  webhookResponse: string | null;
  errorMessage: string | null;
  detectedAt: string;
  executedAt: string | null;
  completedAt: string | null;
  retryCount: number;
}

export default function AdminPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      const response = await fetch('/api/actions');
      const data = await response.json();
      console.log('Fetched actions:', data);
      setActions(data.actions || []);
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTestAction = async () => {
    try {
      console.log('Creating test action...');
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'test-conversation',
          actionType: 'schedule_lab',
          parameters: JSON.stringify({ test: 'blood test', date: 'tomorrow' }),
          status: 'detected'
        })
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Test action created successfully:', result);
        fetchActions(); // Refresh the list
      } else {
        const errorText = await response.text();
        console.error('Failed to create test action:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error creating test action:', error);
    }
  };

  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true;
    return action.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'detected': return 'bg-yellow-100 text-yellow-800';
      case 'executing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const parseParameters = (params: string) => {
    try {
      return JSON.parse(params);
    } catch {
      return params;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Actions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">Action Admin Dashboard</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {actions.length} Total Actions
            </span>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchActions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
            <button
              onClick={createTestAction}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🧪 Create Test Action
            </button>
            <a
              href="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Demo
            </a>
            <a
              href="/history"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View History
            </a>
          </div>
        </div>
      </nav>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex space-x-2">
          {['all', 'detected', 'executing', 'completed', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs">
                  {actions.filter(a => a.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions Table */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parameters
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Webhook
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timing
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActions.map((action) => (
                  <tr key={action.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {action.actionType}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {action.id.slice(0, 8)}...
                        </div>
                        <div className="text-sm text-gray-500">
                          Conv: {action.conversationId.slice(0, 8)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                      {action.retryCount > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Retries: {action.retryCount}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">
                          {JSON.stringify(parseParameters(action.parameters), null, 2)}
                        </pre>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {action.webhookStatus && (
                          <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                            action.webhookStatus === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            HTTP {action.webhookStatus}
                          </div>
                        )}
                        {action.errorMessage && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs">
                            {action.errorMessage}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div>Detected: {formatDate(action.detectedAt)}</div>
                        {action.executedAt && (
                          <div>Executed: {formatDate(action.executedAt)}</div>
                        )}
                        {action.completedAt && (
                          <div>Completed: {formatDate(action.completedAt)}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredActions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No actions found for the selected filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 