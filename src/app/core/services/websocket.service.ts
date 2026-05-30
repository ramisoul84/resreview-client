import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, EMPTY } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError } from 'rxjs/operators';
import { WsMessage, WsOp, OnlineUser } from '../models/ws';
import { environment } from '../../../environments/environment';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly WS_URL = `${environment.wsUrl}/ws`;

  private socket$: WebSocketSubject<WsMessage> | null = null;
  private gen = 0;
  private destroyed = false;
  private pendingQueue: WsMessage[] = [];
  private latestToken = '';
  private latestName = '';
  private latestColor = '';

  readonly status$ = new BehaviorSubject<WsStatus>('disconnected');
  readonly messages$ = new Subject<WsMessage>();
  readonly onlineUsers$ = new BehaviorSubject<OnlineUser[]>([]);

  connect(token: string, name?: string, color?: string): void {
    if (this.socket$) {
      this.socket$.complete();
    }

    this.destroyed = false;
    this.latestToken = token;
    if (name) this.latestName = name;
    if (color) this.latestColor = color;

    const myGen = ++this.gen;
    this.status$.next('connecting');

    let url = `${this.WS_URL}?token=${encodeURIComponent(token)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;
    if (color) url += `&color=${encodeURIComponent(color)}`;

    this.socket$ = webSocket<WsMessage>({
      url,
      openObserver: {
        next: () => {
          if (myGen !== this.gen) return;
          this.status$.next('connected');
          this.pendingQueue.forEach(msg => this.socket$?.next(msg));
          this.pendingQueue = [];
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

    this.socket$.pipe(
      catchError(err => {
        if (myGen !== this.gen) return EMPTY;
        console.error('[WS] Error:', err);
        this.status$.next('error');
        return EMPTY;
      })
    ).subscribe({
      next: (msg) => {
        if (myGen !== this.gen) return;
        if (msg.type === 'presence') this.onlineUsers$.next(msg.users ?? []);
        this.messages$.next(msg);
      },
      error: (err) => {
        if (myGen !== this.gen) return;
        console.error('[WS] Fatal error:', err);
        this.status$.next('error');
      }
    });
  }

  private scheduleReconnect(myGen: number): void {
    const delay = 1000;
    console.log(`[WS] Reconnecting in ${delay}ms`);
    setTimeout(() => {
      if (!this.destroyed && myGen === this.gen) {
        this.connect(this.latestToken, this.latestName, this.latestColor);
      }
    }, delay);
  }

  send(msg: WsMessage): void {
    if (this.status$.value === 'connected' && this.socket$) {
      this.socket$.next(msg);
    } else {
      // Queue for when connected
      this.pendingQueue.push(msg);
    }
  }

  sendOp(op: WsOp): void {
    this.send({ type: 'patch', op });
  }

  disconnect(): void {
    this.destroyed = true;
    this.socket$?.complete();
    this.socket$ = null;
    this.status$.next('disconnected');
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
