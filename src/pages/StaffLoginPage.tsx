import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STAFF_ID_PATTERN = /^OAU\/STAFF\/\d{4,6}$/;

export const StaffLoginPage: React.FC = () => {
  const { loginStaff } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!STAFF_ID_PATTERN.test(staffId.trim().toUpperCase())) {
      setError('Staff ID must match OAU/STAFF/0001.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginStaff(email.trim().toLowerCase(), staffId.trim().toUpperCase(), password);
      navigate(user.role === 'admin' ? '/admin' : '/advisor');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not sign in with those staff details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#001733] via-[#002147] to-[#0B2545] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800">
      <header className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-24 h-24 rounded-2xl bg-white p-3 mx-auto shadow-xl border-2 border-amber-400"><img src="/oau-logo.png" alt="Obafemi Awolowo University logo" className="w-full h-full object-contain" /></div>
        <h1 className="text-3xl font-extrabold text-white">Rectify Staff</h1>
        <p className="text-sm text-blue-200">Faculty of Computing and Engineering</p>
      </header>
      <section className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100 space-y-6">
          <div className="text-center"><h2 className="text-lg font-bold text-slate-900">Staff sign in</h2><p className="text-xs text-slate-500 mt-1">Use your university email and unique staff ID</p></div>
          {error && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs font-semibold uppercase text-slate-700">University email<span className="relative mt-1 block"><Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@oauife.edu.ng" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
            <label className="block text-xs font-semibold uppercase text-slate-700">Staff ID<span className="relative mt-1 block"><User className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="text" required autoComplete="username" value={staffId} onChange={(e) => setStaffId(e.target.value.toUpperCase())} placeholder="OAU/STAFF/0001" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
            <label className="block text-xs font-semibold uppercase text-slate-700">Password<span className="relative mt-1 block"><Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#002147] hover:bg-blue-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">{loading ? 'Signing in...' : 'Staff sign in'} <ArrowRight className="w-4 h-4" /></button>
          </form>
          <div className="text-center space-y-2 text-xs text-slate-500"><p>New part advisor? <Link to="/staff/register" className="font-semibold text-blue-700 hover:underline">Create a staff account</Link></p><p><Link to="/login" className="hover:underline">Student sign in</Link></p></div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400"><ShieldCheck className="w-4 h-4 text-emerald-600" />Staff credentials are verified with your staff ID</div>
        </div>
      </section>
    </main>
  );
};
