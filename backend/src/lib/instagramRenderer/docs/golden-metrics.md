# Golden Master Metrics

**Historische Quelle:** `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
**Dimensionen:** 1080 x 1350 px

> Automatisch extrahiert aus dem V1.7 Golden Master. Alle Werte sind Referenzpunkte fuer die Renderer-Implementierung, nicht heilige Fixpunkte. Feinjustierungen erlaubt, wenn die Gesamtwirkung besser bleibt.

## Golden-Policy: aktuelle und historische Referenz

Die historische V1.7-Datei bleibt unveraendert. Der vorhandene Vergleich nutzt
weiterhin `pixelmatch` mit `threshold=0.10` und einem maximalen
Differenzverhaeltnis von `0.03`. Der aktuelle Renderer liegt gegen diese alte
Komposition bei ungefaehr `0.0549972565` (rund `5.50 %`) und damit erwartbar
ueber dem historischen Gate. Dieser Lauf ist eine Diagnose der historischen
Abweichung, kein aktuelles Release-Gate. Weder die Datei noch der Threshold
oder das Ratio-Gate duerfen ersetzt, angehoben oder durch ein groesseres
Toleranzfenster verborgen werden.
Der Tier-1-Test prueft deshalb die unveraenderte historische Berechnung und die
dokumentierte aktuelle Abweichung von rund `5.5 %`; er bewertet diese
historische Abweichung nicht als aktuellen Release-Fehler.

Die aktuelle akzeptierte Komposition stammt aus dem Arbeitsrender
`backend/output/quarkbroetchen.png`, erzeugt mit
`npm run render:instagram-reference` aus dem bestehenden
`quarkbroetchenFixture` im lokalen Renderer-Pfad. Der QA-Review hat diesen
Arbeitsstand am 2026-09-16 visuell akzeptiert; er ist jedoch keine versionierte
Golden-Datei. Die Datei
`backend/src/lib/instagramRenderer/test-fixtures/reference/fittrack_instagram_current_approved.png`
ist zum Stand dieser Dokumentation nicht angelegt oder promoted. Deshalb darf
das Arbeits-PNG nicht stillschweigend als historische Datei oder als
Release-Referenz umbenannt werden.

Es gelten zwei getrennte Gates:

1. **Historisches Diagnose-Gate:** unveraenderte V1.7-Datei, Fixture,
  `threshold=0.10` und `max ratio=0.03`; der bekannte Nicht-Null-Befund wird
  als historische Abweichung dokumentiert.
2. **Aktuelles Release-Gate:** eine separat promovierte
  `fittrack_instagram_current_approved.png` aus dem akzeptierten Arbeitsrender.
  Promotion benoetigt ein eigenes QA-Gate und muss Fixture, Zielruntime,
  PNG-Metadaten (`1080 x 1350`) und SHA-256-Provenienz festhalten. Bis dahin
  ist die aktuelle Referenz `UNVERIFIED`, nicht durch die historische Datei
  ersetzbar und nicht durch neue Toleranzen simulierbar.

---

## 1. Foto -> Dark Transition (x = 540)

Luminanz-Profil entlang der Mittelachse. Uebergang vom Foto in den dunklen Footer-Bereich.

| Punkt | y | Luminanz (geglaettet) |
|---|---:|---:|
| Transition Start (Lum < 150) | 574 | 147.1 |
| Transition Mid (Lum < 80) | 910 | 78.4 |
| Transition End (Lum < 20) | 953 | 14.2 |

**Referenz-Samples (Mittelspalte x=540):**

| y | R | G | B | Hex | Lum |
|---:|---:|---:|---:|---|---:|
| 0 | 117 | 129 | 170 | #7581AA | 129.4 |
| 200 | 223 | 203 | 139 | #DFCB8B | 202.6 |
| 400 | 185 | 162 | 111 | #B9A26F | 163.2 |
| 600 | 202 | 179 | 118 | #CAB376 | 179.5 |
| 655 | 209 | 180 | 126 | #D1B47E | 182.3 |
| 800 | 170 | 156 | 111 | #AA9C6F | 155.7 |
| 900 | 100 | 97 | 80 | #646150 | 96.4 |
| 1000 | 8 | 15 | 11 | #080F0B | 13.2 |
| 1015 | 8 | 15 | 11 | #080F0B | 13.2 |
| 1050 | 13 | 21 | 17 | #0D1511 | 19 |
| 1115 | 41 | 52 | 47 | #29342F | 49.3 |
| 1200 | 5 | 12 | 8 | #050C08 | 10.2 |
| 1250 | 75 | 76 | 75 | #4B4C4B | 75.7 |
| 1300 | 6 | 11 | 8 | #060B08 | 9.7 |
| 1349 | 9 | 16 | 12 | #09100C | 14.2 |

## 2. Nutrition Highlight Badge (HIGH PROTEIN)

| Wert | Pixel |
|---|---:|
| bounding box x | 897 .. 1004 |
| bounding box y | 76 .. 180 |
| Breite | 107 |
| Hoehe | 104 |
| Mittelpunkt (x, y) | (950, 128) |
| right-Offset (Canvas-Rand -> Badge-Rand) | 76 |
| top-Offset (Canvas-Oben -> Badge-Oben) | 76 |

**Hinweis:** Bounding-Box umfasst nur Lime-Pixel des Rings. Das PNG-Asset hat aussen einen Transparenz-Bereich.

## 3. Rezepttitel (Quarkbroetchen)

| Wert | Pixel |
|---|---:|
| Titel x links | 90 |
| Titel x rechts | 518 |
| Titel Breite | 428 |
| Titel y oben (cap top) | 866 |
| Titel y unten (descender bottom) | 949 |
| Titel Gesamt-Hoehe | 83 |

## 4. Nutrition Card

(Card nicht sicher erkannt - Farb-Toleranz anpassen)

## 5. PRO PORTION Text (Lime)

| Wert | Pixel |
|---|---:|
| Text x links | 471 |
| Text x rechts | 607 |
| Text Breite | 136 |
| Text y oben | 1040 |
| Text y unten | 1053 |
| Cap-Hoehe | 13 |
| Mittelpunkt x | 539 |

## 6. FitTrack Wortmarke (Footer)

| Wert | Pixel |
|---|---:|
| Wortmarke Bounding Box x | 493 .. 588 |
| Wortmarke Bounding Box y | 1246 .. 1260 |
| Breite (sichtbare Zeichen) | 95 |
| Hoehe (sichtbare Zeichen) | 14 |
| Horizontales Zentrum | 540 (Canvas-Mitte: 540) |
| Fit Lime-Teil x | 493 .. 523 |
| Track Weiss-Teil x | 527 .. 588 |

## 7. Green Ambient Field (Grid-Sampling)

Farb-Samples in einem 7x5 Raster ueber die Fusszeile (y = 1015..1349).

| y \\ x | 0 | 180 | 360 | 540 | 720 | 900 | 1079 |
|---:|---|---|---|---|---|---|---|
| **1015** | #0A150D | #0A130D | #09100C | #080F0B | #09100C | #0A130D | #0A150D |
| **1100** | #0B160D | #F8F9F8 | #0D1511 | #29342F | #0D1511 | #0D1511 | #0B160D |
| **1180** | #0C170D | #0D1511 | #0D1511 | #0D1511 | #0D1511 | #0D1511 | #0C170D |
| **1260** | #0D180E | #0C160D | #070E09 | #A6A5A5 | #070E09 | #0C160D | #0D180E |
| **1349** | #0D190E | #0C170D | #0A130C | #09100C | #0A130C | #0C170D | #0D190E |

**Lokaler Wortmarken-BG (Sampling rings um Wortmarke-Zentrum 540, 1253):**

| Offset (dx, dy) | Hex | R | G | B |
|---|---|---:|---:|---:|
| (-150, -40) | #080E0A | 8 | 14 | 10 |
| (-150, 0) | #050B07 | 5 | 11 | 7 |
| (-150, 40) | #070F0A | 7 | 15 | 10 |
| (-100, -40) | #060C09 | 6 | 12 | 9 |
| (-100, 0) | #040805 | 4 | 8 | 5 |
| (-100, 40) | #060C08 | 6 | 12 | 8 |
| (-50, -40) | #060B08 | 6 | 11 | 8 |
| (-50, 0) | #030604 | 3 | 6 | 4 |
| (-50, 40) | #060B08 | 6 | 11 | 8 |
| (0, -40) | #050B08 | 5 | 11 | 8 |
| (0, 0) | #EDECEC | 237 | 236 | 236 |
| (0, 40) | #050A07 | 5 | 10 | 7 |
| (50, -40) | #060B08 | 6 | 11 | 8 |
| (50, 0) | #020504 | 2 | 5 | 4 |
| (50, 40) | #060B08 | 6 | 11 | 8 |
| (100, -40) | #060C09 | 6 | 12 | 9 |
| (100, 0) | #040805 | 4 | 8 | 5 |
| (100, 40) | #060C08 | 6 | 12 | 8 |
| (150, -40) | #080E0A | 8 | 14 | 10 |
| (150, 0) | #050B07 | 5 | 11 | 7 |
| (150, 40) | #070F0A | 7 | 15 | 10 |

## 8. Hantel-Divider Position

| Wert | Pixel |
|---|---:|
| Hantel-Stange y oben | 1045 |
| Hantel-Stange y unten | 1113 |
| Hantel-Stange Hoehe | 69 |
| Stangen-Zentrum y | 1079 |

### 8.1 Historischer B-VF-1-Zwischenstand

Die Messwerte in Abschnitt 8 bleiben als historische V1.7-Referenz erhalten.
Die folgende B-VF-1-Geometrie ist ein historischer Zwischenstand und keine
aktuelle Ziel- oder Referenzdatei:

| Element | x | y | Breite | Hoehe |
|---|---:|---:|---:|---:|
| Hantel-Asset | 88 | 1029 | 904 | 64 |
| Nutrition Card | 88 | 1048 | 904 | 144 |
| PRO PORTION Layoutbereich | 440 | 1033 | 200 | 28 |

Das Hantel-Asset bleibt `nutrition/barbell-header-frame.svg` mit seinem
unveraenderten `viewBox="0 0 904 64"`. `PRO PORTION` zeichnet in diesem
Layoutbereich ausschliesslich die zentrierte Lime-Schrift; der Bereich hat
keine opake Hintergrundfarbe.

### 8.2 Abgelehnter B-FL-1 Footer-/Nutrition-Zwischenstand

Die folgenden Werte gehoeren zum abgelehnten Renderer-Zwischenstand. Sie
ersetzen weder historische V1.7-Messwerte noch stellen sie eine aktuelle
freigegebene Referenzdatei dar.

| Element / Anker | Ziel / Layout | Gerenderter Befund |
|---|---:|---:|
| Canvas | `1080 x 1350` | PNG-Metadaten: `1080 x 1350`, 4 Kanaele |
| Nutrition Card | `x=88, y=1048, w=904, h=144` | unveraendert; Unterkante `y=1192` |
| Wertzeile | `x=120, y=1118, w=840, h=64` | Unterkante `y=1182` |
| Divider | `x=330, 540, 750; y=1118..1182` | drei `1 x 64`-Layer |
| Hantel-Asset | `x=88, y=1089, w=904, h=64` | Root-Sibling, vollstaendige Assetbox |
| Schaft | lokaler SVG-Anker `y=29..35` | Oberkante `y=1118`, Mittelpunkt `y=1121` |
| PRO PORTION Layoutbereich | `x=440, y=1107, w=200, h=28` | sichtbare Lime-Pixel `x=473..605, y=1113..1127`; Mittelpunkt `y=1120` |
| Wortmarken-Layoutbox | `x=475, y=1238, w=130, h=62` | Unterkante `y=1300`, Canvas-Clearance `50 px` |
| Wortmarke sichtbar | Asset-Rasterbereich | `x=493..588, y=1262..1277` |

Die benannten Beziehungen sind `CardBottom=1192`,
`ValueRowTop=1118`, `ValueRowBottom=1182`, `BarbellShaftTop=1118`,
`BarbellShaftCenter=1121`, `PRO_PORTION_CENTER_Y=1121` und
`CanvasBottom - WordmarkBottom = 50`. Die Root-Z-Order bleibt Ambient,
Foto, Transition, optionales Highlight, Titel/Tags, Nutrition Card mit
Wertzeile und Dividern, Hantel, transparentes `PRO PORTION`, Wortmarke.
Die Card bleibt `overflow:hidden`; Hantel und Label sind keine Card-Kinder
und haengen nicht vom Card-Clip ab.

Das Asset `nutrition/barbell-header-frame.svg` wurde unveraendert verifiziert:
`viewBox="0 0 904 64"`, gespiegelte rechte Gruppe und identisches
Seitenverhaeltnis bleiben erhalten. Es war keine SVG-Korrektur erforderlich.

### 8.3 B-FA-1 Footer-Alignment: Ziel und neuer Arbeitsstand

Die folgende Geometrie ist die fuer B-FA-1 umgesetzte Zielgeometrie. Das
Arbeits-PNG wurde nach der Aenderung lokal neu erzeugt; es ist fuer die
manuelle Nutzerabnahme bestimmt, aber keine aktuelle freigegebene Referenz.

| Element / Anker | Ziel / Layout | Neuer PNG-Befund |
|---|---:|---:|
| Canvas | `1080 x 1350` | PNG-Metadaten: `1080 x 1350`, 4 Kanaele |
| Photo-/Transition-Ende | `PHOTO_TRANSITION_END_Y=1015` | Layer-Ende `y=1015`; Card-Abstand `1048 - 1015 = 33 px` |
| Nutrition Card | `x=88, y=1048, w=904, h=144` | unveraendert; Unterkante `y=1192` |
| Wertzeile | `x=120, y=1118, w=840, h=64` | unveraendert; Unterkante `y=1182` |
| Divider | `x=330, 540, 750; y=1118..1182` | drei `1 x 64`-Layer |
| Hantel-Assetbox | `x=128, y=1018.831858..., w=824, h=58.336283...` | Box ist uniform aus `904:64` skaliert; geometrische Insets links/rechts je `40 px`, Mittelpunkt `x=540` |
| Hantel-Schaft | `y=1045.265487..1050.734513`, Mitte `y=1048` | Metallpixelzeilen `y=1045..1050`; links/rechts gespiegelt |
| Sichtbare Platten | innerhalb `x=128..952`, ungefaehr `y=1025..1071` | Metallbounds links `x=128..199`, rechts `x=880..951`, beide `y=1025..1070` |
| `PRO PORTION`-Layoutbereich | `x=440, y=1034, w=200, h=28`, Mitte `y=1048` | Lime-Pixel `x=473..605, y=1040..1054`; keine opake Flaeche |
| Wortmarken-Layoutbox | `x=475, y=1222, w=130, h=62` | Unterkante `y=1284`, Canvas-Clearance `66 px` |
| Wortmarke sichtbar | ungefaehr `x=493..588, y=1246..1260` | `x=493..588, y=1246..1261` |

Die Layoutbox bewahrt exakt das SVG-Verhaeltnis `BARBELL_WIDTH /
BARBELL_HEIGHT = 904 / 64`; die Hantel bleibt ein Root-Sibling ausserhalb
des Card-Clips. `PRO PORTION` bleibt ein transparenter Root-Layer. Das
Arbeits-PNG wurde nicht als `fittrack_instagram_current_approved.png`
angelegt oder promoted.

## 8.4 B-IPR-1 aktueller lokaler Arbeitsstand (nicht historische Golden-Referenz)

Dieser Abschnitt beschreibt ausschliesslich den neuen lokalen Renderer-Stand
und darf nicht mit den historischen V1.7-, B-VF-1-, B-FL-1- oder B-FA-1-Werten
verglichen werden. `backend/output/quarkbroetchen.png` ist ein Arbeits-PNG;
es wurde keine aktuelle Referenzdatei angelegt oder promoted.

#### PRO PORTION A/B-Diagnose und Korrektur

| Messung | Normaler Render gegen leeres Barbell-SVG |
|---|---:|
| Geschuetzter Vergleichsbereich | `x=466..613`, `y=1038..1058` |
| A/B-Abweichungen im Bereich | `0` Pixel |
| A/B-Abweichungen ausserhalb von Lime-Glyphen | `0` Pixel |
| Vorherige Card-Divider-Pixel in der Labelzeile | `70` Pixel bei `y=1048` |
| Nachherige Card-Divider-Pixel im Labelbereich | `0` Pixel |
| Klassifikation | Layer/Other: oberer `Nutrition Card`-Rand `#37463D`, nicht der Hantel-Schaft |

