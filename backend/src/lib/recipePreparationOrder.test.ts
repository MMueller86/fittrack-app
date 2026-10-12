import { describe, expect, it } from 'vitest';
import { redistributeExportReferences, sortExportStepsBySourceOrder } from './recipePreparationOrder';

const step = (order: number, sourceStepOrders: number[]) => ({ order, description: `Schritt ${order}`, sourceStepOrders });

describe('sortExportStepsBySourceOrder', () => {
  it('sorts the rice case 1,3,4,6,5 by first reference and renumbers without mutating the input', () => {
    const raw = { version: 1, steps: [step(1, [1, 2]), step(2, [3]), step(3, [4]), step(4, [6, 7]), step(5, [5])] };
    const before = structuredClone(raw);
    const result = sortExportStepsBySourceOrder(raw);
    expect(result.steps.map((s) => [s.order, s.sourceStepOrders])).toEqual([[1, [1, 2]], [2, [3]], [3, [4]], [4, [5]], [5, [6, 7]]]);
    expect(result.steps.map((s) => s.description)).toEqual(['Schritt 1', 'Schritt 2', 'Schritt 3', 'Schritt 5', 'Schritt 4']);
    expect(raw).toEqual(before);
  });

  it('sorts references inside a group without renumbering unmoved steps', () => {
    const result = sortExportStepsBySourceOrder({ steps: [step(1, [1]), step(2, [4, 5, 3])] });
    expect(result.steps.map((s) => [s.order, s.sourceStepOrders])).toEqual([[1, [1]], [2, [3, 4, 5]]]);
  });

  it('returns an already ascending draft unchanged', () => {
    const raw = { steps: [step(1, [1]), step(2, [2])] };
    expect(sortExportStepsBySourceOrder(raw)).toBe(raw);
  });

  it('keeps duplicates and malformed drafts for the validator to reject', () => {
    const malformed = { steps: [step(1, []), step(2, [1])] };
    expect(sortExportStepsBySourceOrder(malformed)).toBe(malformed);
    expect(sortExportStepsBySourceOrder(null)).toBeNull();
    const duplicate = sortExportStepsBySourceOrder({ steps: [step(1, [3]), step(2, [1]), step(3, [3])] });
    expect(duplicate.steps.map((s) => s.sourceStepOrders)).toEqual([[1], [3], [3]]);
  });
});

describe('redistributeExportReferences', () => {
  it('moves references so the trace ascends while keeping every step, text and group size', () => {
    const raw = { steps: [step(1, [1, 3]), step(2, [2])] };
    const result = redistributeExportReferences(raw);
    expect(result.steps.map((s) => [s.order, s.description, s.sourceStepOrders])).toEqual([[1, 'Schritt 1', [1, 2]], [2, 'Schritt 2', [3]]]);
    expect(raw.steps[0]!.sourceStepOrders).toEqual([1, 3]);
  });

  it('leaves the draft untouched when there are fewer distinct references than steps', () => {
    const raw = { steps: [step(1, [1]), step(2, [1])] };
    expect(redistributeExportReferences(raw).steps.map((s) => s.sourceStepOrders)).toEqual([[1], [1]]);
  });

  it('leaves malformed drafts untouched', () => {
    const malformed = { steps: [{ order: 1 }] };
    expect(redistributeExportReferences(malformed)).toBe(malformed);
  });
});
