import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Lock,
  LogOut,
  RefreshCw,
  Users,
  Inbox,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Database,
  Sliders,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  verifyAdminStatus,
  provisionAdminDocument,
  AUTHORIZED_ADMIN_EMAIL,
} from '../lib/adminAuthService';
import AdminReportsScreen from './AdminReportsScreen';
import AdminRequestsPage from './AdminRequestsPage';

interface AdminDashboardScreenProps {
  currentUser: FirebaseUser;
  onBack: () => void;
  onSignOut?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

type AdminTab = 'overview' | 'reports' | 'requests' | 'security';

export default function AdminDashboardScreen({
  currentUser,
  onBack,
  onSignOut,
  onOpenUserProfile,
}: AdminDashboardScreenProps) {
  const [checking, setChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [docExists, setDocExists] = useState<boolean>(false);
  const [denialReason, setDenialReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Route Guard: verify email and check Firestore collection "admins" (doc ID = user.uid)
  const runAdminVerification = async () => {
    setChecking(true);

    // 1. Guard check: Email must be strictly connectjhv247@gmail.com
    if (
      !currentUser?.email ||
      currentUser.email.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()
    ) {
      setIsAuthorized(false);
      setDocExists(false);
      setDenialReason(
        'Access Denied: Only connectjhv247@gmail.com is authorized to enter the Admin Dashboard.'
      );
      setChecking(false);
      // Automatically redirect unauthorized user to home page
      setTimeout(() => {
        window.history.replaceState({}, '', '/');
        onBack();
      }, 1500);
      return;
    }

    // 2. Guard check: Check document existence in Firestore collection "admins" (doc ID = user UID)
    const result = await verifyAdminStatus(currentUser);

    if (result.isAdmin) {
      setIsAuthorized(true);
      setDocExists(true);
      setDenialReason('');
    } else {
      setIsAuthorized(false);
      setDocExists(result.docExists);
      setDenialReason(
        result.reason ||
          'Account record not found in Firestore collection "admins" (doc ID = user UID).'
      );
    }

    setChecking(false);
  };

  useEffect(() => {
    runAdminVerification();
  }, [currentUser]);

  // Handle auto-provision / initialize record for connectjhv247@gmail.com
  const handleProvisionRecord = async () => {
    setProvisioning(true);
    const result = await provisionAdminDocument(currentUser);
    setProvisioning(false);

    if (result.success) {
      showToast('Admin record successfully registered in Firestore "admins" collection!');
      await runAdminVerification();
    } else {
      showToast(`Error: ${result.error || 'Failed to initialize record'}`);
    }
  };

  // 1. CHECKING / LOADING STATE
  if (checking) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-white font-sans">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <RefreshCw className="h-7 w-7 animate-spin" />
          </div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Verifying Admin Security Clearance
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Checking Firestore collection <code className="text-pink-300">admins/{currentUser.uid}</code>...
          </p>
        </div>
      </div>
    );
  }

  // 2. UNAUTHORIZED / BLOCKED STATE (Route Guard)
  if (!isAuthorized) {
    const isEmailEligible =
      currentUser?.email?.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-4 sm:p-6 text-white font-sans">
        {/* Ambient background glow */}
        <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-red-600/15 blur-3xl" />
        <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

        <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-red-500/30 bg-slate-900/95 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 shadow-lg shadow-red-500/20 mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">
            Admin Access Blocked
          </h2>

          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            {denialReason ||
              'You do not have administrative authorization to access /admin-dashboard.'}
          </p>

          <div className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 text-left text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-white/5">
              <span>Account Email:</span>
              <span className="font-bold text-white truncate max-w-[200px]">
                {currentUser?.email || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 pb-1 border-b border-white/5">
              <span>Target Collection:</span>
              <span className="text-pink-300">admins/{currentUser.uid}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5">
              <span>Document Exists:</span>
              <span className={docExists ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {docExists ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* If the email matches connectjhv247@gmail.com but the document in "admins" has not been created yet */}
          {isEmailEligible && !docExists && (
            <div className="mt-5 w-full rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-left">
              <p className="font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
                <span>Authorized Admin Email Detected</span>
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Your email matches <code className="text-white font-mono">{AUTHORIZED_ADMIN_EMAIL}</code>.
                Per requirement 3 & 7, click below to initialize your admin document in Firestore.
              </p>
              <button
                type="button"
                disabled={provisioning}
                onClick={handleProvisionRecord}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {provisioning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating Admin Document...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    <span>Create & Activate Admin Document in Firestore</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-6 flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.history.replaceState({}, '', '/');
                onBack();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-2.5 px-4 text-xs font-semibold text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Home</span>
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center justify-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 py-2.5 px-4 text-xs font-semibold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. AUTHORIZED ADMIN DASHBOARD (connectjhv247@gmail.com verified in admins/{uid})
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Background Decorative Accent Gradients */}
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
            <div className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-white shadow-xl shadow-blue-500/20 backdrop-blur-xl">
              <Check className="h-4 w-4 text-blue-400" />
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          TOP ADMIN HEADER BAR
      ======================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/');
                onBack();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              title="Return to TEZOCRON App"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-extrabold text-white tracking-tight leading-none">
                    TEZOCRON Admin Console
                  </h1>
                  <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.2 text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">
                    SuperAdmin
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[220px] sm:max-w-none">
                  {currentUser.email}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runAdminVerification}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
              title="Re-verify credentials"
            >
              <RefreshCw className="h-3 w-3 text-blue-400" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, '', '/');
                onBack();
              }}
              className="flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 active:scale-95 transition-all"
            >
              <span>Back to App</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          NAV TABS (Overview, Moderation Reports, Requests Inbox, Security)
      ======================================================== */}
      <div className="border-b border-white/10 bg-slate-900/60 px-4 pt-2.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Dashboard Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Moderation Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'requests'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>User Requests Inbox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-slate-800 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-pink-400" />
            <span>Security & Rules</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          ACTIVE TAB CONTENT
      ======================================================== */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Verified Admin Capsule */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 via-slate-900/80 to-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 shadow-md">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Administrator Verified
                    </h2>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Authorized account: <strong className="text-white font-mono">{AUTHORIZED_ADMIN_EMAIL}</strong>
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Firestore Path: <span className="text-blue-300">admins/{currentUser.uid}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-2xl bg-pink-600/90 hover:bg-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-pink-500/25 transition-all active:scale-95"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Review Reports</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600/90 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
                >
                  <Inbox className="h-3.5 w-3.5" />
                  <span>View Requests</span>
                </button>
              </div>
            </div>

            {/* Quick Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Moderation Reports */}
              <div
                onClick={() => setActiveTab('reports')}
                className="group cursor-pointer rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl hover:border-pink-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 group-hover:scale-110 transition-transform">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-pink-400 transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">Account Reports</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Real community safety reports submitted by authenticated users with anonymous protection.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-pink-400">
                  <span>Manage reports</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Card 2: User Requests */}
              <div
                onClick={() => setActiveTab('requests')}
                className="group cursor-pointer rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl hover:border-indigo-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">User Requests Inbox</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Member submissions from the requests collection with author emails and timestamps.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-indigo-400">
                  <span>Open requests inbox</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Card 3: Security & Rule Verification */}
              <div
                onClick={() => setActiveTab('security')}
                className="group cursor-pointer rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl hover:border-blue-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                    <Lock className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">Security & Permissions</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Verify Firestore security rule enforcement and authorized administrator privileges.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-400">
                  <span>Inspect rule setup</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MODERATION REPORTS */}
        {activeTab === 'reports' && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 overflow-hidden shadow-2xl backdrop-blur-2xl">
            <AdminReportsScreen
              currentUser={currentUser}
              onBack={() => setActiveTab('overview')}
              onOpenUserProfile={onOpenUserProfile}
            />
          </div>
        )}

        {/* TAB 3: USER REQUESTS */}
        {activeTab === 'requests' && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/90 overflow-hidden shadow-2xl backdrop-blur-2xl">
            <AdminRequestsPage onBack={() => setActiveTab('overview')} />
          </div>
        )}

        {/* TAB 4: SECURITY & RULES */}
        {activeTab === 'security' && (
          <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Admin Access Rules & Database Security
                </h2>
                <p className="text-xs text-slate-400">
                  Strict attribute and identity enforcement deployed on Cloud Firestore
                </p>
              </div>
            </div>

            {/* Active Rule Display */}
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 font-mono text-xs text-slate-300">
              <span className="text-slate-500 block mb-1.5">// Cloud Firestore Security Rule</span>
              <pre className="text-pink-300 whitespace-pre-wrap leading-relaxed">
{`match /admins/{docId} {
  allow read, write: if isSignedIn() && request.auth.token.email == 'connectjhv247@gmail.com';
}`}
              </pre>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-white">Email Whitelist Enforced</p>
                  <p className="text-slate-400 text-[11px]">
                    Only <strong className="text-slate-200">{AUTHORIZED_ADMIN_EMAIL}</strong> can read or write in the <code className="text-pink-300">admins</code> collection.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-white">Firestore Document Existence Verified</p>
                  <p className="text-slate-400 text-[11px]">
                    Access to /admin-dashboard requires document ID = <code className="text-pink-300">{currentUser.uid}</code> in the <code className="text-pink-300">admins</code> collection.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-white">Non-Admin User Isolation</p>
                  <p className="text-slate-400 text-[11px]">
                    Normal accounts with other emails are blocked by client route guards and redirected to the home page <code className="text-blue-300">"/"</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
