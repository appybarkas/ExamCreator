'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MonitorCheck,
  ShieldAlert,
  Clock,
  Calendar,
  Sparkles,
  LogOut,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { StudentRecord } from '@/lib/types';

export default function StudentDashboardPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreated, setIsCreated] = useState(false);
  const [title, setTitle] = useState('Computer Science Core Assessment');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [maxViolations, setMaxViolations] = useState(3);

  // Load student auth session
  useEffect(() => {
    const rawSession = localStorage.getItem('student_session');
    if (!rawSession) {
      router.push('/student/login');
      return;
    }
    try {
      const parsed = JSON.parse(rawSession);
      setStudent(parsed);
    } catch {
      router.push('/student/login');
    }
  }, [router]);

  // Fetch quiz status & candidate status (polls so when teacher clicks 'Create Quiz' or changes quiz_status to 0, student immediately sees it)
  const checkQuizStatus = useCallback(async () => {
    try {
      const username = student?.username;
      const [quizRes, statusRes] = await Promise.all([
        fetch('/api/student/quiz', { cache: 'no-store' }),
        username
          ? fetch(`/api/student/status?username=${encodeURIComponent(username)}`, { cache: 'no-store' })
          : Promise.resolve(null),
      ]);

      if (quizRes.ok) {
        const data = await quizRes.json();
        setIsCreated(Boolean(data.isCreated));
        if (data.title) setTitle(data.title);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
        if (data.maxViolations) setMaxViolations(data.maxViolations);
      }

      if (statusRes && statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success) {
          setStudent((prev) => {
            if (!prev) return prev;
            const updated: StudentRecord = {
              ...prev,
              quiz_status: statusData.quiz_status,
              quiz: statusData.quiz,
              violations: statusData.violations,
            };
            localStorage.setItem('student_session', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching quiz status:', err);
    } finally {
      setLoading(false);
    }
  }, [student?.username]);

  useEffect(() => {
    checkQuizStatus();
    const interval = setInterval(checkQuizStatus, 3000);
    return () => clearInterval(interval);
  }, [checkQuizStatus]);

  // Handle Enter Exam (Requests Fullscreen and immediately launches exam)
  const handleEnterExam = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request initiated by user:', err);
    }
    router.push('/student/exam');
  };

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-sm text-slate-400">Loading Student Dashboard...</p>
        </div>
      </div>
    );
  }

  // Rule: "His quiz_status will become 1, indicating he has given the quiz and cannot give it again."
  // When teacher resets quiz_status to 0, hasAlreadyGivenQuiz becomes false.
  const hasAlreadyGivenQuiz = student?.quiz_status === 1;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-4xl mx-auto w-full">
      {/* Top Navbar */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
            <MonitorCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Student Assessment Room</h1>
            <p className="text-xs text-slate-400">
              Candidate: <span className="text-cyan-300 font-semibold">{student?.username}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      {/* Main Status Card */}
      <div className="rounded-3xl glass-panel-glow p-8 relative overflow-hidden mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Proctored Environment
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Total Questions: <span className="text-white font-bold">{totalQuestions}</span> questions | Max Allowed Violations:{' '}
              <span className="text-rose-400 font-bold">{maxViolations}</span>
            </p>
          </div>

          <div className="shrink-0">
            {hasAlreadyGivenQuiz ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-right">
                <span className="text-xs text-emerald-400 font-semibold block">Quiz Completed</span>
                <span className="text-2xl font-extrabold text-white">
                  Score: {student?.quiz ?? 0} / {totalQuestions}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Single attempt locked</span>
              </div>
            ) : isCreated ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Exam Ready to Launch
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                Awaiting Instructor Activation
              </span>
            )}
          </div>
        </div>

        {/* Schedule Windows */}
        {(startTime || endTime) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 mb-8 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">Start Window:</span>
                <span className="font-semibold text-slate-200">
                  {startTime ? new Date(startTime).toLocaleString() : 'Open Immediately'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">End Window:</span>
                <span className="font-semibold text-slate-200">
                  {endTime ? new Date(endTime).toLocaleString() : 'No Deadline Assigned'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Strict Fullscreen Lockdown Notice */}
        <div className="space-y-3 mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            Strict Fullscreen Lockdown Protocol
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <li className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Full screen is strictly enforced. No other application can be opened when in full screen.</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Keyboard input is disabled in full screen. Mouse input works within fullscreen only.</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>You must answer all questions to submit. Auto-submits if violations exceed {maxViolations}.</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>After submission, the application securely closes itself. Single attempt only unless reset by instructor.</span>
            </li>
          </ul>
        </div>

        {/* Action Button */}
        {hasAlreadyGivenQuiz ? (
          <div className="p-4 rounded-xl bg-slate-800 text-center text-xs text-slate-300">
            You have already given this quiz. Your recorded score is <strong className="text-white">{student?.quiz ?? 0}</strong>. If permitted, the instructor can set your quiz status to 0 to grant a retake.
          </div>
        ) : isCreated ? (
          <button
            onClick={handleEnterExam}
            className="w-full py-4 px-6 rounded-2xl font-bold text-base bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-3 hover:scale-[1.01]"
          >
            <Maximize2 className="w-5 h-5" />
            <span>Enter Fullscreen Exam Lockdown</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300">
            The teacher has not yet clicked &quot;Create Quiz&quot;. This page will automatically activate as soon as the quiz is populated.
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <HelpCircle className="w-4 h-4" />
        <span>Strict full-screen enforcement will activate upon clicking Enter Fullscreen Exam Lockdown.</span>
      </div>
    </div>
  );
}
