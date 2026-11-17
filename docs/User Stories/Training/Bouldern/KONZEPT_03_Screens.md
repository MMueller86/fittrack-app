# Konzept Training / Bouldern: Screens

Stand: 16.11.2026  
Ergänzt: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md), Klickfolgen: [KONZEPT_02_Klickfolgen.md](KONZEPT_02_Klickfolgen.md)

Wireframes sind Strukturskizzen, keine pixelgenaue Gestaltung. Maße in dp, Farben ausschließlich über `colors.*`-Tokens. Alle Texte deutsch. Wiederverwendet werden Card DNA, `SwipeableRow`, Snackbar, `ConfirmSheet`, `InfoOverlay`, Bottom Sheet (`@gorhom/bottom-sheet`), Pill-Chips (`primarySoft`-Badge-Muster).

Allgemein: Haupt-Tabs haben `16 dp` horizontalen Außenabstand (Design System, Kartenbreite). Die Erfassung S3 blendet die Tab-Leiste aus, um Platz für große Ziele zu schaffen; der Zurück-Pfeil verlässt die Erfassung, die Session läuft weiter.

---

## Tab-Leiste (neu)

```
┌────────────────────────────────────────────┐
│  ⌂        🍴          🏋          📈      👤  │
│ Home   Ernährung   Training   Progress  Profil│
└────────────────────────────────────────────┘
```

`Rezepte` entfällt als Tab. Das Icon `TrainingIcon` ist neu (SVG im Stil von `TabIcons`).

### Ernährung mit Segment (Option A)

```
┌───────────────────────────────┐
│  [ Tagebuch ][ Rezepte ]      │  Segment, merkt sich die letzte Auswahl
│                               │
│  (DiaryScreen bzw. RecipeList │
│   unverändert darunter)       │
└───────────────────────────────┘
```

---

## S1 Training-Hub (Tab Training)

Zustand A: **keine Session läuft**

```
┌───────────────────────────────┐
│ Training                      │
│                               │
│ ┌───────────────────────────┐ │
│ │ 🧗 Bouldern               │ │
│ │ Boulderhalle Nord, Berlin │ │
│ │ ┌───────────────────────┐ │ │
│ │ │       Starten         │ │ │  Primär, 56 dp
│ │ └───────────────────────┘ │ │
│ │ Andere Halle              │ │  Link, 48 dp
│ └───────────────────────────┘ │
│                               │
│ OFFENE PROJEKTE            3 ›│  Zeile → S10
│ [Foto][Foto][Foto]            │  Vorschau-Thumbs
│                               │
│ LETZTE EINHEITEN              │
│ ┌───────────────────────────┐ │
│ │ Sa 14.11.  Nord  1:42 h   │ │
│ │ 9 Boulder · 24 Versuche   │ │  → S7
│ ├───────────────────────────┤ │
│ │ Di 10.11.  Süd   1:15 h   │ │
│ └───────────────────────────┘ │
│ Alle anzeigen ›               │  → S9
└───────────────────────────────┘
```

Zustand B: **Session läuft**: Die Startkarte wird zur Fortsetzen-Karte.

```
│ ┌───────────────────────────┐ │
│ │ ● Bouldern läuft   0:48 h │ │
│ │ Boulderhalle Nord         │ │
│ │ 6 Boulder · 14 Versuche   │ │
│ │ ┌───────────────────────┐ │ │
│ │ │  Training fortsetzen  │ │ │
│ │ └───────────────────────┘ │ │
│ └───────────────────────────┘ │
```

Zustand C: **leer** (noch nie trainiert): Startkarte bleibt, darunter `Noch keine Einheiten. Starte deine erste Session.` statt Listen. `OFFENE PROJEKTE` entfällt.  
Zustand D: **Fehler/Laden**: Skeleton bzw. `Erneut versuchen` wie in den bestehenden Screens.

Ohne letzte Halle steht auf der Karte `Halle wählen` statt des Hallennamens; `Starten` öffnet dann S2.

---

## S2 Halle wählen (Bottom Sheet oder Screen)

