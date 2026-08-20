# Umsetzungsplan: WeeklyReview - Pre-Alpha Review Findings

**Grundlage:** Architecture Review + UX Review vom 2026-08-19  
**Bezug:** [US-01_Wochenrückblick.md](US-01_Wochenrückblick.md) · [PLAN_US-01_Wochenrückblick.md](PLAN_US-01_Wochenrückblick.md)  
**Status:** Execution-ready: Ja - PO-Entscheidungen resolved, keine offenen Produktentscheidungen

Infrastructure Impact: Alpha  
Mobile Build Impact: None

Diese Revision prüft und ergänzt ausschließlich den vorhandenen Review-Plan für den Orchestrator-Flow. Findings, Work Packages und der fachliche Scope bleiben erhalten, außer dort, wo eine konkrete Umsetzung technisch nicht belastbar war. Diese Datei ist die einzige Datei, die in dieser Planner-Runde geändert wird. Es werden keine Produktionsdateien, Tests, Knowledge-Base-Dateien, Infrastructure-Dateien oder User-Story-Dateien implementiert oder geändert.

## 1. Orchestrator-Ausführbarkeit

- Die `Recommended Execution Order` am Ende dieses Dokuments ist die verbindliche, strikt sequenzielle Queue.
- Jeder Eintrag der Queue entspricht genau einem unten beschriebenen Subtask. Der Orchestrator darf Felder nicht ergänzen, interpretieren, zusammenlegen oder umsortieren.
- Alle PO-Entscheidungen sind aufgelöst. Es gibt keinen Blocker durch eine weitere Rückfrageschleife.
- WP-F3 und WP-B3 bleiben als Post-Alpha-Backlog dokumentiert, sind aber ausdrücklich nicht Teil der aktuellen Queue.
- Es gibt kein Infrastructure-&-Release-Work-Package: Es wird keine neue Ressource, kein Container, keine Bicep-Datei und kein App Setting entworfen. `Infrastructure Impact: Alpha` bedeutet hier, dass der bestehende Backend-Releaseweg nach QA für Alpha erforderlich ist. `Deploy to Alpha` bleibt ein separater direkter Operations-Befehl und ist kein Feature-Subtask.

## 2. Requirement Assessment

**Klassifikation:** Accept with modifications.

Der fachliche Review-Plan ist ausführbar, sobald die fehlenden Routing-Felder, die feste Reihenfolge und die aufgelösten PO-Entscheidungen eingetragen sind. Die Review-Fixes ändern keine WeeklyReview-Fachformeln, keinen API-Contract und keinen AI-Prompt. Sie härten bestehende Repository-/Cache-Verträge und korrigieren klar abgegrenzte UI-/Code-Qualitätsbefunde.

**AI necessity:** Es wird keine neue AI-Funktion benötigt. Die WeeklyInsight-KI bleibt ein serverseitig orchestrierter, beratender Text. Die Backend-Fixes müssen weiterhin den bestehenden neutralen Ausfallvertrag, die Quota-Reihenfolge, Strict Structured Outputs und die Begrenzung auf sanitisierten Kontext bewahren. Deshalb ist `azure-openai-feature-integration` nur für die betroffenen Backend-/QA-Subtasks erforderlich.

**Cosmos assessment:** Es wird kein neuer Container, keine neue Entität und kein neues Dokumentfeld eingeführt. Die Änderungen betreffen die Abgrenzung heterogener Dokumente im bestehenden `aiInsights`-Container sowie eine read-kompatible Bereinigung redundanter WeeklyInsight-Felder. Es ist keine Migration und keine Bicep-Änderung erforderlich.

**Security:** Authentifizierung, User-Partitionierung, Backend-only AI und Secret-Konfiguration bleiben unverändert.

## 3. Verbindliche PO-Entscheidungen

### PO-1: Balkenbreite im Chart (F-UX-01)

Der PO entscheidet verbindlich **Option A: Balken auf 100% erweitern**.

- `styles.bar` und `styles.missingBar` füllen die Breite des bestehenden `barTrack`.
- Der Track behält `colors.surfaceMuted` als leeren vertikalen Hintergrund; die frühere Breiten-Differenz zwischen Balken und Track wird jedoch vollständig entfernt.
- `targetMarker` ist über die volle Track-Breite gespannt.
- Option B, eine gemeinsame 72%-Breite für Marker und Referenzlinie, wird nicht ausgeführt.

### PO-2: Icon für den KI-Bewertungs-Header (F-UX-09)

Der PO delegiert die Auswahl und akzeptiert folgende begründete Empfehlung verbindlich: **Option A - `feather / zap`**.

Begründung: `activity` ist im aktuellen UI bereits semantisch mit körperlicher Aktivität belegt. `zap` trennt die Wochenbewertung sichtbar von Trainings-/Aktivitätsmarkern, ist im bestehenden typisierten Feather-Icon-Wrapper verfügbar und suggeriert keine Bewertungsskala oder Favoritenfunktion wie `star`. Der Titel `Deine Wochenbewertung` bleibt die eindeutige semantische Beschriftung; `zap` ist nur das unterstützende Header-Icon. Option C wird wegen des bestätigten Activity-Mismatch nicht beibehalten.

**Open Product Owner Decisions:** None.

## 4. Technische Ausführbarkeitsprüfung und korrigierte Planfehler

### Bestätigte Findings

- **F-ARCH-01:** Der aktuelle Cosmos-Query filtert nicht explizit auf den Dokumenttyp. Tatsächliche Weekly-Dokumente werden derzeit nur implizit ausgeschlossen, weil sie kein `date`-Feld besitzen. Das Finding ist deshalb defensive Härtung, nicht der Nachweis eines aktuell reproduzierten Datenleaks. Der Filter bleibt sinnvoll; der Test muss ein echtes Cosmos-Query-Szenario abdecken.
- **F-ARCH-03:** Der aktuelle Code setzt bei Hashwechsel innerhalb des Rate-Limits `replaceCache: true`, auch für einen validen `fresh`-Eintrag. Das ist reproduzierbar und bleibt ein Fix.
- **F-ARCH-04, F-ARCH-05, F-ARCH-12:** Die Dateibenennung, die manuelle AI-Response-Prüfung und die alleinstehende Konstante sind im aktuellen Repository vorhanden. Alle Referenzen einschließlich Unit-/Eval-Tests und der betroffenen AI-KB-Referenz müssen berücksichtigt werden.
- **F-UX-01, F-UX-02, F-UX-03, F-UX-04, F-UX-08, F-UX-09, F-UX-11, F-ARCH-09 und F-ARCH-11:** Die Befunde sind im aktuellen Mobile-Code nachvollziehbar und werden als getrennte, sequenzielle Frontend-Subtasks ausgeführt.

### Planfehler, die nicht stillschweigend umgesetzt werden

