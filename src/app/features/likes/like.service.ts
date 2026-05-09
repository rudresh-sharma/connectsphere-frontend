import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LikeRequest, LikeResponse, ReactionSummary, ReactionType, TargetType } from './like.model';

@Injectable({ providedIn: 'root' })
export class LikeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.likeApiUrl}/likes`;

  like(request: LikeRequest): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(this.baseUrl, request).pipe(catchError(this.handleError));
  }

  unlike(userId: number, targetId: number, targetType: TargetType): Observable<void> {
    const params = new HttpParams()
      .set('userId', userId).set('targetId', targetId).set('targetType', targetType);
    return this.http.delete<void>(this.baseUrl, { params }).pipe(catchError(this.handleError));
  }

  hasLiked(userId: number, targetId: number, targetType: TargetType): Observable<boolean> {
    const params = new HttpParams()
      .set('userId', userId).set('targetId', targetId).set('targetType', targetType);
    return this.http.get<boolean>(`${this.baseUrl}/check`, { params }).pipe(catchError(this.handleError));
  }

  getLikesByTarget(targetId: number, targetType: TargetType): Observable<LikeResponse[]> {
    const params = new HttpParams().set('targetType', targetType);
    return this.http.get<LikeResponse[]>(`${this.baseUrl}/target/${targetId}`, { params }).pipe(catchError(this.handleError));
  }

  getLikesByUser(userId: number): Observable<LikeResponse[]> {
    return this.http.get<LikeResponse[]>(`${this.baseUrl}/user/${userId}`).pipe(catchError(this.handleError));
  }

  getLikeCount(targetId: number, targetType: TargetType): Observable<number> {
    const params = new HttpParams().set('targetType', targetType);
    return this.http.get<number>(`${this.baseUrl}/count/${targetId}`, { params }).pipe(catchError(this.handleError));
  }

  getReactionSummary(targetId: number, targetType: TargetType): Observable<ReactionSummary> {
    const params = new HttpParams().set('targetType', targetType);
    return this.http.get<ReactionSummary>(`${this.baseUrl}/summary/${targetId}`, { params }).pipe(catchError(this.handleError));
  }

  changeReaction(userId: number, targetId: number, targetType: TargetType, reactionType: ReactionType): Observable<LikeResponse> {
    const params = new HttpParams()
      .set('userId', userId).set('targetId', targetId).set('targetType', targetType);
    return this.http.put<LikeResponse>(this.baseUrl, { reactionType }, { params }).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Like service request failed.';
    if (error.error?.message) message = error.error.message;
    return throwError(() => new Error(message));
  }
}
