import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Complaint, IssueGroup, ComplaintItem, Course } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { TimelineView } from '../../components/TimelineView';
import { ComplaintAttachments } from '../../components/ComplaintAttachments';
import {
  Users, Layers, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, ShieldAlert, ArrowRight, RefreshCw, Filter,
  UserMinus, MessageSquare, Search, ChevronRight, X
} from 'lucide-react';

export const PartAdvisorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<IssueGroup[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [activeGroup, setActiveGroup] = useState<IssueGroup | null>(null);
  const [activeItem, setActiveItem] = useState<ComplaintItem | null>(null);

  // Action form state
  const [actionType, setActionType] = useState<string>('RESOLVE');
  const [actionNote, setActionNote] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, groupsRes, compsRes] = await Promise.all([
        api.get('/courses'),
        api.get('/groups'),
        api.get('/complaints'),
      ]);
      setCourses(coursesRes.data);
      setGroups(groupsRes.data);
      setComplaints(compsRes.data);
    } catch (err) {
      console.error('Error fetching part-advisor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Bulk action on active group
  const handleBulkAction = async () => {
    if (!activeGroup) return;
    if (!actionNote.trim()) {
      setActionError('A required note/explanation must be entered for all affected students.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/groups/${activeGroup.id}/bulk-action`, {
        action: actionType,
        note: actionNote.trim(),
      });
      setActiveGroup(null);
      setActionNote('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Failed to execute bulk action.');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove single student from group
  const handleRemoveStudentFromGroup = async (groupId: number, itemId: number) => {
    try {
      await api.post(`/groups/${groupId}/remove-student/${itemId}`);
      // Refresh current group modal & data
      const updatedGroup = await api.get(`/groups/${groupId}`);
      setActiveGroup(updatedGroup.data);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Could not remove student from group.');
    }
  };

  // Action on single item
  const handleIndividualAction = async () => {
    if (!activeItem) return;
    if (['REJECT', 'REQUEST_INFO'].includes(actionType) && !actionNote.trim()) {
      setActionError(`A note is strictly required when performing ${actionType}.`);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/items/${activeItem.id}/action`, {
        action: actionType,
        note: actionNote.trim() || `Status updated to ${actionType} by part advisor.`,
      });
      setActiveItem(null);
      setActionNote('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionError(err.response?.data?.detail || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Extract individual items from complaints
  const allItems: ComplaintItem[] = [];
  complaints.forEach((c) => {
    c.items.forEach((item) => {
      allItems.push({
        ...item,
        student_name: c.student_name,
        matric_no: c.matric_no,
        description: c.description,
        course_code: c.course_code,
        course_title: c.course_title,
      });
    });
  });

  const filteredItems = allItems.filter((item) => {
    if (courseFilter !== 'ALL' && item.course_code !== courseFilter) return false;
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.student_name?.toLowerCase().includes(q);
      const matchMatric = item.matric_no?.toLowerCase().includes(q);
      const matchIssue = item.issue_type.toLowerCase().includes(q);
      if (!matchName && !matchMatric && !matchIssue) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-[#002147] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-blue-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/40">
            <span>Part Advisor Result Portal</span>
            <span>•</span>
            <span>{courses.length} Assigned Course(s)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {user?.name}
          </h1>
          <p className="text-sm text-blue-200">
            Courses:{' '}
            {courses.length > 0
              ? courses.map((c) => c.code).join(', ')
              : 'No assigned courses yet'}
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-medium border border-blue-700/60 shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Total Assigned Courses</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {courses.length}
          </span>
          <span className="text-[11px] text-slate-400">Harmattan Semester</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Mass Issue Clusters</span>
          <span className="text-2xl font-bold text-blue-700 mt-1 block">
            {groups.length}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">Auto-grouped cards</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Open Complaint Items</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {allItems.filter((i) => ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO'].includes(i.status)).length}
          </span>
          <span className="text-[11px] text-amber-600">Pending part-advisor action</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Resolved Items</span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">
            {allItems.filter((i) => i.status === 'RESOLVED').length}
          </span>
          <span className="text-[11px] text-emerald-600">Score sheets amended</span>
        </div>
      </div>

      {/* SECTION 1: Mass Complaint Groups (Crucial Requirement) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-700" />
              Mass Complaint Clusters (Grouped Issues)
            </h2>
            <p className="text-xs text-slate-500">
              When multiple students log the same issue on a course, they are clustered into one card for bulk resolution.
            </p>
          </div>
          <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            {groups.length} Cluster{groups.length !== 1 ? 's' : ''}
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 text-sm">
            No mass complaint clusters detected on your assigned courses.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((group) => {
              const isResolved = group.status === 'RESOLVED';
              return (
                <div
                  key={group.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isResolved
                      ? 'border-emerald-200 bg-emerald-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold bg-[#002147] text-white px-2 py-0.5 rounded">
                        {group.course_code}
                      </span>
                      <StatusBadge status={group.status} size="sm" />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {group.issue_type.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {group.title}
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-700" />
                        <div>
                          <span className="text-base font-extrabold text-blue-950 block leading-tight">
                            {group.student_count}
                          </span>
                          <span className="text-[10px] text-blue-800 uppercase tracking-wider font-semibold">
                            Affected Students
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <span>Group #{group.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-400">
                      Created: {new Date(group.created_at).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => {
                        setActiveGroup(group);
                        setActionType('RESOLVE');
                        setActionNote('');
                        setActionError(null);
                      }}
                      className="px-3 py-1.5 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Review Group</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: All Complaints & Individual Items */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-0">
        <div className="p-5 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Individual Complaint Items & Submissions
            </h2>
            <p className="text-xs text-slate-500">
              Examine student score claims, update status with required audit notes, or isolate individual issues
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search matric or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-44 sm:w-52"
              />
            </div>

            {/* Course Dropdown */}
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All My Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="NEEDS_INFO">Needs Info</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Student & Matric</th>
                <th className="px-5 py-3">Course</th>
                <th className="px-5 py-3">Issue Type</th>
                <th className="px-5 py-3">Claimed</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Cluster</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No complaint items matching the filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item);
                      setActionType('RESOLVE');
                      setActionNote('');
                      setActionError(null);
                    }}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    title="Open complaint review"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-900 block text-xs">
                        {item.student_name || 'Student'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.matric_no || 'N/A'}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {item.course_code}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-800">
                        {item.issue_type.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-blue-700">
                      {item.claimed_score !== null && item.claimed_score !== undefined
                        ? `${item.claimed_score} marks`
                        : '—'}
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusBadge status={item.status} size="sm" />
                    </td>

                    <td className="px-5 py-3.5">
                      {item.group_id ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">
                          Group #{item.group_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Individual</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setActionType('RESOLVE');
                          setActionNote('');
                          setActionError(null);
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-[#002147] hover:text-white border border-slate-300 rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        Review Item
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Group Detail & Bulk Action Modal */}
      {activeGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 bg-[#002147] text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                    Group #{activeGroup.id}
                  </span>
                  <h3 className="font-bold text-lg">
                    {activeGroup.course_code}: {activeGroup.issue_type.replace(/_/g, ' ')}
                  </h3>
                </div>
                <p className="text-xs text-blue-200 mt-0.5">
                  Mass Complaint Cluster • {activeGroup.items.length} Affected Students
                </p>
              </div>
              <button
                onClick={() => setActiveGroup(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Bulk Action Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-700" />
                    Atomic Bulk Action for all {activeGroup.items.length} Students
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    One note is written to all individual student timelines
                  </span>
                </div>

                {actionError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                    {actionError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'RESOLVE', label: 'Bulk Resolve', color: 'hover:bg-emerald-600' },
                    { id: 'REQUEST_INFO', label: 'Ask Info from All', color: 'hover:bg-amber-600' },
                    { id: 'REJECT', label: 'Bulk Reject (Reason Required)', color: 'hover:bg-rose-600' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setActionType(btn.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        actionType === btn.id
                          ? 'bg-[#002147] text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Part Advisor's Explanation / Resolution Note <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="e.g. Continuous assessment records located with course rep; updated mark of 24 awarded and portal score amended."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleBulkAction}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {actionLoading ? 'Processing Bulk Action...' : `Execute Bulk ${actionType}`}
                  </button>
                </div>
              </div>

              {/* Affected Students List with Isolate/Remove Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                    Affected Students in this Cluster
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Use "Remove" if a student's case requires distinct individual investigation
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Student Name</th>
                        <th className="px-4 py-2.5">Matric No</th>
                        <th className="px-4 py-2.5">Claimed Score</th>
                        <th className="px-4 py-2.5">Item Status</th>
                        <th className="px-4 py-2.5 text-right">Individual Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeGroup.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {item.student_name}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-500">
                            {item.matric_no}
                          </td>
                          <td className="px-4 py-2.5 text-blue-700 font-semibold">
                            {item.claimed_score !== null && item.claimed_score !== undefined
                              ? `${item.claimed_score}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={item.status} size="sm" />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() =>
                                handleRemoveStudentFromGroup(activeGroup.id, item.id)
                              }
                              className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                              title="Detach from group to investigate separately"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Remove from Group</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveGroup(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Individual Item Review Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-[#002147] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {activeItem.course_code}: {activeItem.issue_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-blue-200">
                  Student: {activeItem.student_name} ({activeItem.matric_no})
                </p>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
                  Student Statement
                </h4>
                <p className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 whitespace-pre-wrap">
                  {activeItem.description || 'No statement provided.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
                  Student Evidence
                </h4>
                <ComplaintAttachments complaintId={activeItem.complaint_id} />
              </section>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Current Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={activeItem.status} size="md" />
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Claimed Score
                  </span>
                  <span className="text-sm font-extrabold text-blue-800">
                    {activeItem.claimed_score !== null && activeItem.claimed_score !== undefined
                      ? `${activeItem.claimed_score} marks`
                      : 'Not stated'}
                  </span>
                </div>
              </div>

              {/* Action Selector */}
              <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                <span className="text-xs font-bold uppercase text-slate-700 tracking-wider block">
                  Select Action to Perform
                </span>

                {actionError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
                    {actionError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'REVIEW', label: 'Mark Under Review' },
                    { id: 'RESOLVE', label: 'Resolve Complaint' },
                    { id: 'REQUEST_INFO', label: 'Request Info' },
                    { id: 'REJECT', label: 'Reject' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActionType(act.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        actionType === act.id
                          ? 'bg-[#002147] text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Audit Note / Explanation (Required for Reject & Request Info):
                  </label>
                  <textarea
                    rows={3}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Provide context or instructions for the student..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleIndividualAction}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : `Apply ${actionType}`}
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider mb-2">
                  Chronological Item Audit
                </h4>
                <TimelineView events={activeItem.timeline} />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
