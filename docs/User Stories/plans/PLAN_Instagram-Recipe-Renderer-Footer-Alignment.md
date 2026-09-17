# Änderungsplan: FitTrack Instagram Recipe Renderer - Footer Alignment

**Status:** APPROVED - gemäß Nutzeranweisung automatisch freigegeben; keine offene fachliche Rückfrage
**Plan-Typ:** Neuer Korrekturplan nach abgebrochenem QA-Lauf und revidierter Interpretation der Footer-Komposition
**Vorgänger:** [`PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md`](PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md)
**Überholter Zwischenplan:** [`PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md`](PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md)
Infrastructure Impact: None
Mobile Build Impact: None

**Ausführungsgate:** Dieser Plan ist als Plan freigegeben und darf sequenziell umgesetzt werden. Die visuelle Nutzerabnahme des neu gerenderten PNGs bleibt ein separates Gate. Eine Promotion zur aktuellen Referenzdatei darf erst nach ausdrücklicher manueller Nutzerabnahme erfolgen.

### Verbindlicher Geometrie-Nachtrag

Die bisherige Zielgeometrie behandelte die Hantel fälschlich als vollbreiten Layer: `BARBELL_X=88`, `BARBELL_Y=1016`, `BARBELL_WIDTH=904` und `BARBELL_HEIGHT=64`. Diese vier Zielwerte sind durch die folgende kleinere, horizontal zentrierte Geometrie ersetzt; die vertikale Schaft-/Label-Beziehung bleibt bewusst erhalten:

```text
BARBELL_VIEWBOX_WIDTH = 904
BARBELL_VIEWBOX_HEIGHT = 64
BARBELL_CARD_INSET = 40
BARBELL_WIDTH = NUTRITION_CARD_WIDTH - 2 * BARBELL_CARD_INSET = 824
BARBELL_SCALE = BARBELL_WIDTH / BARBELL_VIEWBOX_WIDTH = 0.911504...
BARBELL_HEIGHT = BARBELL_VIEWBOX_HEIGHT * BARBELL_SCALE = 58.336...
BARBELL_X = NUTRITION_CARD_X + BARBELL_CARD_INSET = 128
BARBELL_X + BARBELL_WIDTH = 952
```

Die Assetbox liegt damit auf jeder Seite `40 px` innerhalb der Nutrition Card (`x=88..992`). Weil das SVG an seinem äußeren Plattenmotiv nochmals innerhalb der Assetbox beginnt, liegt der erste beziehungsweise letzte sichtbare Plattenpixel voraussichtlich ungefähr `42 px` innerhalb der jeweiligen Cardkante. Die Assetbox bleibt mit dem vollständigen `904:64`-Seitenverhältnis uniform skaliert; eine separate horizontale Stauchung oder vertikale Beschneidung ist nicht zulässig. Die geometrische Mitte bleibt exakt `x=540`, und `PRO PORTION` bleibt im Mittelspalt.

**Ersetzungsregel:** Alle späteren Stellen dieses Plans, die bisher `x=88`, `width=904`, `height=64` oder `BARBELL_Y=1016` als *Ziel* nennen, sind mit den oben genannten Werten zu lesen. Die historischen Ist-Werte des aktuellen Quellstands (`BARBELL_Y=1089`) bleiben als Diagnosebefund dokumentiert und werden nicht stillschweigend umgeschrieben.

## 1. Requirement Assessment

**Klassifikation:** Accept as proposed

### Nutzerproblem

Die vorige Korrektur hat die Hantel zwar aus dem beschneidenden Card-Inhalt gelöst und `PRO PORTION` transparent gemacht, aber die vertikale Bedeutung der Gruppe falsch interpretiert. Die Hantel-/Label-Gruppe wirkt im abgebrochenen Zwischenstand als eigenständiger höherer Header oder als Element innerhalb der Card, statt die obere Linie der gesamten Nährwerte-Box zu bilden.

Zusätzlich ist der Abstand zwischen dem sichtbaren Ende des Bild-/Transition-Bereichs und der Nutrition Card zu groß. Der Footer muss deshalb als zusammenhängende Zone neu vermessen werden: Transition-Ende, Card-Oberkante, Hantel und `PRO PORTION`, Nährwertzeile, Card-Unterkante und Wortmarke müssen in einer gemeinsamen Geometrie geprüft werden.

### Golden-Master-Prüfung

Die historische Datei `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png` wird für diese Planungsrunde ausdrücklich wieder als räumliche Referenz verwendet. Die aus Datei und bestehender Metrik-Dokumentation abgeleiteten Anker sind:

- Dimensionen: `1080 x 1350`.
- Die Card-Oberkante ist in der Mittelzone bei ungefähr `y=1048` erkennbar.
- Das historische `PRO PORTION` liegt sichtbar ungefähr bei `x=471..607`, `y=1040..1053`, also übergreifend an der Card-Oberkante statt in der Mitte der Wertzeile.
- Die historische Metall-/Hantelzone beginnt ungefähr bei `y=1045`; die Hantelstange liegt damit auf beziehungsweise um die obere Card-Linie.
- Die sichtbare Wortmarke liegt ungefähr bei `x=493..588`, `y=1246..1260`.
- Der Golden-Übergang ist am Mittelachsenprofil bereits um ungefähr `y=953` sehr dunkel. Die neue Nutzeranforderung erlaubt ausdrücklich eine längere Bild-/Transition-Zone; diese gezielte Abweichung wird deshalb nicht als unbemerkte Golden-Abweichung behandelt.
- Die historische Hantel darf nicht als stillschweigende Vollbreitenreferenz gelesen werden. Für die neue Zielgeometrie ist die Hantelbox bewusst kleiner als die Nutrition Card und mit einem festen beidseitigen Inset innerhalb der Card zu zentrieren; die Golden-Datei bleibt dafür räumliche Referenz, aber kein blockierendes Pixel-Gate.

Die räumliche Schlussfolgerung ist eindeutig: Die relevante Linie ist die horizontale Schaft-/Label-Achse an der oberen Card-Linie, nicht die obere Kante der vollständigen SVG-Assetbox und nicht die spätere Nährwert-Wertzeile. Die Platten dürfen oberhalb und innerhalb der Card-Oberkante sichtbar sein; die Stange und das Label dürfen nicht als separater Header oberhalb schweben.

### Root-Cause-Hypothese und diskriminierender Check

Die Fehlkomposition wird durch unabhängige vertikale Anker in `layout.ts`, `compose.ts`, `transition.ts` und `photo.ts` verursacht, nicht durch das SVG-Asset selbst:

- Der aktuelle Quellstand setzt `PHOTO_TRANSITION_END_Y=978` und `NUTRITION_CARD_Y=1048`. Dadurch bleiben geometrisch etwa `70 px` dunkle Zone zwischen dem derzeitigen Foto-/Transition-Ende und der Card.
- Der aktuelle Quellstand berechnet `NUTRITION_VALUE_ROW_TOP_Y=1118`, `BARBELL_Y=1089`, `BARBELL_SHAFT_TOP_Y=1118` und `PRO_PORTION_TOP=1107`. Das legt Schaft und Label deutlich innerhalb der Card-Wertzone ab.
- Die aktuelle Arbeitsausgabe bestätigt diese Relation: sichtbare `PRO PORTION`-Pixel liegen ungefähr bei `y=1113..1127`, während die Card-Oberkante bei `y=1048` liegt.
- Die im Nutzerkontext genannte abgeschlossene B-VF-1-Geometrie `x=88, y=1029, width=904, height=64` beschreibt den vorherigen Zwischenstand. Der aktuell gelesene Quellstand enthält dagegen bereits die später abgebrochene Footer-Verschiebung mit `BARBELL_Y=1089`. Diese Divergenz wird im Plan offen dokumentiert; der abgebrochene Stand wird nicht als akzeptierte Referenz behandelt.

Der billige diskriminierende Check wurde durchgeführt: Quellkonstanten, Compose-Baum, Arbeits-PNG und historisches Golden wurden an den genannten y-Ankern verglichen. Der Check bestätigt die Hypothese, weil Card-Oberkante und Golden-Label bei etwa `1048/1040..1053` liegen, der Arbeitsstand das Label aber bei `1113..1127` rendert. Damit ist eine lokale, geometrische Korrektur ausreichend; eine neue Assetgrafik oder eine Änderung der Nährwertberechnung ist nicht erforderlich.

Für den horizontalen Nachtrag ist der diskriminierende Check ebenfalls eindeutig: Das SVG ist symmetrisch und besitzt am äußeren Motiv nur einen sehr kleinen lokalen Rand. Eine unveränderte `904 px`-Box bei `x=88` kann deshalb die äußersten Platten praktisch an die Cardkanten legen. Die verbindliche Box `x=128, width=824` erzeugt dagegen einen geometrischen `40 px`-Inset je Seite und skaliert das gesamte SVG uniform. Der Test kann damit unterscheiden, ob tatsächlich eine kleinere, zentrierte Layerbox verwendet wird oder nur der sichtbare Inhalt innerhalb einer weiterhin vollbreiten Box verschoben wurde.

### Produkt- und Domänenbewertung

