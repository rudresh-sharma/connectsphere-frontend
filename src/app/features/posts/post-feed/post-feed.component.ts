import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/auth.models';
import { PostCardComponent } from '../post-card/post-card.component';
import { PostCreateComponent, PostCreatePayload } from '../post-create/post-create.component';
import { Post, UpdatePostRequest } from '../post.model';
import { PostService } from '../post.service';
import { StoryBarComponent } from '../../stories/story-bar/story-bar.component';
import { NotificationBellComponent } from '../../notifications/notification-bell/notification-bell.component';

@Component({
  selector: 'app-post-feed',
  standalone: true,
  imports: [CommonModule, PostCreateComponent, PostCardComponent, StoryBarComponent, NotificationBellComponent],
  templateUrl: './post-feed.component.html',
  styleUrl: './post-feed.component.css'
})
export class PostFeedComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  currentUser: User | null = null;
  posts: Post[] = [];
  isLoading = false;
  isCreating = false;
  isCreateModalOpen = false;
  errorMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (this.authService.getToken()) {
      this.authService.syncCurrentUser().subscribe({
        next: (user) => {
          const previousUserId = this.currentUserId;
          this.currentUser = user;
          if (user.userId && user.userId !== previousUserId) {
            this.loadPublicPosts();
          }
        },
        error: () => {}
      });
    }

    this.loadPublicPosts();

    this.route.queryParamMap.subscribe((params) => {
      if (params.has('create')) {
        this.openCreateModal();
      }
    });
  }

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  get profileInitial(): string {
    return this.currentUser?.fullName?.charAt(0) || this.currentUser?.username?.charAt(0) || 'C';
  }

  openCreateModal(): void {
    if (!this.currentUserId) {
      void this.router.navigate(['/login']);
      return;
    }

    this.isCreateModalOpen = true;
    window.setTimeout(() => document.getElementById('postContent')?.focus(), 80);
  }

  closeCreateModal(): void {
    if (this.isCreating) {
      return;
    }

    this.isCreateModalOpen = false;
    this.clearCreateQueryParam();
  }

  loadPublicPosts(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.postService
      .getPublicPosts(this.currentUserId || undefined)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (posts) => {
          this.enrichPostsWithAuthors(this.excludeCurrentUserPosts(posts ?? []));
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Could not load posts.';
        }
      });
  }

  createPost(payload: PostCreatePayload): void {
    this.errorMessage = '';

    if (!this.currentUserId) {
      this.errorMessage = 'Your account session is not fully loaded yet. Please refresh profile or sign in again.';
      return;
    }

    this.isCreating = true;

    const request$ = payload.mediaFile
      ? this.postService.uploadMedia(payload.mediaFile).pipe(
          map((upload) => ({
            ...payload.request,
            mediaUrls: [...payload.request.mediaUrls, upload.url],
            postType: upload.resourceType === 'video' ? 'VIDEO' as const : payload.request.postType
          }))
        )
      : of(payload.request);

    request$
      .pipe(
        switchMap((request) => this.postService.createPost(request)),
        finalize(() => (this.isCreating = false))
      )
      .subscribe({
        next: () => {
          this.isCreateModalOpen = false;
          this.clearCreateQueryParam();
          this.loadPublicPosts();
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Could not upload media or create post.';
        }
      });
  }

  likePost(post: Post): void {
    const id = this.getPostId(post);

    if (!id) {
      return;
    }

    this.postService.updateCounters(id, { counterType: 'likes', delta: 1 }).subscribe({
      next: (updatedPost) => {
        this.replacePost(updatedPost, id);
      },
      error: (error: Error) => {
        this.errorMessage = error.message || 'Could not like post.';
      }
    });
  }

  updatePost(event: { post: Post; request: UpdatePostRequest }): void {
    const id = this.getPostId(event.post);

    if (!id) {
      return;
    }

    if (event.post.authorId !== this.currentUserId) {
      this.errorMessage = 'You can only edit your own posts.';
      return;
    }

    this.postService.updatePost(id, this.currentUserId, event.request).subscribe({
      next: (updatedPost) => {
        this.replacePost(updatedPost, id);
      },
      error: (error: Error) => {
        this.errorMessage = error.message || 'Could not update post.';
      }
    });
  }

  deletePost(post: Post): void {
    const id = this.getPostId(post);

    if (!id || !window.confirm('Delete this post?')) {
      return;
    }

    if (post.authorId !== this.currentUserId) {
      this.errorMessage = 'You can only delete your own posts.';
      return;
    }

    this.postService.deletePost(id, this.currentUserId).subscribe({
      next: () => {
        this.posts = this.posts.filter((item) => this.getPostId(item) !== id);
      },
      error: (error: Error) => {
        this.errorMessage = error.message || 'Could not delete post.';
      }
    });
  }

  private replacePost(updatedPost: Post, id: number): void {
    this.posts = this.posts.map((post) => (this.getPostId(post) === id ? updatedPost : post));
  }

  private getPostId(post: Post): number {
    return post.id ?? post.postId ?? 0;
  }

  private excludeCurrentUserPosts(posts: Post[]): Post[] {
    if (!this.currentUserId) {
      return posts;
    }

    return posts.filter((post) => post.authorId !== this.currentUserId);
  }

  private enrichPostsWithAuthors(posts: Post[]): void {
    if (!posts.length) {
      this.posts = [];
      return;
    }

    const authorRequests = posts.map((post) => {
      if (!this.needsAuthorProfile(post)) {
        return of(post);
      }

      return this.authService.getPublicUser(post.authorId).pipe(
        map((author) => ({
          ...post,
          authorUsername: post.authorUsername || author.username,
          authorFullName: post.authorFullName || author.fullName,
          authorProfilePicUrl: post.authorProfilePicUrl || author.profilePicUrl,
          author: {
            ...post.author,
            userId: author.userId,
            username: post.author?.username || author.username,
            fullName: post.author?.fullName || author.fullName,
            profilePicUrl: post.author?.profilePicUrl || author.profilePicUrl
          }
        })),
        catchError(() => of(post))
      );
    });

    forkJoin(authorRequests).subscribe((enrichedPosts) => {
      this.posts = enrichedPosts;
    });
  }

  private needsAuthorProfile(post: Post): boolean {
    return Boolean(
      post.authorId &&
      (!this.hasText(post.authorUsername) ||
        !this.hasText(post.authorFullName) ||
        !this.hasText(post.authorProfilePicUrl) ||
        !this.hasText(post.author?.username) ||
        !this.hasText(post.author?.fullName) ||
        !this.hasText(post.author?.profilePicUrl))
    );
  }

  private hasText(value: string | null | undefined): boolean {
    return Boolean(value && value.trim());
  }

  private clearCreateQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.has('create')) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
