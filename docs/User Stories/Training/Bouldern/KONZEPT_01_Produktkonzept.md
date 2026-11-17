# Konzept Training / Bouldern: Produktkonzept

Stand: 16.11.2026  
Status: Fachliches Konzept zur Prüfung, noch keine User Stories, keine Technik  
Grundlage: [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md)  
Begleitdateien: [KONZEPT_02_Klickfolgen.md](KONZEPT_02_Klickfolgen.md), [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md)

Infrastructure Impact: None (Konzeptphase)  
Mobile Build Impact: None (Konzeptphase)

---

## 1. Entscheidungen des Product Owners (16.11.2026)

| ID | Entscheidung |
|---|---|
| PO-1 | Kein sechster Tab. Es wird ein belastbares Navigationskonzept mit 5 Tabs gefordert (Abschnitt 3). |
| PO-2 | Keine Offline-Funktion in dieser Version. Kommt später. |
| PO-3 | Beim Beenden erscheint der vorbelegte Chip "Heute als Trainingstag eintragen". Keine zusätzlichen kcal. |
| PO-4 | Erfolg im ersten erfassten Versuch ist automatisch "Flash", nachträglich korrigierbar. |
| PO-5 | Dauer = Start und Ende, ohne Pausen, ohne Kalorienwirkung. |
| PO-6 | Nachträgliche Session ist Teil des Umfangs. |
| PO-7 | Skalen: nur Farben und Zahlen. |
| PO-8 | Fortschrittsstatus heißt "Top nicht kontrolliert" (ersetzt "Top erreicht, nicht gehalten"). |
| PO-9 | Foto am Boulder ist Teil des Umfangs. |
| PO-10 | **Geändert 16.11.2026:** Hallen sind persönlich. Jeder Nutzer legt seine Hallen nur für sich an. Ein gemeinsamer Hallenkatalog ist eine mögliche spätere Erweiterung (`[Planned]`). Der Beschluss vom selben Tag ("Hallen allgemein bereitstellen") ist damit ersetzt. |

---

## 2. Gestaltungsprinzipien (verbindlich für alle Screens)

Leitkriterium: **Beim Sport steht der Sport im Vordergrund. Das Handy darf nur kurz stören.**

1. **Klickbudget.** Jede Häufig-Aktion hat ein festes Ziel (Abschnitt 4). Eine Story gilt nur als erfüllt, wenn das Budget eingehalten ist.
2. **Keine Pflichtangaben während der Session.** Fortschrittsstatus, Kommentar, Foto, Zone und Projekt sind immer optional und nie blockierend.
3. **Keine Tastatur während der Session** für den Normalfall. Text nur in Detail-Sheets.
4. **Daumenzone.** Alle Haupt-Aktionen liegen im unteren Drittel. Die Liste der bisherigen Boulder liegt darüber.
5. **Große Ziele.** Primäre Aktionen mindestens 56 dp hoch, sonstige Ziele mindestens 48 dp. Mit Magnesia an den Händen muss ungenaues Tippen funktionieren.
6. **Rückgängig statt Bestätigen.** Jede Erfassungsaktion zeigt den Snackbar mit `Rückgängig` (bestehendes Muster, KB `05-ux-patterns`). Keine Bestätigungsdialoge in der Erfassung. Einzige Ausnahme: Session beenden.
7. **Kein Ghost-Eintrag.** Ein Boulder entsteht erst durch ein Ergebnis (`Geschafft` oder `Offen`) oder durch eine geänderte Versuchszahl. Ein bloßes Antippen einer Stufe speichert nichts.
8. **Versuche: erst klettern, dann eintragen (Standard).** Nutzer probieren einen Boulder meist mehrfach und tragen danach das Ergebnis mit der Gesamtzahl der Versuche ein. Das ist der Hauptweg: Stufe, Versuchszahl (ein Tap auf einen Zahlenchip), Ergebnis. Das Zählen nach jedem Versuch (`+`) bleibt als gleichwertiger zweiter Weg erhalten; beide Wege führen zum selben Zustand.
9. **Farbe nie allein.** Farbstufen zeigen zusätzlich Kürzel oder Name (Farbenblindheit, Sonnenlicht, Hallenlicht).
10. **Bildschirm bleibt während der Session an.** Haptisches Feedback bei jeder gespeicherten Aktion.
11. **Bestehendes Design.** Dark Theme, Card DNA, `colors.*`/`typography.*`/`spacing.*`-Tokens, `ConfirmSheet`, `InfoOverlay`, Snackbar, `SwipeableRow`, Bottom Sheets (`@gorhom/bottom-sheet`). Kein `Alert.alert`.