- **F-ARCH-02 - direkte Feldentfernung:** `status` und `generatedAt` sind tatsächlich redundant. Das ursprüngliche "Top-Level-Felder sofort aus dem Interface entfernen" verletzt jedoch die Cosmos-Backward-Compatibility-Invariante für bereits gespeicherte Alpha-Dokumente und mögliche Rollbacks. Korrigierte Umsetzung: neue Reads verwenden nur `response.status` und `response.generatedAt`; die Top-Level-Felder bleiben als optionale Legacy-Felder lesbar und werden während der Kompatibilitätsphase weiterhin dual geschrieben, damit ältere Deployments und Rollbacks neue Dokumente lesen können. Eine physische Bereinigung alter Dokumente oder ein Ende des Dual-Writes ist nicht Teil dieses Plans.
- **F1-1-Testvorschlag:** `getWeeklyReviewMarkerCells` kann den SVG-ViewBox nicht prüfen. Der bestehende Layout-Test wird deshalb um eine kleine deterministische SVG-Geometrie-/Render-Decision-Funktion ergänzt oder diese Funktion wird aus der Komponente extrahiert. Es wird keine neue React-Native-Testabhängigkeit eingeführt. Zusätzlich bleibt die manuelle Expo-Prüfung erforderlich.
- **F-ARCH-08/F-ARCH-10 in F2-6:** Die vorgeschlagene direkte Entfernung der `targetBand`-Fallback-Berechnung und der 7-Tage-Slice ist technisch nicht belastbar. Der aktuelle Test deckt absichtlich Responses ohne `targetBand` ab, und der Slice schützt die feste Sieben-Tage-Chartgeometrie. Diese beiden Vereinfachungen werden ausdrücklich als Planfehler markiert und nicht in die Queue aufgenommen.
- **F-ARCH-05-Zod-Details:** Ein einfaches `z.string().min(1).max(...)` vor dem Trim würde das bestehende Verhalten bei Randwerten ändern. Die Zod-Validierung muss zuerst trimmen und danach die Länge prüfen, zusätzliche Properties ablehnen und weiterhin genau die bisherigen gültigen/ungültigen Fälle abbilden.
- **F-ARCH-01-Testdetails:** Ein Test ausschließlich gegen `InMemoryInsightRepository` beweist den Cosmos-Filter nicht, weil Weekly-Dokumente dort in einer getrennten Map liegen. Zusätzlich ist ein Cosmos-Contract-Test mit gemischten Dokumenten im Emulator erforderlich; der Testdatensatz muss den `_docType`-Filter tatsächlich treffen.

### Bestehende Dokumentationsabweichung

`docs/kb/tech/07-infrastructure.md` nennt in der Container-Tabelle `insights`. Der aktuelle Repository- und Infrastructure-Code verwendet dagegen `aiInsights` (`backend/src/lib/cosmos.ts`, `infra/modules/cosmos.bicep`). Die Implementierung ist die Verhaltensquelle. Diese Planner-Runde ändert die KB nicht und legt keinen neuen Container an; die Abweichung wird als separater Dokumentationsbedarf an den zuständigen Handoff gegeben.

## 5. Aktueller und gewünschter Zustand

### Aktueller Zustand

- `CosmosInsightRepository.listRecent` arbeitet ohne expliziten `_docType`-Ausschluss.
- `decideWeeklyCache` ersetzt bei einem frischen Cache und einem Hashwechsel innerhalb des 30-Minuten-Fensters den Eintrag neutral.
- WeeklyInsight-Dokumente schreiben und lesen `status` und `generatedAt` doppelt.
- Prompt-Datei, AI-Contract-Konstante und manuelle Response-Prüfung sind auf mehrere Stellen verteilt.
- `MissingLegendMarker` nutzt ein 8x8-ViewBox für Pfadkoordinaten bis 16.
- `DayBar` rendert den Zielmarker auch ohne verfügbares Ziel.
- Balken und Missing-Bar sind 72% breit; `ReferenceLine` und der solide Zielmarker liegen übereinander.
- Der Bewertungsheader verwendet `feather / activity`; der initiale Error-State verwendet `feather / info`.
- `WeeklyReviewCard` und `HomeScreen` führen einen redundanten `loading`-Prop-/State-Pfad.
- `WeeklyReviewDayOverlayDetails.body` ist immer `''`; `InfoOverlay.body` bleibt im aktuellen globalen Vertrag erforderlich.
- `weeklyReviewCardState.ts` enthält nur den Error-State-Typ und eine kleine Funktion.

### Gewünschter Zustand

- Cosmos-Queries grenzen Weekly-Dokumente explizit ab und testen das im Emulator.
- Ein frischer Cache bleibt bei einem kurzfristigen Hashwechsel erhalten, ohne alten Text auszuliefern; nicht-frische Neutral-Caches behalten ihr bestehendes Verhalten.
- Neue WeeklyInsight-Dokumente haben genau eine fachliche Quelle für Status und Generierungszeit; Legacy-Top-Level-Felder bleiben während der Kompatibilitätsphase lesbar und werden weiterhin dual geschrieben, aber nicht als kanonische Read-Quelle verwendet.
- Promptdatei und Textlängen-Konstante tragen die Version `v2`; die AI-Response wird mit Zod ohne Vertragsänderung validiert.
- Missing-Legend-Schraffur ist vollständig sichtbar, ein fehlendes Ziel zeigt keinen Zielmarker, und der Chart hat nach PO-1 eine einheitliche 100%-Breite.
- Es gibt pro Tag genau eine Zielmarkierung, der Header nutzt `zap`, und der Error-State nutzt `alert-circle`.
- Redundante Loading-/Body-/State-Strukturen sind entfernt, ohne globale InfoOverlay-Semantik oder 7-Tage-Schutz zu verändern.

## 6. Scope

### In Scope

- Die Findings F-ARCH-01, F-ARCH-02, F-ARCH-03, F-ARCH-04, F-ARCH-05, F-ARCH-09, F-ARCH-11 sowie F-UX-01, F-UX-02, F-UX-03, F-UX-04, F-UX-08, F-UX-09 und F-UX-11 in der korrigierten technischen Form.
- PO-1 Option A und PO-2 Option A (`feather / zap`).
- Regressionstests für die Backend- und deterministischen Frontend-Pfade sowie die bestehende manuelle Expo-Prüfung.
- Aktualisierung der einzigen betroffenen AI-KB-Referenz beim späteren B2-2-Handoff; die KB wird in dieser Planner-Runde nicht editiert.
- Bestehende Dev-/Alpha-Releaseprüfung ohne neue Azure-Ressource.

### Out of Scope

- Neue AI-Use-Cases, Prompttext, Promptversion, Structured-Output-JSON-Schema, Quota-Key, Quota-Limits, Cache-Key-Format oder AI-Hash-Semantik.
- `calculateWeeklyNutritionReview`, Shared-Calculator, bestehende API-Felder und die historische Zielauflösung.
- Neue Cosmos-Container, neue Dokumentfelder, Migrationen, Partition-Key-Änderungen, Bicep- oder App-Settings-Änderungen.
- Direkte physische Entfernung redundanter Legacy-Felder aus bestehenden Cosmos-Dokumenten.
- Die technisch verworfenen Vereinfachungen aus F-ARCH-08/F-ARCH-10.
- WP-F3 und WP-B3 bis nach dem Alpha-Rollout.
- FT-QA-2026-001 (Debounce) und FT-QA-2026-002 (Docs-Route); deren Status bleibt unverändert.

