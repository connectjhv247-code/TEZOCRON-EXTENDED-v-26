import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, AlertCircle, Loader2 } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { resolveRelateLink, buildUsernameUrl } from '../lib/relateLinkService';
import ProfileScreen from './ProfileScreen';

interface UserProfileRouteProps {
  username?: string;
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onOpenSettings?: () => void;
}

export default function UserProfileRoute({
  username,
  currentUser,
  onBack,
  onOpenSettings,
}: UserProfileRouteProps) {
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract username from props or window.location
  const targetUsername =
    username ||
    (typeof window !== 'undefined'
      ? window.location.pathname.replace(/^\/(@|u\/)/, '').split(/[/?#]/)[0]
      : '');

  useEffect(() => {
    if (!targetUsername) {
      setError('No username specified.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    resolveRelateLink(`@${targetUsername}`)
      .then((res) => {
        if (res && res.userId) {
          setResolvedUserId(res.userId);
        } else {
          setError(`No TEZOCRON member found with username @${targetUsername}.`);
        }
      })
      .catch((err) => {
        console.warn('Error resolving user by username:', err);
        setError('Unable to load user profile. Please check your connection.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetUsername]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500 mb-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Loading @{targetUsername}...
        </p>
      </div>
    );
  }

  if (error || !resolvedUserId) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-white text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 mb-4">
          <User className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Member Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          {error || `Unable to locate a profile for @${targetUsername}.`}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  // If visitor is authenticated, render full ProfileScreen
  if (currentUser) {
    return (
      <ProfileScreen
        user={currentUser}
        targetUserId={resolvedUserId}
        isFromRelateLink={true}
        onBack={onBack}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // Visitor not authenticated yet: prompt to connect
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-white text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-pink-600 text-white font-bold text-2xl mb-4 shadow-xl shadow-pink-500/20">
        @{targetUsername.charAt(0).toUpperCase()}
      </div>
      <h2 className="text-xl font-bold text-white mb-1">@{targetUsername} on TEZOCRON</h2>
      <p className="text-xs text-pink-300 font-mono mb-6">
        {buildUsernameUrl(targetUsername)}
      </p>
      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
        Sign in or create a free TEZOCRON account to connect, relate, and view full posts and live broadcasts.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-105 active:scale-95 transition-all"
      >
        Sign In to Connect
      </button>
    </div>
  );
}
