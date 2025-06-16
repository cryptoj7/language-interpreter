import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { actionId, action, parameters, conversationId } = await request.json();
    
    // Update action status to 'executing'
    if (actionId) {
      await prisma.action.update({
        where: { id: actionId },
        data: { 
          status: 'executing',
          executedAt: new Date()
        }
      });
    }

    const webhookUrl = process.env.WEBHOOK_SITE_URL;
    if (!webhookUrl) {
      // Update action with error
      if (actionId) {
        await prisma.action.update({
          where: { id: actionId },
          data: { 
            status: 'failed',
            errorMessage: 'Webhook URL not configured'
          }
        });
      }
      return NextResponse.json(
        { error: 'Webhook URL not configured' },
        { status: 500 }
      );
    }

    // Execute the action by sending to webhook.site
    const webhookPayload = {
      action,
      parameters,
      conversationId,
      timestamp: new Date().toISOString(),
      source: 'medical-interpreter',
      actionId: actionId || null
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    const webhookResponseText = await webhookResponse.text();

    if (!webhookResponse.ok) {
      console.error('Webhook call failed:', webhookResponse.status, webhookResponse.statusText);
      
      // Update action with failure details
      if (actionId) {
        await prisma.action.update({
          where: { id: actionId },
          data: { 
            status: 'failed',
            webhookUrl,
            webhookStatus: webhookResponse.status,
            webhookResponse: webhookResponseText,
            errorMessage: `Webhook failed with status ${webhookResponse.status}: ${webhookResponse.statusText}`
          }
        });
      }
      
      throw new Error('Webhook call failed');
    }

    console.log('Webhook sent successfully for action:', action);

    // Update action with success details
    if (actionId) {
      await prisma.action.update({
        where: { id: actionId },
        data: { 
          status: 'completed',
          webhookUrl,
          webhookStatus: webhookResponse.status,
          webhookResponse: webhookResponseText,
          completedAt: new Date()
        }
      });
    }

    // Try to store the action execution in the database (optional - for backward compatibility)
    try {
      await prisma.utterance.create({
        data: {
          id: randomUUID(),
          conversationId,
          role: 'system',
          text: `Action executed: ${action} with parameters: ${JSON.stringify(parameters)}`,
          originalLang: 'en',
          timestamp: new Date()
        }
      });
      console.log('Action execution saved to utterances table');
    } catch (dbError) {
      console.error('Failed to save action execution to utterances table:', dbError);
      // Don't fail the whole request if utterance save fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `Action ${action} executed successfully`,
      webhookSent: true,
      actionId,
      webhookStatus: webhookResponse.status
    });
  } catch (error) {
    console.error('Action execution error:', error);
    
    // Update action with error if we have an actionId
    if (request.body) {
      try {
        const body = await request.json();
        if (body.actionId) {
          await prisma.action.update({
            where: { id: body.actionId },
            data: { 
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      } catch (parseError) {
        console.error('Failed to parse request body for error handling:', parseError);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
} 