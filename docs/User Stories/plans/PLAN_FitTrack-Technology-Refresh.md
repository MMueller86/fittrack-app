# Plan: FitTrack-Toolchain und Abhängigkeiten vollständig aktualisieren

- Status: In Umsetzung (Stand 2026-10-30). Phase-0-Gate `PASS` (Bericht `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Phase0.md`). WP-BE-01, -03, -06 laut Product Owner umgesetzt (Handoffs fehlen), WP-BE-02 und WP-BE-05 umgesetzt (Handoffs vorhanden), WP-FE-01 lokal umgesetzt (Handoff fehlt). Neues Ziel des Product Owners: alle Audit-Findings mit den neuesten Versionen beheben (siehe Abschnitt 0). Entscheidungen O-1 (Canvas) und E-3 (`gpt-4.1-mini` bleibt) gelten weiter; O-2 ist durch PO-1 (befristete Ausnahme) ersetzt, PO-1 bis PO-5 sind entschieden (Abschnitt 0)
- Planrevision: `2026-10-30-01` (Ist-Stand eingearbeitet, Ziel "keine Findings", neue Work Packages WP-FE-02, WP-BE-08, WP-FE-03, WP-QA-02; zuvor `2026-10-27-03`: Phase 0 Sicherheitsnetz, Plattform-/Cloud-Lifecycle, Update-Automatisierung, TypeScript-7-Trennung)
- Infrastructure Impact: Alpha
- Mobile Build Impact: Potential Native Impact
- Plan-Typ: Sicherheits-, Toolchain-, Dependency- und Native-Mobile-Migration

## 0. Aktualisierung 2026-10-30: Ist-Stand, Ziel "keine Findings", offene Entscheidungen

**Neues Ziel (Product Owner, 2026-10-30):** Mit den neuesten Versionen sollen alle Findings behoben werden. Vorab akzeptierte Ausnahmen, um einen früheren Plan einzuhalten, entfallen. Ein Finding darf nur dann bestehen bleiben, wenn Upstream nachweislich keine gepatchte Version bietet und der Product Owner das einzeln entscheidet (Advisory-ID, Pfad, Erreichbarkeit, Upstream-Beleg, Prüfdatum). Pauschale Overrides, `--force` und Downgrades (npm schlägt u. a. `expo@51.0.39` und `azurite@2.7.1` vor) sind weiterhin ausgeschlossen. Gezielte Overrides sind nur zulässig, wenn sie nachweislich eine gepatchte, kompatible Version installieren und alle Smokes und Tests grün bleiben.

### Open Product Owner Decisions

| ID | Frage | Optionen | Empfehlung |
|---|---|---|---|
| PO-1 (ersetzt O-2) | Wie werden die verbleibenden Azurite-Findings (`azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid`, jeweils moderate) behoben? Azurite ist nur Dev-Werkzeug. `azurite@3.37.0` ist laut Registry die neueste Version und hält `@azure/ms-rest-js ^2.7.0` und `sequelize ^6.31.0`; ein Fix durch ein Azurite-Update existiert damit nicht. | (A) Gezieltes Override von `uuid` (neueste Linie, Registry `14.0.3`) und Test, ob Azurite damit startet und alle Startup-/Host-Smokes grün sind; (B) Azurite aus dem npm-Graphen entfernen und extern bereitstellen (globale Installation oder Container; lokal laut früherem Plan weder Docker noch WSL, `scripts/storage.mjs`, `npm run dev`, Startup-Tests und Host-Smoke müssten angepasst werden); (C) Entwicklung ohne Storage-Emulator gegen ein vorhandenes Azure-Storage-Konto (berührt Secrets, Kosten und die Regel "keine neuen Azure-Ressourcen", nur nach Prüfung); (D) Finding stehen lassen, einzeln begründet (widerspricht dem neuen Ziel, nur als letzte Option) | A zuerst technisch prüfen (WP-BE-08), bei Fehlschlag B. Nicht C. D nur mit erneuter PO-Entscheidung |
| PO-2 | Wie wird das `zod@3.25.76`-Finding (GHSA-mrhx-c7xc-m3w5, betrifft `<4.6.6`) in `@expo/cli` (neueste Version `58.1.17` verlangt `zod ^3.25.76`) behoben, wenn Expo upstream nicht patcht? | (A) Auf einen Expo-Patch mit zod >= 4.6.6 warten und dann aktualisieren; (B) gezieltes Override von `zod` in `@expo/cli` auf `4.6.7`, nur wenn `smoke:bundle`, `smoke:manifest`, `smoke:doctor`, `expo-doctor` und Tests grün sind (Risiko: zod-3-zu-4-API-Unterschiede im CLI); (C) Finding als dokumentierte Ausnahme (Build-Tooling, nicht im App-Bundle) | A prüfen (WP-FE-03), B nur bei grünen Smokes, C nur als letzte Option |
| PO-3 | Die Pakete `react-native-vision-camera` und `react-native-image-crop-picker` sind nicht mehr in `mobile/package.json`; `mobile/src` nutzt jetzt `expo-camera` (`CameraView` in `AndroidBarcodeScanner.tsx`, `FramedCameraCapture.tsx`) und `expo-image-manipulator` (`cropImageToFrame.ts`). Der Plan sah keinen Ersatz vor. Ist das gewollt? | (A) Bestätigen: Ersatz bleibt; Geräte-Checkliste für Barcode-Scan, Etikettenscan und Foto-Zuschnitt neu fahren, KB und Design-Doku nachziehen; (B) Rückbau auf die alten Pakete, falls UX/Funktion nicht gleichwertig | A bestätigen, wenn die Geräteprüfung besteht. Die Änderung gehört in den WP-FE-01-Handoff |
| PO-4 | AC-5 verlangt SDK-Stufen 55, 56, 57, 58 einzeln. Geprüft wurde direkt SDK 58. | (A) AC-5 auf "Zielstand SDK 58 geprüft" ändern; (B) Zwischenstufen nachholen | A, weil die Zwischenstände keinen Nutzen haben und das Ergebnis (SDK 58 grün) zählt |
| PO-5 | Linux-Node-24-Smoke für `@napi-rs/canvas` (WP-BE-02) fehlt lokal. | (A) Nachweis aus dem CI-Lauf (`ubuntu-latest`) als QA-Evidence; (B) ausdrückliche Freigabe als `UNVERIFIED` | A, sobald ein CI-Lauf auf dem aktuellen Stand grün vorliegt |

**Entschieden am 2026-10-30:**

- **PO-1 = D (befristet):** Der Product Owner akzeptiert die Azurite-Moderates (`azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid`; nur Dev-Werkzeug, nicht im `_deploy_staging`-Graphen) als dokumentierte Ausnahme, bis Azurite eine Version mit gepatchter Kette veröffentlicht. WP-BE-08 Teil 2 entfällt bis dahin; bei jedem Azurite-Release wird neu geprüft (Dependabot/CI-Audit, WP-BE-07). Die High-Findings `@azure/identity`/`@azure/msal-node` bleiben in WP-BE-08 Teil 1 zu beheben (laut npm ohne Override möglich) und sind von dieser Ausnahme nicht erfasst. Die Ausnahme braucht im QA-Bericht Advisory-ID (GHSA-w5hq-g745-h8pq), Pfad, Erreichbarkeit (nur lokal) und Prüfdatum.
- **PO-2 = C (befristet):** Der Product Owner akzeptiert das `zod@3.25.76`-Finding (GHSA-mrhx-c7xc-m3w5) in `@expo/cli` sowie die Expo-Low-Findings (`deepmerge`-Kette, GHSA-gcqx-w48m-w2h4) als dokumentierte Ausnahme, solange Expo keine gepatchte Version liefert (`@expo/cli@58.1.17` und `expo@58.0.21` sind am 2026-10-30 die neuesten). Begründung: Build-Tooling, nicht im App-Bundle; breit eingesetztes Werkzeug, ein Upstream-Fix wird erwartet. Kein Override und kein Downgrade. WP-FE-03 reduziert sich auf Beleg und Pflege der Ausnahme; bei jedem Expo-Release (Dependabot/CI-Audit, WP-BE-07) wird neu geprüft. Die Ausnahme braucht im QA-Bericht Advisory-ID, Pfad, Erreichbarkeit (nur Build), Upstream-Beleg und Prüfdatum.
- **PO-3 = außerhalb dieses Plans:** Der Ersatz von `react-native-vision-camera` und `react-native-image-crop-picker` durch `expo-camera` und `expo-image-manipulator` stammt aus einer parallelen Entwicklung und wird in diesem Plan weder bewertet noch geändert. Der Plan setzt ihn als gegeben voraus; Prüfung und Dokumentation liegen bei der parallelen Entwicklung.
- **PO-4 = A:** AC-5 wird auf "Zielstand SDK 58 geprüft" geändert; die Zwischenstufen 55 bis 57 entfallen.
- **PO-5 = A:** Der Linux-Node-24-Nachweis für `@napi-rs/canvas` kommt aus einem grünen CI-Lauf auf `ubuntu-latest`. Der Lauf erfolgt einmal auf dem Stand nach WP-FE-02, WP-BE-08 Teil 1 und der angehobenen Test-Baseline (Abschnitt 20, Schritt 7b); Lauf-Link und Ergebnis kommen in den QA-Bericht. Bis dahin bleibt der Punkt `UNVERIFIED`.

### Ist-Stand (Quelle: Arbeitsbaum und Messung vom 2026-10-30; Annahmen sind markiert)

| Bereich | Stand | Quelle |
|---|---|---|
| Phase 0 | `PASS`; CI-Lauf, Cosmos-Contract-Job und Android-Assemble sind vom Product Owner ausdrücklich freigegeben (nicht unabhängig verifiziert) | QA-Bericht Phase 0 |
| Backend | Node-Pins, `openai 7.45.1`, `zod 4.6.7`, Azure-SDKs, Vitest 5, Azurite 3.37.0, `@napi-rs/canvas 1.0.13`, TypeScript 7.0.2; Staging `npm audit --omit=dev` = 0 | Manifeste gelesen; Zählungen aus Handoffs (Agentenangabe, backend 84/2.709, shared 10/466, mobile 108/1.002) |
| Mobile | `expo ~58.0.21`, React Native 0.88.1, React 19.3.0, TypeScript 7.0.2; Bundle-Smoke grün (Agentenangabe) | `mobile/package.json` gelesen |
| Root-Audit | 18 Findings (6 low, 4 moderate, 8 high), vorher 27 (11/12/4); Ursachen siehe unten | `npm audit --json`, lokal gemessen |
| Handoffs | vorhanden: WP-BE-02, WP-BE-05; **fehlen:** WP-BE-01, -03, -06, WP-FE-01 (vom Product Owner gelöscht, Plan verlinkte ihn noch) | Dateisuche |
| `mobile/android/` | In `.gitignore`, nicht versioniert, stammt noch aus SDK 54. Die Annahme "eingechecktes Android-Projekt" in Abschnitt 7 und 19 ist falsch; EAS/Prebuild erzeugt es neu | `.gitignore` Zeile 18, `git ls-files` leer |
| Android-Debug-Assemble | lokal nicht lauffähig (Windows-Pfadlänge im OneDrive-Pfad), CI-only | Agentenangabe, QA-Bericht |
| Test-Baseline | `scripts/test-baseline.json` steht auf den Minima 10/466, 77/1.944, 106/993 und ist unter dem aktuellen Stand | Agentenangabe |

### Gemessene Findings und Behebungspfad (Root `npm audit`, 2026-10-30)

Die 8 High-Findings gehen auf 3 Ursachen zurück, npm propagiert ein Advisory auf alle abhängigen Pakete. Die Registry-Angaben wurden mit `npm view` geprüft.

