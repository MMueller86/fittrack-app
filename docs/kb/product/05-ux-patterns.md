# UX Patterns

Recurring UX patterns used across the FitTrack app. Apply these consistently for new screens and features.

---

## Bottom Sheet Pattern

Library: `@gorhom/bottom-sheet` v5

### Standard Configuration

- Backdrop: `BottomSheetBackdrop` with `appearsOnIndex={0}` and `opacity={0.10}`
- Content scroll: `BottomSheetScrollView` for scrollable content
- Keyboard: do not use `keyboardBehavior` — use `ScrollView` + auto-scroll to focused element instead

### Snap Points

| Context | Snap Points | Notes |
|---|---|---|
| FoodEntryHub | `['85%']` | Default hub sheet height |
| FoodEntryHub direct subflow | `['100%']` | Used when a Home-screen direct subflow needs the visible sheet to occupy the full screen |
| Edit / action sheets | `['50%', '92%']` | Stacked over hub when needed |

### Stacking

Bottom sheets can be stacked (e.g., `QuantityView` previously used a `ProduktDialog` on top of the Hub). The preferred pattern is now to replace the Hub's content area inline rather than stacking a second modal.

---

## Information Overlays

Use the shared `InfoOverlay` for short, contextual explanations that do not require a decision or a list of actions.

An information overlay must:
- use a dark FitTrack backdrop and `surfaceElevated` for the panel
- use token-based typography (`h3` for the title, `body2` for the explanation)
- provide one clear dismissal action, `Schließen`
- keep longer content within a bounded scroll area while preserving intrinsic height for short content; the content `ScrollView` is the sole scroll owner, the panel respects the device safe area, and its footer places `Schließen` below the content with a small bottom-panel gap. Optional secondary links remain in the shared header, separately from the `Schließen` dismissal CTA; link, retry and dismissal actions use an effective 48pt touch target
- close when the user taps the backdrop or presses the platform back action
- preserve the current screen and use a quiet fade transition

[Rule] Standard Android alerts must never be used for FitTrack product UI. In particular, do not use `Alert.alert` for information, instructions, confirmations, or action choices. Use `InfoOverlay`, `ConfirmSheet`, or the appropriate bottom-sheet pattern instead.

## Recipe Scale Preview

The recipe detail view presents the saved `Portionen` and the temporary `Nachkochen für` value separately. The target uses a one-step `−`/`+` control within the shared `1–50` bounds. A separate information trigger opens an `InfoOverlay` with the title `Für wie viele kochst du?` and explains that ingredients and preparation are adapted temporarily while the original recipe remains unchanged.

Changing the target projects ingredients immediately and leaves them visible during the approximately 400 ms debounce and the AI request. The old description and steps are hidden in both states; the screen shows exactly: `Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.` A complete response replaces both text sections atomically. If the request fails, the projected ingredients remain, the original texts return, and a friendly German `InfoOverlay` explains the fallback. Returning to the saved portion count restores the original view without an AI request. Pending debounce timers and requests are invalidated on a new target, reset, reload, or unmount.

## Wizard Back Confirmation

Multi-phase flows use the shared `ConfirmSheet` for both the in-screen back action and the Android hardware back action. Returning from the initial input phase leaves the wizard immediately; back is blocked while an analysis is running. In later phases, the sheet explains that unsaved progress would be lost and offers one destructive `Zurück` action plus the standard dismissal. Both back entry points use the same phase transition, so the user receives identical navigation semantics.

## Sticky Wizard Actions

Wizard phases with a primary action keep the scrollable content and the action footer as sibling areas inside the keyboard-avoiding layout. The primary button is rendered only inside that footer, with no content-level bottom CTA or inherited top margin. On screens whose footer owns the bottom action area, the outer `SafeAreaView` uses the top edge only; applying a bottom edge there introduces a visible gap below the footer on devices with a bottom safe-area inset.

---

## Swipe-to-Remove

