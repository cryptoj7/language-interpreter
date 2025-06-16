import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Create ephemeral session for OpenAI Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'alloy',
        instructions: `You are a medical interpreter assistant with automatic language detection. Your role is to:

1. AUTOMATICALLY DETECT the language being spoken (English or Spanish)
2. TRANSLATE ONLY what was spoken to the opposite language:
   - If you hear SPANISH → Respond ONLY in ENGLISH
   - If you hear ENGLISH → Respond ONLY in SPANISH
3. Maintain medical accuracy and terminology in both languages
4. Detect when medical actions are mentioned (scheduling appointments, lab work, prescriptions, referrals)
5. When you detect actions like "schedule lab work" or "schedule follow-up", call the detect_medical_action function
6. Provide clear, professional translations suitable for doctor-patient communication

CRITICAL TRANSLATION RULES:
- SPANISH INPUT = ENGLISH OUTPUT (always translate Spanish to English)
- ENGLISH INPUT = SPANISH OUTPUT (always translate English to Spanish)
- ONLY respond when you hear CLEAR, MEANINGFUL speech (not silence, noise, or unclear sounds)
- Do NOT respond to: silence, background noise, "um", "uh", "hmm", breathing sounds, or unclear audio
- ONLY translate the exact content spoken - do not add greetings, explanations, or extra words
- Do not say "The patient said..." or "The doctor said..." - just provide the direct translation
- Do not add conversational elements like "How can I help?" or similar
- Keep translations concise and medically accurate
- Respond IMMEDIATELY with just the translation when speech is clear
- If the audio is unclear or just noise, DO NOT RESPOND AT ALL

SILENCE HANDLING: If you detect silence, background noise, or unclear audio, remain silent. Only respond to clear speech.

IMPORTANT: You are a TRANSLATOR. Spanish words must become English words. English words must become Spanish words. Never respond in the same language you heard.`,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { 
          type: 'server_vad',
          threshold: 0.7,
          prefix_padding_ms: 500,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: 'function',
            name: 'detect_medical_action',
            description: 'Detect and extract medical actions from conversation',
            parameters: {
              type: 'object',
              properties: {
                action_type: {
                  type: 'string',
                  enum: ['schedule_lab', 'schedule_followup', 'prescribe_medication', 'refer_specialist']
                },
                parameters: {
                  type: 'object',
                  description: 'Action-specific parameters'
                }
              },
              required: ['action_type', 'parameters']
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI Realtime API error:', response.status, errorData);
      return NextResponse.json(
        { error: 'Failed to create realtime session', details: errorData },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    
    return NextResponse.json({
      client_secret: {
        value: sessionData.client_secret.value,
        expires_at: sessionData.client_secret.expires_at
      },
      session_id: sessionData.id,
      model: sessionData.model
    });
  } catch (error) {
    console.error('Realtime token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate realtime token' },
      { status: 500 }
    );
  }
} 