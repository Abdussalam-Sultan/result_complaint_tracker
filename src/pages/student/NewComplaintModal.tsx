import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { uploadComplaintAttachment, validateComplaintAttachment } from '../../api/attachments';
import { Course, IssueType } from '../../types';
import {
  X, AlertTriangle, Upload, CheckSquare, Square,
  HelpCircle, AlertCircle, FileCheck
} from 'lucide-react';

interface NewComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ISSUE_OPTIONS: { type: IssueType; label: string; desc: string }[] = [
  {
    type: 'MISSING_SCORE',
    label: 'Missing Score',
    desc: 'Entire exam or total score is completely absent on the portal sheet.',
  },
  {
    type: 'WRONG_SCORE',
    label: 'Wrong Score Recorded',
    desc: 'Recorded score on the portal differs from what was confirmed/awarded.',
  },
  {
    type: 'WRONG_GRADE',
    label: 'Wrong Letter Grade',
    desc: 'Total score qualifies for a different letter grade (e.g. 64 should be B, but got F).',
  },
  {
    type: 'MISSING_CA',
    label: 'Missing Continuous Assessment (CA)',
    desc: 'Test or quiz score omitted from the 30/40% CA continuous assessment component.',
  },
  {
    type: 'SCRIPT_REMARK_REQUEST',
    label: 'Script Remark Request',
    desc: 'Formal request for the examiner to re-evaluate and remark your physical script.',
  },
  {
    type: 'OTHER',
    label: 'Other / Specific Discrepancy',
    desc: 'Special case not covered by the standard categories above.',
  },
];

export const NewComplaintModal: React.FC<NewComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [selectedIssues, setSelectedIssues] = useState<Record<string, boolean>>({});
  const [claimedScores, setClaimedScores] = useState<Record<string, string>>({});
  const [description, setDescription] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadEnrolledCourses();
      resetForm();
    }
  }, [isOpen]);

  const loadEnrolledCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
      if (res.data.length > 0 && selectedCourseId === '') {
        setSelectedCourseId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Could not load your enrolled courses.');
    }
  };

  const resetForm = () => {
    setSelectedIssues({});
    setClaimedScores({});
    setDescription('');
    setAttachment(null);
    setError(null);
  };

  const toggleIssue = (type: IssueType) => {
    setSelectedIssues((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleScoreChange = (type: IssueType, val: string) => {
    setClaimedScores((prev) => ({
      ...prev,
      [type]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCourseId) {
      setError('Please select an enrolled course.');
      return;
    }

    const activeIssues = Object.keys(selectedIssues).filter((k) => selectedIssues[k]) as IssueType[];
    if (activeIssues.length === 0) {
      setError('Please select at least one issue type.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a brief description of the issue.');
      return;
    }

    if (attachment) {
      try {
        validateComplaintAttachment(attachment);
      } catch (validationError: any) {
        setError(validationError.message);
        return;
      }
    }

    // Build items payload
    const items = [];
    for (const issue of activeIssues) {
      let scoreNum: number | null = null;
      if (claimedScores[issue] && claimedScores[issue].trim() !== '') {
        const parsed = parseFloat(claimedScores[issue]);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
          setError(`Claimed score for ${issue.replace('_', ' ')} must be between 0 and 100.`);
          return;
        }
        scoreNum = parsed;
      }
      items.push({
        issue_type: issue,
        claimed_score: scoreNum,
      });
    }

    setLoading(true);
    let complaintCreated = false;
    try {
      const res = await api.post('/complaints', {
        course_id: Number(selectedCourseId),
        description: description.trim(),
        items,
      });

      const newComplaint = res.data;
      complaintCreated = true;

      // Upload attachment if any
      if (attachment && newComplaint.id) {
        await uploadComplaintAttachment(newComplaint.id, attachment);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (complaintCreated) onSuccess();
      setError(
        (complaintCreated
          ? `Complaint submitted, but the evidence upload failed: ${err.response?.data?.detail || err.message || 'Please try again.'}`
          : err.response?.data?.detail || err.message) ||
        'Failed to submit complaint. Please check your inputs.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002147] text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Log Result Complaint</h3>
            <p className="text-xs text-blue-200">
              Submit your result discrepancy for automated lecturer/HOD review
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Enrolled Course Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Select Enrolled Course <span className="text-rose-500">*</span>
            </label>
            {courses.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No enrolled courses found for this session.</p>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.title} ({c.lecturer_name || 'HOD Direct Route'})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              You can only log complaints for courses you are officially registered for.
            </p>
          </div>

          {/* Issue Types Checklist (Multi-Issue Support) */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Complaint Issues <span className="text-rose-500">*</span>
              <span className="text-slate-400 font-normal lowercase ml-1">
                (select all that apply to this course)
              </span>
            </label>

            <div className="space-y-2.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              {ISSUE_OPTIONS.map((opt) => {
                const isChecked = !!selectedIssues[opt.type];
                return (
                  <div
                    key={opt.type}
                    onClick={() => toggleIssue(opt.type)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                      isChecked
                        ? 'bg-blue-50/70 border-blue-400 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          className="text-blue-600 cursor-pointer focus:outline-hidden"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-blue-700" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <span className="text-sm font-semibold text-slate-800">
                            {opt.label}
                          </span>
                          <p className="text-xs text-slate-500">{opt.desc}</p>
                        </div>
                      </div>
                    </div>

                    {/* Claimed Score input if checked */}
                    {isChecked && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 pt-2 border-t border-blue-200/60 flex items-center gap-3"
                      >
                        <label className="text-xs font-medium text-blue-900 shrink-0">
                          Claimed Score (0-100, optional):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="e.g. 65"
                          value={claimedScores[opt.type] || ''}
                          onChange={(e) => handleScoreChange(opt.type, e.target.value)}
                          className="w-28 px-2.5 py-1 text-xs bg-white border border-blue-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Detailed Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State what you observed, your seat number/exam center, or details of test submission..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
              required
            />
          </div>

          {/* Evidence Attachment */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Evidence / Score Slip Screenshot (Optional)
            </label>
            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-700 font-medium block">
                    {attachment ? attachment.name : 'Upload exam card, portal screenshot, or test script'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PNG, JPG, PDF up to 15MB
                  </span>
                </div>
              </div>
              <div>
                <label className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-medium text-slate-700 cursor-pointer shadow-2xs">
                  Browse
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setError(null);
                        setAttachment(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-[#002147] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            {loading ? 'Submitting Complaint...' : 'Submit Result Complaint'}
          </button>
        </div>
      </div>
    </div>
  );
};
