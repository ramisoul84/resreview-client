import { Component, effect, inject } from '@angular/core';
import { ModalService } from '../../core/services/modal.service';
import { ToastService } from '../../shared/toast/toast.service';
import { StateService } from '../../core/services/state.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modals-host',
  imports: [FormsModule],
  templateUrl: './modals-host.html',
  styleUrl: './modals-host.scss',
})
export class ModalsHost {
  modal = inject(ModalService);
  private toast = inject(ToastService);
  private state = inject(StateService);

  sessName = '';
  prodName = '';
  renameVal = '';
  verLbl = '';
  verName = '';
  selRmapCat = 'planned';
  nodeLabel = '';

  constructor() {
    effect(() => {
      const s = this.modal.state();
      if (s.type === 'rename') this.renameVal = s.data?.currentName ?? '';
      if (s.type === 'add-to-roadmap') this.selRmapCat = 'planned';
      if (s.type === 'add-node') this.nodeLabel = '';
      if (s.type === 'new-session') this.sessName = '';
      if (s.type === 'add-product') this.prodName = '';
      if (s.type === 'new-version') {
        this.verLbl = '';
        this.verName = '';
      }
    });
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('mover')) this.modal.close();
  }

  async confirmSession() {
    const nm = this.sessName.trim();
    if (!nm) { this.toast.show('Enter session name'); return; }
    try {
      await this.state.createSession(nm);
      this.modal.close();
      this.toast.show(`Session "${nm}" started`, 'success');
    } catch {
      this.toast.show('Failed to create session', 'error');
    }
  }

  async confirmAddProduct() {
    const nm = this.prodName.trim();
    if (!nm) { this.toast.show('Enter product name'); return; }
    try {
      await this.state.createProduct(nm);
      this.modal.close();
      this.toast.show('Product added', 'success');
    } catch {
      this.toast.show('Failed to add product', 'error');
    }
  }

  async confirmVersion() {
    const lbl = this.verLbl.trim(), nm = this.verName.trim();
    if (!lbl || !nm) { this.toast.show('Fill label and name'); return; }
    try {
      const { productId } = this.modal.state().data;
      await this.state.createVersion(productId, lbl, nm);
      this.modal.close();
      this.toast.show(`Version ${lbl} created`, 'success');
    } catch {
      this.toast.show('Failed to create version', 'error');
    }
  }

  async confirmRename() {
    const nm = this.renameVal.trim();
    if (!nm) { this.toast.show('Enter a name'); return; }
    const { entity, id } = this.modal.state().data;
    try {
      if (entity === 'product') {
        await this.state.updateProduct(id, nm);
      }
      this.modal.close();
      this.toast.show('Renamed successfully', 'success');
    } catch {
      this.toast.show('Failed to rename', 'error');
    }
  }

  async confirmDelete() {
    const { productId } = this.modal.state().data;
    try {
      await this.state.deleteProduct(productId);
      this.modal.close();
      this.toast.show('Product deleted', 'success');
    } catch {
      this.toast.show('Failed to delete product', 'error');
    }
  }
}
