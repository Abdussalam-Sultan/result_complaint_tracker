import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  Paperclip,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Content                                                                    */
/* -------------------------------------------------------------------------- */

type Tone = 'slate' | 'blue' | 'amber' | 'emerald';

interface Stage {
  status: string;
  tone: Tone;
  actor: string;
  note: string;
  time: string;
}

const STAGES: Stage[] = [
  {
    status: 'Submitted',
    tone: 'slate',
    actor: 'You',
    note: 'Complaint lodged: continuous assessment score missing for CSC 301.',
    time: 'Mon 9:12',
  },
  {
    status: 'Under review',
    tone: 'blue',
    actor: 'Course lecturer',
    note: 'Opened your complaint and is checking the score sheet.',
    time: 'Mon 14:40',
  },
  {
    status: 'Information requested',
    tone: 'amber',
    actor: 'Course lecturer',
    note: 'Please upload a photo of your marked test script.',
    time: 'Tue 10:05',
  },
  {
    status: 'Resolved',
    tone: 'emerald',
    actor: 'Course lecturer',
    note: 'Score of 18/30 added to your record.',
    time: 'Wed 11:30',
  },
];

const TONE_CLASSES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-300',
};

const TONE_DOT: Record<Tone, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
};

interface Step {
  icon: LucideIcon;
  who: string;
  text: string;
}

interface Scenario {
  id: string;
  tab: string;
  title: string;
  summary: string;
  steps: Step[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'missing',
    tab: 'A score is missing',
    title: 'One student, one issue',
    summary:
      'You lodge the complaint against the course. It goes straight to the lecturer who teaches it.',
    steps: [
      {
        icon: Send,
        who: 'Student',
        text: 'Pick the course, choose the issue (missing CA, wrong score, wrong grade, script remark) and attach evidence.',
      },
      {
        icon: Search,
        who: 'Lecturer',
        text: 'Reviews the complaint, asks for more information if needed, or resolves it with a written note.',
      },
      {
        icon: Bell,
        who: 'You',
        text: 'Every status change lands on your timeline with who made it and why, and you get a notification.',
      },
    ],
  },
  {
    id: 'mass',
    tab: 'Many students, same issue',
    title: 'One fix for the whole class',
    summary:
      'When many students report the same problem on the same course, the system groups them so the lecturer deals with it once.',
    steps: [
      {
        icon: Layers,
        who: 'System',
        text: 'Complaints with the same course, session and issue type are attached to one cluster automatically.',
      },
      {
        icon: Users,
        who: 'Lecturer',
        text: 'Resolves, rejects or asks for information for the whole cluster with a single note. A single student can be pulled out for separate review.',
      },
      {
        icon: Bell,
        who: 'Every student',
        text: 'Gets their own timeline entry and notification, so nobody has to chase.',
      },
    ],
  },
  {
    id: 'rejected',
    tab: 'Complaint rejected',
    title: 'A rejection needs a reason',
    summary:
      'Lecturers must give an academic reason when they reject. If you disagree, you can dispute it once.',
    steps: [
      {
        icon: XCircle,
        who: 'Lecturer',
        text: 'Rejects the complaint and states the academic reason on your timeline.',
      },
      {
        icon: Scale,
        who: 'Student',
        text: 'Disputes the rejection with a justification. Each issue can be reopened one time only.',
      },
      {
        icon: Building2,
        who: 'Head of Department',
        text: 'A disputed rejection goes directly to the HOD for independent review.',
      },
    ],
  },
  {
    id: 'silence',
    tab: 'Nobody responds',
    title: 'Complaints never sit in limbo',
    summary: 'Deadlines are built in, so a complaint always has someone responsible for it.',
    steps: [
      {
        icon: Timer,
        who: 'After 7 days',
        text: 'If a lecturer has not acted, the complaint is escalated to the HOD automatically.',
      },
      {
        icon: Clock,
        who: 'After 7 days',
        text: 'If information was requested from you and you do not reply, the item is closed as rejected.',
      },
      {
        icon: Building2,
        who: 'No lecturer assigned',
        text: 'Complaints for a course without a lecturer skip that stage and go to the HOD.',
      },
    ],
  },
];

interface Role {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  points: string[];
}

