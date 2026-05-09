export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface User {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  bio?: string | null;
  profilePicUrl: string | null;
  role: string;
  provider: string;
  providerId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  userId: number;
  username: string;
  fullName: string;
  bio?: string | null;
  profilePicUrl: string | null;
  email?: string;
  role?: string;
  provider?: string;
  providerId?: string | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

export interface OAuthCompleteRequest {
  setupToken: string;
  username: string;
  bio?: string | null;
}

export interface UsernameAvailabilityResponse {
  username: string;
  available: boolean;
}

export interface UpdateProfileRequest {
  username?: string;
  fullName?: string;
  bio?: string | null;
  profilePicUrl?: string | null;
}

export interface ApiError {
  message?: string;
  error?: string;
  details?: string;
  status?: number;
  timestamp?: string;
  validationErrors?: Record<string, string | string[]>;
  errors?: Record<string, string | string[]>;
}
