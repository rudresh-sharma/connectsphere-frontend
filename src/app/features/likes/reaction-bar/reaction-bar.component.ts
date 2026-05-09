import { Component, ElementRef, HostListener, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LikeService } from '../like.service';
import { LikeResponse, REACTION_EMOJIS, ReactionType, TargetType } from '../like.model';
import { NotificationService } from '../../notifications/notification.service';

@Component({
  selector: 'app-reaction-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reaction-bar.component.html',
  styleUrls: ['./reaction-bar.component.css']
})
export class ReactionBarComponent implements OnInit, OnChanges {
  @Input() targetId = 0;
  @Input() targetType: TargetType = 'POST';
  @Input() currentUserId = 0;
  @Input() recipientId = 0;
  @Input() actorName = 'Someone';
  @Input() initialCount = 0;

  private readonly likeService = inject(LikeService);
  private readonly notificationService = inject(NotificationService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  readonly reactionOptions: { type: ReactionType; label: string; emoji: string }[] = [
    { type: 'LIKE', label: 'Like', emoji: REACTION_EMOJIS.LIKE },
    { type: 'LOVE', label: 'Love', emoji: REACTION_EMOJIS.LOVE },
    { type: 'HAHA', label: 'Haha', emoji: REACTION_EMOJIS.HAHA },
    { type: 'WOW', label: 'Wow', emoji: REACTION_EMOJIS.WOW },
    { type: 'SAD', label: 'Sad', emoji: REACTION_EMOJIS.SAD },
    { type: 'ANGRY', label: 'Angry', emoji: REACTION_EMOJIS.ANGRY }
  ];

  hasLiked = false;
  currentReaction: ReactionType | null = null;
  totalCount = 0;
  reactionCounts: Partial<Record<ReactionType, number>> = {};
  showGuestPrompt = false;
  loading = false;
  pickerOpen = false;
  private guestPromptTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pickerCloseTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.totalCount = this.initialCount;
    if (this.targetId) {
      this.loadState();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCount'] && !changes['initialCount'].firstChange) {
      this.totalCount = this.initialCount;
    }

    if ((changes['targetId'] || changes['targetType'] || changes['currentUserId']) && !changes['targetId']?.firstChange) {
      this.totalCount = this.initialCount;
      this.hasLiked = false;
      this.currentReaction = null;
      this.reactionCounts = {};
      if (this.targetId) {
        this.loadState();
      }
    }
  }

  loadState(): void {
    if (this.currentUserId) {
      this.likeService.getLikesByTarget(this.targetId, this.targetType).subscribe({
        next: (likes) => {
          this.syncCurrentReaction(likes);
        },
        error: () => {}
      });
    }

    this.likeService.getReactionSummary(this.targetId, this.targetType).subscribe({
      next: (summary) => {
        this.totalCount = summary.totalCount;
        this.reactionCounts = summary.counts || {};
      },
      error: () => {
        this.totalCount = this.initialCount;
      }
    });
  }

  getReactionCount(type: ReactionType): number {
    return this.reactionCounts[type] ?? 0;
  }

  get currentReactionEmoji(): string {
    return this.currentReaction ? REACTION_EMOJIS[this.currentReaction] : REACTION_EMOJIS.LIKE;
  }

  get currentReactionLabel(): string {
    return this.reactionOptions.find((reaction) => reaction.type === this.currentReaction)?.label ?? 'Like';
  }

  get visibleReactionSummary(): { type: ReactionType; label: string; emoji: string; count: number }[] {
    return this.reactionOptions
      .map((reaction) => ({ ...reaction, count: this.getReactionCount(reaction.type) }))
      .filter((reaction) => reaction.count > 0)
      .sort((left, right) => right.count - left.count);
  }

  get topReactionSummary(): { type: ReactionType; label: string; emoji: string; count: number }[] {
    return this.visibleReactionSummary.slice(0, 3);
  }

  isActiveReaction(type: ReactionType): boolean {
    return this.currentReaction === type;
  }

