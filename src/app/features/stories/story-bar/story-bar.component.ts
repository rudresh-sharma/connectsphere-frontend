import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoryService } from '../story.service';
import { StoryResponse } from '../story.model';
import { LikeService } from '../../likes/like.service';
import { NotificationService } from '../../notifications/notification.service';
import { AuthService } from '../../../core/services/auth.service';

interface StoryGroup {
  authorId: number;
  authorUsername?: string;
  authorProfilePicUrl?: string;
  stories: StoryResponse[];
}

@Component({
  selector: 'app-story-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './story-bar.component.html',
  styleUrls: ['./story-bar.component.css']
})
export class StoryBarComponent implements OnInit, OnDestroy {
  private static readonly IMAGE_STORY_DURATION_MS = 7000;
  private static readonly MAX_VIDEO_STORY_DURATION_MS = 60000;

  private readonly storyService = inject(StoryService);
  private readonly likeService = inject(LikeService);
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private storyAdvanceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private storyProgressIntervalId: ReturnType<typeof setInterval> | null = null;

  stories: StoryResponse[] = [];
  storyGroups: StoryGroup[] = [];
  viewingStory: StoryResponse | null = null;
  viewingGroupIndex = 0;
  viewingStoryIndex = 0;
  showCreateForm = false;
  caption = '';
  currentUserId = 0;
  currentUsername = '';
  isUploading = false;
  errorMessage = '';
  storyLikeIds = new Set<number>();
  likingStoryIds = new Set<number>();
  activeStoryProgress = 0;
  viewedStoryIds = new Set<number>();

  @ViewChild('storyVideo') storyVideo?: ElementRef<HTMLVideoElement>;

  ngOnInit(): void {
    const currentUser = this.getCurrentUser();
    this.currentUserId = currentUser.userId ?? 0;
    this.currentUsername = currentUser.username || currentUser.fullName || 'Someone';

    if (this.authService.getToken()) {
      this.authService.syncCurrentUser().subscribe({
        next: (user) => {
          this.currentUserId = user.userId ?? 0;
          this.currentUsername = user.username || user.fullName || 'Someone';
          this.loadViewedStories();
          this.loadStories();
        },
        error: () => {}
      });
    }

    this.loadViewedStories();
    this.loadStories();
  }

  ngOnDestroy(): void {
    this.clearStoryPlayback();
  }

  loadStories(): void {
    this.storyService.getActiveStories(this.currentUserId).subscribe({
      next: (list) => {
        this.stories = list ?? [];
        this.storyGroups = this.groupStoriesByAuthor(this.stories);
      },
      error: () => {}
    });
  }

  get hasOwnStory(): boolean {
    return this.stories.some((story) => story.authorId === this.currentUserId);
  }

  openStoryGroup(groupIndex: number, storyIndex: number = 0): void {
    this.viewingGroupIndex = groupIndex;
    this.viewingStoryIndex = storyIndex;
    this.showViewingStory();
  }

  isStoryGroupViewed(group: StoryGroup): boolean {
    return group.stories.length > 0 && group.stories.every((story) => this.viewedStoryIds.has(story.storyId));
  }

  isStoryLiked(storyId: number): boolean {
    return this.storyLikeIds.has(storyId);
  }

  toggleStoryLike(story: StoryResponse, event: Event): void {
    event.stopPropagation();

    if (!this.currentUserId || this.likingStoryIds.has(story.storyId)) {
      return;
    }

    this.likingStoryIds.add(story.storyId);

    if (this.isStoryLiked(story.storyId)) {
      this.likeService.unlike(this.currentUserId, story.storyId, 'STORY').subscribe({
        next: () => this.storyLikeIds.delete(story.storyId),
        error: () => this.likingStoryIds.delete(story.storyId),
        complete: () => this.likingStoryIds.delete(story.storyId)
      });
      return;
    }

    this.likeService.like({
      userId: this.currentUserId,
      targetId: story.storyId,
      targetType: 'STORY',
      reactionType: 'LOVE'
    }).subscribe({
      next: () => {
        this.storyLikeIds.add(story.storyId);
        this.notifyStoryLike(story);
      },
      error: () => this.likingStoryIds.delete(story.storyId),
      complete: () => this.likingStoryIds.delete(story.storyId)
    });
  }

