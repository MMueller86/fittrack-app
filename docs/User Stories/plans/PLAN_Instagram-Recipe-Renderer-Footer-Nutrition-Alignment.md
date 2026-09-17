# Technischer Folgeplan: FitTrack Instagram Recipe Renderer - Footer-/Nutrition-Ausrichtung

**Status:** Approved for implementation - automatisch freigegeben gemaess Nutzeranweisung; keine offene fachliche Rueckfrage
**Plan-Typ:** Neuer Folgeplan zur gezielten visuellen Korrektur nach abgelehntem B-VF-1/Q-VF-1-Zwischenstand
**Vorgaenger:** [`PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md`](PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md)
Infrastructure Impact: None
Mobile Build Impact: None

**Ausfuehrungsgate:** Dieser Plan darf nach der automatischen Planfreigabe umgesetzt werden. Die visuelle Nutzerabnahme des neu gerenderten PNGs bleibt ein separates Gate. Vor dieser Abnahme darf die im Vorgaengerplan vorgesehene aktuelle Referenz weder erzeugt noch promoted werden. Die historische V1.7-Datei und ihr Threshold werden nicht als neues Gestaltungsziel umgedeutet.

## 1. Requirement Assessment

**Klassifikation:** Accept as proposed

### Nutzerproblem

Der Nutzer akzeptiert den bereits korrigierten Zustand noch nicht. Die Hantel ist zwar nicht mehr am Card-Clip abgeschnitten und `PRO PORTION` zeichnet keine opake Box mehr, aber die vertikale Komposition des Nutrition-Footers wirkt weiterhin falsch:

1. Die Hantelstange und `PRO PORTION` liegen visuell nicht auf derselben horizontalen Ebene.
2. Die Hantelstange ist nicht eindeutig an der oberen Linie der Nährwert-Wertzeile ausgerichtet.
3. Die Abfolge aus Label, Hantel, Wertzeile, Card-Unterkante, Wortmarke und Canvas-Unterkante hat ungleich gewichtete Abstände. Besonders der sichtbare Abstand von `PRO PORTION` zum unteren Bildbereich wirkt zu gross.

### Root-Cause-Hypothese

Die Fehlgewichtung entsteht durch mehrere unabhaengige vertikale Referenzen in `layout.ts` und `compose.ts`, nicht durch einen einzelnen falschen Pixelwert:

- Das SVG hat einen festen Schaftanker bei lokal `y=29..35`, Mittelpunkt `y=32`. Bei `BARBELL_Y=1029` liegt die Schaftmitte daher bei etwa `y=1061`.
- Der aktuelle `PRO_PORTION`-Layoutbereich beginnt bei `1033` (`PRO_PORTION_Y=1036` minus `PRO_PORTION_TOP_OFFSET=3`); die sichtbaren Lime-Pixel liegen ungefaehr bei `y=1040..1053`. Label und Schaft verwenden damit keine gemeinsame Mittelachse.
- Die Wertzeile besitzt in `createNutritionCard()` keinen benannten oberen Anker. Sie wird implizit aus `bottom: 10`, `NUTRITION_DIVIDER_HEIGHT=64` und der Card-Hoehe berechnet: `1048 + 144 - 10 - 64 = 1118`.
- Die Wortmarke wird unabhaengig bei `WORDMARK_Y=1222` platziert. Das Layout-Rechteck endet bei `1284`, die sichtbaren Zeichen liegen assetbedingt ungefaehr bei `y=1246..1260`; zur Canvas-Unterkante `1350` bleibt dadurch ein anderer visueller Restabstand als zwischen Card und Wortmarke.
- Es gibt bisher keine benannten Konstanten fuer Wertzeilen-Oberkante, Schaftanker, Footer-Bottom-Clearance oder die Card-/Wortmarken-Abstaende. Dadurch kann eine Korrektur eines Elements die Gesamtkomposition nicht ausdruecklich absichern.

Die Hypothese ist durch eine lokale, billige Pruefung falsifizierbar: Der fokussierte Test muss den berechneten Wertzeilenanker, die gerenderte Schaftposition, die sichtbare Label-Mittelachse und die unveraenderte Card-/Wortmarken-Geometrie gemeinsam messen. Wenn diese Relationen bereits mit den aktuellen Konstanten innerhalb des unten definierten Korridors liegen, ist keine vertikale Neuberechnung erforderlich; der aktuelle PNG-Befund und die dokumentierten Koordinaten sprechen dagegen.

### Loesungsfit und Produktbewertung

- Die Korrektur bleibt im bestehenden importierbaren Backend-Renderer und veraendert weder API noch Rezeptdaten, Naehrwertlogik oder Produktworkflow.
- Es wird keine fachliche Nutrition-Regel erfunden. Naehrwerte werden nur an einer vorhandenen visuellen Wertzeile angeordnet.
- Die genaue Pixelposition ist eine technische Layoutentscheidung. Der Nutzer hat die visuelle Richtung und die noetige erneute Abnahme eindeutig vorgegeben; eine weitere Product-Owner- oder Domain-Rueckfrage ist nicht erforderlich.
- Die Korrektur folgt dem Produktprinzip der klaren, scanbaren Darstellung, ohne neue Icons, Badges oder Interaktionen einzufuehren.

## 2. Recommended Product Behaviour

Die Rezeptgrafik behaelt Format, Inhalt, Farben, Text und Informationsreihenfolge des aktuellen Zwischenstands. Der Nutrition-Footer wird als zusammenhaengende, deterministische Gruppe behandelt:

- Card, Wertzeile und Divider behalten ihre bestehende Breite, Hoehe und Naehrwertreihenfolge.
- Die Hantel bleibt ein Root-Sibling der Card und wird nicht wieder in einen beschneidenden Card-Kindbereich verschoben.
- Die obere Kante des sechs Pixel hohen Hantel-Schafts liegt exakt auf der oberen Kante der Wertzeile. Die Schaftmittelachse und die Mittelachse des sichtbaren `PRO PORTION`-Textes liegen auf derselben horizontalen Ebene.
- `PRO PORTION` bleibt transparent, limefarben, zentriert und im Mittelspalt der Hantel.
- Die Card-Unterkante, die sichtbare Wortmarke und die Canvas-Unterkante erhalten bewusst definierte, nahe beieinanderliegende Layout-Abstaende. Der Nutzer kann die gesamte Footer-Gruppe als kompakt und ausgewogen beurteilen.

