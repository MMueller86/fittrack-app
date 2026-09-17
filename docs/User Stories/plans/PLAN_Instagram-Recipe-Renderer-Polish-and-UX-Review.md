# Folgeplan: FitTrack Instagram Recipe Renderer - Polish und UX-Review

- **Status:** READY FOR IMPLEMENTATION - keine offene fachliche Produktentscheidung
- **Plan-Typ:** Folgeplan für vier lokale Renderer-Korrekturen und einen begrenzten Instagram-Template-Review
- **Vorgänger:** [PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md](PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md)
- **Vorgänger-Vorgänger:** [PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md](PLAN_Instagram-Recipe-Renderer-Visual-Fixes.md)
- **Letzter QA-Report:** [PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md](../../qa/reports/PLAN_Instagram-Recipe-Renderer-Footer-Alignment.md)

Infrastructure Impact: None
Mobile Build Impact: None

**Ausführungsgate:** Dieser Plan beschreibt ausschließlich die Umsetzung. Produktionscode, Tests, Assets, PNG und QA-Report entstehen erst in den Work Packages. Das historische Golden wird weder gelockert noch ersetzt. Eine Promotion einer aktuellen Referenzdatei bleibt bis zur ausdrücklichen manuellen Nutzerabnahme gesperrt.

## 1. Requirement Assessment

### Klassifikation

**Accept with modifications.** Die vier konkreten Korrekturen werden angenommen. Die Umsetzung bleibt bewusst auf den lokalen Backend-Renderer, seine Assets, Tests und Dokumentation begrenzt. Die kreative Instagram-Bewertung liefert zusätzliche Empfehlungen, darf aber keine ungefragte Gesamtneugestaltung auslösen.

### Nutzerproblem

Die aktuelle 1080-x-1350-Rezeptgrafik ist als wiederholbare Serie grundsätzlich brauchbar, hat aber vier konkrete Schwächen:

1. Im Bereich von `PRO PORTION` wird weiterhin eine horizontale Linie wahrgenommen. Die vorhandene Transparenz des Textcontainers beseitigt die sichtbare Quelle noch nicht zuverlässig.
2. Die Tag-Chips beginnen innen relativ weit vom linken Rand; Icon und Text wirken dadurch weniger kompakt als nötig.
3. Das `HIGH PROTEIN`-Badge verwendet eine eigene, sehr helle Grünpalette, die nicht exakt zur Renderer-Lime und zum übrigen Branding passt.
4. Die Footer-Wortmarke ist ein vollständig opakes Rasterbild, dessen Hintergrund nur durch eine spezielle Ambient-/Alpha-Normalisierung verborgen wird. Die bereitgestellte transparente SVG-Variante kann diese technische und visuelle Schwäche reduzieren.

Zusätzlich soll die Grafik als wiederholbare Instagram-Vorlage beurteilt werden. Dabei geht es um Scanbarkeit, Hierarchie und Wiedererkennbarkeit, nicht um neue Nutrition-Regeln, neue Badge-Logik oder ein anderes Ausgabeformat.

### Produkt- und Domänenbewertung

- Die Korrekturen verändern keine Rezeptdaten, Portionen, Nährwertberechnungen, Tag-Labels, Tag-Icon-Entscheidungen oder fachlichen Badge-Auslöser.
- `nutritionHighlight` bleibt ein expliziter Renderer-Input. Die in der bestehenden Dokumentation offenen Produktionsschwellen werden nicht in diesem Plan entschieden.
- Es gibt keinen AI-, Auth-, API-, Persistenz-, Health-Risk- oder Infrastruktur-Aspekt.
- Die Änderungen verbessern die visuelle Lesbarkeit einer statischen Share-Grafik und führen keine neue mobile Interaktion ein.
- Das bestehende Format `1080 x 1350` bleibt erhalten. Das ist für eine 4:5-Instagram-Feed-Vorlage passend und wird nicht neu bewertet oder ersetzt.

### Einfachere Lösung

Die kleinste sinnvolle Lösung ist eine lokale Änderung an Layer-Geometrie, Chip-Padding, bestehendem Badge-Asset und Footer-Asset. Eine neue Renderer-Abstraktion, ein Endpoint, eine App-Share-UI oder ein Template-System ist dafür nicht erforderlich.

## 2. Recommended Product Behaviour

### MUST-FIX in dieser Renderer-Runde

- `PRO PORTION` bleibt exakt lesbar, zentriert und limefarben. Die konkrete horizontale Linienquelle wird per Pixelprobe identifiziert. Falls sie aus dem Hantel-Schaft stammt, wird ausschließlich der betroffene mittlere Schaftbereich transparent beziehungsweise nicht gezeichnet. Eine schwarze, opake oder einfarbige Abdeckbox ist ausgeschlossen.
- Die Tag-Chips werden innen kompakter: `16 px` linker/rechter Chip-Rand und `6 px` Abstand zwischen Icon und Text als Zielwerte. Icongröße, Icon-Mapping, Tag-Texte, Chip-Höhe und Reihenfolge bleiben unverändert.
- Das vorhandene `HIGH PROTEIN`-Asset wird lokal und deterministisch auf die Renderer-Lime ausgerichtet. Alpha, dunkler Badge-Körper und weiße Beschriftung bleiben erhalten. Position und Highlight-Auswahl bleiben unverändert.
- `micha_logo_writing_02.svg` wird als transparenter Footer-Kandidat übernommen. Die bisherige Rasterwortmarke wird nicht mehr als aktive Standardquelle verwendet. Variante 01 wird nicht verwendet, weil ihr vollflächiges Rechteck den Footer-Hintergrund opak überdecken würde.

### SHOULD-FIX mit kleinem Scope

- Die neue SVG-Wortmarke wird gegenüber der aktuell sichtbaren Rasterwortmarke moderat vergrößert, damit sie im mobilen Feed nicht als zufälliger kleiner Footer-Fleck verschwindet. Der Startwert ist `160 px` sichtbare Breite, mit einem manuellen Abnahmekorridor von `150..180 px`.
- Der fokussierte Renderer-Test erhält neben Einzelassertions auch einen verkleinerten Thumbnail-Sanity-Check. Dieser prüft nicht die persönliche Ästhetik des Nutzers, sondern ob Titel, Tags, Badge, Nutrition Card und Footer beim 4:5-Downscale als getrennte Zonen erkennbar bleiben.

### LATER / Product-Ideas

Diese Punkte sind bewusst keine Voraussetzung für die aktuelle Umsetzung:

- Share-Preview in der App mit 4:5-Crop-Vorschau, Foto-Focus-Safe-Area und Titel-Safe-Area.
- Datenlängenregeln oder eine kontrollierte Kurzform für sehr lange Rezepttitel und ungewöhnlich lange Tag-Texte, statt diese nur durch die vorhandenen Renderer-Grenzen abzuschneiden oder abzulehnen.
- Versionierte Share-Templates, damit spätere Layoutänderungen nicht rückwirkend alte Posts verändern.
- Mehrere Badge-Stati oder zusätzliche Badge-Kategorien. Dafür wären zuerst fachliche Auslöser und Prioritätsregeln zu entscheiden.
- Variable, aber markenkonforme Accent-Farben pro Template beziehungsweise A/B-Tests für Hook, Badge-Größe, Logo-Größe und Titelposition. Erfolg sollte über Stop-Rate, Saves, Shares und Profilaufrufe bewertet werden, nicht nur über subjektive Designmeinung.
- Eine gemeinsame Asset-Quelle für Backend und Mobile. Die aktuelle Runde darf das SVG aus `mobile/assets/brand/` als Input übernehmen, erzwingt aber keine Mobile-Änderung und keinen neuen Native Build.

## 3. Feature Summary

Der bestehende Renderer unter `backend/src/lib/instagramRenderer/` wird lokal poliert:

- Die `PRO PORTION`-Komposition erhält einen reproduzierbaren Nachweis, dass keine fremde horizontale Farblinie durch den Textbereich läuft. Die Hantel bleibt proportional und die bestehende Card-Geometrie bleibt erhalten.
- Die Tag-Innenabstände werden von `21/8 px` auf `16/6 px` reduziert, ohne Icon-Mapping oder Textinhalt zu ändern.
- Das High-Protein-PNG wird auf die vorhandene Brand-Lime abgestimmt, ohne die Badge-Kategorie, Auswahl oder Position zu verändern.
- Die transparente Wortmarke `micha_logo_writing_02.svg` wird als lokales Backend-Asset übernommen, proportional skaliert und ohne die alte PNG-Hintergrund-Normalisierung gerendert.
- Die Ausgabe bleibt lokal deterministisch, netzwerkfrei und exakt `1080 x 1350 px`.
- Der historische V1.7-Golden-Test bleibt unverändert. Neue Gestaltung wird zuerst durch gezielte Struktur- und Pixelassertions geschützt. Eine aktuelle Referenz darf erst nach Nutzerabnahme entstehen.

