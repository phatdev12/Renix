/* localStorage (prefix "nix."), a tiny event bus and the user settings. */
import { ALL_UNITS } from './course';

const PFX = 'nix.';
export const Store = {
  get<T = any>(k: string, d?: unknown): T {
    try { const v = localStorage.getItem(PFX + k); return v == null ? (d as T) : JSON.parse(v); } catch (e) { return d as T; }
  },
  set(k: string, v: unknown) {
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
  },
  update<T = any>(k: string, fn: (v: T) => T, d?: T): T { const v = fn(Store.get(k, d)); Store.set(k, v); return v; },
  remove(k: string) { try { localStorage.removeItem(PFX + k); } catch (e) { /* ignore */ } },
  dump(): Record<string, string> {
    const out: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.indexOf(PFX) === 0) out[k] = localStorage.getItem(k)!;
      }
    } catch (e) { /* ignore */ }
    return out;
  },
};

type Handler = (data: any) => void;
export const Bus = {
  h: {} as Record<string, Handler[]>,
  on(ev: string, fn: Handler) {
    (this.h[ev] = this.h[ev] || []).push(fn);
    return () => { this.h[ev] = this.h[ev].filter((f) => f !== fn); };
  },
  emit(ev: string, data?: unknown) {
    (this.h[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } });
  },
};

export interface SettingsShape {
  units: number[];
  furi: boolean;
  theme: 'dark' | 'light';
  rate: number;
  voice: string;
  examDate: string;
  realVoice: boolean;
  clipRate?: number;
  [k: string]: any;
}
const DEF: SettingsShape = { units: ALL_UNITS.slice(), furi: true, theme: 'dark', rate: 0.9, voice: '', examDate: '', realVoice: true };
export const Settings = {
  all(): SettingsShape { return Object.assign({}, DEF, Store.get('settings', {})); },
  get<K extends keyof SettingsShape>(k: K): SettingsShape[K] { return this.all()[k]; },
  set<K extends keyof SettingsShape>(k: K, v: SettingsShape[K]) {
    const s = this.all(); s[k] = v; Store.set('settings', s);
    Bus.emit('settings', { key: k, value: v });
  },
};
