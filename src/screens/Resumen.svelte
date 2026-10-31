<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { cumulative } from '../lib/charts';
  import { stats, viewRows } from '../lib/domain';
  import { currentMonth, money, monthLabel, monthName, monthShift, monthShort, short, today } from '../lib/utils';
  import BarChart from '../components/BarChart.svelte';
  import LineChart from '../components/LineChart.svelte';
  import MonthNav from '../components/MonthNav.svelte';

  const rows = $derived(viewRows(app.data, app.queue));
  const st = $derived(stats(app.month, rows));
  const isCurrentMonth = $derived(app.month === currentMonth());
  const cutoff = $derived(isCurrentMonth ? +today().slice(8) : st.days); // último día con datos que se dibuja

  // Referencia: promedio del acumulado de los hasta 6 meses anteriores (solo los que tienen movimientos).
  const refCumulatives = $derived.by(() => {
    const out: (number | null)[][] = [];
    for (let i = 1; i <= 6; i++) {
      const s = stats(monthShift(app.month, -i), rows);
      if (s.n > 0) out.push(cumulative(s.daily, s.days));
    }
    return out;
  });
  const nRef = $derived(refCumulatives.length);
  const refLabel = $derived(
    nRef >= 6
      ? 'los 6 meses anteriores'
      : nRef === 1
        ? 'el mes anterior con datos'
        : `los ${nRef} meses anteriores con datos`
  );

  const averageSeries = $derived.by(() => {
    const out: (number | null)[] = [0];
    for (let d = 1; d <= st.days; d++) {
      out.push(nRef ? refCumulatives.reduce((sum, c) => sum + (c[Math.min(d, c.length - 1)] ?? 0), 0) / nRef : null);
    }
    return out;
  });
  const currentSeries = $derived(cumulative(st.daily, cutoff));

  const net = $derived(st.gasto - st.ingreso);
  const budgets = $derived(app.data.config.budgets);
  const budgetTotal = $derived(Object.values(budgets).reduce((sum, v) => sum + (v || 0), 0));
  const budgetUsed = $derived(Object.keys(budgets).reduce((sum, k) => sum + Math.max(st.byCat[k] || 0, 0), 0));

  const diff = $derived((currentSeries[cutoff] ?? 0) - (averageSeries[cutoff] ?? 0));
  const showDelta = $derived(nRef > 0 && st.n > 0 && Math.round(diff) !== 0);

  // Gasto neto de los últimos 6 meses terminando en el mes elegido.
  const months = $derived(
    [5, 4, 3, 2, 1, 0].map((i) => {
      const key = monthShift(app.month, -i);
      const ms = stats(key, rows);
      return { key, v: ms.gasto - ms.ingreso };
    })
  );

  const spendCategories = $derived(
    Object.keys(st.byCat)
      .filter((c) => st.byCat[c] > 0)
      .sort((a, b) => st.byCat[b] - st.byCat[a])
  );
  const incomeCategories = $derived(
    Object.keys(st.byCat)
      .filter((c) => st.byCat[c] < 0)
      .sort((a, b) => st.byCat[a] - st.byCat[b])
  );
  const totalNet = $derived(spendCategories.reduce((sum, c) => sum + st.byCat[c], 0));
  const accounts = $derived(Object.keys(st.byAcct).sort((a, b) => Math.abs(st.byAcct[b]) - Math.abs(st.byAcct[a])));
  const sampleDays = $derived([1, 5, 10, 15, 20, 25, 30].filter((d) => d <= st.days));

  function goCategory(category: string) {
    app.filter.cat = category;
    app.tab = 'movimientos';
    window.scrollTo(0, 0);
  }
</script>

<MonthNav />

