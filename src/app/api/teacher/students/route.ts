import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await getAllStudents();
    return NextResponse.json({
      success: true,
      students,
    });
  } catch (err) {
    console.error('Students GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student records' },
      { status: 500 }
    );
  }
}

