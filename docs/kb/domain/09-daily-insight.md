# Daily Insight

Status: Current product and backend behavior. This is the central source for
Daily Insight rules; API, mobile, testing, and diary documents link here instead
of defining these rules independently.

## Server Validation Scope (2026-10-20)

The runtime validator (`backend/src/lib/dailyInsightValidation.ts`) enforces
only structure and supplied numbers: strict schema and length limits, the
greeting format with the context name and one emoji,
`shortInsight` as one plain sentence, and that every `kcal`/`Kalorien` number
was supplied in the context. It does not judge wording. Keyword-based semantic
rules (activity completion, stale-weight markers, energy balance, protein and
meal wording, historical days, tone phrases, open-budget advice) were removed by
user decision because wording-pattern checks rejected correct outputs. These
rules now live only in the prompt; the live Daily eval checks structure and
supplied numbers, and wording is reviewed manually from the saved artifacts.
Older sections of this and linked documents that describe those validator rules
or eval phrase lists describe the previous behavior and no longer apply.

## Purpose and API Boundary

Daily Insight creates one personalized briefing through the existing
authenticated `GET /api/ai/daily-insight` request. One model generation returns
the greeting, compact sentence, headline, summary, and optional recommendation
as plain text. The API has no CTA or navigation fields. The server owns data selection, calculations, intent selection,
recommendation eligibility, and validation. Expanding the insight inline makes
no extra request.

The request parameters, authentication, quota, cache identity, refresh triggers,
local-midnight TTL, and persistence model remain unchanged. There is no new
endpoint, data source, container, migration, or deployment in this feature.

## Output Contract

- Successful generated responses include a non-empty `greeting` and
  `shortInsight` together. The API fields remain optional for cached legacy,
  unavailable, and quota responses.
- The greeting uses `Hallo, <Name>! <Emoji>` and is time-neutral. The existing
  `Sportler` name fallback remains.
- `shortInsight` is one complete German sentence of at most 240 characters,
  consistent with and fully supported by the summary.
- `title` is at most 40 characters. `summary` has no minimum word count and is
  limited to 5,000 characters. `recommendation` is optional plain text; the
  provider schema and API response contain no CTA or navigation fields.
- Structured Output is strict. Provider output is validated before persistence
  or usage tracking; invalid output follows the existing `unavailable`
  response path.

## Trusted Signals and Composition

The server computes and supplies the effective calorie target, logged current-day
nutrition, calorie remainder, protein status, meal-advice permission, the latest
weight and Home-compatible 14-day trend, the user goal, milestone facts, and
special-activity facts. The model must not recompute these values from raw data.
Other weight-derived phase, plateau, monthly, and long-term progress signals are
not included in the provider prompt.

Daily nutrition and activity claims describe only the requested current moment;
prior-day diary values, targets, and activities are not evidence for today's
briefing. Missing values remain unknown rather than zero. The Home-compatible
weight trend and an available milestone may inform the briefing. The selected
intent uses a milestone as the only weight-derived focus signal.

## Nutrition Rules

### Calories

- Compare intake only with the supplied effective daily target. Its goal
  adjustment and any activity bonus are already included.
- An intake within the target is not described as too much, including for a
  weight-loss goal. A consistent negative remainder may be described as above
  today's target in a supportive, non-judgmental tone.
- A target relation does not establish physiological energy balance. The term
  `Kalorienüberschuss` and unsupported claims of an achieved energy deficit or
  surplus are prohibited.
- Missing or inconsistent intake, target, or remainder does not establish an
  over-target relation. Numbers may only be assigned to their matching
  server-provided fields.

### Protein and Meal Advice

- The server classifies protein using the 1.5-2.0 g/kg range. Below 1.5 is
  `below_range`; 1.5 through 2.0 is `in_range`; above 2.0 and below 2.5 is
  `above_range`; 2.5 or more is `at_or_above_2_5_g_per_kg`. Missing or stale
  weight makes this status `unknown`.
