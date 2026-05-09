export type TargetType = 'POST' | 'COMMENT' | 'STORY';
export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

export interface LikeRequest {
  userId: number;
  targetId: number;
  targetType: TargetType;
  reactionType?: ReactionType;
}

export interface LikeResponse {
  likeId: number;
  userId: number;
  targetId: number;
  targetType: TargetType;
  reactionType: ReactionType;
  createdAt: string;
}

export interface ReactionSummary {
  targetId: number;
  totalCount: number;
  counts: Record<ReactionType, number>;
}

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  LIKE: '\u{1F44D}',
  LOVE: '\u2764\uFE0F',
  HAHA: '\u{1F602}',
  WOW: '\u{1F62E}',
  SAD: '\u{1F622}',
  ANGRY: '\u{1F621}'
};
