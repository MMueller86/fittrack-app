# Änderungsplan: FitTrack Instagram Recipe Renderer - Visuelle Korrekturen

**Status:** Draft - bereit für explizite Freigabe; diese Planungsrunde implementiert nichts
**Plan-Typ:** Folgeplan zum abgeschlossenen Instagram-Recipe-Renderer-PoC
**Vorgänger:** [`PLAN_Instagram-Recipe-Renderer-PoC.md`](PLAN_Instagram-Recipe-Renderer-PoC.md)
Infrastructure Impact: None
Mobile Build Impact: None

**Execution Gate:** Dieser Plan ist bis zur erneuten expliziten Freigabe nicht ausführbar. Die bestehende PoC-Abnahme und der bisherige V1.7-Golden-Test bleiben als historische Dokumentation erhalten, sind aber kein stillschweigendes Ziel für die neue Gestaltung.

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications

### Nutzerproblem

Die aktuelle, automatisiert geprüfte PNG-Ausgabe hat zwei klar abgegrenzte visuelle Fehler:

1. Das Hantel-Asset wird innerhalb der Nutrition Card oben abgeschnitten. Dadurch sind die oberen Bereiche und die einzelnen Hantelscheiben nicht eindeutig sichtbar.
2. Das Element `PRO PORTION` wird mit einer opaken `COLOR_PANEL`-Fläche gerendert. Diese rechteckige Fläche wirkt wie eine aufgesetzte schwarze Box und ist nicht in die Card-/Ambient-Komposition integriert.

### Lösungsfit

Die Fehler liegen in der Renderer-Komposition, nicht in API, Datenmodell, Nährwertberechnung, Mobile-UI oder Infrastruktur:

- Die SVG-Datei besitzt ein vollständiges `viewBox="0 0 904 64"` und symmetrische Platten-Geometrie.
- `compose.ts` positioniert das Asset mit negativem lokalem `top` innerhalb einer Card mit `overflow: hidden`; der obere Teil wird dadurch zuverlässig abgeschnitten.
- `createProPortion()` malt hinter dem Text explizit `backgroundColor: COLOR_PANEL`.

Die Korrektur bleibt deshalb eine kleine Backend-Renderer-Revision. Die Card-/Hantel-Layer werden sauber getrennt, und `PRO PORTION` wird als transparente Textschicht im vorhandenen Mittelspalt des Assets gerendert.

### Produkt- und Domänenbewertung

- Keine Nutrition-, Weight-, Goal- oder AI-Regel wird verändert.
- Es wird keine neue Badge-, Icon- oder Tag-Entscheidung eingeführt.
- Es gibt keinen Health-Risk- oder Plausibilitätsaspekt.
- Es ist kein Produktentscheid für die genaue Pixelposition erforderlich. Die genaue vertikale Feinjustierung ist eine technische Layoutentscheidung, die durch PNG-Prüfung und Nutzerabnahme abgesichert wird.

## 2. Recommended Product Behaviour

Die aktuelle Rezeptgrafik behält Format, Inhalt und Informationshierarchie des PoC bei. Nur die zwei vom Nutzer benannten visuellen Mängel werden korrigiert:

- Die vollständige Hantel sitzt als klar erkennbares, symmetrisches Header-Element oberhalb und teilweise über der Nutrition Card. Ihr oberer Plattenbereich bleibt sichtbar und wird nicht durch einen Card-Clip abgeschnitten.
- `PRO PORTION` bleibt limefarben, zentriert und lesbar, erhält aber keine eigene opake Hintergrundfläche. Der vorhandene Card-/Ambient-Hintergrund bleibt sichtbar und bildet die Textumgebung.

Die bisherige V1.7-Golden-Vorlage ist für diese Folgeänderung ausdrücklich nicht mehr die visuelle Pflichtreferenz.

## 3. Feature Summary

Der bestehende Renderer unter `backend/src/lib/instagramRenderer/` wird gezielt revidiert. Die öffentliche Library-Signatur, das PNG-Format `1080 x 1350`, das Golden-Fixture, die Nährwertdaten und der lokale Render-Aufruf bleiben erhalten.

Die Teststrategie wird bewusst geändert:

- Der V1.7-Pixelvergleich wird nicht durch eine höhere Toleranz künstlich grün gehalten.
- Nach der visuellen Nutzerabnahme wird das korrigierte PNG als neue aktuelle Referenz gespeichert.
- Der bisherige V1.7-Vergleich wird durch diesen aktuellen Referenztest ersetzt; die V1.7-Datei bleibt als historische Vergleichsdatei, aber ohne blockierende Testfunktion.
- Ein gezielter Layout-Test prüft zusätzlich unabhängig von einer Referenzdatei die vollständige Hantel und die Abwesenheit einer opaken `PRO PORTION`-Box.

## 4. Current Behaviour

Die aktuelle Implementierung zeigt folgende kontrollierende Stellen:

