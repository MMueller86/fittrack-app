# WP-FE-01 Handoff — Expo SDK 58 (zusammen mit WP-BE-05)

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-FE-01 (Abschnitt 13); zusammen mit [WP-BE-05](PLAN_FitTrack-Technology-Refresh_WP-BE-05_Handoff.md)
- Entscheidungen: Product Owner 2026-10-29 Option 2 (aktuelles Expo SDK mit TS-7-Unterstützung, kein TS-6-Alias für mobile); PO-4 = A (AC-5 = Zielstand SDK 58 geprüft); PO-3 = Kamerawechsel außerhalb des Plans
- Prüfdatum: 2026-10-30, lokal Windows x64, Node `24.22.1`, npm `12.2.1`; Stand nach WP-FE-02 (Navigation-Update, `@babel/core 7.29.7`)
- Stand: Branch `chore/fittrack-technology-refresh-phase-0` (Annahme aus früherem Handoff, nicht erneut geprüft), zum Zeitpunkt des Handoffs nicht committet; Stand 2026-10-30: committet in `bce9fe6`, `2763b20`, `cea53b6` und gepusht (`git log`, `git branch -r --contains cea53b6`)
- Status: lokal geprüft; Geräte-Validierung und Android-Assemble offen
- Dev Build Required: **YES** (nicht ausgelöst; kein EAS-Build)

## Zielstand

| Paket | Version (aufgelöst) |
|---|---|
| expo | `58.0.21` (`~58.0.21`) |
| react-native | `0.88.1` |
| react / react-test-renderer / @types/react | `19.3.0` / `^19.3.0` / `~19.3.0` |
| typescript (mobile) | `7.0.2` (`^7.0.2`) |
| vitest | `5.0.5` |
| react-native-reanimated / -worklets / -gesture-handler | `4.7.1` / `0.13.0` / `~3.3.0` |
| react-native-screens / safe-area-context / svg | `~4.30.0` / `~5.10.1` / `15.16.0` |
| `@typescript/typescript6` | `~6.0.2`, nur `mobile` (klassische AST-API in `nutritionDiaryMutationBoundary.test.ts`; Test unverändert) |

Alle `expo-*`-Pakete stehen auf `~58.0.x` (genaue Pins in `mobile/package.json`).

## Geänderte Konfiguration (Versioniert, Arbeitsbaum)

- [mobile/app.json](../../../mobile/app.json): Top-Level-`splash` entfällt, stattdessen Plugin `expo-splash-screen` mit identischen Werten (Bild, `contain`, `#0B0F0C`); `newArchEnabled` entfernt.
- [mobile/package.json](../../../mobile/package.json): Versionen siehe oben; `expo.install.exclude: ["typescript"]` (im Arbeitsbaum vorgefunden; Begründung nicht belegt, Annahme: Schutz vor ungewolltem Pin); `expo.doctor.reactNativeDirectoryCheck.exclude: ["react-native-nitro-image"]`.
- [mobile/app.config.js](../../../mobile/app.config.js): im Arbeitsbaum nur der `photosPermission`-Text von `expo-media-library` geändert (gehört zum Kamera-/Bildfluss, siehe unten). Plugins, Package, Health-Connect-Permissions/queries, minSdk, App-Link-Intent-Filter und Scheme sind gegenüber dem Git-Stand unverändert.
- `mobile/android/` ist per `.gitignore` ausgeschlossen (nicht versioniert, Stand SDK 54). Keine Änderung daran; EAS/Prebuild erzeugt es neu. Annahme "eingechecktes Android-Projekt" im Plan ist falsch. Abgleich mit den offiziellen Expo-Upgradehinweisen 55–58 online nicht erfolgt (UNVERIFIED).
- Gradle/AGP nicht angefasst.

## Außerhalb des Plans: Kamera-Paketwechsel (PO-3)

Im Arbeitsbaum fehlen `react-native-vision-camera` und `react-native-image-crop-picker`; neu sind `expo-camera ~58.0.14` und `expo-image-manipulator ~58.0.16` (stammt aus einer Parallelentwicklung, siehe [PLAN_Einheitlicher-Kamera-Flow.md](PLAN_Einheitlicher-Kamera-Flow.md)). Dieser Wechsel wurde hier weder bewertet noch geändert; Prüfung, Geräte-Checkliste (Barcode, Etikett, Foto-Zuschnitt), KB und Datenschutzprüfung (geänderter Berechtigungstext) liegen bei der Parallelentwicklung.

