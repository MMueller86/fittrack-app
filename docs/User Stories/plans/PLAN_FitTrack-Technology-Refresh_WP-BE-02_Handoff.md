# WP-BE-02 Handoff — Satori/fflate-Kante beseitigt (Renderer auf `@napi-rs/canvas`)

- Plan: [PLAN_FitTrack-Technology-Refresh.md](PLAN_FitTrack-Technology-Refresh.md), WP-BE-02, Entscheidung O-1 Option B
- Prüfdatum: 2026-10-29, lokal Windows x64, Node `24.22.1`, npm `12.2.1`
- Stand: Arbeitsverzeichnis auf Branch `chore/fittrack-technology-refresh-phase-0`, zum Zeitpunkt des Handoffs nicht committet; Stand 2026-10-30: committet in `bce9fe6`, `2763b20`, `cea53b6` und gepusht
- Status: **Umsetzung erfolgt; zwei Nachweise offen** (Linux-Smoke, menschliche Freigabe der Optik, siehe "Offene Punkte")

## Gewählte Rendererquelle

| Punkt | Ergebnis |
|---|---|
| Paket | `@napi-rs/canvas@1.0.13`, Range `~1.0.13` in [backend/package.json](../../../backend/package.json) und [_deploy_staging/package.json](../../../_deploy_staging/package.json) |
| Lizenz | MIT (aus `node_modules/@napi-rs/canvas/package.json`) |
| Distribution | npm-Registry, optionale Plattformpakete im Lockfile (u. a. `linux-x64-gnu`, `linux-x64-musl`, `win32-x64-msvc`) in Root- und Staging-Lockfile |
| Entfernt | `satori`, `@resvg/resvg-js`, `fflate`-Override (Root und Staging); keine Treffer mehr in beiden Lockfiles |
| Root `allowScripts` | `@napi-rs/canvas: false` (kein Install-Skript nötig) |

## Umsetzung

- Neu: [canvasRenderer.ts](../../../backend/src/lib/instagramRenderer/canvasRenderer.ts) (`layoutElementTree`), [flexLayout.ts](../../../backend/src/lib/instagramRenderer/flexLayout.ts) (Flex-Layout und Pixel-Snapping), [canvasPaint.ts](../../../backend/src/lib/instagramRenderer/canvasPaint.ts) (Zeichnen, SVG über `loadImage`, Sharp nur zur PNG-Konvertierung von Fotos), [fontBook.ts](../../../backend/src/lib/instagramRenderer/fontBook.ts) (Fonts, Messung).
- Geändert: [render.ts](../../../backend/src/lib/instagramRenderer/render.ts), [detailTextLayout.ts](../../../backend/src/lib/instagramRenderer/detailTextLayout.ts) und die Renderer-Tests (`golden`, `nutrition-layout`, `recipeDetailsTemplate`, `referenceCorpus`, `tags`).
- Unverändert: Template-Bäume ([compose.ts](../../../backend/src/lib/instagramRenderer/compose.ts), [recipeDetailsTemplateV3.ts](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts)), Layout-Konstanten, Fehlercode `FONT_OR_SATORI_FAILED` und die interne Typbenennung `Satori*` (API-/Fehlervertrag bleibt stabil; Umbenennung wäre ein eigener Schritt).
- Der Referenzkorpus (`manifest.json`, 6 PNGs) bleibt das eingefrorene Satori/Resvg-Baseline und wird nie überschrieben.

## Nachweise (lokal, Windows x64, Node 24.22.1)

| Prüfung | Befehl | Exit | Ergebnis |
|---|---|---|---|
| Typecheck Backend | `npm run typecheck --workspace=backend` | 0 | grün |
| Renderer-Tests | `npm test --workspace=backend -- src/lib/instagramRenderer` | 0 | 11 Dateien, 165 Tests |
| Backend gesamt | `npm test --workspace=backend` | 0 | 84 Dateien, 2.709 Tests |
| Build | `npm run build:verify --workspace=backend` | 0 | grün |
| Root-Graph | `npm ls --all` (Root) | 0 | kein `ELSPROBLEMS` |
| Staging-Graph | `npm ls --all` in `_deploy_staging` | 0 | kein `ELSPROBLEMS` |
| Staging-Audit | `npm audit --omit=dev` in `_deploy_staging` | 0 | 0 Vulnerabilities |
| Root-Audit | `npm audit` (Root) | 1 | 27 Findings (11 low, 12 moderate, 4 high), **historisch** (Stand dieses Pakets; final nach WP-FE-02/WP-BE-08: 12 Findings, nur PO-1/PO-2); keine Treffer zu `satori`, `fflate`, `resvg`. Restliche Findings gehören zu WP-BE-03/O-2/WP-FE-01 |
| Referenzkorpus | `npm test --workspace=backend -- src/lib/instagramRenderer/__tests__/referenceCorpus.test.ts` | 0 | Metriken-Gate grün (Format PNG, exakt 1080 x 1350, nicht leer, kein Überlauf, Zeilenzahlen und Boxhöhen identisch, Breiten `widthDeltas: []`) |

