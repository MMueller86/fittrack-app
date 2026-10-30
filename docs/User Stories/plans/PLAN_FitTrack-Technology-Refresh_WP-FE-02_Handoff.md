# WP-FE-02 Handoff — Navigation-Kette und Babel (inkl. WP-FE-03-Beleg)

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), Abschnitt 0 und 13a (WP-FE-02, WP-FE-03)
- Prüfdatum: 2026-10-30, lokal Windows x64, Node `24.22.1`, npm `12.2.1`; **nicht committet**
- Voraussetzung: [WP-FE-01 Handoff](PLAN_FitTrack-Technology-Refresh_WP-FE-01_Handoff.md)
- Status WP-FE-02: Findings behoben (Audit-Nachweis unten); Geräte-Checkliste Punkt App Link offen (MANUAL VALIDATION REQUIRED)
- Status WP-FE-03: Ausnahme dokumentiert (PO-2 = C), kein Override

## Änderungen

| Datei | Änderung |
|---|---|
| [mobile/package.json](../../../mobile/package.json) | `@react-navigation/native ^7.1.6` → `^7.5.1`; `bottom-tabs ^7.3.10` → `^7.21.0`; `native-stack ^7.3.10` → `^7.21.0` |
| [package-lock.json](../../../package-lock.json) | Minimal, per `npm install … --workspace=mobile` und `npm update @babel/core`; kein Override, kein `--force`, kein Downgrade, keine weiteren Manifeständerungen |

Lockfile-Diff (Paketversionen, aus Vergleich vor/nach):

| Paket | Vorher | Nachher |
|---|---|---|
| `@react-navigation/native` | 7.2.2 | 7.5.1 |
| `@react-navigation/core` | 7.17.2 | 7.24.0 |
| `@react-navigation/bottom-tabs` | 7.15.10 | 7.21.0 |
| `@react-navigation/native-stack` | 7.14.12 | 7.21.0 |
| `@react-navigation/elements` | 2.9.15 | 2.9.45 |
| `@react-navigation/routers` | 7.5.3 | 7.6.5 |
| `@babel/core` | 7.29.0 | 7.29.7 |
| `@babel/helpers` | 7.29.2 | 7.29.10 |
| entfernt | `decode-uri-component 0.2.2`, `query-string 7.1.3`, `filter-obj 1.1.0`, `split-on-first 1.1.0`, `strict-uri-encode 2.0.0` | — |
| neu | — | `standard-navigation 0.0.8` (neue Abhängigkeit der Navigation-Pakete; Annahme, nicht im Detail geprüft) |

Quelltext in `mobile/src` wurde nicht geändert.

## Registry-Stand (`npm view`, 2026-10-30)

`@react-navigation/native 7.5.1`, `bottom-tabs 7.21.0`, `native-stack 7.21.0`, `core 7.24.0` (entspricht der Plan-Erwartung 7.5.1/7.24.0).

## `@babel/core`: Zielversion mit Beleg

- Gewählt: **7.29.7** (Lockfile-Update innerhalb der bestehenden Linie). Advisory GHSA-4x5r-pxfx-6jf8 betrifft `<=7.29.0`; 7.29.7 liegt außerhalb. `npm audit` meldet `@babel/core` nach dem Update nicht mehr.
- Babel 8 (`8.0.10`, `latest`) **nicht verwendet**: `metro@0.87.2` (von `react-native@0.88.1`/`expo@58`) deklariert `@babel/core ^7.25.2`; `babel-preset-expo@58.0.22` nutzt `@babel/plugin-transform-runtime ^7.24.7` (Babel-7-Linie). Babel 8 verlangt zudem Node `^22.18.0 || >=24.11.0`. Beleg: `npm view` 2026-10-30. Eine ausdrückliche Babel-8-Unterstützung durch Expo ist daher nicht belegt.
- Nur eine `@babel/core`-Instanz im Baum (`7.29.7`, alle deduped).

## Nachweise

| Prüfung | Befehl | Exit | Ergebnis |
|---|---|---|---|
| Graph | `npm ls decode-uri-component query-string @react-navigation/core @babel/core` | 0 | `decode-uri-component` und `query-string` nicht mehr vorhanden; `@react-navigation/native@7.5.1` → `core@7.24.0`; `@babel/core@7.29.7` (alle deduped) |
| Graph gesamt | `npm ls --all` / `npm ci --dry-run` | 0 / 0 | ohne Problem |
| Audit vorher | `npm audit --json` (Root) | 1 | 18 (6 low, 4 moderate, 8 high, 0 critical) |
| Audit nachher | `npm audit --json` (Root) | 1 | 14 (5 low, 4 moderate, 5 high, 0 critical) |
| Typecheck | `npm run typecheck` (backend, shared, mobile) | 0 | 0 Fehler |
| Mobile-Tests | `npm run test --workspace=mobile` | 0 | 108 Dateien / 1.002 Tests (Baseline 108/1.002 unverändert) |
| Parität | `node scripts/check-test-parity.mjs …` | 0 | shared 10/466, backend 84/2.709, mobile 108/1.002; alle ≥ Minima |
| Bundle | `smoke:bundle` | 0 | 1 Android-Bundle (5,9 MB) |
| Manifest | `smoke:manifest` | 0 | entspricht Baseline (App-Link-Intent-Filter/Scheme unverändert) |
| Doctor-Smoke | `smoke:doctor` | 0 | 20/20 |
| expo-doctor | `npx expo-doctor` (mobile) | 0 | 20/20 |
| Expo-Pins | `npx expo install --check` | 0 | "Dependencies are up to date" |
| Staging-Audit | `npm audit --omit=dev` in `_deploy_staging` | 0 | 0 Vulnerabilities |

