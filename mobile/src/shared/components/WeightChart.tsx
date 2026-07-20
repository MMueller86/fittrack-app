// WeightChart — smooth Catmull-Rom bezier curves, glowing latest-point
// indicator, inline SVG axis labels, and a compact legend.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Line as SvgLine,
  Text as SvgText,
} from 'react-native-svg';

import { colors, spacing, typography } from '../../app/theme';
import type { WeightEntry } from '@fittrack/shared';
import { computeChartBounds } from './weightChartUtils';

interface WeightChartProps {
  entries: WeightEntry[];
  windowDays?: number;
  height?: number;
  width: number;
  targetWeightKg?: number;
  showLegend?: boolean;
}

interface Point {
  x: number;
  y: number;
  value: number;
  date: string;
}

const PAD = { top: 20, right: 20, bottom: 36, left: 44 };

const LINE_COLOR   = '#8FD157';
const AVG_COLOR    = '#7CB9E8';
const TARGET_COLOR = '#F5A623';

function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - (window - 1));
    const slice = values.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${d}.${m}`;
}

function dateToMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).getTime();
}

function smoothPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
  }
  const t = 0.35;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function areaPath(pts: Point[], bottomY: number): string {
  if (pts.length < 2) return '';
  const last = pts[pts.length - 1];
  return `${smoothPath(pts)} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

const GAP_MS = 3 * 86_400_000;

function segmentize(points: Point[], data: { date: string }[]): Point[][] {
  if (points.length === 0) return [];
  const segments: Point[][] = [];
  let current: Point[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    if (dateToMs(data[i]!.date) - dateToMs(data[i - 1]!.date) > GAP_MS) {
      segments.push(current);
      current = [];
    }
    current.push(points[i]!);
  }
  segments.push(current);
  return segments.filter((s) => s.length > 0);
}

function gapFillPath(from: Point, to: Point, bottomY: number): string {
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)} L ${to.x.toFixed(2)} ${bottomY.toFixed(2)} L ${from.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
}

