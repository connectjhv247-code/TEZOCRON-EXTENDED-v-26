import { motion } from 'motion/react';
import { ArrowLeft, Shield, Building2, Calendar, Mail, ShieldCheck, Lock, AlertCircle } from 'lucide-react';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

export default function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
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
                <Shield className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Privacy Policy
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
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Official Privacy Policy</span>
            </div>

            <h2 className="mt-3 text-lg sm:text-xl font-extrabold tracking-tight text-white">
              TEZOCRON EXTENDED — Privacy Policy
            </h2>

            <div className="mt-2 space-y-1 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Company: Jaz Media Parustarta (JMP)</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-pink-400" />
                <span>App: TEZOCRON EXTENDED</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Effective Date: [Insert date]</span>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-300">
              Jaz Media Parustarta (JMP) respects your privacy and is committed to protecting your personal information when you use TEZOCRON EXTENDED.
            </p>
          </div>

          {/* Clauses 1 - 9 */}
          <div className="mt-6 space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            {/* 1. Information We Collect */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                1. Information We Collect
              </h3>
              <p className="mt-2">
                Depending on how you use the app, we may collect information such as your name, email address, account information, profile information, content you choose to upload, and technical information required to operate and secure the service.
              </p>
              <p className="mt-2 text-slate-400">
                We collect only information reasonably necessary for the purposes described in this policy. This follows the data-minimisation and purpose-limitation principles reflected in Nigeria&apos;s data-protection framework.
              </p>
              <p className="mt-1 text-xs text-blue-400 font-semibold">
                National Data Processing Centre
              </p>
            </div>

            {/* 2. How We Use Information */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                2. How We Use Information
              </h3>
              <p className="mt-2">We may use information to:</p>
              <ul className="mt-2 list-disc list-inside space-y-1 pl-1 text-slate-200">
                <li>Create and manage your account.</li>
                <li>Authenticate and secure your account.</li>
                <li>Provide and operate TEZOCRON EXTENDED.</li>
                <li>Enable features you choose to use.</li>
                <li>Communicate important service or security information.</li>
                <li>Detect abuse, fraud and security threats.</li>
                <li>Improve the reliability and security of the service.</li>
              </ul>
              <p className="mt-2">
                We will not use personal information for unrelated purposes without an appropriate legal basis or notice where required.
              </p>
            </div>

            {/* 3. Sharing Information */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                3. Sharing Information
              </h3>
              <p className="mt-2">
                We do not sell your personal information.
              </p>
              <p className="mt-2">
                Information may be processed by service providers that help us operate TEZOCRON EXTENDED, such as authentication, hosting, data storage, notification or communication providers. Such processing should be limited to legitimate service purposes and appropriate safeguards.
              </p>
            </div>

            {/* 4. Your Privacy Rights */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                4. Your Privacy Rights
              </h3>
              <p className="mt-2">Subject to applicable law, you may have rights to:</p>
              <ul className="mt-2 list-disc list-inside space-y-1 pl-1 text-slate-200">
                <li>Request access to your personal information.</li>
                <li>Request correction of inaccurate information.</li>
                <li>Request deletion where legally applicable.</li>
                <li>Request restriction of certain processing.</li>
                <li>Withdraw consent where processing is based on consent.</li>
                <li>Raise concerns about how your information is processed.</li>
              </ul>
              <p className="mt-2 text-slate-400">
                Nigeria&apos;s Data Protection Commission provides procedures for data-subject access requests and identifies rights including access, rectification, erasure and restriction.
              </p>
              <p className="mt-1 text-xs text-blue-400 font-semibold">
                NDPC Forms
              </p>
            </div>

            {/* 5. Security */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                5. Security
              </h3>
              <p className="mt-2">
                Jaz Media Parustarta (JMP) will take reasonable technical and organisational measures to protect personal information against unauthorised access, loss, misuse, alteration or disclosure.
              </p>
              <p className="mt-2 text-slate-400">
                However, no internet-based service can guarantee absolute security.
              </p>
            </div>

            {/* 6. Data Retention */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                6. Data Retention
              </h3>
              <p className="mt-2">
                We retain personal information only for as long as reasonably necessary for the purposes for which it was collected, legal obligations, security, dispute resolution and legitimate operational requirements.
              </p>
            </div>

            {/* 7. Children's Privacy */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                7. Children&apos;s Privacy
              </h3>
              <p className="mt-2">
                TEZOCRON EXTENDED is not intended for users who are below the minimum age permitted by applicable law. We do not knowingly collect children&apos;s personal information contrary to applicable legal requirements.
              </p>
            </div>

            {/* 8. Changes to This Policy */}
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
              <h3 className="font-bold text-white text-sm">
                8. Changes to This Policy
              </h3>
              <p className="mt-2">
                We may update this Privacy Policy when our services, legal requirements or data-processing practices change. The updated version will be made available through TEZOCRON EXTENDED.
              </p>
            </div>

            {/* 9. Contact */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <h3 className="font-bold text-blue-200 text-sm">
                9. Contact
              </h3>
              <p className="mt-2">For privacy questions, requests or concerns, contact:</p>
              <p className="mt-1 font-semibold text-white">Jaz Media Parustarta (JMP)</p>
              <p className="text-xs font-bold text-pink-400 uppercase">TEZOCRON EXTENDED</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <Mail className="h-3.5 w-3.5 text-blue-400" />
                <span>Privacy contact: [Insert official privacy email address]</span>
              </div>
            </div>

            {/* TEZOCRON EXTENDED — Safety Guide Sub-section */}
            <div className="mt-8 pt-4 border-t border-white/10">
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-300">
                <AlertCircle className="h-3.5 w-3.5 text-pink-400" />
                <span>Safety Best Practices</span>
              </div>

              <h2 className="mt-3 text-base sm:text-lg font-extrabold tracking-tight text-white">
                TEZOCRON EXTENDED — Safety Guide
              </h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-pink-400" />
                    Protect Your Account
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Keep your password private and never give your login credentials or verification codes to another person.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    Protect Your Personal Information
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Avoid publicly sharing sensitive information such as passwords, financial information, private addresses or identity documents.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-pink-400" />
                    Interact Responsibly
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Do not use TEZOCRON EXTENDED to threaten, harass, impersonate, defraud, exploit or harm another person.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-400" />
                    Be Careful With Links and Messages
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Do not open suspicious links or provide account information in response to messages from people you do not trust.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-pink-400" />
                    Report Problems
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    If you encounter abusive, fraudulent, dangerous or otherwise inappropriate activity, use the available reporting/support tools when they are implemented.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-blue-400" />
                    Account Security
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    If you believe someone has accessed your account without permission, change your credentials and contact TEZOCRON EXTENDED support.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-3.5">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-pink-400" />
                    Privacy
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Only share content and personal information that you are comfortable making available through the relevant TEZOCRON EXTENDED feature.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-pink-500/20 bg-pink-500/10 p-3.5 text-xs text-slate-200">
                <p className="font-medium text-pink-200">
                  Jaz Media Parustarta (JMP) is committed to providing a safer and privacy-conscious environment for TEZOCRON EXTENDED users.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
