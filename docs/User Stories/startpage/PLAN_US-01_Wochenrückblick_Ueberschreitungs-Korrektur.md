# Plan: US-01 Wochenrückblick – Korrektur fälschlicher Überschreitungsaussagen

**Bezug:** [US-01_Wochenrückblick.md](US-01_Wochenrückblick.md)  
**Status:** Ready for approval  
**Approval:** Pending

Infrastructure Impact: Dev  
Mobile Build Impact: None

---

## 1. Requirement Assessment

**Klassifikation:** Accept as proposed.

Der Nutzer hat direkten Runtime-Beweis für einen semantisch falschen AI-Output geliefert:

> „An den ersten 3 Tagen hast du deinen Kalorienziele überschritten, aber das war angesicht der hohen Aktivität nachvollziehbar."

Das Diagramm zeigt für genau diese drei Tage `targetPercent`-Werte von 99 %, 90 % und 81 %. Alle drei Werte liegen unter 100 %. „Überschritten" ist damit faktisch falsch. Das Wort „überschritten" darf nur verwendet werden, wenn `targetPercent > 100`.

**Einordnung als RED_CONFIRMED_B (abweichender Szenariotyp):**  
Der vorangegangene Diagnoseplan (`PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md`) testete explizit Sonderaktivitäten (Radtour, Wanderung mit `activity`-Label) bei 83 % und 100 % und schloss `NO_RED` ab. Der vorliegende Fall ist ein anderes Szenario: Trainingstage (`dayType: 'training'`) mit Aktivitätsbonus, bei denen der verbrauchte Wert die Basiskalorien übersteigt, das effektive Ziel aber nicht. Für diesen Szenariotyp liegt jetzt direkter Nutzerbeweis vor. Das qualifiziert als `RED_CONFIRMED_B` für diesen abweichenden Fall und autorisiert eine sofortige Produktionskorrektur ohne weiteren Diagnose-Zyklus.

**Root Cause (aus Repository und Live-Evidenz bestätigt):**

Der System-Prompt `weeklyInsightV2.ts` enthält die Regel „Bewerte die Kalorien immer relativ zum jeweiligen effektiven Tagesziel", definiert aber keinen expliziten Feldvertrag für `baseTargetCalories`, `effectiveTargetCalories` und `targetPercent`. Beide Zielfelder sind im JSON-Payload vorhanden. Das Modell leitet daraus ab:

1. `consumedCalories > baseTargetCalories` → „überschritten" (bezogen auf Basisziel)
2. Gleichzeitiger Aktivitätsbonus → „aber angesichts der hohen Aktivität nachvollziehbar"

Dieser Schluss ist inhaltlich falsch, weil das effektive Ziel der einzige verbindliche Maßstab ist. Die Lücke war in Abschnitt 2.2 des Diagnoseplans als überprüfbarer Feldvertrags-Gap dokumentiert und ist jetzt durch den Live-Output bewiesen.

---

## 2. Current Behaviour

- `weeklyInsightV2.ts` exportiert `WEEKLY_INSIGHT_PROMPT_VERSION = 'v2'`.
- Der System-Prompt enthält die generische Regel, Kalorien relativ zum effektiven Ziel zu bewerten.
- Kein expliziter Feldvertrag definiert, wann „überschritten" erlaubt ist.
- Keine serverseitige semantische Validierung des generierten Textes.

---

## 3. Desired Behaviour

- Der Prompt enthält einen expliziten Feldvertrag, der `baseTargetCalories` als informativen Kontext (niemals als Überschreitungsreferenz) und `effectiveTargetCalories` + `targetPercent` als die einzigen verbindlichen Maßstäbe definiert.
- Das Wort „überschritten" (und synonyme Formulierungen) darf nur im Text erscheinen, wenn der betreffende Tag tatsächlich `targetPercent > 100` hat.
- Eine serverseitige Validierung erkennt und verwirft Texte, die Überschreitungssprache enthalten, wenn kein Tag des Zeitraums `targetPercent > 100` hat.
- Die Promptversion ist auf 'v3' erhöht; alle bestehenden Wochencaches werden damit automatisch invalidiert.

---

## 4. Scope