---

## 3. Navigation: 5 Tabs

### Befund

Heute: Home, Ernährung, Rezepte, Progress, Profil. Fünf Tabs sind das Maximum. Ein sechster Tab ist ausgeschlossen (PO-1).

### Optionen

| Option | Beschreibung | Bewertung |
|---|---|---|
| **A (empfohlen)** | Tab **Training** ersetzt den Tab **Rezepte**. Rezepte wandern in den Tab **Ernährung** als Segment `Tagebuch` / `Rezepte`. | Fachlich stimmig: Rezepte sind Ernährung, Training ist ein eigener Bereich. Rezepte bleiben außerdem über den FoodEntryHub erreichbar. Kosten: Rezepte brauchen einen Tap mehr (Tab, Segment). Das Segment merkt sich die letzte Auswahl. |
| B | Tab **Progress** wird zu **Training** (mit Segment `Gewicht` / `Training`). | Gewicht ist ein Kernthema und verliert seinen Tab. Das Training-Starten wäre in einem Gewichtsbereich versteckt. Verworfen. |
| C | Training nur über Home-Karte, kein Tab. | Widerspricht dem Epic (Hauptbereich) und ist für Verlauf und Projekte nicht auffindbar. Verworfen. |

### Konsequenzen von Option A

- Betrifft eine dokumentierte Navigationsentscheidung ([`02-navigation.md`](../../../kb/product/02-navigation.md)). Das ist die **offene Bestätigung PO-A** (Abschnitt 9).
- Im Repository gibt es außer dem Tab selbst keine Querverweise auf die Route `Recipes` (geprüft per Suche in `mobile/src`). Die technische Umsetzung ist damit voraussichtlich überschaubar; die Details gehören in die Technikplanung.
- Das Tab-Icon für Training und das Segment-Layout in Ernährung sind neue UI-Elemente (Screens in [KONZEPT_03](KONZEPT_03_Screens.md)).

### Zielstruktur

```
Tabs:  Home | Ernährung | Training | Progress | Profil
                │            │          │
   Segment:  Tagebuch    Start-/Hub    Gewicht
             Rezepte     Verlauf       [Planned] Segment "Training"
                         Boulderbereich
```

`Progress` ist die natürliche spätere Heimat der Trainings-Fortschrittsauswertung (Epic Abschnitt 7). Das ist `[Planned]` und nicht Teil dieser Version.

---

## 4. Klickbudget

Gezählt werden Taps ab App im Vordergrund, ohne Tastatur. "Start" = Tab Training geöffnet.

