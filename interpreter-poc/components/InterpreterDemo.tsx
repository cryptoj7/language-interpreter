'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, addUtterance, setRecording, setConnected, setError, addDetectedAction, markActionExecuted } from '../lib/store';
import { SpeechRecognition, SpeechRecognitionEvent } from '../types/speech';

interface InterpreterDemoProps {
  conversationId: string;
}

export default function InterpreterDemo({ conversationId }: InterpreterDemoProps) {
  const dispatch = useDispatch();
  const { currentConversation, isRecording, error, detectedActions } = useSelector(
    (state: RootState) => state.interpreter
  );

  const [isDoctor, setIsDoctor] = useState(true);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognizer = new SpeechRecognition();
      
      recognizer.continuous = true;
      recognizer.interimResults = false;
      recognizer.lang = isDoctor ? 'en-US' : 'es-ES';
      
      recognizer.onresult = handleSpeechResult;
      recognizer.onerror = (event) => {
        dispatch(setError(`Speech recognition error: ${event.error}`));
        dispatch(setRecording(false));
      };
      
      recognizer.onend = () => {
        if (isRecording) {
          recognizer.start(); // Restart for continuous listening
        }
      };
      
      setRecognition(recognizer);
    } else {
      dispatch(setError('Speech recognition not supported in this browser'));
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      setSynthesis(window.speechSynthesis);
    }

    // Simulate connection
    dispatch(setConnected(true));
    dispatch(setError(null));

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isDoctor, isRecording]);

  const handleSpeechResult = async (event: SpeechRecognitionEvent) => {
    const lastResult = event.results[event.results.length - 1];
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.trim();
      
      if (transcript) {
        await processUtterance(transcript);
      }
    }
  };

  const processUtterance = async (text: string) => {
    setIsProcessing(true);
    
    try {
      // Detect language automatically
      const detectedLang = await detectLanguage(text);
      const actualLang = detectedLang || (isDoctor ? 'en' : 'es');
      
      // Auto-adjust role based on detected language
      const autoRole = actualLang === 'en' ? 'doctor' : 'patient';
      
      const utterance = {
        id: `utterance_${Date.now()}`,
        role: autoRole as 'doctor' | 'patient',
        text,
        originalLang: actualLang as 'en' | 'es',
        timestamp: new Date().toISOString()
      };
      
      dispatch(addUtterance(utterance));
      await saveUtteranceToDatabase(utterance);

      // Check for special commands
      if (text.toLowerCase().includes('repeat that') || text.toLowerCase().includes('repite eso')) {
        handleRepeatRequest();
        return;
      }

      // Translate the text
      const translation = await translateText(text, actualLang);
      
      if (translation) {
        // Add translated response
        const translatedUtterance = {
          id: `translation_${Date.now()}`,
          role: 'system' as const,
          text: translation.translatedText,
          originalLang: actualLang === 'en' ? 'es' : 'en' as 'en' | 'es',
          timestamp: new Date().toISOString(),
          translatedText: text
        };
        
        dispatch(addUtterance(translatedUtterance));
        await saveUtteranceToDatabase(translatedUtterance);

        // Speak the translation
        speakText(translation.translatedText, actualLang === 'en' ? 'es' : 'en');

        // Check for actions in the original text
        checkForActions(text, actualLang);
      }
    } catch (error) {
      console.error('Processing error:', error);
      dispatch(setError('Failed to process speech'));
    } finally {
      setIsProcessing(false);
    }
  };

  const detectLanguage = async (text: string): Promise<string | null> => {
    try {
      // Simple language detection based on common words and patterns
      const spanishWords = ['el', 'la', 'es', 'en', 'de', 'que', 'y', 'a', 'un', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una', 'tiene', 'me', 'si', 'bien', 'puede', 'este', 'está', 'todo', 'le', 'su', 'yo', 'muy', 'ahora', 'cada', 'sí', 'voy', 'puede', 'gusta', 'nada', 'muchas', 'ni', 'contra', 'otros', 'ese', 'eso', 'había', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'del', 'al'];
      
      const words = text.toLowerCase().split(/\s+/);
      const spanishWordCount = words.filter(word => spanishWords.includes(word)).length;
      const spanishRatio = spanishWordCount / words.length;
      
      // If more than 20% of words are common Spanish words, consider it Spanish
      return spanishRatio > 0.2 ? 'es' : 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return null;
    }
  };

  const saveUtteranceToDatabase = async (utterance: any) => {
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_utterance',
          conversationId,
          utterance
        })
      });
    } catch (error) {
      console.error('Failed to save utterance:', error);
    }
  };

  const translateText = async (text: string, fromLang: string) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          fromLang,
          toLang: fromLang === 'en' ? 'es' : 'en',
          context: 'medical'
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Translation error:', error);
      dispatch(setError('Translation failed'));
      return null;
    }
  };

  const speakText = (text: string, lang: string) => {
    if (synthesis && !isSpeaking) {
      // Stop any ongoing speech
      synthesis.cancel();
      
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      utterance.onerror = () => {
        setIsSpeaking(false);
      };
      
      synthesis.speak(utterance);
    }
  };

  const checkForActions = async (text: string, lang: string) => {
    try {
      const response = await fetch('/api/detect-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: lang,
          conversationId
        })
      });

      if (response.ok) {
        const { actions } = await response.json();
        
        for (const action of actions) {
          // Add to Redux for immediate UI update
          dispatch(addDetectedAction({
            name: action.name,
            parameters: action.parameters,
            executed: false
          }));
          
          // Save to database and execute
          await saveAndExecuteAction(action.name, action.parameters);
        }
      }
    } catch (error) {
      console.error('Action detection error:', error);
    }
  };

  const saveAndExecuteAction = async (actionName: string, parameters: any) => {
    try {
      // First, save the action to the database
      const saveResponse = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          actionType: actionName,
          parameters: JSON.stringify(parameters),
          status: 'detected'
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save action to database');
      }

      const { actionId } = await saveResponse.json();

      // Then execute the action
      const executeResponse = await fetch('/api/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          action: actionName,
          parameters,
          conversationId
        })
      });
      
      if (executeResponse.ok) {
        dispatch(markActionExecuted(actionName));
      }
    } catch (err) {
      console.error('Failed to save and execute action:', err);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      dispatch(setRecording(false));
      if (recognition) {
        recognition.stop();
      }
    } else {
      dispatch(setRecording(true));
      if (recognition) {
        recognition.lang = isDoctor ? 'en-US' : 'es-ES';
        recognition.start();
      }
    }
  };

  const handleRepeatRequest = () => {
    if (currentConversation?.lastDoctorUtterance) {
      const lastUtterance = currentConversation.lastDoctorUtterance;
      speakText(lastUtterance.text, lastUtterance.originalLang);
      
      // Add system message about repeat
      const repeatMessage = {
        id: `repeat_${Date.now()}`,
        role: 'system' as const,
        text: `Repeating: "${lastUtterance.text}"`,
        originalLang: 'en' as const,
        timestamp: new Date().toISOString()
      };
      
      dispatch(addUtterance(repeatMessage));
      saveUtteranceToDatabase(repeatMessage);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-4 bg-blue-50 rounded-lg">
        <h1 className="text-2xl font-bold text-gray-900">Medical Interpreter (Demo)</h1>
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium text-gray-800">Demo Mode Active</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800 font-medium">
          {error}
        </div>
      )}

      {/* Processing Indicator */}
      {(isProcessing || isSpeaking) && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 font-medium">
          {isProcessing && '🔄 Processing speech and translating...'}
          {isSpeaking && '🔊 Playing translation...'}
        </div>
      )}

      {/* Speaker Toggle */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-blue-900">Language Detection</h3>
          <span className="px-2 py-1 bg-green-100 text-green-900 text-xs rounded-full font-medium">
            🤖 Auto-Detect Active
          </span>
        </div>
        <p className="text-sm text-blue-800 mb-3 font-medium">
          The system automatically detects if you're speaking English (Doctor) or Spanish (Patient). 
          Use manual override if needed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setIsDoctor(true)}
            className={`px-4 py-2 rounded text-sm font-medium ${isDoctor ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            👨‍⚕️ Doctor Mode (English)
          </button>
          <button
            onClick={() => setIsDoctor(false)}
            className={`px-4 py-2 rounded text-sm font-medium ${!isDoctor ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            🧑‍⚕️ Patient Mode (Spanish)
          </button>
        </div>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 border border-gray-300 rounded-lg p-4 overflow-y-auto mb-4 bg-white">
        {currentConversation?.utterances.map((utterance) => (
          <div
            key={utterance.id}
            className={`mb-4 p-4 rounded-lg shadow-sm ${
              utterance.role === 'doctor' 
                ? 'bg-blue-50 border-l-4 border-blue-500 ml-auto max-w-sm' 
                : utterance.role === 'patient'
                ? 'bg-green-50 border-l-4 border-green-500 mr-auto max-w-sm'
                : 'bg-gray-50 border-l-4 border-gray-400 mx-auto max-w-md'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-sm text-gray-900">
                {utterance.role === 'doctor' ? '👨‍⚕️ Doctor' : utterance.role === 'patient' ? '🧑‍⚕️ Patient' : '🔄 Translation'}
                <span className="ml-2 px-2 py-1 text-xs bg-white rounded border text-gray-800 font-medium">
                  {utterance.originalLang === 'en' ? 'English' : 'Spanish'}
                </span>
              </div>
              <span className="text-xs text-gray-600 font-medium">
                {new Date(utterance.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-gray-900 font-medium mb-2">{utterance.text}</div>
            {utterance.translatedText && (
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded">
                <div className="text-xs text-gray-700 mb-1 font-medium">Original:</div>
                <div className="text-gray-800 italic">{utterance.translatedText}</div>
              </div>
            )}
          </div>
        ))}
        
        {currentConversation?.utterances.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            <div className="text-4xl mb-2">🎤</div>
            <p className="font-medium">Start recording to begin the medical interpretation session</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={toggleRecording}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isRecording 
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
          }`}
        >
          {isRecording ? '🔴 Stop Recording' : '🎤 Start Recording'}
        </button>
        
        <button
          onClick={handleRepeatRequest}
          disabled={!currentConversation?.lastDoctorUtterance}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-colors font-medium"
        >
          🔁 Repeat Last
        </button>
      </div>

      {/* Detected Actions */}
      {detectedActions.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-900">Detected Actions:</h3>
          {detectedActions.map((action, index) => (
            <div key={index} className="flex items-center justify-between mb-2 p-2 bg-white rounded border">
              <div>
                <span className="font-medium text-blue-800">{action.name}</span>
                <span className="ml-2 text-sm text-gray-700 font-medium">
                  {JSON.stringify(action.parameters)}
                </span>
              </div>
              <span className={`px-3 py-1 rounded text-xs font-medium ${
                action.executed ? 'bg-green-200 text-green-900' : 'bg-orange-200 text-orange-900'
              }`}>
                {action.executed ? '✅ Executed' : '⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Demo Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 font-medium">
        <strong>Demo Mode:</strong> Using Web Speech API + OpenAI Chat API for translation. 
        Say "repeat that" in either language to replay the last doctor's statement.
      </div>
    </div>
  );
} 