{#if !st.n && !nRef}
  <div class="card empty">
    {app.data.loaded ? 'No hay movimientos en este mes.' : 'Conecta tu planilla en Ajustes para ver el resumen.'}
  </div>
{:else}
  <div class="card">
    <div class="muted small">Gasto neto de {monthName(app.month).toLowerCase()}</div>
    <div class="hero">{money(net)}</div>
    <div class="muted small">Gastos menos reintegros del mes</div>
    <div class="kpis">
      <div><small>Gastos</small><b>{money(st.gasto)}</b></div>
      <div><small>Reintegros</small><b>{money(st.ingreso)}</b></div>
      {#if budgetTotal}<div>
          <small>Presupuesto usado</small><b>{Math.round((budgetUsed / budgetTotal) * 100)}%</b>
        </div>{/if}
    </div>
    {#if showDelta}
      <div style="margin-top:8px">
        <div class="delta {diff > 0 ? 'bad' : 'good'}">
          {diff > 0 ? '▲' : '▼'} Gasto neto {money(Math.abs(diff))}
          {diff > 0 ? 'sobre' : 'bajo'} el promedio de {refLabel}{isCurrentMonth ? ' a esta fecha' : ''}
        </div>
      </div>
    {/if}
  </div>

  <div class="card">
    <h2>Gasto neto acumulado</h2>
    <div class="chartwrap">
      <LineChart current={currentSeries} previous={averageSeries} monthKey={app.month} {cutoff} />
    </div>
    <div class="legend">
      <span><i style="background:var(--accent)"></i>{monthName(app.month)}</span>
      {#if nRef}<span
          ><i style="background:var(--prev)"></i>Promedio {nRef >= 6
            ? 'de 6 meses'
            : `de ${nRef} ${nRef === 1 ? 'mes' : 'meses'}`}</span
        >{/if}
    </div>
    <details class="tbl">
      <summary>Ver tabla</summary>
      <table class="t">
        <tbody>
          <tr><th>Día</th><th>{monthShort(app.month)}</th><th>Promedio</th></tr>
          {#each sampleDays as d (d)}
            <tr
              ><td>{d}</td><td>{currentSeries[d] != null ? money(currentSeries[d]!) : '—'}</td><td
                >{averageSeries[d] != null ? money(averageSeries[d]!) : '—'}</td
              ></tr
            >
          {/each}
        </tbody>
      </table>
    </details>
  </div>

  <div class="card">
    <h2>Gasto neto de los últimos 6 meses</h2>
    <BarChart items={months} selectedKey={app.month} />
    <details class="tbl">
      <summary>Ver tabla</summary>
      <table class="t">
        <tbody
          >{#each months as m (m.key)}<tr><td>{monthLabel(m.key)}</td><td>{money(m.v)}</td></tr>{/each}</tbody
        >
      </table>
    </details>
  </div>

  <div class="card">
    <h2>Gasto neto por categoría</h2>
    <div class="muted small" style="margin:-4px 0 6px">
      Descuenta los reintegros que registres en la misma categoría.
    </div>
    {#each spendCategories as c (c)}
      {@const value = st.byCat[c]}
      {@const budget = budgets[c] || 0}
      {@const isOver = budget > 0 && value > budget}
      {@const percent = budget ? Math.min(100, (value / budget) * 100) : (value / st.byCat[spendCategories[0]]) * 100}
      <button class="cat" onclick={() => goCategory(c)}>
        <div class="top"><span>{c}</span><span>{money(value)}</span></div>
        <div class="bar" class:over={isOver}><i style="width:{percent.toFixed(1)}%"></i></div>
        <div class="sub">
          <span>{totalNet ? Math.round((value / totalNet) * 100) : 0}% del gasto neto</span>
          {#if isOver}<span class="bad">⚠ Excedido en {money(value - budget)} (ppto. {short(budget)})</span>
          {:else if budget}<span>Quedan {money(budget - value)} de {short(budget)}</span>
          {:else}<span></span>{/if}
        </div>
      </button>
    {:else}
      <div class="empty">Sin gastos.</div>
    {/each}
    {#if !budgetTotal}
      <div class="muted small" style="margin-top:8px">
        Define presupuestos por categoría en Ajustes para ver cuánto te queda.
      </div>
    {/if}
  </div>

  {#if incomeCategories.length}
    <div class="card">
      <h2>Ingresos y reintegros</h2>
      {#each incomeCategories as c (c)}
        <button class="cat" onclick={() => goCategory(c)}>
          <div class="top"><span>{c}</span><span style="color:var(--good)">+{money(-st.byCat[c])}</span></div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="card">
    <h2>Gasto neto por cuenta</h2>
    {#each accounts as a (a)}
      <div class="line2"><span>{a}</span><b>{money(st.byAcct[a])}</b></div>
    {:else}
      <div class="empty">Sin movimientos.</div>
    {/each}
  </div>
{/if}
