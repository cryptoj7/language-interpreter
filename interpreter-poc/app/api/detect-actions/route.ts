import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
};

export async function POST(request: NextRequest) {
  try {
    const { text, language, conversationId } = await request.json();
    
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are a medical assistant that detects actionable intents in doctor-patient conversations.

Analyze the following text and detect if it contains any of these actionable intents:
1. Schedule follow-up appointment
2. Order laboratory tests/lab work

Return a JSON response with an array of detected actions. Each action should have:
- name: "schedule_followup" or "schedule_lab" 
- parameters: relevant extracted information

Examples:
- "Let's schedule a follow-up in two weeks" → {"name": "schedule_followup", "parameters": {"date": "in two weeks", "urgency": "routine"}}
- "I need to order some blood work" → {"name": "schedule_lab", "parameters": {"tests": ["blood work"], "priority": "routine"}}

If no actions are detected, return an empty array.

Text to analyze (in ${language === 'en' ? 'English' : 'Spanish'}):`
      }, {
        role: 'user',
        content: text
      }]
    });

    const result = completion.choices[0].message.content?.trim() || '[]';
    
    let actions = [];
    try {
      actions = JSON.parse(result);
    } catch (parseError) {
      console.error('Failed to parse action detection result:', parseError);
      actions = [];
    }

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Action detection error:', error);
    return NextResponse.json(
      { error: 'Action detection failed' },
      { status: 500 }
    );
  }
} 