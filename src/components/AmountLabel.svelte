<script lang="ts">
  import type { Transaction } from '../lib/types';
  import { formatMoney } from '../lib/utils';

  let { transaction, pendingTitle }: { transaction: Transaction; pendingTitle?: string } = $props();
</script>

<span class="am" class:pos={transaction.amount > 0}
  >{#if transaction.isPending}<i class="pend" title={pendingTitle}>⏳</i>{/if}{formatMoney(transaction.amount)}</span
>
