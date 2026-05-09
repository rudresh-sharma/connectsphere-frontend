import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';
import { Post } from '../../posts/post.model';
import { SearchService } from '../search.service';
import { HashtagResponse, UserSearchResult } from '../search.model';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.css']
})
export class SearchPageComponent implements OnInit {
  private readonly searchService = inject(SearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigationHistoryService = inject(NavigationHistoryService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  activeTab: 'users' | 'posts' | 'hashtags' = 'users';
  query = '';
  userResults: UserSearchResult[] = [];
  postResults: Post[] = [];
  trendingHashtags: HashtagResponse[] = [];
  hashtagResults: HashtagResponse[] = [];
  searching = false;
  hasSearched = false;
  errorMessage = '';
  sectionErrors: string[] = [];

  ngOnInit(): void {
    this.loadTrending();

    this.route.queryParamMap.subscribe((params) => {
      const tag = params.get('tag')?.trim();
      const query = params.get('query')?.trim();

      if (tag) {
        this.query = `#${tag.replace(/^#/, '')}`;
        this.activeTab = 'posts';
        this.search();
        return;
      }

      if (!query) {
        return;
      }

      this.query = query;
      this.activeTab = query.startsWith('#') ? 'posts' : 'users';
      this.search();
    });
  }

  loadTrending(): void {
    this.searchService.getTrendingHashtags(10).subscribe({
      next: (tags) => this.trendingHashtags = tags,
      error: () => {}
    });
  }

  search(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }

    const keyword = this.query.trim();
    if (!keyword) {
      this.clearResults();
      return;
    }

    this.searching = true;
    this.hasSearched = true;
    this.errorMessage = '';
    this.sectionErrors = [];

    forkJoin({
      users: this.searchService.searchUsers(keyword).pipe(
        catchError((error) => {
          this.sectionErrors.push(`Users: ${error.message || 'request failed'}`);
          return of([]);
        })
      ),
      posts: this.searchService.searchPublicPosts(keyword).pipe(
        catchError((error) => {
          this.sectionErrors.push(`Posts: ${error.message || 'request failed'}`);
          return of([]);
        })
      ),
      hashtags: this.searchService.searchHashtags(keyword.replace(/^#/, '')).pipe(
        catchError((error) => {
          this.sectionErrors.push(`Hashtags: ${error.message || 'request failed'}`);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ users, posts, hashtags }) => {
        this.userResults = users ?? [];
        this.postResults = posts ?? [];
        this.hashtagResults = hashtags ?? [];
        this.searching = false;
        this.errorMessage = this.sectionErrors.length > 0
          ? `Some search sections failed: ${this.sectionErrors.join('; ')}`
          : '';
      },
      error: (error) => {
        this.searching = false;
        this.errorMessage = error.message || 'Search failed. Please try again.';
      }
    });
  }

  scheduleSearch(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => this.search(), 300);
  }

  searchHashtag(tag: string): void {
    this.query = `#${tag}`;
    this.activeTab = 'posts';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.search();
  }

  selectTab(tab: 'users' | 'posts' | 'hashtags'): void {
    this.activeTab = tab;
  }

  goBack(): void {
    void this.navigationHistoryService.goBack('/dashboard');
  }

  get hasAnyResults(): boolean {
    return this.userResults.length > 0 || this.postResults.length > 0 || this.hashtagResults.length > 0;
  }

  getPostId(post: Post): number {
    return post.id ?? post.postId ?? 0;
  }

  getPostAuthor(post: Post): string {
    return post.authorFullName || post.author?.fullName || post.authorUsername || post.author?.username || 'ConnectSphere user';
  }

  getPostUsername(post: Post): string {
    return post.authorUsername || post.author?.username || 'connectsphere';
  }

  getPostProfilePicUrl(post: Post): string | null {
    return post.authorProfilePicUrl || post.author?.profilePicUrl || null;
  }

  getPostCreatedLabel(post: Post): string {
    return post.createdAt
      ? new Date(post.createdAt).toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : 'Just now';
  }

  getPostInitials(post: Post): string {
    const source = this.getPostAuthor(post).trim();

    if (!source) {
      return 'CS';
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

  isVideo(url: string, post: Post): boolean {
    return /\.(mp4|webm|ogg)$/i.test(url) || post.postType === 'VIDEO';
  }

  private clearResults(): void {
    this.userResults = [];
    this.postResults = [];
    this.hashtagResults = [];
    this.hasSearched = false;
    this.errorMessage = '';
    this.sectionErrors = [];
  }
}