## 3. Feature Summary

Dieser Plan korrigiert ausschliesslich die vertikale Footer-/Nutrition-Geometrie des bestehenden Renderers. Er umfasst:

- explizite vertikale Anker fuer Card, Wertzeile, Divider, Hantel-Schaft und `PRO PORTION`;
- eine nach Canvas-Unterkante abgeleitete Wortmarkenposition;
- eine unveraenderte Card- und Wertdarstellung mit dokumentierter Z-Order;
- aktualisierte relationale Regressionstests statt einer einzelnen Pixelverschiebungsassertion;
- einen neuen PNG-Render fuer die erneute manuelle Nutzerabnahme;
- aktualisierte Renderer-Metriken, QA-Nachweis und strukturierte Findings-Behandlung.

Die Umsetzung erstellt keine aktuelle Golden-/Reference-Datei. Die Referenzpromotion aus dem Vorgaengerplan bleibt bis zur erneuten visuellen Nutzerfreigabe gesperrt.

## 4. Current Behaviour

Der Repository-Zustand nach B-VF-1/Q-VF-1 ist:

- `BARBELL_X=88`, `BARBELL_Y=1029`, `BARBELL_WIDTH=904`, `BARBELL_HEIGHT=64`.
- `NUTRITION_CARD_X=88`, `NUTRITION_CARD_Y=1048`, `NUTRITION_CARD_WIDTH=904`, `NUTRITION_CARD_HEIGHT=144`.
- `createNutritionCard()` setzt weiterhin `overflow: hidden`, rendert die Wertzeile aber als Card-Kind. Die Card beginnt bei `1048` und endet bei `1192`.
- Die Wertzeile liegt implizit bei `y=1118..1182`, weil sie mit `bottom: 10` und `height: 64` innerhalb der Card positioniert wird. Dieser Anker ist nicht als Layoutkonstante benannt und wird im Compose-Baum nicht relational getestet.
- `createBarbellHeader()` rendert die Hantel als Root-Sibling nach der Card. Das bestehende Clipping-Problem ist dadurch behoben; das SVG bleibt `viewBox="0 0 904 64"`.
- Der Schaft des SVG liegt bei global ungefaehr `y=1058..1064`, waehrend die sichtbaren `PRO PORTION`-Pixel ungefaehr bei `y=1040..1053` liegen. Die Ebenen sind daher sichtbar versetzt.
- `createProPortion()` malt keinen Hintergrund, keine Border und keinen Schatten. Diese Korrektur bleibt erhalten.
- `WORDMARK_Y=1222`, `WORDMARK_WIDTH=130`, `WORDMARK_HEIGHT=62`. Die sichtbaren Wortmarken-Pixel liegen im aktuellen Asset ungefaehr bei `x=493..588`, `y=1246..1260`.
- `backend/output/quarkbroetchen.png` ist der aktuelle manuell zu pruefende Renderstand. Er zeigt die Hantel und das Label zwar ohne Box, aber mit zu grosser vertikaler Streckung zwischen Header-Zeile, Wertbereich und Footer-Wortmarke.
- `nutrition-layout.test.ts` prueft derzeit vor allem die alte Relation `NUTRITION_CARD_Y - BARBELL_Y >= 8`, die Transparenz des Labels und symmetrische Plattenpixel. Sie prueft nicht die gemeinsame Schaft-/Label-Mittelachse, die Wertzeilen-Oberkante oder die Card-/Wortmarken-/Canvas-Abstaende.
- `smoke.test.ts` deckt weiterhin den alternativen Render mit `nutritionHighlight: null` ab.
- Der historische V1.7-Golden-Vergleich und die bisherige Referenzpromotion sind nicht das visuelle Ziel dieser Korrektur. Es existiert noch keine aktuelle freigegebene Referenz.

## 5. Desired Behaviour and Target Geometry

### 5.1 Verbindliche Zielkoordinaten

Die folgenden Werte sind die technische Zielgeometrie im `1080 x 1350`-Koordinatensystem. Implementierung darf innerhalb der angegebenen Rastertoleranzen feinjustieren, aber keine andere Layoutstrategie einfuehren.

| Element / Anker | Zielwert | Relation / Abnahme |
|---|---:|---|
| Canvas | `1080 x 1350` | Letzte Pixelzeile ist `y=1349`; Canvas-Unterkante ist die geometrische Linie `y=1350`. |
| Footer-Ambient-Start | `y=1015` | Bestehende Hero-/Footer-Grenze bleibt unveraendert. |
| Nutrition Card | `x=88, y=1048, w=904, h=144` | Card-Unterkante `y=1192`; Card-Geometrie darf nicht durch die Footer-Korrektur verschoben werden. |
| Wertzeile | `x=120, y=1118, w=840, h=64` | `NUTRITION_VALUE_ROW_TOP_Y=1118`, `NUTRITION_VALUE_ROW_BOTTOM_Y=1182`; Ableitung aus Card-Unterkante minus `10 px` Bottom-Padding. |
| Wertspalten | Zentren `x=225, 435, 645, 855` | Vier gleiche Spalten, bestehende Reihenfolge `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett`. |
| Divider | `x=330, 540, 750`, `y=1118..1182` | Drei vertikale Divider, je `1 x 64 px`; keine zusaetzlichen horizontalen Divider. |
| Hantel-Asset | `x=88, y=1089, w=904, h=64` | Root-Sibling; vollstaendiges `904:64`-Verhaeltnis, kein Container-Clipping. |
| Hantel-Schaft | obere Kante `y=1118`, Hoehe `6 px`, Mitte `y=1121` | `BARBELL_SHAFT_TOP_Y === NUTRITION_VALUE_ROW_TOP_Y`; die Schaftmittelachse ist der gemeinsame Header-/Label-Anker. |
| `PRO PORTION`-Layoutbereich | `x=440, y=1107, w=200, h=28` | Bereichsmitte `y=1121`; sichtbare Textmittelachse muss innerhalb `+/-2 px` der Schaftmittelachse liegen. |
| `PRO PORTION`-Pixel | erwartbar etwa `x=471..608`, `y=1114..1127` | Lime-Pixel bleiben im Mittelspalt; Anti-Aliasing-Korridor `+/-3 px`, keine opake Box. |
| Wortmarken-Layoutbox | `x=475, y=1238, w=130, h=62` | `WORDMARK_BOTTOM_CLEARANCE=50`; Layoutbox endet bei `y=1300`. |
| Wortmarke sichtbar | erwartbar etwa `x=493..588`, `y=1262..1276` | Bestehendes Asset bleibt unveraendert; sichtbare Bounds duerfen rasterbedingt um maximal `3 px` abweichen. |
| Canvas-Unterkante | `y=1350` | Layoutbox-Abstand `50 px`; sichtbarer Wortmarken-Restabstand bleibt mit dem bestehenden Asset ungefaehr `72..76 px`. |

