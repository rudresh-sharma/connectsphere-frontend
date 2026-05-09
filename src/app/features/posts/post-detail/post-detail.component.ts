import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { SearchService } from '../../search/search.service';
import { User } from '../../../shared/models/auth.models';
import { Post } from '../post.model';
import { PostCardComponent } from '../post-card/post-card.component';
import { PostService } from '../post.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.css'
})
export class PostDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly searchService = inject(SearchService);
  private readonly navigationHistoryService = inject(NavigationHistoryService);

  currentUser: User | null = null;
  post: Post | null = null;
  relatedPosts: Post[] = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.route.paramMap.subscribe((params) => {
      const postId = Number(params.get('id'));
      if (!Number.isFinite(postId) || postId <= 0) {
        this.errorMessage = 'Post not found.';
        this.post = null;
        this.relatedPosts = [];
        return;
      }

      this.loadPost(postId);
    });
  }

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  get backLabel(): string {
    return this.navigationHistoryService.isPreviousRouteSearch() ? 'Back to search' : 'Back to home';
  }

  goBack(): void {
    void this.navigationHistoryService.goBack('/dashboard');
  }

  private loadPost(postId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.postService.getPostById(postId)
      .pipe(
        switchMap((post) => {
          this.post = post;
          return this.loadRelatedPosts(post).pipe(map((relatedPosts) => ({ post, relatedPosts })));
        }),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: ({ relatedPosts }) => {
          this.relatedPosts = relatedPosts;
        },
        error: (error: Error) => {
          this.post = null;
          this.relatedPosts = [];
          this.errorMessage = error.message || 'Could not load post.';
        }
      });
  }

  private loadRelatedPosts(post: Post) {
    const postId = post.id ?? post.postId ?? 0;
    const hashtagKeywords = this.extractHashtags(post.content).slice(0, 2);
    const textKeywords = this.extractKeywords(post.content).slice(0, 2);
    const searchKeywords = [...hashtagKeywords, ...textKeywords].slice(0, 3);

    if (searchKeywords.length === 0) {
      return this.postService.getUserPosts(post.authorId).pipe(
        map((posts) => this.uniquePosts(posts, postId).slice(0, 4))
      );
    }

    return forkJoin(
      searchKeywords.map((keyword) =>
        this.searchService.searchPublicPosts(keyword).pipe(
          map((posts) => posts ?? []),
          catchError(() => of([]))
        )
      )
    ).pipe(
      map((groups) => groups.flat()),
      map((posts) => this.uniquePosts(posts, postId)),
      switchMap((posts) => {
        if (posts.length > 0) {
          return of(posts.slice(0, 4));
        }

        return this.postService.getUserPosts(post.authorId).pipe(
          map((authorPosts) => this.uniquePosts(authorPosts, postId).slice(0, 4)),
          catchError(() => of([]))
        );
      })
    );
  }

  private uniquePosts(posts: Post[], excludePostId: number): Post[] {
    const seen = new Set<number>();

    return posts.filter((post) => {
      const postId = post.id ?? post.postId ?? 0;
      if (!postId || postId === excludePostId || seen.has(postId)) {
        return false;
      }

      seen.add(postId);
      return true;
    });
  }

  private extractHashtags(content: string): string[] {
    return Array.from(content.matchAll(/#([a-z0-9_]+)/gi), (match) => match[1].trim());
  }

  private extractKeywords(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/#[a-z0-9_]+/gi, ' ')
      .split(/[^a-z0-9]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4)
      .slice(0, 5);
  }
}
