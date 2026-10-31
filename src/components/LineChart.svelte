<script lang="ts">
  import { niceMax } from '../lib/charts';
  import { money, monthShort, short } from '../lib/utils';

  let {
    current,
    previous,
    monthKey,
    cutoff
  }: { current: (number | null)[]; previous: (number | null)[]; monthKey: string; cutoff: number } = $props();

  /* Dimensiones (en unidades del viewBox del SVG). */
  const W = 340,
    H = 190,
    L = 50,
    R = 44,
    T = 12,
    B = 24;

  const days = $derived(Math.max(current.length, previous.length) - 1);
  const scale = $derived.by(() => {
    // El cero puede estar en medio si hay saldos negativos (más reintegros que gastos).
    const values = [...current, ...previous].filter((x): x is number => x != null);
    const maxPositive = Math.max(0, ...values);
    const maxNegative = Math.max(0, ...values.map((v) => -v));
    const top = maxPositive > 0 ? niceMax(maxPositive * 1.04) : 0;
    const bottom = maxNegative > 0 ? niceMax(maxNegative * 1.04) : 0;
    return { top, bottom, span: top + bottom || 1 };
  });

  const x = (day: number) => L + ((day - 1) / (days - 1)) * (W - L - R);
  const y = (value: number) => T + ((scale.top - value) / scale.span) * (H - T - B);
  const linePath = (series: (number | null)[]) =>
    series
      .map((v, d) => {
        if (v == null || d === 0) return '';
        const startsSegment = d === 1 || series[d - 1] == null;
        return (startsSegment ? 'M' : 'L') + x(d).toFixed(1) + ' ' + y(v).toFixed(1);
      })
      .join('');

  const yTicks = $derived([...new Set([scale.top, scale.top / 2, 0, -scale.bottom / 2, -scale.bottom])]);
  const xTicks = $derived([1, 8, 15, 22, days >= 29 ? 29 : days]);
  const hasCurrent = $derived(cutoff >= 1);
  const cutoffDay = $derived(Math.min(cutoff, days));
  const lastCurrent = $derived(hasCurrent ? (current[Math.min(cutoff, current.length - 1)] ?? 0) : 0);
  const lastPrevious = $derived(previous[previous.length - 1]);

  // Tooltip con los valores del día bajo el puntero.
  let svg: SVGSVGElement;
  let hover = $state<{ day: number; left: number } | null>(null);

  function show(e: PointerEvent) {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const day = Math.max(1, Math.min(days, Math.round(1 + ((px - L) / (W - L - R)) * (days - 1))));
    const left = Math.max(60, Math.min(rect.width - 60, (x(day) / W) * rect.width));
    hover = { day, left };
  }
</script>

<svg
  bind:this={svg}
  class="chart"
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Gasto neto acumulado de {monthKey} comparado con el promedio de los meses anteriores"
>
  {#each yTicks as t (t)}
    <line class="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} style={t === 0 ? 'stroke:var(--ink3)' : undefined} />
    <text x={L - 6} y={y(t) + 3.5} text-anchor="end">{short(t)}</text>
  {/each}
  {#each xTicks as d (d)}
    <text x={x(d)} y={H - 6} text-anchor="middle">{d}</text>
  {/each}

  <path
    d={linePath(previous)}
    fill="none"
    stroke="var(--prev)"
    stroke-width="2"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <path
    d={linePath(current)}
    fill="none"
    stroke="var(--accent)"
    stroke-width="2.4"
    stroke-linejoin="round"
    stroke-linecap="round"
  />

  {#if hasCurrent}
    <circle cx={x(cutoffDay)} cy={y(lastCurrent)} r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="2" />
    <text x={x(cutoffDay) + 7} y={y(lastCurrent) + 3.5} style="fill:var(--accent);font-weight:700"
      >{monthShort(monthKey)}</text
    >
  {/if}
  {#if lastPrevious != null}
    <text x={x(previous.length - 1) + 5} y={y(lastPrevious) + 3.5}>Prom.</text>
  {/if}

  <line
    y1={T}
    y2={H - B}
    x1={hover ? x(hover.day) : 0}
    x2={hover ? x(hover.day) : 0}
    stroke="var(--ink3)"
    stroke-width="1"
    visibility={hover ? 'visible' : 'hidden'}
  />
  <rect
    role="presentation"
    x={L}
    y={T}
    width={W - L - R}
    height={H - T - B}
    fill="transparent"
    onpointermove={show}
    onpointerdown={show}
    onpointerleave={() => (hover = null)}
  />
</svg>
{#if hover}
  <div class="tip" style="left:{hover.left}px;top:28px">
    <b>Día {hover.day}</b>{monthShort(monthKey)}: {current[hover.day] != null ? money(current[hover.day]!) : '—'}<br />
    Promedio 6 meses: {previous[hover.day] != null ? money(previous[hover.day]!) : '—'}
  </div>
{/if}
