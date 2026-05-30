import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { UserService } from '../../core/services/user.service';


interface ServerUser {
  id: string;
  name: string;
  email: string;
  color: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}


@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private user = inject(UserService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  users: ServerUser[] = [];
  loading = false;
  updating = new Set<string>();

  ngOnInit() {
    this.loadUsers();
  }

  private done() {
    this.loading = false;
    this.cdr.detectChanges();
  }

  private loadUsers() {
    this.loading = true;

    this.user.getUsers().subscribe({
      next: (res: unknown) => {
        try {
          const data = res as ServerUser[];
          if (!Array.isArray(data)) {
            this.toast.show('Unexpected response format', 'error');
            return;
          }
          this.users = data.map(u => ({
            ...u,
            createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-',
            lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '-',
          }));
        } catch (e) {
          console.error('Admin: failed to parse users', e);
          this.toast.show('Failed to parse users', 'error');
        } finally {
          this.done();
        }
      },
      error: (e) => {
        console.error('Admin: failed to load users', e);
        this.done();
        this.toast.show('Failed to load users', 'error');
      },
    });
  }

  toggleRole(user: ServerUser) {
    const newRole = !user.isAdmin;
    this.updating.add(user.id);

    this.user.updateRole(user.id, newRole).subscribe({
      next: () => {
        user.isAdmin = newRole;
        this.updating.delete(user.id);
        this.toast.show(`${user.name} is now ${newRole ? 'admin' : 'user'}`, 'success');
      },
      error: () => {
        this.updating.delete(user.id);
        this.toast.show('Failed to update role', 'error');
      },
    });
  }
}
