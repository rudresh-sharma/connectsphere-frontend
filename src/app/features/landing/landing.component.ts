  import { CommonModule } from '@angular/common';
  import { Component, inject } from '@angular/core';
  import { RouterLink } from '@angular/router';
  import { AuthService } from '../../core/services/auth.service';

  @Component({
    selector: 'app-landing',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.css'
  })
  export class LandingComponent {
    private readonly authService = inject(AuthService);

    readonly platformPills = ['Live feed', 'Stories', 'Reels', 'Hashtags', 'Notifications'];

    readonly heroHighlights = [
      {
        title: 'Share instantly',
        description: 'Turn moments into posts, stories, and reels without losing the energy of the moment.'
      },
      {
        title: 'Find your people',
        description: 'Follow creators, friends, and communities that match your interests and your pace.'
      },
      {
        title: 'Stay in the loop',
        description: 'Reactions, mentions, and notifications keep every conversation moving in real time.'
      }
    ];

    readonly socialProof = [
      { value: '24/7', label: 'always-on social flow' },
      { value: '3x', label: 'more ways to publish fast' },
      { value: '<1m', label: 'from idea to post momentum' },
      { value: '1 hub', label: 'feed, reels, stories, and search' }
    ];

    readonly featureCards = [
      {
        icon: 'bi-person-check-fill',
        title: 'Identity',
        description: 'Secure sign-in, profile setup, and smoother onboarding for new communities.',
        accent: 'Trust-first access'
      },
      {
        icon: 'bi-chat-heart-fill',
        title: 'Engagement',
        description: 'Posts, replies, reactions, and conversations that feel active instead of cluttered.',
        accent: 'Built for interaction'
      },
      {
        icon: 'bi-compass-fill',
        title: 'Discovery',
        description: 'Stories, reels, search, and trends that keep people exploring what matters.',
        accent: 'Fresh content paths'
      }
    ];

    readonly experienceLanes = [
      {
        eyebrow: 'Publish',
        title: 'Create once, show up everywhere',
        description: 'Move from thought to post, story, or reel with a flow that feels lightweight and social.'
      },
      {
        eyebrow: 'Connect',
        title: 'Conversations stay warm',
        description: 'Replies, follows, and reactions make the platform feel inhabited, not just populated.'
      },
      {
        eyebrow: 'Return',
        title: 'Signals bring people back',
        description: 'Notifications and discovery loops give users a reason to keep checking in.'
      }
    ];

    readonly journeySteps = [
      {
        step: '01',
        title: 'Set up your identity',
        description: 'Create an account, shape your profile, and establish how you want to be seen.'
      },
      {
        step: '02',
        title: 'Start posting with momentum',
        description: 'Drop a quick update, publish a story, or share a reel while the idea is still fresh.'
      },
      {
        step: '03',
        title: 'Build your circle',
        description: 'Follow people, discover interests, and let recommendations widen the room around you.'
      },
      {
        step: '04',
        title: 'Keep the energy alive',
        description: 'Come back to notifications, mentions, and active discussions that are already in motion.'
      }
    ];

    get isAuthenticated(): boolean {
      return this.authService.isAuthenticated();
    }

    get primaryRoute(): '/dashboard' | '/admin' {
      return this.isAuthenticated ? this.authService.getHomeRoute() : '/dashboard';
    }

    get primaryLabel(): string {
      return this.isAuthenticated ? 'Open your feed' : 'Open guest mode';
    }

    get tertiaryRoute(): '/search' | '/register' {
      return this.isAuthenticated ? '/search' : '/register';
    }

    get tertiaryLabel(): string {
      return this.isAuthenticated ? 'Explore' : 'Create an account';
    }

    get ctaSecondaryRoute(): '/search' | '/register' {
      return this.isAuthenticated ? '/search' : '/register';
    }

    get ctaSecondaryLabel(): string {
      return this.isAuthenticated ? 'See what people are sharing' : 'Create your account';
    }
  }
