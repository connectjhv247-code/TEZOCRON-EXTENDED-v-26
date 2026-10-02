import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HeartHandshake,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle,
  Link2,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserPost, subscribeToRelateFeed } from '../lib/postService';
import RelatePostItem from './RelatePostItem';
import RelateCommentsModal from './RelateCommentsModal';
import {
  ensureUserRelateLink,
  copyRelateUrlToClipboard,
  shareViaNativeSheet,
} from '../lib/relateLinkService';

interface RelateScreenProps {
  currentUser: FirebaseUser;
  onOpenUserProfile: (userId: string) => void;
  isActiveTab?: boolean;
}

export default function RelateScreen({
  currentUser,
  onOpenUserProfile,
  isActiveTab = true,
}: RelateScreenProps) {
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentsPost, setActiveCommentsPost] = useState<UserPost | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [userRelateId, setUserRelateId] = useState<string>('');
  const [userRelateUrl, setUserRelateUrl] = useState<string>('');
  const [userUsername, setUserUsername] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Active visible post tracking for single-video autoplay / stop
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const postElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [activeVisiblePostId, setActiveVisiblePostId] = useState<string | null>(null);

  // Monitor scrolling and visibility to detect which post is currently in the active viewing area
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isActiveTab) {
      setActiveVisiblePostId(null);
      return;
    }

    const ratios = new Map<string, number>();

    const evaluateActivePost = () => {
      if (!scrollContainerRef.current) return;
      const rootRect = scrollContainerRef.current.getBoundingClientRect();
      const rootCenterY = rootRect.top + rootRect.height / 2;

      let bestPostId: string | null = null;
      let minCenterDist = Infinity;
      let hasSufficientPost = false;

      postElementsRef.current.forEach((el, id) => {
        const ratio = ratios.get(id) || 0;
        if (ratio >= 0.4) {
          hasSufficientPost = true;
          const elRect = el.getBoundingClientRect();
          const elCenterY = elRect.top + elRect.height / 2;
          const dist = Math.abs(rootCenterY - elCenterY);
          if (dist < minCenterDist) {
            minCenterDist = dist;
            bestPostId = id;
          }
        }
      });

      if (hasSufficientPost && bestPostId) {
        setActiveVisiblePostId(bestPostId);
      } else {
        // If all ratios fall below 0.25 (scrolled past or off-screen), clear active post
        let maxRatio = 0;
        ratios.forEach((r) => {
          if (r > maxRatio) maxRatio = r;
        });
        if (maxRatio < 0.25) {
          setActiveVisiblePostId(null);
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          const postId = target.getAttribute('data-post-id');
          if (postId) {
            ratios.set(postId, entry.intersectionRatio);
          }
        });
        evaluateActivePost();
      },
      {
        root: container,
        threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0],
      }
    );

    // Observe each registered post card
    postElementsRef.current.forEach((el) => {
      observer.observe(el);
    });

    // Also handle window/tab visibility changes to pause immediately when backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setActiveVisiblePostId(null);
      } else {
        evaluateActivePost();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, [posts, isActiveTab]);

  // Guarantee current user's Relate link
  useEffect(() => {
    ensureUserRelateLink(currentUser.uid, currentUser.displayName || undefined)
      .then(({ relateId, relateUrl, username }) => {
        setUserRelateId(relateId);
        setUserRelateUrl(relateUrl);
        setUserUsername(username);
      })
      .catch((e) => console.warn('Relate link init notice:', e));
  }, [currentUser.uid, currentUser.displayName]);

  // Reference to raw posts from subscription
  const rawPostsRef = useRef<UserPost[]>([]);

  // Fisher-Yates shuffle algorithm
  const shufflePosts = (arr: UserPost[]): UserPost[] => {
    if (arr.length <= 1) return arr;
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Real-time subscription to the Relate feed
  // Condition 1: When user restarts, refreshes, or reopens the app, shuffle feed on initial load
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToRelateFeed(currentUser.uid, (loadedPosts) => {
      rawPostsRef.current = loadedPosts;
      setPosts(shufflePosts(loadedPosts));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Condition 1 (continued): Shuffle feed when user completely leaves & reopens / refocuses the app
  useEffect(() => {
    const handleAppReopenOrFocus = () => {
      if (document.visibilityState === 'visible' && rawPostsRef.current.length > 0) {
        setPosts((prev) => shufflePosts(prev.length > 0 ? prev : rawPostsRef.current));
      }
    };

    window.addEventListener('focus', handleAppReopenOrFocus);
    document.addEventListener('visibilitychange', handleAppReopenOrFocus);

    return () => {
      window.removeEventListener('focus', handleAppReopenOrFocus);
      document.removeEventListener('visibilitychange', handleAppReopenOrFocus);
    };
  }, []);

  // Condition 2 & Condition 3:
  // Condition 2: When user remains on Social/Live page for 5 seconds, automatically shuffle available posts/videos.
  // Condition 3: When user leaves Relate/Post page for 5 seconds and then returns, automatically shuffle available posts/videos.
  const prevIsActiveTabRef = useRef<boolean>(isActiveTab);
  const leftRelateTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    let socialLiveTimer: NodeJS.Timeout | null = null;

    if (!isActiveTab) {
      // User is on Social/Live page or away from Relate feed
      if (prevIsActiveTabRef.current) {
        // Record timestamp when user left Relate page
        leftRelateTimestampRef.current = Date.now();
      }

      // Condition 2: When remaining on Social/Live page for 5 seconds, automatically shuffle
      socialLiveTimer = setTimeout(() => {
        if (rawPostsRef.current.length > 0) {
          setPosts((prev) => shufflePosts(prev.length > 0 ? prev : rawPostsRef.current));
        }
      }, 5000);
    } else {
      // User is on Relate page
      if (!prevIsActiveTabRef.current) {
        // Just returned to Relate page
        const timeAway = leftRelateTimestampRef.current
          ? Date.now() - leftRelateTimestampRef.current
          : 0;

        // Condition 3: Left Relate page for 5 seconds or more and returned -> automatically shuffle
        if (timeAway >= 5000) {
          setPosts((prev) => shufflePosts(prev.length > 0 ? prev : rawPostsRef.current));
        }
        leftRelateTimestampRef.current = null;
      }
    }

    prevIsActiveTabRef.current = isActiveTab;

    return () => {
      if (socialLiveTimer) clearTimeout(socialLiveTimer);
    };
  }, [isActiveTab]);

  // Show auto-dismissing toast feedback
  const handleShowToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleCopyMyLink = async () => {
    if (!userRelateUrl) return;
    const success = await copyRelateUrlToClipboard(userRelateUrl);
    if (success) {
      setLinkCopied(true);
      handleShowToast('Relate Link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const handleShareMyLink = async () => {
    if (!userRelateUrl) return;
    const shared = await shareViaNativeSheet(userRelateUrl, currentUser.displayName || 'TEZOCRON Member');
    if (!shared) {
      handleCopyMyLink();
    }
  };

  return (
    <div ref={scrollContainerRef} className="relative flex-1 min-h-0 w-full overflow-y-auto">
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
              <CheckCircle className="h-4 w-4 text-pink-400" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pt-4 pb-28 sm:px-6">
        {/* Top Header Bar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3.5 py-1 text-xs font-semibold text-pink-300 backdrop-blur-sm">
            <HeartHandshake className="h-3.5 w-3.5 text-pink-400" />
            <span>Relate Community Feed</span>
          </div>
        </div>

        {/* Quick Relate Link Share Pill */}
        {(userUsername || userRelateUrl) && (
          <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 border border-pink-500/20 text-pink-400">
                <Link2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 truncate">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Your Relate Link</p>
                <p className="font-mono text-xs font-semibold text-pink-300 truncate">
                  tezocron.com/@{userUsername || (userRelateUrl.includes('/@') ? userRelateUrl.split('/@')[1] : userRelateId)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyMyLink}
                className="flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 active:scale-95"
                title="Copy your link"
              >
                {linkCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-300" />
                )}
                <span className="text-[11px]">{linkCopied ? 'Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareMyLink}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 transition-all hover:bg-pink-500/30 active:scale-95"
                title="Share your link"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            FEED CONTENT
        ======================================================== */}
        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Loading Relate Feed...
            </p>
          </div>
        ) : posts.length === 0 ? (
          /* Real Empty State (No sample posts, no fake content) */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="my-auto flex w-full flex-col items-center rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600/30 to-pink-500/30 border border-pink-500/20 text-pink-400 shadow-lg shadow-pink-500/10">
              <HeartHandshake className="h-7 w-7" />
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              No Community Posts Yet
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-xs">
              When TEZOCRON members upload pictures or videos, their public posts will appear here in the Relate feed.
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span>Share a post from your Profile to get started</span>
            </div>
          </motion.div>
        ) : (
          /* Real User Posts Stream */
          <div className="flex flex-col gap-6">
            {posts.map((post) => (
              <div
                key={post.id}
                data-post-id={post.id}
                ref={(el) => {
                  if (el) {
                    postElementsRef.current.set(post.id, el);
                  } else {
                    postElementsRef.current.delete(post.id);
                  }
                }}
              >
                <RelatePostItem
                  post={post}
                  currentUser={currentUser}
                  onOpenUserProfile={onOpenUserProfile}
                  onOpenComments={(p) => setActiveCommentsPost(p)}
                  onShowToast={handleShowToast}
                  isCurrentlyViewed={activeVisiblePostId === post.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real Comments Inbox Modal */}
      <AnimatePresence>
        {activeCommentsPost && (
          <RelateCommentsModal
            post={activeCommentsPost}
            currentUser={currentUser}
            onClose={() => setActiveCommentsPost(null)}
            onOpenUserProfile={onOpenUserProfile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