Use `SwipeableRow` when a removable row needs the same interaction language as an entry in the nutrition diary:

- Swipe left to reveal the destructive `Entfernen` action
- Keep the gesture one-sided unless the opposite direction has a distinct, useful action
- Trigger the existing undo snackbar after removal
- Do not use a second swipe direction only for visual symmetry or duplicate an action already available by tapping the row

---

## Edit Sheets

Lightweight bottom sheets for editing existing items without leaving the current screen.

Pattern:
- Slide up over current content
- Shows current values pre-filled
- "Speichern" (confirm) + close gesture (dismiss)
- No navigation — returns to same screen after save

Examples: `EditItemSheet.tsx`, `CopyItemSheet.tsx`, `MoveItemSheet.tsx`

---

## Search Result Rows

Standard food search result row (from `SearchState`):

```
[Thumbnail 52pt]  [Product Name — body1 bold]     [❤ toggle]
                  [Brand] [Badge] [⚠ optional]
                  [251 kcal · EW 8g · KH 43g · F 3g]
                  [je 100 g / pro Portion (X g)]
```

Rules:
- Thumbnail: 52pt square, letter-avatar fallback (first letter, `primarySoft` BG)
- Macro line hidden if all macros are null
- Portion line hidden for AI estimates (`isAiEstimate: true`)
- `React.memo` wrapper for performance
- `⚠` shown when `isComplete: false`

---

## Bottom Fallback Section

Used as `ListFooterComponent` in search results. Always visible regardless of result count.

```
0 results:   "Kein Treffer für '{query}' — Wir haben ein paar andere Ideen:"
≥1 results:  "Nicht das passende dabei?"
             [KI-Schätzung] · [Label Scan] · [Manuell erfassen]
```

This pattern replaces sticky action bars. Fallback actions are below content, not above it.

---

## Snackbar Pattern

Temporary feedback after a successful action.

Standard format:
```
"{Item} hinzugefügt"    [Rückgängig]  [Weiteres]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (5s progress bar)
```

Rules:
- Auto-dismiss: 5s
- Progress bar shows remaining time
- "Rückgängig" performs the inverse action (DELETE)
- "Weiteres" resets to search state with keyboard focused
- No "Fertig" button
- Undo disabled if item ID cannot be safely determined

---

## Context-Dependent Placeholders

Input fields and search fields use context-aware placeholder text.

Examples:
- Search field without context: `"Lebensmittel suchen…"`
- Search field with meal type: `"Für Frühstück suchen…"` / `"Für Mittagessen suchen…"`

This pattern applies to any field where the context (target meal, date, goal) is known.

---

## Review Screens (AI Confirmation)

All AI features use a dedicated review screen before saving.

Pattern:
- Full-screen or modal
- Shows AI output with editable fields
- Displays confidence and warnings prominently
- Explicit "Speichern" or "Hinzufügen" CTA
- Optional re-estimation trigger (e.g., "✨ Neu" button)
- Two save modes where applicable: "Als Produkt speichern" vs "Einmalig hinzufügen"

[Rule] Review screens must never be skipped, even if confidence is high.

## Rezept teilen: lokaler Share-Flow und Fotomediathek

`Teilen` wird nur für Rezepte mit einem gespeicherten Foto angeboten. Ohne Foto
starten weder die Exportvorbereitung noch ein Render. Meldet der Server dennoch
`NO_RECIPE_IMAGE`, etwa nach einer zwischenzeitlichen Löschung, schließt die App
die Share-Vorschau und zeigt `Rezeptfoto fehlt` mit
`Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.`. Ein
wirkungsloser Render-Retry wird nicht angeboten; auch der Teilen-Einstieg wird
ausgeblendet, bis wieder ein gespeichertes Foto geladen wird.

