# WP-BE-05 Handoff — TypeScript-7-Migration

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-05 (Abschnitt 12), AC-3/AC-7/AC-8
- Prüfdatum: 2026-10-29, lokal Windows x64, Node `24.22.1`, npm `12.2.1`
- Stand: Arbeitsverzeichnis auf Branch `chore/fittrack-technology-refresh-phase-0`, zum Zeitpunkt des Handoffs nicht committet; Stand 2026-10-30: committet in `bce9fe6`, `2763b20`, `cea53b6` und gepusht
- Status (Update 2026-10-30): **PASS-reif lokal** — der Expo-Blocker ist gelöst durch WP-FE-01 (Expo SDK 58, Product-Owner-Entscheidung 2026-10-29, Option 2), siehe [WP-FE-01 Handoff](PLAN_FitTrack-Technology-Refresh_WP-FE-01_Handoff.md). Planabweichung: WP-BE-05 zusammen mit WP-FE-01 abgeschlossen.
- Status (Stand 2026-10-29, historisch): BLOCKIERT (Mobile/Expo), `smoke:bundle` scheiterte unter Expo SDK 54.

## TypeScript-Version

| Punkt | Ergebnis |
|---|---|
| Registry (`npm view typescript version`) | `7.0.2` (`latest`) |
| Installiert | `typescript@^7.0.2` (aufgelöst `7.0.2`) in `backend`, `shared`, `mobile`, `tools/off-import` |
| Vorher | `^5.8.0` (backend, mobile), `^5.4.0` (off-import), `5.9.3` im Lockfile; `shared` hatte keinen eigenen Eintrag (kam per Hoisting) |
| Neu: `shared` | `typescript` als devDependency, da TS 7 nicht mehr hoisted wird und `tsc` sonst in `shared` fehlt |
| Neu: `@typescript/typescript6@~6.0.2` | Korrektur 2026-10-30: bleibt devDependency in `mobile` (AST-Test `nutritionDiaryMutationBoundary.test.ts`) **und** in `backend` (`scripts/functions-baseline.mjs` importiert `ts` weiterhin für `createSourceFile` und `ts.is*`-Prüfungen). Die frühere Aussage "aus `backend` entfernt, Skript nutzt die TS-API nicht mehr" war falsch; die Deklaration wurde im Backend-Manifest wieder ergänzt (PO-Entscheidung: jedes Workspace deklariert, was es importiert) |
| Lockfile | Native Plattformpakete `@typescript/typescript-*@7.0.2` für alle Plattformen enthalten (u. a. `linux-x64`, `win32-x64`) |

## Geänderte Compiler-Optionen

| Datei | Änderung | Grund |
|---|---|---|
| [backend/tsconfig.json](../../../backend/tsconfig.json) | `moduleResolution`: `node` → `bundler` | `node10` entfernt (TS5108). `node16` scheitert (ESM-only `jose`, Endungspflicht), `bundler` mit `module: commonjs` ist erlaubt und ändert den Emit nicht |
| [backend/tsconfig.json](../../../backend/tsconfig.json) | `baseUrl` entfernt | Option entfernt (TS5102); `paths` sind bereits relativ zur tsconfig (`../shared/...`), Auflösung unverändert |
| [tsconfig.base.json](../../../tsconfig.base.json) | `types: ["node"]` ergänzt | TS 7 bindet `@types/*` nicht mehr automatisch ein (shared, mobile, off-import, Backend nutzen Node-Globals/`node:*`) |
| [tools/off-import/tsconfig.json](../../../tools/off-import/tsconfig.json) | `rootDir: "../.."` ergänzt | TS 7 setzt `rootDir` standardmäßig auf das tsconfig-Verzeichnis (TS6059); ältere Vorgabe war der gemeinsame Wurzelordner. Das Paket läuft über `tsx`, es wird nichts emittiert |

Quelländerung: [render.ts](../../../backend/src/lib/instagramRenderer/render.ts) `type SharpFactory = typeof import("sharp")` statt `...("sharp").default` (TS2694; identischer Funktionstyp, Laufzeit unverändert).

Unverändert: `strict`, `target`, `lib`, `module` (Backend `commonjs`), `paths`, `jsx`, `skipLibCheck`, `esModuleInterop`.

## Breaking-Change-Liste (für dieses Repo relevant)

