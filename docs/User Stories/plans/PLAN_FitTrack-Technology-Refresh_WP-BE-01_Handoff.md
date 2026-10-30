# WP-BE-01 Handoff — Node, Backend-Produktions-SDKs und AI-Verträge

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-01, AC-1/AC-2/AC-3/AC-8
- Erstellt: 2026-10-30, nachträglich (AC-20). Quelle ausschließlich Repository-Stand (Manifeste, Lockfiles, `git diff HEAD`) und Läufe vom 2026-10-30; kein Vorwissen aus der Umsetzung.
- Umgebung: Windows x64, Node `24.22.1`, npm `12.2.1`; Branch `chore/fittrack-technology-refresh-phase-0`, zum Zeitpunkt des Handoffs nicht committet (Diff gegen HEAD `23e92ff`); Stand 2026-10-30: committet in `bce9fe6`, `2763b20`, `cea53b6` und nach `origin/chore/fittrack-technology-refresh-phase-0` gepusht.
- Status: lokal belegt, Teile `UNVERIFIED` (siehe unten).

## Node/npm-Pins

| Datei | Vorher (HEAD) | Jetzt |
|---|---|---|
| `package.json`, `backend/package.json`, `_deploy_staging/package.json` `engines` | `node >=24.0.0`, `npm >=10.0.0` | `node >=24.22.1 <25`, `npm 12.2.1` |
| `package.json` | – | `packageManager: npm@12.2.1`; `allowScripts` (`@napi-rs/canvas`, `esbuild`, `protobufjs`: `false`) |
| `.nvmrc` (neu, untracked) | – | `24.22.1` |
| `.github/workflows/ci.yml` | `node-version: 24` | `node-version-file: .nvmrc` plus Schritt `npm install -g npm@12.2.1` in allen Jobs mit Install |
| Override `fflate: 0.7.5` (Root und Staging) | vorhanden | entfernt (Satori entfällt, siehe WP-BE-02) |

## Aktualisierte Produktions-SDKs (Manifest vorher → jetzt; aufgelöst in `package-lock.json` und `_deploy_staging/package-lock.json`, identisch)

| Paket | Vorher | Manifest jetzt | Aufgelöst |
|---|---|---|---|
| `openai` | `^4.104.0` | `^7.45.1` | 7.45.1 |
| `zod` | `^3.25.76` | `^4.6.7` | 4.6.7 |
| `@azure/cosmos` | `^4.1.1` | `^4.10.1` | 4.10.1 |
| `@azure/functions` | `^4.5.0` | `^4.17.0` | 4.17.0 |
| `@azure/storage-blob` | `^12.25.0` | `^12.34.0` | 12.34.0 |
| `@azure/storage-queue` | `^12.30.0` | `^12.32.0` | 12.32.0 |
| `jose` | `^6.2.3` | `^6.2.14` | 6.2.14 |
| `@azure/ai-form-recognizer` | `^5.1.0` | unverändert | 5.1.0 (siehe WP-BE-06) |
| `sharp` | `^0.35.5` | unverändert | 0.35.5 |

Renderer-Wechsel (`@resvg/resvg-js`, `satori` → `@napi-rs/canvas ~1.0.13`) gehört zu WP-BE-02 und steht nur der Vollständigkeit halber im selben Manifest-Diff.

## Breaking Changes und Anpassungen im Code

