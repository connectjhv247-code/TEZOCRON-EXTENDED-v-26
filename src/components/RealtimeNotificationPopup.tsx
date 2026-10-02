import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  MessageCircle,
  HeartHandshake,
  Sparkles,
  ShieldAlert,
  Radio,
  ShieldCheck,
  X,
  User,
  CheckCircle,
} from 'lucide-react';
import {
  AppNotification,
  subscribeToUserNotifications,
  markNotificationAsRead,
} from '../lib/notificationService';

export interface RealtimeNotificationPopupProps {
  userId: string;
  onOpenUserProfile?: (userId: string) => void;
  onOpenLiveStream?: (channelName: string) => void;
  onOpenRelateFeed?: (postId?: string) => void;
  onOpenNotifications?: () => void;
}

export default function RealtimeNotificationPopup({
  userId,
  onOpenUserProfile,
  onOpenLiveStream,
  onOpenRelateFeed,
  onOpenNotifications,
}: RealtimeNotificationPopupProps) {
  const [activePopups, setActivePopups] = useState<AppNotification[]>([]);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const autoDismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Listen to user notifications in real-time
  useEffect(() => {
    if (!userId) {
      setActivePopups([]);
      return;
    }

    isInitialLoadRef.current = true;
    seenNotificationIdsRef.current.clear();

    const unsubscribe = subscribeToUserNotifications(userId, (notifications) => {
      if (isInitialLoadRef.current) {
        // First snapshot load: register all existing notifications so we don't trigger old pop-ups
        notifications.forEach((n) => seenNotificationIdsRef.current.add(n.id));
        isInitialLoadRef.current = false;
        return;
      }

      // Subsequent snapshot updates: find genuinely new notifications
      const newItems: AppNotification[] = [];
      const nowMs = Date.now();

      notifications.forEach((n) => {
        if (!seenNotificationIdsRef.current.has(n.id)) {
          seenNotificationIdsRef.current.add(n.id);

          // Only trigger pop-up for notifications created recently (within last 3 minutes)
          const createdMs = new Date(n.createdAt).getTime();
          const isRecent = !isNaN(createdMs) && nowMs - createdMs < 3 * 60 * 1000;

          if (isRecent) {
            newItems.push(n);
          }
        }
      });

      if (newItems.length > 0) {
        setActivePopups((prev) => {
          // Prepend new notifications, keep maximum 3 visible at once to avoid screen clutter
          const updated = [...newItems, ...prev].slice(0, 3);
          return updated;
        });

        // Set auto-dismiss timer for each new notification
        newItems.forEach((n) => {
          if (autoDismissTimersRef.current.has(n.id)) {
            clearTimeout(autoDismissTimersRef.current.get(n.id));
          }

          const timer = setTimeout(() => {
            dismissPopup(n.id);
          }, 6000); // Auto-dismiss after 6 seconds

          autoDismissTimersRef.current.set(n.id, timer);
        });
      }
    });

    return () => {
      unsubscribe();
      // Clear all timers on unmount
      autoDismissTimersRef.current.forEach((t) => clearTimeout(t));
      autoDismissTimersRef.current.clear();
    };
  }, [userId]);

  const dismissPopup = (notifId: string) => {
    if (autoDismissTimersRef.current.has(notifId)) {
      clearTimeout(autoDismissTimersRef.current.get(notifId));
      autoDismissTimersRef.current.delete(notifId);
    }
    setActivePopups((prev) => prev.filter((item) => item.id !== notifId));
  };

  const handlePopupClick = async (notif: AppNotification) => {
    // 1. Mark as read in Firestore
    if (!notif.read && userId) {
      markNotificationAsRead(userId, notif.id).catch(() => {});
    }

    // 2. Dismiss popup from screen
    dismissPopup(notif.id);

    // 3. Navigate immediately based on type
    switch (notif.type) {
      case 'comment':
      case 'views_milestone':
        if (onOpenRelateFeed) {
          onOpenRelateFeed(notif.targetId || notif.metadata?.postId);
        } else if (onOpenNotifications) {
          onOpenNotifications();
        }
        break;

      case 'relate':
        if (onOpenUserProfile && (notif.actorId || notif.targetId)) {
          onOpenUserProfile(notif.actorId || notif.targetId!);
        } else if (onOpenNotifications) {
          onOpenNotifications();
        }
        break;

      case 'live_invite': {
        const liveChannel = notif.targetId || notif.metadata?.channelName || 'TEZOCRON_TEST';
        if (onOpenLiveStream) {
          onOpenLiveStream(liveChannel);
        } else if (onOpenNotifications) {
          onOpenNotifications();
        }
        break;
      }

      default:
        if (onOpenNotifications) {
          onOpenNotifications();
        }
        break;
    }
  };

  if (activePopups.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2.5 px-4 pointer-events-none sm:top-6">
      <AnimatePresence>
        {activePopups.map((notif) => {
          const isSystem = notif.category === 'system';
          const isReport = notif.type === 'report_notice';
          const isMilestone = notif.type === 'views_milestone';
          const isLiveInvite = notif.type === 'live_invite';
          const isRelate = notif.type === 'relate';
          const isComment = notif.type === 'comment';

          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -35, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={() => handlePopupClick(notif)}
              className="pointer-events-auto relative flex w-full max-w-md cursor-pointer items-start gap-3 rounded-2xl border border-pink-500/40 bg-slate-900/95 p-3.5 shadow-2xl shadow-pink-500/20 backdrop-blur-2xl transition-all hover:border-pink-500/70 hover:bg-slate-900 active:scale-[0.98]"
            >
              {/* Top Right Glow Pip */}
              <span className="absolute top-3 right-10 h-2 w-2 rounded-full bg-pink-500 ring-4 ring-pink-500/30 animate-pulse" />

              {/* Icon / Avatar Container (Curved 3D Glass style) */}
              <div className="relative shrink-0">
                {isReport ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-600/30 to-slate-800 border border-pink-500/40 text-pink-400 shadow-md">
                    <ShieldAlert className="h-5 w-5 animate-pulse" />
                  </div>
                ) : isMilestone ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/40 text-amber-300 shadow-md">
                    <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
                  </div>
                ) : isSystem ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600/25 to-slate-800 border border-blue-500/40 text-blue-400 shadow-md">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                ) : notif.actorPhoto ? (
                  <img
                    src={notif.actorPhoto}
                    alt={notif.actorName || 'User'}
                    className="h-11 w-11 rounded-2xl object-cover border border-white/20 ring-2 ring-pink-500/30 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-pink-600 text-xs font-bold text-white shadow-md">
                    {notif.actorName?.[0]?.toUpperCase() || 'T'}
                  </div>
                )}

                {/* Badge Icon */}
                <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-950 border border-white/20 text-[9px] shadow-sm">
                  {isComment && <MessageCircle className="h-2.5 w-2.5 text-pink-400" />}
                  {isRelate && <HeartHandshake className="h-2.5 w-2.5 text-blue-400" />}
                  {isMilestone && <Sparkles className="h-2.5 w-2.5 text-amber-400" />}
                  {isReport && <ShieldAlert className="h-2.5 w-2.5 text-pink-400" />}
                  {isLiveInvite && <Radio className="h-2.5 w-2.5 text-red-400" />}
                  {isSystem && <ShieldCheck className="h-2.5 w-2.5 text-blue-400" />}
                </div>
              </div>

              {/* Text & Details */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                    {isComment
                      ? 'New Comment'
                      : isRelate
                      ? 'New Relate'
                      : isLiveInvite
                      ? 'Live Invite'
                      : isMilestone
                      ? 'Milestone'
                      : isReport
                      ? 'Safety Notice'
                      : isSystem
                      ? 'System Notice'
                      : 'Notification'}
                  </span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>

                <h4 className="mt-1 text-xs font-bold text-white tracking-tight leading-snug truncate">
                  {notif.title}
                </h4>

                <p className="mt-0.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {notif.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissPopup(notif.id);
                }}
                className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Dismiss notification"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
