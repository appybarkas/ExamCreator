import { NextResponse } from 'next/server';
import { getQuizConfig, getStudentQuestions } from '@/lib/quizStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getQuizConfig();

    // If teacher hasn't created/published quiz yet
    if (!config.isCreated) {
      return NextResponse.json({
        success: true,
        isCreated: false,
        message: 'Quiz has not been published yet by the teacher.',
        config,
        questions: [],
      });
    }

    // Return student questions strictly WITHOUT answers
    const questions = getStudentQuestions();

    return NextResponse.json({
      success: true,
      isCreated: true,
      title: config.title || 'Exam',
      startTime: config.startTime || null,
      endTime: config.endTime || null,
      maxViolations: config.maxViolations || 3,
      totalQuestions: questions.length,
      questions,
    });
  } catch (err) {
    console.error('Student quiz GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve quiz questions' },
      { status: 500 }
    );
  }
}
