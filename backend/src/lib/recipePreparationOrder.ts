// Ordering references is mechanical; the model is unreliable at it, so the server enforces it.
// Sorts references inside each step, then the steps by first reference, and renumbers `order` only when a step moved.
export function sortExportStepsBySourceOrder<Draft>(raw: Draft): Draft {
  if (!raw || typeof raw !== 'object') return raw;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length < 1) return raw;
  const normalized: Array<Record<string, unknown>> = [];
  for (const step of steps) {
    const refs = step && typeof step === 'object' ? (step as { sourceStepOrders?: unknown }).sourceStepOrders : undefined;
    if (!Array.isArray(refs) || refs.length === 0 || !refs.every((ref) => typeof ref === 'number' && Number.isFinite(ref))) return raw;
    normalized.push({ ...(step as Record<string, unknown>), sourceStepOrders: [...(refs as number[])].sort((a, b) => a - b) });
  }
  const first = (step: Record<string, unknown>) => (step['sourceStepOrders'] as number[])[0]!;
  const indices = normalized.map((_, index) => index).sort((a, b) => first(normalized[a]!) - first(normalized[b]!) || a - b);
  const moved = indices.some((value, index) => value !== index);
  const refsChanged = normalized.some((step, index) =>
    (step['sourceStepOrders'] as number[]).some((ref, refIndex) => ref !== (steps[index] as { sourceStepOrders: number[] }).sourceStepOrders[refIndex]));
  if (!moved && !refsChanged) return raw;
  const sorted = indices.map((value, index) => (moved ? { ...normalized[value]!, order: index + 1 } : normalized[value]!));
  return { ...(raw as Record<string, unknown>), steps: sorted } as Draft;
}

// Last resort for an invalid reference trace: only sourceStepOrders change, the steps, their texts and their count never do.
// The references are server-side anchors, not part of any client contract; returns the input unchanged when a valid trace is impossible.
export function redistributeExportReferences<Draft>(raw: Draft): Draft {
  const sortedDraft = sortExportStepsBySourceOrder(raw);
  const steps = (sortedDraft as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps) || steps.length === 0) return sortedDraft;
  if (!steps.every((step) => Array.isArray((step as { sourceStepOrders?: unknown })?.sourceStepOrders))) return sortedDraft;
  const groups = (steps as Array<{ sourceStepOrders: number[] }>).map((step) => step.sourceStepOrders);
  if (!groups.every((group) => group.length > 0 && group.every((ref) => Number.isFinite(ref)))) return sortedDraft;
  const unique = [...new Set(groups.flat())].sort((a, b) => a - b);
  if (unique.length < steps.length) return sortedDraft;
  let pointer = 0;
  const redistributed = steps.map((step, index) => {
    const take = Math.max(1, Math.min(groups[index]!.length, unique.length - pointer - (steps.length - 1 - index)));
    const refs = unique.slice(pointer, pointer + take);
    pointer += take;
    return { ...(step as Record<string, unknown>), sourceStepOrders: refs };
  });
  return { ...(sortedDraft as Record<string, unknown>), steps: redistributed } as Draft;
}
