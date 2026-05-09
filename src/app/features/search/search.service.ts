import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse, Post } from '../posts/post.model';
import { HashtagResponse, IndexPostRequest, PostSearchResult, UserSearchResult } from './search.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.searchApiUrl;
  private readonly authBaseUrl = `${environment.authApiUrl}/auth`;
  private readonly postBaseUrl = `${environment.postApiUrl}/posts`;

  indexPost(request: IndexPostRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/search/index`, request).pipe(catchError(this.handleError));
  }

  searchPosts(keyword: string): Observable<PostSearchResult[]> {
    const params = new HttpParams().set('q', keyword);
    return this.http.get<PostSearchResult[]>(`${this.baseUrl}/search/posts`, { params }).pipe(catchError(this.handleError));
  }

  searchUsers(keyword: string): Observable<UserSearchResult[]> {
    const params = new HttpParams().set('query', keyword);
    return this.http.get<UserSearchResult[]>(`${this.authBaseUrl}/search`, { params }).pipe(catchError(this.handleError));
  }

  searchPublicPosts(keyword: string): Observable<Post[]> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http
      .get<PageResponse<Post> | Post[]>(`${this.postBaseUrl}/search`, { params })
      .pipe(
        map((response) => Array.isArray(response) ? response : response.content ?? []),
        catchError(this.handleError)
      );
  }

  getTrendingHashtags(limit: number = 10): Observable<HashtagResponse[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<HashtagResponse[]>(`${this.baseUrl}/hashtags/trending`, { params }).pipe(catchError(this.handleError));
  }

  getPostsByHashtag(tag: string): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/hashtags/${tag}/posts`).pipe(catchError(this.handleError));
  }

  searchHashtags(keyword: string): Observable<HashtagResponse[]> {
    const params = new HttpParams().set('q', keyword);
    return this.http.get<HashtagResponse[]>(`${this.baseUrl}/hashtags/search`, { params }).pipe(catchError(this.handleError));
  }

  getHashtagsForPost(postId: number): Observable<HashtagResponse[]> {
    return this.http.get<HashtagResponse[]>(`${this.baseUrl}/hashtags/post/${postId}`).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Search service request failed.';
    if (typeof error.error === 'string' && error.error.trim()) {
      message = error.error;
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (error.error?.error) {
      message = error.error.error;
    } else if (error.message) {
      message = error.message;
    }
    return throwError(() => new Error(message));
  }
}
