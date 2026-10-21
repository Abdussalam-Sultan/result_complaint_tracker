import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Notification } from '../types';
import {
  Bell, Check, LogOut, Shield, GraduationCap, User,
  CheckCircle2, XCircle, Clock, AlertTriangle, Info
} from 'lucide-react';

const humanizeMessage = (msg: string): string => {
  if (!msg) return '';
  return msg
    .replace(/\bUNDER_REVIEW\b/g, 'Under Review')
    .replace(/\bNEEDS_INFO\b/g, 'Information Requested')
    .replace(/\bRESOLVED\b/g, 'Resolved')
    .replace(/\bREJECTED\b/g, 'Rejected')
    .replace(/\bESCALATED\b/g, 'Escalated to Head of Department')
    .replace(/\bWITHDRAWN\b/g, 'Withdrawn')
    .replace(/\bSUBMITTED\b/g, 'Submitted')
    .replace(/\bMISSING_CA\b/g, 'Continuous Assessment')
    .replace(/\bMISSING_EXAM\b/g, 'Examination Score')
    .replace(/\bMISSING_SCORE\b/g, 'Continuous Assessment Score')
    .replace(/\bWRONG_GRADE\b/g, 'Letter Grade')
    .replace(/\bWRONG_SCORE\b/g, 'Score Calculation')
    .replace(/\bSCRIPT_REMARK_REQUEST\b/g, 'Script Remark Request')
    .replace(/Status changed to /gi, 'Status updated to ')
    .replace(/Status is now /gi, 'Status is now ');
};

const getNotificationMeta = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes('resolved') || m.includes('reconciled')) {
    return {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Resolved',
    };
  }
  if (m.includes('not approved') || m.includes('rejected') || m.includes('reject') || m.includes('closed due to')) {
    return {
      icon: <XCircle className="w-4 h-4 text-rose-600 shrink-0" />,
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'Decision',
    };
  }
  if (m.includes('escalat') || m.includes('dispute') || m.includes('appealed')) {
    return {
      icon: <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />,
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      label: 'Escalation',
    };
  }
  if (m.includes('review') || m.includes('investigating')) {
    return {
      icon: <Clock className="w-4 h-4 text-blue-600 shrink-0" />,
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'In Review',
    };
  }
  return {
    icon: <Info className="w-4 h-4 text-sky-600 shrink-0" />,
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
    label: 'Notice',
  };
};

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count'),
      ]);
      setNotifications(notifsRes.data);
      setUnreadCount(countRes.data.unread_count);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'student':
        return (
          <span className="bg-emerald-800/60 text-emerald-100 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-600/40">
            Student
          </span>
        );
      case 'lecturer':
        return (
          <span className="bg-blue-800/60 text-blue-100 text-xs px-2.5 py-0.5 rounded-full font-medium border border-blue-600/40">
            Lecturer
          </span>
        );
      case 'hod':
        return (
          <span className="bg-amber-800/60 text-amber-200 text-xs px-2.5 py-0.5 rounded-full font-medium border border-amber-600/40">
            Head of Department (HOD)
          </span>
        );
      case 'admin':
        return (
          <span className="bg-purple-800/60 text-purple-200 text-xs px-2.5 py-0.5 rounded-full font-medium border border-purple-600/40">
            System Admin
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#002147] text-white shadow-md border-b border-[#0B2E59]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => {
            if (user?.role === 'student') navigate('/student');
            else if (user?.role === 'lecturer') navigate('/lecturer');
            else if (user?.role === 'hod') navigate('/hod');
            else if (user?.role === 'admin') navigate('/admin');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center font-black text-[#002147] shadow-inner text-base">
            OAU
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white group-hover:text-amber-300 transition-colors">
                Result Complaint Tracker
              </span>
              {getRoleBadge(user?.role)}
            </div>
            <p className="text-[11px] text-blue-200/80 hidden sm:block">
              Dept. of Computer Science & Engineering • Obafemi Awolowo University
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors relative cursor-pointer"
              title="In-App Notifications"
            >
              <Bell className="w-5 h-5 text-blue-200 hover:text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-[#002147]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Drawer Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.2 rounded-full font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const cleanMsg = humanizeMessage(notif.message);
                      const meta = getNotificationMeta(cleanMsg);
                      return (
                        <div
                          key={notif.id}
                          className={`p-3.5 hover:bg-slate-50 transition-colors text-xs flex gap-3 ${
                            !notif.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="mt-0.5">
                            {meta.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${meta.bg}`}>
                                {meta.label}
                              </span>
                              {!notif.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                              )}
                            </div>
                            <p className="text-slate-800 leading-snug">{cleanMsg}</p>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                {new Date(notif.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}{' '}
                                •{' '}
                                {new Date(notif.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {!notif.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="text-blue-600 hover:underline cursor-pointer font-medium"
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Logout */}
          <div className="flex items-center gap-3 pl-2 border-l border-blue-900/60">
            <div className="hidden md:block text-right">
              <div className="text-xs font-semibold text-white leading-tight">
                {user?.name}
              </div>
              <div className="text-[11px] text-blue-300">
                {user?.matric_no || user?.email}
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
