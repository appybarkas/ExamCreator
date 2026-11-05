import { NextResponse } from 'next/server';
import { processQuizZip, saveQuizQuestions, getFullQuizQuestions } from '@/lib/quizStore';
import { QuizQuestion } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file uploaded' },
          { status: 400 }
        );
      }

      const fileName = file.name.toLowerCase();

      // Check if uploaded file is a zip file (per AGENTS.md requirements)
      if (fileName.endsWith('.zip')) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = processQuizZip(buffer);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error || 'Failed to process quiz.zip' },
            { status: 400 }
          );
        }

        const loadedQuestions = getFullQuizQuestions();
        return NextResponse.json({
          success: true,
          count: result.count,
          message: `Successfully processed quiz.zip and loaded ${result.count} questions with figures`,
          questions: loadedQuestions,
        });
      }

      // If JSON file uploaded
      if (fileName.endsWith('.json')) {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return NextResponse.json(
              { success: false, error: 'JSON file must contain an array of questions' },
              { status: 400 }
            );
          }
          saveQuizQuestions(parsed as QuizQuestion[]);
          return NextResponse.json({
            success: true,
            count: parsed.length,
            message: `Successfully uploaded ${parsed.length} questions`,
            questions: parsed,
          });
        } catch {
          return NextResponse.json(
            { success: false, error: 'Uploaded file is not valid JSON' },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Please upload quiz.zip (or quiz.json).' },
        { status: 400 }
      );
    }

    // Direct JSON body fallback
    const body = await request.json();
    const questionsRaw = body.questions || body;

    if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Questions must be a non-empty array' },
        { status: 400 }
      );
    }

    saveQuizQuestions(questionsRaw as QuizQuestion[]);
    return NextResponse.json({
      success: true,
      count: questionsRaw.length,
      message: `Successfully saved ${questionsRaw.length} questions`,
      questions: questionsRaw,
    });
  } catch (err) {
    console.error('Quiz upload error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error processing upload' },
      { status: 500 }
    );
  }
}
