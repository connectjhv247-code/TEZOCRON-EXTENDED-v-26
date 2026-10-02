import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  increment,
  Unsubscribe,
  collectionGroup,
  getCountFromServer,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
  uploadToCloudinaryDetailed,
  assertFirestoreDocSize,
  CLOUDINARY_CONFIG,
} from './cloudinaryService';
import { createNotification, createNotificationWithId } from './notificationService';

export interface UserPost {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  privacy: 'public' | 'private';
  createdAt: string;
  viewsCount: number;
  commentsCount: number;
  lovesCount?: number;
  cloudinaryPublicId?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: string;
}

/**
 * Uploads media file DIRECTLY to Cloudinary storage.
 * CRITICAL: NEVER stores base64 data URLs or raw bytes in Firestore documents.
 */
export async function uploadPostMedia(
  file: File,
  userId: string
): Promise<{ mediaUrl: string; mediaType: 'image' | 'video'; cloudinaryPublicId: string }> {
  const isVideo = file.type.startsWith('video/');
  const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

  // DIRECT CLOUDINARY UPLOAD (Preset: tezocron_upload, Folder: tezocron/posts/)
  const result = await uploadToCloudinaryDetailed(
    file,
    isVideo ? 'video' : 'image',
    CLOUDINARY_CONFIG.folders.posts
  );

  if (!result.secure_url || result.secure_url.startsWith('data:')) {
    throw new Error("We couldn't upload your media. Please try again.");
  }

  return {
    mediaUrl: result.secure_url,
    mediaType,
    cloudinaryPublicId: result.public_id,
  };
}

/**
 * Creates a real post belonging to the authenticated user.
 * Stores ONLY metadata (URL, caption, timestamps, userId) in Firestore.
 */
export async function createRealPost(params: {
  userId: string;
  authorName: string;
  authorPhoto?: string;
  mediaFile: File;
  caption?: string;
  privacy: 'public' | 'private';
}): Promise<UserPost> {
  const { mediaUrl, mediaType, cloudinaryPublicId } = await uploadPostMedia(
    params.mediaFile,
    params.userId
  );

  // STRICT VALIDATION: Ensure mediaUrl is a remote URL and NOT a base64 string
  if (mediaUrl.startsWith('data:')) {
    console.warn('Invalid media URL detected in createRealPost');
    throw new Error("We couldn't upload your media. Please try again.");
  }

  const postsCollection = collection(firestore, 'users', params.userId, 'posts');
  const postDocRef = doc(postsCollection);
  const postId = postDocRef.id;

  const now = new Date().toISOString();
  const newPost: UserPost = {
    id: postId,
    userId: params.userId,
    authorName: params.authorName,
    authorPhoto: params.authorPhoto || '',
    mediaUrl,
    mediaType,
    caption: params.caption?.trim() || '',
    privacy: params.privacy,
    createdAt: now,
    viewsCount: 0,
    commentsCount: 0,
    lovesCount: 0,
    cloudinaryPublicId: cloudinaryPublicId || '',
  };

  // Enforce document size limit check (<900,000 bytes)
  assertFirestoreDocSize(newPost, `users/${params.userId}/posts/${postId}`);

  await setDoc(postDocRef, newPost);
  return newPost;
}

/**
 * Real-time listener for a user's posts
 */
export function subscribeToUserPosts(
  targetUserId: string,
  isOwner: boolean,
  callback: (posts: UserPost[]) => void
): Unsubscribe {
  const postsCollection = collection(firestore, 'users', targetUserId, 'posts');

  let postsQuery;
  if (isOwner) {
    // Owner sees all posts (public + private)
    postsQuery = query(postsCollection, orderBy('createdAt', 'desc'));
  } else {
    // Other users can ONLY query public posts
    postsQuery = query(
      postsCollection,
      where('privacy', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
  }

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts: UserPost[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: targetUserId,
          authorName: data.authorName || 'Member',
          authorPhoto: data.authorPhoto || undefined,
          mediaUrl: data.mediaUrl || '',
          mediaType: data.mediaType || 'image',
          caption: data.caption || '',
          privacy: data.privacy || 'public',
          createdAt: data.createdAt || new Date().toISOString(),
          viewsCount: data.viewsCount || 0,
          commentsCount: data.commentsCount || 0,
          cloudinaryPublicId: data.cloudinaryPublicId || undefined,
        };
      });
      callback(posts);
    },
    (err) => {
      console.warn('Posts subscription notice:', err.message);
      callback([]);
    }
  );
}

