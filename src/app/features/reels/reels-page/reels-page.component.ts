import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  inject
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, finalize, forkJoin, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/auth.models';
import { CommentSectionComponent } from '../../comments/comment-section/comment-section.component';
import { ReactionBarComponent } from '../../likes/reaction-bar/reaction-bar.component';
import { Post } from '../../posts/post.model';
import { PostService } from '../../posts/post.service';
import { Reel } from '../reel.model';
import { ReelService } from '../reel.service';

@Component({
  selector: 'app-reels-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactionBarComponent, CommentSectionComponent],
  templateUrl: './reels-page.component.html',
  styleUrl: './reels-page.component.css'
})
export class ReelsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private static hasUnlockedAudio = false;
  private readonly authService = inject(AuthService);
  private readonly reelService = inject(ReelService);
  private readonly postService = inject(PostService);

  @ViewChild('feedMain') private feedMain?: ElementRef<HTMLElement>;
  @ViewChildren('reelCard') private reelCards?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('reelVideo') private reelVideos?: QueryList<ElementRef<HTMLVideoElement>>;

  currentUser: User | null = null;
  reels: Reel[] = [];
  isLoading = false;
  errorMessage = '';
  showCommentsForReelId: number | null = null;
  isSoundEnabled = true;
  bookmarkedPostIds = new Set<number>();
  bookmarkPendingPostIds = new Set<number>();
  private readonly viewedReelIds = new Set<number>();
  private readonly expandedCaptionReelIds = new Set<number>();
  private readonly collapsedCaptionLength = 76;
  private readonly visibleReelRatios = new Map<number, number>();
  private readonly reelListSubscription = new Subscription();
  private activeReelId: number | null = null;
  private reelObserver?: IntersectionObserver;
  private playbackSyncFrame = 0;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadReels();
  }

  ngAfterViewInit(): void {
    this.bindAudioUnlockListeners();
    this.reelListSubscription.add(
      this.reelCards?.changes.subscribe(() => this.resetReelObserver())
    );
    this.resetReelObserver();
  }

  ngOnDestroy(): void {
    this.reelListSubscription.unsubscribe();
    this.reelObserver?.disconnect();
    if (this.playbackSyncFrame) {
      cancelAnimationFrame(this.playbackSyncFrame);
    }
    this.pauseAllVideos();
  }

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  get profileInitial(): string {
    return this.currentUser?.fullName?.charAt(0) || this.currentUser?.username?.charAt(0) || 'C';
  }

  trackReel(_index: number, reel: Reel): number {
    return reel.reelId;
  }

  loadReels(): void {
    this.errorMessage = '';
    this.isLoading = true;

    forkJoin({
      reels: this.reelService.getReels(),
      posts: this.postService.getPublicPosts()
    })
      .pipe(
        map(({ reels, posts }) => this.mergePlatformVideos(reels ?? [], posts ?? [])),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (reels) => {
          this.reels = reels ?? [];
          this.activeReelId = null;
          this.visibleReelRatios.clear();
          this.loadBookmarkStatuses();
          this.schedulePlaybackSync();
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Could not load reels.';
        }
      });
  }

  onVideoPlay(reel: Reel): void {
    if (!reel.reelId || this.viewedReelIds.has(reel.reelId) || reel.sourceType === 'POST') {
      return;
    }

    this.viewedReelIds.add(reel.reelId);
    this.reelService.viewReel(reel.reelId, this.currentUserId || undefined).subscribe({
      next: (updatedReel) => {
        this.reels = this.reels.map((item) => (item.reelId === updatedReel.reelId ? updatedReel : item));
      },
      error: () => {
        // Ignore view-tracking failures so playback is not interrupted.
      }
    });
  }

  toggleSound(reel: Reel): void {
    if (this.activeReelId !== reel.reelId) {
      this.activeReelId = reel.reelId;
    }

    this.isSoundEnabled = !this.isSoundEnabled;
    this.playActiveReel();
  }

  activateReel(reel: Reel): void {
    if (this.activeReelId !== reel.reelId) {
      this.activeReelId = reel.reelId;
    }

    this.playActiveReel();
  }

  isReelMuted(reel: Reel): boolean {
    return !this.isSoundEnabled || this.activeReelId !== reel.reelId;
  }

  deleteReel(reel: Reel): void {
    if (reel.sourceType === 'POST' || !reel.reelId || reel.authorId !== this.currentUserId || !window.confirm('Delete this reel?')) {
      return;
    }

    this.reelService.deleteReel(reel.reelId).subscribe({
      next: () => {
        this.reels = this.reels.filter((item) => item.reelId !== reel.reelId);
      },
      error: (error: Error) => {
        this.errorMessage = error.message || 'Could not delete reel.';
      }
    });
  }

  getAuthorName(reel: Reel): string {
    return reel.authorFullName || reel.authorUsername || 'ConnectSphere creator';
  }

  getCreatedLabel(reel: Reel): string {
    return reel.createdAt
      ? new Date(reel.createdAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Just now';
  }

  canDeleteReel(reel: Reel): boolean {
    return reel.sourceType !== 'POST' && reel.authorId === this.currentUserId;
  }

  hasLongCaption(reel: Reel): boolean {
    return (reel.caption?.trim().length ?? 0) > this.collapsedCaptionLength;
  }

  isCaptionExpanded(reel: Reel): boolean {
    return this.expandedCaptionReelIds.has(reel.reelId);
  }

  getVisibleCaption(reel: Reel): string {
    const caption = reel.caption?.trim() ?? '';

    if (!caption || this.isCaptionExpanded(reel) || !this.hasLongCaption(reel)) {
      return caption;
    }

    return `${caption.slice(0, this.collapsedCaptionLength).trimEnd()}...`;
  }

  toggleCaption(reel: Reel): void {
    if (this.isCaptionExpanded(reel)) {
      this.expandedCaptionReelIds.delete(reel.reelId);
      return;
    }

    this.expandedCaptionReelIds.add(reel.reelId);
  }

  getInteractionTargetId(reel: Reel): number {
    return reel.sourcePostId ?? 0;
  }

  canInteractWithReel(reel: Reel): boolean {
    return Boolean(this.currentUserId && reel.sourcePostId);
  }

  getCommentCount(reel: Reel): number {
    return reel.commentsCount ?? 0;
  }

  isCommentsOpen(reel: Reel): boolean {
    return this.showCommentsForReelId === reel.reelId;
  }

  openComments(reel: Reel): void {
    if (!this.canInteractWithReel(reel)) {
      return;
    }

    if (this.showCommentsForReelId === reel.reelId) {
      this.closeComments();
      return;
    }

    this.showCommentsForReelId = reel.reelId;
  }

  closeComments(): void {
    this.showCommentsForReelId = null;
  }

  updateCommentCount(reel: Reel, commentCount: number): void {
    if ((reel.commentsCount ?? 0) === commentCount) {
      return;
    }

    this.reels = this.reels.map((item) =>
      item.reelId === reel.reelId ? { ...item, commentsCount: commentCount } : item
    );
  }

  onReelsScroll(): void {
    this.schedulePlaybackSync();
  }

  onVideoLoadedMetadata(reel: Reel): void {
    if (this.activeReelId === reel.reelId) {
      this.playActiveReel();
    }
  }

  isBookmarked(reel: Reel): boolean {
    return Boolean(reel.sourcePostId && this.bookmarkedPostIds.has(reel.sourcePostId));
  }

  isBookmarkPending(reel: Reel): boolean {
    return Boolean(reel.sourcePostId && this.bookmarkPendingPostIds.has(reel.sourcePostId));
  }

  toggleBookmark(reel: Reel): void {
    const postId = reel.sourcePostId;
    if (!this.currentUserId || !postId || this.bookmarkPendingPostIds.has(postId)) {
      return;
    }

    this.bookmarkPendingPostIds.add(postId);
    const request$ = this.bookmarkedPostIds.has(postId)
      ? this.postService.removeBookmark(postId, this.currentUserId)
      : this.postService.addBookmark(postId, this.currentUserId);

    request$.subscribe({
      next: () => {
        if (this.bookmarkedPostIds.has(postId)) {
          this.bookmarkedPostIds.delete(postId);
        } else {
          this.bookmarkedPostIds.add(postId);
        }
        this.bookmarkPendingPostIds.delete(postId);
      },
      error: () => {
        this.bookmarkPendingPostIds.delete(postId);
      }
    });
  }

  private mergePlatformVideos(reels: Reel[], posts: Post[]): Reel[] {
    const videoPosts = posts
      .flatMap((post) => this.mapPostToReels(post))
      .filter((reel) => !!reel.videoUrl);

    const merged = [...reels.map((reel) => ({ ...reel, sourceType: 'REEL' as const })), ...videoPosts];

    return merged.sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }

  private mapPostToReels(post: Post): Reel[] {
    const postId = post.id ?? post.postId ?? 0;
    if (!postId || !this.isVideoPost(post)) {
      return [];
    }

    return (post.mediaUrls ?? [])
      .filter((url) => this.isVideoUrl(url))
      .map((url, index) => ({
        reelId: Number(`${postId}${index}`),
        authorId: post.authorId,
        videoUrl: url,
        caption: post.content,
        viewsCount: 0,
        createdAt: post.createdAt ?? '',
        authorUsername: post.authorUsername,
        authorFullName: post.authorFullName,
        authorProfilePicUrl: post.authorProfilePicUrl ?? undefined,
        commentsCount: post.commentsCount ?? post.commentCount ?? 0,
        sourceType: 'POST' as const,
        sourcePostId: postId
      }));
  }

  private isVideoPost(post: Post): boolean {
    return post.postType === 'VIDEO'
      || post.postType === 'MIXED'
      || (post.mediaUrls ?? []).some((url) => this.isVideoUrl(url));
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(url);
  }

  private loadBookmarkStatuses(): void {
    this.bookmarkedPostIds.clear();

    if (!this.currentUserId) {
      return;
    }

    const postIds = [...new Set(this.reels
      .map((reel) => reel.sourcePostId)
      .filter((postId): postId is number => Boolean(postId)))];

    postIds.forEach((postId) => {
      this.postService.isBookmarked(postId, this.currentUserId).subscribe({
        next: (isBookmarked) => {
          if (isBookmarked) {
            this.bookmarkedPostIds.add(postId);
          } else {
            this.bookmarkedPostIds.delete(postId);
          }
        },
        error: () => {
          this.bookmarkedPostIds.delete(postId);
        }
      });
    });
  }

  private resetReelObserver(): void {
    this.reelObserver?.disconnect();
    this.visibleReelRatios.clear();
    this.pauseAllVideos();

    const cards = this.reelCards?.toArray() ?? [];
    if (!cards.length) {
      return;
    }

    this.reelObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = Number((entry.target as HTMLElement).dataset['reelId']);
          if (!reelId) {
            return;
          }

          if (entry.isIntersecting) {
            this.visibleReelRatios.set(reelId, entry.intersectionRatio);
          } else {
            this.visibleReelRatios.delete(reelId);
          }
        });

        this.syncActiveReelPlayback();
      },
      {
        root: this.feedMain?.nativeElement ?? null,
        threshold: [0, 0.35, 0.55, 0.75, 0.95]
      }
    );

    cards.forEach((card) => this.reelObserver?.observe(card.nativeElement));
    this.schedulePlaybackSync();
  }

  private schedulePlaybackSync(): void {
    if (this.playbackSyncFrame) {
      return;
    }

    this.playbackSyncFrame = requestAnimationFrame(() => {
      this.playbackSyncFrame = 0;
      this.syncActiveReelPlayback();
    });
  }

  private syncActiveReelPlayback(): void {
    const nextActiveReelId = this.getMostVisibleReelId();
    if (!nextActiveReelId) {
      this.activeReelId = null;
      this.pauseAllVideos();
      return;
    }

    if (this.activeReelId === nextActiveReelId) {
      this.playActiveReel();
      return;
    }

    this.activeReelId = nextActiveReelId;
    this.playActiveReel();
  }

  private getMostVisibleReelId(): number | null {
    const measuredReelId = this.getMostVisibleMeasuredReelId();
    if (measuredReelId) {
      return measuredReelId;
    }

    let activeReelId: number | null = null;
    let activeRatio = 0;

    this.visibleReelRatios.forEach((ratio, reelId) => {
      if (ratio > activeRatio) {
        activeRatio = ratio;
        activeReelId = reelId;
      }
    });

    return activeRatio >= 0.35 ? activeReelId : null;
  }

  private getMostVisibleMeasuredReelId(): number | null {
    const cards = this.reelCards?.toArray() ?? [];
    const scrollRoot = this.feedMain?.nativeElement;
    if (!cards.length || !scrollRoot) {
      return null;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    let activeReelId: number | null = null;
    let activeRatio = 0;

    cards.forEach((cardRef) => {
      const card = cardRef.nativeElement;
      const reelId = Number(card.dataset['reelId']);
      if (!reelId) {
        return;
      }

      const cardRect = card.getBoundingClientRect();
      const visibleTop = Math.max(cardRect.top, rootRect.top);
      const visibleBottom = Math.min(cardRect.bottom, rootRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const ratioBase = Math.min(cardRect.height, rootRect.height) || cardRect.height || 1;
      const ratio = visibleHeight / ratioBase;

      if (ratio > activeRatio) {
        activeRatio = ratio;
        activeReelId = reelId;
      }
    });

    return activeRatio >= 0.25 ? activeReelId : null;
  }

  private playActiveReel(): void {
    const videos = this.reelVideos?.toArray() ?? [];

    videos.forEach((videoRef) => {
      const video = videoRef.nativeElement;
      const reelId = Number(video.dataset['reelId']);

      if (reelId === this.activeReelId) {
        video.muted = !this.isSoundEnabled || !ReelsPageComponent.hasUnlockedAudio;
        video.volume = 1;
        void video.play().catch(() => {
          // Browsers may still block autoplay until the page gets a real user interaction.
        });
        return;
      }

      video.muted = true;
      if (!video.paused) {
        video.pause();
      }
      video.currentTime = 0;
    });
  }

  private pauseAllVideos(): void {
    this.reelVideos?.forEach((videoRef) => {
      const video = videoRef.nativeElement;
      video.muted = true;
      if (!video.paused) {
        video.pause();
      }
    });
  }

  private bindAudioUnlockListeners(): void {
    if (ReelsPageComponent.hasUnlockedAudio || typeof window === 'undefined') {
      return;
    }

    const unlockAudio = () => {
      ReelsPageComponent.hasUnlockedAudio = true;
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('scroll', unlockAudio, true);
      this.playActiveReel();
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('scroll', unlockAudio, { once: true, capture: true });
  }
}
