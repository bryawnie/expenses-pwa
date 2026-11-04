<script lang="ts">
  import { app } from '../lib/app.svelte';
  import type { Transaction } from '../lib/types';
  import {
    billingPeriod,
    billingPeriodTotals,
    buildVisibleTransactions,
    getAccountConfig,
    listCreditCards
  } from '../lib/domain';
  import {
    addDaysToDate,
    dayAndMonth,
    formatDigitsWithThousands,
    formatMoney,
    isoDateInMonth,
    pesoNumberFormat,
    shiftMonth
  } from '../lib/utils';

  const EXAMPLE_ROUNDING = 1000;
  const EXAMPLE_FALLBACK = 100000;

  const creditCards = $derived(listCreditCards(app.data));
  const cardName = $derived(
    creditCards.includes(app.selectedCard.name) ? app.selectedCard.name : (creditCards[0] ?? '')
  );
  const cardConfig = $derived(getAccountConfig(app.data.config, cardName));
  const isOnSelectedCard = (transaction: Transaction) => transaction.account === cardName;
  const cardTransactions = $derived(buildVisibleTransactions(app.data, app.queue).filter(isOnSelectedCard));
  const period = $derived(billingPeriod(app.data.config, cardName, app.selectedCard.periodOffset));
  const totals = $derived(billingPeriodTotals(cardTransactions, period));

  const statementKey = $derived(`${cardName}|${period.end}`);
  const statementTotal = $derived(app.data.config.statements[statementKey]);
  const hasStatementTotal = $derived(typeof statementTotal === 'number' && statementTotal !== 0);
  const difference = $derived(hasStatementTotal ? Math.round(statementTotal - totals.balanceAtClose) : 0);
  const periodNetMovement = $derived(totals.balanceAtClose - totals.balanceBefore);
  const showsPendingPayment = $derived(!period.isOpen && app.selectedCard.periodOffset === 1);

  // The due date falls in the closing month if its day comes after the closing day, otherwise in the next month.
  const dueDate = $derived.by(() => {
    if (!cardConfig.dueDay || period.isOpen) return '';
    const closingMonth = period.end.slice(0, 7);
    const dueMonth = cardConfig.dueDay > cardConfig.closeDay ? closingMonth : shiftMonth(closingMonth, 1);
    return isoDateInMonth(dueMonth, cardConfig.dueDay);
  });

  const checkedBySignature = $derived(app.checkedCharges[statementKey] || {});
  const chargeSignature = (transaction: Transaction, index: number) =>
    `${transaction.date}|${transaction.name}|${transaction.amount}|${index}`;
  const signatures = $derived(totals.periodTransactions.map(chargeSignature));

  const isChecked = (_transaction: Transaction, index: number) => !!checkedBySignature[signatures[index]];
  const markedTotal = $derived(
    totals.periodTransactions.filter(isChecked).reduce((sum, transaction) => sum - transaction.amount, 0)
  );
  const exampleStatementTotal = $derived(
    pesoNumberFormat.format(Math.round(totals.balanceAtClose / EXAMPLE_ROUNDING) * EXAMPLE_ROUNDING || EXAMPLE_FALLBACK)
  );

  function toggleCharge(signature: string) {
    const current = app.checkedCharges[statementKey] || {};
    app.checkedCharges[statementKey] = {
      ...current,
      [signature]: !current[signature]
    };
  }

  function formatStatementInput(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.value = formatDigitsWithThousands(event.currentTarget.value);
  }

  function saveStatementTotal(event: Event & { currentTarget: HTMLInputElement }) {
    const config = JSON.parse(JSON.stringify(app.data.config));
    const total = +event.currentTarget.value.replace(/\D/g, '');
    if (total) config.statements[statementKey] = total;
    else delete config.statements[statementKey];
    app.saveConfig(config);
  }
</script>

