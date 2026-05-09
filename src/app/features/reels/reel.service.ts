import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Reel } from './reel.model';

@Injectable({ providedIn: 'root' })
export class ReelService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.mediaApiUrl;

  createReel(authorId: number, file: File, caption?: string): Observable<Reel> {
    const formData = new FormData();
    formData.append('authorId', authorId.toString());
    formData.append('file', file);
    if (caption?.trim()) {
      formData.append('caption', caption.trim());
    }

    return this.http.post<Reel>(`${this.baseUrl}/reels`, formData).pipe(catchError(this.handleError));
  }

  getReels(): Observable<Reel[]> {
    return this.http.get<Reel[]>(`${this.baseUrl}/reels`).pipe(catchError(this.handleError));
  }

  viewReel(reelId: number, viewerId?: number): Observable<Reel> {
    const url = viewerId ? `${this.baseUrl}/reels/${reelId}/view?viewerId=${viewerId}` : `${this.baseUrl}/reels/${reelId}/view`;
    return this.http.post<Reel>(url, {}).pipe(catchError(this.handleError));
  }

  deleteReel(reelId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/reels/${reelId}`).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || 'Reel request failed.';
    return throwError(() => new Error(message));
  }
}
