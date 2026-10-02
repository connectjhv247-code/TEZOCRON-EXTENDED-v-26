import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Clock,
  User,
  Mail,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ReportItem,
  subscribeToAllReports,
  updateReportStatus,
} from '../lib/reportService';
import { User as FirebaseUser } from 'firebase/auth';

interface AdminReportsScreenProps {
  currentUser: FirebaseUser;
  onBack: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export default function AdminReportsScreen({
  currentUser,
  onBack,
  onOpenUserProfile,
}: AdminReportsScreenProps) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToAllReports((loadedReports) => {
      setReports(loadedReports);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleUpdateStatus = async (
    reportId: string,
    newStatus: 'pending' | 'reviewed' | 'resolved'
  ) => {
    setActionLoadingId(reportId);
    const success = await updateReportStatus(reportId, newStatus);
    setActionLoadingId(null);
    if (success) {
      showToast(`Report marked as ${newStatus}`);
    } else {
      showToast('Failed to update status.');
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.reportedUsername.toLowerCase().includes(q) ||
      r.reportedId.toLowerCase().includes(q) ||
      r.reportedEmail.toLowerCase().includes(q) ||
      r.reporterEmail.toLowerCase().includes(q) ||
      r.reporterId.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.details.toLowerCase().includes(q) ||
      (r.messageContent && r.messageContent.toLowerCase().includes(q))
    );
  });

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const reviewedCount = reports.filter((r) => r.status === 'reviewed').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;

  const formatTime = (ts: any, id: string) => {
    let date: Date | null = null;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else {
      const keyTime = parseInt(id.split('_')[0], 10);
      if (!isNaN(keyTime)) date = new Date(keyTime);
    }
    if (!date || isNaN(date.getTime())) return 'Recently';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-y-auto bg-slate-950 text-white">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-18 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          >
            <div className="flex items-center gap-2 rounded-full border border-pink-500/40 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-white shadow-xl shadow-pink-500/20 backdrop-blur-xl">
              <CheckCircle2 className="h-4 w-4 text-pink-400" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/90 px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 shadow-sm">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">
                  Moderation Reports
                </h1>
                <p className="text-[10px] text-pink-300 font-mono">
                  /admin/reports • RTDB asia-southeast1
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-300">
              Admin View
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-2xl px-4 py-5 sm:px-6 pb-24 space-y-4">
        {/* Metric Summary Counters */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-center shadow-lg backdrop-blur-xl">
            <p className="text-[11px] text-slate-400 font-medium">All Reports</p>
            <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
              {reports.length}
            </p>
          </div>
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-center shadow-lg backdrop-blur-xl">
            <p className="text-[11px] text-yellow-300 font-medium">Pending</p>
            <p className="text-lg sm:text-xl font-extrabold text-yellow-200 mt-0.5">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-center shadow-lg backdrop-blur-xl">
            <p className="text-[11px] text-green-300 font-medium">Reviewed</p>
            <p className="text-lg sm:text-xl font-extrabold text-green-200 mt-0.5">
              {reviewedCount + resolvedCount}
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by user, email, reason, or content..."
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none backdrop-blur-xl"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'pending', 'reviewed', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterStatus(tab)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all active:scale-95 ${
                  filterStatus === tab
                    ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-sm shadow-pink-500/30'
                    : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? `All (${reports.length})` : `${tab} (${reports.filter((r) => r.status === tab).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-2.5">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p className="text-xs text-slate-400">Loading Realtime Reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 text-green-400 border border-green-500/20 mb-3">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Reports Found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
              {searchQuery
                ? 'No reports matched your search criteria.'
                : 'Moderation queue is clean. No reports have been submitted under this filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const isActioning = actionLoadingId === report.id;
              return (
                <div
                  key={report.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 shadow-xl backdrop-blur-xl space-y-3 transition-all hover:border-white/20"
                >
                  {/* Top Row: Reason Badge + Status Badge + Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-pink-500/40 bg-pink-500/15 px-3 py-0.5 text-xs font-bold text-pink-300">
                        {report.reason}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          report.status === 'pending'
                            ? 'border border-yellow-500/40 bg-yellow-500/20 text-yellow-300'
                            : report.status === 'reviewed'
                            ? 'border border-blue-500/40 bg-blue-500/20 text-blue-300'
                            : 'border border-green-500/40 bg-green-500/20 text-green-300'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatTime(report.timestamp, report.id)}
                    </span>
                  </div>

                  {/* Reported User Information */}
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-pink-600 to-indigo-600 text-[11px] font-bold text-white">
                          {report.reportedUsername.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {report.reportedUsername}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Account ID: {report.reportedId}
                          </p>
                        </div>
                      </div>

                      {onOpenUserProfile && (
                        <button
                          type="button"
                          onClick={() => onOpenUserProfile(report.reportedId)}
                          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <span>View Profile</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {report.reportedEmail && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                        <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                        <span>{report.reportedEmail}</span>
                      </p>
                    )}
                  </div>

                  {/* Message Evidence if report originated from message */}
                  {report.messageContent && (
                    <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-300 mb-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Reported Message Evidence:</span>
                        {report.messageId && (
                          <span className="text-[10px] font-mono text-slate-400">
                            (ID: {report.messageId.substring(0, 10)}...)
                          </span>
                        )}
                      </div>
                      <blockquote className="text-xs italic text-slate-200 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        "{report.messageContent}"
                      </blockquote>
                    </div>
                  )}

                  {/* Additional Details */}
                  {report.details && (
                    <div className="text-xs text-slate-300 bg-black/20 p-2.5 rounded-2xl border border-white/5">
                      <span className="font-semibold text-slate-400 text-[11px] block mb-0.5">
                        Reporter Details:
                      </span>
                      <p>{report.details}</p>
                    </div>
                  )}

                  {/* Reporter Account Info */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                    <span className="truncate max-w-[200px]">
                      Reporter: {report.reporterEmail || report.reporterId}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Ref: {report.id.substring(0, 18)}
                    </span>
                  </div>

                  {/* Admin Actions Row */}
                  <div className="flex items-center gap-2 pt-1">
                    {report.status !== 'reviewed' && (
                      <button
                        type="button"
                        disabled={isActioning}
                        onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                        className="flex-1 rounded-full border border-blue-500/40 bg-blue-500/15 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-all disabled:opacity-50"
                      >
                        Mark Reviewed
                      </button>
                    )}

                    {report.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={isActioning}
                        onClick={() => handleUpdateStatus(report.id, 'resolved')}
                        className="flex-1 rounded-full border border-green-500/40 bg-green-500/15 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 transition-all disabled:opacity-50"
                      >
                        Mark Resolved
                      </button>
                    )}

                    {report.status !== 'pending' && (
                      <button
                        type="button"
                        disabled={isActioning}
                        onClick={() => handleUpdateStatus(report.id, 'pending')}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-all disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
