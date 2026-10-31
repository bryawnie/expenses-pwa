<script lang="ts">
  import { app } from '../lib/app.svelte';
</script>

<div id="toast" class:on={!!app.toastMessage} role="status" aria-live="polite">{app.toastMessage}</div>
