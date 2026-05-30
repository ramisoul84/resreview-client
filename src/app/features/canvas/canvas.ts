import { Component, ElementRef, HostListener, inject, signal, ViewChild, effect } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ModalService } from '../../core/services/modal.service';
import { Pin } from '../../core/models/pin';
import { StateService } from '../../core/services/state.service';
import { VersionService } from '../../core/services/version.service';
import { AnnotationService } from '../../core/services/annotation.service';
import { Toolbar } from '../../shared/toolbar/toolbar';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Annotation } from '../../core/models/annotation';

interface DrawPoint { x: number; y: number; }

const SVG_TAG_MAP: Record<string, string> = {
  rect: 'rect',
  ellipse: 'ellipse',
  arrow: 'line',
  pencil: 'path',
  text: 'text',
  node: 'g',
  pin: 'g',
};

@Component({
  selector: 'app-canvas',
  imports: [FormsModule, Toolbar],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
})
export class Canvas {
  st = inject(StateService);
  private versionSvc = inject(VersionService);
  private annotationSvc = inject(AnnotationService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  @ViewChild('cwrap') cwrapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('cvp') cvpRef!: ElementRef<HTMLDivElement>;
  @ViewChild('annSvg') annSvgRef!: ElementRef<SVGElement>;
  @ViewChild('pinTitleIn') pinTitleInRef?: ElementRef<HTMLInputElement>;

  // ── Canvas transform ──
  readonly transform = () =>
    `translate(${this.st.panX()}px,${this.st.panY()}px) scale(${this.st.zoom()})`;
  readonly zoomPct = () => Math.round(this.st.zoom() * 100);

  // ── Drawing state ──
  private panning = false;
  private panStart = { x: 0, y: 0 };
  private drawStart: DrawPoint | null = null;
  private tempEl: SVGElement | null = null;
  private freePts: DrawPoint[] = [];
  private freePath: SVGElement | null = null;

  // ── Pin form ──
  readonly pendingPt = signal<DrawPoint | null>(null);
  readonly showInlineForm = signal(false);
  readonly inlineFormX = signal(0);
  readonly inlineFormY = signal(0);
  pinTitle = '';
  pinBody = '';
  pendingTags: string[] = [];

  // ── Context menu ──
  readonly ctxOpen = signal(false);
  readonly ctxPos = signal({ x: 0, y: 0 });
  private ctxCanvasPos: DrawPoint = { x: 0, y: 0 };

  // ── Computed ──
  readonly user = this.auth.currentUser;
  readonly verImageUrl = () => {
    return this.st.currentVersion()?.url || null;
  };
  readonly activeSession = () =>
    this.st.sessions().find(s => s.id === this.st.activeSessionId());

  private renderEffect = effect(() => {
    this.st.annotations();
    this.st.currentVersion();
    const svg = this.annSvgRef?.nativeElement;
    if (svg) this.renderAnnotations();
  });

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    setTimeout(() => this.fitScreen(), 100);
    setTimeout(() => this.renderAnnotations(), 200);
  }

  getSession(id: string) { return this.st.getSession(id); }

  shouldDim(p: Pin): boolean {
    const fid = this.st.focusSessId();
    if (!fid) return false;
    return p.sessId !== fid;
  }

  // ── Annotation Rendering ──

  private renderAnnotations(): void {
    const svg = this.annSvgRef?.nativeElement;
    if (!svg) return;
    const existing = svg.querySelectorAll('[data-ann-id]');
    existing.forEach(el => el.remove());

    for (const ann of this.st.annotations()) {
      const el = this.createSvgFromAnnotation(ann);
      if (el) svg.appendChild(el);
    }
  }