## 4. Current Behaviour

### 4.1 Renderer und Ausgabe

- Öffentlicher Einstiegspunkt ist `renderInstagramRecipe(input)`.
- Das Ergebnis ist ein lokales PNG mit `1080 x 1350` Pixeln.
- `backend/output/quarkbroetchen.png` ist das aktuelle Arbeits-PNG und keine freigegebene aktuelle Referenz.
- Alle Renderer-Assets werden lokal aus `backend/src/lib/instagramRenderer/assets/` geladen. Es besteht keine Netzwerkabhängigkeit.

### 4.2 `PRO PORTION` und Hantel

- `layout.ts` definiert aktuell `NUTRITION_CARD_Y=1048`, `BARBELL_X=128`, `BARBELL_WIDTH=824`, `BARBELL_HEIGHT≈58.336`, `BARBELL_Y≈1018.832` und `PRO_PORTION_TOP=1034`.
- `compose.ts` rendert zuerst die Nutrition Card, danach das Hantel-SVG und danach den transparenten `PRO PORTION`-Text. Die Card bleibt `overflow: hidden`; die Hantel ist bereits ein Root-Sibling.
- Das Hantel-SVG besitzt `viewBox="0 0 904 64"`. Der linke Schaft reicht lokal bis `x=366`, der gespiegelte rechte Schaft beginnt lokal bei `x=538`; beide Schäfte haben lokal `y=29..35`.
- Die bestehende Layer-Reihenfolge macht einen simplen `z-index`-Fix unwahrscheinlich. Der nominale Mittelspalt ist breiter als die sichtbaren Textpixel, deshalb muss die tatsächliche Linie mit einem Rendervergleich lokalisiert werden, bevor das SVG verändert wird.
- Der Nutzer sieht trotzdem eine horizontale Linie im Schriftzugbereich. Das ist ein reproduzierbarer visueller Befund, aber die aktuelle Quellstruktur beweist noch nicht, ob die Quelle ein Schaftpixel, eine Anti-Aliasing-Kante, ein anderer Layer oder ein Rasterartefakt ist.

### 4.3 Tag-Chips

Aktuelle Werte in `layout.ts` und `compose.ts`:

| Element | Aktuell |
|---|---:|
| Chip-Höhe | `38 px` |
| Chip-Seitenpadding links/rechts | `21 px` |
| Icongröße | `18 x 18 px` |
| Icon-Text-Gap | `8 px` |
| Abstand zwischen Chips | `12 px` |
| Tag-Reihe | `x=88`, `y=936`, max. `4` Tags |

Die Chips werden als statische Bildbestandteile gerendert. Sie haben keine echte Touch-Fläche. Für diesen Renderer bedeutet "scanbar" daher: Icon und Text müssen beim 100-Prozent-Render und im mobilen Thumbnail klar getrennt bleiben.

### 4.4 High-Protein-Badge

- Aktives Asset: `backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png`.
- Gemessene Quelldaten: `1254 x 1254 px`, RGBA, transparenter Außenrand, Alpha-Bounds ungefähr `x=96..1158`, `y=97..1144`.
- Das Asset enthält einen dunklen, weitgehend opaken Innenkörper sowie weiße Beschriftung und einen grünen Akzentverlauf. Häufige Akzentwerte liegen ungefähr bei `RGB(168,250,74)`, während der Renderer für Tags und `PRO PORTION` `COLOR_LIME=#B9EF12` verwendet.
- Im Layout wird das Bild mit `HIGHLIGHT_BADGE_SIZE=128`, `HIGHLIGHT_BADGE_TOP=66` und `HIGHLIGHT_BADGE_RIGHT=65` platziert. Das sichtbare Ring-Bounding-Box liegt im aktuellen PNG ungefähr bei `x=897..1004`, `y=76..180`.
- Die bestehende Highlight-Logik ist korrekt begrenzt: maximal ein Badge, `nutritionHighlight` bleibt `"high-protein" | "low-fat" | null`. Diese Logik wird nicht geändert.

### 4.5 Footer-Wortmarke

- Aktive Quelle ist `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png`.
- Das PNG ist `1815 x 867`, 24-Bit ohne Alpha. Der Quelldatensatz enthält einen opaken dunklen Hintergrund, überwiegend ungefähr `RGB(3,6,4)`.
- `render.ts` entfernt diesen Hintergrund aktuell per `normalizeWordmarkBackground()`, erzeugt eine neue PNG-Alpha-Version und übergibt diese an Satori als `image/png`.
- Die aktuelle Layoutbox ist `x=475`, `y=1222`, `width=130`, `height=62`; die sichtbaren Zeichen sind ungefähr `x=493..588`, `y=1246..1261`.
- Die beiden bereitgestellten SVGs liegen tatsächlich im Workspace:
  - `mobile/assets/brand/micha_logo_writing_02.svg`: `viewBox="0 0 1197.24 197.35"`, kein Hintergrundrechteck, transparente Wortmarke, Lime- und Metallverlauf.
  - `mobile/assets/brand/micha_logo_writing_01.svg`: `viewBox="0 0 1599.22 763"`, enthält ein vollflächiges Rechteck `fill:#0e110f` und eignet sich nur für eine Variante mit bewusstem dunklem Hintergrund.

## 5. Desired Behaviour and Technical Solution

### 5.1 Fix 1: Linie bei `PRO PORTION`

#### Root-Cause-Check

Backend muss vor der finalen Korrektur einen gezielten A/B-Pixelvergleich erzeugen:

1. Das normale Quarkbrötchen-PNG wird mit der aktuellen Hantel gerendert.
2. Ein lokaler Test-Render verwendet im selben Compose-Baum ein transparentes beziehungsweise leeres Hantel-Asset, während Card, Ambient, Transition und `PRO PORTION` unverändert bleiben.
3. Im geschützten Labelbereich werden pro Pixel folgende Klassen verglichen: Lime-Glyphen, metallische Hantelpixel, Card-/Ambient-Hintergrund und sonstige farbige horizontale Runs.
4. Zusätzlich wird die tatsächliche SVG-Geometrie nach der Skalierung geprüft. Der globale Schutzbereich ist die sichtbare Textbox plus `6 px` Sicherheitsabstand: ungefähr `x=467..611`, `y=1038..1058`. Die genaue Pixelgrenze wird aus den gemessenen Textbounds und nicht aus einem Screenshot-Rand abgeleitet.

Dieser Check unterscheidet:

- **Schaftquelle bestätigt:** Metall- oder andere Hantelpixel verschwinden im normalen PNG, wenn der zentrale Hantelbereich entfernt wird.
- **Schaftquelle widerlegt:** Der Unterschied bleibt auch ohne Hantel. Dann darf das SVG nicht blind verändert werden; Backend untersucht den konkreten Layer oder Resvg-Rasterbefund und korrigiert nur diese Quelle.
- **Nur Layer-Reihenfolge ursächlich:** Die Pixel erscheinen nur bei einer falschen Reihenfolge. Dann reicht eine explizite Z-Order mit `PRO PORTION` oberhalb der Hantel. Im aktuellen Quellstand ist diese Reihenfolge bereits vorhanden; ein reiner Z-Order-Commit ist deshalb nur zulässig, wenn der Check ihn belegt.

#### Bevorzugte Korrektur

Wenn der Hantel-Schaft die Quelle ist, wird nur der mittlere Schaftbereich hinter dem Label transparent beziehungsweise nicht gezeichnet:

- Die linke und rechte Hantelhälfte, Platten, Spiegelung, Card-Inset und `904:64`-Seitenverhältnis bleiben unverändert.
- Der zentrale Freiraum muss die sichtbaren Textpixel plus mindestens `6 px` Luft auf jeder Seite enthalten.
- Eine kleine Anpassung der inneren Schaftenden im bestehenden SVG oder eine SVG-Maske mit transparentem Mittelbereich ist zulässig. Die Maske darf keine opake Farbe auftragen.
- Die sichtbare Card-/Ambient-Fläche bleibt hinter dem Label erhalten. Es wird keine schwarze Box, kein `COLOR_PANEL`-Rechteck, kein Border und kein Schatten ergänzt.
- Die Layer-Reihenfolge bleibt `Nutrition Card -> Barbell -> PRO PORTION -> Wordmark`, sofern der Pixelcheck keine begründete Abweichung verlangt.

Die Regression muss nachweisen, dass im sichtbaren Label-Glyphenbereich keine metallischen oder sonstigen horizontalen Fremdpixel liegen und dass die Umgebung beim Vergleich mit dem Hantel-losen Render identisch bleibt, ausgenommen die Lime-Glyphen selbst.

### 5.2 Fix 2: Tag-Icon-Abstand

Die minimalen Zielwerte sind:

