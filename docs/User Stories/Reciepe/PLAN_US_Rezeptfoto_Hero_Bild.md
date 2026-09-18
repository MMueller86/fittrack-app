# Technischer Plan: US - Rezeptfoto fuer optimales Hero-Bild aufnehmen

**User Story:** [US_Rezeptfoto_Hero_Bild.md](US_Rezeptfoto_Hero_Bild.md)

- **Status:** READY FOR IMPLEMENTATION - keine offene fachliche Produktentscheidung
- **Plan-Typ:** Large cross-cutting feature (Mobile, Shared, Backend, Cosmos read compatibility, Instagram renderer)
- **Klassifikation:** Accept with modifications

Infrastructure Impact: Dev
Mobile Build Impact: Potential Native Impact

Die User Story bleibt unveraendert. Dieser Plan ist die technische und
fachliche Bewertung fuer die anschliessende Umsetzung. Die Planner-Rolle
implementiert weder Produktionscode noch Tests und veraendert keine Knowledge-
Base-Dateien.

## Confirmed Product Owner Decisions

### PO-1 - Verbindlicher Hero-Rahmen (bestaetigt)

Der versionierte Rahmen `instagram-recipe-v1` verwendet verbindlich
`1080 x 1015`. Dies entspricht der aktuellen Foto-/Hero-Flaeche des
bestehenden `1080 x 1350`-Instagram-Renderers: Die Transition beginnt bei
`y=574`, der Titel liegt ungefaehr bei `y=853` und die Tags bei `y=936`.

Die Abweichung von der User-Story-Referenz `1080 x 880` bleibt ausdruecklich
dokumentiert und begruendet: `1080 x 880` endet vor der Tag-Zone und ist daher
kein passender Laufzeitvertrag fuer die bestehende Komposition. Die Ausgabe
bleibt weiterhin exakt `1080 x 1350`; `1080 x 1015` beschreibt nur die
Foto-/Hero-Flaeche.

**Konsequenz:** Kamera-Overlay, Crop-Editor, Safe-Area-Hilfe und Renderer-
Integration verwenden `instagram-recipe-v1` mit `1080 x 1015`. Eine spaetere
Renderer-Geometrieaenderung benoetigt einen neuen versionierten Rahmen oder
eine ausdruecklich geplante Migration.

### PO-2 - Bedeutung von "Originalbild" (bestaetigt)

"Originalbild" bedeutet die vollstaendige uncropped Bildinformation. Eine
orientierungsbereinigte Darstellung im Speicher und eine uebliche
JPEG-Kodierung sind zulaessig. Ein raeumlicher Zuschnitt und eine zusaetzliche
Hero-Datei sind ausgeschlossen; byte-identische Eingabebytes sind kein
separates Produktziel.

**Konsequenz:** Es wird genau ein vollstaendiger Bild-Blob gespeichert. Der
Crop bleibt ausschliesslich Metadaten. Der Backend-Renderer darf EXIF-
Orientierung temporaer im Speicher normalisieren, vorzugsweise mit Sharp
`rotate()`, ohne den gespeicherten Blob zu ersetzen.

### PO-3 - Eigenstaendiger Instagram-Crop (bestaetigt)

Es wird kein separates, persistiertes Instagram-Crop-Metadatum eingefuehrt.
Der gespeicherte Hero-Crop ist der Default fuer den bestehenden
`1080 x 1350`-Instagram-Renderer. Spaetere Ausgabeformate und Templates
benoetigen jeweils eigene versionierte Vertraege.

**Konsequenz:** Das Datenmodell bleibt bei einem versionierten `heroCrop` pro
Bild. Request-Level-Overrides bleiben temporaer und aendern die Persistenz
nicht. Es gibt keinen zusaetzlichen Crop-Schreibpfad und keine zweite Datei.

PO-1 bis PO-3 sind damit verbindliche Grundlagen dieses Plans. Es gibt fuer
diese Punkte keinen offenen Produktentscheid und keine vorgelagerte
Produktfreigabe mehr; alle nachfolgenden Arbeitspakete koennen gegen diese
Vertraege umgesetzt werden.

## 1. Requirement Assessment

### Nutzerproblem

Nutzer sollen ein Rezeptfoto so aufnehmen oder auswaehlen koennen, dass der
Hauptinhalt in der spaeteren Rezeptdarstellung und in der Instagram-Grafik
kontrolliert sichtbar bleibt. Die bestehende Galerieauswahl bietet diese
Sicherheit nicht: Sie verwendet einen systemeigenen `4:3`-Zuschnitt, kennt die
Renderer-Komposition nicht und speichert keine Positionierungsdaten.

### Loesungsfit

Die vorgeschlagene Richtung ist fachlich sinnvoll, weil der verbindlich
bestaetigte Rahmen an den aktuell implementierten Renderer gebunden ist. Ein
Kamera-Overlay allein
loest das Problem nicht, weil Nutzer auch bestehende Galerieaufnahmen nutzen
und spaeter neu positionieren muessen. Deshalb braucht es einen gemeinsamen,
nicht-destruktiven Pan-/Zoom-Editor fuer Kamera- und Galeriequellen.

Die Pixelangabe `1080 x 880` ist dagegen fuer den aktuellen Renderer kein
geeigneter Vertrag. Sie wird durch einen benannten Rahmen ersetzt, dessen
Seitenverhaeltnis der bestehenden Foto-/Hero-Flaeche entspricht. Die Ausgabe
bleibt davon getrennt exakt `1080 x 1350`.

### Produkt- und Domaenenbewertung

- Die Funktion beeinflusst Rezeptbild-Darstellung, aber keine Nutrition-
  Berechnung, Portionslogik oder gesundheitliche Empfehlung.
- Die vollstaendige Bildquelle bleibt erhalten; der Nutzer entscheidet nur,
  welcher Ausschnitt fuer die Darstellung fokussiert wird.
- Der Crop ist pro Bild statt pro Rezept zu speichern, weil ein Rezept mehrere
  Bilder und unterschiedliche Bildkompositionen haben kann.
- Legacy-Rezepte ohne Crop-Metadaten muessen weiterhin lesbar bleiben.
- Die untere Renderer-Zone enthaelt Titel und Tags. Der Crop-Editor sollte
  diese Zone als nicht-destruktive Safe-Area-Hilfe kenntlich machen, damit ein
  Gericht nicht unbemerkt unter serverseitigem Text liegt.

### Health-Risk- und AI-Bewertung

Es gibt keinen AI-Anteil. Kameraaufnahme, Seitenverhaeltnis, Crop-Mathematik,
EXIF-Behandlung und Renderer-Integration sind deterministisch. Azure OpenAI,
Prompt-Aenderungen, Quota-Logik und AI-Evaluation sind fuer dieses Problem
nicht erforderlich und werden nicht eingeplant.

### Einfachere und sicherere Alternative

Die bestehende `4:3`-Systembearbeitung weiterzuverwenden waere zwar kleiner,
aber sie wuerde den Renderer-Vertrag nicht abbilden und die gewuenschte
spaetere Neupositionierung verhindern. Ein separater Hero-Blob wuerde die
Bildspeicherung und Loesch-/Reorder-Logik duplizieren. Der empfohlene Weg
vermeidet beide Probleme: ein Blob, versionierte Metadaten, ein gemeinsamer
Editor.

## 2. Recommended Product Behaviour

