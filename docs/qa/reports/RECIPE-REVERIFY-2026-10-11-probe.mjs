// QA-only probe: exercises the new pure server-side helpers with edge cases; no provider calls, no production edits.
import { sortExportStepsBySourceOrder, forceAscendingExportReferences } from '../../../backend/src/lib/recipePreparationOrder.ts';
import { enforceSourceBackedTotalTime } from '../../../backend/src/lib/recipeTotalTimeGuard.ts';

const step = (order, description, refs) => ({ order, description, sourceStepOrders: refs });
const out = {};

// 1. Sort: rice FIRST inversion becomes a valid order; text keeps pairing with refs.
out.sortRiceInversion = sortExportStepsBySourceOrder({ steps: [step(1, 'cut', [1, 2]), step(2, 'fry', [3, 4]), step(3, 'finish chicken', [6]), step(4, 'cook rice', [5]), step(5, 'serve', [8])] }).steps.map((s) => `${s.order}:${s.description}:${s.sourceStepOrders}`);
// 2. Sort cannot hide duplicates (still duplicated afterwards -> validator would 422).
out.sortKeepsDuplicates = sortExportStepsBySourceOrder({ steps: [step(1, 'a', [3]), step(2, 'b', [3, 4])] }).steps.map((s) => s.sourceStepOrders);
out.sortKeepsIntraDuplicate = sortExportStepsBySourceOrder({ steps: [step(1, 'a', [2, 2])] }).steps[0].sourceStepOrders;
// 3. Sort leaves malformed refs untouched (empty / non-number).
const malformed = { steps: [step(1, 'a', []), step(2, 'b', [1])] };
out.sortMalformedUntouched = sortExportStepsBySourceOrder(malformed) === malformed;
// 4. Sort: text pairing is by object; a mis-referenced step silently moves (documented limit).
out.sortMisreferenced = sortExportStepsBySourceOrder({ steps: [step(1, 'Serve at the end', [2]), step(2, 'Chop onions first', [1])] }).steps.map((s) => s.description);
// 5. Force: interleaving [1,4,6],[5] drops cooking step 5 silently (Import policy is global ascending).
out.forceInterleave = forceAscendingExportReferences({ steps: [step(1, 'prep+fry+finish', [1, 4, 6]), step(2, 'cook rice', [5]), step(3, 'serve', [8])] }).steps.map((s) => `${s.order}:${s.description}:${s.sourceStepOrders}`);
// 6. Force: duplicate trace [1,2,3,4,5],[5] drops the garnish step.
out.forceDuplicate = forceAscendingExportReferences({ steps: [step(1, 'a', [1, 2, 3]), step(2, 'mix', [4, 5]), step(3, 'garnish', [5])] }).steps.map((s) => `${s.order}:${s.description}:${s.sourceStepOrders}`);

// 7. Total-time guard.
const mk = (steps, description) => ({ recipeContext: { description }, steps: steps.map((d, i) => ({ order: i + 1, description: d })) });
const g = (total, source) => enforceSourceBackedTotalTime({ totalTimeMinutes: total }, source).totalTimeMinutes;
out.guardExplicitTotal = g(50, mk(['Mix', 'Bake'], 'Gesamtzeit: 50 Minuten'));
out.guardExplicitTotalHoursMinutes = g(90, mk(['Mix', 'Bake'], 'Gesamtzeit: 1 Std. 30 Min.'));
out.guardPrepPlusCook = g(45, mk(['Mix', 'Bake'], 'Zubereitung 15 Minuten, Backen 30 Minuten'));
out.guardAllTimedSum = g(25, mk(['Sauce 15 Minuten kochen', 'Nudeln 10 Minuten kochen'], ''));
out.guardAllTimedWrongSum = g(90, mk(['Sauce 15 Minuten kochen', 'Nudeln 10 Minuten kochen'], ''));
out.guardUntimed = g(40, mk(['Slice', 'Bake 40 Minuten'], ''));
out.guardNullPassThrough = g(null, mk(['x'], ''));

console.log(JSON.stringify(out, null, 2));
