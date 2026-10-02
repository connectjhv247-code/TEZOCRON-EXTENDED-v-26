import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  Bell,
  LogOut,
  MessageSquare,
  Radio,
  HeartHandshake,
  ShieldCheck,
  AlertTriangle,
  User,
  Settings,
  Shield,
  ShieldAlert,
  FileText,
  HelpCircle,
  X,
  LayoutDashboard,
  Lock,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';
import NotificationScreen from './NotificationScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsServiceScreen from './TermsServiceScreen';
import HelpScreen from './HelpScreen';
import OverviewScreen from './OverviewScreen';
import SocialChatScreen from './SocialChatScreen';
import RelateScreen from './RelateScreen';
import AdminReportsScreen from './AdminReportsScreen';
import AdminRequestsPage from './AdminRequestsPage';
import AdminDashboardScreen from './AdminDashboardScreen';
import GoLiveArea from './GoLiveArea';
import RealtimeNotificationPopup from './RealtimeNotificationPopup';
import {
  detectRelateIdFromLocation,
  resolveRelateLink,
  clearPendingRelateTarget,
} from '../lib/relateLinkService';
import { subscribeToUnreadNotificationsCount } from '../lib/notificationService';
import { isAuthorizedAdminEmail } from '../lib/adminAuthService';

type NavigationScreen =
  | 'home'
  | 'profile'
  | 'settings'
  | 'notification'
  | 'privacy'
  | 'terms'
  | 'help'
  | 'chat'
  | 'admin-dashboard'
  | 'admin-reports'
  | 'admin-requests'
  | 'overview';

interface MainHomepageScreenProps {
  user: FirebaseUser;
  userRole?: string;
  onSignOut: () => void;
  initialTargetProfileUserId?: string;
  initialIsFromRelateLink?: boolean;
}