- A below-range status may be stated even when calorie-target-relative meal
  advice is disallowed. The model must not infer protein status itself.
- Concrete food, meal, or snack advice is permitted only when at least one
  stored item exists in each of breakfast, lunch, and dinner, and at least
  300 kcal remain. Empty meal sections do not count. Advice is optional when
  permitted and is not required for a successful evaluation.
- Above 2.0 and below 2.5 g/kg does not require a warning. At 2.5 g/kg or more,
  a non-alarmist optional note is allowed when the data is reliable.

## Activity and Weight

- A stored activity on a past local date is treated as completed. For today's
  activity, completion may be assumed only at local hours 22-23; before then,
  completion is unknown. Unknown does not authorize a completion claim.
- Long or intensive endurance activity may receive fueling, fluid, and recovery
  guidance. The current approved prompt requires carbohydrate or energy,
  fluids, and recovery or rest to be named in the same output for this case.
  This guidance does not make meal advice eligible when the meal-advice guard
  is false.
- Weight direction uses the same series as Home: a linear regression over 14
  local calendar days, excluding future measurements, requiring at least 7
  measurements, and treating absolute slopes below 0.05 kg/week as neutral.
  The prompt receives only that direction, not a latest-versus-previous
  comparison or the internal 30-day trend. A missing Home trend remains unknown.
  Measurements older than 14 days are stale and cannot be presented as current;
  the specific protein classification is also unknown when weight is stale.

## Mobile Behavior

The Home coaching card displays compact copy only for a complete, non-empty
`greeting`/`shortInsight` pair on a `fresh` or `cached` response and within the
120/240-character limits. Otherwise it uses the existing static greeting and
shows no compact sentence or detail action. `Mehr anzeigen` expands the complete
insight inline in the same card and becomes `Weniger anzeigen`; changing the
insight version or date collapses it. Expansion does not fetch or regenerate
the insight. The Daily API does not emit an action button. Existing feedback
provenance is preserved.

## Verification and Scope

The current candidate is release v31, prompt v30, assembly v14,
fingerprint `sha256:e23c5274df5afabbd3812c53a773ab88b31ee7239785bcf8e0065ff63184ea2a`.
Prompt v30 aligns the model's weight direction with Home and preserves milestone facts while
excluding other weight-derived progress signals from the provider input. Its
live evaluation and QA acceptance are pending. Release v29 / prompt
v28 remains unchanged as the previously accepted B-1 basis. Prompt v28 added a shared-tone rule: with
more than 14 days since the last weight measurement, the `title` must not mention
weight, trend, or kg; the stale marker belongs in `shortInsight`. v29 adds prompt
guidance for the protein statuses above the range: `in_range` is on target,
`above_range` (above 2.0 and below 2.5 g/kg) gets no warning, and
`at_or_above_2_5_g_per_kg` allows only an optional, calm note about choosing other
foods for calories, which may be combined with an over-target intake as a future
food-choice hint but never as a meal recommendation for today. Two eval fixtures
cover these statuses.
As of 2026-10-20 the user accepted the previous v28 output contract as the B-1
basis so that F-1 may start. Its offline gates passed: 71 Backend test files,
typecheck, build verification, and the release guard. Ten consecutive Daily-only
live runs on the previous candidate passed. Because the validator and the
live eval no longer assert wording (see "Server Validation Scope"), that gate
confirms valid structure and supplied numbers only. A broader test strategy
(replay set, quality rubric, smoke gate) is a separate follow-up scope; Q-1 and
story acceptance remain open.
Weekly Insight is a separate feature and its diagnostic is not part of the US-03
Daily gate. No Weekly behavior is changed by this story.

See [the API contract](../tech/09-api-reference.md),
[mobile behavior](../tech/03-mobile.md),
[UX patterns](../product/05-ux-patterns.md), and
[Daily Insight test gates](../tech/08-testing.md).
