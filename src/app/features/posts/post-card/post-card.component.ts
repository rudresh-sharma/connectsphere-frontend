import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ReportDialogComponent } from '../../../shared/components/report-dialog/report-dialog.component';
import { SearchService } from '../../search/search.service';
import { CommentSectionComponent } from '../../comments/comment-section/comment-section.component';
import { ReactionBarComponent } from '../../likes/reaction-bar/reaction-bar.component';
import { User } from '../../../shared/models/auth.models';
import { Post, PostType, PostVisibility, UpdatePostRequest } from '../post.model';
import { PostService } from '../post.service';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
  };
  handler: (response: RazorpayPaymentResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CommentSectionComponent, ReactionBarComponent, ReportDialogComponent],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.css'
})
export class PostCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static activeFeedVideo: HTMLVideoElement | null = null;
  private static hasUnlockedAudio = false;

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly searchService = inject(SearchService);

  @Input({ required: true }) post!: Post;
  @Input({ required: true }) currentUserId = 0;
  @Input() currentUser: User | null = null;
  @Output() liked = new EventEmitter<Post>();
  @Output() deleted = new EventEmitter<Post>();
  @Output() updated = new EventEmitter<{ post: Post; request: UpdatePostRequest }>();
  @ViewChildren('feedVideo') private readonly feedVideos?: QueryList<ElementRef<HTMLVideoElement>>;

  editMode = false;
  showCommentsModal = false;
  menuOpen = false;
  isBookmarked = false;
  bookmarkPending = false;
  sharePending = false;
  promotePending = false;
  reportPending = false;
  showReportDialog = false;
  reportErrorMessage = '';
  reportSuccessMessage = '';
  paymentMessage = '';
  contentExpanded = false;
  private reportedPostIds = new Set<number>();
  private authorLoadPostId = 0;
  private videoObserver: IntersectionObserver | null = null;
  private readonly collapsedContentLength = 220;
  readonly postTypes: PostType[] = ['TEXT', 'IMAGE', 'VIDEO'];
  readonly visibilities: PostVisibility[] = ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'];

  readonly editForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(1000)]],
    mediaUrl: [''],
    postType: ['TEXT' as PostType, [Validators.required]],
    visibility: ['PUBLIC' as PostVisibility, [Validators.required]]
  });

  ngAfterViewInit(): void {
    this.bindAudioUnlockListeners();
    this.setupAutoplayObserver();
    this.feedVideos?.changes.subscribe(() => this.setupAutoplayObserver());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post'] && this.post) {
      this.editForm.reset({
        content: this.post.content,
        mediaUrl: this.displayMediaUrls.join(', '),
        postType: this.post.postType,
        visibility: this.post.visibility
      });
      this.contentExpanded = false;
      this.loadBookmarkStatus();
      this.loadReportedState();
      this.loadMissingAuthorProfile();
      globalThis.setTimeout(() => this.setupAutoplayObserver(), 0);
    }
  }

  ngOnDestroy(): void {
    this.disconnectAutoplayObserver();
    this.pauseFeedVideos(true);
  }

  get postId(): number {
    return this.post.id ?? this.post.postId ?? 0;
  }

  get likeCount(): number {
    return this.post.likesCount ?? this.post.likeCount ?? 0;
  }

  get commentCount(): number {
    return this.post.commentsCount ?? this.post.commentCount ?? 0;
  }

  get shareCount(): number {
    return this.post.sharesCount ?? this.post.shareCount ?? 0;
  }

  get createdLabel(): string {
    return this.post.createdAt
      ? new Date(this.post.createdAt).toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : 'Just now';
  }

  get authorName(): string {
    return (
      this.post.authorFullName ||
      this.post.author?.fullName ||
      this.post.authorUsername ||
      this.post.author?.username ||
      this.currentAuthor?.fullName ||
      this.currentAuthor?.username ||
      `User #${this.post.authorId || 'unknown'}`
    );
  }

  get authorUsername(): string {
    return (
      this.post.authorUsername ||
      this.post.author?.username ||
      this.currentAuthor?.username ||
      `user-${this.post.authorId || 'unknown'}`
    );
  }

  get authorProfilePicUrl(): string | null {
    const picUrl = 
      this.post.authorProfilePicUrl ||
      this.post.author?.profilePicUrl ||
      this.currentAuthor?.profilePicUrl;
    
    if (picUrl && typeof picUrl === 'string' && picUrl.trim().length > 0) {
      return picUrl.trim();
    }
    return null;
  }

  get authorInitials(): string {
    const source = this.authorName.trim();

    if (!source) {
      return 'U';
    }

    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  get hasMedia(): boolean {
    return this.displayMediaUrls.length > 0;
  }

  get hasVideoMedia(): boolean {
    return this.displayMediaUrls.some((url) => this.isVideo(url));
  }

  get displayMediaUrls(): string[] {
    const urls = [
      ...(this.post.mediaUrls ?? []),
      this.post.mediaUrl,
      this.post.videoUrl,
      this.post.imageUrl
    ];

    return Array.from(new Set(urls.filter((url): url is string => Boolean(url?.trim()))));
  }

  get hasLongContent(): boolean {
    return this.post.content.trim().length > this.collapsedContentLength;
  }

  get visibleContent(): string {
    const content = this.post.content.trim();

    if (this.contentExpanded || !this.hasLongContent) {
      return content;
    }

    return `${content.slice(0, this.collapsedContentLength).trimEnd()}...`;
  }

  get canModify(): boolean {
    return Boolean(this.currentUserId && this.post.authorId === this.currentUserId);
  }

  get isPromoted(): boolean {
    return Boolean(this.post.promoted && (!this.post.promotedUntil || new Date(this.post.promotedUntil) > new Date()));
  }

  get isPromotionPending(): boolean {
    return this.post.promotionStatus === 'PENDING' || this.post.promotionStatus === 'PENDING_APPROVAL';
  }

  get canReport(): boolean {
    return Boolean(
      this.currentUserId &&
      this.post.authorId !== this.currentUserId &&
      this.postId &&
      !this.reportPending &&
      !this.hasReportedCurrentPost
    );
  }

  get hasReportedCurrentPost(): boolean {
    return this.postId > 0 && this.reportedPostIds.has(this.postId);
  }

  private get currentAuthor(): User | null {
    return this.canModify ? this.currentUser : null;
  }

  private get hasAuthorProfile(): boolean {
    return Boolean(
      this.hasText(this.post.authorUsername) ||
      this.hasText(this.post.authorFullName) ||
      this.hasText(this.post.authorProfilePicUrl) ||
      this.hasText(this.post.author?.username) ||
      this.hasText(this.post.author?.fullName) ||
      this.hasText(this.post.author?.profilePicUrl)
    );
  }

  isVideo(url: string): boolean {
    const cleanUrl = url.split('?')[0];
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanUrl) || this.post.postType === 'VIDEO';
  }

  getContentSegments(content: string): string[] {
    return content.split(/(#[\w]+|@[\w.-]+)/g).filter((segment) => segment.length > 0);
  }

  toggleContent(): void {
    this.contentExpanded = !this.contentExpanded;
  }

  isHashtagSegment(segment: string): boolean {
    return /^#\w+$/.test(segment);
  }

  isMentionSegment(segment: string): boolean {
    return /^@[\w.-]+$/.test(segment);
  }

  onHashtagClick(hashtag: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.router.navigate(['/search'], {
      queryParams: { tag: hashtag.replace(/^#/, '') }
    });
  }

  onMentionClick(mention: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const username = mention.replace(/^@/, '').trim();
    if (!username) {
      return;
    }

    this.searchService.searchUsers(username).subscribe({
      next: (users) => {
        const matchedUser = users.find((user) => user.username?.toLowerCase() === username.toLowerCase());
        if (matchedUser?.userId) {
          void this.router.navigate(['/profile'], { queryParams: { userId: matchedUser.userId } });
          return;
        }

        void this.router.navigate(['/search'], { queryParams: { query: username } });
      },
      error: () => {
        void this.router.navigate(['/search'], { queryParams: { query: username } });
      }
    });
  }

  openCommentsModal(): void {
    this.pauseFeedVideos();
    this.showCommentsModal = true;
  }

  toggleBookmark(): void {
    if (!this.currentUserId || !this.postId || this.bookmarkPending) {
      return;
    }

    this.bookmarkPending = true;
    const request$ = this.isBookmarked
      ? this.postService.removeBookmark(this.postId, this.currentUserId)
      : this.postService.addBookmark(this.postId, this.currentUserId);

    request$.subscribe({
      next: () => {
        this.isBookmarked = !this.isBookmarked;
        this.bookmarkPending = false;
      },
      error: () => {
        this.bookmarkPending = false;
      }
    });
  }

  sharePost(): void {
    if (!this.postId || this.sharePending) {
      return;
    }

    if (!this.currentUserId) {
      void this.sharePostLink();
      return;
    }

    this.sharePending = true;
    this.postService.sharePost(this.postId, this.currentUserId).subscribe({
      next: async (updatedPost) => {
        this.post = updatedPost;
        await this.sharePostLink();
        this.sharePending = false;
      },
      error: () => {
        this.sharePending = false;
      }
    });
  }

  closeCommentsModal(): void {
    this.showCommentsModal = false;
    globalThis.setTimeout(() => this.playMostVisibleFeedVideo(), 0);
  }

  onCommentCountChange(count: number): void {
    this.post = {
      ...this.post,
      commentsCount: count,
      commentCount: count
    };
  }

  toggleEdit(): void {
    if (!this.canModify) {
      return;
    }

    this.editMode = !this.editMode;
    this.menuOpen = false;
  }

  toggleMenu(): void {
    if (!this.canModify) {
      return;
    }

    this.menuOpen = !this.menuOpen;
  }

  deletePost(): void {
    if (!this.canModify || !this.postId) {
      return;
    }

    this.menuOpen = false;
    this.deleted.emit(this.post);
  }

  promotePost(): void {
    if (!this.canModify || !this.postId || this.promotePending) {
      return;
    }

    this.menuOpen = false;
    this.paymentMessage = '';
    this.promotePending = true;

    this.postService.createPromotionOrder(this.postId, { userId: this.currentUserId }).subscribe({
      next: async (order) => {
        try {
          await this.loadRazorpayCheckout();
        } catch {
          this.promotePending = false;
          this.paymentMessage = 'Could not load Razorpay checkout.';
          return;
        }

        const Razorpay = globalThis.window?.Razorpay;
        if (!Razorpay) {
          this.promotePending = false;
          this.paymentMessage = 'Could not load Razorpay checkout.';
          return;
        }

        const checkout = new Razorpay({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          name: 'ConnectSphere',
          description: `Promote post for ${order.durationDays} days`,
          order_id: order.orderId,
          prefill: {
            name: this.currentUser?.fullName || this.currentUser?.username || ''
          },
          handler: (response) => this.verifyPromotionPayment(response),
          modal: {
            ondismiss: () => {
              this.promotePending = false;
            }
          }
        });
        checkout.open();
      },
      error: (error: Error) => {
        this.promotePending = false;
        this.paymentMessage = error.message;
      }
    });
  }

  saveEdit(): void {
    if (!this.canModify) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formValue = this.editForm.getRawValue();
    this.updated.emit({
      post: this.post,
      request: {
        content: formValue.content.trim(),
        mediaUrls: this.parseMediaUrls(formValue.mediaUrl),
        postType: formValue.postType,
        visibility: formValue.visibility
      }
    });
    this.editMode = false;
  }

  private parseMediaUrls(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter(Boolean);
  }

  private verifyPromotionPayment(response: RazorpayPaymentResponse): void {
    this.postService.verifyPromotionPayment(this.postId, {
      userId: this.currentUserId,
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature
    }).subscribe({
      next: (updatedPost) => {
        this.post = updatedPost;
        this.promotePending = false;
        this.paymentMessage = updatedPost.promotionStatus === 'PENDING_APPROVAL'
          ? 'Payment received. Promotion is pending admin approval.'
          : 'Post promoted successfully.';
      },
      error: (error: Error) => {
        this.promotePending = false;
        this.paymentMessage = error.message;
      }
    });
  }

  private loadRazorpayCheckout(): Promise<void> {
    if (globalThis.window?.Razorpay) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout script.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
      document.body.appendChild(script);
    });
  }

  reportPost(): void {
    if (!this.canReport) {
      return;
    }

    this.reportErrorMessage = '';
    this.reportSuccessMessage = '';
    this.showReportDialog = true;
  }

  closeReportDialog(): void {
    if (this.reportPending) {
      return;
    }

    this.showReportDialog = false;
    this.reportErrorMessage = '';
  }

  submitPostReport(reason: string): void {
    this.reportPending = true;
    this.menuOpen = false;
    this.postService.reportPost(this.postId, this.currentUserId, reason).subscribe({
      next: () => {
        this.reportPending = false;
        this.showReportDialog = false;
        this.reportErrorMessage = '';
        this.reportSuccessMessage = 'Post reported. Our admins can review it now.';
        this.markPostAsReported();
      },
      error: (error: Error) => {
        this.reportPending = false;
        this.reportErrorMessage = error.message || 'Could not report this post.';
      }
    });
  }

  private loadBookmarkStatus(): void {
    if (!this.currentUserId || !this.postId) {
      this.isBookmarked = false;
      return;
    }

    this.postService.isBookmarked(this.postId, this.currentUserId).subscribe({
      next: (isBookmarked) => {
        this.isBookmarked = isBookmarked;
      },
      error: () => {
        this.isBookmarked = false;
      }
    });
  }

  private loadMissingAuthorProfile(): void {
    if (!this.post.authorId || this.hasAuthorProfile || this.authorLoadPostId === this.postId) {
      return;
    }

    this.authorLoadPostId = this.postId;
    this.authService.getPublicUser(this.post.authorId).subscribe({
      next: (author) => {
        this.post = {
          ...this.post,
          authorUsername: this.post.authorUsername || author.username,
          authorFullName: this.post.authorFullName || author.fullName,
          authorProfilePicUrl: this.post.authorProfilePicUrl || author.profilePicUrl,
          author: {
            ...this.post.author,
            userId: author.userId,
            username: this.post.author?.username || author.username,
            fullName: this.post.author?.fullName || author.fullName,
            profilePicUrl: this.post.author?.profilePicUrl || author.profilePicUrl
          }
        };
      },
      error: () => {
        this.authorLoadPostId = 0;
      }
    });
  }

  private hasText(value: string | null | undefined): boolean {
    return !!value?.trim();
  }

  private setupAutoplayObserver(): void {
    this.disconnectAutoplayObserver();

    const videos = this.feedVideos?.toArray().map((video) => video.nativeElement) ?? [];
    if (!videos.length) {
      return;
    }

    for (const video of videos) {
      video.muted = false;
      video.playsInline = true;
      video.preload = 'metadata';
    }

    this.videoObserver = new IntersectionObserver(
      () => this.playMostVisibleFeedVideo(),
      {
        threshold: [0, 0.25, 0.5, 0.65, 0.8, 1]
      }
    );

    for (const video of videos) {
      this.videoObserver.observe(video);
    }

    this.playMostVisibleFeedVideo();
  }

  private disconnectAutoplayObserver(): void {
    this.videoObserver?.disconnect();
    this.videoObserver = null;
  }

  private playMostVisibleFeedVideo(): void {
    if (this.showCommentsModal || this.editMode || document.hidden) {
      this.pauseFeedVideos();
      return;
    }

    const videos = this.feedVideos?.toArray().map((video) => video.nativeElement) ?? [];
    let bestVideo: HTMLVideoElement | null = null;
    let bestVisibleRatio = 0;

    for (const video of videos) {
      const visibleRatio = this.getVisibleRatio(video);
      if (visibleRatio > bestVisibleRatio) {
        bestVisibleRatio = visibleRatio;
        bestVideo = video;
      }
    }

    if (!bestVideo || bestVisibleRatio < 0.65) {
      this.pauseFeedVideos();
      return;
    }

    this.playExclusive(bestVideo);
  }

  private playExclusive(video: HTMLVideoElement): void {
    if (PostCardComponent.activeFeedVideo && PostCardComponent.activeFeedVideo !== video) {
      PostCardComponent.activeFeedVideo.muted = true;
      PostCardComponent.activeFeedVideo.pause();
    }

    PostCardComponent.activeFeedVideo = video;
    video.playsInline = true;
    video.muted = false;

    void video.play().catch(() => {
      video.muted = true;
      void video.play().catch(() => {
        if (PostCardComponent.activeFeedVideo === video) {
          PostCardComponent.activeFeedVideo = null;
        }
      });
    });
  }

  private get reportedPostsStorageKey(): string {
    return `connectsphere_reported_posts_${this.currentUserId || 0}`;
  }

  private loadReportedState(): void {
    if (!this.currentUserId) {
      this.reportedPostIds.clear();
      return;
    }

    const raw = localStorage.getItem(this.reportedPostsStorageKey);
    if (!raw) {
      this.reportedPostIds.clear();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        this.reportedPostIds.clear();
        return;
      }

      this.reportedPostIds = new Set(
        parsed
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      );
    } catch {
      this.reportedPostIds.clear();
      localStorage.removeItem(this.reportedPostsStorageKey);
    }
  }

  private markPostAsReported(): void {
    if (!this.currentUserId || !this.postId) {
      return;
    }

    this.reportedPostIds.add(this.postId);
    localStorage.setItem(this.reportedPostsStorageKey, JSON.stringify([...this.reportedPostIds]));
  }

  private bindAudioUnlockListeners(): void {
    if (PostCardComponent.hasUnlockedAudio || !globalThis.window) {
      return;
    }

    const unlockAudio = () => {
      PostCardComponent.hasUnlockedAudio = true;
      globalThis.removeEventListener('pointerdown', unlockAudio);
      globalThis.removeEventListener('touchstart', unlockAudio);
      globalThis.removeEventListener('keydown', unlockAudio);
      this.playMostVisibleFeedVideo();
    };

    globalThis.addEventListener('pointerdown', unlockAudio, { once: true });
    globalThis.addEventListener('touchstart', unlockAudio, { once: true });
    globalThis.addEventListener('keydown', unlockAudio, { once: true });
  }

  private pauseFeedVideos(reset = false): void {
    const videos = this.feedVideos?.toArray().map((video) => video.nativeElement) ?? [];
    for (const video of videos) {
      video.muted = true;
      video.pause();
      if (reset) {
        video.currentTime = 0;
      }
      if (PostCardComponent.activeFeedVideo === video) {
        PostCardComponent.activeFeedVideo = null;
      }
    }
  }

  private getVisibleRatio(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    const visibleLeft = Math.max(rect.left, 0);
    const visibleRight = Math.min(rect.right, viewportWidth);
    const visibleArea = Math.max(0, visibleBottom - visibleTop) * Math.max(0, visibleRight - visibleLeft);
    const totalArea = Math.max(1, rect.width * rect.height);
    return visibleArea / totalArea;
  }

  private async sharePostLink(): Promise<void> {
    const url = `${globalThis.location.origin}/post/${this.postId}`;
    const text = `${this.authorName}: ${this.post.content}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${this.authorName}'s post`,
          text,
          url
        });
        return;
      } catch {
        // Fall back to clipboard below if native share is cancelled or unavailable.
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Ignore clipboard failures.
      }
    }
  }

}
