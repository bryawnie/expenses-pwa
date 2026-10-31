<script lang="ts">
  import { app } from '../lib/app.svelte';
  import type { Tab } from '../lib/types';

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'register', label: 'Registrar', icon: '<circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />' },
    {
      id: 'transactions',
      label: 'Movimientos',
      icon: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />'
    },
    { id: 'summary', label: 'Resumen', icon: '<path d="M5 20V10M12 20V4M19 20v-7" />' },
    {
      id: 'cards',
      label: 'Tarjetas',
      icon: '<rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" />'
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />'
    }
  ];

  function openTab(tab: Tab) {
    app.tab = tab;
    window.scrollTo(0, 0);
  }
</script>

<nav id="tabs">
  <div class="in">
    {#each TABS as tab (tab.id)}
      <button class:on={app.tab === tab.id} onclick={() => openTab(tab.id)}>
        <svg viewBox="0 0 24 24">{@html tab.icon}</svg>{tab.label}
      </button>
    {/each}
  </div>
</nav>
