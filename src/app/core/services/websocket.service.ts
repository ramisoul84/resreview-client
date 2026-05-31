import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject, BehaviorSubject, EMPTY, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError } from 'rxjs/operators';
import { WsMessage, WsOp, OnlineUser } from '../models/ws';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const MAX_PENDING = 100;
const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;
const MAX_CONSECUTIVE_FAILURES = 10;

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly WS_URL = `${environment.wsUrl}/ws`;
  private auth = inject(AuthService);

  private socket$: WebSocketSubject<WsMessage> | null = null;
  private sub: Subscription | null = null;
  private gen = 0;
  private destroyed = false;
  private pendingQueue: WsMessage[] = [];
  private retryAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private latestName = '';
  private latestColor = '';

  readonly status$ = new BehaviorSubject<WsStatus>('disconnected');
  readonly messages$ = new Subject<WsMessage>();
  readonly onlineUsers = signal<OnlineUser[]>([]);

  private latestVersionId = '';

  connect(name?: string, color?: string, versionId?: string): void {
    this.teardownSocket();
    this.destroyed = false;
    this.retryAttempt = 0;
    if (name) this.latestName = name;
    if (color) this.latestColor = color;
    if (versionId) this.latestVersionId = versionId;

    const token = this.auth.token();
    if (!token) {
      this.status$.next('disconnected');
      return;
    }

    const myGen = ++this.gen;
    this.status$.next('connecting');

    let url = `${this.WS_URL}?token=${encodeURIComponent(token)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;
    if (color) url += `&color=${encodeURIComponent(color)}`;
    if (versionId) url += `&versionId=${encodeURIComponent(versionId)}`;

    this.socket$ = webSocket<WsMessage>({
      url,
      openObserver: {
        next: () => {
          if (myGen !== this.gen) return;
          this.retryAttempt = 0;
          this.status$.next('connected');
          this.flushQueue();
        }
      },
      closeObserver: {
        next: () => {
          if (this.destroyed || myGen !== this.gen) return;
          this.status$.next('disconnected');
          this.scheduleReconnect(myGen);
        }
      }
    });

    const messages$ = this.socket$.pipe(
      catchError(err => {
        if (myGen !== this.gen) return EMPTY;
        console.warn('[WS] Connection error:', err?.type || err?.message || err);
        return EMPTY;
      })
    );

    this.sub = messages$.subscribe({
      next: (msg) => {
        if (myGen !== this.gen) return;
        if (msg.type === 'presence') {
          this.onlineUsers.set(msg.users ?? []);
        }
        this.messages$.next(msg);
      },
      error: () => {
        if (myGen !== this.gen) return;
        this.status$.next('error');
        if (!this.destroyed) this.scheduleReconnect(myGen);
      }
    });
  }

  private flushQueue(): void {
    if (!this.socket$) return;
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift()!;
      try {
        this.socket$.next(msg);
      } catch {
        break;
      }
    }
  }

  private teardownSocket(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
  }

  private scheduleReconnect(myGen: number): void {
    this.retryAttempt++;
    if (this.retryAttempt > MAX_CONSECUTIVE_FAILURES) {
      console.warn('[WS] Too many failures, giving up');
      this.status$.next('disconnected');
      return;
    }

    const token = this.auth.token();
    if (!token) {
      this.status$.next('disconnected');
      return;
    }
    this.latestName = this.auth.currentUser()?.name ?? this.latestName;
    this.latestColor = this.auth.currentUser()?.color ?? this.latestColor;

    const delay = Math.min(INITIAL_RETRY_MS * Math.pow(2, this.retryAttempt - 1), MAX_RETRY_MS);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.retryAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed && myGen === this.gen) {
        this.connect(this.latestName, this.latestColor, this.latestVersionId);
      }
    }, delay);
  }

  send(msg: WsMessage): void {
    if (this.status$.value === 'connected' && this.socket$) {
      try {
        this.socket$.next(msg);
      } catch {
        this.queueOrDrop(msg);
      }
    } else if (!this.destroyed) {
      this.queueOrDrop(msg);
    }
  }

  private queueOrDrop(msg: WsMessage): void {
    if (this.pendingQueue.length < MAX_PENDING) {
      this.pendingQueue.push(msg);
    }
  }

  sendOp(op: WsOp): void {
    this.send({ type: 'patch', op });
  }

  setViewingVersion(versionId: string): void {
    this.latestVersionId = versionId;
    this.sendOp({ op: 'set_viewing_version', versionId });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardownSocket();
    this.pendingQueue = [];
    this.status$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
