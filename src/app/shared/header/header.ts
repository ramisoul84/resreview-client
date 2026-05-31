import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from "@angular/router";
import { Subscription } from 'rxjs';
import { AuthService } from "../../core/services/auth.service";
import { UserService } from "../../core/services/user.service";
import { ToastService } from "../toast/toast.service";
import { COLORS } from '../../core/models/colors';
import { Product } from '../../core/models/product';
import { Version } from '../../core/models/version';
import { ModalService } from '../../core/services/modal.service';
import { StateService } from '../../core/services/state.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header implements OnDestroy {
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private state = inject(StateService);
  private ws = inject(WebSocketService);
  private subs: Subscription[] = [];

  readonly colors = COLORS;

  readonly sessDropOpen = signal(false);
  readonly prodDropOpen = signal(false);
  readonly user = this.auth.currentUser;
  readonly activeSession = this.state.activeSession;
  readonly mySessions = this.state.sessions;
  readonly currentProduct = this.state.currentProduct;
  readonly currentVersion = this.state.currentVersion;
  readonly activeVersionId = this.state.curVerId;
  readonly products = this.state.products;
  readonly isAdmin = this.auth.isAdmin;

  readonly userDropOpen = signal(false);
  readonly wsStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  readonly onlineUsers = this.ws.onlineUsers;

  readonly wsDotColor = computed(() => {
    const s = this.wsStatus();
    if (s === 'connected') return '#22c55e';
    if (s === 'connecting') return '#f59e0b';
    return '#ef4444';
  });

  readonly myId = computed(() => this.user()?.id ?? '');
  readonly otherUsers = computed(() => this.onlineUsers().filter(u => u.userId !== this.myId()));
  readonly showAvatars = computed(() => this.wsStatus() === 'connected');

  constructor() {
    const u = this.auth.currentUser();
    if (this.auth.token()) {
      this.ws.connect(u?.name, u?.color, this.state.curVerId() ?? undefined);
    }

    this.subs.push(this.ws.status$.subscribe(status => {
      if (status === 'connected') this.wsStatus.set('connected');
      else if (status === 'connecting') this.wsStatus.set('connecting');
      else this.wsStatus.set('disconnected');
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.ws.disconnect();
  }

  toggleUserDrop() { this.userDropOpen.update(v => !v); }

  toggleSessDrop() { this.sessDropOpen.update(v => !v); this.prodDropOpen.set(false); }
  toggleProdDrop() { this.prodDropOpen.update(v => !v); this.sessDropOpen.set(false); }

  setUserColor(color: string) {
    const user = this.auth.currentUser();
    if (!user) return;
    this.auth.updateUser({ color });
    this.userService.updateProfile(user.id, { name: user.name, color }).subscribe({
      error: () => this.toast.show('Failed to save color to server', 'error'),
    });
  }

  switchSession(id: string) {
    this.state.setActiveSession(id);
    this.sessDropOpen.set(false);
  }

  newSession() {
    this.sessDropOpen.set(false);
    this.modal.openNewSession();
  }

  switchProduct(id: string) {
    this.state.setActiveProduct(id);
    this.prodDropOpen.set(false);
  }

  pickVer(productId: string, verId: string) {
    this.state.setActiveProduct(productId);
    this.state.setActiveVersion(verId);
    this.prodDropOpen.set(false);
  }

  versFor(productId: string): Version[] {
    return this.state.versions().filter(v => v.productId === productId);
  }

  verDotColor(version: Version): string {
    const idx = this.state.versions().indexOf(version);
    return idx === 0 ? '#1a1a1a' : '#d1d5db';
  }

  addProduct() {
    this.prodDropOpen.set(false);
    this.modal.openAddProduct();
  }

  renameProduct(p: Product) {
    this.prodDropOpen.set(false);
    this.modal.open('rename', { entity: 'product', id: p.id, currentName: p.name });
  }

  deleteProduct(id: string) {
    this.prodDropOpen.set(false);
    this.modal.open('delete-confirm', {
      productId: id,
      title: 'Delete product?',
      message: 'This will permanently delete this product and all its versions.',
    });
  }

  addVersion(productId: string) {
    this.prodDropOpen.set(false);
    this.modal.openNewVersion(productId);
  }

  logout() {
    this.ws.disconnect();
    this.auth.logout();
  }
}
