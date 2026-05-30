import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type: 'error' | 'success' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toast = signal<Toast | null>(null);
  readonly toast = this._toast.asReadonly();

  show(message: string, type: Toast['type'] = 'error') {
    this._toast.set({ message, type });
    setTimeout(() => this._toast.set(null), 4000);
  }

  hide() {
    this._toast.set(null);
  }
}
