<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { niceMax } from '../lib/charts';
  import { money, monthLabel, monthShort, short } from '../lib/utils';

  let { items, selectedKey }: { items: { key: string; v: number }[]; selectedKey: string } = $props();

  const W = 340,
    H = 160,
    T = 20,
    B = 22,
    barWidth = 34;

  const count = $derived(items.length);
  const gap = $derived((W - count * barWidth) / (count + 1));
  const geo = $derived.by(() => {
    const maxPositive = Math.max(0, ...items.map((i) => i.v));
    const maxNegative = Math.max(0, ...items.map((i) => -i.v));
    const top = maxPositive > 0 ? niceMax(maxPositive) : 0;
    const bottom = maxNegative > 0 ? niceMax(maxNegative) : 0;
    const span = top + bottom || 1;
    const plotHeight = H - T - B - (bottom > 0 ? 14 : 0);
    return { zeroY: T + plotHeight * (top / span), scale: plotHeight / span };
  });

  /** Barra con las esquinas de la punta redondeadas, hacia arriba (v > 0) o hacia abajo (v < 0). */
  function barPath(x: number, height: number, up: boolean) {
    const { zeroY } = geo;
    const r = Math.min(4, height);
    return up
      ? `M${x} ${zeroY} V${zeroY - height + r} a${r} ${r} 0 0 1 ${r} -${r} h${barWidth - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${zeroY} Z`
      : `M${x} ${zeroY} V${zeroY + height - r} a${r} ${r} 0 0 0 ${r} ${r} h${barWidth - 2 * r} a${r} ${r} 0 0 0 ${r} -${r} V${zeroY} Z`;
  }
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Gasto neto de los últimos {count} meses">
  <line class="axis" x1="0" x2={W} y1={geo.zeroY} y2={geo.zeroY} stroke-width="1" />
  {#each items as item, i (item.key)}
    {@const x = gap + i * (barWidth + gap)}
    {@const height = Math.abs(item.v) * geo.scale}
    {@const selected = item.key === selectedKey}
    {@const emphasis = selected ? 'fill:var(--ink);font-weight:700' : ''}
    <!-- El rect transparente agranda el área de toque de cada barra. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <g
      style="cursor:pointer"
      role="button"
      tabindex="0"
      aria-label={monthLabel(item.key)}
      onclick={() => (app.month = item.key)}
      onkeydown={(e) => e.key === 'Enter' && (app.month = item.key)}
    >
      <rect x={x - 6} y="0" width={barWidth + 12} height={H} fill="transparent" />
      {#if item.v > 0}
        <path d={barPath(x, height, true)} fill={selected ? 'var(--accent)' : 'var(--accent-mid)'}
          ><title>{monthLabel(item.key)}: {money(item.v)}</title></path
        >
        <text x={x + barWidth / 2} y={geo.zeroY - height - 5} text-anchor="middle" style={emphasis}
          >{short(item.v)}</text
        >
      {:else if item.v < 0}
        <path d={barPath(x, height, false)} fill="var(--good)" fill-opacity={selected ? 1 : 0.55}
          ><title>{monthLabel(item.key)}: {money(item.v)}</title></path
        >
        <text x={x + barWidth / 2} y={geo.zeroY + height + 12} text-anchor="middle" style={emphasis}
          >{short(item.v)}</text
        >
      {/if}
      <text x={x + barWidth / 2} y={H - 7} text-anchor="middle" style={emphasis}>{monthShort(item.key)}</text>
    </g>
  {/each}
</svg>