```
┌───────────────────────────────┐
│ ‹  Halle wählen               │
│ ┌───────────────────────────┐ │
│ │ 🔍 Meine Hallen filtern…  │ │
│ └───────────────────────────┘ │
│ ZULETZT GENUTZT               │
│ ○ Boulderhalle Nord, Berlin   │
│ ○ Boulderhalle Süd, Berlin    │
│ MEINE HALLEN                  │
│ ○ Climbing Base, Hamburg      │
│ ○ …                           │
│                               │
│ + Neue Halle anlegen          │  immer als Footer, nie sticky
└───────────────────────────────┘
```

Auswahl einer Halle startet nicht automatisch; bei laufender Auswahl aus dem Hub genügt der Tap auf die Halle und `Starten` bleibt der bestätigende Schritt. (Bei Tap aus `Andere Halle` wird die Halle gewählt und der Hub zeigt sie vorbelegt.)

Leere Liste: `Noch keine Hallen. Lege deine erste an.` + Button `Neue Halle anlegen`. Kein Filtertreffer: `Keine eigene Halle gefunden.`

---

## S2b Halle anlegen

```
┌───────────────────────────────┐
│ ‹  Neue Halle                 │
│ Name        [______________]  │
│ Ort (optional) [____________]  │
│ ⚠ Gibt es schon: „Boulderhalle │
│   Nord, Berlin“ → Diese verwenden│  nur bei gleicher eigener Halle
│                               │
│ Schwierigkeitsskala           │
│ [ Farben ][ Zahlen ]          │
│                               │
│ Farben (leicht → schwer)      │
│ ≡ ● Weiß    WE   ↑ ↓ ✕        │  Pfeile zum Sortieren (statt Drag), Name, Kürzel
│ ≡ ● Gelb    GE   ✕            │
│ ≡ ● Grün    GR   ✕            │
│ ≡ ● Blau    BL   ✕            │
│ + Farbe hinzufügen            │  → Palette-Auswahl
│                               │
│ Vorschau: [WE][GE][GR][BL]    │
│ ┌───────────────────────────┐ │
│ │ Speichern und starten     │ │  Sticky Footer
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

Zahlen: `Höchste Stufe [ − ] 10 [ + ]`, Vorschau `[1][2]…[10]`.  
Vorbelegung `Farben`: typische Reihenfolge als Vorlage, vollständig änderbar.  
Pflicht: Name, mindestens 2 Stufen (Ort optional). Die Halle ist nur für den Nutzer sichtbar; ein Hinweis zur Sichtbarkeit ist nicht nötig. Bei Bearbeitung: `Löschen` (rot, nur wenn die Halle nicht verwendet wird, mit `ConfirmSheet`).

---

## S3 Erfassung (Kernscreen)

Layout von oben nach unten. Die Liste scrollt, der Aktionsbereich ist fest unten.

```
┌───────────────────────────────┐
│ ‹  Nord · 0:48 h     [Beenden]│  Header, 56 dp
│ 6 Boulder · 14 Versuche · 4 ✓ │  Statuszeile (caption)
├───────────────────────────────┤
│ DIESE SESSION            ↑neu │
│ ● Gelb   Flash       1 Vers.  │  Zeile (SwipeableRow)
│ ● Gelb   Geschafft   3 Vers.  │
│ ● Rot    Offen ★     4 Vers.  │  ★ = Projekt
│ ● Blau   Geschafft   2 Vers.  │
│   …                           │
├───────────────────────────────┤  ── fester Aktionsbereich ──
│ Projekte (3)               ›  │  → S5, 48 dp
│ ┌───┐┌───┐┌───┐┌───┐┌───┐     │
│ │ WE││►GE││ GR││ BL││ RO│     │  Stufenchips, ≥56 dp, Farbe + Kürzel
│ └───┘└───┘└───┘└───┘└───┘     │
│ ┌───────────────────────────┐ │
│ │ Gelb          ★  📷  ⋯   │ │  Aktuelle Karte
│ │ Versuche                  │ │
│ │ [1][2][3][4][5]  [−] 1 [+]│ │  Zahlenchips + Stepper, ≥48 dp
│ │ ┌───────────┐┌───────────┐│ │
│ │ │   Offen   ││ Geschafft ││ │  je 56 dp+, Daumenzone
│ │ │           ││     ✓     ││ │
│ │ └───────────┘└───────────┘│ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