  private createSvgFromAnnotation(ann: Annotation): SVGElement | null {
    const svgNs = 'http://www.w3.org/2000/svg';
    let el: SVGElement;

    if (ann.type === 'pin') {
      const g = document.createElementNS(svgNs, 'g');
      g.setAttribute('data-ann-id', ann.id);
      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(ann.x));
      circle.setAttribute('cy', String(ann.y));
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', ann.color || '#3b82f6');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
      if (ann.title) {
        const txt = document.createElementNS(svgNs, 'text');
        txt.setAttribute('x', String(ann.x + 12));
        txt.setAttribute('y', String(ann.y + 4));
        txt.setAttribute('fill', '#333');
        txt.setAttribute('font-size', '11');
        txt.textContent = ann.title;
        g.appendChild(txt);
      }
      return g;
    }

    if (ann.type === 'node') {
      const g = document.createElementNS(svgNs, 'g');
      g.setAttribute('data-ann-id', ann.id);
      const rect = document.createElementNS(svgNs, 'rect');
      rect.setAttribute('x', String(ann.x));
      rect.setAttribute('y', String(ann.y));
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '60');
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', ann.color || '#f0f0f0');
      rect.setAttribute('stroke', '#999');
      rect.setAttribute('stroke-width', '1.5');
      g.appendChild(rect);
      if (ann.title) {
        const txt = document.createElementNS(svgNs, 'text');
        txt.setAttribute('x', String(ann.x + 10));
        txt.setAttribute('y', String(ann.y + 24));
        txt.setAttribute('fill', '#333');
        txt.setAttribute('font-size', '12');
        txt.textContent = ann.title;
        g.appendChild(txt);
      }
      return g;
    }

    let tag = SVG_TAG_MAP[ann.type];
    if (!tag) return null;

    el = document.createElementNS(svgNs, tag);
    el.setAttribute('data-ann-id', ann.id);

    if (ann.data) {
      try {
        const attrs = JSON.parse(ann.data);
        for (const [k, v] of Object.entries(attrs)) {
          el.setAttribute(k, String(v));
        }
      } catch { }
    }

    if (ann.color && !el.getAttribute('stroke')) {
      el.setAttribute('stroke', ann.color);
    }
    if (ann.strokeW && !el.getAttribute('stroke-width')) {
      el.setAttribute('stroke-width', String(ann.strokeW));
    }
    if (ann.strokeStyle === 'dashed' && !el.getAttribute('stroke-dasharray')) {
      el.setAttribute('stroke-dasharray', '8 4');
    }

    if (ann.type === 'arrow') {
      const defs = this.annSvgRef?.nativeElement.querySelector('#svg-defs-inner');
      if (defs && ann.color) {
        const mid = 'm' + ann.color.replace('#', '') + ann.id.slice(0, 4);
        if (!defs.querySelector('#' + mid)) {
          const m = document.createElementNS(svgNs, 'marker');
          m.setAttribute('id', mid);
          m.setAttribute('markerWidth', '10');
          m.setAttribute('markerHeight', '8');
          m.setAttribute('refX', '9');
          m.setAttribute('refY', '4');
          m.setAttribute('orient', 'auto');
          m.setAttribute('markerUnits', 'userSpaceOnUse');
          const p = document.createElementNS(svgNs, 'path');
          p.setAttribute('d', 'M0,0 L10,4 L0,8 Z');
          p.setAttribute('fill', ann.color);
          m.appendChild(p);
          defs.appendChild(m);
        }
        el.setAttribute('marker-end', `url(#${mid})`);
      }
    }

    return el;
  }

  // ── Canvas math ──
  cvPt(e: MouseEvent): DrawPoint {
    const r = this.cwrapRef.nativeElement.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this.st.panX()) / this.st.zoom(),
      y: (e.clientY - r.top - this.st.panY()) / this.st.zoom(),
    };
  }

  screenPt(canvasPt: DrawPoint) {
    return {
      x: canvasPt.x * this.st.zoom() + this.st.panX(),
      y: canvasPt.y * this.st.zoom() + this.st.panY(),
    };
  }

  // ── Events ──
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = this.cwrapRef.nativeElement.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    this.zoomAt(-e.deltaY * 0.001, cx, cy);
  }

  zoomAt(delta: number, cx: number, cy: number) {
    const prev = this.st.zoom();
    const nz = Math.min(Math.max(prev * (1 + delta), 0.1), 8);
    const r = nz / prev;
    this.st.zoom.set(nz);
    this.st.panX.set(cx - (cx - this.st.panX()) * r);
    this.st.panY.set(cy - (cy - this.st.panY()) * r);
  }

  zoomBy(delta: number) {
    const el = this.cwrapRef.nativeElement;
    this.zoomAt(delta, el.offsetWidth / 2, el.offsetHeight / 2);
  }

  fitScreen() {
    const el = this.cwrapRef.nativeElement;
    const w = el.offsetWidth, h = el.offsetHeight;
    const cw = 960 + 160, ch = 572 + 120;
    const z = Math.min(w / cw, h / ch, 2) * 0.9;
    this.st.zoom.set(z);
    this.st.panX.set((w - cw * z) / 2);
    this.st.panY.set((h - ch * z) / 2);
  }

  onDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const pt = this.cvPt(e);
    this.ctxOpen.set(false);

    const tool = this.st.tool();

    if (tool === 'pan') {
      this.panning = true;
      this.panStart = { x: e.clientX - this.st.panX(), y: e.clientY - this.st.panY() };
      return;
    }

    if (tool === 'cmnt') {
      if (!this.st.activeSessionId()) {
        this.toast.show('Start a session first — click your name ↑');
        return;
      }
      this.startPin(pt, e);
      return;
    }

    if (['rect', 'ellipse', 'arrow'].includes(tool)) {
      this.drawStart = pt;
      this.startDraw(pt);
      return;
    }

    if (tool === 'pencil') {
      this.freePts = [pt];
      this.freePath = this.svgEl('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      this.applyStroke(this.freePath!, this.user()!.color);
      this.annSvgRef.nativeElement.appendChild(this.freePath!);
      return;
    }

    if (tool === 'sel') {
      if ((e.target as HTMLElement).classList.contains('cwrap') ||
        (e.target as HTMLElement) === this.cvpRef?.nativeElement) {
        this.st.activePinId.set(null);
        this.st.focusSessId.set(null);
      }
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMove(e: MouseEvent) {
    if (this.panning) {
      this.st.panX.set(e.clientX - this.panStart.x);
      this.st.panY.set(e.clientY - this.panStart.y);
      return;
    }
    const pt = this.cvPt(e);
    if (this.drawStart && this.tempEl) this.updateDraw(pt);
    if (this.freePts.length && this.freePath) {
      this.freePts.push(pt);
      this.freePath.setAttribute('d', this.freePts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' '));
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onUp(e: MouseEvent) {
    if (this.panning) { this.panning = false; return; }
    if (this.drawStart && this.tempEl) { this.finishDraw(); return; }
    if (this.freePts.length && this.freePath) { this.finishFree(); return; }
  }

  // ── Drawing ──
  private startDraw(pt: DrawPoint) {
    const tool = this.st.tool();
    const svg = this.annSvgRef.nativeElement;
    if (tool === 'rect') {
      this.tempEl = this.svgEl('rect', { x: pt.x, y: pt.y, width: 1, height: 1, fill: 'none', rx: 3 });
    } else if (tool === 'ellipse') {
      this.tempEl = this.svgEl('ellipse', { cx: pt.x, cy: pt.y, rx: 1, ry: 1, fill: 'none' });
    } else if (tool === 'arrow') {
      this.ensureMarker(this.user()!.color);
      this.tempEl = this.svgEl('line', {
        x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
        'marker-end': `url(#m${this.user()!.color.replace('#', '')})`
      });
    }
    if (this.tempEl) {
      this.applyStroke(this.tempEl, this.user()!.color);
      svg.appendChild(this.tempEl);
    }
  }

  private updateDraw(pt: DrawPoint) {
    const el = this.tempEl!;
    const start = this.drawStart!;
    const tool = this.st.tool();
    if (tool === 'rect') {
      el.setAttribute('x', String(Math.min(start.x, pt.x)));
      el.setAttribute('y', String(Math.min(start.y, pt.y)));
      el.setAttribute('width', String(Math.abs(pt.x - start.x) || 1));
      el.setAttribute('height', String(Math.abs(pt.y - start.y) || 1));
    } else if (tool === 'ellipse') {
      el.setAttribute('cx', String((start.x + pt.x) / 2));
      el.setAttribute('cy', String((start.y + pt.y) / 2));
      el.setAttribute('rx', String(Math.abs(pt.x - start.x) / 2 || 1));
      el.setAttribute('ry', String(Math.abs(pt.y - start.y) / 2 || 1));
    } else if (tool === 'arrow') {
      el.setAttribute('x2', String(pt.x));
      el.setAttribute('y2', String(pt.y));
    }
  }

  private async finishDraw() {
    const el = this.tempEl!;
    const tool = this.st.tool();
    this.tempEl = null;
    this.drawStart = null;

    let tooSmall = false;
    if (tool === 'rect') {
      tooSmall = parseFloat(el.getAttribute('width') || '0') < 8 || parseFloat(el.getAttribute('height') || '0') < 8;
    } else if (tool === 'ellipse') {
      tooSmall = parseFloat(el.getAttribute('rx') || '0') < 4;
    } else if (tool === 'arrow') {
      const dx = Math.abs(parseFloat(el.getAttribute('x2')!) - parseFloat(el.getAttribute('x1')!));
      const dy = Math.abs(parseFloat(el.getAttribute('y2')!) - parseFloat(el.getAttribute('y1')!));
      tooSmall = dx < 5 && dy < 5;
    }

    if (tooSmall) { el.remove(); return; }
    await this.persistAnnotation(el, tool as any);
  }

  private async finishFree() {
    const el = this.freePath!;
    this.freePath = null;
    if (this.freePts.length < 3) { el.remove(); return; }
    await this.persistAnnotation(el, 'pencil');
    this.freePts = [];
  }

  private async persistAnnotation(el: SVGElement, type: string) {
    const user = this.auth.currentUser()!;
    const prodId = this.st.activeProductId();
    const verId = this.st.curVerId();
    if (!prodId || !verId) return;

    const attrs = this.getElAttrs(el);

    try {
      const ann = await firstValueFrom(this.annotationSvc.createAnnotation(prodId, verId, {
        type,
        data: JSON.stringify(attrs),
        sessionId: this.st.activeSessionId() ?? '',
        color: user.color,
        strokeW: this.st.strokeW(),
        strokeStyle: this.st.strokeStyle(),
        x: 0,
        y: 0,
      }));
      el.setAttribute('data-ann-id', ann.id);
      this.st.addAnnotation(ann);
    } catch {
      this.toast.show('Failed to save annotation');
    }
  }

  private getElAttrs(el: SVGElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  // ── SVG helpers ──
  svgEl(tag: string, attrs: Record<string, any> = {}): SVGElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElement;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  }

  applyStroke(el: SVGElement, color: string) {
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', String(this.st.strokeW()));
    if (this.st.strokeStyle() === 'dashed') el.setAttribute('stroke-dasharray', '8 4');
    else el.removeAttribute('stroke-dasharray');
  }

  ensureMarker(color: string) {
    const defs = this.annSvgRef.nativeElement.querySelector('#svg-defs-inner')!;
    const id = 'm' + color.replace('#', '');
    if (defs.querySelector('#' + id)) return;
    const m = this.svgEl('marker', { id, markerWidth: 10, markerHeight: 8, refX: 9, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' });
    const p = this.svgEl('path', { d: 'M0,0 L10,4 L0,8 Z', fill: color });
    m.appendChild(p);
    defs.appendChild(m);
  }

  // ── Pins ──
  startPin(pt: DrawPoint, e: MouseEvent) {
    this.pendingPt.set(pt);
    const screen = this.screenPt(pt);
    const wrap = this.cwrapRef.nativeElement.getBoundingClientRect();
    let fx = screen.x + 30, fy = screen.y - 10;
    if (fx + 240 > wrap.width - 8) fx = screen.x - 250;
    if (fy + 140 > wrap.height - 8) fy = wrap.height - 150;
    if (fy < 4) fy = 4;
    this.inlineFormX.set(fx);
    this.inlineFormY.set(fy);
    this.showInlineForm.set(true);
    this.pinTitle = '';
    this.pinBody = '';
    this.pendingTags = [];
    setTimeout(() => this.pinTitleInRef?.nativeElement?.focus(), 30);
  }

  toggleTag(t: string) {
    const i = this.pendingTags.indexOf(t);
    if (i >= 0) this.pendingTags.splice(i, 1);
    else this.pendingTags.push(t);
  }

  async confirmPin() {
    const title = this.pinTitle.trim();
    if (!title) { this.toast.show('Add a title'); return; }
    const pt = this.pendingPt();
    if (!pt) return;
    const prodId = this.st.activeProductId();
    const verId = this.st.curVerId();
    if (!prodId || !verId) return;

    try {
      const ann = await firstValueFrom(this.annotationSvc.createAnnotation(prodId, verId, {
        type: 'pin',
        x: pt.x,
        y: pt.y,
        title,
        text: this.pinBody.trim(),
        sessionId: this.st.activeSessionId() ?? '',
        color: this.user()?.color,
      }));
      this.st.addAnnotation(ann);
      this.toast.show('Comment added', 'success');
    } catch {
      this.toast.show('Failed to save comment');
    }
    this.cancelPin();
  }

  cancelPin() {
    this.pendingPt.set(null);
    this.showInlineForm.set(false);
  }

  activatePin(id: string, e: MouseEvent) {
    e.stopPropagation();
    this.st.activePinId.set(id);
  }

  // ── Context menu ──
  onCtx(e: MouseEvent) {
    e.preventDefault();
    this.ctxCanvasPos = this.cvPt(e);
    this.ctxPos.set({ x: e.offsetX, y: e.offsetY });
    this.ctxOpen.set(true);
  }

  ctxAddPin() {
    this.ctxOpen.set(false);
    if (!this.st.activeSessionId()) { this.toast.show('Start a session first'); return; }
    const e = new MouseEvent('click');
    this.startPin(this.ctxCanvasPos, e);
  }

  ctxAddNode() {
    this.ctxOpen.set(false);
    // this.modal.openAddNode(this.ctxCanvasPos.x, this.ctxCanvasPos.y);
  }

  private async uploadFile(file: File): Promise<void> {
    const verId = this.st.curVerId();
    const prodId = this.st.activeProductId();
    if (!verId || !prodId) return;

    try {
      const version = await firstValueFrom(this.versionSvc.uploadImage(prodId, verId, file));
      this.st.updateVersionUrl(verId, version.url);
      this.toast.show('Image uploaded', 'success');
    } catch {
      this.toast.show('Failed to upload image');
    }
  }

  ctxPasteImg() {
    this.ctxOpen.set(false);
    navigator.clipboard.read().then(items => {
      for (const item of items) {
        const t = item.types.find(x => x.startsWith('image/'));
        if (t) {
          item.getType(t).then(blob => {
            const file = new File([blob], 'clipboard.png', { type: blob.type });
            this.uploadFile(file);
          });
          return;
        }
      }
      this.toast.show('No image in clipboard');
    }).catch(() => this.toast.show('Clipboard access denied'));
  }

  onWrapClick(e: MouseEvent) {
    this.ctxOpen.set(false);
  }

  loadImage(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadFile(file);
    input.value = '';
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).matches('input,textarea,[contenteditable]')) return;
    if (e.key === 'f' || e.key === 'F') this.fitScreen();
    if (e.key === 'Escape') this.cancelPin();
  }

  @HostListener('document:paste', ['$event'])
  onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items ?? [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile()!;
        const file = new File([blob], 'clipboard.png', { type: blob.type });
        this.uploadFile(file);
        return;
      }
    }
  }
}
