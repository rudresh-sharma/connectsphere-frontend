import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../../shared/models/auth.models';
import { Post, UpdatePostRequest } from '../posts/post.model';
import { Comment, UpdateCommentRequest } from '../comments/comment.model';

export interface TrendingHashtagSummary {
  hashtagId: number | null;
  tag: string;
  postCount: number;
}

export interface AdminAnalytics {
  totalUsers: number;
  activeUsers: number;
  dailyActiveUsers: number;
  totalPosts: number;
  trendingHashtags: TrendingHashtagSummary[];
}

export interface PostReport {
  reportId: number;
  postId: number;
  reporterId: number;
  reporterUsername?: string | null;
  reason: string;
  resolved: boolean;
  resolutionNote?: string | null;
  resolvedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentReport {
  reportId: number;
  commentId: number;
  reporterId: number;
  reporterUsername?: string | null;
  reason: string;
  resolved: boolean;
  resolutionNote?: string | null;
  resolvedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly authBaseUrl = `${environment.authApiUrl}/auth`;
  private readonly postBaseUrl = `${environment.postApiUrl}/posts`;
  private readonly commentBaseUrl = `${environment.commentApiUrl}/comments`;
  private readonly notificationBaseUrl = `${environment.notificationApiUrl}/notifications`;
  private readonly searchBaseUrl = environment.searchApiUrl;

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.authBaseUrl}/admin/users`);
  }

  setUserStatus(userId: number, active: boolean): Observable<User> {
    return this.http.patch<User>(`${this.authBaseUrl}/admin/users/${userId}/status`, {}, { params: { active } });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.authBaseUrl}/admin/users/${userId}`);
  }

  getAnalytics(): Observable<AdminAnalytics> {
    return this.http.get<AdminAnalytics>(`${this.authBaseUrl}/admin/analytics`);
  }

  getAllPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postBaseUrl}/admin/all`);
  }

  getFlaggedPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postBaseUrl}/admin/flagged`);
  }

  getPendingPromotions(): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.postBaseUrl}/admin/promotions/pending`);
  }

  updatePost(postId: number, adminUserId: number, request: UpdatePostRequest): Observable<Post> {
    return this.http.put<Post>(`${this.postBaseUrl}/admin/${postId}`, request, { params: { adminUserId } });
  }

  deletePost(postId: number, adminUserId: number): Observable<void> {
    return this.http.delete<void>(`${this.postBaseUrl}/admin/${postId}`, { params: { adminUserId } });
  }

  approvePromotion(postId: number, adminUserId: number): Observable<Post> {
    return this.http.patch<Post>(`${this.postBaseUrl}/admin/${postId}/promotion/approve`, {}, { params: { adminUserId } });
  }

  rejectPromotion(postId: number, adminUserId: number): Observable<Post> {
    return this.http.patch<Post>(`${this.postBaseUrl}/admin/${postId}/promotion/reject`, {}, { params: { adminUserId } });
  }

  moderatePost(postId: number, adminUserId: number, moderationStatus: string, moderationReason: string): Observable<Post> {
    return this.http.patch<Post>(`${this.postBaseUrl}/admin/${postId}/moderation`, {
      adminUserId,
      moderationStatus,
      moderationReason
    });
  }

  getPostReports(resolved = false): Observable<PostReport[]> {
    return this.http.get<PostReport[]>(`${this.postBaseUrl}/admin/reports`, { params: { resolved } });
  }

  resolvePostReport(reportId: number, adminUserId: number, removePost: boolean, resolutionNote: string): Observable<PostReport> {
    return this.http.patch<PostReport>(`${this.postBaseUrl}/admin/reports/${reportId}/resolve`, {
      adminUserId,
      removePost,
      resolutionNote
    });
  }

  getAllComments(): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.commentBaseUrl}/admin/all`);
  }

  updateComment(commentId: number, adminUserId: number, request: UpdateCommentRequest): Observable<Comment> {
    return this.http.put<Comment>(`${this.commentBaseUrl}/admin/${commentId}`, request, { params: { adminUserId } });
  }

  deleteComment(commentId: number, adminUserId: number): Observable<void> {
    return this.http.delete<void>(`${this.commentBaseUrl}/admin/${commentId}`, { params: { adminUserId } });
  }

  getCommentReports(resolved = false): Observable<CommentReport[]> {
    return this.http.get<CommentReport[]>(`${this.commentBaseUrl}/admin/reports`, { params: { resolved } });
  }

  resolveCommentReport(reportId: number, adminUserId: number, removeComment: boolean, resolutionNote: string): Observable<CommentReport> {
    return this.http.patch<CommentReport>(`${this.commentBaseUrl}/admin/reports/${reportId}/resolve`, {
      adminUserId,
      removeComment,
      resolutionNote
    });
  }

  sendBroadcast(recipientIds: number[] | null, message: string): Observable<void> {
    return this.http.post<void>(`${this.notificationBaseUrl}/bulk`, {
      recipientIds,
      message
    });
  }

  getTrendingHashtags(limit = 20): Observable<TrendingHashtagSummary[]> {
    return this.http.get<TrendingHashtagSummary[]>(`${this.searchBaseUrl}/hashtags/trending`, { params: { limit } });
  }
}
