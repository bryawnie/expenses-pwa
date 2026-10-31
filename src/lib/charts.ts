/** Rounds up to 1, 2, 2.5, 5 or 10 times a power of ten, so axes end on a round number. */
export function roundUpToNiceValue(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / magnitude;
  const niceMantissa = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 2.5 ? 2.5 : mantissa <= 5 ? 5 : 10;
  return niceMantissa * magnitude;
}

/** Running total of `dailyNet` (index 0 is unused); days after `lastDay` are null so they are not drawn. */
export function accumulateDaily(dailyNet: number[], lastDay: number): (number | null)[] {
  const accumulated: (number | null)[] = [0];
  let runningTotal = 0;
  for (let day = 1; day < dailyNet.length; day++) {
    runningTotal += dailyNet[day];
    accumulated.push(day <= lastDay ? runningTotal : null);
  }
  return accumulated;
}
