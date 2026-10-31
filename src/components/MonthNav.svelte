<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { currentMonthKey, monthAndYear, shiftMonth } from '../lib/utils';
</script>

<div class="monthnav">
  <button aria-label="Mes anterior" onclick={() => (app.month = shiftMonth(app.month, -1))}>◀</button>
  <b>{monthAndYear(app.month)}</b>
  <button
    aria-label="Mes siguiente"
    disabled={app.month >= currentMonthKey()}
    onclick={() => (app.month = shiftMonth(app.month, 1))}>▶</button
  >
</div>
