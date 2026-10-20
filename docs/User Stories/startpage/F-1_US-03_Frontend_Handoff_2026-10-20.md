# US-03 F-1 Frontend Handoff (2026-10-20)

Status: **F-1 implemented; automated mobile checks pass. Manual device evidence is UNVERIFIED. Q-1 and story acceptance are open.**

## Scope

Home coaching card with the Daily Insight pair and the detail view from a local snapshot; the separate Home Insight card is removed. No backend, shared-type, API, native dependency, or `app.config.js` change.

## Changed files

- `mobile/src/modules/home/HomeScreen.tsx`: passes `insight`, `insightDate`, feedback and CTA callbacks to `CoachingHeroCard`; removes the separate `InsightCard` and the client-side `INSIGHT_UNAVAILABLE` placeholder. Loading, `unavailable`, `quota_exceeded`, errors, and invalid fields resolve to no compact content (static greeting).
- `mobile/src/modules/home/HomeScreen.insight.test.tsx`: asserts no detail is mounted before "Mehr lesen".
- `mobile/src/modules/home/HomeScreen.layout.test.ts`: asserts the Home screen no longer renders `InsightCard` and wires the hero card to the insight.
- KB: `docs/kb/product/03-design-system.md`, `docs/kb/tech/03-mobile.md` (coaching card with short insight and detail action). `product/05-ux-patterns.md` already described the behavior.

Already present and unchanged by this step (existing uncommitted work, preserved): `CoachingHeroCard.tsx` (pair display, "Mehr lesen", snapshot detail), `InsightCard.tsx` (detail mode, feedback, CTA), `insightService.ts` (`hasCompactInsight`), and their tests.

## Behavior against the plan

- QA finding F7 (2026-10-20): `HomeScreen` no longer resets the insight to `null` on a same-day focus or refresh; the previous valid pair stays visible until the new response arrives. A new response without a valid pair or a request error shows the static greeting; a changed local date clears the previous insight. Covered by `HomeScreen.insight.test.tsx`.
- Pair shown only for `fresh`/`cached` with non-empty `greeting` (max 120) and `shortInsight` (max 240); otherwise the static greeting without short text or "Mehr lesen".
- "Mehr lesen" opens the exact displayed response and date as a local snapshot; refresh, day-type selection, and opening the detail trigger no request; an open detail is not replaced by a newer response.
- Focus/refresh loading, request-id race protection, selector, navigation, and the other Home cards are unchanged.

## Verification (2026-10-20)

- `npx vitest run --root mobile`: 89 test files passed.
- `npm run typecheck --workspace=@fittrack/mobile` and `--workspace=@fittrack/shared`: exit 0.
- `node scripts/check-encoding.mjs`: passed.

## Not verified

- AC-7 device matrix (320/360 dp, font scale 1.0/1.3, long names), Android back, TalkBack, and Safe Area on a physical device: **UNVERIFIED**. Unit tests cover structure (no `numberOfLines` on the short insight, 48 dp touch targets, 120/240 character limits) but are not device evidence.
- Backend content quality is not certified by F-1. B-1 was accepted by user decision on reduced criteria (validator checks structure and supplied numbers only); see the [B-1 handoff](B-1_US-03_Backend_Handoff_2026-10-16.md).
- No deployment, EAS build, or migration was performed.