  onReactionClick(type: ReactionType): void {
    if (this.isActiveReaction(type)) {
      this.removeLike();
      return;
    }

    this.react(type);
    this.pickerOpen = false;
  }

  onPrimaryAction(): void {
    if (!this.currentUserId) {
      this.openGuestPrompt();
      return;
    }

    if (this.hasLiked) {
      this.removeLike();
      return;
    }

    this.react('LIKE');
  }

  togglePicker(): void {
    if (!this.currentUserId) {
      this.openGuestPrompt();
      return;
    }

    this.pickerOpen = !this.pickerOpen;
  }

  openPicker(): void {
    if (!this.currentUserId || this.loading) {
      return;
    }

    if (this.pickerCloseTimeoutId) {
      clearTimeout(this.pickerCloseTimeoutId);
      this.pickerCloseTimeoutId = null;
    }

    this.pickerOpen = true;
  }

  closePicker(): void {
    if (this.pickerCloseTimeoutId) {
      clearTimeout(this.pickerCloseTimeoutId);
      this.pickerCloseTimeoutId = null;
    }
    this.pickerOpen = false;
  }

  onPickerMouseLeave(): void {
    if (this.loading) {
      return;
    }

    if (this.pickerCloseTimeoutId) {
      clearTimeout(this.pickerCloseTimeoutId);
    }

    this.pickerCloseTimeoutId = setTimeout(() => {
      this.pickerOpen = false;
      this.pickerCloseTimeoutId = null;
    }, 180);
  }

  react(type: ReactionType): void {
    if (!this.currentUserId) {
      this.openGuestPrompt();
      return;
    }
    if (this.loading) return;
    this.loading = true;

    if (this.hasLiked) {
      this.likeService.changeReaction(this.currentUserId, this.targetId, this.targetType, type).subscribe({
        next: (res) => {
          this.currentReaction = res.reactionType;
          this.loading = false;
          this.loadState();
        },
        error: () => { this.loading = false; }
      });
    } else {
      this.likeService.like({ userId: this.currentUserId, targetId: this.targetId, targetType: this.targetType, reactionType: type }).subscribe({
        next: (res) => {
          this.hasLiked = true;
          this.currentReaction = res.reactionType;
          this.totalCount++;
          this.sendLikeNotification();
          this.loading = false;
          this.loadState();
        },
        error: () => { this.loading = false; }
      });
    }
  }

  removeLike(): void {
    if (!this.currentUserId) {
      this.openGuestPrompt();
      return;
    }
    if (this.loading || !this.hasLiked) return;
    this.loading = true;
    this.likeService.unlike(this.currentUserId, this.targetId, this.targetType).subscribe({
      next: () => {
        this.hasLiked = false;
        this.currentReaction = null;
        this.totalCount = Math.max(0, this.totalCount - 1);
        this.loading = false;
        this.loadState();
      },
      error: () => { this.loading = false; }
    });
  }

  private sendLikeNotification(): void {
    if (
      this.targetType !== 'POST' ||
      !this.recipientId ||
      !this.currentUserId ||
      this.recipientId === this.currentUserId
    ) {
      return;
    }

    this.notificationService.create({
      recipientId: this.recipientId,
      actorId: this.currentUserId,
      type: 'LIKE',
      message: `${this.actorName} liked your post`,
      targetId: this.targetId,
      targetType: this.targetType
    }).subscribe({ error: () => {} });
  }

  private openGuestPrompt(): void {
    this.showGuestPrompt = true;

    if (this.guestPromptTimeoutId) {
      clearTimeout(this.guestPromptTimeoutId);
    }

    this.guestPromptTimeoutId = setTimeout(() => {
      this.showGuestPrompt = false;
      this.guestPromptTimeoutId = null;
    }, 4500);
  }

  private syncCurrentReaction(likes: LikeResponse[]): void {
    const currentUserReaction = likes.find((like) => like.userId === this.currentUserId);
    this.hasLiked = !!currentUserReaction;
    this.currentReaction = currentUserReaction?.reactionType ?? null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.hostElement.nativeElement.contains(event.target as Node)) {
      this.closePicker();
    }
  }
}