Die A/B-Probe hielt Card, Ambient, Transition und Label unveraendert und
entfernte nur den Hantel-Beitrag. Weil die Zeile pixelgenau bestehen blieb,
ist der Schaft als Ursache widerlegt. Die Korrektur ist deshalb kein SVG-
Schaftschnitt: Der Card-Oberrand wird mit einem transparenten Mittelspalt
unter dem Label gezeichnet. Die Hantel bleibt unveraendert mit
`viewBox="0 0 904 64"`, `x=128`, `width=824`, `height=58.336283...`,
`40 px` Card-Inset und Mittelpunkt `x=540`.

#### Tag-Chips

| Wert | Aktiver Wert |
|---|---:|
| `TAG_CHIP_HEIGHT` | `38 px` |
| `TAG_CHIP_PADDING_X` | `16 px` |
| `TAG_ICON_SIZE` | `18 px` |
| `TAG_ICON_GAP` | `6 px` |
| `TAG_CHIP_GAP` | `12 px` |
| Tag-Reihe | `x=88`, `y=936`, maximal `4` Tags |

Der Quarkbroetchen-Arbeitsrender misst fuer die vier unveraenderten Tags
folgende Lime-Chip-Bounds: `Backen x=88..202`, `Vegetarisch x=215..364`,
`Snacks x=377..490`, `Fruehstueck x=503..637`; alle Chips sind `38 px` hoch
und die sichtbaren Luecken betragen `12 px`.