Der lokale Rezept-Share-Flow bleibt als flüchtiger Share-Draft in der
Rezeptdetailansicht. Ein Tap auf `Teilen` startet eine gegen Doppeltaps
abgesicherte Exportvorbereitung und öffnet danach die gemeinsame Vorschau mit
einem Inline-Editor; ein separates Options-Sheet entfällt. Weitere Teilen-Taps
starten keine parallelen Vorbereitungen. `Speichern & teilen` bleibt gesperrt,
bis ein vollständiges, validiertes Paar aus Instagram- und Rezeptdetails-PNG
vorliegt. Vor dem fertigen Bildpaar wird weder ein Foto angelegt noch das
native Share-Sheet geöffnet. Rezeptbilder, gespeicherte Crop-Metadaten und
Nutrition bleiben unverändert.

### Vorbereitung und Exportprüfung

Die Vorbereitung verwendet der Reihe nach ein vorhandenes bestätigtes
`exportView` (auch mit Status `stale`), einen lokal gehaltenen unbestätigten
Exportentwurf aus der Neuanalyse oder einer früheren V2-Vorbereitung, solange
`RecipeDetailScreen` gemountet bleibt, oder genau einen Aufruf von
`POST /api/recipes/{id}/export-view/prepare`, wenn beides fehlt. Ein stale View
triggert keine KI. Ohne Provider-Aufruf zeigt die App
`Exportvorschau wird vorbereitet.`; die KI-spezifische Meldung erscheint nur
während eines tatsächlichen Provider-Aufrufs:

> Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide Bilder checken und die Texte noch anpassen.

Sobald ein Exportentwurf vorliegt, startet der erste gepaarte Bundle-Render
ohne vorherige Textbestätigung und ohne das Rezept zu speichern; der Entwurf
wird nur als request-only `exportViewDraft` übergeben. Beide gerenderten
1080:1350-Bilder stehen gleichzeitig nebeneinander: Instagram und
Rezeptdetails. Während des Bild-Renderings zeigt die Vorschau einen eigenen
Spinner (`Vorschau wird erstellt…`, `Wird gerendert…` oder
`Wird aktualisiert…`), getrennt von der KI-Vorbereitungsmeldung. Sobald beide
Vorschauen bereit sind, erscheint darunter exakt der Hinweis:

> Check beide Bilder kurz durch. Die Texte kannst du jederzeit noch anpassen.

Der optionale top-level Request-Wert heißt exakt
`exportViewDraft` und verwendet den gemeinsamen Typ
`RecipeShareBundleExportDraft`. Ein im Editor angezeigter Entwurf wird nur als
Request-Daten für den jeweiligen Bundle-Render gesendet; ein transienter
Vorschau-Render erfordert weder eine Textbestätigung noch einen Rezept-Write.
Bei einer bereits
gespeicherten, bestätigten Exportansicht startet der Render direkt. Die
Zutatenauswahl erscheint nur bei mehr als 20 Rezeptzutaten; bei bis zu 20
Zutaten werden keine Schalter angezeigt. Fehlende KI-Zeit oder -Schwierigkeit
bleibt beim Render leer und wird als `null` übertragen. Neue oder geänderte
Exporttexte werden nur nach `Speichern` über das bestehende
`PUT /api/recipes/{id}`-Paar `exportViewAction: 'confirm'` plus `exportView`
persistiert; danach wird das Bildpaar frisch gerendert. Ein unveränderter
bestätigter View wird nicht erneut geschrieben. Exporttexte ersetzen nie die
normale Rezeptbeschreibung oder Zubereitungsschritte. Eine fehlgeschlagene
Vorbereitung bleibt unbestätigt und startet keinen Bundle-Render.

### Optionen aus der Rezeptdetailansicht

Ein Tap auf eines der gerenderten Vorschaubilder öffnet es bildschirmfüllend,
proportional und ohne Zuschnitt. Bei zwei Bildern kann der Nutzer horizontal
swipen oder die zugänglichen Vor-/Zurück-Pfeile nutzen; ein Zähler zeigt die
aktuelle Seite. Bei nur einem Bild entfallen Pfeile und Zähler. Schließen und
Android-Zurück führen zur gemeinsamen Vorschau zurück, ohne den Share-Flow zu
beenden. Die CTA `Optionen & Texte bearbeiten` in der Großansicht öffnet direkt
den bestehenden Editor; das Öffnen oder Blättern löst weder KI noch Render oder
Speichern aus.

