import { CommonModule, Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { FollowListComponent } from '../follow-list/follow-list.component';

type FollowListMode = 'followers' | 'following';

@Component({
  selector: 'app-connections-page',
  standalone: true,
  imports: [CommonModule, FollowListComponent],
  templateUrl: './connections-page.component.html',
  styleUrl: './connections-page.component.css'
})
export class ConnectionsPageComponent {
  private readonly authService = inject(AuthService);
  private readonly location = inject(Location);

  activeTab: FollowListMode = 'followers';
  readonly currentUser = this.authService.getCurrentUser();

  get currentUserId(): number {
    return this.currentUser?.userId ?? 0;
  }

  selectTab(tab: FollowListMode): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.location.back();
  }
}