Die Wertezeile ist der neue gemeinsame Layoutanker. Die Hantelposition wird nicht als undurchsichtiger negativer CSS-Offset umgesetzt: Der globale `BARBELL_Y` wird aus dem benannten SVG-internen Schaftanker `BARBELL_SHAFT_TOP_OFFSET_Y=29` und `BARBELL_SHAFT_TOP_Y=1118` abgeleitet. Die resultierende Position `y=1089` wird direkt als absolute Root-Position verwendet.

### 5.2 Harmonisierung der Footer-Abstaende

Die Implementierung dokumentiert und testet die folgenden Abstaende als Layoutbeziehungen, nicht nur als visuelle Absicht:

- Tag-Zeilen-Ende `y=974` bis Footer-Ambient-Start `y=1015`: `41 px`, unveraendert.
- Footer-Ambient-Start `y=1015` bis Card-Oberkante `y=1048`: `33 px`, unveraendert.
- Card-Oberkante `y=1048` bis Hantel-Assetbox `y=1089`: `41 px`; die Card bleibt Hintergrund und die Hantel bleibt ein sichtbarer Root-Sibling.
- Card-Unterkante `y=1192` bis Wortmarken-Layoutbox `y=1238`: `46 px`.
- Wortmarken-Layoutbox-Unterkante `y=1300` bis Canvas-Unterkante `y=1350`: `50 px`.
- Card-Unterkante bis sichtbare Wortmarke: im bestehenden Asset ungefaehr `70 px`.
- Sichtbare `PRO PORTION`-Unterkante bis sichtbare Wortmarken-Oberkante: Ziel ungefaehr `134 px`, mit einem Abnahmekorridor von `+/-6 px`. Das reduziert den aktuellen Abstand sichtbar, ohne die Wortmarke an die Card zu pressen.

Diese Beziehungen verhindern, dass nur `PRO_PORTION_Y` oder nur `WORDMARK_Y` verschoben wird. Wenn ein Rasterbefund eine Korrektur erfordert, muss Backend die zugehoerige benannte Beziehung anpassen und die gesamte Tabelle sowie den fokussierten Test aktualisieren.

### 5.3 Z-Order und Clipping

Die Root-Z-Order bleibt explizit und wird im Test ueber Node-Marker oder eine gleichwertige lokale Strukturpruefung abgesichert:

1. gemeinsames Ambient-Feld;
2. Foto;
3. Foto-zu-Dark-Transition;
4. optionales Nutrition-Highlight;
5. Titel;
6. Tag-Zeile;
7. Nutrition Card inklusive Wertzeile und Divider;
8. Hantel-Asset als Root-Sibling ausserhalb des beschneidenden Card-Kindbereichs;
9. transparentes `PRO PORTION` oberhalb der Hantel-/Card-Pixel;
10. FitTrack-Wortmarke als letzter Footer-Layer.

`overflow: hidden` darf nur weiterhin die Card-Inhalte und deren runde Card-Flaeche schuetzen. Hantel und `PRO PORTION` duerfen nicht von diesem Container abhaengen. Es werden keine impliziten negativen Kind-Offsets, keine zusaetzlichen Abdeckrechtecke und kein `object-fit: cover` eingefuehrt.

## 6. Scope

### In Scope

- `layout.ts`: benannte Footer-, Wertzeilen-, Schaftanker- und Wortmarken-Bottom-Konstanten mit den Zielwerten aus Abschnitt 5.
- `compose.ts`: gemeinsame Wertzeilenreferenz, Schaft-/Label-Ausrichtung, Card-/Hantel-/Label-/Wortmarken-Z-Order und lokale Testmarker, falls fuer die relationale Pruefung erforderlich.
- `barbell-header-frame.svg`: strukturelle Pruefung von `viewBox`, Symmetrie und Schaftkoordinaten; eine SVG-Aenderung ist nur bei einem reproduzierbaren Asset-Befund zulaessig und nicht der erwartete Loesungsweg.
- `nutrition-layout.test.ts`: relationale Geometrie, Schaft-/Label-Ebene, Wertzeile, Divider, Card, Wortmarke, Canvas-Unterkante und beide Highlight-Zustaende gezielt pruefen.
- `smoke.test.ts`: unveraendert ausfuehren; nur lokal anpassen, falls neue Marker die bestehende Smoke-Abstraktion beruehren.
- `backend/output/quarkbroetchen.png`: nach der Implementierung mit dem bestehenden Render-Skript neu erzeugen.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`: neue Footer-Ziel- und Ist-Metriken getrennt von historischen V1.7-Werten dokumentieren.
- separater QA-Report fuer diesen Plan unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md`.

### Out of Scope

- Keine neue Produktentscheidung zu Icons, Badges, Rezeptdaten, Portionen oder Naehrwertlogik.
- Keine Aenderung an `renderInstagramRecipe(input)`, Input-/Result-Typen, HTTP, Auth, Quota, Storage, Cosmos oder Azure Functions.
- Keine Aenderung an `mobile/`, `shared/`, `infra/`, Deployment oder Native-Builds.
- Keine allgemeine Neugestaltung von Foto, Transition, Titel, Tags, Highlight-Badge oder Ambient-Feld.
- Keine neue Abhaengigkeit und kein neues Asset-Set.
- Keine Erhoehung des historischen Pixelmatch-Thresholds oder des historischen `3 %`-Differenzgates.
- Keine Erstellung, Ersetzung oder Promotion von `fittrack_instagram_current_approved.png` vor der erneuten visuellen Nutzerabnahme.
- Kein Ueberschreiben des Vorgaengerplans, des historischen V1.7-PNGs oder des bisherigen PoC-QA-Reports.

## 7. Confirmed Facts