Die einzige Aktion `Optionen & Texte bearbeiten` öffnet Tags, Highlight und
Exporttexte in einem einheitlichen Editor direkt in derselben Vorschau. Im
Abschnitt `Titelbild` liegen `Ausschnitt anpassen`, Zeit,
Schwierigkeit, Tags und Highlight; `Detailbild` enthält den Teaser, die
optionale Zutatenwahl und die Exportschritte:

- Die Tag-Auswahl verwendet ausschließlich bereits gespeicherte Rezept-Tags
    in ihrer gespeicherten Reihenfolge. Es gibt keine freie Tag-Eingabe und
    höchstens vier Tags können aktiv sein. Bei mehr als vier gespeicherten Tags
    sind zunächst die ersten vier ausgewählt; weitere Tags bleiben sichtbar und
    sind solange deaktiviert, bis ein aktiver Tag abgewählt wird. Der Zähler
    zeigt die aktive Auswahl im Verhältnis `n von 4`.
    - Hat das Rezept keine Tags, zeigt der Editor
    `Für dieses Rezept sind keine Tags hinterlegt.` und übergibt die gültige
    leere Auswahl `selectedTags: []`.
- `High-Protein-Symbol anzeigen` ist ein expliziter Toggle, standardmäßig
    ausgeschaltet und mit `Kein Highlight` beschriftet. Aktiviert wird nur die
    sichtbare Presentation-Option `nutritionHighlight: 'high-protein'`,
    deaktiviert `nutritionHighlight: null`. Daraus wird keine automatische
    High-Protein-Klassifikation und keine Nutrition-Regel abgeleitet.

    Teaser, Zeit, Schwierigkeit und Exportschritte bleiben lokal editierbar. Die
    Vorschau kann mit `Vorschau aktualisieren` erneut gerendert werden, ohne das
    Rezept zu schreiben. `Speichern` bestätigt neue oder geänderte Exportfelder
    über das bestehende `PUT /api/recipes/{id}`-Paar
    `exportViewAction: 'confirm'` plus `exportView`; ein unveränderter View mit
    Status `stale` sendet beim `Speichern` keinen PUT, und der Status allein
    erzwingt kein Speichern. Nach erfolgreicher Bestätigung wird das Bildpaar
    frisch gerendert. Nullable Zeit und Schwierigkeit müssen für dieses
    Speichern gültig ergänzt werden. Tag-, Highlight- und Crop-Änderungen
    bleiben präsentationsbezogen und lösen keinen Rezept-Write aus. Ein
    erfolgreich vorbereiteter, unbestätigter Exportentwurf bleibt im
    Detail-Screen gespeichert, solange dieser gemountet ist; beim Verlassen des
    Screens geht er verloren.

### Server-Bundle und Hero-Crop

Mobile ruft `POST /api/recipes/{id}/share-bundle` für den ersten und jeden
bewusst erneuerten Render auf; einen unveränderten bestätigten View schreibt
es vorher nicht erneut. Das optionale top-level Request-Feld heißt exakt
`exportViewDraft` und verwendet den gemeinsamen Typ `RecipeShareBundleExportDraft`.
Der Wert gilt nur für den jeweiligen Render: Er wird nicht persistiert, löst
keine KI aus, verbraucht kein Kontingent und ändert nicht die atomare Antwort
mit beiden PNGs. Ohne dieses Feld verwendet der Server die gespeicherte
Exportansicht mit Status `current` oder `stale`. Fehlen beide Quellen, liefert der Server
`MISSING_EXPORT_VIEW`; Share bereitet die Texte innerhalb des Flows erneut vor,
ohne zum Rezeptwizard zurückzunavigieren oder eine Retry-Schleife zu starten.
Der Request enthält die ausgewählte Bild-ID, gespeicherte Tags und den
expliziten Highlight-Wert, aber keine clientseitige Rezept-Metadatenkopie. Zeit
und Schwierigkeit für beide Renderer stammen aus dem request-only Entwurf oder
der bestätigten Exportansicht; kanonische Angaben und Zutatenwerte stammen
aus dem aktuellen Rezept.

