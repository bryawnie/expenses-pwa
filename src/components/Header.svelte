<script lang="ts">
  import { app } from '../lib/app.svelte';

  const TITLES = {
    registrar: 'Registrar',
    movimientos: 'Movimientos',
    resumen: 'Resumen',
    tarjetas: 'Tarjetas',
    ajustes: 'Ajustes'
  };

  const view = $derived.by(() => {
    const pending = app.queue.length;
    const pendingText = `${pending} pendiente${pending > 1 ? 's' : ''}`;
    if (app.syncing) return { state: 'busy', text: 'Sincronizando…' };
    if (pending && app.status !== 'error') {
      return app.status === 'offline'
        ? { state: 'offline', text: `Sin conexión · ${pendingText}` }
        : { state: 'pending', text: pendingText };
    }
    if (app.status === 'offline') return { state: 'offline', text: 'Sin conexión' };
    if (app.status === 'error') return { state: 'error', text: 'Error · toca para reintentar' };
    return { state: 'ok', text: app.settings.url ? 'Sincronizado' : 'Sin configurar' };
  });

  function syncNow() {
    app.status = 'ok';
    void app.sync();
  }
</script>

<header id="top">
  <h1 id="title">{TITLES[app.tab]}</h1>
  <button id="syncBtn" data-s={view.state} aria-label="Sincronizar ahora" title={app.err} onclick={syncNow}>
    <span id="syncDot"></span><span id="syncTxt">{view.text}</span>
  </button>
</header>
