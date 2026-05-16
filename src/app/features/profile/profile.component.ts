import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, of, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FollowButtonComponent } from '../follow/follow-button/follow-button.component';
import { FollowListComponent } from '../follow/follow-list/follow-list.component';
import { FollowCounts } from '../follow/follow.model';
import { FollowService } from '../follow/follow.service';
import { PublicUser, User } from '../../shared/models/auth.models';
import { Post, UpdatePostRequest } from '../posts/post.model';
import { PostCardComponent } from '../posts/post-card/post-card.component';
import { PostService } from '../posts/post.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FollowButtonComponent, FollowListComponent, PostCardComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly followService = inject(FollowService);
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  user: User | PublicUser | null = null;
  posts: Post[] = [];
  bookmarkedPosts: Post[] = [];
  followCounts: FollowCounts | null = null;
  selectedProfileTab: 'posts' | 'saved' | 'details' = 'posts';
  selectedFollowTab: 'followers' | 'following' = 'followers';
  isRefreshing = false;
  isSavingProfile = false;
  isUploadingPicture = false;
  isDeletingAccount = false;
  isEditingProfile = false;
  isLoadingFollowCounts = false;
  isCheckingUsername = false;
  isOwnProfile = true;
  showConnections = false;
  showSettings = false;
  selectedPostIndex: number | null = null;
  usernameAvailable: boolean | null = null;
  profileImageFailed = false;
  errorMessage = '';
  successMessage = '';
  private originalUsername = '';

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(40),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/)
      ]
    ],
    bio: ['', [Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.profileForm.controls.username.valueChanges
      .pipe(
        tap(() => {
          this.usernameAvailable = null;
        }),
        debounceTime(350),
        distinctUntilChanged(),
        filter(() => this.isOwnProfile),
        filter(() => this.profileForm.controls.username.valid),
        switchMap((username) => {
          const normalizedUsername = username.trim().toLowerCase();
          const currentUsername = this.originalUsername || this.user?.username?.trim().toLowerCase();

          if (normalizedUsername === currentUsername) {
            this.isCheckingUsername = false;
            this.usernameAvailable = true;
            return of(null);
          }

          this.isCheckingUsername = true;
          return this.authService
            .checkUsernameAvailability(normalizedUsername)
            .pipe(finalize(() => (this.isCheckingUsername = false)));
        })
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }

          const currentUsername = this.profileForm.controls.username.value.trim().toLowerCase();
          if (response.username !== currentUsername) {
            return;
          }

          this.usernameAvailable = response.available;
        },
        error: (error: Error) => {
          this.usernameAvailable = false;
          this.errorMessage = error.message;
        }
      });

    this.route.queryParamMap.subscribe((params) => {
      const requestedUserId = Number(params.get('userId'));
      const shouldOpenSettings = params.get('settings') === 'true';
      this.loadProfile(Number.isFinite(requestedUserId) && requestedUserId > 0 ? requestedUserId : null, shouldOpenSettings);
    });
  }

  get profileInitial(): string {
    return this.user?.fullName?.charAt(0) || this.user?.username?.charAt(0) || 'C';
  }

  get hasProfilePicture(): boolean {
    return Boolean(this.user?.profilePicUrl?.trim()) && !this.profileImageFailed;
  }

  get postCount(): number {
    return this.posts.length;
  }

  get visiblePosts(): Post[] {
    return this.selectedProfileTab === 'saved' ? this.bookmarkedPosts : this.posts;
  }

  get currentUserId(): number {
    return this.authService.getCurrentUser()?.userId ?? 0;
  }

  get currentUser(): User | null {
    return this.authService.getCurrentUser();
  }

  get profileUserId(): number {
    return this.user?.userId ?? 0;
  }

  get selectedPost(): Post | null {
    return this.selectedPostIndex === null ? null : this.visiblePosts[this.selectedPostIndex] ?? null;
  }

  getTextPostTileStyle(post: Post): Record<string, string> {
    const length = (post.content || '').trim().length;
    return length > 140
      ? { 'font-size': '0.82rem', '-webkit-line-clamp': '12' }
      : length > 90
        ? { 'font-size': '0.9rem', '-webkit-line-clamp': '10' }
        : { 'font-size': 'clamp(0.9rem, 1.55vw, 1.1rem)', '-webkit-line-clamp': '8' };
  }

  getTextPostMention(post: Post): string {
    return (post.content || '').trim().match(/^@\S+/)?.[0] ?? '';
  }

  getTextPostBody(post: Post): string {
    const content = (post.content || '').trim();
    const mention = this.getTextPostMention(post);
    return mention ? content.slice(mention.length).trim() : content;
  }

  get isViewingAnotherUser(): boolean {
    const currentUser = this.authService.getCurrentUser();
    const currentUsername = currentUser?.username?.trim().toLowerCase();
    const profileUsername = this.user?.username?.trim().toLowerCase();

    if (this.currentUserId && this.profileUserId && this.currentUserId === this.profileUserId) {
      return false;
    }

    if (currentUsername && profileUsername && currentUsername === profileUsername) {
      return false;
    }

    return Boolean(this.currentUserId && this.profileUserId);
  }

  private loadProfile(requestedUserId: number | null, shouldOpenSettings = false): void {
    const currentUser = this.authService.getCurrentUser();
    this.user = currentUser;
    this.errorMessage = '';
    this.successMessage = '';
    this.followCounts = null;
    this.posts = [];
    this.bookmarkedPosts = [];
    this.selectedProfileTab = 'posts';
    this.showConnections = false;
    this.showSettings = false;
    this.isOwnProfile = !requestedUserId || requestedUserId === currentUser?.userId;
    this.showSettings = this.isOwnProfile && shouldOpenSettings;

    if (this.isOwnProfile && !currentUser) {
      void this.router.navigate(['/login']);
      return;
    }

    if (this.isOwnProfile) {
      this.patchProfileForm();
      this.loadProfileData();
      if (this.authService.getToken()) {
        this.refreshProfile();
      }
      return;
    }

    const targetUserId = requestedUserId as number;
    this.isRefreshing = true;
    this.authService
      .getPublicUser(targetUserId)
      .pipe(finalize(() => (this.isRefreshing = false)))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.profileImageFailed = false;
          this.patchProfileForm();
          this.loadProfileData();
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
          if ((error as Error & { status?: number }).status === 401) {
            void this.router.navigate(['/login']);
          }
        }
      });
  }

  refreshProfile(): void {
    if (!this.isOwnProfile) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isRefreshing = true;

    this.authService
      .getProfile()
      .pipe(
        catchError((error: Error & { status?: number }) => {
          const fallbackUser = this.authService.getCurrentUser();
          if (fallbackUser?.userId && error.status && error.status >= 500) {
            return this.authService.getPublicUser(fallbackUser.userId).pipe(
              catchError(() => of(fallbackUser))
            );
          }

          return throwError(() => error);
        }),
        finalize(() => (this.isRefreshing = false))
      )
      .subscribe({
        next: (user) => {
          this.user = user;
          this.profileImageFailed = false;
          if (this.isOwnProfile) {
            this.authService.updateCurrentUserFromProfile(user);
          }
          this.patchProfileForm();
          this.loadProfileData();
          this.successMessage = 'Profile synced.';
        },
        error: (error: Error) => {
          if (this.user?.userId) {
            this.loadProfileData();
          }
          this.errorMessage = error.message;
        }
      });
  }

  loadFollowCounts(): void {
    if (!this.profileUserId) {
      return;
    }

    this.isLoadingFollowCounts = true;
    this.followService
      .getCounts(this.profileUserId)
      .pipe(finalize(() => (this.isLoadingFollowCounts = false)))
      .subscribe({
        next: (counts) => {
          this.followCounts = counts;
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

  loadPosts(): void {
    if (!this.profileUserId) {
      this.posts = [];
      return;
    }

    this.postService.getUserPosts(this.profileUserId).subscribe({
      next: (posts) => {
        this.posts = posts ?? [];
      },
      error: () => {
        this.posts = [];
      }
    });
  }

  loadBookmarkedPosts(): void {
    if (!this.currentUserId) {
      this.bookmarkedPosts = [];
      return;
    }

    this.postService.getBookmarkedPosts(this.currentUserId).subscribe({
      next: (posts) => {
        this.bookmarkedPosts = posts ?? [];
      },
      error: () => {
        this.bookmarkedPosts = [];
      }
    });
  }

  selectFollowTab(tab: 'followers' | 'following'): void {
    this.selectedFollowTab = tab;
    this.showConnections = true;
  }

  selectProfileTab(tab: 'posts' | 'saved' | 'details'): void {
    this.selectedProfileTab = tab;
    this.selectedPostIndex = null;
    if (tab === 'saved') {
      this.loadBookmarkedPosts();
    }
  }

  openPostViewer(index: number): void {
    if (index < 0 || index >= this.visiblePosts.length) {
      return;
    }

    this.selectedPostIndex = index;
  }

  closePostViewer(): void {
    this.selectedPostIndex = null;
  }

  showPreviousPost(): void {
    if (this.selectedPostIndex === null || this.selectedPostIndex <= 0) {
      return;
    }

    this.selectedPostIndex -= 1;
  }

  showNextPost(): void {
    if (this.selectedPostIndex === null || this.selectedPostIndex >= this.visiblePosts.length - 1) {
      return;
    }

    this.selectedPostIndex += 1;
  }

  onPostViewerWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaY) < 24) {
      return;
    }

    event.preventDefault();
    if (event.deltaY > 0) {
      this.showNextPost();
    } else {
      this.showPreviousPost();
    }
  }

  updateViewedPost(event: { post: Post; request: UpdatePostRequest }): void {
    const postId = event.post.id ?? event.post.postId ?? 0;
    if (!postId || event.post.authorId !== this.currentUserId) {
      return;
    }

    this.postService.updatePost(postId, this.currentUserId, event.request).subscribe({
      next: (updatedPost) => {
        this.posts = this.posts.map((post) => ((post.id ?? post.postId) === postId ? updatedPost : post));
        this.bookmarkedPosts = this.bookmarkedPosts.map((post) => ((post.id ?? post.postId) === postId ? updatedPost : post));
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
      }
    });
  }

  deleteViewedPost(post: Post): void {
    const postId = post.id ?? post.postId ?? 0;
    if (!postId || post.authorId !== this.currentUserId || !window.confirm('Delete this post?')) {
      return;
    }

    this.postService.deletePost(postId, this.currentUserId).subscribe({
      next: () => {
        this.posts = this.posts.filter((item) => (item.id ?? item.postId) !== postId);
        this.bookmarkedPosts = this.bookmarkedPosts.filter((item) => (item.id ?? item.postId) !== postId);
        if (!this.visiblePosts.length) {
          this.closePostViewer();
          return;
        }
        if (this.selectedPostIndex !== null && this.selectedPostIndex >= this.visiblePosts.length) {
          this.selectedPostIndex = this.visiblePosts.length - 1;
        }
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
      }
    });
  }

  toggleEditProfile(): void {
    if (!this.isOwnProfile) {
      return;
    }

    this.isEditingProfile = !this.isEditingProfile;
    if (this.isEditingProfile) {
      this.errorMessage = '';
      this.successMessage = '';
      this.patchProfileForm();
      window.setTimeout(() => document.getElementById('profile-fullName')?.focus(), 0);
    }
  }

  closeConnections(): void {
    this.showConnections = false;
  }

  openSettings(): void {
    if (!this.isOwnProfile) {
      return;
    }

    this.showSettings = true;
  }

  closeSettings(): void {
    this.showSettings = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { settings: null },
      queryParamsHandling: 'merge'
    });
  }

  onFollowChanged(isFollowing: boolean): void {
    if (!this.followCounts) {
      this.loadFollowCounts();
      return;
    }

    this.followCounts = {
      ...this.followCounts,
      followersCount: Math.max(0, this.followCounts.followersCount + (isFollowing ? 1 : -1))
    };
  }

  uploadProfilePicture(event: Event): void {
    if (!this.isOwnProfile) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please choose an image file.';
      input.value = '';
      return;
    }

    this.isUploadingPicture = true;
    this.authService
      .uploadProfilePicture(file)
      .pipe(finalize(() => (this.isUploadingPicture = false)))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.profileImageFailed = false;
          this.authService.updateCurrentUserFromProfile(user);
          this.patchProfileForm();
          this.loadFollowCounts();
          this.successMessage = 'Profile picture updated.';
          input.value = '';
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
          input.value = '';
          if ((error as Error & { status?: number }).status === 401) {
            void this.router.navigate(['/login']);
          }
        }
      });
  }

  saveProfileDetails(): void {
    if (!this.isOwnProfile || this.isSavingProfile) {
      return;
    }

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const formValue = this.profileForm.getRawValue();
    const normalizedUsername = formValue.username.trim().toLowerCase();

    if (normalizedUsername === this.originalUsername) {
      this.usernameAvailable = true;
    }

    if (this.usernameAvailable !== true) {
      this.profileForm.controls.username.markAsTouched();
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isSavingProfile = true;

    this.authService
      .updateProfile({
        username: normalizedUsername,
        fullName: formValue.fullName.trim(),
        bio: formValue.bio.trim() || null
      })
      .pipe(finalize(() => (this.isSavingProfile = false)))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.authService.updateCurrentUserFromProfile(user);
          this.originalUsername = user.username.trim().toLowerCase();
          this.patchProfileForm();
          this.successMessage = 'Profile details updated.';
          this.isEditingProfile = false;
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
          if ((error as Error & { status?: number }).status === 401) {
            void this.router.navigate(['/login']);
          }
        }
      });
  }

  deleteAccount(): void {
    if (!this.isOwnProfile || this.isDeletingAccount) {
      return;
    }

    const confirmed = window.confirm(
      'Delete your account permanently? This will remove your profile, posts, follow data, and media, then sign you out.'
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isDeletingAccount = true;

    this.authService
      .deleteAccount()
      .pipe(finalize(() => (this.isDeletingAccount = false)))
      .subscribe({
        next: () => {
          this.authService.logout();
          void this.router.navigate(['/login']);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
          if ((error as Error & { status?: number }).status === 401) {
            void this.router.navigate(['/login']);
          }
        }
      });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  onProfileImageError(): void {
    this.profileImageFailed = true;
  }

  getPrimaryMedia(post: Post): string | null {
    return post.mediaUrls?.[0] ?? null;
  }

  isVideoPost(post: Post): boolean {
    const media = this.getPrimaryMedia(post);
    return post.postType === 'VIDEO' || (!!media && /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(media));
  }

  private loadProfileData(): void {
    this.loadFollowCounts();
    this.loadPosts();
    if (this.isOwnProfile) {
      this.loadBookmarkedPosts();
    }
  }

  private patchProfileForm(): void {
    this.originalUsername = this.user?.username?.trim().toLowerCase() ?? '';
    this.profileForm.reset({
      fullName: this.user?.fullName ?? '',
      username: this.user?.username ?? '',
      bio: this.user?.bio ?? ''
    }, { emitEvent: false });
    this.usernameAvailable = true;
    this.isCheckingUsername = false;
  }
}