Eine Antwort gilt nur als vollständiges Bundle, wenn sie für
dasselbe Rezept zwei PNGs mit `image/png`, passender Byte-Länge und exakt
`1080 x 1350` Pixeln enthält. Fehlende, ungültige oder inhaltlich identische
Bilder werden verworfen.

Mobile legt für Instagram und Rezeptdetails getrennte temporäre PNG-Dateien
und URIs an. Beide werden gemeinsam in den Share-Draft übernommen; ein
fehlgeschriebener zweiter URI, eine fehlende Datei oder zwei gleiche URIs
markieren den Entwurf nicht als bereit. Die Preview zeigt beide Bilder
gleichzeitig, nebeneinander, mit den Labels `Instagram` und `Rezeptdetails` und
je einem festen `1080:1350`-Format. Speichern und Teilen sind nur mit einem
aktuellen, vollständig validierten Paar und zwei verschiedenen lokalen URIs
freigegeben; es gibt keinen Einzelbild-Fallback.

Der Share-Draft ist screen-lokal und revisionsgeschützt. Eine neuere Anfrage
bricht die vorherige ab; verspätete Antworten werden ignoriert. Beim finalen
Crop-Render bleibt das letzte vollständige Paar sichtbar, bis beide neuen
Dateien erfolgreich erzeugt und gemeinsam übernommen wurden. Nach Fehlern
bleibt dieses Paar sichtbar, die CTA ist aber bis zu einem erfolgreichen
aktuellen Render gesperrt.

`Ausschnitt anpassen` öffnet den bestehenden
`RecipeImageHeroCropEditor` mit dem `1080 x 1015`-Hero-Frame. Pan und Pinch
bleiben lokal im Editor; während der Gesten gibt es keinen Live-Render. Ein
Tap auf `Übernehmen` löst genau einen finalen Bundle-Request mit der
vollständig normalisierten `presentation` sowie derselben Tag- und
Highlight-Auswahl aus. Der Crop bleibt ein transienter Share-Draft-Override
und wird nicht über `updateImageHeroCrop` gespeichert. `Abbrechen` verwirft
nur die lokale Crop-Änderung; das Schließen der Preview verwirft die
temporären Bildvorschauen, aber nicht den unbestätigten Exportvorschlag,
solange der Detail-Screen gemountet bleibt. Beim Verlassen des Screens geht
dieser Vorschlag verloren.

### Speichern, Teilen und Fehlerzustände

Render-, Berechtigungs- und Medienfehler bleiben im aktiven Share-Draft
wiederherstellbar. Die UI verwendet den deutschen,
app-eigenen `InfoOverlay` mit `Schließen` als primärer Dismiss-Aktion und einer
getrennten sekundären Aktion. Technische Fehler werden nicht als
Standard-Alert angezeigt.

- Eine fehlgeschlagene Exportvorbereitung bleibt unbestätigt und startet
    keinen Bundle-Render. Sie kann aus dem app-eigenen Share-Fehlerzustand
    explizit wiederholt werden; es gibt keinen automatischen Vorbereitungs-Retry.
- Ein fehlgeschlagener initialer oder finaler Bundle-Render bietet
    `Erneut versuchen` mit derselben Auswahl beziehungsweise demselben
    bestätigten Crop. Bei einem finalen Fehler bleibt das letzte vollständige
    Paar sichtbar, kann aber erst nach erfolgreichem Retry gespeichert werden.