| Aktion | Budget | Ablauf |
|---|---|---|
| Session starten (bekannte Halle) | **2 Taps** | Tab `Training`, `Starten` |
| Boulder sofort geschafft (Flash) | **2 Taps** | Stufe, `Geschafft` |
| Geschafft nach 5 Versuchen (Standardfall) | **3 Taps** | Stufe, Zahlenchip `5`, `Geschafft` |
| Nach 5 Versuchen nicht geschafft | **3 Taps** | Stufe, Zahlenchip `5`, `Offen` |
| Geschafft nach 3 Versuchen, gezählt nach jedem Versuch | **4 Taps** | Stufe, `+`, `+`, `Geschafft` |
| Weiterer Boulder gleicher Stufe | **1 bis 2 Taps** | Stufe bleibt gewählt, dann `Geschafft`, `Offen` oder Zahlenchip + Ergebnis |
| Projekt fortsetzen | **3 bis 4 Taps** | `Projekte`, Projekt, (Zahlenchip), Ergebnis |
| Boulder als Projekt merken | **+1 Tap** | Stern auf der aktuellen Karte |
| Foto hinzufügen | **+2 Taps** | Kamera-Icon, Auslöser |
| Eintrag korrigieren | **2 Taps** | Zeile antippen, Wert ändern |
| Eintrag löschen | **1 Geste** + Rückgängig | Wischen nach links |
| Session beenden | **2 Taps** | `Beenden`, `Session beenden` |
| Erste Session in neuer Halle (Halle vorhanden im Katalog) | **4 bis 5 Taps** | Tab, `Starten`, Halle suchen, Halle wählen, `Starten` |

Ein Boulder, der geschafft ist und dessen Stufe unverändert bleibt, startet beim nächsten Tap (Zahlenchip, `Geschafft` oder `Offen`) automatisch einen **neuen** Boulder derselben Stufe mit Versuchszahl 1. Das ist der häufigste Fall in der Halle und spart den Stufen-Tap.

---

## 5. Fachliche Regeln

### 5.1 Session

- Eine Session hat: Datum, Halle, Startzeit, Endzeit (leer solange laufend), Einträge.
- Pro Nutzer läuft höchstens **eine** Session. `Starten` ist bei laufender Session nicht möglich; stattdessen steht dort `Training fortsetzen`.
- Dauer = Endzeit minus Startzeit. Pausen gibt es nicht (PO-5). Start und Ende sind nachträglich korrigierbar.
- Die Halle einer Session ist nach dem ersten Eintrag **gesperrt**, da Stufen halleneigen sind. Datum und Zeiten bleiben änderbar.
- Eine vergessene Session wird erkannt, sobald seit der letzten Aktivität **2 Stunden** vergangen sind (PO-E, entschieden). Der Hinweis erscheint beim nächsten App-Öffnen oder Zurückkehren in den Vordergrund: `Noch laufende Session · Beenden um <Zeit der letzten Aktivität>?` mit `Beenden`, `Fortsetzen`, `Verwerfen`. Als Aktivität zählt jede gespeicherte Eintragsaktion. Eine Push-Benachrichtigung gibt es nicht.
- Laufende Sessions leben auf dem Server. Wird die App geschlossen und wieder geöffnet, wird die Session über die Home-Karte oder den Training-Tab wiederhergestellt (PO-2: ohne Offline-Zwischenspeicher).

### 5.2 Eintrag (Boulder)

| Feld | Regel |
|---|---|
| Stufe | Aus der Skala der Halle, Pflicht. |
| Versuche | Gesamtzahl der Versuche an diesem Boulder in dieser Session, **inklusive** des erfolgreichen Versuchs. Mindestens 1, Startwert 1. Eingabe per Zahlenchip (1 bis 5), Stepper `−`/`+` oder `+` nach jedem Versuch. `Geschafft` bzw. `Offen` speichert den Eintrag mit der angezeigten Zahl. |
| Ergebnis | `Offen`, `Geschafft`, `Flash`. |
| Fortschrittsstatus | Optional, 4 Werte: `Einstieg geschafft`, `Etwa zur Hälfte geschafft`, `Kurz vor dem Top`, `Top nicht kontrolliert`. Nur bei Ergebnis `Offen` sinnvoll; bei Erfolg wird er ausgeblendet. |
| Kommentar | Optional, Freitext. Unabhängig vom Status. |
| Zone/Bezeichnung | Optional, Kurztext (z. B. "Überhang links"). |
| Foto | Optional, ein Foto. Für Projekte vorgesehen, bei jedem Eintrag möglich. |
| Projekt | Optionales Merkmal, unabhängig von Status und Kommentar. |

