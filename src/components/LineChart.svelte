<script lang="ts">
  import { roundUpToNiceValue } from '../lib/charts';
  import { formatCompactMoney, formatMoney, shortMonthName } from '../lib/utils';

  let {
    currentSeries,
    averageSeries,
    monthKey,
    lastDrawnDay
  }: {
    currentSeries: (number | null)[];
    averageSeries: (number | null)[];
    monthKey: string;
    lastDrawnDay: number;
  } = $props();

  // Chart dimensions in SVG viewBox units
  const WIDTH = 340;
  const HEIGHT = 190;
  const PADDING_LEFT = 50;
  const PADDING_RIGHT = 44;
  const PADDING_TOP = 12;
  const PADDING_BOTTOM = 24;
  const PLOT_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const PLOT_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const AXIS_HEADROOM = 1.04;

  const totalDays = $derived(Math.max(currentSeries.length, averageSeries.length) - 1);

  // Zero can sit in the middle of the chart when refunds exceed expenses.
  const axisRange = $derived.by(() => {
    const values = [...currentSeries, ...averageSeries].filter((value): value is number => value != null);
    const highest = Math.max(0, ...values);
    const lowest = Math.max(0, ...values.map((value) => -value));
    const above = highest > 0 ? roundUpToNiceValue(highest * AXIS_HEADROOM) : 0;
    const below = lowest > 0 ? roundUpToNiceValue(lowest * AXIS_HEADROOM) : 0;
    return { above, below, total: above + below || 1 };
  });

  const xForDay = (day: number) => PADDING_LEFT + ((day - 1) / (totalDays - 1)) * PLOT_WIDTH;
  const yForAmount = (amount: number) => PADDING_TOP + ((axisRange.above - amount) / axisRange.total) * PLOT_HEIGHT;

  // Days without data (null) break the line into separate segments.
  function pathCommandFor(series: (number | null)[], day: number) {
    const amount = series[day];
    if (amount == null || day === 0) return '';
    const startsSegment = day === 1 || series[day - 1] == null;
    return (startsSegment ? 'M' : 'L') + xForDay(day).toFixed(1) + ' ' + yForAmount(amount).toFixed(1);
  }

  const pathFor = (series: (number | null)[]) => series.map((_, day) => pathCommandFor(series, day)).join('');

  const yTicks = $derived([
    ...new Set([axisRange.above, axisRange.above / 2, 0, -axisRange.below / 2, -axisRange.below])
  ]);
  const xTicks = $derived([1, 8, 15, 22, totalDays >= 29 ? 29 : totalDays]);
  const hasCurrentData = $derived(lastDrawnDay >= 1);
  const lastDay = $derived(Math.min(lastDrawnDay, totalDays));
  const lastCurrentAmount = $derived(
    hasCurrentData ? (currentSeries[Math.min(lastDrawnDay, currentSeries.length - 1)] ?? 0) : 0
  );
  const lastAverageAmount = $derived(averageSeries[averageSeries.length - 1]);

  let svgElement: SVGSVGElement;
  let hoveredPoint = $state<{ day: number; tooltipLeft: number } | null>(null);

  function showTooltipAt(event: PointerEvent) {
    const bounds = svgElement.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const day = Math.max(
      1,
      Math.min(totalDays, Math.round(1 + ((pointerX - PADDING_LEFT) / PLOT_WIDTH) * (totalDays - 1)))
    );
    const tooltipLeft = Math.max(60, Math.min(bounds.width - 60, (xForDay(day) / WIDTH) * bounds.width));
    hoveredPoint = { day, tooltipLeft };
  }
</script>

<svg
  bind:this={svgElement}
  class="chart"
  viewBox="0 0 {WIDTH} {HEIGHT}"
  role="img"
  aria-label="Gasto neto acumulado de {monthKey} comparado con el promedio de los meses anteriores"
>
  {#each yTicks as tick (tick)}
    <line
      class="grid"
      x1={PADDING_LEFT}
      x2={WIDTH - PADDING_RIGHT}
      y1={yForAmount(tick)}
      y2={yForAmount(tick)}
      style={tick === 0 ? 'stroke:var(--ink3)' : undefined}
    />
    <text x={PADDING_LEFT - 6} y={yForAmount(tick) + 3.5} text-anchor="end">{formatCompactMoney(tick)}</text>
  {/each}
  {#each xTicks as day (day)}
    <text x={xForDay(day)} y={HEIGHT - 6} text-anchor="middle">{day}</text>
  {/each}

  <path
    d={pathFor(averageSeries)}
    fill="none"
    stroke="var(--prev)"
    stroke-width="2"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <path
    d={pathFor(currentSeries)}
    fill="none"
    stroke="var(--accent)"
    stroke-width="2.4"
    stroke-linejoin="round"
    stroke-linecap="round"
  />

  {#if hasCurrentData}
    <circle
      cx={xForDay(lastDay)}
      cy={yForAmount(lastCurrentAmount)}
      r="4"
      fill="var(--accent)"
      stroke="var(--card)"
      stroke-width="2"
    />
    <text x={xForDay(lastDay) + 7} y={yForAmount(lastCurrentAmount) + 3.5} style="fill:var(--accent);font-weight:700"
      >{shortMonthName(monthKey)}</text
    >
  {/if}
  {#if lastAverageAmount != null}
    <text x={xForDay(averageSeries.length - 1) + 5} y={yForAmount(lastAverageAmount) + 3.5}>Prom.</text>
  {/if}

  <line
    y1={PADDING_TOP}
    y2={HEIGHT - PADDING_BOTTOM}
    x1={hoveredPoint ? xForDay(hoveredPoint.day) : 0}
    x2={hoveredPoint ? xForDay(hoveredPoint.day) : 0}
    stroke="var(--ink3)"
    stroke-width="1"
    visibility={hoveredPoint ? 'visible' : 'hidden'}
  />
  <rect
    role="presentation"
    x={PADDING_LEFT}
    y={PADDING_TOP}
    width={PLOT_WIDTH}
    height={PLOT_HEIGHT}
    fill="transparent"
    onpointermove={showTooltipAt}
    onpointerdown={showTooltipAt}
    onpointerleave={() => (hoveredPoint = null)}
  />
</svg>
{#if hoveredPoint}
  {@const currentAmount = currentSeries[hoveredPoint.day]}
  {@const averageAmount = averageSeries[hoveredPoint.day]}
  <div class="tip" style="left:{hoveredPoint.tooltipLeft}px;top:28px">
    <b>Día {hoveredPoint.day}</b>{shortMonthName(monthKey)}: {currentAmount != null
      ? formatMoney(currentAmount)
      : '—'}<br />
    Promedio 6 meses: {averageAmount != null ? formatMoney(averageAmount) : '—'}
  </div>
{/if}
