import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAppConfig } from './config';
import { StudentRecord } from './types';

const FALLBACK_STUDENTS: StudentRecord[] = [
  { username: 'Bhargav', password: 'Appasani', quiz: null, quiz_status: 0, violations: 0 },
  { username: 'Amulya', password: 'password', quiz: null, quiz_status: 0, violations: 0 },
];

function getSubmissionsFilePaths(): string[] {
  const cwd = process.cwd();
  const list: string[] = [];
  if (cwd.endsWith('frontend')) {
    list.push(path.join(cwd, 'submissions.json'));
    list.push(path.join(cwd, '..', 'submissions.json'));
  } else {
    list.push(path.join(cwd, 'frontend', 'submissions.json'));
    list.push(path.join(cwd, 'submissions.json'));
  }
  list.push(path.join(os.tmpdir(), 'submissions.json'));
  return Array.from(new Set(list));
}

function getLocalSubmissions(): Record<string, { score: number; quiz_status: number; violations?: number }> {
  for (const p of getSubmissionsFilePaths()) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        return JSON.parse(content);
      }
    } catch {
      // Continue
    }
  }
  return {};
}

function saveLocalSubmission(username: string, score: number, violations: number = 0) {
  const subs = getLocalSubmissions();
  subs[username] = { score, quiz_status: 1, violations };
  const jsonStr = JSON.stringify(subs, null, 2);

  for (const p of getSubmissionsFilePaths()) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, jsonStr, 'utf8');
    } catch {
      // Ignore
    }
  }
}

/**
 * Fetch a student by username and plain text password
 * NOTE per requirements: DO NOT hash the passwords as they are needed for student login
 */
export async function authenticateStudent(
  username: string,
  password: string
): Promise<StudentRecord | null> {
  const config = getAppConfig();

  if (config.supabaseUrl && config.supabaseKey) {
    const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(
      username
    )}&password=eq.${encodeURIComponent(password)}&select=*`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data: StudentRecord[] = await res.json();
        if (data && data.length > 0) {
          const student = data[0];
          const localSubs = getLocalSubmissions();
          if (localSubs[student.username]) {
            student.quiz_status = localSubs[student.username].quiz_status;
            student.violations = localSubs[student.username].violations ?? student.violations ?? 0;
            if (student.quiz === null || student.quiz === undefined) {
              student.quiz = localSubs[student.username].score;
            }
          }
          return student;
        }
      }
    } catch (err) {
      console.error('Error authenticating student with database:', err);
    }
  }

  // Fallback for offline / development / test mode
  const localSubs = getLocalSubmissions();
  const matched = FALLBACK_STUDENTS.find(
    (s) => s.username.toLowerCase() === username.toLowerCase() && s.password === password
  );

  if (matched) {
    const student: StudentRecord = { ...matched };
    if (localSubs[student.username]) {
      student.quiz_status = localSubs[student.username].quiz_status;
      student.violations = localSubs[student.username].violations ?? student.violations ?? 0;
      if (student.quiz === null || student.quiz === undefined) {
        student.quiz = localSubs[student.username].score;
      }
    }
    return student;
  }

  return null;
}

/**
 * Get a student by username
 */
export async function getStudentByUsername(username: string): Promise<StudentRecord | null> {
  const students = await getAllStudents();
  return students.find((s) => s.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * Record violation count in real-time in table `student`
 * Rule: "Also record the number of violations in violations column of the table"
 */
export async function recordStudentViolation(
  username: string,
  violations: number
): Promise<boolean> {
  const config = getAppConfig();

  // Also record locally
  try {
    const subs = getLocalSubmissions();
    if (subs[username]) {
      subs[username].violations = violations;
    } else {
      subs[username] = { score: 0, quiz_status: 0, violations };
    }
    const jsonStr = JSON.stringify(subs, null, 2);
    for (const p of getSubmissionsFilePaths()) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, jsonStr, 'utf8');
      } catch {}
    }
  } catch {
    // Ignore
  }

  if (!config.supabaseUrl || !config.supabaseKey) {
    return true;
  }

  const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(username)}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ violations }),
    });

    return res.ok;
  } catch (err) {
    console.error('Error updating student violations in database:', err);
    return false;
  }
}

/**
 * Update the student's quiz score, quiz_status, and violations in table `student`
 * Rule: "After the student submits his quiz, his total score will be stored under the column `quiz` in the `student` table. His `quiz_status` will become 1, indicating he has given the quiz and cannot give it again."
 * Rule: "Also record the number of violations in `violations` column of the table"
 */
export async function updateStudentScore(
  username: string,
  score: number,
  violations: number = 0
): Promise<boolean> {
  const config = getAppConfig();
  saveLocalSubmission(username, score, violations);

  if (!config.supabaseUrl || !config.supabaseKey) {
    return true;
  }

  const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(username)}`;

  try {
    // Attempt updating quiz, quiz_status, and violations
    let res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ quiz: score, quiz_status: 1, violations }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const patchObj: Record<string, unknown> = { quiz: score };
      if (!errText.includes('quiz_status')) patchObj.quiz_status = 1;
      if (!errText.includes('violations')) patchObj.violations = violations;

      res = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patchObj),
      });
    }

    if (!res.ok) {
      console.error('Database update score error:', await res.text());
      return false;
    }

    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('Error updating student score in database:', err);
    return false;
  }
}

