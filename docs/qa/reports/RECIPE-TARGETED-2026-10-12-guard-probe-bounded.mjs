import { enforceSourceBackedTotalTime as g } from '../../../backend/src/lib/recipeTotalTimeGuard.ts';
const digits = (n) => '1'.repeat(n);
const worst = { recipeContext: { description: digits(2000) }, steps: Array.from({ length: 50 }, () => ({ title: digits(200), description: digits(2000) })) };
const start = performance.now();
g({ totalTimeMinutes: 7 }, worst);
console.log(JSON.stringify({ boundedWorstCase50x2000digitsMs: Math.round(performance.now() - start) }));