PNG-Format und Maße 1080 x 1350 werden je Fixture im Referenzkorpus-Test hart geprüft.

## Visuelle Vorher-/Nachher-Bewertung

Pixelvergleich Satori-Baseline gegen Canvas (`pixelmatch`, Threshold 0.1), erzeugt mit `RENDERER_CORPUS_REVIEW_DIR` (Side-by-side- und Diff-Bilder je Fixture):

| Fixture | Abweichende Pixel | Anteil |
|---|---|---|
| nutrition-with-photo | 5.919 | 0,41 % |
| nutrition-without-photo | 4.556 | 0,31 % |
| details-1-ingredient | 5.336 | 0,37 % |
| details-5-ingredients | 6.844 | 0,47 % |
| details-9-ingredients | 8.835 | 0,61 % |
| details-20-ingredients | 10.845 | 0,74 % |

Gate: höchstens 3 % je Fixture. Sichtprüfung durch den Agenten an `details-9-ingredients` (side-by-side): Layout, Umbruch, Chips, Icons, Foto und Footer entsprechen der Baseline; Differenzen liegen in Kantenglättung der Schrift. `nutrition-with-photo` wurde nicht erneut angesehen. Keine Golden-Churn: Baseline-PNGs und Manifest unverändert; `golden.test.ts` nutzt eine Toleranz von 1 % (Kommentar: Skia rastert anders als Resvg).

## Abweichungen und Hinweise

- Die Plan-Baseline (backend 77 Dateien / 1.944 Tests) ist überholt; der aktuelle Lauf zählt 84 / 2.709 (mehr, nicht weniger). Aktualisiert 2026-10-30: `scripts/test-baseline.json` ist angehoben (asOf 2026-10-30; shared 10/466, backend 84/2.709, mobile 108/1.002).
- Die Knowledge Base nennt Satori/Resvg noch ([02-backend.md](../../kb/tech/02-backend.md), [07-infrastructure.md](../../kb/tech/07-infrastructure.md), [08-testing.md](../../kb/tech/08-testing.md)) und [golden-metrics.md](../../../backend/src/lib/instagramRenderer/docs/golden-metrics.md): Aktualisierung gehört zu WP-BE-04, noch nicht erfolgt.
- Der Pixel-Gate-Job in CI läuft auf `windows-2022` (kanonische Plattform des Korpus, `win32/x64/Node 24`).

## Offene Punkte

1. **Linux-Node-24-x64-Smoke: UNVERIFIED.** Lokal ist nur Windows verfügbar. Der Plan verlangt einen Nachweis auf Linux (Staging-Install mit `npm ci --omit=dev`, Laden von `@napi-rs/canvas-linux-x64-gnu`, nichtleeres PNG 1080 x 1350, Fonts). Die Renderer-Tests laufen im CI-Job auf `ubuntu-latest`, ein gezielter Linux-Smoke gegen den Staging-Install fehlt und ein CI-Lauf auf diesem Stand liegt nicht vor. Nachtrag 2026-10-30: CI-Job `staging-linux-renderer-smoke` ist mit WP-BE-07 angelegt (siehe dessen Handoff); ein CI-Lauf liegt weiterhin nicht vor (`UNVERIFIED`).
2. **Visuelle Freigabe durch den Product Owner** der Side-by-side-Bilder (alle 6 Fixtures); Ablage lokal in `%TEMP%\fittrack-corpus-review`, bei Bedarf mit `RENDERER_CORPUS_REVIEW_DIR` neu erzeugen. Schriftmetriken auf Linux können von Windows abweichen.
3. Änderungen waren zum Zeitpunkt des Handoffs nicht committet (inzwischen committet und gepusht, siehe Kopfzeile); Alpha-Deploy bleibt out of scope.