- Keine Nutrition-, Portionierungs-, Weight-, Goal- oder AI-Regel wird verändert.
- Es wird keine neue Icon-, Badge- oder Tag-Entscheidung eingeführt.
- Es gibt keinen API-, Persistenz-, Authentifizierungs- oder Health-Risk-Aspekt.
- Die genaue Pixelposition ist eine technische Renderer-Entscheidung. Die Nutzeranforderung und der Golden-Vergleich legen die gewünschte räumliche Beziehung ausreichend eindeutig fest; eine Product-Owner-Rückfrage ist nicht erforderlich.

## 2. Recommended Product Behaviour

Die Grafik behält Inhalt, Format und Informationshierarchie des bestehenden Renderers. Der Footer wird visuell als eine zusammenhängende Komposition behandelt:

1. Das Bild und seine Transition reichen kontrolliert bis zum bestehenden Hero-Ende bei `y=1015`. Damit sinkt der freie Abstand zur Card von ungefähr `70 px` auf ungefähr `33 px`, ohne Card, Nährwertwerte, Titel, Tags, Badge oder Wortmarke durch eine globale Verschiebung neu zu positionieren.
2. Die Nutrition Card bleibt bei `x=88, y=1048, width=904, height=144`.
3. Die Hantelstange und `PRO PORTION` teilen sich die Card-Oberkante als gemeinsamen horizontalen Anker. Konkret liegt die Mitte der uniform skalierten Stange (`BARBELL_SHAFT_HEIGHT≈5.469 px`) auf `y=1048`; der sichtbare Textmittelpunkt liegt im selben Rasterkorridor.
4. Das vollständige Hantel-SVG bleibt ein nicht beschneidender Root-Sibling. Es wird uniform auf eine kleinere, horizontal zentrierte Box `x=128, y≈1018.83, width=824, height≈58.336` skaliert und damit visuell in die obere Card-Linie integriert, ohne als Card-Kind vom `overflow: hidden` der Card abhängig zu sein. Die Box liegt auf jeder Seite `40 px` innerhalb der Nutrition Card und darf nicht wieder die volle Content-Breite einnehmen.
5. `PRO PORTION` bleibt exakt lesbarer, zentrierter Lime-Text ohne Hintergrund, Border, Schatten oder schwarze Box.
6. Die bestehende stabile Wortmarkenrelation aus dem PoC/Golden wird wieder als Baseline verwendet. Die im abgebrochenen Zwischenplan eingeführte tiefere `WORDMARK_Y=1238` wird nicht als neue Referenz übernommen; Ziel ist die frühere Layoutbox bei `y=1222` mit den historischen sichtbaren Zeichenbounds.

Diese Auswahl nutzt die vom Nutzer ausdrücklich erlaubte Alternative, den Bildbereich zu verlängern. Dadurch bleiben Card und Nährwertzeile an ihren etablierten Koordinaten und Foto, Titel, Tags, Badge und Wortmarke werden nicht durch eine allgemeine Footer-Verschiebung beschädigt.

## 3. Feature Summary

Der bestehende Backend-Renderer unter `backend/src/lib/instagramRenderer/` erhält eine eng begrenzte Footer-Ausrichtung:

- `PHOTO_TRANSITION_END_Y` und die sichtbare Photo-Layer-Höhe werden bis zum Hero-Ende `y=1015` geprüft und gezielt verlängert.
- Card-Oberkante und Hantel-/Label-Achse werden über benannte Konstanten verbunden.
- Die Hantel erhält aus dem SVG-internen Schaftanker die globale, uniform skalierte Assetposition `x=128, y≈1018.83, width=824, height≈58.336`; `BARBELL_CARD_INSET=40` und die Zentrierung auf `x=540` sind explizite Layout-Anker.
- `PRO PORTION` erhält eine aus demselben Card-Oberkantenanker abgeleitete Position.
- Card, Nährwertzeile, Divider und Wortmarke werden als unveränderte oder bewusst wiederhergestellte Anker getestet.
- Der abgebrochene `nutrition-layout.test.ts`-Stand wird nicht als erfolgreiche QA behandelt, sondern gegen diese neue Geometrie ersetzt oder gezielt aktualisiert.
- Der historische V1.7-Golden wird räumlich ausgewertet und mit unveränderten Schwellen ausgeführt, aber nicht durch Toleranzänderung zum neuen Design-Gate gemacht.
- Vor manueller Nutzerabnahme wird keine aktuelle Referenzdatei erzeugt oder promoted.

## 4. Current Behaviour

### 4.1 Kontrollierender Quellstand

Die aktuell gelesenen Dateien zeigen folgende Geometrie:

| Element | Aktueller Quellwert / Befund |
|---|---|
| Canvas | `1080 x 1350` |
| Foto-/Transition-Ende | `PHOTO_TRANSITION_END_Y=978` |
| Tag-Reihe | `TAG_ROW_Y=936`, Höhe `38`, Layout-Ende `974` |
| Nutrition Card | `x=88, y=1048, width=904, height=144`, Unterkante `1192` |
| Nährwert-Wertzeile | `x=120, y=1118, width=840, height=64`, Unterkante `1182` |
| Hantel-Asset | `x=88, y=1089, width=904, height=64` im aktuellen Arbeitsstand |
| Hantelstange | lokale SVG-Position `y=29..35`, global ungefähr `y=1118..1124` |
| `PRO PORTION` | Layoutbox ungefähr `x=440, y=1107, width=200, height=28`; sichtbare Pixel ungefähr `y=1113..1127` |
| Wortmarken-Layoutbox | `x=475, y=1238, width=130, height=62` im aktuellen abgebrochenen Arbeitsstand |

`compose.ts` rendert Card, Hantel und Label zwar als Root-Kinder in nachvollziehbarer Z-Order, aber die aktuelle absolute Hantelposition wird aus der Wertzeile abgeleitet. Das erzeugt genau die vom Nutzer beanstandete mittlere Card-Lage. `createNutritionCard()` bleibt `overflow: hidden`; die Hantel muss deshalb Root-Sibling bleiben.

### 4.2 Abgebrochener QA-Schritt

`backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` existiert im Arbeitsbaum. Seine aktuellen Assertions bestätigen unter anderem `BARBELL_Y=1089`, `BARBELL_SHAFT_TOP_Y=1118` und `WORDMARK_Y=1238`. Diese Assertions dokumentieren den abgebrochenen Zwischenstand, nicht die neue Nutzeranforderung. Ein grüner Lauf dieses Tests darf daher nicht als erfolgreiche Abnahme der neuen Footer-Ausrichtung behandelt werden.

### 4.3 Historischer Golden-Vergleich

`backend/src/lib/instagramRenderer/__tests__/golden.test.ts` vergleicht weiterhin gegen `fittrack_instagram_golden_v1_7_unified_ambient.png` mit `pixelmatch`-Threshold `0.10` und einem Differenzverhältnis von `0.03`. Der Test wurde nicht auf die neue Footer-Geometrie umgebaut. Die Datei bleibt unverändert erhalten und liefert räumliche Vergleichspunkte; ein leicht über dem alten Gate liegender Vergleich ist gemäß Nutzeranforderung kein Grund, diese gezielte Layoutarbeit zu blockieren.

## 5. Desired Behaviour and Target Geometry

### 5.1 Verbindliche Zielkoordinaten

Alle Koordinaten beziehen sich auf das `1080 x 1350`-Canvas. Die Zielwerte sind technische Anker; sichtbare Anti-Aliasing-Bounds dürfen nur in den ausdrücklich genannten Rasterkorridoren abweichen.

| Element / Anker | Ziel | Zulässiger Abnahmekorridor / Bedeutung |
|---|---:|---|
| Canvas | `1080 x 1350` | Exakt; PNG-Metadaten müssen dies bestätigen. |
| `PHOTO_TRANSITION_START_Y` | `574` | Unverändert; Foto-Crop und obere Bildkomposition bleiben stabil. |
| `PHOTO_TRANSITION_END_Y` | `1015` | Ziel exakt; eine technische Feinjustierung von höchstens `4 px` ist nur mit dokumentiertem PNG-Befund zulässig. |
| Tag-Reihe | `y=936..974` | Unverändert; kein Überlappen mit dem verlängerten Bildende. |
| Nutrition Card | `x=88, y=1048, w=904, h=144` | Exakt; Unterkante `y=1192`. |
| Footer-Abstand Transition -> Card | `1015 -> 1048 = 33 px` | Bei begründeter Transition-Feinjustierung mindestens `29 px`; kein Rückfall auf die bisherige `70 px`-Lücke. |
| Hantel-Asset | `x=128, y≈1018.832, w=824, h≈58.336` | `BARBELL_CARD_INSET=40` je Seite; horizontal auf `x=540` zentriert; uniformes `904:64`-Seitenverhältnis, kein Clipping. |
| Hantel-Asset-Relation | `824 < NUTRITION_CARD_WIDTH=904` | Die Assetbox endet bei `x=952`; zur Cardkante `x=992` bleiben rechts ebenfalls `40 px`. Die sichtbaren äußersten Platten liegen voraussichtlich ungefähr `42 px` innerhalb der Cardkanten. |
| Hantel-Schaft | `y≈1045.265..1050.735`, Mitte `y=1048` | Der skalierte Schaftmittelpunkt liegt auf der oberen Card-Linie `y=1048`, mit maximal `+/-1 px` Rastertoleranz. |
| Sichtbarer Plattenbereich | ungefähr `x=130..950`, `y≈1025..1071` | Beide Plattenstapel bleiben vollständig und symmetrisch sichtbar; die sichtbaren äußersten Platten liegen auf beiden Seiten mindestens `40 px` innerhalb der Cardkanten; der SVG-Rand wird nicht beschnitten. |
| `PRO PORTION`-Layoutbox | `x=440, y=1034, w=200, h=28` | Mittelpunkt `x=540, y=1048`; sichtbare Bounds ungefähr `x=471..607, y=1040..1053`, maximal `+/-3 px` Rastertoleranz. |
| Nährwert-Wertzeile | `x=120, y=1118, w=840, h=64` | Unverändert; Unterkante `y=1182`. |
| Divider | `x=330, 540, 750; y=1118..1182` | Unverändert, je `1 x 64 px`. |
| Card-Unterkante -> Wortmarkenbox | `1192 -> 1222 = 30 px` | Als Footer-Abstand testen; keine zufällige Neupositionierung. |
| Wortmarken-Layoutbox | `x=475, y=1222, w=130, h=62` | Zielbaseline aus PoC/Golden; Layoutbox-Unterkante `1284`, Canvas-Clearance `66 px`. |
| Sichtbare Wortmarke | ungefähr `x=493..588, y=1246..1260` | Maximal `+/-3 px` Rastertoleranz, horizontal zentriert. |

