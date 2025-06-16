'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, addUtterance, setRecording, setConnected, setError, addDetectedAction, markActionExecuted } from '../lib/store';

interface RealtimeInterpreterProps {
  conversationId: string;
}

export default function RealtimeInterpreter({ conversationId }: RealtimeInterpreterProps) {
  const dispatch = useDispatch();
  const { currentConversation, isRecording, error, detectedActions } = useSelector(
    (state: RootState) => state.interpreter
  );

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentMode, setCurrentMode] = useState<'doctor' | 'patient'>('doctor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranslation, setLastTranslation] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize WebRTC connection to OpenAI Realtime API
  const connectToRealtimeAPI = useCallback(async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    dispatch(setError(null));

    try {
      // Get ephemeral token from our API
      const tokenResponse = await fetch('/api/realtime-token');
      if (!tokenResponse.ok) {
        throw new Error('Failed to get realtime token');
      }
      const { client_secret, model } = await tokenResponse.json();

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      // Handle incoming audio stream
      pc.ontrack = (event) => {
        if (audioEl) {
          audioEl.srcObject = event.streams[0];
        }
      };

      // Create data channel for sending instructions
      const dataChannel = pc.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('Data channel opened');
        setIsConnected(true);
        setIsConnecting(false);
        dispatch(setConnected(true));
        
        // Automatically start recording after connection
        setTimeout(async () => {
          dispatch(setRecording(true));
          const event = {
            type: 'input_audio_buffer.clear'
          };
          dataChannel.send(JSON.stringify(event));
          console.log('Auto-started recording after connection');
        }, 200);
      };

      dataChannel.onmessage = (event) => {
        handleRealtimeEvent(JSON.parse(event.data));
      };

      dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        dispatch(setError('Data channel error'));
      };

      // Add microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000
        } 
      });
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI Realtime API (correct endpoint)
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client_secret.value}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('WebRTC connection failed:', sdpResponse.status, errorText);
        throw new Error(`Failed to connect to OpenAI Realtime API: ${sdpResponse.status} ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

    } catch (error) {
      console.error('Connection error:', error);
      dispatch(setError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [isConnecting, isConnected, dispatch]);

  // Handle events from OpenAI Realtime API
  const handleRealtimeEvent = (event: any) => {
    console.log('📡 Realtime event received:', event.type, event);

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        // Original speech transcription with automatic language detection
        const originalText = event.transcript;
        
        // Skip if transcript is empty, too short, or just noise
        if (!originalText || originalText.trim().length < 3 || isJustNoise(originalText)) {
          console.log('Skipping empty or noise transcript:', originalText);
          return;
        }
        
        // Check if this is a repeat command
        if (isRepeatCommand(originalText)) {
          console.log('🔄 Repeat command detected:', originalText);
          const detectedLang = detectLanguage(originalText);
          handleRepeatCommand(detectedLang);
          return; // Don't process as normal translation
        }
        
        // Detect language automatically based on content
        const detectedLang = detectLanguage(originalText);
        const actualRole: 'doctor' | 'patient' = detectedLang === 'es' ? 'patient' : 'doctor';
        
        console.log('Language detected:', detectedLang, 'Role:', actualRole, 'Text:', originalText);
        
        const originalUtterance = {
          id: `utterance_${Date.now()}`,
          role: actualRole,
          text: originalText,
          originalLang: detectedLang,
          timestamp: new Date().toISOString()
        };
        
        dispatch(addUtterance(originalUtterance));
        saveUtteranceToDatabase(originalUtterance);
        break;

      case 'response.audio_transcript.done':
        // AI's translated response
        const translatedText = event.transcript;
        
        // Skip if translation is empty or just noise
        if (!translatedText || translatedText.trim().length < 3 || isJustNoise(translatedText)) {
          console.log('Skipping empty or noise translation:', translatedText);
          return;
        }
        
        // Store the last translation for repeat functionality
        setLastTranslation(translatedText);
        
        // Find the last USER utterance (not system translation)
        const lastUserUtterance = currentConversation?.utterances
          .slice()
          .reverse()
          .find(utterance => utterance.role === 'doctor' || utterance.role === 'patient');
        
        const responseLanguage: 'en' | 'es' = lastUserUtterance?.originalLang === 'es' ? 'en' : 'es';
        
        console.log('Translation received:', translatedText, 'Last user utterance:', lastUserUtterance?.originalLang, 'Response language:', responseLanguage);
        
        const translatedUtterance = {
          id: `translation_${Date.now()}`,
          role: 'system' as const,
          text: translatedText,
          originalLang: responseLanguage,
          timestamp: new Date().toISOString()
        };
        
        dispatch(addUtterance(translatedUtterance));
        saveUtteranceToDatabase(translatedUtterance);
        break;

      case 'response.function_call_delta':
        // Handle medical action detection
        console.log('🔧 Function call delta received:', event);
        if (event.name === 'detect_medical_action') {
          try {
            console.log('🏥 Medical action detected, parsing arguments:', event.arguments);
            const actionData = JSON.parse(event.arguments);
            console.log('🏥 Parsed action data:', actionData);
            handleDetectedAction(actionData.action_type, actionData.parameters);
          } catch (error) {
            console.error('❌ Error parsing action data:', error);
            console.error('❌ Raw arguments:', event.arguments);
          }
        }
        break;

      case 'response.function_call_done':
        // Handle completed function calls
        console.log('🔧 Function call done received:', event);
        if (event.name === 'detect_medical_action') {
          try {
            console.log('🏥 Medical action completed, parsing arguments:', event.arguments);
            const actionData = JSON.parse(event.arguments);
            console.log('🏥 Parsed completed action data:', actionData);
            handleDetectedAction(actionData.action_type, actionData.parameters);
          } catch (error) {
            console.error('❌ Error parsing completed action data:', error);
            console.error('❌ Raw arguments:', event.arguments);
          }
        }
        break;

      case 'response.tool_calls':
        // Handle tool calls (alternative event type)
        console.log('🔧 Tool calls received:', event);
        if (event.tool_calls) {
          event.tool_calls.forEach((toolCall: any) => {
            if (toolCall.function?.name === 'detect_medical_action') {
              try {
                console.log('🏥 Medical action from tool call, parsing arguments:', toolCall.function.arguments);
                const actionData = JSON.parse(toolCall.function.arguments);
                console.log('🏥 Parsed tool call action data:', actionData);
                handleDetectedAction(actionData.action_type, actionData.parameters);
              } catch (error) {
                console.error('❌ Error parsing tool call action data:', error);
                console.error('❌ Raw tool call arguments:', toolCall.function.arguments);
              }
            }
          });
        }
        break;

      case 'error':
        console.error('OpenAI Realtime API error:', event);
        
        // Handle specific error types
        if (event.error?.message?.includes('buffer too small')) {
          console.log('Audio buffer too small - this is normal when starting recording');
          // Don't show this as a user error since it's expected behavior
          return;
        }
        
        dispatch(setError(`API Error: ${event.error?.message || 'Unknown error'}`));
        break;
        
      default:
        // Log unhandled events, especially function call related ones
        if (event.type?.includes('function') || event.type?.includes('tool')) {
          console.log('🔧 Unhandled function/tool event:', event.type, event);
        } else {
          console.log('📡 Unhandled event type:', event.type);
        }
        break;
    }
  };

  // Check if text is just noise or meaningless sounds
  const isJustNoise = (text: string): boolean => {
    const cleanText = text.toLowerCase().trim();
    
    // Common noise patterns
    const noisePatterns = [
      /^[aeiou\s]*$/,  // Just vowels and spaces
      /^[hmm\s]*$/,    // Just "hmm" sounds
      /^[uh\s]*$/,     // Just "uh" sounds
      /^[ah\s]*$/,     // Just "ah" sounds
      /^[oh\s]*$/,     // Just "oh" sounds
      /^\W*$/,         // Just punctuation/symbols
      /^[\.\,\!\?\s]*$/ // Just punctuation
    ];
    
    return noisePatterns.some(pattern => pattern.test(cleanText)) || 
           cleanText.length < 3 ||
           cleanText === 'um' ||
           cleanText === 'uh' ||
           cleanText === 'hmm' ||
           cleanText === 'ah' ||
           cleanText === 'oh';
  };

  // Check if user is asking to repeat the last translation
  const isRepeatCommand = (text: string): boolean => {
    const cleanText = text.toLowerCase().trim();
    const repeatPatterns = [
      /repeat\s+that/,
      /say\s+that\s+again/,
      /can\s+you\s+repeat/,
      /repeat\s+please/,
      /say\s+again/,
      /repite\s+eso/,
      /repítelo/,
      /dilo\s+otra\s+vez/,
      /puedes\s+repetir/
    ];
    
    return repeatPatterns.some(pattern => pattern.test(cleanText));
  };

  // Handle repeat command using text-to-speech
  const handleRepeatCommand = async (requestLanguage: 'en' | 'es') => {
    if (!lastTranslation) {
      console.log('No previous translation to repeat');
      return;
    }

    console.log('🔄 Repeating last translation:', lastTranslation);

    // Use Web Speech API for text-to-speech
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(lastTranslation);
      
      // Set language and voice based on the translation language
      const voices = speechSynthesis.getVoices();
      if (requestLanguage === 'es') {
        utterance.lang = 'es-ES';
        const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
        if (spanishVoice) utterance.voice = spanishVoice;
      } else {
        utterance.lang = 'en-US';
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }
      
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      speechSynthesis.speak(utterance);

      // Add the repeat action to the conversation
      const repeatUtterance = {
        id: `repeat_${Date.now()}`,
        role: 'system' as const,
        text: `🔄 Repeated: "${lastTranslation}"`,
        originalLang: requestLanguage,
        timestamp: new Date().toISOString()
      };
      
      dispatch(addUtterance(repeatUtterance));
      saveUtteranceToDatabase(repeatUtterance);
    } else {
      console.error('Speech synthesis not supported');
    }
  };

  // Improved language detection function
  const detectLanguage = (text: string): 'en' | 'es' => {
    const cleanText = text.toLowerCase().trim();
    
    // Common Spanish words and medical terms
    const spanishWords = [
      // Common words
      'el', 'la', 'los', 'las', 'es', 'en', 'de', 'que', 'y', 'a', 'un', 'una', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'tiene', 'me', 'si', 'bien', 'puede', 'este', 'está', 'todo', 'yo', 'muy', 'ahora', 'cada', 'sí', 'voy', 'gusta', 'nada', 'muchas', 'ni', 'contra', 'otros', 'ese', 'eso', 'había', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'del', 'al',
      // Medical terms
      'dolor', 'gracias', 'medicina', 'doctor', 'doctora', 'paciente', 'hospital', 'enfermedad', 'síntoma', 'síntomas', 'tratamiento', 'medicamento', 'medicamentos', 'cita', 'análisis', 'sangre', 'cabeza', 'estómago', 'brazo', 'pierna', 'corazón', 'pecho', 'espalda', 'fiebre', 'tos', 'gripe', 'resfriado', 'alergia', 'presión', 'diabetes', 'pastilla', 'pastillas', 'inyección', 'radiografía', 'examen', 'consulta', 'enfermera', 'enfermero', 'clínica', 'urgencias', 'emergencia', 'receta', 'dosis', 'tomar', 'sentir', 'duele', 'duelen', 'molesta', 'molestan', 'mejor', 'peor', 'grave', 'leve', 'crónico', 'agudo', 'infección', 'inflamación', 'hinchazón', 'mareo', 'náusea', 'vómito', 'diarrea', 'estreñimiento', 'insomnio', 'cansancio', 'debilidad'
    ];
    
    // Common English words and medical terms
    const englishWords = [
      // Common words
      'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'and', 'or', 'but', 'so', 'if', 'when', 'where', 'why', 'how', 'what', 'who', 'which', 'with', 'without', 'for', 'from', 'to', 'at', 'in', 'on', 'by', 'about', 'over', 'under', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
      // Medical terms
      'pain', 'medicine', 'medication', 'doctor', 'patient', 'hospital', 'disease', 'illness', 'symptom', 'symptoms', 'treatment', 'appointment', 'analysis', 'blood', 'head', 'stomach', 'arm', 'leg', 'heart', 'chest', 'back', 'fever', 'cough', 'flu', 'cold', 'allergy', 'pressure', 'diabetes', 'pill', 'pills', 'injection', 'xray', 'exam', 'examination', 'consultation', 'nurse', 'clinic', 'emergency', 'prescription', 'dose', 'take', 'feel', 'hurt', 'hurts', 'ache', 'aches', 'better', 'worse', 'serious', 'mild', 'chronic', 'acute', 'infection', 'inflammation', 'swelling', 'dizzy', 'nausea', 'vomit', 'diarrhea', 'constipation', 'insomnia', 'tired', 'weakness'
    ];
    
    const words = cleanText.split(/\s+/).filter(word => word.length > 1);
    
    if (words.length === 0) return 'en'; // Default to English if no words
    
    const spanishMatches = words.filter(word => spanishWords.includes(word)).length;
    const englishMatches = words.filter(word => englishWords.includes(word)).length;
    
    const spanishRatio = spanishMatches / words.length;
    const englishRatio = englishMatches / words.length;
    
    console.log('Language detection:', {
      text: cleanText,
      words: words.length,
      spanishMatches,
      englishMatches,
      spanishRatio,
      englishRatio
    });
    
    // If we have clear Spanish indicators, it's Spanish
    if (spanishRatio > 0.15 && spanishRatio > englishRatio) {
      return 'es';
    }
    
    // If we have clear English indicators, it's English
    if (englishRatio > 0.15 && englishRatio > spanishRatio) {
      return 'en';
    }
    
    // Fallback: check for specific Spanish patterns
    if (/\b(el|la|los|las|es|está|son|están|de|del|al|con|por|para|que|qué|sí|no|muy|más|menos|bien|mal|dolor|duele|me|te|se|nos|os|le|les)\b/.test(cleanText)) {
      return 'es';
    }
    
    // Default to English if unclear
    return 'en';
  };

  // Handle detected medical actions
  const handleDetectedAction = async (actionType: string, parameters: any) => {
    console.log('🏥 Handling detected action:', { actionType, parameters });
    
    dispatch(addDetectedAction({
      name: actionType,
      parameters,
      executed: false
    }));
    
    console.log('🏥 Added action to Redux store, now saving and executing...');
    await saveAndExecuteAction(actionType, parameters);
  };

  // Save utterance to database
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

  // Save and execute detected actions
  const saveAndExecuteAction = async (actionName: string, parameters: any) => {
    console.log('🔄 Starting saveAndExecuteAction:', { actionName, parameters, conversationId });
    
    try {
      // Save to database
      console.log('📝 Saving action to database...');
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

      console.log('📝 Save response status:', saveResponse.status);
      
      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error('❌ Failed to save action - Response:', errorText);
        throw new Error(`Failed to save action to database: ${saveResponse.status} ${errorText}`);
      }

      const saveResult = await saveResponse.json();
      console.log('✅ Action saved successfully:', saveResult);
      const { actionId } = saveResult;

      // Execute the action
      console.log('🚀 Executing action with ID:', actionId);
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
      
      console.log('🚀 Execute response status:', executeResponse.status);
      
      if (executeResponse.ok) {
        const executeResult = await executeResponse.json();
        console.log('✅ Action executed successfully:', executeResult);
        dispatch(markActionExecuted(actionName));
      } else {
        const errorText = await executeResponse.text();
        console.error('❌ Failed to execute action - Response:', errorText);
      }
    } catch (err) {
      console.error('💥 Failed to save and execute action:', err);
      console.error('💥 Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        actionName,
        parameters,
        conversationId
      });
    }
  };

  // Toggle recording mode - now connects and starts recording in one action
  const toggleRecording = async () => {
    if (!isConnected) {
      // Connect and immediately start recording
      await connectToRealtimeAPI();
      return;
    }

    if (isRecording) {
      // Stop recording
      dispatch(setRecording(false));
      
      if (dataChannelRef.current) {
        const event = {
          type: 'input_audio_buffer.commit'
        };
        dataChannelRef.current.send(JSON.stringify(event));
        console.log('Stopped recording - attempting to commit buffer');
      }
    } else {
      // Start recording
      dispatch(setRecording(true));
      
      if (dataChannelRef.current) {
        const event = {
          type: 'input_audio_buffer.clear'
        };
        dataChannelRef.current.send(JSON.stringify(event));
        console.log('Started recording - cleared buffer');
        
        // Small delay to ensure buffer is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  // Switch between doctor and patient modes (now mainly for session updates)
  const switchMode = (mode: 'doctor' | 'patient') => {
    setCurrentMode(mode);
    if (isConnected && dataChannelRef.current) {
      // Update session instructions for automatic language detection
      const sessionUpdate = {
        type: 'session.update',
        session: {
          instructions: `You are a medical interpreter assistant with automatic language detection. Your role is to:

1. AUTOMATICALLY DETECT the language being spoken (English or Spanish)
2. TRANSLATE ONLY what was spoken to the opposite language:
   - If you hear English → Respond ONLY with the Spanish translation
   - If you hear Spanish → Respond ONLY with the English translation
3. Maintain medical accuracy and terminology in both languages
4. Detect when medical actions are mentioned (scheduling appointments, lab work, prescriptions, referrals)
5. When you detect actions like "schedule lab work" or "schedule follow-up", call the detect_medical_action function
6. Provide clear, professional translations suitable for doctor-patient communication

CRITICAL RULES:
- ONLY translate the exact content spoken - do not add greetings, explanations, or extra words
- Do not say "The patient said..." or "The doctor said..." - just provide the direct translation
- Do not add conversational elements like "How can I help?" or similar
- Keep translations concise and medically accurate
- Respond IMMEDIATELY with just the translation

IMPORTANT: Always respond in the OPPOSITE language of what you hear. Provide ONLY the direct translation without any additional commentary.`
        }
      };
      dataChannelRef.current.send(JSON.stringify(sessionUpdate));
    }
  };

  // Disconnect from API
  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    dispatch(setConnected(false));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 p-4 bg-blue-50 rounded-lg">
        <h1 className="text-2xl font-bold text-gray-900">Medical Interpreter (OpenAI Realtime)</h1>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-800">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800 font-medium">
          {error}
        </div>
      )}

      {/* Language Detection Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-blue-900">Automatic Language Detection</h3>
          <span className="px-2 py-1 bg-green-100 text-green-900 text-xs rounded-full font-medium">
            🤖 Real-time AI Translation
          </span>
        </div>
        <p className="text-sm text-blue-800 mb-3 font-medium">
          The AI automatically detects language and assigns roles: <strong>Spanish = Patient</strong>, <strong>English = Doctor</strong>. 
          Translation happens automatically to the opposite language.
        </p>
        {lastTranslation && (
          <div className="mt-2 p-2 bg-blue-100 rounded border">
            <p className="text-xs text-blue-700 font-medium">💬 Last Translation Available:</p>
            <p className="text-sm text-blue-800 italic">"{lastTranslation}"</p>
            <p className="text-xs text-blue-600 mt-1">Say "repeat that" or "repite eso" to hear it again</p>
          </div>
        )}
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
                {utterance.role === 'doctor' ? '👨‍⚕️ Doctor' : utterance.role === 'patient' ? '🧑‍⚕️ Patient' : '🔄 AI Translation'}
                <span className="ml-2 px-2 py-1 text-xs bg-white rounded border text-gray-800 font-medium">
                  {utterance.originalLang === 'en' ? 'English' : 'Spanish'}
                </span>
              </div>
              <span className="text-xs text-gray-600 font-medium">
                {new Date(utterance.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-gray-900 font-medium">{utterance.text}</div>
          </div>
        ))}
        
        {currentConversation?.utterances.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            <div className="text-4xl mb-2">🎤</div>
            <p className="font-medium">
              {isConnected 
                ? 'Start speaking for automatic language detection and real-time translation' 
                : 'Click "Connect & Start" to begin the medical interpretation session'
              }
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={toggleRecording}
          disabled={isConnecting}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isConnected && isRecording
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg' 
              : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? '🔄 Connecting...' : 
           isConnected && isRecording ? '🔴 Stop Recording' : 
           '🚀 Connect & Start Recording'}
        </button>
        
        {isConnected && (
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-lg transition-colors font-medium"
          >
            🔌 Disconnect
          </button>
        )}
      </div>

      {/* Detected Actions */}
      {detectedActions.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-gray-900">Detected Medical Actions:</h3>
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

      {/* Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 font-medium">
        <strong>OpenAI Realtime API:</strong> Real-time voice translation with WebRTC and automatic language detection. 
        Medical actions are automatically detected and processed.
      </div>
    </div>
  );
}