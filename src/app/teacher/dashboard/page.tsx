'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Upload,
  Calendar,
  Clock,
  Sparkles,
  LogOut,
  RefreshCw,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ListOrdered,
  Users,
  Award,
  Loader2,
  FileCheck,
  ImageIcon,
  ShieldAlert,
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';
import { QuizQuestion, StudentRecord } from '@/lib/types';

export default function TeacherDashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [teacherName, setTeacherName] = useState('Instructor');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quiz config state
  const [title, setTitle] = useState('Computer Science Core Assessment');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxViolations, setMaxViolations] = useState<number>(3);
  const [isCreated, setIsCreated] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Student table state
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [resettingUser, setResettingUser] = useState<string | null>(null);

  // UI status
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Check auth
  useEffect(() => {
    const rawSession = localStorage.getItem('teacher_session');
    if (!rawSession) {
      router.push('/teacher/login');
      return;
    }
    try {
      const session = JSON.parse(rawSession);
      setTeacherName(session.name || 'Instructor');
    } catch {
      router.push('/teacher/login');
    }
  }, [router]);

  // Load Quiz Config & Questions
  const loadData = useCallback(async () => {
    try {
      const [configRes, studentsRes] = await Promise.all([
        fetch('/api/teacher/config', { cache: 'no-store' }),
        fetch('/api/teacher/students', { cache: 'no-store' }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.config) {
          setTitle(configData.config.title || 'Computer Science Core Assessment');
          setStartTime(configData.config.startTime || '');
          setEndTime(configData.config.endTime || '');
          setMaxViolations(
            typeof configData.config.maxViolations === 'number' && configData.config.maxViolations > 0
              ? configData.config.maxViolations
              : 3
          );
          setIsCreated(Boolean(configData.config.isCreated));
        }
        if (Array.isArray(configData.questions)) {
          setQuestions(configData.questions);
        }
      }

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        if (Array.isArray(studentsData.students)) {
          setStudents(studentsData.students);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem('teacher_session');
    router.push('/');
  };

  // Handle "Create Quiz" / "Update Populated Quiz" button click
  const handleCreateOrUpdateQuiz = async () => {
    setSavingConfig(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/teacher/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          startTime,
          endTime,
          maxViolations: Number(maxViolations) || 3,
          isCreated: true, // Populated and fixed until updated with a new one
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreated(true);
        setFeedback({
          type: 'success',
          message: 'Quiz populated and set fixed! Students can now access questions with the updated configuration.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to update quiz settings.',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error saving quiz configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Handle changing student's quiz_status to 0
  // Requirement: "Also, he can change the quiz_status of any student to 0."
  const handleResetStudentStatus = async (username: string) => {
    setResettingUser(username);
    setFeedback(null);

    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, quiz_status: 0 }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStudents((prev) =>
          prev.map((s) =>
            s.username.toLowerCase() === username.toLowerCase()
              ? { ...s, quiz_status: 0, violations: 0 }
              : s
          )
        );
        setFeedback({
          type: 'success',
          message: `Candidate ${username}'s quiz_status changed to 0. They are now eligible to re-attempt the quiz.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || `Failed to reset quiz_status for ${username}`,
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: `Network error changing quiz_status for ${username}`,
      });
    } finally {
      setResettingUser(null);
    }
  };

  // Handle File Upload (quiz.zip with quiz.json and figures/)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/teacher/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQuestions(data.questions || []);
        setIsCreated(true);
        setFeedback({
          type: 'success',
          message: `Successfully uploaded ${file.name} with ${data.count} questions and figures! The newly populated quiz is set fixed and active for students.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to parse and upload quiz file.',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to upload zip package.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Loading Instructor Control Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-7xl mx-auto w-full">
      {/* Top Navbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Instructor Control Center</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                System Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Welcome, <span className="text-indigo-300 font-medium">{teacherName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-panel text-xs text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`mb-8 p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Quiz Setup vs Student Gradebook */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Schedule, Create Quiz, and Questions Upload */}
        <div className="lg:col-span-2 space-y-8">
          {/* Card 1: Schedule & Create Quiz */}
          <div className="rounded-3xl glass-panel p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Quiz Scheduling & Activation</h2>
                  <p className="text-xs text-slate-400">
                    Define exam window, max violations threshold, and deploy questions
                  </p>
                </div>
              </div>

              <div>
                {isCreated ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Quiz Fixed & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Draft / Pending Activation
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-200"
                />
              </div>

              {/* Requirement: The maximum allowed violations can be set from the teacher dashboard */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Max Allowed Violations
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxViolations}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setMaxViolations(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-200"
                  placeholder="3"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Auto-submits when violations exceed {maxViolations}
                </span>
              </div>
            </div>

            {/* Create Quiz Button (Mandated by requirements) */}
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Pressing <strong className="text-slate-200">Create Quiz</strong> sets the populated quiz fixed until updated with a new package, and immediately deploys questions to students.
              </p>
              <button
                type="button"
                onClick={handleCreateOrUpdateQuiz}
                disabled={savingConfig || questions.length === 0}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shrink-0"
              >
                {savingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing & Fixing Quiz...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
                    <span>{isCreated ? 'Update & Fix Quiz Configuration' : 'Create Quiz & Populate Students'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Upload Questions as Zip File (Stored as ./frontend/quiz.zip) */}
          <div className="rounded-3xl glass-panel p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Upload Quiz Zip Package</h2>
                  <p className="text-xs text-slate-400">
                    Upload new zip containing <code className="text-purple-300">quiz.json</code> and <code className="text-purple-300">figures</code> folder
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                {questions.length} Questions Loaded
              </span>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-6 sm:p-8 text-center transition-all bg-white/[0.01] hover:bg-white/[0.03]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json,application/zip,application/x-zip-compressed,application/json"
                onChange={handleFileUpload}
                className="hidden"
                id="quiz-zip-upload"
              />
              <label
                htmlFor="quiz-zip-upload"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {uploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  Click to select or drag and drop <code className="text-indigo-300 font-mono">quiz.zip</code>
                </div>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Stored as <code className="text-indigo-300">./frontend/quiz.zip</code>. Extracts <code className="text-indigo-300">quiz.json</code> and embedded figures. Quiz stays fixed until updated with a new one.
                </p>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all">
                  <FileCheck className="w-3.5 h-3.5" />
                  Browse Quiz Zip File
                </span>
              </label>
            </div>

            {/* Questions Preview Drawer */}
            {questions.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-indigo-400" />
                    Populated Questions Fixed ({questions.length})
                  </h3>
                </div>

                <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-2">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl glass-panel border border-white/5 hover:border-white/15 transition-all text-xs"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="font-bold text-indigo-400">Q{idx + 1}.</span>
                        <p className="flex-1 font-medium text-slate-200">{q.question}</p>
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Answer: {q.Answer}
                        </span>
                      </div>

                      {/* Question Figure preview if present */}
                      {q.figure && (
                        <div className="my-3 p-2 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-3">
                          <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="text-[11px] text-slate-400 font-mono">
                            Figure: {q.figure}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 pl-4">
                        {Object.entries(q.options || {}).map(([optKey, optVal]) => (
                          <div
                            key={optKey}
                            className={`p-2 rounded-lg text-[11px] ${
                              q.Answer === optKey
                                ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            <span className="font-mono font-bold mr-1.5 text-indigo-300">
                              {optKey}:
                            </span>
                            <span>{optVal}</span>

                            {/* Option Figure if present */}
                            {q.figures_options && q.figures_options[optKey] && (
                              <div className="mt-1 text-[10px] text-indigo-300 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                <span>{q.figures_options[optKey]}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Real-Time Student Gradebook */}
        <div className="space-y-6">
          <div className="rounded-3xl glass-panel p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Student Gradebook</h2>
                  <p className="text-xs text-slate-400">Manage candidates and status</p>
                </div>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                {students.length} Registered
              </span>
            </div>

            {/* Students Table */}
            {students.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No students registered.
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((st) => {
                  const hasGiven = st.quiz_status === 1;
                  const isResetting = resettingUser === st.username;
                  return (
                    <div
                      key={st.username}
                      className="p-4 rounded-2xl glass-panel border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{st.username}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Status: {hasGiven ? 'Submitted (Single Attempt Used)' : 'Eligible to Take Quiz'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Violations: <span className="text-rose-400 font-mono font-semibold">{st.violations ?? 0}</span> / {maxViolations} max
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Award className="w-4 h-4 text-indigo-400" />
                            <span className="text-base font-extrabold text-white">
                              {st.quiz !== null && st.quiz !== undefined ? st.quiz : '0'}
                            </span>
                            <span className="text-xs text-slate-400">/ {questions.length}</span>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 ${
                              hasGiven
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {hasGiven ? 'quiz_status: 1' : 'quiz_status: 0'}
                          </span>
                        </div>
                      </div>

                      {/* Requirement: Also, he can change the quiz_status of any student to 0 */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {hasGiven ? 'Candidate locked out' : 'Candidate ready'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetStudentStatus(st.username)}
                          disabled={isResetting}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          title="Set candidate quiz_status to 0 to allow re-attempt"
                        >
                          {isResetting ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Set quiz_status to 0</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                Click &quot;Set quiz_status to 0&quot; anytime to unlock exam re-attempts for candidates.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
