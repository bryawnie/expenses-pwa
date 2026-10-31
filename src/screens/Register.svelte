<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { buildVisibleTransactions, isTransfer } from '../lib/domain';
  import { validateNewTransactions } from '../lib/forms';
  import { dayAndMonth } from '../lib/utils';
  import AmountLabel from '../components/AmountLabel.svelte';
  import CategoryIcon from '../components/CategoryIcon.svelte';
  import TransactionForm from '../components/TransactionForm.svelte';

  const RECENT_COUNT = 4;

  const recentTransactions = $derived(
    buildVisibleTransactions(app.data, app.queue)
      .filter((transaction) => !isTransfer(transaction.type))
      .slice(0, RECENT_COUNT)
  );

  function saveNewTransaction(): string {
    const draft = app.draft;
    const validation = validateNewTransactions(draft, app.data.types, app.data.config);
    if (validation.error !== undefined) return validation.error;

    app.lastUsedAccount = draft.account;
    app.enqueueOperation({
      action: 'add',
      payload: { items: validation.value }
    });
    app.showToast(draft.kind === 'transfer' ? 'Traspaso guardado ✓' : 'Guardado ✓');
    app.resetDraft();
    document.getElementById('f-amount')?.focus();
    return '';
  }
</script>

{#if !app.settings.url}
  <div class="banner">
    Aún no está conectada tu planilla. Ve a <b>Ajustes</b> y pega la URL y el token.
  </div>
{/if}
<div class="card">
  <TransactionForm bind:draft={app.draft} mode="new" onSubmit={saveNewTransaction} />
</div>
{#if recentTransactions.length}
  <div class="card">
    <h2>Últimos registros</h2>
    {#each recentTransactions as transaction, index (transaction.id ?? `${transaction.sheetRow}-${index}`)}
      <div class="item" style="cursor:default">
        <CategoryIcon type={transaction.type} />
        <span class="mid"
          ><b>{transaction.name || '—'}</b><small>{dayAndMonth(transaction.date)} · {transaction.account}</small></span
        >
        <AmountLabel {transaction} />
      </div>
    {/each}
  </div>
{/if}