## Breaking Changes (relevant)

1. `splash` in `app.json` → Plugin `expo-splash-screen`; `newArchEnabled` entfällt.
2. `react-native-gesture-handler` 3.x; `reanimated` 4.7 mit `react-native-worklets`.
3. `@expo/cli` 58 unterstützt TypeScript 7 (`@expo/cli 54.0.26` scheiterte; frühere Messung).
4. TS-7-Compileroptionen: siehe [WP-BE-05 Handoff](PLAN_FitTrack-Technology-Refresh_WP-BE-05_Handoff.md).

## Nachweise (Wiederholungsläufe 2026-10-30)

| Prüfung | Befehl | Exit | Ergebnis |
|---|---|---|---|
| Expo-Pins | `npx expo install --check` (mobile) | 0 | "Dependencies are up to date" (`typescript` ausgenommen) |
| Expo Doctor | `npx expo-doctor` (mobile) | 0 | 20/20 |
| Typecheck backend/shared/mobile | `npm run typecheck` (Root) | 0 | 0 Fehler |
| Bundle | `npm run smoke:bundle --workspace=mobile` | 0 | 1 Android-Hermes-Bundle (5,9 MB) |
| Manifest | `npm run smoke:manifest --workspace=mobile` | 0 | entspricht Native-Baseline |
| Doctor-Smoke | `npm run smoke:doctor --workspace=mobile` | 0 | 20/20 |
| Mobile-Tests | `npm run test --workspace=mobile` | 0 | 108 Dateien / 1.002 Tests, 0 failed |
| Shared-Tests | `vitest run --root shared --reporter=json` | 0 | 10 / 466, 0 failed |
| Backend-Tests | `vitest run --reporter=json` (cwd `backend`) | 0 | 84 / 2.709, 0 failed |
| Parität | `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS (Minima 10/466, 77/1.944, 106/993) |
| Build | `npm run build:verify --workspace=backend` | 0 | "All checks passed" |
| Startup / Skripte | `npm run test:startup --workspace=backend` / `npm run test:scripts` | 0 / 0 | 28 pass, 0 fail / 27 pass, 0 fail, 0 skipped (erneuter Lauf 2026-10-30, Exit 0) |
| Encoding | `npm run check:encoding` | 0 | passed |
| Lockfile / Graph | `npm ci --dry-run` / `npm ls --all` (Root) | 0 / 0 | konsistent, ohne Problem |
| Staging-Audit | `npm audit --omit=dev` in `_deploy_staging` | 0 | 0 Vulnerabilities |
| Root-Audit | `npm audit --json` | 1 | 14 Findings (5 low, 4 moderate, 5 high); Details im [WP-FE-02 Handoff](PLAN_FitTrack-Technology-Refresh_WP-FE-02_Handoff.md) |
| Android-Debug-Assemble | `smoke:android-debug` | — | nicht ausgeführt (Windows-Pfadlänge im OneDrive-Pfad); nur CI, UNVERIFIED |

Hinweis: Backend-Tests müssen mit Arbeitsverzeichnis `backend` laufen (`--root` vom Repo-Root aus liefert 4 Pfad-Fehler im Instagram-Renderer; keine Codeursache).

## Abweichungen

1. AC-5: Zielstand SDK 58 direkt geprüft; Stufen 55/56/57 nicht einzeln (PO-4 = A, entfällt).
2. Planabweichung: WP-FE-01 zusammen mit WP-BE-05 vorgezogen (Product Owner 2026-10-29).

## Offene Punkte

1. **MANUAL VALIDATION REQUIRED:** Geräte-Checkliste aus [PLAN_FitTrack-Technology-Refresh_Phase0.md](../../qa/reports/PLAN_FitTrack-Technology-Refresh_Phase0.md) nach dem Upgrade auf einem Dev Build wiederholen (App-Link, CIAM, Health Connect, Reanimated, Permissions).
2. Android-Debug-Assemble/EAS-Build nur in CI (lokal nicht lauffähig).
3. Lokales `mobile/android/` ist veraltet; bei Bedarf per `expo prebuild` neu erzeugen.
4. KB [03-mobile.md](../../kb/tech/03-mobile.md) und [08-testing.md](../../kb/tech/08-testing.md) mit finalen Versionen abgleichen.
5. Kamerawechsel: außerhalb des Plans (siehe oben).
