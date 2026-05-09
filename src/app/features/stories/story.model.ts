export interface MediaResponse {
  mediaId: number;
  uploaderId: number;
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  sizeKb: number;
  mimeType: string;
  linkedPostId?: number;
  uploadedAt: string;
}

export interface StoryResponse {
  storyId: number;
  authorId: number;
  mediaUrl: string;
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  viewsCount: number;
  expiresAt: string;
  createdAt: string;
  authorUsername?: string;
  authorProfilePicUrl?: string;
}