export default function MainHomepageScreen({
  user,
  userRole = 'Member',
  onSignOut,
  initialTargetProfileUserId,
  initialIsFromRelateLink = false,
}: MainHomepageScreenProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'golive' | 'relate'>('golive');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<NavigationScreen>(
    initialTargetProfileUserId ? 'profile' : 'home'
  );
  const [targetProfileUserId, setTargetProfileUserId] = useState<string | undefined>(
    initialTargetProfileUserId
  );
  const [isFromRelateLink, setIsFromRelateLink] = useState<boolean>(initialIsFromRelateLink);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [targetLiveChannel, setTargetLiveChannel] = useState<string | undefined>(undefined);
  const [goLiveClickCount, setGoLiveClickCount] = useState<number>(0);

  const handleGoLiveNavClick = () => {
    setActiveTab('golive');
    setGoLiveClickCount((prev) => prev + 1);
  };

  // Subscribe to real-time unread notification count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUnreadNotificationsCount(user.uid, (count) => {
      setUnreadNotifCount(count);
    });
    return () => unsub();
  }, [user?.uid]);

  // Monitor visual viewport height for Android virtual keyboard compatibility
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    handleViewportResize();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    } else {
      window.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      } else {
        window.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);

  // Monitor URL path or parameters for Relate link (e.g. /relate/userID or ?relate=userID)
  useEffect(() => {
    const handleUrlRelateCheck = async () => {
      const detectedId = detectRelateIdFromLocation();
      if (!detectedId) return;

      try {
        const resolved = await resolveRelateLink(detectedId);
        if (resolved) {
          clearPendingRelateTarget();
          setTargetProfileUserId(resolved.userId);
          setIsFromRelateLink(true);
          setCurrentScreen('profile');
          // Backward compatibility: redirect from /relate/tz_... to /@username
          if (resolved.wasLegacyRelateId && resolved.username) {
            window.history.replaceState({}, '', `/@${resolved.username}`);
          }
        }
      } catch (err) {
        console.warn('Relate link route detection warning:', err);
      }
    };

    handleUrlRelateCheck();
    window.addEventListener('popstate', handleUrlRelateCheck);
    return () => window.removeEventListener('popstate', handleUrlRelateCheck);
  }, []);

  // Monitor URL for /admin-dashboard and admin management routes
  useEffect(() => {
    const handleUrlAdminCheck = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;

      const isAdminRoute =
        path === '/admin-dashboard' ||
        path.startsWith('/admin-dashboard') ||
        hash === '#admin-dashboard' ||
        search.includes('admin=dashboard') ||
        path === '/admin/requests' ||
        hash === '#admin/requests' ||
        search.includes('admin=requests') ||
        path === '/admin/reports' ||
        path.startsWith('/admin') ||
        hash === '#admin/reports' ||
        search.includes('admin=reports');

      if (isAdminRoute) {
        // Route Guard: Normal users who log in with other emails should NOT see or access admin dashboard. Redirect them to home page "/".
        if (!isAuthorizedAdminEmail(user?.email)) {
          window.history.replaceState({}, '', '/');
          setCurrentScreen('home');
          return;
        }

        if (
          path === '/admin-dashboard' ||
          path.startsWith('/admin-dashboard') ||
          hash === '#admin-dashboard' ||
          search.includes('admin=dashboard')
        ) {
          setCurrentScreen('admin-dashboard');
        } else if (
          path === '/admin/requests' ||
          hash === '#admin/requests' ||
          search.includes('admin=requests')
        ) {
          setCurrentScreen('admin-requests');
        } else if (
          path === '/admin/reports' ||
          path.startsWith('/admin') ||
          hash === '#admin/reports' ||
          search.includes('admin=reports')
        ) {
          setCurrentScreen('admin-reports');
        }
      }
    };

    handleUrlAdminCheck();
    window.addEventListener('popstate', handleUrlAdminCheck);
    return () => window.removeEventListener('popstate', handleUrlAdminCheck);
  }, [user?.email]);

  // Monitor URL for /overview, /convert, and /library routes
  useEffect(() => {
    const handleUrlOverviewCheck = () => {
      const path = window.location.pathname;
      if (
        path === '/overview' ||
        path.startsWith('/overview/') ||
        path === '/convert' ||
        path.startsWith('/convert/') ||
        path === '/library' ||
        path.startsWith('/library/')
      ) {
        setCurrentScreen('overview');
      }
    };

    handleUrlOverviewCheck();
    window.addEventListener('popstate', handleUrlOverviewCheck);
    return () => window.removeEventListener('popstate', handleUrlOverviewCheck);
  }, []);

  // Monitor URL for /live and /live/:id route
  useEffect(() => {
    const handleUrlLiveCheck = () => {
      const path = window.location.pathname;
      if (path === '/live' || path.startsWith('/live/')) {
        const streamId = path.startsWith('/live/') ? path.replace('/live/', '').trim() : undefined;
        if (streamId) {
          setTargetLiveChannel(streamId);
        }
        setActiveTab('golive');
        setCurrentScreen('home');
      }
    };

    handleUrlLiveCheck();
    window.addEventListener('popstate', handleUrlLiveCheck);
    return () => window.removeEventListener('popstate', handleUrlLiveCheck);
  }, []);

  const handleLogoutClick = () => {
    setShowMenuPopup(false);
    setShowExitModal(true);
  };

  const handleConfirmExit = async () => {
    setShowExitModal(false);
    try {
      await signOut(auth);
      onSignOut();
    } catch {
      onSignOut();
    }
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  const handleMenuSelect = (screen: NavigationScreen) => {
    setShowMenuPopup(false);
    if (screen === 'profile') {
      setTargetProfileUserId(undefined);
      setIsFromRelateLink(false);
      setCurrentScreen('profile');
    } else if (screen === 'chat') {
      setActiveTab('chat');
      setCurrentScreen('home');
    } else if (screen === 'admin-dashboard') {
      if (!isAuthorizedAdminEmail(user?.email)) {
        window.history.pushState({}, '', '/');
        setCurrentScreen('home');
      } else {
        window.history.pushState({}, '', '/admin-dashboard');
        setCurrentScreen('admin-dashboard');
      }
    } else if (screen === 'admin-reports') {
      if (!isAuthorizedAdminEmail(user?.email)) {
        window.history.pushState({}, '', '/');
        setCurrentScreen('home');
      } else {
        window.history.pushState({}, '', '/admin/reports');
        setCurrentScreen('admin-reports');
      }
    } else if (screen === 'overview') {
      window.history.pushState({}, '', '/overview');
      setCurrentScreen('overview');
    } else {
      setCurrentScreen(screen);
    }
  };

  const handleOpenUserProfile = (targetUserId: string, fromRelateLink = false) => {
    setTargetProfileUserId(targetUserId);
    setIsFromRelateLink(fromRelateLink);
    setCurrentScreen('profile');
  };

  const handleTabChange = (tab: 'chat' | 'golive' | 'relate') => {
    setActiveTab(tab);
    setCurrentScreen('home');
  };

  const userName = user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <div
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
      className="relative flex w-full flex-col justify-between overflow-hidden bg-slate-950 text-white selection:bg-pink-500 selection:text-white font-sans"
    >
      {/* REAL-TIME POP-UP NOTIFICATION OVERLAY */}
      <RealtimeNotificationPopup
        userId={user.uid}
        onOpenUserProfile={(targetUid) => {
          handleOpenUserProfile(targetUid);
        }}
        onOpenLiveStream={(channelName) => {
          setTargetLiveChannel(channelName);
          setActiveTab('golive');
          setCurrentScreen('home');
        }}
        onOpenRelateFeed={() => {
          setActiveTab('relate');
          setCurrentScreen('home');
        }}
        onOpenNotifications={() => {
          setCurrentScreen('notification');
        }}
      />

      {/* Background Decorative Accent Gradients */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

      {/* ========================================================
          MAIN SCREEN CONTENT CONTAINER
      ======================================================== */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {/* SUB-SCREEN: PROFILE */}
        {currentScreen === 'profile' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <ProfileScreen
              user={user}
              targetUserId={targetProfileUserId}
              isFromRelateLink={isFromRelateLink}
              onBack={() => {
                setTargetProfileUserId(undefined);
                setIsFromRelateLink(false);
                setCurrentScreen('home');
              }}
              onOpenSettings={() => setCurrentScreen('settings')}
            />
          </div>
        )}

        {/* SUB-SCREEN: SETTINGS */}
        {currentScreen === 'settings' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <SettingsScreen
              user={user}
              onBack={() => setCurrentScreen('home')}
              onSignOut={onSignOut}
              onOpenAdminDashboard={() => {
                window.history.pushState({}, '', '/admin-dashboard');
                setCurrentScreen('admin-dashboard');
              }}
              onOpenAdminReports={() => {
                window.history.pushState({}, '', '/admin/reports');
                setCurrentScreen('admin-reports');
              }}
              onOpenAdminRequests={() => {
                window.history.pushState({}, '', '/admin/requests');
                setCurrentScreen('admin-requests');
              }}
            />
          </div>
        )}

        {/* SUB-SCREEN: ADMIN DASHBOARD (/admin-dashboard) */}
        {currentScreen === 'admin-dashboard' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <AdminDashboardScreen
              currentUser={user}
              onBack={() => {
                window.history.pushState({}, '', '/');
                setCurrentScreen('home');
              }}
              onSignOut={onSignOut}
              onOpenUserProfile={(targetUid) => {
                handleOpenUserProfile(targetUid);
              }}
            />
          </div>
        )}

        {/* SUB-SCREEN: ADMIN MODERATION REPORTS (/admin/reports) */}
        {currentScreen === 'admin-reports' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <AdminReportsScreen
              currentUser={user}
              onBack={() => {
                window.history.pushState({}, '', '/');
                setCurrentScreen('home');
              }}
              onOpenUserProfile={(targetUid) => {
                handleOpenUserProfile(targetUid);
              }}
            />
          </div>
        )}

        {/* SUB-SCREEN: ADMIN USER REQUESTS INBOX (/admin/requests) */}
        {currentScreen === 'admin-requests' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <AdminRequestsPage
              onBack={() => {
                window.history.pushState({}, '', '/');
                setCurrentScreen('home');
              }}
            />
          </div>
        )}

        {/* SUB-SCREEN: NOTIFICATION */}
        {currentScreen === 'notification' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <NotificationScreen
              user={user}
              onBack={() => setCurrentScreen('home')}
              onOpenUserProfile={(targetUid) => {
                handleOpenUserProfile(targetUid);
              }}
              onOpenLiveStream={(channelName) => {
                setTargetLiveChannel(channelName);
                setActiveTab('golive');
                setCurrentScreen('home');
              }}
              onOpenRelateFeed={() => {
                setActiveTab('relate');
                setCurrentScreen('home');
              }}
            />
          </div>
        )}

        {/* SUB-SCREEN: PRIVACY POLICY */}
        {currentScreen === 'privacy' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <PrivacyPolicyScreen onBack={() => setCurrentScreen('home')} />
          </div>
        )}

        {/* SUB-SCREEN: TERMS & SERVICE */}
        {currentScreen === 'terms' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <TermsServiceScreen onBack={() => setCurrentScreen('home')} />
          </div>
        )}

        {/* SUB-SCREEN: HELP */}
        {currentScreen === 'help' && (
          <div className="flex-1 min-h-0 w-full overflow-y-auto">
            <HelpScreen onBack={() => setCurrentScreen('home')} />
          </div>
        )}

        {/* SUB-SCREEN: OVERVIEW */}
        {currentScreen === 'overview' && (
          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            <OverviewScreen
              currentUser={user}
              onBack={() => {
                if (window.location.pathname.startsWith('/overview')) {
                  window.history.pushState(null, '', '/');
                }
                setCurrentScreen('home');
              }}
            />
          </div>
        )}

        {/* HOME: 3 MAIN TABS (Social Chat, Go Live, Relate) WITH STAGNATED / PERSISTENT TOP HEADER */}
        {currentScreen === 'home' && (
          <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            {/* PERSISTENT TOP HEADER COMPONENT (HIDDEN ON GO LIVE FOR IMMERSIVE 3D FULL SCREEN EXPERIENCE) */}
            {activeTab !== 'golive' && (
              <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/10 bg-slate-950/80 px-4 py-3.5 backdrop-blur-xl sm:px-6">
                <div className="mx-auto flex max-w-lg items-center justify-between">
                  {/* TEZOCRON EXTENDED BRANDING */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-md shadow-pink-500/20">
                      <img src="/tezocron_logo.svg" alt="TEZOCRON EXTENDED Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold tracking-tight text-white leading-none">
                        TEZOCRON
                      </span>
                      <span className="text-[10px] font-bold tracking-widest text-pink-400 uppercase leading-tight">
                        EXTENDED
                      </span>
                    </div>
                  </div>

                  {/* TOP-RIGHT ACTION ICONS */}
                  <div className="relative flex items-center gap-2">
                    {/* Menu Icon Button */}
                    <button
                      type="button"
                      onClick={() => setShowMenuPopup((prev) => !prev)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all active:scale-95 ${
                        showMenuPopup
                          ? 'border-blue-500/40 bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/30'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                      aria-label="Menu"
                      title="Menu"
                    >
                      {showMenuPopup ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>

                    {/* Notification Icon */}
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('notification')}
                      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                      aria-label="Notifications"
                      title="Notifications"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadNotifCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-slate-950 shadow-md shadow-pink-500/50 animate-pulse">
                          {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                        </span>
                      )}
                    </button>

                    {/* Logout Icon */}
                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300 transition-colors hover:bg-pink-500/20 hover:text-white active:scale-95"
                      aria-label="Logout"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>

                    {/* POPUP MENU */}
                    <AnimatePresence>
                      {showMenuPopup && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowMenuPopup(false)}
                          />

                          <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: -6 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="absolute top-12 right-0 z-50 w-56 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl"
                          >
                            <div className="flex flex-col gap-0.5">
                              {/* 0. Overview */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('overview')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-blue-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                  <LayoutDashboard className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Overview</span>
                              </button>

                              {/* 1. Profile */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('profile')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-blue-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                  <User className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Profile</span>
                              </button>

                              {/* 2. Settings */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('settings')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-blue-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                  <Settings className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Settings</span>
                              </button>

                              {/* 3. Notification */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('notification')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-pink-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:text-pink-300 transition-colors">
                                  <Bell className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Notification</span>
                                {unreadNotifCount > 0 && (
                                  <span className="rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm shadow-pink-500/40">
                                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                                  </span>
                                )}
                              </button>

                              <div className="my-1 h-px w-full bg-white/10" />

                              {/* 4. Privacy Policy */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('privacy')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-blue-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                  <Lock className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Privacy Policy</span>
                              </button>

                              {/* 5. Terms & Service */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('terms')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-pink-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:text-pink-300 transition-colors">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Terms & Service</span>
                              </button>

                              {/* 6. Help */}
                              <button
                                type="button"
                                onClick={() => handleMenuSelect('help')}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-200 transition-all hover:bg-blue-600/15 hover:text-white active:scale-[0.98]"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                  <HelpCircle className="h-4 w-4" />
                                </div>
                                <span className="flex-1">Help</span>
                              </button>

                              {/* 7. Admin Dashboard (Strictly connectjhv247@gmail.com only) */}
                              {isAuthorizedAdminEmail(user?.email) && (
                                <>
                                  <div className="my-1 h-px w-full bg-blue-500/20" />
                                  <button
                                    type="button"
                                    onClick={() => handleMenuSelect('admin-dashboard')}
                                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-blue-200 transition-all hover:bg-blue-600/20 hover:text-white active:scale-[0.98]"
                                  >
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 group-hover:text-blue-200 transition-colors">
                                      <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-bold">Admin Dashboard</span>
                                      <span className="text-[9px] text-blue-300 font-mono">/admin-dashboard</span>
                                    </div>
                                  </button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </header>
            )}

            {/* CONTENT AREA FOR 3 MAIN FEATURES */}
            <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
              {/* 1. SOCIAL CHAT */}
              <div
                style={{ display: activeTab === 'chat' ? 'flex' : 'none' }}
                className="flex-1 min-h-0 w-full flex-col overflow-hidden"
              >
                <SocialChatScreen
                  user={user}
                  onBack={() => setActiveTab('golive')}
                  hideHeader={true}
                />
              </div>

              {/* 2. GO LIVE */}
              <div
                style={{ display: activeTab === 'golive' ? 'flex' : 'none' }}
                className="flex-1 min-h-0 w-full flex-col overflow-hidden"
              >
                <GoLiveArea
                  user={user}
                  userRole={userRole}
                  isActiveTab={activeTab === 'golive'}
                  initialChannelName={targetLiveChannel}
                  onNavigateTab={handleTabChange}
                  goLiveClickCount={goLiveClickCount}
                />
              </div>

              {/* 3. RELATE */}
              <div
                style={{ display: activeTab === 'relate' ? 'flex' : 'none' }}
                className="flex-1 min-h-0 w-full flex-col overflow-hidden"
              >
                <RelateScreen
                  currentUser={user}
                  onOpenUserProfile={handleOpenUserProfile}
                  isActiveTab={currentScreen === 'home' && activeTab === 'relate'}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM EXIT MINI POP-UP MODAL */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-center shadow-2xl backdrop-blur-2xl"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <h3 className="text-lg font-bold text-white tracking-tight">
                Verified Your Attempt
              </h3>

              <p className="mt-1.5 text-xs text-slate-400">
                Are you sure you want to exit your session?
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelExit}
                  className="flex-1 rounded-full border border-white/15 bg-white/5 py-3 px-4 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="flex-1 rounded-full bg-gradient-to-r from-pink-600 to-pink-500 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Confirm Exit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          PERSISTENT MAIN NAVIGATION BAR (3 FEATURES)
          1. Social Chat  |  2. Go Live  |  3. Relate
          Upgraded to Premium Floating 3D Glass Dock
      ======================================================== */}
      <nav className="sticky bottom-0 z-40 w-full shrink-0 border-t border-white/10 bg-slate-950/90 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {/* 1. SOCIAL CHAT */}
          <motion.button
            whileTap={{ scale: 0.92, y: 1 }}
            type="button"
            onClick={() => handleTabChange('chat')}
            className={`group relative flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 transition-all duration-150 ${
              currentScreen === 'home' && activeTab === 'chat'
                ? 'border-t border-l border-r border-white/30 border-b-[2px] border-pink-700/80 bg-gradient-to-b from-pink-500/25 via-pink-600/15 to-transparent text-pink-300 shadow-[0_4px_12px_rgba(236,72,153,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 active:translate-y-0.5'
            }`}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Social Chat</span>
          </motion.button>

          {/* 2. GO LIVE */}
          <motion.button
            whileTap={{ scale: 0.9, y: 2 }}
            type="button"
            onClick={handleGoLiveNavClick}
            className="group relative -mt-5 flex flex-col items-center transition-all duration-150"
          >
            <div
              className={`relative flex h-13 w-13 items-center justify-center rounded-full p-0.5 transition-transform duration-150 ${
                currentScreen === 'home' && activeTab === 'golive'
                  ? 'border-t border-l border-r border-white/40 border-b-[3px] border-pink-800 bg-gradient-to-tr from-blue-600 via-indigo-500 to-pink-500 text-white shadow-[0_8px_24px_rgba(236,72,153,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)]'
                  : 'border-t border-l border-r border-white/20 border-b-[3px] border-black/80 bg-gradient-to-tr from-blue-600/80 via-indigo-600/80 to-pink-600/80 text-slate-200 shadow-[0_6px_18px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)]'
              }`}
            >
              <div className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/35 to-transparent" />
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950/20 backdrop-blur-xs">
                <Radio
                  className={`h-6 w-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                    currentScreen === 'home' && activeTab === 'golive'
                      ? 'animate-pulse text-white'
                      : 'text-slate-200'
                  }`}
                />
              </div>
            </div>
            <span
              className={`mt-0.5 text-[10px] font-black tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                currentScreen === 'home' && activeTab === 'golive'
                  ? 'text-pink-400'
                  : 'text-slate-400'
              }`}
            >
              Go Live
            </span>
          </motion.button>

          {/* 3. RELATE */}
          <motion.button
            whileTap={{ scale: 0.92, y: 1 }}
            type="button"
            onClick={() => handleTabChange('relate')}
            className={`group relative flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 transition-all duration-150 ${
              currentScreen === 'home' && activeTab === 'relate'
                ? 'border-t border-l border-r border-white/30 border-b-[2px] border-pink-700/80 bg-gradient-to-b from-pink-500/25 via-pink-600/15 to-transparent text-pink-300 shadow-[0_4px_12px_rgba(236,72,153,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 active:translate-y-0.5'
            }`}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              <HeartHandshake className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Relate</span>
          </motion.button>
        </div>
      </nav>
    </div>
  );
}
