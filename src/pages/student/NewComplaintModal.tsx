import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { uploadComplaintAttachment, validateComplaintAttachment } from '../../api/attachments';
import { Course, IssueType } from '../../types';
import {
  X, AlertTriangle, Upload, CheckSquare, Square, Trash2,
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
  const [description, setDescription] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
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
    setDescription('');
    setAttachments([]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    setError(null);
  };

  const toggleIssue = (type: IssueType) => {
    setSelectedIssues((prev) => ({
      ...prev,
      [type]: !prev[type],
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

    for (const attachment of attachments) {
      try {
        validateComplaintAttachment(attachment);
      } catch (validationError: any) {
        setError(`${attachment.name}: ${validationError.message}`);
        return;
      }
    }

    // Build items payload
    const items = activeIssues.map((issue) => ({ issue_type: issue }));

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

      // Upload each evidence file after the complaint has been created.
      if (newComplaint.id) {
        for (const attachment of attachments) {
          await uploadComplaintAttachment(newComplaint.id, attachment);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (complaintCreated) onSuccess();
      setError(
        (complaintCreated
          ? `Complaint submitted, but one or more evidence files failed to upload: ${err.response?.data?.detail || err.message || 'Please try again.'}`
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
              Submit your result discrepancy for review by your department part advisor
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

          {/* Department course picker */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Select Department Course <span className="text-rose-500">*</span>
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
                    {c.code}: {c.title}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Courses assigned to your department and shared faculty courses appear here.
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
            <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Upload className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs text-slate-700 font-medium block">
                      {attachments.length > 0
                        ? `${attachments.length} evidence file${attachments.length === 1 ? '' : 's'} selected`
                        : 'Add exam card, portal screenshots, or test scripts'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      PNG, JPG, or PDF. Each file up to 15MB.
                    </span>
                  </div>
                </div>
                <label className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-medium text-slate-700 cursor-pointer shadow-2xs shrink-0">
                  Add files
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.currentTarget.files ?? []);
                      if (selectedFiles.length > 0) {
                        setError(null);
                        setAttachments((current) => {
                          const existingFiles = new Set(
                            current.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
                          );
                          return [
                            ...current,
                            ...selectedFiles.filter((file) => {
                              const key = `${file.name}:${file.size}:${file.lastModified}`;
                              if (existingFiles.has(key)) return false;
                              existingFiles.add(key);
                              return true;
                            }),
                          ];
                        });
                      }
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              {attachments.length > 0 && (
                <ul className="space-y-2 border-t border-slate-200 pt-3">
                  {attachments.map((attachment, index) => (
                    <li
                      key={`${attachment.name}:${attachment.size}:${attachment.lastModified}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate text-slate-700" title={attachment.name}>
                        {attachment.name}
                        <span className="ml-2 text-[10px] text-slate-400">
                          {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        aria-label={`Remove ${attachment.name}`}
                        title="Remove file"
                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
