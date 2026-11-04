import Link from 'next/link';
import {
  ShieldCheck,
  GraduationCap,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  MonitorCheck,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col justify-between p-6 md:p-12 max-w-7xl mx-auto w-full">
      {/* Top Navigation / Brand */}
      <header className="flex items-center justify-between py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              ExamCreator
            </span>
            <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              SECURE PRO
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Online
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            Strict Fullscreen Enforcement
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 shadow-inner">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Proctored High-Stakes Assessment Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15] mb-6">
          Ultra-Modern Quiz Platform with{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            Fullscreen Lockdown
          </span>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-12">
          Strict full-screen enforcement with forbidden shortcut blocking, real-time
          countdown proctoring, embedded figures support, and instant automated gradebook recording.
        </p>

        {/* Portal Entry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Teacher Portal */}
          <div className="group relative rounded-2xl glass-panel p-8 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/15 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 border border-indigo-500/30">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Teacher Portal
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Login with instructor credentials to upload quiz packages, schedule start and end dates,
                activate the exam, and monitor student performance.
              </p>
              <ul className="space-y-2 mb-8 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  Upload Quiz Zip package with figures
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  Assign Start/End dates & Create Quiz
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  Live candidate gradebook & submission status
                </li>
              </ul>
            </div>
            <Link
              href="/teacher/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 transition-all group-hover:scale-[1.01]"
            >
              <span>Teacher Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Student Portal */}
          <div className="group relative rounded-2xl glass-panel p-8 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/15 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-bl-full pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 border border-cyan-500/30">
                <MonitorCheck className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Student Portal
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Login with candidate credentials. Enter the mandatory full-screen lockdown environment,
                complete all questions with radio options, and submit before time expires.
              </p>
              <ul className="space-y-2 mb-8 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Strict full-screen enforcement & shortcut locks
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Top-left real-time countdown timer
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  Auto-submit on timer zero & self-closing
                </li>
              </ul>
            </div>
            <Link
              href="/student/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white shadow-lg shadow-cyan-600/30 transition-all group-hover:scale-[1.01]"
            >
              <span>Student Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Full-Screen Lockdown</div>
            <div className="text-xs text-slate-400">Escape, shortcut keys, tab switching prevented</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Real-Time Clock</div>
            <div className="text-xs text-slate-400">Top-left timer with auto-submit</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Automated Grading</div>
            <div className="text-xs text-slate-400">Secure server evaluation & single attempt check</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 border-t border-white/5">
        ExamCreator &bull; Ultra-Modern Secure Examination Platform
      </footer>
    </main>
  );
}