## 7. Bestätigte Repository- und Knowledge-Base-Fakten

- Backend besitzt den einzigen WeeklyInsight-Endpunkt `GET /api/ai/weekly-insight?date=YYYY-MM-DD`; Mobile ruft keinen AI-Provider direkt auf.
- Weekly-Daten werden deterministisch berechnet; der AI-Prompt erhält nur aggregierte, sanitizierte Werte.
- Weekly-Dokumente liegen im bestehenden `aiInsights`-Container mit Partition Key `/userId`; Dev und Alpha verwenden getrennte Cosmos-Konten.
- Azure OpenAI und Entra External ID sind absichtlich zwischen Dev und Alpha geteilt. Die Review-Fixes erzeugen keine neue OpenAI-Ressource.
- `mobile/src/modules/home/WeeklyReviewCard.tsx` hat bereits bestehende Loading-, Error-, Missing-Data- und Overlay-Pfade; die Frontend-Subtasks dürfen diese Semantik nicht neu entwerfen.
- Die aktuellen Tests sind überwiegend Pure-/Unit-Tests. Es gibt keinen bestehenden React-Native-Component-Test-Harness; visuelle Nachweise bleiben deshalb manuell und deterministische Berechnungen werden über vorhandene Layout-/ViewModel-Tests abgesichert.

## 8. Persistence Impact

- **F-ARCH-01:** Query-Härtung im bestehenden `aiInsights`-Container. Keine Schemaänderung, keine Migration, keine Auswirkung auf Dev-/Alpha-Dokumente.
- **F-ARCH-02:** Read-kompatible Dokumentbereinigung. Neue Writes lassen optionale redundante Top-Level-Felder weg; alte Dokumente mit diesen Feldern bleiben gültig und lesbar. Keine Migration, kein Container- oder Partition-Key-Wechsel. Die Implementierung muss die verschachtelten `response`-Felder als alleinige Quelle verwenden.
- **F-ARCH-03:** Nur Cache-Entscheidungs-/Write-Verhalten. Der alte frische Dokumenttext bleibt physisch vorhanden, wird bei Hash-Mismatch aber nicht ausgeliefert; es erfolgt keine Dokumentformänderung.
- Contract-Tests verwenden ausschließlich den lokalen Cosmos-Emulator, nie Dev- oder Alpha-Cosmos.

## 9. Existing Components to Reuse

- Backend: `getInsightRepository()`, `CosmosInsightRepository`, `InMemoryInsightRepository`, `decideWeeklyCache`, `withHandler()` und die bestehende `__setOpenAiClientForTests()`-Testinjektion.
- AI: bestehende `WEEKLY_INSIGHT_SCHEMA`, `WEEKLY_INSIGHT_PROMPT_VERSION`, `weeklyInsight.eval.test.ts` und `openai.weekly.test.ts`; keine parallele Prompt-/Schemaquelle.
- Frontend: `WeeklyReviewCard`, `weeklyReviewCardLayout.ts`, `weeklyReviewViewModel.ts`, bestehende Theme-Tokens, `Icon` und `InfoOverlay`.
- Tests: bestehende Vitest-Unit-Konfiguration, der Cosmos-Contract-Test und manuelle Expo-Prüfung.

## 10. Backend Work Package WP-B1: Blocking Fixes

### B1-1: Expliziter `_docType`-Filter in `listRecent` (F-ARCH-01)

**Status:** Blocking vor Alpha  
**Agent:** Backend

**Goal**

Den bestehenden `CosmosInsightRepository.listRecent`-Query defensiv auf DailyInsight-Dokumente begrenzen, ohne WeeklyInsight-Dokumente oder bestehende DailyInsight-Dokumente falsch zu behandeln.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`
- `backend/src/test-utils/cosmosEmulator.ts`
- `backend/src/lib/cosmos.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-B1-1
- AC-REG-2

**Dependencies:** None

**Implementation Constraints**

- Den Query um `(NOT IS_DEFINED(c._docType) OR c._docType != 'weeklyInsight')` ergänzen und `ORDER BY c.date DESC` beibehalten.
- Daily-Dokumente ohne `_docType` bleiben auffindbar.
- Neben einem möglichen InMemory-Regressionstest ist ein Cosmos-Contract-Test mit einem gemischten Container-Datensatz verpflichtend. Der Weekly-Fixture-Datensatz muss ein innerhalb des Datumsfensters liegendes `date`-Feld enthalten, damit der explizite Discriminator den Ausschluss tatsächlich beweist.
- Keine Änderung an `CONTAINER_DEFS`, Partition Key oder Infrastruktur.

**Expected Handoff:**
- Aktualisierter `listRecent`-Query.
- Unit-/Contract-Testnachweis, dass Weekly-Dokumente ausgeschlossen und Daily-Dokumente korrekt sortiert zurückgegeben werden.
- Bestätigung: keine Persistenzmigration und keine API-Änderung.

### B1-2: Fresh-Cache bei Hashwechsel im Rate-Limit erhalten (F-ARCH-03)

**Status:** Blocking vor Alpha  
**Agent:** Backend

**Goal**