#### High-Protein-Badge

Das bestehende lokale PNG bleibt die Quelle. Die gruenen Akzentkanaele wurden
deterministisch vom gemessenen Anker `RGB(168,250,74)` auf den Renderer-Lime-
Anker `COLOR_LIME=#B9EF12` verschoben. Alpha-Bytes, dunkler Koerper und
weisse Schrift blieben unveraendert.

| Messung | B-IPR-1-Wert |
|---|---:|
| Asset | `nutrition-highlights/high-protein.png` |
| Quelldatei | `1254 x 1254 px`, RGBA, sRGB |
| Alpha-Bounds bei `alpha >= 240` | `x=98..1156`, `y=98..1142` |
| Dominanter Akzent | `RGB(185,239,18)` = `#B9EF12`, `545` Pixel |
| Mittlere weisse Luminanz | `0.92654` |
| Mittlere dunkle Koerperluminanz | `0.00877` |
| Weisser-auf-dunkel-Kontrast | `16.6175:1` |
| Layoutposition | `size=128`, `top=66`, `right=65`, linke Boxkante `x=887` |
| Gerenderte Lime-Bounds | `x=897..1004`, `y=76..181` |

Die Highlight-Auswahl bleibt `null`, `high-protein` oder `low-fat`; es wird
weiterhin maximal ein Badge gerendert.

