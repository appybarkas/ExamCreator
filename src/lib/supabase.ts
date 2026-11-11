import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAppConfig } from './config';
import { StudentRecord } from './types';

const FALLBACK_STUDENTS: StudentRecord[] = [
  { username: 'Bhargav', password: 'Appasani', quiz: null, quiz_status: 0 },
  { username: 'Amulya', password: 'password', quiz: null, quiz_status: 0 },
];

let lastDbStatus: { connected: boolean; error: string | null; checkedAt: string | null } = {
  connected: false,
  error: null,
  checkedAt: null,
};

export function getDatabaseConnectionStatus() {
  return lastDbStatus;
}

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

function getLocalSubmissions(): Record<string, { score: number; quiz_status: number }> {
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

function findSubKey(
  subs: Record<string, { score: number; quiz_status: number }>,
  username: string
): string {
  const lower = username.toLowerCase();
  for (const k of Object.keys(subs)) {
    if (k.toLowerCase() === lower) return k;
  }
  return username;
}

function saveLocalSubmission(username: string, score: number) {
  const subs = getLocalSubmissions();
  const key = findSubKey(subs, username);
  subs[key] = { score, quiz_status: 1 };
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
    // Check both exact and case-insensitive username match
    const url = `${config.supabaseUrl}/rest/v1/student?username=ilike.${encodeURIComponent(
      username.trim()
    )}&password=eq.${encodeURIComponent(password.trim())}&select=*`;

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
        lastDbStatus = { connected: true, error: null, checkedAt: new Date().toISOString() };
        const data: StudentRecord[] = await res.json();
        if (data && data.length > 0) {
          const student = data[0];
          const localSubs = getLocalSubmissions();
          const key = findSubKey(localSubs, student.username);
          if (localSubs[key]) {
            student.quiz_status = localSubs[key].quiz_status;
            if (student.quiz === null || student.quiz === undefined) {
              student.quiz = localSubs[key].score;
            }
          }
          return student;
        }
      } else {
        const errText = await res.text();
        console.error(`[Supabase Auth Error ${res.status}] ${res.statusText}:`, errText);
        lastDbStatus = {
          connected: false,
          error: `HTTP ${res.status}: ${errText}`,
          checkedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Error authenticating student with database:', err);
      lastDbStatus = {
        connected: false,
        error: String(err),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // Fallback for offline / development / test mode
  const localSubs = getLocalSubmissions();
  const matched = FALLBACK_STUDENTS.find(
    (s) => s.username.toLowerCase() === username.trim().toLowerCase() && s.password === password.trim()
  );

  if (matched) {
    const student: StudentRecord = { ...matched };
    const key = findSubKey(localSubs, student.username);
    if (localSubs[key]) {
      student.quiz_status = localSubs[key].quiz_status;
      if (student.quiz === null || student.quiz === undefined) {
        student.quiz = localSubs[key].score;
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
  return students.find((s) => s.username.toLowerCase() === username.trim().toLowerCase()) || null;
}

/**
 * Record violation - stubbed for backwards compatibility
 * Violations have been removed per user instruction
 */
export async function recordStudentViolation(
  _username: string,
  _violations: number
): Promise<boolean> {
  return true;
}

/**
 * Update the student's quiz score and quiz_status in table `student`
 * Rule: "After the student submits his quiz, his total score will be stored under the column `quiz` in the `student` table. His `quiz_status` will become 1, indicating he has given the quiz and cannot give it again."
 */
export async function updateStudentScore(
  username: string,
  score: number
): Promise<boolean> {
  const config = getAppConfig();
  saveLocalSubmission(username, score);

  if (!config.supabaseUrl || !config.supabaseKey) {
    return true;
  }

  const url = `${config.supabaseUrl}/rest/v1/student?username=ilike.${encodeURIComponent(username.trim())}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ quiz: score, quiz_status: 1 }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Supabase Update Score Error ${res.status}]:`, errText);
      // Fallback if quiz_status column is missing in older table schema
      const fallbackRes = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: config.supabaseKey,
          Authorization: `Bearer ${config.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ quiz: score }),
      });
      return fallbackRes.ok;
    }

    return true;
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

  // Reset in-memory fallback student if present
  const fb = FALLBACK_STUDENTS.find((s) => s.username.toLowerCase() === username.trim().toLowerCase());
  if (fb) {
    fb.quiz_status = quiz_status;
  }

  // Update local submissions
  try {
    const subs = getLocalSubmissions();
    const key = findSubKey(subs, username);
    if (subs[key]) {
      subs[key].quiz_status = quiz_status;
    } else {
      subs[key] = { score: 0, quiz_status };
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

  const url = `${config.supabaseUrl}/rest/v1/student?username=ilike.${encodeURIComponent(username.trim())}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ quiz_status }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Supabase Reset Status Error ${res.status}]:`, errText);
      return false;
    }

    return true;
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
        lastDbStatus = { connected: true, error: null, checkedAt: new Date().toISOString() };
        const data: StudentRecord[] = await res.json();
        if (Array.isArray(data)) {
          const studentMap = new Map<string, StudentRecord>();
          // Include baseline fallback students so default candidates remain resolvable
          for (const fb of FALLBACK_STUDENTS) {
            studentMap.set(fb.username.toLowerCase(), { ...fb });
          }
          // Merge with live database records
          for (const s of data) {
            studentMap.set(s.username.toLowerCase(), s);
          }
          return Array.from(studentMap.values()).map((s) => {
            const key = findSubKey(localSubs, s.username);
            if (localSubs[key]) {
              s.quiz_status = localSubs[key].quiz_status;
              if (s.quiz === null || s.quiz === undefined) {
                s.quiz = localSubs[key].score;
              }
            }
            return s;
          });
        }
      } else {
        const errText = await res.text();
        console.error(`[Supabase Fetch Students Error ${res.status}] ${res.statusText}:`, errText);
        lastDbStatus = {
          connected: false,
          error: `HTTP ${res.status}: ${errText}`,
          checkedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Database fetch students network/exception error:', err);
      lastDbStatus = {
        connected: false,
        error: String(err),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // Fallback default candidates when database is unreachable or offline
  return FALLBACK_STUDENTS.map((s) => {
    const candidate = { ...s };
    const key = findSubKey(localSubs, candidate.username);
    if (localSubs[key]) {
      candidate.quiz_status = localSubs[key].quiz_status;
      if (candidate.quiz === null || candidate.quiz === undefined) {
        candidate.quiz = localSubs[key].score;
      }
    }
    return candidate;
  });
}
