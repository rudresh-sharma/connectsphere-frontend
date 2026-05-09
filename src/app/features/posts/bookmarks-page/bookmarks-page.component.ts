import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/auth.models';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../post.model';
import { PostService } from '../post.service';

@Component({
  selector: 'app-bookmarks-page',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  templateUrl: './bookmarks-page.component.html',
  styleUrl: './bookmarks-page.component.css'
})
export class BookmarksPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);

  currentUser: User | null = null;
  posts: Post[] = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadBookmarks();
  }

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  get profileInitial(): string {
    return this.currentUser?.fullName?.charAt(0) || this.currentUser?.username?.charAt(0) || 'C';
  }

  loadBookmarks(): void {
    if (!this.currentUserId) {
      this.posts = [];
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;
    this.postService.getBookmarkedPosts(this.currentUserId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (posts) => {
          this.posts = posts ?? [];
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'Could not load saved posts.';
        }
      });
  }
}