```text
TAG_CHIP_HEIGHT = 38
TAG_CHIP_PADDING_X = 16
TAG_ICON_SIZE = 18
TAG_ICON_GAP = 6
TAG_CHIP_GAP = 12
```

Begründung:

- `21 -> 16 px` reduziert den optisch leeren Bereich vom Chip-Rand zum Icon um `5 px`, ohne die Pill-Form zu verlieren.
- `8 -> 6 px` hält Icon und Text als eine Gruppe zusammen, lässt aber die Umrisse auch bei 18-px-Icons klar erkennen.
- Die äußeren Chip-Abstände, die Höhe, das Icon-Mapping und die Tag-Texte bleiben unverändert.
- Die vier bestehenden Tags des Quarkbrötchen-Fixtures bleiben innerhalb der `904 px`-Tag-Reihe. Satori-Messung und Overflow-Fehlerbehandlung bleiben aktiv.

Der fokussierte Test prüft Strukturwerte und gerenderte Pixel. Die sichtbare Iconfläche muss weiterhin mindestens `18 px` Layoutfläche erhalten; der tatsächliche Icon-Bounding-Box-Abstand zum Rand darf wegen Stroke-Anti-Aliasing innerhalb eines `+/-1 px`-Rasterkorridors liegen. Ein Icon wird nicht ausgetauscht oder entfernt, nur um Breite zu sparen.

### 5.3 Fix 3: High-Protein-Badge

#### Farb- und Alpha-Befund

Die aktuelle dominante Akzentfarbe `RGB(168,250,74)` ist heller und deutlich weniger gelb als die im Renderer verwendete `COLOR_LIME=#B9EF12`. Dadurch wirkt der Badge-Ring auf dem Foto stärker neon-grün als die Tag-Rahmen und `PRO PORTION`. Das ist eine lokale Brand-Kohärenzfrage, keine Änderung der Protein-Bedeutung.

#### Bevorzugte deterministische Lösung

Backend erstellt aus dem vorhandenen lokalen Backend-Asset eine palette-korrigierte Version unter demselben aktiven Assetpfad `assets/nutrition-highlights/high-protein.png`:

- Akzentpixel mit der vorhandenen grünen Quellencharakteristik werden auf eine `COLOR_LIME`-verankerte Lime-Palette korrigiert. Der relative Verlauf darf erhalten bleiben, aber der dominante Akzent darf nicht wieder zur bisherigen `#A8FA4A`-Wirkung zurückfallen.
- Der dunkle Innenkörper und die weiße `HIGH PROTEIN`-Beschriftung bleiben unverändert, sofern der Pixel-/Kontrastcheck keinen lokalen Befund zeigt.
- Alpha wird byteweise erhalten. Der transparente Außenrand und die sichtbaren Alpha-Bounds dürfen sich durch die Farbkorrektur nicht verschieben.
- Es wird kein neuer Badge-Status, kein neues Asset-Format und keine Tint-Entscheidung im Input eingeführt.
- `HIGHLIGHT_BADGE_SIZE`, `HIGHLIGHT_BADGE_TOP` und `HIGHLIGHT_BADGE_RIGHT` bleiben zunächst unverändert. Position wird nur geändert, wenn die manuelle PNG-Prüfung einen konkreten Foto-Kontrastbefund liefert; dafür gibt es in dieser Runde keinen Startwert.

Eine Laufzeit-Tinting-Funktion ist nur dann zu verwenden, wenn sie Alpha und nicht-grüne Pixel nachweisbar unverändert lässt. Eine einmalig palette-korrigierte lokale PNG-Kopie ist bevorzugt, weil sie einfacher zu messen, deterministisch zu reviewen und zur vorhandenen Asset-Ladearchitektur passend ist.

#### Kontrastkriterien

- Weiße Badge-Beschriftung muss auf dem dunklen Badge-Körper bei einer lokalen Luminanzmessung mindestens `4.5:1` Kontrast erreichen. Das ist ein technischer Lesbarkeits-Sanity-Check, keine neue Produktregel.
- Der sichtbare Lime-Akzent muss farblich zur Renderer-Lime ausgerichtet sein. Der Test dokumentiert den dominanten Akzentwert und akzeptiert nur den festgelegten, engen Korrekturkorridor.
- Die Ring- und Schriftwirkung wird zusätzlich auf dem Quarkbrötchenfoto bei 100 Prozent und in einer verkleinerten 4:5-Thumbnailansicht manuell geprüft. Die manuelle Prüfung entscheidet, ob der Badge klar vom Foto getrennt bleibt, ohne als fremder Neon-Fleck zu dominieren.

### 5.4 Fix 4: Footer-SVG

#### Vergleich und Entscheidung

| Kriterium | `micha_logo_writing_02.svg` | `micha_logo_writing_01.svg` | Bisheriges Rasterlogo |
|---|---|---|---|
| ViewBox | `1197.24 x 197.35` | `1599.22 x 763` | `1815 x 867` |
| Hintergrund | kein Hintergrundrechteck, transparent | vollflächiges Rechteck `#0e110f` | opak, ungefähr `RGB(3,6,4)` |
| Brand-Farben | Lime- und Metallverlauf | Lime- und Metallverlauf | Lime-/Metallraster |
| Footer-Eignung | hoch, weil Ambient sichtbar bleibt | nur bei bewusstem dunklem Panel | nur mit Alpha-Normalisierung |
| Skalierung | proportional, breit und flach | proportionale Box mit viel Hintergrundfläche | Rasterung und versteckter Hintergrund |

**Entscheidung:** `micha_logo_writing_02.svg` ist der bevorzugte und in dieser Runde verbindliche Footer-Kandidat. Variante 01 wird nicht als transparenter Ersatz eingesetzt. Das Kriterium ist nicht der Dateiname, sondern: kein vollflächiger Hintergrund, sichtbares Ambient-Feld außerhalb der Buchstaben, scharfe Lesbarkeit bei 100 Prozent und Thumbnail-Downscale sowie symmetrische Zentrierung.

#### Übernahme und Benennung

- Backend übernimmt den Inhalt von `mobile/assets/brand/micha_logo_writing_02.svg` als lokale Renderer-Datei:
  `backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg`.
- Der finale Dateiname ist ASCII-kompatibel und beschreibt die aktive Rolle. Die ursprüngliche Mobile-Datei bleibt unverändert.
- `mobile/assets/brand/micha_logo_writing_01.svg` und `micha_logo_writing_02.svg` werden in dieser Runde nicht umbenannt und nicht aus Mobile entfernt.
- Das bisherige `fittrack-wordmark.png` bleibt zunächst als historische Rückfall-/Vergleichsdatei im Backend-Assetordner, wird aber nicht mehr als Standardquelle geladen. Eine Löschung ist kein Bestandteil dieses Plans.

#### Loader, Alpha und Skalierung

- `render.ts` lädt die neue Wortmarke als UTF-8-SVG und reicht sie mit MIME-Typ `image/svg+xml` an `imageSource()` und Satori weiter.
- `normalizeWordmarkBackground()` darf auf die neue SVG nicht angewendet werden. Es gibt dort kein Hintergrundrechteck, das entfernt werden müsste. Falls die Funktion für einen expliziten Legacy-Fallback erhalten bleibt, muss der Dateityp vorher unterschieden werden; eine SVG darf nicht in eine opake PNG-Zwischenstufe umgewandelt werden.
- Das Seitenverhältnis bleibt exakt `1197.24 / 197.35`. Der Zielstartwert ist:

```text
WORDMARK_CENTER_X = 540
WORDMARK_WIDTH = 160
WORDMARK_HEIGHT = WORDMARK_WIDTH * 197.35 / 1197.24
WORDMARK_Y = 1242
```

- Der sichtbare Bereich bleibt horizontal zentriert. Die zulässige sichtbare Breite liegt bei `150..180 px`; die endgültige Zahl wird aus dem 160-px-Startwert und der manuellen Nutzerabnahme abgeleitet.
- Die Wortmarke darf nicht so klein werden, dass sie im Thumbnail unlesbar ist, und nicht so groß werden, dass sie Nutrition Card oder `PRO PORTION` als primäre Information konkurriert.
- Die Tests prüfen die SVG direkt auf fehlendes vollflächiges `<rect>`, transparente Ecken beziehungsweise fehlende opake Hintergrundfläche, korrektes ViewBox-Seitenverhältnis und die gerenderte Alpha-/Sichtbarkeitsbox. Das vollständige Canvas bleibt natürlich durch den Ambient-Renderer opak; geprüft wird das isolierte Asset und der lokale Footerbereich.

### 5.5 Erhaltene Layer- und Layout-Anker

Die folgenden etablierten Werte bleiben in dieser Runde unverändert, sofern der fokussierte Pixelbefund keinen direkten Konflikt mit einem der vier Fixes nachweist:

