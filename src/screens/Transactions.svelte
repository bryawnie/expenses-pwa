<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { buildVisibleTransactions, computeMonthStats, isTransfer } from '../lib/domain';
  import type { Transaction } from '../lib/types';
  import { formatMoney, normalizeText, weekdayDayAndMonth } from '../lib/utils';
  import AmountLabel from '../components/AmountLabel.svelte';
  import CategoryIcon from '../components/CategoryIcon.svelte';
  import EditSheet from '../components/EditSheet.svelte';
  import MonthNav from '../components/MonthNav.svelte';

  let transactionBeingEdited = $state<Transaction | null>(null);

  const searchableText = (transaction: Transaction) =>
    normalizeText(`${transaction.name} ${transaction.description} ${transaction.type} ${transaction.account}`);

  const isSpending = (transaction: Transaction) => transaction.amount < 0 && !isTransfer(transaction.type);

  const totalSpentIn = (transactions: Transaction[]) =>
    transactions.filter(isSpending).reduce((sum, transaction) => sum - transaction.amount, 0);

  const filteredTransactions = $derived.by(() => {
    const { account, category, query } = app.movementFilter;
    const normalizedQuery = normalizeText(query);

    const isInSelectedMonth = (transaction: Transaction) => transaction.date.startsWith(app.month);
    const isInSelectedAccount = (transaction: Transaction) => !account || transaction.account === account;
    const isInSelectedCategory = (transaction: Transaction) => !category || transaction.type === category;
    const matchesSearch = (transaction: Transaction) =>
      !normalizedQuery || searchableText(transaction).includes(normalizedQuery);

    return buildVisibleTransactions(app.data, app.queue).filter(
      (transaction) =>
        isInSelectedMonth(transaction) &&
        isInSelectedAccount(transaction) &&
        isInSelectedCategory(transaction) &&
        matchesSearch(transaction)
    );
  });
  const monthStats = $derived(computeMonthStats(app.month, filteredTransactions));

  const transactionsByDay = $derived.by(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const transaction of filteredTransactions) (groups[transaction.date] ||= []).push(transaction);
    return Object.keys(groups)
      .sort()
      .reverse()
      .map((date) => ({
        date,
        transactions: groups[date],
        totalSpent: totalSpentIn(groups[date])
      }));
  });

  function openForEditing(transaction: Transaction) {
    if (transaction.isPending && !transaction.id) {
      app.showToast('Este cambio aún está sincronizándose. Inténtalo en unos segundos.');
      return;
    }
    transactionBeingEdited = transaction;
  }
</script>

<MonthNav />
<input
  class="inp"
  id="q"
  type="search"
  placeholder="Buscar comercio, descripción…"
  aria-label="Buscar"
  bind:value={app.movementFilter.query}
/>
<div class="scroller">
  <button class="pill" class:on={!app.movementFilter.account} onclick={() => (app.movementFilter.account = '')}
    >Todas</button
  >
  {#each app.data.accounts as account (account)}
    <button
      class="pill"
      class:on={app.movementFilter.account === account}
      onclick={() => (app.movementFilter.account = account)}>{account}</button
    >
  {/each}
</div>
{#if app.movementFilter.category}
  <div>
    <button class="pill on" onclick={() => (app.movementFilter.category = '')}>{app.movementFilter.category} ✕</button>
  </div>
{/if}
<div class="card">
  {#if !filteredTransactions.length}
    <div class="empty">
      {app.data.loaded ? 'No hay movimientos con estos filtros.' : 'Aún no hay datos. Conecta tu planilla en Ajustes.'}
    </div>
  {:else}
    <div class="line2">
      <span class="muted">Gastos</span><b>{formatMoney(monthStats.expenses)}</b>
    </div>
    {#if monthStats.income}<div class="line2">
        <span class="muted">Ingresos</span><b>{formatMoney(monthStats.income)}</b>
      </div>{/if}
    {#each transactionsByDay as day (day.date)}
      <div class="dayhdr">
        <span>{weekdayDayAndMonth(day.date)}</span><span>{day.totalSpent ? formatMoney(-day.totalSpent) : ''}</span>
      </div>
      {#each day.transactions as transaction, index (transaction.id ?? `${transaction.sheetRow}-${index}`)}
        <button class="item" onclick={() => openForEditing(transaction)}>
          <CategoryIcon type={transaction.type} />
          <span class="mid"
            ><b>{transaction.name || '—'}</b><small
              >{transaction.description}{transaction.description ? ' · ' : ''}{transaction.account}</small
            ></span
          >
          <AmountLabel {transaction} pendingTitle="Pendiente de sincronizar" />
        </button>
      {/each}
    {/each}
  {/if}
</div>

{#if transactionBeingEdited}
  <EditSheet transaction={transactionBeingEdited} onClose={() => (transactionBeingEdited = null)} />
{/if}
