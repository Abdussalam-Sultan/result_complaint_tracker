import React from 'react';
import {
  Clock, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, ShieldAlert, FileText, Ban
} from 'lucide-react';
import { ItemStatus } from '../types';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const norm = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';
  let Icon = FileText;
  let label = status;

  if (norm.includes('RESOLVED')) {
    colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200';
    Icon = CheckCircle2;
    label = 'Resolved';
  } else if (norm.includes('REJECTED')) {
    colorClasses = 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200';
    Icon = XCircle;
    label = 'Rejected';
  } else if (norm.includes('ESCALATED')) {
    colorClasses = 'bg-red-100 text-red-900 border-red-400 font-semibold shadow-xs ring-1 ring-red-300 animate-pulse';
    Icon = ShieldAlert;
    label = norm.includes('HOD') ? 'Escalated to HOD' : 'Escalated';
  } else if (norm.includes('NEEDS_INFO') || norm.includes('ACTION REQUIRED')) {
    colorClasses = 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200 font-medium';
    Icon = AlertTriangle;
    label = 'Needs Info';
  } else if (norm.includes('UNDER_REVIEW') || norm.includes('UNDER REVIEW')) {
    colorClasses = 'bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-200';
    Icon = Clock;
    label = 'Under Review';
  } else if (norm.includes('SUBMITTED')) {
    colorClasses = 'bg-indigo-50 text-indigo-900 border-indigo-200';
    Icon = Clock;
    label = 'Submitted';
  } else if (norm.includes('WITHDRAWN')) {
    colorClasses = 'bg-gray-100 text-gray-600 border-gray-300 line-through';
    Icon = Ban;
    label = 'Withdrawn';
  } else if (norm.includes('IN PROGRESS') || norm.includes('CLOSED')) {
    colorClasses = 'bg-sky-50 text-sky-900 border-sky-300';
    Icon = RotateCcw;
    label = status;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors ${sizeClasses} ${colorClasses}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
};
