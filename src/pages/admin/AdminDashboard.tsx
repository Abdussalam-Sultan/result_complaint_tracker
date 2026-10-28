import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Complaint, Course, User } from '../../types';
import { ComplaintAttachments } from '../../components/ComplaintAttachments';
import { BookOpen, RefreshCw, ShieldCheck, Users, Paperclip } from 'lucide-react';

interface DepartmentAssignment {
  name: string;
  part_advisor: { id: number; name: string; email: string; staff_id: string | null } | null;
}

type AdminTab = 'DEPARTMENTS' | 'COURSES' | 'STAFF' | 'STUDENTS' | 'EVIDENCE';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DEPARTMENTS');
  const [departments, setDepartments] = useState<DepartmentAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDepartment, setSavingDepartment] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState<number | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDepartments, setCourseDepartments] = useState<string[]>([]);
const [courseDeptDraft, setCourseDeptDraft] = useState<Record<number, string[]>>({});

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [departmentsResponse, usersResponse, coursesResponse] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/admin/users'),
        api.get('/courses/all'),
      ]);
      setDepartments(departmentsResponse.data);
      setUsers(usersResponse.data);
      setCourses(coursesResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load faculty data.');
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    setError(null);
    try {
      const response = await api.get('/complaints');
      setComplaints(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load complaints.');
    }
  };

  useEffect(() => { loadAdminData(); }, []);
  useEffect(() => { if (activeTab === 'EVIDENCE') loadComplaints(); }, [activeTab]);

  const assignAdvisor = async (department: string, value: string) => {
    setSavingDepartment(department);
    setError(null);
    try {
      await api.put(`/admin/departments/${encodeURIComponent(department)}/part-advisor`, {
        advisor_id: value ? Number(value) : null,
      });
      await loadAdminData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not update the part advisor.');
    } finally {
      setSavingDepartment(null);
    }
  };

  const assignCourseDepartments = async (courseId: number, values: string[]) => {
    setSavingCourse(courseId);
    setError(null);
    try {
      await api.put(`/courses/${courseId}/departments`, { departments: values });
      await loadAdminData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not update course departments.');
    } finally {
      setSavingCourse(null);
    }
  };

  const createCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingCourse(true);
    setError(null);
    try {
      await api.post('/courses', {
        code: courseCode.trim(),
        title: courseTitle.trim(),
        session: '2026/2027',
        semester: 'Harmattan',
        departments: courseDepartments,
      });
      setCourseCode('');
      setCourseTitle('');
      setCourseDepartments([]);
      await loadAdminData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create course.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const partAdvisors = users.filter((user) => user.role === 'part_advisor');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in">
      <header className="bg-[#002147] rounded-xl px-6 py-6 sm:px-8 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <span className="inline-flex items-center gap-2 text-xs text-amber-300 font-semibold"><ShieldCheck className="w-4 h-4" />Faculty Administration</span>
          <h1 className="text-2xl font-bold mt-2">Departments & Part Advisors</h1>
          <p className="text-sm text-blue-200 mt-1">Manage department assignments and course coverage.</p>
        </div>
        <button type="button" onClick={loadAdminData} disabled={loading} title="Refresh faculty data" className="p-2.5 self-start sm:self-auto rounded-lg border border-blue-700 hover:bg-blue-900 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      <nav className="flex gap-1 border-b border-slate-300" aria-label="Admin sections">
        {([
          ['DEPARTMENTS', 'Departments'],
          ['COURSES', 'Course Catalog'],
          ['STAFF', 'Staff'],
          ['STUDENTS', 'Students'],
          ['EVIDENCE', 'Complaint Evidence'],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-xs font-semibold border-b-2 ${activeTab === tab ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading faculty records...</p> : <>
        {activeTab === 'DEPARTMENTS' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Users className="w-4 h-4 text-blue-700" /><div><h2 className="text-sm font-bold text-slate-900">Department assignments</h2><p className="text-xs text-slate-500 mt-1">Assign or move a part advisor between departments. An advisor can be assigned to one department at a time.</p></div></div>
            <div className="divide-y divide-slate-100">
              {departments.map((department) => {
                const departmentCourses = courses.filter((course) => course.departments?.includes(department.name) || course.departments?.includes('All Departments'));
                return (
                  <article key={department.name} className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1fr)_minmax(240px,1fr)] gap-4 px-5 py-5 lg:items-start">
                    <div><h3 className="text-sm font-bold text-slate-900">{department.name}</h3><p className="text-xs text-slate-500 mt-1">{departmentCourses.length} available courses, including shared offerings</p></div>
                    <div>
                      <label htmlFor={`advisor-${department.name}`} className="block text-xs font-semibold text-slate-700 mb-1.5">Part advisor</label>
                      <select id={`advisor-${department.name}`} value={department.part_advisor?.id ?? ''} disabled={savingDepartment === department.name} onChange={(event) => assignAdvisor(department.name, event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 disabled:opacity-50">
                        <option value="">No advisor assigned</option>
                        {partAdvisors.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.department} ({candidate.email})</option>)}
                      </select>
                      {department.part_advisor && <a className="block text-xs text-blue-700 hover:underline mt-2 break-all" href={`mailto:${department.part_advisor.email}`}>{department.part_advisor.email}</a>}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />Courses</h4>
                      {departmentCourses.length ? <ul className="space-y-1.5">{departmentCourses.map((course) => <li key={course.id} className="text-xs text-slate-600"><span className="font-mono font-semibold text-slate-800">{course.code}</span> {course.title}{course.departments?.includes('All Departments') && <span className="ml-1 text-[10px] text-emerald-700">Shared</span>}</li>)}</ul> : <p className="text-xs text-slate-400">No courses assigned.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'STAFF' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h2 className="text-sm font-bold text-slate-900">Staff directory</h2></div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700"><thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Staff ID</th><th className="px-4 py-3">Department</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{users.filter((u) => u.role !== 'student').map((user) => <tr key={user.id}><td className="px-4 py-3 font-semibold">{user.name}</td><td className="px-4 py-3 capitalize">{user.role.replace('_', ' ')}</td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3 font-mono">{user.staff_id || '—'}</td><td className="px-4 py-3">{user.department}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'STUDENTS' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h2 className="text-sm font-bold text-slate-900">Student directory</h2></div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700"><thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase text-[10px]"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Matric No</th><th className="px-4 py-3">Department</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{users.filter((u) => u.role === 'student').map((user) => <tr key={user.id}><td className="px-4 py-3 font-semibold">{user.name}</td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3 font-mono">{user.matric_no || '—'}</td><td className="px-4 py-3">{user.department}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'COURSES' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h2 className="text-sm font-bold text-slate-900">Course department membership</h2><p className="text-xs text-slate-500 mt-1">A course can belong to multiple departments. Choose “All Departments” for a shared course.</p></div>
            <form onSubmit={createCourse} className="grid grid-cols-1 md:grid-cols-[150px_minmax(180px,1fr)_minmax(220px,1fr)_auto] gap-3 p-5 border-b border-slate-200 items-end">
              <label className="block text-xs font-semibold text-slate-700">Course code<input required value={courseCode} onChange={(event) => setCourseCode(event.target.value.toUpperCase())} placeholder="CSC 101" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" /></label>
              <label className="block text-xs font-semibold text-slate-700">Course title<input required value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="Introduction to Computing" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" /></label>
              <label className="block text-xs font-semibold text-slate-700">Departments<div className="mt-1 space-y-1 border border-slate-300 rounded-lg p-2 max-h-32 overflow-y-auto">{departments.map(({ name }) => (<label key={name} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={courseDepartments.includes(name)} onChange={(e) => setCourseDepartments((prev) => e.target.checked ? [...prev, name] : prev.filter((d) => d !== name))} />{name}</label>))}</div></label>
              <button type="submit" disabled={creatingCourse || !courseDepartments.length} className="px-4 py-2 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50">{creatingCourse ? 'Adding...' : 'Add course'}</button>
            </form>
            <div className="divide-y divide-slate-100">
              {courses.map((course) => (
                <div key={course.id} className="px-5 py-4 grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_minmax(280px,1fr)_auto] gap-4 md:items-start">
                  <div><p className="text-xs font-mono font-bold text-slate-900">{course.code}</p><p className="text-xs text-slate-600 mt-1">{course.title}</p></div>
                  <div className="space-y-1">
                    {departments.map(({ name }) => {
                      const selected = (courseDeptDraft[course.id] ?? course.departments ?? []);
                      return (
                        <label key={name} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={selected.includes(name)} disabled={savingCourse === course.id} onChange={(e) => {
                      const base = courseDeptDraft[course.id] ?? course.departments ?? [];
                      const next = e.target.checked ? [...base, name] : base.filter((d) => d !== name);
                      setCourseDeptDraft((prev) => ({ ...prev, [course.id]: next }));
                      assignCourseDepartments(course.id, next);
                    }} />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                  </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'EVIDENCE' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2"><Paperclip className="w-4 h-4 text-blue-700" /><div><h2 className="text-sm font-bold text-slate-900">Complaint evidence</h2><p className="text-xs text-slate-500 mt-1">Submitted attachments across all departments.</p></div></div>
            <div className="p-5 space-y-3">{complaints.length === 0 ? <p className="text-xs text-slate-500">No complaints are available.</p> : complaints.map((complaint) => <article key={complaint.id} className="border border-slate-200 rounded-lg p-4 space-y-3"><div><h3 className="text-sm font-semibold text-slate-900">Complaint #{complaint.id} · {complaint.course_code}</h3><p className="text-xs text-slate-500">{complaint.student_name || 'Student'} · {new Date(complaint.created_at).toLocaleDateString()}</p><p className="text-sm text-slate-700 mt-2">{complaint.description}</p></div>{complaint.attachments?.length ? <ComplaintAttachments complaintId={complaint.id} attachments={complaint.attachments} /> : <p className="text-xs text-slate-400">No attachment submitted.</p>}</article>)}</div>
          </section>
        )}
      </>}
    </div>
  );
};
