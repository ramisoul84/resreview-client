import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

const isRefreshing = new BehaviorSubject<boolean>(false);
const refreshedToken = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isRefreshReq = req.url.includes('/auth/refresh');

  req = req.clone({ withCredentials: true });

  if (isRefreshReq) {
    return next(req);
  }

  const token = auth.token();
  if (token) {
    req = attachToken(req, token);
  }

  const isAuthEndpoint = req.url.includes('/auth/');

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        return handle401(req, next, auth, router);
      }
      return throwError(() => error);
    })
  );
};

function attachToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing.value) {
    isRefreshing.next(true);
    refreshedToken.next(null);

    return auth.refreshToken().pipe(
      switchMap((res) => {
        isRefreshing.next(false);
        auth.setAccessToken(res.access_token);
        refreshedToken.next(res.access_token);
        return next(attachToken(req, res.access_token));
      }),
      catchError((err) => {
        isRefreshing.next(false);
        refreshedToken.next(null);
        auth.logout();
        router.navigate(['/login']);
        return throwError(() => err);
      })
    );
  }

  return refreshedToken.pipe(
    filter((t): t is string => t !== null),
    take(1),
    switchMap((token) => next(attachToken(req, token)))
  );
}