Standardablauf: erst klettern, dann eintragen. Stufe tippen, Zahlenchip für die Gesamtversuche, Ergebnis. Wer nach jedem Versuch zählt, tippt `+` ("noch ein Versuch") und am Ende `Geschafft` bzw. `Offen`; die angezeigte Zahl ist immer die Gesamtzahl inkl. des erfolgreichen Versuchs.

Elemente der aktuellen Karte:

| Element | Wirkung |
|---|---|
| `★` | Projekt-Merkmal ein/aus |
| `📷` | Kamera öffnen, Foto am Boulder speichern |
| `⋯` | Details-Sheet S4 |
| Zahlenchips `1` bis `5` | Versuchszahl direkt setzen (ein Tap). Der aktive Chip ist hervorgehoben. |
| `−` / `+` | Versuchszahl in Einzelschritten, mindestens 1. `+` deckt auch das Zählen nach jedem Versuch ab. Jenseits von 5 zeigt das Feld die Zahl. |
| `Offen` | Boulder nicht geschafft: speichern mit der angezeigten Versuchszahl, haptisches Feedback |
| `Geschafft ✓` | Erfolg speichern (Flash bei Versuchszahl 1, sonst Geschafft), Snackbar, nächster Boulder gleicher Stufe |

Zustände:

| Zustand | Darstellung |
|---|---|
| Keine Stufe gewählt (Sessionstart) | Karte zeigt `Wähle eine Stufe`, Buttons deaktiviert. Bei der letzten genutzten Stufe der Halle vorausgewählt (Annahme). |
| Stufe gewählt, noch keine Aktion | Karte zeigt Stufe und Versuchszahl 1, nichts gespeichert (kein Ghost-Eintrag). |
| Versuchszahl ≥ 3 | Zusätzlich Chip `Als Projekt merken` über den Buttons. |
| Nach `Geschafft` | Snackbar `Gelb · Flash  [Kein Flash] [Rückgängig]` (bei Versuchszahl ≥ 2 `Gelb · Geschafft · 5 Versuche  [Rückgängig]`) über der Aktionskarte; Karte springt auf neuen Boulder gleicher Stufe mit Versuchszahl 1. |
| Nach `Offen` | Snackbar `Rot · Offen · 5 Versuche  [Als Projekt merken] [Rückgängig]`. `Als Projekt merken` nur bei Versuchszahl ≥ 3. |
| Senden fehlgeschlagen | Zeile `Nicht gespeichert · Erneut senden` (Warnfarbe `colors.warning`). |
| Verbindung weg | Schmale Zeile unter dem Header `Keine Verbindung. Neue Einträge werden gesendet, sobald möglich.` Hinweis: Wird die App vorher beendet, gehen sie verloren. |
| Nachtragsmodus (S8) | Statt Timer `Nachtrag · 12.11.`, Button `Speichern` statt `Beenden`. |
| Viele Stufen (z. B. 1 bis 20) | Stufenchips umbrechen auf 2 bis 4 Zeilen (je 5 Chips pro Zeile bei 360 dp); die Zeilenhöhe bleibt ≥ 48 dp. Aktionskarte bleibt unverändert unten. Die Liste schrumpft zuerst. |

Entscheidung: Die Stufenleiste gehört **über** die Aktionskarte (näher am Daumen: Stufe wählen und sofort darunter `Geschafft`). Aktuelle Stufe ist hervorgehoben (`primarySoft` Hintergrund + `colors.primary` Rahmen, Pfeil `►`).

---

## S4 Details-Sheet (optional, nie blockierend)

Bottom Sheet `['50%','92%']`, öffnet über `⋯` oder durch Antippen einer Zeile.

