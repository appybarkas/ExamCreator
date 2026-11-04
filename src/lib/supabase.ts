import fs from 'fs';
import path from 'path';
import { getAppConfig } from './config';
import { StudentRecord } from './types';

function getSubmissionsFilePath(): string {
  if (process.cwd().endsWith('frontend')) {
    return path.join(process.cwd(), 'submissions.json');
  }
  const inFrontend = path.join(process.cwd(), 'frontend', 'submissions.json');
  if (fs.existsSync(path.dirname(inFrontend))) {
    return inFrontend;
  }
  return path.join(process.cwd(), 'submissions.json');
}

function getLocalSubmissions(): Record<string, { score: number; quiz_status: number; violations?: number }> {
  try {
    const p = getSubmissionsFilePath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return {};
}

function saveLocalSubmission(username: string, score: number, violations: number = 0) {
  try {
    const p = getSubmissionsFilePath();
    const subs = getLocalSubmissions();
    subs[username] = { score, quiz_status: 1, violations };
    fs.writeFileSync(p, JSON.stringify(subs, null, 2), 'utf8');
  } catch {
    // Ignore
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

    if (!res.ok) {
      console.error('Database auth query error:', await res.text());
      return null;
    }

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
    return null;
  } catch (err) {
    console.error('Error authenticating student:', err);
    return null;
  }
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
  const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(
    username
  )}`;

  // Also record locally
  try {
    const p = getSubmissionsFilePath();
    const subs = getLocalSubmissions();
    if (subs[username]) {
      subs[username].violations = violations;
    } else {
      subs[username] = { score: 0, quiz_status: 0, violations };
    }
    fs.writeFileSync(p, JSON.stringify(subs, null, 2), 'utf8');
  } catch {
    // Ignore
  }

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
  const url = `${config.supabaseUrl}/rest/v1/student?username=eq.${encodeURIComponent(
    username
  )}`;

  saveLocalSubmission(username, score, violations);

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
      // Fallback if any column was missing
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
 * Fetch all students from the `student` table
 */
export async function getAllStudents(): Promise<StudentRecord[]> {
  const config = getAppConfig();
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

    if (!res.ok) {
      console.error('Database fetch students error:', await res.text());
      return [];
    }

    const data: StudentRecord[] = await res.json();
    const localSubs = getLocalSubmissions();

    return (data || []).map((s) => {
      if (localSubs[s.username]) {
        s.quiz_status = localSubs[s.username].quiz_status;
        s.violations = localSubs[s.username].violations ?? s.violations ?? 0;
        if (s.quiz === null || s.quiz === undefined) {
          s.quiz = localSubs[s.username].score;
        }
      }
      return s;
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    return [];
  }
}
