export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  color: string;
  isAdmin: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id: string;
  name: string;
  email: string;
  color: string;
  is_admin: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}