Bei einem Hashwechsel innerhalb des 30-Minuten-Fensters keinen validen `fresh`-Cache durch eine neutrale Persistenz zu ersetzen, ohne den alten Text an den Client auszuliefern.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/lib/weeklyInsight.test.ts`
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/repositories/insightRepository.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-B1-2
- AC-REG-1

**Dependencies:**
- B2-1: Die Cache-Entscheidung verwendet nach der Legacy-Kompatibilitätsanpassung `cached.response.status` und `cached.response.generatedAt` als fachliche Quelle.

**Implementation Constraints**

- Bei Hash-Mismatch und `recent === true` gilt: `replaceCache: cached.response.status !== 'fresh'`.
- `kind: 'neutral'` bleibt bestehen; der alte Text darf weder in der Response noch über eine Cache-Hit-Entscheidung zurückgegeben werden.
- Quota-Reihenfolge, AI-Aufruf, `trackUsage` und Cache-Key bleiben unverändert.

**Expected Handoff:**
- Aktualisierte `decideWeeklyCache`-Logik.
- Unit-Test für `fresh` + Hashwechsel + recent mit `replaceCache: false`, einschließlich Nachweis, dass kein alter Text ausgeliefert wird.
- Bestätigung, dass ein nicht-frischer Neutral-Cache sein bisheriges Verhalten behält.

## 11. Backend Work Package WP-B2: Recommended before Alpha

### B2-1: Redundante WeeklyInsight-Felder read-kompatibel ausphasen (F-ARCH-02)

**Status:** Recommended before Alpha; die direkte Feldentfernung des ursprünglichen Findings ist als Planfehler korrigiert.  
**Agent:** Backend

**Goal**

`response.status` und `response.generatedAt` als alleinige fachliche Quelle etablieren, ohne alte `aiInsights`-Dokumente oder Rollbacks unlesbar zu machen.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/lib/weeklyInsight.test.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-B2-1
- AC-REG-2

**Dependencies:**
- B1-1: Repository-Query-Härtung ist abgeschlossen; bestehender `aiInsights`-Container und Partition Key bleiben unverändert.

**Persistence Impact:**

Read-kompatible Bereinigung im bestehenden `aiInsights`-Container. `status?: WeeklyInsightStoredStatus` und `generatedAt?: string | null` bleiben als optionale Legacy-Felder im Dokumenttyp toleriert. `makeWeeklyDocument` schreibt die verschachtelten Response-Felder und die Legacy-Felder während der Kompatibilitätsphase weiterhin dual; neue Reads verwenden ausschließlich die verschachtelten Felder. Neue und alte Dokumente bleiben ohne Migration lesbar; keine Änderung an Dev-/Alpha-Partitionierung oder Containerdefinition.

**Implementation Constraints**

- Alle aktuellen Reads in `weeklyInsight.ts` und `weeklyInsight.ts`-nahen Handlerpfaden verwenden `document.response.status` bzw. `document.response.generatedAt`.
- `WeeklyInsightStoredStatus` und die `storedStatus`-Transformation für `cached` -> `unavailable` bleiben erhalten.
- Neue Reads verwenden nur die verschachtelten Status-/Zeitfelder. Writes bleiben während dieser Rollout-Phase dual, damit ältere Deployments und Rollbacks kompatibel bleiben; Legacy-Top-Level-Felder werden nicht aktiv gelöscht.
- Tests müssen ein Legacy-Dokument mit redundanten Top-Level-Feldern lesen können und ein neu erzeugtes Dokument mit weiterhin vorhandenen Dual-Write-Feldern prüfen.

**Expected Handoff:**
- Read-kompatibler Dokumenttyp, kanonische Reads und kompatible Dual-Writes.
- Unit-/Contract-Regression für Legacy-Dokumente und neue Dokumente.
- Explizite Persistenzbewertung: keine Migration, kein Container-/Partition-Key-Wechsel.

### B2-2: Prompt-Datei auf `weeklyInsightV2.ts` ausrichten (F-ARCH-04)

**Status:** Recommended before Alpha  
**Agent:** Backend

**Goal**

Die Dateibenennung an die unverändert gültige exportierte Promptversion `v2` angleichen, ohne Prompttext oder Ausgabeinterpretation zu verändern.

**Required Knowledge Base:**
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/02-backend.md`

**Required Repository Context:**
- `backend/src/lib/prompts/weeklyInsightV1.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.weekly.test.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `docs/kb/tech/06-ai-integrations.md`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-B2-2
- AC-REG-1

**Dependencies:**
- B2-1: Handoff mit dem unveränderten WeeklyInsight-Dokumentvertrag.

**Implementation Constraints**

- Datei in `backend/src/lib/prompts/weeklyInsightV2.ts` umbenennen.
- Alle Source-, Unit-, Eval- und Fixture-Imports aktualisieren, insbesondere `openai.weekly.test.ts` und `weeklyInsight.eval.fixtures.ts`.
- `WEEKLY_INSIGHT_PROMPT_VERSION` bleibt exakt `v2`; Prompttext und Prompt-Kontext bleiben inhaltlich unverändert.
- `docs/kb/tech/06-ai-integrations.md` muss die neue Datei referenzieren. Diese spätere Dokumentationsänderung ist Teil des Handoffs, nicht dieser Planner-Runde.

**Expected Handoff:**
- Umbenannte Promptdatei und vollständig aktualisierte Referenzen.
- Nachweis, dass keine aktive Source-/Test-Referenz auf `weeklyInsightV1` verbleibt.
- Bestätigung, dass Promptversion und Promptinhalt unverändert sind.

### B2-3: `weeklyInsightContract.ts` auflösen (F-ARCH-12)

**Status:** Recommended before Alpha  
**Agent:** Backend

**Goal**

Die alleinstehende Textlängen-Konstante in die versionierte WeeklyInsight-Promptdatei verschieben und eine einzige Quelle für den bestehenden 750-Zeichen-Vertrag herstellen.

**Required Knowledge Base:**
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`

**Required Repository Context:**
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.weekly.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/src/lib/weeklyInsightContract.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-B2-3
- AC-REG-1

**Dependencies:**
- B2-2: Die Ziel-Datei `weeklyInsightV2.ts` und ihre Imports existieren.

**Implementation Constraints**

- `WEEKLY_INSIGHT_TEXT_MAX_LENGTH = 750` in `weeklyInsightV2.ts` definieren und exportieren.
- `openai.ts`, Eval-Test und alle Unit-Tests auf diese Quelle umstellen; den bestehenden Re-Export aus `openai.ts` für Test-/Caller-Kompatibilität erhalten.
- `weeklyInsightContract.ts` erst entfernen, wenn keine Source-Referenz mehr besteht.
- Prompttext, JSON-Schema-Grenze und 750-Zeichen-Verhalten bleiben unverändert.

**Expected Handoff:**
- Entfernte Fragmentdatei und aktualisierte Importe.
- Unit-Testnachweis für exakt 750 Zeichen, Trim-Verhalten und die bestehende Rejection-Grenze.
- Bestätigung: keine Prompt- oder API-Vertragsänderung.

### B2-4: Zod-Validierung der WeeklyInsight-AI-Response (F-ARCH-05)

**Status:** Recommended before Alpha  
**Agent:** Backend

**Goal**

Die manuelle WeeklyInsight-Response-Prüfung in `openai.ts` durch Zod ersetzen, ohne den bestehenden Structured-Output-, Trim-, Längen- oder Fehlervertrag zu verändern.

