# WP-BE-06 Handoff — Azure-AI-Plattform-Lebenszyklus

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-06, AC-3/AC-10
- Erstellt: 2026-10-30, nachträglich (AC-20). Quelle: Repository-Stand (Code-Suche, `git diff HEAD`, KB-Datei [06-ai-integrations.md](../../kb/tech/06-ai-integrations.md)), `npm view` und Läufe vom 2026-10-30. Es gab in dieser Sitzung **keinen** Zugriff auf Microsoft-Seiten; Microsoft-Aussagen sind nur als Zitat der KB (Stand 2026-10-29) übernommen und gelten `UNVERIFIED`.
- Branch `chore/fittrack-technology-refresh-phase-0`, nicht committet.

## Einheitliche Konfigurationsquelle (belegt)

[backend/src/lib/azureOpenAiConfig.ts](../../../backend/src/lib/azureOpenAiConfig.ts) (neu, untracked) ist die einzige Quelle:

- `DEFAULT_AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4.1-mini'`, `DEFAULT_AZURE_OPENAI_API_VERSION = '2024-10-21'`; Env-Namen unverändert (`AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION`).
- `getAzureOpenAiDeploymentName()`, `getAzureOpenAiApiVersion()`, `createAzureOpenAiClientOptions()` (wirft, wenn Endpoint oder Key fehlen).
- Genutzt in `openai.ts` (alle Deployment-Zugriffe plus Client), `labelParser.ts`, `reusableItemsEnrich.ts`, `dailyInsight.ts`, `weeklyInsight.ts`, Eval-Hilfen (`weeklyInsightEvalSemantics.ts`, `dailyInsight.eval.test.ts`, `recipeAnalyze.eval.test.ts`).
- Test: [azureOpenAiConfig.test.ts](../../../backend/src/lib/azureOpenAiConfig.test.ts) prüft Defaults und Env-Überschreibung. Strict-Schemas und Prompts unverändert (`git diff HEAD -- backend/src/lib/prompts/` nur Testfixture).
- `backend/local.settings.json.template`: `AZURE_OPENAI_DEPLOYMENT_NAME` `gpt-4o-mini` → `gpt-4.1-mini` (API-Version dort weiter `2024-08-01-preview`).

## Code-Suche: Fallbacks und API-Version (Stand 2026-10-30)

| Suche | Ergebnis |
|---|---|
| `gpt4o-mini` / `gpt-4o-mini` in Produktionscode (`backend/src`, `shared`, ohne Tests) | **Keine Fallbacks mehr.** Einziger Treffer: Kommentar `shared/types/insight.ts:229` (`e.g. "gpt-4o-mini"`) |
| dieselben Strings in Tests | Nur als Beispielwert des Feldes `model` in Testdaten (`dailyInsight.test.ts`, `dailyInsightFeedback.test.ts`, `weeklyInsight.test.ts`, `lib/weeklyInsight.test.ts`, `insightRepository.test.ts`, `cosmosInsightRepository.contract.test.ts`, `weeklyInsightEvalSemantics.test.ts`); kein Konfigurationszugriff |
| `2024-07-01` im Backend | **Kein Code-Fallback mehr.** Nur als explizit gesetzte Test-Env in `openai.wire.test.ts` und `reusableItemsEnrich.wire.test.ts` |
| veraltete Dokumentation | `.github/skills/azure-openai-feature-integration/SKILL.md` (Zeilen 57–58: Default `gpt4o-mini`, `2024-07-01`) und `references/implementation-checklist.md` (Zeile 87); `docs/kb/product/01-product-philosophy.md:47` ("Azure gpt-4o-mini"). **Nicht geändert** (nicht Teil des Auftrags), als Korrekturbedarf gemeldet |
| deployte API-Version | `2024-08-01-preview` in `infra/main.bicep`, `infra/modules/functionapp.bicep` und allen `infra/parameters/*.bicepparam` (Dev/Alpha); Bicep ist nicht Teil dieses Pakets, **keine Änderung**. Der Code-Default `2024-10-21` greift nur, wenn die Env-Variable fehlt |

## Document Intelligence

- Code: `backend/src/lib/documentIntelligence.ts` nutzt `DocumentAnalysisClient`/`AzureKeyCredential` aus `@azure/ai-form-recognizer` und `beginAnalyzeDocument('prebuilt-read', …)`; die Datei ist gegenüber HEAD **unverändert**.
- Registry (`npm view`, 2026-10-30): `@azure/ai-form-recognizer` `latest` = `5.1.0` (installiert 5.1.0), kein `deprecated`-Feld. `@azure-rest/ai-document-intelligence` existiert (`1.1.0`, zuletzt geändert 2026-02-11). `@azure/ai-document-intelligence` existiert nicht (404).
- Entscheidung laut KB: SDK beibehalten, kein Wechsel; Abdeckung durch `documentIntelligence.wire.test.ts` (Fake-HTTP, `api-version=2023-07-31` im Testserver) und Label-Parser-Tests.
- **UNVERIFIED:** Microsoft-Support-/Lebenszyklusstatus des SDK (nur npm-Metadaten belegt, keine Microsoft-Aussage in dieser Sitzung).

## Abkündigung `gpt-4.1-mini`

- KB nennt (Abruf 2026-10-29, Quelle Microsoft-Learn-Seiten): Stufe "Deprecated", Retirement `2027-04-14`, SKU-Zuordnung zu `GlobalStandard` ist Annahme; Folgeaufgabe mit Fristen 2026-12-31 / 2027-02-15 / 2027-03-15 steht als `[Planned]` in `docs/kb/tech/06-ai-integrations.md`.
- **UNVERIFIED in dieser Sitzung:** Termin nicht erneut gegen Microsoft geprüft. Kein Modellwechsel (E-3).
- Offen: Support-Status der deployten Preview-Version `2024-08-01-preview` (KB: kein Retirement-Datum gefunden, `UNVERIFIED`); Umstellung auf GA ist Infra-Entscheidung `[Open]`.

## Nachweise (2026-10-30)

| Prüfung | Befehl (cwd) | Exit | Ergebnis |
|---|---|---:|---|
| Backend-Tests inkl. Wire-/Config-Tests | `npm run test` (`backend`) | 0 | 84 Dateien / 2.709 Tests |
| Typecheck | `npm run typecheck` (Root) | 0 | 0 Fehler |
| Build | `npm run build:verify` (`backend`) | 0 | "All checks passed" |
| Prompt-Evals | `npm run test:eval` (`backend`) | 0 | 5 Dateien / 61 Tests passed; Zugangsdaten in `local.settings.json` waren gesetzt, Lauf wahrscheinlich live gegen Azure OpenAI (136 s). Live-Charakter nicht einzeln belegt, daher `UNVERIFIED` |

## Privacy-Impact-Aussage (Skill `privacy-impact-review`, kein Rechtsrat)

- Keine neuen Datenkategorien, Endpunkte oder Empfänger im Code erkennbar: gleiche Azure-OpenAI- und Document-Intelligence-Aufrufe, nur Konfigurationsauflösung zentralisiert. Der Default-Deployment-Name ändert sich nicht gegenüber der deployten Konfiguration (Env explizit gesetzt laut KB).
- Verarbeitungsort/Region: KB nennt `GlobalStandard` ("processing is not limited to Europe", `docs/kb/tech/07-infrastructure.md`); ob [datenschutzerklaerung-alpha.md](../../legal/datenschutzerklaerung-alpha.md) das abdeckt, wurde in dieser Sitzung **nicht geprüft** (`UNVERIFIED`). Keine Änderung an der Erklärung vorgenommen.
