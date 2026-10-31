/* Cálculos de los gráficos de Resumen. */

/** Redondea hacia arriba a un valor "bonito" (1, 2, 2.5, 5, 10 × potencia de 10) para el eje de un gráfico. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / power;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * power;
}

/** Acumula el gasto diario hasta el día `upTo`; los días posteriores quedan en null (no se dibujan). */
export function cumulative(daily: number[], upTo: number): (number | null)[] {
  const out: (number | null)[] = [0];
  let sum = 0;
  for (let d = 1; d < daily.length; d++) {
    sum += daily[d];
    out.push(d <= upTo ? sum : null);
  }
  return out;
}
