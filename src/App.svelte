<script lang="ts">
  import { app } from './lib/app.svelte';
  import { mostFrequentNames } from './lib/domain';
  import Header from './components/Header.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import Register from './screens/Register.svelte';
  import Transactions from './screens/Transactions.svelte';
  import Summary from './screens/Summary.svelte';
  import Cards from './screens/Cards.svelte';
  import Settings from './screens/Settings.svelte';

  const SCREENS = {
    register: Register,
    transactions: Transactions,
    summary: Summary,
    cards: Cards,
    settings: Settings
  };
  const REFRESH_AFTER_HIDDEN_MS = 30000;

  const Screen = $derived(SCREENS[app.tab]);
  const autocompleteNames = $derived(mostFrequentNames(app.data));

  $effect(() => app.persistOnChange());
  app.importConnectionFromHash();
  void app.synchronize();

  $effect(() => {
    const handleOnline = () => {
      app.syncStatus = 'ok';
      void app.synchronize();
    };
    const handleOffline = () => (app.syncStatus = 'offline');
    const handleVisibilityChange = () => {
      if (!document.hidden && Date.now() - app.lastSyncedAt > REFRESH_AFTER_HIDDEN_MS) void app.synchronize();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<Header />
<main id="view"><Screen /></main>
<datalist id="names">
  {#each autocompleteNames as name (name)}<option value={name}></option>{/each}
</datalist>
<TabBar />
<Toast />
