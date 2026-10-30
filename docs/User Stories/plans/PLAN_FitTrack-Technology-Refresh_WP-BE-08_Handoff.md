# WP-BE-08 Handoff — Azurite-Kette (Teil 1)

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), Abschnitt 0 (PO-1 = D), WP-BE-08, Abschnitt 20 Schritt 7b; AC-7/AC-8/AC-19
- Datum: 2026-10-30; Windows x64, Node `24.22.1`, npm `12.2.1`; Branch `chore/fittrack-technology-refresh-phase-0`, zum Zeitpunkt des Handoffs nicht committet (Stand 2026-10-30: committet in `bce9fe6`, `2763b20`, `cea53b6` und gepusht), kein Deploy, keine Azure-Operation
- Status Teil 1: **behoben ohne Override**. Teil 2: entfällt (PO-1 = D, befristete Ausnahme).

## Teil 1: `@azure/identity` / `@azure/msal-node` (GHSA-xcx6-jx8p-x3h5)

Registry-Prüfung (`npm view`): `@azure/identity@4.14.1` (neueste) hängt von `@azure/msal-node ^7.1.0` ab; `@azure/msal-node` `latest` = `7.1.2`. `applicationinsights@3.17.0` verlangt `@azure/identity ^4.13.1`, `azurite@3.37.0` (neueste) `applicationinsights ^3.16.0`; die Spannen lassen die neuen Versionen zu.

Maßnahme: im Root `npm update @azure/identity @azure/msal-node` (Dry-Run vorab, Exit 0; kein `--force`, kein Override, keine Manifeständerung).

| Datei | Änderung |
|---|---|
| `package-lock.json` | `@azure/identity` 4.14.0 → 4.14.1; `@azure/msal-node` 6.0.1 → 7.1.2 (verlangt dort `@azure/msal-common` 16.15.0); verschachteltes `@azure/msal-common` 16.14.1 entfällt. Diff gegen Sicherungskopie: 8 Zeilen hinzu, 18 entfernt, nur diese Pakete |
| `_deploy_staging/package-lock.json` | unverändert (Diff gegen Vorab-Kopie leer) |
| `mobile/package.json`, `backend/package.json`, `package.json` | von mir nicht geändert; Mobile-Versionen im Lockfile unberührt (Lockfile-Diff enthält keine Mobile-Pakete) |

`npm ls @azure/identity @azure/msal-node` (Exit 0), nachher:
`backend → azurite@3.37.0 → applicationinsights@3.17.0 → @azure/identity@4.14.1 → @azure/msal-node@7.1.2` (deduped über `@azure/monitor-opentelemetry@1.20.1` und `tedious@20.3.8`). Vorher `4.14.0` / `6.0.1`.

## Root-`npm audit --json` vorher/nachher (je Exit 1)

| Severity | Vorher | Nachher |
|---|---:|---:|
| info / critical | 0 / 0 | 0 / 0 |
| low | 5 | 5 |
| moderate | 4 | 4 |
| high | 5 | 3 |
| **gesamt** | **14** | **12** |

