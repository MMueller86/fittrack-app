# WP-BE-07 Handoff — CI-Aktualisierung, Dependabot, Dependency-Anhebung (F-02/F-04)

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-07, AC-11; QA-Bericht `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Findings.md` (F-01..F-04)
- Datum: 2026-10-30; Windows x64, Node `24.22.1`, npm `12.2.1`; kein Commit, kein Push, kein Deploy, keine Evals, keine Azure-Operation.
- Der Plan wurde nicht geändert.

## Änderungen

| Datei | Änderung |
|---|---|
| `.github/workflows/ci.yml` | Actions auf `checkout@v7`, `setup-node@v7`, `cache@v6`, `setup-java@v6`; Core Tools 4.9.0 → 4.16.0 (inkl. Cache-Key); Cosmos-Emulator `vnext-preview` → `vnext-EN20261019`; neuer Job `staging-linux-renderer-smoke` |
| `.github/dependabot.yml` | neu: npm `/` (Workspaces) und `/_deploy_staging`, github-actions; wöchentlich; Gruppe `expo-sdk`, Majors getrennt. Docker weggelassen (kein Dockerfile im Repo) |
| `backend/scripts/staging-renderer-smoke.mjs` + `.test.mjs` | Renderer-Smoke gegen den Staging-Install (1080x1350, nichtleer, `@napi-rs/canvas` muss aus `_deploy_staging/node_modules` kommen); Test in `test:startup` aufgenommen, Script `smoke:staging-renderer` |
| `backend/package.json` | Scripts `smoke:staging-renderer`, `test:startup` (+1 Datei) |
| `docs/kb/tech/08-testing.md` | nur CI-Fakten: Core Tools 4.16.0, neuer Job, Emulator-Tag, Dependabot |
| `docs/kb/tech/07-infrastructure.md` | unverändert (keine CI-Fakten betroffen) |

Job `staging-linux-renderer-smoke` (ubuntu-latest): `npm ci`, `build:verify`, `dist` nach `_deploy_staging/dist`, `npm ci --omit=dev` (Staging), `npm audit --omit=dev` (blockierend), Renderer-Smoke, danach Root-`npm audit` mit `continue-on-error` (Kommentar nennt Ausnahmen PO-1/PO-2). Node kommt aus `.nvmrc` (`24.22.1`).

## Quellen (abgefragt 2026-10-30, GitHub-API `releases/latest` und MCR-Registry; `fetch_webpage` stand nicht zur Verfügung)

| Gegenstand | Beleg |
|---|---|
| `actions/checkout` | `v7.0.1` (2026-07-20) |
| `actions/setup-node` | `v7.1.0` (2026-10-08) |
| `actions/cache` | `v6.1.0` (2026-06-26) |
| `actions/setup-java` | `v6.1.0` (2026-10-14) |
| `actions/upload-artifact` | `v7.0.2`; wird im Workflow nicht verwendet |
| Cosmos-Emulator | MCR-Tag-Liste: `vnext-EN20261019` (nicht `pre`) hat denselben Digest (`sha256:db53613d…`) wie `vnext-latest` und aktuell `vnext-preview`; `vnext-EN20261029pre` ist neuer, aber Preview. 2.14.x ist die ältere HTTPS-Linie, nicht Ziel der Tests |
| Core Tools | `npm view azure-functions-core-tools dist-tags`: `latest` = `4.16.0` |

## Core-Tools-Simulation

`npm install --global --prefix <tmp> --allow-scripts=azure-functions-core-tools azure-functions-core-tools@latest` → Exit 0 (30 Pakete), `func --version` = `4.16.0` (Exit 0); `<tmp>` gelöscht (`Test-Path` = False). Gilt für Windows; der Linux-Download des `func`-Binärs ist lokal nicht prüfbar (`UNVERIFIED`).

## Dependency-Anhebung (F-02)

Vom Vorgänger geändert und von mir verifiziert (`npm outdated`, `npm ci --dry-run`, `npm ls --all`):

| Paket | Vorher | Nachher | Wo |
|---|---|---|---|
| `@napi-rs/canvas` | `~1.0.13` | `~1.1.0` (installiert 1.1.0) | backend, `_deploy_staging` |
| `@tabler/icons` | `~3.46.0` | `~3.50.0` | backend, `_deploy_staging` |
| `lucide-static` | `~1.46.0` | `~1.65.0` | backend, `_deploy_staging` |
| `pixelmatch` | `~7.2.0` | `~8.0.0` (installiert 8.0.0) | backend (dev) |
| `axios` | `^1.8.4` | `^1.21.0` | mobile |
| `react-native-health-connect` | `^4.1.2` | `^4.1.3` | mobile |
| `zustand` | `^5.0.3` | `^5.0.16` | mobile |

Nicht angehoben (Stand `npm outdated` 2026-10-30):

| Paket | Ist → Latest | Grund |
|---|---|---|
| `@react-native-async-storage/async-storage` | 2.2.0 → 3.1.1 | Expo-verwaltet, `expo install --check` ("Dependencies are up to date") |
| `react` | 19.3.0 → 19.3.1 | Expo-SDK-58-Pin |
| `react-test-renderer` | 19.3.0 → 19.3.1 | muss zur `react`-Version passen (19.3.0) |
| `react-native-gesture-handler` | 3.3.0 → 3.4.0 | Expo-verwaltet (`~3.3.0`) |
| `react-native-safe-area-context` | 5.10.1 → 5.11.0 | Expo-verwaltet (`~5.10.1`) |
| `react-native-worklets` | 0.13.0 → 0.13.1 | Expo-verwaltet (`0.13.0`) |
| `@types/node` | 24.19.2 → 26.6.6 | Laufzeit ist Node 24 (`engines`, Azure Functions); Typen müssen zur Laufzeit passen (Stand 2026-10-30) |
| `@typescript/typescript6` | `~6.0.x` | bewusst (Vorgabe) |