- `layout.ts` definiert `NUTRITION_CARD_Y = 1048`, `NUTRITION_CARD_HEIGHT = 144`, `BARBELL_HEIGHT = 64`, `BARBELL_CENTER_Y = 1047` und `PRO_PORTION_Y = 1036`.
- `compose.ts` rendert die Nutrition Card mit `overflow: "hidden"`.
- Das Hantelbild wird innerhalb dieser Card mit einem negativen lokalen Offset positioniert. Die globale Bildbox beginnt ungefähr bei `y = 1015`, die Card beginnt aber erst bei `y = 1048`. Der obere SVG-Inhalt wird deshalb abgeschnitten.
- `barbell-header-frame.svg` enthält links und rechts mehrere Platten mit Höhen bis `50` SVG-Pixeln. Der Asset-Inhalt ist vorhanden; die sichtbare Beschädigung entsteht primär durch das Clipping der Compose-Schicht.
- `createProPortion()` rendert einen `200 x 28`-ähnlichen Layoutbereich und setzt darin `backgroundColor: COLOR_PANEL`. Dieser Hintergrund ist im PNG als rechteckige dunkle Fläche sichtbar.
- `render.ts` lädt das Hantel-Asset unverändert aus `assets/nutrition/barbell-header-frame.svg`. Die Asset-Ladung, PNG-Rasterisierung und öffentliche Fehlerbehandlung sind für diese Änderung grundsätzlich ausreichend.
- `fixtures/quarkbroetchen.ts` und `scripts/render-golden.mjs` liefern weiterhin das richtige visuelle Abnahme-Fixture und sollen nicht durch ein neues Rezept ersetzt werden.
- Der bisherige `golden.test.ts` vergleicht gegen `fittrack_instagram_golden_v1_7_unified_ambient.png`. Der aktuelle Stand war mit `42,647 / 1,458,000 = 0.029250342935528122` innerhalb des alten `0.03`-Gates und wurde im PoC-QA-Report als `PASS` bewertet. Das beweist nur die Nähe zur alten Vorlage, nicht die Akzeptanz der jetzt gewünschten Gestaltung.

## 5. Desired Behaviour

### 5.1 Vollständiges Hantel-Asset

- Beide Plattenstapel und die Stange sind vollständig sichtbar.
- Die obersten Plattenkanten werden nicht an der Card-Oberkante abgeschnitten.
- Die linke und rechte Seite bleiben horizontal gespiegelt und in gleicher Höhe.
- Das Asset behält das Verhältnis `904 x 64` aus dem SVG-`viewBox`; es wird weder vertikal gestaucht noch mit `object-fit: cover` beschnitten.
- Die Hantel erhält eine stabile, benannte Position im 1080-x-1350-Koordinatensystem. Die Position darf nicht mehr von einem negativen Kind-Offset innerhalb eines `overflow: hidden`-Containers abhängen.
- Der obere sichtbare Plattenbereich liegt mit einem klar erkennbaren Abstand oberhalb der Card-Oberkante. Als technischer Startwert gilt eine globale Bildbox bei `x = 88`, `y = 1029`, `width = 904`, `height = 64`: Der sichtbare Plattenanfang liegt damit ungefähr `8 bis 12 px` oberhalb von `NUTRITION_CARD_Y = 1048`. Eine Feinjustierung von höchstens `8 px` ist zulässig, wenn die manuelle PNG-Prüfung dadurch die Platten klarer und die Card-Kante ruhiger erscheinen lässt; der finale Wert muss als benannte Layout-Konstante dokumentiert werden.
- Die Hantel darf die Card als bewusstes Header-Element überlagern, darf aber weder am Canvas-Rand noch an einem Card-Clip abgeschnitten werden.

### 5.2 Integriertes `PRO PORTION`

- Der Text bleibt exakt `PRO PORTION`, limefarben, zentriert und in der bestehenden Größenordnung.
- Der Text liegt im klaren Mittelspalt zwischen linker und rechter Hantelhälfte.
- Das Text-Element hat keinen opaken Hintergrund, keine eigene schwarze Fläche, keinen Schatten und keinen zusätzlichen Rand.
- Der transparente Textbereich darf als unsichtbarer Layoutbereich weiterhin `200 px` breit sein; entscheidend ist, dass nur die Buchstaben Farbe auftragen.
- Unter und neben dem Text bleiben die tatsächlichen Card-/Ambient-Pixel sichtbar. Die Umgebung darf nicht als einfarbiges Rechteck vom übrigen unteren Bereich abweichen.
- Die transparente Darstellung darf die Lesbarkeit nicht verschlechtern. Falls die Card-Oberkante hinter dem Text sichtbar durchläuft, muss die Layer-Reihenfolge so angepasst werden, dass der Mittelspalt als bewusste Hantel-Header-Behandlung lesbar bleibt, ohne eine neue opake Box einzuführen.

### 5.3 Unveränderte Randbedingungen

- `renderInstagramRecipe(input)` bleibt die öffentliche API.
- Die Ausgabe bleibt ein deterministisches PNG mit `1080 x 1350` Pixeln.
- Titel, Tag-Reihe, Highlight-Badge, Nährwertreihenfolge, Wortmarke und Nährwertwerte werden nicht als Teil dieser Aufgabe neu gestaltet.
- Smoke-Fixture, lokale Asset-Ladung und keine Netzwerkabhängigkeit bleiben erhalten.

## 6. Scope

### In Scope

