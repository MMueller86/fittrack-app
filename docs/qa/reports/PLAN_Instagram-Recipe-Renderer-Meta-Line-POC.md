# QA Report: Instagram Recipe Renderer Meta-Zeile POC

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md](docs/User%20Stories/plans/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md)
- Verdict: `PASS WITH ISSUES`
- Review basis: approved plan, B-META-1 handoff, current repository implementation

## Scope

Geprueft wurden der genehmigte Backend-only-Renderer-POC, die optionale
`recipeMeta`-Eingabe, die lokale Meta-Fixture, Compose-/Asset-/Validierungslogik,
die fokussierten Renderer-Regressionen, das Arbeits-PNG, Sharp-Bounds und
Overlap, die 4:5-Downscales sowie der unveraenderte historische No-Meta-
Goldenpfad.

Die planrelevante Implementierung liegt in
[backend/src/lib/instagramRenderer/types.ts](backend/src/lib/instagramRenderer/types.ts),
[backend/src/lib/instagramRenderer/layout.ts](backend/src/lib/instagramRenderer/layout.ts),
[backend/src/lib/instagramRenderer/compose.ts](backend/src/lib/instagramRenderer/compose.ts),
[backend/src/lib/instagramRenderer/render.ts](backend/src/lib/instagramRenderer/render.ts),
[backend/src/lib/instagramRenderer/recipeMeta.ts](backend/src/lib/instagramRenderer/recipeMeta.ts),
der getrennten
[backend/src/lib/instagramRenderer/fixtures/quarkbroetchen-meta.ts](backend/src/lib/instagramRenderer/fixtures/quarkbroetchen-meta.ts)
und den Renderer-Tests.

