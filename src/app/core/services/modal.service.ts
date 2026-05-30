import { Injectable, signal } from "@angular/core";

export type ModalType =
    | 'none'
    | 'new-session'
    | 'new-pin'
    | 'add-product'
    | 'rename'
    | 'new-version'
    | 'add-to-roadmap'
    | 'add-node'
    | 'delete-confirm';

export interface ModalState {
    type: ModalType;
    data?: any;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
    readonly state = signal<ModalState>({ type: 'none' });

    open(type: ModalType, data?: any): void {
        this.state.set({ type, data });
    }

    close(): void {
        this.state.set({ type: 'none' });
    }

    openNewSession(): void {
        this.open('new-session');
    }


    openAddProduct(): void {
        this.open('add-product');
    }


    openNewVersion(productId: string): void {
        this.open('new-version', { productId });
    }
}