- Reorganisation der Nutrition-Card-Komposition in `compose.ts`, sodass die Hantel nicht mehr durch die Card-Innenfläche abgeschnitten wird.
- Ergänzung oder Anpassung benannter Geometrie-Konstanten in `layout.ts` für Card, Hantel-Header und `PRO PORTION`.
- Entfernen der opaken Hintergrundfläche aus `createProPortion()` und Sicherstellung der korrekten Layer-Reihenfolge.
- Prüfung des bestehenden Assets `barbell-header-frame.svg`. Eine Asset-Neuzeichnung ist nicht der primäre Lösungsweg; eine Änderung ist nur zulässig, wenn die vollständige, unbeschnittene Ausgabe nach der Compose-Korrektur weiterhin keine klaren Platten erkennen lässt. In diesem Fall bleiben `viewBox`, Spiegelung und das lokale Asset-Format stabil.
- Neuer gezielter Renderer-Test für Hantel-Geometrie, vollständige Sichtbarkeit und boxfreie `PRO PORTION`-Darstellung.
- Bewusster Wechsel vom V1.7-Golden-Test zu einer nach Nutzerabnahme erzeugten aktuellen Referenz.
- Aktualisierung der renderer-internen Metrik-Dokumentation und Erstellung eines separaten QA-Reports für diese Revision.
- Erzeugung und manuelle Abnahme von `backend/output/quarkbroetchen.png`.

## 7. Out of Scope

- Kein HTTP-Endpunkt, keine Authentifizierung und keine Quota-Logik.
- Keine Cosmos-, Storage-, Bicep-, Deployment- oder Environment-Änderung.
- Keine Mobile-, Shared-Package- oder Native-Build-Änderung.
- Keine Änderung an Rezeptdaten, Nährwertberechnung, Rundungslogik oder Nutrition-Highlight-Ableitung.
- Keine neue Icon-Bibliothek, kein neues Tag-Icon und keine Produktentscheidung zu weiteren Badges.
- Keine allgemeine Überarbeitung des Instagram-Templates und keine Rückkehr zur V1.7-Gestaltung als Pflichtziel.
- Keine Änderung an Foto-Crop, Transition, Ambient-Field, Wortmarke oder Tag-Chips, außer eine direkte Layer-Anpassung ist für die beiden benannten Fehler technisch unvermeidbar.
- Kein Löschen des alten V1.7-PNGs. Es bleibt als historische Dokumentation erhalten und wird nicht durch eine Toleranzänderung zum aktuellen Ziel umgedeutet.

## 8. Confirmed Facts

- Der PoC-Renderer ist eine importierbare Backend-Library unter `backend/src/lib/instagramRenderer/`.
- Die aktuelle Ausgabe ist lokal deterministisch, 1080 x 1350 px groß und wird über `backend/scripts/render-golden.mjs` erzeugt.
- Der bisherige PoC-QA-Report ist `PASS`; der V1.7-Pixelvergleich lag unter dem bisherigen 3-Prozent-Gate.
- Die Nutzeranforderung hebt V1.7 als visuelle Pflichtreferenz ausdrücklich auf.
- Das bestehende Hantel-SVG ist 904 x 64 groß und enthält vollständige, gespiegelte Plattenstapel.
- Das Hantelbild wird derzeit innerhalb einer Card mit `overflow: hidden` gerendert.
- `createProPortion()` setzt derzeit `backgroundColor: COLOR_PANEL` und erzeugt damit die beanstandete Fläche.
- `render.ts`, Fixture und Render-Skript sind für die neue manuelle Abnahme wiederverwendbar.
- Die Änderung betrifft keine Persistenz und keinen API-Vertrag.
- Die vorherige Planungsrunde und ihr QA-Report werden nicht überschrieben. Die neue Nutzeranforderung ist eine bewusste visuelle Revision des vorherigen, weiterhin historisch gültigen PoC-Zustands.

## 9. Assumptions and Open Questions

### Bestätigte bzw. technische Annahmen

- Das Ausgabeformat `1080 x 1350` bleibt unverändert.
- `PRO PORTION` bleibt als Text erhalten; es wird nicht in das SVG eingebrannt.
- Die vorhandene Hantelgrafik reicht nach Entfernung des Clippings voraussichtlich für klar erkennbare Platten aus. Eine SVG-Anpassung ist nur ein begrenzter Fallback bei einem konkreten QA-Befund.
- Die Referenzdatei wird erst nach der visuellen Nutzerabnahme als aktuelle Testbasis festgeschrieben.

### Open Product Owner Decisions

Keine blockierende Product-Owner-Entscheidung. Die Nutzeranforderung autorisiert bereits die Abkehr von V1.7. Die genaue vertikale Feinjustierung innerhalb der genannten technischen Grenzen ist keine neue Produktentscheidung.

