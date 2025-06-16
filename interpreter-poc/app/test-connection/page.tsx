'use client';

import { useState } from 'react';

export default function TestConnection() {
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnection = async () => {
    try {
      setConnectionStatus('Connecting...');
      setError('');
      addLog('Starting connection test...');

      const response = await fetch('/api/realtime-token');
      const { token } = await response.json();
      
      if (!token) {
        throw new Error('No token received');
      }

      addLog(`Token received: ${token.substring(0, 20)}...`);

      // Test different connection methods
      const methods = [
        {
          name: 'Method 1: Bearer with dot',
          websocket: new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
            ['realtime', `Bearer.${token}`]
          )
        },
        {
          name: 'Method 2: Bearer with space',
          websocket: new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
            ['realtime', `Bearer ${token}`]
          )
        }
      ];

      methods.forEach((method, index) => {
        const ws = method.websocket;
        
        ws.onopen = () => {
          addLog(`✅ ${method.name}: Connected successfully`);
          setConnectionStatus('Connected');
          ws.close();
        };

        ws.onerror = (error) => {
          addLog(`❌ ${method.name}: Connection error`);
          console.error(`${method.name} error:`, error);
        };

        ws.onclose = (event) => {
          addLog(`${method.name}: Closed - Code: ${event.code}, Reason: ${event.reason}`);
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          addLog(`${method.name}: Message received - ${message.type}`);
          if (message.type === 'error') {
            addLog(`${method.name}: Error - ${message.error.message}`);
          }
        };
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConnectionStatus('Failed');
      addLog(`Error: ${err}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">OpenAI Realtime API Connection Test</h1>
      
      <div className="mb-4">
        <p className="mb-2">Status: <span className="font-semibold">{connectionStatus}</span></p>
        {error && (
          <p className="text-red-600 mb-2">Error: {error}</p>
        )}
      </div>

      <button
        onClick={testConnection}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-4"
      >
        Test Connection
      </button>

      <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Connection Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet. Click "Test Connection" to start.</p>
        ) : (
          <div className="space-y-1 text-sm font-mono">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p className="text-sm">Server running on: http://localhost:3002</p>
        <p className="text-sm">Test different WebSocket authentication methods</p>
      </div>
    </div>
  );
} 