### Audit vorher/nachher je Severity und Advisory

| Severity | Vorher | Nachher | Entfallen |
|---|---|---|---|
| high | 8 | 5 | `decode-uri-component` (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f), `query-string`, `@react-navigation/core` |
| low | 6 | 5 | `@babel/core` (GHSA-4x5r-pxfx-6jf8) |
| moderate | 4 | 4 | — |

Verbleibend (nicht Teil von WP-FE-02):

- high (5): `@azure/identity`, `@azure/msal-node` (GHSA-xcx6-jx8p-x3h5; WP-BE-08 Teil 1), `zod`, `@expo/cli`, `expo` (GHSA-mrhx-c7xc-m3w5; WP-FE-03)
- moderate (4): `azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid` (GHSA-w5hq-g745-h8pq; PO-1 = D, nur Dev)
- low (5): `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `deepmerge` (GHSA-gcqx-w48m-w2h4; WP-FE-03)

## Breaking-Change-Liste Navigation-Update

- **Keine erzwungene Anpassung:** Typecheck (0 Fehler) und 1.002 Mobile-Tests (unverändert, nicht abgeschwächt) sind grün; kein Quelltext geändert.
- Entfernt: `query-string`-Kette (Linking-Parsing in `core` ohne diese Abhängigkeit). Eine Verhaltensänderung des Linking-Parsers ist durch Tests und Smokes nicht aufgefallen, aber nicht gerätegeprüft.
- Nicht ausgewertet (UNVERIFIED): Release-Notes der Zwischenversionen 7.2.2 → 7.5.1 (native), 7.15.10/7.14.12 → 7.21.0 (tabs/stack) wurden nicht gelesen; die obige Aussage stützt sich auf Typecheck, Tests und Smokes.

## WP-FE-03: Beleg Expo-Findings (PO-2 = C, Stand 2026-10-30)

Quelle: `npm view` am 2026-10-30; kein Override, kein Downgrade, keine Änderung am Manifest.

| Beleg | Wert |
|---|---|
| `expo` latest | `58.0.21` (letzte 58er: 58.0.19, 58.0.20, 58.0.21; dist-tag `latest`) |
| `@expo/cli` latest | `58.1.17` (zuletzt geändert 2026-10-28) |
| `@expo/cli@58.1.17` → `zod` | `^3.25.76` (installiert `3.25.76` unter `node_modules/expo/node_modules/zod`); `zod >= 4.6.6` wird **nicht** genutzt (zod latest `4.6.7`) |
| `@expo/config` latest | `58.0.9` → `deepmerge ^4.3.1`; installiert `deepmerge 4.3.1` |
| `deepmerge` latest | `4.3.1` (betroffen `>=4.2.0 <=4.3.1`; keine gepatchte Version in der Registry) |

| Finding | Advisory | Schwere | Pfad | Erreichbarkeit | Upstream-Beleg |
|---|---|---|---|---|---|
| `zod` (dazu `@expo/cli`, `expo`) | GHSA-mrhx-c7xc-m3w5 ("Zod can exhaust memory while validating oversized constrained collections", CWE-770, betrifft `<4.6.6`) | high | `mobile` → `expo@58.0.21` → `@expo/cli@58.1.17` → `zod@3.25.76` | nur Build-Tooling (Expo CLI auf dem Entwicklungs-/CI-Rechner); nicht im App-Bundle (Annahme aus Pfad, kein Bundle-Scan durchgeführt) | `@expo/cli@58.1.17`/`expo@58.0.21` sind die neuesten; Upstream hält `zod ^3.25.76`; Expo-Issue/Release-Notes nicht abgerufen (UNVERIFIED) |
| `deepmerge` (dazu `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`) | GHSA-gcqx-w48m-w2h4 ("mergeObject() allows prototype poisoning", CWE-1321, `>=4.2.0 <=4.3.1`) | low | `mobile` → `expo` → `@expo/config@58.0.9` → `deepmerge@4.3.1` | nur Build-Tooling (Konfigurationsauflösung zur Build-Zeit) | `deepmerge@4.3.1` ist die neueste Version; kein Patch erkennbar |

- Der Patchstand der Advisories (Fix in `zod 4.6.6`) ist dem Audit-Output entnommen; Release-Notes wurden nicht gelesen.
- Neuprüfung bei jedem Expo-Release (Dependabot/CI-Audit, WP-BE-07). Bei Upstream-Fix: Update ohne Override.

## Offene Punkte

1. **MANUAL VALIDATION REQUIRED:** Geräte-Checkliste, Punkt App Link/Deep Link und Tab-/Stack-Navigation (Dev Build erforderlich).
2. WP-BE-08 Teil 1 (`@azure/identity`/`msal-node`) liegt im Root-Lockfile beim Backend-Agenten; dieser Lauf hat das Lockfile nur für die oben genannten Pakete angefasst.
3. WP-FE-03: bleibt bis zu einem gepatchten Expo-Release dokumentierte Ausnahme (PO-2 = C).
4. Test-Baseline (`scripts/test-baseline.json`) ist nicht angehoben (Zuständigkeit Abschnitt 20, Schritt 7b).