### 5.3 Ergebnislogik

| Situation | Ergebnis |
|---|---|
| `Geschafft` bei Versuchszahl 1, kein Projekt mit Vorversuchen | **Flash** (automatisch, PO-4) |
| `Geschafft` bei Versuchszahl 2 oder mehr | `Geschafft` |
| `Geschafft` bei Projekt mit früheren Versuchen aus anderen Sessions | `Geschafft`, nie Flash |
| Snackbar nach Flash | `Flash · Kein Flash · Rückgängig`. `Kein Flash` setzt `Geschafft` bei 1 Versuch (frühere Besuche sind der App unbekannt). |
| `Offen` getippt | `Offen` mit der angezeigten Versuchszahl |
| Andere Stufe getippt, während der Boulder eine geänderte Versuchszahl (≥ 2) hat, aber kein Ergebnis | Boulder wird automatisch `Offen` gespeichert (Snackbar mit `Rückgängig`) |
| Andere Stufe getippt bei unveränderter Versuchszahl 1 ohne Ergebnis | Nichts wird gespeichert (der Nutzer tippt bei einem Fehlversuch `Offen`) |

Konsistenzregeln bei Korrektur (Detail-Sheet):

- `Flash` ist nur bei genau 1 Versuch und ohne frühere Projektversuche wählbar. Sonst ist die Option deaktiviert.
- Wird die Versuchszahl bei einem Flash auf mehr als 1 erhöht, wird das Ergebnis automatisch `Geschafft` (mit Hinweis).
- Wird `Offen` auf `Geschafft` geändert, ist die Versuchszahl mindestens 1.
- Ein Erfolg kann zurück auf `Offen` gesetzt werden; dann bleibt die Versuchszahl unverändert (sie enthält den Erfolgsversuch), mindestens 1.

### 5.4 Projekte

- Ein Projekt gehört zu **Halle + Stufe** und hat eine Gesamtversuchszahl, Fortschrittsstatus und Kommentare je Session.
- Fortsetzen erzeugt einen neuen Session-Eintrag, der dem bestehenden Projekt zugeordnet ist. Es entsteht nie ein zweites Projekt.
- Projekt-Zustände: `Offen`, `Geschafft` (verschwindet automatisch aus "Offene Projekte"), `Archiviert` (Boulder abgeschraubt oder aufgegeben).
- Projekt-Vorschlag: Wird ein Boulder mit **3 oder mehr Versuchen** als `Offen` gespeichert, bietet der Snackbar `Als Projekt merken` an. Dieselbe Aktion erscheint auf der Karte, sobald die Versuchszahl 3 oder höher ist. Die Schwelle 3 ist eine Annahme (Heuristik). Der Stern ist immer verfügbar.
- **Projektmerkmal entfernen** (Vorschlag):
  - Gibt es nur Einträge der aktuellen Session, wird der Eintrag wieder normal und das Projekt gelöscht.
  - Gibt es Einträge aus früheren Sessions, wird stattdessen `Archivieren` angeboten. Die Historie bleibt unverändert.
- **Erfolgreichen Projekt-Eintrag löschen oder korrigieren:** Das Projekt wird wieder `Offen`. Gesamtversuche und Flash/Geschafft-Logik werden aus den verbleibenden Einträgen neu berechnet.
- **Foto:** gehört zum Projekt. Das jüngste Foto ist das Titelbild. Fotos sind **privat** (nur der Nutzer sieht sie).

### 5.5 Hallen und Skalen (persönlich, PO-10)

Hallen sind persönlich: Jeder Nutzer legt seine Hallen für sich an, andere Nutzer sehen sie nicht. Das gilt auch für Nutzer, die oft an wechselnden Orten trainieren. Ein gemeinsamer Hallenkatalog ist `[Planned]` und nicht Teil dieser Version.

