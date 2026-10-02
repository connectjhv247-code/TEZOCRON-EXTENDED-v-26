import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  User,
  Camera,
  Eye,
  Heart,
  HeartHandshake,
  Sparkles,
  Shield,
  ShieldAlert,
  Check,
  Calendar,
  Mail,
  Edit3,
  X,
  UploadCloud,
  Lock,
  Settings as SettingsIcon,
  RefreshCw,
  AlertCircle,
  Share2,
  Plus,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import CreatePostModal from './CreatePostModal';
import PostCard from './PostCard';
import { UserPost, subscribeToUserPosts, deleteRealPost } from '../lib/postService';
import {
  UserProfileData,
  fetchUserProfile,
  uploadProfilePicture,
  updateUserProfileDetails,
  recordProfileView,
  getProfileViewsCount,
  getRelateCount,
  isUserRelated,
  toggleRelate,
  getLoveCount,
  hasUserLoved,
  toggleProfileLove,
} from '../lib/profileService';
import RelateLinkCard from './RelateLinkCard';
import { ensureUserRelateLink, buildRelateUrl, buildUsernameUrl } from '../lib/relateLinkService';
import ReportAccountModal from './ReportAccountModal';

interface ProfileScreenProps {
  user: FirebaseUser;
  targetUserId?: string;
  onBack: () => void;
  onOpenSettings?: () => void;
  isFromRelateLink?: boolean;
}

