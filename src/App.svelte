<script lang="ts">
  import { app } from './lib/app.svelte';
  import { frequentNames } from './lib/domain';
  import Header from './components/Header.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import Registrar from './screens/Registrar.svelte';
  import Movimientos from './screens/Movimientos.svelte';
  import Resumen from './screens/Resumen.svelte';
  import Tarjetas from './screens/Tarjetas.svelte';
  import Ajustes from './screens/Ajustes.svelte';

  const screens = {
    registrar: Registrar,
    movimientos: Movimientos,
    resumen: Resumen,
    tarjetas: Tarjetas,
    ajustes: Ajustes
  };
  const Screen = $derived(screens[app.tab]);
  const names = $derived(frequentNames(app.data));

  // Persistencia y arranque
  $effect(() => app.persist());
  app.importHash();
  void app.sync();

  $effect(() => {
    const onOnline = () => {
      app.status = 'ok';
      void app.sync();
    };
    const onOffline = () => {
      app.status = 'offline';
    };
    const onVisible = () => {
      if (!document.hidden && Date.now() - app.lastSync > 30000) void app.sync();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });
</script>

<Header />
<main id="view"><Screen /></main>
<datalist id="names">
  {#each names as n (n)}<option value={n}></option>{/each}
</datalist>
<TabBar />
<Toast />
