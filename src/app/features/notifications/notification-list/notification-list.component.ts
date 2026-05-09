import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../notification.service';
import { Notification } from '../notification.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.css']
})
export class NotificationListComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);

  notifications: Notification[] = [];
  loading = true;
  currentUserId = 0;

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUser()?.userId ?? 0;
    if (this.currentUserId) this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading = true;
    this.notificationService.getByRecipient(this.currentUserId).subscribe({
      next: (list) => { this.notifications = list; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  markAsRead(n: Notification): void {
    if (!n.read) {
      this.notificationService.markAsRead(n.notificationId).subscribe({ next: () => n.read = true });
    }
  }

  markAllRead(): void {
    this.notificationService.markAllRead(this.currentUserId).subscribe({
      next: () => this.notifications.forEach(n => n.read = true)
    });
  }

  deleteNotification(id: number): void {
    this.notificationService.delete(id).subscribe({
      next: () => this.notifications = this.notifications.filter(n => n.notificationId !== id)
    });
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = { LIKE: '❤️', COMMENT: '💬', REPLY: '↩️', FOLLOW: '👤', MENTION: '🏷️' };
    return icons[type] || '🔔';
  }
}
