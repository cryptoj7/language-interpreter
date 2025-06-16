import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { conversationId, actionType, parameters, status } = await request.json();
    
    const action = await prisma.action.create({
      data: {
        conversationId,
        actionType,
        parameters,
        status: status || 'detected'
      }
    });

    return NextResponse.json({ 
      success: true, 
      actionId: action.id,
      action 
    });
  } catch (error) {
    console.error('Failed to create action:', error);
    return NextResponse.json(
      { error: 'Failed to create action' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const status = searchParams.get('status');

    const where: any = {};
    if (conversationId) where.conversationId = conversationId;
    if (status) where.status = status;

    const actions = await prisma.action.findMany({
      where,
      orderBy: { detectedAt: 'desc' }
    });

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Failed to fetch actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { actionId, status, webhookStatus, webhookResponse, errorMessage, executedAt, completedAt } = await request.json();
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (webhookStatus !== undefined) updateData.webhookStatus = webhookStatus;
    if (webhookResponse) updateData.webhookResponse = webhookResponse;
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (executedAt) updateData.executedAt = new Date(executedAt);
    if (completedAt) updateData.completedAt = new Date(completedAt);

    const action = await prisma.action.update({
      where: { id: actionId },
      data: updateData
    });

    return NextResponse.json({ 
      success: true, 
      action 
    });
  } catch (error) {
    console.error('Failed to update action:', error);
    return NextResponse.json(
      { error: 'Failed to update action' },
      { status: 500 }
    );
  }
} 