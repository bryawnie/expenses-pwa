<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { accountConfig, creditCards, isTransfer, periodFor, periodTotals, viewRows } from '../lib/domain';
  import { addDays, clp, dayMonth, daysInMonth, formatDigits, money, monthShift, pad } from '../lib/utils';

  const cards = $derived(creditCards(app.data));
  const name = $derived(cards.includes(app.card.name) ? app.card.name : (cards[0] ?? ''));
  const config = $derived(accountConfig(app.data.config, name));
  const rows = $derived(viewRows(app.data, app.queue).filter((r) => r.c === name));
  const period = $derived(periodFor(app.data.config, name, app.card.p));
  const totals = $derived(periodTotals(rows, period));

  const statementKey = $derived(`${name}|${period.end}`);
  const statement = $derived(app.data.config.statements[statementKey]);
  const hasStatement = $derived(typeof statement === 'number' && statement !== 0);
  const difference = $derived(hasStatement ? statement - totals.facturado : 0);

  /** Fecha de vencimiento: en el mismo mes del cierre si el día es posterior, si no al mes siguiente. */
  const dueDate = $derived.by(() => {
    if (!config.dueDay || period.open) return '';
    const closeMonth = period.end.slice(0, 7);
    const dueMonth = config.dueDay > config.closeDay ? closeMonth : monthShift(closeMonth, 1);
    const [y, m] = dueMonth.split('-').map(Number);
    return `${dueMonth}-${pad(Math.min(config.dueDay, daysInMonth(y, m)))}`;
  });

  // Cargos que el usuario ya marcó como vistos en su estado de cuenta
  const checked = $derived(app.checks[statementKey] || {});
  const signatures = $derived(totals.periodRows.map((r, i) => `${r.d}|${r.n}|${r.a}|${i}`));
  const markedTotal = $derived(
    totals.periodRows.reduce((sum, r, i) => {
      if (!checked[signatures[i]]) return sum;
      const isPaymentReceived = isTransfer(r.t) && r.a >= 0; // los pagos recibidos no suman a lo facturado
      return sum + (isPaymentReceived ? 0 : -r.a);
    }, 0)
  );

  function tick(sig: string) {
    const current = app.checks[statementKey] || {};
    app.checks[statementKey] = { ...current, [sig]: !current[sig] };
  }

  function onStatement(e: Event & { currentTarget: HTMLInputElement }) {
    e.currentTarget.value = formatDigits(e.currentTarget.value);
  }

  function saveStatement(e: Event & { currentTarget: HTMLInputElement }) {
    const config = JSON.parse(JSON.stringify(app.data.config));
    const amount = +e.currentTarget.value.replace(/\D/g, '');
    if (amount) config.statements[statementKey] = amount;
    else delete config.statements[statementKey];
    app.saveConfig(config);
  }
</script>

{#if !cards.length}
  <div class="card empty">
    No hay tarjetas de crédito marcadas.<br />Ve a <b>Ajustes → Cuentas</b>, elige “Crédito” para tus tarjetas e indica
    su día de cierre.<br /><br />
    <button class="ghost" onclick={() => (app.tab = 'ajustes')}>Ir a Ajustes</button>
  </div>
{:else}
  <div class="scroller">
    {#each cards as c (c)}
      <button class="pill" class:on={c === name} onclick={() => (app.card = { name: c, p: 0 })}>{c}</button>
    {/each}
  </div>

  {#if !config.closeDay}
    <div class="banner">
      Indica el día de cierre de {name} en <b>Ajustes → Cuentas</b> para cuadrar el estado de cuenta.
    </div>
  {:else}
    <div class="card">
      <div class="monthnav">
        <button aria-label="Período anterior" onclick={() => (app.card = { name, p: app.card.p + 1 })}>◀</button>
        <b style="text-align:center">
          {period.open ? 'Período abierto' : 'Cierre ' + dayMonth(period.end)}
          <div class="muted small" style="font-weight:400">{dayMonth(period.start)} – {dayMonth(period.end)}</div>
        </b>
        <button
          aria-label="Período siguiente"
          disabled={app.card.p <= 0}
          onclick={() => (app.card = { name, p: app.card.p - 1 })}>▶</button
        >
      </div>
      <div class="muted small" style="margin-top:10px">
        {period.open ? 'Uso desde el último cierre' : 'Facturado en este cierre'}
      </div>
      <div class="hero">{money(totals.facturado)}</div>
      <div class="muted small">
        {period.open
          ? `Compras y cargos desde el cierre del ${dayMonth(addDays(period.start, -1))}, sin descontar tus pagos`
          : 'Compras y cargos del período, sin descontar tus pagos'}
      </div>
      <div style="margin-top:12px">
        <div class="line2"><span>Compras y cargos</span><b>{money(totals.compras + totals.cargosTr)}</b></div>
        {#if totals.devol}<div class="line2"><span>Devoluciones</span><b>{money(-totals.devol)}</b></div>{/if}
        {#if totals.pagos}<div class="line2">
            <span class="muted">Pagos abonados (no se restan)</span><b>{money(totals.pagos)}</b>
          </div>{/if}
        {#if dueDate}<div class="line2"><span class="muted">Vence</span><b>{dayMonth(dueDate)}</b></div>{/if}
      </div>
      {#if !period.open}
        <label class="f" style="margin-top:10px"
          >Total del estado de cuenta
          <input
            class="inp"
            inputmode="numeric"
            placeholder="Ej: {clp.format(Math.round(totals.facturado / 1000) * 1000 || 100000)}"
            value={hasStatement ? clp.format(statement) : ''}
            oninput={onStatement}
            onchange={saveStatement}
          />
        </label>
      {/if}
      <div style="margin-top:10px">
        {#if period.open}
          <span class="badge neutral">Período abierto: aún no llega el estado de cuenta</span>
        {:else if !hasStatement}
          <span class="badge neutral">Ingresa el total de tu estado de cuenta para cuadrar</span>
        {:else if difference === 0}
          <span class="badge ok">✓ Cuadra con tu estado de cuenta</span>
        {:else if difference > 0}
          <span class="badge warn">⚠ Faltan {money(difference)} por registrar en la planilla</span>
        {:else}
          <span class="badge bad">⚠ La planilla suma {money(-difference)} más que el estado de cuenta</span>
        {/if}
      </div>
    </div>

    <div class="card">
      <h2>Movimientos del período ({totals.periodRows.length})</h2>
      {#if !totals.periodRows.length}
        <div class="empty">Sin movimientos en este período.</div>
      {:else}
        <div class="muted small" style="margin-bottom:4px">
          Marca cada cargo que veas en tu estado de cuenta. Marcado: <b>{money(markedTotal)}</b> · Sin marcar:
          <b>{money(totals.facturado - markedTotal)}</b>
        </div>
        {#each totals.periodRows as r, i (signatures[i])}
          <button class="chk" class:done={checked[signatures[i]]} onclick={() => tick(signatures[i])}>
            <span class="box">✓</span>
            <span class="mid"><b>{r.n || '—'}</b><small>{dayMonth(r.d)}{r.ds ? ' · ' + r.ds : ''}</small></span>
            <span class="am" class:pos={r.a > 0}>{money(r.a)}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
{/if}