**Required Knowledge Base:**
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.weekly.test.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/package.json`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-B2-4
- AC-REG-1

**Dependencies:**
- B2-3: Die einzige Textlängen-Konstante wird aus `weeklyInsightV2.ts` bezogen.

**Implementation Constraints**

- Zod ist bereits in `backend/package.json` vorhanden; keine neue Dependency.
- Das Runtime-Schema muss ein Objekt mit genau `text` akzeptieren, zusätzliche Properties ablehnen, `text` trimmen und erst danach `1..750` Zeichen validieren.
- `finish_reason === 'length'`, leere Providerantwort, ungültiges JSON und Schemafehler bleiben Fehlerpfade; `trackUsage` darf dadurch nicht nachträglich ausgelöst werden.
- Die Structured-Output-Definition bleibt `json_schema`, `strict: true`, `additionalProperties: false` und unverändertem `WEEKLY_INSIGHT_SCHEMA`.

**Expected Handoff:**
- Zod-basierte Validierung mit erhaltenem Normalisierungs-/Fehlerverhalten.
- Erweiterter oder aktualisierter `openai.weekly.test.ts`-Nachweis für Whitespace, Zusatzfelder, falschen Typ, 0/751 Zeichen und exakt 750 Zeichen.
- Bestätigung, dass kein Prompt-Eval wegen einer semantischen Prompt-/Schemaänderung erforderlich wurde; der Promptvertrag blieb unverändert.

## 12. Frontend Work Package WP-F1: Blocking Fixes

### F1-1: `MissingLegendMarker` SVG-Bug beheben (F-UX-03)

**Status:** Blocking vor Alpha  
**Agent:** Frontend

**Goal**

Das Missing-Pattern der Legende innerhalb der sichtbaren 8x8pt-Ausgabe mit zwei Diagonallinien rendern.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.ts`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`
- `mobile/src/app/theme/index.ts`
- `mobile/package.json`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F1-1

**Dependencies:** None

**Implementation Constraints**

- Das SVG-ViewBox muss die verwendeten Koordinaten bis `patternSize * 2` enthalten; Ausgabegröße und Theme-Tokens bleiben unverändert.
- Für den bestehenden Vitest-Harness eine kleine deterministische Geometrie-Funktion aus der Komponente extrahieren oder dort wiederverwenden. Der Test muss ViewBox-Grenzen und zwei Liniensegmente prüfen; `getWeeklyReviewMarkerCells` allein ist kein ausreichender Nachweis.
- Keine neue Test- oder SVG-Abhängigkeit.

**Expected Handoff:**
- Sichtbar korrigiertes Missing-Pattern mit unveränderter 8x8pt-Ausgabe.
- Bestehender Layout-Test mit einem echten Geometrie-/ViewBox-Regressionstest.
- Manuelle Expo-Prüfanweisung für die Legende als Hinweis an QA.

### F1-2: `targetMarker` bei fehlendem Ziel ausblenden (F-UX-04)

**Status:** Blocking vor Alpha  
**Agent:** Frontend

**Goal**

Keinen Zielmarker rendern, wenn `day.hasTarget` false ist, damit ein fehlendes Ziel nicht als 100%-Referenz erscheint.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.ts`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F1-2
- AC-REG-3

**Dependencies:**
- F1-1: Der bestehende Chart-/Legend-Testpfad und die deterministische Render-Decision-Teststrategie sind etabliert.

**Implementation Constraints**

- Die Bedingung erfolgt direkt an der `targetMarker`-Ausgabe; `targetMarkerUnavailable` und die zugehörige Bedingungsstyle-Verwendung entfallen.
- Ein vorhandenes Ziel darf weiterhin genau einen Marker zeigen, auch wenn die Ernährung fehlt. Es werden keine Datenstatus- oder Zielauflösungsregeln im ViewModel geändert.

**Expected Handoff:**
- Aktualisierte `DayBar`-Darstellung ohne Marker bei fehlendem Ziel.
- Deterministischer Test für `hasTarget: false` und `hasTarget: true` sowie unveränderte Missing-/Zero-Semantik.
- Manuelle Expo-Prüfanweisung für `missing_nutrition_and_target` an QA.

## 13. Frontend Work Package WP-F2: Recommended before Alpha

### F2-1: Balkenbreite auf PO-1 Option A umstellen (F-UX-01, F-UX-02)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Die sichtbare Breite von Datenbalken, Missing-Bar und Zielmarker auf den gemeinsamen 100%-Track ausrichten.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.ts`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-1
- AC-REG-3

**Dependencies:**
- F1-2: Die Marker-Semantik für fehlende Ziele ist stabil.
- PO-1: Option A ist verbindlich entschieden.

**Implementation Constraints**

- `styles.bar` und `styles.missingBar` auf `width: '100%'` setzen.
- `barTrack` darf seinen vertikalen `surfaceMuted`-Hintergrund behalten; es gibt keine zusätzliche 72%-Visualisierung.
- Kein gerätespezifischer Layoutwert und keine Änderung an `chartScaleMaxPercent`.

**Expected Handoff:**
- Chart mit einheitlicher 100%-Breite und unveränderter Höhe/Skalierung.
- Aktualisierte Layout-/Visual-Regressionsnachweise.
- Bestätigung, dass Option B nicht implementiert wurde.

### F2-2: Doppelte Referenzlinie entfernen (F-UX-02)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Pro Tag genau eine sichtbare Zielmarkierung behalten und die überlagernde gestrichelte `ReferenceLine` entfernen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-2
- AC-REG-3

**Dependencies:**
- F2-1: Zielmarker und Balken verwenden den gemeinsamen 100%-Track.

**Implementation Constraints**

- `ReferenceLine` sowie `styles.referenceLine` und `styles.referenceLineDash` entfernen.
- `targetMarker` bleibt die einzige Zielmarkierung und wird weiterhin nur bei `day.hasTarget` gerendert.
- Keine neue gestrichelte Ersatzvisualisierung ohne zusätzliche Produktentscheidung.

**Expected Handoff:**
- Komponente ohne doppelte Referenzlinien-Renderung.
- Test-/Reviewnachweis für genau eine Zielmarkierung pro Tag.

### F2-3: KI-Bewertungs-Icon auf `feather / zap` setzen (F-UX-09, PO-2)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Das semantisch unpassende Activity-Icon im Bewertungsheader durch die verbindlich empfohlene `zap`-Darstellung ersetzen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/shared/components/Icon.tsx`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-3

**Dependencies:**
- F2-2: Chart-Zielmarkierung ist abgeschlossen; keine funktionale Abhängigkeit, aber gemeinsamer Frontend-Reviewpfad.
- PO-2: Option A (`feather / zap`) ist verbindlich entschieden.

**Expected Handoff:**
- Bewertungsheader mit `feather / zap`, unverändertem deutschem Titel und unverändertem AI-Text-/Expand-Verhalten.
- Typecheck-Nachweis für den bestehenden `Icon`-Wrapper.

### F2-4: Initiales Error-Icon auf `alert-circle` setzen (F-UX-08)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Den initialen WeeklyReview-Fehlerzustand visuell mit dem bereits im Refresh-Fehler verwendeten `feather / alert-circle` vereinheitlichen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardState.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-4

**Dependencies:**
- F2-3: Vorheriger Frontend-Handoff mit unverändertem State-Vertrag.

**Expected Handoff:**
- Initialer Fehlerzustand mit `alert-circle` und unverändertem Retry-Verhalten.

