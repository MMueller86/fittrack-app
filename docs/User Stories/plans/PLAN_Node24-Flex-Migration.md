# Plan: Neue Alpha in der Subscription `Fittrack` mit Node 24 und Azure Functions Flex Consumption

**Planrevision:** `2026-10-26-NEWSUB-07` — ersetzt `2026-10-26-NEWSUB-06` (alte Fassungen in der Git-Historie).
**Status:** Entscheidungen getroffen, wartet auf ausdrückliche `APPROVE`. Dieser Plan implementiert, testet und deployt nichts.
**Stand:** 2026-10-26
**Plan-Typ:** Large Change / Infrastruktur (vereinfacht, ohne Nutzerdaten-Migration)

Infrastructure Impact: Alpha (Dev bleibt lokal; Dev-Flex entfällt)
Mobile Build Impact: None (nur neues Profil `preview-flex` in `mobile/eas.json`; keine nativen Änderungen, kein `app.config.js`-Diff)
Privacy Impact: Update needed (Zusatzsatz KI-Verarbeitungsort), separater, nicht blockierender Benutzer-Subtask; kein Teil des technischen Abschlusses (Abschnitt 4)
Persistence Impact: Class 0, Schema unverändert; keine Nutzerdatenkopie in diesem Plan; einmaliger Katalog-Seed `foodProducts` aus Dev (Abschnitt 5)

---

## 1. Ziel und Leitgedanke

Es wird eine **neue Alpha** in `Fittrack` (`dd7539ab-c638-44f8-9173-8bcd28cdbae3`, `germanywestcentral`) provisioniert und deployt: Flex-Consumption-Function-App (FC1, Node 24), eigenes Cosmos, ein Storage-Konto, eigene Application Insights. Die neue Alpha startet **ohne Nutzerdaten**; Nutzer legen sich neu an. Die Migration der Nutzerdaten ist zurückgestellt (Abschnitt 12). Einzige Daten, die geladen werden, sind Katalogdaten (`foodProducts`, Abschnitt 5). Die alte Alpha (PRODYNA, `func-fittrack-alpha-ppf5sc`, Y1) bleibt unverändert live. Dev bleibt lokal und unverändert.

| Bereich | Ziel |
|---|---|
| Hosting | Linux Flex Consumption (FC1), Functions v4, Node 24, Always Ready 0, Maximum Instances 5 je Funktionsgruppe, Instanz 2048 MB |
| Storage | **Ein** Konto je Umgebung; Flex-Deployment-Paket als zusätzlicher Blob-Container im selben Konto |
| Release | `func azure functionapp publish … --build remote --javascript` aus `_deploy_staging/` |
| Mobile | Profil `preview-flex` mit neuer API-URL; CIAM-Werte unverändert |
| Auth-Relay | Bleibt vorerst in PRODYNA; späterer Umzug als Folgemigration (Abschnitt 9) |

**Nicht Teil dieses Plans:** Nutzerdaten-Migration (Abschnitt 12), Dev-Flex, Y1-Abbau (Benutzer), Auth-Relay-Umzug, KI-Modellwechsel (`gpt-4.1-mini` läuft laut Azure 2027-04-14 aus; eigenes Vorhaben, Entscheidung bis 2027-01-14).

---

## 2. Festlegungen (gültiger Stand)