#### Transparenter Footer-SVG

| Messung | B-IPR-1-Wert |
|---|---:|
| Mobile-Quelle | `mobile/assets/brand/micha_logo_writing_02.svg` |
| Aktives Backend-Asset | `assets/branding/micha-logo-writing.svg` |
| ViewBox | `0 0 1197.24 197.35` |
| Renderer-MIME-Pfad | UTF-8-SVG, `image/svg+xml`, ohne `normalizeWordmarkBackground()` |
| Layoutbox | `x=460`, `y=1242`, `width=160`, `height=26.3739935...` |
| Sichtbare Bounds | `x=460..619`, `y=1242..1267` |
| Sichtbare Breite | `160 px`, damit innerhalb `150..180 px` |
| Sichtbares Zentrum | `x=539.5`, Canvas-Zentrum `x=540` |
| Vollflaechiges Rechteck | nicht vorhanden; transparente Ecken bleiben erhalten |

`fittrack-wordmark.png` bleibt als historische PNG-Fallback-/Vergleichsdatei
im Assetordner. Die alte Hintergrundnormalisierung wird nur fuer diesen
expliziten Fallback verwendet und ist nicht der aktive Standardpfad.

#### Arbeits-PNG

`backend/output/quarkbroetchen.png` wurde lokal, deterministisch und
netzwerkfrei erzeugt. Die PNG-Metadaten sind `1080 x 1350 px`, sRGB, RGBA
mit `4` Kanaelen und Alpha-Kanal. Das V1.7-Golden, sein `0.10`-Threshold und
sein `0.03`-Ratio-Gate wurden nicht geaendert.

