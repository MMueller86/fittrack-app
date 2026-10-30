# WP-INFRA-02 Handoff: Bicep-API-Versionen und Repo-Altlasten

Stand: 2026-10-30. Agent: Infrastructure. Kein `az deployment group create`, kein Apply, kein Commit.

## Ergebnis

`PASS`: Builds erfolgreich ohne Warnungen, lesendes `what-if` ohne Delete/Recreate. Apply steht aus (separater Auftrag nach QA).

## 1. API-Versionen je Ressourcentyp

Quelle: `az provider show` (verfügbare Versionen, Subscription `Fittrack`) und Bicep-Typ-Index der installierten Bicep CLI 0.42.1 (verfügbar: 0.48.1). Neuere Provider-Versionen ohne Bicep-Typen (BCP081) wurden verworfen, damit Properties validiert bleiben.

| Ressourcentyp | vorher | nachher | Neuere Provider-Version ohne Bicep-Typen |
|---|---|---|---|
| `Microsoft.DocumentDB/databaseAccounts` (+ `sqlDatabases`, `containers`) | 2024-05-15 | 2025-10-15 | 2026-03-15 |
| `Microsoft.Storage/storageAccounts` (+ `blobServices`, `containers`, `managementPolicies`, `queueServices`, `queues`) | 2023-05-01 | 2025-08-01 | 2026-04-01, 2026-06-01, 2026-09-01 |
| `Microsoft.OperationalInsights/workspaces` | 2023-09-01 | 2025-07-01 | 2026-03-01 |
| `Microsoft.Insights/components` | 2020-02-02 | 2020-02-02 | – (neueste stabile) |
| `Microsoft.Web/serverfarms`, `Microsoft.Web/sites` | 2023-12-01 | 2025-03-01 | 2025-05-01 … 2026-08-01 |
| `Microsoft.Web/staticSites` | 2023-12-01 | 2025-03-01 | 2025-05-01 |
| `Microsoft.CognitiveServices/accounts` (`main.bicep` existing, `documentintelligence.bicep`) | 2024-10-01 | 2025-12-01 | 2026-03-01 und neuer |

Geänderte Dateien: `infra/main.bicep`, `infra/modules/{appinsights,cosmos,documentintelligence,functionapp,staticwebapp,storage}.bicep`. Keine Property-Änderungen.

**[Open]** `azureOpenAiApiVersion` (`2024-08-01-preview` in Bicep/Parameterdateien, Code-Default `2024-10-21`) ist eine Function-App-Einstellung, keine Ressourcen-API-Version. Nicht geändert; Abgleich Bicep/Code offen.

**[Open]** Nach `az bicep upgrade` (0.48.1, nicht ausgeführt) können die Versionen in der Spalte rechts angehoben werden.

## 2. Build

`az bicep build --file <f> --stdout` für `main.bicep` und alle sechs Module: Exit 0, keine Warnungen/Fehler (keine BCP081). Keine Ausgabe ins Repo geschrieben.

## 3. Lesendes `what-if` gegen Alpha

Ausführung: Subscription `dd7539ab-…` bestätigt (`az account show`), RG `rg-fittrack-alpha`, `alpha-fittrack.bicepparam`. Die drei Secrets sind lokal nicht gesetzt; für `what-if` wurden Platzhalter nur im Prozess gesetzt und danach entfernt, daher sind Secret-App-Settings nicht aussagekräftig.

| Stand | Modify | NoChange | Create/Delete (Ressource) |
|---|---|---|---|
| HEAD-Templates (Baseline) | 3 | 24 | 0 |
| Geänderte Templates | 4 | 23 | 0 |

Kein Delete/Recreate bestehender Ressourcen → kein Stoppfall.

Property-Diffs:
- Bestand (auch in Baseline): Function App `functionAppConfig.deployment.storage.value` Modify sowie `siteConfig.cors`/`localMySqlEnabled`/`minTlsVersion`/`netFrameworkVersion` Create; Static Web App `deploymentAuthPolicy`/`provider`/`stableInboundIP`/`trafficSplitting` Delete (Server-/Default-Rauschen); Cosmos `sqlEndpoint` Delete.
- Neu durch API-Anhebung: Cosmos-Account `defaultPriorityLevel`, `enablePerRegionPerPartitionAutoscale`, `enablePriorityBasedExecution`, `perPartitionAutomaticFailoverEnabled` Delete (live gelesen: `High`, `false`, `false`, `null` = Serverdefaults); Storage-Account `staticWebsite` Delete (schreibgeschützter Endpunkt). Alle Rauschen, keine Funktionsänderung erwartet.
- Runtime `node`/`24` unverändert.

Vor dem Apply `what-if` mit echten Secrets erneut ausführen und das Function-App-Diff (`deployment.storage.value`) prüfen.

## 4. Temporäre Dateien

| Datei | Befund | Entscheidung |
|---|---|---|
| `infra/modules/.cosmos-community-dev-deployment.tmp.bicep` | getrackt (`git ls-files`); keine Referenz in Code, Skripten, Docs (nur Planhinweis „nicht verwenden“ in `PLAN_Node24-Flex-Migration.md`); Inhalt: Einmal-Deployment `recipes`/`communityRecipes` auf existierendes Cosmos-Konto, vollständig in `cosmos.bicep` enthalten | **entfernt** (Dateisystem; Löschung noch nicht gestaged/committet) |
| `infra/parameters/.cosmos-dev-deployment.tmp.json` | getrackt; unreferenziert; Parameter für das Legacy-Konto `cosmos-fittrack-dev-ppf5sc` (northeurope) | **entfernt** |

## 5. Hinweis

Ein Apply (`az deployment group create`) erfolgt als separater Auftrag nach QA und unter dem Deploy-Gate (`.github/instructions/infra-release.instructions.md`).

## Dokumentation

Geändert, weil sich Fakten änderten: `infra/README.md` (Abschnitt „Bicep API Versions“), `docs/kb/tech/07-infrastructure.md` (eine Zeile mit den Versionen).
