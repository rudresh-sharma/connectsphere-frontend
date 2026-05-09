import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/auth.models';
import { AdminAnalytics, AdminService, CommentReport, PostReport, TrendingHashtagSummary } from './admin.service';
import { Post } from '../posts/post.model';
import { PostCardComponent } from '../posts/post-card/post-card.component';
import { Comment } from '../comments/comment.model';
import { CommentSectionComponent } from '../comments/comment-section/comment-section.component';

type AdminDataTab = 'users' | 'posts' | 'comments' | 'reports' | 'hashtags';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentSectionComponent, PostCardComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('adminDataCard') private adminDataCard?: ElementRef<HTMLElement>;

  currentUser: User | null = null;
  isLoading = false;
  errorMessage = '';
  analytics: AdminAnalytics | null = null;
  users: User[] = [];
  posts: Post[] = [];
  flaggedPosts: Post[] = [];
  pendingPromotions: Post[] = [];
  comments: Comment[] = [];
  postReports: PostReport[] = [];
  commentReports: CommentReport[] = [];
  trendingHashtags: TrendingHashtagSummary[] = [];
  broadcastMessage = '';
  broadcastRecipients = '';
  showRecipientSuggestions = false;
  broadcastSuccessMessage = '';
  isSendingBroadcast = false;
  activeAdminTab: AdminDataTab = 'users';
  adminView: 'overview' | 'notifications' | 'data' = 'overview';
  selectedCommentPost: Post | null = null;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser?.role !== 'ADMIN') {
      void this.router.navigate(['/dashboard']);
      return;
    }
    this.route.queryParamMap.subscribe((params) => {
      const view = params.get('view');
      this.adminView = view === 'notifications' || view === 'data' ? view : 'overview';
    });
    this.loadAdminData();
  }

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  canManageUser(user: User): boolean {
    return user.userId !== this.currentUserId && user.role !== 'ADMIN';
  }

  selectAdminTab(tab: AdminDataTab): void {
    this.activeAdminTab = tab;
    this.selectedCommentPost = null;
    setTimeout(() => this.adminDataCard?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  get suggestedBroadcastUsers(): User[] {
    const token = this.currentBroadcastRecipientToken;
    if (!token) {
      return [];
    }

    const selectedUsernames = new Set(
      this.broadcastRecipients
        .split(',')
        .map((value) => value.trim().replace(/^@/, '').toLowerCase())
        .filter((value) => value && value !== token)
    );

    return this.users
      .filter((user) => {
        const username = user.username.toLowerCase();
        const fullName = user.fullName?.toLowerCase() ?? '';
        return !selectedUsernames.has(username)
          && (username.includes(token) || fullName.includes(token));
      })
      .slice(0, 6);
  }

  loadAdminData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      analytics: this.adminService.getAnalytics(),
      users: this.adminService.getUsers(),
      posts: this.adminService.getAllPosts(),
      flaggedPosts: this.adminService.getFlaggedPosts(),
      comments: this.adminService.getAllComments(),
      postReports: this.adminService.getPostReports(false),
      commentReports: this.adminService.getCommentReports(false),
      trendingHashtags: this.adminService.getTrendingHashtags(20)
    }).subscribe({
      next: (result) => {
        this.analytics = result.analytics;
        this.users = result.users;
        this.posts = result.posts;
        this.flaggedPosts = result.flaggedPosts;
        this.pendingPromotions = result.posts.filter((post) => this.isPromotionPendingReview(post));
        this.comments = result.comments;
        this.postReports = result.postReports;
        this.commentReports = result.commentReports;
        this.trendingHashtags = result.trendingHashtags;
        this.isLoading = false;
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
        this.isLoading = false;
      }
    });
  }

  suspendUser(user: User): void {
    this.adminService.setUserStatus(user.userId, false).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  reactivateUser(user: User): void {
    this.adminService.setUserStatus(user.userId, true).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  deleteUser(user: User): void {
    if (!window.confirm(`Delete @${user.username} permanently?`)) {
      return;
    }
    this.adminService.deleteUser(user.userId).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  editPost(post: Post): void {
    const content = window.prompt('Edit post content', post.content);
    if (content == null) {
      return;
    }
    this.adminService.updatePost(post.postId ?? 0, this.currentUserId, {
      content,
      mediaUrls: post.mediaUrls ?? [],
      postType: post.postType,
      visibility: post.visibility
    }).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  removePost(post: Post): void {
    this.adminService.deletePost(post.postId ?? 0, this.currentUserId).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  openPostComments(post: Post): void {
    if (!this.getPostId(post) || !this.currentUserId) {
      return;
    }
    this.selectedCommentPost = post;
  }

  closePostComments(): void {
    this.selectedCommentPost = null;
  }

  onAdminCommentCountChange(count: number): void {
    if (!this.selectedCommentPost) {
      return;
    }
    this.selectedCommentPost.commentsCount = count;
    this.selectedCommentPost.commentCount = count;
  }

  getPostId(post: Post): number {
    return post.postId ?? post.id ?? 0;
  }

  isPromotionPendingReview(post: Post): boolean {
    return post.promotionStatus === 'PENDING' || post.promotionStatus === 'PENDING_APPROVAL';
  }

  approvePromotion(post: Post): void {
    this.adminService.approvePromotion(post.postId ?? 0, this.currentUserId).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  rejectPromotion(post: Post): void {
    this.adminService.rejectPromotion(post.postId ?? 0, this.currentUserId).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  approvePost(post: Post): void {
    this.adminService.moderatePost(post.postId ?? 0, this.currentUserId, 'APPROVED', 'Approved by admin').subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  flagRemovePost(post: Post): void {
    this.adminService.moderatePost(post.postId ?? 0, this.currentUserId, 'REMOVED', 'Removed by admin').subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  editComment(comment: Comment): void {
    const content = window.prompt('Edit comment content', comment.content);
    if (content == null) {
      return;
    }
    this.adminService.updateComment(comment.commentId, this.currentUserId, { content }).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  removeComment(comment: Comment): void {
    this.adminService.deleteComment(comment.commentId, this.currentUserId).subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  resolvePostReport(report: PostReport, removePost: boolean): void {
    this.adminService.resolvePostReport(report.reportId, this.currentUserId, removePost, removePost ? 'Post removed after report review' : 'Report reviewed').subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  resolveCommentReport(report: CommentReport, removeComment: boolean): void {
    this.adminService.resolveCommentReport(report.reportId, this.currentUserId, removeComment, removeComment ? 'Comment removed after report review' : 'Report reviewed').subscribe({
      next: () => this.loadAdminData(),
      error: (error: Error) => this.errorMessage = error.message
    });
  }

  sendBroadcast(): void {
    const message = this.broadcastMessage.trim();
    this.broadcastSuccessMessage = '';
    this.errorMessage = '';

    if (!message) {
      this.errorMessage = 'Write a notification message first.';
      return;
    }

    const recipientIds = this.resolveBroadcastRecipients();
    if (recipientIds === undefined) {
      return;
    }

    this.isSendingBroadcast = true;
    this.adminService.sendBroadcast(recipientIds && recipientIds.length > 0 ? recipientIds : null, message).subscribe({
      next: () => {
        this.broadcastMessage = '';
        this.broadcastRecipients = '';
        this.broadcastSuccessMessage = 'Broadcast notification sent.';
        this.isSendingBroadcast = false;
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
        this.isSendingBroadcast = false;
      }
    });
  }

  selectBroadcastRecipient(user: User, event: MouseEvent): void {
    event.preventDefault();

    const parts = this.broadcastRecipients.split(',');
    parts[parts.length - 1] = ` @${user.username}`;
    this.broadcastRecipients = parts
      .map((part, index) => index === 0 ? part.trim() : part.trim())
      .filter(Boolean)
      .join(', ');
    this.showRecipientSuggestions = false;
  }

  hideRecipientSuggestionsSoon(): void {
    setTimeout(() => {
      this.showRecipientSuggestions = false;
    }, 120);
  }

  getUserInitial(user: User): string {
    return (user.fullName || user.username || 'U').charAt(0).toUpperCase();
  }

  private resolveBroadcastRecipients(): number[] | null | undefined {
    const rawRecipients = this.broadcastRecipients.trim();
    if (!rawRecipients) {
      return null;
    }

    const usersByUsername = new Map(
      this.users.map((user) => [user.username.toLowerCase(), user])
    );
    const recipientIds = new Set<number>();
    const missingUsers: string[] = [];

    rawRecipients
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        const numericId = Number(value);
        if (Number.isInteger(numericId) && numericId > 0) {
          recipientIds.add(numericId);
          return;
        }

        const username = value.replace(/^@/, '').toLowerCase();
        const user = usersByUsername.get(username);
        if (user) {
          recipientIds.add(user.userId);
          return;
        }

        missingUsers.push(value);
      });

    if (missingUsers.length > 0) {
      this.errorMessage = `Could not find user${missingUsers.length > 1 ? 's' : ''}: ${missingUsers.join(', ')}`;
      return undefined;
    }

    return [...recipientIds];
  }

  private get currentBroadcastRecipientToken(): string {
    const lastToken = this.broadcastRecipients.split(',').pop()?.trim() ?? '';
    return lastToken.replace(/^@/, '').toLowerCase();
  }
}
