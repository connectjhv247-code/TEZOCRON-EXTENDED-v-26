import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, PenTool } from 'lucide-react';

interface RoleSelectionScreenProps {
  onBack: () => void;
  onContinue: (selectedRole: string) => void;
}

interface RoleOption {
  id: string;
  label: string;
  isCustom?: boolean;
}

const ROLE_OPTIONS: RoleOption[] = [
  { id: 'live_streamer', label: 'Participate as T&E Live Streamer' },
  { id: 'advertiser', label: 'Advertiser' },
  { id: 'content_creator', label: 'Content Creator' },
  { id: 'business', label: 'Business / Enterprise / Organization' },
  { id: 'others', label: 'Others', isCustom: true },
];

export default function RoleSelectionScreen({ onBack, onContinue }: RoleSelectionScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customRoleText, setCustomRoleText] = useState<string>('');
  const customInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when "Others" is selected
  useEffect(() => {
    if (selectedId === 'others') {
      setTimeout(() => {
        customInputRef.current?.focus();
      }, 150);
    }
  }, [selectedId]);

  const selectRole = (id: string) => {
    if (selectedId === id) {
      // Allow deselecting the active role
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  };

  const isOthersSelected = selectedId === 'others';
  const isSelectionValid =
    selectedId !== null && (!isOthersSelected || customRoleText.trim().length > 0);

  const handleContinueClick = () => {
    if (!isSelectionValid || !selectedId) return;

    if (isOthersSelected) {
      onContinue(customRoleText.trim());
    } else {
      const foundOption = ROLE_OPTIONS.find((r) => r.id === selectedId);
      if (foundOption) {
        onContinue(foundOption.label);
      }
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-slate-950 text-white selection:bg-pink-500 selection:text-white">
      {/* Background Decorative Accent Gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-600/20 blur-3xl" />

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

      {/* Main Content Area */}
      <div className="relative z-10 my-auto flex w-full max-w-md flex-col px-6 py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          {/* Title Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-md shadow-pink-500/20">
              <img
                src="/tezocron_logo.svg"
                alt="TEZOCRON EXTENDED Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Choose Your Role
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Select one role that best represents your presence on TEZOCRON EXTENDED.
            </p>
          </div>

          {/* Single Selection Role Options List */}
          <div className="space-y-3">
            {ROLE_OPTIONS.map((option) => {
              const isSelected = selectedId === option.id;

              return (
                <div key={option.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => selectRole(option.id)}
                    className={`group relative flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99] ${
                      isSelected
                        ? 'border-pink-500/60 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-pink-900/40 shadow-lg shadow-pink-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 pr-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {option.label}
                      </span>
                    </div>

                    {/* Tickable Single Selection Radio Control */}
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                        isSelected
                          ? 'border-pink-500 bg-gradient-to-tr from-blue-600 to-pink-500 text-white shadow-md shadow-pink-500/30'
                          : 'border-white/30 bg-white/5 group-hover:border-white/50'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Option E: Others - Text Input Area */}
                  {option.isCustom && isSelected && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden px-1"
                      >
                        <div className="relative">
                          <PenTool className="absolute top-3.5 left-4 h-4 w-4 text-pink-400" />
                          <input
                            ref={customInputRef}
                            type="text"
                            value={customRoleText}
                            onChange={(e) => setCustomRoleText(e.target.value)}
                            placeholder="Type your role or description here..."
                            className="w-full rounded-2xl border border-pink-500/40 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-pink-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-pink-500/50 transition-all"
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </div>

          {/* Continue Navigation Button */}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleContinueClick}
              disabled={!isSelectionValid}
              className={`group relative flex w-full items-center justify-center rounded-full p-0.5 font-bold text-white shadow-lg transition-all duration-300 ${
                isSelectionValid
                  ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-pink-500 shadow-blue-500/25 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/30 active:scale-[0.98]'
                  : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500 opacity-50 shadow-none'
              }`}
            >
              <span className="flex w-full items-center justify-center rounded-full bg-slate-950/20 py-3.5 px-8 text-base backdrop-blur-sm group-hover:bg-transparent">
                Continue
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 pb-8 text-center text-xs text-slate-500">
        TEZOCRON EXTENDED &bull; Role Configuration
      </div>
    </div>
  );
}
