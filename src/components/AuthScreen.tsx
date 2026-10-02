import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Mail, Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, HeartHandshake } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { auth, googleProvider, firestore } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { translateAuthError } from '../lib/authUtils';
import { detectRelateIdFromLocation } from '../lib/relateLinkService';

interface AuthScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  onContinue: () => void;
}

type AuthMode = 'select' | 'register' | 'login';

export default function AuthScreen({ onBack, onSuccess, onContinue }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasPendingRelate, setHasPendingRelate] = useState(false);

  useEffect(() => {
    if (detectRelateIdFromLocation()) {
      setHasPendingRelate(true);
    }
  }, []);

  const resetForm = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // 1. Real Account Registration (Continue Flow)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    resetForm();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (userCredential.user) {
        // Brand new user registration -> proceed to role selection
        onContinue();
      }
    } catch (err) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. Real Email/Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setLoading(true);
    resetForm();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (userCredential.user) {
        // Existing registered user sign-in -> go directly to app
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // 3. Real Google OAuth
  const handleGoogleAuth = async () => {
    setLoading(true);
    resetForm();

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const additionalInfo = getAdditionalUserInfo(result);
        const isNewUser = additionalInfo?.isNewUser ?? false;

        // Check if user document already exists in Firestore
        try {
          const userDocRef = doc(firestore, 'users', result.user.uid);
          const userDoc = await getDoc(userDocRef);

          if (!isNewUser || userDoc.exists()) {
            // Existing registered user -> go directly to app
            onSuccess();
          } else {
            // New user registration -> proceed to role selection
            onContinue();
          }
        } catch {
          // Fallback to onSuccess if offline/query error
          onSuccess();
        }
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

      {/* Top Header */}
      <div className="relative z-10 flex w-full max-w-md items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={() => {
            if (mode !== 'select') {
              handleModeChange('select');
            } else {
              onBack();
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
          <img src="/tezocron_logo.svg" alt="TEZOCRON EXTENDED Logo" className="h-4 w-4 rounded-full object-cover" referrerPolicy="no-referrer" />
          <span className="text-xs font-semibold text-slate-200 tracking-wider uppercase">TEZOCRON EXTENDED</span>
        </div>

        <div className="w-10" />
      </div>

      {/* Main Form Box */}
      <div className="relative z-10 my-auto flex w-full max-w-md flex-col px-6 py-6">
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
        >
          {/* Header Title & Subtitle */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              {mode === 'select' && 'Welcome'}
              {mode === 'register' && 'Continue'}
              {mode === 'login' && 'Sign In'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              {mode === 'select' && 'Choose your preferred access method below.'}
              {mode === 'register' && 'Enter your details to continue with TEZOCRON EXTENDED.'}
              {mode === 'login' && 'Enter your account credentials to log in.'}
            </p>
          </div>

          {/* Pending Relate Link Banner */}
          {hasPendingRelate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 flex items-center gap-3 rounded-2xl border border-pink-500/40 bg-gradient-to-r from-pink-500/20 via-purple-600/20 to-blue-600/20 p-3 text-xs text-white"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/30 text-pink-300">
                <HeartHandshake className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-white">You're invited to Relate!</p>
                <p className="text-[11px] text-pink-200">
                  Sign in or create an account to connect with this member.
                </p>
              </div>
            </motion.div>
          )}

          {/* User-friendly Error Alert */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3.5 text-xs text-pink-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* User-friendly Success Alert */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-200"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* 1. SELECTION MODE (Three Main Rounded Buttons) */}
            {mode === 'select' && (
              <motion.div
                key="select-mode"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="space-y-3.5"
              >
                {/* Button 1: Continue */}
                <button
                  type="button"
                  onClick={onContinue}
                  className="group relative flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 p-0.5 font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="flex w-full items-center justify-center rounded-full bg-slate-950/20 py-3.5 px-6 text-sm backdrop-blur-sm group-hover:bg-transparent">
                    Continue
                  </span>
                </button>

                {/* Button 2: Login */}
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 py-3.5 px-6 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/10 active:scale-[0.98]"
                >
                  Login
                </button>

                <div className="relative py-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <span className="relative bg-slate-900 px-3 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    or
                  </span>
                </div>

                {/* Button 3: Continue with Google */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 py-3.5 px-6 text-sm font-semibold text-white backdrop-blur-md transition-all hover:border-pink-500/40 hover:bg-white/15 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-pink-400" />
                  ) : (
                    <>
                      {/* Custom Clean Google Icon */}
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* 2. REGISTER FORM (Continue Flow) */}
            {mode === 'register' && (
              <motion.form
                key="register-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-pink-500 focus:bg-white/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 focus:border-pink-500 focus:bg-white/10 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 transition-colors hover:text-white"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    'Continue'
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="text-xs text-slate-400 hover:text-pink-400 transition-colors"
                  >
                    Already have an account? <span className="font-semibold text-white underline">Sign In</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* 3. LOGIN FORM */}
            {mode === 'login' && (
              <motion.form
                key="login-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-white/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-white/10 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 transition-colors hover:text-white"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    'Log In'
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleModeChange('register')}
                    className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Need an account? <span className="font-semibold text-white underline">Create Account</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 pb-8 text-center text-xs text-slate-500">
        TEZOCRON EXTENDED &bull; Secure Connection
      </div>
    </div>
  );
}