- `backend/src/lib/prompts/weeklyInsightV2.ts` (Version + Prompt-Inhalt)
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts` (neue Eval-Fixture)
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts` (TESTED_PROMPT_VERSION)
- `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts` (TESTED_PROMPT_VERSION)
- `backend/src/lib/weeklyInsightValidation.ts` (neue Datei: serverseitiger Validator)
- `backend/src/lib/openai.ts` (Validatoraufruf nach Response-Parsing)
- `backend/src/lib/weeklyInsightValidation.test.ts` (neue Unit-Tests)

---

## 5. Out of Scope

- Änderungen am Frontend/Mobile (kein API-Vertragsbruch).
- Cosmos-Schemaänderungen (keine neuen Felder).
- Änderungen am täglichen Insight oder anderen Prompt-Ketten.
- Umbenennung von `weeklyInsightV2.ts` (kein funktionaler Nutzen in dieser Korrektur; separate Kosmetikaufgabe wenn gewünscht).
- Diagnose-Eval-Fixtures im Sonderaktivitäts-Diagnosepfad (`WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES`): diese bleiben unverändert.

---

## 6. Confirmed Facts

- `computeWeeklyInputHash()` erhält `promptVersion` als Parameter; ein Versionswechsel von 'v2' auf 'v3' erzeugt automatisch einen anderen Hash und invalidiert alle bestehenden Wocheninsight-Caches.
- `generateWeeklyInsight()` in `openai.ts` empfängt den vollständigen `WeeklyInsightPromptContext` einschließlich aller `days` mit `targetPercent`.
- `weeklyInsightV2.ts` wird in `openai.ts` (Systemfeld und Typ) und in den Eval-Tests importiert; in `weeklyInsight.ts` (Handler) wird `WEEKLY_INSIGHT_PROMPT_VERSION` verwendet.
- Der Diagnoseplan fand `payload: { underEffectiveTarget: PASS, atEffectiveTarget: PASS }` für Sonderaktivitäten: Die Datenaufbereitung ist korrekt. Der Fehler liegt ausschließlich in der AI-Interpretation.
- Es gibt keine bestehende serverseitige semantische Validierung für den Weekly-Insight-Text.

---

## 7. Assumptions and Open Questions

- **Assumption A1:** Der beschriebene AI-Output entstammt einem Trainingstagsszenario mit `dayType: 'training'` und `activityBonusCalories > 0`. Falls der Fehler stattdessen bei `activity`-Label-Tagen oder bei Tagen ohne Bonus aufgetreten ist, ist das Fixture-Szenario in AC-5 anzupassen; der Promptfix bleibt identisch.
- **Open Question Q1:** Soll die neue Eval-Fixture mit Live-Azure-Credentials ausgeführt werden oder nur mit `forbiddenPhrases`-Check? → Plan schreibt beides vor: `forbiddenPhrases`-Check immer, Live-Eval wenn Credentials verfügbar.

---

## 8. Proposed Technical Solution

### Prompt-Änderung (weeklyInsightV2.ts)

Die Version wird von `'v2'` auf `'v3'` erhöht. Der System-Prompt erhält einen neuen Abschnitt **vor** den bestehenden „Verbindliche Regeln":

```
## Verbindlicher Feldvertrag

Die sieben Tage enthalten folgende Felder, deren Bedeutung strikt einzuhalten ist:

- `baseTargetCalories`: das Basisziel des Tages **ohne** Aktivitätsbonus. Dieses Feld ist
  ausschließlich informativer Kontext. Es darf niemals als Maßstab für „überschritten",
  „über dem Ziel" oder eine sinngemäße Formulierung verwendet werden, wenn
  `effectiveTargetCalories` vorliegt.
- `activityBonusCalories`: die serverseitig berechnete Kalorienerhöhung durch eine Aktivität.
  Dieser Bonus ist kein zusätzlicher Verbrauch und darf nicht doppelt gezählt werden.
- `effectiveTargetCalories`: das **alleinige, verbindliche Tagesziel** einschließlich aller Boni.
  Nur dieser Wert ist der Nenner für die Zielerreichung.
- `targetPercent`: die einzige verbindliche Messgröße für die Zielerreichung eines Tages.
  `targetPercent = consumedCalories / effectiveTargetCalories × 100`.

**Überschreitung gilt ausschließlich, wenn `targetPercent > 100`.**
Für jeden Tag, dessen `targetPercent ≤ 100` ist, sind „überschritten", „Überschreitung",
„über dem Ziel", „über deinem Ziel", „über dem Bedarf" und alle sinngemäß gleichbedeutenden
Formulierungen verboten — unabhängig davon, ob `consumedCalories > baseTargetCalories` gilt.
Dass verbrauchte Kalorien das Basisziel übersteigen, während `targetPercent ≤ 100` bleibt,
ist der beabsichtigte Normalfall bei einem Aktivitätstag und kein Befund.
```

