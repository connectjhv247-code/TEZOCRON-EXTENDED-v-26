import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Send, Trash2, MessageCircle, Loader2, User as UserIcon } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  UserPost,
  PostComment,
  subscribeToPostComments,
  addRealComment,
  deleteRealComment,
} from '../lib/postService';

interface RelateCommentsModalProps {
  post: UserPost;
  currentUser: FirebaseUser;
  onClose: () => void;
  onOpenUserProfile: (userId: string) => void;
}

export default function RelateCommentsModal({
  post,
  currentUser,
  onClose,
  onOpenUserProfile,
}: RelateCommentsModalProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to real-time comments for this post
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToPostComments(post.userId, post.id, (loadedComments) => {
      setComments(loadedComments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [post.userId, post.id]);

  // Submit comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addRealComment({
        postOwnerId: post.userId,
        postId: post.id,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'TEZOCRON Member',
        authorPhoto: currentUser.photoURL || undefined,
        text: commentText.trim(),
      });
      setCommentText('');
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.warn('Comment post error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      await deleteRealComment(post.userId, post.id, commentId);
    } catch (err) {
      console.warn('Comment deletion notice:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md">
      {/* Backdrop tap to close */}
      <div className="fixed inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.98 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative z-10 flex h-[82vh] sm:h-[650px] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Comments
              </h3>
              <p className="text-[11px] text-slate-400">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Close comments"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Comments Stream */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {loading ? (
            <div className="flex h-full items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                <span className="text-xs text-slate-400">Loading comments...</span>
              </div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400">
                <MessageCircle className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">No comments yet</p>
              <p className="mt-1 text-xs text-slate-400 max-w-xs">
                Be the first to share your thoughts on this post.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const canDelete =
                comment.authorId === currentUser.uid || post.userId === currentUser.uid;
              const formattedTime = comment.createdAt
                ? new Date(comment.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div
                  key={comment.id}
                  className="group flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]"
                >
                  {/* Author Avatar */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUserProfile(comment.authorId);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-500/30 bg-slate-950"
                  >
                    {comment.authorPhoto ? (
                      <img
                        src={comment.authorPhoto}
                        alt={comment.authorName}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-600/40 to-pink-600/40 text-xs font-bold text-white">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenUserProfile(comment.authorId);
                        }}
                        className="text-xs font-bold text-white hover:text-pink-300 transition-colors truncate"
                      >
                        {comment.authorName}
                      </button>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formattedTime}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-200 leading-relaxed break-words">
                      {comment.text}
                    </p>
                  </div>

                  {/* Delete Button (if comment owner or post owner) */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={deletingId === comment.id}
                      className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-pink-400 hover:bg-pink-500/10 transition-all active:scale-95"
                      aria-label="Delete comment"
                      title="Delete comment"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Bottom Comment Input */}
        <form
          onSubmit={handleSubmitComment}
          className="border-t border-white/10 bg-slate-950/80 p-3 sm:p-4 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              maxLength={400}
              className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
            />

            <button
              type="submit"
              disabled={!commentText.trim() || submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-pink-500 text-white shadow-md shadow-pink-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Post comment"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
