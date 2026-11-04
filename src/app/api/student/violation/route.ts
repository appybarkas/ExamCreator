import { NextResponse } from 'next/server';
import { recordStudentViolation } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, violations } = body;

    if (!username || violations === undefined) {
      return NextResponse.json(
        { success: false, error: 'Username and violations count are required' },
        { status: 400 }
      );
    }

    await recordStudentViolation(username, Number(violations));

    return NextResponse.json({
      success: true,
      violations: Number(violations),
      recordedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Violation recording error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error recording violation' },
      { status: 500 }
    );
  }
}