### Neue Eval-Fixture

In `weeklyInsight.eval.fixtures.ts` wird eine neue Fixture `training-day-activitybonus-under-target` hinzugefügt. Sie enthält mindestens drei Trainingstage mit `dayType: 'training'`, `activityBonusCalories > 0` und `targetPercent` von 99, 90 bzw. 81 (alle < 100). Die `forbiddenPhrases` schließen ein: `'überschritten'`, `'überschreitung'`, `'über dem ziel'`, `'über deinem ziel'`, `'über deinen bedarf'`.

### Neuer Server-Side Validator (weeklyInsightValidation.ts)

```typescript
// Neue Datei: backend/src/lib/weeklyInsightValidation.ts

export interface WeeklyInsightValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Conservative exceedance-language guard.
 * Rejects a generated text when no day in the period actually exceeded its
 * effective target (targetPercent > 100) but the text contains exceedance
 * language. Does not validate individual-day attribution in mixed periods.
 */
export function validateWeeklyInsightExceedanceClaims(
  text: string,
  days: Array<{ targetPercent: number | null }>,
): WeeklyInsightValidationResult
```

Logik:
1. Bestimme `hasAnyExceededDay = days.some(d => d.targetPercent !== null && d.targetPercent > 100)`.
2. Wenn `hasAnyExceededDay`, gib `{ valid: true }` zurück (Überschreitungssprache kann für echte Überschreitungstage korrekt sein).
3. Wenn `!hasAnyExceededDay`, prüfe ob `text.toLocaleLowerCase('de-DE')` einen der verbotenen Terme enthält: `'überschritten'`, `'überschreitung'`, `'über dem ziel'`, `'über deinem ziel'`, `'über deinen bedarf'`, `'über dein ziel'`.
4. Bei Treffern: `{ valid: false, reason: 'Exceedance language detected but no day exceeded effective target' }`.
5. Sonst: `{ valid: true }`.

### Integration in openai.ts

In `generateWeeklyInsight()`, nach dem `parsedResponse`-Check und der Textextraktion, wird `validateWeeklyInsightExceedanceClaims(text, context.days)` aufgerufen. Bei `valid: false` wird ein `Error` geworfen; der Aufrufer behandelt ihn als Generierungsfehler (kein ungültiges Ergebnis wird gecacht).

---

## 9. Backend Work Package

**Agent:** Backend

**Goal:** Promptversion auf v3 erhöhen, Feldvertrag ergänzen, neue Eval-Fixture hinzufügen, serverseitigen Validator implementieren und testen.

### Subtask B-1: Prompt-Update und Eval-Fixture

**Agent:** Backend

**Required Knowledge Base:**
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/02-backend.md

**Required Repository Context:**
- backend/src/lib/prompts/weeklyInsightV2.ts
- backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts
- backend/src/lib/prompts/weeklyInsight.eval.test.ts
- backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts

**Required Skills:**
- azure-openai-feature-integration

**Relevant Acceptance Criteria:**
- AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7

**Dependencies:**
- None

**Expected Handoff:**
- `weeklyInsightV2.ts` mit Version 'v3' und neuem Feldvertrag-Abschnitt
- `weeklyInsight.eval.fixtures.ts` mit neuer Trainingstag-Fixture
- `weeklyInsight.eval.test.ts` mit `TESTED_PROMPT_VERSION = 'v3'`
- `weeklyInsight.special-activity.diagnostic.eval.test.ts` mit `TESTED_PROMPT_VERSION = 'v3'`