```
┌───────────────────────────────┐
│ Gelb · Boulder                │
│ Versuche   [ − ]  3  [ + ]    │
│ Ergebnis   (Offen)(Geschafft)(Flash) │  Flash deaktiviert wenn nicht möglich
│ Fortschritt (nur bei Offen)   │
│  ( Einstieg geschafft )       │
│  ( Etwa zur Hälfte geschafft )│
│  ( Kurz vor dem Top )         │
│  ( Top nicht kontrolliert )   │
│ Zone      [ Überhang links ]  │
│ Kommentar [________________]  │
│ Foto      [📷 Foto aufnehmen] │  oder Thumbnail + Ersetzen
│ ★ Als Projekt merken     ◯    │
│ ┌───────────────────────────┐ │
│ │ Speichern                 │ │
│ └───────────────────────────┘ │
│ Eintrag löschen               │  rot, → ConfirmSheet
└───────────────────────────────┘
```

Regeln: Statuschips sind einzeln wählbar und wieder abwählbar. Bei Ergebnis `Geschafft` oder `Flash` ist der Block `Fortschritt` ausgeblendet. Validierung gemäß Produktkonzept 5.3.

---

## S5 Projekte-Sheet

```
┌───────────────────────────────┐
│ Offene Projekte · Nord        │
│ ┌───────────────────────────┐ │
│ │[Foto] ● Rot · Überhang li.│ │
│ │       7 Vers. · 2 Sessions│ │
│ │       Kurz vor dem Top    │ │
│ ├───────────────────────────┤ │
│ │[Foto] ● Blau · Dach       │ │
│ │       3 Vers. · 1 Session │ │
│ └───────────────────────────┘ │
│ Leer: „Keine offenen          │
│ Projekte in dieser Halle.“    │
└───────────────────────────────┘
```

Tap auf Projekt: Sheet schließt, die aktuelle Karte zeigt Stufe, Zone und die Info `Bisher 7 Versuche · Kurz vor dem Top`. Aktionen laufen sofort. Sortierung: zuletzt bearbeitet zuerst.

---

## S6 Beenden-Sheet

```
┌───────────────────────────────┐
│ Session beenden?              │
│ 1:42 h · 9 Boulder · 24 Vers. │
│ 6 geschafft · 2 Flash         │
│                               │
│ ☑ Heute als Trainingstag      │  vorbelegt, abwählbar
│   (Bouldern) eintragen        │
│   Es gilt dein Trainings-     │
│   tag-Ziel.                   │
│ ┌───────────────────────────┐ │
│ │ Session beenden           │ │
│ └───────────────────────────┘ │
│ Weiter trainieren             │
└───────────────────────────────┘
```

Zustandsabhängiger Bereich im Sheet (Regeln: Produktkonzept 5.7):

```
Kein Tagestyp
 oder ausdrücklich Ruhetag: ☑ Heute als Trainingstag (Bouldern) eintragen   (vorbelegt)
Trainingstag Bouldern:   (nichts)
Trainingstag, z. B. Gym: Welches Training gilt für heute?
                         (● Gym)  (○ Bouldern)                         (vorbelegt: bestehend)
```

Ohne Einträge: `Session verwerfen` statt `Session beenden`. Das Sheet nutzt das `ConfirmSheet`-Muster; die Auswahl ist eine Einzelauswahl mit mindestens 48 dp je Option.

---

## S7 Zusammenfassung

```
┌───────────────────────────────┐
│ ‹  Sa 14.11. · Nord           │
│ 17:02–18:44 · 1:42 h  ✎       │  ✎ Zeiten/Datum korrigieren
│ ┌───────────────────────────┐ │
│ │ 9 Boulder   24 Versuche   │ │
│ │ 6 Geschafft  2 Flash      │ │  Flash zusätzlich, nicht doppelt
│ │ Schwerste: Blau           │ │
│ └───────────────────────────┘ │
│ VERTEILUNG NACH STUFE         │
│ ● Gelb   ▇▇▇▇▇▇ 4 (3 ✓)      │
│ ● Grün   ▇▇▇ 3 (2 ✓)         │
│ ● Blau   ▇▇ 2 (1 ✓)          │
│ EINTRÄGE                      │
│ (Liste wie S3, antippbar)     │
│ Session löschen               │  rot, ConfirmSheet
└───────────────────────────────┘
```

