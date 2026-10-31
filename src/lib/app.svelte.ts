/* Estado global de la app y sincronización con la planilla (cola offline). */
import { ApiError, api, type Snapshot } from './api';
import { emptyConfig, emptyData } from './domain';
import { storage } from './storage';
import type { Config, Data, Form, Item, NewOp, Op, Settings, SyncState, Tab } from './types';
import { currentMonth, uid } from './utils';
import { newForm } from './forms';

class App {
  tab = $state<Tab>('registrar');
  month = $state(currentMonth());

  // Persistido en localStorage
  settings = $state<Settings>(storage.get('settings', { url: '', token: '' }));
  data = $state<Data>(storage.get('data', emptyData()));
  queue = $state<Op[]>(storage.get('queue', []));
  last = $state<{ acct: string }>(storage.get('last', { acct: '' })); // última cuenta usada
  checks = $state<Record<string, Record<string, boolean>>>(storage.get('checks', {})); // cargos marcados al cuadrar tarjetas

  // Solo en memoria
  syncing = $state(false);
  status = $state<SyncState>('ok');
  err = $state('');
  lastSync = $state(0);
  filter = $state({ acct: '', cat: '', q: '' }); // filtros de Movimientos
  card = $state({ name: '', p: 0 }); // tarjeta y período elegidos (p: 0 = abierto, 1 = último cerrado…)
  draft = $state<Form>(newForm(storage.get('last', { acct: '' }).acct)); // borrador de Registrar
  toastMessage = $state('');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Persiste cada parte del estado cuando cambia. Llamar una vez dentro de un `$effect.root`. */
  persist() {
    $effect(() => storage.set('settings', $state.snapshot(this.settings)));
    $effect(() => storage.set('data', $state.snapshot(this.data)));
    $effect(() => storage.set('queue', $state.snapshot(this.queue)));
    $effect(() => storage.set('last', $state.snapshot(this.last)));
    $effect(() => storage.set('checks', $state.snapshot(this.checks)));
  }

  /** Importa URL y token desde el hash (#u=…&t=…) para configurar un dispositivo nuevo con un enlace. */
  importHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const url = params.get('u');
    const token = params.get('t');
    if (!url || !token) return;
    this.settings = { url, token };
    history.replaceState(null, '', location.pathname + location.search);
    this.tab = 'registrar';
  }

  toast(message: string) {
    this.toastMessage = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastMessage = ''), 2800);
  }

  resetDraft() {
    this.draft = newForm(this.last.acct);
  }

  /** Agrega una operación a la cola e intenta sincronizar de inmediato. */
  enqueue(op: NewOp) {
    // Solo importa la última configuración: descarta las anteriores sin enviar.
    if (op.action === 'saveConfig') this.queue = this.queue.filter(o => o.action !== 'saveConfig');
    this.queue.push({ qid: uid(), ...op } as Op);
    void this.sync();
  }

  /** Guarda la configuración localmente y la encola para la planilla. */
  saveConfig(config: Config) {
    this.data.config = config;
    this.enqueue({ action: 'saveConfig', payload: { config } });
  }

  discardQueue() {
    this.queue = [];
  }

  clearLocal() {
    ['data', 'queue', 'checks', 'last'].forEach(k => storage.remove(k));
    location.reload();
  }

  /** Corrige un alta que aún está en la cola (no llegó a la planilla). */
  replacePendingItem(item: Item) {
    for (const op of this.queue) {
      if (op.action === 'add') op.payload.items = op.payload.items.map(it => (it.id === item.id ? item : it));
    }
  }

  /** Quita un alta que aún está en la cola; descarta la operación si queda vacía. */
  removePendingItem(id: string) {
    for (const op of this.queue) {
      if (op.action === 'add') op.payload.items = op.payload.items.filter(it => it.id !== id);
    }
    this.queue = this.queue.filter(op => op.action !== 'add' || op.payload.items.length > 0);
  }

  private applySnapshot(json: Snapshot) {
    // Si hay una config sin enviar, la local manda sobre la del servidor.
    const keepLocalConfig = this.queue.some(op => op.action === 'saveConfig');
    this.data = {
      rows: json.rows,
      types: json.types,
      accounts: json.accounts,
      loaded: true,
      config: keepLocalConfig ? this.data.config : { ...emptyConfig(), ...json.config }
    };
  }

  /** Envía la cola en orden y luego descarga una copia fresca de la planilla. */
  async sync() {
    if (this.syncing) return;
    if (!this.settings.url) return;

    this.syncing = true;
    try {
      while (this.queue.length) {
        const op = this.queue[0];
        try {
          const json = await api($state.snapshot(this.settings), op.action, $state.snapshot(op.payload));
          this.queue.shift();
          this.applySnapshot(json);
        } catch (e) {
          // Los errores "definitivos" descartan la operación; el resto (red, auth…) aborta y se reintenta luego.
          if (!(e instanceof ApiError) || (e.code !== 'conflict' && e.code !== 'bad_request')) throw e;
          this.queue.shift();
          this.toast(
            e.code === 'conflict'
              ? 'Un cambio no se aplicó: la fila ya había cambiado en la planilla.'
              : 'Un cambio fue rechazado: ' + e.message
          );
        }
      }
      this.applySnapshot(await api($state.snapshot(this.settings), 'bootstrap'));
      this.err = '';
      this.lastSync = Date.now();
      this.status = 'ok';
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError('internal', (e as Error).message);
      this.err = error.message;
      this.status = error.code === 'network' ? 'offline' : 'error';
      if (error.code === 'auth') {
        this.tab = 'ajustes';
        this.toast('Token inválido: revísalo en Ajustes.');
      }
    } finally {
      this.syncing = false;
    }
  }
}

export const app = new App();