const ROLES: Role[] = [
  {
    id: 'student',
    label: 'Student',
    icon: GraduationCap,
    headline: 'Raise it, then watch it move.',
    points: [
      'Lodge several issues on one course in a single complaint',
      'Attach evidence such as photos of scripts or score sheets',
      'Follow a timeline for every issue and get notified on each change',
      'Dispute a rejection once, or withdraw a complaint',
    ],
  },
  {
    id: 'lecturer',
    label: 'Lecturer',
    icon: FileText,
    headline: 'Everything for your courses in one queue.',
    points: [
      'See complaints for the courses you teach, grouped into clusters where students share an issue',
      'Resolve, reject or request information in bulk with one note',
      'Isolate a single student from a cluster to review them separately',
      'Rejections require a reason, so students always get an explanation',
    ],
  },
  {
    id: 'hod',
    label: 'Head of Department',
    icon: Building2,
    headline: 'Oversight without chasing people.',
    points: [
      'Receive escalated complaints, disputed rejections and complaints for courses with no lecturer',
      'See open, escalated and resolved counts by course and by issue type',
      'Track how long complaints take to resolve and which are oldest',
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    headline: 'Keep courses and people in order.',
    points: [
      'Allocate lecturers to courses so complaints route to the right person',
      'Manage the user registry',
      'Preview the 7-day escalation rules with the time simulator',
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400';

const scrollToId = (id: string, reduce: boolean | null) => {
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

const AuthButtons: React.FC<{ size?: 'sm' | 'lg'; onDark?: boolean }> = ({ size = 'sm', onDark = true }) => {
  const pad = size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-xs';
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/login"
        className={`${pad} ${focusRing} rounded-xl font-bold border transition-colors ${
          onDark
            ? 'text-white border-white/30 hover:bg-white/10'
            : 'text-[#002147] border-[#002147]/30 hover:bg-[#002147]/5'
        }`}
      >
        Sign in
      </Link>
      <Link
        to="/register"
        className={`${pad} ${focusRing} rounded-xl font-bold bg-amber-500 text-[#002147] hover:bg-amber-400 transition-colors shadow-md flex items-center gap-2`}
      >
        <span>Create account</span>
        {size === 'lg' && <ArrowRight className="w-4 h-4" />}
      </Link>
    </div>
  );
};

/** The live demo card in the hero: walks through the life of one complaint. */
const LiveComplaintCard: React.FC = () => {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const last = STAGES.length - 1;
    const delay = index === last ? 4500 : 2800;
    const timer = window.setTimeout(() => setIndex((i) => (i === last ? 0 : i + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduce]);

  const stage = STAGES[index];

  return (
    <div
      className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 text-slate-800 w-full max-w-md mx-auto lg:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">CSC 301</p>
          <p className="text-xs text-slate-500">Missing continuous assessment score</p>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage.status}
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${TONE_CLASSES[stage.tone]}`}
          >
            {stage.status}
          </motion.span>
        </AnimatePresence>
      </div>

      <ol className="mt-5 space-y-4 min-h-[15rem]" aria-live="polite">
        {STAGES.slice(0, index + 1).map((s, i) => (
          <motion.li
            key={s.status}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: i === index ? 1 : 0.55, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex gap-3"
          >
            <span className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${TONE_DOT[s.tone]}`} />
              {i < STAGES.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
            </span>
            <div className="pb-1">
              <p className="text-xs font-semibold text-slate-900">
                {s.status} <span className="font-normal text-slate-400">{s.time}</span>
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-medium text-slate-700">{s.actor}:</span> {s.note}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5" role="group" aria-label="Jump to a stage">
          {STAGES.map((s, i) => (
            <button
              key={s.status}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show stage: ${s.status}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all cursor-pointer ${focusRing} ${
                i === index ? 'w-6 bg-[#002147]' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
        <span className="text-[11px] text-slate-400">Example complaint</span>
      </div>
    </div>
  );
};

/** 25 students in one cluster; one click resolves them all. */
const ClusterViz: React.FC = () => {
  const reduce = useReducedMotion();
  const [resolved, setResolved] = useState(false);
  const total = 25;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-900">CSC 301: Missing score cluster</p>
          <p className="text-[11px] text-slate-500">
            {resolved ? `${total} of ${total} students resolved` : `${total} students waiting`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setResolved((r) => !r)}
          className={`text-xs font-bold px-4 py-2 rounded-xl bg-[#002147] text-white hover:bg-blue-900 transition-colors cursor-pointer ${focusRing}`}
        >
          {resolved ? 'Reset the example' : 'Resolve all with one note'}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-10 sm:grid-cols-[repeat(25,minmax(0,1fr))] gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className="aspect-square rounded-full"
            initial={false}
            animate={{ backgroundColor: resolved ? '#059669' : '#f59e0b', scale: resolved ? 1 : 0.9 }}
            transition={reduce ? { duration: 0 } : { delay: i * 0.035, duration: 0.25 }}
          />
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export const HomePage: React.FC = () => {
  const reduce = useReducedMotion();
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [roleId, setRoleId] = useState(ROLES[0].id);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
  const RoleIcon = role.icon;

  const heroContainer = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.12 } },
  };
  const heroItem = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#001733]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className={`flex items-center gap-3 ${focusRing} rounded-lg`}>
            <span className="w-12 h-12 rounded-lg bg-white p-1 shrink-0">
              <img src="/oau-logo.png" alt="Obafemi Awolowo University logo" className="w-full h-full object-contain" />
            </span>
            <span className="hidden sm:block text-sm font-bold text-white">Result Complaint Tracker</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-blue-100" aria-label="Page sections">
            {[
              ['how', 'How it works'],
              ['roles', 'Who uses it'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToId(id, reduce)}
                className={`hover:text-white transition-colors cursor-pointer rounded ${focusRing}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <AuthButtons />
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#001733] via-[#002147] to-[#0B2545] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <motion.div variants={heroContainer} initial="hidden" animate="show" className="space-y-6">
            <motion.p variants={heroItem} className="text-sm text-blue-200">
              Obafemi Awolowo University, Ile-Ife • Department of Computer Science & Engineering
            </motion.p>
            <motion.h1
              variants={heroItem}
              className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            >
              Result looks wrong? Follow your complaint until it is fixed.
            </motion.h1>
            <motion.p variants={heroItem} className="text-base sm:text-lg text-blue-100 max-w-xl leading-relaxed">
              Report a missing score, a wrong grade or a script remark request. See who is reviewing it, what they
              said and what happens next, without walking from office to office.
            </motion.p>
            <motion.div variants={heroItem} className="pt-2">
              <AuthButtons size="lg" />
              <p className="mt-3 text-xs text-blue-200">
                Students register with their matric number. Staff accounts are created by the department admin.
              </p>
            </motion.div>
          </motion.div>

          <LiveComplaintCard />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 py-16 lg:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#002147] tracking-tight">
              What happens after you submit
            </h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Pick a situation to see how the tracker handles it.
            </p>
          </div>

          <div role="tablist" aria-label="Situations" className="mt-8 flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                role="tab"
                type="button"
                id={`tab-${s.id}`}
                aria-selected={s.id === scenarioId}
                aria-controls="scenario-panel"
                onClick={() => setScenarioId(s.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${focusRing} ${
                  s.id === scenarioId
                    ? 'bg-[#002147] text-white border-[#002147]'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-[#002147]'
                }`}
              >
                {s.tab}
              </button>
            ))}
          </div>

          <div
            id="scenario-panel"
            role="tabpanel"
            aria-labelledby={`tab-${scenario.id}`}
            className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={scenario.id}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <h3 className="text-xl font-bold text-slate-900">{scenario.title}</h3>
                <p className="mt-1 text-sm text-slate-600 max-w-2xl leading-relaxed">{scenario.summary}</p>

                <ol className="mt-6 grid md:grid-cols-3 gap-4">
                  {scenario.steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <motion.li
                        key={step.who + i}
                        initial={reduce ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : 0.1 + i * 0.12, duration: 0.35 }}
                        className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
                      >
                        <span className="w-9 h-9 rounded-xl bg-[#002147] text-amber-400 flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </span>
                        <p className="mt-3 text-sm font-bold text-slate-900">{step.who}</p>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">{step.text}</p>
                      </motion.li>
                    );
                  })}
                </ol>

                {scenario.id === 'mass' && <ClusterViz />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 py-16 lg:py-24 bg-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#002147] tracking-tight">
              One system, four roles
            </h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Everyone sees the same complaint, with the tools their role needs.
            </p>
          </div>

          <div className="mt-8 grid lg:grid-cols-[18rem_1fr] gap-6">
            <div role="tablist" aria-label="Roles" aria-orientation="vertical" className="flex lg:flex-col gap-2 overflow-x-auto">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = r.id === roleId;
                return (
                  <button
                    key={r.id}
                    role="tab"
                    type="button"
                    id={`role-${r.id}`}
                    aria-selected={active}
                    aria-controls="role-panel"
                    onClick={() => setRoleId(r.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${focusRing} ${
                      active
                        ? 'bg-[#002147] text-white border-[#002147]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#002147]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div
              id="role-panel"
              role="tabpanel"
              aria-labelledby={`role-${role.id}`}
              className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 sm:p-8"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={role.id}
                  initial={reduce ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="w-10 h-10 rounded-xl bg-[#002147] text-amber-400 flex items-center justify-center">
                    <RoleIcon className="w-5 h-5" />
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">{role.headline}</h3>
                  <ul className="mt-4 space-y-3">
                    {role.points.map((p) => (
                      <li key={p} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-gradient-to-br from-[#001733] via-[#002147] to-[#0B2545] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
              Check on your result today.
            </h2>
            <p className="mt-3 text-blue-100 leading-relaxed flex items-start gap-2">
              <Paperclip className="w-4 h-4 mt-1 shrink-0 text-amber-400" />
              <span>Have your matric number and course list ready. Registration takes about a minute.</span>
            </p>
          </div>
          <AuthButtons size="lg" />
        </div>
      </section>

      <footer className="py-5 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Obafemi Awolowo University, Ile-Ife • Student Result Complaint & Escalation Tracking System
        </span>
      </footer>
    </div>
  );
};
