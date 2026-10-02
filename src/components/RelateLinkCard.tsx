import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Link2,
  Copy,
  Check,
  Share2,
  MessageSquare,
  Send,
  Mail,
  Smartphone,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  copyRelateUrlToClipboard,
  getShareUrls,
  shareViaNativeSheet,
  buildUsernameUrl,
  buildSimpleDisplayUrl,
} from '../lib/relateLinkService';

interface RelateLinkCardProps {
  relateUrl?: string;
  relateId?: string;
  username?: string;
  displayName: string;
  isOwner: boolean;
  onOpenAsVisitor?: () => void;
}

export default function RelateLinkCard({
  relateUrl,
  username,
  displayName,
  isOwner,
  onOpenAsVisitor,
}: RelateLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  // Derive the clean username
  const cleanUsername =
    username ||
    (relateUrl && relateUrl.includes('/@') ? relateUrl.split('/@')[1].split(/[?#]/)[0] : '') ||
    displayName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) ||
    'user';

  const fullRelateUrl = buildUsernameUrl(cleanUsername);
  const displayUrl = buildSimpleDisplayUrl(cleanUsername);

  const shareUrls = getShareUrls(fullRelateUrl, displayName, cleanUsername);

  const handleCopy = async () => {
    const success = await copyRelateUrlToClipboard(fullRelateUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    const shared = await shareViaNativeSheet(fullRelateUrl, displayName, cleanUsername);
    if (!shared) {
      setShowShareOptions(true);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 p-5 shadow-2xl backdrop-blur-2xl">
      {/* Glow accent */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-pink-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-blue-500/15 blur-2xl" />

      {/* Header Badge */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 shadow-sm">
            <Link2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {isOwner ? 'Your TEZOCRON Relate Link' : `${displayName}'s Relate Link`}
            </h3>
            <p className="text-[10px] text-pink-300/80">
              Simple public URL for community connection
            </p>
          </div>
        </div>

        {/* Clean Username Pill instead of tz_ code */}
        <span className="rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-pink-300">
          @{cleanUsername}
        </span>
      </div>

      {/* Link URL Display Bar — Showing simple tezocron.com/@username */}
      <div className="group relative mt-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 pl-3.5 shadow-inner transition-all hover:border-pink-500/40">
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <span className="block truncate font-mono text-xs font-semibold text-pink-300 selection:bg-pink-500 selection:text-white">
            {displayUrl}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
            copied
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-md shadow-pink-500/25 hover:from-pink-500 hover:to-pink-400'
          }`}
          title="Copy Relate Link"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>

      {/* Action Buttons: Native Share + Direct Apps Drawer */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleNativeShare}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <Share2 className="h-3.5 w-3.5 text-pink-400" />
          <span>Share Link</span>
        </button>

        <button
          type="button"
          onClick={() => setShowShareOptions((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
            showShareOptions
              ? 'border-pink-500/40 bg-pink-500/20 text-pink-300'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span>Apps</span>
          <span className="text-[10px] text-pink-400">▼</span>
        </button>

        {isOwner && onOpenAsVisitor && (
          <button
            type="button"
            onClick={onOpenAsVisitor}
            title="Preview how others see your Relate link"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Preview Link</span>
          </button>
        )}
      </div>

      {/* Direct App Sharing Icons Drawer */}
      <AnimatePresence>
        {showShareOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/10 pt-3">
              {/* WhatsApp */}
              <a
                href={shareUrls.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center transition-all hover:bg-emerald-500/20 active:scale-95"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-300">WhatsApp</span>
              </a>

              {/* Telegram */}
              <a
                href={shareUrls.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-center transition-all hover:bg-sky-500/20 active:scale-95"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
                  <Send className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-sky-300">Telegram</span>
              </a>

              {/* SMS */}
              <a
                href={shareUrls.sms}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-center transition-all hover:bg-indigo-500/20 active:scale-95"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                  <Smartphone className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-indigo-300">SMS</span>
              </a>

              {/* Email */}
              <a
                href={shareUrls.email}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-center transition-all hover:bg-amber-500/20 active:scale-95"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-amber-300">Email</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Guarantee Note */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="text-left text-[10.5px]">
          Simple username link for your profile. Your private account ID and email remain hidden and secure.
        </span>
      </div>
    </section>
  );
}
