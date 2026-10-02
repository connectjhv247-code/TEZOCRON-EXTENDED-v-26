import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Coins,
  Radio,
  Heart,
  MessageCircle,
  Gift,
  X,
  Send,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Loader2,
  ChevronDown,
  UserPlus,
  Search,
  Check,
  CreditCard,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { createNotification } from '../lib/notificationService';
import { motion, AnimatePresence } from 'motion/react';
import {
  LiveStream,
  LiveComment,
  subscribeToActiveLiveStreams,
  subscribeToUserCoins,
  subscribeToLiveComments,
  sendLiveComment,
  subscribeToLiveReactions,
  sendLiveReaction,
  createLiveStreamDoc,
  endLiveStreamDoc,
  joinAgoraLiveStreamAsViewer,
  startAgoraLiveBroadcast,
  ActiveAudienceSession,
  ActiveHostSession,
  subscribeToStreamDoc,
  joinStreamViewer,
  leaveStreamViewer,
  burnViewerCoin,
} from '../lib/liveStreamService';

// Formats time left based on 1 coin per 2 seconds (0.5 coin/sec)
function formatTimeLeft(coinCount: number): string {
  if (coinCount <= 0) return '0s';
  const totalSeconds = coinCount * 2;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

interface GoLiveAreaProps {
  user: FirebaseUser;
  userRole?: string;
  isActiveTab: boolean;
  initialChannelName?: string;
  onNavigateTab?: (tab: 'chat' | 'golive' | 'relate') => void;
  goLiveClickCount?: number;
}

interface FloatingHeartItem {
  id: string;
  x: number;
  color?: 'pink' | 'white' | 'blue';
}

export default function GoLiveArea({
  user,
  isActiveTab,
  initialChannelName,
  goLiveClickCount,
}: GoLiveAreaProps) {
  // Navigation mode within Go Live:
  // 'selection' = Go Live selection screen with large 3D "Watch Live" & "Host Live" buttons
  // 'watch' = Immersive full-screen Watch Live experience
  const [goLiveViewMode, setGoLiveViewMode] = useState<'selection' | 'watch'>(
    initialChannelName ? 'watch' : 'selection'
  );

  // Host Live notice modal (Host Live functionality not built yet per instruction)
  const [showHostInfoModal, setShowHostInfoModal] = useState<boolean>(false);

  // Coin balance from Firestore users/{uid}
  const [coins, setCoins] = useState<number>(0);

  // Active streams from Firestore live_streams
  const [activeStreams, setActiveStreams] = useState<LiveStream[]>([]);
  const [currentStreamIndex, setCurrentStreamIndex] = useState<number>(0);
  const [loadingStreams, setLoadingStreams] = useState<boolean>(true);

  // Audience Agora session state
  const viewerVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const activeAudienceSessionRef = useRef<ActiveAudienceSession | null>(null);
  const [isAudienceConnecting, setIsAudienceConnecting] = useState<boolean>(false);
  const [isAudienceJoined, setIsAudienceJoined] = useState<boolean>(false);
  const [activeStreamDoc, setActiveStreamDoc] = useState<LiveStream | null>(null);
  const [isStreamFull, setIsStreamFull] = useState<boolean>(false);
  const [showOutOfCoinsModal, setShowOutOfCoinsModal] = useState<boolean>(false);
  const hasJoinedViewerRef = useRef<string | null>(null);

  // Comments & Reactions for current stream
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isSendingComment, setIsSendingComment] = useState<boolean>(false);
  const [showCommentsSheet, setShowCommentsSheet] = useState<boolean>(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);

  // Double-tap timestamp tracker for Love action
  const lastTapTimeRef = useRef<number>(0);

  // Gift modal state (Designated area kept empty per STEP 17 instruction)
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);

  // Invite / Tag Friends Modal state
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteUsersList, setInviteUsersList] = useState<
    { uid: string; displayName: string; photoURL?: string; role?: string }[]
  >([]);
  const [loadingInviteUsers, setLoadingInviteUsers] = useState<boolean>(false);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [inviteSearchQuery, setInviteSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [streamConnectionError, setStreamConnectionError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const isAiStudioPreview =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('aistudio.google.com') ||
      window.location.hostname.includes('europe-west3.run.app') ||
      (window.self !== window.top && Boolean(document.referrer && document.referrer.includes('aistudio.google.com'))));

  // Host broadcast state (kept intact)
  const [showHostSetupModal, setShowHostSetupModal] = useState<boolean>(false);
  const [hostStreamTitle, setHostStreamTitle] = useState<string>('');
  const [isStartingBroadcast, setIsStartingBroadcast] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null);
  const [broadcastChannelName, setBroadcastChannelName] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [hostErrorMessage, setHostErrorMessage] = useState<string | null>(null);
  const [hostLiveEarnings, setHostLiveEarnings] = useState<number>(0);
  const [hostStreamDoc, setHostStreamDoc] = useState<LiveStream | null>(null);

  const hostVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const activeHostSessionRef = useRef<ActiveHostSession | null>(null);

  // Ref to container for scroll detection
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Toast feedback helper
  const handleShowToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage((prev) => (prev === text ? null : prev));
    }, 2800);
  };

  // Switch to selection screen whenever user taps the middle Go Live button in bottom nav
  const prevClickCountRef = useRef<number>(goLiveClickCount || 0);
  useEffect(() => {
    if (goLiveClickCount !== undefined && goLiveClickCount > prevClickCountRef.current) {
      prevClickCountRef.current = goLiveClickCount;
      if (activeAudienceSessionRef.current) {
        activeAudienceSessionRef.current.leave().catch(() => {});
        activeAudienceSessionRef.current = null;
      }
      if (hasJoinedViewerRef.current) {
        leaveStreamViewer(hasJoinedViewerRef.current);
        hasJoinedViewerRef.current = null;
      }
      setIsAudienceJoined(false);
      setGoLiveViewMode('selection');
    }
  }, [goLiveClickCount]);

  // Switch to initial channel if requested
  useEffect(() => {
    if (initialChannelName && activeStreams.length > 0) {
      const idx = activeStreams.findIndex((s) => s.channelName === initialChannelName);
      if (idx !== -1) {
        setCurrentStreamIndex(idx);
        setGoLiveViewMode('watch');
      }
    }
  }, [initialChannelName, activeStreams]);

  // Open Tag / Invite Modal and load real community users
  const handleOpenInviteModal = async () => {
    setShowInviteModal(true);
    setLoadingInviteUsers(true);
    try {
      const usersSnap = await getDocs(query(collection(firestore, 'users'), limit(40)));
      const list = usersSnap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as any))
        .filter((u) => u.uid !== user.uid)
        .map((u) => ({
          uid: u.uid,
          displayName: u.display_name || u.full_name || 'Member',
          photoURL: u.photo_url || undefined,
          role: u.play_role || 'Member',
        }));
      setInviteUsersList(list);
    } catch (err) {
      console.warn('Failed to load users for invite:', err);
    } finally {
      setLoadingInviteUsers(false);
    }
  };

  // Send real tag / invite notification
  const handleSendLiveInvite = async (targetUser: {
    uid: string;
    displayName: string;
    photoURL?: string;
  }) => {
    if (!user?.uid || invitedUserIds.has(targetUser.uid)) return;

    const stream = isBroadcasting
      ? {
          title: hostStreamTitle.trim() || 'TEZOCRON Live Broadcast',
          hostName: user.displayName || 'Host',
          channelName: broadcastChannelName || `host_${user.uid}`,
          hostPhoto: user.photoURL || undefined,
        }
      : activeStreams[currentStreamIndex] || {
          title: 'Live Stream',
          hostName: 'Host',
          channelName: 'live',
        };

    try {
      await createNotification({
        userId: targetUser.uid,
        category: 'personal',
        type: 'live_invite',
        title: `${user.displayName || 'TEZOCRON Member'} tagged you to join Live`,
        message: `Join the live stream: "${stream.title}" hosted by ${stream.hostName}!`,
        actorId: user.uid,
        actorName: user.displayName || 'TEZOCRON Member',
        actorPhoto: user.photoURL || undefined,
        targetId: stream.channelName,
        metadata: {
          channelName: stream.channelName,
          streamTitle: stream.title,
          hostName: stream.hostName,
          hostPhoto: (stream as any).hostPhoto,
        },
      });

      setInvitedUserIds((prev) => new Set([...prev, targetUser.uid]));
      handleShowToast(`Tagged ${targetUser.displayName} to join live!`);
    } catch (inviteErr) {
      console.warn('Invite notification trigger warning:', inviteErr);
    }
  };

  // -------------------------------------------------------------
  // 1. Subscribe to User Coins (REAL purchased balance only)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user?.uid) return;
    const unsubCoins = subscribeToUserCoins(user.uid, (balance) => {
      setCoins(balance);
    });
    return () => unsubCoins();
  }, [user?.uid]);

  // -------------------------------------------------------------
  // 2. Subscribe to REAL Active Live Streams from Firestore
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubStreams = subscribeToActiveLiveStreams((streams) => {
      setActiveStreams(streams);
      setLoadingStreams(false);

      // Adjust index if list shrank
      setCurrentStreamIndex((prev) => {
        if (streams.length === 0) return 0;
        if (prev >= streams.length) return streams.length - 1;
        return prev;
      });
    });

    return () => unsubStreams();
  }, []);

  const currentStream: LiveStream | undefined = activeStreams[currentStreamIndex];

  // -------------------------------------------------------------
  // 2b. Subscribe to Current Stream Doc for Realtime Viewer Count & Capacity
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentStream?.id) {
      setActiveStreamDoc(null);
      setIsStreamFull(false);
      return;
    }

    const unsub = subscribeToStreamDoc(currentStream.id, (docSnap) => {
      setActiveStreamDoc(docSnap);
      if (docSnap) {
        if (docSnap.currentViewers && docSnap.maxViewers && docSnap.currentViewers >= docSnap.maxViewers && !isAudienceJoined) {
          setIsStreamFull(true);
        } else {
          setIsStreamFull(false);
        }
      }
    });

    return () => unsub();
  }, [currentStream?.id, isAudienceJoined]);

  // -------------------------------------------------------------
  // 2c. Subscribe to Host Stream Doc for Realtime Viewers & Earnings
  // -------------------------------------------------------------
  useEffect(() => {
    if (!broadcastStreamId) {
      setHostStreamDoc(null);
      return;
    }

    const unsub = subscribeToStreamDoc(broadcastStreamId, (docSnap) => {
      setHostStreamDoc(docSnap);
    });

    return () => unsub();
  }, [broadcastStreamId]);

  // -------------------------------------------------------------
  // 3. Connect to live stream when in Watch mode
  //    - Only connects when goLiveViewMode === 'watch'
  //    - Checks coins > 0
  //    - Checks currentViewers < maxViewers (500 max, default 100)
  //    - Increments currentViewers in Firestore on join
  //    - Decrements on leave/unmount
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isActiveTab || goLiveViewMode !== 'watch' || isBroadcasting || !currentStream) {
      if (activeAudienceSessionRef.current) {
        activeAudienceSessionRef.current.leave().catch(() => {});
        activeAudienceSessionRef.current = null;
      }
      if (hasJoinedViewerRef.current) {
        leaveStreamViewer(hasJoinedViewerRef.current);
        hasJoinedViewerRef.current = null;
      }
      setIsAudienceJoined(false);
      return;
    }

    let isCancelled = false;
    setIsAudienceConnecting(true);

    const setupAudience = async () => {
      setStreamConnectionError(null);
      // Leave any existing session
      if (activeAudienceSessionRef.current) {
        await activeAudienceSessionRef.current.leave().catch(() => {});
        activeAudienceSessionRef.current = null;
      }
      if (hasJoinedViewerRef.current) {
        await leaveStreamViewer(hasJoinedViewerRef.current);
        hasJoinedViewerRef.current = null;
      }
      setIsAudienceJoined(false);

      if (!viewerVideoContainerRef.current) return;

      // 1. Check if user is out of coins
      if (coins <= 0) {
        setIsAudienceConnecting(false);
        setShowOutOfCoinsModal(true);
        return;
      }

      // 2. Max viewers logic: check streams/{streamId}.currentViewers < maxViewers (500 max, default 100)
      const capacityCheck = await joinStreamViewer(currentStream.id);
      if (!capacityCheck.allowed) {
        setIsAudienceConnecting(false);
        setIsStreamFull(true);
        handleShowToast(`Stream is full (${capacityCheck.maxViewers} max viewers). Capacity limit reached.`);
        return;
      }

      setIsStreamFull(false);

      try {
        const session = await joinAgoraLiveStreamAsViewer(
          currentStream.channelName,
          user.uid,
          viewerVideoContainerRef.current
        );

        if (isCancelled) {
          session.leave().catch(() => {});
          leaveStreamViewer(currentStream.id);
          return;
        }

        activeAudienceSessionRef.current = session;
        hasJoinedViewerRef.current = currentStream.id;
        setIsAudienceJoined(true);
        setIsAudienceConnecting(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('Live viewer initialization notice:', err);
        const errMsg = String(err?.message || err);
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expired')) {
          handleShowToast('Connecting to the live stream...');
        }
        setStreamConnectionError('Unable to connect to the live stream. Please try again.');
        setIsAudienceConnecting(false);
        leaveStreamViewer(currentStream.id);
      }
    };

    setupAudience();

    return () => {
      isCancelled = true;
      if (activeAudienceSessionRef.current) {
        activeAudienceSessionRef.current.leave().catch(() => {});
        activeAudienceSessionRef.current = null;
      }
      if (hasJoinedViewerRef.current) {
        leaveStreamViewer(hasJoinedViewerRef.current);
        hasJoinedViewerRef.current = null;
      }
      setIsAudienceJoined(false);
    };
  }, [currentStream?.id, currentStream?.channelName, isActiveTab, goLiveViewMode, isBroadcasting, user.uid, coins <= 0, retryTrigger]);

  // -------------------------------------------------------------
  // 3b. Viewer Coin Timer: 1 coin per 2 seconds (0.5 coin/sec)
  //     - Deduct 1 coin from local display and Firestore every 2000ms
  //     - Warning toast if coins < 20
  //     - Auto leave & show modal if coins <= 0
  //     - Decrement currentViewers
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isActiveTab || goLiveViewMode !== 'watch' || isBroadcasting || !isAudienceJoined || !currentStream || isStreamFull) {
      return;
    }

    const burnInterval = setInterval(async () => {
      setCoins((prev) => {
        const next = prev - 1;

        // Deduct 1 coin from Firestore directly
        burnViewerCoin(user.uid);

        // When coins < 20, show warning toast
        if (next < 20 && next > 0) {
          handleShowToast(`Low coins, top up! ${next} coins left (${formatTimeLeft(next)})`);
        }

        // When coins <= 0, auto leave, decrement currentViewers, show modal
        if (next <= 0) {
          if (activeAudienceSessionRef.current) {
            activeAudienceSessionRef.current.leave().catch(() => {});
            activeAudienceSessionRef.current = null;
          }
          if (hasJoinedViewerRef.current) {
            leaveStreamViewer(hasJoinedViewerRef.current);
            hasJoinedViewerRef.current = null;
          }
          setIsAudienceJoined(false);
          setShowOutOfCoinsModal(true);
          return 0;
        }

        return next;
      });
    }, 2000);

    return () => {
      clearInterval(burnInterval);
    };
  }, [isActiveTab, goLiveViewMode, isBroadcasting, isAudienceJoined, currentStream?.id, isStreamFull, user.uid]);

  // -------------------------------------------------------------
  // 4. Subscribe to Comments for the currently selected stream
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentStream?.channelName) {
      setComments([]);
      return;
    }

    const unsubComments = subscribeToLiveComments(
      currentStream.channelName,
      (list) => {
        setComments(list);
      }
    );

    return () => unsubComments();
  }, [currentStream?.channelName]);

  // -------------------------------------------------------------
  // 5. Subscribe to Reactions for the currently selected stream
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentStream?.channelName) return;

    const unsubReactions = subscribeToLiveReactions(
      currentStream.channelName,
      () => {
        // Trigger floating heart animation
        const newHeart: FloatingHeartItem = {
          id: Math.random().toString(36).substring(7),
          x: Math.random() * 40 - 20,
          color: 'pink',
        };
        setFloatingHearts((prev) => [...prev.slice(-15), newHeart]);

        // Auto remove after animation completes
        setTimeout(() => {
          setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
        }, 2200);
      }
    );

    return () => unsubReactions();
  }, [currentStream?.channelName]);

  // -------------------------------------------------------------
  // 6. Handle Scroll between multiple live streams
  // -------------------------------------------------------------
  const handleFeedScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, clientHeight } = scrollContainerRef.current;
    if (clientHeight <= 0) return;
    const newIdx = Math.round(scrollTop / clientHeight);
    if (newIdx !== currentStreamIndex && newIdx >= 0 && newIdx < activeStreams.length) {
      setCurrentStreamIndex(newIdx);
    }
  };

  // -------------------------------------------------------------
  // 7. Send Love Reaction (❤️) with 3D Glowing Animation
  // -------------------------------------------------------------
  const handleSendLove = async () => {
    const channelName = isBroadcasting ? broadcastChannelName : currentStream?.channelName;
    if (!channelName) return;

    // Trigger local immediate 3D glowing hearts animation (pink, white, blue)
    const newHearts: FloatingHeartItem[] = [
      {
        id: Math.random().toString(36).substring(7),
        x: Math.random() * 30 - 15,
        color: 'pink',
      },
      {
        id: Math.random().toString(36).substring(7),
        x: Math.random() * 50 - 25,
        color: 'white',
      },
      {
        id: Math.random().toString(36).substring(7),
        x: Math.random() * 40 - 20,
        color: 'blue',
      },
    ];
    setFloatingHearts((prev) => [...prev.slice(-20), ...newHearts]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !newHearts.some((nh) => nh.id === h.id)));
    }, 2200);

    try {
      await sendLiveReaction(channelName, user, '❤️');
    } catch (e) {
      console.warn('Failed to send reaction:', e);
    }
  };

  // Double-tap on video screen performs real love action
  const handleScreenDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 350) {
      lastTapTimeRef.current = 0;
      handleSendLove();
    } else {
      lastTapTimeRef.current = now;
    }
  };

  // Exit Watch Live back to Go Live Selection Screen
  const handleExitWatchLive = async () => {
    if (activeAudienceSessionRef.current) {
      await activeAudienceSessionRef.current.leave().catch(() => {});
      activeAudienceSessionRef.current = null;
    }
    if (hasJoinedViewerRef.current) {
      await leaveStreamViewer(hasJoinedViewerRef.current);
      hasJoinedViewerRef.current = null;
    }
    setIsAudienceJoined(false);
    setGoLiveViewMode('selection');
  };

  // -------------------------------------------------------------
  // 8. Send Live Comment
  // -------------------------------------------------------------
  const handleSendCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const channelName = isBroadcasting ? broadcastChannelName : currentStream?.channelName;
    if (!channelName || !newCommentText.trim() || isSendingComment) return;

    setIsSendingComment(true);
    const textToSend = newCommentText.trim();
    setNewCommentText('');

    try {
      await sendLiveComment(channelName, user, textToSend);
    } catch (e) {
      console.warn('Failed to send live comment:', e);
    } finally {
      setIsSendingComment(false);
    }
  };

  // -------------------------------------------------------------
  // 9. Host Broadcast Lifecycle (Kept intact)
  // -------------------------------------------------------------
  const handleOpenHostModal = () => {
    const defaultTitle = `${user.displayName || user.email?.split('@')[0] || 'User'}'s Live`;
    setHostStreamTitle(defaultTitle);
    setHostErrorMessage(null);
    setShowHostSetupModal(true);
  };

  const handleStartBroadcast = async () => {
    setHostErrorMessage(null);
    setIsStartingBroadcast(true);

    try {
      const { streamId, channelName } = await createLiveStreamDoc(
        user,
        hostStreamTitle
      );
      setBroadcastStreamId(streamId);
      setBroadcastChannelName(channelName);
      setShowHostSetupModal(false);
      setIsBroadcasting(true);

      setTimeout(async () => {
        if (!hostVideoContainerRef.current) return;
        try {
          const session = await startAgoraLiveBroadcast(
            channelName,
            user.uid,
            hostVideoContainerRef.current
          );
          activeHostSessionRef.current = session;
          setIsStartingBroadcast(false);
        } catch (agoraErr: any) {
          console.warn('Host initialization notice:', agoraErr);
          const rawMsg = String(agoraErr?.message || agoraErr);
          let userMsg = 'Unable to connect to the live stream. Please try again.';
          if (
            rawMsg.toLowerCase().includes('camera') ||
            rawMsg.toLowerCase().includes('permission') ||
            rawMsg.toLowerCase().includes('notallowed') ||
            rawMsg.toLowerCase().includes('allow')
          ) {
            userMsg = 'Please allow camera';
            handleShowToast('Please allow camera');
          } else if (rawMsg.toLowerCase().includes('token')) {
            handleShowToast('Connecting to the live stream...');
          }
          setHostErrorMessage(userMsg);
          setIsStartingBroadcast(false);
          setIsBroadcasting(false);
          await endLiveStreamDoc(streamId);
        }
      }, 250);
    } catch (err: any) {
      console.error('Broadcast start error:', err);
      setHostErrorMessage('Unable to connect to the live stream. Please try again.');
      setIsStartingBroadcast(false);
    }
  };

  const handleEndBroadcast = async () => {
    if (activeHostSessionRef.current) {
      await activeHostSessionRef.current.stopHost();
      activeHostSessionRef.current = null;
    }

    if (broadcastStreamId) {
      await endLiveStreamDoc(broadcastStreamId);
    }

    setIsBroadcasting(false);
    setBroadcastStreamId(null);
    setBroadcastChannelName(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  };

  const handleToggleAudio = async () => {
    if (!activeHostSessionRef.current) return;
    const nextState = !isAudioMuted;
    setIsAudioMuted(nextState);
    await activeHostSessionRef.current.toggleAudio(!nextState);
  };

  const handleToggleVideo = async () => {
    if (!activeHostSessionRef.current) return;
    const nextState = !isVideoMuted;
    setIsVideoMuted(nextState);
    await activeHostSessionRef.current.toggleVideo(!nextState);
  };

  // Clean up host on unmount
  useEffect(() => {
    return () => {
      if (activeHostSessionRef.current) {
        activeHostSessionRef.current.stopHost();
        activeHostSessionRef.current = null;
      }
      if (broadcastStreamId) {
        endLiveStreamDoc(broadcastStreamId);
      }
    };
  }, [broadcastStreamId]);

  return (
    <main className="relative z-10 flex h-full w-full flex-1 flex-col overflow-hidden bg-slate-950 font-sans select-none">
      {/* AI Studio Preview Warning Banner */}
      {isAiStudioPreview && (
        <div className="z-40 flex items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-200 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="font-semibold">Live won't work in preview, open in new tab</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95, y: 1 }}
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            className="rounded-full border-t border-white/40 border-b-[2px] border-amber-800 bg-amber-500 px-3 py-1 text-[11px] font-bold text-slate-950 shadow-[0_4px_12px_rgba(245,158,11,0.4)] hover:bg-amber-400 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            Open in New Tab
          </motion.button>
        </div>
      )}

      {/* ========================================================
          CASE 1: USER IS CURRENTLY BROADCASTING AS HOST
      ======================================================== */}
      {isBroadcasting ? (
        <div className="relative flex-1 min-h-0 w-full bg-slate-950 flex flex-col justify-between overflow-hidden">
          {/* Host Camera Video Track Container */}
          <div
            ref={hostVideoContainerRef}
            className="absolute inset-0 h-full w-full object-cover bg-slate-900"
          />

          {/* Broadcast Overlay Header */}
          <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 rounded-full border-t border-white/40 border-b-[2px] border-red-900 bg-red-600 px-2.5 py-1 text-[10px] font-extrabold text-white tracking-widest uppercase shadow-[0_4px_12px_rgba(239,68,68,0.5)]">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                <span>LIVE</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white leading-tight drop-shadow">
                  {hostStreamTitle || 'Your Live Broadcast'}
                </span>
                <span className="text-[10px] text-pink-300 drop-shadow">
                  Host: {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full border-t border-white/30 border-b-[2px] border-black/70 bg-slate-950/80 px-2.5 py-1 text-xs text-amber-300 shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md"
                title="Host Live Earnings: 70% share (0.7 coin per 2s per viewer)"
              >
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono text-[11px] font-bold">+{hostLiveEarnings.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border-t border-white/30 border-b-[2px] border-black/70 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.5)] backdrop-blur-md">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono text-[11px] font-bold">{hostStreamDoc?.currentViewers || 1} / {hostStreamDoc?.maxViewers || 100}</span>
              </div>
            </div>
          </div>

          {/* Floating Reactions on Host Screen */}
          <div className="pointer-events-none absolute bottom-24 right-4 z-30 h-64 w-20 overflow-hidden">
            <AnimatePresence>
              {floatingHearts.map((heart) => (
                <motion.div
                  key={heart.id}
                  initial={{ opacity: 1, y: 180, x: heart.x, scale: 0.6 }}
                  animate={{ opacity: 0, y: 0, x: heart.x * 1.5, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  className="absolute bottom-0 text-pink-500"
                >
                  <Heart className="h-7 w-7 fill-pink-500 text-pink-500 drop-shadow-md" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Bottom Controls for Host */}
          <div className="relative z-20 flex items-center justify-around p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            {/* Mic Toggle */}
            <motion.button
              whileTap={{ scale: 0.9, y: 1 }}
              type="button"
              onClick={handleToggleAudio}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-t border-white/30 border-b-[2px] transition-all cursor-pointer ${
                isAudioMuted
                  ? 'border-red-500/50 border-b-red-900 bg-red-500/20 text-red-400'
                  : 'border-white/30 border-b-black/80 bg-slate-900/80 text-white shadow-lg'
              }`}
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </motion.button>

            {/* Video Toggle */}
            <motion.button
              whileTap={{ scale: 0.9, y: 1 }}
              type="button"
              onClick={handleToggleVideo}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-t border-white/30 border-b-[2px] transition-all cursor-pointer ${
                isVideoMuted
                  ? 'border-red-500/50 border-b-red-900 bg-red-500/20 text-red-400'
                  : 'border-white/30 border-b-black/80 bg-slate-900/80 text-white shadow-lg'
              }`}
              title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </motion.button>

            {/* Tag / Invite Friends */}
            <motion.button
              whileTap={{ scale: 0.9, y: 1 }}
              type="button"
              onClick={handleOpenInviteModal}
              className="flex h-11 w-11 items-center justify-center rounded-full border-t border-white/30 border-b-[2px] border-blue-900/90 bg-blue-500/20 text-blue-300 shadow-lg cursor-pointer"
              title="Tag / Invite friends to live"
            >
              <UserPlus className="h-5 w-5" />
            </motion.button>

            {/* End Broadcast */}
            <motion.button
              whileTap={{ scale: 0.95, y: 1 }}
              type="button"
              onClick={handleEndBroadcast}
              className="rounded-full border-t border-white/40 border-b-[3px] border-red-900 bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(239,68,68,0.4)] cursor-pointer"
            >
              End Stream
            </motion.button>
          </div>
        </div>
      ) : goLiveViewMode === 'selection' ? (
        /* ========================================================
            CASE 2: GO LIVE SELECTION SCREEN (SECTION 13)
            - Smoothly shown when tapping middle Go Live button
            - Large, attractive, curved, glossy 3D "Watch Live" & "Host Live" buttons
            - Physical 3D elevated cards, specular highlights, depth rims
        ======================================================== */
        <div className="relative flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          {/* Ambient Lighting Orbs */}
          <div className="pointer-events-none fixed top-12 -left-20 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl" />
          <div className="pointer-events-none fixed bottom-20 -right-20 h-80 w-80 rounded-full bg-pink-600/15 blur-3xl" />

          {/* Compact 3D Glass Coin Capsule in Top Corner */}
          <div className="absolute top-4 left-4 z-20">
            <motion.button
              whileTap={{ scale: 0.95, y: 1 }}
              type="button"
              onClick={() => setShowOutOfCoinsModal(true)}
              className="flex items-center gap-2 rounded-full border-t border-l border-r border-white/40 border-b-[2px] border-black/80 bg-gradient-to-b from-white/20 via-slate-900/85 to-slate-950/95 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.4)] backdrop-blur-xl transition-all cursor-pointer"
              title="Real Coin Balance • Tap to Top Up"
            >
              <Coins className="h-4 w-4 text-amber-400 drop-shadow" />
              <span className="font-mono text-xs font-extrabold tracking-tight text-white drop-shadow">
                {coins}
              </span>
              <span className="text-[10px] text-pink-300 font-medium">Coins</span>
            </motion.button>
          </div>

          {/* Main 3D Elevated Selection Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm rounded-3xl border-t border-l border-r border-white/30 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950/98 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl flex flex-col items-center"
          >
            {/* Glossy 3D Badge */}
            <div className="flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/15 py-1 px-3.5 text-[11px] font-extrabold text-pink-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
              <Radio className="h-3.5 w-3.5 animate-pulse text-pink-400" />
              <span>TEZOCRON LIVE</span>
            </div>

            {/* Heading & Subtitle */}
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              Live Experience
            </h2>
            <p className="mt-1.5 max-w-xs text-xs text-slate-300 leading-relaxed drop-shadow">
              Connect, interact, and stream in real time with the TEZOCRON community.
            </p>

            {/* TWO LARGE ATTRACTIVE CURVED GLOSSY 3D BUTTONS */}
            <div className="mt-6 w-full flex flex-col gap-3.5">
              {/* 1. WATCH LIVE (Primary 3D Glossy Button) */}
              <motion.button
                whileTap={{ scale: 0.95, y: 3 }}
                type="button"
                onClick={() => setGoLiveViewMode('watch')}
                className="group relative flex w-full items-center justify-between gap-4 rounded-3xl border-t-2 border-l border-r border-white/50 border-b-[5px] border-pink-950/90 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 p-4 text-left text-white shadow-[0_16px_36px_rgba(236,72,153,0.4),inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all hover:brightness-110 cursor-pointer"
              >
                {/* Specular highlight rim */}
                <div className="pointer-events-none absolute inset-x-4 top-1 h-[2px] rounded-full bg-gradient-to-r from-white/90 via-white/50 to-transparent" />

                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)] backdrop-blur-md">
                    <Radio className="h-6 w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      Watch Live
                    </span>
                    <span className="truncate text-[11px] font-medium text-white/85">
                      {activeStreams.length > 0
                        ? `${activeStreams.length} stream${activeStreams.length === 1 ? '' : 's'} live now`
                        : 'Explore real-time community streams'}
                    </span>
                  </div>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/15 shadow-sm group-hover:translate-x-0.5 transition-transform">
                  <ChevronDown className="h-4 w-4 -rotate-90 text-white" />
                </div>
              </motion.button>

              {/* 2. HOST LIVE (Curved Glossy 3D Button) */}
              <motion.button
                whileTap={{ scale: 0.95, y: 3 }}
                type="button"
                onClick={() => setShowHostInfoModal(true)}
                className="group relative flex w-full items-center justify-between gap-4 rounded-3xl border-t-2 border-l border-r border-white/30 border-b-[5px] border-black/90 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 p-4 text-left text-white shadow-[0_14px_32px_rgba(0,0,0,0.7),inset_0_1.5px_2px_rgba(255,255,255,0.3)] backdrop-blur-xl transition-all hover:bg-slate-900 hover:brightness-110 cursor-pointer"
              >
                {/* Specular highlight rim */}
                <div className="pointer-events-none absolute inset-x-4 top-1 h-[2px] rounded-full bg-gradient-to-r from-white/50 via-white/20 to-transparent" />

                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-tr from-pink-500/20 to-blue-500/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] backdrop-blur-md">
                    <Sparkles className="h-6 w-6 text-pink-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      Host Live
                    </span>
                    <span className="truncate text-[11px] font-medium text-slate-400">
                      Broadcast live to TEZOCRON members
                    </span>
                  </div>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-sm group-hover:translate-x-0.5 transition-transform">
                  <ChevronDown className="h-4 w-4 -rotate-90 text-slate-300" />
                </div>
              </motion.button>
            </div>
          </motion.div>
        </div>
      ) : (
        /* ========================================================
            CASE 3: IMMERSIVE FULL-SCREEN WATCH LIVE EXPERIENCE
            - Full-screen live video main focus
            - No normal app header
            - Small curved 3D exit button at top-right (returns to selection screen)
            - Small 3D/glass coin balance capsule at top-left
            - Left-side controls (❤️ Love, 💬 Comments, 🎁 Gift, 👥 Invite)
            - Double-tap anywhere on screen triggers real love reaction
            - 3D glowing floating hearts
        ======================================================== */
        <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col bg-black">
          {/* Top-Right Small Curved 3D Exit Button */}
          <motion.button
            whileTap={{ scale: 0.9, y: 1.5 }}
            type="button"
            onClick={handleExitWatchLive}
            className="absolute top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-black/80 bg-gradient-to-b from-white/20 via-slate-900/85 to-slate-950/95 shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.5)] backdrop-blur-xl text-white transition-all hover:brightness-125 cursor-pointer"
            aria-label="Exit Live Stream"
            title="Exit to Go Live Menu"
          >
            <X className="h-5 w-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </motion.button>

          {/* Top-Left Small Curved 3D/Glass Coin Balance Capsule */}
          <motion.button
            whileTap={{ scale: 0.95, y: 1 }}
            type="button"
            onClick={() => setShowOutOfCoinsModal(true)}
            className={`absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full border-t border-l border-r border-white/40 border-b-[2px] border-black/80 px-3.5 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.4)] backdrop-blur-xl transition-all cursor-pointer ${
              coins < 20
                ? 'bg-gradient-to-b from-rose-500/30 via-slate-900/85 to-slate-950/95 text-rose-300 ring-2 ring-rose-500/40'
                : 'bg-gradient-to-b from-white/20 via-slate-900/85 to-slate-950/95 text-pink-300'
            }`}
            title="Real Coin Balance • Tap to Top Up"
          >
            <Coins className="h-4 w-4 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="font-mono text-xs font-black tracking-tight text-white drop-shadow">
              {coins}
            </span>
            <span className="text-[10px] text-pink-300/80 font-semibold hidden sm:inline">
              • {formatTimeLeft(coins)}
            </span>
            {coins < 20 && (
              <span className="rounded-full bg-pink-500 px-1.5 py-0.2 text-[9px] font-extrabold text-white uppercase shadow-sm">
                Top Up
              </span>
            )}
          </motion.button>

          {loadingStreams ? (
            /* Loading State */
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-slate-950">
              <Loader2 className="h-8 w-8 animate-spin text-pink-500 drop-shadow-[0_2px_8px_rgba(236,72,153,0.6)]" />
              <p className="mt-3 text-xs text-slate-400">Loading your information...</p>
            </div>
          ) : activeStreams.length === 0 ? (
            /* CASE B: 0 ACTIVE STREAMS -> EXACT "No live stream yet." */
            <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center bg-slate-950">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border-t border-l border-r border-white/30 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/90 to-slate-950 shadow-2xl backdrop-blur-xl">
                <Radio className="h-10 w-10 text-pink-400 drop-shadow-[0_2px_8px_rgba(236,72,153,0.5)]" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-white drop-shadow">
                No live stream yet.
              </h3>
              <p className="mt-1.5 max-w-xs text-xs text-slate-400">
                There are currently no active live streams. Check back soon or return to the menu.
              </p>
              <motion.button
                whileTap={{ scale: 0.95, y: 2 }}
                type="button"
                onClick={handleExitWatchLive}
                className="mt-6 flex items-center gap-2 rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-pink-900 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 px-6 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(236,72,153,0.35),inset_0_1px_2px_rgba(255,255,255,0.6)] cursor-pointer"
              >
                <span>Back to Selection</span>
              </motion.button>
            </div>
          ) : (
            /* CASE C: REAL ACTIVE STREAMS -> VERTICALLY SCROLLABLE FEED */
            <div
              ref={scrollContainerRef}
              onScroll={handleFeedScroll}
              className="relative flex-1 min-h-0 w-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
            >
              {activeStreams.map((stream, idx) => {
                const isSelected = idx === currentStreamIndex;

                return (
                  <div
                    key={stream.id}
                    className="relative h-full w-full snap-start snap-always shrink-0 flex flex-col justify-between overflow-hidden bg-black"
                  >
                    {/* Live Stream Remote Video Container with Double-Tap Detection */}
                    <div
                      ref={isSelected ? viewerVideoContainerRef : null}
                      onClick={handleScreenDoubleTap}
                      className="absolute inset-0 h-full w-full object-cover bg-slate-950 flex items-center justify-center cursor-pointer"
                    >
                      {isAudienceConnecting && isSelected && !isStreamFull && (
                        <div className="absolute z-10 flex flex-col items-center gap-2 text-center text-slate-400 pointer-events-none">
                          <Loader2 className="h-7 w-7 animate-spin text-pink-500" />
                          <span className="text-xs">Connecting to the live stream...</span>
                        </div>
                      )}

                      {/* Connection Error Retry Overlay */}
                      {streamConnectionError && isSelected && !isStreamFull && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-md">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-md">
                            <AlertTriangle className="h-7 w-7" />
                          </div>
                          <h4 className="text-base font-bold text-white">Connection Issue</h4>
                          <p className="mt-1 max-w-xs text-xs text-slate-400">
                            Unable to connect to the live stream. Please try again.
                          </p>
                          <motion.button
                            whileTap={{ scale: 0.95, y: 1 }}
                            type="button"
                            onClick={() => {
                              setStreamConnectionError(null);
                              setRetryTrigger((prev) => prev + 1);
                            }}
                            className="mt-4 flex items-center gap-2 rounded-full border-t border-white/40 border-b-[3px] border-pink-900 bg-gradient-to-r from-blue-600 to-pink-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Retry</span>
                          </motion.button>
                        </div>
                      )}

                      {/* Stream Full Capacity Block Notice */}
                      {isStreamFull && isSelected && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-md">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                            <Users className="h-7 w-7" />
                          </div>
                          <h4 className="text-base font-bold text-white">Stream at Capacity</h4>
                          <p className="mt-1 max-w-xs text-xs text-slate-400">
                            This live stream has reached the maximum capacity of {activeStreamDoc?.maxViewers || stream.maxViewers || 100} viewers.
                          </p>
                          {activeStreams.length > 1 && (
                            <motion.button
                              whileTap={{ scale: 0.95, y: 1 }}
                              type="button"
                              onClick={() => {
                                if (activeStreams.length > currentStreamIndex + 1) {
                                  setCurrentStreamIndex(currentStreamIndex + 1);
                                } else {
                                  setCurrentStreamIndex(0);
                                }
                              }}
                              className="mt-4 rounded-full border-t border-white/40 border-b-[2px] border-pink-900 bg-gradient-to-r from-pink-600 to-pink-500 px-5 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                            >
                              Watch Another Stream
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Streamer Info & LIVE Badge (Clean translucent 3D pill positioned below top bar) */}
                    <div className="absolute top-16 left-4 z-30 flex items-center gap-2 rounded-full border-t border-l border-r border-white/30 border-b-[2px] border-black/70 bg-slate-950/70 p-1.5 pr-3 shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_1.5px_rgba(255,255,255,0.3)] backdrop-blur-xl">
                      {stream.hostPhoto ? (
                        <img
                          src={stream.hostPhoto}
                          alt={stream.hostName}
                          className="h-8 w-8 rounded-full object-cover border border-white/25 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-pink-500 text-xs font-bold text-white shadow-md">
                          {stream.hostName?.[0]?.toUpperCase() || 'S'}
                        </div>
                      )}

                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="text-xs font-bold text-white leading-tight truncate max-w-[110px] drop-shadow">
                          {stream.hostName}
                        </span>
                        <span className="text-[10px] text-slate-300 truncate max-w-[110px]">
                          {stream.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-extrabold text-white tracking-wider uppercase shadow-md shadow-red-600/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        <span>LIVE</span>
                      </div>

                      <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                        <Users className="h-3 w-3 text-blue-400" />
                        <span>{isSelected ? (activeStreamDoc?.currentViewers ?? stream.currentViewers ?? 1) : (stream.currentViewers ?? 1)}</span>
                      </div>
                    </div>

                    {/* Scroll indicator if multiple streams exist */}
                    {activeStreams.length > 1 && idx < activeStreams.length - 1 && (
                      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-[10px] text-white/70 animate-bounce drop-shadow">
                        <span>Scroll for next stream</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {/* 3D FLOATING GLOWING REACTIONS ANIMATION */}
                    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
                      <AnimatePresence>
                        {floatingHearts.map((heart) => (
                          <motion.div
                            key={heart.id}
                            initial={{ opacity: 1, y: '75%', x: heart.x + 40, scale: 0.6 }}
                            animate={{
                              opacity: 0,
                              y: '15%',
                              x: heart.x * 2.5 + 40,
                              scale: 1.5,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2, ease: 'easeOut' }}
                            className="absolute bottom-0"
                          >
                            <div className="relative">
                              <Heart
                                className={`drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] ${
                                  heart.color === 'white'
                                    ? 'h-8 w-8 fill-white text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.9)]'
                                    : heart.color === 'blue'
                                    ? 'h-9 w-9 fill-blue-400 text-blue-400 drop-shadow-[0_2px_12px_rgba(59,130,246,0.9)]'
                                    : 'h-10 w-10 fill-pink-500 text-pink-500 drop-shadow-[0_2px_12px_rgba(236,72,153,0.9)]'
                                }`}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* ========================================================
                        LEFT-SIDE CONTROLS (❤️ Love, 💬 Comments, 🎁 Gift, 👥 Invite)
                        Placed on the LEFT side per Section 6 requirement.
                        Glossy, curved, elevated, physical 3D buttons.
                    ======================================================== */}
                    <div className="absolute left-4 bottom-28 z-30 flex flex-col items-center gap-3.5">
                      {/* 1. ❤️ Love Button */}
                      <motion.button
                        whileTap={{ scale: 0.88, y: 2 }}
                        type="button"
                        onClick={handleSendLove}
                        className="group flex flex-col items-center gap-1 cursor-pointer"
                        aria-label="Love"
                        title="Send Love (or double-tap screen)"
                      >
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-pink-900/90 bg-gradient-to-b from-pink-500/35 via-slate-900/80 to-slate-950/95 text-pink-500 shadow-[0_8px_20px_rgba(236,72,153,0.35),inset_0_1.5px_2px_rgba(255,255,255,0.6)] backdrop-blur-xl transition-all group-hover:scale-105 group-hover:brightness-110">
                          <Heart className="h-6 w-6 fill-pink-500 text-pink-500 drop-shadow-[0_2px_6px_rgba(236,72,153,0.8)]" />
                        </div>
                        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
                          Love
                        </span>
                      </motion.button>

                      {/* 2. 💬 Comments Button */}
                      <motion.button
                        whileTap={{ scale: 0.88, y: 2 }}
                        type="button"
                        onClick={() => setShowCommentsSheet(true)}
                        className="group flex flex-col items-center gap-1 cursor-pointer"
                        aria-label="Comments"
                        title="View & Post Comments"
                      >
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-blue-950/90 bg-gradient-to-b from-blue-500/30 via-slate-900/80 to-slate-950/95 text-blue-300 shadow-[0_8px_20px_rgba(37,99,235,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.6)] backdrop-blur-xl transition-all group-hover:scale-105 group-hover:brightness-110">
                          <MessageCircle className="h-5 w-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                          {comments.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-black text-white shadow-md">
                              {comments.length > 99 ? '99+' : comments.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
                          Comments
                        </span>
                      </motion.button>

                      {/* 3. 🎁 Gift Button */}
                      <motion.button
                        whileTap={{ scale: 0.88, y: 2 }}
                        type="button"
                        onClick={() => setShowGiftModal(true)}
                        className="group flex flex-col items-center gap-1 cursor-pointer"
                        aria-label="Gift"
                        title="Gift"
                      >
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-amber-950/90 bg-gradient-to-b from-amber-500/30 via-slate-900/80 to-slate-950/95 text-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.6)] backdrop-blur-xl transition-all group-hover:scale-105 group-hover:brightness-110">
                          <Gift className="h-5 w-5 text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </div>
                        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
                          Gift
                        </span>
                      </motion.button>

                      {/* 4. 👥 Invite Button */}
                      <motion.button
                        whileTap={{ scale: 0.88, y: 2 }}
                        type="button"
                        onClick={handleOpenInviteModal}
                        className="group flex flex-col items-center gap-1 cursor-pointer"
                        aria-label="Invite"
                        title="Tag Friends to Join Live"
                      >
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-t border-l border-r border-white/40 border-b-[3px] border-cyan-950/90 bg-gradient-to-b from-cyan-500/30 via-slate-900/80 to-slate-950/95 text-cyan-300 shadow-[0_8px_20px_rgba(6,182,212,0.3),inset_0_1.5px_2px_rgba(255,255,255,0.6)] backdrop-blur-xl transition-all group-hover:scale-105 group-hover:brightness-110">
                          <UserPlus className="h-5 w-5 text-cyan-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </div>
                        <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
                          Invite
                        </span>
                      </motion.button>
                    </div>

                    {/* Stream Info / Title at Bottom */}
                    <div className="pointer-events-none absolute bottom-28 left-22 right-4 z-20 flex flex-col text-left">
                      <div className="inline-block max-w-sm rounded-2xl border-t border-l border-r border-white/20 border-b-[2px] border-black/60 bg-slate-950/60 p-2.5 backdrop-blur-md shadow-lg">
                        <p className="text-xs font-bold text-white drop-shadow truncate">
                          {stream.title}
                        </p>
                        <p className="text-[10px] font-medium text-pink-300 drop-shadow mt-0.5">
                          Host: {stream.hostName} • TEZOCRON Live
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          COMMENTS BOTTOM SHEET (REAL COMMENTS FROM FIRESTORE)
          - Curved 3D glass panel
          - Real comments only
          - Small 3D curved send button
      ======================================================== */}
      <AnimatePresence>
        {showCommentsSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs">
            <div
              className="flex-1"
              onClick={() => setShowCommentsSheet(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative max-h-[65vh] w-full rounded-t-3xl border-t border-l border-r border-white/30 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black p-4 shadow-[0_-16px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-white">Live Comments</h4>
                  <span className="text-xs text-slate-400">({comments.length})</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowCommentsSheet(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[160px] max-h-[300px]">
                {comments.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">
                    No comments yet. Be the first to say hello!
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5 text-xs">
                      {c.userPhoto ? (
                        <img
                          src={c.userPhoto}
                          alt={c.userName}
                          className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5 border border-white/15"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-pink-600 text-[10px] font-bold text-white mt-0.5 shadow-sm">
                          {c.userName[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-pink-300">
                          {c.userName}
                        </span>
                        <span className="text-white mt-0.5 text-xs leading-relaxed">{c.text}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Send Comment Input */}
              <form
                onSubmit={handleSendCommentSubmit}
                className="mt-2 flex items-center gap-2 pt-2 border-t border-white/10"
              >
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Type a comment..."
                  className="flex-1 rounded-full border border-white/15 bg-slate-950/90 px-4 py-2.5 text-xs text-white placeholder-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] focus:border-pink-500 focus:outline-none"
                  maxLength={200}
                />
                <motion.button
                  whileTap={{ scale: 0.9, y: 1 }}
                  type="submit"
                  disabled={!newCommentText.trim() || isSendingComment}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-t border-white/50 border-b-[2px] border-pink-900 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-500 text-white shadow-[0_4px_12px_rgba(236,72,153,0.4),inset_0_1px_2px_rgba(255,255,255,0.6)] disabled:opacity-40 transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  {isSendingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 drop-shadow" />
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          HOST LIVE NOTICE MODAL (SECTION 13)
          "Do NOT build the Host Live functionality yet.
           The Watch Live option must navigate into the real Watch Live system."
      ======================================================== */}
      <AnimatePresence>
        {showHostInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border-t border-l border-r border-white/35 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowHostInfoModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-t border-l border-r border-white/30 border-b-[3px] border-pink-900/90 bg-gradient-to-tr from-pink-500/20 to-blue-500/20 text-pink-400 shadow-[0_8px_20px_rgba(236,72,153,0.3)]">
                <Radio className="h-7 w-7 animate-pulse text-pink-400" />
              </div>

              <h3 className="text-lg font-black tracking-tight text-white">
                Host Live Broadcast
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Host Live broadcasting is being prepared for upcoming release. In the meantime, you can explore, watch, and interact with active community live streams!
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.95, y: 2 }}
                  type="button"
                  onClick={() => {
                    setShowHostInfoModal(false);
                    setGoLiveViewMode('watch');
                  }}
                  className="flex items-center justify-center gap-2 rounded-full border-t border-l border-r border-white/50 border-b-[3px] border-pink-900 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 py-3 text-xs font-bold text-white shadow-[0_8px_24px_rgba(236,72,153,0.4),inset_0_1px_2px_rgba(255,255,255,0.6)] cursor-pointer"
                >
                  <Radio className="h-4 w-4" />
                  <span>Watch Live Instead</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95, y: 1 }}
                  type="button"
                  onClick={() => setShowHostInfoModal(false)}
                  className="rounded-full border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          GIFT INTERACTION LOCATION (EMPTY PER STEP 17 INSTRUCTION)
          - Curved 3D glass card
          - Real balance preserved
          - No fake gifts or animations
      ======================================================== */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border-t border-l border-r border-white/35 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-t border-l border-r border-white/30 border-b-[3px] border-amber-950/90 bg-amber-500/15 text-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.3)]">
                <Gift className="h-7 w-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
              </div>

              <h3 className="text-lg font-black tracking-tight text-white">Gifts Area</h3>

              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                This designated gift interaction area is reserved for the upcoming official TEZOCRON EXTENDED release.
              </p>

              <div className="mt-6">
                <motion.button
                  whileTap={{ scale: 0.95, y: 1 }}
                  type="button"
                  onClick={() => setShowGiftModal(false)}
                  className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          HOST BROADCAST MODAL (EXPLICIT INITIATION)
      ======================================================== */}
      <AnimatePresence>
        {showHostSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl border-t border-l border-r border-white/35 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowHostSetupModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-t border-l border-r border-white/30 border-b-[3px] border-pink-900/90 bg-pink-500/15 text-pink-400 shadow-[0_8px_20px_rgba(236,72,153,0.3)]">
                <Radio className="h-7 w-7 text-pink-400" />
              </div>

              <h3 className="text-lg font-black text-white">
                Start Live Broadcast
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Broadcast live to TEZOCRON EXTENDED members in real time.
              </p>

              {hostErrorMessage && (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 text-left">
                  {hostErrorMessage}
                </div>
              )}

              <div className="mt-4 text-left">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Stream Topic / Title
                </label>
                <input
                  type="text"
                  value={hostStreamTitle}
                  onChange={(e) => setHostStreamTitle(e.target.value)}
                  placeholder="e.g. Live Q&A and Chat"
                  className="w-full rounded-2xl border border-white/15 bg-slate-950/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                  maxLength={80}
                />
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowHostSetupModal(false)}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartBroadcast}
                  disabled={isStartingBroadcast}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full border-t border-white/40 border-b-[3px] border-pink-900 bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isStartingBroadcast ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="h-3.5 w-3.5" />
                      <span>Go Live</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          TAG / INVITE TO JOIN LIVE MODAL
          - Curved 3D glass card with depth
          - Search bar with specular highlight
          - Real notification dispatched to target member
      ======================================================== */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <div className="fixed inset-0" onClick={() => setShowInviteModal(false)} />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative z-10 flex h-[75vh] sm:h-[550px] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border-t border-l border-r border-white/35 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border-t border-l border-r border-white/30 border-b-[2px] border-blue-900/90 bg-blue-500/20 text-blue-400 shadow-md">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight leading-none">
                      Tag to Join Live
                    </h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Send real live stream notifications to members
                    </span>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Search Bar */}
              <div className="p-3 border-b border-white/5">
                <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/90 px-3.5 py-2 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    placeholder="Search TEZOCRON members..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {inviteSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setInviteSearchQuery('')}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Users List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingInviteUsers ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                    <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                    <span>Loading members...</span>
                  </div>
                ) : inviteUsersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 text-xs">
                    <Users className="h-8 w-8 text-slate-500 mb-2" />
                    <span>No members found to invite</span>
                  </div>
                ) : (
                  inviteUsersList
                    .filter((u) =>
                      u.displayName
                        .toLowerCase()
                        .includes(inviteSearchQuery.toLowerCase().trim())
                    )
                    .map((targetMember) => {
                      const isInvited = invitedUserIds.has(targetMember.uid);

                      return (
                        <div
                          key={targetMember.uid}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-2.5 transition-colors hover:border-white/20 shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {targetMember.photoURL ? (
                              <img
                                src={targetMember.photoURL}
                                alt={targetMember.displayName}
                                className="h-9 w-9 rounded-xl object-cover border border-white/15"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-pink-600 text-xs font-bold text-white shrink-0 shadow">
                                {targetMember.displayName[0]?.toUpperCase() || 'M'}
                              </div>
                            )}

                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-xs font-bold text-white">
                                {targetMember.displayName}
                              </span>
                              <span className="text-[10px] text-pink-400 font-semibold">
                                {targetMember.role || 'Member'}
                              </span>
                            </div>
                          </div>

                          <motion.button
                            whileTap={{ scale: 0.92, y: 1 }}
                            type="button"
                            onClick={() => handleSendLiveInvite(targetMember)}
                            disabled={isInvited}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                              isInvited
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                                : 'border-t border-l border-r border-white/40 border-b-[2px] border-pink-900 bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-[0_4px_12px_rgba(236,72,153,0.3)]'
                            }`}
                          >
                            {isInvited ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span>Tagged ✓</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3 w-3" />
                                <span>Tag to Join</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-white/10 p-3 bg-slate-950/70 text-center">
                <span className="text-[10px] text-slate-400">
                  Tagged members receive an instant notification with live stream access.
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          OUT OF COINS MODAL (PAYSTACK TOP UP)
          - Keeps Paystack price: 7200 coins for 15,000 Naira
          - Conversion: 100 Naira = 48 coins
          - Burn rate: 1 coin per 2 seconds (0.5 coin/sec)
      ======================================================== */}
      <AnimatePresence>
        {showOutOfCoinsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border-t border-l border-r border-white/35 border-b-[4px] border-black/80 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.3)] backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowOutOfCoinsModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-t border-l border-r border-white/30 border-b-[3px] border-amber-950/90 bg-amber-500/15 text-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.3)]">
                <Coins className="h-7 w-7 animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-white tracking-tight">
                Out of coins
              </h3>
              <p className="mt-1 text-xs text-amber-300 font-bold">
                Top up 7200 coins for 15000 Naira
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 p-3.5 text-left space-y-2 shadow-inner">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Package:</span>
                  <span className="font-bold text-white">7,200 Coins</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Price:</span>
                  <span className="font-bold text-amber-400">₦15,000 Naira</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-white/10">
                  <span className="text-slate-400">Conversion:</span>
                  <span className="text-slate-300 font-mono">100 Naira = 48 Coins</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Burn Rate:</span>
                  <span className="text-slate-300 font-mono">1 coin / 2 sec (0.5/s)</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Total Watch Time:</span>
                  <span className="text-slate-300 font-mono">⏱️ 4 Hours per package</span>
                </div>
              </div>

              {/* Paystack Button */}
              <div className="mt-6 flex flex-col gap-2.5">
                <motion.a
                  whileTap={{ scale: 0.95, y: 2 }}
                  href="https://paystack.shop/pay/tazo-card"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full border-t border-l border-r border-white/50 border-b-[3px] border-pink-900 bg-gradient-to-r from-amber-500 via-pink-600 to-pink-500 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_8px_24px_rgba(236,72,153,0.35),inset_0_1px_2px_rgba(255,255,255,0.6)] cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Top up 7200 coins for 15000 Naira</span>
                </motion.a>
                <motion.button
                  whileTap={{ scale: 0.95, y: 1 }}
                  type="button"
                  onClick={() => setShowOutOfCoinsModal(false)}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          >
            <div className="flex items-center gap-2 rounded-full border border-pink-500/40 bg-slate-900/95 px-4 py-2 text-xs font-bold text-white shadow-xl shadow-pink-500/20 backdrop-blur-xl">
              <Check className="h-4 w-4 text-pink-400" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
