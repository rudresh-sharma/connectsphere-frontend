import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/auth.models';
import { Comment, CreateCommentRequest, UpdateCommentRequest } from './comment.model';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.commentApiUrl}/comments`;

  addComment(request: CreateCommentRequest): Observable<Comment> {
    return this.http.post<Comment>(this.baseUrl, request).pipe(catchError((error) => this.handleError(error)));
  }

  getCommentsByPost(postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/post/${postId}`).pipe(catchError((error) => this.handleError(error)));
  }

  getCommentById(commentId: number): Observable<Comment> {
    return this.http.get<Comment>(`${this.baseUrl}/${commentId}`).pipe(catchError((error) => this.handleError(error)));
  }

  getReplies(commentId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/${commentId}/replies`).pipe(catchError((error) => this.handleError(error)));
  }

  updateComment(commentId: number, requesterId: number, request: UpdateCommentRequest): Observable<Comment> {
    const params = new HttpParams().set('requesterId', requesterId);
    return this.http
      .put<Comment>(`${this.baseUrl}/${commentId}`, request, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  deleteComment(commentId: number, requesterId: number): Observable<void> {
    const params = new HttpParams().set('requesterId', requesterId);
    return this.http
      .delete<void>(`${this.baseUrl}/${commentId}`, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  likeComment(commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${commentId}/like`, null).pipe(catchError((error) => this.handleError(error)));
  }

  unlikeComment(commentId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${commentId}/unlike`, null).pipe(catchError((error) => this.handleError(error)));
  }

  getCommentsByUser(userId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/user/${userId}`).pipe(catchError((error) => this.handleError(error)));
  }

  getCommentCount(postId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/post/${postId}/count`).pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: { error?: ApiError | string | null; message?: string; status?: number }): Observable<never> {
    const apiError = error.error;
    let message = 'Could not load comments. Please try again.';

    if (typeof apiError === 'string' && apiError.trim()) {
      message = apiError;
    } else if (apiError && typeof apiError === 'object') {
      message = apiError.message || apiError.error || apiError.details || message;
    }

    return throwError(() => new Error(message));
  }
}