## 9. Tag-Zeile

| Wert | Pixel |
|---|---:|
| Tag-Zeile y oben (erste Lime-Detail-Pixel) | 936 |
| Tag-Zeile y unten (letzte Lime-Detail-Pixel) | 974 |
| Ungefaehre Chip-Hoehe | 39 |

## 10. Referenz-Farb-Samples

| Position | Beschreibung | Hex | R | G | B |
|---|---|---|---:|---:|---:|
| (0, 0) | Canvas TL (Foto-Rand) | #FFFFEB | 255 | 255 | 235 |
| (1079, 0) | Canvas TR (Foto-Rand) | #090906 | 9 | 9 | 6 |
| (0, 1349) | Canvas BL (Footer) | #0D190E | 13 | 25 | 14 |
| (1079, 1349) | Canvas BR (Footer) | #0D190E | 13 | 25 | 14 |
| (540, 1349) | Canvas Bottom-Center | #09100C | 9 | 16 | 12 |
| (540, 1015) | Hero-Unterkante lt. Spec | #080F0B | 8 | 15 | 11 |
| (540, 655) | Transition Start lt. Spec | #D1B47E | 209 | 180 | 126 |
| (540, 1115) | Transition End lt. Spec | #29342F | 41 | 52 | 47 |

---

## 11. Analyse und Widersprüche zur Spezifikation

