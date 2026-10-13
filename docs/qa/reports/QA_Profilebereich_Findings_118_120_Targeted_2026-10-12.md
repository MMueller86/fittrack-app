# QA Report: Profilebereich — Targeted QA der Korrekturen zu FT-QA-2026-118 und FT-QA-2026-120

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` (Korrekturen zu den Findings `T-01` und `T-03` aus `docs/qa/reports/QA_Profilebereich_Findings_113-117_Targeted_2026-10-12.md`)
- Verdict: `PASS`

## Scope

Gezielte Prüfung der Korrekturen zu FT-QA-2026-118 (Backend: Rezept-Guard in `addItemHandler` fail-open) und FT-QA-2026-120 (Dokumentation: Fehlreferenzen auf `quickEntryRelevance.ts`/`computeRelevanceOrder()`). Kein Vollreview.

Korrekturumfang (abgegrenzt über Dateizeitstempel nach Erstellung des Vor-Reports, 21:50:11): `backend/src/functions/diary.ts`, `backend/src/functions/diary.test.ts`, `docs/kb/tech/02-backend.md` (alle 21:51:50), `docs/kb/domain/03-food-catalog.md`, `docs/kb/product/04-food-entry-hub.md` (beide 21:53:44).

Hinweis zum Arbeitsbaum: Der R2-/Addendum-Stand ist gegenüber `HEAD` weiterhin uncommitted; `git diff --stat` ist daher nicht korrekturspezifisch, die Abgrenzung erfolgte über Pfade und Zeitstempel (wie im Vor-Report).

Nicht geprüft (out of scope): FT-QA-2026-119 (Contract-Test `updateDisplayDenormalized`; vom User noch nicht entschieden), Mobile-Suite (keine Mobile-Änderung), Gerät/Alpha-Deploy.

## Acceptance Criteria

Kriterien = Soll gemäß Finding-Empfehlung (T-01 / T-03) plus Scope-Prüfung.

| ID | Result | Evidence |
|---|---|---|
| FT-QA-2026-118 — Guard fail-open bei Lesefehler von `getByFoodRef` | PASS | `backend/src/functions/diary.ts` Z. 372-385: `try { relation = await getByFoodRef(...); isRecipeRelation = relation?.foodRefType === 'recipe'; } catch { logEvent(ctx, 'warn', 'diary.item.recipeGuardReadFailed', { errorClass }) }`. Bei Fehler bleibt `isRecipeRelation = false`, der Handler läuft weiter. |
| FT-QA-2026-118 — Warnung enthält nur `errorClass`, keine userId/Fehlermeldung | PASS | `diary.ts` Z. 378-380: Payload nur `errorClass: err instanceof Error ? err.name : 'unknown'`. Test prüft `JSON.parse(logged)` auf `level: 'warn'`, `event`, `errorClass: 'Error'` und `not.toContain('secret-detail')` (Fehlertext) sowie `not.toContain(TEST_USER_ID)`. |
| FT-QA-2026-118 — Erfolgs- und 404/null-Fall unverändert; gefundener Rezeptbezug blockiert weiter (404) | PASS | `diary.ts` Z. 382-384: `isRecipeRelation` → 404 `Recipe not found` (unverändert). Bestehende Rezept-Tests (`diary.test.ts` u. a. „unmarked“ Forged-Recipe-Fall, Z. ~1497-1513: Rezept-Relation `productId` + `sourceType: 'manual'` → 404, Mahlzeit bleibt leer) in der grünen Suite. Neuer Test „treats a missing relation (null) as before without a warning“: 201, `warn` nicht aufgerufen. |
| FT-QA-2026-118 — Handler-Tests für Lesefehler (503 → Add liefert 201) | PASS | `diary.test.ts` `describe('recipe guard read failure (fail-open)')`: `it.each` für OFF-Katalog (`openFoodFacts:5100`) und eigenes Produkt (`reusableItem`); `getByFoodRef` per `vi.spyOn(...).mockRejectedValue({code: 503})`; Erwartung: Status 201, `getMealById(...).items` hat Länge 1, `warn` genau einmal aufgerufen. Neue Testanzahl Backend 1726 → 1729 (+3), konsistent mit den drei neuen Fällen. `afterEach(vi.restoreAllMocks)` isoliert den Spy. |
| FT-QA-2026-118 — `getByFoodRef` unverändert, Rethrow aus FT-QA-2026-115 bleibt | PASS | `cosmosUserFoodRelationRepository.ts` (21:40:40) und `userFoodRelationRepository.ts` (21:40:50) vor Erstellung des Vor-Reports (21:50:11) zuletzt geändert und danach unverändert; Z. 223-234 weiterhin 404 → `null`, sonst `throw`. `cosmosUserFoodRelationRepository.test.ts` (Rethrow-Tests) unverändert und grün. |
| FT-QA-2026-118 — Weitere `await getByFoodRef`-Aufrufer im Loggen-Kontext | PASS | Grep `getByFoodRef` in `backend/src` (Produktivcode): `diary.ts` Z. 376 (Guard, jetzt fail-open); `favorites.ts` Z. 139 (DELETE-Handler, kein Loggen; Lesefehler → 500 statt fälschlich 404, gewollt aus FT-QA-2026-115); Repository intern: `cosmosUserFoodRelationRepository.ts` Z. 30 (`upsert`), Z. 68 (`setFavorite`), Z. 144 (`recordUsage`, im `try/catch`, fire-and-forget). `diaryItemUsage.ts` und `recipeDiary.ts` enthalten keinen `getByFoodRef`-Treffer (rufen nur `recordUsage` auf). Übrige Treffer sind Tests. Kein weiterer Aufrufer blockiert das Loggen bei Lesefehler. |
| FT-QA-2026-118 — KB-Entscheidung dokumentiert | PASS | `docs/kb/tech/02-backend.md` Z. 125-137: Rethrow-Semantik von `getByFoodRef`; Guard in `POST /api/diary/meals/:id/items` als fail-open mit Warnung `diary.item.recipeGuardReadFailed` (nur Fehlerklasse), Restrisiko (eigene Rezept-ID als freier Eintrag) benannt, gefundener Rezeptbezug → 404. Stimmt mit dem Code überein. |
| FT-QA-2026-120 — Keine Verweise mehr auf `quickEntryRelevance.ts`/`computeRelevanceOrder()` | PASS | Grep `computeRelevanceOrder\|quickEntryRelevance` in `docs/kb`: 0 Treffer. Grep in `mobile/src`, `shared`, `backend/src`: 0 Treffer (Datei/Funktion existieren nicht). |
| FT-QA-2026-120 — Beschreibung „Für dich“ stimmt mit Code überein | PASS | `04-food-entry-hub.md` Z. 89 und `03-food-catalog.md` Z. 159: `favoritesApi.listFavoritesRanked(mealType, localDate)` (`FoodEntryHub.tsx` Z. 164; `favoritesApi.ts` Z. 17) → `GET /api/favorites?context=…&localDate=…` → `sortByRelevance(favorites, context, localDate)` (`favorites.ts` Z. 74) in `backend/src/lib/favoritesScoring.ts` Z. 69; `scoreItem()` Z. 28. Kontext-Mahlzeit `context.mealType ?? getSuggestedMealType()` (`FoodEntryHub.tsx` Z. 163) und Session-Reihenfolge `ordered = sessionOrderRef.current ?? allFavorites` (`displayItems`, Filter `fuerDich` → `ordered`) entsprechen der Beschreibung. |
| FT-QA-2026-120 — Filter „Alle“ alphabetisch nach `displayName` (`localeCompare('de')`) | PASS | `FoodEntryHub.tsx` Z. 217-219: `[...favorites, ...extraItems].sort(... localeCompare(..., 'de'))` (Favoriten + eigene Produkte + Rezepte). Entspricht `04-food-entry-hub.md` („favorites + personal library + recipes, alphabetical“). |
| FT-QA-2026-120 — Mahlzeit-Filter (Korrektur über den Auftrag hinaus, Z. 99) | PASS | Neue Beschreibung: „ranked favorites that have at least one `usageDates` entry for the meal type, sorted descending by the number of such entries (`sortByMealTypeUsage()`)“. Code: `FoodEntryHub.utils.ts` Z. 149-154 filtert `count > 0` über `usageDates`-Einträge des Mahlzeittyps und sortiert absteigend nach `count`; Eingabe ist `ordered` (backend-gerankte Favoriten, `FoodEntryHub.tsx` Z. 630). Die frühere Aussage „filtered by `mealTypeCounts`“ war falsch (Feld wird nicht mehr geschrieben, siehe `userFoodRelationRepository.ts` Z. 258-261; `favorites.ts` Z. 198 Kommentar). Die Korrektur ist fachlich korrekt und im Hub-Kontext liegend; keine Scope-Verletzung. Hinweis: Gleichstände behalten die Backend-Rangfolge (stabile Sortierung) — nicht dokumentiert, aber unkritisch. |
| FT-QA-2026-120 — Dateitabelle/Key files | PASS | `04-food-entry-hub.md` Z. 125-126: `FoodEntryHub.utils.ts` mit `computeLastUsageText()`, `computeDirectAddLabel()`, `computeMacroText()`, `sortByMealTypeUsage()`, `buildDirectAddItemInput()`, `relativeUsage()`; Exporte in der Datei vorhanden (`sortByMealTypeUsage` Z. 149; übrige im Vor-Report verifiziert). |
| SCOPE — Nur die fünf vorgesehenen Dateien in der Korrekturrunde geändert | PASS | Zeitstempel (Dateien in `backend/src`, `docs/kb`, `shared`, `infra`, `backend/scripts`, `mobile/src` mit Änderung nach 21:50:11): ausschließlich `diary.ts`, `diary.test.ts`, `02-backend.md`, `03-food-catalog.md`, `04-food-entry-hub.md`. Vorherige Änderung: `mobile/src/...` und Repository-Dateien spätestens 21:41:51 (vor Vor-Report). |
| SCOPE — Keine Änderung in `shared/`, `infra/`, `backend/scripts/`, `backend/src/lib/cosmos.ts`, App-Config, `package.json`/Lockfiles | PASS | `git status --short` für diese Pfade: keine Einträge (leere Ausgabe). Keine Datei in diesen Pfaden in der Zeitstempelliste. |
| SCOPE — Repository-Dateien gegenüber der vorigen Targeted-QA unverändert | PASS | `cosmosUserFoodRelationRepository.ts` (21:40:40), `userFoodRelationRepository.ts` (21:40:50), zugehörige Tests (21:41:22/21:41:28) und `reusableItems.ts`/`.test.ts` (21:40:54/21:41:51) liegen vor dem Vor-Report (21:50:11) und wurden danach nicht mehr verändert. |
| Dokumentation — KB für geänderte Fachlogik | PASS | `02-backend.md` zur Handler-Entscheidung aktualisiert; keine API-Vertragsänderung (Statuscodes, Request/Response unverändert; Fehlerfall liefert jetzt den Erfolgspfad) → `09-api-reference.md` nicht erforderlich. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm test --workspace=@fittrack/backend` | 0 | 70 Testdateien, 1729 Tests bestanden |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | `tsc --noEmit` ohne Fehler |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | „All checks passed“ (keine Shared-Imports, keine doppelten Function-IDs) |
| `npm run check:encoding` | 0 | „Encoding check passed“ |
| `npx vitest run --config vitest.contract.config.mts src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts` (in `backend/`) | 1 | Nicht ausführbar: Cosmos-Emulator nicht erreichbar (Port 8081 belegt, antwortet nicht als Emulator; `createTestDatabase` schlägt fehl, 5 Tests übersprungen). Umgebungsbeschränkung, kein Befund. |
| Mobile-Suite | — | Nicht ausgeführt (keine Mobile-Änderung in dieser Korrekturrunde). |

