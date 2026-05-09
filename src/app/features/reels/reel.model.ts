export interface Reel {
  reelId: number;
  authorId: number;
  videoUrl: string;
  caption?: string;
  viewsCount: number;
  createdAt: string;
  authorUsername?: string;
  authorFullName?: string;
  authorProfilePicUrl?: string;
  commentsCount?: number;
  sourceType?: 'REEL' | 'POST';
  sourcePostId?: number;
}