---

## S8 Session nachtragen

```
┌───────────────────────────────┐
│ ‹  Session nachtragen         │
│ Datum    [ Gestern 15.11. ▾ ] │
│ Halle    [ Nord, Berlin   ▾ ] │
│ Beginn   [ – ]  Ende [ – ]    │  optional
│ ┌───────────────────────────┐ │
│ │ Weiter                    │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

Zukunftsdaten sind nicht wählbar. Datum nutzt den bestehenden Datepicker aus dem Progress-Kalender (Kalender-Sheet).

---

## S9 Verlauf

```
┌───────────────────────────────┐
│ ‹  Verlauf        [+ Nachtrag]│
│ NOVEMBER 2026                 │
│ ┌───────────────────────────┐ │
│ │ Sa 14.11. · Nord · 1:42 h │ │
│ │ 9 Boulder · 24 Versuche   │ │
│ └───────────────────────────┘ │
│ …                             │
│ Leer: „Noch keine Einheiten.“ │
└───────────────────────────────┘
```

Tippen öffnet S7. Wischen nach links löscht nicht (Löschen nur im Detail mit `ConfirmSheet`, da eine ganze Session mehr Daten enthält als ein Eintrag).

---

## S10 Offene Projekte (alle Hallen)

```
┌───────────────────────────────┐
│ ‹  Projekte                   │
│ [ Offen ][ Geschafft ][ Archiv ] │
│ NORD                          │
│ [Foto] Rot · Überhang li. …   │
│ SÜD                           │
│ [Foto] Blau · …               │
└───────────────────────────────┘
```

Tap öffnet S11.

## S11 Projekt-Detail

```
┌───────────────────────────────┐
│ ‹  Rot · Überhang links       │
│ [        Foto groß          ] │
│ 7 Versuche · 2 Sessions       │
│ Kurz vor dem Top              │
│ VERLAUF                       │
│ 14.11.  4 Vers.  Offen        │
│        „Linke Hand zu früh“   │
│ 07.11.  3 Vers.  Offen        │
│ Archivieren                   │  ConfirmSheet
│ Projektmerkmal entfernen      │  Regeln siehe 5.4
└───────────────────────────────┘
```

Archivierte und geschaffte Projekte sind lesbar, nicht fortsetzbar. Aus S11 gibt es keinen Direktstart; fortgesetzt wird in der Erfassung (S5).

---

## Neue Design-Bausteine (zu klären mit dem Design System)

| Baustein | Bemerkung |
|---|---|
| Boulder-Farbpalette | Neue Tokens (`colors.boulder.*`), je Farbe Name + Kürzel; Kontrast zu `surface` prüfen. |
| `GradeChip` | Farbe + Kürzel, Zustände: normal, gewählt, deaktiviert (Stufe deaktiviert). |
| `SegmentedControl` | Für Ernährung (`Tagebuch`/`Rezepte`) und S10. Prüfen, ob es bereits eine wiederverwendbare Komponente gibt. |
| `TrainingIcon` | Neues Tab-Icon. |
| Kamera/Foto-Auswahl | Neuer Bedienpfad, nutzt eine neue Berechtigung (Planung). |
| Active-Session-Karte | Wird auf Home (kompakt) und im Hub (groß) verwendet. |

---

## Home: Karte "Bouldern läuft"

```
┌───────────────────────────────┐
│ ● Bouldern läuft · 0:48 h     │
│ Nord · 6 Boulder              │
│            Training fortsetzen ›│
└───────────────────────────────┘
```

Erscheint nur bei laufender Session, gesamte Karte antippbar → S3. Ohne laufende Session erscheint eine kompakte Karte `Bouldern starten · <Halle>` mit Button `Starten` nur, wenn für heute der Tagestyp Trainingstag mit Workout-Typ Bouldern gesetzt ist und heute noch keine Boulder-Session existiert (PO-C); nur der Button startet. Ohne zuletzt genutzte Halle heißt der Button `Halle wählen`.
