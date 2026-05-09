import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Comment } from '../comment.model';
import { CommentService } from '../comment.service';
import { NotificationService } from '../../notifications/notification.service';
import { SearchService } from '../../search/search.service';
import { UserSearchResult } from '../../search/search.model';

@Component({
  selector: 'app-comment-section',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './comment-section.component.html',
  styleUrl: './comment-section.component.css'
})
export class CommentSectionComponent implements OnInit, OnChanges, OnDestroy {
  private static readonly mentionPattern = /(^|\s)@([a-zA-Z0-9._-]{3,40})/g;
  private readonly commentService = inject(CommentService);
  private readonly notificationService = inject(NotificationService);
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private mentionTimer: ReturnType<typeof setTimeout> | null = null;

  @Input({ required: true }) postId!: number;
  @Input({ required: true }) currentUserId = 0;
  @Input() currentUserName = 'Someone';
  @Input() postAuthorId: number | null = null;
  @Input() composerPosition: 'top' | 'bottom' = 'bottom';
  @Input() showCloseButton = false;
  @Output() commentCountChange = new EventEmitter<number>();
  @Output() closeRequested = new EventEmitter<void>();

  comments: Comment[] = [];
  repliesMap: Map<number, Comment[]> = new Map();
  expandedReplies: Set<number> = new Set();

  newCommentContent = '';
  replyContentMap: Map<number, string> = new Map();
  showReplyForm: Set<number> = new Set();

  editingCommentId: number | null = null;
  editContent = '';

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  likingSet: Set<number> = new Set();
  showEmojiPicker = false;
  mentionResults: UserSearchResult[] = [];
  activeMentionQuery = '';
  activeMentionStart = -1;
  activeMentionTarget: string | null = null;
  showMentionSuggestions = false;

