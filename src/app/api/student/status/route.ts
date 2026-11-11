import { NextResponse } from 'next/server';
import { getStudentByUsername } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username query parameter is required' },
        { status: 400 }
      );
    }

    const student = await getStudentByUsername(username);

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      username: student.username,
      quiz: student.quiz,
      quiz_status: student.quiz_status ?? 0,
      violations: student.violations ?? 0,
    });
  } catch (err) {
    console.error('Student status GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve student status' },
      { status: 500 }
    );
  }
}