{#if !creditCards.length}
  <div class="card empty">
    No hay tarjetas de crédito marcadas.<br />Ve a <b>Ajustes → Cuentas</b>, elige “Crédito” para tus tarjetas e indica
    su día de cierre.<br /><br />
    <button class="ghost" onclick={() => (app.tab = 'settings')}>Ir a Ajustes</button>
  </div>
{:else}
  <div class="scroller">
    {#each creditCards as card (card)}
      <button
        class="pill"
        class:on={card === cardName}
        onclick={() => (app.selectedCard = { name: card, periodOffset: 0 })}>{card}</button
      >
    {/each}
  </div>

  {#if !cardConfig.closeDay}
    <div class="banner">
      Indica el día de cierre de {cardName} en <b>Ajustes → Cuentas</b> para cuadrar el estado de cuenta.
    </div>
  {:else}
    <div class="card">
      <div class="monthnav">
        <button
          aria-label="Período anterior"
          onclick={() =>
            (app.selectedCard = {
              name: cardName,
              periodOffset: app.selectedCard.periodOffset + 1
            })}>◀</button
        >
        <b style="text-align:center">
          {period.isOpen ? 'Período abierto' : 'Cierre ' + dayAndMonth(period.end)}
          <div class="muted small" style="font-weight:400">
            {dayAndMonth(period.start)} – {dayAndMonth(period.end)}
          </div>
        </b>
        <button
          aria-label="Período siguiente"
          disabled={app.selectedCard.periodOffset <= 0}
          onclick={() =>
            (app.selectedCard = {
              name: cardName,
              periodOffset: app.selectedCard.periodOffset - 1
            })}>▶</button
        >
      </div>
      <div class="muted small" style="margin-top:10px">
        {period.isOpen ? 'Saldo a la fecha' : 'Saldo al cierre'}
      </div>
      <div class="hero">{formatMoney(totals.balanceAtClose)}</div>
      <div class="muted small">
        {period.isOpen
          ? 'Compras y cargos menos devoluciones y pagos hechos hasta hoy'
          : 'Lo que debías al cierre, descontando los pagos hechos antes de esa fecha'}
      </div>
      <div style="margin-top:12px">
        <div class="line2"><span>Saldo anterior</span><b>{formatMoney(totals.balanceBefore)}</b></div>
        <div class="line2">
          <span>Compras y cargos</span><b>{formatMoney(totals.purchases + totals.transferCharges)}</b>
        </div>
        {#if totals.refunds}<div class="line2">
            <span>Devoluciones</span><b>{formatMoney(-totals.refunds)}</b>
          </div>{/if}
        {#if totals.paymentsReceived}<div class="line2">
            <span>Pagos del período</span><b>{formatMoney(-totals.paymentsReceived)}</b>
          </div>{/if}
        {#if showsPendingPayment}
          <div class="line2">
            <span>Pagos después del cierre</span><b>{formatMoney(-totals.paymentsAfterClose)}</b>
          </div>
          <div class="line2">
            <span>Falta pagar de este estado</span><b>{formatMoney(totals.pendingAfterPayments)}</b>
          </div>
        {/if}
        {#if dueDate}<div class="line2">
            <span class="muted">Vence</span><b>{dayAndMonth(dueDate)}</b>
          </div>{/if}
      </div>
      {#if !period.isOpen}
        <label class="f" style="margin-top:10px"
          >Total del estado de cuenta
          <input
            class="inp"
            inputmode="numeric"
            placeholder="Ej: {exampleStatementTotal}"
            value={hasStatementTotal ? pesoNumberFormat.format(statementTotal) : ''}
            oninput={formatStatementInput}
            onchange={saveStatementTotal}
          />
        </label>
      {/if}
      <div style="margin-top:10px">
        {#if period.isOpen}
          <span class="badge neutral">Período abierto: aún no llega el estado de cuenta</span>
        {:else if !hasStatementTotal}
          <span class="badge neutral">Ingresa el total de tu estado de cuenta para cuadrar</span>
        {:else if difference === 0}
          <span class="badge ok">✓ Cuadra con tu estado de cuenta</span>
        {:else if difference > 0}
          <span class="badge warn">⚠ Faltan {formatMoney(difference)} por registrar en la planilla</span>
        {:else}
          <span class="badge bad">⚠ La planilla suma {formatMoney(-difference)} más que el estado de cuenta</span>
        {/if}
      </div>
    </div>

    <div class="card">
      <h2>Movimientos del período ({totals.periodTransactions.length})</h2>
      {#if !totals.periodTransactions.length}
        <div class="empty">Sin movimientos en este período.</div>
      {:else}
        <div class="muted small" style="margin-bottom:4px">
          Marca cada cargo que veas en tu estado de cuenta. Marcado: <b>{formatMoney(markedTotal)}</b>
          · Sin marcar: <b>{formatMoney(periodNetMovement - markedTotal)}</b>
        </div>
        {#each totals.periodTransactions as transaction, index (signatures[index])}
          <button
            class="chk"
            class:done={checkedBySignature[signatures[index]]}
            onclick={() => toggleCharge(signatures[index])}
          >
            <span class="box">✓</span>
            <span class="mid"
              ><b>{transaction.name || '—'}</b><small
                >{dayAndMonth(transaction.date)}{transaction.description ? ' · ' + transaction.description : ''}</small
              ></span
            >
            <span class="am" class:pos={transaction.amount > 0}>{formatMoney(transaction.amount)}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
{/if}