## 10. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/layout.ts` für Canvas-, Card- und Typografie-Konstanten.
- `backend/src/lib/instagramRenderer/compose.ts` für Satori-Layer, Card-Inhalt und Z-Order.
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` als bestehendes symmetrisches Asset.
- `backend/src/lib/instagramRenderer/render.ts` für lokale Asset-Ladung, Fonts, Satori und Resvg.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` als visuelles Abnahme-Fixture.
- `backend/scripts/render-golden.mjs` für den reproduzierbaren PNG-Export.
- `sharp` für PNG-Metadaten und Rohpixel-Prüfungen sowie die vorhandene Vitest-/pixelmatch-Infrastruktur.
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` als unveränderter Nicht-Referenz-Smoke-Test.

## 11. Proposed Technical Solution

### 11.1 Nutrition-Group statt Card-internem Clipping

`compose.ts` führt eine klar abgegrenzte Nutrition-Kompositionsgruppe ein oder bildet sie mit den vorhandenen Satori-Elementen explizit ab:

1. Die Nutrition Card bleibt für ihre gerundete Fläche und die vier Nährwertspalten zuständig. Ihr `overflow: hidden` darf weiterhin die Card-Inhalte schützen.
2. Das Hantelbild wird aus dem abgeschnittenen Card-Kindbereich herausgelöst und als Geschwister- bzw. Header-Layer in einem nicht beschneidenden Wrapper gerendert.
3. Hantelposition und -größe kommen ausschließlich aus benannten Konstanten, vorzugsweise `BARBELL_TOP`, `BARBELL_WIDTH`, `BARBELL_HEIGHT` und einer klaren Card-Referenz. Kein neuer impliziter negativer Offset wird eingeführt.
4. Das Hantelbild wird mit `width = CONTENT_WIDTH` und `height = BARBELL_HEIGHT` gerendert. Die SVG-Seitenrelation bleibt erhalten.
5. Die Hantel wird nach Card-Hintergrund und vor `PRO PORTION` beziehungsweise in einer definierten Z-Order gerendert. Beide Plattenstapel müssen außerhalb der Card-Oberkante sichtbar sein.
6. Für Testbarkeit erhalten Nutrition Card, Hantel-Layer und `PRO PORTION` stabile `data-render-node`-Marker oder eine gleichwertige, lokale Strukturerkennung. Diese Marker sind keine Produktions-API.

Die bevorzugte Startgeometrie ist `x = CONTENT_LEFT`, `y = 1029`, `width = CONTENT_WIDTH`, `height = 64`. QA darf nur eine begrenzte Feinjustierung melden; Backend entscheidet die konkrete Konstantenanpassung innerhalb des in Abschnitt 5.1 beschriebenen Rahmens.

### 11.2 Transparentes `PRO PORTION`

`createProPortion()` behält Position, Breite, Ausrichtung, Schrift und Text bei, entfernt aber `backgroundColor: COLOR_PANEL`. Der Hintergrundwert wird nicht durch eine andere opake Farbe ersetzt.

Das Asset besitzt bereits einen Mittelspalt zwischen der linken und rechten Schaftseite. Dieser Spalt wird für den Text genutzt. Die Komposition muss daher die Hantel vollständig sichtbar machen und den Text darüberlegen, ohne ein Rechteck zum Verdecken des Schafts zu verwenden. Ein unsichtbarer Layoutbereich ist zulässig; visuell dürfen nur die Lime-Buchstaben erscheinen.

### 11.3 Asset-Grenze

`render.ts` bleibt grundsätzlich unverändert. Die Referenz `DESIGN_ASSET_FILES.barbell` bleibt auf `nutrition/barbell-header-frame.svg` gerichtet. Backend prüft:

- SVG-`viewBox` und tatsächliche Asset-Dimension bleiben konsistent.
- Beide Seiten enthalten dieselbe Plattenfolge.
- Keine Compose-Schicht beschneidet den SVG-Rand.
- Eine Änderung am SVG selbst erfolgt nur als gezielte Klarheitskorrektur nach einem reproduzierbaren visuellen Befund. Es werden keine neuen Abhängigkeiten und keine zusätzliche handgezeichnete SVG-Grafik eingeführt.

### 11.4 Bewusste Golden-/Referenz-Entscheidung

Die bisherige `golden.test.ts`-Prüfung gegen `fittrack_instagram_golden_v1_7_unified_ambient.png` wird nicht durch eine größere Pixelabweichungstoleranz angepasst. Stattdessen gilt folgende verbindliche Entscheidung:

- `fittrack_instagram_golden_v1_7_unified_ambient.png` bleibt als historische V1.7-Datei erhalten.
- Der V1.7-Test wird nach manueller Nutzerabnahme nicht mehr als blockierender Test verwendet.
- Das akzeptierte korrigierte PNG wird als `backend/src/lib/instagramRenderer/test-fixtures/reference/fittrack_instagram_current_approved.png` gespeichert.
- `golden.test.ts` wird bewusst in `current-reference.test.ts` umbenannt. Der Test vergleicht nur noch gegen die neue aktuelle Referenz und behält die bestehende pixelmatch-Methodik sowie das `0.10`-Farbthreshold und das begründete `3 %`-Differenzgate bei, sofern die Resvg-Deterministik dies zulässt.
- Die neue Referenz wird erst nach der visuellen Nutzerfreigabe erzeugt. Vor dieser Freigabe ist ein abweichendes PNG ein erwarteter Arbeitsstand und darf nicht als neue Regression-Basis festgeschrieben werden.
- Zusätzlich prüft ein gezielter Layout-Test die Hantel und `PRO PORTION`, damit die beiden Nutzeranforderungen nicht ausschließlich durch ein Referenzbild geschützt werden.

Diese Änderung ist eine bewusste Testdesign-Entscheidung und keine Löschung oder Abschwächung von Testabdeckung.

## 12. Affected Files and Minimal Change Boundary

| Datei | Geplante Behandlung | Minimalgrenze |
|---|---|---|
| `backend/src/lib/instagramRenderer/layout.ts` | Geometrie-Konstanten für Hantel-Header und gegebenenfalls Marker ergänzen/anpassen | Nur Nutrition-Header-Geometrie; keine allgemeine Layout-Neuberechnung |
| `backend/src/lib/instagramRenderer/compose.ts` | Card-, Hantel- und `PRO PORTION`-Layer trennen; `PRO PORTION` transparent machen | Keine Änderung an Foto, Tags, Titel, Badge oder Wortmarke |
| `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` | Prüfen; nur bei nachgewiesener Rest-Unklarheit minimal anpassen | `viewBox`, Symmetrie und lokales SVG bleiben erhalten |
| `backend/src/lib/instagramRenderer/render.ts` | Als Asset-/Render-Kontext prüfen; Änderung nur bei konkretem Asset-Pfadbefund | Keine API-, Fehler- oder Runtime-Architekturänderung |
| `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` | Bewusst in `current-reference.test.ts` umbenennen | Kein Toleranz-Workaround für V1.7 |
| `backend/src/lib/instagramRenderer/__tests__/current-reference.test.ts` | Umbenannte Referenzprüfung nach Nutzerabnahme | Vergleich ausschließlich gegen aktuelle freigegebene Referenz |
| `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` | Neuer gezielter Regressionstest | Hantel- und `PRO PORTION`-Fehlerfläche; keine globale Testbereinigung |
| `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` | Weiterverwenden und ausführen; Änderung nur bei notwendiger zusätzlicher Korrektur-Assertion | Kein Golden-Vergleich für das Smoke-Fixture |
| `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` | Unverändert | Weiterhin manuelles Abnahme-Fixture |
| `backend/scripts/render-golden.mjs` | Unverändert weiterverwenden | Weiterhin lokaler PNG-Export, keine CLI-Erweiterung |
| `backend/src/lib/instagramRenderer/docs/golden-metrics.md` | Historische V1.7-Werte erhalten, aktuelle Hantel-/Label-Geometrie ergänzen | Keine stillschweigende Umschreibung historischer Messwerte |
| `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` | Neuer QA-Report durch QA | Vorherigen PoC-Report nicht überschreiben |

## 13. Backend Work Package

### B-VF-1 - Nutrition-Header-Komposition korrigieren

**Agent:** Backend

**Goal**

Die beiden visuellen Fehler im bestehenden Renderer beheben: vollständige, klar lesbare Hantel ohne Card-Clipping und transparent integriertes `PRO PORTION`, ohne den Renderer-Vertrag oder angrenzende Gestaltung unbeabsichtigt zu verändern.

**Required Knowledge Base:**

- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/scripts/render-golden.mjs`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-PoC.md`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7

**Dependencies:**

- Erneute explizite `APPROVE`-Freigabe für diesen Plan.

**Expected Handoff:**

- `compose.ts` rendert Card, vollständige Hantel und `PRO PORTION` in einer nachvollziehbaren, nicht beschneidenden Z-Order.
- `layout.ts` enthält die final gewählten, benannten Nutrition-Header-Konstanten.
- `PRO PORTION` besitzt keine opake Hintergrundfläche.
- `barbell-header-frame.svg` ist entweder unverändert als ausreichend klar verifiziert oder mit einer begrenzten, dokumentierten Asset-Korrektur versehen.
- `npm run render:instagram-reference` erzeugt ein neues `backend/output/quarkbroetchen.png` mit 1080 x 1350 px.
- Der Handoff benennt die finalen Hantelkoordinaten, die geänderten Dateien und alle bewusst unveränderten Renderer-Bereiche.

### B-VF-2 - Aktuelle Referenz nach Nutzerabnahme festschreiben

**Agent:** Backend

**Goal**

Nach ausdrücklicher visueller Nutzerfreigabe die neue Gestaltung als aktuelle Regression-Basis festschreiben und die alte V1.7-Prüfung ohne Testlücke ablösen.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-VF-1-Handoff
- `backend/output/quarkbroetchen.png` nach manueller Nutzerabnahme
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-7
- AC-8
- AC-9
- AC-10

**Dependencies:**

- B-VF-1 abgeschlossen.
- QA hat die gezielten Layout-Checks ohne offenen Blocking-Befund ausgeführt.
- Nutzer hat `backend/output/quarkbroetchen.png` visuell akzeptiert.

**Expected Handoff:**

- `test-fixtures/reference/fittrack_instagram_current_approved.png` enthält exakt das akzeptierte PNG.
- Der aktuelle Referenztest verwendet diese Datei und nicht mehr die V1.7-Datei.
- Die alte V1.7-Datei bleibt unverändert als historische Referenz erhalten und ist nicht Teil des blockierenden Test-Gates.
- `golden-metrics.md` unterscheidet historische V1.7-Messwerte von den aktuellen Hantel-/Label-Messwerten.
- Der Handoff dokumentiert, dass keine Toleranz angehoben und kein Test stillschweigend entfernt wurde.

## 14. Frontend Work Package

**None.** Es gibt keine Änderung an `mobile/`, React Native, Navigation, API-Client, Assets der Mobile-App oder Native Build-Konfiguration.

## 15. QA Work Package

### Q-VF-1 - Gezielte visuelle Regressionstests

**Agent:** QA

**Goal**

Die beiden Nutzerfehler reproduzierbar als Regressionstests absichern und den Backend-Handoff vor der Referenzpromotion prüfen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-VF-1-Handoff
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/output/quarkbroetchen.png`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-4
- AC-5
- AC-6