| Thema | Original-Story | Empfohlene Umsetzung | Grund der Abweichung |
|---|---|---|---|
| Hero-Rahmen | Ungefaehr `1080 x 880` | Versionierter Rahmen `instagram-recipe-v1`, abgebildet auf `1080 x 1015` | Der Renderer besitzt bereits `1080 x 1015` als Foto-/Hero-Flaeche. |
| Endformat | Spaeteres Hero-Bild | Renderer liefert weiterhin exakt `1080 x 1350` | Der Rahmen ist nur die Fotoquelle, nicht die komplette Share-Grafik. |
| Aufnahme | Kamera mit abgedunkeltem Bereich ausserhalb des Rahmens | In-App-Kamera mit responsivem Rahmen und Safe-Area-Hilfe | Die mobile Vorschau muss den echten Produktvertrag abbilden. |
| Galerie | Nicht explizit geregelt | Galerie bleibt moeglich, aber ohne systemeigenen Zuschnitt; danach derselbe Editor | Kamera und vorhandene Bilder brauchen identische Bearbeitung. |
| Original | Vollstaendig speichern, kein Zuschnitt | Ein einziger vollstaendiger Blob; Crop nur als Metadaten; Orientierung darf im Speicher normalisiert werden | Spatialer Zuschnitt und zweite Datei werden vermieden. |
| Crop | Parameter speichern, spaeter Pan/Zoom | `version`, `frame`, normalisierte `focusX`, `focusY`, `zoom` pro Bild speichern | Der Vertrag ist servervalidierbar und rendererfaehig. |
| Renderer | Hero-Crop aus dem Original anzeigen | Gespeicherter Crop ist der Default; optionale Request-Overrides bleiben moeglich | Detailansicht und Share-Grafik zeigen denselben Nutzerfokus. |
| KI | Nicht gefordert | Keine KI | Deterministische Bildgeometrie ist ausreichend. |

Der Rahmen bezeichnet das Seitenverhaeltnis, nicht eine physische Aufloesung
auf dem Mobilgeraet. Die UI skaliert den Rahmen responsiv. `1080 x 1015` ist
die technische Referenz fuer das Renderer-Koordinatensystem.

## 3. Feature Summary

Die Umsetzung verbindet fuenf Schichten:

1. Shared definiert einen optionalen, versionierten `heroCrop`-Vertrag auf
   `RecipeImage`.
2. Mobile bietet Kamera und Galerie als Quellen an und fuehrt beide Quellen
   durch denselben Pan-/Zoom-Editor. Das Original-URI bleibt bis zum Upload
   erhalten; der Editor veraendert keine Datei.
3. Backend validiert Crop-Metadaten serverseitig, persistiert sie zusammen
   mit der bestehenden RecipeImage-Referenz und bietet eine authentifizierte
   Update-Route fuer spaetere Crop-Aenderungen.
4. Cosmos speichert das optionale Feld im bestehenden `recipes`-Dokument.
   Alte Dokumente ohne Feld erhalten einen deterministischen Default.
5. Der Instagram-Adapter verwendet den gespeicherten Crop, wenn kein
   Request-Override geliefert wird. Der Renderer normalisiert EXIF-
   Orientierung im Speicher und liefert weiterhin ein `1080 x 1350` PNG.

## 4. Current Behaviour

### Mobile

- `RecipeWizardScreen.handlePickImage()` oeffnet nur die Galerie.
- `expo-image-picker` verwendet `allowsEditing: true` und `aspect: [4, 3]`.
- Der lokale Draft speichert URI und MIME, aber keine Crop-Daten.
- Es gibt keinen Rezeptkamera-Flow, keinen Hero-Rahmen und keinen gemeinsamen
  Crop-Editor.
- `RecipeWizardPreviewPhase` zeigt Thumbnails mit einfachem `cover`.
- `recipeWizardEditBootstrap` ignoriert Bild-Praesentationsdaten.
- `recipeWizardImageMutations` kann hochladen, loeschen und sortieren, aber
  keine Crop-Metadaten aktualisieren.
- `RecipeDetailScreen` zeigt das aktuelle Bild mit fester Hoehe und
  `resizeMode="cover"`; `focusX`, `focusY` und `zoom` werden ignoriert.
- `mobile/app.config.js` enthaelt bereits `expo-camera`, nennt in der
  Berechtigungsbeschreibung aber noch keine Rezeptfotos.

### Shared und Persistenz

- `RecipeImage` enthaelt `id`, `blobName`, `order` und optional eine
  transiente `url`.
- `cosmosRecipesRepository` serialisiert aktuell nur `id`, `blobName` und
  `order` fuer Bilder.
- Bestehende Cosmos-Dokumente enthalten daher keine Crop-Metadaten.
- Die Partitionierung bleibt `/userId`; es gibt keinen Anlass fuer einen
  neuen Container oder eine neue Partition.

### Backend und API

- `POST /api/recipes/{id}/images` nimmt JPEG/PNG bis 8 MB an und speichert
  das Rohbild als einen Blob.
- Upload, Loeschen, Reorder und GET sind user-scoped; Authentifizierung laeuft
  ueber `requireUser()` beziehungsweise bestehende Handler-Muster.
- Es gibt keine Route zum separaten Aktualisieren der Bildpraesentation.
- `POST /api/recipes/{id}/instagram-render` rendert das serverseitig geladene
  Bild. Der Adapter verwendet bisher Request-Werte oder feste Defaults
  `focusX: 0.5`, `focusY: 0.46`, `zoom: 1`.

### Renderer

- Die Ausgabe ist exakt `1080 x 1350` PNG.
- Die Foto-/Hero-Flaeche ist `1080 x 1015`.
- `PHOTO_TRANSITION_START_Y` ist `574`, `PHOTO_TRANSITION_END_Y` ist `1015`.
- Der Titel beginnt ungefaehr bei `y=853`, die Tag-Reihe bei `y=936` und die
  Nutrition Card bei `y=1048`.
- `calculateCoverPlacement()` verwendet Cover-Skalierung, Focus und Zoom.
- Die aktuelle Breitenpruefung mit pauschaler 90-Grad-Rotation ist fuer EXIF-
  orientierte Bilder nicht belastbar.

## 5. Desired Behaviour

### 5.1 Quelle auswaehlen

Der Rezeptwizard bietet eine FitTrack-eigene Auswahl fuer:

- **Kamera:** bestehende `expo-camera`-Integration und `CameraView`.
- **Galerie:** vorhandenes Bild ohne systemeigenen Zuschnitt.

Wird die Berechtigung verweigert, bleibt der Wizard benutzbar und zeigt die
bestehende FitTrack-Fehler-/Hinweislogik mit einer Moeglichkeit, die Galerie
zu verwenden oder die Berechtigung spaeter zu erteilen.

### 5.2 Kamera-Rahmen

- Der Rahmen nutzt das feste Verhaeltnis `1080 / 1015`.
- Der Bereich ausserhalb des Rahmens ist sichtbar abgedunkelt.
- Der Rahmen bleibt bei unterschiedlichen Displaygroessen, Safe-Area-Inset-
  Werten und Portrait-Geraeten stabil.
- Die Kamera-Vorschau darf den Sensor nicht ungeprueft als bereits korrekt
  beschnitten annehmen. Der anschliessende Editor ist die verbindliche
  Positionierungsstufe.
- Die untere Text-/Tag-Zone des Renderers wird als dezente, nicht-destruktive
  Safe-Area-Hilfe im Editor kenntlich gemacht. Sie veraendert weder das
  Original noch die gespeicherten Crop-Daten.

### 5.3 Gemeinsamer Crop-Editor

- Kamera- und Galeriequelle verwenden denselben Editor.
- Ein Finger verschiebt das Bild innerhalb des Rahmens.
- Pinch veraendert den Zoom; der minimale Zoom fuellt den Rahmen vollstaendig.
- Panning wird so begrenzt, dass kein leerer Raum sichtbar wird.
- Der Editor speichert nur normalisierte Metadaten. Er schreibt keine
  zugeschnittene Datei und erzeugt keinen zweiten Blob.
- Beim erneuten Oeffnen wird der gespeicherte Crop deterministisch geladen.
- Ein Legacy-Bild ohne Metadaten verwendet den zentral definierten Default
  und kann danach normal bearbeitet werden.

### 5.4 Shared Crop-Vertrag

Der verbindliche Vertrag lautet:

```ts
interface RecipeImageHeroCrop {
  version: 1;
  frame: 'instagram-recipe-v1';
  focusX: number;
  focusY: number;
  zoom: number;
}
```

Semantik:

- `focusX` und `focusY` sind endliche normalisierte Werte in `[0, 1]`.
- Die Werte beziehen sich auf das visuell orientierte Quellbild, nicht auf
  rohe EXIF-Koordinaten.
