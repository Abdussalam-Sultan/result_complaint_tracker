import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { DepartmentStats, ComplaintItem, Course } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { TimelineView } from '../../components/TimelineView';
import { ComplaintAttachments } from '../../components/ComplaintAttachments';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ShieldAlert, CheckCircle2, Clock, AlertTriangle, Layers,
  TrendingUp, Award, AlertCircle, RefreshCw, X, Shield, ChevronRight
} from 'lucide-react';

const COLORS = ['#002147', '#E5A823', '#2563EB', '#10B981', '#EF4444', '#8B5CF6'];

export const HodDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [escalatedItems, setEscalatedItems] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active review item
  const [selectedItem, setSelectedItem] = useState<ComplaintItem | null>(null);
  const [actionDecision, setActionDecision] = useState<'RESOLVE' | 'REJECT'>('RESOLVE');
  const [hodNote, setHodNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHodData = async () => {
    setLoading(true);
    try {
      const [statsRes, complaintsRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/complaints'),
      ]);
      setStats(statsRes.data);

      // Extract all escalated items
      const esc: ComplaintItem[] = [];
      complaintsRes.data.forEach((c: any) => {
        c.items.forEach((it: ComplaintItem) => {
          if (it.status === 'ESCALATED' || it.assigned_to_role === 'hod') {
            esc.push({
              ...it,
              student_name: c.student_name,
              matric_no: c.matric_no,
              course_code: c.course_code,
              course_title: c.course_title,
            });
          }
        });
      });
      setEscalatedItems(esc);
    } catch (err) {
      console.error('Error fetching HOD data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHodData();
  }, [user]);

  const handleHodAction = async () => {
    if (!selectedItem) return;
    if (!hodNote.trim()) {
      setErrorMsg('An executive resolution note or reason is required by the HOD.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await api.post(`/items/${selectedItem.id}/action`, {
        action: actionDecision === 'OVERRIDE' ? 'OVERRIDE' : actionDecision,
        note: `[HOD Decision] ${hodNote.trim()}`,
      });
      setSelectedItem(null);
      setHodNote('');
      fetchHodData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'HOD action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-16 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-900" />
        <span>Loading Departmental Oversight Analytics...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-[#002147] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-blue-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/40">
            <Shield className="w-3.5 h-3.5" />
            <span>Head of Department Executive Portal</span>
            <span>•</span>
            <span>OAU Faculty of Technology</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {user?.name || 'Prof. Olumide Adeleke'}
          </h1>
          <p className="text-sm text-blue-200">
            Department of Computer Science & Engineering • Department-wide Result Oversight
          </p>
        </div>

        <button
          onClick={fetchHodData}
          className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-medium border border-blue-700/60 shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Department Metrics</span>
        </button>
      </div>

      {/* Unassigned Course Warning Banner */}
      {stats?.courses_without_lecturers && stats.courses_without_lecturers.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block">
                Unassigned Courses Alert (Complaints Route Directly to HOD):
              </span>
              <p className="text-xs text-amber-800 mt-0.5">
                The following courses currently lack an assigned lecturer:{' '}
                <span className="font-semibold">
                  {stats.courses_without_lecturers.map((c) => `${c.code} (${c.title})`).join(', ')}
                </span>
                . Any complaint filed by students on these courses will be queued immediately in the HOD portal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Total Complaints</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {stats?.total_complaints || 0}
          </span>
          <span className="text-[11px] text-slate-400">
            {stats?.total_items || 0} issue items
          </span>
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-4 shadow-2xs bg-red-50/20">
          <span className="text-xs text-red-700 font-semibold block flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Escalated to HOD
          </span>
          <span className="text-2xl font-extrabold text-red-900 mt-1 block">
            {stats?.escalated_count || 0}
          </span>
          <span className="text-[11px] text-red-600 font-medium">Requires executive decision</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Pending with Lecturers</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {stats?.pending_count || 0}
          </span>
          <span className="text-[11px] text-amber-600">Active reviews</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Resolved Results</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {stats?.resolved_count || 0}
          </span>
          <span className="text-[11px] text-emerald-600">Amended & certified</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Avg Resolution Time</span>
          <span className="text-2xl font-bold text-blue-900 mt-1 block">
            {stats?.avg_resolution_hours || 0} <span className="text-sm font-normal text-slate-500">hrs</span>
          </span>
          <span className="text-[11px] text-blue-700 font-medium">SLA Performance</span>
        </div>
      </div>

      {/* SECTION 1: Escalated Queue (Primary HOD Focus) */}
      <div className="bg-white border border-red-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:px-6 bg-red-50/60 border-b border-red-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-red-950">
                Escalated Complaints Queue ({escalatedItems.length})
              </h2>
              <p className="text-xs text-red-800">
                Issues escalated due to lecturer inactivity (&gt;7 days), student rejection disputes, or unassigned courses
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Course</th>
                <th className="px-5 py-3">Issue Type</th>
                <th className="px-5 py-3">Claimed</th>
                <th className="px-5 py-3">Escalation Reason / Status</th>
                <th className="px-5 py-3 text-right">Executive Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {escalatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No escalated complaints pending in the HOD queue.
                  </td>
                </tr>
              ) : (
                escalatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-red-50/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-900 block text-xs">
                        {item.student_name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.matric_no}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {item.course_code}
                    </td>

                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {item.issue_type.replace(/_/g, ' ')}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-blue-700">
                      {item.claimed_score !== null && item.claimed_score !== undefined
                        ? `${item.claimed_score} marks`
                        : '—'}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} size="sm" />
                        {item.reopened && (
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold border border-purple-200">
                            Student Disputed
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setActionDecision('RESOLVE');
                          setHodNote('');
                          setErrorMsg(null);
                        }}
                        className="px-3.5 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        Decide Escalation
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Analytics & Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Complaints Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Complaints Volume by Course
            </h3>
            <span className="text-xs text-slate-400">Total vs Resolved</span>
          </div>

          <div className="h-64 w-full">
            {stats?.by_course && stats.by_course.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.by_course} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total Complaints" fill="#002147" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="escalated" name="Escalated to HOD" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No course data available
              </div>
            )}
          </div>
        </div>

        {/* Issue Types Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Complaint Types Distribution
            </h3>
            <span className="text-xs text-slate-400">By Issue Category</span>
          </div>

          <div className="h-64 w-full">
            {stats?.by_issue_type && stats.by_issue_type.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.by_issue_type}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    label={(entry: any) => `${entry.label || entry.name || ''}: ${entry.value}`}
                  >
                    {stats.by_issue_type.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No issue distribution data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Oldest Unresolved Complaints */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Oldest Unresolved Complaints (SLA Inactivity Watchlist)
            </h3>
            <p className="text-xs text-slate-500">
              Complaints open the longest without completion. HOD can exercise executive override anytime.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
              <tr>
                <th className="px-5 py-3">Days Open</th>
                <th className="px-5 py-3">Course</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Issue</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">HOD Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.oldest_unresolved?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-xs ${
                        (item.days_open || 0) >= 7
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.days_open || 0} days
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    {item.course_code}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-slate-800 block">
                      {item.student_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.matric_no}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {item.issue_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} size="sm" />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActionDecision('RESOLVE');
                        setHodNote('');
                        setErrorMsg(null);
                      }}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded font-semibold text-xs cursor-pointer transition-colors"
                    >
                      Review Case
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HOD Decision Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-[#002147] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  Executive Decision: {selectedItem.course_code}
                </h3>
                <p className="text-xs text-blue-200">
                  Student: {selectedItem.student_name} ({selectedItem.matric_no}) • {selectedItem.issue_type.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
                  Student Evidence
                </h4>
                <ComplaintAttachments complaintId={selectedItem.complaint_id} />
              </section>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* Decision Choice */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
                  Head of Department Ruling:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionDecision('RESOLVE')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      actionDecision === 'RESOLVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Resolve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionDecision('REJECT')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      actionDecision === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Final Rejection</span>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Official HOD Minute / Decision Note <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  value={hodNote}
                  onChange={(e) => setHodNote(e.target.value)}
                  placeholder="Record department board justification and directed score correction..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider mb-2">
                  Complaint History
                </h4>
                <TimelineView events={selectedItem.timeline} />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleHodAction}
                disabled={submitting}
                className="px-5 py-2 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Executing Ruling...' : 'Enforce HOD Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
