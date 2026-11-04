'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Award,
  AlertTriangle,
  ImageIcon,
} from 'lucide-react';
import { StudentQuizQuestion, StudentRecord } from '@/lib/types';

export default function StudentExamPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [questions, setQuestions] = useState<StudentQuizQuestion[]>([]);
  const [title, setTitle] = useState('Secure Examination');
  const [loading, setLoading] = useState(true);

  // Exam answers: question index -> chosen option ('A', 'B', 'C', 'D')
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Current active question index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Timer state (seconds remaining)
  const [timeRemaining, setTimeRemaining] = useState<number>(1800);
  const [timerInitialized, setTimerInitialized] = useState(false);

  // Lockdown security state
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [violations, setViolations] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalResult, setFinalResult] = useState<{ score: number; total: number; violations: number } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isSubmittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const violationsRef = useRef(0);
  violationsRef.current = violations;

  // Web Audio Warning Beeper
  const playAlertSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Ignore audio failure
    }
  }, []);

  // 1. Authenticate candidate session & single-attempt check
  useEffect(() => {
    const rawSession = localStorage.getItem('student_session');
    if (!rawSession) {
      router.push('/student/login');
      return;
    }
    try {
      const parsed = JSON.parse(rawSession);
      if (parsed.quiz_status === 1 || (parsed.quiz !== null && parsed.quiz !== undefined && parsed.quiz > 0)) {
        router.push('/student/dashboard');
        return;
      }
      setStudent(parsed);
      if (parsed.violations) {
        setViolations(Number(parsed.violations));
        violationsRef.current = Number(parsed.violations);
      }
    } catch {
      router.push('/student/login');
    }
  }, [router]);

  // 2. Fetch Quiz Questions (without answers)
  useEffect(() => {
    async function fetchExam() {
      try {
        const res = await fetch('/api/student/quiz', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load quiz');
        const data = await res.json();

        if (!data.isCreated || !data.questions || data.questions.length === 0) {
          router.push('/student/dashboard');
          return;
        }

        setQuestions(data.questions);
        if (data.title) setTitle(data.title);

        if (data.endTime) {
          const endMs = new Date(data.endTime).getTime();
          const nowMs = Date.now();
          const diffSec = Math.max(0, Math.floor((endMs - nowMs) / 1000));
          if (diffSec > 0) {
            setTimeRemaining(diffSec);
          } else {
            setTimeRemaining(1800);
          }
        } else {
          setTimeRemaining(1800);
        }
        setTimerInitialized(true);
      } catch (err) {
        console.error('Failed to load exam questions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchExam();
  }, [router]);

  // 3. Strict Fullscreen Helper
  const enterStrictFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (typeof navigator !== 'undefined' && 'keyboard' in navigator) {
        // @ts-expect-error Keyboard Lock API
        navigator.keyboard?.lock?.([
          'Escape',
          'F11',
          'Tab',
          'AltLeft',
          'AltRight',
          'ControlLeft',
          'ControlRight',
          'MetaLeft',
          'MetaRight',
        ]);
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen lock error:', err);
    }
  }, []);

  // 4. Submit Handler (Mandatory questions validation, autosubmit on timer or violations exceed 3)
  const submitExam = useCallback(
    async (isAutoSubmit = false, violationsCountOverride?: number) => {
      if (isSubmittedRef.current || submitting) return;

      const currentAnswers = answersRef.current;
      const total = questions.length;
      const finalViolations = violationsCountOverride !== undefined ? violationsCountOverride : violationsRef.current;

      // Rule: "The student must answer all questions to submit the quiz, else he cannot submit"
      // Exception: Autosubmission when timer hits 0 OR violations exceed 3
      if (!isAutoSubmit) {
        for (let i = 0; i < total; i++) {
          if (!currentAnswers[i]) {
            setValidationError(
              `You must answer all questions to submit. Question ${i + 1} has not been answered.`
            );
            setCurrentIndex(i);
            return;
          }
        }
      }

      setSubmitting(true);
      isSubmittedRef.current = true;

      try {
        const rawSession = localStorage.getItem('student_session');
        const candidate = rawSession ? JSON.parse(rawSession) : null;
        const candidateUsername = candidate?.username || student?.username || 'Unknown';

        const res = await fetch('/api/student/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: candidateUsername,
            answers: currentAnswers,
            isAutoSubmit,
            violations: finalViolations,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSubmitted(true);
          setFinalResult({
            score: data.score,
            total: data.totalQuestions,
            violations: finalViolations,
          });

          // Update local candidate session with score, quiz_status = 1, and violations
          if (candidate) {
            candidate.quiz = data.score;
            candidate.quiz_status = 1;
            candidate.violations = finalViolations;
            localStorage.setItem('student_session', JSON.stringify(candidate));
          }

          // Release Keyboard Lock if available
          try {
            // @ts-expect-error Keyboard Lock API
            navigator.keyboard?.unlock?.();
          } catch {
            // Ignore
          }

          // Rule: "After he submit the application closes itself."
          setTimeout(() => {
            try {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
              window.close();
            } catch {
              // Ignore
            }
          }, 3500);
        } else {
          setValidationError(data.error || 'Submission error. Please retry.');
          isSubmittedRef.current = false;
        }
      } catch (err) {
        console.error('Submission failure:', err);
        setValidationError('Network error submitting exam. Please try again.');
        isSubmittedRef.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [questions.length, student?.username, submitting]
  );

  // 5. Security Violation Handler
  // Rule: "If violations are exceed 3, he quiz gets autosubmitted. Everytime a warning will be displayed along with the remaining violations."
  // Rule: "Also record the number of violations in `violations` column of the table"
  const handleSecurityViolation = useCallback(
    (reason: string) => {
      if (isSubmittedRef.current) return;

      const newViolations = violationsRef.current + 1;
      violationsRef.current = newViolations;
      setViolations(newViolations);

      playAlertSound();

      // Live update violations column in table
      const rawSession = localStorage.getItem('student_session');
      const candidate = rawSession ? JSON.parse(rawSession) : null;
      const username = candidate?.username || student?.username;
      if (username) {
        fetch('/api/student/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, violations: newViolations }),
        }).catch(() => {});
      }

      // Check violation threshold
      if (newViolations > 3) {
        setAutoSubmitReason(
          `Security violations exceeded the maximum limit of 3 (${newViolations} total violations recorded). Exam has been autosubmitted.`
        );
        setWarningTitle('VIOLATIONS EXCEEDED (EXAM AUTOSUBMITTING)');
        setWarningMessage(
          `You have committed ${newViolations} violations. Maximum limit (3) exceeded. Your quiz is being automatically submitted now!`
        );
        setShowWarningModal(true);
        submitExam(true, newViolations);
      } else {
        const remaining = 3 - newViolations;
        setWarningTitle(`SECURITY WARNING (${newViolations} OF 3)`);
        setWarningMessage(
          `${reason} You have ${remaining} violation${remaining === 1 ? '' : 's'} remaining. If violations exceed 3, your quiz will be automatically submitted!`
        );
        setShowWarningModal(true);
      }
    },
    [playAlertSound, submitExam, student?.username]
  );

  // 6. Timer Countdown & Auto-Submit
  useEffect(() => {
    if (!timerInitialized || submitted) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Rule: "If timer goes to zero, the quiz gets autosubmitted."
          setAutoSubmitReason('Time expired! Your quiz was autosubmitted.');
          submitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerInitialized, submitted, submitExam]);

  // 7. Strict Fullscreen and Keyboard Enforcement Handlers
  useEffect(() => {
    enterStrictFullscreen();

    // Check fullscreen periodically
    const fsCheckInterval = setInterval(() => {
      if (!isSubmittedRef.current) {
        const inFull = Boolean(document.fullscreenElement);
        setIsFullscreen(inFull);
        if (!inFull) {
          enterStrictFullscreen();
        }
      }
    }, 350);

    const handleFullscreenChange = () => {
      const inFull = Boolean(document.fullscreenElement);
      setIsFullscreen(inFull);
      if (!inFull && !isSubmittedRef.current) {
        handleSecurityViolation(
          'Fullscreen exited! Continuous full-screen view is strictly enforced.'
        );
      }
    };

    // Strict keyboard capture: block Escape, F-keys, Tab, Alt+Tab, Ctrl combos, Meta
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmittedRef.current) return;

      const forbiddenKeys = [
        'Escape',
        'F1',
        'F2',
        'F3',
        'F4',
        'F5',
        'F6',
        'F7',
        'F8',
        'F9',
        'F10',
        'F11',
        'F12',
      ];

      if (forbiddenKeys.includes(e.key) || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSecurityViolation('Forbidden key shortcut attempted (Escape / Function Key).');
        enterStrictFullscreen();
        return false;
      }

      // Block Ctrl / Meta / Alt combos
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const lowerKey = e.key.toLowerCase();
        const blockedChars = ['w', 't', 'n', 'r', 'u', 'p', 'i', 'j', 'c', 's', 'h', 'f', 'q'];
        if (blockedChars.includes(lowerKey) || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleSecurityViolation('Restricted shortcut key combination detected.');
          return false;
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleCopyPaste = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleBlur = () => {
      if (!isSubmittedRef.current) {
        window.focus();
        handleSecurityViolation(
          'Window blur detected! Switching tabs, windows, or applications is forbidden.'
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittedRef.current) {
        handleSecurityViolation(
          'Tab switch detected! Leaving the assessment tab is strictly prohibited.'
        );
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmittedRef.current) {
        e.preventDefault();
        e.returnValue = 'Exam in progress. You cannot close this application.';
        return e.returnValue;
      }
    };

    // Trap back/forward navigation
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('copy', handleCopyPaste, true);
    window.addEventListener('cut', handleCopyPaste, true);
    window.addEventListener('paste', handleCopyPaste, true);
    window.addEventListener('selectstart', handleCopyPaste, true);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearInterval(fsCheckInterval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('copy', handleCopyPaste, true);
      window.removeEventListener('cut', handleCopyPaste, true);
      window.removeEventListener('paste', handleCopyPaste, true);
      window.removeEventListener('selectstart', handleCopyPaste, true);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enterStrictFullscreen, handleSecurityViolation]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = timeRemaining < 300;
  const currentQuestion = questions[currentIndex];
  const remainingViolationsAllowed = Math.max(0, 3 - violations);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#090d16]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-sm text-slate-400">Locking environment and initializing exam...</p>
        </div>
      </div>
    );
  }

  // Submitted / Finished Screen
  if (submitted && finalResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#090d16] text-center">
        <div className="max-w-md w-full rounded-3xl glass-panel-glow p-8 md:p-10 border border-emerald-500/30">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-5 border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Exam Successfully Submitted</h1>
          <p className="text-xs text-slate-400 mb-6">
            {autoSubmitReason
              ? autoSubmitReason
              : 'Your responses have been verified and recorded to your candidate record.'}
          </p>

          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 space-y-3">
            <div>
              <div className="flex items-center justify-center gap-2 text-indigo-400 mb-1">
                <Award className="w-5 h-5" />
                <span className="text-xs uppercase font-bold tracking-wider">Final Score</span>
              </div>
              <div className="text-4xl font-extrabold text-white">
                {finalResult.score} <span className="text-xl text-slate-400 font-normal">/ {finalResult.total}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>Security Violations:</span>
              <span className={`font-mono font-bold ${finalResult.violations > 3 ? 'text-red-400' : 'text-slate-200'}`}>
                {finalResult.violations}
              </span>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium">
              Status updated: Single attempt recorded
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Per examination regulations, this application is closing itself.
          </p>

          <button
            onClick={() => {
              try {
                window.close();
              } catch {
                router.push('/');
              }
            }}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 transition-all"
          >
            Close Application Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16] select-none text-slate-100">
      {/* ======================================================== */}
      {/* TOP HEADER: Prominently displays TIME REMAINING on TOP LEFT */}
      {/* ======================================================== */}
      <header className="fixed top-0 left-0 right-0 z-40 h-20 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 flex items-center justify-between">
        {/* TOP LEFT: CURRENT TIME REMAINING (Mandated by requirements) */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
              isTimeCritical
                ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-lg shadow-red-500/20 animate-pulse'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl ${
                isTimeCritical ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Time Remaining
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white leading-none">
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>

          {/* Violations Tracker Badge in Top Bar */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
              violations === 0
                ? 'bg-slate-900 border-white/10 text-slate-300'
                : violations <= 2
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Violations: <strong className="font-mono text-white">{violations}</strong>/3
            </span>
          </div>
        </div>

        {/* Center: Title */}
        <div className="hidden lg:block text-center">
          <div className="text-xs font-bold text-slate-200 tracking-wide">{title}</div>
          <div className="text-[10px] text-cyan-400 font-mono">Full-Screen Mode Enforced</div>
        </div>

        {/* Right: Progress & Submit Button */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">
              Candidate: <span className="text-cyan-300">{student?.username}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Answered: <strong className="text-indigo-300">{answeredCount}</strong> of{' '}
              {questions.length} questions
            </div>
          </div>

          <button
            onClick={() => submitExam(false)}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Final Exam</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 max-w-5xl mx-auto w-full flex flex-col justify-between">
        {/* Validation Error Alert Banner */}
        {validationError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="font-bold uppercase tracking-wider text-xs opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Question Card */}
        {currentQuestion && (
          <div className="rounded-3xl glass-panel-glow p-6 sm:p-10 mb-8 relative">
            {/* Top Question Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center text-sm">
                  {currentIndex + 1}
                </span>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </div>

              <div>
                {answers[currentIndex] ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Answered (Option {answers[currentIndex]})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Pending Answer
                  </span>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-6">
              <h2 className="text-base sm:text-xl font-bold text-white leading-relaxed whitespace-pre-line">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Question Figure (Rule: "The figures should also be rendered if the question or the options have the figure paths") */}
            {currentQuestion.figure && (
              <div className="mb-8 p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5 text-xs text-indigo-300 mb-3 self-start font-semibold">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>Question Figure:</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentQuestion.figure}
                  alt={`Figure for Question ${currentIndex + 1}`}
                  className="max-h-80 w-auto object-contain rounded-xl shadow-lg border border-white/10 bg-black/40 p-1"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.src.includes('/figures/')) {
                      img.src = `/figures/${img.src.split('/').pop()}`;
                    }
                  }}
                />
              </div>
            )}

            {/* Radio Button Options (Rule: "The options are radio buttons") */}
            <div className="space-y-4">
              {['A', 'B', 'C', 'D'].map((key) => {
                const optText = currentQuestion.options[key];
                const optionFig = currentQuestion.figures_options?.[key];
                if (optText === undefined && !optionFig) return null;
                const isSelected = answers[currentIndex] === key;

                return (
                  <label
                    key={key}
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
                      if (validationError) setValidationError(null);
                    }}
                    className={`quiz-option-label flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'selected bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-900/50 border-white/10 hover:border-white/20 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 flex-1">
                      {/* Native Radio Input */}
                      <input
                        type="radio"
                        name={`question_${currentIndex}`}
                        value={key}
                        checked={isSelected}
                        onChange={() => {
                          setAnswers((prev) => ({ ...prev, [currentIndex]: key }));
                        }}
                        className="sr-only"
                      />

                      {/* Radio Pill Icon */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/50 scale-105'
                            : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}
                      >
                        {key}
                      </div>

                      {/* Option Text */}
                      <span className="text-sm font-medium text-slate-200 leading-snug">
                        {optText}
                      </span>
                    </div>

                    {/* Option Figure (Rule: "The figures should also be rendered if the question or the options have the figure paths") */}
                    {optionFig && (
                      <div className="p-2 rounded-xl bg-slate-950 border border-white/10 shrink-0 self-start sm:self-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={optionFig}
                          alt={`Option ${key} figure`}
                          className="max-h-28 w-auto object-contain rounded-lg shadow"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (!img.src.includes('/figures/')) {
                              img.src = `/figures/${img.src.split('/').pop()}`;
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Selected Checkmark */}
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 self-end sm:self-auto" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Question Navigation Drawer & Pagination */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl glass-panel text-xs font-semibold text-slate-300 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Question</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => submitExam(false)}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Final Exam</span>
              </button>
            )}
          </div>

          {/* Question Grid Pills */}
          <div className="p-4 rounded-2xl glass-panel border border-white/5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Quick Question Selector</span>
              <span>
                {answeredCount}/{questions.length} answered
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {questions.map((_, idx) => {
                const isAns = Boolean(answers[idx]);
                const isCurr = idx === currentIndex;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-9 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                      isCurr
                        ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 font-black'
                        : ''
                    } ${
                      isAns
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-white/5 hover:border-white/20'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* VIOLATION WARNING MODAL (Displayed every time a violation occurs)         */}
      {/* Rule: "Everytime a warning will be displayed along with the remaining violations. */}
      {/* If violations are exceed 3, he quiz gets autosubmitted."                 */}
      {/* ========================================================================= */}
      {showWarningModal && !submitted && (
        <div className="fixed inset-0 z-[9999999] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center select-none">
          <div className="max-w-lg w-full rounded-3xl glass-panel-glow p-8 md:p-10 border-2 border-red-500/60 shadow-2xl shadow-red-500/30">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-5 border border-red-500/40 animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-3 tracking-tight">
              {warningTitle || 'SECURITY VIOLATION DETECTED'}
            </h2>
            <p className="text-xs sm:text-sm text-red-200 mb-6 leading-relaxed">
              {warningMessage}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Total Violations
                </span>
                <span className="text-2xl font-black font-mono text-red-300">
                  {violations} <span className="text-xs text-slate-400 font-normal">/ 3</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Remaining Allowed
                </span>
                <span className="text-2xl font-black font-mono text-amber-300">
                  {remainingViolationsAllowed}
                </span>
              </div>
            </div>

            {violations > 3 ? (
              <div className="p-4 rounded-xl bg-red-600/30 border border-red-500 text-xs text-white font-semibold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Violations exceeded 3. Autosubmitting exam...</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setShowWarningModal(false);
                  await enterStrictFullscreen();
                }}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-red-600 via-rose-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white shadow-xl shadow-red-600/40 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Maximize2 className="w-5 h-5" />
                <span>I UNDERSTAND & RETURN TO EXAM</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Persistent Fullscreen Barrier if exited and warning modal dismissed */}
      {!isFullscreen && !showWarningModal && !submitted && (
        <div
          onClick={enterStrictFullscreen}
          className="fixed inset-0 z-[9999998] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 text-center select-none"
        >
          <div className="max-w-md w-full rounded-3xl glass-panel-glow p-8 border border-red-500/50">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Fullscreen Mode Required</h3>
            <p className="text-xs text-slate-300 mb-6">
              You must maintain full screen throughout the exam.
            </p>
            <button
              onClick={enterStrictFullscreen}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-red-600 text-white"
            >
              Resume Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