- Ein defensives `MISSING_EXPORT_VIEW` startet die Vorprüfung innerhalb von
    Share erneut, höchstens einmal. Es gibt keine Rückkehr zum Rezeptwizard und
    keine automatische Retry-Schleife. Ein stale Fingerprint hat keinen
    eigenen Share-Fehlerpfad.
- Beim Speichern wird die erforderliche Lese-/Schreibberechtigung der
    Fotomediathek geprüft, weil das vorhandene Album `FitTrack` zuerst gelesen
    und beide Bilder anschließend gespeichert werden. `canAskAgain: true`
    bleibt über `Erneut versuchen` retrybar; `canAskAgain: false` verweist über
    `Geräteeinstellungen öffnen` auf die Geräteeinstellungen. Beide Vorschauen
    und die Auswahl bleiben erhalten.
- Erst nach `Speichern & teilen` werden die beiden lokalen Assets angelegt.
    Das Ziel ist bei jeder Speicherung das exakte Album `FitTrack`; ein
    fehlendes Album wird beim ersten erfolgreichen Vorgang angelegt und danach
    wiederverwendet. Fehler bei Asset-Erstellung, Albumzugriff oder
    Album-Zuordnung öffnen kein Share-Sheet. Neu angelegte Assets und ein dabei
    angelegtes leeres Album werden best effort zurückgerollt; vorhandene
    Albuminhalte bleiben unberührt. Das vollständige Paar bleibt für einen
    neuen Versuch erhalten.
- Die native Multi-Image-Kandidatinvokation erhält beide unterschiedlichen
    lokalen PNG-URIs in einem Aufruf. Ist Sharing nicht verfügbar oder wird der
    Aufruf abgebrochen, bleiben beide Bilder in `FitTrack` gespeichert und es
    wird kein Instagram-Erfolg behauptet. `Erneut teilen` verwendet dasselbe
    gespeicherte Paar, ohne weitere Assets anzulegen. Die tatsächliche
    Android-Gerätewirkung bleibt bis U-1 **UNVERIFIED**.

`FitTrack` bezeichnet dabei ein lokales Gerätealbum der nativen
Fotomediathek, nicht einen direkten Google-Photos-Upload. Ein aktiviertes
Google-Photos-Backup kann die lokalen Bilder anschließend selbst
synchronisieren, wird von FitTrack aber weder abgefragt noch als Erfolg
garantiert. Preview, Crop-Editor und Fehler-Overlays folgen der bestehenden
Dark-only-Oberfläche.

---

## Optimistic Updates

On delete operations (diary items, weight entries): remove from local state immediately, roll back on error.

Pattern used in `WeightDetailScreen` (optimistic delete on weight entries).

---

## Empty States

When a list is empty (before first use or after filtering):

- Clear visual indicator (icon + short message)
- Actionable suggestion (e.g., "Tippe um zu suchen", auto-focus keyboard)
- No generic "No items" text

---

## Error Handling

- Network/API errors: friendly German message, no technical details exposed to user
- Quota exceeded (429): show reset date in user-friendly format (e.g., "Morgen wieder verfügbar")
- Auth errors (401): silent refresh attempted first; logout only on repeated failure
- AI unavailable: graceful fallback (especially for daily insight — never shows an error card)

---

## Wochenrückblick

Der Wochenrückblick steht direkt nach der Tages-Nutrition-Karte auf dem Homescreen. Während des Requests wird eine kompakte Skeleton-Karte angezeigt; bei einem recoverable Netzwerkfehler bleibt die Tagesansicht intakt und die Karte bietet `Erneut versuchen`. Wenn ein vorhandener Wochenrückblick beim Refresh erhalten bleibt, zeigt die Karte zusätzlich dezent `Aktualisierung fehlgeschlagen` mit demselben Retry-Callback. Die Wochenkarte zeigt immer sieben flexible Tagescontainer ohne horizontales Scrollen. Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label und mit kleinem Abstand zur Kartenkante. Die beiden unteren Bilanzzeilen entfallen. Über jedem Balken stehen Prozentwert und Tagesverbrauch ohne wiederholte `kcal`-Einheit; die Accessibility-Beschreibung behält Verbrauch, Ziel und vollständige Einheiten. Textuelle Diagrammüberschriften und die sichtbare Tageszählung entfallen. Jeder Balken ist ein zugänglicher Trigger und öffnet zuerst ausschließlich das bestehende `InfoOverlay` mit Tagesdetails; nur `Tagebuch öffnen` darin navigiert für das ausgewählte date-only-Datum über `Nutrition -> DiaryMain({ date })`. Es gibt keine Navigation vom Balken selbst, keine Bearbeitung und keine FoodEntryHub-Aktion.