Weitere direkte Abhängigkeiten (Root, shared, `tools/off-import`, `_deploy_staging`) waren laut `npm outdated` aktuell.

### Golden-/pixelmatch-Änderung (Bewertung)

`golden.test.ts`: `EXPECTED_HISTORICAL_DIFFERING_PIXEL_RATIO` 0.5602764… → 0.5945507…; `golden-metrics.md` entsprechend. Gates unverändert: `PIXELMATCH_THRESHOLD` 0.1, `MAX_DIFFERING_PIXEL_RATIO` 0.03, Toleranz 0.01. Ursache laut Kommentar: `pixelmatch` 8 misst im OKLab- statt YIQ-Abstand; der Renderer, die historische Golden-Datei und das Referenzkorpus sind unverändert. Bewertung: **kein Abschwächen** (Erwartungswert einer reinen Diagnose gegen ein bewusst abweichendes historisches Bild, kein Release-Gate; Toleranz nicht vergrößert). Referenzkorpus-Test und Golden-Test laufen grün. Die Angabe "7.2 maß 0,5639 auf demselben Bildpaar" habe ich nicht neu gemessen (kein Downgrade): `UNVERIFIED`.

## F-04: Vitest-Config

`poolOptions.forks.singleFork` → `maxWorkers: 1` + `isolate: false` in `backend/vitest.eval.config.mts` und `backend/vitest.contract.config.mts` (Vitest-4-Migrationsregel). `npx vitest list --config <je Datei>` Exit 0, keine `DEPRECATED`-Warnung. Evals und Contract-Tests wurden nicht ausgeführt.

## Prüfungen

| Prüfung | Befehl | Exit | Zahlen |
|---|---|---:|---|
| Install trocken | `npm ci --dry-run` (Root) | 0 | |
| Abhängigkeitsbaum | `npm ls --all` (Root / Staging) | 0 / 0 | |
| Staging-Install | `npm ci --omit=dev` (`_deploy_staging`) | 0 | |
| Staging-Audit | `npm audit --omit=dev` | 0 | 0 Findings |
| Root-Audit | `npm audit --json` | 1 (Findings) | 12 (5 low, 4 moderate, 3 high, 0 critical): nur PO-1 (`azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid`) und PO-2 (`expo`, `@expo/cli`, `zod`, `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `deepmerge`) |
| Typecheck | `npm run typecheck` | 0 | shared, backend, mobile |
| Backend-Tests | `npm test` (cwd `backend`) | 0 | 84 Dateien / 2.709 Tests |
| Shared-Tests | `npm test --workspace=shared` | 0 | 10 / 466 |
| Mobile-Tests | `npm test --workspace=mobile` | 0 | 108 / 1.002 |
| Parität | `node scripts/check-test-parity.mjs …` | 0 | alle gleich dem Minimum (10/466, 84/2.709, 108/1.002), keine Senkung |
| Skripttests | `npm run test:scripts` | 0 | 27 pass, 0 fail, 0 skipped |
| Startup-Tests | `npm run test:startup --workspace=backend` | 0 | 31 pass, 0 fail (vorher 28; +3 neue Smoke-Tests) |
| Build | `npm run build:verify --workspace=backend` | 0 | |
| Staging-Renderer-Smoke (Windows, lokal) | `node scripts/staging-renderer-smoke.mjs ..\_deploy_staging` | 0 | PNG 1.917.091 Bytes, 1080x1350 |
| Encoding | `npm run check:encoding` | 0 | |
| Mobile | `smoke:bundle` / `smoke:manifest` / `smoke:doctor` | 0 / 0 / 0 | Doctor 20/20 |
| Expo | `npx expo install --check` (mobile) | 0 | "Dependencies are up to date" |
| Prompt-Guard | `FITTRACK_PROMPT_GUARD_BASE=HEAD~2 npm run verify:daily-insight-prompt --workspace=backend` | 0 | v31, provider input changed: no |
| YAML | `js-yaml` lädt `ci.yml` (8 Jobs) und `dependabot.yml` (3 Einträge) | 0 | Syntax OK, kein Schema-Lauf |

## UNVERIFIED / offen

1. Kein CI-Lauf auf diesem Stand; alle neuen CI-Schritte (neue Action-Majors, Core Tools 4.16.0 auf Linux, Job `staging-linux-renderer-smoke`) sind lokal nicht auf Linux ausgeführt. Der Linux-Nachweis für F-01 (`@napi-rs/canvas` Linux-Binär, PNG 1080x1350) bleibt bis zum ersten CI-Lauf `UNVERIFIED`; lokal nur Windows.
2. Contract-Tests mit `vnext-EN20261019` nicht ausführbar (kein Docker lokal): `UNVERIFIED`.
3. Dependabot-Konfiguration nur syntaktisch geprüft; GitHub validiert sie erst nach dem Push.
4. `pixelmatch`-7.2-Vergleichswert (0,5639) nicht nachgemessen.
5. Die Ausnahmen PO-1/PO-2 bestehen weiter; bei Azurite-/Expo-Releases neu prüfen.
