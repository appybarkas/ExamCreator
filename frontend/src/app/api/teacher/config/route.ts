import { NextResponse } from 'next/server';
import { getQuizConfig, saveQuizConfig, getFullQuizQuestions } from '@/lib/quizStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getQuizConfig();
    const questions = getFullQuizQuestions();

    return NextResponse.json({
      success: true,
      config,
      totalQuestions: questions.length,
      questions,
    });
  } catch (err) {
    console.error('Quiz config GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load quiz config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startTime, endTime, title, isCreated, maxViolations } = body;

    const parsedMaxViolations =
      maxViolations !== undefined && maxViolations !== null
        ? Math.max(1, parseInt(String(maxViolations), 10) || 3)
        : undefined;

    const updated = saveQuizConfig({
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(title !== undefined && { title }),
      ...(isCreated !== undefined && { isCreated: Boolean(isCreated) }),
      ...(parsedMaxViolations !== undefined && { maxViolations: parsedMaxViolations }),
    });

    return NextResponse.json({
      success: true,
      config: updated,
      message: isCreated
        ? 'Quiz successfully created and populated for students!'
        : 'Quiz configuration saved',
    });
  } catch (err) {
    console.error('Quiz config POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save quiz config' },
      { status: 500 }
    );
  }
}