- `zoom` ist endlich und mindestens `1`.
- `frame` ist eine geschlossene Versionkennung. Clientseitig gelieferte
  beliebige Breiten, Hoehen oder Seitenverhaeltnisse werden nicht akzeptiert.
- Der zentrale Default fuer Legacy-Bilder entspricht dem aktuellen
  Renderer-Default: `{ version: 1, frame: 'instagram-recipe-v1', focusX: 0.5,
  focusY: 0.46, zoom: 1 }`.

### 5.5 API-Vertrag

Der bestehende Upload wird additiv erweitert:

```text
POST /api/recipes/{id}/images
Content-Type: multipart/form-data

image: <jpeg-or-png>
heroCrop: <optional JSON string matching RecipeImageHeroCrop>
```

Neue Route fuer Metadaten-Aenderungen:

```text
PUT /api/recipes/{id}/images/{imageId}/hero-crop
Content-Type: application/json

{ "heroCrop": { ... } }
```

Beide Routen:

- verlangen `requireUser()` und laden das Rezept user-scoped;
- akzeptieren nur ein Bild, das zu diesem Rezept gehoert;
- validieren Version, Frame, endliche Focus-Werte und Zoom serverseitig;
- speichern nur Metadaten, wenn der Blob bereits existiert;
- vertrauen nicht auf vom Client gelieferte Blobnamen, Abmessungen oder
  Orientierungsangaben.

Der Upload ohne `heroCrop` bleibt fuer Legacy- und alte Clients gueltig. Wird
ein `heroCrop` geliefert, speichert der Server ausschliesslich die validierte
Struktur. Wird kein `heroCrop` geliefert, bleibt das optionale Feld im
Dokument weg; beim Lesen liefert der Repository-/Adapter-Pfad den
deterministischen effektiven Default. Damit bleiben alte Clients kompatibel,
ohne neue Dokumente unnoetig mit einem impliziten Wert anzureichern.

### 5.6 Renderer-Integration

- Wird keine `presentation` im Instagram-Request geliefert, verwendet der
  Adapter den effektiven `heroCrop` des ausgewaehlten Bildes.
- Wenn nur einzelne Request-Felder geliefert werden, werden fehlende Felder
  aus dem gespeicherten Crop des Bildes uebernommen, nicht aus unabhaengigen
  globalen Defaults.
- Request-Level-Overrides veraendern die gespeicherten Metadaten nicht.
- Der Renderer bleibt alleinige Autoritaet fuer Layout, Transition, Titel,
  Tags und Nutrition Card.
- Der Renderer normalisiert die EXIF-Orientierung fuer die Berechnung im
  Speicher, vorzugsweise mit Sharp `rotate()`, ohne eine zweite Datei zu
  speichern. Die bestehende Breitenheuristik darf nicht die einzige
  Orientierungslogik bleiben.

### 5.7 Bildgroesse und Original

Die bestehende 8-MB-Grenze bleibt in diesem Plan die serverseitige Grenze.
Kamera und Galerie duerfen fuer die Upload-Kodierung eine uebliche
Qualitaetseinstellung verwenden, aber niemals still raeumlich zuschneiden.
Wenn ein Bild nach der Auswahl weiterhin ueber 8 MB liegt, bricht der Upload
mit einem stabilen, fuer den Nutzer verstaendlichen Fehler ab; es wird kein
teilweiser Bilddatensatz angelegt. Eine spaetere Anhebung der Grenze oder
kontrollierte Re-Kompression ist ein eigener Produkt-/Performanceentscheid.

## 6. Scope

- Shared-Typ und Default-/Validierungsvertrag fuer Hero-Crop-Metadaten.
- Optionales `heroCrop` in `RecipeImage` und kompatible Cosmos-Serialisierung.
- Authentifizierte Crop-Validierung beim Upload und eigene Crop-Update-Route.
- Kameraquelle mit `expo-camera`, dimmendem Hero-Overlay und Berechtigungs-
  handling.
- Galeriequelle ohne `allowsEditing` und gemeinsamer Pan-/Pinch-Editor.
- Draft-, Bootstrap-, Upload-, Update-, Reorder- und Delete-Integration im
  Rezeptwizard.
- Crop-konsistente Darstellung im Wizard-Preview, Rezeptdetail und den
  vorhandenen Rezeptbild-Thumbnails.
- Instagram-Adapter-Integration, EXIF-Orientierung und Regressionen fuer
  Portrait, Landscape und EXIF-rotierte Bilder.
- Aktualisierung der betroffenen Knowledge-Base-/API-Dokumentation durch die
  nachgelagerten Implementierungsagenten.
- Sequenzierte Dev-Bereitstellung und Entscheidung des Infrastructure-Agenten,
  ob wegen `app.config.js` ein neuer Dev Build benoetigt wird.

## 7. Out of Scope

- Aenderung der unveraenderten User Story `US_Rezeptfoto_Hero_Bild.md`.
- Neue Azure-Ressource, neue Resource Group, neuer Cosmos-Container oder neue
  Partitionierung.
- Separater Hero-Blob, separates Instagram-Bild oder persistiertes PNG.
- Persistierte beliebige Seitenverhaeltnisse oder ein generisches Crop-System
  fuer kuenftige Templates.
- Instagram Graph API, nativer Share-Sheet-Flow und automatischer Upload zu
  Instagram.
- Vollstaendige Instagram-Preview mit allen Rezeptdaten im Mobile-Editor.
  Eine Safe-Area-Hilfe ist eingeschlossen; die serverseitige Grafik bleibt
  die visuelle Autoritaet.
- Aenderung von Nutrition-, Rezeptanalyse- oder KI-Prompts.
- Clientseitige Autorisierung, Vertrauen in Client-Blobnamen oder Umgehung
  von `requireUser()`.
- Stille Aufhebung oder stilles Ueberschreiten der 8-MB-Grenze.
- Neue npm-Abhaengigkeit, sofern die bereits installierten Kamera-, Gesture-
  und Reanimated-Pakete die Umsetzung tragen.

## 8. Confirmed Facts

### Repository

1. Der aktuelle Renderer liegt unter `backend/src/lib/instagramRenderer/` und
   liefert exakt `1080 x 1350` PNG.
2. `layout.ts` definiert `HERO_WIDTH=1080`, `HERO_HEIGHT=1015`,
   `PHOTO_TRANSITION_START_Y=574` und `PHOTO_TRANSITION_END_Y=1015`.
3. Titel, Tags und Nutrition Card belegen die Zonen um `y=853`, `y=936` und
   `y=1048`; das Foto endet nicht bei `y=880`.
4. Der aktuelle Wizard bietet nur Galerieauswahl mit `allowsEditing: true` und
   `aspect: [4, 3]`.
5. `expo-camera`, Reanimated und Gesture Handler sind bereits im Mobile-
   Projekt vorhanden.
6. `RecipeImage` und die Cosmos-Serialisierung enthalten derzeit keine Crop-
   oder Orientierungsmetadaten.
7. Upload, Delete und Reorder sind bereits user-scoped und verwenden den
   bestehenden Blob-Container `recipe-images`.
8. Die bestehende Upload- und Render-Download-Grenze liegt bei 8 MB.
9. Der Instagram-Endpoint ist bereits implementiert und verwendet aktuell
   Request-Presentation oder unabhaengige Defaults.
10. Die aktuelle Foto-Platzierung enthaelt eine Breitenheuristik fuer Rotation,
    die EXIF-Orientierung nicht vollstaendig ersetzt.
11. Die vorhandenen Package-Abhaengigkeiten rechtfertigen derzeit keine neue
    Bild- oder Kamera-Bibliothek.

### Knowledge Base und Dokumentation

12. `docs/kb/domain/06-recipes.md` dokumentiert aktuell nur Blob-Referenz und
    Reihenfolge fuer RecipeImage.
13. `docs/kb/tech/09-api-reference.md` dokumentiert Upload/Delete/Reorder und
    den `1080 x 1350`-Renderer, aber noch keinen Crop-Vertrag.