  closeViewer(): void {
    this.clearStoryPlayback();
    this.viewingStory = null;
    this.viewingGroupIndex = 0;
    this.viewingStoryIndex = 0;
    this.activeStoryProgress = 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.[0]) {
      return;
    }

    if (!this.currentUserId) {
      this.errorMessage = 'You must be logged in to add a story.';
      input.value = '';
      return;
    }

    this.errorMessage = '';
    this.isUploading = true;
    this.storyService.createStory(this.currentUserId, input.files[0], this.caption || undefined).subscribe({
      next: () => {
        this.showCreateForm = false;
        this.caption = '';
        this.isUploading = false;
        input.value = '';
        this.loadStories();
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
        this.isUploading = false;
        input.value = '';
      }
    });
  }

  toggleCreate(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  showCreate(event: Event): void {
    event.stopPropagation();
    this.showCreateForm = true;
  }

  deleteStory(storyId: number): void {
    this.storyService.deleteStory(storyId).subscribe({
      next: () => {
        this.storyLikeIds.delete(storyId);
        this.closeViewer();
        this.loadStories();
      },
      error: () => {}
    });
  }

  goToNextStory(event?: Event): void {
    event?.stopPropagation();

    const currentGroup = this.storyGroups[this.viewingGroupIndex];
    if (!currentGroup) {
      return;
    }

    if (this.viewingStoryIndex < currentGroup.stories.length - 1) {
      this.viewingStoryIndex += 1;
      this.showViewingStory();
      return;
    }

    if (this.viewingGroupIndex < this.storyGroups.length - 1) {
      this.viewingGroupIndex += 1;
      this.viewingStoryIndex = 0;
      this.showViewingStory();
      return;
    }

    this.closeViewer();
  }

  goToPreviousStory(event?: Event): void {
    event?.stopPropagation();

    if (this.viewingStoryIndex > 0) {
      this.viewingStoryIndex -= 1;
      this.showViewingStory();
      return;
    }

    if (this.viewingGroupIndex > 0) {
      this.viewingGroupIndex -= 1;
      const previousGroup = this.storyGroups[this.viewingGroupIndex];
      this.viewingStoryIndex = Math.max(0, previousGroup.stories.length - 1);
      this.showViewingStory();
    }
  }

  get activeStoryGroup(): StoryGroup | null {
    return this.storyGroups[this.viewingGroupIndex] ?? null;
  }

  getStoryProgress(storyIndex: number): number {
    if (storyIndex < this.viewingStoryIndex) {
      return 100;
    }

    if (storyIndex > this.viewingStoryIndex) {
      return 0;
    }

    return this.activeStoryProgress;
  }

  selectStoryInViewer(index: number, event?: Event): void {
    event?.stopPropagation();
    this.viewingStoryIndex = index;
    this.showViewingStory();
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  private getCurrentUserId(): number {
    return this.getCurrentUser().userId ?? 0;
  }

  private getCurrentUser(): { userId?: number; username?: string; fullName?: string } {
    const currentUser = this.authService.getCurrentUser();
    return currentUser ?? {};
  }

  private loadStoryLikeStatus(storyId: number): void {
    if (!this.currentUserId) {
      return;
    }

    this.likeService.hasLiked(this.currentUserId, storyId, 'STORY').subscribe({
      next: (liked) => {
        if (liked) {
          this.storyLikeIds.add(storyId);
        } else {
          this.storyLikeIds.delete(storyId);
        }
      },
      error: () => {}
    });
  }

  private notifyStoryLike(story: StoryResponse): void {
    if (story.authorId === this.currentUserId) {
      return;
    }

    this.notificationService.create({
      recipientId: story.authorId,
      actorId: this.currentUserId,
      type: 'LIKE',
      message: `${this.currentUsername} liked your story`,
      targetId: story.storyId,
      targetType: 'STORY'
    }).subscribe({ error: () => {} });
  }

  private groupStoriesByAuthor(stories: StoryResponse[]): StoryGroup[] {
    const groups = new Map<number, StoryGroup>();

    for (const story of stories) {
      const existingGroup = groups.get(story.authorId);
      if (existingGroup) {
        existingGroup.stories.push(story);
        continue;
      }

      groups.set(story.authorId, {
        authorId: story.authorId,
        authorUsername: story.authorUsername,
        authorProfilePicUrl: story.authorProfilePicUrl,
        stories: [story]
      });
    }

    return Array.from(groups.values()).sort((first, second) => {
      if (first.authorId === this.currentUserId) {
        return -1;
      }

      if (second.authorId === this.currentUserId) {
        return 1;
      }

      return 0;
    });
  }

  private showViewingStory(): void {
    this.clearStoryPlayback();
    const group = this.storyGroups[this.viewingGroupIndex];
    const story = group?.stories[this.viewingStoryIndex] ?? null;

    this.viewingStory = story;
    this.activeStoryProgress = 0;

    if (!story) {
      return;
    }

    this.markStoryViewed(story.storyId);

    if (story.mediaType !== 'VIDEO') {
      this.startStoryTimer(StoryBarComponent.IMAGE_STORY_DURATION_MS);
    }

    this.loadStoryLikeStatus(story.storyId);

    if (story.authorId === this.currentUserId) {
      return;
    }

    this.storyService.viewStory(story.storyId, this.currentUserId).subscribe({
      next: (updated) => {
        this.viewingStory = updated;
        const currentGroup = this.storyGroups[this.viewingGroupIndex];
        if (currentGroup?.stories[this.viewingStoryIndex]?.storyId === updated.storyId) {
          currentGroup.stories[this.viewingStoryIndex] = updated;
        }
      },
      error: () => {}
    });
  }

  onStoryVideoLoaded(): void {
    const video = this.storyVideo?.nativeElement;
    if (!video || this.viewingStory?.mediaType !== 'VIDEO') {
      return;
    }

    const durationMs = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(video.duration * 1000, StoryBarComponent.MAX_VIDEO_STORY_DURATION_MS)
      : StoryBarComponent.MAX_VIDEO_STORY_DURATION_MS;

    this.startStoryTimer(durationMs);
  }

  onStoryVideoEnded(): void {
    this.goToNextStory();
  }

  private startStoryTimer(durationMs: number): void {
    this.clearStoryPlayback();

    const safeDuration = Math.max(1000, durationMs);
    const startedAt = Date.now();
    this.activeStoryProgress = 0;

    this.storyProgressIntervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      this.activeStoryProgress = Math.min(100, (elapsed / safeDuration) * 100);
    }, 100);

    this.storyAdvanceTimeoutId = setTimeout(() => {
      this.activeStoryProgress = 100;
      this.goToNextStory();
    }, safeDuration);
  }

  private clearStoryPlayback(): void {
    if (this.storyAdvanceTimeoutId) {
      clearTimeout(this.storyAdvanceTimeoutId);
      this.storyAdvanceTimeoutId = null;
    }

    if (this.storyProgressIntervalId) {
      clearInterval(this.storyProgressIntervalId);
      this.storyProgressIntervalId = null;
    }
  }

  private loadViewedStories(): void {
    const key = this.getViewedStoriesStorageKey();
    if (!key) {
      this.viewedStoryIds.clear();
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as number[];
      this.viewedStoryIds = new Set(stored.filter((storyId) => Number.isFinite(storyId)));
    } catch {
      this.viewedStoryIds.clear();
    }
  }

  private markStoryViewed(storyId: number): void {
    if (!storyId || this.viewedStoryIds.has(storyId)) {
      return;
    }

    this.viewedStoryIds.add(storyId);
    this.persistViewedStories();
  }

  private persistViewedStories(): void {
    const key = this.getViewedStoriesStorageKey();
    if (!key) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(Array.from(this.viewedStoryIds)));
  }

  private getViewedStoriesStorageKey(): string | null {
    return this.currentUserId ? `connectsphere_viewed_stories_${this.currentUserId}` : null;
  }
}
