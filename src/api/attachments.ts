import api from './client';
import { Attachment } from '../types';

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function validateComplaintAttachment(file: File): void {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Evidence files must be between 1 byte and 15 MB.');
  }
  if (ALLOWED_ATTACHMENT_TYPES[extension] !== file.type.toLowerCase()) {
    throw new Error('Evidence must be a PDF, PNG, or JPEG file.');
  }
}

export async function uploadComplaintAttachment(
  complaintId: number,
  file: File
): Promise<Attachment> {
  validateComplaintAttachment(file);
  const metadata = {
    filename: file.name,
    size: file.size,
    content_type: file.type,
  };
  const prepared = await api.post(
    `/complaints/${complaintId}/attachment/prepare`,
    metadata
  );
  const uploadResponse = await fetch(prepared.data.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Supabase upload failed with HTTP ${uploadResponse.status}.`);
  }
  const completed = await api.post(
    `/complaints/${complaintId}/attachment/complete`,
    { ...metadata, path: prepared.data.path }
  );
  return completed.data;
}
