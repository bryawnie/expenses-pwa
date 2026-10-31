<script lang="ts">
  import type { Row } from '../lib/types';
  import { money } from '../lib/utils';

  let { row, pendingTitle }: { row: Row; pendingTitle?: string } = $props();
</script>

<span class="am" class:pos={row.a > 0}
  >{#if row.pending}<i class="pend" title={pendingTitle}>⏳</i>{/if}{money(row.a)}</span
>
