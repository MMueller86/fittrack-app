# Technischer Plan: FitTrack Instagram Recipe Renderer - Meta-Zeile im letzten POC-Korrekturlauf

- **Status:** APPROVED - Product Owner hat die Bewertung "sinnvoll mit Änderungen" und den fixture-only POC-Umfang genehmigt; bereit für die sequenzielle Umsetzung
- **Plan-Typ:** Letzte lokale Renderer-Korrekturrunde vor der späteren echten Rezeptintegration
- **Vorgänger:** `PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md`
- **Infrastructure Impact:** None
- **Mobile Build Impact:** None
- **QA-Report:** `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`

**Ausführungsgate:** Dieser Plan ist als technische Umsetzung des bereits bewerteten und genehmigten POC-Umfangs freigegeben. In dieser Planungsrunde werden ausschließlich diese Markdown-Datei sowie keine Produktionsdateien, Tests, Fixtures oder Assets geändert. Die Umsetzung läuft strikt sequenziell über Backend und danach QA. Eine spätere Integration in Rezeptmodell, AI-Vertrag, API, Persistenz und Mobile-Nutzerbestätigung ist nicht Bestandteil dieses Plans.

## 1. Requirement Assessment

### Klassifikation

**Accept with modifications.** Die Meta-Zeile ist als letzte POC-Politur sinnvoll, weil sie den bislang ungenutzten Footer-Bereich mit drei für ein Rezept relevanten Informationen füllt, ohne die Nutrition Card zu vergrößern oder die bestehende Informationshierarchie umzubauen. Die genehmigte Modifikation begrenzt die Umsetzung auf einen optionalen, vollständig validierten Renderer-Input und Beispielwerte im Fixture. Es gibt keine neue AI-Anfrage und keine echte Integrationsentscheidung in dieser Runde.

### Nutzerproblem

Unterhalb der bestehenden Nährwertkarte bleibt bis zur Wortmarke ein ruhiger, ungenutzter Bereich. Die Grafik ist funktional und als 4:5-Feed-Post bereits brauchbar, aber Gesamtzeit, Portionen und Schwierigkeit fehlen als schnelle sekundäre Orientierung. Eine zusätzliche Card oder ein weiterer farbiger Block würde diesen Bereich zwar füllen, aber die bestehende Nutrition-Signatur schwerer und weniger ruhig machen.

### Produkt- und Designbewertung

Die genehmigte Lösung ist für Influencer- und Product-Design-Zwecke sinnvoll, wenn die Meta-Zeile klar sekundär bleibt:

- Drei kurze Rezeptsignale erhöhen die Scanbarkeit im Feed.
- Eine ungerahmte, zentrierte Zeile nutzt den freien Bereich, ohne eine zweite Card-Hierarchie zu erzeugen.
- Line-Icons geben den drei Werten eine schnelle visuelle Zuordnung.
- Die bestehende Nutrition Card, der Hanteltrenner, `PRO PORTION`, das Foto und die Wortmarke behalten ihre etablierte Gewichtung.
- Die Zeile darf weder als Pill-Gruppe noch als zusätzlicher limefarbener Akzentblock erscheinen.

### AI- und Domänenbewertung

AI ist für diese POC-Änderung nicht erforderlich. Die Renderer-Eingabe erhält lokale Beispielwerte. Die tatsächliche Herkunft von Zeit und Schwierigkeit aus einer späteren AI-/Rezeptintegration wird nicht in diesem Plan entschieden. `portions` kommt bei der späteren echten Integration aus dem bestätigten Rezeptwert; im POC wird ein Fixture-Wert verwendet. Es werden keine Nutrition-, Portionierungs-, Gesundheits- oder Fachregeln neu abgeleitet.

### Einfachste tragfähige Lösung

Die kleinste passende Lösung ist:

1. den lokalen Renderer-Input um ein optionales, nur im Renderer verwendetes `recipeMeta`-Objekt zu ergänzen;
2. eine einzelne Meta-Zeile zwischen Nutrition Card und Wortmarke zu komponieren;
3. drei bereits lokal verfügbare Line-Icons zu laden;
4. vollständige Werte strikt zu validieren und bei fehlenden/ungültigen Werten keinen Teilinhalt zu rendern;
5. die neue Darstellung über Sharp-, Struktur- und Downscale-Tests zu schützen.

## 2. Feature Summary

Der Backend-Renderer erhält eine optionale, ungerahmte Meta-Zeile im Footer:

```text
[Timer] 25 Min.  ·  [Portionen] 8 Portionen  ·  [Schwierigkeit] Einfach
```

Die konkrete visuelle Darstellung besteht aus drei gleichartigen Line-Icons und den Beispielwerten `25 Min. · 8 Portionen · Einfach`. Die Zeile wird horizontal innerhalb des bestehenden Content-Bereichs zentriert, einzeilig gesetzt und als sekundäre Information für 100-Prozent-Ansicht und 4:5-Thumbnail ausgerichtet.

Die Änderung ist renderer-only/fixture-only:

- Keine neue AI-Anfrage im Renderpfad.
- Keine Änderung an Shared Recipe-Typen, Rezept-API, Cosmos-Dokumenten, Mobile-Wizard, Quoten, Endpoints oder Infrastruktur.
- Keine Änderung an Hanteltrenner, `PRO PORTION`, Nährwertkarte, deren Geometrie oder dem übrigen Layout.

## 3. Current Behaviour