1. `moduleResolution: node` (node10) entfernt → `bundler`.
2. `baseUrl` entfernt → `paths` relativ zur tsconfig.
3. `types` standardmäßig leer (kein Auto-Include von `@types/*`) → `types: ["node"]`.
4. `rootDir` standardmäßig tsconfig-Verzeichnis → explizit in off-import (Backend hatte bereits `rootDir: ".."`).
5. `typeof import("x").default` für `export =`-CJS-Module nicht mehr gültig unter `module: commonjs`.
6. Klassische Compiler-JS-API (`require('typescript')`: `createSourceFile`, `ts.sys`, `ScriptTarget` …) existiert nicht mehr; `typescript` wird nicht mehr hoisted (jedes Workspace-Paket braucht eine eigene Abhängigkeit).
7. `tsc` ist ein nativer Binary (Plattformpakete als optionale Abhängigkeiten); `npx tsc` ohne installierte Abhängigkeit schlägt vor, ein fremdes Paket `tsc` zu installieren (nicht bestätigen).

## Nachweise (lokal, Windows x64, Node 24.22.1, npm 12.2.1)

| Prüfung | Befehl | Exit | Ergebnis |
|---|---|---|---|
| Typecheck Backend | `npm run typecheck --workspace=backend` (`tsc --noEmit`) | 0 | 0 Fehler |
| Typecheck Shared | `npm run typecheck --workspace=shared` | 0 | 0 Fehler |
| Typecheck Mobile | `npm run typecheck --workspace=mobile` | 0 | 0 Fehler |
| Typecheck off-import | `npx tsc --noEmit -p .` in `tools/off-import` | 0 | 0 Fehler (kein npm-Script vorhanden) |
| Build | `npm run build:verify --workspace=backend` | 0 | "All checks passed"; 181 emittierte `.js`-Dateien bytegleich zum vorherigen `dist` (0 Abweichungen) |
| Shared-Tests | `npm test --workspace=shared` | 0 | 10 Dateien, 466 Tests |
| Backend-Tests | `npm test --workspace=backend` | 0 | 84 Dateien, 2.709 Tests |
| Mobile-Tests | `npm test --workspace=mobile` | 0 | 108 Dateien, 1.002 Tests |
| Parität | `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS shared 10/466, backend 84/2709 (Minimum 77/1944), mobile 108/1002 (Minimum 106/993) |
| Skript-Tests | `npm run test:scripts` | 0 | 27 pass, 0 fail |
| Startup-Tests | `npm run test:startup --workspace=backend` | 0 | 28 pass, 0 fail (nach Umstellung von `functions-baseline.mjs`, davor 1 Fail) |
| Encoding | `npm run check:encoding` | 0 | passed |
| Root-Graph | `npm ls --all` | 0 | kein Problem |
| Staging-Graph | `npm ls --all` in `_deploy_staging` | 0 | kein Problem |
| Staging-Audit | `npm audit --omit=dev` in `_deploy_staging` | 0 | 0 Vulnerabilities |
| Root-Audit | `npm audit` | 1 | 27 Findings (11 low, 12 moderate, 4 high), identisch zum Stand vor TS 7; kein TypeScript-Bezug, Zuordnung WP-BE-03/O-2/WP-FE-01 |
| Lockfile | `npm ci --dry-run` (Root) | 0 | konsistent, "up to date" |
| ~~Expo-Bundle (SDK 54)~~ | `npm run smoke:bundle --workspace=mobile` | 1 | historisch: `TypeError ... getCurrentDirectory` in `@expo/cli` 54 |
| **Expo-Bundle (SDK 58), Update 2026-10-30** | `npm run smoke:bundle --workspace=mobile` | **0** | Android-Bundle (`.hbc`, 5,9 MB) exportiert mit `typescript@7.0.2`, `expo@58.0.21`, `@expo/cli@58.1.17` |
| Re-Check 2026-10-30 | Typecheck backend/shared/mobile/off-import, `build:verify`, Vitest (JSON), `test:scripts`, `test:startup`, `check:encoding`, `npm ls --all`, `npm ci --dry-run` | 0 | Paritaet PASS: shared 10/466, backend 84/2709, mobile 108/1002; scripts 27 pass, startup 28 pass |

## Kompatibilität

| Toolchain | Ergebnis |
|---|---|
| Vitest 5 | OK. Alle Tests laufen (esbuild/Oxc transpiliert, TS wird nur für Typen genutzt) |
| tsx 4.23.15 (off-import) | OK, `tsx -e` mit Import läuft. Vollständiger Lauf der Skripte (`analyze:off` usw.) nicht ausgeführt (benötigen Daten/Cosmos) |
| Expo SDK 54 / `@expo/cli 54.0.26` | war blockiert (historisch), durch SDK 58 gelöst |
| Expo SDK 58 / `@expo/cli 58.1.17` | OK: Bundle-Smoke grün mit TS 7; `@expo/cli` 58 ruft `ts.sys.getCurrentDirectory` nicht mehr auf (Textsuche im installierten Build ohne Treffer) |
| `babel-preset-expo 58.0.22` | OK: Typen werden von Babel gestrippt, Metro-Bundle grün |
| `expo/tsconfig.base` | Wird nur von der Root-[tsconfig.json](../../../tsconfig.json) genutzt (Editor-Fallback); `mobile/tsconfig.json` erweitert `../tsconfig.base.json`. Typecheck mobile grün; die Root-Datei wurde nicht mit TS 7 geprüft |
| Editor | `.vscode/settings.json` setzt kein `typescript.tsdk`; VS Code nutzt seinen eigenen TS-Server. Nutzung von TS 7 im Editor nicht geprüft (UNVERIFIED) |

## Blocker — GELÖST (2026-10-30, Option 2: Expo SDK 58)

Nachfolgend die ursprüngliche Analyse (historisch). Umgesetzt wurde Option 2; Details und Nachweise im [WP-FE-01 Handoff](PLAN_FitTrack-Technology-Refresh_WP-FE-01_Handoff.md). Keine Overrides, kein TS-6-Alias für `typescript` in mobile.

`@expo/cli` 54 lädt über `resolve-from(projectRoot, 'typescript')` das Paket `typescript` aus `mobile/` und ruft `ts.sys.getCurrentDirectory` auf (`utils/tsconfig/evaluateTsConfig`, aufgerufen von `loadTsConfigPathsAsync` beim Metro-Start). TS 7 exportiert die klassische API nicht. Folge: `expo export`/`expo start` und damit Bundle-Smoke und vermutlich EAS-Builds scheitern, solange `mobile` `typescript@7` auflöst. Die Prüfung ist optional (`importTypeScriptFromProjectOptionally`), greift aber, sobald ein `typescript`-Paket gefunden wird.

Lösungsoptionen für den Orchestrator (nicht umgesetzt, jede ist eine Abweichung vom Plan):

1. Mobile bleibt auf einer TS-6-kompatiblen Linie (z. B. `typescript` als Alias auf `@typescript/typescript6`), Backend/shared/off-import auf TS 7.
2. Expo-Upgrade auf eine Version mit TS-7-Unterstützung (widerspricht "keine anderen Dependency-Upgrades"; Version nicht geprüft).
3. TS 7 in `mobile` nur für `tsc`, Expo-Auflösung über ein Override auf TS 6 (vom Auftrag ausgeschlossen: Overrides zum Kaschieren).

## Abweichungen und Hinweise

- **Zusätzliche Abhängigkeit `@typescript/typescript6@~6.0.2`** (backend, mobile): nötig, weil [nutritionDiaryMutationBoundary.test.ts](../../../mobile/src/services/nutritionDiaryMutationBoundary.test.ts) und [functions-baseline.mjs](../../../backend/scripts/functions-baseline.mjs) die AST-API von `typescript` nutzen. Nur der Import wurde umgestellt; Tests und Assertions sind unverändert. Alternative wäre ein Parser-Wechsel (z. B. `@babel/parser`), das wäre eine Testumschreibung.
- `backend/tsconfig.test.json` (nicht Teil von `typecheck`/`build`): 59 Typfehler unter TS 7 gegenüber 68 unter TS 5.9.3 (mit `moduleResolution: node`) in Testdateien; vorbestehend, nicht verschärft, nicht behoben.
- Skripte in `docs/…/*.mjs` mit `require('typescript')` sind einmalige QA-Verifikationsskripte und mit TS 7 nicht mehr lauffähig; nicht angepasst.
- `tools/off-import/package-lock.json` enthält weiterhin TS 5.9.3 (Workspace-Lockfile, wird von Root-Lockfile überlagert); nicht angepasst.
- Die Paritätsbaseline [test-baseline.json](../../../scripts/test-baseline.json) war zum Zeitpunkt des Handoffs niedriger als der Ist-Stand (backend 77/1944, mobile 106/993) und unverändert; aktualisiert 2026-10-30: angehoben auf shared 10/466, backend 84/2.709, mobile 108/1.002 (siehe WP-BE-08-Handoff).
- KB (`02-backend.md`, `08-testing.md`) erwähnt TS-Version nicht angepasst; Aktualisierung gehört zu WP-BE-04.
- Der Arbeitsbaum enthielt zum Zeitpunkt des Handoffs ungetrackte/unkommittete Änderungen anderer Pakete; es wurde nichts zurückgesetzt oder committet (inzwischen committet und gepusht, siehe Kopfzeile).

## Offene Punkte

1. ~~Planrevision zum Expo-Blocker~~ — erledigt (WP-FE-01, SDK 58); `smoke:bundle`, `smoke:manifest`, `smoke:doctor` am 2026-10-30 grün.
2. Linux/CI-Lauf mit TS 7 (native `typescript-linux-x64` ist im Lockfile, aber nicht ausgeführt).
3. Editor-Tooling mit TS 7 (`typescript.tsdk`) durch den Product Owner prüfen.
4. Optional: `tsconfig.test.json`-Fehler bereinigen.