- **Halle:** Name, optionaler Ort, Skalentyp, geordnete Stufenliste. Gleicher Name plus Ort unter den eigenen Hallen gilt als Doppelung.
- **Skalentypen:**
  - `Farben`: freie Farbstufen aus einer festen, benannten Farbpalette, Reihenfolge leicht nach schwer, optional eigene Beschriftung je Stufe.
  - `Zahlen`: Stufen 1 bis Obergrenze (maximal 20).
- **Historische Verständlichkeit:** Jeder Eintrag speichert Stufenname, Farbe und Rang als Momentaufnahme. Eine spätere Änderung der Hallenskala verändert alte Einträge nicht.
- **Skala ändern:** Stufen dürfen umbenannt, umgefärbt, ergänzt oder umsortiert werden. Benutzte Stufen werden nur **deaktiviert**, nie gelöscht.
- **Halle löschen:** Nur solange keine Session und kein Projekt sie verwendet.
- **Hallenauswahl-Reihenfolge:** `Zuletzt genutzt`, dann alle eigenen Hallen alphabetisch. Es wird **kein Standort** abgefragt (keine neue Berechtigung, Datenschutz).

### 5.6 Nachträgliche Session (PO-6)

- Einstieg: Verlauf, `Session nachtragen`.
- Eingabe: Datum (Standard gestern), Halle, optional Start/Ende (Standard: leer = Dauer unbekannt).
- Danach dieselbe Erfassungsoberfläche wie live, ohne laufenden Timer, mit sichtbarem Hinweis `Nachtrag · <Datum>`. `Speichern` statt `Beenden`.
- Der Chip `Heute als Trainingstag eintragen` heißt dort `<Datum> als Trainingstag eintragen`.

### 5.7 Verbindung zu Kalorien und Aktivität

- Befund: Das Tagesmodell kennt bereits `dayType: 'training'` mit Workout-Typ `bouldering`. Das Trainingstag-Kalorienziel des Profils enthält Training bereits.
- Entscheidung PO-3: Eine Session löst **keine zusätzlichen kcal** aus. Beim Beenden kann der Tag auf Trainingstag/Bouldern gesetzt werden.
- Die Sonderaktivität (Wandern, Radfahren) hat mit dem Training nichts zu tun und beeinflusst die Regeln unten nicht. Sie bleibt unberührt.
- Ein Tag hat nur einen Workout-Typ (Mehrfachauswahl existiert in der App nicht und ist nicht Teil dieses Konzepts). Der Nutzer entscheidet selbst, was für den Tag gelten soll (PO-H).

| Zustand des Tages beim Beenden | Beenden-Sheet (S6) |
|---|---|
| Kein Tagestyp gesetzt oder ausdrücklich als Ruhetag gesetzt | Chip `Heute als Trainingstag (Bouldern) eintragen`, **vorbelegt**. Hinweis: `Es gilt dein Trainingstag-Ziel.` Beide Zustände verhalten sich gleich. |
| Trainingstag mit Workout-Typ Bouldern | Kein Chip. |
| Trainingstag mit anderem Workout-Typ (z. B. Gym) | Einzelauswahl `Welches Training gilt für heute?` mit den zwei Optionen (z. B. `Gym`, `Bouldern`), **vorbelegt mit dem bestehenden Typ**. Die Wahl bestimmt das Home-Icon und das Wochenmarker-Symbol. Das Kalorienziel ändert sich nicht. |