## Verification Notes

- State: `UNVERIFIED`
  - Reason: Cosmos-Emulator nicht verfügbar. Das echte SDK-Verhalten von `getByFoodRef` bei 404 (→ `null`) und die Fail-open-Wirkung bei einem realen Cosmos-Lesefehler sind nur gegen Mocks/Spies geprüft.
  - Manual action: Emulator starten (`npm run emulator:start` in `backend/`), `npm run test:contract --workspace=@fittrack/backend` ausführen. Erwartet: Relation-Contract-Tests grün. Ergebnis: ______
- State: `MANUAL VALIDATION REQUIRED`
  - Reason: Beobachtbarkeit der Warnung `diary.item.recipeGuardReadFailed` in Azure (Application Insights) nur nach Deploy prüfbar.
  - Manual action: Nach dem Alpha-Deploy prüfen, dass das Event nur bei tatsächlichen Lesefehlern auftritt (Erwartung: nicht im Normalbetrieb) und keine userId/Fehlermeldung enthält. Ergebnis: ______
- FT-QA-2026-119 (Contract-Test `updateDisplayDenormalized` fehlt) ist nicht Teil dieser Prüfung; Entscheidung des Users steht aus.

## Release-Einschätzung (Alpha: Expo-Build und Azure Function)

Release-Blocker aus QA-Sicht: **Nein.**