- Canvas `1080 x 1350`.
- Foto, Focus, Zoom, Titelposition und Transition-Ende `y=1015`.
- Tag-Reihe `x=88`, `y=936`, Höhe `38`.
- Nutrition Card `x=88`, `y=1048`, `width=904`, `height=144`.
- Nährwert-Wertzeile `x=120`, `y=1118`, `width=840`, `height=64`.
- Divider bei `x=330`, `540`, `750`.
- Hantel-Inset `40 px`, Mittelpunkt `x=540`, Seitenverhältnis `904:64`.
- `PRO PORTION`-Text und Lime-Farbe.
- Highlight-Auswahl und null-Highlight-Verhalten.
- Rezeptfoto und Nährwertwerte des Quarkbrötchen-Fixtures.

## 6. UX-/Instagram-Template-Review

### 6.1 Eignung als Serienvorlage

**Geeignet mit den vier Korrekturen.** Das feste 4:5-Format, die wiederkehrenden linken/rechten Ränder, die Lime-Pills, die große Fotozone und die immer gleich platzierte Nutrition Card bilden eine erkennbare Serie. Die Ausgabe wirkt aktuell eher wie ein hochwertiges Nutrition-Tool als wie ein redaktioneller Food-Post. Das ist für FitTrack plausibel und muss nicht durch eine Marketing- oder Lifestyle-Neugestaltung ersetzt werden.

### 6.2 Feed-Scanbarkeit und Thumb-Stop

- **Primärer Hook:** Foto plus großer Rezepttitel funktionieren auf der ersten Blickebene. Der Titel sitzt auf einem kontrolliert dunkler werdenden Bildbereich und ist dadurch grundsätzlich lesbar.
- **Sekundäre Orientierung:** Tags erklären Rezeptcharakter und sind durch die Lime-Kontur schnell auffindbar. Das aktuelle `21/8 px`-Innenmaß macht sie etwas luftiger als nötig; `16/6 px` verbessert die Kompaktheit.
- **Tertiärer Akzent:** Das Badge ist auf dem Foto gut lokalisierbar, aber die abweichende Neon-Grünpalette bindet unnötig Aufmerksamkeit. Die Farbangleichung ist sinnvoller als eine neue Badge-Größe oder eine neue Badge-Kategorie.
- **Nutrition Card:** Die Card ist ein starkes Serienmerkmal, enthält aber viele kleine Informationen. Auf dem Feed-Thumbnail wird sie als kompakte Signatur wahrgenommen; die Detailwerte werden erst bei größerer Darstellung gelesen. Das ist akzeptabel, solange Card, Hantel und Label nicht durch eine Linie visuell verschmelzen.
- **Footer:** Die aktuelle Rasterwortmarke ist zu klein und technisch von einem versteckten Rechteck abhängig. Die transparente SVG verbessert Kantenqualität und lässt den Footer bewusster wirken. Sie soll trotzdem sekundär bleiben.

### 6.3 Hierarchie und Brand-Fit

Die gewünschte Hierarchie lautet:

1. Foto und Rezepttitel.
2. Tag-Pills als schnelle Einordnung.
3. Nutrition Card mit `PRO PORTION` als funktionale Signatur.
4. Ein einzelner Highlight-Badge als kleiner Akzent.
5. FitTrack-Wortmarke als Abschluss.

Die vier Fixes stärken genau diese Hierarchie. Eine zusätzliche dunkle Fläche aus SVG 01, ein größeres Badge oder mehrere Badges würden sie verschlechtern und sind deshalb nicht Bestandteil dieser Runde.

### 6.4 Kleine kreative Verbesserungsvorschläge

Die folgenden Vorschläge sind technisch begründet und bewusst nach Scope getrennt:

- **In dieser Runde:** kompaktere Chip-Innenabstände, markenkonformer Badge-Akzent und schärfere, transparente Wortmarke. Diese Änderungen sind klein, deterministisch und risikoarm.
- **Als nächster kleiner Renderer-Schritt:** einen Titel-/Foto-Safe-Area-Check mit repräsentativen langen Rezeptnamen ergänzen. Der aktuelle Renderer arbeitet mit `whiteSpace: nowrap` und fester Maximalbreite. Für eine Serie muss ein langer Name entweder kontrolliert gekürzt, bewusst abgelehnt oder in einem eigenen Template behandelt werden. Das ist keine freie Designfrage, sondern eine Datenlängenentscheidung und daher nicht still in diesem Plan zu lösen.
- **Nicht jetzt:** keine allgemeine neue Farbwelt, keine Kartenabschaffung, keine neue Schriftfamilie, kein Formatwechsel und keine zusätzliche dekorative Illustration. Solche Änderungen würden die Vorlagenfunktion und den Vergleich der vier konkreten Fixes verwässern.

## 7. Scope

### In Scope

- Pixel- und Strukturdiagnose der `PRO PORTION`-Linie.
- Minimale transparente Korrektur des betroffenen Hantel-/Labelbereichs, falls der Pixelbefund die Hantel bestätigt.
- Anpassung von `TAG_CHIP_PADDING_X` auf `16` und `TAG_ICON_GAP` auf `6`; bestehende `18 px`-Icons und `38 px`-Chips erhalten.
- Lokale, deterministische Palette-Korrektur des aktiven High-Protein-Assets mit erhaltener Alpha-Geometrie.
- Übernahme und Benennung von `micha_logo_writing_02.svg` als Backend-Renderer-Asset.
- SVG-MIME-/Loader-Anpassung und Abschalten der PNG-Hintergrund-Normalisierung für den SVG-Pfad.
- Proportionale Footer-Skalierung mit Startwert `160 px` Breite und kontrollierter manueller Abnahme.
- Gezielte Struktur- und Pixeltests für alle vier Fixes.
- Neuer lokaler Render von `backend/output/quarkbroetchen.png`.
- Aktualisierung der renderer-internen Golden-/Asset-Metriken und der Footer-/Badge-Dokumentation.
- Separater QA-Report unter dem Pfad dieses Plans.
- Manuelle visuelle Nutzerabnahme auf 100-Prozent-Darstellung und im 4:5-Thumbnail.

### Out of Scope

- Keine HTTP-Funktion, kein Endpoint, keine Authentifizierung, keine Quota- oder AI-Änderung.
- Keine Rezept-, Nährwert-, Portions-, Tag- oder fachliche Badge-Logik.
- Keine neue Badge-Kategorie, kein Wechsel des `nutritionHighlight`-Vertrags und keine Schwellenentscheidung.
- Keine Änderung an Mobile-Screens, Mobile-Navigation, Mobile-API, Shared-Package oder Native-Build-Konfiguration.
- Keine Infrastruktur-, Cosmos-, Storage-, Azure-, Deployment- oder Release-Arbeit.
- Keine Netzwerkabhängigkeit und keine neue npm-Abhängigkeit.
- Kein Formatwechsel von `1080 x 1350` und keine neue UI-App.
- Keine ungefragte Gesamtneugestaltung des Instagram-Layouts.
- Keine Änderung des historischen Golden-Thresholds `0.10` oder des Differenz-Gates `0.03`.
- Keine stille Promotion oder Erstellung von `fittrack_instagram_current_approved.png` vor `ACCEPTED` durch den Nutzer.
- Keine Änderung der bestehenden Tag-Icon-Mappings oder Tag-Texte.
- Keine direkte Mobile-Integration des neuen Logos in dieser Runde.

## 8. Confirmed Facts

