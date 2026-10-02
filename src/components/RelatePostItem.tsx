import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  HeartHandshake,
  MessageCircle,
  Share2,
  Eye,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  User as UserIcon,
  ShieldAlert,
} from 'lucide-react';
import ReportAccountModal from './ReportAccountModal';
import { User as FirebaseUser } from 'firebase/auth';
import {
  UserPost,
  recordMediaView,
  hasUserLovedPost,
  togglePostLove,
  getPostLoveCount,
} from '../lib/postService';
import { isUserRelated, toggleRelate } from '../lib/profileService';

interface RelatePostItemProps {
  post: UserPost;
  currentUser: FirebaseUser;
  onOpenUserProfile: (userId: string) => void;
  onOpenComments: (post: UserPost) => void;
  onShowToast: (message: string) => void;
  isCurrentlyViewed?: boolean;
}

export default function RelatePostItem({
  post,
  currentUser,
  onOpenUserProfile,
  onOpenComments,
  onShowToast,
  isCurrentlyViewed = false,
}: RelatePostItemProps) {
  const isSelf = currentUser.uid === post.userId;

  // Love State
  const [isLoved, setIsLoved] = useState(false);
  const [lovesCount, setLovesCount] = useState<number>(post.lovesCount || 0);
  const [loving, setLoving] = useState(false);

  // Relate State
  const [isRelated, setIsRelated] = useState(false);
  const [relating, setRelating] = useState(false);

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);

  // Video playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const hasManuallyPausedRef = useRef(false);

  // Automatic video play/stop based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || post.mediaType !== 'video') return;

    if (isCurrentlyViewed) {
      // Automatically start playing that video when viewed, respecting manual pause
      if (!hasManuallyPausedRef.current) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              // Gracefully handle browser autoplay or rapid scroll interruption
              console.debug('Video autoplay notice:', err?.message || err);
            });
        }
      }
    } else {
      // When scrolled away, immediately pause/stop that video and release active playback
      hasManuallyPausedRef.current = false; // Reset so returning to the post auto-plays again
      video.pause();
      setIsPlaying(false);
    }
  }, [isCurrentlyViewed, post.mediaType]);

  // Clean up video playback on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  // View recorded flag
  const viewRecordedRef = useRef(false);

  // 1. Record legitimate media view once (only if not self)
  useEffect(() => {
    if (!viewRecordedRef.current && currentUser.uid && !isSelf) {
      viewRecordedRef.current = true;
      recordMediaView(post.userId, post.id, currentUser.uid);
    }
  }, [post.id, post.userId, currentUser.uid, isSelf]);

  // 2. Fetch initial love state & count
  useEffect(() => {
    let mounted = true;
    hasUserLovedPost(post.userId, post.id, currentUser.uid).then((loved) => {
      if (mounted) setIsLoved(loved);
    });
    getPostLoveCount(post.userId, post.id).then((count) => {
      if (mounted) setLovesCount(count);
    });
    return () => {
      mounted = false;
    };
  }, [post.userId, post.id, currentUser.uid]);

  // 3. Fetch initial relate state
  useEffect(() => {
    let mounted = true;
    if (!isSelf) {
      isUserRelated(post.userId, currentUser.uid).then((related) => {
        if (mounted) setIsRelated(related);
      });
    }
    return () => {
      mounted = false;
    };
  }, [post.userId, currentUser.uid, isSelf]);

  // Handle Love toggle
  const handleToggleLove = async () => {
    if (loving) return;
    setLoving(true);

    const prevLoved = isLoved;
    const prevCount = lovesCount;

    // Optimistic update
    setIsLoved(!prevLoved);
    setLovesCount(prevLoved ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const result = await togglePostLove(post.userId, post.id, currentUser.uid);
      setIsLoved(result.loved);
      setLovesCount(result.newCount);
    } catch (err) {
      console.warn('Love interaction warning:', err);
      setIsLoved(prevLoved);
      setLovesCount(prevCount);
    } finally {
      setLoving(false);
    }
  };

  // Handle Relate toggle
  const handleToggleRelate = async () => {
    if (isSelf || relating) return;
    setRelating(true);

    const prevRelated = isRelated;
    setIsRelated(!prevRelated);

    try {
      const result = await toggleRelate(post.userId, currentUser.uid);
      setIsRelated(result.related);
      if (result.related) {
        onShowToast(`You are now related with ${post.authorName}`);
      } else {
        onShowToast(`Removed relation with ${post.authorName}`);
      }
    } catch (err) {
      console.warn('Relate interaction warning:', err);
      setIsRelated(prevRelated);
    } finally {
      setRelating(false);
    }
  };

  // Handle Share action
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?post=${post.id}&user=${post.userId}`;
    const shareTitle = `${post.authorName} on TEZOCRON EXTENDED`;
    const shareText = post.caption || `Check out this post by ${post.authorName} on TEZOCRON EXTENDED`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        onShowToast('Post link copied to clipboard!');
      } else {
        onShowToast('Share URL: ' + shareUrl);
      }
    } catch {
      onShowToast('Share URL: ' + shareUrl);
    }
  };

  // Toggle video play/pause on manual user tap
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      hasManuallyPausedRef.current = false;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => console.debug('Manual play notice:', err));
      }
    } else {
      hasManuallyPausedRef.current = true;
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Toggle video audio mute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const formattedDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
      {/* ========================================================
          MEDIA CONTAINER (PICTURE OR VIDEO)
      ======================================================== */}
      <div className="relative flex min-h-[380px] max-h-[72vh] w-full items-center justify-center overflow-hidden bg-black/60 sm:min-h-[460px]">
        {post.mediaType === 'video' ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <video
              ref={videoRef}
              src={post.mediaUrl}
              playsInline
              loop
              muted={isMuted}
              preload="metadata"
              onClick={toggleVideoPlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="h-full max-h-[72vh] w-full object-contain cursor-pointer"
            />

            {/* Play/Pause Overlay Indicator on Tap */}
            {!isPlaying && (
              <button
                type="button"
                onClick={toggleVideoPlay}
                className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity"
                aria-label="Play video"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-xl backdrop-blur-md border border-white/20 transition-transform active:scale-90">
                  <Play className="h-7 w-7 translate-x-0.5 text-pink-400" />
                </div>
              </button>
            )}

            {/* Video Controls: Mute/Unmute toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/15 transition-transform active:scale-95"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-slate-300" /> : <Volume2 className="h-4 w-4 text-pink-400" />}
            </button>
          </div>
        ) : (
          <div className="relative flex h-full w-full items-center justify-center">
            <img
              src={post.mediaUrl}
              alt={post.caption || `${post.authorName}'s post`}
              loading="lazy"
              className="h-full max-h-[72vh] w-full object-contain"
            />
          </div>
        )}

        {/* Soft Bottom Gradient for Overlay Legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

        {/* ========================================================
            TOP-RIGHT WATERMARK: "T&E" (White)
            - Overlay on every post media item (video & picture)
        ======================================================== */}
        <div className="pointer-events-none select-none absolute top-3.5 right-3.5 z-20 flex items-center">
          <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            T&E
          </span>
        </div>

        {/* ========================================================
            RIGHT-SIDE POST CONTROLS (VERTICAL GROUP)
            1. Profile Picture
            2. Name
            3. Relate
            4. Love ❤️
            5. Comments
            6. Share
            7. Report
        ======================================================== */}
        <div className="absolute right-2.5 sm:right-3 bottom-3 sm:bottom-4 z-20 flex flex-col items-center gap-1.5 sm:gap-2">
          {/* 1. PROFILE PICTURE */}
          <button
            type="button"
            onClick={() => onOpenUserProfile(post.userId)}
            className="group relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 border-pink-500 bg-slate-950 p-0.5 shadow-lg shadow-pink-500/25 transition-transform active:scale-95"
            aria-label={`View ${post.authorName}'s profile`}
            title={`View ${post.authorName}'s profile`}
          >
            {post.authorPhoto ? (
              <img
                src={post.authorPhoto}
                alt={post.authorName}
                className="h-full w-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-pink-600 font-bold text-white text-xs">
                {post.authorName ? post.authorName.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white ring-2 ring-slate-950">
              +
            </span>
          </button>

          {/* 2. USER NAME (Compact Tap Action) */}
          <button
            type="button"
            onClick={() => onOpenUserProfile(post.userId)}
            className="max-w-[66px] truncate rounded bg-slate-950/80 px-1 py-0.5 text-center text-[9px] font-bold text-white shadow backdrop-blur-md border border-white/10 hover:text-pink-300 transition-colors"
            title={post.authorName}
          >
            {post.authorName.split(' ')[0]}
          </button>

          {/* 3. RELATE BUTTON */}
          {!isSelf && (
            <button
              type="button"
              onClick={handleToggleRelate}
              disabled={relating}
              className={`flex flex-col items-center rounded-xl px-2 py-1 text-center transition-all active:scale-90 ${
                isRelated
                  ? 'border border-blue-500/40 bg-blue-500/20 text-blue-300 shadow-md shadow-blue-500/20'
                  : 'border border-pink-500/40 bg-pink-500/20 text-pink-300 hover:bg-pink-500/30'
              }`}
              aria-label={isRelated ? 'Related with author' : 'Relate with author'}
              title={isRelated ? 'Related' : 'Relate'}
            >
              <div className="flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center">
                {isRelated ? (
                  <Check className="h-3.5 w-3.5 text-blue-300 animate-in zoom-in" />
                ) : (
                  <HeartHandshake className="h-3.5 w-3.5 text-pink-300" />
                )}
              </div>
              <span className="text-[9px] font-bold tracking-tight">
                {isRelated ? 'Related' : 'Relate'}
              </span>
            </button>
          )}

          {/* 4. LOVE ❤️ BUTTON */}
          <button
            type="button"
            onClick={handleToggleLove}
            disabled={loving}
            className="group flex flex-col items-center text-center transition-transform active:scale-90"
            aria-label={isLoved ? 'Unlike post' : 'Love post'}
            title="Love ❤️"
          >
            <div
              className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border transition-all ${
                isLoved
                  ? 'border-pink-500 bg-pink-500/25 text-pink-400 shadow-lg shadow-pink-500/30'
                  : 'border-white/15 bg-slate-950/70 text-white backdrop-blur-md hover:border-pink-500/40 hover:text-pink-300'
              }`}
            >
              <Heart
                className={`h-4 w-4 sm:h-4.5 sm:w-4.5 transition-transform ${
                  isLoved ? 'fill-pink-500 text-pink-500 scale-110' : 'text-slate-200 group-hover:scale-110'
                }`}
              />
            </div>
            <span className="text-[9px] font-semibold text-slate-200 mt-0.5">
              {lovesCount}
            </span>
          </button>

          {/* 5. COMMENTS BUTTON */}
          <button
            type="button"
            onClick={() => onOpenComments(post)}
            className="group flex flex-col items-center text-center transition-transform active:scale-90"
            aria-label="View comments"
            title="Comments"
          >
            <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-white backdrop-blur-md transition-all hover:border-blue-500/40 hover:text-blue-300">
              <MessageCircle className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-200 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[9px] font-semibold text-slate-200 mt-0.5">
              {post.commentsCount || 0}
            </span>
          </button>

          {/* 6. SHARE BUTTON */}
          <button
            type="button"
            onClick={handleShare}
            className="group flex flex-col items-center text-center transition-transform active:scale-90"
            aria-label="Share post"
            title="Share"
          >
            <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-white backdrop-blur-md transition-all hover:border-white/30 hover:text-white">
              <Share2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-200 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[9px] font-semibold text-slate-200 mt-0.5">
              Share
            </span>
          </button>

          {/* 7. REPORT BUTTON (Moderation) */}
          {!isSelf && (
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="group flex flex-col items-center text-center transition-transform active:scale-90"
              aria-label="Report this post or author"
              title="Report"
            >
              <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-full border border-red-500/25 bg-slate-950/70 text-red-300 backdrop-blur-md transition-all hover:border-red-500/50 hover:bg-red-500/10">
                <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-[9px] font-semibold text-slate-300 mt-0.5">
                Report
              </span>
            </button>
          )}
        </div>

        {/* ========================================================
            BOTTOM LEFT POST INFO & CAPTION
        ======================================================== */}
        <div className="absolute left-4 bottom-4 z-10 max-w-[calc(100%-90px)] pr-2">
          {/* ========================================================
              BOTTOM-LEFT WATERMARK: "Tezocron extended"
              - Tezocron = WHITE
              - extended = PINK
          ======================================================== */}
          <div className="pointer-events-none select-none mb-1.5 inline-flex items-center gap-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white">
              Tezocron
            </span>
            <span className="text-xs sm:text-sm font-bold tracking-tight text-pink-400">
              extended
            </span>
          </div>

          {/* Author Name and Tag */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenUserProfile(post.userId)}
              className="text-left font-bold text-sm text-white hover:text-pink-300 transition-colors drop-shadow"
            >
              @{post.authorName}
            </button>
            {formattedDate && (
              <span className="text-[11px] text-slate-400 drop-shadow">
                • {formattedDate}
              </span>
            )}
          </div>

          {/* Post Caption */}
          {post.caption && (
            <p className="mt-1 text-xs text-slate-200 line-clamp-2 leading-relaxed drop-shadow">
              {post.caption}
            </p>
          )}

          {/* Post Views Info */}
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-md border border-white/10">
            <Eye className="h-3 w-3 text-blue-400" />
            <span>{post.viewsCount || 0} views</span>
          </div>
        </div>
      </div>

      {/* Real Report Modal for Post / Author */}
      {showReportModal && !isSelf && (
        <ReportAccountModal
          currentUser={currentUser}
          reportedUserId={post.userId}
          reportedUserName={post.authorName}
          reportedUserPhoto={post.authorPhoto}
          reportedMessageText={post.caption || undefined}
          profileRef={`https://tezocron.com/relate/${post.userId}`}
          onClose={() => setShowReportModal(false)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
