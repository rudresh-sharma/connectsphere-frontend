import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MediaResponse, StoryResponse } from './story.model';

@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.mediaApiUrl;

  // ---- Media ----
  uploadMedia(uploaderId: number, file: File, linkedPostId?: number): Observable<MediaResponse> {
    const formData = new FormData();
    formData.append('uploaderId', uploaderId.toString());
    formData.append('file', file);
    if (linkedPostId) formData.append('linkedPostId', linkedPostId.toString());
    return this.http.post<MediaResponse>(`${this.baseUrl}/media/upload`, formData).pipe(catchError(this.handleError));
  }

  getMediaByPost(postId: number): Observable<MediaResponse[]> {
    return this.http.get<MediaResponse[]>(`${this.baseUrl}/media/post/${postId}`).pipe(catchError(this.handleError));
  }

  // ---- Stories ----
  createStory(authorId: number, file: File, caption?: string): Observable<StoryResponse> {
    const formData = new FormData();
    formData.append('authorId', authorId.toString());
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return this.http.post<StoryResponse>(`${this.baseUrl}/stories`, formData).pipe(catchError(this.handleError));
  }

  getActiveStories(viewerId?: number): Observable<StoryResponse[]> {
    const url = viewerId ? `${this.baseUrl}/stories?viewerId=${viewerId}` : `${this.baseUrl}/stories`;
    return this.http.get<StoryResponse[]>(url).pipe(catchError(this.handleError));
  }

  viewStory(storyId: number, viewerId?: number): Observable<StoryResponse> {
    const url = viewerId ? `${this.baseUrl}/stories/${storyId}/view?viewerId=${viewerId}` : `${this.baseUrl}/stories/${storyId}/view`;
    return this.http.post<StoryResponse>(url, {}).pipe(catchError(this.handleError));
  }

  deleteStory(storyId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/stories/${storyId}`).pipe(catchError(this.handleError));
  }

  getStoriesByUser(userId: number, viewerId?: number): Observable<StoryResponse[]> {
    const url = viewerId ? `${this.baseUrl}/stories/user/${userId}?viewerId=${viewerId}` : `${this.baseUrl}/stories/user/${userId}`;
    return this.http.get<StoryResponse[]>(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Media service request failed.';
    if (error.error?.message) message = error.error.message;
    return throwError(() => new Error(message));
  }
}
