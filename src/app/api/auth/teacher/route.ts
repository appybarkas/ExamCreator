import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password } = body;

    const config = getAppConfig();

    if (
      name &&
      password &&
      name.trim() === config.TEACHER_NAME &&
      password.trim() === config.TEACHER_PASSWORD
    ) {
      return NextResponse.json({
        success: true,
        teacher: {
          name: config.TEACHER_NAME,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid teacher name or password' },
      { status: 401 }
    );
  } catch (err) {
    console.error('Teacher auth error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

