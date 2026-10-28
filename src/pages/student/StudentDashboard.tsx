import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Complaint, Course } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { NewComplaintModal } from './NewComplaintModal';
import { ComplaintDetailModal } from './ComplaintDetailModal';
import {
  PlusCircle, BookOpen, Clock, AlertCircle, FileText,
  ChevronRight, RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [advisor, setAdvisor] = useState<{ name: string; email: string; staff_id?: string | null; department: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [compsRes, coursesRes, advisorRes] = await Promise.all([
        api.get('/complaints'),
        api.get('/courses'),
        api.get('/auth/advisor'),
      ]);
      setComplaints(compsRes.data);
      setEnrolledCourses(coursesRes.data);
      setAdvisor(advisorRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTION_REQUIRED') return c.overall_status.includes('ACTION REQUIRED') || c.overall_status.includes('NEEDS_INFO');
    if (statusFilter === 'RESOLVED') return c.overall_status.includes('RESOLVED');
    if (statusFilter === 'OPEN') return !c.overall_status.includes('RESOLVED') && !c.overall_status.includes('CLOSED');
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#002147] via-[#0B2E59] to-[#002147] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-blue-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name}
          </h1>
          <p className="text-sm text-blue-200">
            Matriculation Number:{' '}
            <span className="font-mono font-bold text-amber-300">{user?.matric_no}</span>{' '}
            | {user?.department}
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Log Result Complaint</span>
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Registered Courses</h2>
              <p className="text-xs text-slate-500 mt-1">{enrolledCourses.length} courses in your current registration</p>
            </div>
            <BookOpen className="w-5 h-5 text-blue-700" />
          </div>
          {enrolledCourses.length ? (
            <ul className="divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:divide-y-0">
              {enrolledCourses.map((course) => (
                <li key={course.id} className="px-5 py-3 border-b border-slate-100 sm:border-r">
                  <span className="font-mono text-xs font-bold text-slate-900">{course.code}</span>
                  <p className="text-xs text-slate-600 mt-1">{course.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{course.session} · {course.semester}</p>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-6 text-xs text-slate-500">No registered courses were found.</p>}
        </div>

        <aside className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900">Your Part Advisor</h2>
          <p className="text-xs text-slate-500 mt-1">{user?.department}</p>
          {advisor ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-900">{advisor.name}</p>
              <a className="block text-xs text-blue-700 hover:underline break-all" href={`mailto:${advisor.email}`}>{advisor.email}</a>
              
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">No part advisor is assigned yet. Contact the faculty admin.</p>}
        </aside>
      </section>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Enrolled Courses</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {enrolledCourses.length}
          </span>
          <span className="text-[11px] text-slate-400">Harmattan Semester</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Complaints Lodged</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {complaints.length}
          </span>
          <span className="text-[11px] text-blue-600">Tracked in system</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Action Required</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {complaints.filter((c) => c.overall_status.includes('ACTION REQUIRED')).length}
          </span>
          <span className="text-[11px] text-amber-600 font-medium">Needs your reply</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Resolved Result(s)</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {complaints.filter((c) => c.overall_status.includes('RESOLVED')).length}
          </span>
          <span className="text-[11px] text-emerald-600">Updated on portal</span>
        </div>
      </div>

      {/* Main Complaints List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Result Complaints</h2>
            <p className="text-xs text-slate-500">
              Live status tracking for your submitted result complaints
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium text-slate-700">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'OPEN', label: 'Active' },
                { id: 'ACTION_REQUIRED', label: 'Needs Reply' },
                { id: 'RESOLVED', label: 'Resolved' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Complaints Listing */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading complaint history...
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-semibold text-slate-800">
              No result complaints found
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              If you have missing scores, computation errors, or omitted continuous assessments, click the button below to submit a tracked complaint.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002147] text-white text-xs font-semibold rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Log a Complaint Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredComplaints.map((c) => {
              const dateStr = new Date(c.created_at).toLocaleDateString('en-NG', {
                dateStyle: 'medium',
              });

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedComplaint(c)}
                  className="p-5 sm:px-6 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  {/* Left Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold bg-[#002147] text-white px-2 py-0.5 rounded shadow-2xs">
                        #{c.id}
                      </span>
                      <span className="font-bold text-base text-slate-900 group-hover:text-blue-900 transition-colors">
                        {c.course_code}: {c.course_title}
                      </span>
                      <StatusBadge status={c.overall_status} size="sm" />
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1">
                      {c.description}
                    </p>

                    {/* Items chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {c.items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 border border-slate-200 text-slate-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>{item.issue_type.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-500">({item.status})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Status & Meta */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-slate-400 block flex items-center md:justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {dateStr}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {c.items.length} issue item{c.items.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-800 text-slate-400 flex items-center justify-center transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <NewComplaintModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />

      <ComplaintDetailModal
        complaint={selectedComplaint}
        isOpen={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        onRefresh={() => {
          fetchData();
          if (selectedComplaint) {
            // refresh active modal view
            api.get(`/complaints/${selectedComplaint.id}`).then((res) => {
              setSelectedComplaint(res.data);
            });
          }
        }}
      />
    </div>
  );
};
