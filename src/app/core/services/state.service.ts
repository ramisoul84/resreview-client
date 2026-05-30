import { computed, inject, Injectable, signal } from "@angular/core";
import { AuthService } from "./auth.service";
import { Session } from "../models/session";
import { Product } from "../models/product";
import { SessionService } from "./session.service";
import { ProductService } from "./product.service";
import { VersionService } from "./version.service";
import { AnnotationService } from "./annotation.service";
import { WebSocketService } from "./websocket.service";
import { firstValueFrom } from "rxjs";
import { Version } from "../models/version";
import { Pin } from "../models/pin";
import { Annotation } from "../models/annotation";

export interface AppState {
    sessions: Session[];
    products: Product[];
    versions: Version[];
}

export type ViewMode = 'full' | 'session';

const ACTIVE_SESSION_KEY = 'reviewflow_active_session';
const ACTIVE_PRODUCT_KEY = 'reviewflow_active_product';
const ACTIVE_VERSION_KEY = 'reviewflow_active_version';

@Injectable({ providedIn: 'root' })
export class StateService {
    private authSvc = inject(AuthService);
    private sessionSvc = inject(SessionService);
    private productSvc = inject(ProductService);
    private versionSvc = inject(VersionService);
    private annotationSvc = inject(AnnotationService);
    private ws = inject(WebSocketService);

    // ── Core state signals ──
    readonly sessions = signal<Session[]>([]);
    readonly products = signal<Product[]>([]);
    readonly versions = signal<Version[]>([]);
    readonly annotations = signal<Annotation[]>([]);
    readonly pins = signal<Pin[]>([]);

    readonly tags = signal<string[]>([]);

    readonly activeProductId = signal<string | null>(localStorage.getItem(ACTIVE_PRODUCT_KEY));
    readonly curVerId = signal<string | null>(localStorage.getItem(ACTIVE_VERSION_KEY));
    readonly activeSessionId = signal<string | null>(localStorage.getItem(ACTIVE_SESSION_KEY));
    readonly focusSessId = signal<string | null>(null);
    readonly activePinId = signal<string | null>(null);

    readonly zoom = signal<number>(1);
    readonly panX = signal<number>(0);
    readonly panY = signal<number>(0);
    readonly tool = signal<string>('sel');
    readonly strokeW = signal<number>(2);
    readonly strokeStyle = signal<string>('solid');

    readonly currentProduct = computed(() => {
        const id = this.activeProductId();
        if (!id) return null;
        return (this.products() ?? []).find(p => p.id === id) ?? null;
    });

    readonly currentVersion = computed(() => {
        const id = this.curVerId();
        if (!id) return null;
        return (this.versions() ?? []).find(v => v.id === id) ?? null;
    });

    readonly activeSession = computed(() => {
        const id = this.activeSessionId();
        if (!id) return null;
        return (this.sessions() ?? []).find(s => s.id === id) ?? null;
    });

    constructor() {
        this.initSeedState();
        this.initWsSub();
    }

    private initWsSub(): void {
        this.ws.messages$.subscribe(msg => {
            if (msg.type !== 'patch' || !msg.op) return;
            const op = msg.op;
            const verId = this.curVerId();
            if (!verId) return;

            if (op.op === 'create_annotation') {
                const ann = op.annotation as Annotation;
                if (ann.versionId === verId) {
                    this.annotations.update(list => {
                        if (list.some(a => a.id === ann.id)) return list;
                        return [...list, ann];
                    });
                }
            }

            if (op.op === 'delete_annotation') {
                this.annotations.update(list =>
                    list.filter(a => a.id !== op.annotationId)
                );
            }
        });
    }

    private async initSeedState(): Promise<void> {
        const seed = await this.buildSeedState();

        this.sessions.set(seed.sessions);
        this.products.set(seed.products);
        this.versions.set(seed.versions);

        if (!this.activeSessionId() && seed.sessions.length > 0) {
            this.setActiveSession(seed.sessions[0].id);
        }

        if (!this.activeProductId() && seed.products.length > 0) {
            this.setActiveProduct(seed.products[0].id);
        }

        if (!this.curVerId() && seed.versions.length > 0) {
            const prodId = this.activeProductId();
            const first = prodId
                ? seed.versions.find(v => v.productId === prodId)
                : seed.versions[0];
            if (first) this.setActiveVersion(first.id);
        }
    }