- Die Nutzeranforderung ist fachlich hinreichend konkret; die Pixelposition darf technisch entschieden werden.
- B-VF-1 hat die Hantel aus dem Card-Clipping geloest und als Root-Sibling etabliert.
- B-VF-1 hat `PRO PORTION` transparent gemacht; die opake `COLOR_PANEL`-Flaeche ist kein aktuelles Zielproblem mehr.
- Der aktuelle Render verwendet `BARBELL_Y=1029`, `NUTRITION_CARD_Y=1048`, `NUTRITION_CARD_HEIGHT=144`, `PRO_PORTION_Y=1036` und `WORDMARK_Y=1222`.
- Das SVG `barbell-header-frame.svg` hat `viewBox="0 0 904 64"`, einen lokalen Schaftbereich bei `y=29..35` und gespiegelt aufgebaute Plattenstapel.
- `nutrition-layout.test.ts` und `smoke.test.ts` existieren und waren im vorherigen Zwischenstand gruen.
- Der aktuelle Render `backend/output/quarkbroetchen.png` ist die visuelle Arbeitsgrundlage, aber noch keine akzeptierte Referenz.
- Es gibt keine Persistenz-, API-, Mobile- oder Infrastrukturbetroffenheit.
- Der Vorgaengerplan ist aufgrund der Nutzerablehnung nicht abgeschlossen: Seine Referenzpromotion bleibt bis zur erneuten visuellen Freigabe blockiert.

## 8. Assumptions and Open Questions

### Technische Annahmen

- Das bestehende `904 x 64`-SVG bleibt ausreichend klar, wenn es bei `y=1089` vollstaendig und ohne Clip gerendert wird.
- Die sichtbaren Wortmarken-Offsets des bestehenden PNG-Assets bleiben deterministisch genug fuer den engen `+/-3 px`-Bounds-Test in derselben Renderer-Umgebung.
- Die vier Naehrwertwerte und ihre Rundung bleiben unveraendert; nur die visuelle Wertzeilenposition wird explizit benannt.
- Die im Plan festgelegte Interpretation von "obere Linie der Naehrwerte" ist: Die obere Kante des sechs Pixel hohen Schaftes liegt auf der oberen Kante der 64 Pixel hohen Wertzeile; die Label- und Schaftmittelachsen liegen gemeinsam bei `y=1121`.

### Open Product Owner Decisions

Keine. Die genaue Geometrie und der begrenzte Rasterkorridor sind als technische Umsetzung dieses konkreten Nutzerfeedbacks festgelegt.

