import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  MessageCircle,
  Trash2,
  Lock,
  Globe,
  Send,
  User as UserIcon,
  Loader2,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  UserPost,
  PostComment,
  recordMediaView,
  subscribeToPostComments,
  addRealComment,
  deleteRealComment,
} from '../lib/postService';

interface PostCardProps {
  post: UserPost;
  currentUser: FirebaseUser;
  isOwner: boolean;
  onDeletePost: (postId: string) => Promise<void>;
}

export default function PostCard({
  post,
  currentUser,
  isOwner,
  onDeletePost,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const viewRecordedRef = useRef(false);

  // 1. Record Real Media View (Only if viewer is authenticated non-owner)
  useEffect(() => {
    if (!viewRecordedRef.current && currentUser.uid && currentUser.uid !== post.userId) {
      viewRecordedRef.current = true;
      recordMediaView(post.userId, post.id, currentUser.uid);
    }
  }, [post.id, post.userId, currentUser.uid]);

  // 2. Real-time subscription to comments
  useEffect(() => {
    const unsubscribe = subscribeToPostComments(post.userId, post.id, (loadedComments) => {
      setComments(loadedComments);
    });
    return () => unsubscribe();
  }, [post.userId, post.id]);

  // 3. Add Real Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
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
    } catch (err) {
      console.warn('Comment submission error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // 4. Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteRealComment(post.userId, post.id, commentId);
    } catch (err) {
      console.warn('Comment delete error:', err);
    }
  };

  // 5. Delete Post Action
  const handleConfirmDelete = async () => {
    if (!isOwner || deleting) return;
    setDeleting(true);
    try {
      await onDeletePost(post.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.warn('Post delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formattedDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recently';

  const displayedCommentsCount = Math.max(comments.length, post.commentsCount || 0);

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl backdrop-blur-xl transition-all">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-pink-500/30 bg-slate-950">
            {post.authorPhoto ? (
              <img
                src={post.authorPhoto}
                alt={post.authorName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-600/30 to-pink-600/30 text-white font-bold text-sm">
                {post.authorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white tracking-tight">{post.authorName}</h4>

              {/* Real Privacy Badge */}
              {isOwner && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    post.privacy === 'private'
                      ? 'border border-pink-500/30 bg-pink-500/10 text-pink-300'
                      : 'border border-blue-500/30 bg-blue-500/10 text-blue-300'
                  }`}
                >
                  {post.privacy === 'private' ? (
                    <>
                      <Lock className="h-2.5 w-2.5" /> Private
                    </>
                  ) : (
                    <>
                      <Globe className="h-2.5 w-2.5" /> Public
                    </>
                  )}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">{formattedDate}</span>
          </div>
        </div>

        {/* Owner Post Management: Delete Button */}
        {isOwner && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              title="Post Options"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 hover:text-red-400" />
            </button>

            {/* Confirm Delete Prompt */}
            {showDeleteConfirm && (
              <div className="absolute right-0 top-10 z-20 w-48 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
                <p className="text-[11px] font-semibold text-white mb-2">Delete this post?</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 py-1 text-[10px] text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="flex-1 rounded-full bg-red-600 py-1 text-[10px] font-bold text-white shadow-md hover:bg-red-500"
                  >
                    {deleting ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Caption if provided */}
      {post.caption && (
        <div className="px-4 sm:px-5 pb-3">
          <p className="text-xs text-slate-200 leading-relaxed break-words">{post.caption}</p>
        </div>
      )}

      {/* Real Image or Video Media Display */}
      <div className="relative overflow-hidden bg-slate-950 border-y border-white/5">
        {post.mediaType === 'image' ? (
          <div className="flex items-center justify-center max-h-[460px] overflow-hidden bg-black/40">
            <img
              src={post.mediaUrl}
              alt={post.caption || 'User post media'}
              className="w-full max-h-[460px] object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="relative flex items-center justify-center bg-black max-h-[460px]">
            <video
              src={post.mediaUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[460px] bg-black"
            />
          </div>
        )}
      </div>

      {/* Media Metrics Bar: View Count 👁 & Comment Count 💬 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          {/* Real Media View Count */}
          <div
            title="Real unique views"
            className="flex items-center gap-1.5 text-blue-400 font-semibold"
          >
            <Eye className="h-4 w-4" />
            <span className="text-white text-xs">{(post.viewsCount || 0).toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-normal">views</span>
          </div>

          {/* Real Comment Count & Toggle */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 transition-colors font-semibold"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-white text-xs">{displayedCommentsCount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-normal">comments</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
        >
          {showComments ? 'Hide Comments' : 'View Comments'}
        </button>
      </div>

      {/* Real Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-950/60 p-4 sm:p-5 border-t border-white/5 space-y-3.5"
          >
            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {comments.map((comment) => {
                  const isCommentAuthor = currentUser.uid === comment.authorId;
                  const canDelete = isCommentAuthor || isOwner;
                  const commentDate = comment.createdAt
                    ? new Date(comment.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={comment.id}
                      className="group flex items-start justify-between gap-2.5 rounded-2xl border border-white/5 bg-white/5 p-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-500/30 bg-slate-900 text-[10px] font-bold text-white">
                          {comment.authorPhoto ? (
                            <img
                              src={comment.authorPhoto}
                              alt={comment.authorName}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            comment.authorName.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-[11px] truncate">
                              {comment.authorName}
                            </span>
                            <span className="text-[9px] text-slate-500">{commentDate}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-200 break-words leading-relaxed">
                            {comment.text}
                          </p>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                          className="opacity-60 hover:opacity-100 text-slate-400 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                disabled={submittingComment}
                className="flex-1 rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-md shadow-pink-500/20 hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {submittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