**Deliverables:**
1. In `weeklyInsightV2.ts`: `WEEKLY_INSIGHT_PROMPT_VERSION` auf `'v3'` setzen; Abschnitt „Verbindlicher Feldvertrag" (exakt wie in Abschnitt 8 definiert) **vor** dem bestehenden „Verbindliche Regeln"-Abschnitt in `WEEKLY_INSIGHT_SYSTEM_PROMPT` einfügen.
2. In `weeklyInsight.eval.fixtures.ts`: neue Fixture `training-day-activitybonus-under-target` mit mindestens drei aufeinanderfolgenden Trainingstagen (`dayType: 'training'`, `activityBonusCalories > 0`) und `targetPercent`-Werten von 99, 90, 81 (alle < 100); `forbiddenPhrases` enthält `'überschritten'`, `'überschreitung'`, `'über dem ziel'`, `'über deinem ziel'`, `'über deinen bedarf'`, `'über dein ziel'`.
3. In `weeklyInsight.eval.test.ts`: `TESTED_PROMPT_VERSION` auf `'v3'` aktualisieren.
4. In `weeklyInsight.special-activity.diagnostic.eval.test.ts`: `TESTED_PROMPT_VERSION` auf `'v3'` aktualisieren.

---

### Subtask B-2: Server-Side Validator

**Agent:** Backend

**Required Knowledge Base:**
- docs/kb/tech/02-backend.md

**Required Repository Context:**
- backend/src/lib/openai.ts (generateWeeklyInsight-Funktion, Zeilen 644–710)
- backend/src/lib/prompts/weeklyInsightV2.ts (WeeklyInsightPromptDay-Typ)

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-8, AC-9, AC-10

**Dependencies:**
- Subtask B-1 (aktualisierte Typen aus weeklyInsightV2.ts)

**Expected Handoff:**
- `backend/src/lib/weeklyInsightValidation.ts` (neue Datei)
- `backend/src/lib/weeklyInsightValidation.test.ts` (neue Test-Datei)
- Aktualisiertes `backend/src/lib/openai.ts` mit Validatoraufruf

**Deliverables:**
1. Neue Datei `weeklyInsightValidation.ts` mit der in Abschnitt 8 definierten `validateWeeklyInsightExceedanceClaims()`-Funktion und dem `WeeklyInsightValidationResult`-Typ.
2. In `openai.ts` (`generateWeeklyInsight()`): nach dem Schema-Check den Validator aufrufen. Bei `valid: false` einen `Error` mit dem `reason` werfen. Die Signatur von `generateWeeklyInsight()` bleibt unverändert.
3. Neue Datei `weeklyInsightValidation.test.ts` mit Unit-Tests (vgl. AC-10).

---

## 10. QA Work Package

**Agent:** QA

**Goal:** Vollständige Verifikation der Prompt-, Fixture-, Validator- und Integrationskorrektheit.

**Required Knowledge Base:**
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/08-testing.md

**Required Repository Context:**
- backend/src/lib/prompts/weeklyInsightV2.ts
- backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts
- backend/src/lib/prompts/weeklyInsight.eval.test.ts
- backend/src/lib/weeklyInsightValidation.ts
- backend/src/lib/weeklyInsightValidation.test.ts
- backend/src/lib/openai.ts

**Required Skills:**
- azure-openai-feature-integration

**Relevant Acceptance Criteria:**
- AC-1 through AC-13

**Dependencies:**
- Subtask B-1 und B-2 abgeschlossen

**Test commands:**

| Kommando | Erwarteter Exitcode |
|---|---|
| `cd backend; npx vitest run src/lib/weeklyInsightValidation.test.ts` | 0 |
| `cd backend; npx vitest run src/lib/prompts/weeklyInsight.eval.test.ts` | 0 (AC-Prüfung ohne Credentials: version guard) |
| `cd backend; npx vitest run` | 0 |
| `cd backend; npm run build:verify` | 0 |
| `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.eval.test.ts` (nur mit Credentials) | 0 |

---

## 11. Acceptance Criteria

