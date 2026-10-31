<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { roundUpToNiceValue } from '../lib/charts';
  import { formatCompactMoney, formatMoney, monthAndYear, shortMonthName } from '../lib/utils';

  let { months, selectedMonthKey }: { months: { monthKey: string; netSpending: number }[]; selectedMonthKey: string } =
    $props();

  const WIDTH = 340;
  const HEIGHT = 160;
  const PADDING_TOP = 20;
  const PADDING_BOTTOM = 22;
  const BAR_WIDTH = 34;
  const MAX_CORNER_RADIUS = 4;
  const LABEL_ROOM_BELOW_AXIS = 14;

  const gap = $derived((WIDTH - months.length * BAR_WIDTH) / (months.length + 1));
  const layout = $derived.by(() => {
    const highest = Math.max(0, ...months.map((month) => month.netSpending));
    const lowest = Math.max(0, ...months.map((month) => -month.netSpending));
    const above = highest > 0 ? roundUpToNiceValue(highest) : 0;
    const below = lowest > 0 ? roundUpToNiceValue(lowest) : 0;
    const total = above + below || 1;
    const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM - (below > 0 ? LABEL_ROOM_BELOW_AXIS : 0);
    return { zeroY: PADDING_TOP + plotHeight * (above / total), pixelsPerPeso: plotHeight / total };
  });

  /** Bar with rounded corners on its free end: growing up from the axis, or down when the month closed in credit. */
  function barPath(x: number, height: number, growsUp: boolean) {
    const radius = Math.min(MAX_CORNER_RADIUS, height);
    const { zeroY } = layout;
    return growsUp
      ? `M${x} ${zeroY} V${zeroY - height + radius} a${radius} ${radius} 0 0 1 ${radius} -${radius} h${BAR_WIDTH - 2 * radius} a${radius} ${radius} 0 0 1 ${radius} ${radius} V${zeroY} Z`
      : `M${x} ${zeroY} V${zeroY + height - radius} a${radius} ${radius} 0 0 0 ${radius} ${radius} h${BAR_WIDTH - 2 * radius} a${radius} ${radius} 0 0 0 ${radius} -${radius} V${zeroY} Z`;
  }

  const selectMonth = (monthKey: string) => (app.month = monthKey);
</script>

<svg
  class="chart"
  viewBox="0 0 {WIDTH} {HEIGHT}"
  role="img"
  aria-label="Gasto neto de los últimos {months.length} meses"
>
  <line class="axis" x1="0" x2={WIDTH} y1={layout.zeroY} y2={layout.zeroY} stroke-width="1" />
  {#each months as month, index (month.monthKey)}
    {@const x = gap + index * (BAR_WIDTH + gap)}
    {@const barHeight = Math.abs(month.netSpending) * layout.pixelsPerPeso}
    {@const isSelected = month.monthKey === selectedMonthKey}
    {@const labelStyle = isSelected ? 'fill:var(--ink);font-weight:700' : ''}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <g
      style="cursor:pointer"
      role="button"
      tabindex="0"
      aria-label={monthAndYear(month.monthKey)}
      onclick={() => selectMonth(month.monthKey)}
      onkeydown={(event) => event.key === 'Enter' && selectMonth(month.monthKey)}
    >
      <!-- transparent rectangle that enlarges the touch area of each bar -->
      <rect x={x - 6} y="0" width={BAR_WIDTH + 12} height={HEIGHT} fill="transparent" />
      {#if month.netSpending > 0}
        <path d={barPath(x, barHeight, true)} fill={isSelected ? 'var(--accent)' : 'var(--accent-mid)'}>
          <title>{monthAndYear(month.monthKey)}: {formatMoney(month.netSpending)}</title>
        </path>
        <text x={x + BAR_WIDTH / 2} y={layout.zeroY - barHeight - 5} text-anchor="middle" style={labelStyle}
          >{formatCompactMoney(month.netSpending)}</text
        >
      {:else if month.netSpending < 0}
        <path d={barPath(x, barHeight, false)} fill="var(--good)" fill-opacity={isSelected ? 1 : 0.55}>
          <title>{monthAndYear(month.monthKey)}: {formatMoney(month.netSpending)}</title>
        </path>
        <text x={x + BAR_WIDTH / 2} y={layout.zeroY + barHeight + 12} text-anchor="middle" style={labelStyle}
          >{formatCompactMoney(month.netSpending)}</text
        >
      {/if}
      <text x={x + BAR_WIDTH / 2} y={HEIGHT - 7} text-anchor="middle" style={labelStyle}
        >{shortMonthName(month.monthKey)}</text
      >
    </g>
  {/each}
</svg>
