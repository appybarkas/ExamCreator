import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');

const PORT = 3008;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let serverProcess = null;

async function startServer() {
  console.log(`\n🚀 Starting Next.js test server on port ${PORT}...`);
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', () => {});

  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/student/quiz`);
      if (res.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // server starting
    }
    await sleep(1000);
  }

  if (!ready) {
    throw new Error('Server failed to start within 30 seconds');
  }
  console.log('✅ Next.js server is ready and accepting requests!\n');
}

function stopServer() {
  if (serverProcess) {
    console.log('\n🛑 Stopping Next.js test server...');
    try {
      serverProcess.kill('SIGTERM');
      serverProcess.kill('SIGKILL');
    } catch {}
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    await startServer();

    console.log('--- TEST SUITE 1: Teacher Authentication ---');
    const teacherAuthRes = await fetch(`${BASE_URL}/api/auth/teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bhargav_Appasani',
        password: 'GOODexample1!',
      }),
    });
    const teacherAuthData = await teacherAuthRes.json();
    assert(
      teacherAuthRes.ok && teacherAuthData.success && teacherAuthData.teacher.name === 'Bhargav_Appasani',
      'Teacher login succeeds with .env credentials'
    );

    const invalidTeacherRes = await fetch(`${BASE_URL}/api/auth/teacher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bhargav_Appasani',
        password: 'WrongPassword',
      }),
    });
    assert(invalidTeacherRes.status === 401, 'Teacher login fails with invalid password (401)');

    console.log('\n--- TEST SUITE 2: Quiz Zip Upload & Figure Handling ---');
    // Upload ./frontend/quiz.zip via multipart FormData
    const quizZipPath = path.join(frontendDir, 'quiz.zip');
    assert(fs.existsSync(quizZipPath), 'quiz.zip file exists in ./frontend/quiz.zip');

    const zipBuffer = fs.readFileSync(quizZipPath);
    const formData = new FormData();
    formData.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'quiz.zip');

    const uploadRes = await fetch(`${BASE_URL}/api/teacher/upload`, {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();
    assert(
      uploadRes.ok && uploadData.success && uploadData.count > 0,
      `Upload of quiz.zip succeeds and extracts questions (count: ${uploadData.count})`
    );

    // Verify figure endpoint
    const figureRes = await fetch(`${BASE_URL}/figures/Fig1.jpg`);
    assert(
      figureRes.ok && figureRes.status === 200,
      'Figure image endpoint /figures/Fig1.jpg serves extracted image correctly'
    );

    console.log('\n--- TEST SUITE 3: Teacher Scheduling & Quiz Activation ---');
    const now = new Date();
    const future = new Date(now.getTime() + 7200 * 1000);
    const configRes = await fetch(`${BASE_URL}/api/teacher/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime: now.toISOString(),
        endTime: future.toISOString(),
        title: 'Full-Stack Engineering Assessment',
        isCreated: true,
        maxViolations: 3,
      }),
    });
    const configData = await configRes.json();
    assert(
      configRes.ok && configData.success && configData.config.isCreated === true,
      'Create Quiz button activates exam and populates student dashboard'
    );

    console.log('\n--- TEST SUITE 4: Student Authentication (No Password Hashing) ---');
    const studentAuthRes = await fetch(`${BASE_URL}/api/auth/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        password: 'Appasani',
      }),
    });
    const studentAuthData = await studentAuthRes.json();
    assert(
      studentAuthRes.ok && studentAuthData.success && studentAuthData.student.username === 'Bhargav',
      'Student login authenticates using plain-text password from student table (no hashing)'
    );

    console.log('\n--- TEST SUITE 5: Secret Answers Stripping & Radio Options ---');
    const studentQuizRes = await fetch(`${BASE_URL}/api/student/quiz`);
    const studentQuizData = await studentQuizRes.json();
    assert(
      studentQuizRes.ok && studentQuizData.isCreated === true && studentQuizData.questions.length > 0,
      'Student receives questions and options'
    );

    let answerLeaked = false;
    for (const q of studentQuizData.questions) {
      if (q.Answer !== undefined || q.answer !== undefined) {
        answerLeaked = true;
        break;
      }
    }
    assert(!answerLeaked, 'Secret Answer field is strictly hidden from student');

    console.log('\n--- TEST SUITE 6: Mandatory Answer Submission Validation ---');
    // Rule: "The student must answer all questions to submit the quiz, else he cannot submit"
    // Reset local submissions first so candidates can submit
    for (const p of [
      path.join(frontendDir, 'submissions.json'),
      path.join(rootDir, 'submissions.json'),
      path.join('/tmp', 'submissions.json'),
    ]) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }

    const partialSubmitRes = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        answers: { 0: 'C' }, // Only 1 answered
        isAutoSubmit: false,
      }),
    });
    const partialSubmitData = await partialSubmitRes.json();
    assert(
      partialSubmitRes.status === 400 && partialSubmitData.success === false,
      'Incomplete submission is strictly blocked when all questions are not answered'
    );

    console.log('\n--- TEST SUITE 7: Final Submission, Single Attempt & Database Score ---');
    // Fetch loaded questions to construct 100% correct answers dynamically
    const configQuestionsRes = await fetch(`${BASE_URL}/api/teacher/config`);
    const configQuestionsData = await configQuestionsRes.json();
    const completeAnswers = {};
    if (configQuestionsData.questions) {
      configQuestionsData.questions.forEach((q, idx) => {
        completeAnswers[idx] = q.Answer || 'A';
      });
    }

    const finalSubmitRes = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        answers: completeAnswers,
        isAutoSubmit: false,
      }),
    });
    const finalSubmitData = await finalSubmitRes.json();
    assert(
      finalSubmitRes.ok && finalSubmitData.success && finalSubmitData.score === 10,
      'Full submission grades correctly with +1 per correct answer (Score: 10/10)'
    );

    // Rule: "His quiz_status will become 1, indicating he has given the quiz and cannot give it again."
    const repeatSubmitRes = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        answers: completeAnswers,
        isAutoSubmit: false,
      }),
    });
    assert(
      repeatSubmitRes.status === 403,
      'Candidate cannot take quiz again once quiz_status is 1 (Single attempt enforced: 403)'
    );

    console.log('\n--- TEST SUITE 8: Autosubmit on Timer Zero ---');
    const autoSubmitAnswers = {};
    if (configQuestionsData.questions && configQuestionsData.questions.length >= 2) {
      autoSubmitAnswers[0] = configQuestionsData.questions[0].Answer || 'A';
      autoSubmitAnswers[1] = configQuestionsData.questions[1].Answer || 'A';
    }

    const autoSubmitRes = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Amulya',
        answers: autoSubmitAnswers,
        isAutoSubmit: true,
      }),
    });
    const autoSubmitData = await autoSubmitRes.json();
    assert(
      autoSubmitRes.ok && autoSubmitData.success && autoSubmitData.score === 2,
      'Timer zero triggers automatic autosubmit without requiring all questions'
    );

    console.log('\n--- TEST SUITE 9: Configurable Maximum Allowed Violations ---');
    // Teacher sets max allowed violations to 5
    const updateViolationsRes = await fetch(`${BASE_URL}/api/teacher/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxViolations: 5,
      }),
    });
    const updateViolationsData = await updateViolationsRes.json();
    assert(
      updateViolationsRes.ok && updateViolationsData.config.maxViolations === 5,
      'Teacher can configure maximum allowed violations (set to 5)'
    );

    const studentQuizWithViolationsRes = await fetch(`${BASE_URL}/api/student/quiz`);
    const studentQuizWithViolationsData = await studentQuizWithViolationsRes.json();
    assert(
      studentQuizWithViolationsData.maxViolations === 5,
      'Student quiz endpoint returns updated maxViolations (5) configured by teacher'
    );

    console.log('\n--- TEST SUITE 10: Teacher Changes student quiz_status to 0 (and resets violations) ---');
    // Simulate candidate recording violations
    await fetch(`${BASE_URL}/api/student/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        violations: 2,
      }),
    });

    // Teacher resets student quiz_status to 0
    const resetStatusRes = await fetch(`${BASE_URL}/api/teacher/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        quiz_status: 0,
      }),
    });
    const resetStatusData = await resetStatusRes.json();
    assert(
      resetStatusRes.ok &&
        resetStatusData.success &&
        resetStatusData.student.quiz_status === 0 &&
        resetStatusData.student.violations === 0,
      'Teacher can change quiz_status of any student to 0, which also resets violations to 0'
    );

    // Verify student status endpoint reflects status 0 and violations 0
    const checkStatusRes = await fetch(`${BASE_URL}/api/student/status?username=Bhargav`);
    const checkStatusData = await checkStatusRes.json();
    assert(
      checkStatusRes.ok && checkStatusData.quiz_status === 0 && checkStatusData.violations === 0,
      'Student status query confirms quiz_status is 0 and violations are reset to 0'
    );

    // Candidate can now submit again!
    const resubmitRes = await fetch(`${BASE_URL}/api/student/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bhargav',
        answers: completeAnswers,
        isAutoSubmit: false,
      }),
    });
    const resubmitData = await resubmitRes.json();
    assert(
      resubmitRes.ok && resubmitData.success && resubmitData.score === 10,
      'Candidate is allowed to re-attempt and submit quiz after quiz_status changed to 0'
    );

    console.log('\n--- TEST SUITE 11: Populated Quiz Remains Fixed Until Updated With New One ---');
    const persistentQuizRes = await fetch(`${BASE_URL}/api/student/quiz`);
    const persistentQuizData = await persistentQuizRes.json();
    assert(
      persistentQuizData.isCreated === true && persistentQuizData.totalQuestions === 10,
      'Populated quiz remains fixed, active, and accessible with all questions preserved'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    stopServer();
  }

  console.log(`\n===========================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests();
