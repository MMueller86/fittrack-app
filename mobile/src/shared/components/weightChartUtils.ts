/**
 * Computes clean Y-axis bounds with meaningful step intervals.
 *
 * Step selection:
 *   - data range ≤ 2 kg  → 0.5 kg steps
 *   - data range ≤ 10 kg → 1.0 kg steps
 *   - otherwise          → 2.0 kg steps
 *
 * Snaps yMin down and yMax up to the nearest step boundary, then adds
 * one extra step of padding on each side so data never touches the edges.
 */
export function computeChartBounds(
  dataMin: number,
  dataMax: number,
): { yMin: number; yMax: number; step: number; ticks: number[] } {
  const range = dataMax - dataMin;
  const step = range <= 2 ? 0.5 : range <= 10 ? 1.0 : 2.0;

  const yMin = Math.floor(dataMin / step) * step - step;
  const yMax = Math.ceil(dataMax / step) * step + step;

  const ticks: number[] = [];
  // Build ticks from bottom to top; round to avoid floating-point drift.
  for (let t = yMin; t <= yMax + step * 0.001; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }

  return { yMin, yMax, step, ticks };
}