- Die Auswahl ist Teil des Beenden-Sheets (kein Pop-up, kein `Alert.alert`). Die Session selbst wird in jedem Fall gespeichert.
- Hat der Tag eine Sonderaktivität, gelten dieselben Regeln. Das Zusammenspiel von Trainingstag-Ziel und Aktivitätsbonus folgt der bestehenden Tageslogik und wird in der Technikplanung bestätigt (Annahme: identisch zum heutigen manuellen Setzen von Trainingstag plus Sonderaktivität).
- "Besondere Aktivität" bleibt unberührt. Doppelzählung ist ausgeschlossen, weil keine kcal-Berechnung aus Sessions erfolgt.
- Der Wochenrückblick auf Home zeigt für diesen Tag automatisch den bestehenden Marker `Bouldern / Klettern`.

### 5.8 Fehlerverhalten ohne Offline (PO-2)

- `Session starten` erfordert Verbindung. Ohne Verbindung: `InfoOverlay` mit klarem Hinweis.
- Jede Erfassungsaktion wird sofort gespeichert. Die Oberfläche reagiert sofort (optimistisch); ein Fehler markiert die Zeile mit `Nicht gespeichert · Erneut senden`.
- **Bekannte Einschränkung:** Wird die App vor erfolgreichem Senden beendet, gehen nicht gesendete Aktionen verloren. Das wird bis zur Offline-Funktion akzeptiert und dem Nutzer nicht verschwiegen (Hinweis in der Erfassung bei Verbindungsverlust).
- Annahme: Eine kurzzeitige Wiederholung im Speicher (ohne lokale Persistenz) gilt nicht als Offline-Funktion. Falls das nicht gewünscht ist, bitte melden.

---

## 6. Zusammenfassung und Verlauf

- **Session-Zusammenfassung:** Dauer, Anzahl Boulder, Gesamtversuche, Geschafft (inklusive Flash), Flash separat (nicht doppelt gezählt), Verteilung nach Stufe und Ergebnis, schwerste geschaffte Stufe (Annahme: Ranghöchste Stufe mit Ergebnis Geschafft oder Flash).
- **Verlauf:** Chronologisch, neueste zuerst. Zeile: Datum, Halle, Dauer, Boulder, Versuche. Struktur ermöglicht später einen Sportart-Filter (`[Planned]`).
- Eine Einheit ist zum Korrigieren und Löschen öffenbar (Löschen mit `ConfirmSheet`).

---

## 7. Datenschutz und Sicherheit (Vorab-Einschätzung, `privacy-impact-review` folgt in der Planung)

- **Neu gespeicherte Daten:** Hallen, Sessions, Einträge, Projekte, Fotos, Kommentare. Sie sind persönliche Trainingsdaten, privat. Kein anderer Nutzer sieht sie.
- **Kamera:** Neue Fotospeicherung (die Kamera-Berechtigung existiert bereits). Fotos von Wänden können Personen zeigen. Fotos sind privat, werden mit dem Konto gelöscht und verlassen den FitTrack-Speicher nicht.
- **Konto-Löschung:** Hallen, Sessions, Projekte, Fotos werden gelöscht.
- Die Datenschutzerklärung (`docs/legal/datenschutzerklaerung-alpha.md`) muss angepasst werden (Abschnitte "Welche Daten verarbeiten wir?", "Wo und womit werden die Daten verarbeitet?", "Speicherdauer und Löschen"). Formulierung und Rechtsgrundlage stehen im Epic-Plan; keine Änderung ohne gesonderte Freigabe.

---

## 8. Nicht Teil dieser Version

- Offline-Erfassung (PO-2, später).
- Pausenzeiten, Kalorienberechnung aus Sessions.
- Fb-/V-Skala, hallenübergreifende Gleichsetzung von Stufen.
- Auswertungsbereich "Fortschritt" im Tab Progress (`[Planned]`).
- Weitere Sportarten (Struktur vorbereitet, keine Umsetzung).
- Teilen von Projekten, Fotos oder Sessions.
- Standortbasierte Hallenvorschläge.
- Gemeinsamer Hallenkatalog (`[Planned]`).

---

## 9. Offene Entscheidungen für den Product Owner