Die folgenden Werte weichen im V1.7 Golden Master erkennbar von den in der Spec genannten Referenzwerten ab. Nach der Vorgabe des Product Owners darf der Planner bei erkannten Suboptimalitäten feinjustieren, solange die Gesamtwirkung besser bleibt.

### 11.1 Foto → Dark Transition (Spec Sektion 7)

| Referenz | Spec | Gemessen (V1.7) | Delta |
|---|---:|---:|---:|
| Transition Start (y) | ~655 | 574 | −81 |
| Transition End (y) | ~1115 | 953 | −162 |
| Zonenhöhe | ~460 | ~380 | −80 |

**Interpretation:** Der Übergang beginnt im Golden früher und endet früher als in der Spec beschrieben. Bei y=1015 ist bereits Basis-Dunkelton (`#080F0B`) erreicht — die Spec-Aussage "Hero endet bei y=1015" passt zur gemessenen Transition, aber die Zone `655…1115` ist so nicht erkennbar. Empfehlung: Renderer folgt der gemessenen Zone (~574…953) und dokumentiert die Abweichung.

### 11.2 Nutrition Highlight Badge (Spec Sektion 9)

| Referenz | Spec | Gemessen (V1.7) | Delta |
|---|---:|---:|---:|
| right-Offset | ~58 | 76 | +18 |
| top-Offset | ~58 | 76 | +18 |
| Größe (Durchmesser) | ~140–150 | ~107 (Lime-Ring) | −33..−43 |

