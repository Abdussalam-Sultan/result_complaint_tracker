import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { uploadComplaintAttachment } from '../api/attachments';
import { Attachment } from '../types';
import { ExternalLink, Paperclip, Upload } from 'lucide-react';

interface ComplaintAttachmentsProps {
  complaintId: number;
  attachments?: Attachment[];
  allowUpload?: boolean;
  onUploaded?: () => void;
}

export const ComplaintAttachments: React.FC<ComplaintAttachmentsProps> = ({
  complaintId,
  attachments: initialAttachments,
  allowUpload = false,
  onUploaded,
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments || []);
  const [loading, setLoading] = useState(initialAttachments === undefined);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAttachments !== undefined) {
      setAttachments(initialAttachments);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api.get(`/complaints/${complaintId}`)
      .then((response) => {
        if (!cancelled) setAttachments(response.data.attachments || []);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.response?.data?.detail || 'Could not load complaint attachments.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [complaintId, initialAttachments]);

  const openAttachment = async (attachment: Attachment) => {
    setOpeningId(attachment.id);
    setError(null);
    try {
      const response = await api.get(
        `/complaints/${complaintId}/attachments/${attachment.id}/download`
      );
      window.location.assign(response.data.url);
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.detail || 'Could not open this attachment. Please try again.'
      );
    } finally {
      setOpeningId(null);
    }
  };

  const uploadAttachment = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const attachment = await uploadComplaintAttachment(complaintId, selectedFile);
      setAttachments((current) => [...current, attachment]);
      setSelectedFile(null);
      onUploaded?.();
    } catch (uploadRequestError: any) {
      setUploadError(
        uploadRequestError.response?.data?.detail ||
        uploadRequestError.message ||
        'Could not upload evidence. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-500">Loading submitted evidence...</p>;
  }

  if (attachments.length === 0 && !allowUpload) {
    return initialAttachments === undefined && error ? (
      <p role="alert" className="text-xs text-rose-700">{error}</p>
    ) : null;
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => openAttachment(attachment)}
              disabled={openingId === attachment.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 transition-colors disabled:opacity-60"
            >
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
              <span>{openingId === attachment.id ? 'Opening...' : attachment.filename}</span>
              <span className="text-[10px] text-blue-500">
                ({Math.round(attachment.file_size / 1024)} KB)
              </span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {allowUpload && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 cursor-pointer hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5" />
            {selectedFile?.name || 'Choose evidence file'}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="sr-only"
              onChange={(event) => {
                setUploadError(null);
                setSelectedFile(event.target.files?.[0] || null);
                event.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            onClick={uploadAttachment}
            disabled={!selectedFile || uploading}
            className="px-3 py-1.5 bg-[#002147] text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload evidence'}
          </button>
          {uploadError && <p role="alert" className="w-full text-xs text-rose-700">{uploadError}</p>}
        </div>
      )}
    </div>
  );
};