- **openai 4 → 7:** Importe `AzureOpenAI` und `openai/resources/chat/completions/completions` bleiben; Clients werden über `createAzureOpenAiClientOptions()` erzeugt (siehe WP-BE-06). Strict-Schemas und Prompts nicht geändert (`git diff HEAD -- backend/src/lib/prompts/` zeigt nur `recipeAnalyze.eval.fixtures.ts`, Testfixture).
- **zod 3 → 4:** Neu `backend/src/lib/zodCompat.ts` (+ `zodCompat.test.ts`) stellt Zod-3-Meldungstexte und Issue-Codes wieder her, weil beide Teil des HTTP-Fehlervertrags sind; eingebunden in `backend/src/lib/http.ts` (`legacyIssueCode(issue)`). `z.string().uuid()` → `z.guid()` in `backend/src/functions/ai.ts` (Begründung nicht im Repository dokumentiert; vermutlich Erhalt der lockeren Zod-3-UUID-Prüfung, `UNVERIFIED`). Weitere kleine Anpassungen in `dailyInsight.ts`, `instagramRecipe.ts`, `recipes.ts`, `dailyInsightValidation.ts`, `recipeAnalyzeValidation.ts`, `recipeHttp.ts` (20 Zeilen +/13 −, siehe Diff).
- **Offen (UNVERIFIED):** Die Zod-Charakterisierungstests aus Phase 0 sind grün (Backend-Suite, siehe unten); ob jede Fehlermeldung bytegleich zu Zod 3 ist, belegt nur der Testumfang, nicht eine vollständige Äquivalenzprüfung aller Routen.

## Nachweise (2026-10-30, lokal)

| Prüfung | Befehl (cwd) | Exit | Ergebnis |
|---|---|---:|---|
| Typecheck backend/shared/mobile | `npm run typecheck` (Root) | 0 | 0 Fehler |
| Backend-Tests | `npm run test` (`backend`) | 0 | 84 Dateien / 2.709 Tests, 0 failed, 0 skipped |
| Offline-AI-Verträge (Wire-Tests) | Teil der Backend-Suite (`openai.wire.test.ts`, `documentIntelligence.wire.test.ts`, `reusableItemsEnrich.wire.test.ts`) | 0 | in den 2.709 enthalten |
| Build | `npm run build:verify` (`backend`) | 0 | "All checks passed" |
| Startup-Tests | `npm run test:startup` (`backend`) | 0 | 28 pass, 0 fail |
| Functions-Smoke | `npm run test:functions-smoke` (`backend`) | 0 | `/api/health` 200, `/api/diary/meals` ohne Token 401, 79 Registrierungen = Baseline |
| Staging-Produktionsaudit | `npm audit --omit=dev` (`_deploy_staging`) | 0 | 0 Vulnerabilities |
| Staging-Graph | `npm ls --all` (`_deploy_staging`) | 0 | ohne Problem |
| Root-Graph | `npm ls --all` | 0 | ohne Problem |
| Prompt-Evals | `npm run test:eval` (`backend`) | 0 | 5 Dateien / 61 Tests passed; siehe Hinweis |

**Hinweis Prompt-Evals:** `run-eval.mjs` liest `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_API_KEY` aus `backend/local.settings.json`; beide waren gesetzt (Werte nicht ausgegeben). Der Lauf am 2026-10-30 hat daher mit hoher Wahrscheinlichkeit gegen den konfigurierten Azure-OpenAI-Endpunkt gerechnet (Laufzeit 136 s). Ob alle 61 Tests live oder teils per Fixture liefen, wurde nicht einzeln geprüft. Bewertung: bestanden, Live-Charakter `UNVERIFIED`.

## Offen / UNVERIFIED

- Cosmos-Contract-Tests (`test:contract`) lokal nicht ausgeführt (Emulator fehlt); CI-Ergebnis vom Product Owner freigegeben, nicht unabhängig belegt (QA-Bericht Phase 0).
- Linux-/CI-Lauf auf dem aktuellen Stand fehlt (PO-5, Abschnitt 20 Schritt 7b).
- Welche zwei Produktionsadvisories ursprünglich gemeint waren (AC-2), lässt sich aus dem Repository nicht rekonstruieren; belegt ist nur der heutige Stand `npm audit --omit=dev` = 0.
- Keine Datenflussänderung durch dieses Paket erkennbar (gleiche Endpunkte, gleiche Nutzdaten); formale `privacy-impact-review` ist nicht dokumentiert (`UNVERIFIED`).
