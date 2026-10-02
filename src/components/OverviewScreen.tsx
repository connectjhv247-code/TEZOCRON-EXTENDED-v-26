import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  LayoutDashboard,
  Gift,
  Coins,
  Radio,
  UserCheck,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Info,
  ShoppingBag,
  CreditCard,
  ExternalLink,
  X,
  Tag,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Inbox,
  Library,
  Check,
  Users,
  Flame,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  subscribeToUserOverview,
  getRealDailyEvent,
  getRealLastLiveStream,
  getRealCoinPricing,
  addCoinsToSavings,
  updateLiveViewerAmount,
  updateLiveViewerDeduction,
  LiveViewerAmountOption,
  LiveViewerDeductionOption,
  UserOverviewData,
  LastLiveInfo,
  DailyEventInfo,
  CoinPriceItem,
} from '../lib/overviewService';

interface AdMediaItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  alt: string;
  durationMs?: number;
}

// Configured advertisement media: genuine Tazo Card assets in the system
const CONFIGURED_AD_MEDIA: AdMediaItem[] = [
  {
    id: 'tazo-card-promo-video',
    type: 'video',
    src: '/tazo_card_promo.mp4',
    alt: 'Tazo Card Promotional Video',
  },
  {
    id: 'tazo-card-ad-graphic',
    type: 'image',
    src: '/tazo_card_ad.svg',
    alt: 'Tazo Card Advertisement',
    durationMs: 6000,
  },
];

type OverviewSubView = 'main' | 'buy-gift' | 'buy-coin' | 'request' | 'convert' | 'library';

interface OverviewScreenProps {
  currentUser?: FirebaseUser | null;
  onBack: () => void;
}

