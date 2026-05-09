import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification, CreateNotificationRequest, BulkNotificationRequest } from './notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.notificationApiUrl}/notifications`;

  create(request: CreateNotificationRequest): Observable<Notification> {
    return this.http.post<Notification>(this.baseUrl, request).pipe(catchError(this.handleError));
  }

  sendBulk(request: BulkNotificationRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/bulk`, request).pipe(catchError(this.handleError));
  }

  markAsRead(notificationId: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${notificationId}/read`, {}).pipe(catchError(this.handleError));
  }

  markAllRead(recipientId: number): Observable<void> {
    const params = new HttpParams().set('recipientId', recipientId);
    return this.http.patch<void>(`${this.baseUrl}/read-all`, {}, { params }).pipe(catchError(this.handleError));
  }

  getByRecipient(recipientId: number): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.baseUrl}/user/${recipientId}`).pipe(catchError(this.handleError));
  }

  getUnreadCount(recipientId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/user/${recipientId}/unread-count`).pipe(catchError(this.handleError));
  }

  connectRealtime(recipientId: number): Observable<Notification> {
    return new Observable<Notification>((subscriber) => {
      const socket = new WebSocket(`${environment.notificationWsUrl}?userId=${recipientId}`);

      socket.onmessage = (event) => {
        try {
          subscriber.next(JSON.parse(event.data) as Notification);
        } catch (error) {
          subscriber.error(error);
        }
      };

      socket.onerror = (event) => subscriber.error(event);
      socket.onclose = () => subscriber.complete();

      return () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    });
  }

  delete(notificationId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${notificationId}`).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Notification service request failed.';
    if (error.error?.message) message = error.error.message;
    return throwError(() => new Error(message));
  }
}
