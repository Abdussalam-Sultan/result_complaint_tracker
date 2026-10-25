import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { User, Course, Complaint } from '../../types';
import { ComplaintAttachments } from '../../components/ComplaintAttachments';
import {
  Users, BookOpen, Clock, Play, RotateCcw,
  CheckCircle2, AlertTriangle, ShieldAlert, Plus, X, UserCheck, Paperclip
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState<boolean>(false);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tab
  const [activeTab, setActiveTab] = useState<'COURSES' | 'USERS' | 'SIMULATION' | 'EVIDENCE'>('COURSES');

  // Simulation State
  const [simDays, setSimDays] = useState<number>(7);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Course Assignment Modal
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [newLecturerId, setNewLecturerId] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState<boolean>(false);

  // New User Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserMatric, setNewUserMatric] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('student');
  const [newUserPassword, setNewUserPassword] = useState<string>('password123');
  const [userCreateLoading, setUserCreateLoading] = useState<boolean>(false);
  const [userError, setUserError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, coursesRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/courses/all'),
      ]);
      setUsers(usersRes.data);
      setCourses(coursesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComplaints = async () => {
    setComplaintsLoading(true);
    setComplaintsError(null);
    try {
      const response = await api.get('/complaints');
      setComplaints(response.data);
    } catch (err: any) {
      console.error(err);
      setComplaintsError(err.response?.data?.detail || 'Could not load complaints.');
    } finally {
      setComplaintsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [user]);

  const handleSimulateTime = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await api.post('/admin/simulate-time', {
        days_to_advance: simDays,
      });
      setSimResult(res.data);
      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setSimResult({ error: 'Simulation failed. Please check inputs.' });
    } finally {
      setSimulating(false);
    }
  };

  const handleAssignLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setAssignLoading(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/assign`, {
        lecturer_id: newLecturerId === '' ? null : Number(newLecturerId),
      });
      setSelectedCourse(null);
      fetchAdminData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserCreateLoading(true);
    try {
      await api.post('/admin/users', {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        matric_no: newUserRole === 'student' ? newUserMatric.trim() : null,
        password: newUserPassword,
      });
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserMatric('');
      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setUserError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setUserCreateLoading(false);
    }
  };

  const lecturers = users.filter((u) => u.role === 'lecturer');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Banner */}
      <div className="bg-[#002147] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-blue-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-500/40 mb-2">
            <span>Academic Affairs Administrative Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Academic Affairs & Course Allocation
          </h1>
          <p className="text-sm text-blue-200">
            Allocate courses to lead lecturers, manage student registry, and execute automated SLA escalation policies.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-blue-950/80 p-1 rounded-xl border border-blue-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('COURSES')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'COURSES' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-blue-200 hover:text-white'
            }`}
          >
            Course Allocation
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'USERS' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-blue-200 hover:text-white'
            }`}
          >
            Users Directory
          </button>
          <button
            onClick={() => setActiveTab('SIMULATION')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'SIMULATION' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-blue-200 hover:text-white'
            }`}
          >
            SLA Policy Engine
          </button>
          <button
            onClick={() => {
              setActiveTab('EVIDENCE');
              fetchComplaints();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'EVIDENCE' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-blue-200 hover:text-white'
            }`}
          >
            Complaint Evidence
          </button>
        </div>
      </div>

      {activeTab === 'EVIDENCE' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-700" />
              Department Complaint Evidence
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              View submitted attachments for complaints across the department.
            </p>
          </div>
          <div className="p-5 space-y-3">
            {complaintsLoading ? (
              <p className="text-sm text-slate-500">Loading complaints...</p>
            ) : complaintsError ? (
              <p role="alert" className="text-sm text-rose-700">{complaintsError}</p>
            ) : complaints.length === 0 ? (
              <p className="text-sm text-slate-500">No complaints are available.</p>
            ) : (
              complaints.map((complaint) => (
                <article key={complaint.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Complaint #{complaint.id} · {complaint.course_code}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {complaint.student_name || 'Student'} · {new Date(complaint.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-700 mt-2">{complaint.description}</p>
                  </div>
                  {complaint.attachments?.length ? (
                    <ComplaintAttachments
                      complaintId={complaint.id}
                      attachments={complaint.attachments}
                    />
                  ) : (
                    <p className="text-xs text-slate-400">No attachment submitted.</p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* TAB 3: SLA Policy Engine */}
      {activeTab === 'SIMULATION' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              SLA Compliance & Automated Inactivity Escalation
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              University regulations require lecturers to review and act on result complaints within 7 days. If a lecturer remains inactive past this threshold, the complaint is automatically escalated to the Head of Department (HOD). Furthermore, student queries pending information without a reply are automatically closed.
            </p>
          </div>

          <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Execute SLA Inactivity Check
              </span>
              <p className="text-xs text-amber-800">
                Scan all active complaints against resolution deadlines and enforce automatic transitions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={simDays}
                onChange={(e) => setSimDays(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 shadow-2xs focus:outline-hidden"
              >
                <option value={7}>7 Days Inactivity Threshold</option>
                <option value={14}>14 Days Inactivity Threshold</option>
                <option value={30}>30 Days Inactivity Threshold</option>
              </select>

              <button
                onClick={handleSimulateTime}
                disabled={simulating}
                className="px-5 py-2.5 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{simulating ? 'Processing Policy Engine...' : 'Run SLA Policy Check'}</span>
              </button>
            </div>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Simulation Finished: Advanced by {simResult.simulated_days} Days
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Engine Status: 200 OK
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-xs text-red-800 font-semibold block">
                    Auto-Escalated to HOD
                  </span>
                  <span className="text-xl font-bold text-red-950 mt-1 block">
                    {simResult.auto_escalated_count} item(s)
                  </span>
                  <span className="text-[10px] text-red-700">Due to lecturer inactivity</span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs text-amber-800 font-semibold block">
                    Auto-Closed as Rejected
                  </span>
                  <span className="text-xl font-bold text-amber-950 mt-1 block">
                    {simResult.auto_closed_count} item(s)
                  </span>
                  <span className="text-[10px] text-amber-700">No student response</span>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs text-blue-800 font-semibold block">
                    Issue Groups Escalated
                  </span>
                  <span className="text-xl font-bold text-blue-950 mt-1 block">
                    {simResult.groups_escalated_count} cluster(s)
                  </span>
                  <span className="text-[10px] text-blue-700">Mass items transitioned</span>
                </div>
              </div>

              {simResult.auto_escalated_items?.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Escalation Audit Trail:
                  </span>
                  <div className="space-y-1 text-xs text-slate-700">
                    {simResult.auto_escalated_items.map((it: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white border border-slate-200 rounded flex justify-between">
                        <span>
                          #{it.item_id} • <b>{it.course}</b> ({it.issue_type}) • Student: {it.student}
                        </span>
                        <span className="text-red-700 font-semibold">ESCALATED TO HOD</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Course Allocation & Lecturer Assignment */}
      {activeTab === 'COURSES' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Course Lecturer Assignment
              </h2>
              <p className="text-xs text-slate-500">
                Allocate course leads. If reassigned mid-complaint, open complaints follow the new lecturer! If unassigned, complaints route directly to HOD.
              </p>
            </div>
          </div>

          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
              <tr>
                <th className="px-5 py-3">Course Code</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Session / Semester</th>
                <th className="px-5 py-3">Assigned Lead Lecturer</th>
                <th className="px-5 py-3">Enrolled</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    {c.code}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">
                    {c.title}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {c.session} • {c.semester}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.lecturer_id ? (
                      <span className="font-semibold text-slate-800">
                        {c.lecturer_name}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                        Unassigned (Routes to HOD)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-500">
                    {c.enrollment_count || 0} students
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedCourse(c);
                        setNewLecturerId(c.lecturer_id || '');
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-[#002147] hover:text-white border border-slate-300 rounded font-medium text-xs cursor-pointer transition-colors"
                    >
                      Assign Lecturer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Users Directory */}
      {activeTab === 'USERS' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-0">
          <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                User Registry ({users.length} Users)
              </h2>
              <p className="text-xs text-slate-500">
                Students, Lecturers, HOD, and Academic Affairs Administrators
              </p>
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-3.5 py-1.5 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold sticky top-0">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Matric No</th>
                  <th className="px-5 py-3">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {u.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600">
                      {u.email}
                    </td>
                    <td className="px-5 py-3">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-500">
                      {u.matric_no || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {u.department}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Lecturer Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Assign Lecturer for {selectedCourse.code}
              </h3>
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignLecturer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Lead Lecturer:
                </label>
                <select
                  value={newLecturerId}
                  onChange={(e) => setNewLecturerId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
                >
                  <option value="">Leave Unassigned (Routes complaints directly to HOD)</option>
                  {lecturers.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      {lec.name} ({lec.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Complaints filed for this course will instantly follow the newly assigned lecturer.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="px-4 py-1.5 bg-[#002147] hover:bg-blue-900 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                >
                  {assignLoading ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add New Academic User</h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                {userError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Babajide Fashola"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email (@oauife.edu.ng)</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@oauife.edu.ng"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="hod">HOD</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {newUserRole === 'student' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Matric Number</label>
                  <input
                    type="text"
                    required
                    value={newUserMatric}
                    onChange={(e) => setNewUserMatric(e.target.value)}
                    placeholder="e.g. CSC/2021/050"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 bg-slate-200 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userCreateLoading}
                  className="px-4 py-1.5 bg-[#002147] text-white rounded text-xs font-bold cursor-pointer"
                >
                  {userCreateLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
