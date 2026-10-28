import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import api from '../api/client';

const STAFF_ID_PATTERN = /^OAU\/STAFF\/\d{4,6}$/;

export const StaffRegisterPage: React.FC = () => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [staffId, setStaffId] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/departments')
      .then((response) => setDepartments(response.data))
      .catch(() => setError('Could not load departments. Refresh the page to try again.'));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!STAFF_ID_PATTERN.test(staffId.trim().toUpperCase())) {
      setError('Staff ID must match OAU/STAFF/0001.');
      return;
    }
    if (password.length < 8 || password !== confirmation) {
      setError(password.length < 8 ? 'Password must be at least 8 characters.' : 'The passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/staff/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        staff_id: staffId.trim().toUpperCase(),
        department,
        password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create your staff account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#001733] via-[#002147] to-[#0B2545] flex flex-col justify-center py-10 sm:px-6 lg:px-8 text-slate-800">
      <header className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-24 h-24 rounded-2xl bg-white p-3 mx-auto shadow-xl border-2 border-amber-400"><img src="/oau-logo.png" alt="Obafemi Awolowo University logo" className="w-full h-full object-contain" /></div>
        <h1 className="text-3xl font-extrabold text-white">Rectify Staff</h1>
        <p className="text-sm text-blue-200">Faculty of Computing and Engineering</p>
      </header>
      <section className="mt-7 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-7 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100 space-y-5">
          {success ? <div className="text-center space-y-3"><h2 className="text-lg font-bold text-slate-900">Staff account created</h2><p className="text-xs text-slate-600">You can now sign in with your university email and staff ID.</p><Link to="/staff/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">Go to staff sign in <ArrowRight className="w-4 h-4" /></Link></div> : <>
            <div className="text-center"><h2 className="text-lg font-bold text-slate-900">Create part-advisor account</h2><p className="text-xs text-slate-500 mt-1">Register with your assigned staff ID</p></div>
            {error && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-xs font-semibold uppercase text-slate-700">Full name<span className="relative mt-1 block"><User className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
              <label className="block text-xs font-semibold uppercase text-slate-700">University email<span className="relative mt-1 block"><Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@oauife.edu.ng" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
              <label className="block text-xs font-semibold uppercase text-slate-700">Staff ID<span className="relative mt-1 block"><User className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input required value={staffId} onChange={(e) => setStaffId(e.target.value.toUpperCase())} placeholder="OAU/STAFF/0001" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
              <label className="block text-xs font-semibold uppercase text-slate-700">Department<select required value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"><option value="">Select department</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="block text-xs font-semibold uppercase text-slate-700">Password<span className="relative mt-1 block"><Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
              <label className="block text-xs font-semibold uppercase text-slate-700">Confirm password<span className="relative mt-1 block"><Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" /><input type="password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs" /></span></label>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#002147] hover:bg-blue-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">{loading ? 'Creating account...' : 'Create staff account'} <ArrowRight className="w-4 h-4" /></button>
            </form>
            <p className="text-center text-xs text-slate-500">Already registered? <Link to="/staff/login" className="font-semibold text-blue-700 hover:underline">Staff sign in</Link></p>
          </>}
        </div>
      </section>
    </main>
  );
};
