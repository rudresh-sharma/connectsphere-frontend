export interface FollowRequest {
  followerId: number;
}

export interface FollowRelationship {
  id?: number;
  followId?: number;
  followerId: number;
  followingId: number;
  createdAt?: string;
}

export interface FollowPage {
  content?: FollowRelationship[];
}

export interface FollowStatus {
  followerId: number;
  followingId: number;
  following: boolean;
}

export interface FollowCounts {
  userId: number;
  followersCount: number;
  followingCount: number;
}