| Ursache | Advisory | Pfad | Behebung mit neuesten Versionen | Work Package |
|---|---|---|---|---|
| `decode-uri-component@0.2.2` (high, dazu `query-string`, `@react-navigation/core`) | GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f | `mobile` → `@react-navigation/native@7.2.2` → `core@7.17.2` → `query-string@7.1.3` → `decode-uri-component@0.2.2` | `@react-navigation/native@7.5.1` verlangt `@react-navigation/core ^7.24.0`; `core@7.24.0` hat laut Registry keine `query-string`-Abhängigkeit mehr. Update des direkten Pakets entfernt die Kette (zu bestätigen mit `npm ls`) | WP-FE-02 |
| `@azure/msal-node@6.0.1` (high, dazu `@azure/identity`) | GHSA-xcx6-jx8p-x3h5 (betrifft `<7.1.0`) | `backend` → `azurite@3.37.0` → `applicationinsights@3.17.0` → `@azure/identity@4.14.0` → `@azure/msal-node@6.0.1` | npm meldet `fixAvailable: true`; `@azure/identity@4.14.1` ist die neueste Version. Zu prüfen, ob sie `msal-node >= 7.1.0` zieht. Falls ja, reicht ein Lockfile-Update ohne Override | WP-BE-08 |
| `zod@3.25.76` unter `expo/node_modules` (high, dazu `@expo/cli`, `expo`) | GHSA-mrhx-c7xc-m3w5 (betrifft `<4.6.6`) | `mobile` → `expo@58.0.21` → `@expo/cli@58.1.17` → `zod ^3.25.76` | Upstream-Fix fehlt: `@expo/cli@58.1.17` und `expo@58.0.21` sind die neuesten Versionen. npm schlägt nur das Downgrade `expo@51.0.39` vor (nicht zulässig). Entscheidung PO-2 | WP-FE-03 |
| Expo-Low-Findings: `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `deepmerge` | GHSA-gcqx-w48m-w2h4 (deepmerge `<=4.3.1`) | über `@expo/config` | `deepmerge@4.3.1` ist die neueste Version, ein Upstream-Patch ist nach Registry nicht erkennbar. Zu belegen (Advisory-Text, Expo-Issue). Entscheidung PO-2, gleiche Logik | WP-FE-03 |
| `@babel/core` (low, `<=7.29.0`) | GHSA-4x5r-pxfx-6jf8 | Mobile-Build | npm meldet `fixAvailable: true`; die Registry-Linie ist `8.0.10`. Zielversion innerhalb der von Expo/Babel unterstützten Linie prüfen (Babel 8 nur, wenn `babel-preset-expo` es trägt) | WP-FE-02 |
| `azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid` (moderate) | GHSA-w5hq-g745-h8pq (uuid `<11.1.1`) | `backend` (devDependency) → `azurite@3.37.0` | `azurite@3.37.0` ist die neueste Version; npm bietet nur das Downgrade `azurite@2.7.1`. Entscheidung PO-1 | WP-BE-08 |

Warum High von 4 auf 8 stieg, ist nicht belegt (der alte Messstand ist nicht rekonstruierbar). Gesichert ist nur, dass die 8 Pakete auf die 3 Ursachen oben zurückgehen.

### Risiken aus dem neuen Ziel

- Ein Override von `uuid` oder `zod` kann Laufzeitverhalten ändern (Azurite-Datenbankschicht, Expo-CLI-Konfigurationsprüfung). Er zählt nur dann als Behebung, wenn die Smokes und Tests grün sind und der Nachweis im Handoff steht.
- Expo-bezogene Findings liegen im Build-Tooling, nicht im App-Bundle. Sie sind trotzdem Findings und werden nur per Beleg und PO-Entscheidung stehen gelassen.
- Das Ziel "Audit ohne Findings" ist zeitabhängig: neue Advisories können nach der Behebung auftreten. Das CI-Gate (WP-BE-07) meldet das, die Behebung ist dann ein neues Paket.

## 1. Requirement Assessment

**Einstufung: Accept with modifications.** FitTrack soll nicht ohne Grund auf älteren oder verwundbaren Technologien verbleiben. Das Ziel ist daher nicht, jeden Paket-Major mechanisch auf die höchste Nummer zu setzen, sondern alle produktiven, CI-, Entwicklungs- und nativen Abhängigkeiten auf die jeweils neueste stabile und zueinander unterstützte Version zu bringen. Nicht unterstützte Azure-Runtimes und inkompatible Einzel-Upgrades werden nicht erzwungen.

**Product-Owner-Entscheidung O-1 — Renderer (entschieden am 2026-10-27: Option B, `@napi-rs/canvas`):** Soll FitTrack Satori durch `@napi-rs/canvas` ersetzen oder einen eigenen, dauerhaft gepflegten Satori-Fork verantworten? Empfehlung: unabhängigen Renderer (`@napi-rs/canvas@1.0.13`) wählen, um die ungültige `fflate`-Kante ohne Fork-Pflege zu entfernen. Das ist eine sichtbare Neuimplementierung; bestehende Rezeptgrafiken müssen visuell geprüft werden. Alternative: Fork von Satori mit gepatchter Dependency, explizitem Maintainer, Upstream-Synchronisierung und gemeinsam nutzbarem Root-/Staging-Paketpfad. WP-BE-02 ist nach der Planfreigabe ausführbar.

## 2. Feature Summary

- **Phase 0 (zwingend zuerst):** Sicherheitsnetz schaffen. Fehlende Tests an den Bibliotheksgrenzen (OpenAI/Document-Intelligence-SDK, Zod-Schemas, Renderer, Functions-Host, Expo/React-Native-Konfiguration, native Wrapper) werden **vor** jedem Versionsupgrade ergänzt, und die CI führt alle Test-Suiten aus. Alle Tests müssen auf dem unveränderten Dependency-Stand grün sein, bevor ein Upgrade beginnt.
- Node lokal und in CI auf `24.22.1` vereinheitlichen; Azure Functions bleibt bei unterstütztem Node 24.
- Direkte Backend-Produktionsadvisories in OpenAI/Zod beheben und Azure-SDKs aktualisieren.
- Expo SDK 54 schrittweise bis zum aktuell stabilen SDK 58 aktualisieren, einschließlich passender React-/React-Native- und nativer Module.
- Kritische CI-/Test-Tooling-Advisories beseitigen; TypeScript, Vitest, Vite, Azurite und Import-Tooling aktualisieren.
- Satori/fflate-Abhängigkeitskonflikt beseitigen und Root- sowie Alpha-Staging-Graph gültig machen.
- GitHub Actions, npm, EAS CLI und Azure Functions Core Tools auf aktuelle, Node-24-kompatible Releases bringen.
- Azure-Plattformschicht bereinigen: Azure-OpenAI-API-Version und Konfiguration (Modell `gpt-4.1-mini` bleibt), Document-Intelligence-SDK, Bicep-API-Versionen, Cosmos-Emulator-Image in CI.
- Veraltete Altlasten entfernen (`@types/sharp`-Stub, versionierte temporäre Bicep-Datei, `gpt4o-mini`-Fallbacks).
- Update-Automatisierung (Dependabot/Renovate) und einen Audit-Schritt in CI einführen, damit der Stack nicht erneut veraltet.
- Nach erfolgreicher Bereinigung sollen Root- und Alpha-Produktionsaudits keine bekannten Advisories melden; verbleibende Dev-only-Findings werden einzeln begründet (siehe O-2).

## 3. Current Behaviour and Audit Baseline

Audit- und Versionssnapshot vom 2026-10-27; Registry-Stände sind vor Implementierung erneut zu verifizieren.

| Bereich | Aktueller Befund | Ziel/Risiko |
|---|---|---|
| Node | lokal `24.15.0`; Manifeste nur `>=24`; CI nur Major 24 | Patch `24.22.1` festlegen; Azure bleibt Major 24 |
| npm | lokal `11.12.1`; Registry `12.2.1` unterstützt Node 24.15+ | auf npm 12 vereinheitlichen |
| Alpha-Staging-Produktion | 2 High: `openai@4.104.0` und `zod@3.25.76` | OpenAI 7 / Zod 4 Major-Migration |
| Root npm Audit | 50 Findings: 4 critical, 16 high, 29 moderate, 1 low | jede Advisory beheben; nicht behebbare Findings einzeln belegen und neu entscheiden lassen |
| Mobile | Expo `54.0.36`; `expo install --check` erwartet `~54.0.37`; letzter SDK-54-Patch `54.0.38`; React Native `0.81.5` | SDK 55, 56, 57, dann 58 einzeln migrieren; nativer Build nötig |
| Expo Advisories | Expo 54 liegt im aktuellen Advisory-Bereich; npm schlägt Expo `58.0.19` als Major-Fix vor | SDK-Upgrade einschließlich Expo-Modulen und nativer Konfiguration |
| Vitest | `2.1.9`; Audit meldet Critical in Vitest/Tinypool | Vitest `5.0.5` mit kompatiblem Vite aktualisieren |
| TypeScript | `5.9.3`; Registry `7.0.2` | Major-Migration aller Workspaces und TS-Konfigurationen |
| Renderer | `satori@0.33.5`, latest `0.63.2` hält weiterhin exaktes `fflate@0.7.3`; FitTrack erzwingt `0.7.5`; `npm ls` ist ungültig | Fork mit echtem patched Manifest oder Rendererwechsel; kein ungültiger Override |
| Azure SDKs | Cosmos `4.9.3`, Functions `4.14.0`, Blob `12.31.0`, Queue `12.30.0` | Registry-Stände `4.10.1`, `4.17.0`, `12.34.0`, `12.32.0` prüfen und übernehmen |
| Weitere direkte Updates | u.a. `jose 6.2.3`, `axios 1.20.0`, `zustand 5.0.12`, Azurite `3.35.0`, MongoDB `6.21.0` | aktuelle kompatible Stände; Major-Wechsel explizit testen |
| Operator-Toolchain | Functions Core Tools `4.9.0`, EAS CLI `21.6.0`; Registry `4.16.0` / `26.0.0` | aktualisieren und gegen Node 24 prüfen |
| GitHub Actions | `checkout@v5`, `setup-node@v5` | aktuelle Releases `checkout@v7`, `setup-node@v7` prüfen und übernehmen |
| Azure OpenAI | Code-Fallbacks: Deployment `gpt4o-mini`, API-Version `2024-07-01` (`openai.ts`, `labelParser.ts`); Bicep nutzt `2024-08-01-preview`, KB nennt `gpt-4.1-mini`. Frühere Planung nannte Abkündigung von `gpt-4.1-mini` zum 2027-04-14 (nicht erneut verifiziert) | `gpt-4.1-mini` bleibt (Entscheidung E-3, 2026-10-27); Abkündigungstermin belegen und als Folgeaufgabe festhalten, API-Version und Defaults vereinheitlichen, Prompt-Evals erneut ausführen |
| Document Intelligence SDK | `@azure/ai-form-recognizer` (`DocumentAnalysisClient`); npm markiert es nicht als deprecated, Nachfolger `@azure-rest/ai-document-intelligence@1.1.0` existiert | Support-Status bei Microsoft prüfen; Migrationsentscheidung dokumentieren |
| Bicep API-Versionen | Cosmos `2024-05-15`, Storage `2023-05-01`, Web `2023-12-01`, Log Analytics `2023-09-01`, Cognitive Services `2024-10-01` | aktuelle stabile Versionen per `az bicep`/`what-if` prüfen; Apply separat |
| CI Cosmos-Emulator | Image `azure-cosmos-emulator:vnext-preview` | aktuellen stabilen Tag prüfen |
| Typpakete | `@types/sharp` ist laut npm ein Stub (sharp liefert eigene Typen) | entfernen |
| Repo-Altlasten | versionierte Datei `infra/modules/.cosmos-community-dev-deployment.tmp.bicep` und `infra/parameters/.cosmos-dev-deployment.tmp.json` | klären und entfernen, falls obsolet |
| Update-Prozess | keine `dependabot.yml`/`renovate.json`, kein Audit-Schritt in CI | automatisierte Update-PRs und CI-Audit einführen |
| Test-Baseline (2026-10-27, lokal, alles grün) | shared 10 Dateien / 466 Tests; backend 77 / 1.944 (ca. 164 s); mobile 106 / 993; Typecheck aller Workspaces grün. Zusätzlich 11 Cosmos-Contract-Tests (Emulator, nur in CI) und 9 Prompt-Evals (Zugangsdaten) | als Paritäts-Baseline festschreiben; nach jedem Upgrade-Schritt dürfen Datei- und Testzahl nicht sinken |
| CI-Abdeckung | `ci.yml` führt nur Typechecks, Encoding, Daily-Insight-Guard und Backend-Unit-Tests aus; **nicht** shared-Tests (466), mobile-Tests (993), `test:scripts`, `test:startup` und `build:verify`; kein Host-Start | Phase 0 nimmt alle Suiten in CI auf |
| Blinde Flecken an Bibliotheksgrenzen | OpenAI-/Document-Intelligence-Tests nutzen Fake-Clients (`as never`) oder mocken `openai`; Zod-Schemas inline in Handlern ohne Characterization; Renderer nur 1 Golden-PNG, Layout-Tests an Satori gekoppelt; Mobile-Tests laufen in Node mit gemockten nativen Modulen; native Wrapper (`HealthConnectService`, Vision Camera, Crop Picker) nutzen `require(...)` mit Cast bzw. untypisiert; Off-Import ohne Tests | Phase 0 ergänzt gezielte Tests je Grenze (siehe Abschnitt 9a) |

Der Root-Audit ist ein Graph aus Produktions-, Mobile-Build-, Test- und Dev-Abhängigkeiten; die Gesamtzahl bedeutet nicht, dass alle Findings im ausgelieferten App- oder Backend-Binary liegen. Der separate `_deploy_staging`-Audit ist die maßgebliche Backend-Produktionssicht. `npm audit fix --force` ist keine akzeptierte Migrationsstrategie.

## 4. Desired Behaviour

- Root-, Backend-, Mobile-, Shared-, Off-Import- und Staging-Manifeste sowie Lockfiles beschreiben gültige, reproduzierbar installierbare Abhängigkeitsgraphen.
- `npm ci --omit=dev`, `npm ls --all` und `npm audit --omit=dev` sind im `_deploy_staging` sauber. Im Root sind `npm ci` und `npm ls --all` sauber; `npm audit` meldet keine Critical/High in produktiven oder CI-erreichbaren Pfaden. Verbleibende Findings in reinen Dev-Werkzeugen (siehe O-2) sind einzeln mit Advisory-ID, Pfad, Erreichbarkeit und Upstream-Status begründet.
- Alle direkten Dependencies sind auf dem neuesten stabilen Stand, der mit der gewählten Node-/Expo-/Azure-Matrix kompatibel ist. Bewusste Abweichungen benötigen eine konkrete technische Begründung und ein Prüfdatum.
- Backend API-Verträge, AI Structured Outputs, Promptsemantik, Quoten und Renderer-Ausgaben bleiben unverändert, sofern O-1 für den Rendererwechsel keine visuelle Änderung explizit akzeptiert.
- Mobile bleibt auf einer offiziellen Expo-/React-Native-Kombination. Sämtliche nativen Plugins und Android-Projekte bauen mit dem SDK-Ziel.
- Kein Security-Finding wird durch Audit-Overrides, `npm audit`-Ausnahmen oder unvollständige Workspace-Prüfung verschleiert.
- Kein Versions-, Lockfile-, Toolchain- oder Native-Upgrade beginnt, bevor Phase 0 abgeschlossen ist und **alle** Tests (shared, backend, mobile, scripts, startup, Typecheck, `build:verify`, Contract-Tests in CI, neue Phase-0-Tests und -Smokes) auf dem unveränderten Dependency-Stand grün sind. Rote oder instabile Tests werden in Phase 0 repariert, nicht ausgeschaltet oder abgeschwächt.

## 5. Scope

- Alle Workspaces, Root-/Staging-Manifeste, npm-Lockfiles, direkte und transitive Runtime-, Test-, Build- und Native-Pakete.
- Azure Functions Node-/SDK-Toolchain, GitHub Actions sowie dokumentierte lokale Operator-CLIs.
- Expo SDK-/React-Native-/Android-Native-Migration.
- Satori/fflate-Korrektur oder Rendererwechsel gemäß O-1.
- Knowledge Base und operative Dokumentation aktualisieren, damit Versionsstände und Release-Schritte der finalen Implementierung entsprechen.
- Azure-Plattform-Lebenszyklus: OpenAI-API-Version und -Konfiguration (Modell `gpt-4.1-mini` bleibt), Document-Intelligence-SDK, Bicep-API-Versionen (nur Repo-Änderung und lesende `what-if`), Cosmos-Emulator-Image in CI.
- Update-Automatisierung und CI-Audit-Gate.
- Phase 0: Tests, Test-Infrastruktur, CI-Verdrahtung und rein typbezogene Anpassungen (typisierte Imports) ohne Änderung des Laufzeitverhaltens; keine Dependency-Versionenänderung.

## 6. Out of Scope

- Azure-Deployment, Bicep-Apply, Functions-Publish, Function-App-Neustart, EAS Build oder EAS Submit. Dies sind separate operative Aufträge mit eigener ausdrücklicher Freigabe.
- Node 26 auf Azure Functions, solange Microsoft es nicht als GA-Functions-Runtime unterstützt.
- API-, Produkt-, Prompt-, Datenmodell- oder UI-Verhaltensänderungen außer unvermeidbaren Anpassungen durch SDK-Kompatibilität; solche Abweichungen erfordern Planrevision.
- Wechsel des Azure-OpenAI-Modells: `gpt-4.1-mini` bleibt vorerst (E-3). Ein späterer Modellwechsel ist ein eigener Plan mit Prompt-Evals und Privacy-Review.
- Neue Azure-Ressourcen, Cosmos-Migrationen, Datenmigration und Änderung von Secrets.
- Paketupdates ohne Nutzen, die lediglich eine höhere Versionsnummer liefern, aber Kompatibilität, Support oder Sicherheit verschlechtern.

## 7. Confirmed Facts and External References

- Node `24.22.1` ist das Node-24-Sicherheitsrelease vom 21. Oktober 2026: [Node.js Security Releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
- Azure Functions listet Node 24 als GA; Node 26 ist derzeit nicht als unterstützte Functions-Runtime gelistet: [Azure Functions language support](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages).
- Expo dokumentiert SDK-Upgrades mit versionspezifischer Dependency-Ausrichtung und anschließender Native-Projektvalidierung: [Expo SDK upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
- Registry-Snapshot: Expo `58.0.19`, React Native `0.88.0`, OpenAI `7.45.0`, Zod `4.6.7`, Vitest `5.0.5`, TypeScript `7.0.2`, Satori `0.63.2`, `@napi-rs/canvas` `1.0.13`.
- OpenAI `7.45.0` unterstützt Node >=22 sowie Zod 3.25 oder Zod 4; Umstellung kann trotzdem SDK-Typen und Azure-API-Aufrufe berühren.
- `@napi-rs/canvas@1.0.13` ist MIT-lizenziert und liefert optionale Linux-x64-native Pakete; es ist keine Satori-kompatible API.
- Backend Structured Outputs verwenden von Hand deklarierte `json_schema`-Schemas an zahlreichen AI-Aufrufstellen. Der SDK-Wechsel darf deren Schema und Verhalten nicht still verändern.
- Android-Projekt ist vorhanden, verwendet Expo New Architecture und Gradle Wrapper `8.14.3`; `mobile/gradle.properties` enthält die für Expo SDK 55 angekündigte Deprecation `expo.edgeToEdgeEnabled=true`.

## 8. Product-Owner-Entscheidungen

### O-1: Satori-Fork oder unabhängiger Renderer

**Option A — gepflegter Satori-Fork:** kleinste Layout-Änderung, aber FitTrack muss Source, Lizenz-/Provenienznotizen, Upstream-Synchronisierung, Maintainer und einen Paketpfad pflegen, der Root und standalone `_deploy_staging` gleichermaßen versorgt. Forks ohne benannten Maintainer und Distributionstest sind nicht zulässig.

**Option B — `@napi-rs/canvas`: empfohlen.** Entfernt Satori/fflate, vermeidet einen dauerhaften Fork und besitzt optionale Linux-x64-Binaries. Erfordert die Neuimplementierung der Komposition, Typografie, Messung, Fonts, SVG/Icon-Behandlung und PNG-Ausgabe. Vorhandene Renderings und Golden-Tests sind zwingend visuell zu vergleichen.

**Entscheidung (2026-10-27): Option B, `@napi-rs/canvas`.** Voraussetzung bleibt der visuelle Vorher-/Nachher-Vergleich der Rezeptgrafiken; ist das Ergebnis nicht akzeptabel, wird der Plan revidiert und Option A nur zusammen mit Maintainer, Quellpfad, Lizenzprüfung und Upstream-Pflegeverantwortung freigegeben.

### O-2: Umgang mit Azurite und `@azure/ms-rest-js`

Der Audit meldet für `@azure/ms-rest-js` (Bereich `*`) und `azurite` High-Findings, für die npm keinen Fix anbietet; sie hängen an alten Express-/ms-rest-js-Ketten und liegen nur in der lokalen Entwicklungsumgebung, nicht im `_deploy_staging`-Graphen. Ein Audit mit Exit 0 ist daher möglicherweise nicht erreichbar.

**Option A (empfohlen):** Azurite auf die aktuelle Version heben (`3.37.0`, Stand 2026-10-27 prüfen). Verbleiben Findings, bleibt Azurite als Dev-only-Werkzeug mit dokumentierter, einzeln begründeter Ausnahme (nur lokal, nur `127.0.0.1`, nicht im Deploy-Graphen); die Entscheidung wird bei jedem Update erneut geprüft.

**Option B:** Azurite aus dem npm-Graphen entfernen und außerhalb des Repositories bereitstellen (z. B. globale Installation oder Container). Beachten: lokale Windows-Umgebung hat laut früherem Plan weder Docker noch WSL; `scripts/storage.mjs`, `npm run dev` und die Startup-Tests müssten angepasst werden.

**Entscheidung (2026-10-27): Option A.** AC-8 wurde nach der Ausnahmeregel bewertet.

**Ersetzt am 2026-10-30:** Option A (Ausnahme für Azurite) gilt nicht mehr. Das Ziel ist ein Audit ohne Findings. Die Behebung der Azurite-Kette wird als Entscheidung PO-1 (Abschnitt 0) mit den Optionen A bis D neu vorgelegt; die Ausnahme darf nur als letzte Option und mit erneuter PO-Entscheidung bleiben. Die Findings `@azure/identity` und `@azure/msal-node` sind laut npm ohne Ausnahme behebbar (WP-BE-08).

### E-3: Azure-OpenAI-Modell

**Entscheidung (2026-10-27): `gpt-4.1-mini` bleibt vorerst.** Kein Modellwechsel in diesem Plan. WP-BE-06 belegt lediglich den Abkündigungstermin (die frühere Planung nannte 2027-04-14, nicht erneut verifiziert) und hält einen Folgeplan mit Frist fest; API-Version und Konfigurationsquelle werden vereinheitlicht.

## 9. Proposed Technical Solution

**Phase 0 — Sicherheitsnetz (zwingend vor Schritt 1; siehe Abschnitt 9a).** Auf dem unveränderten Dependency-Stand werden Baseline, Paritäts-Gate, vollständige CI-Abdeckung und gezielte Tests an allen Bibliotheksgrenzen geschaffen. Erst wenn alle Suiten grün sind und QA das Gate (WP-QA-00) bestätigt hat, startet Schritt 1. Während der Upgrades beendet jede Stufe mit denselben grünen Suiten und unveränderter Test-Parität.

1. Node in `.nvmrc` auf `24.22.1` pinnen; CI liest denselben Wert. Root-/Backend-/Staging-Engines und Node-Typdefinitionen werden vereinheitlicht. Azure Bicep bleibt bei Node Major 24.
2. Node `24.22.1` und npm `12.2.1` als lokale/CI-Versionen fixieren. `setup-node` aktiviert npm-Version deterministisch; Lockfiles werden mit der festgelegten npm-Version neu erzeugt.
3. Backend-Produktionsabhängigkeiten schrittweise aktualisieren: OpenAI `7.45.0`, Zod `4.6.7`, Azure Functions/Cosmos/Storage SDKs und `jose` auf aktuelle kompatible stabile Releases. Änderungen an AI Request-/Response-Typen werden mit bestehenden Contracts, Strict JSON Schemas und Offline-Tests abgesichert.
4. Renderer gemäß O-1 korrigieren. Entfernen von `fflate`-Overrides ist erst zulässig, wenn Root und `_deploy_staging` jeweils einen gültigen Baum besitzen und der Linux-Node-24-Render-Smoke nachweislich funktioniert.
5. Backend-Test-/Build-Kette aktualisieren: Vitest 5 samt erforderlichem Vite, Azurite gemäß O-2, MongoDB 7.7 und TSX 4.23.15; `@types/sharp` entfernen; weitere direkte Updates aus `npm outdated` einbeziehen. Je Major Änderungen und Tests separat sichtbar machen. TypeScript 7 wird bewusst als eigener, späterer Schritt (WP-BE-05) migriert, damit Compiler- und Testrunner-Wechsel nicht gleichzeitig Fehler verursachen; mit dokumentierter Rückfallregel auf die letzte funktionierende TS-5-Linie nur bei nachgewiesenem Blocker und Planrevision.
6. Mobile strikt SDK-weise aktualisieren: Expo 54 → 55 → 56 → 57 → 58. Für jede SDK-Stufe `npx expo install --fix`, `npx expo-doctor`, Typecheck, Tests und native Android-Konfiguration prüfen. Zu jeder Stufe passende React-/React-Native-/Expo-Modulversionen benutzen; keine losgelösten Expo-Modul-Upgrades.
7. Native Konfiguration und eingechecktes Android-Projekt mit den jeweiligen Expo-Upgradehinweisen abgleichen. Deprecations wie `expo.edgeToEdgeEnabled` vor SDK 55 migrieren. Nativen SDK-/Gradle-Stand nicht blind auf neueste Gradle-Major heben; die von Expo/RN unterstützte Version verwenden.
8. Globale Tools und CI aktualisieren: Functions Core Tools 4.16, EAS CLI 26, GitHub Actions checkout v7/setup-node v7. Versionsnachweis und Installationsweg in Infra-Dokumentation pflegen. EAS/Azure-Deploy-Befehle bleiben verboten.
9. Bei jeder Sequenz Root-Audit, Workspace-Audit, Staging-Produktionsaudit und Dependency-Tree neu prüfen. Am Ende Advisory-Abwesenheit mit Paketpfad dokumentieren; keine pauschalen Overrides oder `force`-Installs.
10. Azure-AI-Plattform bereinigen (WP-BE-06): `gpt-4.1-mini` bleibt (E-3); dessen Abkündigungstermin bei Microsoft belegen und als Folgeaufgabe festhalten; `gpt4o-mini`-Fallbacks und API-Version `2024-07-01` im Code durch eine einzige, dokumentierte Konfigurationsquelle ersetzen; Document-Intelligence-SDK-Entscheidung treffen. Änderungen am Deployment oder an der Region können die Verarbeitung von Nutzerdaten berühren und sind mit `privacy-impact-review` zu bewerten.
11. Infrastruktur-Repository bereinigen (WP-INFRA-02): Bicep-API-Versionen aktualisieren und mit `what-if` lesend prüfen; obsolete temporäre Bicep-/Parameterdateien entfernen. Kein Apply ohne separate Freigabe.
12. Update-Prozess etablieren (WP-BE-07): Dependabot oder Renovate für npm, GitHub Actions und Docker-Image-Tags; CI-Job für `npm audit` (Produktions- und Staging-Graph), aktueller Cosmos-Emulator-Tag.

## 9a. Phase 0 — Sicherheitsnetz (Work Packages, zwingend zuerst)

**Regeln für Phase 0:**
- Phase 0 ändert keine Dependency-Versionen und keinen fachlichen Produktionscode. Erlaubt sind Tests, Test-Hilfen, Fixtures, CI-Verdrahtung, Skripte und rein typbezogene Änderungen (z. B. typisierte `require`-Casts) ohne Laufzeitänderung. Jede nötige Produktionscode-Änderung (z. B. ein Test-Seam) wird minimal gehalten und im Handoff ausdrücklich genannt.
- Neue Tests werden gegen den **aktuellen** Stand geschrieben und müssen dort grün sein; sie beschreiben heutiges Verhalten (Characterization), nicht gewünschtes. Ein Test, der heutiges Verhalten als Fehler zeigt, wird gemeldet und bewusst entschieden, nicht stillschweigend angepasst.
- Keine Tests entfernen, ausschalten oder abschwächen. Instabile Tests werden ursachenbezogen repariert.
- Keine echten Nutzerdaten, keine Secrets und keine Alpha-Fotos in Fixtures.
- **Phase-0-Gate:** Kein Upgrade-Paket (WP-BE-01 und alle folgenden) startet ohne `PASS` von WP-QA-00. Grün bedeutet: shared-, backend-, mobile-, scripts- und startup-Tests, Typechecks, `build:verify`, alle neuen Phase-0-Tests und -Smokes lokal **und** in CI; Contract-Tests in CI; Prompt-Evals ausgeführt und bestanden. Nicht ausführbare Prüfungen (z. B. fehlende Zugangsdaten) gelten als `UNVERIFIED` und blockieren das Gate, bis der Product Owner sie ausdrücklich freigibt.

### WP-T0-01: Baseline, Paritäts-Gate und vollständige CI-Abdeckung

Agent: Backend

Goal: Den heutigen grünen Stand als maschinenprüfbare Baseline festschreiben und die CI so erweitern, dass alle bestehenden Suiten laufen.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- package.json
- backend/package.json, mobile/package.json, shared/package.json
- backend/vitest.config.mts, mobile/vitest.config.mts, shared/vitest.config.mts
- .github/workflows/ci.yml
- scripts/

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-13
- AC-18

Dependencies:
- Ausdrückliche Freigabe dieses Plans

Expected Handoff:
- Baseline-Datei mit Mindestzahlen je Paket (Testdateien und Tests: shared 10/466, backend 77/1.944, mobile 106/993, Stand 2026-10-27) und ein Prüfskript, das Vitest-JSON-Ergebnisse dagegen vergleicht und bei geringerer Zahl oder übersprungenen Tests fehlschlägt; das Skript hat einen eigenen Test
- CI führt zusätzlich aus: shared-Tests, mobile-Tests, `test:scripts`, `test:startup`, `build:verify`, Paritäts-Prüfung; angepasste Timeouts
- Beleg, dass die erweiterte CI grün läuft (oder dokumentierte rote Altlasten, die in Phase 0 repariert werden)

### WP-T0-02: Wire-Contract-Tests für OpenAI und Document Intelligence

Agent: Backend

Goal: Das echte SDK-Verhalten (URL, API-Version, Auth-Header, Request-Body, Antwort- und Fehlerbehandlung) offline gegen einen lokalen Fake-HTTP-Server absichern, bevor `openai` oder `@azure/ai-form-recognizer` verändert werden.

Required Knowledge Base:
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/openai.ts
- backend/src/lib/labelParser.ts
- backend/src/lib/documentIntelligence.ts
- backend/src/functions/reusableItemsEnrich.ts
- backend/src/functions/labelScan.test.ts
- backend/src/lib/openai.recipeAnalyze.test.ts
- backend/vitest.config.mts

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-14
- AC-18

Dependencies:
- WP-T0-01 `PASS`

Expected Handoff:
- Tests mit Dateinamen `*.wire.test.ts` (laufen in der normalen Unit-Suite), die den **echten** `AzureOpenAI`-Client und den **echten** `DocumentAnalysisClient` gegen `127.0.0.1` auf einem lokalen `node:http`-Server prüfen; lehnt das SDK HTTP ab, ein lokaler TLS-Test mit selbstsigniertem Zertifikat nur im Testprozess
- OpenAI: mindestens ein Aufruf je Client-Konstruktionsstelle (`openai.ts`, `labelParser.ts`, `reusableItemsEnrich.ts`) und je Strict-Schema-Familie; geprüft werden Pfad mit Deployment-Name, `api-version`, `api-key`-Header, `response_format` mit `strict: true`, erfolgreiche Antwort, leere Antwort, 400, 429, 5xx und Anzahl der SDK-Wiederholungen als beobachteter Ist-Wert
- Document Intelligence: Analyse-Start, Polling und Ergebnis (Fixture mit synthetischem Etikett ohne personenbezogene Daten, kein Foto), anschließende Verarbeitung durch den bestehenden Parser; ist keine echte aufgezeichnete Antwort verfügbar, wird die Fixture nach der dokumentierten SDK-Antwortform erstellt und als `UNVERIFIED gegen Live-Dienst` gekennzeichnet
- Alle Tests grün auf dem aktuellen Stand; keine Änderung bestehender Fake-Client-Tests

### WP-T0-03: Zod-Characterization-Tests

Agent: Backend

Goal: Das heutige Validierungsverhalten aller Request-Schemas als Tabelle absichern, damit das Zod-3-zu-4-Update Abweichungen sichtbar macht.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/http.ts
- backend/src/lib/recipeHttp.ts
- backend/src/lib/recipeValidation.ts
- backend/src/lib/recipeAnalyzeValidation.ts
- backend/src/lib/dailyInsightValidation.ts
- backend/src/functions/ (ai, dailyInsightFeedback, diary, favorites, foodEstimate, foodEstimateBatch, instagramRecipe, profile, recipes, reusableItems, specialActivity, weights)

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-15
- AC-18

Dependencies:
- WP-T0-01 `PASS`

Expected Handoff:
- Je Route mit Request-Schema eine Fall-Tabelle auf Handler-Ebene (HTTP-Antwort statt interner Schema-Exporte): gültig minimal, gültig maximal, jedes Pflichtfeld fehlt, falscher Typ, Grenzwerte (min/max, Länge, Zahlenbereich), ungültiger Enum-Wert, zusätzliche Felder, leere Strings, `null` gegen fehlend, Datums- und ID-Formate (inklusive nicht-standardkonformer UUIDs), Unicode und Leerzeichen
- Geprüft werden Statuscode, API-Fehlercode und Feldname der Antwort; zusätzlich Tests für `parseBody` und die Recipe-Fehlerumsetzung
- Liste der Schemas, bei denen heutiges Verhalten fragwürdig ist, zur bewussten Entscheidung; kein stilles Anpassen
- Alle Tests grün auf Zod 3; Test-Seams (Exporte) nur falls unvermeidbar und genannt

### WP-T0-04: Renderer-Referenzkorpus

Agent: Backend

Goal: Eine renderer-neutrale „Vorher“-Basis für Rezeptgrafiken schaffen, damit der Wechsel zu Canvas objektiv bewertet werden kann.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/domain/06-recipes.md

Required Repository Context:
- backend/src/lib/instagramRenderer/
- backend/src/lib/instagramRenderer/__tests__/
- backend/src/lib/instagramRenderer/test-fixtures/
- backend/scripts/render-*-template.mjs
- backend/scripts/render-golden.mjs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-16
- AC-18

Dependencies:
- WP-T0-01 `PASS`

Expected Handoff:
- Mindestens 6 Fixture-Rezepte (u. a. Nutrition-Layout mit und ohne Foto, Detail-Template mit 1, 5, 9 und 20 Zutaten, lange Titel, deutsche Silbentrennung, Sonderzeichen, Highlight-Icons) ausschließlich mit dem versionierten Foto `quarkbroetchen-source.png`, keine Alpha-Fotos
- Referenz-PNGs und ein Manifest mit renderer-neutralen Metriken (Format, exakt 1080 x 1350, nicht leer, Überlaufliste, Zeilenzahlen, Textboxmaße) je Fixture
- Test mit zwei Ebenen: (a) Metriken und Format als hartes Gate, auch nach dem Rendererwechsel; (b) Pixelvergleich mit `pixelmatch` und Toleranz, für Satori hart, für Canvas nur Bericht mit menschlicher Sichtprüfung
- Festlegung der Erzeugungs- und Vergleichsplattform (Plattformunterschiede bei Schrift-Rasterung dürfen nicht zu Flackertests führen)
- Bestehende Golden- und Layout-Tests bleiben unverändert grün

### WP-T0-05: Functions-Host-Smoke

Agent: Backend

Goal: Vor dem Merge prüfen, dass der echte Azure-Functions-Host die gebauten Funktionen registriert und Auth-Middleware aktiv ist.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/index.ts
- backend/src/lib/registrations.test.ts
- backend/scripts/dev.mjs, backend/scripts/storage.mjs, backend/scripts/wait-for-azurite.mjs
- backend/host.json
- backend/local.settings.json.template

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-17
- AC-18

Dependencies:
- WP-T0-01 `PASS`

Expected Handoff:
- Smoke-Skript im Backend, das baut, Azurite und `func start` mit In-Memory-Repositories startet und `GET /api/health` = 200 sowie `GET /api/diary/meals` ohne Token = 401 prüft
- Baseline-Liste der registrierten Funktionen (Namen und Anzahl; der Alpha-Release zählte 79) und Vergleich im Smoke
- Klärung, warum der zuletzt ausgeführte lokale `npm run dev` mit Exit 1 endete, oder dokumentierte Unabhängigkeit
- Lauffähig lokal (Core Tools vorhanden) und in CI (Core Tools Installation dort, Version dokumentiert)

### WP-T0-06: Mobile-Sicherheitsnetz

Agent: Frontend

Goal: Expo-/React-Native-Kompatibilität abdecken, die Node-Unit-Tests nicht sehen: Bundle, Konfiguration, Manifest und native Modulschnittstellen.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/package.json
- mobile/app.json
- mobile/app.config.js
- mobile/babel.config.js
- mobile/metro.config.js
- mobile/eas.json
- mobile/src/services/health/HealthConnectService.ts
- mobile/src/modules/nutrition/hub/LabelSubFlow.tsx
- mobile/src/modules/scanner/BarcodeScannerScreen.tsx
- mobile/src/modules/nutrition/AddItemModal.tsx
- mobile/android/

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-17
- AC-18

Dependencies:
- WP-T0-01 `PASS`

Expected Handoff:
- Typisierung der nativen Wrapper (`require(...) as typeof import(...)` bzw. `import type`), damit `tsc` API-Drift in Health Connect, Vision Camera und Crop Picker erkennt; Laufzeitverhalten und lazy `require` unverändert; Typecheck und alle Mobile-Tests grün
- Tests für `app.config.js` (Dev- und Standardvariante): Plugins, Android-Package, Health-Connect-Permissions und `queries`, minSdk 26, App-Link-Intent-Filter, `softwareKeyboardLayoutMode`, Scheme
- Bundle-Smoke `expo export --platform android` (Metro, Babel, Reanimated-Plugin) als reproduzierbarer Befehl und `expo-doctor`-Baseline (bekannte Befunde dokumentiert; dürfen nicht schlechter werden)
- Manifest-Ergebnis über `expo config --type introspect` oder, falls nicht aussagekräftig, Prebuild in eine Kopie **außerhalb** des Repositories; kein Prebuild im Repository, keine Änderung an `mobile/android/`
- Android-Debug-Assemble-Befehl (Gradle-Wrapper, JDK-Anforderung dokumentiert) als CI-tauglicher Baseline-Nachweis; kein EAS-Build

### WP-T0-07: CI-Verdrahtung der Phase-0-Gates und Testdokumentation

Agent: Backend

Goal: Alle neuen Phase-0-Tests und -Smokes in die CI aufnehmen und die Testdokumentation aktualisieren.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md

Required Repository Context:
- .github/workflows/ci.yml
- backend/scripts/ (Host-Smoke)
- mobile/package.json (Bundle-Smoke, Android-Assemble)
- docs/kb/tech/08-testing.md

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-13
- AC-17
- AC-18

Dependencies:
- WP-T0-02 bis WP-T0-06 `PASS`

Expected Handoff:
- CI-Jobs für Host-Smoke, Mobile-Bundle-Smoke, Android-Debug-Assemble und Paritätsprüfung; keine Deploy-Schritte, keine Secrets; Cosmos-Contract-Job unverändert
- Ein vollständiger grüner CI-Lauf auf dem Phase-0-Stand als Nachweis (Lauf-Link oder Zusammenfassung im Handoff)
- `docs/kb/tech/08-testing.md` beschreibt die neuen Testarten (Wire-Contract, Characterization, Referenzkorpus, Host-Smoke, Mobile-Smokes, Paritäts-Gate) und die CI-Abdeckung

### WP-QA-00: Phase-0-Gate

Agent: QA

Goal: Unabhängig bestätigen, dass das Sicherheitsnetz vollständig und der gesamte Teststand grün ist, bevor das erste Upgrade beginnt.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/06-ai-integrations.md

Required Repository Context:
- Diff aller Phase-0-Änderungen (Tests, Fixtures, Skripte, CI, typisierte Wrapper)
- Baseline-Datei und Prüfskript
- docs/qa/reports/README.md

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-13
- AC-14
- AC-15
- AC-16
- AC-17
- AC-18

Dependencies:
- WP-T0-01 bis WP-T0-07 `PASS`

Expected Handoff:
- QA-Bericht `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Phase0.md` mit `fittrack-qa-v1`, einem Verdict und jeder Suite mit Befehl, Exit-Code und Zahlen
- Nachweis, dass keine Dependency-Version geändert wurde (Manifest- und Lockfile-Diff) und kein Test entfernt oder abgeschwächt wurde
- Lauf von `npm run test:eval` als Baseline vor dem OpenAI-Update; ohne Zugangsdaten `UNVERIFIED` und Entscheidung beim Product Owner
- Manuelle Geräte-Checkliste (`MANUAL VALIDATION REQUIRED`): Login, Barcode-Scan, Etikettenscan, Health Connect, Foto-Zuschnitt, Bottom-Sheets/Animationen, App Link; mit Voraussetzungen, Schritten, erwartetem Ergebnis und Ergebnisfeld; wird nach jedem Mobile-Upgrade-Schritt wiederholt
- Verdict `PASS` nur, wenn alle Suiten lokal und in CI grün sind; sonst `FAIL` mit Findings. Ein `PASS` ist die Freigabe des Phase-0-Gates.

## 10. Backend Work Package

### WP-BE-01: Node, Backend-Produktions-SDKs und AI-Verträge

Agent: Backend

Goal: Node-24-/npm-Toolchain festlegen und die beiden direkten Produktionsadvisories sowie kompatible Backend-SDK-Updates beheben, ohne AI- oder HTTP-Verhalten zu ändern.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- package.json
- package-lock.json
- backend/package.json
- _deploy_staging/package.json
- _deploy_staging/package-lock.json
- backend/src/lib/openai.ts
- backend/src/lib/labelParser.ts
- backend/src/functions/reusableItemsEnrich.ts
- backend/src/lib/prompts/
- .github/workflows/ci.yml

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-8

Dependencies:
- Ausdrückliche Freigabe dieses Plans
- WP-QA-00 `PASS` (Phase-0-Gate)

Expected Handoff:
- Node/npm Pins und synchronisierte Manifeste/Lockfiles
- aktualisierte SDKs mit Versions-/Breaking-Change-Liste
- Backend tests, typecheck, `build:verify`, AI Offline-Tests und nötige Prompt-Evals mit Exitcodes
- bestätigter sauberer Staging-Produktionsaudit oder dokumentierter Blocker

## 11. Backend Renderer Work Package

### WP-BE-02: Satori/fflate-Kante vollständig beseitigen

Status: Freigegeben für Option B (Canvas), O-1 entschieden am 2026-10-27; umgesetzt, Handoff: [PLAN_FitTrack-Technology-Refresh_WP-BE-02_Handoff.md](PLAN_FitTrack-Technology-Refresh_WP-BE-02_Handoff.md) (Linux-Smoke offen)

Agent: Backend

Goal: Den ungültigen Root-/Staging-Dependency-Graph entfernen und den gewählten Renderer für Node 24/Linux bereitstellen.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- package.json
- backend/package.json
- backend/src/lib/instagramRenderer/
- backend/scripts/copy-instagram-assets.mjs
- _deploy_staging/package.json
- _deploy_staging/package-lock.json
- vorhandene Renderer-Golden- und Layouttests

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-4
- AC-5
- AC-8

Dependencies:
- O-1 ist entschieden: Option B (`@napi-rs/canvas`)
- WP-BE-01 `PASS`

Expected Handoff:
- gewählte Rendererquelle, Version, Lizenz und Distribution in Root und standalone Staging
- `npm ls --all` erfolgreich in Root und Staging
- Renderer-Unit-/Golden-Ergebnisse und Linux-Node-24-Smoke mit nichtleerem PNG 1080 x 1350
- visuelle Vorher-/Nachher-Bewertung; keine unreviewte Golden-Churn

## 12. Backend Tooling Work Package

### WP-BE-03: Test-, Import- und weitere Workspace-Abhängigkeiten

Agent: Backend

Goal: Kritische Tooling-Advisories beheben und alle Backend-/Shared-/Off-Import-Dependencies auf aktuelle kompatible Releases bringen.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/package.json
- shared/package.json
- tools/off-import/package.json
- package.json
- package-lock.json
- scripts/*.mjs und backend/vitest.config.mts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-6
- AC-8

Dependencies:
- WP-BE-01 `PASS`

Expected Handoff:
- Teststack auf aktuelle kompatible Vitest-/Vite-Version, Azurite gemäß O-2, MongoDB 7.7 und TSX 4.23.15 aktualisiert oder einzelne Abweichungen begründet; `@types/sharp` entfernt
- TypeScript bleibt in diesem Paket auf der bestehenden Linie (Migration in WP-BE-05)
- vollständige Backend-, Shared-, Import- und Script-Testresultate
- gelöste Vitest/Tinypool-Critical-/High-Advisories mit Advisory-IDs; für Azurite/`@azure/ms-rest-js` Ergebnis gemäß O-2 mit Advisory-IDs und Pfaden

### WP-BE-05: TypeScript-7-Migration

Status 2026-10-30: PASS-reif lokal (TS 7.0.2, Expo-Bundle grün), Android-Build nur CI/UNVERIFIED — siehe [WP-BE-05 Handoff](PLAN_FitTrack-Technology-Refresh_WP-BE-05_Handoff.md). Planabweichung: zusammen mit WP-FE-01 vorgezogen (Entscheidung Product Owner 2026-10-29, Option 2).

Agent: Backend

Goal: TypeScript in allen Workspaces auf die aktuelle Major-Version migrieren, ohne Build-, Test- oder Laufzeitverhalten zu ändern.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- tsconfig.base.json
- tsconfig.json
- backend/tsconfig.json
- backend/tsconfig.test.json
- shared/tsconfig.json
- mobile/tsconfig.json
- tools/off-import/tsconfig.json
- backend/package.json, shared/package.json, mobile/package.json, tools/off-import/package.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-3
- AC-7
- AC-8

Dependencies:
- WP-BE-01 `PASS`
- WP-BE-02 `PASS`
- WP-BE-03 `PASS`

Expected Handoff:
- TypeScript-Version, geänderte Compiler-Optionen und Breaking-Change-Liste
- Typecheck aller Workspaces, Backend `build:verify` und Backend-/Shared-/Mobile-Tests grün
- Kompatibilitätsnachweis mit Expo/Babel-Toolchain, Vitest und Editor-Tooling; bei Blocker dokumentierter Rückfall nur nach Planrevision

### WP-BE-06: Azure-AI-Plattform-Lebenszyklus

Agent: Backend

Goal: OpenAI-API-Version und -Konfiguration (Modell bleibt `gpt-4.1-mini`, E-3) sowie das Document-Intelligence-SDK auf einen unterstützten, einheitlich konfigurierten Stand bringen, ohne AI-Verträge oder Nutzerverhalten zu ändern.

Required Knowledge Base:
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md
- docs/kb/domain/08-quota-system.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/openai.ts
- backend/src/lib/labelParser.ts
- backend/src/lib/documentIntelligence.ts
- backend/src/functions/reusableItemsEnrich.ts
- backend/src/lib/prompts/
- infra/modules/functionapp.bicep (nur lesend)
- infra/parameters/alpha-fittrack.bicepparam (nur lesend)

Required Skills:
- azure-openai-feature-integration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-3
- AC-10

Dependencies:
- WP-BE-01 `PASS`
- Ergebnis der Microsoft-Lebenszyklusprüfung für das Document-Intelligence-SDK sowie Abkündigungstermin von `gpt-4.1-mini`

Expected Handoff:
- belegter Abkündigungstermin von `gpt-4.1-mini` und Unterstützung der API-Version (Quelle, Datum); kein Modellwechsel in diesem Plan; Folgeaufgabe mit Frist festgehalten
- einheitliche Konfigurationsquelle für Deployment-Name und API-Version; `gpt4o-mini`-Fallbacks durch den tatsächlichen Deployment-Namen `gpt-4.1-mini` ersetzt; Strict-Schemas unverändert
- Document-Intelligence-SDK-Entscheidung (beibehalten mit Beleg oder Migration auf das empfohlene SDK) samt Tests
- Prompt-Evals ausgeführt und bestanden oder als `UNVERIFIED` gekennzeichnet, falls keine Zugangsdaten verfügbar sind
- Privacy-Impact-Aussage (Datenkategorien, Verarbeitungsort, Hinweis ob `docs/legal/datenschutzerklaerung-alpha.md` angepasst werden müsste; keine Änderung ohne Freigabe)

### WP-BE-07: Update-Automatisierung und CI-Gates

Agent: Backend

Goal: Wiederholtes Veralten verhindern und CI-Konfiguration auf aktuelle, geprüfte Versionen bringen.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md

Required Repository Context:
- .github/workflows/ci.yml
- package.json
- _deploy_staging/package.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-11

Dependencies:
- WP-BE-03 `PASS`
- WP-FE-01 `PASS`

Expected Handoff:
- GitHub Actions auf aktuell geprüfte Releases (`checkout`, `setup-node`); Node-Version aus `.nvmrc`
- Cosmos-Emulator-Image auf aktuellen stabilen Tag, mit Nachweis, dass die Contract-Tests laufen (sonst `UNVERIFIED`)
- CI-Job mit `npm audit --omit=dev` im Staging-Graphen als Gate und Root-Audit als Bericht (nicht-blockierend, solange O-2-Ausnahmen offen sind)
- `.github/dependabot.yml` oder Renovate-Konfiguration für npm-Workspaces, `_deploy_staging`, GitHub Actions und Docker-Images, mit Gruppierung nach Expo-SDK und Major-Updates als getrennten PRs
- keine Secrets oder Deploy-Schritte in den Workflows

## 13. Frontend Work Package

### WP-FE-01: Expo-/React-Native-SDK-Migration bis SDK 58

Status 2026-10-30: lokal umgesetzt (Expo 58, React Native 0.88.1), Bundle-Smoke grün (Agentenangabe). **Handoff fehlt**: die Datei `PLAN_FitTrack-Technology-Refresh_WP-FE-01_Handoff.md` wurde vom Product Owner gelöscht und ist neu zu erstellen (AC-20). Offen: Geräte-Checkliste nach dem Upgrade (`MANUAL VALIDATION REQUIRED`), Android-Assemble nur in CI. AC-5 ist auf den Zielstand SDK 58 geändert (PO-4). Der Kamera-Paketwechsel (PO-3) stammt aus einer Parallelentwicklung und ist nicht Teil dieses Pakets. Planabweichung: zusammen mit WP-BE-05 vorgezogen (Entscheidung Product Owner 2026-10-29, Option 2).

Agent: Frontend

Goal: Mobile-App schrittweise auf die aktuelle kompatible Expo-/React-Native-/Native-Module-Linie migrieren.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/product/03-design-system.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/package.json
- mobile/package-lock.json
- mobile/app.json
- mobile/app.config.js
- mobile/eas.json
- mobile/android/
- mobile/babel.config.js
- mobile/metro.config.js
- mobile/vitest.config.mts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-5
- AC-6
- AC-7
- AC-8

Dependencies:
- WP-BE-03 `PASS`

Expected Handoff:
- jedes Expo-SDK-Upgrade einzeln protokolliert (54→55→56→57→58), mit Expo Doctor- und Typecheck-Ergebnis pro Stufe
- React Native, React, React Test Renderer und native Module in einer von Expo unterstützten Matrix
- aktualisierte Native-Konfiguration; App-Links, CIAM, Health Connect, Camera, Crop Picker, Reanimated und Android Permissions unverändert funktionsfähig
- Android Debug/Preview-Konfigurationsbuild sowie Testresultate; keine EAS-Build-ID ohne separate Freigabe
- `Dev Build Required: YES`

## 13a. Findings-Behebung (Work Packages, neu 2026-10-30)

Ziel: Alle Findings aus Abschnitt 0 mit den neuesten Versionen beheben (AC-19). Reihenfolge: WP-FE-02 und WP-BE-08 sind unabhängig voneinander; WP-FE-03 läuft parallel als Beobachtung und Prüfung.

### WP-FE-02: Mobile-Navigation-Kette und Babel

Agent: Frontend

Goal: Die High-Findings `decode-uri-component`, `query-string` und `@react-navigation/core` sowie das Low-Finding `@babel/core` beheben, ohne Navigation, Deep-Link-Verhalten oder Build zu ändern.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/package.json
- package-lock.json
- mobile/src (Navigation, Linking, App-Link-Konfiguration)
- mobile/app.config.js

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-5
- AC-8
- AC-19

Dependencies:
- WP-FE-01 `PASS`

Expected Handoff:
- `@react-navigation/native`, `bottom-tabs`, `native-stack` auf die neuesten kompatiblen Versionen (Registry-Stand `native@7.5.1`, `core@7.24.0`); `npm ls decode-uri-component query-string @react-navigation/core` zeigt die behobene Kette
- `@babel/core` auf eine von Expo/`babel-preset-expo` unterstützte, gepatchte Version (Zielversion mit Beleg; Babel 8 nur wenn unterstützt)
- Root-`npm audit` vorher/nachher mit Advisory-IDs; Typecheck, Mobile-Tests, Bundle-/Manifest-/Doctor-Smokes mit Exitcodes; Test-Parität
- Breaking-Change-Liste der Navigation-Updates (API-Änderungen in Typen/Hooks, Linking-Optionen); Verhalten von App-Link und Deep-Link unverändert (Test und Geräte-Checkliste Punkt App Link)

### WP-BE-08: Azurite-Kette

Status: Teil 1 ausführbar; Teil 2 entfällt bis zu einem Azurite-Release mit gepatchter Kette (PO-1 = D, befristet).

Agent: Backend

Goal: Die Findings `@azure/identity`, `@azure/msal-node` (high) und `azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid` (moderate) beheben.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md

Required Repository Context:
- backend/package.json
- package.json
- package-lock.json
- backend/scripts/storage.mjs, dev.mjs, wait-for-azurite.mjs, functions-smoke.mjs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-7
- AC-8
- AC-19

Dependencies:
- WP-BE-03 `PASS`
- Teil 2: Entscheidung PO-1

Expected Handoff:
- Teil 1 (ohne PO-Entscheidung): Lockfile-Auflösung der Kette `azurite` → `applicationinsights` → `@azure/identity` → `@azure/msal-node` auf gepatchte Versionen prüfen (`@azure/identity@4.14.1`, `msal-node >= 7.1.0`), ohne Override, mit `npm ls`; falls nur per Override möglich, als Option an den Product Owner melden
- Teil 2 (nach PO-1): Option A (gezieltes `uuid`-Override) mit Nachweis, dass Azurite startet und `npm run test:startup`, `test:functions-smoke` und Backend-Tests grün sind; oder Option B (Entfernung/Extern-Bereitstellung) samt angepassten Skripten und Tests
- Root-`npm audit` vorher/nachher mit Advisory-IDs; Test-Parität; `_deploy_staging` unverändert 0 Findings

### WP-FE-03: Expo-Findings (`zod`, `deepmerge`) prüfen und beheben

Status: Beleg und Ausnahme-Dokumentation ausführbar; PO-2 = C entschieden (2026-10-30), kein Override.

Agent: Frontend

Goal: Die Findings `zod@3.25.76` unter `@expo/cli` (high, dazu `expo`) und `deepmerge`/`@expo/config`-Kette (low) so beheben, dass die neueste Expo-Linie erhalten bleibt.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/package.json
- package.json
- package-lock.json
- mobile/scripts (Smokes)

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-5
- AC-8
- AC-19

Dependencies:
- WP-FE-01 `PASS`
- Entscheidung PO-2

Expected Handoff:
- Beleg (Quelle, Datum): neueste `expo`/`@expo/cli`-Patchstände, ob eine Version `zod >= 4.6.6` oder eine gepatchte `deepmerge`-Linie nutzt (Release-Notes, Expo-Issues); Registry-Stände
- Falls Upstream-Fix vorhanden: Update und Audit-Nachweis. Falls nicht und PO-2 = B: gezieltes Override mit grünen `smoke:bundle`, `smoke:manifest`, `smoke:doctor`, `expo-doctor`, Typecheck und Tests. Falls PO-2 = C: Ausnahme-Dokumentation mit Advisory-ID, Pfad, Erreichbarkeit (Build-Tooling), Upstream-Status und Prüfdatum
- keine Downgrades, keine pauschalen Overrides

### WP-QA-02: Findings-Gate

Agent: QA

Goal: Unabhängig bestätigen, dass die Findings behoben sind.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/qa/reports/README.md

Required Repository Context:
- Diffs aller Manifeste und Lockfiles seit Phase 0
- Root-/Staging-Audit
- Handoffs der Pakete WP-FE-02, WP-BE-08, WP-FE-03

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-19
- AC-20

Dependencies:
- WP-FE-02, WP-BE-08, WP-FE-03 `PASS`

Expected Handoff:
- QA-Bericht `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Findings.md` mit `fittrack-qa-v1`, Verdict und Befehl, Exitcode und Zahlen je Audit/Suite
- Liste der verbleibenden Findings mit PO-Entscheidung oder "keine"
- Prüfung, dass keine Downgrades, kein `--force` und nur gezielte, belegte Overrides verwendet wurden
- Geräte-Checkliste (Phase-0-Liste) nach den Mobile-Updates als `MANUAL VALIDATION REQUIRED`

## 14. Infrastructure and Release Work Package

### WP-INFRA-01: Runtime-, lokale CLI- und Release-Dokumentation

Agent: Infrastructure

Goal: Azure Runtime auf unterstütztem Node 24 belassen, lokale Functions-/EAS-CLIs aktualisieren und den späteren Alpha-Release nachvollziehbar vorbereiten.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- infra/modules/functionapp.bicep
- infra/README.md
- .github/instructions/infra-release.instructions.md
- mobile/eas.json
- Azure Alpha Release Record

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-8
- AC-9

Dependencies:
- WP-BE-01 `PASS`
- WP-FE-01 `PASS`

Expected Handoff:
- Azure Node-24-Major-/Functions-Health-Baseline, ohne Runtime-Mutation
- Functions Core Tools 4.16 und EAS CLI 26 lokal verifiziert oder Installationshindernisse dokumentiert
- Release-Anweisung mit getrenntem Deploy-/EAS-Freigabegate
- aktualisierte Infra-/Release-Dokumentation; keine Azure- oder EAS-Operation ausgeführt

### WP-INFRA-02: Bicep-API-Versionen und Repo-Altlasten

Agent: Infrastructure

Goal: Bicep-Ressourcen-API-Versionen aktualisieren und obsolete temporäre Infrastrukturdateien bereinigen, ohne Azure zu verändern.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- infra/main.bicep
- infra/modules/
- infra/parameters/
- infra/README.md

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12

Dependencies:
- WP-BE-06 `PASS`

Expected Handoff:
- aktuelle stabile API-Versionen je Ressourcentyp (Quelle, Datum), `az bicep build` erfolgreich
- lesendes `what-if` gegen Alpha mit Ergebnis; Delete/Recreate bestehender Ressourcen ist ein Stoppfall; kein `az deployment group create`
- Entscheidung und Entfernung der Dateien `infra/modules/.cosmos-community-dev-deployment.tmp.bicep` und `infra/parameters/.cosmos-dev-deployment.tmp.json`, falls obsolet
- Hinweis, dass ein Apply als separater Auftrag nach QA erfolgt

## 15. Documentation Work Package

### WP-BE-04: Wissensbasis und Dependency-Policy aktualisieren

Agent: Backend

Goal: Versions- und Runtime-Dokumentation an den nach QA bestätigten Zustand angleichen.

Required Knowledge Base:
- docs/kb/README.md
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- package.json
- backend/package.json
- mobile/package.json
- shared/package.json
- tools/off-import/package.json
- _deploy_staging/package.json
- .github/workflows/ci.yml
- infra/README.md
- .github/instructions/infra-release.instructions.md

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12

Dependencies:
- WP-BE-01, WP-BE-02, WP-BE-03, WP-BE-05, WP-BE-06, WP-BE-07, WP-FE-01, WP-INFRA-01, WP-INFRA-02 `PASS`

Expected Handoff:
- Knowledge Base und Operator-Anleitungen nennen tatsächliche Versionspins, Upgradepfad, Supportmatrix und verbleibende Ausnahmen
- keine als aktuell bezeichnete Version ohne Registry-/Microsoft-/Expo-Nachweis

## 16. QA Work Package

### WP-QA-01: Vollständige Security-, Kompatibilitäts- und Releaseprüfung

Agent: QA

Goal: Alle AC unabhängig verifizieren und ein dauerhaftes QA-Ergebnis mit Audit-IDs, Dependency-Pfaden und Android-/Backend-Evidence liefern.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- finale Diffs aller Manifeste und Lockfiles
- `.nvmrc`, `.github/workflows/ci.yml`, `infra/modules/functionapp.bicep`
- Backend Renderer, Tests und CI-Bericht
- `mobile/android/`, Expo-Konfiguration und Mobile-Testresultate
- docs/qa/reports/README.md

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-1 bis AC-18

Dependencies:
- WP-QA-00 `PASS` (Phase 0); WP-BE-01, WP-BE-02, WP-BE-03, WP-BE-05, WP-BE-06, WP-BE-07, WP-FE-01, WP-FE-02, WP-FE-03, WP-BE-08, WP-QA-02, WP-INFRA-01, WP-INFRA-02, WP-BE-04 `PASS`

Expected Handoff:
- QA-Bericht unter `docs/qa/reports/PLAN_FitTrack-Technology-Refresh.md` mit `fittrack-qa-v1`
- genau ein Verdict: `PASS`, `PASS WITH ISSUES` oder `FAIL`
- Root-/Staging-Audit, jeden Testbefehl/Exitcode, native Build-Evidence und alle verbleibenden UNVERIFIED-Punkte

## 17. Test Strategy

- **Phase 0 zuerst:** Baseline (shared 10/466, backend 77/1.944, mobile 106/993, Stand 2026-10-27), Paritäts-Gate, erweiterte CI, Wire-Contract-, Characterization-, Referenzkorpus-, Host- und Mobile-Smokes. Nach **jedem** Upgrade-Schritt laufen dieselben Suiten; Datei- und Testzahl dürfen nicht sinken, keine Tests werden übersprungen oder abgeschwächt. Ein roter Test stoppt den Schritt.
- Installationsintegrität: Root `npm ci`, Root `npm ls --all`; `_deploy_staging` `npm ci --omit=dev`, `npm ls --all`.
- Security: `npm audit --json` in Root, Mobile und Backend; `npm audit --omit=dev` im Staging. Jeden Advisory-Titel, GHSA/CVE, Schweregrad und Dependency-Pfad festhalten.
- Backend: Unit- und Startup-Tests, Typecheck, `build:verify`, Renderer Golden, AI Structured-Output-Tests; prompt eval nur falls SDK-/Promptänderungen Interpretation oder Request-Verhalten berühren.
- Shared/Off-Import: Typechecks und alle Tests; Import-/Export-Skript-Tests auf MongoDB-7-Kompatibilität.
- Mobile je Expo-SDK-Stufe: `npx expo install --fix`, `npx expo-doctor`, Typecheck, Vitest und nativer Android-Build. EAS/Preview-Build erst nach separater Freigabe.
- Linux: Node 24 x64 Staging-Install, native Renderer-Abhängigkeit laden und PNG Smoke testen; Windows-native Ergebnisse sind kein Ersatz.
- Abschluss: Staging Production Audit exit 0; Root-Audit ohne Critical/High in produktiven oder CI-erreichbaren Pfaden. Verbleibende Findings (z. B. Azurite, O-2) mit Advisory-ID, Pfad, Erreichbarkeit und Upstream-Status offenlegen; den Plan nicht als vollständig bereinigt melden, wenn Findings unbegründet bleiben.
- Plattform: Offline-Tests für OpenAI-/Document-Intelligence-Clients; Prompt-Evals nur mit verfügbaren Zugangsdaten, sonst `UNVERIFIED`. Bicep: `az bicep build` und lesendes `what-if`.

## 18. Acceptance Criteria

1. **AC-1 Runtime/CI:** `.nvmrc` und CI pinnen Node `24.22.1`; npm ist auf `12.2.1` vereinheitlicht; Manifeste und Node-Typdefinitionen enthalten keine unbeabsichtigten Node-20-Pins. Azure bleibt bei unterstütztem Node 24.
2. **AC-2 Backend-Produktion:** `_deploy_staging`-`npm audit --omit=dev` exit 0; `openai` und `zod` sind auf aktuelle kompatible Versionen migriert; alle bestehenden Structured Outputs behalten `strict: true`, identische Schemas und dokumentierte Responses.
3. **AC-3 Backend-Kompatibilität:** Backend Tests, AI Offline-Tests, Typecheck und `build:verify` sind auf finalem Lockfile erfolgreich; notwendige AI Prompt-Evals sind bestanden.
4. **AC-4 Renderer:** O-1 ist dokumentiert; Root und Staging haben gültige Abhängigkeitsgraphen ohne `ELSPROBLEMS`, und kein erreichbarer fflate-Advisory-Pfad bleibt. Node-24/Linux-x64 Smoke erzeugt ein nichtleeres PNG exakt `1080 x 1350`; visueller Vergleich ist reviewt.
5. **AC-5 Mobile SDK:** Expo SDK 58 (Zielstand) ist durch Expo Doctor, Typecheck, Tests und Bundle-Smoke validiert; die Zwischenstufen 55 bis 57 werden nicht einzeln geprüft (PO-4 = A, 2026-10-30). Das finale Expo-/React-Native-/React-Modulset ist von Expo empfohlen; Expo-SDK-Advisories sind behoben oder nach PO-2 dokumentiert.
6. **AC-6 Native App:** Android Gradle/Expo Native-Konfiguration entspricht dem SDK-Ziel; App Links, Authentication, Health Connect, Camera/Crop Picker und Reanimated bleiben funktionsfähig; Android Debug Build und relevante Tests passieren. Neues Native Dev Build ist als erforderlich dokumentiert, aber nicht ausgelöst.
7. **AC-7 Dev/Test-Dependencies:** Critical/High Advisories aus Vitest/Tinypool, Azurite/Proxy-Addr, Shell-Quote und weiteren erreichbaren Dev-/Build-Pfaden sind behoben; alle Workspaces bestehen ihre Test- und Typecheck-Gates.
8. **AC-8 Gesamtabhängigkeiten:** Alle direkten Dependencies (inklusive TypeScript 7 nach WP-BE-05) sind aktuell/stabil und kompatibel oder mit konkretem Grund, verantwortlicher Prüfung und Review-Datum zurückgestellt; `@types/sharp` ist entfernt. Root `npm ls --all` exit 0. Root `npm audit` meldet **keine Findings** (Soll 0, jede Severity). Ein verbleibendes Finding ist nur zulässig, wenn Upstream nachweislich keine gepatchte Version bietet; dann sind Advisory-ID, Pfad, Erreichbarkeit, Upstream-Beleg und Prüfdatum dokumentiert und der Product Owner hat es einzeln entschieden (PO-1, PO-2). Ein nicht belegtes oder nicht entschiedenes Finding führt zu `FAIL`.
9. **AC-9 Release/Docs:** CLI-/Action-Versionen und KB/Release-Anleitungen stimmen mit verifizierten Zuständen überein. Kein Bicep-Apply, Azure Functions Publish, EAS Build oder Submit wurde ausgeführt; solche Operationen warten auf getrennte ausdrückliche Freigabe.
10. **AC-10 Azure-AI-Plattform:** Der Abkündigungstermin von `gpt-4.1-mini` und die Unterstützung der API-Version sind mit Quelle und Datum belegt, ein Modellwechsel wurde nicht durchgeführt; es existiert genau eine Konfigurationsquelle ohne `gpt4o-mini`-Fallback; Strict-Schemas sind unverändert; die Document-Intelligence-SDK-Entscheidung ist dokumentiert und durch Tests abgesichert; Prompt-Evals bestanden oder `UNVERIFIED`; die Privacy-Aussage liegt vor, `docs/legal/` wurde nicht ohne Freigabe geändert.
11. **AC-11 Update-Automatisierung:** Dependabot oder Renovate deckt npm-Workspaces, `_deploy_staging`, GitHub Actions und Docker-Images ab; CI enthält ein Audit-Gate für den Staging-Produktionsgraphen; Workflows nutzen aktuelle geprüfte Action-Versionen und einen aktuellen stabilen Cosmos-Emulator-Tag; es gibt keine Deploy-Schritte oder Secrets in Workflows.
12. **AC-12 Bicep und Altlasten:** Bicep-API-Versionen sind auf geprüfte aktuelle Stände gehoben, `az bicep build` ist erfolgreich, ein lesendes `what-if` zeigt kein Delete/Recreate; obsolete temporäre Bicep-/Parameterdateien sind entfernt; kein `az deployment group create` wurde ausgeführt.
13. **AC-13 Baseline und CI-Abdeckung:** Die Baseline-Datei hält Datei- und Testzahlen je Paket fest (Stand 2026-10-27: shared 10/466, backend 77/1.944, mobile 106/993); das Prüfskript schlägt bei geringerer Zahl oder übersprungenen Tests fehl und ist selbst getestet; die CI führt shared-, mobile-, scripts- und startup-Tests, Typechecks, `build:verify` und die Paritätsprüfung aus. Nach jedem Upgrade-Schritt ist die Parität erfüllt.
14. **AC-14 SDK-Wire-Contracts:** `*.wire.test.ts` prüfen den echten OpenAI- und Document-Intelligence-Client gegen einen lokalen Fake-Server: Pfad mit Deployment-Name, `api-version`, `api-key`, Strict-`response_format`, Erfolgs-, Leer-, 400-, 429- und 5xx-Fall sowie Wiederholungsanzahl; mindestens ein Aufruf je Client-Konstruktionsstelle und je Strict-Schema-Familie; Fixtures ohne personenbezogene Daten; alle Tests grün vor dem OpenAI- oder SDK-Update.
15. **AC-15 Zod-Characterization:** Für jede Route mit Request-Schema existiert eine Fall-Tabelle (gültig minimal/maximal, fehlende Pflichtfelder, falsche Typen, Grenzwerte, Enums, Zusatzfelder, `null` gegen fehlend, ID-/Datumsformate) mit geprüftem Statuscode, API-Fehlercode und Feldname; alle grün auf Zod 3; fragwürdige Ist-Verhalten sind dem Product Owner gemeldet.
16. **AC-16 Renderer-Referenzkorpus:** Mindestens 6 Fixtures mit Referenz-PNGs und renderer-neutralem Metrik-Manifest (Format, exakt `1080 x 1350`, nicht leer, Überlauf, Zeilenzahlen, Textbox-Maße); Metrik-Test als hartes Gate, Pixelvergleich mit Toleranz; Erzeugungsplattform festgelegt; keine Alpha-Fotos; bestehende Renderer-Tests unverändert grün.
17. **AC-17 Host- und Mobile-Smokes:** Host-Smoke bestätigt `/api/health` = 200, `/api/diary/meals` ohne Token = 401 und die Funktionsliste gegen die Baseline; `app.config.js`-Tests, Bundle-Smoke `expo export --platform android`, `expo-doctor`-Baseline, Manifest-Prüfung und Android-Debug-Assemble sind als Befehle reproduzierbar und grün; native Wrapper sind typisiert, sodass `tsc` API-Drift erkennt; `mobile/android/` blieb unverändert; alle Smokes laufen in CI.
18. **AC-18 Phase-0-Gate:** Auf unverändertem Dependency-Stand sind alle Suiten (shared, backend, mobile, scripts, startup, Typechecks, `build:verify`, neue Phase-0-Tests und -Smokes) lokal und in CI grün; Contract-Tests sind in CI grün; Prompt-Evals sind ausgeführt und bestanden oder vom Product Owner ausdrücklich als `UNVERIFIED` freigegeben; Manifest- und Lockfile-Diff beweist, dass in Phase 0 keine Dependency-Version geändert wurde; kein Test wurde entfernt oder abgeschwächt; die manuelle Geräte-Checkliste liegt vor; WP-QA-00 hat `PASS`. Erst dann darf WP-BE-01 starten.
19. **AC-19 Findings-frei:** Root `npm audit` und `_deploy_staging` `npm audit --omit=dev` melden jeweils 0 Findings, oder jedes verbleibende Finding ist nach der Regel in AC-8 belegt und durch den Product Owner entschieden; es wurden weder `--force` noch Downgrades (`expo@51`, `azurite@2.7.1`) noch pauschale Overrides verwendet; jedes Override ist gezielt, installiert nachweislich eine gepatchte Version und ist mit grünen Smokes und Tests belegt. Nach jedem Behebungsschritt gilt die Test-Parität (AC-13).
20. **AC-20 Handoff-Vollständigkeit:** Für WP-BE-01, -02, -03, -05, -06, -07, WP-FE-01, -02, -03, WP-BE-08 und die INFRA-Pakete liegt ein Handoff mit Befehlen, Exitcodes und Zahlen vor; fehlende Handoffs (aktuell BE-01, BE-03, BE-06, FE-01) sind nachgeholt, bevor WP-QA-01 startet.

## 19. Risks and Edge Cases

- OpenAI 7/Zod 4 sind Major-Upgrades; Request-Typen und Structured Output-Serialisierung können sich ändern. Kein Prompt-/Schemaverhalten darf ohne evals und Planrevision abweichen.
- Expo 54→58 kann mehrere Native-Änderungen enthalten. Upgrade nicht als ein Paket-Bump behandeln; pro SDK-Stufe bauen und Android-Projektänderungen bewerten.
- In `mobile/android` liegen native Projekte und Konfiguration. Keine `prebuild --clean`-Operation verwenden, solange nicht bewiesen ist, dass keine handgepflegten Änderungen verloren gehen.
- `@napi-rs/canvas` besitzt Plattform-spezifische optionale Binaries. Linux x64 Node 24 muss in CI oder gleichwertiger Umgebung validiert werden.
- Ein Zero-Advisory-Audit ist zeitabhängig. Neuer Audit-Stand und alle Ausnahmen gehören in den QA-Bericht; `npm audit` darf nicht mit `--force` oder Ignore-Regeln schöngefärbt werden.
- Globale CLI-Updates ändern den Benutzerrechner außerhalb des Repositories und erfolgen erst in ihrem zugewiesenen Arbeitspaket nach Planfreigabe.
- Der Alpha-Backend-Deploy und neue EAS Builds sind reale Releases und explizit out of scope.
- TypeScript 7 ist ein Compiler-Wechsel mit Ökosystemrisiko (Expo/Babel, Vitest, Editor-Tooling); deshalb separater Schritt nach Renderer und Testrunner.
- Ein späterer Wechsel des OpenAI-Modells oder -Deployments (jetzt ausgeschlossen, E-3) kann Ausgabequalität, Kosten, Quoten und Verarbeitungsort ändern und erfordert Prompt-Evals sowie gegebenenfalls eine Product-Owner-Entscheidung; er darf nicht stillschweigend als Dependency-Update erfolgen. Die Abkündigung von `gpt-4.1-mini` setzt dafür eine Frist.
- Das Document-Intelligence-SDK-Replacement kann Ergebnisformate des Etikettenscans ändern; Label-Parser-Tests und Fixtures müssen unverändert bestehen.
- Bicep-API-Versionen können Standardwerte ändern; `what-if` ist Pflicht, Apply nur separat und nach QA.
- Der Cosmos-Emulator-Tag kann Verhalten oder Protokoll ändern (derzeit HTTP bei `vnext-preview`); Contract-Tests sind der Nachweis.
- Phase-0-Tests beschreiben heutiges Verhalten. Zeigen sie fragwürdige Ist-Zustände (z. B. zu laxe Validierung), wird das gemeldet und gesondert entschieden; Phase 0 ändert dieses Verhalten nicht.
- Wire-Contract-Tests gegen einen lokalen Server lehnen möglicherweise HTTP ab oder hängen am SDK-Retry-Verhalten; Ist-Werte werden beobachtet und festgeschrieben, nicht geraten. Sie ersetzen die Prompt-Evals nicht (Modellqualität), sondern sichern das SDK-Protokoll.
- Pixelvergleiche können sich zwischen Windows und Linux in der Schrift-Rasterung unterscheiden; Erzeugungs- und Vergleichsplattform ist festzulegen, sonst entstehen Flackertests.
- Phase 0 ist ein Verzögerungsrisiko für den Start der Updates, aber bewusst: ohne grünes Netz sind Inkompatibilitäten nach den Upgrades nicht von bestehenden Fehlern zu unterscheiden.
- Ein typisierter nativer Wrapper kann beim Typecheck vorhandene, bisher verdeckte Typfehler offenlegen; diese werden ohne Laufzeitänderung behoben und gemeldet.
- Prompt-Evals und Cosmos-Contract-Tests brauchen Zugangsdaten bzw. Emulator; fehlt beides lokal, gilt der Teilbereich als `UNVERIFIED`, bis CI oder der Product Owner ihn bestätigt.

## 20. Recommended Execution Order

1. Planfreigabe einholen; die Entscheidungen O-1 (Canvas), O-2 (Option A) und E-3 (`gpt-4.1-mini` bleibt) sind getroffen.
   **Phase 0 (zwingend zuerst, sequenziell):** WP-T0-01 Baseline und CI → WP-T0-02 Wire-Contracts → WP-T0-03 Zod-Characterization → WP-T0-04 Renderer-Korpus → WP-T0-05 Host-Smoke → WP-T0-06 Mobile-Netz → WP-T0-07 CI-Verdrahtung → WP-QA-00 Gate. Ohne `PASS` von WP-QA-00 startet keiner der folgenden Schritte.
2. WP-BE-01: Node/npm sowie Backend-Produktions-SDKs und AI-Verträge migrieren.
3. WP-BE-03: Backend-/Shared-/Off-Import-Test-, Build- und Utility-Dependencies aktualisieren (ohne TypeScript 7).
4. WP-BE-06: Azure-AI-Plattform-Lebenszyklus (Modell/API-Version, Document-Intelligence-SDK) klären und bereinigen.
5. WP-BE-02: Rendererroute gemäß O-1 (Canvas) implementieren.
6. WP-BE-05: TypeScript 7 in allen Workspaces migrieren. **Erledigt (lokal), zusammen mit Schritt 7 vorgezogen (PO 2026-10-29).**
7. WP-FE-01: Expo SDK auf 58 migrieren und nativen Android Build validieren. **Lokal erledigt; Handoff neu erstellen (AC-20), PO-3 und PO-4 klären.**
7a. **Findings-Behebung (neu, parallel):** WP-FE-02 (Navigation-Kette, Babel), WP-BE-08 Teil 1 (`@azure/identity`/`msal-node`), WP-FE-03 (Expo-Beleg). Danach WP-BE-08 Teil 2 nach PO-1 und WP-FE-03 nach PO-2. Dann WP-QA-02.
7b. Fehlende Handoffs nachholen (BE-01, BE-03, BE-06, FE-01), Test-Baseline in `scripts/test-baseline.json` auf den aktuellen Stand anheben (Backend-Agent, Paritätsregel bleibt), CI-Lauf mit Linux-Renderer-Nachweis für PO-5.
8. WP-INFRA-01: unterstützte Runtime und lokale CLIs prüfen; Release-Dokumentation vorbereiten, ohne Deployment.
9. WP-INFRA-02: Bicep-API-Versionen und Repo-Altlasten bereinigen (nur `build` und lesendes `what-if`).
10. WP-BE-07: Update-Automatisierung, CI-Audit-Gate, aktuelle Actions und Cosmos-Emulator-Tag.
11. WP-BE-04: Knowledge Base/Operator-Dokumentation anhand finaler Versionen aktualisieren.
12. WP-QA-01: vollständige unabhängige Prüfung und Bericht; jedes nicht erfüllte AC ergibt `FAIL` oder `UNVERIFIED` entsprechend QA-Regeln.
13. Etwaiger Alpha Deploy, Bicep-Apply, EAS Development Build oder Preview Build erfolgt ausschließlich nach separatem direktem Benutzerauftrag.