**Dependencies:**

- B-VF-1 muss abgeschlossen sein.
- Der alte V1.7-Test darf für diese Zwischenprüfung als bekannter veralteter Referenzstand behandelt werden; die finale Review erfolgt erst nach B-VF-2.

**Expected Handoff:**

- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` prüft Struktur und gerenderte Pixel der Nutrition-Header-Komposition.
- Der Test weist nach, dass beide Hantelhälften oberhalb der Card-Oberkante sichtbare Plattenpixel besitzen und nicht an einem Container-Clip enden.
- Der Test weist nach, dass `PRO PORTION` keine opake Hintergrundfarbe besitzt und die umgebende Fläche nicht als unerwartetes Rechteck abweicht.
- Der Test prüft mindestens den Highlight-Fall und den `nutritionHighlight: null`-Smoke-Fall, ohne einen zusätzlichen Badge- oder Icon-Produktentscheid zu treffen.
- QA liefert gezielte Testergebnisse und konkrete Findings an Backend zurück. Ein Hantel-Clipping oder eine weiterhin sichtbare schwarze Box ist `Blocking` und verhindert die Referenzpromotion.

### Q-VF-2 - Finale QA-Abnahme und Report

**Agent:** QA

**Goal**

Die vollständige Folgeänderung gegen alle Acceptance Criteria prüfen, den aktuellen Referenztest sowie den bestehenden Renderer-Testlauf ausführen und einen separaten, dauerhaften QA-Report erstellen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- B-VF-2-Handoff
- Q-VF-1-Handoff
- `backend/src/lib/instagramRenderer/__tests__/current-reference.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/reference/fittrack_instagram_current_approved.png`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/package.json`
- `backend/vitest.config.mts`