### F2-5: Redundanten Loading-Pfad entfernen (F-UX-11)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Den wirkungslosen Loading-Zweig in `WeeklyReviewCard` einschließlich des nicht mehr benötigten `loading`-Props und HomeScreen-States entfernen, ohne Skeleton-/Error-Verhalten zu ändern.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/weeklyReviewCardState.ts`
- `mobile/src/modules/home/weeklyReviewCardState.test.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-5
- AC-REG-3

**Dependencies:**
- F2-4: Bestehender Error-State-Vertrag bleibt erhalten.

**Implementation Constraints**

- `loading` aus den Props und dem Aufruf entfernen, sofern danach keine Verwendung verbleibt.
- `weeklyLoading` und seine Setter in `HomeScreen` entfernen, wenn sie ausschließlich diesen Prop bedienen.
- Bei `review === null` und initialem Fehler bleibt `WeeklyReviewError` sichtbar; ohne Fehler bleibt `WeeklyReviewSkeleton` sichtbar. Bei vorhandenem Review bleibt der stale Refresh-Fehler unverändert.

**Expected Handoff:**
- Vereinfachter Card-/Home-Lifecycle ohne toten Loading-Zweig.
- Mobile-Typecheck und State-Regressionsergebnis.

### F2-7: Leeres Overlay-Body-Feld aus dem ViewModel entfernen (F-ARCH-09)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Die immer leere `body`-Eigenschaft aus `WeeklyReviewDayOverlayDetails` entfernen, ohne den globalen `InfoOverlay`-Vertrag unnötig zu ändern.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/shared/components/InfoOverlay.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-6
- AC-REG-3

**Dependencies:**
- F2-5: Card-Props und Home-Lifecycle sind bereinigt; Overlay-Datenstruktur bleibt kompatibel.

**Implementation Constraints**

- `body` aus Interface und Formatter entfernen.
- `InfoOverlay.body` bleibt als bestehender erforderlicher Prop bestehen; die WeeklyReviewCard übergibt am Aufruf explizit `body=""`.
- Keine globale Änderung an anderen Overlay-Aufrufern und kein zusätzlicher Content-Slot.

**Expected Handoff:**
- ViewModel ohne künstliches Body-Feld.
- Aktualisierte ViewModel-Tests für strukturierte Overlay-Summaries und unveränderte InfoOverlay-Dismiss-Semantik.

### F2-8: WeeklyReview-Error-State in das ViewModel zusammenführen (F-ARCH-11)

**Status:** Recommended before Alpha  
**Agent:** Frontend

**Goal**

Die einzige kleine Error-State-Abstraktion in `weeklyReviewViewModel.ts` konsolidieren und eine parallele State-Datei entfernen, ohne das Verhalten zu ändern.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `mobile/src/modules/home/weeklyReviewCardState.ts`
- `mobile/src/modules/home/weeklyReviewCardState.test.ts`
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-F2-7
- AC-REG-3

**Dependencies:**
- F2-7: ViewModel- und Card-Änderungen sind auf dem finalen Overlay-Datenpfad.

**Implementation Constraints**

- `WeeklyReviewErrorState` und `getWeeklyReviewErrorState` in die ViewModel-Datei verschieben.
- `weeklyReviewCardState.ts` und seinen Test entfernen, sobald Imports und Testabdeckung im ViewModel-Test aktualisiert sind.
- Die unabhängige `weeklyReviewEvaluationState.ts` bleibt unverändert.

**Expected Handoff:**
- Konsolidierte ViewModel-Datei, entfernte State-Datei und verschobene Regressionstests.
- Bestätigung des unveränderten `none`-/`initial`-/`stale`-Verhaltens.

## 14. Nicht ausführbarer Teil von F2-6: Planfehler F-ARCH-08/F-ARCH-10

Der ursprüngliche Vorschlag, `targetBand` ohne Fallback direkt aus der Response zu übernehmen und `chartDays` direkt auf `viewModel.days` zu setzen, wird nicht als Subtask geroutet. Die aktuelle Response-/Testkompatibilität und der Sieben-Tage-Schutz sind im Repository beabsichtigte defensive Regeln. Eine Entfernung würde den Scope nicht nur bereinigen, sondern Verhalten verschärfen. Eine spätere Änderung benötigt einen eigenen technischen Nachweis und eine neue Planentscheidung.

## 15. Deferred Work Package WP-F3: Frontend Backlog nach Alpha

Diese Arbeit ist nicht Teil der aktuellen `Recommended Execution Order` und darf vom Orchestrator in diesem Lauf nicht enqueued werden.

### F3-1: Restliche Frontend-Review-Findings

**Status:** Deferred until after Alpha  
**Agent:** Frontend

**Goal**

Die verbleibenden UX-/Code-Qualitäts-Findings nach dem Alpha-Rollout separat bewerten und in einem eigenen, priorisierten Folgepaket umsetzen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:** None - deferred scope requires a separate QA baseline.

**Dependencies:**
- QA-1 PASS und abgeschlossener Alpha-Rollout.

**Expected Handoff:**
- Folgeplan oder umgesetzte Einzel-Findings für F-UX-05, F-UX-06, F-UX-07, F-UX-10, F-UX-12, F-ARCH-06, F-ARCH-07 und F-ARCH-15 mit eigener Acceptance-Criteria-Matrix.

**Deferred Findings:**

| Finding | Beschreibung |
|---|---|
| F-UX-05 | Minimum-Balken bei 0% auf `spacing.sm = 8pt` erhöhen |
| F-UX-06 | Marker-Icon-Größe von 10pt auf 12pt, Badge von 12pt auf 20pt |
| F-UX-07 | `accessibilityHint` Balken-Button vereinfachen |
| F-UX-10 | Markerlegende: konkrete Aktivitätstypen bei eindeutiger Woche |
| F-UX-12 | Farblegende: `numberOfLines={2}` auf LegendText |
| F-ARCH-06 | `hasExplicitDayContext` Kommentar ergänzen |
| F-ARCH-07 | API-Boundary-Validierung via Zod (`date`-Query-Param) |
| F-ARCH-15 | Differenzierter Neutral-Text bei `quota_exceeded` |

## 16. Deferred Work Package WP-B3: Backend Backlog nach Alpha

Diese Arbeit ist nicht Teil der aktuellen `Recommended Execution Order` und darf vom Orchestrator in diesem Lauf nicht enqueued werden.

### B3-1: Restliche Backend-/AI-Review-Findings

**Status:** Deferred until after Alpha  
**Agent:** Backend

**Goal**

Die verbleibenden AI-Evaluations- und Prompt-Temperatur-Findings nach Alpha anhand der bestehenden Eval-/Quota-Regeln separat bewerten.

**Required Knowledge Base:**
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/openai.ts`
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`
- `backend/src/lib/weeklyInsight.test.ts`
- `shared/lib/weeklyReviewCalculator.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:** None - deferred scope requires a separate QA baseline.

**Dependencies:**
- QA-1 PASS und abgeschlossener Alpha-Rollout.

**Expected Handoff:**
- Dokumentierte Entscheidung oder Folgeänderung für FT-QA-2026-003, FT-QA-2026-004 und F-ARCH-13 inklusive Eval-Ergebnis, falls Prompt-/Schemaverhalten geändert wird.

**Deferred Findings:**

| Finding | Beschreibung |
|---|---|
| FT-QA-2026-003 | `temperature: 0.3` -> `0` evaluieren |
| FT-QA-2026-004 | Eval-Fixture totals mit Kalkulator-Inklusions-Regeln abgleichen |
| F-ARCH-13 | `temperature`-Entscheidung dokumentieren (Akzeptanz oder Fix) |

## 17. QA Work Package Q-ALPHA-1

