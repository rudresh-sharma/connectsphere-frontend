export type NotificationType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'MENTION';

export interface Notification {
  notificationId: number;
  recipientId: number;
  actorId: number;
  type: NotificationType;
  message: string;
  targetId?: number;
  targetType?: string;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationRequest {
  recipientId: number;
  actorId: number;
  type: NotificationType;
  message?: string;
  targetId?: number;
  targetType?: string;
}

export interface BulkNotificationRequest {
  recipientIds: number[];
  message: string;
}