**Required Skills:** None

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

**Dependencies:**

- B-VF-2 muss abgeschlossen sein.
- Die manuelle Nutzerabnahme muss dokumentiert sein.

**Expected Handoff:**

- Neuer QA-Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` im Format `fittrack-qa-v1`.
- Kriterienmatrix für AC-1 bis AC-10.
- Testkommandos mit Exit-Code und Ergebnis.
- Separate Abschnitte für `UNVERIFIED` und `MANUAL VALIDATION REQUIRED`.
- Findings mit vollständigen Feldern; insbesondere dürfen alte V1.7-Differenzen nach der bewussten Referenzablösung nicht als Fehler gegen das neue Design bewertet werden.
- Finales Verdict `PASS`, sofern alle Kriterien und die Nutzerfreigabe erfüllt sind; andernfalls `PASS WITH ISSUES` oder `FAIL` nach QA-Regeln.

## 16. Shared Package Changes

Keine. `shared/` bleibt unverändert.

## 17. Infrastructure and Configuration

- Keine Bicep-Änderung.
- Keine Cosmos- oder Storage-Änderung.
- Keine Endpoint-Registrierung und kein Deployment.
- Keine Mobile-Build-Aktion.
- Development: lokale Backend-Tests und lokaler PNG-Export.
- Alpha: keine Aktion.

Es gibt kein Infrastructure-&-Release-Work-Package, weil weder Infrastruktur noch Deployment betroffen sind.

## 18. Documentation Updates

- Diese Folgeplanung wird unter `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` persistiert.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` ergänzt die aktuelle Hantel-/Label-Geometrie und markiert V1.7 als historische Messbasis. Historische Zahlen werden nicht überschrieben.
- QA erstellt den separaten Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` und überschreibt nicht den PoC-Report.
- Keine Änderung an `docs/kb/`, weil weder eine dokumentierte Domainregel noch eine Architektur- oder API-Entscheidung geändert wird.
- Keine Änderung an der Tag-Icon-Dokumentation, an Badge-Entscheidungen oder an Mobile-Dokumentation.

## 19. Test Strategy

### Automatisierte Renderer-Tests

1. **Gezielter Nutrition-Layout-Test:**
   - Rendern des Quarkbrötchen-Fixtures.
   - Nachweis der sichtbaren linken und rechten Plattenstapel oberhalb der Card-Oberkante.
   - Nachweis der horizontalen Symmetrie und des unveränderten `904 x 64`-Assetverhältnisses.
   - Strukturprüfung, dass die Hantel nicht mehr als Inhalt eines beschneidenden Card-Containers positioniert ist.
   - Struktur- und Pixelprüfung, dass `PRO PORTION` keinen opaken Hintergrund malt.
   - Prüfung, dass `PRO PORTION` im Hantel-Mittelspalt bleibt und lesbar ist.

2. **Aktueller Referenztest:**
   - Erst nach Nutzerabnahme gegen `fittrack_instagram_current_approved.png`.
   - Bestehende `sharp`-Dekodierung, PNG-Dimensionsprüfung und pixelmatch-Fehlerausgabe bleiben erhalten.
   - Bestehende `0.10`-Farbthreshold- und `3 %`-Gate-Werte werden nicht zur Kompensation der Designänderung erhöht.

3. **Smoke-Test:**
   - `smoke.test.ts` bleibt ein Nicht-Referenztest für ein anderes Rezept und `nutritionHighlight: null`.
   - Er bestätigt weiterhin `ok: true`, PNG und `1080 x 1350`.

4. **Bestehende Testabdeckung:**
   - Fehler-, Tag- und Highlight-Tests bleiben bestehen.
   - Änderungen an ihnen sind nur zulässig, wenn die neue Nutrition-Layer-Struktur ihre lokale Testabstraktion berührt. Assertions dürfen nicht gelockert werden.

### Auszuführende Kommandos

- `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `cd backend && npx vitest run src/lib/instagramRenderer/__tests__/current-reference.test.ts`
- `cd backend && npm test`
- `cd backend && npm run typecheck`
- `cd backend && npm run build:verify`
- `cd backend && npm run render:instagram-reference`

