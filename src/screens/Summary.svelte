<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { accumulateDaily } from '../lib/charts';
  import { buildVisibleTransactions, computeMonthStats } from '../lib/domain';
  import {
    currentMonthKey,
    dayOfMonth,
    formatCompactMoney,
    formatMoney,
    monthAndYear,
    monthName,
    shiftMonth,
    shortMonthName,
    todayIso
  } from '../lib/utils';
  import BarChart from '../components/BarChart.svelte';
  import LineChart from '../components/LineChart.svelte';
  import MonthNav from '../components/MonthNav.svelte';

  const MONTHS_IN_AVERAGE = 6;
  const MONTHS_IN_BAR_CHART = 6;
  const SAMPLE_DAYS = [1, 5, 10, 15, 20, 25, 30];

  const transactions = $derived(buildVisibleTransactions(app.data, app.queue));
  const monthStats = $derived(computeMonthStats(app.month, transactions));
  const isCurrentMonth = $derived(app.month === currentMonthKey());
  const lastDrawnDay = $derived(isCurrentMonth ? dayOfMonth(todayIso()) : monthStats.daysInMonth);

  const previousMonthsAccumulated = $derived.by(() => {
    const accumulatedByMonth: (number | null)[][] = [];
    for (let monthsBack = 1; monthsBack <= MONTHS_IN_AVERAGE; monthsBack++) {
      const stats = computeMonthStats(shiftMonth(app.month, -monthsBack), transactions);
      if (stats.transactionCount > 0) accumulatedByMonth.push(accumulateDaily(stats.dailyNet, stats.daysInMonth));
    }
    return accumulatedByMonth;
  });
  const averagedMonthCount = $derived(previousMonthsAccumulated.length);
  const averageDescription = $derived(
    averagedMonthCount >= MONTHS_IN_AVERAGE
      ? 'los 6 meses anteriores'
      : averagedMonthCount === 1
        ? 'el mes anterior con datos'
        : `los ${averagedMonthCount} meses anteriores con datos`
  );

  // Months shorter than the one shown keep their final total for the remaining days.
  const accumulatedOnDay = (accumulated: (number | null)[], day: number) =>
    accumulated[Math.min(day, accumulated.length - 1)] ?? 0;

  const averageAccumulatedOnDay = (day: number) => {
    const sumOfMonths = previousMonthsAccumulated.reduce(
      (sum, accumulated) => sum + accumulatedOnDay(accumulated, day),
      0
    );
    return sumOfMonths / averagedMonthCount;
  };

  const averageSeries = $derived.by(() => {
    const series: (number | null)[] = [0];
    for (let day = 1; day <= monthStats.daysInMonth; day++) {
      series.push(averagedMonthCount ? averageAccumulatedOnDay(day) : null);
    }
    return series;
  });
  const currentSeries = $derived(accumulateDaily(monthStats.dailyNet, lastDrawnDay));

  const netSpending = $derived(monthStats.expenses - monthStats.income);
  const budgets = $derived(app.data.config.budgets);
  const netSpentIn = (category: string) => monthStats.netByCategory[category] || 0;
  const totalBudget = $derived(Object.values(budgets).reduce((sum, budget) => sum + (budget || 0), 0));
  const budgetUsed = $derived(
    Object.keys(budgets).reduce((sum, category) => sum + Math.max(netSpentIn(category), 0), 0)
  );

  const differenceFromAverage = $derived((currentSeries[lastDrawnDay] ?? 0) - (averageSeries[lastDrawnDay] ?? 0));
  const showDifferenceFromAverage = $derived(
    averagedMonthCount > 0 && monthStats.transactionCount > 0 && Math.round(differenceFromAverage) !== 0
  );

  const monthlyNetSpending = $derived(
    Array.from({ length: MONTHS_IN_BAR_CHART }, (_, index) => {
      const monthKey = shiftMonth(app.month, index + 1 - MONTHS_IN_BAR_CHART);
      const stats = computeMonthStats(monthKey, transactions);
      return { monthKey, netSpending: stats.expenses - stats.income };
    })
  );

  const isSpendingCategory = (category: string) => netSpentIn(category) > 0;
  const isIncomeCategory = (category: string) => netSpentIn(category) < 0;
  const bySpentDescending = (a: string, b: string) => netSpentIn(b) - netSpentIn(a);
  const byIncomeDescending = (a: string, b: string) => netSpentIn(a) - netSpentIn(b);
  const byLargestAccountAmount = (a: string, b: string) =>
    Math.abs(monthStats.netByAccount[b]) - Math.abs(monthStats.netByAccount[a]);

  const categories = $derived(Object.keys(monthStats.netByCategory));
  const spendingCategories = $derived(categories.filter(isSpendingCategory).sort(bySpentDescending));
  const incomeCategories = $derived(categories.filter(isIncomeCategory).sort(byIncomeDescending));
  const totalNetSpending = $derived(spendingCategories.reduce((sum, category) => sum + netSpentIn(category), 0));
  const accountsByAmount = $derived(Object.keys(monthStats.netByAccount).sort(byLargestAccountAmount));
  const isDayInMonth = (day: number) => day <= monthStats.daysInMonth;
  const sampleDays = $derived(SAMPLE_DAYS.filter(isDayInMonth));

  function showCategoryTransactions(category: string) {
    app.movementFilter.category = category;
    app.tab = 'transactions';
    window.scrollTo(0, 0);
  }
</script>

<MonthNav />

