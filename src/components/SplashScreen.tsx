import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onJoin: () => void;
}

export default function SplashScreen({ onJoin }: SplashScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-slate-950 text-white selection:bg-pink-500 selection:text-white">
      {/* Background Decorative Gradient Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />

      {/* Subtle Grid Accent */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* Top Header Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 pt-10 text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500"></span>
          </span>
          <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
            Official Release v2.0
          </span>
        </div>
      </motion.div>

      {/* Main Branding Section */}
      <div className="relative z-10 my-auto flex max-w-md flex-col items-center px-6 text-center">
        {/* Animated Brand Logo Icon Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.1, type: 'spring', stiffness: 120 }}
          className="group relative mb-8"
        >
          {/* Glowing Ring */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 via-pink-500 to-blue-500 opacity-70 blur-xl transition duration-500 group-hover:opacity-100" />

          {/* Logo Card */}
          <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-white/20 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
            <img
              src="/tezocron_logo.svg"
              alt="TEZOCRON EXTENDED Official Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
        >
          TEZOCRON{' '}
          <span className="bg-gradient-to-r from-pink-400 via-pink-500 to-blue-400 bg-clip-text text-transparent">
            EXTENDED
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base"
        >
          Next-generation social connectivity platform powered by advanced real-time communication.
        </motion.p>
      </div>

      {/* Bottom Action Area */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 w-full max-w-md px-6 pb-12 text-center"
      >
        <button
          onClick={onJoin}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 p-0.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-950/20 px-8 py-4 backdrop-blur-sm transition duration-300 group-hover:bg-transparent">
            <span className="text-base font-bold tracking-wide">Join</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Secure Cloud Infrastructure</span>
        </div>
      </motion.div>
    </div>
  );
}