- `renderInstagramRecipe(input)` ist eine lokale importierbare Backend-Funktion unter `backend/src/lib/instagramRenderer/`.
- `RenderInput` enthält derzeit Foto, Präsentationswerte, Titel, Tags, `nutritionHighlight` und Nutrition-Werte, aber keine Rezept-Meta-Daten.
- `compose.ts` rendert nach Titel/Tags die Nutrition Card, danach Hantel, `PRO PORTION` und Wortmarke. Zwischen Card und Wortmarke existiert keine Meta-Zeile.
- Die Nutrition Card liegt bei `x=88, y=1048, width=904, height=144` und endet bei `y=1192`.
- Die Wortmarken-Layoutbox beginnt bei `y=1242`; der Bereich dazwischen ist Ambient-Footerfläche.
- Der aktuelle Renderer nutzt lokale SVG-/PNG-Assets, lokale Fonts, Satori, Resvg und Sharp. Es besteht kein HTTP- oder AI-Aufruf im Renderpfad.
- Das historische Golden-Fixture wird ohne neue Meta-Zeile geprüft. Es ist eine historische Referenz und darf weder ersetzt noch gelockert werden.

## 4. Desired Behaviour and Presentation

### 4.1 Gewünschte Darstellung

Die neue Zeile wird als Root-Layer nach der Nutrition Card und vor der Wortmarke eingefügt. Sie ist nicht Bestandteil der Card und erhält keinen eigenen Rahmen oder Hintergrund.

Verbindliche visuelle Startwerte im `1080 x 1350`-Canvas:

| Element | Zielwert |
|---|---:|
| Meta-Zeile X | bestehender Content-Bereich `x=88..992`, Inhalt horizontal zentriert |
| Meta-Zeile Y | ungefähr `1204` |
| Meta-Zeilenhöhe | ungefähr `24 px`, Zielbereich `y=1204..1228` |
| Icongröße | ungefähr `20 x 20 px` |
| Textgröße | ungefähr `18 px` |
| Zeilenhöhe | ungefähr `24 px` |
| Card-Unterkante bis Zeilenanfang | `1192 -> 1204`, ungefähr `12 px` |
| Zeilenende bis Wortmarkenbox | `1228 -> 1242`, ungefähr `14 px` |
| Zeilenbreite | maximal bestehender Content-Bereich; keine horizontale Überschreitung |

Die drei festen lokalen Line-Icon-Zuordnungen sind:

- Gesamtzeit: `timer.svg`
- Portionen: `users.svg`
- Schwierigkeit: `gauge.svg`

Die Assets werden aus der bereits vorhandenen lokalen `lucide-static`-Quelle wiederverwendet. Es wird keine neue Icon-Bibliothek und kein handgezeichnetes Ersatz-Asset eingeführt. Icons und Text verwenden eine zurückhaltende sekundäre Renderer-Farbe; es gibt keinen zusätzlichen limefarbenen Block.

Die drei Item-Gruppen werden durch den sichtbaren Mittelpunkttrenner `·` und einen konsistenten Abstand getrennt. Die Zeile bleibt einzeilig und ohne Umbruch. Der Text wird nicht geraten, ersetzt oder still gekürzt.

### 4.2 Vollständigkeits- und Validierungsverhalten

Der lokale Renderer-Input erhält ausschließlich für diese POC-Runde:

```ts
recipeMeta?: {
  totalTimeMinutes: number;
  portions: number;
  difficulty: string;
};
```

Regeln:

- `recipeMeta` fehlt: Der Renderer rendert erfolgreich ohne Meta-Zeile. Card, Hantel, `PRO PORTION`, Wortmarke und alle anderen Pixel außerhalb der Meta-Zone bleiben unverändert.
- `recipeMeta` ist vorhanden: Alle drei Felder müssen gültig sein. Die Zeile wird nur vollständig gerendert.
- `totalTimeMinutes` und `portions` müssen endliche positive ganze Zahlen sein. `0`, negative, nicht-endliche und nicht-ganzzahlige Werte sind ungültig.
- `difficulty` muss ein String mit sichtbarem, nicht-leerem Inhalt ohne Zeilenumbruch sein. Führende und nachgestellte Leerzeichen dürfen für die Darstellung entfernt werden; ein leerer oder nur aus Leerzeichen bestehender Wert ist ungültig.
- Eine ungültige oder unvollständige Meta-Struktur führt fail-closed zu `INVALID_RECIPE_META` mit Feldbezug. Es wird kein Teilobjekt gerendert und es gibt keine geratenen Defaults.
- Wenn eine formal gültige Schwierigkeit wegen ihrer gemessenen Breite nicht in die einzeilige Content-Zone passt, führt der Renderer fail-closed zu `RECIPE_META_OVERFLOW`. Es gibt keine stille Trunkierung oder Teilzeile.
- `1` wird als `1 Portion` dargestellt; alle Werte größer als `1` als `<n> Portionen`.
- Die Zeit wird als `<n> Min.` und der validierte Schwierigkeitswert als Label dargestellt.

### 4.3 Erhaltene Darstellung

Unverändert bleiben:

- `1080 x 1350` PNG und bestehender 4:5-Rahmen.
- Foto, Crop, Focus, Zoom, Transition, Titel und Tags.
- Nutrition Card, Card-Hintergrund, Radius, Border, Werte, Rundung und Divider-Geometrie.
- Hanteltrenner, seine `904:64`-Asset-Proportion, Symmetrie und Position.
- `PRO PORTION` als zentrierter Lime-Text ohne Hintergrund, Border oder Schatten.
- Highlight-Auswahl und Null-Highlight-Verhalten.
- Wortmarke, ihre Größe, Zentrierung und Position.