## 9. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/layout.ts` fuer Canvas-, Card-, Wertzeilen-, Typografie- und Footer-Konstanten.
- `backend/src/lib/instagramRenderer/compose.ts` fuer Satori-Elemente, Nutrition-Card und Root-Z-Order.
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` als bestehendes symmetrisches Asset.
- `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png` als bestehendes Wortmarken-Asset.
- `backend/src/lib/instagramRenderer/render.ts` fuer lokale Assets, Fonts, Satori und Resvg.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` als visuelles Abnahme-Fixture.
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts` und `smoke.test.ts` fuer den Null-Highlight-Regressionsfall.
- `backend/scripts/render-golden.mjs` fuer den deterministischen lokalen PNG-Export.
- vorhandene Sharp-/Vitest-Hilfsfunktionen in `nutrition-layout.test.ts` fuer Pixel- und Strukturassertions.

## 10. Proposed Technical Solution

### 10.1 Benannte Layoutanker

Backend ergaenzt bzw. ersetzt die impliziten Einzelwerte durch zusammenhaengende Konstanten. Die konkreten Namen duerfen dem lokalen Stil folgen, muessen aber diese Bedeutungen und Werte abbilden:

```text
NUTRITION_CARD_BOTTOM_Y = NUTRITION_CARD_Y + NUTRITION_CARD_HEIGHT = 1192
NUTRITION_CARD_BOTTOM_PADDING = 10
NUTRITION_VALUE_ROW_HEIGHT = 64
NUTRITION_VALUE_ROW_TOP_Y = 1118
NUTRITION_VALUE_ROW_BOTTOM_Y = 1182
NUTRITION_VALUE_ROW_X = 120
NUTRITION_VALUE_ROW_WIDTH = 840
NUTRITION_DIVIDER_X = 330, 540, 750
BARBELL_SHAFT_TOP_OFFSET_Y = 29
BARBELL_SHAFT_HEIGHT = 6
BARBELL_SHAFT_TOP_Y = NUTRITION_VALUE_ROW_TOP_Y = 1118
BARBELL_SHAFT_CENTER_Y = 1121
BARBELL_Y = BARBELL_SHAFT_TOP_Y - BARBELL_SHAFT_TOP_OFFSET_Y = 1089
PRO_PORTION_CENTER_Y = BARBELL_SHAFT_CENTER_Y = 1121
PRO_PORTION_TOP = PRO_PORTION_CENTER_Y - PRO_PORTION_HEIGHT / 2 = 1107
WORDMARK_BOTTOM_CLEARANCE = 50
WORDMARK_Y = CANVAS_HEIGHT - WORDMARK_HEIGHT - WORDMARK_BOTTOM_CLEARANCE = 1238
```

Die Konstanten muessen so verwendet werden, dass keine zweite, abweichende Berechnung in `compose.ts` entsteht. Der SVG-interne Offset `29` ist ein benannter Assetanker und kein versteckter negativer Kind-Offset.

### 10.2 Compose-Struktur

- `createNutritionCard()` setzt die Wertzeile mit `top: NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_CARD_Y` oder einer gleichwertigen expliziten Card-relativen Ableitung. `bottom: 10` darf nicht die einzige Quelle fuer die Geometrie bleiben.
- Die Wertzeile und Divider erhalten fuer den lokalen Test stabile `data-render-node`-Marker oder eine gleichwertige strukturelle Erkennung. Die Marker werden nicht Teil des oeffentlichen Renderer-Vertrags.
- `createBarbellHeader()` bleibt ein Root-Sibling ausserhalb der Card. Seine absolute Root-Position ist `BARBELL_X`, `BARBELL_Y`, `BARBELL_WIDTH`, `BARBELL_HEIGHT`.
- `createProPortion()` verwendet einen expliziten `PRO_PORTION_TOP` beziehungsweise eine gemeinsame Center-Y-Ableitung. `PRO_PORTION_TOP_OFFSET` darf nicht als unabhaengiger vertikaler Designhebel weiterleben, wenn dadurch die gemeinsame Mittelachse unterlaufen wird.
- `createWordmark()` leitet `WORDMARK_Y` aus der benannten Bottom-Clearance ab. Die sichtbaren Pixel des bestehenden, normalisierten Assets werden nicht durch ein neues Rechteck oder eine neue Hintergrundfarbe veraendert.
- Die Card bleibt vor Hantel und Label im Root-Kinderarray; Label bleibt nach der Hantel; Wortmarke bleibt letzter Footer-Layer. Damit kann die Schaftlinie die Card-Oberflaeche ueberlagern, ohne durch Card-Clipping zu verschwinden.

### 10.3 Asset-Grenze

Backend prueft das bestehende SVG auf `viewBox`, Spiegelung und lokale Schaftkoordinaten. Eine Asset-Aenderung ist nur zulaessig, wenn ein konkreter, reproduzierbarer Befund zeigt, dass die relationale Position mit dem unveraenderten Asset nicht sichtbar umgesetzt werden kann. In diesem Ausnahmefall bleiben `viewBox`, Seitenverhaeltnis, Spiegelung und die Zielkoordinaten erhalten; eine neue Hantelgrafik oder Abhaengigkeit ist ausgeschlossen.

### 10.4 Keine Referenzpromotion in dieser Iteration

- `fittrack_instagram_golden_v1_7_unified_ambient.png` bleibt unveraendert und historisch.
- `golden.test.ts` beziehungsweise der historische V1.7-Test wird nicht durch Threshold- oder Ratio-Aenderungen an die neue Geometrie angepasst.
- Die aktuelle Referenzdatei `fittrack_instagram_current_approved.png` wird in diesem Plan weder angelegt noch aktualisiert.
- Erst nach ausdruecklicher visueller Nutzerfreigabe des neuen `backend/output/quarkbroetchen.png` darf der Orchestrator die Referenzpromotion aus dem Vorgaengerplan (B-VF-2) wieder aufnehmen.
- Bis dahin sind die relationale Layoutpruefung, der Smoke-Test, Typecheck, Build-Verify und die manuelle Bildpruefung die massgeblichen Checks fuer diese Iteration. Eine historische V1.7-Abweichung ist kein Anlass fuer eine Toleranzaufweichung.

## 11. Affected Files and Minimal Change Boundary

| Datei | Behandlung | Minimalgrenze |
|---|---|---|
| `backend/src/lib/instagramRenderer/layout.ts` | Footer-/Wertzeilen-/Schaft-/Wortmarken-Konstanten explizit machen | Keine allgemeine Layout-Neuberechnung |
| `backend/src/lib/instagramRenderer/compose.ts` | Wertzeilenanker, gemeinsame Schaft-/Label-Ebene, Z-Order und Marker | Keine Aenderung an Foto, Tags, Titel, Badge oder Nutrition-Rundung |
| `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` | Pruefen; nur bei reproduzierbarem Asset-Befund minimal aendern | `viewBox`, Symmetrie und `904:64` erhalten |
| `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` | Relationale Regression aktualisieren | Keine Toleranzaufweichung fuer den historischen Golden-Test |
| `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` | Ausfuehren; nur bei Marker-/Strukturbedarf lokal anpassen | Null-Highlight-Verhalten unveraendert |
| `backend/output/quarkbroetchen.png` | Nach Implementierung neu rendern | Keine Promotion zur Referenz |
| `backend/src/lib/instagramRenderer/docs/golden-metrics.md` | Footer-Ziel-/Ist-Metriken ergaenzen, Historie erhalten | V1.7-Werte nicht ueberschreiben |
| `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md` | QA erstellt separaten Report | Vorgaengerreport nicht ueberschreiben |
| `docs/qa/findings.md` | Nur durch Orchestrator gemaess QA-Handoff aktualisieren | QA schreibt nicht direkt in das zentrale Register |

## 12. Backend Work Package

### B-FL-1 - Vertikale Footer-/Nutrition-Komposition korrigieren

**Agent:** Backend

**Goal**

Die bestehende Renderer-Komposition auf die verbindliche Zielgeometrie aus Abschnitt 5 umstellen. Card, Wertzeile und Wortmarke bleiben stabil kontrolliert; Hantel-Schaft und `PRO PORTION` erhalten eine gemeinsame Ebene; das neue PNG wird fuer die manuelle Abnahme erzeugt.

**Required Knowledge Base:**

- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/scripts/render-golden.mjs`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md`

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
- AC-10

**Dependencies:**

- Automatische Freigabe dieses Plans.
- Bestehender B-VF-1/Q-VF-1-Zwischenstand mit Root-Sibling-Hantel und transparentem `PRO PORTION`.
- Keine Abhaengigkeit von einer aktuellen Golden-Referenz.

**Expected Handoff:**

- `layout.ts` enthaelt die finalen benannten Zielanker und keine konkurrierenden impliziten Footer-Y-Werte.
- `compose.ts` rendert Card, Wertzeile, Divider, Hantel, Label und Wortmarke in der festgelegten Z-Order.
- Die Hantel bleibt vollstaendig sichtbar; `PRO PORTION` bleibt transparent und auf der Schaftmittelachse.
- `backend/output/quarkbroetchen.png` ist als `1080 x 1350` PNG neu erzeugt und bereit fuer manuelle Nutzerabnahme.
- `golden-metrics.md` dokumentiert die finalen Zielkoordinaten getrennt von historischen V1.7- und B-VF-1-Messwerten.
- Der Handoff bestaetigt ausdruecklich, dass keine aktuelle Referenzdatei erzeugt oder promoted wurde.

## 13. Frontend Work Package

Keines. Es gibt keine Aenderung an `mobile/`, React Native, Navigation, API-Client, Shared Types oder Native Build-Konfiguration.

## 14. QA Work Packages

### Q-FL-1 - Relationale Footer-Regression aktualisieren und fokussiert pruefen

**Agent:** QA

**Goal**

Den fokussierten Renderer-Test so aktualisieren, dass die neue relationale Geometrie und die unveraenderte Card-/Wortmarkenposition gegen Struktur und gerenderte Pixel geschuetzt sind. Die Hantel-/Label-/Wertzeilenbeziehungen muessen unabhaengig vom historischen Golden-Test pruefbar sein.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-FL-1-Handoff
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/output/quarkbroetchen.png`

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

**Dependencies:**

- B-FL-1 muss die Zielkonstanten und die Compose-Struktur bereitstellen.
- QA behandelt die historische V1.7-Abweichung nicht als neuen Layout-Failure und aendert keinen historischen Threshold.

**Expected Handoff:**