- Keine Blocking-Findings; alle ausgeführten automatisierten Prüfungen grün (Exit 0).
- Der einzige Verhaltens-/Verfügbarkeitsbezug (Loggen bei transientem Relation-Lesefehler) ist durch den Fail-open-Guard behoben; der Mobile-Client ist nicht betroffen, kein Vertrags-/Schema-/Infrastrukturwechsel.
- Weiterhin gültig aus dem Vor-Report: Der R2-Stand ist uncommitted und enthält untracked Dateien (u. a. `mobile/src/modules/legal/`, `mobile/src/modules/profile/*`, `docs/legal/`); Expo-Build und Function-Deploy müssen aus dem committeten Stand erfolgen.
- Offen, nicht Teil dieser Prüfung: FT-QA-2026-119 (Non-blocking), Emulator-Contract-Suite.

## Findings

Finding key: S-01
Plan reference: N/A (Randbefund zu FT-QA-2026-120)
Acceptance criterion: N/A
Description: `mealTypeCounts` wird im Code nicht mehr geschrieben (`userFoodRelationRepository.ts` Z. 258-261 und `cosmosUserFoodRelationRepository.ts` Z. 150-153 entfernen es selbstbereinigend; `favorites.ts` Z. 198 Kommentar), steht aber in `docs/kb/domain/03-food-catalog.md` Z. 118 weiterhin als Feld unter „Usage tracking“ (`mealTypeCounts?: Partial<Record<MealType, number>>` — per-meal usage counts). In `shared/types/userFoodRelation.ts` Z. 116 steht nur noch ein veralteter Kommentar („Favorites with no mealTypeCounts … shown above tab strip“); eine Feld-Deklaration existiert dort nicht. Nur gemeldet, nicht behoben (laut Auftrag).
Criticality: Suggestion
Owner: Documentation
Evidence: Grep `mealTypeCounts` in `docs/kb` → `03-food-catalog.md` Z. 118; in `shared/` → `shared/types/userFoodRelation.ts` Z. 116 (Kommentar); Produktivcode nur als Drop-Logik (`userFoodRelationRepository.ts` Z. 258-261, `cosmosUserFoodRelationRepository.ts` Z. 150-153).
Recommendation: In `03-food-catalog.md` Z. 118 als „removed/legacy, no longer written; dropped from existing documents on next write“ kennzeichnen bzw. entfernen und den Kommentar in `shared/types/userFoodRelation.ts` Z. 116 anpassen, sobald `shared/` ohnehin angefasst wird.
