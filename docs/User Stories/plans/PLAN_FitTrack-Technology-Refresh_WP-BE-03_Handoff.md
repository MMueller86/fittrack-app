# WP-BE-03 Handoff — Test-, Import- und weitere Workspace-Abhängigkeiten

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-03, AC-1/AC-6/AC-8
- Erstellt: 2026-10-30, nachträglich (AC-20). Quelle: Repository-Stand (Manifeste, Lockfile, `git diff HEAD`) und Läufe vom 2026-10-30. Node `24.22.1`, npm `12.2.1`, Windows x64; Branch `chore/fittrack-technology-refresh-phase-0`, nicht committet.

## Aktualisierte Abhängigkeiten (Manifest vorher → jetzt; aufgelöst laut Root-`package-lock.json`)

| Workspace | Paket | Vorher | Jetzt | Aufgelöst |
|---|---|---|---|---|
| backend | `vitest` | `^2.1.9` | `^5.0.5` | 5.0.5 (Vite 8.3.5; `tinypool` nicht mehr im Lockfile) |
| shared | `vitest` | `^2.1.0` | `^5.0.5` | 5.0.5 |
| backend | `azurite` | `^3.35.0` | `^3.37.0` | 3.37.0 (neueste laut `npm view azurite version`) |
| backend | `@types/sharp` | `^0.31.1` | entfernt | – |
| backend | `pixelmatch` | `~7.2.0` | unverändert | 7.2.0 (backend-lokal installiert, `pngjs 7.0.0`) |
| tools/off-import | `mongodb` | `^6.5.0` | `^7.7.0` | 7.7.0 |
| tools/off-import | `tsx` | `^4.7.0` | `^4.23.15` | 4.23.15 |
| tools/off-import | `@types/node` | `^20.0.0` | `^24.0.0` | Root-Lockfile: 26.6.6 (backend/Staging teils 25.9.9) |
| tools/off-import | `@azure/cosmos` | `^4.1.1` | unverändert | Root 4.10.1 (aufgelöst über Workspace-Hoisting; nicht angehoben, Manifest-Untergrenze unverändert) |

TypeScript bleibt laut Plan Sache von WP-BE-05 (jetzt 7.0.2, siehe [WP-BE-05 Handoff](PLAN_FitTrack-Technology-Refresh_WP-BE-05_Handoff.md)); der aktuelle Manifest-Diff enthält diese Anhebung bereits.

## Anpassungen für den neuen Teststack

- `backend/scripts/run-eval.mjs`: Vitest 5 exportiert `./vitest.mjs` nicht mehr; die Binärdatei wird über `vitest/package.json` aufgelöst (Kommentar im Code).
- `backend/vitest.eval.config.mts`: im Diff nur ein Kommentar (Default-Deployment `gpt-4.1-mini`, WP-BE-06). `test.poolOptions` steht weiterhin in `backend/vitest.eval.config.mts` (Zeile 45) und `backend/vitest.contract.config.mts` (Zeile 42); Vitest 5 warnt dazu `DEPRECATED test.poolOptions was removed in Vitest 4` (Eval-Lauf 2026-10-30). Bereinigung offen.
- Test-Dateien im Backend: 36 geänderte Dateien unter `backend/src` (+2.427/−271 Zeilen gegen HEAD, zusammen mit BE-01/BE-02/BE-06; keine Löschungen von Testdateien belegt: Dateizahl 82 → 84, Tests 2.682 → 2.709 laut Phase-0-Bericht und heutigem Lauf).
- Overrides im Root: `azurite → @azure/ms-rest-js → form-data 2.5.6` besteht unverändert; der Override `fflate` ist entfernt (WP-BE-01/-02).

## Advisories

- Vitest/Tinypool (Critical/High laut Plan): Im heutigen Lockfile ist `tinypool` nicht mehr enthalten, `vitest 5.0.5`. Root `npm audit --json` (2026-10-30) nennt kein Vitest-/Vite-/Tinypool-Paket mehr. Die ursprünglichen Advisory-IDs sind aus dem Repository **nicht rekonstruierbar** (`UNVERIFIED`; nur der heutige Zustand ist belegt).
- Azurite-Kette: siehe [WP-BE-08 Handoff](PLAN_FitTrack-Technology-Refresh_WP-BE-08_Handoff.md) (msal-node/identity behoben, uuid-Kette befristete Ausnahme PO-1 = D).
- `mongodb 7.7.0`: im Root-Audit kein Finding.

## Nachweise (2026-10-30)

| Prüfung | Befehl (cwd) | Exit | Ergebnis |
|---|---|---:|---|
| Typecheck backend/shared/mobile | `npm run typecheck` (Root) | 0 | 0 Fehler |
| Typecheck off-import | `npx tsc --noEmit -p .` (`tools/off-import`) | 0 | 0 Fehler |
| Shared-Tests | `npm run test --workspace=shared` | 0 | 10 Dateien / 466 Tests |
| Backend-Tests | `npm run test` (`backend`) | 0 | 84 / 2.709 |
| Mobile-Tests | `npm run test --workspace=mobile` | 0 | 108 / 1.002 |
| Skript-Tests | `npm run test:scripts` | 0 | 27 pass, 0 fail |
| Startup-Tests | `npm run test:startup` (`backend`) | 0 | 28 pass, 0 fail |
| Encoding | `npm run check:encoding` | 0 | passed |
| Parität | `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS gegen angehobene Baseline (10/466, 84/2.709, 108/1.002) |

## Offen / UNVERIFIED

- Import-Skripte in `tools/off-import` (`analyze:off`, `import:cosmos` usw.) wurden nicht ausgeführt (brauchen Daten/Cosmos); belegt sind nur Typecheck und `tsx`-Kompatibilität aus dem WP-BE-05-Handoff.
- `backend/scripts/functions-baseline.mjs` importiert `@typescript/typescript6`, das nur in `mobile/package.json` als devDependency steht und im Backend über Hoisting aufgelöst wird (Startup-Tests grün). Ein eigener Eintrag in `backend/package.json` fehlt; Entscheidung (Backend-Manifest ergänzen oder Skript umstellen) offen, nicht Teil dieses Auftrags.
- Verbleibende `DEPRECATED test.poolOptions`-Warnung (s. o.).
