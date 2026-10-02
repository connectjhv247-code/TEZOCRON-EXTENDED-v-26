import { motion } from 'motion/react';
import { ArrowLeft, FileText, Building2, CheckCircle2 } from 'lucide-react';

interface TermsServiceScreenProps {
  onBack: () => void;
}

export default function TermsServiceScreen({ onBack }: TermsServiceScreenProps) {
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
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Terms & Service
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
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-300">
              <FileText className="h-3.5 w-3.5 text-pink-400" />
              <span>Official Document</span>
            </div>

            <h2 className="mt-3 text-lg sm:text-xl font-extrabold tracking-tight text-white">
              TEZOCRON EXTENDED — Terms of Service
            </h2>

            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-300">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Company: Jaz Media Parustarta (JMP)</span>
            </div>
          </div>

          {/* Terms Content Clauses */}
          <div className="mt-6 space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <p>
                By using TEZOCRON EXTENDED, you agree to use the app responsibly and comply with applicable laws. You are responsible for the content and activity associated with your account.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <p>
                Do not use TEZOCRON EXTENDED to post, share, or distribute illegal, harmful, abusive, fraudulent, or rights-infringing content.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <p>
                You must keep your account information secure and must not misuse other users&apos; accounts or information.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <p>
                Jaz Media Parustarta (JMP) may restrict or suspend accounts that violate these Terms or misuse the service.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <p>
                TEZOCRON EXTENDED may be updated or changed from time to time to improve the service.
              </p>
            </div>

            <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-4 text-slate-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
                <p className="font-medium">
                  By creating or using an account, you acknowledge that you have read and accepted these Terms of Service.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="mt-8 border-t border-white/10 pt-5 text-right">
            <p className="text-xs font-semibold text-slate-200">
              Jaz Media Parustarta (JMP)
            </p>
            <p className="text-[11px] font-bold tracking-wider text-pink-400 uppercase">
              TEZOCRON EXTENDED
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