    private async buildSeedState(): Promise<AppState> {
        try {
            const [sessions, products] = await Promise.all([
                firstValueFrom(this.sessionSvc.getSessions()),
                firstValueFrom(this.productSvc.getProducts())
            ]);

            let allVersions: Version[] = [];
            if (products?.length) {
                const results = await Promise.allSettled(
                    products.map(p => firstValueFrom(this.versionSvc.getVersions(p.id)))
                );
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value) {
                        allVersions.push(...r.value);
                    }
                }
            }

            return {
                sessions: sessions ?? [],
                products: products ?? [],
                versions: allVersions,
            };
        } catch (error) {
            console.error('Failed to load initial state:', error);
            return { sessions: [], products: [], versions: [] };
        }
    }

    setActiveSession(id: string): void {
        this.activeSessionId.set(id);
        localStorage.setItem(ACTIVE_SESSION_KEY, id);
    }

    setActiveProduct(id: string): void {
        this.activeProductId.set(id);
        localStorage.setItem(ACTIVE_PRODUCT_KEY, id);
        const curVer = this.curVerId();
        const versions = this.versions();
        if (!curVer || !versions.some(v => v.id === curVer && v.productId === id)) {
            const first = versions.find(v => v.productId === id);
            this.setActiveVersion(first?.id ?? null);
        }
    }

    setActiveVersion(id: string | null): void {
        this.curVerId.set(id);
        if (id) {
            localStorage.setItem(ACTIVE_VERSION_KEY, id);
            this.loadAnnotations(id);
        } else {
            localStorage.removeItem(ACTIVE_VERSION_KEY);
            this.annotations.set([]);
        }
    }

    getSession(id: string): Session | undefined {
        return (this.sessions() ?? []).find(s => s.id === id);
    }

    // ── Annotations ──

    async loadAnnotations(versionId: string): Promise<void> {
        const prodId = this.activeProductId();
        if (!prodId) return;
        try {
            const list = await firstValueFrom(this.annotationSvc.getAnnotations(prodId, versionId));
            this.annotations.set(list);
        } catch (err) {
            console.error('Failed to load annotations:', err);
        }
    }

    addAnnotation(ann: Annotation): void {
        this.annotations.update(list => [...list, ann]);
    }

    removeAnnotation(id: string): void {
        this.annotations.update(list => list.filter(a => a.id !== id));
    }

    // ── Session CRUD ──

    async createSession(name: string): Promise<Session> {
        const session = await firstValueFrom(this.sessionSvc.createSession(name));
        this.sessions.update(list => [...list, session]);
        this.setActiveSession(session.id);
        return session;
    }

    // ── Product CRUD ──

    async createProduct(name: string): Promise<Product> {
        const product = await firstValueFrom(this.productSvc.createProduct(name));
        this.products.update(list => [...list, product]);
        this.setActiveProduct(product.id);
        return product;
    }

    async updateProduct(productId: string, name: string): Promise<void> {
        await firstValueFrom(this.productSvc.updateProduct(productId, name));
        this.products.update(list =>
            list.map(p => p.id === productId ? { ...p, name } : p)
        );
    }

    async deleteProduct(productId: string): Promise<void> {
        await firstValueFrom(this.productSvc.deleteProduct(productId));
        this.products.update(list => list.filter(p => p.id !== productId));
        this.versions.update(list => list.filter(v => v.productId !== productId));
        if (this.activeProductId() === productId) {
            this.activeProductId.set(null);
            localStorage.removeItem(ACTIVE_PRODUCT_KEY);
        }
    }

    // ── Version CRUD ──

    async createVersion(productId: string, label: string, name: string): Promise<Version> {
        const version = await firstValueFrom(this.versionSvc.createVersion(productId, label, name));
        this.versions.update(list => [...list, version]);
        this.setActiveVersion(version.id);
        return version;
    }

    async updateVersion(productId: string, versionId: string, label: string, name: string): Promise<void> {
        await firstValueFrom(this.versionSvc.updateVersion(productId, versionId, label, name));
        this.versions.update(list =>
            list.map(v => v.id === versionId ? { ...v, label, name } : v)
        );
    }

    async deleteVersion(productId: string, versionId: string): Promise<void> {
        await firstValueFrom(this.versionSvc.deleteVersion(productId, versionId));
        this.versions.update(list => list.filter(v => v.id !== versionId));
        if (this.curVerId() === versionId) {
            this.curVerId.set(null);
            localStorage.removeItem(ACTIVE_VERSION_KEY);
        }
    }


    updateVersionUrl(versionId: string, url: string): void {
        this.versions.update(list =>
            list.map(v => v.id === versionId ? { ...v, url } : v)
        );
    }
}