14. `docs/kb/tech/02-backend.md` beschreibt den serverseitigen Renderer und
    direkten Blob-Zugriff.
15. `docs/kb/tech/03-mobile.md` beschreibt das Rezeptmodul, aber keinen
    Rezeptkamera- oder Hero-Crop-Flow.
16. Ein historischer Instagram-Plan beschreibt den Endpoint teilweise als
    noch nicht vorhanden. Das widerspricht dem aktuellen Repository und wird
    fuer diesen Plan nicht als Quelle fuer das Ist-Verhalten verwendet.

### User Story

17. Die User Story fordert einen Kamera-Hero-Frame, vollstaendige Quelle,
    gespeicherte Crop-Parameter, spaetere Pan-/Zoom-Bearbeitung und keinen
    zweiten Hero-Blob.
18. Die User Story fordert keine KI.

## 9. Assumptions and Open Questions

PO-1 bis PO-3 sind im vorherigen Abschnitt verbindlich entschieden. Dieser
Abschnitt enthaelt deshalb nur technische Annahmen und Umsetzungsgrenzen;
keine davon erfordert eine weitere Produktfreigabe fuer die Umsetzung.

| ID | Technische Annahme / Rahmenbedingung | Status und Auswirkung |
|---|---|---|
| A-1 | Die bestehende 8-MB-Grenze bleibt unveraendert und wird bei Ueberschreitung sichtbar abgelehnt. | Fuer diese Umsetzung festgelegt; kein stiller Qualitaets- oder Inhaltsverlust. |
| A-2 | Der untere Safe-Area-Hinweis ist eine UI-Hilfe und kein zusaetzlicher Persistenzwert. | Technische Umsetzungsregel; die Renderer-Geometrie bleibt serverseitig. |
| A-3 | Legacy-Bilder ohne Metadaten erhalten beim Lesen den Default `0.5 / 0.46 / 1`. | Kompatibilitaetsregel; keine Einmalmigration erforderlich. |
| A-4 | Ein zusaetzlicher nativer Bildeditor ist nicht erforderlich, weil der Crop als Transformationsmetadaten gespeichert wird. | Bestehende Gesture-/Reanimated-APIs werden verwendet; eine neue Abhaengigkeit ist nicht Teil dieses Plans. |

**Open Questions:** Keine fuer den aktuellen Umsetzungsumfang. Eine spaetere
Anhebung der 8-MB-Grenze oder ein weiteres Renderer-Template waere ein
separater Produktentscheid, aendert aber nicht die Umsetzungsbereitschaft
dieses Plans.

## 10. Existing Components to Reuse

| Bereich | Bestehende Komponenten | Verwendung |
|---|---|---|
| Kamera | `expo-camera`, vorhandene Barcode-`CameraView`-Muster | Permission, Preview und Capture ohne neue Bibliothek |
| Galerie | `expo-image-picker` | Auswahl ohne systemeigenen Crop |
| Gesten | `react-native-gesture-handler`, `react-native-reanimated` | Pan, Pinch, Clamp und stabile Animation |
| Wizard | `RecipeWizardScreen`, `RecipeWizardPreviewPhase`, Draft-Typen | Quelle, Vorschau und Edit-Flow |
| Persistenz | `recipeWizardImageMutations`, `recipeApi`, bestehende Image-Handler | Upload, Delete, Reorder und neuer Metadata-Update |
| Backend-Auth | `requireUser()`, `withHandler()`, bestehende Rezept-Handler | Authentifizierung und User-Scoping |
| Storage | `uploadRecipeImage`, `downloadRecipeImage` | Ein Blob, bestehende MIME- und Groessenregeln |
| Cosmos | `recipesRepository`, `cosmosRecipesRepository` | Optionales Feld im bestehenden Dokument |
| Renderer | `recipeAdapter`, `photo.ts`, `render.ts`, `layout.ts` | Gespeicherte Presentation und Orientierung |
| UX | bestehende FitTrack-Sheets, Alerts/Snackbar und Theme-Tokens | Quelle, Fehler, Abbruch und Zugriffshilfen |

## 11. Proposed Technical Solution

### 11.1 Layering

```text
RecipeWizardScreen
  -> source chooser
  -> CameraView or ImagePicker URI
  -> shared HeroCropEditor
  -> local draft { uri, mime, heroCrop }
  -> recipeApi upload/update
  -> authenticated recipes handler
  -> RecipeImage { blobName, order, heroCrop? }
  -> instagramRecipe adapter
  -> renderer orientation normalization + cover placement
  -> 1080 x 1350 PNG
```

Der Crop-Editor kennt nur Bilddimensionen, Gesten und den versionierten
Rahmen. Er kennt keine Cosmos- oder Renderer-Layoutdaten ausser der
versionierten Rahmenkennung und der Safe-Area-Darstellung. Der HTTP-Handler
bleibt Orchestrator; Layoutformeln bleiben im Renderer.

### 11.2 Shared contract and effective default

- `shared/types/recipes.ts` erhaelt `RecipeImageHeroCrop` und
  `RecipeImage.heroCrop?: RecipeImageHeroCrop`.
- Ein zentraler, importierbarer Default verhindert abweichende Legacy-Werte
  in Mobile und Backend.
- Backend validiert strikt und unabhaengig vom Client.
- Mobile darf den Vertrag typisiert verwenden, ist aber nicht die
  Sicherheitsgrenze.
- Beliebige Frame-Masse, negative Zoomwerte, `NaN`, `Infinity` und Focus-
  Werte ausserhalb `[0, 1]` werden abgelehnt.

### 11.3 Cosmos evolution

**Persistence Impact:** Additives optionales Feld in bestehenden
`recipes.images`-Eintraegen, Class 1 read compatibility mit deterministischem
Default. Es gibt keine Einmalmigration, keinen neuen Container, keine neue
Partition und keine Bicep-Aenderung. Alte Dokumente ohne `heroCrop` bleiben
lesbar; ein Read-Fallback liefert den effektiven Default. Neue Dokumente
duerfen das Feld speichern. Die Serialisierung muss weiterhin transiente
`url`-Werte entfernen.

Die Implementierung muss die bestehenden Delete- und Reorder-Pfade so
beibehalten, dass `heroCrop` beim Umsortieren erhalten bleibt und beim
Loeschen zusammen mit dem Bild verschwindet.

### 11.4 Upload and metadata update

- Upload liest nur das Multipart-Bild und optionales JSON fuer `heroCrop`.
- Der Server validiert den Bildtyp, die Groesse, die Rezeptzugehoerigkeit und
  die Crop-Struktur.
- Die Update-Route aendert keine Blobbytes; sie aktualisiert nur das
  user-scoped Recipe-Dokument.
- Ein Update auf unbekanntes Rezept oder Bild ist kein globaler Metadata-
  Schreibpfad und darf keine fremden Daten veraendern.
- Die Antwort liefert das bestehende `RecipeImage`-Shape mit persistiertem
  Crop, soweit der aktuelle API-Response dies zulaesst.

### 11.5 Orientation and renderer math

Die bevorzugte Reihenfolge im Backend ist:

1. autorisiertes Blob laden und 8-MB-Grenze pruefen;
2. Bild mit Sharp-Metadaten pruefen;
3. EXIF-Orientierung in einem Buffer normalisieren, ohne den Blob zu ersetzen;
4. Dimensionen des orientierten Buffers fuer Cover- und Focus-Berechnung
   verwenden;
5. gespeicherten Crop auf die `1080 x 1015`-Flaeche anwenden;
6. Renderer wie bisher auf `1080 x 1350` ausgeben.

Die Implementation darf alternativ einen expliziten Orientierungsparameter in
der Platzierungslogik fuehren, muss dann aber dieselbe Semantik fuer Mobile-
Metadaten, Server-Renderer und Tests nachweisen. Eine reine Pruefung
`width > height` ist nicht ausreichend.

### 11.6 Renderer request precedence