Entfallen: `@azure/identity` (high), `@azure/msal-node` (high, GHSA-xcx6-jx8p-x3h5).
Verbleibend (nachher):
- moderate (befristete Ausnahme PO-1 = D): `azurite`, `@azure/ms-rest-js`, `sequelize`, `uuid` (GHSA-w5hq-g745-h8pq)
- high (WP-FE-03 / PO-2 = C): `zod` (GHSA-mrhx-c7xc-m3w5), `@expo/cli`, `expo`
- low (PO-2 = C): `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `deepmerge` (GHSA-gcqx-w48m-w2h4)

Hinweis: Der Plan nannte vorher 18 Findings (8 high); der Messstand vor meiner Änderung war bereits 14/5 high, weil WP-FE-02 die Navigation-/Babel-Findings behoben hat.

## Override nötig?

Nein. Das Lockfile-Update reicht. Kein Override eingeführt oder vorgeschlagen. (Bestehender Override `azurite → @azure/ms-rest-js → form-data 2.5.6` im Root-`package.json` ist unverändert.)

## Teil 2: dokumentierte befristete Ausnahme (PO-1 = D)

| Feld | Inhalt |
|---|---|
| Advisory | GHSA-w5hq-g745-h8pq (`uuid` `<11.1.1`; npm propagiert auf `@azure/ms-rest-js`, `sequelize`, `azurite`) |
| Pfad | `backend` (devDependency `azurite ^3.37.0`) → `azurite@3.37.0` → `uuid` / `@azure/ms-rest-js ^2.7.0` / `sequelize ^6.31.0` |
| Erreichbarkeit | nur lokal (Storage-Emulator für `npm run dev`, Startup-/Smoke-Tests); `_deploy_staging` enthält Azurite nicht: `npm audit --omit=dev` = 0 Vulnerabilities |
| Prüfdatum | 2026-10-30 |
| Upstream-Beleg | `npm view azurite version` = `3.37.0` (neueste); dessen Abhängigkeiten laut `npm view azurite@3.37.0 dependencies`: `@azure/ms-rest-js ^2.7.0`, `sequelize ^6.31.0`; npm bietet nur das verbotene Downgrade `azurite@2.7.1` |
| Neuprüfung | bei jedem Azurite-Release (Dependabot/CI-Audit, WP-BE-07) |
| Nicht umgesetzt | kein `uuid`-Override, kein Downgrade, kein `--force` |

## Nachweise (alle 2026-10-30, nach dem Lockfile-Update)

| Prüfung | Befehl (cwd) | Exit | Ergebnis |
|---|---|---:|---|
| Graph Root | `npm ls --all` | 0 | ohne Problem |
| Staging-Audit | `npm audit --omit=dev` (`_deploy_staging`) | 0 | 0 Vulnerabilities |
| Staging-Graph | `npm ls --all` (`_deploy_staging`) | 0 | ohne Problem |
| Typecheck backend/shared/mobile | `npm run typecheck` | 0 | 0 Fehler |
| Typecheck off-import | `npx tsc --noEmit -p .` (`tools/off-import`) | 0 | 0 Fehler |
| Shared-Tests | `npm run test --workspace=shared` | 0 | 10 / 466 |
| Backend-Tests | `npm run test` (`backend`) | 0 | 84 / 2.709 |
| Mobile-Tests | `npm run test --workspace=mobile` | 0 | 108 / 1.002 |
| Build | `npm run build:verify` (`backend`) | 0 | "All checks passed" |
| Startup | `npm run test:startup` (`backend`) | 0 | 28 pass, 0 fail |
| Functions-Smoke | `npm run test:functions-smoke` (`backend`) | 0 | Health 200, Diary ohne Token 401, 79/79 Registrierungen |
| Skript-Tests | `npm run test:scripts` | 0 | 27 pass, 0 fail |
| Encoding | `npm run check:encoding` | 0 | passed |
| Parität | `node scripts/check-test-parity.mjs …` | 0 | PASS 10/466, 84/2.709, 108/1.002 (Baseline angehoben, siehe unten) |

## Test-Baseline

`scripts/test-baseline.json` angehoben (`asOf` 2026-10-30): shared 10/466 (unverändert), backend 77/1.944 → 84/2.709, mobile 106/993 → 108/1.002. Gemessen mit Vitest-JSON-Reports am 2026-10-30; Paritätsregel unverändert, 0 failed, 0 pending, 0 todo; keine Tests entfernt oder abgeschwächt.

## Offen

- Azurite-Start unter `@azure/identity 4.14.1` ist nur indirekt belegt (Startup-Tests und Functions-Smoke grün, Health 200 mit lokalem Host).
- CI-Lauf auf `ubuntu-latest` (PO-5) steht aus; Linux-Renderer-Nachweis bleibt `UNVERIFIED`.
- `backend/scripts/functions-baseline.mjs` importiert `@typescript/typescript6`, das jetzt auch in `backend/package.json` als devDependency deklariert ist (aufgelöst 2026-10-30, siehe WP-BE-03 Handoff).
