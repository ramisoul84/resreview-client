import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../models/user';
import { environment } from '../../../environments/environment';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<User | null>(this.loadFromStorage());
  private _token = signal<string | null>(localStorage.getItem('rd_token'));

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isAdmin = computed(() => !!this._user()?.isAdmin);

  private loadFromStorage(): User | null {
    try {
      const raw = localStorage.getItem('rd_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  login(payload: LoginPayload) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload).pipe(
      tap(res => this.handleAuth(res)),
      catchError(err => throwError(() => err.error?.message || 'Login failed'))
    );
  }

  register(payload: RegisterPayload) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload).pipe(
      tap(res => this.handleAuth(res)),
      catchError(err => throwError(() => err.error?.message || 'Registration failed'))
    );
  }

  refreshToken() {
    const rt = localStorage.getItem('rd_refresh');
    if (!rt) return throwError(() => 'No refresh token');
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken: rt }).pipe(
      tap(res => this.handleAuth(res))
    );
  }

  logout() {
    localStorage.removeItem('rd_token');
    localStorage.removeItem('rd_refresh');
    localStorage.removeItem('rd_user');
    this._user.set(null);
    this._token.set(null);
    this.router.navigate(['/auth']);
  }

  promoteToAdmin(userId: string) {
    return this.http.patch(`${environment.apiUrl}/users/${userId}/admin`, {});
  }

  getUsers() {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  private handleAuth(res: AuthResponse) {
    localStorage.setItem('rd_token', res.token);
    localStorage.setItem('rd_refresh', res.refreshToken);
    localStorage.setItem('rd_user', JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
  }
}
