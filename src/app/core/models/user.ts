export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  color: string;
  isAdmin: boolean;
  createdAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}