Keine spaetere Rezeptmodell-, AI-, API-, Persistenz-, Mobile-, Quoten-,
Endpoint- oder Infrastrukturintegration wurde als Abschlusskriterium bewertet.
Der Workspace enthaelt bereits unabhängige, nicht von QA erzeugte Vorarbeiten
und unversionierte Renderer-/Plan-Dateien; QA hat diese nicht veraendert und
schreibt nicht `docs/qa/findings.md`.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Handoff und statische Pruefung begrenzen die Meta-Aenderung auf die lokale Backend-Renderer-Flaeche, lokale Fixtures/Tests, das bestehende Render-Skript, das Arbeits-PNG und diesen Report. Es gibt keine planrelevante Shared-, AI-, API-, Persistenz-, Mobile-, Quoten-, Endpoint- oder Infrastrukturdatei. |
| AC-2 | PASS | `renderInstagramRecipe(input)` bleibt der bestehende lokale Einstieg in [backend/src/lib/instagramRenderer/index.ts](backend/src/lib/instagramRenderer/index.ts) und [backend/src/lib/instagramRenderer/render.ts](backend/src/lib/instagramRenderer/render.ts). Der fokussierte Lauf bestaetigt PNG und `1080 x 1350`; der Arbeits-PNG-Check bestaetigt dieselben Dimensionen. Der Renderpfad fuehrt keine HTTP- oder AI-Anfrage ein. |
| AC-3 | PASS | [backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts](backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts) bestaetigt genau eine Meta-Zeile, drei Item-Gruppen, drei Icon-Nodes, zwei Trenner und exakt `25 Min.`, `8 Portionen`, `Einfach`. [backend/src/lib/instagramRenderer/recipeMeta.ts](backend/src/lib/instagramRenderer/recipeMeta.ts) laedt lokal `timer.svg`, `users.svg` und `gauge.svg`. |
| AC-4 | PASS | [backend/src/lib/instagramRenderer/layout.ts](backend/src/lib/instagramRenderer/layout.ts) definiert `x=88`, `width=904`, `y=1204`, Hoehe `24`, Icon `20`, Text `18` und Zeilenhoehe `24`. Der Compose-Test bestaetigt Zentrierung und `nowrap`; die Sharp-Meta-Differenz liegt bei `x=347..732`, `y=1206..1225`. |
| AC-5 | PASS | Der Compose-Test bestaetigt fuer die Meta-Row kein `backgroundColor`, `border`, `borderRadius` oder `boxShadow`; der Text und alle drei Icons verwenden `COLOR_SECONDARY_TEXT`. Die 100%-Ansicht zeigt keine Card, Pills, Schatten oder einen zusaetzlichen Lime-Block. |
| AC-6 | PASS | Der No-Meta-Render bleibt erfolgreich und enthaelt keinen Meta-Node. Der A/B-Test in `recipe-meta.test.ts` misst ausserhalb `x=88..992`, `y=1204..1228` exakt `0` Pixel-Differenzen und vergleicht die Styles von Nutrition Card, Hantel, `PRO PORTION` und Wortmarke. |
| AC-7 | PASS | Die fokussierten Tests decken fehlende, null-, nicht-objektartige, zero/negative/fractional/non-finite Zeit- und Portionswerte sowie fehlende, leere, whitespace-only, nicht-stringartige und mehrzeilige Labels ab. Alle liefern fail-closed `INVALID_RECIPE_META` mit Feldbezug. Ein formal gueltiges, zu breites Label liefert `RECIPE_META_OVERFLOW`; kein Teilrender oder Default wird erzeugt. |
| AC-8 | PASS | Der fokussierte Test bestaetigt exakt `1 Portion` fuer `1` und `2 Portionen` fuer `2`; `0`, negative, fractionale und nicht-finite Werte werden als `INVALID_RECIPE_META` abgewiesen. |
| AC-9 | PASS | [backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts](backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts) bleibt mit drei Tests gruen und bestaetigt Card `x=88, y=1048, width=904, height=144`, Unterkante `1192`, Wertzeile/Divider, Hantelproportion und Wortmarke ab `y=1242`. Der Meta-Test bestaetigt unveraenderte Styles der bestehenden Footer-Nodes. |
| AC-10 | PASS | Der Sharp-A/B-Vergleich ergibt `fullMetaDifferenceBounds = x=347..732, y=1206..1225`, also vollstaendig innerhalb der Zielzone, und `fullDifferencesOutsideMetaZone = 0`. Die Downscale-Bounds bleiben bei `360x450: y=400..410` und `216x270: y=238..247`; es gibt keinen Card-/Wortmarken-Overlap. |
| AC-11 | PASS | Der fokussierte 4:5-Test rendert und prueft `216 x 270`. Die unabhaengige Sharp-Pruefung bestaetigt zusaetzlich `360 x 450` und `216 x 270`; beide behalten die Meta-Aenderung als getrennte, schmale Footer-Zone. Die lokale Bildpruefung bestaetigt bei 100%, Feed- und Thumbnail-Groesse die visuelle Trennung und sekundäre Gewichtung. Geraete-/Feed-Rendering ausserhalb dieses Windows-Laufs bleibt manuell offen. |
| AC-12 | PASS | Der Null-Highlight-Test rendert die vollstaendige Meta-Zeile erfolgreich ohne Badge. Der A/B-Pixelvergleich fuer Highlight gegen `nutritionHighlight: null` findet ausserhalb der bestehenden Badge-Zone `0` Differenzen; die Meta-Zone bleibt vollstaendig erhalten. |
| AC-13 | PASS WITH VERIFICATION LIMITATION | [backend/src/lib/instagramRenderer/__tests__/golden.test.ts](backend/src/lib/instagramRenderer/__tests__/golden.test.ts) verwendet weiterhin Pixelmatch-Threshold `0.10`, Differenz-Gate `0.03` und die unveraenderte No-Meta-Fixture. Der historische Lauf reproduziert `0.054997256515775035 > 0.03`; derselbe Wert ist bereits im vorherigen Renderer-Polish-Report dokumentiert und kein neuer Meta-Effekt. Der Referenz-Hash wurde nur gelesen (`68C201C34179C5F30BCDEC8FB77DF71FD34189DD22EEE12CA28242CCF453B58C`), und keine aktuelle Referenzdatei wurde erzeugt oder promoted. |
| AC-14 | PASS | Dieser Report verwendet `fittrack-qa-v1`, enthaelt jedes AC-1 bis AC-14 genau einmal, dokumentiert alle relevanten Befehle mit Exit-Code, trennt historische/umgebungsbedingte Limitierungen von Findings und behandelt die spaetere Rezept-/AI-/API-/Persistenz-/Mobile-Integration nicht als POC-Blocker. |

## Tests

