import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Hash,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/client';

interface CourseOption {
  id: number;
  code: string;
  title: string;
  session: string;
  semester: string;
}

const EMAIL_DOMAIN = '@oauife.edu.ng';
const MATRIC_PATTERN = /^[A-Z]{2,4}\/\d{4}\/\d{3,4}$/;
const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  'w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all';
const labelClass = 'block text-xs font-semibold uppercase text-slate-700 mb-1';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [matricNo, setMatricNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/register/courses')
      .then((res) => {
        if (!cancelled) setCourses(res.data);
      })
      .catch(() => {
        if (!cancelled) setCoursesError('Could not load the course list. Refresh the page to try again.');
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCourse = (id: number) => {
    setSelectedCourses((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const validate = (): string | null => {
    if (name.trim().length < 2) return 'Enter your full name.';
    if (!MATRIC_PATTERN.test(matricNo.trim().toUpperCase())) {
      return 'Enter your matric number in the format CSC/2021/001.';
    }
    if (!email.trim().toLowerCase().endsWith(EMAIL_DOMAIN)) {
      return `Use your university email ending in ${EMAIL_DOMAIN}.`;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password !== confirmPassword) return 'The two passwords do not match.';
    if (selectedCourses.length === 0) return 'Select at least one course you are enrolled in.';
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: name.trim(),
        matric_no: matricNo.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
        course_ids: selectedCourses,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001733] via-[#002147] to-[#0B2545] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 animate-in fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-28 h-28 rounded-2xl bg-white p-3 mx-auto shadow-xl border-2 border-amber-400">
          <img src="/oau-logo.png" alt="Obafemi Awolowo University logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Result Complaint Tracker
        </h1>
        <p className="text-xs sm:text-sm text-blue-200">
          Obafemi Awolowo University, Ile-Ife • Faculty of Technology
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100 space-y-6">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Account created</h2>
                <p className="text-xs text-slate-500">
                  You are registered for {selectedCourses.length}{' '}
                  {selectedCourses.length === 1 ? 'course' : 'courses'}. Sign in to lodge a result complaint.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 bg-[#002147] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to sign in</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Create your student account</h2>
                <p className="text-xs text-slate-500">
                  Register with your matric number and university email
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reg-name" className={labelClass}>
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ayomide Balogun"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-matric" className={labelClass}>
                    Matric Number
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="reg-matric"
                      type="text"
                      required
                      value={matricNo}
                      onChange={(e) => setMatricNo(e.target.value.toUpperCase())}
                      placeholder="e.g. CSC/2021/001"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className={labelClass}>
                    University Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={`e.g. ayomide${EMAIL_DOMAIN}`}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className={labelClass}>
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-confirm" className={labelClass}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="reg-confirm"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className={inputClass}
                    />
                  </div>
                </div>

                <fieldset>
                  <legend className={labelClass}>Your Courses</legend>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Select every course you are enrolled in. You can only lodge complaints for these.
                  </p>
                  <div className="max-h-44 overflow-y-auto border border-slate-300 rounded-xl bg-slate-50 divide-y divide-slate-200">
                    {coursesLoading && <p className="p-3 text-xs text-slate-500">Loading courses...</p>}
                    {coursesError && <p className="p-3 text-xs text-rose-700">{coursesError}</p>}
                    {!coursesLoading && !coursesError && courses.length === 0 && (
                      <p className="p-3 text-xs text-slate-500">No courses have been set up yet. Contact the department admin.</p>
                    )}
                    {courses.map((course) => (
                      <label
                        key={course.id}
                        className="flex items-start gap-2.5 p-2.5 text-xs text-slate-800 cursor-pointer hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
                          onChange={() => toggleCourse(course.id)}
                          className="mt-0.5 accent-[#002147]"
                        />
                        <span>
                          <span className="font-semibold">{course.code}</span>
                          <span className="text-slate-600"> {course.title}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#002147] hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  <span>{loading ? 'Creating account...' : 'Create account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <p className="text-center text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-blue-700 hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Student & Academic Staff Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