Der Header zeigt den Zeitraum, unter dem Diagramm bleibt nur der Wochentag als sichtbare Tageszuordnung; das einzelne Tagesdatum sowie Tagesziel-, Ziel- und Statuszeilen entfallen aus dem engen Raster. Training und besondere Aktivitäten erhalten kompakte Marker innerhalb ihrer Spalte; bei einer Kombination bleiben beide Marker sichtbar, ohne die Chartgeometrie zu verschieben. Sonderaktivitätsmarker werden lila dargestellt, während Trainingsmarker und Wochentagskürzel neutral bleiben. Das Overlay zeigt, sofern vorhanden, Wochentag sowie Verbrauch, Zielerreichung und effektives Ziel in der kompakten Kalorienvisualisierung; diese drei Werte erscheinen nicht zusätzlich im erklärenden Body. Bei besonderer Aktivität oder Training zeigt das Overlay nur die kompakten Label-/Wert-Gruppen `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel` und die vorhandene `Aktivität`; `Tagestyp`, `Workout-Typ` und `Datenstatus` entfallen sichtbar und accessibility-relevant. Fehlende Werte heißen `Nicht verfügbar`, gültige `0`-Werte bleiben sichtbar. Der Header-Link `Tagebuch öffnen` bleibt vom separaten `Schließen`-CTA getrennt und öffnet nur das Tagebuch des ausgewählten date-only-Datums; der Content-ScrollView bleibt der einzige Scroll-Owner, und der Footer setzt `Schließen` mit 48-dp-Touchhöhe tiefer unter den Content, aber mit kleinem Abstand zum Panelrand. Die inklusive Zielzone `95–105 %` ist grün, Werte außerhalb sind orange. Pro Tag gibt es einen Zielmarker; bei fehlendem historischem Ziel wird nur ein neutraler Marker-Slot ohne Zielzahl und ohne Prozentsatz gezeigt. Fehlende Ernährung, fehlendes Ziel und vollständig fehlende Daten werden als neutrale diagonale Schraffur ohne Höhen-Semantik dargestellt und weder als `0 kcal` noch als positive oder negative Bewertung behandelt. Ein vorhandener MealItem mit `0 kcal` bleibt dagegen ein gültiger solider `0 kcal`-Balken.

Die gerenderte Reihenfolge lautet `Balken -> Wochentag -> Markerbereich -> Markerlegende -> Farblegende`; wenn im Sieben-Tage-Zeitraum eine Sonderaktivität vorkommt, wird dazwischen genau ein deduplizierter Legendeneintrag `Sonderaktivität` gezeigt. Der Markerbereich besteht aus sieben stabilen Zellen unterhalb der Wochentagslabels und liegt nicht in `barTrack`. Bekannte Workout-Typen verwenden die gemeinsamen Kataloglabels und -icons `Gym`, `Bouldern / Klettern`, `Laufen`, `Radfahren` und `Sonstiges`; ein fehlender oder unbekannter Workout-Wert wird neutral als `Training` markiert. Ein Ruhetag ohne Sonderaktivität bleibt markerfrei. Sonderaktivitäten erhalten bei `cycling` den Marker `Radtour`, bei `hiking` den Marker `Wanderung` und bei unbekannten Werten den neutralen Marker `Sonderaktivität`. `cycling` als Training ist mit `Radfahren` und der Trainingsmarkerart von `Radtour` als Sonderaktivitätsmarker unterscheidbar; bei einer Kombination bleiben beide in der Reihenfolge Training, Sonderaktivität nebeneinander sichtbar. Nur das Sonderaktivitäts-Icon trägt den lila Akzent `colors.chart.specialActivityOutline`; Trainingsmarker, Wochentagskürzel, Balkenfüllungen und Nachbarspalten bleiben monochrom beziehungsweise neutral. Unter den Balken wird kein konkretes Datum gerendert. Die Marker sind dekorativ und keine eigenen TalkBack-Aktionsziele. Die vollständige Farblegende mit `Im Ziel`, `Nicht im Ziel` und `Keine Daten` bleibt erhalten, vertikal zentriert und wird über kontrollierten responsiven Umbruch an die verfügbare Breite angepasst.