/**
 * Records a real media view event (only if viewer != post owner)
 * Multiple views by the same viewer will not create duplicate counts
 */
export async function recordMediaView(
  postOwnerId: string,
  postId: string,
  viewerUserId: string
): Promise<void> {
  // If not signed in or is the post owner, do not record or inflate
  if (!viewerUserId || viewerUserId === postOwnerId) {
    return;
  }

  try {
    const viewDocRef = doc(
      firestore,
      'users',
      postOwnerId,
      'posts',
      postId,
      'views',
      viewerUserId
    );
    const existing = await getDoc(viewDocRef);

    if (!existing.exists()) {
      // First legitimate view by this viewer
      await setDoc(viewDocRef, {
        viewerId: viewerUserId,
        viewedAt: new Date().toISOString(),
      });

      // Increment views count on the post
      const postRef = doc(firestore, 'users', postOwnerId, 'posts', postId);
      await updateDoc(postRef, {
        viewsCount: increment(1),
      }).catch(() => {});

      // Check for 50-view milestone reached legitimately
      try {
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const currentViews = postData.viewsCount || 0;
          if (currentViews >= 50 && !postData.hasNotified50Views) {
            await updateDoc(postRef, { hasNotified50Views: true }).catch(() => {});
            await createNotificationWithId(`milestone_50views_${postId}`, {
              userId: postOwnerId,
              category: 'personal',
              type: 'views_milestone',
              title: '🎉 50+ Views Milestone Reached!',
              message: `Your post reached ${currentViews} views from the TEZOCRON community!`,
              targetId: postId,
              metadata: {
                postId,
                postOwnerId,
                viewsCount: currentViews,
                postMediaUrl: postData.mediaUrl || '',
                postCaption: postData.caption || '',
              },
            });
          }
        }
      } catch (milestoneErr) {
        console.warn('Milestone notification check warning:', milestoneErr);
      }
    }
  } catch (err) {
    console.warn('View record warning:', err);
  }
}

/**
 * Real-time listener for comments on a post
 */
export function subscribeToPostComments(
  postOwnerId: string,
  postId: string,
  callback: (comments: PostComment[]) => void
): Unsubscribe {
  const commentsCol = collection(
    firestore,
    'users',
    postOwnerId,
    'posts',
    postId,
    'comments'
  );
  const commentsQuery = query(commentsCol, orderBy('createdAt', 'asc'));

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments: PostComment[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          postId,
          authorId: data.authorId || '',
          authorName: data.authorName || 'Member',
          authorPhoto: data.authorPhoto || undefined,
          text: data.text || '',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      callback(comments);
    },
    (err) => {
      console.warn('Comments subscription warning:', err.message);
      callback([]);
    }
  );
}

/**
 * Adds a real comment to a post
 */
export async function addRealComment(params: {
  postOwnerId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
}): Promise<PostComment> {
  const commentsCol = collection(
    firestore,
    'users',
    params.postOwnerId,
    'posts',
    params.postId,
    'comments'
  );
  const commentDocRef = doc(commentsCol);
  const commentId = commentDocRef.id;

  const now = new Date().toISOString();
  const commentData: PostComment = {
    id: commentId,
    postId: params.postId,
    authorId: params.authorId,
    authorName: params.authorName,
    authorPhoto: params.authorPhoto || '',
    text: params.text.trim(),
    createdAt: now,
  };

  await setDoc(commentDocRef, commentData);

  // Increment comments count on the post
  const postRef = doc(firestore, 'users', params.postOwnerId, 'posts', params.postId);
  await updateDoc(postRef, {
    commentsCount: increment(1),
  }).catch(() => {});

  // Trigger personal notification for post owner (only if author is not post owner)
  if (params.authorId !== params.postOwnerId) {
    const previewText =
      params.text.trim().length > 60
        ? params.text.trim().slice(0, 57) + '...'
        : params.text.trim();
    createNotification({
      userId: params.postOwnerId,
      category: 'personal',
      type: 'comment',
      title: `${params.authorName} commented on your post`,
      message: `"${previewText}"`,
      actorId: params.authorId,
      actorName: params.authorName,
      actorPhoto: params.authorPhoto,
      targetId: params.postId,
      metadata: {
        postId: params.postId,
        postOwnerId: params.postOwnerId,
        commentId,
        commentText: params.text.trim(),
      },
    }).catch((err) => console.warn('Comment notification trigger warning:', err));
  }

  return commentData;
}