- **AC-1:** `WEEKLY_INSIGHT_PROMPT_VERSION` in `weeklyInsightV2.ts` ist `'v3'`.
- **AC-2:** `WEEKLY_INSIGHT_SYSTEM_PROMPT` enthält den Abschnitt „Verbindlicher Feldvertrag" mit der expliziten Definition von `baseTargetCalories`, `activityBonusCalories`, `effectiveTargetCalories` und `targetPercent`.
- **AC-3:** Der Feldvertrag enthält die explizite Aussage, dass „Überschreitung" ausschließlich bei `targetPercent > 100` gilt und Überschreitungsformulierungen für Tage mit `targetPercent ≤ 100` verboten sind.
- **AC-4:** Der Feldvertrag enthält die explizite Aussage, dass `baseTargetCalories` nicht als Überschreitungsreferenz verwendet werden darf, wenn `effectiveTargetCalories` vorliegt.
- **AC-5:** `weeklyInsight.eval.fixtures.ts` enthält eine neue Fixture mit mindestens drei Trainingstagen (`dayType: 'training'`, `activityBonusCalories > 0`, `targetPercent` von 99, 90, 81) und `forbiddenPhrases` mit `'überschritten'`, `'überschreitung'`, `'über dem ziel'`, `'über deinem ziel'`, `'über deinen bedarf'`, `'über dein ziel'`.
- **AC-6:** `TESTED_PROMPT_VERSION` in `weeklyInsight.eval.test.ts` ist `'v3'`.
- **AC-7:** `TESTED_PROMPT_VERSION` in `weeklyInsight.special-activity.diagnostic.eval.test.ts` ist `'v3'`.
- **AC-8:** `weeklyInsightValidation.ts` exportiert `validateWeeklyInsightExceedanceClaims(text, days)`, die `{ valid: true }` zurückgibt, wenn mindestens ein Tag `targetPercent > 100` hat, unabhängig vom Textinhalt.
- **AC-9:** `validateWeeklyInsightExceedanceClaims()` gibt `{ valid: false, reason: string }` zurück, wenn kein Tag `targetPercent > 100` hat und der Text einen der verbotenen Terme enthält.
- **AC-10:** `weeklyInsightValidation.test.ts` enthält Unit-Tests für: (a) kein Tag überschritten, kein Überschreitungsterm → valid; (b) kein Tag überschritten, Text enthält 'überschritten' → invalid; (c) mindestens ein Tag überschritten, Text enthält 'überschritten' → valid; (d) alle targetPercent null → valid (keine Datenbasis für Prüfung).
- **AC-11:** `generateWeeklyInsight()` in `openai.ts` ruft `validateWeeklyInsightExceedanceClaims()` nach dem Schema-Check auf und wirft einen `Error`, wenn `valid: false`.
- **AC-12:** `cd backend; npm run build:verify` exitiert mit Code 0.
- **AC-13:** `cd backend; npx vitest run` exitiert mit Code 0 mit mindestens so vielen Tests wie vor der Änderung.
- **AC-14 (Live-Eval, nur mit Credentials):** `cd backend; npm run test:eval -- src/lib/prompts/weeklyInsight.eval.test.ts` exitiert mit Code 0; die neue Trainingstag-Fixture enthält keinen der verbotenen Terme im generierten Text.

---

## 12. Risks and Edge Cases

- **Gemischte Wochen (manche Tage > 100 %):** Der Validator gibt `valid: true` zurück, wenn mindestens ein Tag das Ziel überschritten hat. Der Promptfix übernimmt die Hauptlast; der Validator ist nur für den klaren Fall (keine Überschreitung in der Woche) wirksam.
- **Promptfix und Temperatur 0,3:** Der Prompt verwendet `temperature: 0.3`. Bei niedrigem Temperaturwert ist die Auswirkung des Feldvertrags stabiler als bei höheren Werten.
- **Cache-Invalidierung:** Alle bestehenden wöchentlichen Caches werden durch den Versionswechsel zu 'v3' automatisch invalidiert. Das ist korrekt und gewollt.

---

## 13. Recommended Execution Order

1. **B-1:** Prompt-Update und Eval-Fixture
2. **B-2:** Server-Side Validator
3. **QA:** Vollverifikation
4. **Deploy:** Infrastructure & Release führt Dev-Deployment aus (direkter operativer Befehl, kein separates WP)
