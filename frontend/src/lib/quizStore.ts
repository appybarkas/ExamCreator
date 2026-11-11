import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { QuizQuestion, StudentQuizQuestion, QuizConfig } from './types';
import os from 'os';

/**
 * Returns candidate file paths across cwd, frontend/, parent, and os.tmpdir()
 */
function getCandidateFilePaths(fileName: string): string[] {
  const list: string[] = [];
  const cwd = process.cwd();

  if (cwd.endsWith('frontend')) {
    list.push(path.join(cwd, fileName));
    list.push(path.join(cwd, '..', fileName));
  } else {
    list.push(path.join(cwd, 'frontend', fileName));
    list.push(path.join(cwd, fileName));
  }

  list.push(path.join(os.tmpdir(), fileName));
  return Array.from(new Set(list));
}

/**
 * Find the first existing and non-empty file path
 */
export function findExistingFilePath(fileName: string): string {
  const candidates = getCandidateFilePaths(fileName);
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.size > 0) return p;
      } catch {
        // Continue
      }
    }
  }
  return candidates[0];
}

/**
 * Write content to all writeable locations so the quiz remains fixed and persistent
 */
export function writeToAllLocations(fileName: string, content: string | Buffer): void {
  const candidates = getCandidateFilePaths(fileName);
  let written = false;
  for (const p of candidates) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(p, content);
      written = true;
    } catch {
      // Ignore read-only filesystem errors for certain paths
    }
  }
  if (!written) {
    const tmpPath = path.join(os.tmpdir(), fileName);
    try {
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      fs.writeFileSync(tmpPath, content);
    } catch {
      // Ignore
    }
  }
}

export function getQuizZipFilePath(): string {
  return findExistingFilePath('quiz.zip');
}

export function getQuizFilePath(): string {
  return findExistingFilePath('quiz.json');
}

export function getConfigFilePath(): string {
  return findExistingFilePath('quiz_config.json');
}

export function getFigureDirs(): string[] {
  const cwd = process.cwd();
  const list: string[] = [];
  if (cwd.endsWith('frontend')) {
    list.push(path.join(cwd, 'public', 'figures'));
    list.push(path.join(cwd, 'figures'));
    list.push(path.join(cwd, '..', 'public', 'figures'));
    list.push(path.join(cwd, '..', 'figures'));
  } else {
    list.push(path.join(cwd, 'frontend', 'public', 'figures'));
    list.push(path.join(cwd, 'frontend', 'figures'));
    list.push(path.join(cwd, 'public', 'figures'));
    list.push(path.join(cwd, 'figures'));
  }
  list.push(path.join(os.tmpdir(), 'figures'));
  return Array.from(new Set(list));
}

export function getFiguresDir(): string {
  const possibleDirs = getFigureDirs();
  for (const d of possibleDirs) {
    if (fs.existsSync(d)) return d;
  }
  return possibleDirs[0];
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
 * 1. Saves to ./frontend/quiz.zip (and mirrors to root and tmpdir)
 * 2. Extracts quiz.json and figures folder
 * 3. Keeps the newly populated quiz fixed until updated
 */
export function processQuizZip(zipBuffer: Buffer): { success: boolean; count: number; error?: string } {
  try {
    writeToAllLocations('quiz.zip', zipBuffer);

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

    // Save quiz.json (will persist across all locations and keep quiz populated/fixed)
    saveQuizQuestions(questionsRaw as QuizQuestion[]);

    // Extract figures to all candidate directories
    const figureDirs = getFigureDirs();

    for (const d of figureDirs) {
      try {
        if (!fs.existsSync(d)) {
          fs.mkdirSync(d, { recursive: true });
        }
      } catch {
        // Ignore
      }
    }

    for (const entry of zipEntries) {
      if (!entry.isDirectory && (entry.entryName.includes('figures/') || entry.entryName.includes('figures\\'))) {
        const fileName = path.basename(entry.entryName);
        if (fileName) {
          const fileData = entry.getData();
          for (const d of figureDirs) {
            try {
              fs.writeFileSync(path.join(d, fileName), fileData);
            } catch {
              // Ignore
            }
          }
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
 * Load questions from quiz.json with full answers (server-side only).
 * Returns the fixed populated quiz questions.
 */
export function getFullQuizQuestions(): QuizQuestion[] {
  const candidates = getCandidateFilePaths('quiz.json');
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Continue
    }
  }
  return [];
}

/**
 * Save new questions to quiz.json.
 * Keeps the populated quiz fixed until updated with a new one.
 */
export function saveQuizQuestions(questions: QuizQuestion[]): boolean {
  try {
    const jsonStr = JSON.stringify(questions, null, 2);
    writeToAllLocations('quiz.json', jsonStr);

    // Update config to keep totalQuestions and fixed status in sync
    const current = getQuizConfig();
    saveQuizConfig({
      ...current,
      totalQuestions: questions.length,
      isCreated: true, // Fixed and populated until updated with a new one
      updatedAt: new Date().toISOString(),
    });
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
 * Get Quiz Configuration (start time, end time, maxViolations, isCreated status)
 * The populated quiz is set fixed until it is updated with a new one.
 */
export function getQuizConfig(): QuizConfig {
  const defaultQuestions = getFullQuizQuestions();
  const defaultConfig: QuizConfig = {
    isCreated: true,
    title: 'Computer Science Core Assessment',
    startTime: '',
    endTime: '',
    totalQuestions: defaultQuestions.length,
    maxViolations: 3,
    updatedAt: new Date().toISOString(),
  };

  const candidates = getCandidateFilePaths('quiz_config.json');
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          return {
            ...defaultConfig,
            ...parsed,
            totalQuestions: defaultQuestions.length > 0 ? defaultQuestions.length : (parsed.totalQuestions || 0),
            maxViolations:
              typeof parsed.maxViolations === 'number' && parsed.maxViolations > 0
                ? parsed.maxViolations
                : 3,
            // The populated quiz remains fixed: once isCreated is true, it stays fixed
            isCreated: parsed.isCreated !== undefined ? Boolean(parsed.isCreated) : true,
          };
        }
      }
    } catch {
      // Continue
    }
  }

  // Create initial default config if missing
  saveQuizConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Save Quiz Configuration (stores maxViolations and persists across all locations)
 */
export function saveQuizConfig(config: Partial<QuizConfig>): QuizConfig {
  const current = getQuizConfig();
  const updated: QuizConfig = {
    ...current,
    ...config,
    maxViolations:
      typeof config.maxViolations === 'number' && config.maxViolations > 0
        ? config.maxViolations
        : current.maxViolations || 3,
    updatedAt: new Date().toISOString(),
  };

  writeToAllLocations('quiz_config.json', JSON.stringify(updated, null, 2));
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