**Interpretation:** Badge im Golden ist deutlich kleiner und etwas weiter innen als Spec verlangt. Das ist einer der vom PO angesprochenen "V1.7 nicht pixelperfekt"-Punkte (siehe E2: Badge-Kontrast/Dominanz). Empfehlung: Planner soll Badge-Größe zwischen 120..150 px testen und im Side-by-Side entscheiden.

### 11.3 Rezepttitel (Spec Sektion 10)

| Referenz | Spec | Gemessen (V1.7) | Delta |
|---|---:|---:|---:|
| Titel x links | 88 | 90 | +2 (praktisch identisch) |
| Titel y (Referenz) | ~850 | 866 (cap-top) | +16 |

Titel-Höhe 83 px, Breite 428 px für "Quarkbroetchen". Bei 62 px Inter Display Bold Cap-Height plus Descender passt das gut. Empfehlung: Spec-Werte `x=88, y=850` beibehalten.

### 11.4 FitTrack Wortmarke (Spec Sektion 16)

| Referenz | Spec | Gemessen (V1.7) | Delta |
|---|---:|---:|---:|
| Wortmarke-Breite | ~220 | ~95 (nur sichtbare Zeichen) | −125 |
| Wortmarke y-Position | ~1222 | ~1246–1260 (Zeichen) | +24 (weiter unten) |
| Horizontales Zentrum | 540 | 540 | 0 ✓ |

**Interpretation:** Die im Golden gerenderte Wortmarke wirkt visuell klein und sitzt tief. Die 95 px erfassen nur die inneren Lime-/Weiß-Pixel — durch Anti-Aliasing und die metallische Struktur des "Track"-Schriftzugs ist die tatsächliche Wortmarken-Rendering-Breite größer, aber deutlich unter Spec-Wert 220. Vom PO explizit als möglicher Feinjustierungs-Punkt genannt.

### 11.5 Nutrition Card (Spec Sektion 13)

Automatische Panel-Detektion (Schwellwert für `#0D1511 ±10`) hat die Card bei y=1120 nicht erkannt. Blick ins Grid-Sampling: bei y=1100 sind die Zellen bei x=360/540/720/900 alle im Panel-Ton oder darüber. Bei x=180, y=1100 sind wir bei `#F8F9F8` — das ist eine weiße Nährwert-Ziffer, nicht Card-Rand.

**Näherungswert für die Card aus Grid-Sampling:**
- x-Ausdehnung: ~90 bis ~990 (nicht direkt gemessen, aber Card-Farbe reicht durchgehend über x=360..900)
- y-Ausdehnung: ~1050 (Top) bis ~1180 (Bottom), Höhe ~130 px

Spec: y=1048, height=144. Delta ~14 px in Höhe. Empfehlung: Spec-Werte übernehmen und Detektion mit weniger streng gefasstem Panel-Farbraum wiederholen (Follow-up).

### 11.6 Hantel-Divider (Spec Sektion 14)

Metallic-Detektion 200 px vom Rand ergibt y = 1045..1113, also 69 px Höhe für den Metallic-Bereich (Scheiben + Stange).

**Interpretation:** Bei 904×64 Original-Aspect (14.125:1) und Breite 904 im Layout wäre Barbell-Höhe genau 64 px. 69 px gemessene Metallic-Zone deutet auf leichte Skalierung (~+8 %) oder Anti-Aliasing-Bloom. `PRO PORTION` Text sitzt bei y=1040..1053, also **über** der Barbell-Stange (`shaftCenter y=1079`). Muss im Renderer explizit berücksichtigt werden.

### 11.7 Green Ambient Field (Spec Sektion 8)

**Reproduzierbare Charakterisierung aus dem Grid-Sampling:**

| Zone | Farbwert-Bereich |
|---|---|
| Basis (Zentrum unter Wortmarke, ohne Wortmarke-Pixel selbst) | `#020504` – `#050B08` (praktisch Wortmarken-BG, siehe unten) |
| Basis über die Fläche (y ~1015, x_mid = 540) | `#080F0B` |
| Rand-Zone (Eckpunkte y=1349, x=0/1079) | `#0D190E` (RGB 13, 25, 14) |
| Zwischen-Zone (y=1349, x=180/900) | `#0C170D` |

