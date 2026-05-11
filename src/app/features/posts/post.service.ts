import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreatePostRequest,
  CreatePromotionOrderRequest,
  CreatePromotionOrderResponse,
  MediaUploadResponse,
  PageResponse,
  Post,
  PostVisibility,
  UpdateCounterRequest,
  UpdatePostRequest,
  VerifyPromotionPaymentRequest
} from './post.model';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.postApiUrl}/posts`;

  reportPost(id: number, reporterId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reports`, {
      reporterId,
      reason
    });
  }

  createPost(request: CreatePostRequest): Observable<Post> {
    return this.http.post<Post>(this.baseUrl, request);
  }

  getPublicPosts(viewerId?: number): Observable<Post[]> {
    const params = viewerId ? new HttpParams().set('viewerId', viewerId) : undefined;
    return this.http
      .get<PageResponse<Post> | Post[]>(this.baseUrl, { params })
      .pipe(map((response) => this.unwrapPage(response)));
  }

  uploadMedia(file: File): Observable<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MediaUploadResponse>(`${this.baseUrl}/media`, formData);
  }

  getPostById(id: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/${id}`);
  }

  updatePost(id: number, requesterId: number, request: UpdatePostRequest): Observable<Post> {
    const params = new HttpParams().set('requesterId', requesterId);
    return this.http.put<Post>(`${this.baseUrl}/${id}`, request, { params });
  }

  deletePost(id: number, requesterId: number): Observable<void> {
    const params = new HttpParams().set('requesterId', requesterId);
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { params });
  }

  getUserPosts(userId: number): Observable<Post[]> {
    return this.http
      .get<PageResponse<Post> | Post[]>(`${this.baseUrl}/user/${userId}`)
      .pipe(map((response) => this.unwrapPage(response)));
  }

  getUserFeed(userId: number): Observable<Post[]> {
    return this.http
      .get<PageResponse<Post> | Post[]>(`${this.baseUrl}/feed/${userId}`)
      .pipe(map((response) => this.unwrapPage(response)));
  }

  searchPosts(keyword: string): Observable<Post[]> {
    const params = new HttpParams().set('keyword', keyword);
    return this.http
      .get<PageResponse<Post> | Post[]>(`${this.baseUrl}/search`, { params })
      .pipe(map((response) => this.unwrapPage(response)));
  }

  filterByVisibility(visibility: PostVisibility): Observable<Post[]> {
    const params = new HttpParams().set('visibility', visibility);
    return this.http
      .get<PageResponse<Post> | Post[]>(`${this.baseUrl}/visibility`, { params })
      .pipe(map((response) => this.unwrapPage(response)));
  }

  countPosts(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/count`);
  }

  updateCounters(id: number, request: UpdateCounterRequest): Observable<Post> {
    return this.http.patch<Post>(`${this.baseUrl}/${id}/count`, request);
  }

  sharePost(id: number, requesterId: number): Observable<Post> {
    const params = new HttpParams().set('requesterId', requesterId);
    return this.http.post<Post>(`${this.baseUrl}/${id}/share`, {}, { params });
  }

  createPromotionOrder(id: number, request: CreatePromotionOrderRequest): Observable<CreatePromotionOrderResponse> {
    return this.http.post<CreatePromotionOrderResponse>(`${this.baseUrl}/${id}/promotion/order`, request);
  }

  verifyPromotionPayment(id: number, request: VerifyPromotionPaymentRequest): Observable<Post> {
    return this.http.post<Post>(`${this.baseUrl}/${id}/promotion/verify`, request);
  }

  addBookmark(id: number, userId: number): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    return this.http.post<void>(`${this.baseUrl}/${id}/bookmarks`, {}, { params });
  }

  removeBookmark(id: number, userId: number): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    return this.http.delete<void>(`${this.baseUrl}/${id}/bookmarks`, { params });
  }

  isBookmarked(id: number, userId: number): Observable<boolean> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<boolean>(`${this.baseUrl}/${id}/bookmarks/status`, { params });
  }

  getBookmarkedPosts(userId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/bookmarks/${userId}`);
  }

  private unwrapPage(response: PageResponse<Post> | Post[]): Post[] {
    return Array.isArray(response) ? response : response.content ?? [];
  }
}