Das Overlay zeigt, sofern vorhanden, die vorab geladenen absoluten Makros Protein, Kohlenhydrate und Fett ohne erfundene Zielwerte; fehlende Makros bleiben neutral. Unterhalb des Diagramms wird nur der zusammenhängende Text aus `evaluation.text` angezeigt. Die KI-Wochenbewertung wird mit identischer Typografie und realer Breite unbeschränkt, aber unsichtbar gemessen und ist initial auf höchstens zwei sichtbare Textzeilen begrenzt; nur bei tatsächlichem Überlauf erscheinen `Mehr anzeigen` und ein Chevron. Im geöffneten Zustand gibt es keine native Zeilenbegrenzung. Der Text lässt sich mit `Weniger anzeigen` wieder einklappen. Bei neuem Text, Review, verfügbarer Breite oder Font Scale wird der Expand-Zustand zurückgesetzt. Bei `null`, Quota- oder Providerfehlern erscheint ausschließlich ein neutraler Nicht-verfügbar-Hinweis, niemals eine deterministische Ersatzbewertung. Die PNG ist eine reine Layout- und Dichte-Referenz; ihre Beispielwerte und die fehlerhafte Farbgebung oberhalb von `105 %` sind nicht maßgeblich.

Das Tages-Overlay hält Kalorienvergleich und absolute Makrowerte als getrennte deutsche Accessibility-Ziele. Die Kalorienziel-Leiste verwendet das effektive Ziel oder den gelieferten Zielprozentsatz; fehlende Vergleichsdaten bleiben neutral, während `0 kcal` und `0 g` gültige Werte bleiben. Vorhandene Special-Activity- und Bonusdetails erscheinen in den vier kompakten Gruppen `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel` und `Sonderaktivität`; `Tagestyp`, `Workout-Typ` und `Datenstatus` werden vollständig entfernt. Der Kalorienvergleich bleibt in seiner Kachelvisualisierung verfügbar, auch wenn der erläuternde Body leer ist.

**Aktueller Implementierungsstand (2026-08-19):** Links im Header steht `Letzte 7 Tage`; rechts oben steht einzeilig `Zielerreichung: <Wert>`. Darunter folgt rechtsbündig nur `<Gegessen> / <Ziel> kcal` ohne sichtbares Ziel-Label. Die beiden unteren Bilanzzeilen entfallen. Über jedem Balken stehen Prozentwert und Tages-kcal ohne wiederholte `kcal`-Einheit; die Einheit bleibt im Header und in den Accessibility-Beschreibungen erhalten. Diese Regel ersetzt die frühere Beschreibung von zwei Bilanzzeilen unter dem Diagramm.

## Favorite Heart Toggle

- Shown on search result rows
- Immediate visual feedback (toggle state)
- Persisted via `POST /api/favorites` / `DELETE /api/favorites/{foodRef}`
- [Current] Fully functional — favorite management UI is a separate future story

---

## Section Labels

```ts
// overline typography
{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }
// color: colors.textMuted
```

Used above content sections. Example: "SCHNELLZUGRIFF", "KÜRZLICH HINZUGEFÜGT".