export default function OverviewScreen({ currentUser, onBack }: OverviewScreenProps) {
  const currentUid = currentUser?.uid || auth.currentUser?.uid || '';

  // Current view state inside Overview
  const [subView, setSubView] = useState<OverviewSubView>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/overview/buy-gift' || path === '/buy-gift') return 'buy-gift';
      if (path === '/overview/buy-coin' || path === '/buy-coin') return 'buy-coin';
      if (path === '/overview/request' || path === '/request') return 'request';
      if (path === '/overview/convert' || path === '/convert') return 'convert';
      if (path === '/overview/library' || path === '/library') return 'library';
    }
    return 'main';
  });

  // Real data state
  const [userData, setUserData] = useState<UserOverviewData>({
    role: '',
    coinBalance: 0,
    creditCoinBalance: 0,
    giftCount: 0,
    savedAmount: 0,
    nairaBalance: 0,
    liveViewerAmount: null,
    liveViewerDeduction: null,
  });
  const [dailyEvent, setDailyEvent] = useState<DailyEventInfo | null>(null);
  const [lastLive, setLastLive] = useState<LastLiveInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check Price real modal state
  const [showCheckPrice, setShowCheckPrice] = useState<boolean>(false);
  const [pricingItems, setPricingItems] = useState<CoinPriceItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState<boolean>(false);

  // Request Page State (Step 25)
  const [requestText, setRequestText] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [requestStatus, setRequestStatus] = useState<{
    type: 'success' | 'error' | 'unconfigured';
    message: string;
  } | null>(null);

  // Helper to count words strictly
  const getWordCount = (str: string): number => {
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const requestWordCount = getWordCount(requestText);
  const remainingWords = Math.max(0, 100 - requestWordCount);
  const isSendActive = requestWordCount > 0 && requestWordCount <= 100 && !isSubmittingRequest;

  // Handle typing & enforce maximum 100 words
  const handleRequestChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 100) {
      setRequestText(val);
      if (requestStatus) setRequestStatus(null);
    } else {
      // Clamps to 100 words if pasting or typing exceeds limit
      const clamped = words.slice(0, 100).join(' ');
      setRequestText(clamped);
      if (requestStatus) setRequestStatus(null);
    }
  };

  // Submit Request directly to Firestore
  const handleSendRequest = async () => {
    // Ensure only logged-in users can send
    if (!currentUser || !currentUid) {
      setRequestStatus({
        type: 'error',
        message: 'Please sign in to your account to send a request.',
      });
      return;
    }

    if (!isSendActive) return;

    const words = requestText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      setRequestStatus({
        type: 'error',
        message: 'Please enter a request before sending.',
      });
      return;
    }

    if (words.length > 100) {
      setRequestStatus({
        type: 'error',
        message: `Request exceeds 100 words (currently ${words.length} words). Maximum limit is 100 words.`,
      });
      return;
    }

    setIsSubmittingRequest(true);
    setRequestStatus(null);

    try {
      await addDoc(collection(db, 'requests'), {
        requestMessage: requestText.trim(),
        userName: currentUser.displayName || userData.role || 'TEZOCRON Member',
        userEmail: currentUser.email || 'Authorized Account',
        userId: currentUid,
        requestId: 'req_' + Date.now(),
        wordCount: words.length,
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        status: 'pending',
      });

      setRequestStatus({
        type: 'success',
        message: 'Your request has been submitted successfully!',
      });
      setRequestText('');
    } catch (err) {
      console.error('Failed to submit request to Firestore:', err);
      setRequestStatus({
        type: 'error',
        message: 'Unable to submit request. Please try again.',
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Convert Page State (Page 27)
  const [convertInput, setConvertInput] = useState<string>('');
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveAmountInput, setSaveAmountInput] = useState<string>('');
  const [isSavingCoins, setIsSavingCoins] = useState<boolean>(false);
  const [convertStatus, setConvertStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Derived calculations for Convert page: 1 Coin = ₦1
  const enteredCoinAmount = parseInt(convertInput, 10) || 0;
  const calculatedNaira = enteredCoinAmount * 1;

  // Handle typing & enforcing only numeric and <= available real balance
  const handleConvertInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setConvertInput('');
      setConvertStatus(null);
      return;
    }
    const num = parseInt(raw, 10);
    if (num > userData.coinBalance) {
      setConvertInput(String(userData.coinBalance));
      setConvertStatus({
        type: 'warning',
        message: `Amount capped to your available balance (${userData.coinBalance.toLocaleString()} coins).`,
      });
    } else {
      setConvertInput(raw);
      setConvertStatus(null);
    }
  };

  const handleMaxCoins = () => {
    if (userData.coinBalance > 0) {
      setConvertInput(String(userData.coinBalance));
      setConvertStatus(null);
    }
  };

  const handleOpenSaveModal = () => {
    if (userData.coinBalance <= 0) {
      setConvertStatus({
        type: 'warning',
        message: 'You have 0 coins in your balance to add to savings.',
      });
      return;
    }
    // If convertInput has a valid positive amount, use it as default
    if (enteredCoinAmount > 0 && enteredCoinAmount <= userData.coinBalance) {
      setSaveAmountInput(String(enteredCoinAmount));
    } else {
      setSaveAmountInput(String(userData.coinBalance));
    }
    setConvertStatus(null);
    setShowSaveModal(true);
  };

  const handleConfirmSaveCoins = async () => {
    if (!currentUid) {
      setConvertStatus({
        type: 'error',
        message: 'Please sign in to manage your savings.',
      });
      return;
    }

    const amt = parseInt(saveAmountInput, 10);
    if (!amt || amt <= 0) {
      setConvertStatus({
        type: 'error',
        message: 'Please enter a valid amount of coins to save.',
      });
      return;
    }

    if (amt > userData.coinBalance) {
      setConvertStatus({
        type: 'error',
        message: `Cannot save more than your available balance (${userData.coinBalance.toLocaleString()} coins).`,
      });
      return;
    }

    setIsSavingCoins(true);
    setConvertStatus(null);

    const res = await addCoinsToSavings(currentUid, amt);
    setIsSavingCoins(false);

    if (res.success) {
      setConvertStatus({
        type: 'success',
        message: `Successfully transferred ${amt.toLocaleString()} coins (₦${amt.toLocaleString()}) to your savings!`,
      });
      setShowSaveModal(false);
      setSaveAmountInput('');
      if (convertInput === String(amt)) {
        setConvertInput('');
      }
    } else {
      setConvertStatus({
        type: 'error',
        message: res.error || 'Failed to update savings.',
      });
    }
  };

  const handleRequestWithdrawal = () => {
    if (!currentUser || !currentUid) {
      setConvertStatus({
        type: 'error',
        message: 'Please sign in to your account to request a withdrawal.',
      });
      return;
    }

    let prefilled = '';
    if (enteredCoinAmount > 0) {
      prefilled = `Withdrawal Request: I would like to request a withdrawal of ${enteredCoinAmount.toLocaleString()} coins (₦${calculatedNaira.toLocaleString()}). Account ID: ${currentUid}`;
    } else {
      prefilled = `Withdrawal Request: I would like to request a coin withdrawal. Current coin balance: ${userData.coinBalance.toLocaleString()} coins. Account ID: ${currentUid}`;
    }

    setRequestText(prefilled);
    setRequestStatus(null);
    navigateToSubView('request');
  };

  // Live Library State (Page 29)
  const [isUpdatingLiveSetting, setIsUpdatingLiveSetting] = useState<boolean>(false);
  const [liveLibraryStatus, setLiveLibraryStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSelectViewerAmount = async (option: LiveViewerAmountOption) => {
    if (!currentUid) {
      setLiveLibraryStatus({
        type: 'error',
        message: 'Please sign in to configure live settings.',
      });
      return;
    }
    setIsUpdatingLiveSetting(true);
    setLiveLibraryStatus(null);
    const res = await updateLiveViewerAmount(currentUid, option);
    setIsUpdatingLiveSetting(false);
    if (!res.success) {
      setLiveLibraryStatus({
        type: 'error',
        message: res.error || 'Failed to update viewer amount setting.',
      });
    } else {
      const label = option === 'min' ? '50 viewers' : option === 'max' ? '250 viewers' : '500 viewers';
      setLiveLibraryStatus({
        type: 'success',
        message: `Viewer capacity set to ${label}.`,
      });
    }
  };

  const handleSelectViewerDeduction = async (option: LiveViewerDeductionOption) => {
    if (!currentUid) {
      setLiveLibraryStatus({
        type: 'error',
        message: 'Please sign in to configure live settings.',
      });
      return;
    }
    setIsUpdatingLiveSetting(true);
    setLiveLibraryStatus(null);
    const res = await updateLiveViewerDeduction(currentUid, option);
    setIsUpdatingLiveSetting(false);
    if (!res.success) {
      setLiveLibraryStatus({
        type: 'error',
        message: res.error || 'Failed to update deduction setting.',
      });
    } else {
      const label = option === 'special_event'
        ? 'Special Event (Existing 2 + 1 additional coin/sec)'
        : option === 'favourite'
        ? 'Favourite (Existing 2 + 1 additional coin/sec)'
        : 'Hot (Existing 2 + 2 additional coins/sec)';
      setLiveLibraryStatus({
        type: 'success',
        message: `Deduction updated: ${label}.`,
      });
    }
  };

  // Advertisement media rotation / shuffling state
  const [activeAdIndex, setActiveAdIndex] = useState<number>(0);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);

  // Automatic shuffling between configured advertisement images and videos
  useEffect(() => {
    if (subView !== 'buy-coin' || CONFIGURED_AD_MEDIA.length <= 1) return;

    const currentMedia = CONFIGURED_AD_MEDIA[activeAdIndex];
    if (!currentMedia) return;

    if (currentMedia.type === 'image') {
      const duration = currentMedia.durationMs || 5000;
      const timer = setTimeout(() => {
        setActiveAdIndex((prev) => (prev + 1) % CONFIGURED_AD_MEDIA.length);
      }, duration);
      return () => clearTimeout(timer);
    }

    if (currentMedia.type === 'video') {
      // Ensure video plays normally if browser requires play()
      if (adVideoRef.current) {
        adVideoRef.current.currentTime = 0;
        adVideoRef.current.play().catch(() => {});
      }
      // Safety fallback timer if video onEnded does not fire or stalls
      const fallbackTimer = setTimeout(() => {
        setActiveAdIndex((prev) => (prev + 1) % CONFIGURED_AD_MEDIA.length);
      }, 15000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [activeAdIndex, subView]);

  // Sync URL history state
  const navigateToSubView = (target: OverviewSubView) => {
    setSubView(target);
    if (typeof window !== 'undefined') {
      if (target === 'main') {
        window.history.pushState({ overviewView: 'main' }, '', '/');
      } else {
        window.history.pushState({ overviewView: target }, '', `/overview/${target}`);
      }
    }
  };

  // Handle browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/overview/buy-gift' || path === '/buy-gift') setSubView('buy-gift');
      else if (path === '/overview/buy-coin' || path === '/buy-coin') setSubView('buy-coin');
      else if (path === '/overview/request' || path === '/request') setSubView('request');
      else if (path === '/overview/convert' || path === '/convert') setSubView('convert');
      else if (path === '/overview/library' || path === '/library') setSubView('library');
      else setSubView('main');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch real pricing list when Check Price popup is opened
  useEffect(() => {
    if (showCheckPrice) {
      setPricingLoading(true);
      getRealCoinPricing().then((items) => {
        setPricingItems(items);
        setPricingLoading(false);
      });
    }
  }, [showCheckPrice]);

  // Subscribe to real user data and fetch real live history and daily events
  useEffect(() => {
    if (!currentUid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    // 1. Subscribe to real user overview fields (role, coinBalance, creditCoinBalance, giftCount)
    const unsubscribeUser = subscribeToUserOverview(currentUid, (data) => {
      if (isMounted) {
        setUserData(data);
      }
    });

    // 2. Fetch real daily events (if exists, else null)
    getRealDailyEvent().then((ev) => {
      if (isMounted) {
        setDailyEvent(ev);
      }
    });

    // 3. Fetch real last live stream stats for this user
    getRealLastLiveStream(currentUid).then((live) => {
      if (isMounted) {
        setLastLive(live);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeUser();
    };
  }, [currentUid]);

  // Handle back button on top header
  const handleHeaderBack = () => {
    if (showCheckPrice) {
      setShowCheckPrice(false);
      return;
    }
    if (subView !== 'main') {
      navigateToSubView('main');
    } else {
      onBack();
    }
  };

  // Sub-view title mapper
  const getSubViewTitle = () => {
    switch (subView) {
      case 'buy-gift':
        return 'Buy Gift';
      case 'buy-coin':
        return 'Buy Coin';
      case 'request':
        return 'Request';
      case 'convert':
        return 'Convert';
      case 'library':
        return 'LIVE LIBRARY';
      default:
        return 'Overview';
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white overflow-hidden">
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

      {/* FIXED TOP HEADER */}
      <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/10 bg-slate-950/90 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleHeaderBack}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              aria-label="Go Back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <LayoutDashboard className="h-3 w-3" />
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight">
                {getSubViewTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900">
              <img
                src="/tezocron_logo.svg"
                alt="TEZOCRON EXTENDED"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* COMPACT MAIN CONTENT AREA (Fits neatly between fixed header and fixed bottom nav) */}
      <main
        className={`relative z-10 mx-auto w-full max-w-lg flex-1 min-h-0 px-3 py-2 sm:px-4 sm:py-3 ${
          subView === 'buy-coin' || subView === 'request' || subView === 'convert' || subView === 'library'
            ? 'overflow-y-auto flex flex-col justify-start'
            : 'overflow-y-auto sm:overflow-hidden flex flex-col justify-center'
        }`}
      >
        <AnimatePresence mode="wait">
          {subView === 'main' ? (
            /* COMPACT 5 ROUNDED CARDS OVERVIEW LAYOUT (PAGE 21) */
            <motion.div
              key="overview-main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-2 sm:gap-2.5 w-full my-auto"
            >
              {/* PAGE 28: LIBRARY NAVIGATION COMPONENT (Upper available area above stat boxes) */}
              <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-300 tracking-tight">
                    Click to view library
                  </span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Library className="h-3 w-3" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigateToSubView('library')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 py-2 sm:py-2.5 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-pink-500/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Library className="h-4 w-4" />
                  <span>Library</span>
                </button>
              </div>

              {/* TOP 4 CARDS: 2x2 COMPACT GRID */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* BOX 1 — USER ROLE / DAILY EVENT */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
                        User Role
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <UserCheck className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 text-xs font-bold text-white tracking-tight leading-snug truncate" title={`User Role: ${userData.role || 'Member'}`}>
                      User Role: <span className="text-blue-300 font-extrabold">{userData.role || 'Member'}</span>
                    </div>
                  </div>

                  {/* REAL Daily Event from Firestore (only shown if real document exists) */}
                  {dailyEvent && dailyEvent.title ? (
                    <div className="mt-1.5 pt-1 border-t border-white/10">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Daily Event
                      </div>
                      <div className="text-[11px] font-semibold text-slate-200 truncate">
                        {dailyEvent.title}
                      </div>
                      {dailyEvent.description ? (
                        <div className="text-[9px] text-slate-400 truncate">
                          {dailyEvent.description}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* BOX 2 — LAST LIVE INFO */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        Last Live
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Radio className="h-3 w-3" />
                      </div>
                    </div>

                    {lastLive ? (
                      <div className="mt-1 space-y-0.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[10px]">Viewer:</span>
                          <span className="font-bold text-white">{lastLive.viewersCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[10px]">Emoji:</span>
                          <span className="font-bold text-white">{lastLive.reactionsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[10px]">Gift:</span>
                          <span className="font-bold text-white">{lastLive.giftsCount}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] sm:text-[11px] font-medium text-slate-400 italic">
                        No live history yet
                      </div>
                    )}
                  </div>
                </div>

                {/* BOX 3 — GIFT / BUY GIFT */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-pink-400 uppercase">
                        Gift
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Gift className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1">
                      <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                        {userData.giftCount}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Gifts</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToSubView('buy-gift')}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 py-1.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-pink-500/25 transition-all hover:from-pink-500 hover:to-rose-400 active:scale-[0.98]"
                  >
                    <Gift className="h-3 w-3" />
                    <span>BUY GIFT</span>
                  </button>
                </div>

                {/* BOX 4 — COIN BALANCE / BUY COIN */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
                        Coin Balance
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Coins className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1">
                      <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                        {userData.coinBalance}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Coins</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToSubView('buy-coin')}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
                  >
                    <Coins className="h-3 w-3" />
                    <span>BUY COIN</span>
                  </button>
                </div>
              </div>

              {/* BOX 5 — REQUEST / CONVERT COIN (Centered below) */}
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-2 sm:p-2.5 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigateToSubView('request')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 active:scale-[0.98]"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" />
                    <span>REQUEST</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToSubView('convert')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-300 transition-all hover:bg-blue-500/20 active:scale-[0.98]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                    <span>CONVERT COIN</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : subView === 'buy-coin' ? (
            /* ========================================================
               PAGE 22 — BUY COIN SCREEN (EXTENSION OF PAGE 21)
               5 COMPACT ROUNDED/CURVED BOXES + TAZO CARD ADVERTISEMENT
            ======================================================== */
            <motion.div
              key="overview-buy-coin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-2 sm:gap-2.5 w-full pb-3"
            >
              {/* TOP 2 BOXES: COMPACT 2-COLUMN GRID (BOX 1 & BOX 2) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* BOX 1 — CREDIT COIN BALANCE */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-pink-400 uppercase truncate">
                        Credit Coin Balance
                      </span>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Sparkles className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1">
                      <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                        {userData.creditCoinBalance ?? 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Coins</span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[9px] text-slate-400 font-medium">
                    Credited Coin Offer
                  </div>
                </div>

                {/* BOX 2 — COIN BALANCE */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
                        Coin Balance
                      </span>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Coins className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline gap-1">
                      <div className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                        {userData.coinBalance ?? 0}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Coins</span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[9px] text-slate-400 font-medium">
                    Remaining Tazo Balance
                  </div>
                </div>
              </div>

              {/* BOX 3 — TAZO COIN INFORMATION */}
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="flex h-4 w-4 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Info className="h-2.5 w-2.5" />
                  </div>
                  <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
                    Tazo Coin Information
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] font-medium text-slate-200 leading-snug">
                  Get your Tazo Coin and card at an affordable price.
                </p>
              </div>

              {/* BOX 4 — BUY COIN / CHECK PRICE */}
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white tracking-tight">Buy Coin</span>
                      <p className="text-[10px] text-slate-400 leading-none mt-0.5">Active coin package pricing</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCheckPrice(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 px-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
                  >
                    <span>Check Price</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* BOX 5 — PAYMENT METHOD */}
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-slate-300 border border-white/10">
                      <CreditCard className="h-3 w-3" />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-300 uppercase">
                      Payment Method
                    </span>
                  </div>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium text-slate-400 border border-white/10">
                    Not configured
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Visibly presented non-functional payment-method button */}
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-[11px] font-semibold text-slate-300 opacity-80 cursor-not-allowed"
                    title="Payment processing is intentionally not configured yet"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                      <span>Payment Method</span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                      Inactive
                    </span>
                  </button>

                  {/* Functional link area for the Tazo offer page */}
                  <div
                    onClick={() => {
                      const link = 'https://paystack.shop/pay/tazo-card';
                      const a = document.createElement('a');
                      a.href = link;
                      a.target = '_blank';
                      a.rel = 'noopener noreferrer';
                      a.click();
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-pink-500/20 bg-pink-500/5 py-1.5 px-3 transition-all hover:border-pink-500/40 hover:bg-pink-500/10 active:scale-[0.99]"
                    title="Visit Tazo Card Offer (Paystack)"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ExternalLink className="h-3 w-3 text-pink-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider">
                          Tazo Offer Page
                        </span>
                        <span className="text-[10px] font-mono text-slate-300 truncate">
                          https://paystack.shop/pay/tazo-card
                        </span>
                      </div>
                    </div>
                    <a
                      href="https://paystack.shop/pay/tazo-card"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 ml-2 rounded-lg border border-pink-500/30 bg-pink-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-pink-300 hover:bg-pink-500/30 hover:text-white transition-all active:scale-95"
                    >
                      Visit
                    </a>
                  </div>
                </div>
              </div>

              {/* 6. TAZO CARD ADVERTISEMENT (VISUALLY SEPARATED BELOW 5 BOXES) */}
              <div className="mt-1 w-full flex flex-col gap-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                      Advertisement
                    </span>
                    {CONFIGURED_AD_MEDIA[activeAdIndex] && (
                      <span className="rounded bg-pink-500/20 px-1 py-0.2 text-[8px] font-extrabold uppercase text-pink-300">
                        {CONFIGURED_AD_MEDIA[activeAdIndex].type === 'video' ? 'Video' : 'Image'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold text-pink-400/80">
                      Tazo Card
                    </span>
                    {CONFIGURED_AD_MEDIA.length > 1 && (
                      <div className="flex items-center gap-1 ml-1">
                        {CONFIGURED_AD_MEDIA.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveAdIndex(idx)}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === activeAdIndex ? 'w-3.5 bg-pink-400' : 'w-1.5 bg-white/20'
                            }`}
                            aria-label={`Show ${item.alt}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg shadow-black/50 aspect-[16/9] max-h-44 sm:max-h-56 flex items-center justify-center">
                  {CONFIGURED_AD_MEDIA.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center">
                      <span className="text-[11px] text-slate-500">No advertisements configured</span>
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      {CONFIGURED_AD_MEDIA[activeAdIndex]?.type === 'video' ? (
                        <motion.div
                          key={CONFIGURED_AD_MEDIA[activeAdIndex].id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="h-full w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40"
                        >
                          <video
                            ref={adVideoRef}
                            src={CONFIGURED_AD_MEDIA[activeAdIndex].src}
                            autoPlay
                            muted
                            playsInline
                            preload="auto"
                            onEnded={() => setActiveAdIndex((prev) => (prev + 1) % CONFIGURED_AD_MEDIA.length)}
                            className="h-full w-full object-contain rounded-2xl"
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key={CONFIGURED_AD_MEDIA[activeAdIndex]?.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="h-full w-full flex items-center justify-center overflow-hidden rounded-2xl"
                        >
                          <img
                            src={CONFIGURED_AD_MEDIA[activeAdIndex]?.src}
                            alt={CONFIGURED_AD_MEDIA[activeAdIndex]?.alt || 'Advertisement'}
                            className="h-full w-full object-contain rounded-2xl"
                            referrerPolicy="no-referrer"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </motion.div>
          ) : subView === 'request' ? (
            /* ========================================================
               PAGE: REQUEST (STEP 25)
               Make a request input + Send + Request a Card + Tazo Ad
            ======================================================== */
            <motion.div
              key="overview-request"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3 pb-8 w-full"
            >
              {/* 1. "MAKE A REQUEST" INPUT BOX */}
              <div className="flex flex-col gap-1.5 rounded-3xl border border-white/10 bg-slate-900/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="user-request-input" className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span className="text-blue-400">Make a request</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold tracking-wide ${
                      requestWordCount >= 100
                        ? 'text-pink-400 font-bold'
                        : requestWordCount >= 85
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {requestWordCount}/100 words • {remainingWords} remaining
                  </span>
                </div>

                <div className="relative w-full">
                  <textarea
                    id="user-request-input"
                    rows={4}
                    value={requestText}
                    onChange={handleRequestChange}
                    placeholder="Make a request"
                    disabled={isSubmittingRequest}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all leading-relaxed"
                  />
                  {requestWordCount >= 100 && (
                    <div className="mt-1 text-[10px] text-pink-400 font-medium px-1">
                      Maximum 100-word limit reached.
                    </div>
                  )}
                </div>

                {/* Status / Alert Banner */}
                {requestStatus && (
                  <div
                    className={`mt-1 flex items-start gap-2 rounded-2xl p-2.5 text-xs ${
                      requestStatus.type === 'success'
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : requestStatus.type === 'unconfigured'
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border border-pink-500/30 bg-pink-500/10 text-pink-300'
                    }`}
                  >
                    {requestStatus.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : requestStatus.type === 'unconfigured' ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
                    )}
                    <span className="leading-snug text-[11px]">{requestStatus.message}</span>
                  </div>
                )}
              </div>

              {/* 2. SEND BUTTON */}
              <button
                type="button"
                onClick={handleSendRequest}
                disabled={!isSendActive}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.99] ${
                  isSendActive
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 shadow-blue-500/25 cursor-pointer'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed shadow-none border border-white/5'
                }`}
              >
                {isSubmittingRequest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>SENDING REQUEST...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>SEND</span>
                  </>
                )}
              </button>

              {/* Admin Inbox Shortcut for connectjhv247@gmail.com */}
              {currentUser?.email === 'connectjhv247@gmail.com' && (
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', '/admin/requests');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 py-2 px-3 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Inbox className="h-3.5 w-3.5 text-blue-400" />
                  <span>Admin Inbox: View User Requests (/admin/requests) &rarr;</span>
                </button>
              )}

              {/* 3. "REQUEST A CARD" NAVIGATION BUTTON */}
              <a
                href="https://paystack.shop/pay/tazo-card"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-3 sm:p-3.5 backdrop-blur-xl shadow-lg shadow-black/40 transition-all hover:border-pink-500/30 hover:bg-slate-900/90 active:scale-[0.99] group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500/20 to-blue-500/20 border border-pink-500/30 text-pink-400 group-hover:scale-105 transition-transform">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-white tracking-tight group-hover:text-pink-300 transition-colors">
                      Request
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Request a card
                    </span>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 group-hover:bg-pink-500/20 group-hover:text-pink-300 group-hover:border-pink-500/30 transition-all">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </a>

              {/* 4. TAZO CARD ADVERTISEMENT */}
              <div className="w-full flex flex-col gap-1 mt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    Advertisement
                  </span>
                  <span className="text-[9px] font-semibold text-pink-400/80">
                    Tazo Card
                  </span>
                </div>

                <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg shadow-black/50 aspect-[16/9] max-h-44 sm:max-h-56 flex items-center justify-center">
                  <img
                    src="/tazo_card_ad.jpg"
                    alt="Tazo Card Advertisement"
                    className="h-full w-full object-contain rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </motion.div>
          ) : subView === 'convert' ? (
            /* ========================================================
               PAGE 27: CONVERT COINS & SAVINGS / WITHDRAWAL
               Real authenticated Firestore data only
            ======================================================== */
            <motion.div
              key="overview-convert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-2.5 pb-6 w-full"
            >
              {/* 1. SMALL COIN BALANCE BOX */}
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-3 sm:p-3.5 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/30 text-amber-300">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Coin Balance
                    </span>
                    <span className="text-base sm:text-lg font-black tracking-tight text-white font-mono">
                      {userData.coinBalance.toLocaleString()}
                      <span className="ml-1 text-xs font-semibold text-amber-300 font-sans">Coins</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-pink-500/20 bg-pink-500/10 px-2.5 py-1 text-[10px] font-bold text-pink-300">
                  <Sparkles className="h-3 w-3 text-pink-400" />
                  <span>Real Balance</span>
                </div>
              </div>

              {/* Status Banner / Feedback */}
              {convertStatus && (
                <div
                  className={`flex items-start gap-2 rounded-2xl p-2.5 text-xs transition-all ${
                    convertStatus.type === 'success'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : convertStatus.type === 'warning'
                      ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                      : 'border border-pink-500/30 bg-pink-500/10 text-pink-300'
                  }`}
                >
                  {convertStatus.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : convertStatus.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
                  )}
                  <span className="leading-snug text-[11px] font-medium">{convertStatus.message}</span>
                </div>
              )}

              {/* 2. DASHBOARD ONE — CONVERT COINS */}
              <div className="flex flex-col gap-2.5 rounded-3xl border border-white/10 bg-slate-900/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight uppercase tracking-wider">
                      Convert Coins
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-400">
                    Rate: 1 Coin = ₦1
                  </span>
                </div>

                {/* A. CONVERT AMOUNT INPUT */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <label htmlFor="convert-amount-input" className="text-xs font-semibold text-slate-300">
                      Convert Amount
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Available: <span className="font-mono text-white font-bold">{userData.coinBalance.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="convert-amount-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={convertInput}
                      onChange={handleConvertInputChange}
                      placeholder="0"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-2.5 pl-3.5 pr-16 text-sm font-mono font-bold text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleMaxCoins}
                      disabled={userData.coinBalance <= 0}
                      className="absolute right-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-40 border border-blue-500/30 px-2 py-1 text-[10px] font-bold text-blue-300 uppercase transition-colors"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* B. AUTOMATIC NAIRA CALCULATION */}
                <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 p-2.5 sm:p-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                      Calculated Naira Value
                    </span>
                    <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight mt-0.5">
                      ₦{calculatedNaira.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-medium text-blue-300/80 block">
                      Rule: 1 coin = ₦1
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">
                      {enteredCoinAmount.toLocaleString()} {enteredCoinAmount === 1 ? 'Coin' : 'Coins'} = ₦{calculatedNaira.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. DASHBOARD TWO — WITHDRAWAL / SAVINGS FUNCTIONS */}
              <div className="flex flex-col gap-2.5 rounded-3xl border border-white/10 bg-slate-900/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight uppercase tracking-wider">
                      Withdrawal & Savings
                    </span>
                  </div>
                </div>

                {/* SPLIT ROW: ADD TO SAVE (LEFT) & SAVED AMOUNT DISPLAY (RIGHT) */}
                <div className="grid grid-cols-2 gap-2.5 items-stretch">
                  {/* B. ADD TO SAVE BUTTON */}
                  <div className="flex flex-col justify-between rounded-2xl border border-pink-500/25 bg-pink-500/10 p-2.5 sm:p-3 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
                        Savings Vault
                      </span>
                      <span className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                        Deposit coins to your safe
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenSaveModal}
                      disabled={userData.coinBalance <= 0}
                      className={`mt-2 flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold text-white shadow-md transition-all active:scale-95 ${
                        userData.coinBalance > 0
                          ? 'bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 shadow-pink-500/20 cursor-pointer'
                          : 'bg-white/10 text-slate-500 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Add to Save</span>
                    </button>
                  </div>

                  {/* C. SAVED AMOUNT DISPLAY */}
                  <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 sm:p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Saved Amount
                      </span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-300 border border-white/10">
                        <Coins className="h-3 w-3" />
                      </div>
                    </div>

                    <div className="mt-1 flex flex-col">
                      <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                        ₦{(userData.savedAmount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-pink-400 font-semibold font-mono">
                        {(userData.savedAmount || 0).toLocaleString()} coins saved
                      </span>
                    </div>
                  </div>
                </div>

                {/* A. REQUEST WITHDRAWAL BUTTON */}
                <button
                  type="button"
                  onClick={handleRequestWithdrawal}
                  className="flex w-full items-center justify-between rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-pink-600/20 p-3 text-left transition-all hover:border-blue-500/50 hover:bg-slate-900/90 active:scale-[0.99] group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 group-hover:scale-105 transition-transform">
                      <Send className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white tracking-tight group-hover:text-blue-200 transition-colors">
                        Request Withdrawal
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {enteredCoinAmount > 0
                          ? `Proceed with ₦${calculatedNaira.toLocaleString()} (${enteredCoinAmount} coins)`
                          : 'Submit official withdrawal request'}
                      </span>
                    </div>
                  </div>

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 group-hover:bg-blue-500/20 group-hover:text-blue-300 group-hover:border-blue-500/30 transition-all">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </button>

                {/* 4. CHANGE CURRENCY BUTTON (INTENTIONALLY DISABLED / NON-FUNCTIONAL) */}
                <div
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-slate-400 cursor-not-allowed select-none"
                  title="Currency options other than Naira (₦) are currently unavailable"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-slate-400 border border-white/10">
                      <span className="text-xs font-bold font-mono">₦</span>
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      Change Currency
                    </span>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-400">
                    NGN (Default)
                  </span>
                </div>
              </div>

              {/* 5. ADVERTISEMENT AREA */}
              <div className="w-full flex flex-col gap-1 mt-0.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    Advertisement
                  </span>
                  <span className="text-[9px] font-semibold text-pink-400/80">
                    Tazo Card
                  </span>
                </div>

                <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg shadow-black/50 aspect-[16/9] max-h-40 sm:max-h-52 flex items-center justify-center">
                  <img
                    src="/tazo_card_ad.jpg"
                    alt="Tazo Card Advertisement"
                    className="h-full w-full object-contain rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </motion.div>
          ) : subView === 'library' ? (
            /* ========================================================
               PAGE 29: LIVE LIBRARY PAGE
               Header: LIVE LIBRARY
               2 Top Balance Boxes:
                 - Box 1: Naira Balance (Real from Firestore)
                 - Box 2: Coin Balance (Real from Firestore)
               2 Middle Setting Boxes:
                 - Box 1: Set viewer amount to watch (Min — 50 viewers | Max — 250 viewers | Extended — 500 viewers)
                 - Box 2: Set viewer count deduction (Special Event — 1 | Favourite — 1 | Hot — 2)
            ======================================================== */
            <motion.div
              key="overview-live-library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-2.5 pb-6 w-full"
            >
              {/* 2. TOP BALANCE AREA: TWO SMALL FLAT COMPACT ROUNDED BOXES */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full">
                {/* BOX 1 — NAIRA BALANCE */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-2.5 sm:p-3 backdrop-blur-xl shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Naira Balance
                    </span>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <span className="text-[10px] font-bold font-mono">₦</span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                      ₦{userData.nairaBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* BOX 2 — COIN BALANCE */}
                <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-2.5 sm:p-3 backdrop-blur-xl shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Coin Balance
                    </span>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Coins className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                      {userData.coinBalance.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Coins</span>
                  </div>
                </div>
              </div>

              {/* Status / Feedback Banner */}
              {liveLibraryStatus && (
                <div
                  className={`flex items-start gap-2 rounded-2xl p-2.5 text-xs transition-all ${
                    liveLibraryStatus.type === 'success'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border border-pink-500/30 bg-pink-500/10 text-pink-300'
                  }`}
                >
                  {liveLibraryStatus.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
                  )}
                  <span className="leading-snug text-[11px] font-medium">{liveLibraryStatus.message}</span>
                </div>
              )}

              {/* 3. MIDDLE AREA — TWO COMPACT MAIN ROUNDED BOXES */}

              {/* BOX 1 — VIEWER AMOUNT SETTING */}
              <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-slate-900/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Set viewer amount to watch
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Select one</span>
                </div>

                <div className="flex flex-col gap-1.5 mt-0.5">
                  {[
                    { key: 'min' as LiveViewerAmountOption, label: 'Min — 50 viewers' },
                    { key: 'max' as LiveViewerAmountOption, label: 'Max — 250 viewers' },
                    { key: 'extended' as LiveViewerAmountOption, label: 'Extended — 500 viewers' },
                  ].map((opt) => {
                    const isSelected = userData.liveViewerAmount === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleSelectViewerAmount(opt.key)}
                        disabled={isUpdatingLiveSetting}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.99] cursor-pointer ${
                          isSelected
                            ? 'border-blue-500/40 bg-blue-500/15 text-white shadow-sm shadow-blue-500/10'
                            : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20 hover:bg-slate-950/80'
                        }`}
                      >
                        <span className="text-xs font-semibold tracking-tight">
                          {opt.label}
                        </span>

                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? 'border-blue-400 bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                              : 'border-white/20 bg-white/5 text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BOX 2 — VIEWER COUNT DEDUCTION SETTING */}
              <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-slate-900/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <Flame className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Set viewer count deduction
                    </h3>
                  </div>
                  <span className="text-[10px] text-pink-400/80 font-medium">Adds to base 2 coins/s</span>
                </div>

                <div className="flex flex-col gap-1.5 mt-0.5">
                  {[
                    { key: 'special_event' as LiveViewerDeductionOption, label: 'Special Event — 1' },
                    { key: 'favourite' as LiveViewerDeductionOption, label: 'Favourite — 1' },
                    { key: 'hot' as LiveViewerDeductionOption, label: 'Hot — 2' },
                  ].map((opt) => {
                    const isSelected = userData.liveViewerDeduction === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleSelectViewerDeduction(opt.key)}
                        disabled={isUpdatingLiveSetting}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.99] cursor-pointer ${
                          isSelected
                            ? 'border-pink-500/40 bg-pink-500/15 text-white shadow-sm shadow-pink-500/10'
                            : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20 hover:bg-slate-950/80'
                        }`}
                      >
                        <span className="text-xs font-semibold tracking-tight">
                          {opt.label}
                        </span>

                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? 'border-pink-400 bg-pink-500 text-white shadow-sm shadow-pink-500/30'
                              : 'border-white/20 bg-white/5 text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            /* SUB-PAGES: EMPTY CONTENT (As required: Just Header & Empty Content Foundation) */
            <motion.div
              key={`overview-${subView}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-1 w-full"
            />
          )}
        </AnimatePresence>
      </main>

      {/* CHECK PRICE POPUP / MINI-PAGE MODAL */}
      <AnimatePresence>
        {showCheckPrice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-5 text-left shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Tazo Coin Pricing
                    </h3>
                    <p className="text-[10px] text-slate-400">Configured official rates</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckPrice(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* PRICE CONTENT: ONLY REAL DATA OR CLEAN EMPTY STATE (NO INVENTED DATA) */}
              <div className="py-5">
                {pricingLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span className="text-[11px] text-slate-400 font-medium">Checking price source...</span>
                  </div>
                ) : pricingItems.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {pricingItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{item.name || `${item.coins} Coins`}</span>
                          {item.description && <span className="text-[10px] text-slate-400">{item.description}</span>}
                        </div>
                        <span className="text-xs font-extrabold text-blue-400">
                          {item.currency || '$'}{item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center px-2 py-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
                      <Tag className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Pricing Not Configured</h4>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs">
                      Pricing has not yet been configured. Official rates and coin packages will appear here once configured.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-1 pt-3 border-t border-white/10 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowCheckPrice(false)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-2 px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ADD TO SAVE POPUP / MINI-PAGE MODAL */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-5 text-left shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Add to Save
                    </h3>
                    <p className="text-[10px] text-slate-400">Transfer coins to your secure savings</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 border border-white/10">
                  <span className="text-xs text-slate-400">Available Balance:</span>
                  <span className="text-xs font-mono font-bold text-white">{userData.coinBalance.toLocaleString()} Coins</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="save-amount-modal-input" className="text-xs font-semibold text-slate-300">
                    Amount to Save (Coins)
                  </label>
                  <input
                    id="save-amount-modal-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={saveAmountInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      if (!v) {
                        setSaveAmountInput('');
                        return;
                      }
                      const n = parseInt(v, 10);
                      if (n > userData.coinBalance) {
                        setSaveAmountInput(String(userData.coinBalance));
                      } else {
                        setSaveAmountInput(v);
                      }
                    }}
                    placeholder="Enter coin amount"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm font-mono font-bold text-white placeholder-slate-600 focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/50 transition-all"
                  />
                </div>

                {/* Quick percentage buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveAmountInput(String(Math.floor(userData.coinBalance * 0.25)))}
                    className="rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveAmountInput(String(Math.floor(userData.coinBalance * 0.5)))}
                    className="rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveAmountInput(String(userData.coinBalance))}
                    className="rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    100% (Max)
                  </button>
                </div>

                <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-2.5 text-[11px] text-pink-300 flex items-center justify-between">
                  <span>Calculated Savings Value:</span>
                  <span className="font-mono font-bold">₦{(parseInt(saveAmountInput, 10) || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSavingCoins}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveCoins}
                  disabled={isSavingCoins || !parseInt(saveAmountInput, 10) || parseInt(saveAmountInput, 10) <= 0}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 py-2.5 px-3 text-xs font-bold text-white shadow-lg shadow-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:from-pink-500 hover:to-pink-400 transition-all cursor-pointer"
                >
                  {isSavingCoins ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm & Save</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