Der aktuelle Referenztest wird erst nach B-VF-2 als finale Gate-Prüfung ausgeführt. Vorher ist die alte V1.7-Abweichung ein erwarteter Übergangszustand, kein Grund für eine Toleranzänderung.

### Manuelle Nutzerabnahme

Der Nutzer öffnet `backend/output/quarkbroetchen.png` und prüft bei 100 Prozent beziehungsweise ausreichend hoher Darstellung:

- Beide Hantelplattenstapel sind vollständig zu sehen, ihre einzelnen Scheiben sind erkennbar und der obere Bereich ist nicht abgeschnitten.
- Die Hantel sitzt stabil über der Nutrition Card und hat einen klaren Abstand zur oberen Card-Kante.
- `PRO PORTION` ist lesbar, zentriert und ohne schwarze beziehungsweise opake Rechteckfläche sichtbar.
- Card, Nährwerte, Titel, Tags, Badge und Wortmarke wirken durch die Korrektur nicht unbeabsichtigt verschoben oder beschädigt.

Nur bei ausdrücklicher Freigabe darf das PNG als aktuelle Referenz festgeschrieben werden.

## 20. Acceptance Criteria

- **AC-1:** `renderInstagramRecipe(input)` bleibt als importierbare Backend-Library mit unverändertem Input-/Result-Vertrag verfügbar. Es entsteht kein HTTP-, Auth-, Cosmos-, Storage- oder Mobile-Code.
- **AC-2:** Das Quarkbrötchen-Fixture rendert als PNG mit exakt `1080 x 1350` Pixeln. Das bestehende Render-Skript bleibt nutzbar.
- **AC-3:** Das Hantel-SVG wird vollständig innerhalb des Canvas gerendert. Beide symmetrischen Plattenstapel enthalten sichtbare obere und untere Bereiche; der obere Plattenbereich wird nicht an `NUTRITION_CARD_Y` oder einem übergeordneten `overflow: hidden` abgeschnitten. Die Hantel behält ihr `904 x 64`-Seitenverhältnis.
- **AC-4:** Die Hantelposition wird über benannte Layout-Konstanten kontrolliert. Der sichtbare Plattenanfang liegt mindestens ungefähr `8 px` oberhalb der Card-Oberkante, bleibt innerhalb des Canvas und besitzt auf beiden Seiten dieselbe vertikale Position. Es gibt keinen impliziten negativen Child-Offset als alleinige Voraussetzung für die Sichtbarkeit.
- **AC-5:** `PRO PORTION` wird exakt als limefarbener, zentrierter Text im Hantel-Mittelspalt gerendert und bleibt lesbar.
- **AC-6:** Hinter `PRO PORTION` wird keine opake rechteckige Fläche gemalt. Pixel in den Randbereichen des Label-Layoutbereichs folgen der darunterliegenden Card-/Ambient-Fläche; eine sichtbare schwarze beziehungsweise einfarbige Box ist ausgeschlossen.
- **AC-7:** Die Korrektur verändert nicht unbeabsichtigt Titel, Tag-Reihe, Nutrition-Werte, Highlight-Badge, Wortmarke, Foto-Transition oder öffentliche Fehlerpfade. Bestehende fokussierte Tests bleiben grün.
- **AC-8:** Der V1.7-Pixelvergleich wird bewusst als blockierendes Ziel ersetzt, nicht durch eine höhere Toleranz abgeschwächt. Nach manueller Nutzerabnahme existiert eine aktuelle Referenz unter `test-fixtures/reference/fittrack_instagram_current_approved.png`, und der aktuelle Referenztest verwendet diese Datei. Das alte V1.7-PNG bleibt unverändert archiviert und wird nicht als aktuelles Pass/Fail-Gate verwendet.
- **AC-9:** Ein gezielter Regressionstest prüft die Hantel- und `PRO PORTION`-Anforderungen strukturell und/oder anhand gerenderter Pixel. Der Smoke-Test rendert weiterhin ohne Golden-Vergleich erfolgreich, auch mit `nutritionHighlight: null`.
- **AC-10:** QA erstellt den separaten Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md` mit Verdict, vollständiger AC-Matrix, Testkommandos, manueller Nutzerabnahme und Findings-Behandlung. Ein nicht behobenes Hantel-Clipping oder eine sichtbare opake `PRO PORTION`-Box ist ein Blocking Finding.

## 21. Risks and Edge Cases

- **Card-Clipping bleibt bestehen:** Ein bloßes Verschieben des negativen Offsets reicht nicht, wenn ein übergeordneter Card-Container weiter beschneidet. Die Hantel muss strukturell außerhalb des beschneidenden Inhaltsbereichs liegen oder in einem nachweislich sichtbaren Wrapper gerendert werden.
- **Label liegt auf der Card-Kante:** Eine transparente Textfläche kann die Card-Oberkante hinter dem Text sichtbar lassen. QA prüft, ob die Hantel-Mittelspalte und die Z-Order als bewusste Gestaltung gelesen werden; eine neue opake Abdeckfläche ist keine zulässige Reparatur.
- **Asset weiterhin zu filigran:** Erst wenn die vollständige Ausgabe trotz entferntem Clipping unklar bleibt, darf Backend die Plattengeometrie im bestehenden SVG minimal verstärken. Eine neue Bibliothek oder ein neues, nicht dokumentiertes Asset ist ausgeschlossen.
- **Unbeabsichtigte Layoutverschiebung:** Die neue Nutrition-Gruppe darf Card-Inhalt, Footer-Wortmarke oder Canvas-Höhe nicht verschieben. Der gezielte Test und der aktuelle Referenztest decken dies ab.
- **Veraltete V1.7-Differenz:** Eine Abweichung zum alten PNG ist nach dieser Planentscheidung kein Finding, solange die neuen Kriterien, der aktuelle Referenztest und die Nutzerabnahme erfüllt sind. Der alte Test darf dafür weder durch Toleranzaufweitung noch durch kommentarloses Löschen entkräftet werden.
- **Plattformabhängiges Rasterizing:** Die bestehende `@resvg/resvg-js`-Plattformabhängigkeit bleibt ein PoC-Risiko. Die aktuelle Referenz wird in derselben lokalen Umgebung erzeugt, in der der Renderer geprüft wird; Cross-Platform-CI bleibt außerhalb dieses Plans.
- **Manuelle Abnahme fehlt:** Ohne ausdrückliche Nutzerfreigabe darf QA die aktuelle Referenz nicht als akzeptiert behandeln. Das ist ein manueller Gate-Status, kein stillschweigend geschlossener Finding.

## 22. Findings-Behandlung

- QA führt visuelle oder technische Abweichungen ausschließlich gegen die Acceptance Criteria dieses Folgeplans.
- Hantel-Clipping, fehlende Plattenklarheit oder eine opake `PRO PORTION`-Box werden als `Blocking`, Owner `Backend`, an B-VF-1 zurückgegeben.
- Ein Fehler im aktuellen Referenztest nach Nutzerabnahme wird als Regression gegen die aktuelle Referenz behandelt.
- Unterschiede zur historischen V1.7-Datei werden nicht als Finding erfasst, sofern sie aus der bewusst freigegebenen Designänderung stammen.
- Unausgeführte Cross-Platform-, CI- oder nicht benötigte Environment-Prüfungen werden als `UNVERIFIED` dokumentiert, nicht als Finding eingestuft.
- Die ursprüngliche PoC-QA-Datei bleibt unverändert; neue Findings und das finale Verdict stehen ausschließlich im neuen Folge-Report.

## 23. Recommended Execution Order and Handoffs

Die Ausführung erfolgt strikt sequenziell:

1. **Planfreigabe:** Orchestrator holt ein erneutes `APPROVE` für diese Folgeplanung ein.
2. **Backend B-VF-1:** Nutrition-Header-Komposition ändern, Hantel ohne Clipping rendern, `PRO PORTION` transparent machen, lokales PNG erzeugen und Handoff mit finalen Koordinaten übergeben.
3. **QA Q-VF-1:** Gezielte Hantel-/Label-Regressionstests erstellen und ausführen. Blocking Findings gehen an Backend zurück; danach erfolgt ein erneuter fokussierter Lauf.
4. **Manuelle Nutzerabnahme:** Nutzer prüft `backend/output/quarkbroetchen.png`. Bei Ablehnung wird die konkrete visuelle Abweichung als Backend-Finding zurückgegeben. Bei Annahme wird die Freigabe für die Referenzpromotion dokumentiert.
5. **Backend B-VF-2:** Akzeptiertes PNG als `fittrack_instagram_current_approved.png` festschreiben, den aktuellen Referenztest herstellen und renderer-interne Metriken aktualisieren.
6. **QA Q-VF-2:** Aktuellen Referenztest, gezielte Regressionstests, Smoke-Test, vollständige Backend-Tests, Typecheck, Build-Verify und Render-Skript ausführen; separaten QA-Report schreiben.
7. **Abschluss:** Nur bei erfüllten ACs, dokumentierter Nutzerabnahme und ohne Blocking Finding gilt diese Folgeänderung als abgeschlossen. Eine spätere Integrationsplanung bleibt außerhalb dieses Plans.

## 24. Planstatus

Dieser Plan ist vollständig und implementation-ready, aber bis zur expliziten Freigabe gesperrt. Er schreibt keinen Produktionscode, keine Tests und keine QA-Artefakte; diese entstehen erst in den beschriebenen Work Packages.

Plan complete. Type APPROVE to begin implementation, or describe what you want to change.
