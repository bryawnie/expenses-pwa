<script lang="ts">
  import { app } from '../lib/app.svelte';

  const TAB_TITLES = {
    register: 'Registrar',
    transactions: 'Movimientos',
    summary: 'Resumen',
    cards: 'Tarjetas',
    settings: 'Ajustes'
  };

  const syncIndicator = $derived.by(() => {
    const pendingCount = app.queue.length;
    const pendingText = `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`;
    if (app.isSyncing) return { state: 'busy', text: 'Sincronizando…' };
    if (pendingCount && app.syncStatus !== 'error') {
      return app.syncStatus === 'offline'
        ? { state: 'offline', text: `Sin conexión · ${pendingText}` }
        : { state: 'pending', text: pendingText };
    }
    if (app.syncStatus === 'offline') return { state: 'offline', text: 'Sin conexión' };
    if (app.syncStatus === 'error') return { state: 'error', text: 'Error · toca para reintentar' };
    return { state: 'ok', text: app.settings.url ? 'Sincronizado' : 'Sin configurar' };
  });

  function retrySync() {
    app.syncStatus = 'ok';
    void app.synchronize();
  }
</script>

<header id="top">
  <h1 id="title">{TAB_TITLES[app.tab]}</h1>
  <button
    id="syncBtn"
    data-s={syncIndicator.state}
    aria-label="Sincronizar ahora"
    title={app.errorMessage}
    onclick={retrySync}
  >
    <span id="syncDot"></span><span id="syncTxt">{syncIndicator.text}</span>
  </button>
</header>
