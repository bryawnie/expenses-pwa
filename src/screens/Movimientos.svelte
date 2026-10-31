<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { isTransfer, stats, viewRows } from '../lib/domain';
  import type { Row } from '../lib/types';
  import { dayLabel, money, norm } from '../lib/utils';
  import Amount from '../components/Amount.svelte';
  import CategoryIcon from '../components/CategoryIcon.svelte';
  import EditSheet from '../components/EditSheet.svelte';
  import MonthNav from '../components/MonthNav.svelte';

  let editing = $state<Row | null>(null);

  /** Aplica mes, cuenta, categoría y búsqueda. */
  const rows = $derived.by(() => {
    let list = viewRows(app.data, app.queue).filter(r => r.d.startsWith(app.month));
    if (app.filter.acct) list = list.filter(r => r.c === app.filter.acct);
    if (app.filter.cat) list = list.filter(r => r.t === app.filter.cat);
    const query = norm(app.filter.q);
    if (query) list = list.filter(r => norm(`${r.n} ${r.ds} ${r.t} ${r.c}`).includes(query));
    return list;
  });
  const st = $derived(stats(app.month, rows));

  /** Agrupa por día (más reciente primero). */
  const days = $derived.by(() => {
    const byDay: Record<string, Row[]> = {};
    for (const r of rows) (byDay[r.d] ||= []).push(r);
    return Object.keys(byDay)
      .sort()
      .reverse()
      .map(day => ({
        day,
        rows: byDay[day],
        total: byDay[day].filter(r => r.a < 0 && !isTransfer(r.t)).reduce((sum, r) => sum - r.a, 0)
      }));
  });

  function open(row: Row) {
    if (row.pending && !row.id) {
      app.toast('Este cambio aún está sincronizándose. Inténtalo en unos segundos.');
      return;
    }
    editing = row;
  }
</script>

<MonthNav />
<input class="inp" id="q" type="search" placeholder="Buscar comercio, descripción…" aria-label="Buscar" bind:value={app.filter.q} />
<div class="scroller" id="acctFilter">
  <button class="pill" class:on={!app.filter.acct} onclick={() => (app.filter.acct = '')}>Todas</button>
  {#each app.data.accounts as a (a)}
    <button class="pill" class:on={app.filter.acct === a} onclick={() => (app.filter.acct = a)}>{a}</button>
  {/each}
</div>
{#if app.filter.cat}
  <div><button class="pill on" onclick={() => (app.filter.cat = '')}>{app.filter.cat} ✕</button></div>
{/if}
<div class="card">
  {#if !rows.length}
    <div class="empty">{app.data.loaded ? 'No hay movimientos con estos filtros.' : 'Aún no hay datos. Conecta tu planilla en Ajustes.'}</div>
  {:else}
    <div class="line2"><span class="muted">Gastos</span><b>{money(st.gasto)}</b></div>
    {#if st.ingreso}<div class="line2"><span class="muted">Ingresos</span><b>{money(st.ingreso)}</b></div>{/if}
    {#each days as g (g.day)}
      <div class="dayhdr"><span>{dayLabel(g.day)}</span><span>{g.total ? money(-g.total) : ''}</span></div>
      {#each g.rows as r, i (r.id ?? `${r.r}-${i}`)}
        <button class="item" onclick={() => open(r)}>
          <CategoryIcon type={r.t} />
          <span class="mid"><b>{r.n || '—'}</b><small>{r.ds}{r.ds ? ' · ' : ''}{r.c}</small></span>
          <Amount row={r} pendingTitle="Pendiente de sincronizar" />
        </button>
      {/each}
    {/each}
  {/if}
</div>

{#if editing}
  <EditSheet row={editing} onclose={() => (editing = null)} />
{/if}