- Die vier konkreten Korrekturen kommen aus der aktuellen Nutzeranforderung.
- Der Backend-Renderer ist eine lokale, importierbare TypeScript-Library unter `backend/src/lib/instagramRenderer/`.
- `renderInstagramRecipe(input)` und das PNG-Format `1080 x 1350` bestehen bereits.
- Der aktuelle Footer-Alignment-QA-Report bewertet die vorherige Card-/Hantel-Geometrie als bestanden, lässt aber die manuelle Nutzerabnahme weiterhin offen.
- Die historische Golden-Datei ist `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`.
- Der historische Golden-Test nutzt `pixelmatch` mit Threshold `0.10` und einem Differenzverhältnis von `0.03`.
- `golden.test.ts` und die historische Golden-Datei dürfen nicht stillschweigend gelockert, gelöscht oder promoted werden.
- Der aktuelle Quellcode rendert die Nutrition Card, danach die Hantel, danach `PRO PORTION` und zuletzt die Wortmarke als Root-Layer.
- Die bestehende Hantel ist symmetrisch und proportional auf `824 x ungefähr 58.336 px` skaliert.
- Die aktuelle Tag-Geometrie ist `21 px` Seitenpadding und `8 px` Icon-Text-Gap.
- Das aktuelle High-Protein-Asset ist RGBA mit transparentem Außenrand, dunklem Innenkörper, weißer Schrift und einem Akzentverlauf um `RGB(168,250,74)`.
- Das aktuelle Backend-Wortmarken-PNG ist vollständig opak; seine Alpha-Transparenz wird derzeit nachträglich durch `normalizeWordmarkBackground()` erzeugt.
- Beide SVG-Anhänge liegen bereits unter `mobile/assets/brand/` vor. Variante 02 ist transparent; Variante 01 enthält ein vollflächiges dunkles Rechteck.
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md` beschreibt den bisherigen PNG-Workaround und die geplante Präferenz für eine transparente SVG-Wortmarke.
- Die bestehende lokale Abhängigkeit `sharp` kann für Asset-/Pixelprüfungen verwendet werden. Es ist keine neue Abhängigkeit nötig.

## 9. Assumptions and Open Questions

### Technische Annahmen

- Die visuell wahrgenommene Linie lässt sich durch den A/B-Render im Labelbereich einer konkreten Layerquelle zuordnen.
- Falls der Schaft nicht die Quelle ist, kann die Ursache innerhalb der bestehenden Compose-/Resvg-Kette lokal behoben werden, ohne die Card, Werte oder das Format zu verschieben.
- Die von der Nutzeranforderung gelieferten SVG-Dateien sind für die Backend-Übernahme maßgeblich. Der Backend-Assetpfad wird eine lokale Kopie, damit der Renderer weiterhin unabhängig von Mobile-Quellpfaden bleibt.
- Die supplied SVG gradients werden von der vorhandenen Resvg-Version korrekt gerendert. Falls ein reproduzierbarer Resvg-Befund dagegen spricht, darf Backend die SVG nicht durch Variante 01 ersetzen; es muss die transparente Variante technisch kompatibel halten.
- `160 px` ist ein technischer Startwert für die Footer-Wortmarke. Die `150..180 px`-Grenze schützt die Hierarchie und lässt die manuelle visuelle Abnahme eine kleine Raster-/Lesbarkeitskorrektur zu.
- Die Kontrastwerte `4.5:1` für weiße Badge-Schrift und der dokumentierte Lime-Korridor sind Renderer-Sanity-Heuristiken, keine fachlichen Nutrition-Regeln.

### Open Product Owner Decisions

**Keine.** Die Nutzeranforderung gibt die vier Korrekturen und den Review-Auftrag ausreichend vor. Die genaue Ursache der Linie ist eine technische Messfrage, keine Produktentscheidung. Die manuelle Nutzerabnahme ist ein Abschluss-Gate und keine offene Planungsfrage.

## 10. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/layout.ts` für alle Canvas-, Tag-, Badge-, Card- und Footer-Konstanten.
- `backend/src/lib/instagramRenderer/compose.ts` für Tag-Chips, Layer-Reihenfolge, Hantel, `PRO PORTION`, Badge und Wortmarke.
- `backend/src/lib/instagramRenderer/render.ts` für lokale Asset-Ladung, MIME-Auswahl, Sharp, Satori und Resvg.
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` als bestehendes symmetrisches Hantel-Asset.
- `backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png` als aktives lokales Badge-Asset.
- `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png` als historische Fallback-/Vergleichsquelle, nicht als neue Standardquelle.
- `mobile/assets/brand/micha_logo_writing_02.svg` als Input für die lokale Backend-Kopie.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` und `fixtures/smoke.ts`.
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`, `tags.test.ts`, `highlight.test.ts`, `smoke.test.ts` und `golden.test.ts`.
- `backend/scripts/render-golden.mjs` für den lokalen PNG-Export.
- Sharp-Rohpixel-, Alpha-Bounds- und vorhandene Renderer-Testhelfer.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` und `docs/tag-icon-mapping.md` für getrennte historische und aktuelle Messwerte.

## 11. Affected Files and Minimal Change Boundary

| Datei | Behandlung | Minimalgrenze |
|---|---|---|
| `backend/src/lib/instagramRenderer/layout.ts` | Tagwerte, geschützter Labelbereich und SVG-Wortmarkenbox benennen beziehungsweise anpassen | Keine globale Layout-Neuberechnung; Card-/Wertzeilenanker bleiben stabil |
| `backend/src/lib/instagramRenderer/compose.ts` | Chip-Padding/Gaps, explizite Label-Z-Order und SVG-Wortmarken-MIME behandeln | Keine Änderung an Tag-IDs, Texten, Badge-Auswahl oder Nährwerten |
| `backend/src/lib/instagramRenderer/render.ts` | SVG-Wortmarke laden, PNG-Normalisierung typabhängig umgehen, Badge-Asset unverändert lokal laden | Keine API-, Runtime-, Netzwerk- oder Fehlervertragsänderung |
| `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg` | Nur ändern, wenn der Pixelcheck den Schaft als Linienquelle bestätigt | `viewBox`, Symmetrie, Proportion und Plattenmotiv erhalten; kein opakes Overlay |
| `backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png` | Palette des bestehenden Assets lokal korrigieren, Alpha erhalten | Kein neues Badge und keine neue Kategorie |
| `backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg` | Neue lokale Kopie aus `mobile/assets/brand/micha_logo_writing_02.svg` | Inhalt, Transparenz und ViewBox erhalten; Variante 01 nicht verwenden |
| `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png` | Vorläufig behalten, aber aus dem aktiven Standardpfad entfernen | Keine Löschung in dieser Runde |
| `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts` | Linie, Hantel-/Label-Clearance, Card-Anker, Wordmark-Bounds und Thumbnail-Sanity prüfen | Keine breite Toleranz und kein Golden-Workaround |
| `backend/src/lib/instagramRenderer/__tests__/tags.test.ts` | Neue Padding-/Gap-/Icon-Größen und 0/1/4-/Fallback-Tags absichern | Keine Änderung der Mapping-Regeln |
| `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts` | Badge-Alpha, Farbcluster, Contrast-Sanity und Null-Highlight-Isolation absichern | Keine Änderung des Input-Vertrags |
| `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` | Unverändert ausführen und als historischen Diagnosepfad dokumentieren | Threshold `0.10` und Gate `0.03` unverändert |
| `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` | Unverändert ausführen; bei Bedarf nur lokale Footer-/Badge-Regression ergänzen | Kein neuer Produktzustand |
| `backend/src/lib/instagramRenderer/docs/golden-metrics.md` | Neue Tag-, Badge-, Linien- und Footer-Metriken getrennt von V1.7 und vorherigem Footer-Stand dokumentieren | Historische Werte nicht überschreiben |
| `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md` | Aktiven transparenten Footer-Assetpfad und abgeschalteten PNG-Workaround dokumentieren | Tag-Mapping und Badge-Fachregeln unverändert |
| `backend/output/quarkbroetchen.png` | Nach Umsetzung neu erzeugen | Arbeitsartefakt, keine Referenzpromotion |
| `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md` | QA erstellt den dauerhaften Review-Report | Vorgängerreports nicht überschreiben |
| `docs/qa/findings.md` | Nicht direkt durch QA ändern; Orchestrator pflegt das zentrale Register | Findings über Handoff melden |

## 12. Backend Work Package

### B-IPR-1 - Renderer-Polish und Arbeits-PNG

**Agent:** Backend

**Goal**

Die vier lokalen Renderer-Korrekturen implementieren, die bestehenden Verträge und Fachlogiken unverändert halten, gezielte Regressionstests ergänzen, das aktuelle Arbeits-PNG erzeugen und alle Messwerte für QA übergeben.

**Required Knowledge Base:**

- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/product/01-product-philosophy.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png`
- `backend/src/lib/instagramRenderer/assets/branding/fittrack-wordmark.png`
- `mobile/assets/brand/micha_logo_writing_02.svg`
- `mobile/assets/brand/micha_logo_writing_01.svg`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/tags.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/scripts/render-golden.mjs`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- `backend/output/quarkbroetchen.png`

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

**Dependencies:**

- Dieser Plan ist als technische Grundlage vorhanden.
- Die beiden SVG-Dateien sind im Workspace verfügbar.
- Keine Mobile-, Infrastructure- oder Product-Owner-Abhängigkeit.

**Expected Handoff:**

- Geänderte Renderer-Dateien und lokale Assets mit kurzer Begründung pro Fix.
- Dokumentierter Pixelbefund zur Linienquelle und Nachweis, dass nur der betroffene mittlere Bereich korrigiert wurde.
- Final verwendete Tag-Werte, Badge-Farbkorridor, Badge-Alpha-Bounds und Footer-SVG-ViewBox/-Bounds.
- `backend/output/quarkbroetchen.png` als neues `1080 x 1350`-Arbeits-PNG.
- Fokussierte Tests für Layout, Tags und Badge sowie unveränderte historische Golden-Konstanten.
- Aktualisierte `golden-metrics.md` und `tag-icon-mapping.md`.
- Klare Aussage, dass keine aktuelle Referenzdatei erzeugt oder promoted wurde.