Die effektive Presentation wird in dieser Reihenfolge gebildet:

1. serverseitiger Crop des ausgewaehlten Bildes;
2. einzelne gueltige Request-Felder als expliziter Preview-/Editor-Override;
3. zentraler Legacy-Default fuer fehlende gespeicherte Daten.

Der Handler darf bei einem partiellen Request nicht alle anderen Felder auf
POC-Defaults zuruecksetzen. Die Persistenz wird durch einen Render-Request
nicht veraendert.

### 11.7 Accessibility and failure behaviour

- Quelle, Ausloeser, Zurueck, Bestaetigen und Crop-Editieraktion benoetigen
  sinnvolle Accessibility-Labels und ausreichende Touch-Ziele.
- Permission-Denied, Cancel, unlesbare Datei und zu grosse Datei werden als
  normale Nutzerzustaende behandelt; kein leerer Draft wird gespeichert.
- Serverfehler beim Metadata-Update duerfen den lokalen Draft nicht als
  erfolgreich persistiert markieren.
- Beim Editieren eines bestehenden Bildes wird bei Fehlern der letzte
  bestaetigte Crop erhalten.

## 12. Backend Work Package

**Agent:** Backend

**Goal**

Den versionierten Hero-Crop sicher in Shared-Vertrag, Cosmos, Upload-/Update-
API und Instagram-Renderer integrieren. Bestehende Bild-, Auth-, Delete- und
Reorder-Vertraege bleiben kompatibel.

**Required Knowledge Base:**
- docs/kb/domain/06-recipes.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- shared/types/recipes.ts
- backend/src/functions/recipes.ts
- backend/src/functions/instagramRecipe.ts
- backend/src/lib/repositories/recipesRepository.ts
- backend/src/lib/repositories/cosmosRecipesRepository.ts
- backend/src/lib/storage.ts
- backend/src/lib/instagramRenderer/

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-5 through AC-12
- AC-16 through AC-18

**Dependencies:**
- None for the initial contract; subsequent subtasks are strictly sequential.

**Expected Handoff:**
- Shared Crop-Typen und Default
- validierter Upload-/Update-API-Vertrag
- Cosmos-Kompatibilitaetsregeln
- Renderer-Integration und Backend-Testbefunde

### B-HR-1 - Shared-Vertrag und serverseitige Validierung

**Agent:** Backend

**Goal**

Den `RecipeImageHeroCrop`-Vertrag, den zentralen Default und eine strikte
serverseitige Validierung definieren. Die Validierung muss `frame` und
`version` geschlossen behandeln und darf keine beliebigen Client-Abmessungen
uebernehmen.

**Required Knowledge Base:**
- docs/kb/domain/06-recipes.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- shared/types/recipes.ts
- backend/src/lib/instagramRenderer/types.ts
- backend/src/lib/instagramRenderer/recipeAdapter.ts
- backend/src/functions/recipes.ts

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-5
- AC-6
- AC-9

**Dependencies:**
- None.

**Expected Handoff:**
- Typen, Default und Validierungsregeln fuer Backend und Frontend
- Liste der stabilen Fehlerfaelle

### B-HR-2 - Cosmos-Serialisierung und Bild-API

**Agent:** Backend

**Goal**

Das optionale Feld in der bestehenden `recipes`-Dokumentstruktur speichern,
Legacy-Dokumente mit Default lesen, Upload-Multipart erweitern und eine
user-scoped `PUT .../hero-crop`-Route implementieren. Delete und Reorder
muessen das Feld korrekt erhalten beziehungsweise entfernen.

**Required Knowledge Base:**
- docs/kb/domain/06-recipes.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- shared/types/recipes.ts
- backend/src/functions/recipes.ts
- backend/src/lib/repositories/recipesRepository.ts
- backend/src/lib/repositories/cosmosRecipesRepository.ts
- backend/src/lib/storage.ts
- backend/src/lib/auth.ts
- backend/src/lib/http.ts
- backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-5 through AC-10
- AC-16
- AC-17

**Dependencies:**
- B-HR-1.

**Expected Handoff:**
- API-Routen und Request-/Response-Vertrag
- Cosmos-Read-Fallback fuer Legacy-Dokumente
- Contract-/Handler-Testbefunde
- bestaetigte Fehlerstatus fuer Frontend

### B-HR-3 - Instagram-Adapter, Orientierung und Renderer-Regressionen

**Agent:** Backend

**Goal**

Gespeicherten Hero-Crop als Default in den Instagram-Renderer integrieren,
partielle Request-Overrides korrekt mergen und EXIF-Orientierung vor der
Cover-Berechnung belastbar behandeln. Die Ausgabe- und Layoutvertraege des
Renderers bleiben unveraendert.

**Required Knowledge Base:**
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- backend/src/functions/instagramRecipe.ts
- backend/src/lib/instagramRenderer/recipeAdapter.ts
- backend/src/lib/instagramRenderer/photo.ts
- backend/src/lib/instagramRenderer/render.ts
- backend/src/lib/instagramRenderer/layout.ts
- backend/src/lib/instagramRenderer/types.ts
- backend/src/lib/instagramRenderer/__tests__/
- backend/src/lib/instagramRenderer/fixtures/
- backend/src/lib/storage.ts

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-10 through AC-15
- AC-18

**Dependencies:**
- B-HR-2.

**Expected Handoff:**
- Renderer nutzt gespeicherten Crop und Legacy-Default
- Portrait-, Landscape- und EXIF-Regressionsergebnisse
- bestaetigter `1080 x 1350`-Output

### B-HR-4 - Backend- und API-Dokumentation

**Agent:** Backend

**Goal**

Die aktuelle RecipeImage-Struktur, Crop-Semantik, Routen, Validierung,
Legacy-Kompatibilitaet und Renderer-Prioritaet dokumentieren. Veraltete
Aussagen in betroffenen Dokumenten werden als solche korrigiert oder entfernt.

**Required Knowledge Base:**
- docs/kb/README.md
- docs/kb/domain/06-recipes.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md

**Required Repository Context:**
- shared/types/recipes.ts
- backend/src/functions/recipes.ts
- backend/src/functions/instagramRecipe.ts
- backend/src/lib/repositories/cosmosRecipesRepository.ts
- backend/src/lib/instagramRenderer/
- docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-19

**Dependencies:**
- B-HR-3.

**Expected Handoff:**
- Aktualisierte API-, Domain- und Backend-Dokumentation
- dokumentierte Abweichung `1080 x 880` versus `1080 x 1015`

## 13. Frontend Work Package

**Agent:** Frontend

**Goal**

Einen konsistenten Kamera-/Galerie-/Crop-Flow in den bestehenden Rezeptwizard
integrieren und die gespeicherten Metadaten in Edit-, Preview- und
Darstellungsflaechen verwenden.

**Required Knowledge Base:**
- docs/kb/tech/03-mobile.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx
- mobile/src/modules/recipes/recipeWizardTypes.ts
- mobile/src/modules/recipes/recipeWizardEditBootstrap.ts
- mobile/src/modules/recipes/recipeWizardImageMutations.ts
- mobile/src/shared/api/recipeApi.ts
- mobile/src/modules/recipes/RecipeDetailScreen.tsx
- mobile/src/modules/recipes/RecipeListScreen.tsx
- mobile/app.config.js
- mobile/package.json

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-1 through AC-4
- AC-6
- AC-13
- AC-16
- AC-18

**Dependencies:**
- B-HR-1 fuer den Shared-Vertrag.
- B-HR-2 fuer den finalen API-Vertrag vor der Persistenzintegration.

**Expected Handoff:**
- Nutzerfluss fuer Quelle, Kamera, Editor und Preview
- mobile Tests und manuelle Geraetepruefung
- dokumentierter Build-Signal fuer `app.config.js`

### F-HR-1 - Kamera, Galerie und Berechtigungen

**Agent:** Frontend

**Goal**

Quelleauswahl und Kamera-Preview mit responsivem `1080:1015`-Overlay
implementieren. Galerieauswahl darf keinen systemeigenen Zuschnitt erzwingen.
Die bestehende Permission- und Fehlerlogik wird um Rezeptfotos erweitert.