{#if !monthStats.transactionCount && !averagedMonthCount}
  <div class="card empty">
    {app.data.loaded ? 'No hay movimientos en este mes.' : 'Conecta tu planilla en Ajustes para ver el resumen.'}
  </div>
{:else}
  <div class="card">
    <div class="muted small">
      Gasto neto de {monthName(app.month).toLowerCase()}
    </div>
    <div class="hero">{formatMoney(netSpending)}</div>
    <div class="muted small">Gastos menos reintegros del mes</div>
    <div class="kpis">
      <div><small>Gastos</small><b>{formatMoney(monthStats.expenses)}</b></div>
      <div>
        <small>Reintegros</small><b>{formatMoney(monthStats.income)}</b>
      </div>
      {#if totalBudget}<div>
          <small>Presupuesto usado</small><b>{Math.round((budgetUsed / totalBudget) * 100)}%</b>
        </div>{/if}
    </div>
    {#if showDifferenceFromAverage}
      <div style="margin-top:8px">
        <div class="delta {differenceFromAverage > 0 ? 'bad' : 'good'}">
          {differenceFromAverage > 0 ? '▲' : '▼'} Gasto neto {formatMoney(Math.abs(differenceFromAverage))}
          {differenceFromAverage > 0 ? 'sobre' : 'bajo'} el promedio de {averageDescription}{isCurrentMonth
            ? ' a esta fecha'
            : ''}
        </div>
      </div>
    {/if}
  </div>

  <div class="card">
    <h2>Gasto neto acumulado</h2>
    <div class="chartwrap">
      <LineChart {currentSeries} {averageSeries} monthKey={app.month} {lastDrawnDay} />
    </div>
    <div class="legend">
      <span><i style="background:var(--accent)"></i>{monthName(app.month)}</span>
      {#if averagedMonthCount}
        <span
          ><i style="background:var(--prev)"></i>Promedio {averagedMonthCount >= MONTHS_IN_AVERAGE
            ? 'de 6 meses'
            : `de ${averagedMonthCount} ${averagedMonthCount === 1 ? 'mes' : 'meses'}`}</span
        >
      {/if}
    </div>
    <details class="tbl">
      <summary>Ver tabla</summary>
      <table class="t">
        <tbody>
          <tr><th>Día</th><th>{shortMonthName(app.month)}</th><th>Promedio</th></tr>
          {#each sampleDays as day (day)}
            <tr>
              <td>{day}</td>
              <td>{currentSeries[day] != null ? formatMoney(currentSeries[day]!) : '—'}</td>
              <td>{averageSeries[day] != null ? formatMoney(averageSeries[day]!) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  </div>

  <div class="card">
    <h2>Gasto neto de los últimos 6 meses</h2>
    <BarChart months={monthlyNetSpending} selectedMonthKey={app.month} />
    <details class="tbl">
      <summary>Ver tabla</summary>
      <table class="t">
        <tbody
          >{#each monthlyNetSpending as month (month.monthKey)}<tr
              ><td>{monthAndYear(month.monthKey)}</td><td>{formatMoney(month.netSpending)}</td></tr
            >{/each}</tbody
        >
      </table>
    </details>
  </div>

  <div class="card">
    <h2>Gasto neto por categoría</h2>
    <div class="muted small" style="margin:-4px 0 6px">
      Descuenta los reintegros que registres en la misma categoría.
    </div>
    {#each spendingCategories as category (category)}
      {@const spent = monthStats.netByCategory[category]}
      {@const budget = budgets[category] || 0}
      {@const isOverBudget = budget > 0 && spent > budget}
      {@const barPercent = budget
        ? Math.min(100, (spent / budget) * 100)
        : (spent / monthStats.netByCategory[spendingCategories[0]]) * 100}
      <button class="cat" onclick={() => showCategoryTransactions(category)}>
        <div class="top">
          <span>{category}</span><span>{formatMoney(spent)}</span>
        </div>
        <div class="bar" class:over={isOverBudget}>
          <i style="width:{barPercent.toFixed(1)}%"></i>
        </div>
        <div class="sub">
          <span>{totalNetSpending ? Math.round((spent / totalNetSpending) * 100) : 0}% del gasto neto</span>
          {#if isOverBudget}
            <span class="bad">⚠ Excedido en {formatMoney(spent - budget)} (ppto. {formatCompactMoney(budget)})</span>
          {:else if budget}
            <span>Quedan {formatMoney(budget - spent)} de {formatCompactMoney(budget)}</span>
          {:else}
            <span></span>
          {/if}
        </div>
      </button>
    {:else}
      <div class="empty">Sin gastos.</div>
    {/each}
    {#if !totalBudget}
      <div class="muted small" style="margin-top:8px">
        Define presupuestos por categoría en Ajustes para ver cuánto te queda.
      </div>
    {/if}
  </div>

  {#if incomeCategories.length}
    <div class="card">
      <h2>Ingresos y reintegros</h2>
      {#each incomeCategories as category (category)}
        <button class="cat" onclick={() => showCategoryTransactions(category)}>
          <div class="top">
            <span>{category}</span><span style="color:var(--good)"
              >+{formatMoney(-monthStats.netByCategory[category])}</span
            >
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="card">
    <h2>Gasto neto por cuenta</h2>
    {#each accountsByAmount as account (account)}
      <div class="line2">
        <span>{account}</span><b>{formatMoney(monthStats.netByAccount[account])}</b>
      </div>
    {:else}
      <div class="empty">Sin movimientos.</div>
    {/each}
  </div>
{/if}
