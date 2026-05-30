import { Component, inject } from '@angular/core';
import { StateService } from '../../core/services/state.service';

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar {
  st = inject(StateService);

  setTool(tool: string): void {
    this.st.tool.set(tool);
  }
}
