export interface HashtagResponse {
  hashtagId: number;
  tag: string;
  postCount: number;
  lastUsedAt: string;
}

export interface PostSearchResult {
  postId: number;
  authorId: number;
  content: string;
  authorUsername: string;
  visibility: string;
}

export interface IndexPostRequest {
  postId: number;
  authorId: number;
  content: string;
  authorUsername?: string;
  visibility?: string;
}

export interface UserSearchResult {
  userId: number;
  username: string;
  email?: string;
  fullName: string;
  bio?: string | null;
  profilePicUrl?: string | null;
  active?: boolean;
}