export default function ProfileScreen({
  user,
  targetUserId,
  onBack,
  onOpenSettings,
  isFromRelateLink = false,
}: ProfileScreenProps) {
  const profileUserId = targetUserId || user.uid;
  const isOwner = user.uid === profileUserId;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  // Counters
  const [viewsCount, setViewsCount] = useState<number>(0);
  const [relateCount, setRelateCount] = useState<number>(0);
  const [loveCount, setLoveCount] = useState<number>(0);

  // Relate Link State
  const [relateId, setRelateId] = useState<string>('');
  const [relateUrl, setRelateUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  // Interaction States for other users
  const [isRelated, setIsRelated] = useState(false);
  const [isLoved, setIsLoved] = useState(false);
  const [loveActionLoading, setLoveActionLoading] = useState(false);
  const [relateActionLoading, setRelateActionLoading] = useState(false);

  // Upload State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Profile Details Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRole, setEditRole] = useState('Gamer');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

  // Step 11B: Posts & Media State
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  // Step 15: Real Report Account State
  const [showReportModal, setShowReportModal] = useState(false);

  // Load Profile and Metrics
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch user data
      const data = await fetchUserProfile(profileUserId);

      // Check Privacy rules
      if (data) {
        setProfileData(data);
        const privacy = data.settings?.privacy?.profileVisibility || 'public';
        const restricted = !isOwner && privacy === 'private';
        setIsPrivate(restricted);

        setEditName(data.full_name || data.display_name || user.displayName || '');
        setEditBio(data.bio || '');
        setEditRole(data.play_role || 'Gamer');
      } else if (isOwner) {
        // First-time owner profile fallback
        const fallbackData: UserProfileData = {
          uid: user.uid,
          email: user.email || '',
          full_name: user.displayName || 'TEZOCRON Member',
          display_name: user.displayName || 'TEZOCRON Member',
          photo_url: user.photoURL || undefined,
          play_role: 'Gamer',
          account_created_at: user.metadata.creationTime || new Date().toISOString(),
        };
        setProfileData(fallbackData);
        setEditName(user.displayName || 'TEZOCRON Member');
      }

      // 2. Record View Event (ONLY if non-owner is visiting)
      if (!isOwner) {
        await recordProfileView(profileUserId, user.uid);
      }

      // 3. Ensure User Relate Link & Username exist and are stored
      let currentRelateId = data?.relate_id;
      let currentRelateUrl = data?.relate_url;
      let currentUsername = data?.username;

      if (!currentUsername || !currentRelateUrl) {
        try {
          const ensured = await ensureUserRelateLink(
            profileUserId,
            data?.full_name || data?.display_name || user.displayName || 'TEZOCRON Member',
            currentUsername
          );
          currentRelateId = ensured.relateId;
          currentRelateUrl = ensured.relateUrl;
          currentUsername = ensured.username;
        } catch (linkErr) {
          console.warn('ensureUserRelateLink warning:', linkErr);
        }
      }

      if (currentRelateId) {
        setRelateId(currentRelateId);
        setRelateUrl(
          currentRelateUrl ||
            (currentUsername ? buildUsernameUrl(currentUsername) : buildRelateUrl(currentRelateId))
        );
        setUsername(currentUsername || '');
      }

      // 4. Load Real Counters concurrently
      const [views, relates, loves, relatedState, lovedState] = await Promise.all([
        getProfileViewsCount(profileUserId),
        getRelateCount(profileUserId),
        getLoveCount(profileUserId),
        isUserRelated(profileUserId, user.uid),
        hasUserLoved(profileUserId, user.uid),
      ]);

      setViewsCount(views);
      setRelateCount(relates);
      setLoveCount(loves);
      setIsRelated(relatedState);
      setIsLoved(lovedState);
    } catch (err) {
      console.warn('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [profileUserId, user.uid, user.displayName, user.email, user.photoURL, user.metadata.creationTime, isOwner]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Handle Profile Picture Picker & Upload
  const handleAvatarClick = () => {
    if (!isOwner || uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadFeedback({ type: 'error', message: 'Please select a valid image file.' });
      return;
    }

    // Limit to reasonable initial size (12MB)
    if (file.size > 12 * 1024 * 1024) {
      setUploadFeedback({ type: 'error', message: 'Selected image exceeds the 12MB limit.' });
      return;
    }

    try {
      setUploadingAvatar(true);
      setUploadFeedback(null);

      const downloadUrl = await uploadProfilePicture(file, profileUserId);

      // Update state immediately
      setProfileData((prev) =>
        prev ? { ...prev, photo_url: downloadUrl } : { uid: profileUserId, photo_url: downloadUrl }
      );

      setUploadFeedback({ type: 'success', message: 'Profile picture updated successfully.' });
      setTimeout(() => setUploadFeedback(null), 3000);
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: "We couldn't upload your media. Please try again." });
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Edit Profile Save
  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditFeedback('Display name cannot be empty.');
      return;
    }

    setSavingEdit(true);
    setEditFeedback(null);

    try {
      await updateUserProfileDetails(profileUserId, {
        full_name: editName.trim(),
        bio: editBio.trim(),
        play_role: editRole,
      });

      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              full_name: editName.trim(),
              display_name: editName.trim(),
              bio: editBio.trim(),
              play_role: editRole,
            }
          : prev
      );

      setShowEditModal(false);
    } catch {
      setEditFeedback('Unable to save changes. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Love Toggle
  const handleToggleLove = async () => {
    if (loveActionLoading) return;
    setLoveActionLoading(true);
    try {
      const result = await toggleProfileLove(profileUserId, user.uid);
      setIsLoved(result.loved);
      setLoveCount(result.newCount);
    } catch (err) {
      console.warn('Love toggle error:', err);
    } finally {
      setLoveActionLoading(false);
    }
  };

  // Handle Relate Toggle
  const handleToggleRelate = async () => {
    if (relateActionLoading) return;
    setRelateActionLoading(true);
    try {
      const result = await toggleRelate(profileUserId, user.uid);
      setIsRelated(result.related);
      setRelateCount(result.newCount);
    } catch (err) {
      console.warn('Relate toggle error:', err);
    } finally {
      setRelateActionLoading(false);
    }
  };

  // Step 11B: Subscribe to real-time posts
  useEffect(() => {
    setLoadingPosts(true);
    const unsubscribe = subscribeToUserPosts(profileUserId, isOwner, (loadedPosts) => {
      setPosts(loadedPosts);
      setLoadingPosts(false);
    });
    return () => unsubscribe();
  }, [profileUserId, isOwner]);

  // Handle Post Deletion
  const handleDeletePost = async (postId: string) => {
    try {
      await deleteRealPost(profileUserId, postId, user.uid);
    } catch (err) {
      console.warn('Error deleting post:', err);
    }
  };

  const displayName = profileData?.full_name || profileData?.display_name || user.displayName || 'TEZOCRON Member';
  const role = profileData?.play_role || 'Member';
  const avatarUrl = profileData?.photo_url || user.photoURL || null;
  const userBio = profileData?.bio || 'Ready to connect, play, and stream on TEZOCRON EXTENDED.';
  const creationDate = profileData?.account_created_at || user.metadata.creationTime;
  const formattedCreationDate = creationDate
    ? new Date(creationDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Active Member';

  const visibilitySetting = profileData?.settings?.privacy?.profileVisibility || 'public';

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Ambient background decorative accents */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/15 blur-3xl" />

      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 px-4 py-3.5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
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
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <User className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                {isOwner ? 'My Profile' : `${displayName}'s Profile`}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOwner && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 hover:text-white active:scale-95 shadow-sm"
                title="Report account to TEZOCRON"
                aria-label="Report this account"
              >
                <ShieldAlert className="h-4 w-4" />
              </button>
            )}

            {isOwner && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                title="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            )}

            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-sm">
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

      {/* Main Profile Page Body */}
      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        {loading ? (
          <div className="flex min-h-[340px] w-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Loading Profile...
            </p>
          </div>
        ) : isPrivate ? (
          /* ========================================================
             PRIVATE PROFILE NOTICE (Backend privacy enforcement)
          ======================================================== */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-xl backdrop-blur-xl"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20 mb-4">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">This Profile is Private</h2>
            <p className="mt-2 text-xs text-slate-400 max-w-xs leading-relaxed">
              The account owner has restricted access to their profile and activity according to TEZOCRON EXTENDED privacy rules.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              Return to Previous Page
            </button>
          </motion.div>
        ) : (
          <>
            {/* Feedback notifications */}
            {uploadFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl p-3.5 text-xs flex items-center gap-2 border ${
                  uploadFeedback.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
                }`}
              >
                {uploadFeedback.type === 'success' ? (
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span>{uploadFeedback.message}</span>
              </motion.div>
            )}

            {/* Opened via Relate Link Banner */}
            {isFromRelateLink && !isOwner && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-pink-500/40 bg-gradient-to-r from-pink-500/20 via-purple-600/20 to-blue-600/20 p-3.5 shadow-lg backdrop-blur-xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/30 text-pink-300 border border-pink-500/40 shadow-sm">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Opened via TEZOCRON Relate Link</p>
                    <p className="text-[11px] text-pink-300">
                      Connect directly with {displayName} using the Relate button below!
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-pink-400/40 bg-pink-500/30 px-2.5 py-1 text-[10px] font-bold text-pink-200">
                  Direct Link
                </span>
              </motion.div>
            )}

            {/* ========================================================
                1 & 2. HERO PROFILE CARD — PICTURE, NAME & DETAILS
            ======================================================== */}
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
              {/* Profile Background Accent */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-600/20 via-pink-600/20 to-indigo-600/20" />

              <div className="relative flex flex-col items-center text-center pt-2">
                {/* Real Profile Picture Container */}
                <div className="relative mb-3.5">
                  <div
                    onClick={handleAvatarClick}
                    role={isOwner ? 'button' : undefined}
                    aria-label={isOwner ? 'Change profile picture' : `${displayName}'s avatar`}
                    className={`relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center overflow-hidden rounded-full border-2 border-pink-500/50 bg-slate-950 shadow-xl transition-all ${
                      isOwner
                        ? 'cursor-pointer hover:border-pink-400 hover:scale-[1.02] active:scale-95 group'
                        : ''
                    }`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-600/40 via-purple-600/30 to-pink-600/40 text-white font-bold text-2xl">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Uploading Overlay Spinner */}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                        <RefreshCw className="h-6 w-6 animate-spin text-pink-400" />
                        <span className="mt-1 text-[10px] font-bold text-pink-300">Saving...</span>
                      </div>
                    )}

                    {/* Owner Hover/Tappable Camera Badge */}
                    {isOwner && !uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                        <Camera className="h-6 w-6 text-white drop-shadow" />
                      </div>
                    )}
                  </div>

                  {/* Owner Floating Camera Action Button */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      title="Upload profile picture"
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-lg shadow-pink-500/30 transition-transform hover:scale-110 active:scale-90"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  )}

                  {/* Hidden Real File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Name & Verified Badge */}
                <div className="flex items-center gap-1.5 justify-center">
                  <h2 className="text-lg font-bold text-white tracking-tight">{displayName}</h2>
                  {user.emailVerified && isOwner && (
                    <span
                      title="Verified Account"
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px]"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Simple Username Handle */}
                {username && (
                  <p className="mt-0.5 font-mono text-xs font-semibold text-pink-400">
                    @{username}
                  </p>
                )}

                {/* Role Pill & Privacy Indicator */}
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-0.5 text-xs font-semibold text-blue-300">
                    {role}
                  </span>

                  {isOwner && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize ${
                        visibilitySetting === 'public'
                          ? 'border-green-500/30 bg-green-500/10 text-green-300'
                          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {visibilitySetting} Profile
                    </span>
                  )}
                </div>

                {/* Bio Details */}
                <p className="mt-3 text-xs text-slate-300 max-w-sm leading-relaxed">{userBio}</p>

                {/* Owner: Edit Profile Button / Non-Owner: Relate & Love Actions */}
                <div className="mt-5 flex w-full items-center justify-center gap-2.5">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <>
                      {/* Non-Owner Relate Action Button */}
                      <button
                        type="button"
                        onClick={handleToggleRelate}
                        disabled={relateActionLoading}
                        className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all active:scale-95 shadow-md ${
                          isRelated
                            ? 'border border-pink-500/40 bg-pink-500/20 text-pink-300'
                            : isFromRelateLink
                            ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-pink-500/30 ring-2 ring-pink-400 ring-offset-2 ring-offset-slate-900 animate-pulse hover:scale-105'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25 hover:scale-105'
                        }`}
                      >
                        <HeartHandshake className="h-3.5 w-3.5" />
                        <span>{isRelated ? 'Related' : 'Relate'}</span>
                      </button>

                      {/* Non-Owner Love Action Button */}
                      <button
                        type="button"
                        onClick={handleToggleLove}
                        disabled={loveActionLoading}
                        aria-label="Love this profile"
                        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 border ${
                          isLoved
                            ? 'border-pink-500 bg-pink-500/20 text-pink-300 shadow-md shadow-pink-500/25'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            isLoved ? 'fill-pink-500 text-pink-500' : 'text-slate-400'
                          }`}
                        />
                        <span>{isLoved ? 'Loved ❤️' : 'Love ❤️'}</span>
                      </button>

                      {/* Non-Owner Report Action Button */}
                      <button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        aria-label="Report this account"
                        title="Report this account to TEZOCRON"
                        className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-white shadow-xs"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                        <span>Report</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ========================================================
                4, 5, 6. METRICS & COUNTERS CARD
                - PROFILE VIEWS (Eye icon)
                - RELATE COUNT (Sparkles icon)
                - LOVE ❤️ COUNT (Heart icon)
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 sm:p-5 shadow-xl backdrop-blur-xl">
              <div className="grid grid-cols-3 divide-x divide-white/10 text-center">
                {/* 4. Profile Views with Eye icon */}
                <div className="flex flex-col items-center justify-center px-2 py-1">
                  <div className="flex items-center gap-1 text-blue-400 mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-base font-bold text-white">
                      {viewsCount.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Views</span>
                </div>

                {/* 5. Relate Count */}
                <div className="flex flex-col items-center justify-center px-2 py-1">
                  <div className="flex items-center gap-1 text-pink-400 mb-1">
                    <HeartHandshake className="h-4 w-4" />
                    <span className="text-base font-bold text-white">
                      {relateCount.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Relate</span>
                </div>

                {/* 6. Love ❤️ Count */}
                <div className="flex flex-col items-center justify-center px-2 py-1">
                  <div className="flex items-center gap-1 text-pink-500 mb-1">
                    <Heart className="h-4 w-4 fill-pink-500" />
                    <span className="text-base font-bold text-white">
                      {loveCount.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Love ❤️</span>
                </div>
              </div>

              {/* Informative footer */}
              {isOwner && (
                <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-blue-400" /> Real viewer metrics
                  </span>
                  <span>Unique authenticated interactions</span>
                </div>
              )}
            </section>

            {/* ========================================================
                TEZOCRON RELATE LINK (Safe Public Username & One-Touch Sharing)
            ======================================================== */}
            {(username || relateId) && (
              <RelateLinkCard
                relateId={relateId}
                relateUrl={relateUrl || (username ? buildUsernameUrl(username) : buildRelateUrl(relateId))}
                username={username}
                displayName={displayName}
                isOwner={isOwner}
              />
            )}

            {/* ========================================================
                PUBLIC PROFILE DETAILS SECTION
            ======================================================== */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl space-y-3.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                Account Details
              </h3>

              <div className="space-y-3 text-xs">
                {/* Username */}
                {username && (
                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <User className="h-4 w-4 text-pink-400" />
                      <span>Username</span>
                    </div>
                    <span className="font-mono font-semibold text-pink-300 text-[11px]">@{username}</span>
                  </div>
                )}

                {/* Account Email (shown for owner) */}
                {isOwner && profileData?.email && (
                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <Mail className="h-4 w-4 text-blue-400" />
                      <span>Email</span>
                    </div>
                    <span className="font-mono text-white text-[11px]">{profileData.email}</span>
                  </div>
                )}

                {/* Play Role */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <User className="h-4 w-4 text-pink-400" />
                    <span>Role / Category</span>
                  </div>
                  <span className="font-semibold text-white text-[11px]">{role}</span>
                </div>

                {/* Member Since */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Member Since</span>
                  </div>
                  <span className="text-slate-200 text-[11px]">{formattedCreationDate}</span>
                </div>

                {/* Privacy Status */}
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Shield className="h-4 w-4 text-blue-400" />
                    <span>Profile Visibility</span>
                  </div>
                  <span className="text-slate-200 text-[11px] capitalize font-medium">
                    {visibilitySetting}
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================
                STEP 11B: POSTS & MEDIA SECTION
            ======================================================== */}
            <section className="space-y-4">
              {/* Header with Title and Create Post Button */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">Posts & Media</h3>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-pink-300 border border-white/5">
                    {posts.length}
                  </span>
                </div>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowCreatePostModal(true)}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-pink-500/20 hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Post</span>
                  </button>
                )}
              </div>

              {/* Posts List or Empty State */}
              {loadingPosts ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
                  <RefreshCw className="h-6 w-6 animate-spin text-pink-400 mb-2" />
                  <span className="text-xs text-slate-400">Loading posts...</span>
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 mb-3">
                    <ImageIcon className="h-6 w-6 text-pink-400/80" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">No Posts Yet</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs mb-4">
                    {isOwner
                      ? 'Share your first picture or video post with the TEZOCRON community.'
                      : 'This user hasn’t shared any public posts yet.'}
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowCreatePostModal(true)}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-pink-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-105 active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Post</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      isOwner={isOwner}
                      onDeletePost={handleDeletePost}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ========================================================
          EDIT PROFILE DETAILS MODAL
      ======================================================== */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl"
            >
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Edit Profile</h3>
                  <p className="text-xs text-slate-400">Update your public profile details</p>
                </div>
              </div>

              {editFeedback && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                  {editFeedback}
                </div>
              )}

              <form onSubmit={handleSaveProfileDetails} className="space-y-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block mb-1 font-semibold text-slate-300">Display Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                {/* Play Role Selection */}
                <div>
                  <label className="block mb-1 font-semibold text-slate-300">Play Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                  >
                    <option value="Gamer">Gamer</option>
                    <option value="Content Creator">Content Creator</option>
                    <option value="Streamer">Streamer</option>
                    <option value="Pro Player">Pro Player</option>
                    <option value="Esports Fan">Esports Fan</option>
                    <option value="Member">Community Member</option>
                  </select>
                </div>

                {/* Bio / Description */}
                <div>
                  <label className="block mb-1 font-semibold text-slate-300">Bio</label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell other members about yourself..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 font-semibold text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 rounded-full bg-gradient-to-r from-pink-600 to-pink-500 py-2.5 font-bold text-white shadow-lg shadow-pink-500/25 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          STEP 11B: CREATE POST MODAL (Photo & Video Picker)
      ======================================================== */}
      {isOwner && (
        <CreatePostModal
          isOpen={showCreatePostModal}
          onClose={() => setShowCreatePostModal(false)}
          currentUser={user}
          authorName={displayName}
          authorPhoto={avatarUrl || undefined}
        />
      )}

      {/* ========================================================
          STEP 15: REAL REPORT ACCOUNT MODAL
      ======================================================== */}
      <AnimatePresence>
        {showReportModal && !isOwner && (
          <ReportAccountModal
            currentUser={user}
            reportedUserId={profileUserId}
            reportedUserName={displayName}
            reportedUserPhoto={avatarUrl || undefined}
            reportedUserEmail={profileData?.email || undefined}
            profileRef={relateUrl || `https://tezocron.com/relate/${profileUserId}`}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