### QA-1: Vollständige Review- und Regressionprüfung

**Status:** Required final gate before Alpha  
**Agent:** QA

**Goal**

Die Implementierung gegen alle aktuellen Acceptance Criteria, die unveränderten WeeklyInsight-/Cosmos-/Mobile-Baselines, den Scope und die Handoffs prüfen. QA führt keine der technisch verworfenen F2-6-Vereinfachungen als Soll-Anforderung ein.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`
- `backend/src/lib/weeklyInsight.ts`
- `backend/src/lib/weeklyInsight.test.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/openai.weekly.test.ts`
- `backend/src/lib/prompts/weeklyInsightV2.ts`
- `backend/src/lib/prompts/weeklyInsight.eval.test.ts`
- `backend/src/functions/weeklyInsight.ts`
- `backend/src/functions/weeklyInsight.test.ts`
- `mobile/src/modules/home/WeeklyReviewCard.tsx`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/weeklyReviewCardLayout.ts`
- `mobile/src/modules/home/weeklyReviewCardLayout.test.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.ts`
- `mobile/src/modules/home/weeklyReviewViewModel.test.ts`
- `mobile/src/shared/components/InfoOverlay.tsx`
- `mobile/src/shared/components/Icon.tsx`
- `docs/kb/tech/06-ai-integrations.md`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**
- AC-B1-1 through AC-B2-4
- AC-F1-1 through AC-F2-8
- AC-REG-1 through AC-REG-3

**Dependencies:**
- B1-1, B2-1, B1-2, B2-2, B2-3, B2-4, F1-1, F1-2, F2-1, F2-2, F2-3, F2-4, F2-5, F2-7 and F2-8 completed with their declared handoffs.
- Der aktuelle Backend-Stand muss für die finale Alpha-Prüfung über den bestehenden Releaseweg in Dev/Alpha erreichbar sein; fehlende Credentials, Emulatoren oder reale Geräte sind als `UNVERIFIED` zu dokumentieren, nicht als erfundene Findings.

**Expected Handoff:**
- Acceptance-Criteria-Matrix mit positivem, negativem und relevantem Edge-Case-Nachweis.
- Ergebnisse von Backend-Unit-Tests, Cosmos-Contract-Tests, Mobile-Tests, Typechecks und `backend npm run build:verify`.
- Manuelle Expo-Prüfung der 8x8-Schraffur, fehlender Zielmarker, 100%-Balkenbreite, genau einer Zielmarkierung, `zap`-/`alert-circle`-Icons und unverändertem Loading-/Error-Verhalten.
- Prüfung, dass Prompt, Quota, Structured Output, Cache-Key, sanitized AI context und Legacy-Cosmos-Dokumente vertragskonform bleiben.
- Review-Urteil `PASS`, `PASS WITH ISSUES` oder `FAIL` mit konkreten Findings und separaten `UNVERIFIED`-Hinweisen.

## 18. Documentation Updates

- B2-2 aktualisiert `docs/kb/tech/06-ai-integrations.md` von `weeklyInsightV1.ts` auf `weeklyInsightV2.ts`.
- Die Containerabweichung `insights` versus `aiInsights` in `docs/kb/tech/07-infrastructure.md` wird als bestehender Dokumentationsbedarf an den zuständigen KB-Handoff gegeben. Sie ist nicht durch diese Review-Fixes zu lösen und wird in dieser Planner-Runde nicht editiert.
- Für die übrigen Findings ist keine fachliche KB-Änderung erforderlich, weil weder API-, Domänen-, Quota- noch Produktverhalten geändert wird.

## 19. Test Strategy

- Backend-Unit-Tests: `cd backend && npm test`.
- Backend-Build-Importprüfung: `cd backend && npm run build:verify`.
- Cosmos-Contract-Test für B1-1 und B2-1: `cd backend && npm run test:contract`, ausschließlich gegen den lokalen Emulator.
- Mobile-Unit-Tests: `cd mobile && npm test`.
- Mobile-Typecheck: `cd mobile && npm run typecheck`.
- Prompt-Evals sind für diese Queue nicht wegen einer semantischen Prompt-/Structured-Output-Änderung verpflichtend. Falls ein Backend-Agent entgegen diesem Plan Prompttext oder Ausgabeinterpretation ändert, wird `cd backend && npm run test:eval` verpflichtend und der Orchestrator muss den Planfehler behandeln.
- Visuelle Checks auf Expo/S23 beziehungsweise S23 Ultra prüfen die nicht durch den bestehenden Unit-Test-Harness abbildbaren SVG-, Layout- und Accessibility-Aspekte.

## 20. Acceptance Criteria

### Backend

**AC-B1-1:** `CosmosInsightRepository.listRecent` schließt ein `_docType: 'weeklyInsight'`-Dokument auch dann aus, wenn dessen `userId`, `date` und Datumsfenster ansonsten passen. Ein DailyInsight-Dokument ohne `_docType` bleibt enthalten und die Reihenfolge bleibt `date DESC`. Nachweis: Unit-/Cosmos-Contract-Test.

**AC-B1-2:** Bei `fresh`-Cache, geändertem Input-Hash und aktuellem `lastAttemptAt` liefert `decideWeeklyCache` `kind: 'neutral'`, `replaceCache: false` und `evaluation.text: null`. Der alte Text wird nicht ausgeliefert und der frische Dokumentinhalt wird nicht neutral überschrieben. Nachweis: Unit-Test.

**AC-B2-1:** Neue WeeklyInsight-Reads verwenden `response.status` und `response.generatedAt`; neue Writes halten während der Kompatibilitätsphase die verschachtelten und die redundanten Top-Level-Felder dual. Ein bestehendes Dokument mit Legacy-Feldern bleibt ohne Fehler lesbar. Keine Migration oder Feldlöschung gegen bestehende Dokumente. Nachweis: Unit-/Contract-Test.

**AC-B2-2:** Keine aktive Source-, Unit- oder Eval-Referenz verwendet nach B2-2 den Dateinamen `weeklyInsightV1`; die Datei heißt `weeklyInsightV2.ts`, `WEEKLY_INSIGHT_PROMPT_VERSION` bleibt `v2`, und der Prompttext bleibt byte-/inhaltlich unverändert. Nachweis: Repository-Suche und Tests.

**AC-B2-3:** `WEEKLY_INSIGHT_TEXT_MAX_LENGTH` existiert als exportierte Konstante in `weeklyInsightV2.ts`; `weeklyInsightContract.ts` ist nicht mehr importiert oder vorhanden; 750-Zeichen-Grenze und Re-Export aus `openai.ts` bleiben funktionsgleich. Nachweis: Unit-Test und Repository-Suche.

**AC-B2-4:** Die Zod-Validierung akzeptiert gültigen Text nach Trim einschließlich exakt 750 Zeichen und weist Whitespace-only, 751 Zeichen, falschen Typ, ungültiges JSON und zusätzliche Properties zurück. `finish_reason: 'length'` bleibt unavailable und verbraucht keine Quota. Nachweis: `openai.weekly.test.ts` und bestehender Handler-Test.