| ID | Frage | Empfehlung |
|---|---|---|
| **PO-A** | **Entschieden (16.11.2026): Ja.** Training ersetzt den Tab Rezepte, Rezepte werden Segment in Ernährung. Die KB-Navigationsentscheidung wird mit der Umsetzung aktualisiert. | — |
| **PO-B** | **Gegenstandslos (16.11.2026):** Hallen sind persönlich, daher gibt es keine Rechte, Moderation oder Katalogpflege. Die frühere Zustimmung zu einem Katalog mit Ersteller-Rechten ist ersetzt. | — |
| **PO-C** | **Geändert (16.11.2026):** Die Schnellstart-Karte `Bouldern starten · <Halle>` erscheint auf Home nur, wenn der Nutzer für heute den Tagestyp Trainingstag mit Workout-Typ Bouldern gesetzt hat und für heute keine Boulder-Session existiert. Ohne zuletzt genutzte Halle führt der Button zur Hallenauswahl. | — |
| **PO-D** | **Geklärt (16.11.2026):** Es gibt bereits Azure Blob Storage (Rezept- und Produktbilder, Zugriff nur über das Backend mit kurzlebigen SAS-Links, Löschung bei Kontolöschung). Kein neuer Speicher nötig. Voraussichtlich genügt ein zusätzlicher Blob-Container im bestehenden Storage-Account (kleine Bicep-Ergänzung); das entscheidet die Technikplanung. Offen bleibt nur das Größenlimit (Vorschlag: wie bei Rezeptbildern 8 MB, vor dem Upload verkleinert). | — |
| **PO-E** | **Entschieden (16.11.2026):** Vergessene Session nach **2 Stunden** ohne Aktivität. Versuche werden standardmäßig nach dem Klettern als Gesamtzahl eingetragen, die Zählung je Versuch bleibt unterstützt. Projekt-Vorschlag ab 3 Versuchen bei `Offen` (Annahme, bei Bedarf anpassen). | — |
| **PO-F** | **Entschieden (16.11.2026):** Zahlenskala 1 bis maximal 20. Vorbelegung beim Anlegen: 1 bis 7. Bekannte Hallenskalen des PO: 1 bis 7 und 1 bis 9. | — |
| **PO-G** | **Entschieden (16.11.2026):** Feste, benannte Farbpalette mit 12 Farben (Weiß, Gelb, Orange, Grün, Türkis, Blau, Lila, Pink, Rot, Braun, Grau, Schwarz), je mit Kürzel. Jede Farbe pro Halle einmal, optional eigenes Label. Keine Mehrfarb-Stufen. Auswahlmarkierung nie nur über Farbe (dicker Rahmen + `►`). Neue Farb-Tokens `colors.boulder.*` im Design System. | — |
| **PO-H** | **Entschieden (16.11.2026):** Der Nutzer entscheidet. Bei anderem Workout-Typ wählt er im Beenden-Sheet zwischen den beiden Typen (Einzelauswahl). Eine Sonderaktivität ist unabhängig und ändert die Regeln nicht. Ausdrücklicher Ruhetag wird wie ein nicht gesetzter Tagestyp behandelt: Chip vorbelegt, Tagestyp wird auf Trainingstag/Bouldern gesetzt. Details in 5.7. | — |

---

## 10. Nächste Schritte

1. PO-Entscheidungen A bis H klären (A, B und D bestimmen den Umfang).
2. User-Story-Zerlegung (Vorschlag):
   1. Navigation und Trainings-Hub (inkl. Tab-Umbau).
   2. Eigene Hallen und Skalen.
   3. Session starten, Erfassung, Korrektur, Beenden.
   4. Projekte und Foto.
   5. Verlauf, Zusammenfassung, nachträgliche Session.
   6. Home-Karte "Training fortsetzen" (und optional Schnellstart).
   7. Trainingstag-Verknüpfung.
3. Erst danach technische Planung (Datenmodell, API, Bildspeicher, Datenschutz).
