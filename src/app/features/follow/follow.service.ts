import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/auth.models';
import { FollowCounts, FollowPage, FollowRelationship, FollowStatus } from './follow.model';

@Injectable({
  providedIn: 'root'
})
export class FollowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.followApiUrl}/follows`;

  follow(followerId: number, followingId: number): Observable<FollowRelationship> {
    if (this.isSelfRelationship(followerId, followingId)) {
      return throwError(() => new Error('You cannot follow yourself.'));
    }

    return this.http
      .post<FollowRelationship>(`${this.baseUrl}/${followingId}`, { followerId })
      .pipe(catchError((error) => this.handleError(error)));
  }

  unfollow(followerId: number, followingId: number): Observable<void> {
    if (this.isSelfRelationship(followerId, followingId)) {
      return throwError(() => new Error('You cannot unfollow yourself.'));
    }

    const params = new HttpParams().set('followerId', followerId);
    return this.http
      .delete<void>(`${this.baseUrl}/${followingId}`, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  getFollowing(userId: number): Observable<FollowRelationship[]> {
    return this.http
      .get<FollowPage | FollowRelationship[]>(`${this.baseUrl}/following/${userId}`)
      .pipe(
        map((response) => this.unwrapFollowList(response)),
        catchError((error) => this.handleError(error))
      );
  }

  getFollowers(userId: number): Observable<FollowRelationship[]> {
    return this.http
      .get<FollowPage | FollowRelationship[]>(`${this.baseUrl}/followers/${userId}`)
      .pipe(
        map((response) => this.unwrapFollowList(response)),
        catchError((error) => this.handleError(error))
      );
  }

  getStatus(followerId: number, followingId: number): Observable<FollowStatus> {
    if (this.isSelfRelationship(followerId, followingId)) {
      return throwError(() => new Error('You cannot follow yourself.'));
    }

    const params = new HttpParams().set('followerId', followerId);
    return this.http
      .get<FollowStatus>(`${this.baseUrl}/status/${followingId}`, { params })
      .pipe(catchError((error) => this.handleError(error)));
  }

  getCounts(userId: number): Observable<FollowCounts> {
    return this.http
      .get<FollowCounts>(`${this.baseUrl}/counts/${userId}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  getFollowingIds(userId: number): Observable<number[]> {
    return this.http
      .get<number[]>(`${this.baseUrl}/following-ids/${userId}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const apiError = error.error as ApiError | string | null;
    let message = 'Follow service request failed. Please try again.';

    if (typeof apiError === 'string' && apiError.trim()) {
      message = apiError;
    } else if (apiError && typeof apiError === 'object') {
      message = apiError.message || apiError.error || apiError.details || message;
    } else if (error.message) {
      message = error.message;
    }

    return throwError(() => new Error(message));
  }

  private isSelfRelationship(followerId: number, followingId: number): boolean {
    return Boolean(followerId && followingId && followerId === followingId);
  }

  private unwrapFollowList(response: FollowPage | FollowRelationship[]): FollowRelationship[] {
    return Array.isArray(response) ? response : response.content ?? [];
  }
}
