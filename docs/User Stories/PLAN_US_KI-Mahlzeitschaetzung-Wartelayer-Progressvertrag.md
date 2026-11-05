# PLAN — KI-Mahlzeitschätzung: Phasenvertrag für den Foto-Wartelayer

- Status: WP-BE-01 COMPLETE; WP-FE-01 noch nicht implementiert (vorheriger BLOCKED-Handoff ausschließlich wegen fehlendem Android-Gerät/Emulator; kein negativer technischer Befund); WP-QA-01 NOT STARTED. Diese Revision setzt die Nutzerklarstellung um. Eine frühere Planfreigabe gilt für diese Revision nicht: Vor Fortsetzung mit Frontend oder QA ist ein frisches explizites `APPROVE` erforderlich.
- Planpfad: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag.md`
- Infrastructure Impact: Alpha
- Mobile Build Impact: None

## Kurzbewertung

Die Änderung ist klein, aber sie verändert den Response-Vertrag zwischen Backend und Mobile. WP-BE-01 ist bereits abgeschlossen; Frontend und QA sind die verbleibenden Zuständigkeiten. Das fehlende Android-Gerät verhindert weder die Frontend-Implementierung noch den QA-Start.

**Muss bleiben:** Der Foto-Check wird erst nach Rückkehr des tatsächlichen Foto-Assessments als abgeschlossen gezeigt. Die Schätzanimation beginnt erst nach einer Backend-Meldung unmittelbar vor dem bestehenden Estimate-Aufruf. Dieselbe POST-Anfrage, Provideraufrufe und -reihenfolge, Resultatvalidierung und Quota bleiben erhalten.

**Graceful Degradation:** Erhält der Client alle Phasenmeldungen zusammen mit dem Ergebnis, bleibt der Wartelayer bis zum Ergebnis im bisherigen unbestimmten Zustand; es werden keine Zwischenzustände nachgeholt. Das ist eine akzeptable Degradation, kein Acceptance- oder Release-Blocker. Die fehlende Live-Prüfung ist kein negativer Befund. PO-1 greift nur, wenn technische Evidenz zeigt, dass die Umsetzung ein natives Modul oder unverhältnismäßige Komplexität erfordert.

**Kann entfallen:** separate Shared-Typ-, erneute Backend-Machbarkeits- und Dokumentationspakete; SSE als Protokollalternative (der Backend-Vertrag steht fest); globale Handler-/Axios-Wrapper-Änderungen; umfangreiche Fehler-/Geräte-/Performance-Matrizen; ein eigenes Infrastrukturpaket; ein Geräte-Smoke vor FE/QA, Flex-Vorab-Nachweis oder Alpha-Validierungsdeploy vor QA.

## Product-Owner-Entscheidungen

| ID | Entscheidung | Konsequenz | Status |
|---|---|---|---|
| PO-1 | A: Performance hat Vorrang vor einem irreführenden oder unverhältnismäßig aufwendigen Phasenwechsel. | Nur wenn technische Evidenz zeigt, dass der Phasenwechsel ein natives Modul oder unverhältnismäßige Komplexität erfordert, wird diese Komplexität nicht eingeführt und der bestehende Wartelayer beibehalten. Ein fehlendes Gerät/ein nicht ausgeführter Live-Test ist kein solcher Nachweis. Gepufferte Ereignisse degradieren gemäß AC-5 ohne nachgeholte Zwischenzustände. | Entschieden |
| PO-2 | Theoretisch erwarteter Zusatzaufwand unter 100 ms ist akzeptabel. | Engineering-Schätzung, keine Messung oder Garantie. Keine Vorher-/Nachher-Benchmark, p50/p95-Messung oder Performance-Abnahmegrenze. | Entschieden |

Keine offene Produktentscheidung. Die RN/Axios-Teilzustellung bleibt eine nicht blockierende Laufzeitfrage für die manuelle Prüfung nach QA (Abschnitt 10). Ein frisches `APPROVE` dieser Revision ist erforderlich und stellt keine Releasefreigabe dar.

## 1. Assessment und Verhalten

**Einstufung: Accept with modification.** Backend unterstützt für Fotoanfragen bereits opt-in NDJSON über dieselbe `POST /api/ai/meal-estimate/preview`-Anfrage. Mobile sendet das Opt-in bislang nicht und verarbeitet weiterhin nur das finale Ergebnis; der sichtbare Ablauf bleibt daher unverändert. Der vorherige FE-Handoff ist wegen fehlender Geräte-Laufzeitumgebung BLOCKED, nicht wegen eines festgestellten Transportdefekts.

Gewünscht ist ein wahrheitsgemäßer Abschluss des Foto-Checks nach erfolgreichem Assessment; das bedeutet „geprüft“, nicht „Foto passt“. Die Schätzanimation beginnt erst, wenn der Backend-Pfad tatsächlich unmittelbar vor `estimateMeal()` steht. Anfragen ohne Foto bleiben unverändert. Prompt, Modell, fachliches Routing, Validierung, Fehlergrenzen und Nutzungszählung ändern sich nicht. Die AI-Vorschau bleibt vor dem Speichern nutzerbestätigungspflichtig.

Zusatzaufwand unter 100 ms ist theoretisch durch dieselbe Anfrage und wenige kleine Phasenmeldungen zu erwarten, nicht gemessen und keine Garantie. Keine zusätzliche KI-Anfrage, Netzwerkanfrage, künstliche Wartezeit, Timer-Abschlüsse oder Polling. FE-Implementierung und automatisierte Verifikation sind ohne Android-Gerät durchzuführen; der Nutzer übernimmt den Live-Smoke nach Abschluss der QA.

## 2. Technische Befundlage und Grenze

- Backend verwendet Azure Functions v4 / Node 24 und `@azure/functions` 4.17.0. WP-BE-01 ist COMPLETE: Fotoanfragen erhalten bei `Accept: application/x-ndjson` dieselbe POST-Antwort mit `photo_check.completed`, `estimate.started`, `result` oder terminalem Fehler. Streaming ist im Functions-Host aktiviert; `withHandler()` blieb unverändert. JSON- und No-photo-Verhalten bleiben erhalten.
- Der [Backend-Handoff](../handoffs/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag/01-backend-progress-contract.md) belegt einen lokalen Host-Check mit Node 24.22.1 und Azure Functions Core Tools 4.16.0. Synthetischer Foto-POST ergab zwei Reads mit Record-Verteilung `[2, 1]`; dies belegt lokales Functions-Host-Framing, nicht Azure/Flex/Alpha- oder RN/Axios-Teilzustellung.
- Mobile verwendet Expo SDK 58 / React Native 0.88.1 und Axios 1.x. `aiApi.estimateMeal()` nutzt den gemeinsamen Axios-Client mit Bearer-, 401-Refresh- und 429-Interceptors; aktuell wird nur das finale Ergebnis verarbeitet. Der [Frontend-Handoff](../handoffs/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag/02-frontend-progress-ui.md) vermerkt die Teilzustellung als **UNVERIFIED**, weil kein Android-Gerät/Emulator verfügbar war. Das ist kein negativer technischer Befund und kein Blocker für FE oder QA.
- Der Vertrag ist NDJSON mit `Accept: application/x-ndjson`, festgelegt und implementiert in WP-BE-01. Die Mobile-Änderung bleibt auf den bestehenden API-Pfad und die bestehende UI begrenzt; globale Interceptor-/Handler-Änderungen sind nicht vorgesehen.
- Zusätzliche Anfrage, weitere AI-Aufrufe, Polling, künstliche Verzögerung, Persistenz/Jobs oder neue Azure-Ressource sind ausgeschlossen. PO-1 greift nur bei technischer Evidenz für erforderliches natives Modul oder unverhältnismäßige Implementierungskomplexität; bloß fehlender Gerätezugang genügt nicht.

## 3. Scope und Nicht-Ziele

**Scope:** bestehende Foto-POST-Route; minimaler typisierter Phasenvertrag; Empfang über den bestehenden Mobile-API-Pfad; Zustand des bestehenden Overlays; fokussierte Backend-/Mobile-Tests und erforderliche API-/UX-Dokumentationsupdates. Ein gemeinsamer Typ wird bei Bedarf innerhalb der Backend-Aufgabe ergänzt, nicht als eigenes Arbeitspaket.

**Nicht-Ziele:** neue Route/Request, Prozentfortschritt, neue AI- oder Promptlogik, Quotaänderung, globale Refactors, neue Abhängigkeit/native Funktion, Persistenz, Bicep/Ressourcen, Mobile-Build, dauerhafte Messdaten, Performance-Benchmark, Flex-Vorab-Verifikation oder Alpha-Deploy vor QA.

## 4. Privacy Impact

Privacy Impact: Policy covered

Data flow: Bereits übertragener Mahlzeitentext und optionales Foto gehen unverändert an Azure OpenAI; Mobile erhält dieselbe Vorschau plus Phasenstatus. Phasenmeldungen enthalten keine Mahlzeitdaten, Fotos, Assessment-Kategorie, Nutzer-ID oder Tokens. Keine neue Speicherung, Aufbewahrung, Empfänger, Berechtigung oder Nutzung.

Policy sections affected: KI-Funktionen; keine inhaltliche Änderung erforderlich.

Proposed text: N/A.

Open questions: Keine, solange Payload, Empfänger und Logs unverändert bleiben.

## 5. Acceptance Criteria

- **AC-1:** Bei Fotoanfragen wird der Foto-Check nur nach erfolgreicher Rückkehr von `assessMealPhoto()` mit unterstütztem Ergebnis als abgeschlossen gezeigt. Das behauptet weder ein positives Match noch, dass das Foto zur Schätzung verwendet wird.
- **AC-2:** Die Schätzanimation beginnt nur nach einer echten Backend-Phasenmeldung unmittelbar vor dem vorhandenen `estimateMeal()`-Aufruf; kein Prozentfortschritt.
- **AC-3:** Es bleibt dieselbe POST-Anfrage mit unverändertem Inhalt, Provideraufrufanzahl/-reihenfolge, Ergebnisvalidierung und Quota. Finale `AiMealEstimatePreview`-Felder, No-photo-Verhalten und JSON-Kompatibilität bestehender Clients bleiben erhalten.
- **AC-4:** Assessment-, Estimate-, Validierungs- oder Transportfehler können weder Abschluss noch Erfolg vortäuschen. Authentifizierung und Quota-Fehler bleiben nutzbar. Abbruch/Unmount erzeugt keine späteren UI-Updates.
- **AC-5:** Der Parser verarbeitet aufgeteilte, zusammengefasste und vollständig gepufferte Antworten (alle Meldungen plus Ergebnis in einem Block). Im Pufferfall zeigt der Wartelayer keine nachgeholten Zwischenzustände und verhält sich wie heute. Fokussierte Tests decken Phasenreihenfolge, Fehler ohne falschen Abschluss, No-photo-/JSON-Kompatibilität, Pufferfall und UI-Zustandswechsel ab.
- **AC-6:** Device-unabhängige automatisierte Prüfung der Frontend-Verarbeitung (fokussierte Tests und Mobile-Typecheck) ist vor QA-Abschluss ausführbar und bestanden; die bereits abgeschlossene lokale Functions-Host-Verifikation aus dem WP-BE-01-Handoff wird als Backend-Evidenz herangezogen. Ein Android-/Expo-Live-Smoke der RN/Axios-Teilzustellung ist `MANUAL VALIDATION REQUIRED` nach QA, aber kein Gate für FE-Implementierung, QA-Start, QA-Verdikt oder Abnahme. Bei fehlendem Gerät wird dies als `UNVERIFIED` dokumentiert, ohne daraus einen negativen Befund abzuleiten. Nur belegte native Modulabhängigkeit oder unverhältnismäßige Komplexität aktiviert PO-1. Verhalten auf Alpha/Flex bleibt Post-Release-Beobachtung, kein Abnahmekriterium. <100 ms bleibt eine ungemessene Schätzung, kein Gate.
- **AC-7:** API- und Mobile-UX-Dokumentation beschreiben nach Umsetzung nur den bestätigten Vertrag und das sichtbare Verhalten. Datenschutzangaben bleiben unverändert, solange der Datenfluss gleich bleibt.

## 6. Backend Work Package

### WP-BE-01: Fortschrittsvertrag auf bestehender Route

Agent: Backend

Status: COMPLETE — bestehende Implementierung und Handoff bleiben gültig; kein Neustart vorgesehen.

Goal: Die bereits abgeschlossene Same-POST-NDJSON-Unterstützung für Fotoanfragen und deren JSON-/No-photo-Kompatibilität als Backend-Baseline bereitstellen. Provider-, Routing-, Plausibilitäts- und Quota-Logik wurden nicht fachlich geändert. Der vorhandene COMPLETE-Handoff einschließlich lokaler Host-Verifikation ist maßgeblich; WP-BE-01 wird nicht erneut ausgeführt, sofern QA keinen konkreten Defekt feststellt.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/07-ai-features.md
- docs/kb/domain/08-quota-system.md

Required Repository Context:
- backend/src/functions/ai.ts
- backend/src/functions/ai.test.ts
- backend/src/lib/http.ts
- shared/types/aiMealEstimate.ts
- docs/kb/tech/09-api-reference.md
- scripts/release-alpha.ps1
- docs/handoffs/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag/01-backend-progress-contract.md

Required Skills:
- azure-openai-feature-integration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6

Dependencies:
- None

Expected Handoff:
- Vorhandener Handoff `docs/handoffs/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag/01-backend-progress-contract.md` bleibt die gültige Evidenz für API-/Phasenvertrag, Implementierung, Tests und lokale Host-Verifikation.
- Keine erneute Backend-Änderung oder Verifikation, sofern QA keinen konkreten Defekt meldet.
- FE und QA berücksichtigen die dokumentierten Grenzen des lokalen Host-Checks: Er beweist weder RN/Axios-Teilzustellung noch Azure/Flex-Verhalten.

## 7. Frontend Work Package

### WP-FE-01: Mobile-Transport und Wartelayer

Agent: Frontend

Status: Nach frischem `APPROVE` ausführbar; fehlendes Android-Gerät/Emulator ist kein Implementierungsblocker.

Goal: Den Vertrag aus WP-BE-01 über den vorhandenen Axios-Client konsumieren und das NDJSON-Opt-in für Fotoanfragen ergänzen. Den Foto-Check nur bei echtem `photo_check.completed`, die Schätzanimation nur bei echtem `estimate.started` anzeigen. Wenn Meldungen erst zusammen mit dem finalen Ergebnis eintreffen, keine nachgeholten Zwischenzustände zeigen; den bisherigen unbestimmten Wartelayer bis zum Ergebnis beibehalten. Auth-/401-/429-Interceptor und finale Vorschauverarbeitung erhalten. Keine globale Clientinstanz, kein natives Modul und kein allgemeiner API-Client-Refactor. Vorhandene Unit-/Komponententests und Typecheck müssen ohne Gerät ausführbar sein. PO-1 greift nur bei belegter nativer Modulabhängigkeit oder unverhältnismäßiger Implementierungskomplexität, nicht wegen fehlender Live-Testmöglichkeit.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/07-ai-features.md
- docs/kb/product/03-design-system.md
- docs/kb/product/04-food-entry-hub.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/shared/api/aiApi.ts
- mobile/src/shared/api/client.ts
- mobile/src/modules/nutrition/hub/AISubFlow.tsx
- mobile/src/modules/nutrition/hub/MealEstimateLoadingOverlay.tsx
- mobile/src/modules/nutrition/hub/MealEstimateLoadingOverlay.test.tsx
- shared/types/aiMealEstimate.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7

Dependencies:
- WP-BE-01 handoff

Expected Handoff:
- API-/UI-Änderung mit fokussierten automatisierten Tests für echte Zustandswechsel, aufgeteilte/zusammengefasste/gepufferte Frames, Fehler, Abbruch und No-photo-Fall; Mobile-Typecheck-Ergebnis.
- Erforderliche Mobile-/UX-KB-Updates; Privacy-Handoff bestätigt keine zusätzliche lokale Speicherung oder Datenweitergabe.
- RN/Axios-Live-Teilzustellung als `UNVERIFIED` mit manueller Prüfanleitung für den Nutzer nach QA dokumentiert, falls vor Handoff kein Gerät verfügbar ist. Kein PO-1-Stopp allein aus fehlender Geräteverfügbarkeit.

## 8. QA Work Package

### WP-QA-01: Fokussierte Vertrags- und lokale Zustellprüfung

Agent: QA

Goal: Alle Acceptance Criteria anhand der Backend-/Frontend-Handoffs prüfen. Relevante Backend- und Frontend-Unit-Tests, den Backend-Build-Verify und den Mobile-Typecheck ausführen. Für AC-6 die bestehende lokale Backend-Host-Evidenz aus dem WP-BE-01-Handoff und die device-unabhängigen Frontendtests prüfen. Kein Android-/Expo-Live-Smoke als QA-Gate; diesen als `MANUAL VALIDATION REQUIRED` für den Nutzer nach QA ausweisen. Kein Flex-Gate, kein Alpha-Deploy, keine Host-/Geräte-Matrix, kein Benchmark.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/07-ai-features.md
- docs/kb/domain/08-quota-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- backend/src/functions/ai.ts
- backend/src/functions/ai.test.ts
- mobile/src/shared/api/aiApi.ts
- mobile/src/modules/nutrition/hub/AISubFlow.tsx
- mobile/src/modules/nutrition/hub/MealEstimateLoadingOverlay.tsx
- mobile/src/modules/nutrition/hub/MealEstimateLoadingOverlay.test.tsx
- shared/types/aiMealEstimate.ts
- docs/kb/tech/09-api-reference.md
- docs/kb/product/05-ux-patterns.md

Required Skills:
- azure-openai-feature-integration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7

Dependencies:
- WP-BE-01 and WP-FE-01 handoffs

Expected Handoff:
- QA-Bericht mit Evidenz je AC sowie Testkommandos und Exit-Codes.
- Prüfung der im WP-BE-01-Handoff belegten lokalen Backend-Host-Verifikation und der Frontendtests ohne Gerät; Testkommandos, Toolchain-Versionen und Exit-Codes im Bericht.
- RN/Axios-Geräte-Smoke mit Voraussetzungen, Schritten, erwarteten Ergebnissen und Ergebnisfeld als `MANUAL VALIDATION REQUIRED` nach QA dokumentiert; fehlende Ausführung ist weder Finding noch Blocker und senkt das QA-Verdikt nicht.
- AI-/Quota-/Privacy-Abgleich; kein Performance-Benchmark.

## 9. Infrastructure, Documentation, Order and Post-Release Observation

`Infrastructure Impact: Alpha`: Der geänderte Backend-Endpunkt wird nach QA-PASS über den bestehenden Releaseprozess nach Alpha ausgeliefert; den Deploy-Befehl gibt der Nutzer separat. Kein Vorab-Validierungsdeploy, keine neue Ressource, keine Bicep-Änderung. `Mobile Build Impact: None`: nur JavaScript/TypeScript, keine nativen Änderungen.

API-/AI-Dokumentation wurde im abgeschlossenen WP-BE-01 aktualisiert; Mobile-UX-Dokumentation wird bei WP-FE-01 aktualisiert, falls sich das sichtbare Verhalten ändert. Keine separaten Doku-Pakete. Prompt-Evals, Cosmos-Contract-Tests und Datenschutzerklärungsänderungen sind nicht erforderlich.

Ausführungsreihenfolge: 1) frisches `APPROVE`; 2) WP-FE-01 unter Verwendung des gültigen WP-BE-01-Handoffs; 3) WP-QA-01; 4) nach Abschluss der QA führt der Nutzer den Android-/Expo-Live-Smoke aus (manuelle Verifikation, kein QA-, Abnahme- oder Freigabegate); 5) normaler Release über den bestehenden Prozess nach QA-PASS (Deploy-Befehl durch den Nutzer); 6) Post-Release-Beobachtung des Azure/Flex-Verhaltens. WP-BE-01 wird nicht wiederholt. Ohne QA-PASS bleibt der heutige Wartelayer.

**Post-QA-Geräteprüfung (`MANUAL VALIDATION REQUIRED`, kein Abnahmekriterium):** Der Nutzer führt nach QA mit einem Expo-Dev-Build auf Android eine Foto-Schätzung gegen den lokalen Functions-Host aus und prüft, ob die bestehende Axios/RN-Antwort Phasen vor dem Endergebnis verfügbar macht. Wenn ja, werden die Phasen entsprechend angezeigt. Wenn alle Frames zusammen eintreffen, bleibt der Layer bis zum Ergebnis unbestimmt; es gibt keine nachgeholten Zwischenzustände. Fehlende Gerätemöglichkeit verzögert weder FE noch QA und wird nicht als negativer Befund gewertet. Eine beobachtete technische Notwendigkeit für ein natives Modul/unverhältnismäßigen Aufwand ist konkret zu dokumentieren und anhand PO-1 zu behandeln.

**Post-Release-Beobachtung (kein Abnahmekriterium):** Auf Alpha wird eine Foto-Schätzung ausgeführt, um Azure/Flex-Pufferung zu beobachten. Vor dem Ergebnis eintreffende Phasen können sichtbar werden; gemeinsam gepufferte Frames führen weiterhin zum bisherigen unbestimmten Layer bis zum Ergebnis. Das lokale Backend-Ergebnis beweist dieses Azure/Flex-Verhalten nicht. Beobachtungen werden dokumentiert; Änderungen oder Folgearbeiten benötigen eine separate Entscheidung.

## 10. Offene technische Frage

**Nicht blockierend und derzeit UNVERIFIED:** Liefert React Native/Axios im Expo-Dev-Build Teilantworten derselben POST rechtzeitig für sichtbare Phasenwechsel? Der vorige Handoff konnte dies mangels Android-Gerät/Emulator nicht prüfen; daraus folgt kein negativer Befund. Der Nutzer führt den Live-Smoke nach QA aus. Die Frontendimplementierung und automatisierte Tests erfolgen vorher ohne Gerät. PO-1 greift nur, falls technische Evidenz dabei oder im späteren Smoke ein natives Modul bzw. unverhältnismäßigen Aufwand belegt. Flex-Pufferung bleibt Gegenstand der Post-Release-Beobachtung und kein Gate.

## Validation Status

Plan-only Revision: bestehender Plan sowie COMPLETE-Handoff WP-BE-01 und environment-limited BLOCKED-Handoff WP-FE-01 geprüft. WP-BE-01 bleibt abgeschlossen; fehlender Android-Gerätezugang wurde als nicht blockierende Verifikationsgrenze eingeordnet. FE-Implementierung und automatisierte QA sind ohne Gerät ausführbar; Live-Smoke ist `MANUAL VALIDATION REQUIRED` nach QA und kein Acceptance Gate. Keine Laufzeittests, Frontend-, QA- oder Codeänderungen ausgeführt. Diese Revision erfordert ein frisches explizites `APPROVE`.