#### Backend-Ausführungsschritte

1. **Diagnose und Regression zuerst:** Die A/B-Pixelprobe für `PRO PORTION` und die notwendigen Testhelfer anlegen. Die Quelle der Linie muss im Testbefund klassifiziert werden.
2. **Linie minimal beheben:** Nur Schaftmittelbereich, SVG-Geometrie oder bestätigte Layer-Reihenfolge korrigieren. Keine opake Abdeckung.
3. **Tag-Chips korrigieren:** `16 px` Seitenpadding und `6 px` Icon-Gap einsetzen; Icon-Mapping und Text unverändert lassen.
4. **Badge normalisieren:** Bestehendes Backend-PNG palette-korrigieren, Alpha-Bounds und dunklen/weißen Inhalt erhalten, Highlight-Input unverändert lassen.
5. **Footer-SVG übernehmen:** `micha_logo_writing_02.svg` als `micha-logo-writing.svg` kopieren, SVG-MIME laden, PNG-Normalisierung für diesen Pfad umgehen und proportional mit Startwert `160 px` rendern.
6. **Tests und Dokumentation aktualisieren:** Gezielt messen, keine Schwellen lockern, historische Werte getrennt dokumentieren.
7. **Arbeits-PNG erzeugen:** `backend/output/quarkbroetchen.png` lokal neu rendern und an QA übergeben.

## 13. Frontend Work Package

**None.** In dieser Runde gibt es keine Änderung an `mobile/src/`, Navigation, API-Client, Shared-Code, Mobile-Assets als laufender Anwendung oder Native-Build-Konfiguration. `mobile/assets/brand/micha_logo_writing_02.svg` dient nur als bestehender Asset-Input für eine isolierte Backend-Kopie.

## 14. QA Work Package

### Q-IPR-1 - Renderer-Regression, UX-Sanity und Abnahmebericht

**Agent:** QA

**Goal**

Die Umsetzung gegen alle Acceptance Criteria prüfen, die vier visuellen Korrekturen strukturell und als gerenderte Pixel absichern, die historische Golden-Abweichung korrekt einordnen und den manuellen Nutzerabnahmezustand im dauerhaften QA-Report dokumentieren.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/product/01-product-philosophy.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**

- B-IPR-1-Handoff
- `backend/src/lib/instagramRenderer/layout.ts`
- `backend/src/lib/instagramRenderer/compose.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/assets/nutrition/barbell-header-frame.svg`
- `backend/src/lib/instagramRenderer/assets/nutrition-highlights/high-protein.png`
- `backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg`
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts`
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts`
- `backend/src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/tags.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/output/quarkbroetchen.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- `backend/package.json`
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

**Dependencies:**

- B-IPR-1 muss abgeschlossen sein.
- Das neue Arbeits-PNG muss vorliegen.
- Die Nutzerabnahme kann zum QA-Zeitpunkt noch `MANUAL VALIDATION REQUIRED` sein und darf nicht als erteilt behandelt werden.

**Expected Handoff:**

- QA-Report unter `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md` im Format `fittrack-qa-v1`.
- Vollständige Kriterienmatrix für AC-1 bis AC-14.
- Testkommandos mit Exit-Code und Ergebnis.
- Separater Abschnitt für `UNVERIFIED` und `MANUAL VALIDATION REQUIRED`.
- Strukturierte Findings mit Owner und konkreter Evidenz. `docs/qa/findings.md` wird nicht direkt bearbeitet.
- Expliziter Status `ACCEPTED` oder konkrete visuelle Ablehnung. Ohne `ACCEPTED` bleibt die aktuelle Referenzpromotion gesperrt.

#### QA-Prüfschritte

1. Fokussierte Layout-, Tag-, Badge- und Smoke-Tests ausführen.
2. PNG-Struktur und Pixelbounds unabhängig vom Compose-Tree prüfen.
3. Historischen Golden-Test unverändert ausführen und einen eventuellen Exit-Code `1` als historischen Diagnosebefund dokumentieren, nicht durch Toleranzänderung beheben.
4. Typecheck, Build-Verify, vollständigen Backend-Test und lokalen Render ausführen.
5. `backend/output/quarkbroetchen.png` in 100 Prozent sowie als verkleinertes 4:5-Thumbnail prüfen.
6. Den neuen QA-Report schreiben und die manuelle Nutzerabnahme als Gate festhalten.

## 15. Shared Package Changes

Keine. `shared/` bleibt unverändert.

## 16. Infrastructure and Configuration

Keine. Es gibt keine Bicep-, Cosmos-, Storage-, Azure-, Environment-, Deployment- oder Release-Änderung. Development wird ausschließlich über lokale Backend-Tests, Typecheck, Build-Verify und den lokalen PNG-Render geprüft. Alpha und Production sind nicht betroffen. Es gibt kein Infrastructure-&-Release-Work-Package.

## 17. Documentation and Findings

- Dieses Planartefakt ist die einzige Datei, die der Planner in dieser Runde schreibt.
- Backend ergänzt `backend/src/lib/instagramRenderer/docs/golden-metrics.md` um:
  - die finale `PRO PORTION`-Pixelprobe und Linienklassifikation,
  - `TAG_CHIP_PADDING_X=16` und `TAG_ICON_GAP=6`,
  - die Badge-Quell-/Zielpalette, Alpha-Bounds und Contrast-Sanity,
  - die SVG-Quelle, ViewBox, Renderbox und sichtbaren Bounds.
- Backend aktualisiert `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md` auf die aktive transparente Footer-SVG. Die fachlich offenen Badge-Schwellen bleiben als offen dokumentiert.
- QA erstellt ausschließlich den Report `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md` nach `fittrack-qa-v1`.
- QA schreibt nicht `docs/qa/findings.md`. Der Orchestrator übernimmt relevante Findings mit den im QA-Report gelieferten Schlüsseln.
- `docs/kb/` wird nicht geändert, weil keine Architektur-, API-, Domain- oder Laufzeitentscheidung geändert wird.
- Historische Pläne, der historische Golden-Master und der bestehende Footer-Alignment-Report bleiben unverändert.

## 18. Test Strategy

### 18.1 Strukturtests

Die Tests müssen unter anderem absichern:

- `renderInstagramRecipe`-Vertrag, `ok=true`, PNG, `1080 x 1350` und unveränderte Fixture-Nährwerte.
- Root-Layer-Reihenfolge: Card, Hantel, `PRO PORTION`, Wordmark; `PRO PORTION` bleibt über der Hantel.
- `PRO_PORTION`-Text exakt `PRO PORTION`, `COLOR_LIME`, zentriert und ohne `background`, `border` oder `boxShadow`.
- `BARBELL_WIDTH < NUTRITION_CARD_WIDTH`, `40 px` beidseitiger geometrischer Inset, `x=540`-Zentrum und unverändertes `904:64`-Verhältnis.
- `TAG_CHIP_HEIGHT=38`, Seitenpadding `16`, Icongröße `18`, Icon-Gap `6`, Chip-Gap `12`.
- 0, 1, 4, unbekannte und bewusst icon-lose Tags bleiben renderbar; kein Mapping wird geändert.
- High-Protein- und Low-Fat-Input bleiben renderbar; `null` bleibt badge-frei; der restliche Footer verschiebt sich nicht.
- Footer-Wordmark lädt die finale SVG und nicht das alte PNG als Standardquelle.
- SVG-ViewBox ist `0 0 1197.24 197.35`; kein vollflächiges Hintergrund-`rect` und keine PNG-Normalisierung im SVG-Pfad.

### 18.2 Gerenderte Pixeltests

#### `PRO PORTION`-Linie

- Quarkbrötchen mit realem Hantel-Asset und mit leerem Hantel-Asset rendern.
- Im geschützten sichtbaren Labelbereich müssen alle nicht-limefarbenen Pixel dem Hantel-losen Vergleich entsprechen.
- Metallische Hantelpixel oder ein zusammenhängender horizontaler Fremd-Run durch die sichtbaren Textbounds sind nicht zulässig.
- Die Hantelplatten und die beiden äußeren Schaftseiten bleiben vollständig, symmetrisch und innerhalb des bestehenden Inset-Korridors sichtbar.
- Eine Prüfung, die nur die CSS-/Satori-Box oder nur die Textfarbe kontrolliert, reicht nicht aus.

#### Tag-Padding

- Die Strukturwerte werden direkt aus den `tag-chip`-Nodes geprüft.
- Die gerenderte erste Iconfläche und der Textbeginn werden relativ zur Chipkante gemessen. Ziel: `16 px` Rand und `6 px` Icon-Text-Abstand mit maximal `+/-1 px` Rasterabweichung.
- Die Icons bleiben als Lime-Pixel erkennbar; ein Text-only-Fallback bleibt für unbekannte Tags und Curry erhalten.
- Der Test bestätigt, dass die Änderung nur innerhalb der Tag-Zeile Unterschiede erzeugt.

#### High-Protein-Badge

- Quelldatei auf RGBA, Alpha-Minimum/-Maximum, transparenten Außenrand und Bounds prüfen.
- Den gerenderten Badge-Crop gegen `nutritionHighlight: null` vergleichen. Unterschiede außerhalb der bestehenden Badge-Box sind ein Fehler.
- Dominante Akzentpixel und die dokumentierte `COLOR_LIME`-Nähe prüfen.
- Weiße Schrift gegen dunklen Badge-Körper mit der festgelegten `4.5:1`-Sanity-Schwelle prüfen.
- Sichtbare Ringbounds und Badge-Position gegen die bestehenden `128/66/65`-Anker prüfen, sofern kein konkreter manueller Kontrastbefund eine kleine Positionsempfehlung begründet.

#### Footer-SVG

- Isoliertes SVG mit transparentem Hintergrund rasterisieren und Alpha-Bounds prüfen.
- Die vier Assetecken dürfen keine opake Hintergrundfüllung aus Variante 01 oder dem alten PNG enthalten.
- Gerendertes Footer-PNG auf sichtbare Bounds, horizontale Zentrierung um `x=540`, proportionalen `197.35/1197.24`-Faktor und sichtbare Breite `150..180 px` prüfen.
- Die Umgebung außerhalb der sichtbaren Wortmarke muss dem Ambient-Feld folgen; ein rechteckiger `RGB(3,6,4)`-Block ist ein Fehler.
- Die SVG- und Gradientfarben müssen bei 100 Prozent und Thumbnail-Downscale lesbar bleiben.

### 18.3 Historischer Golden-Test

- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` bleibt inhaltlich und numerisch unverändert.
- `PIXELMATCH_THRESHOLD=0.1` und `MAX_DIFFERING_PIXEL_RATIO=0.03` werden nicht erhöht.
- Die historische Datei bleibt unverändert.
- Wegen der vier absichtlich neuen Designänderungen darf der historische Vergleich vom aktuellen PNG abweichen. Ein Überschreiten des alten Gates wird als historischer Diagnosebefund dokumentiert, nicht als Anlass für Threshold-Lockerung.
- Die neue Gestaltung wird durch die oben beschriebenen gezielten Assertions geschützt.
- Erst nach dokumentiertem `ACCEPTED` darf ein separater Folge-Schritt eine aktuelle Referenzdatei erzeugen und einen neuen aktuellen Referenztest einführen. Dieser Plan führt diese Promotion nicht aus.