Die zentrale Berechnung soll in `layout.ts` nachvollziehbar bleiben:

```text
NUTRITION_FOOTER_TOP_Y = NUTRITION_CARD_Y = 1048
BARBELL_VIEWBOX_WIDTH = 904
BARBELL_VIEWBOX_HEIGHT = 64
BARBELL_CARD_INSET = 40
BARBELL_WIDTH = NUTRITION_CARD_WIDTH - 2 * BARBELL_CARD_INSET = 824
BARBELL_SCALE = BARBELL_WIDTH / BARBELL_VIEWBOX_WIDTH = 0.911504...
BARBELL_HEIGHT = BARBELL_VIEWBOX_HEIGHT * BARBELL_SCALE = 58.336...
BARBELL_X = NUTRITION_CARD_X + BARBELL_CARD_INSET = 128
BARBELL_SHAFT_TOP_OFFSET_Y = 29 * BARBELL_SCALE = 26.434...
BARBELL_SHAFT_HEIGHT = 6 * BARBELL_SCALE = 5.469...
BARBELL_SHAFT_TOP_Y = NUTRITION_FOOTER_TOP_Y - BARBELL_SHAFT_HEIGHT / 2 = 1045.265...
BARBELL_SHAFT_CENTER_Y = NUTRITION_FOOTER_TOP_Y = 1048
BARBELL_Y = BARBELL_SHAFT_TOP_Y - BARBELL_SHAFT_TOP_OFFSET_Y = 1018.832...
PRO_PORTION_CENTER_Y = BARBELL_SHAFT_CENTER_Y = 1048
PRO_PORTION_TOP = PRO_PORTION_CENTER_Y - PRO_PORTION_HEIGHT / 2 = 1034
WORDMARK_Y = 1222
```

Die obere Card-Linie bezeichnet damit die gemeinsame horizontale Achse der Stange und des Labels. Die uniform skalierte SVG-Box beginnt bewusst früher, damit die Platten sichtbar bleiben; ihre Box-Oberkante ist nicht selbst der Card-Linienanker. Die horizontale Mitte der Box ist `BARBELL_X + BARBELL_WIDTH / 2 = 540`; linke und rechte Asset-/Platten-Insets müssen in Layout und PNG symmetrisch sein.

### 5.2 Footer-Abstandsmodell

Die Implementierung und QA prüfen die gesamte Zone als Abstandsfolge:

| Beziehung | Zielabstand |
|---|---:|
| Ende Tag-Reihe `974` -> Transition-Ende `1015` | `41 px` |
| Transition-Ende `1015` -> Card-Oberkante `1048` | `33 px` |
| Transition-Ende `1015` -> sichtbarer Plattenanfang ungefähr `1025` | ungefähr `10 px` |
| Card-Oberkante `1048` -> gemeinsame Schaft-/Label-Achse `1048` | `0 px` |
| Schaft-/Label-Achse `1048` -> Wertzeilen-Oberkante `1118` | `70 px` |
| Card-Unterkante `1192` -> Wortmarken-Layoutbox `1222` | `30 px` |
| Wortmarken-Layoutbox-Unterkante `1284` -> Canvas-Unterkante `1350` | `66 px` |

Diese Zahlen sind keine neue Produktentscheidung für Inhalte. Sie schützen die vom Nutzer verlangte räumliche Beziehung und machen sichtbar, wenn nur ein einzelnes Element verschoben wurde, während der Footer insgesamt unausgewogen bleibt.

Zusätzlich gilt die verbindliche horizontale Abstandsfolge `Cardkante links x=88 -> Hantel-Assetkante x=128 = 40 px` und `Hantel-Assetkante rechts x=952 -> Cardkante rechts x=992 = 40 px`. Die Hantelbox-Mitte `128 + 824 / 2 = 540` muss exakt auf der Card-/Canvas-Mitte liegen. Die `40 px` sind Mindest-Inset-Ziele für die Hantelbox und zugleich die untere Grenze für die äußersten sichtbaren Plattenpixel. Ein Test darf diese Relation nicht durch einen bloßen `x`-Shift in einer weiterhin `904 px` breiten Box erfüllen: `BARBELL_WIDTH` muss kleiner als `NUTRITION_CARD_WIDTH` sein, die Assetbox muss zentriert sein und die linke/rechte sichtbare Metallgrenze muss spiegelbildlich innerhalb dieses Inset-Korridors liegen.

### 5.3 Unveränderte Bild- und Inhaltsanker

- Fotoquelle, `focusX`, `focusY` und `zoom` bleiben unverändert.
- `TITLE_Y=853`, `TAG_ROW_Y=936`, Badge-Position und Badge-Asset bleiben unverändert.
- Die Verlängerung betrifft nur den unteren Clip-/Transition-Abschluss bis `y=1015`; der Bild-Crop wird nicht global neu skaliert oder verschoben.
- Card-Hintergrund, Radius, Border, Nährwertreihenfolge und Rundung bleiben unverändert.
- Die Wortmarke bleibt in Größe und Asset unverändert; nur die stabile Baseline `WORDMARK_Y=1222` wird gegenüber dem abgebrochenen Zwischenstand wiederhergestellt und getestet.

### 5.4 Z-Order und Clipping

Die Root-Z-Order bleibt:

1. Ambient-Feld
2. Foto
3. Foto-zu-Dark-Transition
4. optionales Highlight-Badge
5. Titel und Tags
6. Nutrition Card mit Wertzeile und Dividern
7. Hantel-Asset als Root-Sibling außerhalb des Card-Clips
8. transparentes `PRO PORTION` oberhalb von Hantel/Card
9. FitTrack-Wortmarke als letzter Footer-Layer

Die Card darf weiterhin `overflow: hidden` verwenden. Hantel und Label dürfen nicht wieder Card-Kinder werden, wenn dadurch der SVG-Rand oder die obere Plattenhälfte beschnitten werden. `object-fit: cover`, negative Kind-Offsets als alleinige Sichtbarkeitsbedingung und opake Abdeckrechtecke sind nicht zulässig.

## 6. Scope

### In Scope

