import { NextResponse } from 'next/server';
import { gradeStudentSubmission, getFullQuizQuestions } from '@/lib/quizStore';
import { updateStudentScore, getAllStudents } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, answers, isAutoSubmit, violations } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Student username is required' },
        { status: 400 }
      );
    }

    // Check if student has already submitted
    // Rule: "His quiz_status will become 1, indicating he has given the quiz and cannot give it again."
    const students = await getAllStudents();
    const existing = students.find((s) => s.username === username);
    if (existing && existing.quiz_status === 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'You have already submitted this quiz and cannot give it again.',
          alreadySubmitted: true,
        },
        { status: 403 }
      );
    }

    const fullQuestions = getFullQuizQuestions();
    const totalQuestions = fullQuestions.length;

    if (totalQuestions === 0) {
      return NextResponse.json(
        { success: false, error: 'No quiz questions are currently active' },
        { status: 400 }
      );
    }

    // Validation: The student must answer all questions to submit the quiz, else he cannot submit
    // Exception: Autosubmit when timer reaches zero
    if (!isAutoSubmit) {
      for (let i = 0; i < totalQuestions; i++) {
        if (!answers || !answers[i] || typeof answers[i] !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: `You must answer all questions to submit. Question ${i + 1} is unanswered.`,
              unansweredIndex: i,
            },
            { status: 400 }
          );
        }
      }
    }

    // Grade answers server-side (answers never revealed to student)
    // Each correct answer increases score by 1; no negative marking
    const { score } = gradeStudentSubmission(answers || {});

    // Save total score and violations to table `student` under columns `quiz`, `quiz_status`, and `violations`
    const violationsCount = Number(violations || 0);
    await updateStudentScore(username, score, violationsCount);

    return NextResponse.json({
      success: true,
      score,
      totalQuestions,
      username,
      quiz_status: 1,
      violations: violationsCount,
      submittedAt: new Date().toISOString(),
      message: 'Exam submitted successfully.',
    });
  } catch (err) {
    console.error('Submission processing error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while evaluating exam' },
      { status: 500 }
    );
  }
}