### 18.4 Auszuführende Kommandos

Nach dem Backend-Handoff:

```text
cd backend && npx vitest run src/lib/instagramRenderer/__tests__/nutrition-layout.test.ts src/lib/instagramRenderer/__tests__/tags.test.ts src/lib/instagramRenderer/__tests__/highlight.test.ts src/lib/instagramRenderer/__tests__/smoke.test.ts
cd backend && npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts
cd backend && npx tsc --noEmit
cd backend && npm run build:verify
cd backend && npm run render:instagram-reference
cd backend && npm test
```

Der historische Golden-Befehl und der vollständige Testlauf werden mit Exit-Code dokumentiert. Der lokale Render-Befehl darf keine Datei außerhalb des vorgesehenen Arbeits-PNGs als Referenz promotionieren.

### 18.5 Manuelle Nutzerabnahme

Der Nutzer prüft `backend/output/quarkbroetchen.png`:

- bei 100 Prozent beziehungsweise ausreichender Vergrößerung,
- zusätzlich als 4:5-Thumbnail in einer typischen mobilen Feedbreite.

Zu bestätigen sind:

1. `PRO PORTION` ist exakt lesbar und zentriert. Keine horizontale grüne oder metallische Linie läuft durch den Schriftzug. Die Card-/Ambient-Fläche bleibt sichtbar; keine schwarze Box wurde ergänzt.
2. Die Hantel bleibt symmetrisch, vollständig und mit dem bestehenden Card-Inset sichtbar.
3. Die Tag-Chips wirken kompakter, aber Icons und Text sind nicht gequetscht oder unklar.
4. Das High-Protein-Badge wirkt farblich mit Tags und `PRO PORTION` verbunden, bleibt auf dem Foto klar und dominiert den Titel nicht.
5. Die Footer-Wortmarke ist scharf, transparent integriert, horizontal zentriert und im Thumbnail noch als Brand-Signatur erkennbar. Kein dunkles Rechteck ist sichtbar.
6. Foto und Titel sind weiterhin der erste Blickfang. Tags, Badge, Nutrition Card, `PRO PORTION` und Wortmarke bilden eine stabile, wiederholbare Hierarchie.
7. Werte, Divider, Titelposition, Foto-Crop, Highlight-Auswahl und Null-Highlight-Ausgabe sind nicht unbeabsichtigt verändert.

Das Ergebnis wird explizit als `ACCEPTED` oder mit einer konkreten visuellen Ablehnung dokumentiert. Ohne `ACCEPTED` bleibt eine aktuelle Referenzpromotion gesperrt.

## 19. Acceptance Criteria

- **AC-1:** `renderInstagramRecipe(input)` bleibt mit unverändertem Input-/Result-Vertrag verfügbar. Es entsteht kein HTTP-, Auth-, API-, Cosmos-, Storage-, Mobile-, Shared- oder Infrastructure-Code.
- **AC-2:** Der lokale Renderer erzeugt weiterhin deterministisch ein PNG mit exakt `1080 x 1350` Pixeln. `backend/scripts/render-golden.mjs` bleibt nutzbar und benötigt keine Netzwerkverbindung.
- **AC-3:** `PRO PORTION` bleibt exakt der Text `PRO PORTION`, limefarben, horizontal und vertikal zentriert auf dem bestehenden Hantel-/Card-Anker. Im gerenderten sichtbaren Glyphenbereich gibt es keine metallischen oder sonstigen horizontalen Fremdpixel aus der diagnostizierten Linienquelle. Eine opake Box, Border oder ein Schatten wird nicht verwendet.
- **AC-4:** Die Korrektur von AC-3 verändert nur den betroffenen mittleren Hantel-/Labelbereich. Hantelplatten, Symmetrie, `904:64`-Seitenverhältnis, `40 px`-Card-Insets und Card-/Wertzeilenanker bleiben erhalten. Die Korrektur ist entweder als transparenter SVG-Mittelbereich oder als nachweislich notwendige Layer-/Rasterkorrektur dokumentiert.
- **AC-5:** Tag-Chips verwenden `38 px` Höhe, `16 px` linkes/rechtes Padding, `18 px` Icongröße, `6 px` Icon-Text-Gap und unverändert `12 px` Chip-Gap. 0, 1, 4, unbekannte und bewusst icon-lose Tags bleiben renderbar; Tag-Texte und Icon-Mapping ändern sich nicht.
- **AC-6:** Die gerenderten Tag-Icons sind weiterhin sichtbar und vom Text getrennt. Rand- und Gap-Messungen liegen innerhalb eines `+/-1 px`-Rasterkorridors um die Zielwerte. Die vier Quarkbrötchen-Tags passen weiterhin in die `904 px`-Reihe ohne stilles Abschneiden.
- **AC-7:** Das aktive High-Protein-Asset bleibt `RGBA` mit transparentem Außenrand und unveränderten Alpha-Bounds. Die palette-korrigierten dominanten Akzentpixel sind an `COLOR_LIME=#B9EF12` ausgerichtet; dunkler Badge-Körper und weiße Beschriftung bleiben erhalten, soweit kein gemessener lokaler Befund eine Änderung begründet.
- **AC-8:** High-Protein-, Low-Fat- und Null-Highlight-Fälle bleiben renderbar. Das Badge bleibt auf seiner bestehenden `128/66/65`-Layoutbox, Unterschiede bleiben auf diese Box begrenzt, und die übrige Layoutgeometrie verschiebt sich nicht. Es entsteht keine neue Badge-Kategorie und keine Änderung der Highlight-Auswahl.
- **AC-9:** Die Badge-Schrift erfüllt im gerenderten Crop die dokumentierte `4.5:1`-Kontrast-Sanity gegenüber dem dunklen Badge-Körper. Die Lime-Akzentwirkung ist auf Foto und Thumbnail manuell nachvollziehbar, ohne den Titel als primären Hook zu überstrahlen.
- **AC-10:** Der aktive Footer verwendet eine lokale Kopie von `micha_logo_writing_02.svg` mit `viewBox="0 0 1197.24 197.35"`. Variante 01 und das alte opake PNG werden nicht als Standardquelle verwendet. Das alte PNG bleibt höchstens als dokumentierter Fallback erhalten.
- **AC-11:** Die SVG-Wortmarke wird als SVG geladen, nicht durch die alte PNG-Hintergrund-Normalisierung geschleust, proportional gerendert und um `x=540` zentriert. Die sichtbare Breite liegt zwischen `150` und `180 px`, der Startwert ist `160 px`, und im Footer-PNG ist kein opakes Hintergrundrechteck sichtbar.
- **AC-12:** Der fokussierte Test schützt alle vier Änderungen mit Struktur- und Pixelassertions: `PRO PORTION`-Linie, Tag-Padding/Gaps, Badge-Farbe/Alpha/Kontrast und Footer-SVG-Alpha/Bounds. Der Test prüft außerdem Highlight- und Null-Highlight-Zustände.
- **AC-13:** Der historische Golden-Test bleibt mit Threshold `0.10`, Differenz-Gate `0.03` und unveränderter Golden-Datei erhalten. Keine Schwellenlockerung, kein stilles Löschen und keine stille Referenzpromotion wird vorgenommen. Neue Designabweichungen werden über gezielte Assertions geschützt.
- **AC-14:** `backend/output/quarkbroetchen.png`, `golden-metrics.md`, `tag-icon-mapping.md` und der neue QA-Report dokumentieren die finalen lokalen Messwerte, die getrennte historische Diagnose und den manuellen Abnahmestatus. Findings werden an den Orchestrator gegeben; QA schreibt nicht das zentrale Findings-Register.

