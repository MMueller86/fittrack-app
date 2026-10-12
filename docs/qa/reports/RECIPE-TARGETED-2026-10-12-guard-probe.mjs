import { enforceSourceBackedTotalTime as g } from '../../../backend/src/lib/recipeTotalTimeGuard.ts';
const src = (steps, description) => ({ recipeContext: { description }, steps: steps.map((d) => ({ description: d })) });
const t = (n, s) => g({ totalTimeMinutes: n }, s).totalTimeMinutes;
const cases = {
  rangeStep40to45_draft40: t(40, src(['Backe 40-45 Minuten.'])),
  rangeStep40to45_draft45: t(45, src(['Backe 40-45 Minuten.'], 'Gesamtzeit: 45 Minuten')),
  insgesamtFalsePositive_draft40: t(40, src(['Wende insgesamt dreimal, dann 40 Minuten backen.', 'Schneide.'])),
  gesamtmengeFalsePositive_draft30: t(30, src(['Gesamtmenge verteilen, 30 Min. ruhen.', 'Schneide.'])),
  hours_h_draft120: t(120, src(['Schmore 2 h.'], 'Gesamt 2 h')),
  stuckDigit_draft5: t(5, src(['Fertig in 5 Minuten insgesamt'])),
  gesamtzeitNoUnitDraft60: t(60, src(['x'], 'Gesamtzeit 1 Stunde')),
  decimalComma_draft90: t(90, src(['x'], 'Gesamtzeit 1,5 Std.')),
  sekunden_draft1: t(1, src(['Röste 60 Sekunden.'])),
  nonInteger: g({ totalTimeMinutes: 12.5 }, src(['x'])).totalTimeMinutes,
  zero: g({ totalTimeMinutes: 0 }, src(['x'])).totalTimeMinutes,
};
const timing = {};
for (const [name, text] of Object.entries({
  digits20k: '1'.repeat(20000),
  digitsSpace20k: '1 '.repeat(10000),
  gesamt20k: 'gesamt '.repeat(3000),
  gesamtDigits: 'gesamt ' + '9'.repeat(15000),
  minutes20k: '5 Min. '.repeat(3000),
  hourMin20k: '1 Std. 2 '.repeat(2000),
})) {
  const start = performance.now();
  g({ totalTimeMinutes: 7 }, src([text], text));
  timing[name] = Math.round(performance.now() - start) + ' ms';
}
console.log(JSON.stringify({ cases, timing }, null, 1));