- `nutrition-layout.test.ts` prueft Card, Wertzeile, Divider, Hantel-Schaft, `PRO PORTION`, Wortmarke und Canvas-Unterkante relational.
- Der Test weist nach, dass `BARBELL_SHAFT_TOP_Y === NUTRITION_VALUE_ROW_TOP_Y` und dass die sichtbare Label-Mittelachse innerhalb `+/-2 px` von `BARBELL_SHAFT_CENTER_Y` liegt.
- Der Test weist nach, dass Card-Y/Height, Wertzeilen-Y/Height, Wortmarken-Bottom-Clearance und Canvas-Abmessungen nicht unbeabsichtigt verschoben wurden.
- Der Test prueft weiterhin vollstaendige symmetrische Plattenpixel, boxfreies `PRO PORTION` und den Null-Highlight-Smoke-Fall.
- QA liefert konkrete Findings mit Planreferenz, AC, Criticality, Owner, Evidence und Recommendation an den Orchestrator zurueck.

### Q-FL-2 - Nutzerabnahme vorbereiten und finale Folgepruefung dokumentieren

**Agent:** QA

**Goal**

Nach dem fokussierten Testlauf den neuen PNG-Render gegen die Acceptance Criteria pruefen, die manuelle Nutzerabnahme explizit anfordern und nach deren Ergebnis einen dauerhaften QA-Report schreiben. Die Referenzpromotion bleibt bis zum Nutzerentscheid ausserhalb der Ausfuehrung.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-FL-1-Handoff
- Q-FL-1-Handoff
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/output/quarkbroetchen.png`
- `backend/package.json`
- `backend/vitest.config.mts`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md`

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

**Dependencies:**

- Q-FL-1 ohne Blocking Finding.
- `backend/output/quarkbroetchen.png` muss neu gerendert sein.
- Die manuelle Nutzerabnahme muss vor einer spaeteren Referenzpromotion dokumentiert werden.

**Expected Handoff:**

- QA-Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md` im Format `fittrack-qa-v1`.
- Kriterienmatrix fuer AC-1 bis AC-11, Testkommandos mit Exit-Code und getrennte Abschnitte fuer `UNVERIFIED` sowie `MANUAL VALIDATION REQUIRED`.
- Ergebnis der manuellen Nutzerabnahme: akzeptiert oder konkrete visuelle Ablehnung; eine Ablehnung geht als Blocking Backend-Finding zurueck.
- Explizite Aussage, dass vor Nutzerfreigabe keine aktuelle Referenzdatei angelegt oder promoted wurde.
- Bei erfolgreicher Abnahme ein Handoff an den Orchestrator, dass B-VF-2 aus dem Vorgaengerplan die Referenzpromotion aufnehmen darf. Q-FL-2 selbst erzeugt die Referenz nicht.

## 15. Shared Package Changes

Keine. `shared/` bleibt unveraendert.

## 16. Infrastructure and Configuration

Keine. Es gibt keine Bicep-, Cosmos-, Storage-, Azure-Function-, Deployment-, Environment- oder Mobile-Build-Aktion.

Development wird lokal ueber Vitest, Typecheck, Build-Verify und `npm run render:instagram-reference` geprueft. Alpha und Production sind nicht betroffen.

## 17. Documentation Updates

- Dieser neue Plan bleibt als eigenstaendiges Artefakt unter `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md` bestehen; der Vorgaengerplan wird nicht ueberschrieben.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` ergaenzt die Ziel- und Ist-Metriken fuer Footer, Wertzeile, Schaft, Label, Wortmarke und Canvas-Unterkante. Historische V1.7-Werte und B-VF-1-Werte bleiben als solche markiert.
- QA erstellt den separaten Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Nutrition-Alignment.md` und ueberschreibt weder den PoC-Report noch den Report des Vorgaengerplans.
- Findings werden von QA strukturiert an den Orchestrator uebergeben. Der Orchestrator pflegt `docs/qa/findings.md`; QA schreibt das zentrale Register nicht direkt.
- Keine Aenderung an `docs/kb/`, weil weder eine Domainregel noch eine Architektur-, API- oder Laufzeitentscheidung geaendert wird.

## 18. Test Strategy

### 18.1 Fokussierter Layout-Regressionstest

`nutrition-layout.test.ts` wird auf folgende Pruefungen ausgerichtet:

1. **Struktur:** Card, Wertzeile, Divider, Hantel, `PRO PORTION` und Wortmarke sind als erwartete Nodes vorhanden. Die Hantel ist Root-Sibling der Card; `overflow: hidden` bleibt auf die Card beschraenkt.
2. **Konstantenrelationen:** Card `88/1048/904/144`, Wertzeile `120/1118/840/64`, Divider `x=330/540/750`, Schaftoberkante `1118`, Schaftmitte `1121`, Labelbox `440/1107/200/28`, Wortmarkenbox `475/1238/130/62`, Canvas `1080/1350`.
3. **Gerenderte Achsen:** Schaftpixel liegen auf der oberen Wertzeilenlinie; sichtbare `PRO PORTION`-Pixel sind horizontal zentriert und ihre vertikale Mitte weicht maximal `2 px` von der Schaftmitte ab.
4. **Abstaende:** Card-Unterkante, Wortmarkenbox und Canvas-Unterkante erfuellen `1192 -> 1238 -> 1300 -> 1350`; sichtbare Wortmarken-Bounds bleiben mit maximal `3 px` Rastertoleranz im Zielkorridor.
5. **Inhalt:** Naehrwertreihenfolge und gerundete Fixture-Werte bleiben `250 kcal / 14 g / 31 g / 8 g`.
6. **Asset:** `viewBox="0 0 904 64"`, Spiegelung, vollstaendige linke/rechte Platten und `904:64`-Seitenverhaeltnis bleiben erhalten.
7. **Transparenz:** `PRO PORTION` hat weiterhin keinen Hintergrund, keine Border und keinen Schatten; Randpixel des Labelbereichs bleiben Teil der darunterliegenden Card-/Ambient-Flaeche.
8. **Zustaende:** Highlight-Fixture und `nutritionHighlight: null` rendern ohne unbeabsichtigte Verschiebung der Footer-Koordinaten.

Assertions duerfen nicht durch breitere Korridore ersetzt werden, wenn ein konkreter Befund fehlschlaegt. Eine notwendige technische Feinjustierung erfolgt an benannten Konstanten und wird mit demselben Test erneut geprueft.

### 18.2 Smoke-, Typ- und Build-Pruefungen

Mindestens folgende Kommandos sind nach dem Backend-Handoff auszufuehren:

- `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `cd backend && npx tsc --noEmit`
- `cd backend && npm run build:verify`
- `cd backend && npm run render:instagram-reference`