## 20. Risks and Edge Cases

- **Linienquelle ist nicht die Hantel:** Die aktuelle SVG-Geometrie besitzt nominal bereits einen Mittelspalt. Deshalb ist der A/B-Pixelcheck verpflichtend. Ein blindes SVG-Umschreiben oder schwarzes Overlay ist nicht zulässig.
- **Maskierung löscht zu viel:** Eine Mittelbereichskorrektur darf weder sichtbare Platten noch die äußeren Schaftseiten entfernen. Symmetrie- und Metallbounds bleiben Regressionen.
- **Text wird durch die Korrektur unlesbar:** `PRO PORTION` darf nicht verkleinert, umbrochen oder fachlich verändert werden. Lesbarkeit wird über Freiraum und Z-Order gelöst.
- **Tag-Reihe läuft über:** Weniger Padding verbessert die Breite, aber lange Tags können weiterhin die feste Maximalbreite erreichen. Die bestehende Satori-Messung bleibt aktiv; Texte werden nicht still gekürzt.
- **Badge-Farbkorrektur verändert Alpha:** Farbkorrektur darf keine neue rechteckige Alpha-Fläche erzeugen. Source- und Render-Bounds müssen separat geprüft werden.
- **Badge wird zu neon oder zu dunkel:** Der Farbkorridor wird technisch gemessen, die finale Wirkung zusätzlich manuell auf Foto und Thumbnail beurteilt. Eine globale Ambient-Änderung ist kein Ausweg.
- **SVG-Verlauf oder Transparenz wird im Renderer anders gerastert:** Resvg-/SVG-Befund wird lokal dokumentiert. Variante 01 darf nicht als Kompatibilitätsersatz gewählt werden, weil sie die zentrale Transparenzanforderung verletzt.
- **Wortmarke konkurriert mit der Card:** Die `150..180 px`-Grenze und die manuelle Hierarchieprüfung verhindern eine zu große Footer-Marke.
- **Altes PNG bleibt scheinbar aktiv:** QA prüft den Loaderpfad, den MIME-Typ und die tatsächliche Compose-Quelle. Ein nur visuell kaschiertes altes Rechteck erfüllt AC-10/AC-11 nicht.
- **Historischer Golden-Test schlägt fehl:** Die vier bewussten Designänderungen können die alte Referenz überschreiten. Das wird dokumentiert, nicht durch höhere Toleranz repariert.
- **Cross-Platform-Rasterung:** Unterschiede anderer Resvg-/OS-Versionen werden als `UNVERIFIED` dokumentiert. Sie rechtfertigen keine breiten Pixelkorridore.
- **Manuelle Nutzerabnahme fehlt:** Ohne explizites `ACCEPTED` bleibt die aktuelle Referenzpromotion blockiert.

## 21. Findings-Behandlung

- Ein weiterhin sichtbarer Fremd-Run durch `PRO PORTION`, eine opake Labelbox, verlorene Hantelplatten oder eine verschobene Card-/Wertzeile ist `Blocking`, Owner `Backend`.
- Ein Tag-Gap außerhalb des Zielkorridors, unlesbare Icons oder ein unkontrollierter Vier-Tag-Overflow ist `Blocking`, Owner `Backend`.
- Ein Badge mit veränderter Alpha-Geometrie, fehlender Kontrast-Sanity, globaler Layoutverschiebung oder geänderter Highlight-Logik ist `Blocking`, Owner `Backend`.
- Verwendung von Variante 01 als transparenter Footer-Ersatz, ein sichtbares altes PNG-Rechteck oder fehlende SVG-Bounds-/MIME-Tests ist `Blocking`, Owner `Backend`.
- Fehlende gezielte Regressionstests für einen der vier Fixes ist `Blocking`, Owner `Backend` beziehungsweise `QA`, wenn die Implementierung vorhanden, aber nicht prüfbar ist.
- Eine rein subjektive Größenpräferenz innerhalb des vorgesehenen `150..180 px`-Footer-Korridors wird als `Suggestion` oder als manueller Nutzerentscheid dokumentiert, nicht als fachlicher Fehler.
- Historische Golden-Abweichungen infolge der ausdrücklich gewünschten neuen Gestaltung sind kein Finding gegen das neue Design, solange AC-12/AC-13 erfüllt sind und keine Threshold-Lockerung vorgenommen wurde.
- Nicht ausgeführte CI-, Cross-Platform- oder manuelle Checks gehören unter `UNVERIFIED` beziehungsweise `MANUAL VALIDATION REQUIRED`, nicht in die Findings-Liste.
- QA meldet Findings mit `Finding key`, Plan reference, Acceptance criterion, Description, Criticality, Owner, Evidence und Recommendation. Der Orchestrator pflegt daraus `docs/qa/findings.md`.

## 22. Recommended Execution Order and Handoffs

Die Umsetzung erfolgt strikt sequenziell:

1. **Planübergabe:** Orchestrator übergibt B-IPR-1 und Q-IPR-1 mit diesem Plan als vollständigem Kontext.
2. **Backend B-IPR-1, Diagnose:** A/B-Pixelcheck und strukturierter Linienbefund; keine Änderung ohne lokale Hypothese und Regression.
3. **Backend B-IPR-1, Korrekturen:** Linie, Chip-Abstände, Badge-Palette und transparente SVG-Wortmarke gemäß Abschnitt 5 umsetzen.
4. **Backend B-IPR-1, Tests und Dokumentation:** gezielte Tests, historische Golden-Konstanten, Metriken und Asset-Dokumentation aktualisieren.
5. **Backend B-IPR-1, Arbeits-Render:** `backend/output/quarkbroetchen.png` erzeugen und Handoff mit finalen Bounds übergeben.
6. **QA Q-IPR-1, fokussierte Prüfung:** Layout-, Tag-, Badge- und Smoke-Tests ausführen. Blocking Findings gehen mit konkreter Evidenz an Backend zurück; nach jeder Korrektur wird derselbe fokussierte Lauf erneut geprüft.
7. **QA Q-IPR-1, Gesamtprüfung:** Typecheck, Build-Verify, vollständiger Backend-Test, historischer Golden-Diagnosepfad und Renderprüfung ausführen.
8. **Manuelle Nutzerabnahme:** Nutzer prüft das Arbeits-PNG in 100 Prozent und im Thumbnail. Das Resultat wird als `ACCEPTED` oder mit konkreter visueller Ablehnung dokumentiert.
9. **Referenz-Gate:** Erst nach `ACCEPTED` darf ein separater Folge-Schritt die aktuelle Referenzdatei erzeugen oder promoten. Dieser Plan selbst führt diesen Schritt nicht aus.
10. **Abschluss:** Der Plan gilt erst mit erfüllten ACs, dauerhaftem QA-Report und dokumentiertem Nutzerabnahmestatus als abgeschlossen.

## 23. Planstatus

Dieser Plan ist ohne offene fachliche Produktfrage implementation-ready. Er schreibt keine Produktionsdatei, keinen Test, kein PNG und keine Referenz. Die technische Unsicherheit der Linienquelle wird durch einen verpflichtenden lokalen A/B-Pixelcheck vor der Korrektur aufgelöst; sie ist keine Rückfrage an den Nutzer. Die vier MUST-FIXes, die begrenzten SHOULD-FIXes, die späteren Product-Ideas, die Mobile-/Infrastructure-Grenzen, die historischen Golden-Regeln und das manuelle Abnahme-Gate sind explizit getrennt dokumentiert.