/**
 * Deletes a comment (owner of comment or owner of post)
 */
export async function deleteRealComment(
  postOwnerId: string,
  postId: string,
  commentId: string
): Promise<void> {
  const commentRef = doc(
    firestore,
    'users',
    postOwnerId,
    'posts',
    postId,
    'comments',
    commentId
  );
  await deleteDoc(commentRef);

  // Decrement comments count on the post
  const postRef = doc(firestore, 'users', postOwnerId, 'posts', postId);
  await updateDoc(postRef, {
    commentsCount: increment(-1),
  }).catch(() => {});
}

/**
 * Deletes a post belonging to the authenticated user
 */
export async function deleteRealPost(
  postOwnerId: string,
  postId: string,
  currentUserId: string
): Promise<void> {
  if (postOwnerId !== currentUserId) {
    throw new Error('Unauthorized');
  }

  // 1. Delete comments subcollection
  try {
    const commentsCol = collection(
      firestore,
      'users',
      postOwnerId,
      'posts',
      postId,
      'comments'
    );
    const commentsSnap = await getDocs(commentsCol);
    for (const d of commentsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Subcollection comments cleanup notice:', err);
  }

  // 2. Delete views subcollection
  try {
    const viewsCol = collection(
      firestore,
      'users',
      postOwnerId,
      'posts',
      postId,
      'views'
    );
    const viewsSnap = await getDocs(viewsCol);
    for (const d of viewsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Subcollection views cleanup notice:', err);
  }

  // 3. Delete loves subcollection
  try {
    const lovesCol = collection(
      firestore,
      'users',
      postOwnerId,
      'posts',
      postId,
      'loves'
    );
    const lovesSnap = await getDocs(lovesCol);
    for (const d of lovesSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Subcollection loves cleanup notice:', err);
  }

  // 4. Delete post document
  const postDocRef = doc(firestore, 'users', postOwnerId, 'posts', postId);
  await deleteDoc(postDocRef);
}

/**
 * Retrieves real Love count on a post
 */
export async function getPostLoveCount(
  postOwnerId: string,
  postId: string
): Promise<number> {
  try {
    const lovesCol = collection(firestore, 'users', postOwnerId, 'posts', postId, 'loves');
    const snapshot = await getCountFromServer(lovesCol);
    return snapshot.data().count;
  } catch {
    try {
      const lovesCol = collection(firestore, 'users', postOwnerId, 'posts', postId, 'loves');
      const snap = await getDocs(query(lovesCol));
      return snap.size;
    } catch {
      return 0;
    }
  }
}

/**
 * Checks if current user has loved this post
 */
export async function hasUserLovedPost(
  postOwnerId: string,
  postId: string,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  try {
    const loveDoc = doc(firestore, 'users', postOwnerId, 'posts', postId, 'loves', userId);
    const snap = await getDoc(loveDoc);
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Toggles Love ❤️ on a post
 */
export async function togglePostLove(
  postOwnerId: string,
  postId: string,
  userId: string
): Promise<{ loved: boolean; newCount: number }> {
  if (!userId) {
    const count = await getPostLoveCount(postOwnerId, postId);
    return { loved: false, newCount: count };
  }

  const loveRef = doc(firestore, 'users', postOwnerId, 'posts', postId, 'loves', userId);
  const snap = await getDoc(loveRef);
  const postRef = doc(firestore, 'users', postOwnerId, 'posts', postId);

  if (snap.exists()) {
    // Remove Love
    await deleteDoc(loveRef);
    await updateDoc(postRef, {
      lovesCount: increment(-1),
    }).catch(() => {});
    const newCount = await getPostLoveCount(postOwnerId, postId);
    return { loved: false, newCount };
  } else {
    // Add Love
    const now = new Date().toISOString();
    await setDoc(loveRef, {
      loverId: userId,
      createdAt: now,
    });
    await updateDoc(postRef, {
      lovesCount: increment(1),
    }).catch(() => {});
    const newCount = await getPostLoveCount(postOwnerId, postId);
    return { loved: true, newCount };
  }
}

/**
 * Real-time listener for the Relate feed
 * Loads real posts from authenticated TEZOCRON users, strictly enforcing privacy
 */
export function subscribeToRelateFeed(
  currentUserId: string,
  callback: (posts: UserPost[]) => void
): Unsubscribe {
  let unsubCollectionGroup: Unsubscribe | null = null;
  let activeUnsubs: Unsubscribe[] = [];
  let isCleanedUp = false;

  const tryCollectionGroup = () => {
    try {
      const postsQuery = query(
        collectionGroup(firestore, 'posts'),
        where('privacy', '==', 'public')
      );

      unsubCollectionGroup = onSnapshot(
        postsQuery,
        (snapshot) => {
          if (isCleanedUp) return;
          const posts: UserPost[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const pathSegments = docSnap.ref.path.split('/');
            const ownerId = data.userId || (pathSegments.length >= 2 ? pathSegments[1] : '');
            return {
              id: docSnap.id,
              userId: ownerId,
              authorName: data.authorName || 'TEZOCRON Member',
              authorPhoto: data.authorPhoto || undefined,
              mediaUrl: data.mediaUrl || '',
              mediaType: data.mediaType || 'image',
              caption: data.caption || '',
              privacy: data.privacy || 'public',
              createdAt: data.createdAt || new Date().toISOString(),
              viewsCount: data.viewsCount || 0,
              commentsCount: data.commentsCount || 0,
              lovesCount: data.lovesCount || 0,
              cloudinaryPublicId: data.cloudinaryPublicId || undefined,
            };
          });

          // Sort descending by creation date
          posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(posts);
        },
        (error) => {
          console.warn('CollectionGroup feed notice, initiating multi-user sync:', error.message);
          startMultiUserSync();
        }
      );
    } catch {
      startMultiUserSync();
    }
  };

  const startMultiUserSync = () => {
    if (isCleanedUp) return;
    if (unsubCollectionGroup) {
      unsubCollectionGroup();
      unsubCollectionGroup = null;
    }

    const postsMap = new Map<string, UserPost[]>();

    const emitAggregatedPosts = () => {
      const all: UserPost[] = [];
      for (const list of postsMap.values()) {
        all.push(...list);
      }
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(all);
    };

    // Listen to registered users
    const usersCol = collection(firestore, 'users');
    const unsubUsers = onSnapshot(
      usersCol,
      (usersSnap) => {
        if (isCleanedUp) return;

        activeUnsubs.filter((u) => u !== unsubUsers).forEach((u) => u());
        activeUnsubs = [unsubUsers];

        usersSnap.docs.forEach((uDoc) => {
          const uId = uDoc.id;
          const uData = uDoc.data();
          if (uData.settings?.privacy?.postVisibility === 'private' && uId !== currentUserId) {
            postsMap.delete(uId);
            emitAggregatedPosts();
            return;
          }

          const userPostsCol = collection(firestore, 'users', uId, 'posts');
          const q = query(userPostsCol, where('privacy', '==', 'public'));
          const unsub = onSnapshot(
            q,
            (postSnap) => {
              if (isCleanedUp) return;
              const uPosts: UserPost[] = postSnap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  userId: uId,
                  authorName: data.authorName || uData.full_name || uData.display_name || 'Member',
                  authorPhoto: data.authorPhoto || uData.photo_url || undefined,
                  mediaUrl: data.mediaUrl || '',
                  mediaType: data.mediaType || 'image',
                  caption: data.caption || '',
                  privacy: data.privacy || 'public',
                  createdAt: data.createdAt || new Date().toISOString(),
                  viewsCount: data.viewsCount || 0,
                  commentsCount: data.commentsCount || 0,
                  lovesCount: data.lovesCount || 0,
                  cloudinaryPublicId: data.cloudinaryPublicId || undefined,
                };
              });
              postsMap.set(uId, uPosts);
              emitAggregatedPosts();
            },
            (err) => {
              console.warn('User posts sync note:', err.message);
            }
          );

          activeUnsubs.push(unsub);
        });
      },
      (err) => {
        console.warn('Users query notice:', err.message);
        callback([]);
      }
    );

    activeUnsubs.push(unsubUsers);
  };

  tryCollectionGroup();

  return () => {
    isCleanedUp = true;
    if (unsubCollectionGroup) unsubCollectionGroup();
    activeUnsubs.forEach((u) => u());
  };
}