Nach der visuellen Abnahme und der daraus folgenden Referenzpromotion aus dem Vorgaengerplan werden dessen vollstaendiger Backend-Testlauf, aktueller Referenztest und abschliessender QA-Lauf ausgefuehrt. Vor der Abnahme wird kein aktueller Referenztest durch eine neu erzeugte Referenz gruen gemacht.

### 18.3 Historischer Golden-Test

- Der historische Threshold `pixelmatch threshold=0.10` und das `3 %`-Gate bleiben unveraendert.
- Die historische V1.7-Datei bleibt erhalten und wird nicht zur neuen visuellen Pflichtreferenz.
- Eine Abweichung durch die bewusst neue Footer-Geometrie wird weder durch Threshold-Erhoehung noch durch stilles Entfernen des Tests behandelt.
- Die Resultate eines historischen Vergleichs werden, falls ausgefuehrt, als diagnostischer/unverifizierter Altstand dokumentiert. Massgeblich fuer diese Iteration sind die relationalen Layoutassertions und die manuelle Abnahme.

### 18.4 Manuelle Nutzerabnahme

Nach `npm run render:instagram-reference` oeffnet der Nutzer `backend/output/quarkbroetchen.png` bei 100 Prozent oder ausreichend hoher Darstellung und prueft:

- Die Hantelstange und `PRO PORTION` liegen optisch auf derselben horizontalen Ebene.
- Die obere Kante der Hantelstange liegt auf der oberen Linie der vier Naehrwertspalten; die Stange wirkt nicht mehr wie ein losgeloester oberer Streifen.
- Beide Plattenstapel sind vollstaendig und symmetrisch sichtbar; Card-Clipping fehlt.
- Die Card, die vier Werte, die Divider und ihre Reihenfolge sind unveraendert und nicht nach unten oder oben verrutscht.
- Der Abstand zwischen `PRO PORTION`/Hantel, Card-Unterkante, Wortmarke und Canvas-Unterkante wirkt kompakt und harmonisiert; der bisher zu grosse Leerraum ist sichtbar reduziert.
- Die Wortmarke bleibt zentriert, ohne rechteckigen Hintergrund oder harte Kante; die Canvas-Unterkante wird nicht beruehrt.
- Die `PRO PORTION`-Umgebung zeigt keine opake Box.

Das Ergebnis wird als `ACCEPTED` oder mit einer konkreten Ablehnung dokumentiert. `ACCEPTED` erlaubt erst danach die Wiederaufnahme von B-VF-2 zur Referenzpromotion. Planfreigabe und PNG-Freigabe sind zwei getrennte Entscheidungen.

## 19. Acceptance Criteria

- **AC-1:** `renderInstagramRecipe(input)` und sein bestehender Input-/Result-Vertrag bleiben unveraendert. Es entsteht kein HTTP-, Auth-, Storage-, Cosmos-, Shared-, Mobile- oder Infrastructure-Code.
- **AC-2:** Der neue Render bleibt ein deterministisches PNG mit exakt `1080 x 1350` Pixeln. Das Render-Skript bleibt nutzbar.
- **AC-3:** Die Nutrition Card bleibt bei `x=88, y=1048, width=904, height=144` und endet bei `y=1192`. Der bestehende `COLOR_PANEL`-Hintergrund, Radius und Border bleiben erhalten.
- **AC-4:** Die Wertzeile liegt bei `x=120, y=1118, width=840, height=64`, endet bei `y=1182` und enthaelt weiterhin `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett` in dieser Reihenfolge mit den unveraenderten Fixture-Werten.
- **AC-5:** Die drei Divider liegen auf `x=330`, `x=540` und `x=750`, reichen von `y=1118` bis `y=1182` und werden nicht durch zusaetzliche oder verschobene Divider ersetzt.
- **AC-6:** Das Hantel-Asset wird als Root-Sibling bei `x=88, y=1089, width=904, height=64` gerendert. Der SVG-Rand wird weder durch `overflow: hidden` noch durch `object-fit: cover` abgeschnitten; beide Seiten bleiben gespiegelt und vollstaendig sichtbar.
- **AC-7:** Die obere Schaftkante liegt exakt bei `y=1118` auf der oberen Kante der Wertzeile. Die sichtbare `PRO PORTION`-Mittelachse liegt innerhalb `+/-2 px` der Schaftmittelachse `y=1121`. Der Text bleibt im Hantel-Mittelspalt lesbar.
- **AC-8:** `PRO PORTION` bleibt exakt als limefarbener Text ohne opake Hintergrundflaeche, Border oder Schatten. Im Label-Randbereich erscheint keine sichtbare `COLOR_PANEL`-Rechteckbox.
- **AC-9:** Die Wortmarken-Layoutbox liegt bei `x=475, y=1238, width=130, height=62`; ihre Unterkante liegt `50 px` ueber der Canvas-Unterkante. Sichtbare Wortmarkenpixel bleiben im erwarteten Zielkorridor und die Wortmarke bleibt horizontal zentriert.
- **AC-10:** `nutrition-layout.test.ts` prueft die Relationen aus AC-3 bis AC-9 strukturell und/oder anhand des gerenderten PNGs. `smoke.test.ts` rendert den `nutritionHighlight: null`-Fall weiterhin erfolgreich. Card und Wortmarke zeigen in beiden Highlight-Zustaenden keine unbeabsichtigte Verschiebung.
- **AC-11:** `backend/output/quarkbroetchen.png` wird nach der Umsetzung neu gerendert und fuer die manuelle Nutzerabnahme bereitgestellt. Vor `ACCEPTED` existiert keine aktuelle Referenzpromotion.
- **AC-12:** Der historische V1.7-Pixelthreshold und das `3 %`-Gate bleiben unveraendert. Keine Abweichung zum historischen PNG wird durch Toleranzaufweitung als neue Gestaltung akzeptiert.
- **AC-13:** `golden-metrics.md` dokumentiert Ziel- und Ist-Geometrie getrennt von historischen Werten. Der neue QA-Report enthaelt eine vollstaendige AC-Matrix, Testausgaenge, manuelle Abnahme und Findings-Behandlung.

## 20. Risks and Edge Cases

