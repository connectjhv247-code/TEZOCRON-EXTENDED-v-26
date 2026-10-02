import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Link2,
  Search,
  X,
  AlertCircle,
  Loader2,
  CheckCircle,
  User,
  HeartHandshake,
} from 'lucide-react';
import { resolveRelateLink, extractRelateId } from '../lib/relateLinkService';

interface OpenRelateLinkModalProps {
  onClose: () => void;
  onOpenUserProfile: (userId: string) => void;
  currentUserId: string;
}

export default function OpenRelateLinkModal({
  onClose,
  onOpenUserProfile,
  currentUserId,
}: OpenRelateLinkModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = extractRelateId(inputValue);
    if (!cleanId) {
      setError('Please enter a valid TEZOCRON link or username (e.g. tezocron.com/@connectjhv247 or @connectjhv247)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const match = await resolveRelateLink(inputValue);
      if (!match) {
        setError(`No TEZOCRON member found matching "${cleanId}". Please check the link or username and try again.`);
        return;
      }

      onClose();
      onOpenUserProfile(match.userId);
    } catch (err) {
      console.warn('Resolve error:', err);
      setError('Unable to resolve Relate link. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-pink-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Open TEZOCRON Relate Link</h2>
              <p className="text-[11px] text-slate-400">
                Connect directly with any member using their link
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Paste Relate Link or @Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="tezocron.com/@username or @username"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 pl-10 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                autoFocus
              />
              <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Example: <span className="font-mono text-pink-300">tezocron.com/@connectjhv247</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Looking up Member...</span>
                </>
              ) : (
                <>
                  <HeartHandshake className="h-3.5 w-3.5" />
                  <span>Open & Relate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
