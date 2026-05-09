export type PostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'MIXED';
export type PostVisibility = 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
export type CounterType = 'likes' | 'comments' | 'shares';

export interface Post {
  id?: number;
  postId?: number;
  authorId: number;
  authorUsername?: string;
  authorFullName?: string;
  authorProfilePicUrl?: string | null;
  author?: {
    userId?: number;
    username?: string;
    fullName?: string;
    profilePicUrl?: string | null;
  };
  content: string;
  mediaUrls: string[];
  mediaUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  postType: PostType;
  visibility: PostVisibility;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  promoted?: boolean;
  promotedUntil?: string | null;
  promotionStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePostRequest {
  authorId: number;
  content: string;
  mediaUrls: string[];
  postType: PostType;
  visibility: PostVisibility;
}

export interface UpdatePostRequest {
  content: string;
  mediaUrls: string[];
  postType: PostType;
  visibility: PostVisibility;
}

export interface UpdateCounterRequest {
  counterType: CounterType;
  delta: number;
}

export interface MediaUploadResponse {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video' | 'raw' | string;
  bytes: number | null;
  durationSeconds: number | null;
}

export interface CreatePromotionOrderRequest {
  userId: number;
  amountPaise?: number;
  durationDays?: number;
}

export interface CreatePromotionOrderResponse {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  postId: number;
  durationDays: number;
}

export interface VerifyPromotionPaymentRequest {
  userId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
