import { NextResponse } from 'next/server';
import {
  getAllStudents,
  resetStudentQuizStatus,
  getStudentByUsername,
  getDatabaseConnectionStatus,
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getAllStudents();
    const dbStatus = getDatabaseConnectionStatus();
    return NextResponse.json({
      success: true,
      students,
      dbStatus,
    });
  } catch (err) {
    console.error('Students GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student records' },
      { status: 500 }
    );
  }
}

/**
 * Change quiz_status of any student to 0 (or a specified status)
 * Requirement: "Also, he can change the quiz_status of any student to 0."
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, quiz_status } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Student username is required' },
        { status: 400 }
      );
    }

    const targetStatus = quiz_status !== undefined && quiz_status !== null ? Number(quiz_status) : 0;
    const ok = await resetStudentQuizStatus(username.trim(), targetStatus);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: `Failed to update quiz_status for ${username}` },
        { status: 500 }
      );
    }

    const updatedStudent = await getStudentByUsername(username.trim());

    return NextResponse.json({
      success: true,
      message: `Successfully set quiz_status for ${username} to ${targetStatus}`,
      student: updatedStudent || { username, quiz_status: targetStatus },
    });
  } catch (err) {
    console.error('Student status update POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error updating student status' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