**Vorschlag für die Renderer-Funktion (Radial-Gradient, im Renderer als deterministische Funktion zu implementieren):**

```
center: (540, 1250)          // Zentrum unter Wortmarke
radius:  ~720                // bis in die entfernte Ecke
stops:
  0%   #030604  (Wortmarken-BG, gemessen an dx=±50 vom WM-Zentrum)
  15%  #060C08  (schmaler Übergang aus dem Local-BG)
  40%  #080F0B  (Basis-Dunkel, Spec-Basis)
  100% #0D190E  (Green Ambient Edge)
```

**Sonderzone unter Wortmarke:** Direkt hinter der Wortmarke (radius ~50–100 px um Zentrum (540, 1253)) ist die Zone reines `#030604` — der Wortmarken-PNG-Hintergrund geht damit nahtlos in den Card auf. Dieses Verhalten muss der Renderer explizit reproduzieren.

### 11.8 Tag-Zeile (Spec Sektion 11)

| Referenz | Spec | Gemessen (V1.7) |
|---|---:|---:|
| Chip-Höhe | 38 | 39 ✓ |
| Start-y | ~936 | 936 ✓ |

Sehr gut übereinstimmend.

### 11.9 PRO PORTION Text (Spec Sektion 14)

| Referenz | Spec | Gemessen (V1.7) |
|---|---:|---:|
| Font Cap-Höhe | 18 px SemiBold → ~13 px cap | 13 ✓ |
| Zentrum x | 540 (Canvas-Mitte) | 539 ✓ |
| y-Baseline (Range) | im Barbell-Center-Gap | y = 1040..1053 |

Sehr gut übereinstimmend.

### 11.10 Farbkonstanten Bestätigung

Die von der Spec vorgegebenen Farb-Tokens sind im Golden Master tatsächlich präsent:

| Token | Spec | Gemessene Fundstellen |
|---|---|---|
| Basis-Dunkel | `#080D0B` | `#080F0B` (Delta ±2 auf G-Kanal, Anti-Aliasing-Toleranz) — bestätigt |
| Panel | `#0D1511` | direkt gemessen — bestätigt |
| Lime | `#B9EF12` | Lime-Detektion trifft überall wo erwartet — bestätigt |
| Primary Text | `#F8F9F8` | direkt gemessen bei Nährwert-Ziffern — bestätigt |
| Wortmarken-BG | (nicht in Spec) | `#030604` (RGB 3,6,4) — konsistent mit vorheriger Messung des Raster-PNG |

---

## Empfehlungen für den Plan

1. **Farb-Tokens der Spec sind belastbar** — direkt übernehmen, keine Anpassung nötig.
2. **Layout-Werte aus Spec grundsätzlich übernehmen** (Titel, Tag-Zeile, PRO PORTION passen).
3. **Vom Golden abweichende Spec-Werte, die die Spec besser sind**: Wordmark-Größe (~220 statt 95), Badge-Größe (~140 statt 107). Der Planner soll diese als Design-Verbesserung interpretieren.
4. **Foto→Dark Transition** neu justieren: `y=574..953` als gemessene Werte, alternativ Spec `y=655..1115` mit anderer Alpha-Kurve. Planner wählt.
5. **Green Ambient Field**: als Radial-Gradient von `(540, 1250)` mit den in 11.7 genannten Stops. Sonderzone `#030604` um die Wortmarke im Radius ~60 px.
6. **Golden-Gate-Policy:** Der historische Threshold `0.10` und das Ratio-Gate
  `0.03` bleiben unveraendert. Das aktuelle Release-Gate wird nur gegen eine
  separat promovierte aktuelle Referenz ausgefuehrt; neue Abweichungen werden
  als Diff/QA-Finding behandelt und nicht durch breitere Toleranzen verdeckt.