function gapLinePath(from: Point, to: Point): string {
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

export function WeightChart({
  entries,
  windowDays = 30,
  height = 220,
  width,
  targetWeightKg,
  showLegend = true,
}: WeightChartProps) {
  const data = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-windowDays);
  }, [entries, windowDays]);

  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          Füge mehr Einträge hinzu, um den Trend zu sehen.
        </Text>
      </View>
    );
  }

  const values = data.map((e) => e.value);
  const avg = movingAverage(values, 7);

  const minRaw = Math.min(...values, ...avg, ...(targetWeightKg !== undefined ? [targetWeightKg] : []));
  const maxRaw = Math.max(...values, ...avg, ...(targetWeightKg !== undefined ? [targetWeightKg] : []));
  const { yMin: min, yMax: max, ticks } = computeChartBounds(minRaw, maxRaw, targetWeightKg);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const bottomY = PAD.top + innerH;

  const firstMs   = dateToMs(data[0]!.date);
  const lastMs    = dateToMs(data[data.length - 1]!.date);
  const dateRange = Math.max(lastMs - firstMs, 1);

  const xFor = (i: number) =>
    PAD.left + ((dateToMs(data[i]!.date) - firstMs) / dateRange) * innerW;
  const yFor = (v: number) =>
    PAD.top + innerH - ((v - min) / (max - min)) * innerH;

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

  const actualSegments = segmentize(actualPoints, data);
  const avgSegments    = segmentize(avgPoints, data);

  const gapConnectors: Array<{ from: Point; to: Point }> = [];
  for (let i = 0; i < actualSegments.length - 1; i++) {
    const seg  = actualSegments[i]!;
    const next = actualSegments[i + 1]!;
    if (seg.length > 0 && next.length > 0) {
      gapConnectors.push({ from: seg[seg.length - 1]!, to: next[0]! });
    }
  }

  const n = actualPoints.length;
  const step = Math.max(1, Math.floor(n / 5));
  const dotIndices = new Set<number>();
  for (let i = 0; i < n; i += step) dotIndices.add(i);
  dotIndices.add(n - 1);

  const xLabelIdx = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  const pillW = 62;
  const pillH = 17;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={LINE_COLOR} stopOpacity="0.5" />
            <Stop offset="55%"  stopColor={LINE_COLOR} stopOpacity="0.1" />
            <Stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0"   />
          </LinearGradient>
          <LinearGradient id="areaGradGap" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={LINE_COLOR} stopOpacity="0.12" />
            <Stop offset="55%"  stopColor={LINE_COLOR} stopOpacity="0.04" />
            <Stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0"    />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {ticks.map((tick, i) => {
          const y = yFor(tick);
          return (
            <React.Fragment key={`grid-${i}`}>
              <SvgLine
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
                stroke={colors.chart.grid}
                strokeWidth={1}
                strokeDasharray="3,4"
              />
              <SvgText
                x={PAD.left - 5}
                y={y + 4}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {tick.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis labels */}
        {xLabelIdx.map((i) => (
          <SvgText
            key={`xlab-${i}`}
            x={xFor(i)}
            y={height - 10}
            fontSize={9}
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {formatShortDate(data[i].date)}
          </SvgText>
        ))}

        {/* Gap zones — dimmed fill rendered behind actual data */}
        {gapConnectors.map((gc, gi) => (
          <Path
            key={`gap-fill-${gi}`}
            d={gapFillPath(gc.from, gc.to, bottomY)}
            fill="url(#areaGradGap)"
          />
        ))}

        {/* Filled gradient area — one fill per continuous segment */}
        {actualSegments.map((seg, si) => (
          <Path key={`fill-${si}`} d={areaPath(seg, bottomY)} fill="url(#areaGrad)" />
        ))}

        {/* 7-day moving average — dashed, per segment */}
        {avgSegments.map((seg, si) => (
          <Path
            key={`avg-${si}`}
            d={smoothPath(seg)}
            fill="none"
            stroke={AVG_COLOR}
            strokeWidth={1.5}
            strokeDasharray="6,4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Actual weight — smooth bezier line, per segment */}
        {actualSegments.map((seg, si) => (
          <Path
            key={`line-${si}`}
            d={smoothPath(seg)}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Gap connectors — thin dashed line over dimmed fill */}
        {gapConnectors.map((gc, gi) => (
          <Path
            key={`gap-line-${gi}`}
            d={gapLinePath(gc.from, gc.to)}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1}
            strokeDasharray="4,3"
            strokeOpacity={0.35}
            strokeLinecap="round"
          />
        ))}

        {/* Dots — glow on latest, small on periodic points */}
        {actualPoints.map((p, i) => {
          if (!dotIndices.has(i)) return null;
          const isLast = i === n - 1;
          if (isLast) {
            return (
              <React.Fragment key={`dot-${i}`}>
                <Circle cx={p.x} cy={p.y} r={13} fill={LINE_COLOR} opacity={0.07} />
                <Circle cx={p.x} cy={p.y} r={7.5} fill={LINE_COLOR} opacity={0.16} />
                <Circle cx={p.x} cy={p.y} r={4.5} fill={LINE_COLOR} />
              </React.Fragment>
            );
          }
          return (
            <Circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill={colors.background}
              stroke={LINE_COLOR}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Target weight — dashed line + orange pill badge */}
        {targetWeightKg !== undefined && (() => {
          const ty = yFor(targetWeightKg);
          const inRange = ty >= PAD.top && ty <= PAD.top + innerH;
          if (!inRange) return null;
          const pillX = width - PAD.right - pillW;
          const pillY = ty - pillH / 2;
          return (
            <React.Fragment>
              <SvgLine
                x1={PAD.left}
                x2={pillX - 4}
                y1={ty}
                y2={ty}
                stroke={TARGET_COLOR}
                strokeWidth={1.5}
                strokeDasharray="6,4"
              />
              <Rect
                x={pillX}
                y={pillY}
                width={pillW}
                height={pillH}
                rx={pillH / 2}
                fill={TARGET_COLOR}
              />
              <SvgText
                x={pillX + pillW / 2}
                y={pillY + 11}
                fontSize={9.5}
                fontWeight="700"
                fill="#1A1A1A"
                textAnchor="middle"
              >
                Ziel {targetWeightKg.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })()}
      </Svg>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendLine} />
            <Text style={styles.legendLabel}>Gewicht</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendDash} />
            <Text style={styles.legendLabel}>Ø 7 Tage</Text>
          </View>
          {targetWeightKg !== undefined && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDash, { borderColor: TARGET_COLOR }]} />
              <Text style={styles.legendLabel}>Ziel</Text>
            </View>
          )}
        </View>
      )}
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
    gap: 5,
  },
  legendLine: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: LINE_COLOR,
  },
  legendDash: {
    width: 16,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: AVG_COLOR,
  },
  legendLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
