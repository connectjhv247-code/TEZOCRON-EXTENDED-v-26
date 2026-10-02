import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Plus,
  Mic,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  Camera,
  X,
  Copy,
  Flag,
  AlertCircle,
  Check,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  ChatMessage,
  subscribeToGlobalChat,
  sendChatMessage,
  uploadChatImage,
  uploadVoiceAudio,
  deleteChatMessage,
  reportChatMessage,
  setTypingStatus,
  subscribeToTyping,
  subscribeToAllPresence,
  formatLastSeen,
} from '../lib/chatService';
import {
  db,
  ref,
  push,
  onValue,
  set,
  serverTimestamp,
  UserPresence,
  DEFAULT_CHAT_ID,
} from '../lib/firebase-realtime';
import {
  startAgoraVoiceRecording,
  stopAgoraVoiceRecording,
  cancelAgoraVoiceRecording,
  AgoraVoiceSession,
} from '../lib/agora';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { fetchUserProfile } from '../lib/profileService';
import ReportAccountModal from './ReportAccountModal';

interface SocialChatScreenProps {
  user: FirebaseUser;
  onBack: () => void;
  hideHeader?: boolean;
}

export default function SocialChatScreen({ user, onBack, hideHeader = false }: SocialChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});

  const [userProfile, setUserProfile] = useState<{ name: string; photo: string }>({
    name: user.displayName || user.email?.split('@')[0] || 'Member',
    photo: user.photoURL || '',
  });

  // Attachment mini-popup state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Active message actions menu
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

  // Report message modal state
  const [reportModalMessage, setReportModalMessage] = useState<ChatMessage | null>(null);

  // Enlarged photo preview modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingVolume, setRecordingVolume] = useState(10);
  const [voiceSession, setVoiceSession] = useState<AgoraVoiceSession | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // User-facing feedback toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Typing debounce & stop timers
  const typingDebounceTimer = useRef<number | null>(null);
  const typingStopTimer = useRef<number | null>(null);

  // Refs for file inputs and message scroll
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load current authenticated user profile
  useEffect(() => {
    let isMounted = true;
    fetchUserProfile(user.uid)
      .then((profile) => {
        if (isMounted && profile) {
          setUserProfile({
            name: profile.full_name || profile.display_name || user.displayName || 'Member',
            photo: profile.photo_url || user.photoURL || '',
          });
        }
      })
      .catch((err) => {
        console.warn('Profile fetch notice:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 4. Fix connection listener - add timeout:
  useEffect(() => {
    let timeout = setTimeout(() => setIsConnecting(false), 5000);
    const connectedRef = ref(db, ".info/connected");
    const unsubscribe = onValue(connectedRef, (snap) => {
      clearTimeout(timeout);
      if (snap.val() === true) {
        setIsConnecting(false);
        // 5. After fix, push initial data to DB to remove null:
        set(ref(db, "test"), { created: Date.now() }).catch(() => {});
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // 2. CHAT MESSAGES: Subscribe to real-time chat messages via onChildAdded
  useEffect(() => {
    setLoading(true);
    const emptySafetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribe = subscribeToGlobalChat((incomingMessages) => {
      clearTimeout(emptySafetyTimer);
      setMessages(incomingMessages);
      setLoading(false);
    });
    return () => {
      clearTimeout(emptySafetyTimer);
      unsubscribe();
    };
  }, []);

  // 3. TYPING INDICATOR: Listen for other users typing in realtime
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToTyping(DEFAULT_CHAT_ID, user.uid, (typingNames) => {
      setTypingUsers(typingNames);
    });
    return () => unsubscribe();
  }, [user]);

  // 4. ONLINE PRESENCE: Listen to all user presences in realtime
  useEffect(() => {
    const unsubscribe = subscribeToAllPresence((map) => {
      setPresenceMap(map);
    });
    return () => unsubscribe();
  }, []);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceTimer.current) window.clearTimeout(typingDebounceTimer.current);
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (user?.uid) {
        setTypingStatus(DEFAULT_CHAT_ID, user.uid, userProfile.name, false);
      }
    };
  }, [user, userProfile.name]);

  // Smooth scroll to bottom on new messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [loading, messages.length, scrollToBottom]);

  // Scroll to bottom when someone starts typing
  useEffect(() => {
    if (typingUsers.length > 0) {
      scrollToBottom(true);
    }
  }, [typingUsers.length, scrollToBottom]);

  // Auto scroll to bottom when viewport resizes (e.g. keyboard opens)
  useEffect(() => {
    const handleViewportResize = () => {
      scrollToBottom(true);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
    };
  }, [scrollToBottom]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (voiceSession) {
        cancelAgoraVoiceRecording(voiceSession).catch(() => {});
      }
    };
  }, [voiceSession]);

  // 3. TYPING INDICATOR: Handle input changes with 500ms debounce & 2s timeout
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const textVal = e.target.value;
    setInputText(textVal);

    if (!user?.uid) return;

    // Debounce typing event by 500ms
    if (typingDebounceTimer.current) {
      window.clearTimeout(typingDebounceTimer.current);
    }

    if (textVal.trim().length > 0) {
      typingDebounceTimer.current = window.setTimeout(() => {
        setTypingStatus(DEFAULT_CHAT_ID, user.uid, userProfile.name, true);
      }, 500);
    } else {
      setTypingStatus(DEFAULT_CHAT_ID, user.uid, userProfile.name, false);
    }

    // Automatically stop typing after 2 seconds of no input
    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = window.setTimeout(() => {
      setTypingStatus(DEFAULT_CHAT_ID, user.uid, userProfile.name, false);
    }, 2000);
  };

  // 2. CHAT MESSAGES: Send Text Message
  // Fix send button loading forever in SocialChat:
  const chatId = DEFAULT_CHAT_ID;

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    // 1. At the top: setIsSending(true)
    setIsSending(true);

    // Immediately clear typing status
    if (typingDebounceTimer.current) window.clearTimeout(typingDebounceTimer.current);
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    setTypingStatus(chatId, user.uid, userProfile.name, false);

    // 2. Wrap the firebase push in try/catch:
    try {
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      await push(messagesRef, {
        senderId: auth.currentUser?.uid || user.uid,
        displayName: userProfile.name,
        text: text,
        timestamp: serverTimestamp(),
        imageUrl: '',
        photoURL: userProfile.photo || '',
        messageType: 'text',
      });
      setInputText(""); // CLEAR INPUT HERE
      setShowAttachmentMenu(false);
      scrollToBottom(true);
    } catch (err) {
      console.error(err);
      showToast('Unable to send message. Please try again.', 'error');
    } finally {
      setIsSending(false); // MUST stop loading here
    }
  };

  const handleSend = handleSendMessage;
  const handleSendText = handleSendMessage;

  // Handle Enter key -> handleSend
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start Voice Recording via Agora RTC
  const handleStartRecording = async () => {
    setShowAttachmentMenu(false);
    try {
      const session = await startAgoraVoiceRecording(user.uid, (vol) => {
        setRecordingVolume(vol);
      });
      setVoiceSession(session);
      setIsRecording(true);
      setRecordingDuration(0);

      if (session.isFallback) {
        showToast('Microphone not detected. Recording with simulated audio.', 'info');
      }

      const interval = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      recordingTimerRef.current = interval;
    } catch (err: unknown) {
      console.warn('Microphone error:', err);
      showToast(
        'Microphone access is needed for voice messages. Please check your browser permissions.',
        'error'
      );
    }
  };

  // Cancel Voice Recording
  const handleCancelRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (voiceSession) {
      await cancelAgoraVoiceRecording(voiceSession);
      setVoiceSession(null);
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // Finish & Send Voice Recording
  const handleFinishRecording = async () => {
    if (!voiceSession) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsSending(true);
    setIsRecording(false);

    try {
      const { audioBlob, durationSeconds } = await stopAgoraVoiceRecording(voiceSession);
      setVoiceSession(null);

      // Upload audio to Firebase Storage
      const audioUrl = await uploadVoiceAudio(audioBlob, user.uid);

      // Send chat message to Firebase Realtime Database
      await sendChatMessage({
        userId: user.uid,
        senderName: userProfile.name,
        senderPhoto: userProfile.photo,
        content: `Voice message (${durationSeconds}s)`,
        messageType: 'voice',
        mediaUrl: audioUrl,
        duration: durationSeconds,
      });

      scrollToBottom(true);
    } catch (err: any) {
      showToast("We couldn't upload your media. Please try again.", 'error');
    } finally {
      setIsSending(false);
      setRecordingDuration(0);
    }
  };

  // Handle Photo / Media Upload
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachmentMenu(false);
    setUploadingMedia(true);
    try {
      const imageUrl = await uploadChatImage(file, user.uid);
      await sendChatMessage({
        userId: user.uid,
        senderName: userProfile.name,
        senderPhoto: userProfile.photo,
        content: 'Shared an image',
        messageType: 'image',
        mediaUrl: imageUrl,
      });
      scrollToBottom(true);
    } catch (err: any) {
      showToast("We couldn't upload your media. Please try again.", 'error');
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  // Delete message from Realtime Database
  const handleDeleteMessage = async (messageId: string, authorId: string) => {
    setActiveMenuMessageId(null);
    if (authorId !== user.uid) {
      showToast('You can only delete your own messages.', 'error');
      return;
    }

    try {
      await deleteChatMessage(messageId, user.uid);
      showToast('Message deleted');
    } catch {
      showToast('Failed to delete message.', 'error');
    }
  };

  // Report message
  const handleReportMessage = (messageId: string) => {
    setActiveMenuMessageId(null);
    const targetMsg = messages.find((m) => m.id === messageId);
    if (targetMsg) {
      setReportModalMessage(targetMsg);
    }
  };

  // Copy message text
  const handleCopyText = (content: string) => {
    setActiveMenuMessageId(null);
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard');
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Count active online users
  const onlineCount = Object.values(presenceMap).filter((p) => p.online).length;

  return (
    <div
      ref={chatContainerRef}
      className="flex flex-1 min-h-0 w-full flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
    >
      {/* ========================================================
          1. TOP NAVIGATION HEADER / CHAT STATUS BAR
      ======================================================== */}
      {!hideHeader ? (
        <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-95"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                  Social Chat
                </h1>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online ({onlineCount || 1})</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                TEZOCRON Realtime Community
              </p>
            </div>
          </div>

          {/* User Identity Avatar */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-white max-w-[110px] truncate">
                {userProfile.name}
              </span>
              <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            </div>

            <div className="relative">
              <div className="h-8 w-8 rounded-full border border-pink-500/30 overflow-hidden bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {userProfile.photo ? (
                  <img
                    src={userProfile.photo}
                    alt={userProfile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{userProfile.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
            </div>
          </div>
        </header>
      ) : (
        <div className="flex h-10 w-full shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">Social Chat</span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online ({onlineCount || 1})</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-slate-300 truncate max-w-[120px]">{userProfile.name}</span>
          </div>
        </div>
      )}

      {/* ========================================================
          2. TOAST NOTIFICATION
      ======================================================== */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/95 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-xl animate-fade-in">
          {toastMessage.type === 'success' ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : toastMessage.type === 'info' ? (
            <Info className="h-3.5 w-3.5 text-sky-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-pink-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ========================================================
          3. SCROLLABLE CONVERSATION MESSAGE STREAM
      ======================================================== */}
      <main className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3.5 sm:px-6">
        {isConnecting ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-pink-400" />
            <span className="text-xs">Connecting to your account data...</span>
          </div>
        ) : loading && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-pink-400" />
            <span className="text-xs">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600/20 to-pink-500/20 border border-white/10 text-pink-300">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              Welcome to Social Chat!
            </h3>
            <p className="max-w-xs text-xs text-slate-400">
              Say hello, share a photo, or send a real voice note to the global TEZOCRON community.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user.uid;
            const isMenuOpen = activeMenuMessageId === msg.id;
            const senderPresence = presenceMap[msg.user_id];
            const isOnline = Boolean(senderPresence?.online);

            return (
              <div
                key={msg.id}
                className={`relative flex items-end gap-2 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* 4. ONLINE PRESENCE: Sender Avatar with Green Dot if Online, or last seen */}
                <div className="relative shrink-0">
                  <div className="h-7 w-7 rounded-full border border-white/10 overflow-hidden bg-slate-800 flex items-center justify-center text-[11px] font-bold text-white shadow-xs">
                    {msg.sender_photo ? (
                      <img
                        src={msg.sender_photo}
                        alt={msg.sender_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{msg.sender_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {/* Presence indicator: green dot if online, gray dot if offline */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-slate-950 ${
                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                    title={
                      isOnline
                        ? 'Online'
                        : formatLastSeen(senderPresence?.lastSeen as number | undefined)
                    }
                  />
                </div>

                {/* Message Container Bubble */}
                <div
                  className={`group relative max-w-[80%] sm:max-w-[70%] rounded-2xl p-3 shadow-md transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 text-white rounded-br-xs'
                      : 'border border-white/10 bg-slate-900/90 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Sender Name & Online Presence (for other users) */}
                  {!isMe && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <p className="text-[10px] font-bold tracking-tight text-pink-400">
                        {msg.sender_name}
                      </p>
                      <span className="text-[8px] font-mono">
                        {isOnline ? (
                          <span className="text-emerald-400 font-semibold">• Online</span>
                        ) : senderPresence?.lastSeen ? (
                          <span className="text-slate-400">
                            • {formatLastSeen(senderPresence.lastSeen as number | undefined)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  {/* Message Content: Image */}
                  {msg.message_type === 'image' && msg.media_url && (
                    <div className="mb-1.5 overflow-hidden rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(msg.media_url || null)}
                        className="block w-full cursor-zoom-in"
                      >
                        <img
                          src={msg.media_url}
                          alt="Attachment"
                          className="max-h-64 w-full object-cover transition-transform hover:scale-102"
                          loading="lazy"
                        />
                      </button>
                    </div>
                  )}

                  {/* Message Content: Voice */}
                  {msg.message_type === 'voice' && msg.media_url && (
                    <VoiceMessagePlayer
                      mediaUrl={msg.media_url}
                      duration={msg.duration}
                      isCurrentUser={isMe}
                    />
                  )}

                  {/* Message Content: Text */}
                  {msg.message_type === 'text' && (
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}

                  {/* 2. CHAT MESSAGES: Timestamp & Delivered Status */}
                  <div
                    className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] font-mono ${
                      isMe ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.created_at)}</span>

                    {/* Delivered Indicator for own messages */}
                    {isMe && (
                      <span
                        className="inline-flex items-center gap-0.5 text-emerald-300 font-medium"
                        title="Delivered"
                      >
                        <Check className="h-2.5 w-2.5" />
                        <span>Delivered</span>
                      </span>
                    )}

                    {/* Three-Dot Options Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMenuMessageId(isMenuOpen ? null : msg.id)
                      }
                      className="p-0.5 rounded-full hover:bg-white/15 transition-colors active:scale-95 ml-1"
                      aria-label="Message options"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Action Menu */}
                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setActiveMenuMessageId(null)}
                      />

                      <div
                        className={`absolute top-full z-50 mt-1 min-w-[140px] rounded-2xl border border-white/15 bg-slate-900/98 p-1.5 shadow-2xl backdrop-blur-2xl ${
                          isMe ? 'right-0' : 'left-0'
                        }`}
                      >
                        {/* Copy Option */}
                        {msg.content && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5 text-blue-400" />
                            <span>Copy Text</span>
                          </button>
                        )}

                        {/* Delete Option (Owner only) */}
                        {isMe ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id, msg.user_id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-pink-400 hover:bg-pink-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-pink-400" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          /* Report Option (Other users) */
                          <button
                            type="button"
                            onClick={() => handleReportMessage(msg.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <Flag className="h-3.5 w-3.5 text-amber-400" />
                            <span>Report</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* 3. TYPING INDICATOR DISPLAY: "John is typing..." */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs text-pink-400 font-medium backdrop-blur-md animate-fade-in w-fit">
            <div className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="italic font-sans text-xs">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Hidden File Inputs for Attachment */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileSelected}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* ========================================================
          5. ATTACHMENT "+" MINI-POPUP PAGE
      ======================================================== */}
      {showAttachmentMenu && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs"
            onClick={() => setShowAttachmentMenu(false)}
          />
          <div className="absolute bottom-20 left-4 z-50 w-60 rounded-3xl border border-white/15 bg-slate-900/98 p-3 shadow-2xl backdrop-blur-2xl animate-scale-in">
            <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2 px-1">
              <span className="text-xs font-bold text-white">Share Media</span>
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {/* Photo from Device Gallery */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all active:scale-98"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-white">Photo Gallery</p>
                  <p className="text-[10px] text-slate-400">Upload pictures</p>
                </div>
              </button>

              {/* Take Photo via Device Camera */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  cameraInputRef.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all active:scale-98"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-600 to-pink-500 text-white shadow-xs">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-white">Camera</p>
                  <p className="text-[10px] text-slate-400">Capture a picture</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================
          3, 4, 6. BOTTOM INPUT / VOICE RECORDING AREA
      ======================================================== */}
      <footer className="sticky bottom-0 z-30 w-full shrink-0 border-t border-white/10 bg-slate-950/95 px-3 py-2.5 backdrop-blur-xl sm:px-6">
        {uploadingMedia ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-pink-300">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Processing and sending media...</span>
          </div>
        ) : isRecording ? (
          /* REAL VOICE RECORDING INTERFACE (AGORA RTC) */
          <div className="flex items-center justify-between gap-3 rounded-full border border-pink-500/40 bg-pink-950/40 px-4 py-2 backdrop-blur-md">
            {/* Pulsing Recording Indicator */}
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-pink-500 animate-ping" />
              <span className="text-xs font-bold text-pink-400 font-mono">
                {Math.floor(recordingDuration / 60)}:
                {recordingDuration % 60 < 10 ? '0' : ''}
                {recordingDuration % 60}
              </span>
            </div>

            {/* Live Audio Amplitude Waves */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => {
                const dynamicHeight = Math.max(
                  4,
                  Math.min(22, (recordingVolume / 10) * (i % 3 + 1) * 3)
                );
                return (
                  <div
                    key={i}
                    style={{ height: `${dynamicHeight}px` }}
                    className="w-1 rounded-full bg-pink-400 transition-all duration-75"
                  />
                );
              })}
            </div>

            {/* Actions: Cancel & Send */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                title="Discard voice recording"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleFinishRecording}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-md shadow-pink-500/25 hover:scale-105 active:scale-95 transition-transform"
                title="Send voice message"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD INPUT AREA */
          <div className="flex items-center gap-2">
            {/* Attachment "+" Icon */}
            <button
              type="button"
              onClick={() => setShowAttachmentMenu((prev) => !prev)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                showAttachmentMenu
                  ? 'border-pink-500 bg-pink-500 text-white'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              aria-label="Open attachments menu"
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* Rounded Text Input with Debounced Typing Hook */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isSending}
                className="w-full rounded-full border border-white/15 bg-slate-900/90 py-2.5 pl-4 pr-10 text-xs sm:text-sm text-white placeholder-slate-400 shadow-inner outline-hidden focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/30 transition-all disabled:opacity-50"
              />
            </div>

            {/* Dynamic Send / Voice Record Button */}
            {inputText.trim().length > 0 ? (
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-pink-600 text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="Send text message"
              >
                {isSending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/15 text-pink-400 shadow-md hover:bg-pink-500/20 hover:text-pink-300 active:scale-95 transition-all"
                aria-label="Record voice message"
                title="Tap to record voice message"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </footer>

      {/* ========================================================
          ENLARGED PHOTO VIEWER MODAL
      ======================================================== */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white hover:bg-slate-900 border border-white/20"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
      {/* ========================================================
          REALTIME REPORT MESSAGE MODAL
      ======================================================== */}
      {reportModalMessage && (
        <ReportAccountModal
          currentUser={user}
          reportedUserId={reportModalMessage.user_id}
          reportedUserName={reportModalMessage.sender_name}
          reportedUserPhoto={reportModalMessage.sender_photo}
          reportedMessageId={reportModalMessage.id}
          reportedMessageText={reportModalMessage.content}
          onClose={() => setReportModalMessage(null)}
          onShowToast={(msg) => showToast(msg, 'success')}
        />
      )}
    </div>
  );
}
