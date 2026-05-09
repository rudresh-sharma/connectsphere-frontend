import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../notification.service';
import { Notification } from '../notification.model';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="notif-bell" (click)="toggleDropdown()" title="Notifications">
      <i class="bi bi-bell"></i>
      <span class="badge" *ngIf="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>
    <div class="notif-dropdown" *ngIf="showDropdown">
      <div class="notif-header">
        <h4>Notifications</h4>
        <button class="mark-all-btn" (click)="markAllRead($event)" *ngIf="unreadCount > 0">Mark all read</button>
      </div>
      <div class="notif-list" *ngIf="notifications.length > 0; else empty">
        <div *ngFor="let n of notifications" class="notif-item" [class.unread]="!n.read" (click)="markRead(n)">
          <span class="notif-icon">{{ getIcon(n.type) }}</span>
          <div class="notif-body">
            <p class="notif-message">{{ n.message }}</p>
            <small class="notif-time">{{ n.createdAt | date:'short' }}</small>
          </div>
        </div>
      </div>
      <ng-template #empty><p class="empty-msg">No notifications yet</p></ng-template>
    </div>
  `,
  styleUrls: ['./notification-bell.component.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private realtimeSubscription?: Subscription;

  unreadCount = 0;
  notifications: Notification[] = [];
  showDropdown = false;
  currentUserId = 0;

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUser()?.userId ?? 0;
    if (this.currentUserId) {
      this.loadUnreadCount();
      this.connectRealtime();
    }
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
  }

  loadUnreadCount(): void {
    this.notificationService.getUnreadCount(this.currentUserId).subscribe({
      next: (count) => this.unreadCount = count,
      error: () => {}
    });
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown && this.currentUserId) {
      this.notificationService.getByRecipient(this.currentUserId).subscribe({
        next: (list) => this.setNotifications(list),
        error: () => {}
      });
    }
  }

  markRead(n: Notification): void {
    if (!n.read) {
      this.notificationService.markAsRead(n.notificationId).subscribe({
        next: () => {
          this.notifications = this.notifications.map((notification) =>
            notification.notificationId === n.notificationId ? { ...notification, read: true } : notification
          );
          this.updateUnreadCountFromList();
        },
        error: () => {}
      });
    }
  }

  markAllRead(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.currentUserId) {
      return;
    }

    this.notifications = this.notifications.map((notification) => ({ ...notification, read: true }));
    this.unreadCount = 0;

    this.notificationService.markAllRead(this.currentUserId).subscribe({
      next: () => {
        this.notificationService.getByRecipient(this.currentUserId).subscribe({
          next: (list) => this.setNotifications(list),
          error: () => {}
        });
      },
      error: () => this.loadUnreadCount()
    });
  }

  private setNotifications(list: Notification[]): void {
    this.notifications = list;
    this.updateUnreadCountFromList();
  }

  private connectRealtime(): void {
    this.realtimeSubscription = this.notificationService.connectRealtime(this.currentUserId).subscribe({
      next: (notification) => {
        this.notifications = [
          notification,
          ...this.notifications.filter((item) => item.notificationId !== notification.notificationId)
        ];
        this.updateUnreadCountFromList();
      },
      error: () => {}
    });
  }

  private updateUnreadCountFromList(): void {
    this.unreadCount = this.notifications.filter((notification) => !notification.read).length;
  }

  getIcon(type: string): string {
    switch (type) {
      case 'LIKE': return '❤️';
      case 'COMMENT': return '💬';
      case 'REPLY': return '↩️';
      case 'FOLLOW': return '👤';
      case 'MENTION': return '🏷️';
      default: return '🔔';
    }
  }
}
