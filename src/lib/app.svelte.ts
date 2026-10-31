import { ApiError, callApi, type Snapshot } from './api';
import { emptyConfig, emptySheetData } from './domain';
import { emptyDraft } from './forms';
import { storage } from './storage';
import type {
  Config,
  ConnectionSettings,
  MovementFilter,
  OperationInput,
  QueuedOperation,
  SelectedCard,
  SheetData,
  SyncStatus,
  Tab,
  TransactionDraft,
  TransactionItem
} from './types';
import { currentMonthKey, generateId } from './utils';

const TOAST_DURATION_MS = 2800;

const isSaveConfig = (operation: QueuedOperation) => operation.action === 'saveConfig';

const isAdditionWithoutItems = (operation: QueuedOperation) =>
  operation.action === 'add' && operation.payload.items.length === 0;

class App {
  tab = $state<Tab>('register');
  month = $state(currentMonthKey());

  // Saved in localStorage
  settings = $state<ConnectionSettings>(storage.get('settings', { url: '', token: '' }));
  data = $state<SheetData>(storage.get('data', emptySheetData()));
  queue = $state<QueuedOperation[]>(storage.get('queue', []));
  lastUsedAccount = $state(storage.get('last', { acct: '' }).acct);
  checkedCharges = $state<Record<string, Record<string, boolean>>>(storage.get('checks', {}));

  // Memory only
  isSyncing = $state(false);
  syncStatus = $state<SyncStatus>('ok');
  errorMessage = $state('');
  lastSyncedAt = $state(0);
  movementFilter = $state<MovementFilter>({ account: '', category: '', query: '' });
  selectedCard = $state<SelectedCard>({ name: '', periodOffset: 0 });
  draft = $state<TransactionDraft>(emptyDraft(storage.get('last', { acct: '' }).acct));
  toastMessage = $state('');
  private toastTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /** Call once inside an effect root: saves each part of the state whenever it changes. */
  persistOnChange() {
    $effect(() => storage.set('settings', $state.snapshot(this.settings)));
    $effect(() => storage.set('data', $state.snapshot(this.data)));
    $effect(() => storage.set('queue', $state.snapshot(this.queue)));
    $effect(() => storage.set('last', { acct: this.lastUsedAccount }));
    $effect(() => storage.set('checks', $state.snapshot(this.checkedCharges)));
  }

  /** A link ending in #u=<url>&t=<token> configures a new device without typing. */
  importConnectionFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const url = params.get('u');
    const token = params.get('t');
    if (!url || !token) return;
    this.settings = { url, token };
    history.replaceState(null, '', location.pathname + location.search);
    this.tab = 'register';
  }

  showToast(message: string) {
    this.toastMessage = message;
    clearTimeout(this.toastTimeoutId);
    this.toastTimeoutId = setTimeout(() => (this.toastMessage = ''), TOAST_DURATION_MS);
  }

  resetDraft() {
    this.draft = emptyDraft(this.lastUsedAccount);
  }

  enqueueOperation(operation: OperationInput) {
    if (operation.action === 'saveConfig') {
      this.queue = this.queue.filter((queued) => !isSaveConfig(queued)); // only the latest config matters
    }
    this.queue.push({ queueId: generateId(), ...operation });
    void this.synchronize();
  }

  saveConfig(config: Config) {
    this.data.config = config;
    this.enqueueOperation({ action: 'saveConfig', payload: { config } });
  }

  discardPendingOperations() {
    this.queue = [];
  }

  clearLocalCopy() {
    ['data', 'queue', 'checks', 'last'].forEach((key) => storage.remove(key));
    location.reload();
  }

  replaceQueuedItem(item: TransactionItem) {
    for (const operation of this.queue) {
      if (operation.action === 'add') {
        operation.payload.items = operation.payload.items.map((queued) => (queued.id === item.id ? item : queued));
      }
    }
  }

  removeQueuedItem(itemId: string) {
    for (const operation of this.queue) {
      if (operation.action === 'add') {
        operation.payload.items = operation.payload.items.filter((queued) => queued.id !== itemId);
      }
    }
    this.queue = this.queue.filter((operation) => !isAdditionWithoutItems(operation));
  }

  private applySnapshot(snapshot: Snapshot) {
    const hasUnsentConfig = this.queue.some(isSaveConfig);
    this.data = {
      rows: snapshot.rows,
      types: snapshot.types,
      accounts: snapshot.accounts,
      loaded: true,
      config: hasUnsentConfig ? this.data.config : { ...emptyConfig(), ...snapshot.config }
    };
  }

  /** Sends the queue in order, then downloads a fresh copy of the sheet. */
  async synchronize() {
    if (this.isSyncing || !this.settings.url) return;

    this.isSyncing = true;
    try {
      while (this.queue.length) {
        const operation = this.queue[0];
        try {
          const snapshot = await callApi(
            $state.snapshot(this.settings),
            operation.action,
            $state.snapshot(operation.payload)
          );
          this.queue.shift();
          this.applySnapshot(snapshot);
        } catch (error) {
          // Rejected operations are dropped; network and auth errors abort and are retried later.
          const isRejection = error instanceof ApiError && (error.code === 'conflict' || error.code === 'bad_request');
          if (!isRejection) throw error;
          this.queue.shift();
          this.showToast(
            error.code === 'conflict'
              ? 'Un cambio no se aplicó: la fila ya había cambiado en la planilla.'
              : 'Un cambio fue rechazado: ' + error.message
          );
        }
      }
      this.applySnapshot(await callApi($state.snapshot(this.settings), 'bootstrap'));
      this.errorMessage = '';
      this.lastSyncedAt = Date.now();
      this.syncStatus = 'ok';
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('internal', (error as Error).message);
      this.errorMessage = apiError.message;
      this.syncStatus = apiError.code === 'network' ? 'offline' : 'error';
      if (apiError.code === 'auth') {
        this.tab = 'settings';
        this.showToast('Token inválido: revísalo en Ajustes.');
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const app = new App();
