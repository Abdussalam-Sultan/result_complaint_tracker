import React, { useState } from 'react';
import api from '../../api/client';
import { Complaint, ComplaintItem } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { TimelineView } from '../../components/TimelineView';
import { ComplaintAttachments } from '../../components/ComplaintAttachments';
import {
  X, MessageSquare, AlertTriangle, RotateCcw,
  Ban, Paperclip, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'REPLY' | 'REOPEN' | 'WITHDRAW' | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !complaint) return null;

  const handleActionSubmit = async () => {
    if (!selectedItemId || !actionType) return;
    setError(null);
    setLoading(true);

    try {
      if (actionType === 'REPLY') {
        if (!noteText.trim()) {
          setError('Please provide clarification details.');
          setLoading(false);
          return;
        }
        await api.post(`/items/${selectedItemId}/reply`, {
          reply_note: noteText.trim(),
        });
      } else if (actionType === 'REOPEN') {
        if (!noteText.trim()) {
          setError('Justification is required to dispute this rejection.');
          setLoading(false);
          return;
        }
        await api.post(`/items/${selectedItemId}/reopen`, {
          justification: noteText.trim(),
        });
      } else if (actionType === 'WITHDRAW') {
        await api.post(`/items/${selectedItemId}/withdraw`);
      }

      setActionType(null);
      setNoteText('');
      setSelectedItemId(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002147] text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                #{complaint.id}
              </span>
              <h3 className="font-bold text-lg">
                {complaint.course_code}: {complaint.course_title}
              </h3>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">
              Logged on {new Date(complaint.created_at).toLocaleDateString('en-NG', { dateStyle: 'long' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Overall Summary Bar */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider block">
                Overall Complaint Status
              </span>
              <div className="mt-1">
                <StatusBadge status={complaint.overall_status} size="lg" />
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider block">
                Total Items Tracked
              </span>
              <span className="text-base font-bold text-slate-800">
                {complaint.items?.length || 0} issue component(s)
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-600 mb-1 tracking-wider">
              Student Statement
            </h4>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed">
              {complaint.description}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-600 mb-1.5 tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Submitted Evidence
            </h4>
            <ComplaintAttachments
              complaintId={complaint.id}
              attachments={complaint.attachments || []}
              allowUpload
              onUploaded={onRefresh}
            />
          </div>

          {/* Issue Items Breakdown */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
              Issue Components & Action Timeline
            </h4>

            {complaint.items.map((item: ComplaintItem, idx: number) => {
              const canReply = item.status === 'NEEDS_INFO';
              const canReopen = item.status === 'REJECTED' && item.reopen_count === 0 && !item.reopened;
              const isFinalRejected = item.status === 'REJECTED' && (item.reopen_count >= 1 || item.reopened);
              const canWithdraw = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO'].includes(item.status);

              return (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          {item.issue_type.replace(/_/g, ' ')}
                        </span>
                        {item.claimed_score !== null && item.claimed_score !== undefined && (
                          <span className="ml-2 text-xs text-blue-600 font-medium">
                            (Claimed: {item.claimed_score} marks)
                          </span>
                        )}
                        {item.group_id && (
                          <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            Part of Mass Cluster #{item.group_id}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} size="md" />
                      {item.assigned_to_role === 'hod' && (
                        <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded border border-purple-200">
                          HOD Direct Queue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Student Action Triggers */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {canReply && (
                      <button
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActionType('REPLY');
                          setNoteText('');
                          setError(null);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Reply to Lecturer's Request
                      </button>
                    )}

                    {canReopen && (
                      <button
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActionType('REOPEN');
                          setNoteText('');
                          setError(null);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Dispute Rejection (Escalate to HOD)
                      </button>
                    )}

                    {isFinalRejected && (
                      <span className="text-xs text-slate-400 italic">
                        Rejection final (policy limit: 1 dispute allowed).
                      </span>
                    )}

                    {canWithdraw && (
                      <button
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActionType('WITHDRAW');
                          setError(null);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Withdraw Item
                      </button>
                    )}
                  </div>

                  {/* Action Input Form if this item is selected */}
                  {selectedItemId === item.id && actionType && (
                    <div className="p-4 bg-slate-50 border border-blue-200 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {actionType === 'REPLY'
                            ? 'Provide Requested Information'
                            : actionType === 'REOPEN'
                            ? 'Dispute Rejection & Escalate to HOD'
                            : 'Confirm Voluntary Withdrawal'}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedItemId(null);
                            setActionType(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {error && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
                          {error}
                        </div>
                      )}

                      {actionType !== 'WITHDRAW' ? (
                        <div>
                          <textarea
                            rows={3}
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={
                              actionType === 'REPLY'
                                ? 'State the exact test dates, submission details, or matric number clarifications...'
                                : 'Explain why the rejection is incorrect with specific academic evidence for the HOD panel...'
                            }
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">
                          Are you sure you want to withdraw this complaint item? This action will close the issue.
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedItemId(null);
                            setActionType(null);
                          }}
                          className="px-3 py-1 bg-white border border-slate-300 rounded text-xs text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleActionSubmit}
                          disabled={loading}
                          className="px-4 py-1.5 bg-[#002147] hover:bg-blue-900 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? 'Submitting...' : 'Confirm & Submit'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Timeline */}
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider block mb-2">
                      Item Audit Timeline
                    </span>
                    <TimelineView events={item.timeline} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Obafemi Awolowo University Result Tracking Portal
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
