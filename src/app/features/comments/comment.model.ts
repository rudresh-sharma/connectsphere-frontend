export interface Comment {
  commentId: number;
  postId: number;
  authorId: number;
  authorUsername?: string;
  authorFullName?: string;
  authorProfilePicUrl?: string | null;
  parentCommentId?: number | null;
  content: string;
  likesCount: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  postId: number;
  authorId: number;
  parentCommentId?: number | null;
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}