## 5. Scope

### In Scope

- Optionales lokales `recipeMeta`-Feld im Renderer-Input, ohne Änderung eines Shared Recipe-Typs.
- Strikte Renderer-Validierung für Zeit, Portionen und Schwierigkeitslabel.
- Eine ungerahmte, zentrierte, einzeilige Meta-Zeile zwischen Card und Wortmarke.
- Drei lokale Line-Icons aus der vorhandenen `lucide-static`-Quelle: `timer.svg`, `users.svg`, `gauge.svg`.
- Exakte POC-Beispielwerte `25 Min.`, `8 Portionen`, `Einfach` in einem separaten Meta-Fixture beziehungsweise Render-Fixture.
- Singular-/Plural-Formatierung für Portionen.
- Struktur-, Bounding-, Overlap-, Sharp- und 4:5-Downscale-Tests.
- Test mit vollständigen Meta-Daten und Test ohne Meta-Objekt.
- Test mit ungültiger Zeit, ungültigen Portionen und ungültigem Label.
- Test mit `nutritionHighlight: null` und vollständigen Meta-Daten.
- Lokales Arbeits-PNG über das vorhandene Render-Skript.
- Dauerhafter QA-Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`.

### Out of Scope

- Keine Erweiterung oder Änderung von `shared/types/recipes.ts` oder anderer Shared Recipe-Typen.
- Keine Änderung an Recipe-Create-/Update-API, API-Response, Rezeptmodell, Cosmos-Dokumenten oder Persistenz.
- Keine Änderung an AI-Prompt, Structured Output, AI-Schema, Azure-OpenAI-Aufruf oder Quoten.
- Keine neue HTTP-Funktion, kein Endpoint, keine Authentifizierung und keine Nutzerbestätigung.
- Keine Mobile-Screen-, Mobile-Wizard-, Navigation-, API-Client- oder Native-Build-Arbeit.
- Keine Infrastructure-, Cosmos-, Storage-, Deployment- oder Release-Arbeit.
- Keine neue Card, keine Pills, kein weiterer limefarbener Block und keine allgemeine Footer-Neugestaltung.
- Keine Änderung an Hanteltrenner, `PRO PORTION`, Nährwertkarte, Nährwertgeometrie oder restlichem Layout.
- Keine Änderung des historischen Golden-PNGs, des historischen Pixelmatch-Thresholds `0.10` oder des Differenz-Gates `0.03`.
- Keine Erstellung oder Promotion einer aktuellen freigegebenen Referenzdatei.
- Keine Integration realer Rezeptdaten in den Renderer über diesen POC hinaus.

## 6. Confirmed Facts

### Aus dem Repository

- Der Renderer ist eine lokale TypeScript-Library unter `backend/src/lib/instagramRenderer/`.
- `renderInstagramRecipe(input)` liefert weiterhin ein PNG mit `1080 x 1350`.
- `RenderInput` besitzt derzeit kein Rezept-Meta-Objekt.
- `compose.ts` rendert derzeit keine Meta-Zeile.
- `NUTRITION_CARD_BOTTOM_Y` ist `1192`; `WORDMARK_Y` ist `1242`.
- Die bestehende Layout- und Teststruktur verwendet Sharp für PNG-/Rohpixelprüfungen und Vitest für fokussierte Tests.
- Die bestehende lokale Iconquelle `lucide-static` enthält `timer.svg`, `users.svg` und `gauge.svg`; `timer.svg` ist bereits im vorhandenen Renderer-Icon-Mapping in Gebrauch.
- Der historische Golden-Test verwendet die bestehende Quarkbrötchen-Fixture und die unveränderten historischen Schwellen.

### Aus der genehmigten Nutzerfassung

- Die Rezeptdaten werden für diese POC-Runde als vorhanden angenommen.
- Für Renderer-Test und Fixture dürfen Beispielwerte verwendet werden.
- Die Beispielwerte sind `25 Min.`, `8 Portionen`, `Einfach`.
- `portions` kommt erst bei der echten Integration aus dem bestätigten Rezeptwert.
- Die spätere Erweiterung von Rezeptmodell, AI-Schema, API, Persistenz und Nutzerbestätigung ist ausdrücklich nicht Teil dieser POC-Runde.
- Die vier bisherigen Integrationsfragen blockieren diesen Plan nicht.
- Die Bewertung "sinnvoll mit Änderungen" und der fixture-only POC-Umfang sind genehmigt.

## 7. Assumptions and Later Integration Decisions

### Technische Annahmen

- Die bestehende Satori-/Resvg-Kette kann drei lokale SVG-Line-Icons in der vorgesehenen Größe deterministisch rasterisieren.
- Die Zielzone `y=1204..1228` passt zwischen Card-Unterkante `1192` und Wortmarkenbox ab `1242`, ohne bestehende Layer zu verschieben.
- Die sichtbaren Text- und Iconpixel können im lokalen Windows-Renderer mit Sharp ausreichend reproduzierbar gemessen werden. Rastertoleranzen werden nur dort verwendet, wo Anti-Aliasing sie erforderlich macht.
- Die konkrete POC-Inputform bleibt lokal und wird nicht als zukünftiger API- oder Recipe-Vertrag ausgegeben.

### Keine offenen POC-Blocker

Es gibt keine offene Product-Owner-Entscheidung, die die POC-Umsetzung blockiert. Die folgenden Themen sind bewusst spätere Integrationsentscheidungen und gehören nicht zu den Acceptance Criteria dieses Plans:

1. Rezeptmodell und Herkunft des bestätigten `portions`-Werts.
2. AI-Schema beziehungsweise Quelle und Validierung von Gesamtzeit und Schwierigkeit.
3. API-/Persistenz-Propagation der Meta-Daten einschließlich Rückwärtskompatibilität.
4. Mobile Nutzerbestätigung und der genaue Zeitpunkt, an dem die Werte vor einer echten Speicherung oder Freigabe geprüft werden.

Diese Punkte werden in einer späteren Integrationsplanung betrachtet. Sie sind keine `[Open]`-Blocker dieses fixture-only POCs und dürfen die Backend- oder QA-Ausführung nicht anhalten.

## 8. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/types.ts` für den lokalen Renderer-Input.
- `backend/src/lib/instagramRenderer/layout.ts` für bestehende Canvas-, Card-, Footer- und Farbkonstanten sowie neue Meta-Zonen-Konstanten.
- `backend/src/lib/instagramRenderer/compose.ts` für die Root-Layer-Reihenfolge und statische Satori-Elemente.
- `backend/src/lib/instagramRenderer/render.ts` für Validierung, Satori-Messung, Resvg und lokale Assets.
- `backend/src/lib/instagramRenderer/tagIcons.ts` als Muster für lokales SVG-Laden und Stroke-Normalisierung; das bestehende Tag-Mapping wird nicht verändert.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` für die historische No-Meta-Fixture und eine getrennte POC-Meta-Variante.
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts` für den bestehenden Null-Highlight-Regressionspfad.
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` für bestehende Card-/Hantel-/`PRO PORTION`-Geometrieassertions.
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts` für den Null-Highlight-Vergleich.
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` und `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png` für den unveränderten historischen Kontrollpfad.
- `backend/scripts/render-golden.mjs` und das bestehende Script `render:instagram-reference` für das lokale Arbeits-PNG.
- `sharp` für Rohpixel-, Bounding-, Overlap- und Downscale-Prüfungen.

## 9. Proposed Technical Solution

### 9.1 Lokaler Renderer-Vertrag

`RenderInput` erhält ein optionales Feld `recipeMeta`, das ausschließlich im Backend-Renderer-Modul definiert und verwendet wird. Es wird nicht aus `@fittrack/shared` importiert und nicht in einen API-Vertrag exportiert.

Die Validierung läuft vor dem Compose-/Assetpfad. Dadurch werden ungültige Meta-Daten deterministisch und ohne Teilrender abgewiesen. Ein fehlendes Feld bleibt ein gültiger Legacy-/No-Meta-Fall.

### 9.2 Compose und Layer-Reihenfolge

Die Root-Reihenfolge bleibt bis einschließlich Nutrition Card unverändert. Danach gilt:

1. Nutrition Card inklusive Wertzeile und Divider.
2. Optional vollständige Meta-Zeile.
3. Hanteltrenner, `PRO PORTION` und Wortmarke in ihrer bestehenden Reihenfolge beziehungsweise mit den bestehenden Layerankern.

Die konkrete Implementierung darf die Hantel-/Label-Layer nur so anfassen, dass ihre aktuelle Geometrie unverändert bleibt. Die Meta-Zeile darf kein Kind der Nutrition Card werden, damit `overflow: hidden` und Card-Geometrie unverändert bleiben.

Die Meta-Zeile erhält interne Marker für fokussierte Tests, zum Beispiel `recipe-meta-row`, `recipe-meta-item` und `recipe-meta-icon`. Diese Marker sind kein öffentlicher Renderer-Vertrag.

### 9.3 Meta-Zeilen-Geometrie

Die Layoutkonstanten sollen die genehmigten Startwerte ausdrücklich benennen:

```text
RECIPE_META_ROW_X = CONTENT_LEFT = 88
RECIPE_META_ROW_TOP_Y = 1204
RECIPE_META_ROW_WIDTH = CONTENT_WIDTH = 904
RECIPE_META_ROW_HEIGHT = 24
RECIPE_META_ICON_SIZE = 20
RECIPE_META_FONT_SIZE = 18
RECIPE_META_LINE_HEIGHT = 24
```

Die gesamte Gruppe wird im `904 px`-Bereich horizontal zentriert. Icons und Texte bleiben innerhalb des Row-Bereichs; die zwei sichtbaren Mittelpunkttrenner werden nicht als Card, Pill oder Hintergrundfläche umgesetzt. Die Zeile bekommt weder Border noch Radius noch Schatten noch eigenes Hintergrundrechteck.

Die Meta-Zeile wird mit `whiteSpace: nowrap` und einer gemessenen Maximalbreite aufgebaut. Bei Breitenüberschreitung wird `RECIPE_META_OVERFLOW` zurückgegeben, statt Text zu schneiden oder auf eine zweite Zeile umzubrechen.

### 9.4 Icon-Laden

Die drei SVGs werden aus der vorhandenen lokalen Paketquelle geladen und in derselben lokalen, deterministischen Weise wie bestehende Renderer-Icons in den Compose-Baum eingebettet. Stroke, Linecap, Linejoin und Farbe werden auf einen gemeinsamen neutralen Meta-Stil normalisiert. Es wird keine Runtime-Netzwerkquelle und keine zusätzliche Dependency verwendet.

Die vorhandene Tag-Icon-Semantik bleibt unverändert. Die Meta-Icons werden nicht als neue Recipe-Tags registriert und verändern `resolveTagIcon()` nicht.

### 9.5 Fixture- und Golden-Trennung

Die bestehende historische Quarkbrötchen-Fixture bleibt ohne `recipeMeta`, damit `golden.test.ts` weiterhin den historischen No-Meta-Zustand gegen das unveränderte Golden-PNG prüft. Für den neuen POC wird eine getrennte, benannte Meta-Fixture oder eine explizit abgeleitete Fixture-Variante verwendet:

```text
recipeMeta.totalTimeMinutes = 25
recipeMeta.portions = 8
recipeMeta.difficulty = "Einfach"
```

`render:instagram-reference` verwendet die neue Meta-Fixture, damit `backend/output/quarkbroetchen.png` die genehmigte Darstellung für die manuelle POC-Abnahme zeigt. Der historische Golden-Pfad verwendet weiterhin die No-Meta-Fixture. Dadurch werden neue Meta-Pixel nicht durch eine stillschweigende Änderung der historischen Referenz kaschiert.

## 10. Backend Work Package

### B-META-1 - Renderer-only Meta-Zeile und POC-Fixture

**Agent:** Backend

**Goal**

Die genehmigte Meta-Zeile als lokale, optionale Renderer-Funktion implementieren, vollständige Werte fail-closed validieren, die bestehende Nutrition-/Footer-Geometrie unverändert halten, die POC-Fixture mit Beispielwerten ausstatten, fokussierte Tests ergänzen und das neue Arbeits-PNG erzeugen.

**Required Knowledge Base:**

- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/product/01-product-philosophy.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/types.ts`
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/tagIcons.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/scripts/render-golden.mjs`
- `backend/package.json`

**Required Skills:**

None. Es gibt in diesem Work Package keine AI-, Cosmos-, Persistenz- oder Infrastructure-Entscheidung.

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

**Dependencies:**

- Dieser genehmigte Plan und der bestehende Renderer-Arbeitsstand.
- Die lokal vorhandenen `lucide-static`-SVGs `timer.svg`, `users.svg` und `gauge.svg`.
- Keine Abhängigkeit von Mobile, Shared, Infrastructure, AI, Cosmos oder einer späteren echten Rezeptintegration.

**Expected Handoff:**

- Lokales optionales `recipeMeta`-Input mit dokumentierter Validierung und den Fehlercodes `INVALID_RECIPE_META` sowie `RECIPE_META_OVERFLOW`.
- Vollständige Meta-Zeile mit den Beispielwerten `25 Min. · 8 Portionen · Einfach`, drei konsistenten Line-Icons und der Zielzone `y=1204..1228`.
- Nachweis, dass Card, Hanteltrenner, `PRO PORTION`, Nutrition-Card-Geometrie, Wortmarke und restliches Layout unverändert bleiben.
- Separate Meta-Fixture für den POC sowie unveränderte historische No-Meta-Fixture für den Golden-Test.
- Fokussierte Vitest-/Sharp-Tests für vollständige, fehlende, ungültige, Singular-/Plural-, Null-Highlight-, Bounding-/Overlap- und Downscale-Fälle.
- `backend/output/quarkbroetchen.png` als neues `1080 x 1350`-Arbeits-PNG mit Meta-Zeile.
- Kurze Aussage im Handoff, dass keine Shared-, AI-, API-, Persistenz-, Mobile-, Quoten-, Endpoint- oder Infrastrukturdatei geändert wurde.

## 11. Frontend Work Package

**None.** Es gibt keine Frontend-, Mobile-, Shared- oder Native-Build-Arbeit. `portions` wird im POC ausschließlich als Fixture-Wert verwendet; eine mobile Anzeige oder Nutzerbestätigung wird erst bei der späteren Integration geplant.

## 12. QA Work Package

### Q-META-1 - Renderer-Regression, Pixelprüfung und dauerhafter QA-Report

**Agent:** QA

**Goal**

Die Backend-Umsetzung gegen alle Acceptance Criteria prüfen, die Meta-Zeile als vollständige und optionale Darstellung verifizieren, bestehende Footer-Geometrie und historische Golden-Kontrollen schützen, die 4:5-Thumbnail-Eignung prüfen und den vollständigen Review dauerhaft im planbezogenen QA-Report dokumentieren.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/product/01-product-philosophy.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**

- B-META-1-Handoff
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`
- `backend/src/lib/instagramRenderer/types.ts`
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/output/quarkbroetchen.png`
- `backend/package.json`
- `docs/qa/reports/README.md`

**Required Skills:**

None. Der POC ändert weder AI-Verhalten noch Cosmos-Persistenz.

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

**Dependencies:**

- B-META-1 ist abgeschlossen und liefert das Meta-Fixture, den Teststand und das neue Arbeits-PNG.
- Der historische Golden-Pfad und seine Referenzdatei bleiben verfügbar und unverändert.
- QA nimmt keine Implementierung vor und löst keine späteren Integrationsfragen im Review auf.

**Expected Handoff:**

- Dauerhafter Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`.
- Format `fittrack-qa-v1` mit genau einem Verdict.
- Kriterienmatrix für AC-1 bis AC-14, jedes Kriterium genau einmal mit Ergebnis und Evidence.
- Testbefehle mit Exit-Code und Ergebnis.
- Separate Abschnitte `UNVERIFIED` und `MANUAL VALIDATION REQUIRED` für plattform- oder manuell begrenzte Prüfungen.
- Strukturierte Findings mit Planreferenz, Acceptance Criterion, Criticality, Owner, Evidence und Recommendation; keine direkte Änderung an `docs/qa/findings.md`.
- Explizite Aussage, dass keine aktuelle Referenzdatei erzeugt oder promoted wurde.

