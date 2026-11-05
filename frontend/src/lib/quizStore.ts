import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { QuizQuestion, StudentQuizQuestion, QuizConfig } from './types';
import os from 'os';

export function getQuizZipFilePath(): string {
  return path.join(os.tmpdir(), 'quiz.zip');
}

export function getQuizFilePath(): string {
  return path.join(os.tmpdir(), 'quiz.json');
}

export function getConfigFilePath(): string {
  return path.join(os.tmpdir(), 'quiz_config.json');
}

export function getFiguresDir(): string {
  return path.join(os.tmpdir(), 'figures');
}

/**
 * Normalizes figure paths (e.g. "./figures/Fig1.jpg" -> "/figures/Fig1.jpg")
 */
export function normalizeFigurePath(figPath?: string): string | undefined {
  if (!figPath || typeof figPath !== 'string') return undefined;
  const trimmed = figPath.trim();
  if (!trimmed) return undefined;

  // If already absolute or starts with http
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  // Extract basename / subpath relative to figures
  const cleaned = trimmed.replace(/^\.\//, '').replace(/^figures\//, '');
  return `/figures/${cleaned}`;
}

/**
 * Process uploaded zip buffer:
 * 1. Saves to ./frontend/quiz.zip
 * 2. Extracts quiz.json and figures folder
 */
export function processQuizZip(zipBuffer: Buffer): { success: boolean; count: number; error?: string } {
  try {
    const zipPath = getQuizZipFilePath();
    const zipDir = path.dirname(zipPath);
    if (!fs.existsSync(zipDir)) {
      fs.mkdirSync(zipDir, { recursive: true });
    }

    // Save ./frontend/quiz.zip
    fs.writeFileSync(zipPath, zipBuffer);

    // Extract using AdmZip
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    let jsonEntry = null;
    for (const entry of zipEntries) {
      if (entry.entryName.endsWith('quiz.json') || entry.name === 'quiz.json') {
        jsonEntry = entry;
        break;
      }
    }

    if (!jsonEntry) {
      return { success: false, count: 0, error: 'The zip file must contain quiz.json' };
    }

    const jsonText = jsonEntry.getData().toString('utf8');
    const questionsRaw = JSON.parse(jsonText);

    if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
      return { success: false, count: 0, error: 'quiz.json must contain a non-empty array of questions' };
    }

    // Save quiz.json
    const quizJsonPath = getQuizFilePath();
    fs.writeFileSync(quizJsonPath, JSON.stringify(questionsRaw, null, 2), 'utf8');

    // Extract figures to public/figures
    const figuresDir = getFiguresDir();
    if (!fs.existsSync(figuresDir)) {
      fs.mkdirSync(figuresDir, { recursive: true });
    }

    // Also extract to frontend/figures just in case
    const frontendFiguresDir = path.join(path.dirname(quizJsonPath), 'figures');
    if (!fs.existsSync(frontendFiguresDir)) {
      fs.mkdirSync(frontendFiguresDir, { recursive: true });
    }

    for (const entry of zipEntries) {
      if (!entry.isDirectory && (entry.entryName.includes('figures/') || entry.entryName.includes('figures\\'))) {
        const fileName = path.basename(entry.entryName);
        if (fileName) {
          const destFilePublic = path.join(figuresDir, fileName);
          const destFileFrontend = path.join(frontendFiguresDir, fileName);
          fs.writeFileSync(destFilePublic, entry.getData());
          fs.writeFileSync(destFileFrontend, entry.getData());
        }
      }
    }

    return { success: true, count: questionsRaw.length };
  } catch (err) {
    console.error('Error processing quiz.zip:', err);
    return { success: false, count: 0, error: String(err) };
  }
}

/**
 * Load questions from ./frontend/quiz.json with full answers (server-side only)
 */
export function getFullQuizQuestions(): QuizQuestion[] {
  const filePath = getQuizFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading quiz.json:', err);
  }
  return [];
}

/**
 * Save new questions to ./frontend/quiz.json
 */
export function saveQuizQuestions(questions: QuizQuestion[]): boolean {
  const filePath = getQuizFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving quiz.json:', err);
    return false;
  }
}

/**
 * Get student-safe questions (strips 'Answer' field completely, normalizes figures)
 */
export function getStudentQuestions(): StudentQuizQuestion[] {
  const fullQuestions = getFullQuizQuestions();
  return fullQuestions.map((q, idx) => {
    const normalizedFigOptions: Record<string, string> = {};
    if (q.figures_options) {
      for (const [k, v] of Object.entries(q.figures_options)) {
        if (v) {
          normalizedFigOptions[k] = normalizeFigurePath(v) || '';
        }
      }
    }

    return {
      id: idx,
      question: q.question,
      figure: normalizeFigurePath(q.figure),
      options: {
        A: q.options?.A || '',
        B: q.options?.B || '',
        C: q.options?.C || '',
        D: q.options?.D || '',
      },
      figures_options: normalizedFigOptions,
    };
  });
}

/**
 * Get Quiz Configuration (start time, end time, isCreated status)
 */
export function getQuizConfig(): QuizConfig {
  const filePath = getConfigFilePath();
  const defaultQuestions = getFullQuizQuestions();
  const defaultConfig: QuizConfig = {
    isCreated: true,
    title: 'Computer Science Core Assessment',
    startTime: '',
    endTime: '',
    totalQuestions: defaultQuestions.length,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      return {
        ...defaultConfig,
        ...parsed,
        totalQuestions: defaultQuestions.length,
      };
    } else {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error reading quiz_config.json:', err);
  }

  // Create initial default config if missing
  saveQuizConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Save Quiz Configuration
 */
export function saveQuizConfig(config: Partial<QuizConfig>): QuizConfig {
  const current = getQuizConfig();
  const updated: QuizConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getConfigFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving quiz_config.json:', err);
  }

  return updated;
}

/**
 * Grade student answers against server-side quiz.json
 * Each correct answer increases score by 1; no negative marking.
 */
export function gradeStudentSubmission(answers: Record<number, string>): {
  score: number;
  totalQuestions: number;
} {
  const fullQuestions = getFullQuizQuestions();
  let score = 0;

  fullQuestions.forEach((q, idx) => {
    const studentChoice = answers[idx];
    if (
      studentChoice &&
      q.Answer &&
      studentChoice.trim().toUpperCase() === q.Answer.trim().toUpperCase()
    ) {
      score += 1;
    }
  });

  return {
    score,
    totalQuestions: fullQuestions.length,
  };
}