- **Schaft ueberlagert Wertzeile:** Weil der Schaft auf der oberen Wertzeilenlinie liegt, kann er Dividerpixel am oberen Rand ueberdecken. Die festgelegte Z-Order und der gerenderte Pixeltest muessen sicherstellen, dass keine Naehrwertziffer verdeckt wird. Bei einem Befund wird die benannte Schaft-/Wertzeilenrelation korrigiert, nicht durch ein zusaetzliches Abdeckelement kaschiert.
- **Font-Rasterung:** Satori/Resvg kann sichtbare Textbounds geringfuegig rasterbedingt verschieben. Dafuer gilt nur der explizite `+/-2 px`-Mittelachsen- und `+/-3 px`-Bounds-Korridor; der historische Golden-Threshold wird nicht angefasst.
- **Wortmarken-Transparenz:** Layoutbox und sichtbare Pixel sind nicht identisch. Die Abnahme unterscheidet deshalb `WORDMARK_Y`/Bottom-Clearance von den sichtbaren Zeichenbounds und erlaubt keine opake Hintergrundflaeche.
- **Card-Clipping:** Ein erneutes Verschachteln der Hantel oder des Labels in einem `overflow: hidden`-Container ist ein Blocking Finding.
- **Asset-Klarheit:** Das bestehende SVG wird nicht neu gezeichnet, solange seine vollstaendige Ausgabe lesbar bleibt. Eine Assetaenderung ohne reproduzierbaren Befund ist ausserhalb des Plans.
- **Null-Highlight:** Das Weglassen des Badges darf keine Footer-Y-Position veraendern. Der Smoke-Test muss das weiterhin pruefen.
- **Historische Referenz:** Eine Differenz zum V1.7-PNG ist nach dieser gezielten Layoutkorrektur kein neues visuelles Ziel. Toleranzaufweichung oder stillschweigende Referenzpromotion sind nicht zulaessig.
- **Manuelle Abnahme fehlt:** Eine ausstehende Nutzerpruefung ist `MANUAL VALIDATION REQUIRED`, kein QA-Finding. Ohne `ACCEPTED` bleibt B-VF-2 blockiert.

## 21. Findings-Behandlung

- QA bewertet ausschliesslich gegen die Acceptance Criteria dieses Plans und den dokumentierten Zielkorridor.
- Falsche Schaft-/Label-Ebene, sichtbares Clipping, verschobene Card-/Wert-/Divider-Geometrie, eine opake Labelbox oder eine unbeabsichtigt verschobene Wortmarke sind `Blocking`, Owner `Backend`.
- Ein Fehler im Null-Highlight-Smoke-Test oder im fokussierten Relationstest ist `Blocking`, Owner `Backend` fuer Produktionsursache beziehungsweise `QA` nur bei einer fehlerhaften Testassertion.
- Eine Abweichung gegen die historische V1.7-Datei wird nicht als Finding erfasst, sofern sie aus der bewusst neuen Footer-Geometrie stammt und AC-3 bis AC-10 erfuellt sind.
- Fehlende lokale Plattform-/CI-/Cross-Platform-Pruefungen werden als `UNVERIFIED` dokumentiert, nicht als Criticality-Finding.
- Die ausstehende visuelle Nutzerentscheidung wird als `MANUAL VALIDATION REQUIRED` mit Prerequisite, erwarteter Beobachtung und Result-Feld dokumentiert.
- QA liefert strukturierte Findings an den Orchestrator. Der Orchestrator entscheidet nicht stillschweigend ueber Akzeptanz, sondern pflegt das zentrale Register `docs/qa/findings.md` gemaess Prozess.
- Der Vorgaenger-QA-Report bleibt unveraendert; dieser Plan erhaelt einen separaten Report.

## 22. Recommended Execution Order and Handoffs

Die Ausfuehrung erfolgt strikt sequenziell:

1. **Automatische Planfreigabe:** Der Orchestrator behandelt diesen Plan gemaess Nutzeranweisung als freigegeben; es gibt keine offene fachliche Rueckfrage.
2. **Backend B-FL-1:** Benannte Zielgeometrie und Z-Order implementieren, fokussiertes Arbeits-Rendering erzeugen, Metriken aktualisieren und Handoff ohne Referenzpromotion uebergeben.
3. **QA Q-FL-1:** Regressionstest auf relationale Geometrie aktualisieren und fokussierte Tests ausfuehren. Blocking Findings gehen an Backend zurueck; nach jeder Reparatur wird derselbe fokussierte Lauf erneut ausgefuehrt.
4. **PNG-Render:** `backend/output/quarkbroetchen.png` mit `npm run render:instagram-reference` neu erzeugen und als Arbeitsartefakt bereitstellen.
5. **Manuelle Nutzerabnahme:** Nutzer prueft das PNG gegen Abschnitt 18.4. Bei Ablehnung wird die konkrete visuelle Abweichung an B-FL-1 zurueckgegeben; bei Annahme wird `ACCEPTED` dokumentiert.
6. **QA Q-FL-2:** Nach manueller Abnahme den vollstaendigen Folge-Report mit AC-Matrix, Testresultaten, Abnahmeergebnis, `UNVERIFIED`- und Findings-Abschnitten erstellen. Vor `ACCEPTED` bleibt dieser Schritt auf die Vorabpruefung und Dokumentation ohne Referenzpromotion begrenzt.
7. **Vorgaengerplan wiederaufnehmen:** Erst nach `ACCEPTED` darf der Orchestrator B-VF-2 aus `PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` zur Promotion von `fittrack_instagram_current_approved.png` dispatchen. Diese Promotion ist nicht Bestandteil der vorherigen Schritte und wird nicht vorgezogen.
8. **Abschluss:** Erst wenn AC-1 bis AC-13, die Nutzerabnahme und der nachgelagerte Referenz-/QA-Lauf des Vorgaengerplans abgeschlossen sind, gilt die Footer-Korrektur als abgeschlossen.

## 23. Planstatus

Dieser Plan ist vollstaendig und implementation-ready. Er ist gemaess Nutzeranweisung automatisch zur Umsetzung freigegeben, enthaelt keine offene fachliche Frage und schreibt ausschliesslich diesen Plan als Planner-Artefakt. Produktionscode, Tests, PNG, Metriken und QA-Report entstehen erst in den beschriebenen sequenziellen Work Packages. Die aktuelle Referenzpromotion bleibt bis zur erneuten visuellen Nutzerfreigabe gesperrt.