## 13. Shared Package Changes

Keine. `shared/` und insbesondere die Shared Recipe-Typen bleiben unverändert.

## 14. Infrastructure and Configuration

**Infrastructure Impact: None.** Es gibt keine Bicep-, Cosmos-, Storage-, Azure-, Environment-, Deployment- oder Release-Änderung. Es ist kein Infrastructure-&-Release-Work-Package erforderlich.

Die Umsetzung wird lokal im Backend geprüft. Alpha und Production sind von diesem fixture-only Renderer-POC nicht betroffen. Es wird keine neue npm-Abhängigkeit eingeführt; `lucide-static`, Sharp, Vitest, Satori und Resvg werden aus dem bestehenden Backend-Setup wiederverwendet.

## 15. Documentation Updates

- Der Planner schreibt in dieser Runde ausschließlich diesen neuen Plan unter `docs/User Stories/plans/`.
- Backend darf nur renderernahe Test-/Fixture-Dokumentation aktualisieren, falls die konkreten Meta-Bounds für die Messbarkeit dort bereits dokumentiert werden; eine Änderung der Knowledge Base ist nicht erforderlich und nicht Teil dieses Plans.
- QA erstellt ausschließlich den planbezogenen Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`.
- QA schreibt nicht `docs/qa/findings.md`; relevante Findings werden an den Orchestrator übergeben.
- Keine spätere Integrationsdokumentation wird vorweggenommen oder als implementiert beschrieben.

## 16. Test Strategy

### 16.1 Vollständige Meta-Daten

Ein fokussierter Test rendert die separate Meta-Fixture mit `25`, `8` und `Einfach` und prüft:

- `renderInstagramRecipe()` liefert `ok=true`, PNG und `1080 x 1350`.
- Der Compose-Baum enthält genau eine Meta-Zeile, genau drei Meta-Item-Gruppen und drei Line-Icons.
- Die sichtbaren Inhalte sind `25 Min.`, `8 Portionen` und `Einfach`, getrennt durch `·`.
- Die Zeile ist ein ungerahmter Root-Layer zwischen Card und Wortmarke.
- Die Zeile ist einzeilig, zentriert und innerhalb `x=88..992`.

### 16.2 Kein Meta-Objekt

Ein zweiter Render nutzt dieselben übrigen Eingabewerte ohne `recipeMeta` und prüft:

- kein Meta-Node und keine Meta-Pixel;
- kein Fehler und weiterhin gültiges PNG;
- Card-, Hantel-, `PRO PORTION`- und Wortmarken-Node bleiben vorhanden;
- ein Pixelvergleich mit und ohne Meta zeigt außerhalb der erwarteten Meta-Zone keine Unterschiede. Damit bleibt die optionale Zeile tatsächlich optional und verschiebt kein anderes Layout.

### 16.3 Ungültige Werte und kein Teilrender

Fokussierte Fälle decken mindestens ab:

- `totalTimeMinutes = 0`, negativ, nicht-ganzzahlig und nicht-finit;
- `portions = 0`, negativ, nicht-ganzzahlig und nicht-finit;
- fehlendes Feld, leerer String, nur Leerzeichen, Nicht-String oder Zeilenumbruch bei `difficulty`.

Jeder Fall liefert `INVALID_RECIPE_META` mit Feldbezug. Ein überlanges, ansonsten sichtbares Label liefert `RECIPE_META_OVERFLOW`. Kein Fall rendert eine Teilzeile oder setzt einen Default.

### 16.4 Singular und Plural

Der Test rendert mindestens `portions=1` und `portions=2` und prüft exakt `1 Portion` beziehungsweise `2 Portionen`. `portions=0` wird als ungültig behandelt und nicht als `0 Portionen` dargestellt.

### 16.5 Sharp Bounding und Overlap

Mit Sharp werden die gerenderten PNGs als RGBA-Rohdaten untersucht:

- Der Änderungs-Bounding-Box-Vergleich zwischen vollständiger Meta-Fixture und derselben Eingabe ohne Meta liegt vollständig in der erwarteten Meta-Zone `y=1204..1228`.
- Die Meta-Pixel überschreiten den bestehenden Content-Bereich nicht.
- Es gibt keine Meta-Änderung in der Nutrition Card bis `y=1192`.
- Es gibt keine Meta-Änderung in der Wortmarkenbox ab `y=1242`.
- Die Zeile überschneidet weder Hantel/`PRO PORTION` noch die Wortmarke.
- Die drei Icon-/Text-Gruppen bleiben in einer gemeinsamen, einzeiligen Bounds-Zone.

Anti-Aliasing darf nur einen engen, dokumentierten Randkorridor von höchstens einem Pixel an der Zielzone auslösen; ein tatsächliches Überlappen ist ein Fehler.

### 16.6 4:5-Downscale

Das vollständige `1080 x 1350`-PNG wird mit Sharp auf eine 4:5-Thumbnailgröße, mindestens `216 x 270`, verkleinert. Die Prüfung bestätigt, dass Meta-Zeile, Nutrition Card und Wortmarke weiterhin als getrennte horizontale Zonen erkennbar bleiben und die Meta-Zeile als sekundäre, nicht dominante Information erhalten bleibt. Die Prüfung ist ein Lesbarkeits-/Zonen-Sanity-Check und ersetzt nicht die manuelle visuelle Abnahme.

### 16.7 Null-Highlight

Eine vollständige Meta-Fixture mit `nutritionHighlight: null` wird gerendert. Der Badge bleibt aus, die Meta-Zeile bleibt vollständig, und Card-/Hantel-/`PRO PORTION`-/Wortmarken-Geometrie ändert sich nicht. Der Unterschied zum Highlight-Render darf außerhalb der bestehenden Badge-Zone einschließlich Meta-Zone nicht auftreten.

### 16.8 Historisches Golden

- `fittrack_instagram_golden_v1_7_unified_ambient.png` bleibt byteweise unverändert.
- `golden.test.ts` behält `pixelmatch`-Threshold `0.10` und Differenz-Gate `0.03`.
- Der historische Test verwendet den unveränderten No-Meta-Fixturepfad; die neue Meta-Fixture wird nicht still in den historischen Vergleich eingeschleust.
- Eine aktuelle Referenzdatei wird nicht erstellt oder promoted.

### 16.9 Ausführbare Prüfungen

Backend und QA führen mindestens diese fokussierten Prüfungen aus:

```text
cd backend && npx vitest run src/lib/instagramRenderer/__tests__/recipe-meta.test.ts src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/highlight.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts
cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts
cd backend && npx tsc --noEmit
cd backend && npm run build:verify
cd backend && npm run render:instagram-reference
cd backend && npm test
```

Ein Ausführungsfehler des historischen Golden-Tests darf nicht durch geänderte Schwellen oder eine neue Referenzdatei behoben werden. QA dokumentiert historische beziehungsweise umgebungsbedingte Abweichungen getrennt von Findings.

## 17. Acceptance Criteria

- **AC-1:** Die Änderung bleibt auf `backend/src/lib/instagramRenderer/`, seine lokalen Fixtures/Tests, das bestehende Render-Skript, das lokale Arbeits-PNG und den planbezogenen QA-Report begrenzt. Es gibt keine Änderung an AI-Prompt, Structured Output, Shared Recipe-Typen, Rezept-API, Cosmos-Dokumenten, Mobile-Wizard, Quoten, Endpoints oder Infrastruktur.
- **AC-2:** `renderInstagramRecipe(input)` bleibt die bestehende lokale Renderer-Funktion und liefert für einen gültigen Meta-Input ein PNG mit exakt `1080 x 1350` Pixeln. Es wird keine neue HTTP- oder AI-Anfrage im Renderpfad eingeführt.
- **AC-3:** Ein gültiges `recipeMeta` rendert genau eine vollständige, ungerahmte Zeile zwischen der Nutrition Card und der Wortmarke mit den sichtbaren Werten `25 Min. · 8 Portionen · Einfach` und genau drei konsistenten lokalen Line-Icons für Zeit, Portionen und Schwierigkeit.
- **AC-4:** Die Meta-Zeile liegt als einzeiliger, horizontal zentrierter Layer im bestehenden Content-Bereich `x=88..992` und im Zielbereich ungefähr `y=1204..1228`. Icons sind ungefähr `20 px`, Text ungefähr `18 px`, die Zeilenhöhe ungefähr `24 px`; die Darstellung ist feed-lesbar und sekundär.
- **AC-5:** Die Meta-Zeile besitzt keine zusätzliche Card, keine Pill-Container, keinen Border, keinen Schatten, kein eigenes Hintergrundrechteck und keinen weiteren limefarbenen Block. Die Icons und der Text verwenden einen gemeinsamen zurückhaltenden Line-Icon-/Textstil.
- **AC-6:** Fehlt `recipeMeta`, rendert der Renderer erfolgreich ohne Meta-Zeile. Card, Hanteltrenner, `PRO PORTION`, Nutrition-Werte, Wortmarke und alle Pixel außerhalb der vorgesehenen Meta-Zone bleiben gegenüber dem vollständigen Meta-Render unverändert.
- **AC-7:** Ungültige oder unvollständige Zeit-, Portionen- oder Labelwerte führen fail-closed zu `INVALID_RECIPE_META`; ein zu breites Label führt zu `RECIPE_META_OVERFLOW`. Es gibt weder geratenen Default noch Teilzeile, stille Trunkierung oder Umbruch.
- **AC-8:** Die Portionendarstellung verwendet exakt `1 Portion` für den Wert `1` und `<n> Portionen` für Werte größer als `1`. Nicht-positive oder nicht-ganzzahlige Portionen werden nicht als gültige Anzeige ausgegeben.
- **AC-9:** Nutrition Card, Hanteltrenner, `PRO PORTION`, Nährwertkarte und restliches Layout behalten ihre bestehenden Geometrien und Inhalte: insbesondere Card `x=88, y=1048, width=904, height=144`, Card-Unterkante `y=1192`, bestehende Wertzeile/Divider, bestehende Hantel-Assetproportion und Wortmarkenposition ab `y=1242`. Die Meta-Zeile verschiebt keine dieser Elemente.
- **AC-10:** Der Sharp-Bounding-/Overlap-Test weist nach, dass alle durch die Meta-Zeile verursachten Pixeländerungen in der Zielzone liegen, nicht in die Card bis `y=1192` oder in die Wortmarkenbox ab `y=1242` ragen und weder Hantel/`PRO PORTION` noch Wortmarke überdecken.
- **AC-11:** Der 4:5-Downscale-Test bestätigt bei mindestens `216 x 270`, dass Meta-Zeile, Nutrition Card und Wortmarke als getrennte Zonen bestehen bleiben und die Meta-Zeile als sekundäre Feed-Information lesbar bleibt.
- **AC-12:** Ein vollständiger Meta-Render mit `nutritionHighlight: null` ist erfolgreich, enthält die Meta-Zeile vollständig, enthält keinen Highlight-Badge und verändert außerhalb der bestehenden Badge-Zone keine bestehende Geometrie.
- **AC-13:** Das historische Golden-PNG bleibt unverändert; der historische No-Meta-Goldenpfad sowie `pixelmatch`-Threshold `0.10` und Differenz-Gate `0.03` bleiben unverändert. Es wird keine aktuelle Referenzdatei erzeugt oder promoted.
- **AC-14:** QA erstellt `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md` im Format `fittrack-qa-v1` mit genau einem Verdict, einer vollständigen Matrix für AC-1 bis AC-14, Testkommandos samt Exit-Codes, getrennten `UNVERIFIED`-/`MANUAL VALIDATION REQUIRED`-Abschnitten und strukturierten Findings. Der Report behandelt die späteren Integrationsentscheidungen nicht als POC-Blocker.

## 18. Risks and Edge Cases

- **Unvollständige Daten:** Eine Teilzeile wäre irreführend. Die Validierung muss deshalb vor dem Compose greifen und bei jedem fehlenden/ungültigen Feld fail-closed reagieren.
- **Überlanges Label:** Eine Schwierigkeit kann formal gültig, aber zu breit für die feste Feed-Zone sein. Der Renderer gibt `RECIPE_META_OVERFLOW` zurück und schneidet nicht still.
- **Card-/Wordmark-Overlap:** Die enge Footer-Zone lässt wenig vertikalen Spielraum. Sharp-Bounds und feste `12/14 px`-Abstände müssen die Umsetzung absichern.
- **Rasterung:** Satori/Resvg kann sichtbare Bounds um einzelne Pixel verändern. Es gilt nur ein enger Messkorridor; die Zielzone darf nicht durch breite Toleranzen aufgeweicht werden.
- **Icon-Verfügbarkeit:** Die drei Icons müssen aus der vorhandenen lokalen Quelle geladen werden. Ein fehlendes Asset ist ein Renderer-Asset-Fehler, kein Anlass für eine neue Dependency oder ein anderes Layout.
- **Null-Highlight:** Das Weglassen des Badges darf die Meta-Zeile oder den unteren Footer nicht verschieben.
- **Historischer Goldenpfad:** Die Meta-Fixture darf nicht versehentlich in den No-Meta-Golden-Test gelangen. Die Fixture-Trennung ist deshalb Teil des Handoffs.
- **Spätere Integration:** Die POC-Inputform darf nicht als endgültiger Rezept-/AI-/API-Vertrag interpretiert werden. Diese Erweiterung bleibt ausdrücklich außerhalb dieses Plans.

## 19. Recommended Execution Order

Die Ausführung erfolgt strikt sequenziell:

1. **Backend B-META-1:** Lokales `recipeMeta` definieren und validieren, Meta-Zeile mit den drei vorhandenen Line-Icons komponieren, Meta-Fixture und fokussierte Tests ergänzen, historische No-Meta-Fixture unangetastet lassen und das Arbeits-PNG erzeugen.
2. **Backend-Handoff:** Geänderte Renderer-Dateien, Testresultate, Sharp-Metriken, Fixture-Trennung und die Aussage zum unveränderten Integrationsumfang an QA übergeben.
3. **QA Q-META-1:** Fokussierte Tests, Typecheck, Build-Verify, vollständigen Backend-Test, historischen Goldenpfad, Sharp-Bounds, 4:5-Downscale und Arbeits-PNG prüfen.
4. **QA-Report:** QA schreibt den dauerhaften Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Meta-Line-POC.md`. Manuelle beziehungsweise plattformabhängige Restprüfungen stehen getrennt in `UNVERIFIED` oder `MANUAL VALIDATION REQUIRED`.
5. **Spätere Integration:** Erst in einem separaten, später genehmigten Plan werden Rezeptmodell, bestätigte Portionsquelle, AI-Schema, API, Persistenz und Mobile-Nutzerbestätigung betrachtet. Diese Themen sind kein Abschlusskriterium für den aktuellen POC.

## 20. Planstatus

Der Plan ist vollständig, routingfähig und zur sequenziellen Umsetzung freigegeben. Der Planner ändert in dieser Runde keine Produktionsdateien, Tests, Fixtures, Assets oder Knowledge-Base-Dateien. Der genehmigte POC endet bei der lokalen Renderer-/Fixture-Änderung, deren QA-Verifikation und dem dauerhaften QA-Report; die echte Rezeptintegration bleibt ein späterer separater Entscheidungs- und Umsetzungsgegenstand.
