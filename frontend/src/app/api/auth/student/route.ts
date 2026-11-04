import { NextResponse } from 'next/server';
import { authenticateStudent } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Direct plain-text credential verification against Supabase `student` table
    // DO NOT hash the passwords per requirements
    const student = await authenticateStudent(username.trim(), password.trim());

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      student: {
        username: student.username,
        quiz: student.quiz,
        lab: student.lab,
        quiz_status: student.quiz_status ?? (student.quiz !== null && student.quiz > 0 ? 1 : 0),
      },
    });
  } catch (err) {
    console.error('Student auth error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
