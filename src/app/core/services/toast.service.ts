import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timeout?: ReturnType<typeof setTimeout>;

  show(msg: string, duration = 2400): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.message.set(msg);
    this.timeout = setTimeout(() => this.message.set(null), duration);
  }
}