| Festlegung | Inhalt |
|---|---|
| Keine Nutzerdaten | Die neue Alpha startet leer (außer Katalog-Seed). Die alte Alpha bleibt unverändert; der Zugriff auf sie wird vom Benutzer neu beantragt |
| Node 24 | Ziel ohne Node-22-Rückfall; Native-Gate-Fehler = STOP mit Planrevision |
| `product-images` | Notwendige Umsetzung (Container in `storage.bicep`), keine Entscheidung |
| Geteilte KI-Dienste | Alpha nutzt `oai-fittrack-dev` (Deployment `gpt-4.1-mini`, `GlobalStandard`) und `di-fittrack-dev-hlpqe7` (F0) gemeinsam mit Dev; beide zustandslos, keine eigenen Alpha-Instanzen (KB `01-system-overview.md`: „shared by design") |
| Auth-Relay | SWA bleibt in PRODYNA, Umzug später (Abschnitt 9); `deployStaticWebApp = false` |
| Datenschutz | `GlobalStandard`/Verarbeitung außerhalb der EU vom Benutzer akzeptiert; Textformulierung separater, nicht blockierender Benutzer-Subtask (Abschnitt 4) |
| Umstellung | `preview-flex` ist bis zur Entscheidung des Benutzers nur Testbuild; wann umgestellt wird, entscheidet der Benutzer (Abschnitt 9) |

---

## 3. Entscheidungen (getroffen, Benutzer, 2026-10-26)

| ID | Entscheidung | Kurzbegründung |
|---|---|---|
| E-1 | Ein Storage-Konto je Umgebung (Daten, Queue, Flex-Deployment-Container) | Kein Code-/Trigger-/Queue-Eingriff, kein Host-Storage-Modul |
| E-2 | Alpha in eigener RG `rg-fittrack-alpha` (`germanywestcentral`); Ressourcennamen aus Deployment-Outputs, nie geraten | Getrennte Lösch-/RBAC-Grenze; KB-Regel „eine RG" wird in WP-5 angepasst |
| E-3 | Alpha teilt die Dev-DI `di-fittrack-dev-hlpqe7` (F0, 500 Seiten/Monat, mit Dev geteilt); keine eigene Alpha-DI | KB: OpenAI/DI „shared by design", zustandslos; Nachteil nur gemeinsames Seitenlimit |
| E-4 | OpenAI bleibt `GlobalStandard` (`gpt-4.1-mini` in `oai-fittrack-dev`, API `2024-08-01-preview`); kein DataZone-Test | Benutzer: Verarbeitung außerhalb der EU unkritisch (Abschnitt 4) |
| E-5 | Auth-Relay bleibt vorerst in PRODYNA, späterer Umzug als eigene kleinere Folgemigration, keine feste Frist | Priorität: Functions müssen laufen; Auslöser siehe Abschnitt 9 |

---

## 4. Privacy Impact

Skill: `privacy-impact-review`. Gelesen: `docs/legal/datenschutzerklaerung-alpha.md`, `infra/modules/storage.bicep`, `infra/modules/appinsights.bicep`.

```
Privacy Impact: Update needed (Zusatzsatz), separat, nicht blockierend
Data flow: Keine Nutzerdaten werden kopiert. Die neue Alpha enthält nur den öffentlichen Open-Food-Facts-Katalog. KI-/OCR-Anfragen gehen weiter an Azure OpenAI/Document Intelligence; Datenkategorien unverändert. Neue App-Insights-Instanz, 30 Tage Retention.
Policy sections affected: „Wo und womit werden die Daten verarbeitet?"
Proposed text: unten
Open questions: unten
```

| Punkt | Klasse |
|---|---|
| Speicherregion „Azure-Dienste in Europa", 30 Tage App Insights, 7 Tage Soft-Delete | Covered (Region nicht einzeln genannt) |
| KI-Verarbeitungsort: `gpt-4.1-mini` bleibt `GlobalStandard` (Verarbeitung nicht auf Europa begrenzt); vom Benutzer akzeptiert; Zusatzsatz in der Erklärung nötig | Update needed (E-4), separat, nicht blockierend |
| Benutzereinschätzung (E-4): Verarbeitung außerhalb der EU unkritisch, da keine Nutzer-ID, E-Mail oder Tokens an die KI gehen. Laut `datenschutzerklaerung-alpha.md` Z. 33 können Anzeigename, Profildaten und eingegebene Texte oder Fotos Teil der Anfrage sein; die rechtliche Einordnung bleibt beim Benutzer | Open question, Sache des Benutzers |
| Rechtsgrundlage/Vertrag mit Microsoft (privat statt PRODYNA) | Open question, Sache des Benutzers |

**Vorgeschlagener Text** (nur nach ausdrücklicher Freigabe, mit neuem `Stand:`; Änderung unter `docs/legal/` ist eigener Subtask des Benutzers/Backend):
- **Erforderlich** (E-4): „Die Verarbeitung durch Azure OpenAI kann abhängig vom Bereitstellungstyp auch außerhalb Europas erfolgen." [Formulierung wird separat verfeinert und vom Benutzer rechtlich geklärt]

**Hinweis an den Benutzer (nicht-technisch, kein Gate):** Der Zusatzsatz ist Verantwortung und getrennter Subtask des Benutzers. Er ändert nichts an WP-1 bis WP-6, den Acceptance Criteria, der QA oder dem technischen Abschluss. `docs/legal/` wird nur mit ausdrücklicher Freigabe geändert. Die spätere Nutzerdaten-Migration (Abschnitt 12) braucht einen eigenen Privacy-Review.

---

## 5. Persistence Impact und Katalog-Seed

**Klasse 0:** `CONTAINER_DEFS` (12 Container, `backend/src/lib/cosmos.ts`) und Partition Keys unverändert. Die Container entstehen per `main.bicep` leer.

**Befund: Referenz-/Katalogdaten.** Nur `foodProducts` ist Katalog statt Nutzerdaten:
- `cosmos.ts` Z. 25–26: „Internal food product catalog"; KB `07-infrastructure.md` Z. 79: „Open Food Facts catalog"; KB `domain/03-food-catalog.md` („Catalog Import", ~Z. 60–65): Import erfolgt offline per `tools/off-import/import-to-cosmos.ts`, „not part of the live application".
- Die App braucht ihn für die Grundfunktion: `foodProducts.ts` (`GET /food-products/search`, `/food-products/{id}`, „Catalog only", KB `02-backend.md` Z. 30), Lesezugriff `cosmosFoodProductRepository.ts` Z. 90–131; Suchranking und Meal-Parser arbeiten auf dem Katalog (KB `03-food-catalog.md`). Ohne Katalog liefert die Lebensmittelsuche nichts: die neue Alpha wäre nicht sinnvoll nutzbar. Seed daher nötig.
- Übrige Container sind nutzergeneriert oder Cache und starten leer: `users`, `profiles`, `nutritionProfiles`, `weights`, `nutritionDiaryMeals`, `reusableMealItems`, `recipes`, `aiUsage`, `aiInsights`, `userFoodRelations`; `communityRecipes` enthält ownerlose Kopien von Nutzerrezepten (KB `07-infrastructure.md` Z. 77), also keine Referenzdaten; leer ist funktional (leere Community-Liste). Kein Seed.

**Quelle und Weg.** Quelle ist Dev-Cosmos `cosmos-fittrack-dev-hlpqe7` (read-only); Ziel ist das Alpha-Cosmos aus den Deployment-Outputs von WP-3. Schlüssel nur als Prozess-Umgebungsvariablen, nie in Dateien/Logs/Argumenten.

**Skript-Entscheidung.** `scripts/migrate-food-products.mjs` genügt **nicht unverändert**:
- Endpoints sind hartcodiert auf die alten PRODYNA-Konten (`cosmos-fittrack-dev-ppf5sc`, `cosmos-fittrack-alpha-ppf5sc`; Z. 17, 19): es würde gegen die falsche Umgebung laufen.
- Es löscht zuerst **alle** Dokumente im Ziel (`deleteAllInAlpha`, Z. 33–52): unnötig und riskant bei Fehlkonfiguration.
- Schlüssel kommen auch per Kommandozeile (`argv`, Z. 16, 18): landet in der Shell-Historie.

Minimale Erweiterung (WP-2): Endpoints und Schlüssel aus Umgebungsvariablen (`SOURCE_COSMOS_ENDPOINT`/`SOURCE_COSMOS_KEY`, `TARGET_COSMOS_ENDPOINT`/`TARGET_COSMOS_KEY`), `argv`-Schlüssel und Delete-Phase entfernen (reiner Upsert, damit wiederholbar), Abbruch wenn Ziel-Endpoint = Quell-Endpoint oder dem alten PRODYNA-Konto entspricht, Bericht nur mit Zählwerten. `tools/off-import` scheidet aus: braucht den Open-Food-Facts-Dump und ist aufwendiger als eine Kopie aus Dev (~210k Dokumente, in Dev in wenigen Minuten importiert).

**Prüfung.** Zieldokumentzahl = Quellzahl; 20 Stichproben feldgleich (ohne Systemfelder); nach Publish ein Suchaufruf (`/food-products/search`) mit Treffer.

**Offen:** Durchsatzmodus/RU des neuen Cosmos nicht geprüft; bei 429 wird der Upsert-Lauf wiederholt (Abschnitt 10).

---

## 6. Technische Lösung

- **Ein Storage-Konto (E-1).** Belege: `functionapp.bicep` setzt `AzureWebJobsStorage` (Z. 116–117) und `STORAGE_CONNECTION_STRING` (Z. 156–157) schon auf dieselbe `storageConnectionString`; `queueClient.ts` (Z. 27–28) bevorzugt `AzureWebJobsStorage`, der Trigger (`reusableItemsEnrich.ts` Z. 158) nutzt es ebenfalls: beide zeigen auf dasselbe Konto, kein Codeeingriff. Profil-Löschung und `listPersonalBlobs` arbeiten nur mit Präfix `{userId}/` in `recipe-images`/`product-images` (`storage.ts` Z. 108–119, 325); der Deployment-Container wird nicht berührt. Doku: Standard-Deployment-Container liegt im `AzureWebJobsStorage`-Konto; das Konto ist je Umgebung exklusiv für diese App. Risiko: Schlüssel-Rotation betrifft Host und Daten zugleich; Deployment-Container muss privat bleiben (Standard).
- **Runtime.** `engines.node`, `@types/node` und `_deploy_staging/package.json` auf Node 24 (aktuell `>=22`/`^22`). `sharp ^0.35.5`, `@resvg/resvg-js ~2.6.2` bleiben. Flex unterstützt 22 und 24; Ziel ist Node 24. Scheitert das Linux-Native-Gate unter Node 24, ist das ein STOP mit Planrevision, ohne Ersatzwert; die alte Alpha bleibt live, es entsteht kein Nutzerimpact.
- **Flex-IaC.** `infra/modules/functionapp.bicep` (Y1, `Node|22`) ersetzen durch FC1-Plan (`reserved: true`) und Site mit `functionAppConfig` (Runtime `node`/`24`, Deployment-Container im Konto, `maximumInstanceCount: 5`, Always Ready 0, Instanz 2048 MB). Nicht mehr gültige Y1-Settings (`WEBSITE_RUN_FROM_PACKAGE`, `WEBSITE_CONTENT*`, `FUNCTIONS_WORKER_RUNTIME`, Oryx-Flags) per Validierung entfernen. Property-Formen per `what-if` bestätigen.
- **Maximum Instances.** Doku: Minimum 1, Maximum 1000; `@minValue(40)` im Quickstart ist nur ein Template-Guard. `5` gilt nur für On-Demand-Instanzen und **je Funktionsgruppe** (`http`, `function:reusable-items-enrich`, Timer), nicht als App-Gesamtlimit. Regionale Flex-Kernquote 250 (Pay-as-you-go).
- **`main.bicep`.** `createAccount`/`createFunctionApp` (`!= 'alpha'`) entfernen; veraltete Defaults/Kommentare (`gpt4o-mini`, „6 Containers") anpassen. `storage.bicep`: Container `product-images` ergänzen (notwendig: Backend nutzt ihn, `uploadProductImage` legt ihn nicht an, `storage.ts` Z. 13, 293–312; KB `07-infrastructure.md` Z. 59).
- **Parameter.** Neue `infra/parameters/alpha-fittrack.bicepparam` (nicht `alpha.bicepparam` wiederverwenden: setzt `deployStaticWebApp = true`, alte PRODYNA-DI, `gpt-4o-mini`): `deployStaticWebApp = false`, `azureOpenAiDeploymentName = 'gpt-4.1-mini'`, `azureOpenAiApiVersion = '2024-08-01-preview'`, `azureDocIntelligenceEndpoint = 'https://di-fittrack-dev-hlpqe7.cognitiveservices.azure.com/'` (E-3; `main.bicep` Z. 147–170 überspringt dann das DI-Modul), CIAM unverändert, RG `rg-fittrack-alpha` (E-2). `azureOpenAiEndpoint`, `azureOpenAiApiKey` und `azureDocIntelligenceKey` werden nur beim Deployment aus Prozess-Umgebungsvariablen übergeben, nie in Dateien/Logs; kein `documentIntelligenceSku`.
- **Deployment.** `build:verify`, Spiegelung nach `_deploy_staging/dist`, Remote-Build-Publish. Dokumentiert werden Source-Commit, Lockfile-Hash und Hash von `_deploy_staging/dist`; Remote-Oryx-Builds sind nicht bitgleich, Gleichwertigkeit belegen Function-List, Health, Auth-401 und Renderer-Test. Kein `WEBSITE_TIME_ZONE` im Repo, Timer-Cron ist UTC.
- **Native-Gate.** Nach Deploy: Function-List enthält `health` und `instagramRecipe`, `/api/health` = 200, authentifizierter Renderer-Aufruf liefert PNG.
- **Mobile.** `mobile/eas.json`: Profil `preview-flex` als Kopie von `preview` mit `EXPO_PUBLIC_API_URL=https://<alpha-flex-host>/api`; `preview` bleibt unverändert.

---

## 7. Work Packages

Strikt sequenziell, genau ein Agent je WP. Ergebnis `PASS`, `STOP` oder `UNVERIFIED`.

### WP-1 Preflight

Agent: Infrastructure
Goal: Vor jeder Mutation Kontext und Flex-Voraussetzungen prüfen.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md
Required Repository Context:
- infra/main.bicep
- infra/parameters/dev-fittrack.bicepparam
Required Skills: None
Relevant Acceptance Criteria: AC-1
Dependencies: None
Inhalt: Aktiver Kontext `Fittrack` (jeder `az`-Befehl mit `--subscription`); einmalig `az provider register --namespace Microsoft.App` (kein Gate); Flex/Node 24 in `germanywestcentral`. Kein Zugriff auf die alte Alpha.
Expected Handoff: Preflight-Ergebnis.

### WP-2 Backend: Node-24-Manifeste und Seed-Skript

Agent: Backend
Goal: Manifeste auf Node 24 und das Seed-Skript gemäß Abschnitt 5 minimal anpassen; kein Queue-/Trigger-Eingriff.
Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
Required Repository Context:
- package.json
- backend/package.json
- _deploy_staging/package.json
- scripts/migrate-food-products.mjs
Required Skills: None
Relevant Acceptance Criteria: AC-2, AC-3, AC-7
Dependencies: WP-1 `PASS`
Inhalt: Manifeste; Skript `scripts/migrate-food-products.mjs` gemäß Abschnitt 5 (Env-Variablen, kein Delete, Zielschutz, Zählbericht); Clean Build, `build:verify`, Typechecks, Vitest, `check:encoding`, `test:startup`; Artefakt-Fingerprint (Commit, Lockfile-Hash, `dist`-Hash). Das Skript liegt außerhalb des Backend-Builds; Test der Zielschutz-Logik nur, falls sie in eine testbare Funktion fällt, sonst Dry-Run-Nachweis.
Expected Handoff: Skriptpfad und Aufruf, Testnachweis, Fingerprint.

### WP-3 Infrastructure: Flex-IaC und Alpha-Provisionierung

Agent: Infrastructure
Goal: Flex-Bicep, Parameterdatei, `product-images` bereitstellen und Alpha-Ressourcen (ohne Code) provisionieren.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md
Required Repository Context:
- infra/main.bicep
- infra/modules/
- infra/parameters/
Required Skills: None
Relevant Acceptance Criteria: AC-4, AC-5
Dependencies: WP-2 `PASS`
Inhalt: Abschnitt 6 (IaC, Parameter, Container `product-images` in `storage.bicep`); `az bicep build`, `validate`, `what-if` (Delete/Recreate bestehender Ressourcen oder Ablehnung von `5`/Always Ready 0 = STOP, kein Ersatzwert 40); Deploy der Alpha-RG; App bleibt ohne Code. Getrackte Temp-Dateien `infra/modules/.cosmos-community-dev-deployment.tmp.bicep` und `infra/parameters/.cosmos-dev-deployment.tmp.json` nicht verwenden.
Expected Handoff: Resource-IDs, Hostname, `what-if`-Ergebnis, Settings-Matrix (nur Namen).

### WP-4 Infrastructure: Katalog-Seed, Deploy, EAS-Build

Agent: Infrastructure
Goal: Katalog seeden, Artefakt deployen, `preview-flex` bauen.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- scripts/migrate-food-products.mjs
- _deploy_staging/
- mobile/eas.json
Required Skills: None
Relevant Acceptance Criteria: AC-5, AC-6, AC-7, AC-8, AC-10
Dependencies: WP-3 `PASS`
Inhalt: (1) Seed `foodProducts` von Dev (read-only) in das Alpha-Cosmos nach Abschnitt 5; Zählung und 20 Stichproben. (2) Publish nach Alpha; Function-List (Native-Gate-Nachweis), Health 200, `/api/diary/meals` ohne Token 401, Native-Gate (Fehlschlag unter Node 24 = STOP), Suchaufruf `/food-products/search` mit Treffer. (3) Profil `preview-flex` in `mobile/eas.json` ergänzen und `eas build --profile preview-flex --platform android --non-interactive`; Build-ID melden. Die Profiländerung liegt hier beim Infrastructure-Agenten (siehe Abschnitt 10); `Dev Build Required` wird laut `infra-release.instructions.md` (Z. 245) für `eas.json` mit YES gemeldet, ohne einen Dev-Build auszulösen.
Expected Handoff: Seed-Bericht (Zählwerte), Fingerprint, Function-List, Health/Auth/Such-Ergebnis, Build-ID.

### WP-5 Infrastructure: Smoke und Dokumentation

Agent: Infrastructure
Goal: Betrieb gegen die neue Alpha beweisen und Dokumente an den Ist-Zustand anpassen (vor QA).
Required Knowledge Base:
- docs/kb/README.md
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/06-ai-integrations.md
- docs/kb/tech/02-backend.md
- infra/README.md
- .github/instructions/infra-release.instructions.md
Required Skills: None
Relevant Acceptance Criteria: AC-9, AC-11, AC-12
Dependencies: WP-4 `PASS`
Inhalt: Smoke mit `preview-flex`: Login (CIAM-Testuser, frisch angelegter Nutzer), Lebensmittelsuche (Katalog), reversibler Schreibvorgang (Tagebuch/Gewicht), ein KI-Aufruf, ein Etikettenscan; Queue-Smoke und Timer-Smoke (einmal manuell über Admin-Route, Master Key nur Session); App-Insights-Eintrag in der neuen Instanz; Testdaten entfernen. Doku: Subscription/Region/RG-Zuschnitt (E-2; löst „alles in `rg-Michael-Mueller`" ab), geteilte Dev-DI und Dev-OpenAI für Alpha (E-3/E-4), Flex statt Y1, Node 24, `product-images`, `gpt-4.1-mini`, neue Parameterdatei, Katalog-Seed-Hinweis, veraltete Namen und Healthchecks in `infra-release.instructions.md` (`rg-Michael-Mueller`, `func-fittrack-alpha-ppf5sc`, `Node|22`, hartes `--profile preview`); Datenschutztext wird hier **nicht** geändert.
Expected Handoff: Smoke-Bericht, Liste geänderter Dokumente.

### WP-6 QA

Agent: QA
Goal: Alle Acceptance Criteria gegen Evidence prüfen; Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL`; fehlende Evidence ist nie PASS.
Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- Diff von `backend/`, `infra/`, `scripts/`, `mobile/eas.json`, `docs/kb/`
Required Skills: None
Relevant Acceptance Criteria: AC-1 bis AC-12
Dependencies: WP-5 `PASS`
Expected Handoff: QA-Bericht mit einem Verdict.

---

## 8. Execution Order

1. WP-1 Preflight (Infrastructure)
2. WP-2 Backend: Manifeste und Seed-Skript (Backend)
3. WP-3 Flex-IaC und Provisionierung (Infrastructure)
4. WP-4 Seed, Deploy, EAS-Build (Infrastructure)
5. WP-5 Smoke und Doku (Infrastructure)
6. WP-6 QA (QA)

**Danach, durch den Benutzer (kein WP):** `preview-flex`-Build testen; Entscheidung über die Umstellung (Abschnitt 9); Abbau der alten Umgebung liegt beim Benutzer.

**Separater Hinweis (nicht-technisch, kein Gate):** Datenschutztext (Abschnitt 4) ist ein getrennter Subtask des Benutzers.

**Deploy-Reihenfolge:** Infrastruktur (WP-3), Katalog-Seed (WP-4), Backend-Code (WP-4), Mobile-Build (WP-4, zuletzt).

---

## 9. Auth-Relay und Rückfall/Betrieb

**Auth-Relay (E-5).** Static Web App `swa-fittrack-alpha-ppf5sc` (`blue-hill-03fb3c103.1.azurestaticapps.net`) bleibt vorerst in PRODYNA. Der Login-Callback hängt daran (`mobile/auth-callback-host.json`, Entra-Redirect-URIs, `assetlinks.json`). Der Umzug folgt später als eigene, kleinere Folgemigration (neuer Hostname, Redirect-URIs, `auth-callback-host.json`, `assetlinks.json`, neue Builds) ohne feste Frist. Einzige Bedingung: Subscription und SWA dürfen erst abgebaut werden bzw. der Zugriff darauf darf erst verloren gehen, wenn das Relay umgezogen ist; ein Ausfall bricht den Login **aller** Builds. Verantwortlich: Benutzer. In der neuen Parameterdatei gilt `deployStaticWebApp = false`.

**Rückfall/Betrieb.** Bis zur Tester-Freigabe bleibt die alte Alpha unverändert und `preview` zeigt weiter auf sie. Die neue Alpha enthält keine Nutzerdaten der alten Alpha: Nach Umstellung auf `preview-flex` sind diese dort **nicht sichtbar**, bis die Migration nachgeholt ist (Abschnitt 12). `preview-flex` dient bis dahin nur zum Test; der Benutzer entscheidet, wann er umstellt. Einträge, die in der neuen Alpha angelegt werden, liegen nur dort. `preview`-Builds mit alter URL schreiben weiter in die alte Umgebung, solange diese läuft. Fehler in der neuen Alpha werden vorwärts korrigiert (Neu-Deploy); es gibt keinen Datenabgleich zwischen alter und neuer Alpha.

**STOP-Fälle:** `what-if` zeigt Delete/Recreate beim Deployment; Flex lehnt `5` oder Always Ready 0 ab; Quota-Fehler; Seed-Zielkonto = Quellkonto oder altes PRODYNA-Konto; Zählabweichung des Seeds nach Wiederholung; Native-Gate-Fehler unter Node 24 (mit Planrevision); Secret in Ausgabe/Log.

---

## 10. Verifikation, Abweichungen und Annahmen

**Abweichungen/Hinweise (Repo gewinnt):**
- `mobile/eas.json` ist in `infra-release.instructions.md` nicht dem Infra-Agenten zugewiesen (Z. 245 nennt nur die Dev-Build-Bewertung); der Planner weist die Profiländerung dem Infrastructure-Agenten zu, um die WP-Zahl niedrig zu halten.
- `scripts/migrate-food-products.mjs` ist auf die alten PRODYNA-Konten fest verdrahtet und löscht das Ziel (Abschnitt 5); KB `03-food-catalog.md` erwähnt dieses Skript nicht, nur `tools/off-import`.
- Scheduler/Queue: bestätigt (`reusableItemsEnrichScheduler.ts` Z. 59–60; `reusableItemsEnrich.ts` Z. 99, 157–158).

**Annahmen (durch Gates abgesichert):** Remote-Oryx-Build holt die Linux-Binärpakete von `sharp`/`@resvg/resvg-js`; 2048 MB reichen für den Renderer; Site-Properties für `5`/Always Ready 0 sind per `what-if` zu bestätigen; Dev-Cosmos `cosmos-fittrack-dev-hlpqe7` enthält den vollständigen Katalog (~210k Dokumente laut Benutzer, nicht vom Planner geprüft); Durchsatz/RU des neuen Cosmos reicht für den Seed (ungeprüft, Wiederholung per Upsert möglich). Ein Tarifwechsel der Dev-DI von F0 auf S0 ist laut Benutzer/Orchestrator möglich, aber ungeprüft. Benutzerangaben (Subscription, Provider, Dev-Daten, Modell-SKU, Quoten) sind nicht vom Planner gegen Azure geprüft. Microsoft-Learn-Aussagen (Flex-Limits, `Microsoft.App` nur für VNet, Remote-Build, Node 22/24) stammen vom Orchestrator und sind nicht vom Planner erneut abgerufen.

---

## 11. Acceptance Criteria

1. **AC-1** Preflight dokumentiert aktiven Kontext `Fittrack`, `Microsoft.App`-Registrierung und Flex-/Node-24-Verfügbarkeit in `germanywestcentral`; vor jeder Mutation ist kein PRODYNA-Kontext aktiv.
2. **AC-2** Root-, Backend- und Staging-Manifeste sowie `@types/node` verlangen Node 24; `queueClient.ts`, Trigger-Binding, API, DTOs und Cosmos-Modell sind unverändert.
3. **AC-3** Clean Build, `build:verify`, Typechecks, Vitest, `check:encoding`, `test:startup` sind grün; Commit, Lockfile-Hash und `dist`-Hash sind dokumentiert.
4. **AC-4** Die Alpha-Flex-App ist per GET nachgewiesen: FC1, Node 24, Maximum Instances 5, Always Ready 0; `what-if` zeigte keine Delete/Recreate-Änderung bestehender Ressourcen.
5. **AC-5** Alpha liegt in `rg-fittrack-alpha` mit eigenem Storage-Konto (Daten, Queue, Deployment-Container), eigenem Cosmos und eigener App Insights; DI (`di-fittrack-dev-hlpqe7`) und OpenAI (`oai-fittrack-dev`, `gpt-4.1-mini`) sind bewusst mit Dev geteilt, es existiert keine Alpha-DI; kein Setting verweist auf PRODYNA-Ressourcen (Settings-Matrix ohne Secretwerte); `product-images` existiert in `storage.bicep` und im Ziel.
6. **AC-6** Function-List enthält `health` und `instagramRecipe`; `GET /api/health` = 200; `GET /api/diary/meals` ohne Token = 401; ein Renderer-Aufruf liefert PNG.
7. **AC-7** Das Seed-Skript liest nur `foodProducts` aus der Dev-Quelle (nie schreibend), schreibt nur per Upsert (kein Delete), nimmt keine Secrets in Dateien/Logs/Argumente auf, hat keine hartcodierten Endpoints und bricht ab, wenn Ziel = Quelle oder = altes PRODYNA-Konto.
8. **AC-8** Der Seed ist verifiziert: Zieldokumentzahl `foodProducts` = Quellzahl, 20 Stichproben feldgleich (ohne Systemfelder); alle anderen Container der neuen Alpha enthalten keine kopierten Daten; die alte Alpha wurde nicht gelesen oder verändert.
9. **AC-9** Ein neues Reusable-Item wird mindestens einmal verarbeitet; Endzustand `searchTermsEnriched = true`, keine doppelten Suchbegriffe, Poison-Queue leer; der manuell ausgelöste Scheduler ist idempotent (zweiter Lauf ändert nichts).
10. **AC-10** `mobile/eas.json` enthält genau ein neues Profil `preview-flex` mit Alpha-URL inklusive `/api`; CIAM-Werte unverändert; kein Diff in `app.config.js` oder nativen Dateien; Build-ID existiert.
11. **AC-11** Mit `preview-flex`: Login (frischer Nutzer), Lebensmittelsuche liefert Katalogtreffer, reversibler Schreibvorgang, KI-Aufruf, Etikettenscan gelingen; Telemetrie erscheint in der neuen App-Insights-Instanz.
12. **AC-12** Die in WP-5 genannten Dokumente enthalten keine veralteten Aussagen zu `rg-Michael-Mueller` als einziger RG, Y1/`Node|22`, `gpt-4o-mini`, altem Funktionsnamen oder fehlendem `product-images`; die alte PRODYNA-Umgebung und die Dev-Ressourcen wurden durch diesen Plan nicht verändert.

---

## 12. Zurückgestellt: Nutzerdaten-Migration

Folgevorhaben mit **eigenem Plan**, sobald der Zugriff auf die alte Alpha wieder besteht. Nicht Teil von WP-1 bis WP-6. Leitplanken aus Rev 06, nicht ausgearbeitet:

- **Voraussetzung:** Lesezugriff auf Alpha-Cosmos und -Storage der Quelle (Schlüssel nur als Umgebungsvariablen). Verantwortlich: Benutzer beantragt den Zugriff.
- **Merge/Upsert statt Reset:** Die neue Alpha wird bis dahin produktiv genutzt; das Reset-Konzept von Rev 06 (Reset auf leeres Ziel) gilt nicht mehr und ist neu zu planen.
- **Bilder:** Bild-Inventur (absolute Quell-Storage-URLs in `userFoodRelations.imageUrl`/Tagebuch-`imageUrl`) und Blob-Kopie (`recipe-images`, `product-images`) gehören in dieses Folgevorhaben.
- **Nutzer-IDs:** Bleiben gültig (CIAM unverändert).
- **Umfang:** Caches nicht kopieren (`dailyInsight`, `weeklyInsight`, `profileDeletionLock`); aus `aiInsights` nur `insightFeedback`; nicht kopieren: `label-scans` und Host-Container (`azure-webjobs-*`, `function-releases`, `scm-releases`).
- **Privacy:** Eigener Privacy-Review vor Start.
