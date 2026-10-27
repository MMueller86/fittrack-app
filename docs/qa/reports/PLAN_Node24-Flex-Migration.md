# QA Report: Neue Alpha in Subscription `Fittrack` (Node 24, Flex Consumption)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Rev `2026-10-26-NEWSUB-07`)
- Verdict: `PASS WITH ISSUES`

## Scope

Geprüft: Diffs von `backend/` (nur `package.json`, `tsconfig.json`), `infra/`, `scripts/`, `mobile/eas.json`, `docs/kb/`, `.github/instructions/`, READMEs; Azure nur lesend (Subscription `dd7539ab-c638-44f8-9173-8bcd28cdbae3`, `rg-fittrack-alpha`, Dev nur Cosmos-Metriken/Activity-Log); Testläufe. Keine Setting-Werte ausgegeben, kein Zugriff auf PRODYNA/alte Alpha.
Nicht geprüft: Datenschutztext (laut Plan kein QA-Kriterium; `docs/legal/` unverändert), Gerätetests mit Benutzer-Token (siehe Verification Notes).

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Aktive Subscription `Fittrack` (Enabled); `Microsoft.App` = `Registered`. Preflight-Zeitpunkt selbst nur per Orchestrator-Handoff belegt (kein Repo-Artefakt), Endzustand live bestätigt. |
| AC-2 | PASS | `git diff`: `package.json`, `backend/package.json`, `_deploy_staging/package.json` auf `>=24.0.0`, `@types/node ^24.0.0`. Kein Diff in `backend/src/**`, `shared/**`, `mobile/src/**` (weder Working Tree noch HEAD~1) → `queueClient.ts`, Trigger, API, DTOs, Cosmos-Modell unverändert. |
| AC-3 | PASS | Siehe Tests (alle grün, Node v24.15.0). Lockfile-Hash `A80F601A…` und Commit `1fb36a8` stimmen mit Handoff überein. `dist`-Hash nicht neu berechnet (build:verify hat `dist` neu gebaut); Dokumentation nur im Handoff, nicht im Repo (Finding F-2). |
| AC-4 | PASS | ARM GET `func-fittrack-alpha-wcobsd`: Plan `asp-fittrack-alpha` FC1/FlexConsumption/reserved, runtime `node` `24`, `maximumInstanceCount 5`, `alwaysReady null`, `instanceMemoryMB 2048`, Status Running. Deployments `alpha-flex-wp3`, `storage/cosmos/monitoring/functionapp-deploy` Succeeded. `what-if`-Ergebnis nur per Handoff; im Repo nicht belegt, aber Resultat (keine Neuanlage bestehender Ressourcen, nur eine RG) ist konsistent (F-2). |
| AC-5 | PASS | RG enthält genau: Cosmos, Storage, Function-App, Plan, App Insights, Log Analytics; keine DI/OpenAI. Blob-Container: `recipe-images`, `label-scans`, `product-images`, `app-package-func-fittrack-alpha-wcobsd` (alle privat) + Host-Container; 12 Cosmos-Container. Setting-Namen (18) geprüft, keiner enthält `ppf5sc`/`PRODYNA`/`rg-Michael` (Wertprüfung ohne Ausgabe). Hosts: Cosmos `cosmos-fittrack-alpha-wcobsd`, OpenAI `oai-fittrack-dev`, DI `di-fittrack-dev-hlpqe7`, Deployment `gpt-4.1-mini`. `product-images` in `infra/modules/storage.bicep`. |
| AC-6 | UNVERIFIED (Teil PNG) | Function-List: 79 Funktionen inkl. `health`, `recipes-render-instagram`; `GET /api/health` = 200; `GET /api/diary/meals` ohne Token = 401 (selbst geprüft). Authentifizierter Renderer-Aufruf mit PNG-Ergebnis fehlt (braucht Benutzer-Token). |
| AC-7 | PASS | `scripts/migrate-food-products.mjs`: nur Env-Variablen, keine `argv`-Schlüssel, nur `query` auf Quelle und `upsert` auf Ziel (kein Delete), keine hartcodierten Endpoints, `assertSafeTarget` bricht bei Ziel=Quelle, gesperrten PRODYNA-Konten, Nicht-`cosmos-fittrack-alpha-*`-Ziel, falscher Quelle; Log nur Kontonamen/Zählwerte. `scripts/migrate-food-products.test.mjs`: 6/6 grün. |
| AC-8 | PASS | Unabhängig per Cosmos-Metrik `DocumentCount`: `foodProducts` Alpha 209696 = Dev 209696. Alpha-Container mit Daten außer `foodProducts`: keine (alle übrigen 0 bzw. ohne Werte). 20 Stichproben nur per Handoff (Schlüssel für Re-Check bewusst nicht gelesen). Activity-Log (3 Tage): Schreib-Operationen nur in `rg-fittrack-alpha`; kein Zugriff auf die alte Alpha. |
| AC-9 | UNVERIFIED | Handoff: Timer-Smoke zweimal HTTP 202, 0 Items; Queue leer, keine Poison-Queue; 0 Severity>=3. Es wurde kein Reusable-Item verarbeitet, `searchTermsEnriched = true`/Duplikatfreiheit/Idempotenz mit realem Item nicht belegt. Siehe Checkliste. |
| AC-10 | PASS (Build-ID nur per Handoff) | `mobile/eas.json`-Diff: ausschließlich +14 Zeilen, neues Profil `preview-flex` (Kopie von `preview`, `EXPO_PUBLIC_API_URL=https://func-fittrack-alpha-wcobsd.azurewebsites.net/api`, CIAM-Werte identisch); `preview` unverändert. Kein Diff in `mobile/app.config.js`, `mobile/app.json`, `mobile/android/**`. Build-ID 27151b55-… laut Handoff zuletzt `IN_PROGRESS`; Abschluss nicht geprüft (F-3). |
| AC-11 | UNVERIFIED | Login, Katalogsuche, Schreibvorgang, KI-Aufruf, Etikettenscan und Telemetrie dieser Aktionen erfordern Gerät/Benutzer-Token. |
| AC-12 | PASS WITH ISSUES | Grep in den WP-5-Dokumenten: `rg-Michael-Mueller`, `ppf5sc`, `Y1`, `Node\|22`, `alpha.bicepparam` kommen nur noch als ausdrücklich gekennzeichnetes Legacy vor; keine `gpt-4o`-Treffer; `product-images`, Flex, Node 24, `gpt-4.1-mini` dokumentiert. Dev: keine ARM-Schreiboperationen, Dev-Cosmos-Zählwerte plausibel unverändert. Mängel: F-1 (Release-Doku), F-4 (Modul-Defaults). |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run` | 0 | 1944/1944 Tests grün (347 Suites) |
| `cd shared && npx vitest run` | 0 | 466/466 grün (63 Suites) |
| `cd mobile && npx vitest run` | 0 | 993/993 grün (300 Suites) |
| `npx tsc --noEmit` (backend, shared, mobile) | 0 / 0 / 0 | keine Fehler |
| `npm run test:scripts` | 0 | 6/6 grün |
| `npm run check:encoding` | 0 | Encoding check passed |
| `cd backend && npm run build:verify` | 0 | All checks passed |
| `cd backend && npm run test:startup` | 0 | 16 pass, 0 fail |
| Azure lesend (`az resource/functionapp/cosmosdb/monitor`, HTTP GET `health`, `diary/meals`) | 0 | siehe AC-1, 4, 5, 6, 8 |

Nicht ausgeführt: `test:eval` (keine Prompt-/OpenAI-Dateien geändert), Contract-Tests (kein Repository-Code geändert, kein Emulator).

## Verification Notes

- State: `MANUAL VALIDATION REQUIRED` (AC-6 PNG, AC-9 Queue/Reusable-Item, AC-11)
- Reason: Benutzer-Token und Gerät mit `preview-flex` nötig.
- Manual action (Prerequisite: `preview-flex`-APK installiert, CIAM-Testuser):

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 1 | Mit frischem CIAM-Nutzer anmelden (Auth-Relay läuft weiter in PRODYNA) | Login gelingt, Profil wird neu angelegt | |
| 2 | Lebensmittelsuche z. B. „Haferflocken" | Katalogtreffer (209696 Produkte geseedet) | |
| 3 | Gewicht oder Tagebucheintrag anlegen, danach löschen | Schreiben und Löschen gelingt | |
| 4 | KI-Aufruf (z. B. Mahlzeit per Text/Insight) | Ergebnis ohne Fehler (`gpt-4.1-mini` via `oai-fittrack-dev`) | |
| 5 | Etikettenscan | Ergebnis ohne Fehler (geteilte DI F0) | |
| 6 | Eigenes Produkt (Reusable-Item) anlegen | Nach <= 1 Scheduler-/Queue-Zyklus `searchTermsEnriched = true`, keine doppelten Suchbegriffe, Poison-Queue `reusable-items-enrich-poison` leer | |
| 7 | Scheduler `reusable-items-enrich-scheduler` ein zweites Mal manuell auslösen | Keine Änderung am Item (idempotent) | |
| 8 | Rezept-Instagram-Bild erzeugen/teilen | PNG wird geliefert (Renderer, Native-Gate) | |
| 9 | App Insights `appi-fittrack-alpha`: Requests/Traces der Schritte 1–8 | Einträge vorhanden, keine Severity >= 3 | |
| 10 | Testdaten entfernen | Nutzer-/Testdaten gelöscht | |

- State: `UNVERIFIED` — EAS-Build 27151b55-14b4-46bf-94ae-930b8f9c279d: Endstatus `FINISHED` und APK-Artefakt prüfen (`eas build:view`).

## Findings

Finding key: F-1
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Abschnitt 2 „Umstellung", Abschnitt 9)
Acceptance criterion: AC-12
Description: `.github/instructions/infra-release.instructions.md` schreibt für den `New Alpha Build` fest `eas build --profile preview-flex` vor (Z. 164) und nennt `preview-flex` als Standardprofil (Z. 20), ohne zu vermerken, dass `preview-flex` laut Plan bis zur Benutzerentscheidung nur Testbuild ist. Jeder künftige „New Alpha Build" würde damit faktisch auf die neue (leere) Alpha umstellen. Zudem erwähnt keine KB-Datei das Profil `preview-flex`.
Criticality: Non-blocking
Owner: Documentation
Evidence: `.github/instructions/infra-release.instructions.md` Z. 20, 164; `grep preview-flex docs/kb/**` ohne Treffer; Plan Abschnitt 2 und 9.
Recommendation: Hinweis ergänzen („`preview-flex` bis zur Benutzerentscheidung nur Testbuild; `preview` zeigt weiter auf die alte Alpha; Umstellung nur auf Anweisung des Benutzers") und Profil in KB `07-infrastructure.md`/Mobile-Doku nennen.

Finding key: F-2
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md`
Acceptance criterion: AC-1, AC-3, AC-4, AC-8
Description: Preflight, `what-if`-Ergebnis, `dist`-Hash `F3C19CE6…`/`AE0984B8…` und 20-Stichproben-Vergleich sind nicht in einem Repo-Artefakt festgehalten (letzter Eintrag in `infra/release-records/` vom 2026-10-13). Die Belege existieren nur im Orchestrator-Handoff.
Criticality: Non-blocking
Owner: Infrastructure
Evidence: `infra/release-records/` ohne Datensatz zu dieser Migration.
Recommendation: Kurzen Release-Record unter `infra/release-records/` anlegen (Commit, Lockfile-/dist-Hash, what-if, Seed-Zählwerte, Build-ID; keine Secrets).

Finding key: F-3
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md`
Acceptance criterion: AC-10
Description: Der EAS-Build war beim letzten Handoff `IN_PROGRESS`; der Abschluss wurde nicht belegt.
Criticality: Non-blocking
Owner: Infrastructure
Evidence: Handoff WP-4.
Recommendation: Endstatus und Artefakt-URL (ohne Secrets) im Release-Record nachtragen.

Finding key: F-4
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Abschnitt 6 „veraltete Defaults anpassen")
Acceptance criterion: AC-12
Description: `infra/modules/functionapp.bicep` führt weiter die Defaults `azureOpenAiApiVersion = '2024-02-01'` und `azureOpenAiDeploymentName = 'gpt4o-mini'` (Z. 55, 58); `main.bicep` wurde angepasst. Durch die Parameterdatei wirkungslos, aber veraltet.
Criticality: Suggestion
Owner: Infrastructure
Evidence: `infra/modules/functionapp.bicep` Z. 55, 58.
Recommendation: Defaults auf `2024-08-01-preview` / `gpt-4.1-mini` angleichen.

Finding key: F-5
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Abschnitt 2: nur Manifeste/`@types/node`)
Acceptance criterion: AC-2
Description: `backend/tsconfig.json` erhielt zusätzlich `"lib": ["ES2022", "DOM"]`. Das ist im Plan nicht genannt; Build, Typechecks und alle Tests sind grün, es gibt keine Verhaltensänderung zur Laufzeit.
Criticality: Non-blocking
Owner: Planner
Evidence: `git diff HEAD -- backend/tsconfig.json`.
Recommendation: Änderung im Plan/Handoff nachträglich mit Begründung (vermutlich Typen für `fetch` unter `@types/node ^24`) bestätigen.

Finding key: F-6
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Abschnitt 9)
Acceptance criterion: N/A
Description: `.vscode/tasks.json` (Tasks „FitTrack: Alpha Release …") zeigt weiter auf `func-fittrack-alpha-ppf5sc` (PRODYNA, Y1) und `eas build --profile preview`. Bewusst unverändert; ein Start würde die alte Umgebung deployen und den Health-Check gegen deren Host fahren. Es ist eine lokale, nicht versionierte Datei.
Criticality: Suggestion
Owner: Infrastructure
Evidence: `.vscode/tasks.json` enthält `ppf5sc`, kein `wcobsd`; `git status` zeigt keine Änderung.
Recommendation: Bei Umstellungsentscheidung des Benutzers Task anpassen oder mit Hinweis kennzeichnen.

Finding key: F-7
Plan reference: `docs/User Stories/plans/PLAN_Node24-Flex-Migration.md` (Abschnitt 6, Application Insights)
Acceptance criterion: AC-5
Description: Automatisch erzeugtes Deployment `Failure-Anomalies-Alert-Rule-Deployment-59ae363d` in `rg-fittrack-alpha` ist `Failed` (Provider `Microsoft.AlertsManagement` nicht registriert). Es betrifft nur die automatische Smart-Detection-Regel von App Insights, nicht Telemetrie oder Funktionen.
Criticality: Suggestion
Owner: Infrastructure
Evidence: `az deployment group show` (lesend), Zeitstempel 2026-10-26T14:56Z.
Recommendation: Optional `Microsoft.AlertsManagement` registrieren und Regel neu anlegen, oder bewusst ignorieren.