  readonly emojiOptions = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😍', '😘', '😎', '🤩', '🥳', '😢', '😭',
    '😡', '😱', '🤔', '🙄', '😴', '🤯', '😤', '😮', '😋', '🤗',
    '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '🔥', '✨', '🎉',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '💯', '⭐', '⚡',
    '🌟', '🌈', '☀️', '🌙', '🌍', '🚀', '🏆', '🎯', '💡', '📌',
    '🍕', '🍔', '☕', '🎵', '🎮', '📷', '🚗', '🏎️', '💬', '✅'
  ];

  ngOnInit(): void {
    this.loadComments();
  }

  ngOnDestroy(): void {
    if (this.mentionTimer) {
      clearTimeout(this.mentionTimer);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['postId'] && !changes['postId'].firstChange) {
      this.loadComments();
    }
  }

  loadComments(): void {
    if (!this.postId) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.commentService
      .getCommentsByPost(this.postId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (comments) => {
          this.comments = comments ?? [];
          this.emitCommentCount();
        },
        error: (err: Error) => {
          this.comments = [];
          this.emitCommentCount();
          this.errorMessage = '';
        }
      });
  }

  addComment(): void {
    const content = this.newCommentContent.trim();
    if (!content || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.commentService
      .addComment({ postId: this.postId, authorId: this.currentUserId, content })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (comment) => {
          this.comments = [comment, ...this.comments];
          this.newCommentContent = '';
          this.emitCommentCount();
          this.notifyPostComment(comment);
          this.notifyMentions(comment);
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Could not add comment.';
        }
      });
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmojiToComment(emoji: string, textarea: HTMLTextAreaElement): void {
    const start = textarea.selectionStart ?? this.newCommentContent.length;
    const end = textarea.selectionEnd ?? this.newCommentContent.length;
    this.newCommentContent = `${this.newCommentContent.slice(0, start)}${emoji}${this.newCommentContent.slice(end)}`;
    window.setTimeout(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  toggleReplies(commentId: number): void {
    if (this.expandedReplies.has(commentId)) {
      this.expandedReplies.delete(commentId);
      return;
    }

    this.expandedReplies.add(commentId);

    if (!this.repliesMap.has(commentId)) {
      this.commentService.getReplies(commentId).subscribe({
        next: (replies) => {
          this.repliesMap.set(commentId, replies ?? []);
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Could not load replies.';
        }
      });
    }
  }

  toggleReplyForm(commentId: number): void {
    if (this.showReplyForm.has(commentId)) {
      this.showReplyForm.delete(commentId);
      this.clearMentionSuggestions();
    } else {
      this.showReplyForm.add(commentId);
      if (!this.replyContentMap.has(commentId)) {
        this.replyContentMap.set(commentId, '');
      }
    }
  }

  getReplyContent(commentId: number): string {
    return this.replyContentMap.get(commentId) ?? '';
  }

  setReplyContent(commentId: number, value: string): void {
    this.replyContentMap.set(commentId, value);
  }

  submitReply(parentCommentId: number): void {
    const content = (this.replyContentMap.get(parentCommentId) ?? '').trim();
    if (!content || this.isSubmitting) return;

    this.isSubmitting = true;
    this.commentService
      .addComment({
        postId: this.postId,
        authorId: this.currentUserId,
        parentCommentId,
        content
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (reply) => {
          const existing = this.repliesMap.get(parentCommentId) ?? [];
          this.repliesMap.set(parentCommentId, [...existing, reply]);
          this.expandedReplies.add(parentCommentId);
          this.replyContentMap.set(parentCommentId, '');
          this.showReplyForm.delete(parentCommentId);

          // Update reply count on the parent comment
          this.comments = this.comments.map((c) =>
            c.commentId === parentCommentId ? { ...c, replyCount: c.replyCount + 1 } : c
          );
          this.emitCommentCount();
          this.notifyReply(reply, parentCommentId);
          this.notifyMentions(reply);
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Could not post reply.';
        }
      });
  }

  startEdit(comment: Comment): void {
    this.editingCommentId = comment.commentId;
    this.editContent = comment.content;
  }

  cancelEdit(): void {
    this.editingCommentId = null;
    this.editContent = '';
  }

  saveEdit(comment: Comment): void {
    const content = this.editContent.trim();
    if (!content) return;

    this.commentService
      .updateComment(comment.commentId, this.currentUserId, { content })
      .subscribe({
        next: (updated) => {
          this.comments = this.comments.map((c) => (c.commentId === updated.commentId ? updated : c));
          // Also update in replies map if it's a reply
          if (comment.parentCommentId) {
            const replies = this.repliesMap.get(comment.parentCommentId);
            if (replies) {
              this.repliesMap.set(
                comment.parentCommentId,
                replies.map((r) => (r.commentId === updated.commentId ? updated : r))
              );
            }
          }
          this.editingCommentId = null;
          this.editContent = '';
        },
        error: (err: Error) => {
          this.errorMessage = err.message || 'Could not update comment.';
        }
      });
  }

  deleteComment(comment: Comment): void {
    if (!window.confirm('Delete this comment?')) return;

    this.commentService.deleteComment(comment.commentId, this.currentUserId).subscribe({
      next: () => {
        if (comment.parentCommentId) {
          // It's a reply — remove from replies map
          const replies = this.repliesMap.get(comment.parentCommentId);
          if (replies) {
            this.repliesMap.set(
              comment.parentCommentId,
              replies.filter((r) => r.commentId !== comment.commentId)
            );
          }
          // Decrement reply count on parent
          this.comments = this.comments.map((c) =>
            c.commentId === comment.parentCommentId ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c
          );
          this.emitCommentCount();
        } else {
          // It's a top-level comment — remove from list
          this.comments = this.comments.filter((c) => c.commentId !== comment.commentId);
          this.repliesMap.delete(comment.commentId);
          this.expandedReplies.delete(comment.commentId);
          this.emitCommentCount();
        }
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Could not delete comment.';
      }
    });
  }

  getAuthorInitials(comment: Comment): string {
    const name = comment.authorFullName || comment.authorUsername || '';
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  }

  getAuthorName(comment: Comment): string {
    return comment.authorFullName || comment.authorUsername || 'User';
  }

  getContentSegments(content: string): string[] {
    return content.split(/(@[a-zA-Z0-9._-]+)/g).filter((segment) => segment.length > 0);
  }

  isMentionSegment(segment: string): boolean {
    return /^@[a-zA-Z0-9._-]+$/.test(segment);
  }

  getTimeLabel(comment: Comment): string {
    if (!comment.createdAt) return 'Just now';
    return new Date(comment.createdAt).toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  canModify(comment: Comment): boolean {
    return Boolean(this.currentUserId && comment.authorId === this.currentUserId);
  }

  get canInteract(): boolean {
    return this.currentUserId > 0;
  }

  onMentionInput(textarea: HTMLTextAreaElement, target: string, content: string): void {
    const caretIndex = textarea.selectionStart ?? content.length;
    const prefix = content.slice(0, caretIndex);
    const mentionMatch = prefix.match(/(^|\s)@([a-zA-Z0-9._-]{1,40})$/);

    if (!mentionMatch) {
      this.clearMentionSuggestions();
      return;
    }

    this.activeMentionTarget = target;
    this.activeMentionQuery = mentionMatch[2].trim();
    this.activeMentionStart = caretIndex - this.activeMentionQuery.length - 1;

    if (!this.activeMentionQuery) {
      this.clearMentionSuggestions();
      return;
    }

    if (this.mentionTimer) {
      clearTimeout(this.mentionTimer);
    }

    this.mentionTimer = setTimeout(() => {
      this.searchService.searchUsers(this.activeMentionQuery).subscribe({
        next: (users) => {
          this.mentionResults = (users ?? []).slice(0, 5);
          this.showMentionSuggestions = this.mentionResults.length > 0;
        },
        error: () => {
          this.clearMentionSuggestions();
        }
      });
    }, 180);
  }

  insertMention(user: UserSearchResult, textarea: HTMLTextAreaElement): void {
    if (!this.activeMentionTarget) {
      return;
    }

    const content = this.getMentionContent(this.activeMentionTarget);
    const caretIndex = textarea.selectionStart ?? content.length;

    if (this.activeMentionStart < 0) {
      return;
    }

    const nextContent = `${content.slice(0, this.activeMentionStart)}@${user.username} ${content.slice(caretIndex)}`;
    this.setMentionContent(this.activeMentionTarget, nextContent);
    this.clearMentionSuggestions();

    const nextCaretIndex = this.activeMentionStart + user.username.length + 2;
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaretIndex, nextCaretIndex);
    });
  }

  hideMentionSuggestions(): void {
    window.setTimeout(() => this.clearMentionSuggestions(), 120);
  }

  trackMention(_index: number, user: UserSearchResult): number {
    return user.userId;
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

  likeComment(comment: Comment): void {
    if (!this.canInteract) return;
    if (this.likingSet.has(comment.commentId)) return;
    this.likingSet.add(comment.commentId);
    this.commentService.likeComment(comment.commentId).subscribe({
      next: () => {
        this.updateCommentLikes(comment, comment.likesCount + 1);
        this.likingSet.delete(comment.commentId);
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Could not like comment.';
        this.likingSet.delete(comment.commentId);
      }
    });
  }

  unlikeComment(comment: Comment): void {
    if (!this.canInteract) return;
    if (this.likingSet.has(comment.commentId) || comment.likesCount <= 0) return;
    this.likingSet.add(comment.commentId);
    this.commentService.unlikeComment(comment.commentId).subscribe({
      next: () => {
        this.updateCommentLikes(comment, comment.likesCount - 1);
        this.likingSet.delete(comment.commentId);
      },
      error: (err: Error) => {
        this.errorMessage = err.message || 'Could not unlike comment.';
        this.likingSet.delete(comment.commentId);
      }
    });
  }

  requestClose(): void {
    this.closeRequested.emit();
  }

  private getMentionContent(target: string): string {
    if (target === 'comment') {
      return this.newCommentContent;
    }

    if (target.startsWith('reply:')) {
      const commentId = Number(target.slice('reply:'.length));
      return this.replyContentMap.get(commentId) ?? '';
    }

    return '';
  }

  private setMentionContent(target: string, value: string): void {
    if (target === 'comment') {
      this.newCommentContent = value;
      return;
    }

    if (target.startsWith('reply:')) {
      const commentId = Number(target.slice('reply:'.length));
      this.replyContentMap.set(commentId, value);
    }
  }

  private clearMentionSuggestions(): void {
    this.mentionResults = [];
    this.activeMentionQuery = '';
    this.activeMentionStart = -1;
    this.activeMentionTarget = null;
    this.showMentionSuggestions = false;
  }

  private updateCommentLikes(comment: Comment, newCount: number): void {
    this.comments = this.comments.map((c) =>
      c.commentId === comment.commentId ? { ...c, likesCount: newCount } : c
    );
    // Also update in replies map if it's a reply
    if (comment.parentCommentId) {
      const replies = this.repliesMap.get(comment.parentCommentId);
      if (replies) {
        this.repliesMap.set(
          comment.parentCommentId,
          replies.map((r) => (r.commentId === comment.commentId ? { ...r, likesCount: newCount } : r))
        );
      }
    }
  }

  private notifyPostComment(comment: Comment): void {
    if (!this.postAuthorId || this.postAuthorId === this.currentUserId) {
      return;
    }

    this.notificationService.create({
      recipientId: this.postAuthorId,
      actorId: this.currentUserId,
      type: 'COMMENT',
      message: `${this.currentUserName} commented on your post`,
      targetId: comment.postId,
      targetType: 'POST'
    }).subscribe({ error: () => {} });
  }

  private emitCommentCount(): void {
    const replyCount = this.comments.reduce((total, comment) => total + (comment.replyCount ?? 0), 0);
    this.commentCountChange.emit(this.comments.length + replyCount);
  }

  private notifyReply(reply: Comment, parentCommentId: number): void {
    const parentComment = this.comments.find((comment) => comment.commentId === parentCommentId);
    const recipientId = parentComment?.authorId ?? null;

    if (!recipientId || recipientId === this.currentUserId) {
      return;
    }

    this.notificationService.create({
      recipientId,
      actorId: this.currentUserId,
      type: 'REPLY',
      message: `${this.currentUserName} replied to your comment`,
      targetId: reply.postId,
      targetType: 'COMMENT'
    }).subscribe({ error: () => {} });
  }

  private notifyMentions(comment: Comment): void {
    const usernames = this.extractMentionUsernames(comment.content);
    if (usernames.length === 0) {
      return;
    }

    const notifiedUserIds = new Set<number>();

    for (const username of usernames) {
      this.searchService.searchUsers(username).subscribe({
        next: (users) => {
          const matchedUser = users.find((user) => user.username?.toLowerCase() === username);
          if (!matchedUser?.userId || matchedUser.userId === this.currentUserId || notifiedUserIds.has(matchedUser.userId)) {
            return;
          }

          notifiedUserIds.add(matchedUser.userId);
          this.notificationService.create({
            recipientId: matchedUser.userId,
            actorId: this.currentUserId,
            type: 'MENTION',
            message: `${this.currentUserName} mentioned you in a comment`,
            targetId: comment.postId,
            targetType: comment.parentCommentId ? 'COMMENT' : 'POST'
          }).subscribe({ error: () => {} });
        },
        error: () => {}
      });
    }
  }

  private extractMentionUsernames(content: string): string[] {
    if (!content.trim()) {
      return [];
    }

    const usernames = new Set<string>();
    const matches = content.matchAll(CommentSectionComponent.mentionPattern);
    for (const match of matches) {
      const username = match[2]?.trim().toLowerCase();
      if (username) {
        usernames.add(username);
      }
    }

    return [...usernames];
  }
}