- Geometrie-Anker in `backend/src/lib/instagramRenderer/layout.ts` für Transition-Ende, Card-Oberkante, Hantel-Schaft, Label und Wortmarke.
- Horizontale Hantel-Geometrie in `backend/src/lib/instagramRenderer/layout.ts` für `BARBELL_CARD_INSET=40`, `BARBELL_X=128`, `BARBELL_WIDTH=824`, uniform skalierte Höhe und die zentrierte sichtbare Plattenzone.
- Anpassung der unteren sichtbaren Photo-/Transition-Grenze in `photo.ts` und `transition.ts`, ohne Foto-Crop, Titel, Tags oder Badge zu verschieben.
- Anpassung der Card-/Hantel-/Label-Z-Order und absoluten Position in `compose.ts`, sodass die Gruppe visuell die obere Card-Linie bildet und strukturell nicht vom Card-Clip abhängt.
- Transparenzprüfung von `PRO PORTION`; keine schwarze oder `COLOR_PANEL`-Box.
- Wiederherstellung und Prüfung der stabilen Wortmarken-Baseline aus PoC/Golden, sofern der aktuelle abgebrochene Stand sie auf `1238` verschoben hat.
- Fokussierte strukturelle und gerenderte Pixelassertions in `nutrition-layout.test.ts`.
- Nutzung von Highlight- und `nutritionHighlight: null`-Fällen zur Prüfung unveränderter Footer-Geometrie.
- Neuer lokaler Render von `backend/output/quarkbroetchen.png` für die manuelle Abnahme.
- Ergänzung von `backend/src/lib/instagramRenderer/docs/golden-metrics.md` um die neue Footer-Ziel-/Ist-Geometrie, ohne historische Werte zu überschreiben.
- Separater QA-Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md`.

### Out of Scope

- Keine Azure Function, kein HTTP-Endpunkt, keine Authentifizierung und keine Quota-Logik.
- Keine Mobile-, Shared-, Infrastruktur-, Cosmos-, Storage-, Deployment- oder Native-Build-Arbeit.
- Keine Änderung an Rezeptdaten, Nährwertberechnung, Portionslogik oder Rundung.
- Keine Änderung an Fotoquelle, Fokus, Zoom, Titel, Tag-Labels, Tag-Icons, Highlight-Badge oder Wortmarken-Asset; außer den ausdrücklich genannten vertikalen Ankern werden diese Bereiche eingefroren.
- Keine neue Produktentscheidung zu Icons, Badges, Tags oder weiteren Grafiken.
- Keine neue Abhängigkeit und keine Neuzeichnung der Hantel, solange das bestehende `904 x 64`-SVG vollständig lesbar ist.
- Keine Änderung des historischen Pixelmatch-Thresholds `0.10` oder des historischen Differenz-Gates `0.03`.
- Keine stillschweigende Promotion, Erstellung oder Ersetzung einer aktuellen Referenzdatei vor manueller Nutzerabnahme.
- Kein Überschreiben des Vorgängerplans, des überholten Zwischenplans, des historischen V1.7-PNGs oder des bisherigen PoC-QA-Reports.

## 7. Confirmed Facts

- Der Renderer ist eine lokale, importierbare Backend-Library unter `backend/src/lib/instagramRenderer/`.
- Die öffentliche Funktion `renderInstagramRecipe(input)` und das PNG-Format `1080 x 1350` existieren bereits.
- Das Hantel-Asset `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` besitzt `viewBox="0 0 904 64"`, einen lokalen Schaft bei `y=29..35` und eine gespiegelte rechte Seite.
- Der aktuelle Quellstand rendert die Hantel als Root-Sibling und `PRO PORTION` transparent, verwendet aber die abgelehnte Wertzeilen-Ausrichtung `BARBELL_Y=1089` / `BARBELL_SHAFT_TOP_Y=1118`.
- Die aktuelle Card bleibt bei `x=88, y=1048, width=904, height=144`.
- `transition.ts` und `photo.ts` verwenden `PHOTO_TRANSITION_END_Y=978` als unteren Bild-/Transition-Clip.
- `ambient.ts` erzeugt bereits ein vollflächiges Ambient-Feld; eine neue Hintergrundarchitektur ist nicht erforderlich.
- `backend/output/quarkbroetchen.png` ist ein vorhandenes Arbeitsartefakt und keine akzeptierte aktuelle Referenz.
- `nutrition-layout.test.ts` existiert, wurde aber im abgebrochenen QA-/Zwischenstand auf die falsche Wertzeilenrelation ausgerichtet.
- `golden.test.ts` verwendet weiterhin die historische V1.7-Datei mit unveränderten Schwellen.
- Der historische Golden-Master wird für Abstände und Komposition wieder herangezogen, aber nicht blind als vollständiger Pixel-Master für die neue Gestaltung behandelt.
- Die Nutzeranforderung erlaubt ausdrücklich entweder eine höhere Card oder einen längeren Bildbereich. Dieser Plan entscheidet technisch für den längeren Bild-/Transition-Bereich, um die etablierten Card-/Wertkoordinaten zu erhalten, und ergänzt die Hantel um einen festen horizontalen Inset statt um eine Vollbreitenbox.
- Es gibt keine Persistenz-, API-, Mobile- oder Infrastrukturbetroffenheit.

### Dokumentierte Divergenz im Arbeitsbaum

Der Nutzerkontext nennt als vorherigen B-VF-1-Stand `BARBELL_Y ungefähr 1029`. Der aktuell gelesene Quellstand und die vorhandene `nutrition-layout.test.ts` enthalten dagegen die spätere, abgebrochene Footer-Ausrichtung bei `BARBELL_Y=1089`. Die bisherige Plan-Zielbox `x=88, y=1016, width=904, height=64` ist durch den verbindlichen Inset-Nachtrag ersetzt: `BARBELL_X=128`, `BARBELL_WIDTH=824`, `BARBELL_HEIGHT≈58.336` und `BARBELL_Y≈1018.832`, jeweils aus der Card-Oberkante und dem skalierten SVG-Schaftanker abgeleitet. Der Quellstand bleibt für die aktuelle Implementierungsplanung maßgeblich; die Nutzerbeschreibung ist die Referenz für den Grund der Korrektur.

## 8. Assumptions and Open Questions

### Technische Annahmen

- Das bestehende Hantel-SVG bleibt bei unverändertem `viewBox`, Seitenverhältnis und Spiegelung ausreichend klar, wenn seine vollständige Box uniform skaliert bei `x=128, y≈1018.832, width=824, height≈58.336` gerendert wird.
- `PRO PORTION` bleibt Text in `compose.ts` und wird nicht in das SVG eingebrannt.
- Die Transition kann bis `y=1015` verlängert werden, ohne die obere Photo-Platzierung zu verändern, weil der vorhandene `HERO_HEIGHT` bereits `1015` beträgt und nur der untere Clip sichtbar erweitert wird.
- Die sichtbaren Wortmarkenbounds folgen bei `WORDMARK_Y=1222` wieder dem historischen Rasterkorridor `y=1246..1260`.
- Anti-Aliasing- und Font-Rasterabweichungen werden ausschließlich über die explizit genannten kleinen Pixelkorridore geprüft.

### Open Product Owner Decisions

Keine. Die Nutzeranforderung, der erneute Golden-Vergleich und die vorhandene Implementierung ermöglichen eine eindeutige technische Entscheidung. Die visuelle Nutzerabnahme bleibt ein Abnahme-Gate, ist aber keine offene Planungsfrage.

## 9. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/layout.ts` für Canvas-, Card-, Transition-, Hantel-, Label- und Wortmarkenanker.
- `backend/src/lib/instagramRenderer/compose.ts` für Satori-Elemente, Layer-Reihenfolge und lokale Render-Marker.
- `backend/src/lib/instagramRenderer/transition.ts` für den bestehenden deterministischen Fade-Verlauf.
- `backend/src/lib/instagramRenderer/photo.ts` für den bestehenden Photo-Crop und den unteren Photo-Layer-Clip.
- `backend/src/lib/instagramRenderer/ambient.ts` für das unveränderte vollflächige Ambient-Feld.
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` als bestehendes symmetrisches Asset.
- `backend/src/lib/instagramRenderer/render.ts` für lokale Assets, Fonts, Satori und Resvg.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` und `fixtures/smoke.ts` für visuelle und Null-Highlight-Prüfungen.
- `backend/scripts/render-golden.mjs` für den reproduzierbaren lokalen PNG-Export.
- Sharp-, Vitest- und vorhandene Pixel-Hilfsfunktionen aus `nutrition-layout.test.ts`.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` für historische und neue Messwerte.

## 10. Proposed Technical Solution

### 10.1 Gemeinsamer oberer Footer-Anker

`layout.ts` erhält eine nachvollziehbare Ableitung, bei der die Card-Oberkante der einzige obere Footer-Anker ist:

```text
NUTRITION_FOOTER_TOP_Y = NUTRITION_CARD_Y = 1048
BARBELL_VIEWBOX_WIDTH = 904
BARBELL_VIEWBOX_HEIGHT = 64
BARBELL_CARD_INSET = 40
BARBELL_WIDTH = NUTRITION_CARD_WIDTH - 2 * BARBELL_CARD_INSET = 824
BARBELL_SCALE = BARBELL_WIDTH / BARBELL_VIEWBOX_WIDTH = 0.911504...
BARBELL_HEIGHT = BARBELL_VIEWBOX_HEIGHT * BARBELL_SCALE = 58.336...
BARBELL_X = NUTRITION_CARD_X + BARBELL_CARD_INSET = 128
BARBELL_SHAFT_TOP_OFFSET_Y = 29 * BARBELL_SCALE = 26.434...
BARBELL_SHAFT_HEIGHT = 6 * BARBELL_SCALE = 5.469...
BARBELL_SHAFT_TOP_Y = NUTRITION_FOOTER_TOP_Y - BARBELL_SHAFT_HEIGHT / 2 = 1045.265...
BARBELL_SHAFT_CENTER_Y = NUTRITION_FOOTER_TOP_Y = 1048
BARBELL_Y = BARBELL_SHAFT_TOP_Y - BARBELL_SHAFT_TOP_OFFSET_Y = 1018.832...
PRO_PORTION_CENTER_Y = BARBELL_SHAFT_CENTER_Y = 1048
PRO_PORTION_TOP = PRO_PORTION_CENTER_Y - 28 / 2 = 1034
```

Die bestehende Wertzeile bleibt separat bei `y=1118`. Sie ist nicht mehr der Hantelanker. So wird die konkrete Fehlinterpretation des überholten Footer-Plans ausgeschlossen.

### 10.2 Verlängerte Bild-/Transition-Zone

- `PHOTO_TRANSITION_START_Y=574` bleibt unverändert.
- `PHOTO_TRANSITION_END_Y` wird auf `1015` gesetzt beziehungsweise auf `HERO_HEIGHT` ausgerichtet.
- `createPhotoLayer()` clippt die sichtbare Fotozone bis zum neuen Ende; die Cover-Berechnung, Fotoquelle, Fokus und Zoom bleiben unverändert.
- `createTransitionLayer()` nutzt denselben neuen Endanker und behält die vorhandene deterministische Alpha-Kurve bei. Eine Kurvenänderung ist nur als begrenzte technische Feinjustierung zulässig, falls die PNG-Prüfung am neuen Übergangsende eine harte Kante nachweist.
- Der Bereich `y=978..1015` wird damit nicht als unkontrollierte leere Lücke, sondern als verlängerter Bild-/Transition-Auslauf behandelt. Card, Titel, Tags, Badge und Wortmarke werden nicht durch einen gemeinsamen Container-Shift bewegt.

### 10.3 Card, Hantel und Label

- `createNutritionCard()` behält Card-Hintergrund, Radius, Border, `overflow: hidden`, Wertzeile und Divider.
- `createBarbellHeader()` bleibt ein absoluter Root-Sibling bei `x=128, y≈1018.832, width=824, height≈58.336`. `width / height` muss exakt dem SVG-Verhältnis `904 / 64` entsprechen; `BARBELL_X + BARBELL_WIDTH / 2` muss `540` ergeben.
- `createProPortion()` bleibt ein absoluter Root-Sibling nach der Hantel. Seine Layoutbox wird aus `PRO_PORTION_CENTER_Y=1048` abgeleitet.
- Card, Hantel und Label können dadurch in der Root-Z-Order die obere Linie visuell gemeinsam bilden, ohne die Hantel in einen beschneidenden Card-Container einzubetten.
- `PRO PORTION` setzt ausschließlich Textfarbe, Font, Größe, Ausrichtung und Text. `backgroundColor`, `background`, `border` und `boxShadow` bleiben undefiniert.
- Lokale `data-render-node`-Marker für Card, Wertzeile, Divider, Hantel, Label und Wortmarke bleiben oder werden so stabilisiert, dass QA die Struktur prüfen kann. Diese Marker sind keine öffentliche API.

### 10.4 Wortmarke und übrige Gestaltung

- Die Wortmarke wird mit unverändertem Asset und `WORDMARK_Y=1222` als historische/etablierte Baseline geprüft.
- Foto, Titel, Tags, Badge und Nährwertdaten bekommen keine neue relative Position.
- `ambient.ts` wird nur darauf geprüft, dass es die verlängerte Transition und die Card nicht mit einem neuen opaken Rechteck überdeckt; eine Ambient-Neugestaltung ist nicht Bestandteil des Plans.

### 10.5 Asset-Grenze

Das SVG wird strukturell auf `viewBox`, lokale Schaftkoordinaten, Spiegelung und vollständige Platten geprüft. Die Renderbox wird uniform aus `BARBELL_SCALE=824/904` abgeleitet; `object-fit: cover`, nicht-proportionale Skalierung und Clipping sind ausgeschlossen. Eine Assetänderung ist nur zulässig, wenn der unbeschnittene, proportional skalierte Render mit einem reproduzierbaren Pixelbefund trotz korrekter Position nicht lesbar ist. In diesem Ausnahmefall bleiben `viewBox="0 0 904 64"`, Symmetrie, lokale Schaftposition und Zielanker erhalten; eine neue Abhängigkeit oder ein neues Produktmotiv ist ausgeschlossen.

### 10.6 Bewusste Golden-/Referenz-Entscheidung

- `fittrack_instagram_golden_v1_7_unified_ambient.png` bleibt unverändert als historische räumliche Referenz erhalten.
- `golden.test.ts` bleibt mit `pixelmatch`-Threshold `0.10` und `0.03`-Differenzgate unverändert. Kein Testwert wird angehoben, um die neue Gestaltung künstlich grün zu machen.
- Der historische Pixelvergleich wird in dieser Layoutiteration ausgeführt und sein Ergebnis als historischer Diagnosebefund dokumentiert. Er ist wegen der ausdrücklich gewünschten Transition-/Footer-Abweichung nicht das blockierende Pixel-Gate für diese neue Gestaltung.
- Das blockierende automatisierte Gate für diese Iteration sind die strukturellen/geometrischen Nutrition-Assertions, der Null-Highlight-Smoke-Test, Typecheck, Build-Verify und die Prüfung der unveränderten Randbereiche.
- Eine aktuelle Referenzdatei wie `test-fixtures/reference/fittrack_instagram_current_approved.png` wird in dieser Iteration nicht vor Nutzerabnahme erzeugt.
- Erst nach `ACCEPTED` durch den Nutzer darf der Orchestrator den Referenz-Promotion-Schritt aus dem Vorgängerplan wieder aufnehmen. Dann wird die akzeptierte Datei zur aktuellen Referenz und ein aktueller Referenztest kann als nachgelagertes Pixel-Gate eingerichtet werden.

## 11. Affected Files and Minimal Change Boundary

| Datei | Geplante Behandlung | Minimalgrenze |
|---|---|---|
| `backend/src/lib/instagramRenderer/layout.ts` | Gemeinsame Footer-/Schaft-/Label-/Transition-Anker, `BARBELL_CARD_INSET`, uniform skalierte Hantelbreite/-höhe und stabile Wortmarkenbaseline definieren | Keine allgemeine Layout-Neuberechnung; keine Vollbreiten-Hantel |
| `backend/src/lib/instagramRenderer/compose.ts` | Card, kleinere zentrierte Hantel und Label auf gemeinsame obere Card-Linie ausrichten; Z-Order und Marker erhalten | Keine Änderung an Fotoquelle, Titel, Tags, Badge oder Nährwertwerten; keine nicht-proportionale SVG-Skalierung |
| `backend/src/lib/instagramRenderer/transition.ts` | Transition-Ende bis `y=1015` nachvollziehbar verwenden | Alpha-Kurve nur bei konkretem Kantenbefund ändern |
| `backend/src/lib/instagramRenderer/photo.ts` | unteren Photo-Layer-Clip an neuen Endanker anpassen | Cover-Crop, Fokus, Zoom und obere Position unverändert |
| `backend/src/lib/instagramRenderer/ambient.ts` | prüfen, voraussichtlich unverändert | Keine neue Ambient-Komposition |
| `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` | prüfen, voraussichtlich unverändert | `viewBox`, Symmetrie und Seitenverhältnis erhalten |
| `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` | Überholte Assertions auf gemeinsame y-Ebene, kleinere zentrierte Hantelbox, sichtbare linke/rechte Insets, vollständige vertikale Sichtbarkeit und Footer-Abstände umstellen | Kein historischer Threshold-Workaround und keine breite Toleranz für die Inset-Relation |
| `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` | unverändert ausführen und Ergebnis historisch klassifizieren | Keine Schwellenänderung und kein stilles Löschen |
| `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` | unverändert ausführen, Footer-Gleichheit im Null-Highlight-Fall absichern | Kein neuer Produktzustand |
| `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` | unverändert verwenden | Kein neues Rezeptfixture |
| `backend/output/quarkbroetchen.png` | nach Backend-Umsetzung neu erzeugen | Arbeitsartefakt, keine Referenzpromotion |
| `backend/src/lib/instagramRenderer/docs/golden-metrics.md` | historische und neue Footer-Messwerte getrennt ergänzen | Historische Zahlen nicht überschreiben |
| `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` | QA erstellt neuen dauerhaften Report | Vorgängerreports nicht überschreiben |
| `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` | dieser Plan | Keine Änderung an bestehenden User Stories oder Vorgängerplänen |

## 12. Backend Work Package

### B-FA-1 - Footer-Geometrie an der Card-Oberkante ausrichten

**Agent:** Backend

**Goal**

Die abgelehnte Wertzeilen-/Header-Interpretation durch eine gemeinsame Card-Oberkanten-Geometrie ersetzen, die Bild-/Transition-Lücke verkürzen, die kleinere Hantelbox mit sichtbarem beidseitigem Inset vollständig und ohne Clip rendern, `PRO PORTION` transparent halten und ein neues PNG für die manuelle Abnahme erzeugen.

**Required Knowledge Base:**

- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/transition.ts`
- `backend/src/lib/instagramRenderer/photo.ts`
- `backend/src/lib/instagramRenderer/ambient.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/scripts/render-golden.mjs`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/output/quarkbroetchen.png`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md`

