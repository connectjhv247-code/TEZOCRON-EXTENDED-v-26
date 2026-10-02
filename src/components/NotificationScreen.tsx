import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Trash2,
  MessageCircle,
  HeartHandshake,
  Sparkles,
  ShieldAlert,
  Radio,
  ShieldCheck,
  ExternalLink,
  X,
  AlertCircle,
  Eye,
  Check,
  User,
  Info,
  Calendar,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  AppNotification,
  NotificationCategory,
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  ensureSystemWelcomeNotification,
} from '../lib/notificationService';

export interface NotificationScreenProps {
  user: FirebaseUser;
  onBack: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenLiveStream?: (channelName: string) => void;
  onOpenRelateFeed?: (postId?: string) => void;
}

export default function NotificationScreen({
  user,
  onBack,
  onOpenUserProfile,
  onOpenLiveStream,
  onOpenRelateFeed,
}: NotificationScreenProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'personal' | 'system'>('all');
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize real system welcome notice if needed and subscribe to user notifications
  useEffect(() => {
    if (!user?.uid) return;

    // Ensure initial real authenticated welcome notice
    ensureSystemWelcomeNotification(
      user.uid,
      user.displayName || user.email?.split('@')[0] || 'Member'
    ).catch(() => {});

    setLoading(true);
    const unsubscribe = subscribeToUserNotifications(user.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.displayName, user?.email]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage((prev) => (prev === text ? null : prev));
    }, 2500);
  };

  // Filter by category
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  // Counts
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const personalUnread = useMemo(() => {
    return notifications.filter((n) => n.category === 'personal' && !n.read).length;
  }, [notifications]);

  const systemUnread = useMemo(() => {
    return notifications.filter((n) => n.category === 'system' && !n.read).length;
  }, [notifications]);

  // Handle click on a notification card
  const handleCardClick = async (notif: AppNotification) => {
    if (!notif.read && user?.uid) {
      await markNotificationAsRead(user.uid, notif.id);
    }
    setSelectedNotification(notif);
  };

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    if (!user?.uid || unreadCount === 0) return;
    await markAllNotificationsAsRead(user.uid);
    showToast('All notifications marked as read');
  };

  // Handle Delete Single
  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    await deleteNotification(user.uid, notifId);
    if (selectedNotification?.id === notifId) {
      setSelectedNotification(null);
    }
    showToast('Notification deleted');
  };

  // Handle Clear All
  const handleClearAll = async () => {
    if (!user?.uid || notifications.length === 0) return;
    await clearAllNotifications(user.uid);
    setSelectedNotification(null);
    showToast('All notifications cleared');
  };

  // Navigate to action target
  const handleActionNavigate = (notif: AppNotification) => {
    setSelectedNotification(null);

    switch (notif.type) {
      case 'comment':
      case 'views_milestone':
        if (onOpenRelateFeed) {
          onOpenRelateFeed(notif.targetId || notif.metadata?.postId);
        } else {
          onBack();
        }
        break;

      case 'relate':
        if (onOpenUserProfile && (notif.actorId || notif.targetId)) {
          onOpenUserProfile(notif.actorId || notif.targetId!);
        } else {
          onBack();
        }
        break;

      case 'live_invite': {
        const liveChannel = notif.targetId || notif.metadata?.channelName;
        if (onOpenLiveStream && liveChannel) {
          onOpenLiveStream(liveChannel);
        } else {
          onBack();
        }
        break;
      }

      default:
        // Report notices or system announcements stay in modal or back
        break;
    }
  };

  // Format relative time cleanly
  const formatTimeAgo = (isoString: string): string => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white pb-24">
      {/* Ambient background accents (Blue, Pink) */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-18 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          >
            <div className="flex items-center gap-2 rounded-full border border-pink-500/40 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-white shadow-xl shadow-pink-500/20 backdrop-blur-xl">
              <Check className="h-4 w-4 text-pink-400" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          STICKY TOP HEADER
          - Back Button (Curved)
          - Title & Bell Icon (Blue/Pink)
          - Mark All Read & Clear Actions (Curved)
      ======================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              aria-label="Go Back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-inner">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-bold text-white tracking-tight leading-none">
                  Notification
                </h1>
                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition-all hover:bg-blue-500/20 hover:text-white active:scale-95"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-300 active:scale-95"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-sm">
              <img
                src="/tezocron_logo.svg"
                alt="TEZOCRON"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          CATEGORY TABS (ROUNDED, CURVED, SOCIAL MEDIA STYLED)
          - All
          - Personal (Comment, Relate, 50+ Views, Live, Reports)
          - System (Verified Platform & Security Notices)
      ======================================================== */}
      <div className="mx-auto w-full max-w-lg px-4 pt-3 pb-2 sm:px-6">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 backdrop-blur-xl shadow-lg">
          {/* 1. All */}
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-md shadow-pink-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>All</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                activeCategory === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {notifications.length}
            </span>
          </button>

          {/* 2. Personal */}
          <button
            type="button"
            onClick={() => setActiveCategory('personal')}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all ${
              activeCategory === 'personal'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Personal</span>
            {personalUnread > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
            ) : null}
          </button>

          {/* 3. System */}
          <button
            type="button"
            onClick={() => setActiveCategory('system')}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition-all ${
              activeCategory === 'system'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>System</span>
            {systemUnread > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            ) : null}
          </button>
        </div>
      </div>

      {/* ========================================================
          MAIN NOTIFICATIONS FEED
      ======================================================== */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-2 sm:px-6">
        {loading ? (
          /* Loading skeletons */
          <div className="flex flex-col gap-2.5 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-2xl border border-white/5 bg-slate-900/40 p-3.5 animate-pulse"
              >
                <div className="h-11 w-11 rounded-2xl bg-white/10 shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3 w-3/4 rounded-full bg-white/10" />
                  <div className="h-2.5 w-1/2 rounded-full bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* Empty State matching TEZOCRON design */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center backdrop-blur-2xl my-6"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shadow-lg shadow-pink-500/10">
              <Bell className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-base font-bold text-white tracking-tight">
              {activeCategory === 'personal'
                ? 'No Personal Notifications'
                : activeCategory === 'system'
                ? 'No System Notices'
                : 'No Notifications Yet'}
            </h2>
            <p className="mt-1.5 max-w-xs text-xs text-slate-400 leading-relaxed">
              {activeCategory === 'personal'
                ? 'When someone comments on your post, relates with you, or invites you to live, real notifications will appear here.'
                : activeCategory === 'system'
                ? 'Important platform security alerts and account notices will appear here.'
                : 'Real community activity on your posts, relates, and live streams will appear here.'}
            </p>
          </motion.div>
        ) : (
          /* Real Notifications List */
          <div className="flex flex-col gap-2.5 pt-1">
            <AnimatePresence>
              {filteredNotifications.map((notif) => {
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleCardClick(notif)}
                    className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all active:scale-[0.99] backdrop-blur-xl ${
                      !notif.read
                        ? 'border-pink-500/35 bg-slate-900/90 shadow-lg shadow-pink-500/5 hover:border-pink-500/50'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80'
                    }`}
                  >
                    {/* Unread Glow Indicator */}
                    {!notif.read && (
                      <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-pink-500 ring-4 ring-pink-500/20 animate-pulse" />
                    )}

                    {/* Icon / Avatar Container (Curved, Rounded) */}
                    <div className="relative shrink-0">
                      {notif.type === 'report_notice' ? (
                        /* Strict Anonymity for Report Notice: NO reporter avatar */
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-600/30 to-slate-800 border border-pink-500/40 text-pink-400 shadow-md">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                      ) : notif.type === 'views_milestone' ? (
                        /* 50+ Views Milestone Trophy / Sparkles */
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/40 text-amber-300 shadow-md">
                          <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
                        </div>
                      ) : notif.category === 'system' ? (
                        /* Verified System Notice */
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600/25 to-slate-800 border border-blue-500/40 text-blue-400 shadow-md">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                      ) : notif.actorPhoto ? (
                        /* Real User Actor Profile Picture */
                        <img
                          src={notif.actorPhoto}
                          alt={notif.actorName || 'User'}
                          className="h-11 w-11 rounded-2xl object-cover border border-white/20 ring-2 ring-pink-500/30 shadow-md"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        /* Real User Initials Avatar */
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-pink-600 text-xs font-bold text-white shadow-md">
                          {notif.actorName?.[0]?.toUpperCase() || 'T'}
                        </div>
                      )}

                      {/* Small Type Icon Badge on Bottom-Right */}
                      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 border border-white/20 text-[9px] shadow-sm">
                        {notif.type === 'comment' && (
                          <MessageCircle className="h-2.5 w-2.5 text-pink-400" />
                        )}
                        {notif.type === 'relate' && (
                          <HeartHandshake className="h-2.5 w-2.5 text-blue-400" />
                        )}
                        {notif.type === 'views_milestone' && (
                          <Eye className="h-2.5 w-2.5 text-amber-400" />
                        )}
                        {notif.type === 'report_notice' && (
                          <ShieldAlert className="h-2.5 w-2.5 text-pink-400" />
                        )}
                        {notif.type === 'live_invite' && (
                          <Radio className="h-2.5 w-2.5 text-red-400" />
                        )}
                        {notif.category === 'system' && (
                          <ShieldCheck className="h-2.5 w-2.5 text-blue-400" />
                        )}
                      </div>
                    </div>

                    {/* Card Content (Modern, Compact, Curved) */}
                    <div className="flex-1 min-w-0 pr-4">
                      {/* Header line */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {notif.category === 'system' && (
                          <span className="inline-flex items-center rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                            Official
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-white tracking-tight leading-snug">
                          {notif.title}
                        </h3>
                      </div>

                      {/* Message Body */}
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Footer: Time & Action Pill */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatTimeAgo(notif.createdAt)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Type-Specific Compact Action */}
                          {notif.type === 'comment' && (
                            <span className="rounded-xl border border-pink-500/30 bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-300 group-hover:bg-pink-500/25 transition-colors">
                              View Post
                            </span>
                          )}
                          {notif.type === 'relate' && (
                            <span className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300 group-hover:bg-blue-500/25 transition-colors">
                              View Profile
                            </span>
                          )}
                          {notif.type === 'views_milestone' && (
                            <span className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 group-hover:bg-amber-500/25 transition-colors">
                              50+ Views
                            </span>
                          )}
                          {notif.type === 'live_invite' && (
                            <span className="rounded-xl border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 group-hover:bg-red-500/25 transition-colors flex items-center gap-1">
                              <Radio className="h-2.5 w-2.5 animate-pulse" />
                              Join Live
                            </span>
                          )}
                          {notif.type === 'report_notice' && (
                            <span className="rounded-xl border border-pink-500/30 bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-300 transition-colors">
                              Safety Notice
                            </span>
                          )}

                          {/* Quick Delete */}
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, notif.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-pink-400 hover:bg-white/5 transition-all"
                            title="Delete notification"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* ========================================================
          NOTIFICATION DETAIL POPUP / MODAL
          - Rounded-3xl, Curved
          - Consistent Blue, White, Pink design
          - Full metadata and direct action link
      ======================================================== */}
      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              onClick={() => setSelectedNotification(null)}
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl"
            >
              {/* Top Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border ${
                      selectedNotification.category === 'system'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                    }`}
                  >
                    {selectedNotification.type === 'comment' && (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    {selectedNotification.type === 'relate' && (
                      <HeartHandshake className="h-3.5 w-3.5" />
                    )}
                    {selectedNotification.type === 'views_milestone' && (
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    {selectedNotification.type === 'report_notice' && (
                      <ShieldAlert className="h-3.5 w-3.5 text-pink-400" />
                    )}
                    {selectedNotification.type === 'live_invite' && (
                      <Radio className="h-3.5 w-3.5 text-red-400" />
                    )}
                    {selectedNotification.category === 'system' && (
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {selectedNotification.category === 'system'
                      ? 'Official System Notice'
                      : 'Personal Notification'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="mt-4 flex flex-col gap-4">
                {/* Notification Title & Details */}
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {selectedNotification.title}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(selectedNotification.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                {/* Actor Info (if personal and not report notice) */}
                {selectedNotification.actorName &&
                  selectedNotification.type !== 'report_notice' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      {selectedNotification.actorPhoto ? (
                        <img
                          src={selectedNotification.actorPhoto}
                          alt={selectedNotification.actorName}
                          className="h-10 w-10 rounded-xl object-cover border border-white/20 ring-2 ring-pink-500/30"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-pink-600 text-xs font-bold text-white">
                          {selectedNotification.actorName[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">
                          {selectedNotification.actorName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          TEZOCRON Community Member
                        </span>
                      </div>
                    </div>
                  )}

                {/* Message Box (Curved, Rounded) */}
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedNotification.message}
                  </p>
                </div>

                {/* Special Detail: Report Notice Explanation */}
                {selectedNotification.type === 'report_notice' && (
                  <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3.5 text-xs text-slate-300 leading-relaxed">
                    <div className="flex items-center gap-2 text-pink-300 font-bold mb-1">
                      <ShieldAlert className="h-4 w-4 text-pink-400" />
                      <span>Reporter Privacy Protection</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      In accordance with TEZOCRON Extended safety policies, the reporter's
                      identity, name, and profile remain strictly private and confidential.
                      Our moderation team will review this case. Please ensure all interactions
                      abide by our Community Guidelines.
                    </p>
                  </div>
                )}

                {/* Special Detail: Views Milestone */}
                {selectedNotification.type === 'views_milestone' && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>Genuine Milestone</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90">
                      Congratulations! Your post crossed the 50 legitimate view count threshold
                      from unique TEZOCRON members.
                    </p>
                  </div>
                )}

                {/* Special Detail: Live Invite Stream Info */}
                {selectedNotification.type === 'live_invite' &&
                  selectedNotification.metadata?.streamTitle && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-slate-200 leading-relaxed">
                      <div className="flex items-center gap-2 text-red-300 font-bold mb-1">
                        <Radio className="h-4 w-4 text-red-400 animate-pulse" />
                        <span>Live Stream Details</span>
                      </div>
                      <p className="text-[11px]">
                        Title: <strong className="text-white">{selectedNotification.metadata.streamTitle}</strong>
                      </p>
                      {selectedNotification.metadata.hostName && (
                        <p className="text-[11px] text-slate-300">
                          Host: {selectedNotification.metadata.hostName}
                        </p>
                      )}
                    </div>
                  )}

                {/* Special Detail: Comment Text */}
                {selectedNotification.type === 'comment' &&
                  selectedNotification.metadata?.commentText && (
                    <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-3 text-xs">
                      <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-wider block mb-1">
                        Comment
                      </span>
                      <p className="italic text-slate-200">
                        "{selectedNotification.metadata.commentText}"
                      </p>
                    </div>
                  )}

                {/* Action Buttons in Modal */}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, selectedNotification.id)}
                    className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-300 transition-all active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>

                  {/* Primary Navigation Action */}
                  {(selectedNotification.type === 'comment' ||
                    selectedNotification.type === 'views_milestone') && (
                    <button
                      type="button"
                      onClick={() => handleActionNavigate(selectedNotification)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-pink-500 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Open Post & Comments</span>
                    </button>
                  )}

                  {selectedNotification.type === 'relate' && (
                    <button
                      type="button"
                      onClick={() => handleActionNavigate(selectedNotification)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-pink-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <User className="h-4 w-4" />
                      <span>View Relater Profile</span>
                    </button>
                  )}

                  {selectedNotification.type === 'live_invite' && (
                    <button
                      type="button"
                      onClick={() => handleActionNavigate(selectedNotification)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-pink-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Radio className="h-4 w-4 animate-pulse" />
                      <span>Join Live Broadcast</span>
                    </button>
                  )}

                  {(selectedNotification.type === 'report_notice' ||
                    selectedNotification.category === 'system') && (
                    <button
                      type="button"
                      onClick={() => setSelectedNotification(null)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Check className="h-4 w-4" />
                      <span>I Understand</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
