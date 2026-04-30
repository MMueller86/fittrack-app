// Lightweight weight-history chart, drawn directly with react-native-svg.
//
// Renders two polylines for the last N days of `entries` (chronologically
// ascending):
//   - "actual" — solid bright-green line + filled gradient area + dots
//   - "average" — dashed lighter line for the 7-day moving average
//
// Why not a chart library? The data is tiny (≤30 points) and the visual
// requirements are specific. Using `react-native-svg` directly keeps
// dependencies minimal and the result Expo-Go safe.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Line as SvgLine,
} from 'react-native-svg';

import { colors, spacing, typography } from '../../app/theme';
import type { WeightEntry } from '@fittrack/shared';

interface WeightChartProps {
  entries: WeightEntry[]; // any order — we sort internally
  windowDays?: number;    // default 30
  height?: number;
  width: number;          // caller passes available width
}

interface Point {
  x: number;
  y: number;
  value: number;
  date: string;
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 36 };

/**
 * 7-day trailing simple moving average. For index `i`, averages
 * `values[max(0, i-6)..i]`. With <7 points, averages over what's there.
 */
function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - (window - 1));
    const slice = values.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function formatShortDate(iso: string): string {
  // YYYY-MM-DD → DD.MM
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${d}.${m}`;
}

export function WeightChart({
  entries,
  windowDays = 30,
  height = 220,
  width,
}: WeightChartProps) {
  const data = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-windowDays);
  }, [entries, windowDays]);

  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          Add a couple more entries to see your trend chart.
        </Text>
      </View>
    );
  }

  const values = data.map((e) => e.value);
  const avg = movingAverage(values, 7);

  const minRaw = Math.min(...values, ...avg);
  const maxRaw = Math.max(...values, ...avg);
  // Pad the range so the line never hugs the edges.
  const range = Math.max(maxRaw - minRaw, 0.4);
  const min = minRaw - range * 0.1;
  const max = maxRaw + range * 0.1;

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const xFor = (i: number) =>
    PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) =>
    PADDING.top + innerH - ((v - min) / (max - min)) * innerH;

  const actualPoints: Point[] = data.map((e, i) => ({
    x: xFor(i),
    y: yFor(e.value),
    value: e.value,
    date: e.date,
  }));
  const avgPoints: Point[] = avg.map((v, i) => ({
    x: xFor(i),
    y: yFor(v),
    value: v,
    date: data[i].date,
  }));

  const actualPolyline = actualPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const avgPolyline = avgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Filled area path under the actual line.
  const areaPath =
    `M ${actualPoints[0].x} ${PADDING.top + innerH} ` +
    actualPoints.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${actualPoints[actualPoints.length - 1].x} ${PADDING.top + innerH} Z`;

  // Y-axis ticks: min, mid, max.
  const ticks = [max, (max + min) / 2, min];

  // X-axis labels: first, middle, last entry. Dedupe so we never render
  // two labels with the same key when there are ≤ 2 data points.
  const xLabelIdx = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
  );

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.chart.gradientFrom} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.chart.gradientTo} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid + Y labels */}
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <React.Fragment key={`grid-${i}`}>
              <SvgLine
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y}
                y2={y}
                stroke={colors.chart.grid}
                strokeWidth={1}
                strokeDasharray="3,4"
              />
            </React.Fragment>
          );
        })}

        {/* Filled area under actual */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* 7-day moving average — dashed */}
        <Polyline
          points={avgPolyline}
          fill="none"
          stroke={colors.chart.average}
          strokeWidth={2}
          strokeDasharray="6,5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Actual values — solid */}
        <Polyline
          points={actualPolyline}
          fill="none"
          stroke={colors.chart.line}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots on each actual point */}
        {actualPoints.map((p, i) => (
          <Circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={colors.background}
            stroke={colors.chart.line}
            strokeWidth={2}
          />
        ))}
      </Svg>

      {/* Y-axis labels (overlaid) */}
      <View style={[styles.yLabels, { height, top: 0 }]} pointerEvents="none">
        {ticks.map((t, i) => (
          <Text
            key={`ylab-${i}`}
            style={[
              styles.axisLabel,
              {
                position: 'absolute',
                left: 0,
                top: yFor(t) - 7,
                width: PADDING.left - 4,
                textAlign: 'right',
              },
            ]}
          >
            {t.toFixed(1)}
          </Text>
        ))}
      </View>

      {/* X-axis labels */}
      <View style={styles.xLabels} pointerEvents="none">
        {xLabelIdx.map((i) => (
          <Text
            key={`xlab-${i}`}
            style={[
              styles.axisLabel,
              {
                position: 'absolute',
                left: xFor(i) - 24,
                width: 48,
                textAlign: 'center',
              },
            ]}
          >
            {formatShortDate(data[i].date)}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.chart.line }]} />
          <Text style={styles.legendText}>Actual</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatchDashed, { borderColor: colors.chart.average }]} />
          <Text style={styles.legendText}>7-day avg</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  xLabels: {
    height: 18,
    position: 'relative',
    marginTop: -8,
  },
  axisLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingRight: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  swatchDashed: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