**Required Knowledge Base:**
- docs/kb/tech/03-mobile.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/modules/recipes/
- mobile/src/modules/* mit bestehender `expo-camera`-Nutzung
- mobile/app.config.js
- mobile/package.json

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-16

**Dependencies:**
- B-HR-1.

**Expected Handoff:**
- Kamera- und Galeriequellen liefern unbeschnittene Draft-URIs
- Permission-Denied-, Cancel- und Retry-Zustaende
- responsives Overlay ohne neue Dependency

### F-HR-2 - Gemeinsamer Hero-Crop-Editor

**Agent:** Frontend

**Goal**

Einen wiederverwendbaren Editor fuer Kamera- und Galeriequellen bauen, der
Pan, Pinch, Cover-Minimum, Clamp, Safe-Area-Hilfe und die Berechnung der
normalisierten Crop-Metadaten kapselt. Der Editor schreibt keine Bilddatei.

**Required Knowledge Base:**
- docs/kb/tech/03-mobile.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- mobile/src/modules/recipes/recipeWizardTypes.ts
- mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx
- mobile/src/modules/recipes/
- mobile/src/shared/components/
- mobile/package.json

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-2 through AC-5
- AC-13

**Dependencies:**
- F-HR-1.
- B-HR-1.

**Expected Handoff:**
- Crop-Editor mit `RecipeImageHeroCrop`-Ergebnis
- pure Crop-Mathematik oder testbare Berechnung
- wiederherstellbarer Default- und Legacy-Zustand

### F-HR-3 - Wizard-Persistenz und Bilddarstellung

**Agent:** Frontend

**Goal**

Crop-Metadaten in lokale Drafts, Edit-Bootstrap, Upload, Metadata-Update,
Reorder/Delete, Preview, Detail und Thumbnail-Darstellung integrieren. Ein
bestehendes Bild ohne Metadaten erhaelt den effektiven Default und kann ohne
Sonderpfad bearbeitet werden.

**Required Knowledge Base:**
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx
- mobile/src/modules/recipes/recipeWizardTypes.ts
- mobile/src/modules/recipes/recipeWizardEditBootstrap.ts
- mobile/src/modules/recipes/recipeWizardImageMutations.ts
- mobile/src/shared/api/recipeApi.ts
- mobile/src/modules/recipes/RecipeDetailScreen.tsx
- mobile/src/modules/recipes/RecipeListScreen.tsx
- shared/types/recipes.ts

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-4
- AC-6 through AC-8
- AC-13
- AC-14
- AC-18

**Dependencies:**
- B-HR-2.
- F-HR-2.

**Expected Handoff:**
- kompletter Wizard- und Edit-Flow
- typed API-Client fuer Upload und Crop-Update
- crop-konsistente Bildflaechen
- Frontend-Unit-/Integration-Testbefunde

### F-HR-4 - Mobile-Dokumentation

**Agent:** Frontend

**Goal**

Den dokumentierten Rezeptmodul- und Permission-Stand um Kameraquelle,
Galeriequelle, Hero-Crop-Editor, Legacy-Default und den moeglichen nativen
Build-Impact ergaenzen.

**Required Knowledge Base:**
- docs/kb/README.md
- docs/kb/tech/03-mobile.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- mobile/src/modules/recipes/
- mobile/app.config.js
- docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-19

**Dependencies:**
- F-HR-3.

**Expected Handoff:**
- aktualisierte Mobile-Dokumentation
- expliziter Hinweis, dass keine neue npm-Dependency eingefuehrt wurde

## 14. QA Work Package

**Agent:** QA

**Goal**

Den gesamten Kamera-, Crop-, Persistenz- und Renderer-Vertrag gegen die
Acceptance Criteria pruefen. Die Pruefung umfasst automatisierte Tests,
Cosmos-Kompatibilitaet, EXIF-Faelle sowie manuelle Mobile- und Build-
Beobachtung.

**Required Knowledge Base:**
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/domain/06-recipes.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

**Required Repository Context:**
- docs/User Stories/Reciepe/US_Rezeptfoto_Hero_Bild.md
- docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md
- shared/types/recipes.ts
- backend/src/functions/recipes.ts
- backend/src/functions/instagramRecipe.ts
- backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts
- backend/src/lib/instagramRenderer/
- backend/src/lib/instagramRenderer/__tests__/
- mobile/src/modules/recipes/
- mobile/src/shared/api/recipeApi.ts
- mobile/app.config.js
- infra/

**Required Skills:**
- cosmos-data-model-and-migration

**Relevant Acceptance Criteria:**
- AC-1 through AC-20

**Dependencies:**
- B-HR-4.
- F-HR-4.
- Infrastructure Release Gate.

**Expected Handoff:**
- QA-Report mit Verdict, AC-Matrix, Testbefehlen und Befunden
- Cosmos-Legacy-/New-Document-Nachweis
- Renderer-Diff- und EXIF-Nachweis
- manuelle Mobile-/Accessibility-/Build-Ergebnisse

## 15. Shared Package Changes

Der Shared-Bereich bleibt frei von UI-, Blob- und Auth-Logik.

- `shared/types/recipes.ts` erhaelt `RecipeImageHeroCrop` und das optionale
  Feld `RecipeImage.heroCrop`.
- Ein kleiner, reiner Helper darf Default und Typguard bereitstellen, wenn er
  von Mobile und Backend identisch verwendet werden kann.
- Der Helper darf keine Client-Sicherheit ersetzen; Backend validiert erneut.
- Keine Aenderung an Nutrition-Typen, Rezeptanalyse-Typen oder AI-Vertraegen.
- Shared-Unit-Tests pruefen Default, gueltige Werte und Grenzfaelle.

## 16. Infrastructure and Configuration (Development + Alpha)

### Infrastrukturwirkung

- Bestehender Blob-Container `recipe-images`, bestehender Cosmos-Container
  `recipes` und Partition `/userId` werden wiederverwendet.
- Neue Bicep-Ressourcen, neue Container und neue Resource Groups sind nicht
  erforderlich.
- `Infrastructure Impact: Dev` bedeutet: Die neue Backend-Route und die
  geaenderte Persistenz muessen nach der Implementierung in Dev verifiziert
  werden. Eine Alpha-Bereitstellung ist erst nach der QA-Abnahme zu planen.
- Infrastructure prueft, ob bestehende App Settings fuer Storage und Auth
  unveraendert ausreichen.

### Mobile Build Signal

- `mobile/app.config.js` wird wegen der Kameraberechtigungsbeschreibung
  geaendert.
- Deshalb lautet das Planner-Signal `Mobile Build Impact: Potential Native
  Impact`.
- Infrastructure entscheidet nach der Expo-Konfiguration, ob ein neuer Dev
  Build erforderlich ist. Der Plan behauptet nicht vorab, dass ein Build
  zwingend oder entbehrlich ist.

### Infrastructure Release Gate

**Agent:** Infrastructure

**Goal**

Deployment- und Build-Auswirkung pruefen, vorhandene Dev-Infrastruktur
wiederverwenden, die Backend-Aenderung nach dem Implementierungshandoff in
Dev bereitstellen und das finale `Dev Build Required: YES | NO` festhalten.

**Required Knowledge Base:**
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

**Required Repository Context:**
- infra/main.bicep
- infra/modules/cosmos.bicep
- infra/modules/functionapp.bicep
- infra/parameters/dev.bicepparam
- backend/package.json
- mobile/app.config.js
- mobile/eas.json

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-16
- AC-19
- AC-20

**Dependencies:**
- B-HR-4.
- F-HR-4.

**Expected Handoff:**
- Dev-Deployment-Status und Route-Verfuegbarkeit
- Aussage, ob Bicep unveraendert bleibt
- finale Entscheidung `Dev Build Required: YES | NO`
- bekannte umgebungsabhaengige Einschraenkungen fuer QA

## 17. Documentation Updates

Diese Dokumentationsaenderungen gehoeren in die nachgelagerte Umsetzung und
nicht in die aktuelle Planner-Aktion ausserhalb dieser Datei:

- `docs/kb/domain/06-recipes.md`: optionales `heroCrop`, pro-Bild-Semantik,
  Legacy-Default und kein zweiter Blob.
- `docs/kb/tech/09-api-reference.md`: Upload-Feld,
  `PUT /api/recipes/{id}/images/{imageId}/hero-crop`, Fehler und Auth.
- `docs/kb/tech/02-backend.md`: Adapter-Prioritaet, EXIF-Normalisierung und
  Renderer-Rahmen `1080 x 1015` innerhalb `1080 x 1350`.
- `docs/kb/tech/03-mobile.md`: Kamera-/Galeriequelle, Editor und moeglicher
  Build-Impact.
- `docs/kb/tech/08-testing.md` nur, falls der bestehende allgemeine Testvertrag
  um den neuen Cosmos-/EXIF-Testfall erweitert werden muss.
- Betroffene historische Texte werden nicht still als aktuelle API-Wahrheit
  weitergefuehrt. Die Repository-Implementierung ist fuer Ist-Verhalten
  massgeblich.

## 18. Test Strategy

### Shared

- Unit-Tests fuer gueltige und ungueltige Crop-Werte.
- Tests fuer den Legacy-Default und die Frame-/Version-Guardrails.
- Keine Tests fuer AI oder Nutrition, weil diese Pfade unberuehrt bleiben.

### Backend/API/Cosmos

- Handler-Tests fuer Upload mit gueltigem Crop, Upload ohne Crop und ungueltige
  Crop-JSON-Daten.
- Auth-/Ownership-Tests fuer Rezept, Bild und Crop-Update.
- Tests fuer unbekanntes `imageId`, ungueltigen Frame, Focus ausserhalb des
  Intervalls, `NaN`/`Infinity`, Zoom kleiner als `1` und zu grosse Dateien.
- Cosmos-Contract-Test mit neuem Dokument inklusive Crop.
- Cosmos-Contract-Test mit Legacy-Dokument ohne Crop und erwarteten Default.
- Reorder-, Delete- und Read-Tests, die Crop-Erhalt beziehungsweise Entfernung
  nachweisen.

### Renderer

- Adapter-Tests fuer gespeicherten Crop, Legacy-Default und partielle Request-
  Overrides.
- Output-Test auf exakt `1080 x 1350`.
- Focus-/Zoom-Tests mit Portrait- und Landscape-Quellen.
- EXIF-Fixtures fuer mindestens 0/1, 90, 180 und 270 Grad beziehungsweise die
  im verwendeten Bildtool relevanten Orientierungswerte.
- Regressionstest, dass die Breitenheuristik keine falsch gedrehten Bilder
  mehr erzeugt.
- Bestehende Golden-/Smoke-Tests bleiben gruen; visuelle Renderer-Aenderungen
  werden mit Diff-Ausgabe beurteilt und nicht durch ein groesseres Toleranz-
  fenster verborgen.

### Mobile

- Unit-Tests fuer Crop-Mathematik, Clamp, Zoom-Minimum und Normalisierung.
- Tests fuer Draft-Mapping, Legacy-Bootstrap, Upload-/Update-/Reorder-/Delete-
  Orchestrierung und Fehlerrollback.
- Komponenten-/Integrationstests fuer Quelleauswahl, Permission-Denied,
  Cancel, Wiedereroeffnen eines bestehenden Crops und Accessibility-Labels.
- Manuelle Geraetepruefung auf iOS und Android fuer Kamera-Overlay,
  Safe-Area-Insets, Pan, Pinch, Rotation, Galeriequelle und sichtbare
  Fehlermeldung bei zu grosser Datei.

### Build und Release

- Shared-, Backend- und Mobile-Typechecks nach den Paketregeln.
- Backend-Testlauf einschliesslich Renderer- und Cosmos-Contract-Suite.
- Backend-Build-Verifikation einschliesslich registrierter Routes.
- Dev-Endpunkt mit einem bestehenden privaten Rezept und mindestens einem
  Legacy-Bild sowie einem Bild mit Crop-Metadaten.
- QA dokumentiert, ob ein neuer Dev Build fuer `app.config.js` erforderlich
  ist.

## 19. Acceptance Criteria

1. Der Rezeptwizard bietet Kamera und Galerie als Quellen an. Bei verweigerter
   Kameraberechtigung bleiben Galerie und bestehender Wizard nutzbar; bei
   Abbruch wird kein leerer Draft angelegt.
2. Die Kamera zeigt einen responsiven Hero-Rahmen mit dem Verhaeltnis
   `1080:1015`; der Bereich ausserhalb ist sichtbar abgedunkelt. Der Rahmen
   springt nicht durch Safe-Area-Insets oder wechselnde Geraetebreiten.
3. Galerieauswahl verwendet keinen systemeigenen `4:3`-Zuschnitt. Kamera- und
   Galeriequelle durchlaufen denselben Crop-Editor.
4. Der Crop-Editor erlaubt Pan und Pinch, erzwingt vollstaendige Abdeckung des
   Rahmens und verhindert leeren Raum. Eine untere Safe-Area-Hilfe bildet die
   Renderer-Zone fuer Titel und Tags ab, ohne Bildbytes zu veraendern.
5. Der Editor speichert `version`, `frame`, `focusX`, `focusY` und `zoom`; die
   Werte sind endlich, normalisiert und fuer `zoom` gilt `zoom >= 1`.
6. Es wird genau ein vollstaendiger Bild-Blob gespeichert. Weder die Kamera-
   noch die Galerieaktion erzeugt eine raeumlich zugeschnittene Hero-Datei.
7. Ein neues Bild kann seinen Crop beim Upload mitsenden; ein bestehendes Bild
   kann seinen Crop ueber die authentifizierte Metadata-Route aktualisieren.
8. Upload und Crop-Update sind auf den JWT-Benutzer und das angegebene Rezept
   und Bild begrenzt. Fremde oder unbekannte IDs veraendern keine Daten.
9. Das Backend lehnt unbekannte Frame-/Versionwerte, beliebige Client-
   Abmessungen, unendliche Werte, Focus ausserhalb `[0,1]` und Zoom kleiner
   als `1` mit einem stabilen Clientfehler ab.
10. Ein Legacy-Cosmos-Dokument ohne `heroCrop` bleibt lesbar und verwendet
    deterministisch `focusX=0.5`, `focusY=0.46`, `zoom=1` sowie
    `frame='instagram-recipe-v1'`.
11. Delete und Reorder bewahren Crop-Metadaten fuer verbleibende Bilder und
    entfernen sie zusammen mit dem geloeschten Bild.
12. Der Instagram-Renderer verwendet den gespeicherten Crop als Default; ein
    partieller Request-Override ergaenzt nur die gelieferten Felder und
    ueberschreibt die gespeicherten Daten nicht.
13. Renderer und Adapter behandeln Portrait-, Landscape- und EXIF-rotierte
    Quellen visuell korrekt; die Bildorientierung wird nicht allein aus
    `width > height` abgeleitet.
14. Der Instagram-Output bleibt fuer alle gueltigen Faelle exakt ein
    `1080 x 1350` PNG. Die Renderer-Geometrie verwendet die Foto-/Hero-Flaeche
    `1080 x 1015`; `1080 x 880` wird nicht als Laufzeitvertrag verwendet.
15. Rezeptdetail, Wizard-Preview und vorhandene Rezeptbild-Thumbnails nutzen
    den effektiven Crop statt eines unabhaengigen, widerspruechlichen Fokus.
16. Ein Bild ueber 8 MB wird nicht teilweise gespeichert und nicht still
    zugeschnitten. Der Nutzer erhaelt einen stabilen, verstaendlichen Fehler;
    ein spaeteres Limit-Upgrade ist nicht Bestandteil dieser Umsetzung.
17. Die Berechtigungsbeschreibung in `mobile/app.config.js` nennt neben den
    bestehenden Kameraanwendungen auch Rezeptfotos. Infrastructure dokumentiert
    die daraus abgeleitete Build-Entscheidung.
18. Es werden keine neuen Azure-Container, Partitionen, Resource Groups oder
    KI-Endpunkte eingefuehrt. Es gibt keine Prompt-, Quota- oder AI-
    Klassifizierungs-Aenderung.
19. API-, Domain-, Backend- und Mobile-Dokumentation beschreibt nach der
    Umsetzung denselben Crop-Vertrag, Legacy-Default und Rahmenvertrag.
20. QA liefert eine vollstaendige Kriterienmatrix inklusive automatisierter
    Testbefunde, Cosmos-Legacy-Nachweis, EXIF-Nachweis, manueller Mobile-
    Pruefung und Dev-/Build-Status.

## 20. Risks and Edge Cases

- **Rahmenvertrag:** Eine spaetere Renderer-Geometrieaenderung darf nicht
  still die Bedeutung von `instagram-recipe-v1` aendern. Bei Layoutaenderung
  braucht es einen neuen Frame-Vertrag oder eine bewusste Migration.
- **Textueberdeckung:** Das Foto kann unter Titel oder Tags liegen. Die
  Safe-Area-Hilfe reduziert das Risiko, ersetzt aber keine vollstaendige
  Share-Preview.
- **Kamera-FOV:** Kamera-Preview und gespeichertes Foto koennen wegen Sensor-
  und Plattformverhalten leicht abweichen. Der Editor nach der Aufnahme ist
  deshalb verbindlich.
- **EXIF:** Ein Bild kann hochkant aussehen, obwohl rohe Metadaten Landscape-
  Dimensionen melden. Mobile und Backend muessen dieselbe orientierte
  Koordinatensemantik verwenden.
- **Legacy:** Alte Dokumente haben kein Feld; ein zufaelliger Default oder ein
  globaler Request-Default wuerde alte und neue Bilder unterschiedlich zeigen.
- **8 MB:** Hochaufloesende Kameraaufnahmen koennen die bestehende Grenze
  ueberschreiten. Der Fehler muss sichtbar und reproduzierbar sein; keine
  stille Datenveraenderung darf die Story scheinbar erfuellen.
- **Thumbnails:** Kleine `cover`-Darstellungen koennen trotz identischem
  Focus visuell anders wirken. Die zentrale Bilddarstellung muss feste
  Dimensionen und dieselbe effektive Presentation verwenden.
- **Concurrency:** Crop-Update, Delete und Reorder muessen user-scoped und
  gegen veraltete lokale Drafts robust sein. Ein fehlgeschlagenes Update darf
  keinen falschen lokalen Erfolg anzeigen.
- **Native Configuration:** Eine Aenderung an `app.config.js` kann einen neuen
  Dev Build erfordern, auch wenn keine neue npm-Dependency installiert wird.
- **Renderer-Grenzen:** Crop-Daten loesen keine bestehenden Titel-, Tag- oder
  Asset-Fehler. Diese bleiben Renderer-Fehler und duerfen nicht durch mobile
  Crop-Logik verdeckt werden.
- **Dokumentationskonflikt:** Historische Plaene koennen den aktuellen
  Endpoint-Stand falsch darstellen. Implementierung und aktuelle KB muessen
  vor einer Dokumentationsaenderung abgeglichen werden.

## 21. Recommended Execution Order

Die Orchestrierung erfolgt strikt sequenziell. PO-1 bis PO-3 sind als
verbindliche Eingangsgrundlage gesetzt. Kein Arbeitspaket startet, bevor das
vorherige seinen Handoff und die fokussierte Validierung abgeschlossen hat.

1. **B-HR-1:** Shared-Vertrag, Default und serverseitige Validierungsregeln
   festlegen und fokussiert testen.
2. **B-HR-2:** Cosmos-Serialisierung, Legacy-Read-Fallback, Upload-Erweiterung
   und Crop-Update-Route implementieren und per Handler-/Contract-Tests
   pruefen.
3. **B-HR-3:** Renderer-Adapter, Request-Precedence, EXIF-Normalisierung und
   Renderer-Regressionen implementieren und pruefen.
4. **F-HR-1:** Kamera-/Galeriequelle, Permission-States und responsives
   Overlay auf Basis des bestaetigten Shared-Vertrags umsetzen.
5. **F-HR-2:** Gemeinsamen Pan-/Pinch-Crop-Editor, Clamp und Safe-Area-Hilfe
   implementieren und mit Crop-Mathematiktests absichern.
6. **F-HR-3:** Wizard-Drafts, Edit-Bootstrap, Upload/Update, Preview, Detail
   und Thumbnails an den Backend-Vertrag anschliessen.
7. **B-HR-4:** Backend-, Domain- und API-Dokumentation an den implementierten
   Verhaltenstand angleichen.
8. **F-HR-4:** Mobile-Dokumentation und Permission-/Build-Hinweis angleichen.
9. **Infrastructure Release Gate:** Vorhandene Dev-Infrastruktur pruefen,
    Backend in Dev bereitstellen, Route verifizieren und
    `Dev Build Required: YES | NO` festhalten. Keine neue Ressource oder
    Resource Group anlegen.
10. **QA:** Vollstaendige automatisierte und manuelle Pruefung gegen AC-1 bis
    AC-20 einschliesslich Legacy-Cosmos, EXIF, 8-MB-Grenze, Renderer-Output,
    Accessibility und Dev-/Build-Status.
11. **Gezielte Nacharbeit:** Nur bei QA-Findings iteriert der jeweils
    verantwortliche Agent in seinem eigenen Slice. Danach wird die betroffene
    fokussierte QA-Pruefung erneut ausgefuehrt, bevor der Gesamtstatus geaendert
    wird.

## Abweichungen von der Original-Story - Kurzfassung

1. `1080 x 880` wird nicht als technischer Rahmen verwendet. Verbindlich ist
  `1080 x 1015`, weil dies die aktuelle Renderer-Fotoflaeche ist und die
  Title-/Tag-Komposition einschliesst.
2. Die Kamera ist nicht der einzige Eingang. Galerieauswahl bleibt erhalten,
   aber ohne systemeigenen `4:3`-Zuschnitt und mit demselben Crop-Editor.
3. Der Crop wird als versionierte Metadaten pro Bild gespeichert; es entsteht
   keine zweite Hero- oder Instagram-Datei.
4. Der gespeicherte Hero-Crop wird fuer den bestehenden Instagram-Renderer als
   Default wiederverwendet; ein unabhaengiger Instagram-Crop ist nicht Teil
   dieses Plans.
5. EXIF-Orientierung wird explizit behandelt. Das "Original" bleibt spatial
   vollstaendig, aber eine byte-identische Datei wird nicht als notwendiges
   Produktziel angenommen.
6. Die aktuelle 8-MB-Grenze wird nicht still umgangen. Zu grosse Bilder werden
   mit einem sichtbaren Fehler abgelehnt, statt unbemerkt beschnitten oder
   durch einen neuen Bildpfad verarbeitet zu werden.

## Fachliche Empfehlungen - Kurzfassung

- PO-1 bis PO-3 als bestaetigte Eingangsgrundlage fuer Kamera- und Renderer-
  Integration verwenden; eine erneute Produktfreigabe ist nicht erforderlich.
- Die Safe-Area-Hilfe fuer die untere Titel-/Tag-Zone im Crop-Editor beibehalten;
  sie verbessert die spaetere Instagram-Verwendbarkeit ohne neue Datei.
- Den Crop-Vertrag als `instagram-recipe-v1` versionieren, damit spaetere
  Renderer-Templates nicht still alte Metadaten umdeuten.
- Die 8-MB-Grenze nach ersten Dev-Geraetetests erneut messen. Eine Anhebung
  oder kontrollierte Kompression sollte als eigener, messbarer Folgeentscheid
  behandelt werden.
- Keine KI einplanen: Das Problem ist reine Bildgeometrie und wird durch
  deterministische UI-, Persistenz- und Renderer-Logik besser geloest.