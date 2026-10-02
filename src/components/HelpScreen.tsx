import { motion } from 'motion/react';
import { ArrowLeft, HelpCircle, ShieldAlert, MoreVertical, MessageSquare } from 'lucide-react';

interface HelpScreenProps {
  onBack: () => void;
}

export default function HelpScreen({ onBack }: HelpScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Ambient background accents */}
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
                <HelpCircle className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Help
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900">
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

      {/* Main Component Area */}
      <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl"
        >
          {/* Header Section */}
          <div className="border-b border-white/10 pb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <ShieldAlert className="h-3.5 w-3.5 text-blue-400" />
              <span>Safety & Support Guide</span>
            </div>

            <h2 className="mt-3 text-lg sm:text-xl font-extrabold tracking-tight text-white">
              WHAT TO DO IF YOU ARE VIOLATED
            </h2>
          </div>

          {/* Action Guidelines List */}
          <div className="mt-6 space-y-3.5 text-xs sm:text-sm text-slate-200">
            {/* Item 1 */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                1
              </span>
              <div className="flex-1 leading-relaxed">
                <span>If any user communicate or comments violently please </span>
                <span className="inline-flex items-center rounded-lg bg-pink-500/20 px-2 py-0.5 text-xs font-bold text-pink-300 border border-pink-500/30">
                  #report
                </span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                2
              </span>
              <div className="flex-1 leading-relaxed">
                <span>If any user impersonate your profile please </span>
                <span className="inline-flex items-center rounded-lg bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
                  #report
                </span>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                3
              </span>
              <div className="flex-1 leading-relaxed">
                <span>If you discover fake account or fraud please </span>
                <span className="inline-flex items-center rounded-lg bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300 border border-blue-500/30">
                  #report
                </span>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                4
              </span>
              <div className="flex-1 leading-relaxed">
                <span>If you can&apos;t block or report a user please </span>
                <span className="inline-flex items-center rounded-lg bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300 border border-red-500/30">
                  #contant our care
                </span>
              </div>
            </div>

            {/* Item 5 */}
            <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                5
              </span>
              <div className="flex-1 leading-relaxed">
                <span>If you are discomfort by any features in tezocron extended please </span>
                <span className="inline-flex items-center rounded-lg bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300 border border-red-500/30">
                  #contant our care
                </span>
              </div>
            </div>
          </div>

          {/* How to Report Instructions */}
          <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <MoreVertical className="h-4 w-4" />
              </div>
              <div className="text-xs sm:text-sm leading-relaxed">
                <span className="font-bold text-blue-200">How to report: </span>
                <span className="text-slate-200">
                  tap the 3 dot icon in message directly from the user you want to report
                </span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 border-t border-white/10 pt-5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <MessageSquare className="h-3.5 w-3.5 text-pink-400" />
              <span>TEZOCRON EXTENDED Support</span>
            </div>
            <p className="text-xs font-extrabold tracking-wider text-pink-400 uppercase">
              THANK YOU
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
