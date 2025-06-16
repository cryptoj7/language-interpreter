import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

// Initialize OpenAI client only when needed
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
};

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      include: {
        utterances: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          status: 'active'
        }
      });

      return NextResponse.json({ conversation });
    }

    if (action === 'add_utterance') {
      const { conversationId, utterance } = body;
      
      // Save utterance to database
      const savedUtterance = await prisma.utterance.create({
        data: {
          id: utterance.id,
          conversationId,
          role: utterance.role,
          text: utterance.text,
          originalLang: utterance.originalLang,
          translatedText: utterance.translatedText || null,
          timestamp: new Date(utterance.timestamp),
          audioUrl: utterance.audioUrl || null
        }
      });

      return NextResponse.json({ utterance: savedUtterance });
    }

    if (action === 'end') {
      const { conversationId } = body;
      
      // Get all utterances for this conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          utterances: {
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }

      // Generate summary using OpenAI
      const transcript = conversation.utterances
        .map((u: any) => `${u.role}: ${u.text}`)
        .join('\n');

      try {
        const openai = getOpenAIClient();
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `You are a medical assistant. Analyze this doctor-patient conversation transcript and provide a JSON response with:
            1. A clinical summary of the conversation
            2. A list of detected actions (schedule_followup, schedule_lab)
            
            Format: {"summary": "...", "actions": [...]}`
          }, {
            role: 'user',
            content: transcript
          }]
        });

        const responseContent = completion.choices[0].message.content || '{"summary": "", "actions": []}';
        
        // Extract JSON from markdown code blocks if present
        let jsonContent = responseContent;
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        
        let result;
        try {
          result = JSON.parse(jsonContent);
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', responseContent);
          result = {
            summary: `Clinical conversation completed. Raw response: ${responseContent.substring(0, 200)}...`,
            actions: []
          };
        }

        // Update conversation with summary
        const updatedConversation = await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            status: 'completed',
            summary: result.summary,
            actions: JSON.stringify(result.actions)
          }
        });

        return NextResponse.json({ 
          conversation: updatedConversation,
          summary: result.summary,
          actions: result.actions
        });
      } catch (openaiError) {
        console.error('OpenAI error:', openaiError);
        // Update conversation without summary if OpenAI fails
        const updatedConversation = await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            status: 'completed',
            summary: 'Summary generation failed - OpenAI API not available',
            actions: JSON.stringify([])
          }
        });

        return NextResponse.json({ 
          conversation: updatedConversation,
          summary: 'Summary generation failed - OpenAI API not available',
          actions: []
        });
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Conversation management error:', error);
    return NextResponse.json(
      { error: 'Failed to manage conversation' },
      { status: 500 }
    );
  }
} 