**Required Skills:**

None.

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-14

**Dependencies:**

- Dieser automatisch freigegebene Plan.
- Kein Azure-, Mobile-, Shared- oder Infrastruktur-Handoff.
- Keine aktuelle freigegebene Referenzdatei erforderlich.

**Expected Handoff:**

- `layout.ts` enthält die benannten Zielanker `PHOTO_TRANSITION_END_Y=1015`, Card-Oberkante `1048`, Schaftmitte `1048`, `BARBELL_CARD_INSET=40`, `BARBELL_X=128`, `BARBELL_WIDTH=824`, `BARBELL_HEIGHT≈58.336`, `BARBELL_Y≈1018.832`, Labelmitte `1048` und Wortmarkenbaseline `1222` oder dokumentiert einen innerhalb der Plan-Korridore begründeten Befund.
- `compose.ts` rendert Card, Wertzeile, Divider, kleinere zentrierte Hantel, Label und Wortmarke in der festgelegten Root-Z-Order; Hantel und Label hängen nicht vom Card-Clip ab, und die Renderbox bewahrt das `904:64`-Verhältnis.
- `PRO PORTION` zeichnet keine opake Fläche und bleibt exakt lesbar.
- `backend/output/quarkbroetchen.png` ist als `1080 x 1350` PNG neu erzeugt und bereit für die Nutzerabnahme.
- `golden-metrics.md` trennt historische Golden-Messwerte von den neuen Arbeitswerten.
- Der Handoff benennt explizit unveränderte Bereiche und bestätigt, dass keine aktuelle Referenz promoted wurde.

