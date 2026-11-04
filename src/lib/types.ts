export interface QuestionOptions {
  A: string;
  B: string;
  C: string;
  D: string;
  [key: string]: string;
}

export interface FiguresOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  [key: string]: string | undefined;
}

export interface QuizQuestion {
  question: string;
  figure?: string;
  options: QuestionOptions;
  figures_options?: FiguresOptions;
  Answer?: string; // Secret! Only present on server-side
}

export interface StudentQuizQuestion {
  id: number;
  question: string;
  figure?: string;
  options: QuestionOptions;
  figures_options?: FiguresOptions;
}

export interface QuizConfig {
  isCreated: boolean;
  title: string;
  startTime: string; // ISO string or empty
  endTime: string;   // ISO string or empty
  totalQuestions: number;
  updatedAt: string;
}

export interface StudentRecord {
  username: string;
  password?: string;
  quiz: number | null;
  lab?: number | null;
  quiz_status?: number | null;
  violations?: number | null;
}

export interface QuizSubmissionPayload {
  username: string;
  answers: Record<number, string>;
  isAutoSubmit?: boolean;
  violations?: number;
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  username: string;
  submittedAt: string;
  violations?: number;
}
