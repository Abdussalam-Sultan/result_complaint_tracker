import React from 'react';
import { StatusEvent } from '../types';
import { StatusBadge } from './StatusBadge';
import { Clock, User as UserIcon, Shield, GraduationCap, Server } from 'lucide-react';

interface TimelineViewProps {
  events: StatusEvent[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-3 text-center italic">
        No timeline events recorded yet.
      </div>
    );
  }

  // Sort chronologically
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const getActorIcon = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'part_advisor':
        return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'student':
        return <UserIcon className="w-4 h-4 text-emerald-600" />;
      default:
        return <Server className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {sorted.map((ev, idx) => (
        <div key={ev.id || idx} className="relative group">
          {/* Node Icon */}
          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center group-hover:border-blue-600 transition-colors shadow-xs">
            <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-blue-600" />
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 shadow-2xs hover:bg-white hover:border-slate-300 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={ev.to_status} size="sm" />
                {ev.from_status && ev.from_status !== 'NONE' && (
                  <span className="text-xs text-slate-500">
                    from <span className="font-medium text-slate-600">{ev.from_status}</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(ev.created_at)}
              </span>
            </div>

            {/* Note */}
            <p className="text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
              {ev.note}
            </p>

            {/* Actor Footprint */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-xs text-slate-500">
              {getActorIcon(ev.actor_role)}
              <span className="font-medium text-slate-700">
                {ev.actor_name || 'System Auto-Engine'}
              </span>
              {ev.actor_role && (
                <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.2 bg-slate-200/70 text-slate-600 rounded">
                  {ev.actor_role}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
