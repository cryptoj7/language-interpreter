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
    const { text, fromLang, toLang, context } = await request.json();
    
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are a professional medical interpreter. Translate the following text from ${fromLang === 'en' ? 'English' : 'Spanish'} to ${toLang === 'en' ? 'English' : 'Spanish'}.

Context: Medical consultation
Instructions:
- Maintain medical accuracy and professional tone
- Preserve medical terminology appropriately
- Use formal, respectful language suitable for doctor-patient communication
- If translating from English to Spanish, use formal "usted" form
- Return only the translation, no additional commentary

Text to translate:`
      }, {
        role: 'user',
        content: text
      }]
    });

    const translatedText = completion.choices[0].message.content?.trim() || '';

    return NextResponse.json({
      translatedText,
      originalText: text,
      fromLang,
      toLang
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
} 