## 13. Frontend Work Package

**None.** Es gibt keine Änderung an `mobile/`, React Native, Navigation, API-Client, `shared/` oder Native-Build-Konfiguration.

## 14. QA Work Package

### Q-FA-1 - Fokussierte Footer-Alignment-Regression

**Agent:** QA

**Goal**

Den abgebrochenen beziehungsweise überholten Layouttest auf die neue Nutzeranforderung ausrichten und die räumliche Beziehung von Transition, Card, kleiner zentrierter Hantel, `PRO PORTION`, Nährwertzeile und Wortmarke strukturell sowie im PNG prüfen. Der Test muss ausdrücklich nachweisen, dass die äußersten sichtbaren Platten links und rechts innerhalb der Nutrition Card liegen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-FA-1-Handoff
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/transition.ts`
- `backend/src/lib/instagramRenderer/photo.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/output/quarkbroetchen.png`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`

**Required Skills:**

None.

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-14

**Dependencies:**

- B-FA-1 muss die neue Geometrie und das Arbeits-PNG übergeben.
- Der bisherige QA-Lauf gilt nicht als erfolgreich; seine Testdatei ist nur Ausgangsmaterial.

**Expected Handoff:**

- `nutrition-layout.test.ts` schützt Card-Oberkante, gemeinsame Schaft-/Label-Achse, kleinere `824 x≈58.336`-Hantelbox, sichtbare linke/rechte Mindest-Insets von `40 px`, horizontale Zentrierung/Symmetrie, vollständige vertikale Sichtbarkeit, Label-Transparenz, Wertzeile, Wortmarke und Abstandsfolge.
- Der Test bestätigt für Highlight- und Null-Highlight-Fall, dass Card-/Footer-Anker nicht durch das Badge verändert werden.
- QA liefert die gemessenen sichtbaren Bounds, Testkommandos, Exit-Codes und konkrete Findings an den Orchestrator.
- Ein Clipping, ein sichtbarer Plattenrand an der Cardkante, eine unsymmetrische Hantelbox, eine Labelbox, eine Schaftachse außerhalb der Card-Oberkante oder eine unzulässige Footer-Lücke ist Blocking und geht an Backend zurück.

### Q-FA-2 - Finale QA-Prüfung und Nutzerabnahme-Gate

**Agent:** QA

**Goal**

Die vollständige Folgeänderung gegen alle Acceptance Criteria prüfen, den historischen Golden-Vergleich korrekt als diagnostischen Altstand einordnen, den neuen PNG-Render für die manuelle Abnahme dokumentieren und die Referenzpromotion ausdrücklich blockiert halten, bis der Nutzer `ACCEPTED` bestätigt.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-FA-1-Handoff
- Q-FA-1-Handoff
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/output/quarkbroetchen.png`
- `backend/package.json`
- `backend/vitest.config.mts`
- `docs/qa/reports/README.md`

**Required Skills:**

None.

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-13
- AC-14
- AC-15

**Dependencies:**

- Q-FA-1 ohne ungelöstes Blocking Finding.
- Das Arbeits-PNG wurde nach der Backend-Änderung neu erzeugt.
- Die Nutzerabnahme kann zum Prüfzeitpunkt noch `MANUAL VALIDATION REQUIRED` sein; diese Abnahme darf nicht stillschweigend als erteilt gelten.

**Expected Handoff:**

- QA-Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` im Format `fittrack-qa-v1`.
- Vollständige Kriterienmatrix für AC-1 bis AC-15, Testkommandos mit Exit-Code, getrennte Abschnitte für `UNVERIFIED` und `MANUAL VALIDATION REQUIRED` sowie strukturierte Findings.
- Explizite Einstufung des historischen V1.7-Vergleichs als unveränderten diagnostischen Altstand; keine Schwellenlockerung.
- Ergebnis der Nutzerabnahme als `ACCEPTED` oder konkrete visuelle Ablehnung. Ohne `ACCEPTED` bleibt die Referenzpromotion blockiert.
- Bei `ACCEPTED` ein Handoff an den Orchestrator, den Referenz-Promotion-Schritt aus dem Vorgängerplan wieder aufzunehmen; QA erstellt die aktuelle Referenz nicht eigenmächtig vor diesem Gate.

## 15. Shared Package Changes

Keine. `shared/` bleibt unverändert.

## 16. Infrastructure and Configuration

Keine. Es gibt keine Azure Function, keine Bicep-, Cosmos-, Storage-, Environment-, Deployment- oder Mobile-Build-Aktion. Die Prüfung läuft lokal im Backend-Paket. Development wird über Vitest, Typecheck, Build-Verify und den lokalen Render geprüft; Alpha und Production sind nicht betroffen.

## 17. Documentation Updates

- Dieser Plan wird als eigenständiges Artefakt unter `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` geführt.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` erhält nach der Umsetzung einen Abschnitt für die neue Footer-Ziel- und Ist-Geometrie. Historische V1.7-Werte, der alte B-VF-1-Wert und der abgebrochene Zwischenstand werden klar voneinander getrennt und nicht überschrieben.
- QA erstellt den separaten Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` und überschreibt keine Vorgängerreports.
- Der Orchestrator pflegt bei Findings das zentrale `docs/qa/findings.md`; QA schreibt dieses Register nicht direkt.
- `docs/kb/` wird nicht geändert, weil keine Architektur-, API-, Domänen- oder Laufzeitentscheidung des Knowledge Base geändert wird.
- Die bestehenden Pläne `PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` und `PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md` bleiben als historische Planung erhalten und werden nicht umgeschrieben.

## 18. Test Strategy

### 18.1 Fokussierter struktureller und geometrischer Test

`nutrition-layout.test.ts` muss mindestens Folgendes prüfen:

1. **Canvas und Rendervertrag:** `ok=true`, PNG, `1080 x 1350`, Buffer und unveränderte Fixture-Werte.
2. **Photo-/Transition-Ende:** `PHOTO_TRANSITION_END_Y=1015` beziehungsweise ein dokumentierter Wert im Korridor; `TAG_ROW_Y`, Titel und Badge bleiben unverändert.
3. **Card:** `x=88, y=1048, w=904, h=144`, `overflow: hidden`, `COLOR_PANEL`, Border und Radius bleiben unverändert.
4. **Wertzeile:** `x=120, y=1118, w=840, h=64`, Divider `x=330/540/750`, Reihenfolge `250 kcal / 14 g / 31 g / 8 g`.
5. **Hantelstruktur und Inset:** Die Hantel ist Root-Sibling nach der Card. Ihre Renderbox hat `BARBELL_X=128`, `BARBELL_WIDTH=824`, `BARBELL_HEIGHT=824*64/904≈58.336` und `BARBELL_Y≈1018.832`; damit ist sie kleiner als `NUTRITION_CARD_WIDTH=904`, horizontal auf `x=540` zentriert und auf beiden Seiten mindestens `40 px` von der Cardkante entfernt. Das gerenderte Verhältnis `width / height` entspricht exakt `904 / 64`; `object-fit: cover`, nicht-proportionale Skalierung und Card-Clipping sind ausgeschlossen.
6. **Hantelpixel und Symmetrie:** Beide Plattenseiten haben vollständige, symmetrische Metallpixel. Die linke sichtbare Metallgrenze liegt mindestens bei `x=128` und die rechte höchstens bei `x=952` beziehungsweise beide mindestens `40 px` innerhalb der geometrischen Cardkanten; die linken/rechten Inset-Messwerte weichen höchstens `1 px` voneinander ab. Die sichtbare Plattenoberkante liegt wegen der uniformen Skalierung ungefähr bei `y=1025`; der sichtbare Plattenbereich ist vertikal vollständig und die Schaftpixel liegen ungefähr bei `y=1045..1051` mit Mitte `y=1048`.
7. **Gemeinsame obere Ebene und Label:** `PRO PORTION` ist exakt, limefarben, im Hantel-Mittelspalt und vertikal um höchstens `2 px` von `y=1048` entfernt. Die Schaftmittelachse und die sichtbare Labelmittelachse teilen diese obere Card-Linie; die Label-Randpixel folgen dem darunterliegenden Card-/Ambient-Pixel. Es gibt keine opake Fläche, Border oder Schatten.
8. **Footer-Abstände:** Transition-Ende/Card-Oberkante, sichtbarer Plattenanfang/Card-Oberkante, Card-Unterkante/Wortmarkenbox und Wortmarkenbox/Canvas-Unterkante entsprechen Abschnitt 5.2; insbesondere bleiben die Transition-Card-Lücke bei ungefähr `33 px` und die Inset-/Symmetrie-Relationen unverändert über die Zustände.
9. **Unveränderte Zustände:** Highlight-Fixture und `nutritionHighlight: null` verwenden dieselben Card-, Wertzeilen- und Wortmarkenanker; das Badge darf den Footer nicht verschieben.

