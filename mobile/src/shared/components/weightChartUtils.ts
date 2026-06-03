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
 *
 * When `targetWeightKg` is provided, it is included in the range so the
 * target line is always visible inside the chart area.
 */
export function computeChartBounds(
  dataMin: number,
  dataMax: number,
  targetWeightKg?: number,
): { yMin: number; yMax: number; step: number; ticks: number[] } {
  const effectiveMin = targetWeightKg !== undefined ? Math.min(dataMin, targetWeightKg) : dataMin;
  const effectiveMax = targetWeightKg !== undefined ? Math.max(dataMax, targetWeightKg) : dataMax;

  const range = effectiveMax - effectiveMin;
  const step = range <= 2 ? 0.5 : range <= 10 ? 1.0 : 2.0;

  const yMin = Math.floor(effectiveMin / step) * step - step;
  const yMax = Math.ceil(effectiveMax / step) * step + step;

  const ticks: number[] = [];
  // Build ticks from bottom to top; round to avoid floating-point drift.
  for (let t = yMin; t <= yMax + step * 0.001; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }

  return { yMin, yMax, step, ticks };
}
