import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError, Observable } from 'rxjs';
import { LoginPayload, LoginResponse, RegisterPayload, User } from '../models/user';
import { environment } from '../../../environments/environment';



@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'reviewflow_token';
  private readonly USER_KEY = 'reviewflow_user';

  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser() && !!this.token());
  readonly isAdmin = computed(() => !!this.currentUser()?.isAdmin && !!this.token());

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        this.token.set(token);
        this.currentUser.set(user);
      } catch {
        this.clearStorage();
      }
    }
  }

  login(req: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, req).pipe(
      tap(res => {
        const user: User = {
          id: res.id,
          name: res.name,
          email: res.email,
          color: res.color,
          isAdmin: res.is_admin,
          avatarInitials: (res.name || '').slice(0, 2).toUpperCase(),
        };
        this.setSession(res.access_token, user);
      }),
      catchError(err => throwError(() => err))
    );
  }

  register(req: RegisterPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/register`, req).pipe(
      catchError(err => throwError(() => err))
    );
  }

  refreshToken(): Observable<{ access_token: string }> {
    return this.http.post<{ access_token: string }>(`${this.API_URL}/refresh`, {});
  }

  logout(): void {
    this.http.post(`${this.API_URL}/logout`, {}).subscribe({
      error: () => {},
    });
    this.clearStorage();
    this.router.navigate(['/login']);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.token.set(token);
  }

  private setSession(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.currentUser.set(user);
  }

  updateUser(changes: Partial<User>): void {
    const current = this.currentUser();
    if (!current) return;
    const updated = { ...current, ...changes };
    this.currentUser.set(updated);
    localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
  }

  private clearStorage(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }
}