Assertions dürfen nicht durch breite Korridore oder das Entfernen der fehlschlagenden Relation ersetzt werden. Wenn ein konkreter Rasterbefund eine Feinjustierung erfordert, wird die benannte Layoutkonstante geändert, die Zieltabelle aktualisiert und derselbe fokussierte Test erneut ausgeführt.

Die Inset-Prüfung muss sowohl die Compose-Geometrie als auch gerenderte Pixel abdecken: `BARBELL_WIDTH < NUTRITION_CARD_WIDTH`, `BARBELL_X - NUTRITION_CARD_X = 40`, `NUTRITION_CARD_X + NUTRITION_CARD_WIDTH - (BARBELL_X + BARBELL_WIDTH) = 40`, Boxmitte `540` und sichtbare Metallbounds innerhalb derselben Grenzen. Ein Test, der nur die alte volle `904 x 64`-Box oder nur die Labelposition prüft, erfüllt diese Anforderung nicht.

### 18.2 Historischer Golden-Test als bewusster Diagnosepfad

- `golden.test.ts` wird unverändert ausgeführt, wenn der Backend-Testlauf dies umfasst.
- `PIXELMATCH_THRESHOLD=0.1` und `MAX_DIFFERING_PIXEL_RATIO=0.03` bleiben exakt erhalten.
- Die historische Datei bleibt unverändert.
- Ein Ergebnis über dem alten Gate wird als erwartbare historische Abweichung der bewusst verlängerten Transition und neu ausgerichteten Footer-Zone dokumentiert. Es ist kein Anlass, Schwellen stillschweigend zu lockern.
- Dieser Test ist in dieser Iteration kein blockierendes Pixel-Gate für die neue Gestaltung. Das blockierende Gate sind die neuen strukturellen/geometrischen Assertions und die unveränderten Renderer-Smoke-/Vertragsprüfungen.
- Nach manueller Nutzerabnahme darf ein separater Vorgänger-Schritt eine aktuelle Referenz erzeugen. Erst diese aktuelle Referenz kann nachgelagert wieder als blockierendes Pixel-Gate dienen.

### 18.3 Auszuführende Kommandos

Nach dem Backend-Handoff:

- `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts`
- `cd backend && npx tsc --noEmit`
- `cd backend && npm run build:verify`
- `cd backend && npm run render:instagram-reference`

Im finalen QA-Lauf zusätzlich:

- `cd backend && npm test`

Der historische Golden-Test darf bei der Bewertung dieser neuen Layoutiteration diagnostisch über dem alten Gate liegen; der Testlauf und sein Exit-Code werden trotzdem vollständig dokumentiert. Eine aktuelle Referenzdatei wird vor manueller Abnahme weder angelegt noch aus dem Arbeits-PNG abgeleitet.

### 18.4 Manuelle Nutzerabnahme

Nach dem neuen Render öffnet der Nutzer `backend/output/quarkbroetchen.png` bei 100 Prozent oder ausreichend hoher Darstellung und prüft:

- Hantelstange und exakt lesbares `PRO PORTION` liegen auf einer Ebene mit der oberen Linie der gesamten Nutrition Card.
- Die Gruppe wirkt nicht wie ein höher schwebender Header und liegt nicht in einer separaten Zone über der Box.
- Beide Plattenstapel sind vollständig und symmetrisch sichtbar; kein Card-Clipping und keine abgeschnittene SVG-Kante.
- Die äußersten sichtbaren Platten liegen links und rechts klar innerhalb der Nutrition-Box und berühren deren Außenkanten nicht. Der Abstand wirkt auf beiden Seiten gleich und entspricht der festgelegten `40 px`-Inset-Geometrie; die Hantel wirkt nicht wie ein vollbreiter Content-Layer.
- Die sichtbare Distanz vom Bild-/Transition-Ende zur Card ist gegenüber dem abgelehnten Zwischenstand reduziert.
- Card, Werte, Divider, Titel, Tags, Badge und Wortmarke bleiben in Inhalt und räumlicher Wirkung intakt.
- Hinter und neben `PRO PORTION` ist keine schwarze oder sonstige opake Rechteckfläche sichtbar.
- Die Wortmarke bleibt zentriert, ohne neue harte Kante oder ungewollte vertikale Verschiebung.

Das Resultat wird als `ACCEPTED` oder mit einer konkreten visuellen Ablehnung dokumentiert. Nur `ACCEPTED` erlaubt die spätere Referenzpromotion aus dem Vorgängerplan.

## 19. Acceptance Criteria