/**
 * Reset or change the quiz_status of a student to 0 (or another value).
 * Requirement: "Also, he can change the quiz_status of any student to 0."
 */
export async function resetStudentQuizStatus(
  username: string,
  quiz_status: number = 0
): Promise<boolean> {
  const config = getAppConfig();

  // Update local submissions
  try {
    const subs = getLocalSubmissions();
    if (subs[username]) {
      subs[username].quiz_status = quiz_status;
      subs[username].violations = 0;
    } else {
      subs[username] = { score: 0, quiz_status, violations: 0 };
    }
    const jsonStr = JSON.stringify(subs, null, 2);
    for (const p of getSubmissionsFilePaths()) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, jsonStr, 'utf8');
      } catch {}
    }
  } catch (e) {
    console.error('Failed to update local submission status:', e);
  }

  if (!config.supabaseUrl || !config.supabaseKey) {
    return true;
  }

  const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(username)}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ quiz_status, violations: 0 }),
    });

    if (!res.ok) {
      const fallbackRes = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ quiz_status }),
      });
      return fallbackRes.ok;
    }

    return res.ok;
  } catch (err) {
    console.error('Error resetting student quiz_status in database:', err);
    return false;
  }
}

/**
 * Fetch all students from the `student` table
 */
export async function getAllStudents(): Promise<StudentRecord[]> {
  const config = getAppConfig();
  const localSubs = getLocalSubmissions();

  if (config.supabaseUrl && config.supabaseKey) {
    const url = `${config.supabaseUrl}/rest/v1/student?select=*&order=username.asc`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data: StudentRecord[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((s) => {
            if (localSubs[s.username]) {
              s.quiz_status = localSubs[s.username].quiz_status;
              s.violations = localSubs[s.username].violations ?? s.violations ?? 0;
              if (s.quiz === null || s.quiz === undefined) {
                s.quiz = localSubs[s.username].score;
              }
            }
            return s;
          });
        }
      }
    } catch (err) {
      console.error('Database fetch students error:', err);
    }
  }

  // Fallback default candidates
  return FALLBACK_STUDENTS.map((s) => {
    const candidate = { ...s };
    if (localSubs[candidate.username]) {
      candidate.quiz_status = localSubs[candidate.username].quiz_status;
      candidate.violations = localSubs[candidate.username].violations ?? candidate.violations ?? 0;
      if (candidate.quiz === null || candidate.quiz === undefined) {
        candidate.quiz = localSubs[candidate.username].score;
      }
    }
    return candidate;
  });
}