Alle Befehle wurden aus `backend/` ausgefuehrt, sofern nicht anders angegeben.

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/recipe-meta.test.ts src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/highlight.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts` | 0 | 4 Testdateien, 31 Tests bestanden. |
| `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts` | 1 | Der einzige historische Golden-Test ueberschreitet mit `0.054997256515775035` das unveraenderte Gate `0.03`; Threshold und Referenz wurden nicht geaendert. |
| `cd backend && npx tsc --noEmit` | 0 | Backend-Typecheck ohne Fehler. |
| `cd backend && npm run build:verify` | 0 | Build und Shared-Import-Pruefung bestanden; erwartete Azure-Functions-Test-Mode-Warnungen waren nicht fehlschlagend. |
| `cd backend && npm run render:instagram-reference` | 0 | Arbeits-PNG unter `backend/output/quarkbroetchen.png` erzeugt. |
| `cd backend && npm test` | 1 | Vollstaendige Backend-Suite: 52 Testdateien bestanden, 1 historischer Golden-Test fehlgeschlagen; 1012/1013 Tests bestanden. Kein weiterer Fehler. |
| In-memory Sharp A/B-Bounds fuer Meta gegen No-Meta | 0 | Vollbild `1080 x 1350`; Bounds `x=347..732, y=1206..1225`; Pixel ausserhalb der Meta-Zone: `0`. |
| Sharp-Downscale auf `360 x 450` und `216 x 270` | 0 | Beide 4:5-Ausgaben erzeugt und gemessen; Differenz-Bounds `y=400..410` beziehungsweise `y=238..247`. |
| Arbeits-PNG-Metadaten und Promotion-Gate | 0 | `backend/output/quarkbroetchen.png` ist PNG `1080 x 1350`; `fittrack_instagram_current_approved.png` ist nicht vorhanden. |

Shared-, Mobile-, Contract-, AI-Eval- und Infrastrukturtests wurden nicht
ausgefuehrt, weil der genehmigte Plan keine entsprechenden Dateien oder
Vertraege aendert. Sie sind fuer diesen fixture-only Backend-POC keine
zusaetzliche Abschlussbedingung.

## Verification Notes

- Das Arbeits-PNG [backend/output/quarkbroetchen.png](backend/output/quarkbroetchen.png) wurde bei 100% sowie als ungefaehre `360 x 450`-Feed-Ansicht und `216 x 270`-Thumbnail-Ansicht geprueft. Die Meta-Zeile bleibt ungerahmt, zentriert, getrennt von Card und Wortmarke und visuell sekundaer.
- Der historische Golden-Mismatch ist reproduziert und wird wegen des identischen, bereits vor diesem POC dokumentierten Werts als historische Verifikationslimitierung gefuehrt. Es gibt keinen Anlass, Threshold, Differenz-Gate oder Golden-Referenz zu lockern oder zu ersetzen.
- Der lokale Windows-Lauf prueft nicht die Rasteridentitaet auf anderen Betriebssystemen oder mit anderen Resvg-Versionen.

## UNVERIFIED

- State: `UNVERIFIED`
- Check: Historischer V1.7-Goldenpfad als gruener Pass-Gate.
- Reason: Der No-Meta-Renderer weicht bereits aus der vorherigen genehmigten Renderer-Polish-Runde mit exakt demselben Differenzwert von der historischen V1.7-Referenz ab. Der aktuelle Meta-Pfad fuegt ausserhalb der Meta-Zone keine Pixel hinzu; der Mismatch ist daher kein neuer Meta-Regressionseffekt.
- Evidence: `golden.test.ts` Exit-Code `1`, Differenzratio `0.054997256515775035`; Threshold `0.10`, Gate `0.03` und Referenzdatei unveraendert.
- Manual action: Historischen Goldenpfad nicht promoten oder lockern. Eine neue Referenz beziehungsweise ein neues Golden-Gate benoetigt einen separaten genehmigten Plan.

- State: `UNVERIFIED`
- Check: Cross-platform-/CI-Rasterdeterminismus.
- Reason: Nur der lokale Windows-Renderer war verfuegbar; keine andere Resvg-/Betriebssystemkombination wurde ausgefuehrt.
- Manual action: Bei einer spaeteren CI- oder Release-Pruefung denselben Renderer mit der dort verwendeten Runtime ausfuehren und die Zielzone sowie das historische Gate separat bewerten.

## MANUAL VALIDATION REQUIRED

- State: `MANUAL VALIDATION REQUIRED`
- Check: Endgueltige visuelle Feed-Abnahme auf einem realen Geraet beziehungsweise in der Zielplattform.
- QA result: Lokale Bildpruefung bei 100%, `360 x 450` und `216 x 270` abgeschlossen; Meta-Zeile sichtbar, innerhalb der vorgesehenen Zone, nicht gerahmt und nicht dominant. Bei `216 x 270` ist sie bewusst sehr klein und sekundaer.
- Prerequisite: `backend/output/quarkbroetchen.png` in der Zielplattform oder einem realen Feed-Preview oeffnen.
- Expected result: `25 Min.`, `8 Portionen` und `Einfach` bleiben als zusammengehoerige, nicht ueberlappende Meta-Zeile wahrnehmbar; Nutrition Card, Hanteltrenner, `PRO PORTION` und Wortmarke bleiben getrennt und unveraendert.
- Result: Nicht auf einem realen Geraet oder in einem externen Feed ausgefuehrt; kein automatischer oder produktiver Blocker fuer diesen lokalen POC.

## Findings

No actionable findings.

Der historische Golden-Mismatch ist oben als `UNVERIFIED`-Verifikationslimitierung
dokumentiert, nicht als implementierungsbezogener Finding: gleicher Wert wie in
der vorherigen genehmigten Renderer-Polish-Runde, unveraenderte historische
Fixture, unveraenderter Threshold, unveraendertes Gate und keine aktuelle
Referenzpromotion.
