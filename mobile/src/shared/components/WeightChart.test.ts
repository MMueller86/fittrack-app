import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WeightEntry } from '@fittrack/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { colors } from '../../app/theme';
import { computeChartBounds } from './weightChartUtils';

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text', View: 'View',
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'LinearGradient',
  Path: 'Path', Rect: 'Rect', Stop: 'Stop', Line: 'SvgLine', Text: 'SvgText',
}));

import { WeightChart } from './WeightChart';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const activeRenderers: ReactTestRenderer[] = [];
afterEach(() => {
  while (activeRenderers.length) act(() => activeRenderers.pop()!.unmount());
});

describe('WeightChart seven-day view', () => {
  function renderChart(): ReactTestRenderer {
    const entries: WeightEntry[] = ['2026-10-12', '2026-10-14'].map((date, index) => ({
      id: `weight-${index}`, userId: 'user-1', date, value: 80 + index * 0.4,
      unit: 'kg', createdAt: `${date}T08:00:00.000Z`,
    }));
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(WeightChart, {
        entries, width: 324, targetWeightKg: 60,
        calendarWindow: { firstDate: '2026-10-10', lastDate: '2026-10-16' },
      }));
    });
    activeRenderers.push(renderer);
    return renderer;
  }

  it('spans the entire calendar week, not just the measured dates', () => {
    const renderer = renderChart();
    const firstLabel = renderer.root.findAll((node) => node.type === 'SvgText' && node.props.children === '10.10')[0]!;
    const lastLabel = renderer.root.findAll((node) => node.type === 'SvgText' && node.props.children === '16.10')[0]!;
    const latestPoint = renderer.root.findAll((node) => node.type === 'Circle' && node.props.r === 4.5)[0]!;

    expect(firstLabel.props.x).toBe(44);
    expect(lastLabel.props.x).toBe(304);
    expect(latestPoint.props.cx).toBeCloseTo(44 + 4 / 6 * 260);
  });

  it('includes an out-of-range goal in the chart and legend', () => {
    const renderer = renderChart();
    const targetLine = renderer.root.findAll((node) => node.type === 'SvgLine' && node.props.stroke === colors.warning)[0]!;

    expect(renderer.root.findAll((node) => node.type === 'Rect')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Ziel')).toHaveLength(1);
    expect(targetLine.props.y1).toBeGreaterThanOrEqual(20);
    expect(targetLine.props.y1).toBeLessThanOrEqual(184);
  });

  it('scales the blue calendar average line with the selected day range', () => {
    const entries: WeightEntry[] = [
      { id: 'old', userId: 'user-1', date: '2026-10-01', value: 80, unit: 'kg', createdAt: '2026-10-01T08:00:00.000Z' },
      { id: 'middle', userId: 'user-1', date: '2026-10-10', value: 70, unit: 'kg', createdAt: '2026-10-10T08:00:00.000Z' },
      { id: 'latest', userId: 'user-1', date: '2026-10-16', value: 60, unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z' },
    ];
    const renderAverage = (averageWindowDays: 7 | 30) => {
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(React.createElement(WeightChart, {
          entries: entries.slice(1),
          averageEntries: entries,
          averageWindowDays,
          width: 324,
        }));
      });
      activeRenderers.push(renderer);
      return renderer;
    };

    const sevenDayRenderer = renderAverage(7);
    const thirtyDayRenderer = renderAverage(30);
    const getAveragePath = (renderer: ReactTestRenderer) => renderer.root.findAll((node) =>
      node.type === 'Path' && node.props.stroke === colors.chart.average,
    )[0]!.props.d;

    expect(getAveragePath(sevenDayRenderer)).not.toBe(getAveragePath(thirtyDayRenderer));
    expect(sevenDayRenderer.root.findAll((node) => node.type === 'Text').map((node) => node.props.children))
      .toContain('Gleitender Ø 7T');
    expect(thirtyDayRenderer.root.findAll((node) => node.type === 'Text').map((node) => node.props.children))
      .toContain('Gleitender Ø 30T');
  });

  it('shows three clear dash marks for the rolling-average legend key', () => {
    const entries: WeightEntry[] = ['2026-10-12', '2026-10-16'].map((date, index) => ({
      id: `weight-${index}`, userId: 'user-1', date, value: 80 + index,
      unit: 'kg', createdAt: `${date}T08:00:00.000Z`,
    }));
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(WeightChart, {
        entries, width: 324, averageWindowDays: 90,
      }));
    });
    activeRenderers.push(renderer);

    expect(renderer.root.findAll((node) => node.props.testID === 'weight-average-legend-dash')).toHaveLength(3);
    expect(renderer.root.findAll((node) => node.type === 'Text')
      .map((node) => node.props.children)).toContain('Gleitender Ø 90T');
  });
});

describe('computeChartBounds', () => {
  it('uses 0.5 kg steps for a small range (≤ 2 kg)', () => {
    const { step, ticks } = computeChartBounds(79.0, 80.5);
    expect(step).toBe(0.5);
    // All ticks must be multiples of 0.5
    for (const t of ticks) {
      expect(Math.round(t * 2) / 2).toBeCloseTo(t, 5);
    }
  });

  it('uses 1.0 kg steps for a medium range (2–10 kg)', () => {
    const { step } = computeChartBounds(75.0, 80.0);
    expect(step).toBe(1.0);
  });

  it('uses 2.0 kg steps for a large range (> 10 kg)', () => {
    const { step } = computeChartBounds(60.0, 85.0);
    expect(step).toBe(2.0);
  });

  it('pads yMin below dataMin by at least one step', () => {
    const { yMin } = computeChartBounds(79.2, 81.0);
    expect(yMin).toBeLessThan(79.2);
  });

  it('pads yMax above dataMax by at least one step', () => {
    const { yMax } = computeChartBounds(79.0, 80.8);
    expect(yMax).toBeGreaterThan(80.8);
  });

  it('ticks are monotonically increasing in 0.5 steps', () => {
    const { ticks, step } = computeChartBounds(79.1, 80.9);
    expect(step).toBe(0.5);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(0.5, 5);
    }
  });

  it('first tick ≤ yMin and last tick ≥ yMax', () => {
    const bounds = computeChartBounds(79.3, 80.7);
    expect(bounds.ticks[0]).toBeCloseTo(bounds.yMin, 5);
    expect(bounds.ticks[bounds.ticks.length - 1]).toBeCloseTo(bounds.yMax, 5);
  });

  it('handles identical min and max (flat line)', () => {
    const { step, ticks } = computeChartBounds(80.0, 80.0);
    expect(step).toBe(0.5);
    expect(ticks.length).toBeGreaterThan(2);
  });
});
