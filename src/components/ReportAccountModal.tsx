import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  Check,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import {
  REPORT_REASONS,
  ReportReason,
  submitRealtimeReport,
} from '../lib/reportService';
import { User as FirebaseUser } from 'firebase/auth';

interface ReportAccountModalProps {
  currentUser: FirebaseUser;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserPhoto?: string;
  reportedUserEmail?: string;
  profileRef?: string;
  reportedMessageId?: string | null;
  reportedMessageText?: string | null;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

export default function ReportAccountModal({
  currentUser,
  reportedUserId,
  reportedUserName,
  reportedUserPhoto,
  reportedUserEmail,
  profileRef,
  reportedMessageId,
  reportedMessageText,
  onClose,
  onShowToast,
}: ReportAccountModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);

  const handleSelectReason = (reason: ReportReason) => {
    if (isSubmitting || hasSubmittedSuccessfully) return;
    setErrorMessage(null);
    setSelectedReason((prev) => (prev === reason ? null : reason));
  };

  const handleSend = async () => {
    if (isSubmitting || hasSubmittedSuccessfully) return;

    if (!selectedReason) {
      setErrorMessage('Please select a report reason.');
      return;
    }

    if (selectedReason === 'Other' && !otherText.trim()) {
      setErrorMessage('Please specify details for Other.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await submitRealtimeReport({
        reporterId: currentUser.uid,
        reporterEmail: currentUser.email || undefined,
        reportedId: reportedUserId,
        reportedEmail: reportedUserEmail,
        reportedUsername: reportedUserName,
        reason: selectedReason,
        details: otherText.trim(),
        messageId: reportedMessageId || null,
        messageContent: reportedMessageText || null,
      });

      if (result.success) {
        setHasSubmittedSuccessfully(true);
        const toastText = 'Report sent. Our team will review within 24h. Thanks!';
        setSuccessMessage(toastText);
        if (onShowToast) {
          onShowToast(toastText);
        }
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setErrorMessage(
          result.error || 'Unable to submit your report. Please try again.'
        );
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage('Unable to submit your report. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report Account or Message"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl text-white"
      >
        {/* Top Header Row with Icon and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {reportedMessageId ? 'Report Message' : 'Report Account'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
                {reportedUserName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Reported Target Account Info */}
        <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl border border-white/5 bg-white/5 px-3 py-2">
          {reportedUserPhoto ? (
            <img
              src={reportedUserPhoto}
              alt={reportedUserName}
              className="h-7 w-7 rounded-full object-cover border border-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-pink-500 text-[11px] font-bold text-white">
              {reportedUserName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {reportedUserName}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              ID: {reportedUserId.substring(0, 14)}...
            </p>
          </div>
        </div>

        {/* Message Evidence Preview if reporting a message */}
        {reportedMessageText && (
          <div className="mt-2.5 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-pink-300 mb-1">
              <MessageSquare className="h-3 w-3" />
              <span>Reported Message Evidence:</span>
            </div>
            <p className="text-xs italic text-slate-200 line-clamp-3 bg-black/20 p-2 rounded-xl">
              "{reportedMessageText}"
            </p>
          </div>
        )}

        {/* Notice Info */}
        <div className="mt-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
          <p className="text-xs leading-relaxed text-blue-200">
            Your chosen option will be used to report this {reportedMessageId ? 'message' : 'selected account'} to TEZOCRON for review and appropriate action.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-start gap-2.5 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-3 text-xs text-pink-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-pink-400 mt-0.5" />
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {/* Success Confirmation Toast Notice */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center gap-2.5 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-200 shadow-md"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
            <span className="font-semibold">{successMessage}</span>
          </motion.div>
        )}

        {/* 1. REPORT OPTIONS */}
        {!hasSubmittedSuccessfully && (
          <div className="mt-3.5 space-y-2">
            {REPORT_REASONS.map((reason) => {
              const isChecked = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleSelectReason(reason)}
                  disabled={isSubmitting}
                  className={`flex w-full items-center justify-between rounded-2xl border p-2.5 sm:p-3 text-left transition-all active:scale-[0.98] ${
                    isChecked
                      ? 'border-pink-500/60 bg-pink-500/15 text-white shadow-sm'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold">{reason}</span>

                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${
                      isChecked
                        ? 'border-pink-500 bg-pink-500 text-white shadow-xs'
                        : 'border-slate-500/60 bg-transparent'
                    }`}
                  >
                    {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                </button>
              );
            })}

            {/* Other (with text input) */}
            {selectedReason === 'Other' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-1.5"
              >
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Describe the reason or issue:
                </label>
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Provide additional details..."
                  rows={2}
                  maxLength={300}
                  className="w-full rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
                />
              </motion.div>
            )}

            {/* Optional details input when other reasons selected */}
            {selectedReason && selectedReason !== 'Other' && (
              <div className="pt-1">
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Optional details (e.g. context)..."
                  maxLength={200}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. FUNCTIONAL SEND BUTTON */}
        {!hasSubmittedSuccessfully && (
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!selectedReason || isSubmitting}
              className={`flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-bold transition-all shadow-md active:scale-95 ${
                selectedReason && !isSubmitting
                  ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 text-white shadow-pink-500/25 hover:opacity-95 cursor-pointer'
                  : 'border border-white/10 bg-white/10 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Send</span>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
