import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, Mail, Lock, Shield, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { User as FirebaseUser, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { translateAuthError } from '../lib/authUtils';
import { ensureUserRelateLink, buildUsernameUrl } from '../lib/relateLinkService';
import { generateUniqueUsername } from '../lib/generateUsername';

interface CreateAccountScreenProps {
  selectedRole: string;
  googleUser: FirebaseUser | null;
  onBack: () => void;
  onSuccess: () => void;
}

export default function CreateAccountScreen({
  selectedRole,
  googleUser,
  onBack,
  onSuccess,
}: CreateAccountScreenProps) {
  // Pre-fill fields from Google account if available
  const initialName =
    googleUser?.displayName ||
    googleUser?.email?.split('@')[0] ||
    '';
  const initialEmail = googleUser?.email || '';

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isGoogleAccount = Boolean(googleUser);

  // Field level validation rules
  const isNameValid = name.trim().length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isRoleValid = Boolean(selectedRole && selectedRole.trim().length > 0);
  const isPasswordValid = isGoogleAccount
    ? true
    : password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;

  // The Create button remains DISABLED until EVERY required condition is met
  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isRoleValid &&
    isPasswordValid &&
    privacyAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isFormValid) {
      if (!privacyAccepted) {
        setErrorMessage('Please accept the Privacy Policy to continue.');
      } else if (!isPasswordValid && !isGoogleAccount) {
        setErrorMessage('Passwords do not match or are less than 6 characters.');
      } else {
        setErrorMessage('Please fill in all required fields accurately.');
      }
      return;
    }

    setLoading(true);

    try {
      let currentUser = auth.currentUser || googleUser;

      if (!currentUser && !isGoogleAccount) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        currentUser = userCredential.user;
      }

      if (currentUser) {
        // Update Firebase Auth user display name
        await updateProfile(currentUser, {
          displayName: name.trim(),
        });

        // Auto-generate clean, unique username from displayName
        const autoUsername = await generateUniqueUsername(name.trim(), currentUser.uid);
        const autoRelateUrl = buildUsernameUrl(autoUsername);

        // Store role & privacy acceptance record in Firestore
        await setDoc(
          doc(firestore, 'users', currentUser.uid),
          {
            uid: currentUser.uid,
            email: currentUser.email || email.trim(),
            full_name: name.trim(),
            display_name: name.trim(),
            username: autoUsername,
            relate_url: autoRelateUrl,
            play_role: selectedRole,
            privacy_accepted: true,
            account_created_at: new Date().toISOString(),
          },
          { merge: true }
        );

        // Automatically create and store the unique public Relate Link
        try {
          await ensureUserRelateLink(currentUser.uid, name.trim(), autoUsername);
        } catch (linkErr) {
          console.warn('Auto relate link generation warning:', linkErr);
        }

        setSuccessMessage('Account created successfully!');
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        setErrorMessage('Unable to finalize account registration. Please try again.');
      }
    } catch (err) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-slate-950 text-white selection:bg-pink-500 selection:text-white">
      {/* Background Decorative Accent Gradients */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-pink-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

      {/* Top Navigation Header */}
      <div className="relative z-10 flex w-full max-w-md items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
          <img src="/tezocron_logo.svg" alt="TEZOCRON EXTENDED Logo" className="h-4 w-4 rounded-full object-cover" referrerPolicy="no-referrer" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            TEZOCRON EXTENDED
          </span>
        </div>

        <div className="w-10" />
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 my-auto flex w-full max-w-md flex-col px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Create Account
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Enter your details to complete your TEZOCRON EXTENDED account.
            </p>
          </div>

          {/* User Alert Messages */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3.5 text-xs text-pink-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Name Field */}
            <div>
              <label className="mb-1.5 ml-2 block text-xs font-semibold text-slate-300">
                Name
              </label>
              <div className="relative">
                <User className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full rounded-full border border-white/15 bg-white/5 py-3 pr-4 pl-11 text-sm text-white placeholder-slate-500 transition-all focus:border-pink-500 focus:bg-white/10 focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Email Field */}
            <div>
              <label className="mb-1.5 ml-2 block text-xs font-semibold text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  disabled={isGoogleAccount}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={`w-full rounded-full border border-white/15 py-3 pr-4 pl-11 text-sm text-white transition-all ${
                    isGoogleAccount
                      ? 'bg-slate-800/80 text-slate-300 cursor-not-allowed border-white/10'
                      : 'bg-white/5 placeholder-slate-500 focus:border-pink-500 focus:bg-white/10 focus:outline-none'
                  }`}
                />
              </div>
            </div>

            {/* 3. Play Role Field (Populated from Step 3 Single Role Selection) */}
            <div>
              <label className="mb-1.5 ml-2 block text-xs font-semibold text-slate-300">
                Play Role
              </label>
              <div className="relative">
                <Shield className="absolute top-3.5 left-4 h-4 w-4 text-pink-400" />
                <input
                  type="text"
                  readOnly
                  value={selectedRole || 'Role Selected'}
                  className="w-full cursor-default rounded-full border border-pink-500/30 bg-pink-500/10 py-3 pr-4 pl-11 text-sm font-semibold text-pink-200 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* 4 & 5. Password & Confirm Password (Email/Password Flow Only) */}
            {!isGoogleAccount ? (
              <>
                <div>
                  <label className="mb-1.5 ml-2 block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pr-11 pl-11 text-sm text-white placeholder-slate-500 transition-all focus:border-pink-500 focus:bg-white/10 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-3.5 right-4 text-slate-400 transition-colors hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 ml-2 block text-xs font-semibold text-slate-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute top-3.5 left-4 h-4 w-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pr-11 pl-11 text-sm text-white placeholder-slate-500 transition-all focus:border-pink-500 focus:bg-white/10 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute top-3.5 right-4 text-slate-400 transition-colors hover:text-white"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 ml-2 text-[11px] font-medium text-pink-400">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-center text-xs text-blue-300">
                Authenticated via Google Account Session
              </div>
            )}

            {/* Privacy Policy Checkbox (Unchecked by default) */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs leading-relaxed text-slate-300 transition-colors group-hover:text-white">
                  I accept the{' '}
                  <span className="font-semibold text-pink-400 underline">
                    Privacy Policy
                  </span>
                </span>
              </label>
            </div>

            {/* Create Account Submit Button (Disabled until ALL conditions met) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isFormValid || loading}
                className={`group relative flex w-full items-center justify-center rounded-full p-0.5 font-bold text-white shadow-lg transition-all duration-300 ${
                  isFormValid && !loading
                    ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 shadow-blue-500/25 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/30 active:scale-[0.98]'
                    : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500 opacity-50 shadow-none'
                }`}
              >
                <span className="flex w-full items-center justify-center rounded-full bg-slate-950/20 py-3.5 px-6 text-sm backdrop-blur-sm group-hover:bg-transparent">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    'Create Account'
                  )}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 pb-8 text-center text-xs text-slate-500">
        TEZOCRON EXTENDED &bull; Registration Gateway
      </div>
    </div>
  );
}
