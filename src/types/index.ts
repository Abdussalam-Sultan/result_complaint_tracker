export type UserRole = 'student' | 'lecturer' | 'hod' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  matric_no?: string | null;
  department?: string;
  created_at?: string;
}

export type IssueType =
  | 'MISSING_SCORE'
  | 'WRONG_SCORE'
  | 'WRONG_GRADE'
  | 'MISSING_CA'
  | 'SCRIPT_REMARK_REQUEST'
  | 'OTHER';

export type ItemStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_INFO'
  | 'RESOLVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'WITHDRAWN';

export interface Course {
  id: number;
  code: string;
  title: string;
  session: string;
  semester: string;
  lecturer_id?: number | null;
  lecturer_name?: string;
  enrollment_count?: number;
}

export interface StatusEvent {
  id: number;
  complaint_item_id: number;
  from_status: string;
  to_status: string;
  actor_id?: number | null;
  actor_name?: string;
  actor_role?: string;
  note: string;
  created_at: string;
}

export interface ComplaintItem {
  id: number;
  complaint_id: number;
  issue_type: IssueType;
  status: ItemStatus;
  claimed_score?: number | null;
  group_id?: number | null;
  assigned_to_role: 'lecturer' | 'hod';
  reopened: boolean;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  timeline: StatusEvent[];
  student_name?: string;
  matric_no?: string;
  course_code?: string;
  course_title?: string;
  days_open?: number;
}

export interface Attachment {
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

export interface Complaint {
  id: number;
  student_id: number;
  student_name?: string;
  matric_no?: string;
  course_id: number;
  course_code?: string;
  course_title?: string;
  description: string;
  overall_status: string;
  created_at: string;
  updated_at: string;
  items: ComplaintItem[];
  attachments: Attachment[];
}

export interface IssueGroup {
  id: number;
  course_id: number;
  course_code?: string;
  course_title?: string;
  issue_type: IssueType;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  student_count: number;
  assigned_lecturer_id?: number | null;
  assigned_lecturer_name?: string;
  items: ComplaintItem[];
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  read: boolean;
  complaint_id?: number | null;
  created_at: string;
}

export interface DepartmentStats {
  total_complaints: number;
  total_items: number;
  pending_count: number;
  escalated_count: number;
  resolved_count: number;
  rejected_count: number;
  avg_resolution_hours: number;
  status_breakdown: Record<string, number>;
  by_course: Array<{
    course_id: number;
    code: string;
    title: string;
    lecturer_name: string;
    total: number;
    open: number;
    escalated: number;
    resolved: number;
    rejected: number;
  }>;
  by_issue_type: Array<{
    issue_type: string;
    label: string;
    total: number;
    resolved: number;
    escalated: number;
  }>;
  oldest_unresolved: ComplaintItem[];
  courses_without_lecturers: Array<{
    id: number;
    code: string;
    title: string;
    session: string;
  }>;
}
