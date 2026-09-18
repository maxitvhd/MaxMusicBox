import { invoke as coreInvoke } from '@tauri-apps/api/core';
import { listen as coreListen, emit as coreEmit } from '@tauri-apps/api/event';

type EventCallback = (event: { payload: any }) => void;

function detectTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

class TauriBridgeService {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public readonly isNative: boolean;

  constructor() {
    this.isNative = detectTauri();
  }

  /** Listen to Tauri IPC events (audio_levels, pix_pago, track_ended, ...) with browser fallback. */
  public async listen<T = any>(
    eventName: string,
    handler: (event: { payload: T }) => void
  ): Promise<() => void> {
    if (this.isNative) {
      try {
        const unlisten = await coreListen<T>(eventName, handler as any);
        return unlisten;
      } catch (err) {
        console.warn(`[tauri] event listen("${eventName}") falhou; usando bus local`, err);
      }
    }
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(handler as EventCallback);
    return () => {
      this.listeners.get(eventName)?.delete(handler as EventCallback);
    };
  }

  /** Emit an event to the Tauri backend and to local (browser) listeners. */
  public emit(eventName: string, payload: any): void {
    if (this.isNative) {
      coreEmit(eventName, payload).catch(() => {});
    }
    const set = this.listeners.get(eventName);
    if (set) {
      set.forEach((cb) => {
        try {
          cb({ payload });
        } catch (e) {
          console.error(`[tauri] erro no listener de ${eventName}`, e);
        }
      });
    }
  }

  /** Invoke a Tauri command. Returns null when unavailable (browser mode) or on failure. */
  public async invoke<T = any>(command: string, args: Record<string, any> = {}): Promise<T | null> {
    if (this.isNative) {
      try {
        return await coreInvoke<T>(command, args);
      } catch (err) {
        console.warn(`[tauri] invoke("${command}") falhou:`, err);
        return null;
      }
    }
    console.debug(`[tauri:simulado] ${command}`, args);
    return null;
  }

  /** Invoke that propagates errors (usado para Pix/Mercado Pago). */
  public async invokeStrict<T = any>(command: string, args: Record<string, any> = {}): Promise<T> {
    if (this.isNative) {
      return await coreInvoke<T>(command, args);
    }
    throw new Error('Disponível apenas no aplicativo nativo (Tauri).');
  }

  /** Envia mensagem de diagnóstico para o terminal do app nativo. */
  public log(msg: string): void {
    if (this.isNative) {
      coreInvoke('log_frontend', { msg }).catch(() => {});
    } else {
      console.warn(`[mmb] ${msg}`);
    }
  }
}

export const tauriBridge = new TauriBridgeService();