- **AC-1:** `renderInstagramRecipe(input)` und sein bestehender Input-/Result-Vertrag bleiben unverändert. Es entsteht kein HTTP-, Auth-, Cosmos-, Storage-, Mobile-, Shared- oder Infrastructure-Code.
- **AC-2:** Der Renderer erzeugt weiterhin ein deterministisches PNG mit exakt `1080 x 1350` Pixeln; `backend/scripts/render-golden.mjs` bleibt nutzbar.
- **AC-3:** Der sichtbare Bild-/Transition-Bereich endet im Ziel bei `y=1015` beziehungsweise nur innerhalb des ausdrücklich dokumentierten `+/-4 px`-Korridors. Die Card-Oberkante bleibt bei `y=1048`, sodass der Abstand zwischen Transition-Ende und Card ungefähr `33 px` und nicht mehr ungefähr `70 px` beträgt. Foto-Crop, Fokus und Zoom ändern sich nicht.
- **AC-4:** Die Nutrition Card bleibt bei `x=88, y=1048, width=904, height=144` und endet bei `y=1192`; Hintergrund, Border, Radius und Card-Clipping für interne Inhalte bleiben erhalten.
- **AC-5:** Wertzeile und Divider bleiben bei `x=120, y=1118, width=840, height=64` und `x=330/540/750`, enthalten weiterhin `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett` und die unveränderten gerundeten Fixture-Werte.
- **AC-6:** Die Hantel wird vollständig als Root-Sibling in einer kleineren, horizontal zentrierten Box bei `x=128, y≈1018.832, width=824, height≈58.336` gerendert. `BARBELL_WIDTH` ist strikt kleiner als `NUTRITION_CARD_WIDTH`; die linke und rechte Assetkante liegen geometrisch exakt `40 px` innerhalb der Nutrition-Card-Kanten (`x=88..992`), die Boxmitte liegt bei `x=540`, und `width / height` entspricht exakt dem SVG-Verhältnis `904 / 64`. Der SVG-Rand wird weder durch `overflow: hidden` noch durch `object-fit: cover` beschnitten; beide Seiten bleiben gespiegelt.
- **AC-7:** Die äußersten sichtbaren linken und rechten Plattenpixel liegen jeweils mindestens `40 px` innerhalb der linken beziehungsweise rechten Nutrition-Card-Kante und ihre beiden Inset-Messwerte weichen höchstens `1 px` voneinander ab. Beide Plattenstapel sind vertikal vollständig sichtbar; der sichtbare Metallbereich liegt ungefähr bei `y=1025..1071`, der skalierte Schaft ungefähr bei `y=1045.265..1050.735`, und seine Mitte liegt bei `y=1048` auf der oberen Card-Linie. Kein SVG-Rand oder Plattenbereich wird geclippt.
- **AC-8:** `PRO PORTION` wird exakt, limefarben, horizontal im Hantel-Mittelspalt zentriert und mit sichtbarer Mittelachse bei `y=1048` gerendert. Die Textmittelachse teilt sich mit der Schaftmittelachse die obere Nutrition-Box-Ebene; die sichtbaren Textbounds bleiben ungefähr bei `x=471..607, y=1040..1053`; maximal `+/-3 px` Rasterabweichung ist zulässig.
- **AC-9:** Hinter `PRO PORTION` wird keine opake Fläche, kein Border und kein Schatten gerendert. Randpixel des Labelbereichs folgen der darunterliegenden Card-/Ambient-Fläche; eine schwarze oder einfarbige Box ist ausgeschlossen.
- **AC-10:** Die Wortmarke bleibt als unverändertes Asset zentriert und verwendet die stabile Layoutbox `x=475, y=1222, width=130, height=62` mit sichtbaren Bounds ungefähr `x=493..588, y=1246..1260`. Card-Unterkante, Wortmarkenbox und Canvas-Unterkante erfüllen `1192 -> 1222 -> 1284 -> 1350`; zusätzlich bleiben Transition-Ende `1015` -> Card-Oberkante `1048` ungefähr `33 px` sowie die `40 px`-Hantel-Insets und die sichtbare Platten-/Footer-Zone gemäß Abschnitt 5.2 erhalten.
- **AC-11:** Titel, Tags, Highlight-Badge, Foto-Platzierung, Card-Inhalt und Wortmarke werden durch die Footer-Korrektur nicht unbeabsichtigt verschoben oder beschädigt. Der Highlight-Fall und der `nutritionHighlight: null`-Smoke-Fall bleiben renderbar.
- **AC-12:** `nutrition-layout.test.ts` schützt die neuen strukturellen, horizontalen und vertikalen gerenderten Pixelrelationen: kleinere `824 x≈58.336`-Box, beidseitige `40 px`-Insets, Zentrierung/Symmetrie, vollständige Platten, gemeinsame Schaft-/Label-/Card-Oberkante, verkürzte Transition-Card-Lücke und Footer-Abstände. Der abgebrochene QA-Lauf und seine alten `y=1089/1118`-Assertions werden nicht als erfolgreiche Abnahme behandelt.
- **AC-13:** `golden.test.ts` bleibt mit Threshold `0.10` und Differenz-Gate `0.03` unverändert. Eine Abweichung zur historischen Golden-Datei wird weder durch Schwellenaufweitung akzeptiert noch als stiller Produktionsfehler gegen die neue, ausdrücklich gewünschte Footer-Komposition bewertet; das Ergebnis wird als historischer Diagnosebefund dokumentiert.
- **AC-14:** `golden-metrics.md` dokumentiert historische V1.7-Werte, den abgelehnten Zwischenstand und die neue Ziel-/Ist-Geometrie getrennt. QA erstellt den separaten Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md` mit vollständiger AC-Matrix, Testausgängen, `UNVERIFIED`, `MANUAL VALIDATION REQUIRED` und strukturierten Findings.
- **AC-15:** Vor ausdrücklicher manueller Nutzerabnahme wird keine aktuelle Referenzdatei erzeugt oder promoted. Erst ein dokumentiertes `ACCEPTED` erlaubt dem Orchestrator, den Referenz-Promotion-Schritt aus dem Vorgängerplan aufzunehmen.

## 20. Risks and Edge Cases

- **Schaft und Card-Linie werden verwechselt:** Die relevante Zielrelation ist die Schaftmittelachse bei `y=1048`, nicht `BARBELL_Y` als obere SVG-Boxkante und nicht die Wertzeilen-Oberkante `y=1118`. Der Test muss beide Relationen getrennt ausweisen.
- **Hantel wird erneut geclippt:** Die Card bleibt `overflow: hidden`, daher sind Root-Sibling-Struktur und Pixelprüfung verpflichtend. Ein erneutes Card-Kind mit abgeschnittenen Platten ist Blocking.
- **Hantel bleibt vollbreit:** Ein bloßer `x`-Shift oder ein transparenter Rand im SVG genügt nicht. Die gerenderte Box muss `width=824 < 904`, `x=128`, beidseitig `40 px` inset und auf `x=540` zentriert sein. Sichtbare Platten an oder nahe den Cardkanten sind ein Blocking-Finding.
- **Nicht-proportionale Skalierung:** Die kleinere Box darf das SVG nicht horizontal stauchen oder vertikal beschneiden. `BARBELL_HEIGHT` muss aus `BARBELL_WIDTH * 64 / 904` abgeleitet und der lokale Schaftanker mit demselben Faktor skaliert werden; Rundung darf nur im Rastertest, nicht in der Renderbox erfolgen.
- **Label passt nicht mehr in den Mittelspalt:** Durch die kleinere Hantel wird der Mittelspalt enger. QA muss prüfen, dass `PRO PORTION` weiterhin vollständig lesbar, horizontal zentriert und von den beiden Schaftseiten nicht überlagert wird; eine opake Abdeckfläche ist kein zulässiger Ausweg.
- **Label wird durch eine Abdeckfläche lesbar gemacht:** Eine opake Fläche würde die Nutzeranforderung verletzen. Lesbarkeit muss durch Position, Z-Order und bestehende Font-/Asset-Geometrie erreicht werden.
- **Transition-Verlängerung verschiebt Foto-Inhalt:** Die Photo-Platzierung darf nicht neu berechnet oder global verschoben werden. Nur der untere Clip-/Fade-Abschluss wird verlängert; obere Pixel, Titel, Tags und Badge werden gezielt geprüft.
- **Footer wird nur lokal verschoben:** Card, Wertzeile, Hantel, Label und Wortmarke müssen als Abstandsfolge geprüft werden. Eine isolierte `PRO_PORTION_Y`-Korrektur ohne Gesamtvermessung ist nicht ausreichend.
- **Wortmarke bleibt auf dem abgebrochenen Wert:** `WORDMARK_Y=1238` stammt aus dem überholten Zwischenplan. Wenn dieser Wert im Arbeitsbaum vorhanden ist, muss Backend die stabile `1222`-Baseline wiederherstellen oder einen konkreten gegenteiligen Pixelbefund dokumentieren.
- **Historischer Golden-Test liegt über dem alten Gate:** Das ist nach Nutzeranweisung kein Anlass, den neuen Layoutplan zu blockieren. Der Schwellenwert darf trotzdem nicht gelockert werden; der Befund wird als historischer Diagnose-/Unverifiziert-Status dokumentiert.
- **Cross-Platform-Rasterung:** Unterschiede von Satori/Resvg außerhalb der lokalen Umgebung werden als `UNVERIFIED` dokumentiert, nicht durch breitere Layoutkorridore kaschiert.
- **Manuelle Abnahme fehlt:** Ohne `ACCEPTED` bleibt die aktuelle Referenzpromotion blockiert. Das ist ein Gate-Status und kein stillschweigend geschlossener Finding.

## 21. Findings-Behandlung

- QA bewertet die Umsetzung gegen die Acceptance Criteria dieses Plans und behandelt den abgebrochenen QA-Lauf nicht als erfolgreich.
- Falsche Card-/Schaft-/Label-Ebene, sichtbares Hantel-Clipping, ein fehlender beidseitiger `40 px`-Inset, eine unsymmetrische oder weiterhin vollbreite Hantelbox, eine opake Labelbox, die alte große Transition-Lücke oder eine unbeabsichtigte Verschiebung von Card/Wertzeile/Wortmarke sind `Blocking`, Owner `Backend`.
- Ein fehlender oder fehlschlagender fokussierter Regressionstest ist `Blocking`, wenn dadurch die Nutzeranforderung nicht prüfbar ist.
- Eine Abweichung zum historischen V1.7-PNG ist kein Finding gegen die neue Gestaltung, sofern sie durch die ausdrücklich erlaubte Transition-/Footer-Änderung entsteht und die neuen geometrischen Kriterien erfüllt sind. Sie darf aber nicht durch eine Threshold-Änderung versteckt werden.
- Nicht ausgeführte Cross-Platform-, CI- oder manuelle Checks werden als `UNVERIFIED` oder `MANUAL VALIDATION REQUIRED` außerhalb der Findings-Liste dokumentiert.
- Die Nutzerablehnung des PNGs wird mit konkreter visueller Beobachtung an Backend zurückgegeben. Ohne `ACCEPTED` darf keine aktuelle Referenz promoted werden.
- QA erstellt den neuen Report; der Orchestrator pflegt das zentrale Findings-Register.

## 22. Recommended Execution Order and Handoffs

Die Ausführung erfolgt strikt sequenziell:

1. **Planfreigabe:** Dieser Plan gilt gemäß Nutzeranweisung als `APPROVED`; es besteht keine offene fachliche Frage.
2. **Backend B-FA-1:** Transition-/Photo-Ende, Card-Oberkantenanker, kleinere zentrierte Hantelbox (`BARBELL_CARD_INSET=40`, `824 x≈58.336`, `x=128`), Label und Wortmarkenbaseline gemäß Zielgeometrie umsetzen; Arbeits-PNG erzeugen; Metriken und Handoff übergeben.
3. **QA Q-FA-1:** Den überholten `nutrition-layout.test.ts`-Stand auf die neue Footer-Relation umstellen und die fokussierten Struktur-/Pixeltests für Inset, Zentrierung, Symmetrie, vollständige Sichtbarkeit, gemeinsame obere Ebene und Footer-Abstände ausführen. Blocking Findings gehen an Backend zurück; nach jeder Korrektur wird derselbe fokussierte Lauf erneut ausgeführt.
4. **QA Q-FA-2:** Vollständigen Backend-Testlauf, Typecheck, Build-Verify, Renderprüfung und historischen Golden-Diagnosepfad ausführen; den neuen QA-Report schreiben. Der historische Pixelbefund darf nicht durch Threshold-Änderung repariert werden.
5. **Manuelle Nutzerabnahme:** Nutzer prüft `backend/output/quarkbroetchen.png` gegen Abschnitt 18.4. Bei Ablehnung geht die konkrete Beobachtung an B-FA-1 zurück. Bei `ACCEPTED` wird die Freigabe dokumentiert.
6. **Referenzpromotion nach Gate:** Erst nach `ACCEPTED` darf der Orchestrator den Referenz-Promotion-Schritt aus `PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` wieder aufnehmen. Vorher bleibt `fittrack_instagram_current_approved.png` unangelegt beziehungsweise unverändert.
7. **Abschluss:** Die Footer-Änderung gilt erst nach erfüllten ACs, abgeschlossenem QA-Report und dokumentierter Nutzerabnahme als abgeschlossen. Die nachgelagerte Referenzpromotion bleibt an dieses Gate gebunden.

## 23. Planstatus

Dieser Plan ist vollständig und implementation-ready. Er ist gemäß Nutzeranweisung automatisch als `APPROVED` zu behandeln und enthält keine offene fachliche Rückfrage. Der verbindliche Nachtrag ersetzt die vorherige Vollbreiten-Hantelzielbox durch die kleinere, uniform skalierte, zentrierte `824 x≈58.336`-Box mit `40 px` Mindest-Inset je Seite. Er schreibt ausschließlich dieses Planartefakt; Produktionscode, Tests, PNG, Metriken und QA-Report entstehen erst in den beschriebenen Work Packages. Die aktuelle Referenzpromotion bleibt ausdrücklich bis zur manuellen Nutzerabnahme gesperrt.