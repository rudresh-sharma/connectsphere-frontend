import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SearchService } from '../../search/search.service';
import { UserSearchResult } from '../../search/search.model';
import { CreatePostRequest, PostType, PostVisibility } from '../post.model';

export interface PostCreatePayload {
  request: CreatePostRequest;
  mediaFile: File | null;
}

@Component({
  selector: 'app-post-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './post-create.component.html',
  styleUrl: './post-create.component.css'
})
export class PostCreateComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly searchService = inject(SearchService);
  private mentionTimer: ReturnType<typeof setTimeout> | null = null;

  @Input() currentUserId = 0;
  @Input() isSubmitting = false;
  @Output() postCreated = new EventEmitter<PostCreatePayload>();

  readonly postTypes: PostType[] = ['TEXT', 'IMAGE', 'VIDEO'];
  readonly visibilities: PostVisibility[] = ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'];

  readonly createForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(1000)]],
    postType: ['TEXT' as PostType, [Validators.required]],
    visibility: ['PUBLIC' as PostVisibility, [Validators.required]]
  });

  selectedFile: File | null = null;
  fileError = '';
  mentionResults: UserSearchResult[] = [];
  activeMentionQuery = '';
  activeMentionStart = -1;
  showMentionSuggestions = false;

  get content() {
    return this.createForm.controls.content;
  }

  ngOnDestroy(): void {
    if (this.mentionTimer) {
      clearTimeout(this.mentionTimer);
    }
  }

  onFileSelected(event: Event): void {
    this.fileError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedFile = null;
      return;
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      this.selectedFile = null;
      this.fileError = 'Only image and video files are supported.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
  }

  submit(): void {
    if (!this.currentUserId) {
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const formValue = this.createForm.getRawValue();
    this.postCreated.emit({
      mediaFile: this.selectedFile,
      request: {
        authorId: this.currentUserId,
        content: formValue.content.trim(),
        mediaUrls: [],
        postType: formValue.postType,
        visibility: formValue.visibility
      }
    });
    this.createForm.reset({
      content: '',
      postType: 'TEXT',
      visibility: 'PUBLIC'
    });
    this.selectedFile = null;
    this.clearMentionSuggestions();
  }

  onContentInput(textarea: HTMLTextAreaElement): void {
    const content = this.content.value ?? '';
    const caretIndex = textarea.selectionStart ?? content.length;
    const prefix = content.slice(0, caretIndex);
    const mentionMatch = prefix.match(/(^|\s)@([a-zA-Z0-9._-]{1,40})$/);

    if (!mentionMatch) {
      this.clearMentionSuggestions();
      return;
    }

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
    const content = this.content.value ?? '';
    const caretIndex = textarea.selectionStart ?? content.length;

    if (this.activeMentionStart < 0) {
      return;
    }

    const nextContent = `${content.slice(0, this.activeMentionStart)}@${user.username} ${content.slice(caretIndex)}`;
    this.createForm.patchValue({ content: nextContent });
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

  private clearMentionSuggestions(): void {
    this.mentionResults = [];
    this.activeMentionQuery = '';
    this.activeMentionStart = -1;
    this.showMentionSuggestions = false;
  }
}