### Frontend

**AC-F1-1:** Die Missing-Legend-Geometrie enthält zwei sichtbare Diagonalsegmente innerhalb des ViewBox und wird weiterhin als 8x8pt-Ausgabe gerendert. Nachweis: deterministischer Layout-Test und manuelle Expo-Prüfung.

**AC-F1-2:** Bei `hasTarget: false` wird kein `targetMarker` gerendert. Bei `hasTarget: true` bleibt genau ein Zielmarker sichtbar, unabhängig davon, ob Nutrition-Daten verfügbar sind. Nachweis: Render-Decision-/Layout-Test und manuelle Prüfung mit fehlenden Daten.

**AC-F2-1:** Datenbalken und Missing-Bar sind 100% breit; der `barTrack` bleibt der einzige Track-Hintergrund und die Chart-Höhe/Skalierung bleibt unverändert. Nachweis: Code-/Layout-Review und Expo.

**AC-F2-2:** `ReferenceLine` wird nicht mehr gerendert und es existiert pro Tag höchstens die eine durch `targetMarker` kontrollierte Zielmarkierung. Nachweis: Code-Review und visuelle Prüfung.

**AC-F2-3:** `EvaluationSection` verwendet `feather / zap`; Titel, Text, Expand/Collapse und Accessibility bleiben unverändert. Nachweis: Mobile-Typecheck und manuelle Prüfung.

**AC-F2-4:** Der initiale WeeklyReview-Fehlerzustand verwendet `feather / alert-circle`; Retry, Stale-Fehler und Accessibility bleiben funktionsgleich. Nachweis: Code-Review und manuelle Prüfung.

**AC-F2-5:** `loading`/`weeklyLoading` wird nicht mehr als redundanter Card-Pfad geführt. `review === null` ohne Fehler zeigt Skeleton, `review === null` mit initialem Fehler zeigt den Retry-Fehler und ein vorhandener Review zeigt den stale Fehler. Nachweis: Typecheck, State-Tests und manuelle Prüfung.

**AC-F2-6:** `WeeklyReviewDayOverlayDetails` enthält kein künstliches `body`-Feld mehr; `InfoOverlay` erhält für WeeklyReview weiterhin explizit `body=""`, und globale Overlay-Aufrufer bleiben unverändert. Nachweis: ViewModel-Tests und Typecheck.

**AC-F2-7:** `WeeklyReviewErrorState` und `getWeeklyReviewErrorState` sind im ViewModel konsolidiert, die alte State-Datei ist entfernt und `none`/`initial`/`stale` bleiben unverändert. Nachweis: ViewModel-Regressionstest und Typecheck.

### Regression und Architektur

**AC-REG-1:** Der bestehende WeeklyInsight-Vertrag bleibt erhalten: sieben abgeschlossene Tage, sanitizierter AI-Kontext ohne Rohdaten, `strict: true`, Quota vor AI, Tracking nur nach gültiger Antwort, neutraler Quota-/Provider-Fehler und keine Ausgabe alten Textes nach Hashwechsel. Nachweis: bestehende Backend-Tests und QA-Matrix.

**AC-REG-2:** Es gibt keine neue Cosmos-Container-/Partition-Key-/Bicep-Änderung; Legacy-WeeklyInsight-Dokumente bleiben mit `/userId` im bestehenden `aiInsights`-Container lesbar. Nachweis: Contract-Test, Diff-/Repository-Review und Persistence Impact Handoff.

**AC-REG-3:** Die bestehende 0-kcal-, Missing-Data-, historische Ziel- und feste Sieben-Tage-Semantik bleibt unverändert. Nachweis: Shared-/Mobile-Regressionstests und QA-Matrix.

## 21. Risks and Edge Cases

- Cosmos-Contract-Tests benötigen den lokalen Emulator; ein fehlender Emulator ist `UNVERIFIED`, kein automatisch erfundenes Defect.
- Die physische Existenz alter Top-Level-Felder ist erwartbar. Ein Test darf deren bloßes Vorhandensein nicht als Fehler bewerten, solange neue Writes sie nicht erzeugen und Reads die verschachtelte Quelle nutzen.
- Ein frischer Cache darf bei Hashwechsel nicht ausgeliefert werden, obwohl er physisch erhalten bleibt. Diese Trennung ist für F-ARCH-03 entscheidend.
- `0 kcal` und `0 g` bleiben gültige vorhandene Daten; `null` bleibt fehlende Datenlage.
- Eine leere oder nicht verfügbare AI-Bewertung darf den deterministischen Chart nicht blockieren.
- Ohne React-Native-Component-Harness sind SVG-/Layout-/Accessibility-Nachweise teilweise manuell. QA muss diese als `UNVERIFIED` kennzeichnen, wenn Expo oder ein reales Gerät fehlt.
- Die KB-Tabelle `insights` darf nicht dazu führen, dass ein Agent einen zweiten Container anlegt. Der aktuelle Code `aiInsights` ist für diese Umsetzung maßgeblich.

## 22. Recommended Execution Order

Die folgende Reihenfolge ist die einzige Orchestrator-Queue und wird strikt nacheinander ausgeführt:

1. **B1-1** - Expliziter `_docType`-Filter in `listRecent`.
2. **B2-1** - Read-kompatible Ausphasung redundanter WeeklyInsight-Felder.
3. **B1-2** - Fresh-Cache bei Hashwechsel im Rate-Limit erhalten.
4. **B2-2** - Prompt-Datei auf `weeklyInsightV2.ts` ausrichten.
5. **B2-3** - `weeklyInsightContract.ts` auflösen.
6. **B2-4** - Zod-Validierung der WeeklyInsight-AI-Response.
7. **F1-1** - `MissingLegendMarker` SVG-Bug beheben.
8. **F1-2** - `targetMarker` bei fehlendem Ziel ausblenden.
9. **F2-1** - Balkenbreite auf PO-1 Option A umstellen.
10. **F2-2** - Doppelte Referenzlinie entfernen.
11. **F2-3** - KI-Bewertungs-Icon auf `feather / zap` setzen.
12. **F2-4** - Initiales Error-Icon auf `alert-circle` setzen.
13. **F2-5** - Redundanten Loading-Pfad entfernen.
14. **F2-7** - Leeres Overlay-Body-Feld aus dem ViewModel entfernen.
15. **F2-8** - WeeklyReview-Error-State in das ViewModel zusammenführen.
16. **QA-1** - Vollständige Review- und Regressionprüfung.

F-ARCH-08/F-ARCH-10 aus F2-6, WP-F3 und WP-B3 werden nicht in diese Queue aufgenommen. Nach einem QA-`PASS` und dem Merge erfolgt der bestehende operative Releaseweg nach Alpha durch einen separaten direkten `Deploy to Alpha`-Befehl. Ein neuer Dev Build ist wegen `Mobile Build Impact: None` nicht aus diesem Plan abzuleiten; die finale operative Build-Entscheidung verbleibt bei Infrastructure & Release.
