# QA Report: Profilebereich — Targeted QA der Korrekturen zu FT-QA-2026-113 bis -117

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` (zusätzlich `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2_Addendum_Favoriten-Marke.md`)
- Verdict: `PASS WITH ISSUES`

## Scope

Gezielte Prüfung der Korrekturen zu FT-QA-2026-113 (R2Q-01), -114 (R2Q-02), -115 (R2Q-03), -116 (R2Q-04) und -117 (R2Q-05) gemäß `docs/qa/reports/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md`. Kein Vollreview; Regression nur über die vollständigen Mobile- und Backend-Suiten und die Scope-Prüfung.

Korrekturumfang (abgegrenzt über Dateizeitstempel nach dem Vor-Report, 21:30): `mobile/src/modules/nutrition/hub/{FoodEntryHub.tsx, FoodEntryHub.utils.ts, FoodEntryHub.test.ts, QuantityView.tsx, QuantityView.imageUrl.test.tsx, RelationRow.tsx, RelationRow.utils.ts, SearchState.tsx}`, `backend/src/functions/reusableItems.ts` (+ Test), `backend/src/lib/repositories/{cosmosUserFoodRelationRepository,userFoodRelationRepository}.ts` (+ Tests, neu `cosmosUserFoodRelationRepository.test.ts`), `docs/kb/{product/04-food-entry-hub,tech/03-mobile,tech/02-backend,domain/03-food-catalog}.md`. `backend/src/functions/diary.ts` und `diary.test.ts` wurden im Korrekturzeitraum nicht verändert.

Nicht geprüft (out of scope): übrige R2-Akzeptanzkriterien (bereits im Vor-Report bewertet), Gerät/Emulator/Screenreader, Alpha-Deploy.

Hinweis zum Arbeitsbaum: Der gesamte R2-/Addendum-Stand ist gegenüber `HEAD` uncommitted (viele geänderte und untracked Dateien, u. a. `mobile/src/modules/legal/`, `docs/legal/`, `mobile/src/modules/profile/*`). `git diff --stat HEAD` ist daher nicht korrekturspezifisch; die Scope-Abgrenzung erfolgte über Pfade und Zeitstempel.

## Acceptance Criteria

Kriterien = Soll gemäß Finding-Empfehlung (je Finding) plus Scope-/Regressionsprüfung.

| ID | Result | Evidence |
|---|---|---|
| FT-QA-2026-113 — `SearchState` ohne Literal-Icon-Größe | PASS | `mobile/src/modules/nutrition/hub/SearchState.tsx` Z. 215: `<Icon lib="feather" name="plus" size="sm" .../>`; `Icon.tsx` `SIZE_MAP.sm = 16`. Alle übrigen `Icon`-Größen in der Datei sind Tokens (`md`). |
| FT-QA-2026-113 — `SyncStatusSheet` `lineHeight: 16`/`maxHeight: 200` unverändert, Begründung | PASS | `SyncStatusSheet.tsx` Z. 232, 237 (Datei nicht nach 21:30 geändert). `theme/index.ts` enthält keinen `lineHeight`- oder Höhen-Token (`typography.overline` hat nur `fontSize`/`fontWeight`/`letterSpacing`); R2-AC-12 zählt `lineHeight`/`maxHeight` nicht auf. Begründung „kein passender Token“ ist plausibel und akzeptabel. |
| FT-QA-2026-113 — R2-AC-12 neu bewertet | PASS | Grep auf `rgba`/Hex/`fontSize`/`padding*`/`margin*`/`gap`/`hitSlop`/`borderRadius`/`Icon size=` in `FoodProductSummary.tsx`, `SearchState.tsx`, `SyncStatusSheet.tsx`: keine `rgba`-/Hex-Treffer; alle `padding*`/`margin*`/`gap`/`hitSlop`/`borderRadius` verwenden `spacing.*`/`radius.*`; `fontSize` nur `typography.overline.fontSize`; Icons nur Tokens `sm`/`md`; erlaubt bleiben `borderWidth: 1`, `hairlineWidth`, `height: 0` (`SearchState.tsx` Z. 387), `FOOD_THUMBNAIL_SIZE`. Verbleibende Nicht-Token-Werte (`lineHeight`, `maxHeight`) fallen nicht unter die AC-Aufzählung. |
| FT-QA-2026-114 — Guard `QuantityView` (`addFavorite`, `diaryApi.addItem`) | PASS | `QuantityView.tsx` Z. 313 und Z. 381: `isRemoteImageUri(product.imageUrl) ? product.imageUrl : null`. Test `QuantityView.imageUrl.test.tsx` (Remote-URL bleibt, Blob-Pfad → `null` für beide Aufrufe). |
| FT-QA-2026-114 — Guard `FoodEntryHub.handleDirectAdd` via `buildDirectAddItemInput` | PASS | `FoodEntryHub.utils.ts` Z. 94-114 (Guard Z. 107); `FoodEntryHub.tsx` Z. 796-800 ruft die Funktion auf. Payload sonst identisch zur vorherigen Inline-Konstruktion (Diff geprüft: `productId`, `productName`, `inputMode`, `inputAmount`, `amountGrams`, `sourceType`-Mapping, `calculatedNutrition` unverändert; einzige Abweichung: `imageUrl` jetzt `null` statt `undefined`, vom Backend-Schema `optional().nullable()` akzeptiert und im Repository nicht überschreibend, da `recordUsage` nur bei `imageUrl != null` schreibt). Test `FoodEntryHub.test.ts` „keeps the remaining payload unchanged“. |
| FT-QA-2026-114 — Zusatzstelle `RelationRow` (Scope-Abweichung) | PASS | `RelationRow.tsx` Z. 91 → `buildRelationFavoriteInput` (`RelationRow.utils.ts` Z. 20-31). Gleiche Fehlerklasse, gleicher Endpunkt (`POST /api/favorites`, `favorites.ts` Z. 23 `z.string().url()`), Änderung minimal und innerhalb des Hub-Bereichs; kein Konflikt mit Scope (nur `hub/`). Bewertung: sinnvolle, vertretbare Erweiterung (ohne sie bliebe derselbe 400-Pfad im Quick-Entry-Herz offen). Test `FoodEntryHub.test.ts` „buildRelationFavoriteInput imageUrl“. Fehlend: kein Komponententest, der `RelationRow.handleFavoriteToggle` rendert; Abdeckung nur über die reine Funktion (ausreichend, da die Komponente nur die Funktion aufruft). |
| FT-QA-2026-114 — Backend-Schemas (nur lesend) | PASS | `backend/src/functions/diary.ts` Z. 130 `imageUrl: z.string().url().optional().nullable()`; `favorites.ts` Z. 23 `z.string().url().max(1000).optional().nullable()`. `null` wird akzeptiert. Weitere `addItem`/`addFavorite`-Aufrufer in `mobile/src` (grep) senden kein `imageUrl` aus Relationen/Produkten bzw. nur Remote-Rezeptbild-URLs (`RecipeDetailScreen.tsx` Z. 1183). Kein weiterer Blob-Pfad-Pfad gefunden. |
| FT-QA-2026-114 — Tests und Rot-vor-Fix | PASS | Mobile-Suite grün (77 Dateien / 752 Tests). Tests: `QuantityView.imageUrl.test.tsx`, `FoodEntryHub.test.ts`, `SearchState.ResultRow.test.tsx`. Die gemeldeten 6 Rot-Fehlschläge vor dem Guard wurden von QA nicht reproduziert (kein Rückbau des Arbeitsbaums); die Tests prüfen jedoch das Soll-Verhalten eindeutig (Blob-Pfad → `null`). Siehe `UNVERIFIED`. |
| FT-QA-2026-114 — offene Reste dokumentiert, KB | PASS | `docs/kb/tech/03-mobile.md` Known limitations (Z. 520): ersetzt die frühere „not investigated“-Zeile, nennt alle drei Stellen, `isRemoteImageUri`, und die Reste: (a) `FoodEntryHub` Rezept-Zutaten-Produkt trägt `imageUrl` weiter (Code Z. 767: `item.imageUrl ?? undefined`, geht nicht an einen Endpunkt), (b) `QuantityView` rendert `product.imageUrl` ungeprüft als `<Image>` (Code Z. 410-412). Beide Aussagen stimmen mit dem Code überein. Ein dritter, nicht benannter Nebeneffekt (Favorit eines eigenen Lebensmittels mit Foto speichert kein Bild in der Relation) ist mit PO-1 (Avatar-Fallback) konsistent. |
| FT-QA-2026-115 — `getByFoodRef` nur 404/fehlend → `null`, sonst Rethrow | PASS | `cosmosUserFoodRelationRepository.ts` Z. 223-234: `resource ?? null`; `catch` liefert `null` nur bei `code === 404`, sonst `throw`. In-Memory unverändert (kein Fehlerpfad). Tests `cosmosUserFoodRelationRepository.test.ts`: kein Resource → `null`, 404 → `null`, 503/429/`ECONNRESET`/plain Error → throw (`rejects.toBe(error)`). |
| FT-QA-2026-115 — Aufrufer geprüft | PASS | `setFavorite` (Z. 68), `upsert` (Z. 30), `recordUsage` (Z. 144, im umschließenden `try/catch` → fire-and-forget, schreibt bei Lesefehler nichts, wirft nicht), DELETE-Handler `favorites.ts` Z. 139 (Lesefehler → 500 statt fälschlich 404; korrekt), `diary.ts` Z. 373 (siehe nächste Zeile), `diaryItemUsage.ts` Z. 30/58 (`bestEffort`) und `recipeDiary.ts` Z. 61 (`.catch(() => {})`) rufen nur `recordUsage` auf (kein direkter `getByFoodRef`). Tests: `setFavorite` 404 → neu angelegt; 503 → wirft, kein `upsert`; `recordUsage` 404 → neu angelegt; 503 → kein Schreiben, kein Wurf. |
| FT-QA-2026-115 — Verhaltensänderung Rezept-Guard in `diary.ts` | PASS WITH ISSUES | `diary.ts` Z. 372-377: `await getByFoodRef` läuft für **jedes** `POST /api/diary/meals/:id/items` mit `productId` (OFF-Katalog, eigene Produkte, Legacy-Clients), nicht nur für Rezepte; `sourceType === 'recipe'` verlässt den Handler vorher. Ein transienter Lesefehler (5xx/429/Netz) ergibt jetzt 500 und blockiert das Loggen jedes Lebensmittels mit `productId`; vorher lief der Guard fail-open (`null`). Fachliche Bewertung: Der Guard ist Defense-in-Depth gegen das Loggen einer Rezept-ID über den Legacy-Produktpfad (Daten gehören dem Nutzer, kein Fremdzugriff). Fail-closed erhöht die Abhängigkeit des Kernflusses „Loggen“ von einem zusätzlichen Punktlesevorgang; bei einem Cosmos-weiten Ausfall wäre `addItem` ohnehin betroffen, bei isoliertem Container-Fehler/429 aber nicht. Kein Handler-Test dokumentiert die neue Entscheidung, KB `02-backend.md` Z. 125-129 beschreibt die Auswirkung auf diesen Handler nicht. Siehe Finding `T-01`. |
| FT-QA-2026-116 — `updateDisplayDenormalized` in beiden Repositories, nur bestehende Nicht-Rezept-Relationen | PASS | `userFoodRelationRepository.ts` `applyDisplayFields` (Z. 54-71): `null` für Rezepte und ohne Änderung; Cosmos `updateDisplayDenormalized` (Z. 281-292) iteriert `listByFoodRef` (nur vorhandene Dokumente → keine Neuanlage) und schreibt nur bei Rückgabewert ≠ `null`; In-Memory analog (Z. 344-352). Interface Z. 139-143. |
| FT-QA-2026-116 — Merge-Semantik leere Marke, Konsistenz B-A.1 | PASS | `applyDisplayFields`: Marke nur bei nicht leerem String; `undefined`/`''` (und `null` über den Handler) löschen nicht; konsistent mit `recordUsage`/`setFavorite` (Addendum B-A.1). Entscheidung dokumentiert in `03-food-catalog.md` („applies the same merge rule“, Known limitation „Removing a brand … is not propagated“) und `02-backend.md`. |
| FT-QA-2026-116 — Handler: fire-and-forget nur bei `name`/`brand`, Fehler beeinflussen Update nicht | PASS | `reusableItems.ts` Z. 250-263: Bedingung `fields.name !== undefined \|\| fields.brand !== undefined` (`brand: null` wird beim Aufbau von `fields` zu `undefined` aufgelöst → Marke unverändert); `try/catch` im `void`-IIFE. Tests `reusableItems.test.ts` (Z. 440-550): Marke/Name aktualisiert, keine Neuanlage, `null`/`''` löschen nicht, kein Sync ohne `name`/`brand`, Rezept-Relation unverändert, 200 bei Sync-Fehler. |
| FT-QA-2026-116 — Schreiben nur bei Änderung; Repository-Tests | PASS | Cosmos-Mock-Tests (`cosmosUserFoodRelationRepository.test.ts` Z. 263-335): Aktualisierung behält übrige Felder, `''`/`undefined` löschen nicht, unveränderte Werte → kein `upsert`, keine Relation → kein `upsert`, Rezept unberührt. In-Memory-Tests (`userFoodRelationRepository.test.ts` Z. 487-523). |
| FT-QA-2026-116 — Name-Sync als Scope-Erweiterung | PASS | Bewertung: vertretbar. `recordUsage` überschreibt `displayName` ohnehin bei jedem Loggen (`cosmosUserFoodRelationRepository.ts` Z. 158); Sync derselben Denormalisierung ist klein, getestet und dokumentiert. Kein neuer Vertrag, keine neue Persistenzform. |
| FT-QA-2026-116 — Skill `cosmos-data-model-and-migration` (QA-Checkliste) | PASS WITH ISSUES | Klasse 0 bestätigt: keine neuen Felder, keine Typänderung, kein Container (`cosmos.ts`, `infra/`, `shared/` unverändert), Partition `/userId` unverändert, keine Migration/Backfill; Invarianten §5 nicht berührt (bestehendes Feld `displayBrand`/`displayName`, Semantik unverändert, bleibt optional). Bestehende Dokumente werden nur lesekompatibel angefasst. Lücke: neue Cosmos-Repository-Methode ohne Contract-Test (Skill §8 und `qa.instructions.md` „New repository methods“). Siehe Finding `T-02`. |
| FT-QA-2026-117 — Dokumentation vs. Code (Hub-Struktur) | PASS WITH ISSUES | Verifiziert: `hub/` enthält `FoodEntryHub.tsx`, `FoodList.tsx`, `RelationRow.tsx`, `SearchState.tsx`, `QuantityView.tsx`, Sub-Flows, `hubReducer.ts`, `mealTimeRules.ts`; **kein** `IdleState.tsx`, `AlleFavoritenModal.tsx`, `RecentItem.tsx`. Grep in `docs/kb`: Treffer nur noch als „no longer exists“-Hinweise (`04-food-entry-hub.md` Z. 87, 212, 215, 216; `03-food-catalog.md` Z. 165). Z. 46, 85, 212, 215, 225, 234 sind korrigiert; Dateitabelle Z. 222-233 entspricht dem Verzeichnis. Rest: `04-food-entry-hub.md` Z. 126 nennt `hub/quickEntryRelevance.ts` mit `computeRelevanceOrder()`; weder Datei noch Funktion existieren in `mobile/src` (Grep leer; `computeLastUsageText`/`computeDirectAddLabel` liegen in `FoodEntryHub.utils.ts`). Gleiche Fehlreferenz in `04-food-entry-hub.md` Z. 89 und `03-food-catalog.md` Z. 159. Siehe Finding `T-03`. |
| SCOPE — keine Änderungen in `shared/`, `infra/`, `backend/scripts/`, `backend/src/lib/cosmos.ts`, App-Config, `package.json`/Lockfiles | PASS | `git status --short` für diese Pfade: keine Einträge. Zeitstempel: keine Datei in diesen Pfaden nach 21:30 geändert. |
| SCOPE — Mobile-Änderungen nur Hub + Tests | PASS | Einzige Mobile-Dateien mit Änderung nach 21:30: acht Dateien unter `mobile/src/modules/nutrition/hub/` (siehe Scope). Backend-Änderungen entsprechen den beauftragten Findings 115/116 (R2-AC-17/Addendum-Ausnahme bezog sich auf B-A.1; die Erweiterung wurde vom Auftrag ohne Planänderung freigegeben — formale Abweichung, hier nur festgehalten). |
| SCOPE — FT-QA-2026-110 unberührt, keine Legal-/Datenschutz-Änderung | PASS | `HealthConnectScreen.tsx` (zuletzt 16:39) enthält die Log-Löschung weiter nur im `IS_DEBUG_BUILD`-Block (`development`/`preview`, Z. 40-42, Log-Block ab Z. 585). `mobile/src/modules/legal/legalTexts.ts` (16:55), `docs/legal/*` (16:26/16:33) vor den Korrekturen zuletzt geändert, danach unverändert. |
| Dokumentation — KB für geänderte Fachlogik | PASS | `03-mobile.md`, `04-food-entry-hub.md`, `03-food-catalog.md`, `02-backend.md` aktualisiert. Keine API-Vertragsänderung → `09-api-reference.md` nicht erforderlich. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | `tsc --noEmit` ohne Fehler |
| `npm test --workspace=@fittrack/mobile` | 0 | 77 Testdateien, 752 Tests bestanden |
| `npm test --workspace=@fittrack/backend` | 0 | 70 Testdateien, 1726 Tests bestanden |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | `tsc --noEmit` ohne Fehler |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | „All checks passed“ (keine Shared-Imports, keine doppelten Function-IDs) |
| `npm run check:encoding` | 0 | „Encoding check passed“ |
| `npx vitest run --config vitest.contract.config.mts src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts` (in `backend/`) | 1 | Nicht ausführbar: Cosmos-Emulator nicht erreichbar (`fetch failed`, 5 Tests übersprungen). Umgebungsbeschränkung, kein Befund. |

## Verification Notes

- State: `UNVERIFIED`
  - Reason: Cosmos-Emulator nicht verfügbar (Port 8081 ist belegt, antwortet aber nicht als Cosmos-Emulator).
  - Manual action: Emulator starten (`npm run emulator:start` in `backend/`) und `npm run test:contract --workspace=@fittrack/backend` ausführen. Erwartet: alle Relation-Contract-Tests grün, einschließlich „keeps displayBrand in the stored document when recordUsage omits it“ und `getByFoodRef` nicht gefunden → `null` (echtes SDK-Verhalten für 404). Ergebnis: ______
- State: `UNVERIFIED`
  - Reason: Rot-vor-Fix (6 Fehlschläge) vom Implementierer gemeldet, von QA nicht reproduziert.
  - Manual action: Optional `isRemoteImageUri`-Guards in `QuantityView.tsx`, `FoodEntryHub.utils.ts`, `RelationRow.utils.ts` temporär zurücknehmen und `FoodEntryHub.test.ts`, `QuantityView.imageUrl.test.tsx` ausführen. Erwartet: Blob-Pfad-Tests schlagen fehl. Ergebnis: ______
- State: `MANUAL VALIDATION REQUIRED`
  - Reason: Gerät/Emulator/Screenreader nicht verfügbar; Backend nur gegen In-Memory/Mocks geprüft.
  - Manual action (Dev, lokales Backend neu gestartet): (1) Produkt mit Marke favorisieren → loggen → Favoritenliste: Marke bleibt. (2) Marke eines eigenen Produkts ändern → Favorit zeigt neue Marke (kurz warten; fire-and-forget). (3) Eigenes Lebensmittel mit Foto im Hub favorisieren (Suche, Mengenansicht, Quick-Entry-Herz) und über Direct-Add loggen → kein Fehler, Herz bleibt gesetzt, Eintrag erscheint im Tagebuch. Ergebnis: ______
- State: `MANUAL VALIDATION REQUIRED`
  - Reason: Sichtprüfung nie erfolgt.
  - Manual action: Quick-Accept-Pill (Rezept-Zutaten-Modus) in `SearchState` prüfen: Plus-Icon jetzt 16 statt 12 pt; Pill bleibt visuell ausgewogen. Ergebnis: ______
- State: `MANUAL VALIDATION REQUIRED`
  - Reason: Fire-and-forget-Sync läuft nach der Antwort (gleiches Muster wie `updateNutritionDenormalized`). Ob die Azure-Function-Instanz die Arbeit nach der Antwort zuverlässig beendet, ist lokal nicht prüfbar.
  - Manual action: Nach dem Alpha-Deploy Marke eines eigenen, favorisierten Produkts ändern und Favoriten neu laden. Erwartet: neue Marke. Ergebnis: ______

## Release-Einschätzung (Alpha: Expo-Build und Azure Function)

Release-Blocker aus QA-Sicht: **Nein.**

- Keine Blocking-Findings; alle automatisierten Prüfungen grün (Exit 0).
- Keine API-/Schema-/Infrastrukturänderung (Klasse 0, kein Backfill). Mobile und Backend sind unabhängig voneinander deploybar: der neue Mobile-Guard sendet `null` statt Blob-Pfad (vom aktuell deployten Backend-Schema bereits akzeptiert); das neue Backend ändert keine Verträge.
- Einzige Verhaltensänderung mit Verfügbarkeitsbezug ist `T-01` (Loggen liefert bei transientem Relation-Lesefehler 500). Wahrscheinlichkeit gering, Auswirkung begrenzt; Entscheidung des Users, ob vor dem Release angepasst wird.
- Voraussetzung außerhalb der QA-Prüfung: Der R2-Stand ist uncommitted und enthält untracked Dateien (u. a. `mobile/src/modules/legal/`, `mobile/src/modules/profile/*`, `docs/legal/`). Ein Expo-Build und ein Function-Deploy müssen aus dem committeten Stand erfolgen; sonst fehlen diese Dateien im Artefakt.
- Die manuellen Dev-Abläufe oben sind nicht durchgeführt (Beschränkung, keine Absenkung des Verdicts).

## Findings

Finding key: T-01
Plan reference: N/A (Korrektur zu FT-QA-2026-115 / R2Q-03; Addendum `PLAN_Profilebereich_Redesign_und_Strukturierung_R2_Addendum_Favoriten-Marke.md` Abschnitt 5, Out of Scope)
Acceptance criterion: N/A
Description: Mit dem Rethrow in `getByFoodRef` wirkt der Rezept-Guard in `addItemHandler` fail-closed. Der Guard läuft für jedes Hinzufügen mit `productId` (OFF-Katalog, eigene Produkte, Legacy), nicht nur für Rezepte; ein transienter Lesefehler der `userFoodRelations`-Container-Abfrage ergibt 500 und blockiert das Loggen normaler Lebensmittel. Zusätzlich fehlt ein Handler-Test, der das neue Verhalten festhält, und `docs/kb/tech/02-backend.md` benennt die Folge für diesen Handler nicht. Die Verhaltensänderung wurde vom Implementierer gemeldet, aber weder entschieden noch abgesichert.
Criticality: Non-blocking
Owner: Backend
Evidence: `backend/src/functions/diary.ts` Z. 372-377 (`await getByFoodRef` ohne `try/catch`, `diary.ts` im Korrekturzeitraum unverändert); `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts` Z. 223-234; `backend/src/functions/diary.test.ts` ohne Test mit rejectendem `getByFoodRef`; `docs/kb/tech/02-backend.md` Z. 125-129.
Recommendation: Bewusst entscheiden: (a) Guard fail-open belassen, indem der Handler den Lesefehler abfängt, mit `logEvent`-Warnung weiterläuft (Verfügbarkeit des Loggens vor Defense-in-Depth; Risiko beschränkt sich auf das Loggen einer eigenen Rezept-ID als freier Eintrag) oder (b) fail-closed beibehalten und explizit dokumentieren. In beiden Fällen Handler-Test für den Lesefehlerfall ergänzen und die Entscheidung in `02-backend.md` festhalten. Empfehlung QA: (a).

Finding key: T-02
Plan reference: N/A (Korrektur zu FT-QA-2026-116 / R2Q-04)
Acceptance criterion: N/A
Description: Die neue Cosmos-Repository-Methode `updateDisplayDenormalized` hat keinen Contract-Test gegen den Emulator. Skill `cosmos-data-model-and-migration` §8 und `qa.instructions.md` (Coverage Expectations, „New repository methods“) verlangen einen. Die Cosmos-Mock-Tests belegen die Logik, aber nicht das Verhalten von `listByFoodRef` + `upsert` gegen das echte SDK (Partition, Dokument-ID). Kein Contract-Test wurde in dieser Prüfung ausgeführt (Emulator nicht erreichbar).
Criticality: Non-blocking
Owner: Backend
Evidence: `backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts` (kein Verweis auf `updateDisplayDenormalized`); Grep `updateDisplayDenormalized` nur in Implementierung, Mock- und In-Memory-Tests und Handler-Tests; `.github/skills/cosmos-data-model-and-migration/SKILL.md` §8.
Recommendation: Contract-Test ergänzen: Relation anlegen, `updateDisplayDenormalized` mit neuer Marke und neuem Namen aufrufen, Dokument direkt lesen (Marke/Name neu, `isFavorite`/`usageCount` unverändert); Fall „keine Relation → kein Dokument“. Danach Contract-Suite mit Emulator ausführen.

Finding key: T-03
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` (F-2.5, R2-AC-19; Korrektur zu FT-QA-2026-117 / R2Q-05)
Acceptance criterion: R2-AC-19 (Randbereich)
Description: Die Korrektur zu FT-QA-2026-117 behebt die genannten `IdleState`/`AlleFavoritenModal`-Referenzen, aber `docs/kb/product/04-food-entry-hub.md` verweist weiterhin auf `hub/quickEntryRelevance.ts` mit `computeRelevanceOrder()` (Z. 126, Funktion zusätzlich Z. 89) und `docs/kb/domain/03-food-catalog.md` Z. 159. Weder Datei noch Funktion existieren in `mobile/src`; `computeLastUsageText()` und `computeDirectAddLabel()` liegen in `hub/FoodEntryHub.utils.ts`. Der Code ist Ground Truth. Der Konflikt war vor den Korrekturen vorhanden und wurde beim Abgleich der Hub-Struktur nicht erfasst.
Criticality: Non-blocking
Owner: Documentation
Evidence: `list_dir mobile/src/modules/nutrition/hub/` (keine `quickEntryRelevance.ts`); Grep `computeRelevanceOrder|quickEntryRelevance` in `mobile/src` ohne Treffer, in `docs/kb` drei Treffer (`04-food-entry-hub.md` Z. 89, 126; `03-food-catalog.md` Z. 159); `FoodEntryHub.utils.ts` Exports (Z. 6-149).
Recommendation: Z. 126 auf `hub/FoodEntryHub.utils.ts` (`computeLastUsageText`, `computeDirectAddLabel`, `computeMacroText`, `sortByMealTypeUsage`, `buildDirectAddItemInput`) korrigieren, `computeRelevanceOrder()` in Z. 89 und `03-food-catalog.md` Z. 159 durch die tatsächliche Sortierung (Backend-Ranking `GET /api/favorites?context=…` bzw. `sortByMealTypeUsage`) ersetzen; vorher die tatsächlich genutzte Sortierung im Code verifizieren.
