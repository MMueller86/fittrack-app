# Konzept Training / Bouldern: Klickfolgen

Stand: 16.11.2026  
Ergänzt: [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md), Screens: [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md)

Legende: Rechtecke = Screens, Rauten = Entscheidungen, Zahlen am Pfeil = Tap-Zähler ab Tab `Training`. Screen-IDs (`S1` ...) verweisen auf die Wireframes.

---

## 1. Gesamtnavigation

```mermaid
flowchart LR
    subgraph Tabs
        H[Home]
        E[Ernährung<br/>Segment Tagebuch / Rezepte]
        T[Training]
        P[Progress]
        PR[Profil]
    end
    H -- Karte "Bouldern läuft" --> S3
    T --> S1[S1 Training-Hub]
    S1 --> S2[S2 Halle wählen]
    S1 --> S3[S3 Erfassung]
    S1 --> S9[S9 Verlauf]
    S1 --> S10[S10 Projekte]
    S2 --> S2b[S2b Halle anlegen]
    S2 --> S3
    S3 --> S4[S4 Details-Sheet]
    S3 --> S5[S5 Projekte-Sheet]
    S3 --> S6[S6 Beenden-Sheet]
    S6 --> S7[S7 Zusammenfassung]
    S9 --> S7
    S9 --> S8[S8 Nachtrag anlegen]
    S8 --> S3
    S10 --> S11[S11 Projekt-Detail]
```

---

## 2. Session starten (bekannte Halle) — 2 Taps

```mermaid
flowchart TD
    A[App öffnen] --> B["Tap 1: Tab Training"]
    B --> C{Session läuft?}
    C -- Ja --> D["Karte Training fortsetzen"] --> S3
    C -- Nein --> E["Tap 2: Starten in Halle X"]
    E --> S3[S3 Erfassung<br/>Timer läuft, Stufen sichtbar]
```

Variante mit Home-Schnellstart-Karte (PO-C, nur an einem Bouldern-Trainingstag ohne Session heute): `Home` → `Starten` = **1 Tap**.

---

## 3. Erste Session / andere Halle

```mermaid
flowchart TD
    A["Tab Training"] --> B["Starten"]
    B --> C{Letzte Halle vorhanden?}
    C -- Ja --> S3
    C -- Nein --> S2["S2 Halle wählen"]
    A2["Link: Andere Halle"] --> S2
    S2 --> D{"Eigene Halle vorhanden?"}
    D -- Ja --> F["Halle antippen"] --> G["Starten"] --> S3
    D -- Nein --> H["Neue Halle anlegen"] --> S2b["S2b Name, optional Ort, Skala"]
    S2b --> I["Speichern"] --> S3
```

Tap-Zähler mit vorhandener eigener Halle: Tab, `Starten`, Halle wählen, `Starten` = 3 bis 4 Taps (siehe Budget).

---

## 4. Hauptschleife: Boulder erfassen

```mermaid
flowchart TD
    S[S3 Erfassung] --> A["Tap: Stufe wählen"]
    A --> V{"Versuche zählen"}
    V -- "Standard: nach dem Klettern" --> V1["Tap: Zahlenchip 1-5<br/>(oder Stepper)"]
    V -- "Alternativ: je Versuch" --> V2["Tap: + nach jedem Versuch"]
    V -- "Flash: nichts tippen" --> B
    V1 --> B{Ergebnis}
    V2 --> B
    B -- Geschafft --> C{"Versuche = 1?"}
    C -- Ja --> D["Ergebnis Flash<br/>Snackbar: Kein Flash / Rückgängig"]
    C -- Nein --> E["Ergebnis Geschafft<br/>Snackbar: Rückgängig"]
    B -- Offen --> F["Boulder Offen gespeichert"]
    F -- "Versuche >= 3" --> P["Snackbar: Als Projekt merken"]
    D --> G["Nächster Boulder:<br/>gleiche Stufe bleibt gewählt, Versuche = 1"]
    E --> G
    F --> G
    G --> A
    A2["Andere Stufe tippen, Versuche geändert (>= 2), kein Ergebnis"] --> H["Boulder wird Offen gespeichert,<br/>neuer Boulder beginnt"]
    H --> A
```

Beispiele:

| Fall | Taps |
|---|---|
| Gelb im ersten Versuch | Stufe `Gelb`, `Geschafft` = **2** |
| Gelb nach 5 Versuchen (Standardfall) | `Gelb`, Chip `5`, `Geschafft` = **3** |
| Rot 5x versucht, nicht geschafft | `Rot`, Chip `5`, `Offen` = **3** |
| Gelb, gezählt nach jedem Versuch (3 Versuche) | `Gelb`, `+`, `+`, `Geschafft` = **4** |
| Danach nochmal Gelb, sofort geschafft | `Geschafft` = **1** (Stufe bleibt) |
| Rot versucht, nicht geschafft, dann Gelb | `Rot`, `Offen`, `Gelb`, `Geschafft` = **4** |

---

## 5. Korrigieren und Löschen

```mermaid
flowchart TD
    A["Letzte Aktion falsch"] --> B["Snackbar: Rückgängig"] --> Z["Zustand wie vorher"]
    C["Älterer Eintrag falsch"] --> D["Zeile antippen"] --> S4["S4 Details-Sheet"]
    S4 --> E["Versuche +/-, Ergebnis, Status, Kommentar"]
    E --> F["Speichern"]
    G["Eintrag unerwünscht"] --> H["Zeile nach links wischen"] --> I["Snackbar: Rückgängig"]
```

Das Details-Sheet erzwingt konsistente Werte (Flash nur bei genau 1 Versuch, siehe Produktkonzept 5.3).

---

## 6. Projekt anlegen und fortsetzen

```mermaid
flowchart TD
    subgraph Anlegen
        A["Boulder aktiv"] --> B{"Wie?"}
        B -- Stern --> C["Projekt-Merkmal gesetzt"]
        B -- "Snackbar nach Offen ab 3 Versuchen" --> C
        C --> D["Optional: Kamera-Icon → Foto"]
        C --> E["Optional: Details → Zone, Status, Kommentar"]
    end
    subgraph Fortsetzen
        F["Neue Session in derselben Halle"] --> G["Tap: Projekte"]
        G --> S5["S5 Projekte-Sheet<br/>Liste offener Projekte dieser Halle"]
        S5 --> H["Tap: Projekt"]
        H --> I["Boulder aktiv<br/>Stufe und Vorversuche vorbelegt"]
        I --> J{Aktion}
        J -- "Offen (Versuche)" --> K["Versuche der Session = Zahl<br/>Projektgesamtzahl + Zahl"]
        J -- Geschafft --> L["Projekt Geschafft<br/>aus offenen Projekten entfernt"]
    end
```

Projekt fortsetzen = `Projekte`, Projekt, Aktion = **3 Taps**.

Projekt aufgeben (Boulder abgeschraubt): `Tab Training` → `Projekte` → Projekt → `Archivieren` → `ConfirmSheet` bestätigen.

---

## 7. Session beenden

```mermaid
flowchart TD
    A["Tap 1: Beenden"] --> S6["S6 Beenden-Sheet<br/>Kurzbilanz + Tagestyp-Bereich (Chip oder Auswahl je Tageszustand)"]
    S6 --> B{"Chip abwählen?"}
    B -- optional --> C["Tap: Chip aus"]
    B -- nein --> D
    C --> D["Tap 2: Session beenden"]
    D --> S7["S7 Zusammenfassung"]
    S7 --> E["Fertig → Training-Hub"]
```

Gibt es keinen Eintrag, bietet das Sheet `Session verwerfen` statt `Session beenden` an.

---

## 8. Nachträgliche Session

```mermaid
flowchart TD
    A["Training → Verlauf"] --> B["Session nachtragen"]
    B --> S8["S8: Datum, Halle, optional Start/Ende"]
    S8 --> C["Weiter"]
    C --> S3["S3 Erfassung im Nachtragsmodus<br/>kein Timer, Hinweis Nachtrag"]
    S3 --> D["Speichern"]
    D --> S6["Sheet mit Chip: Datum als Trainingstag"]
    S6 --> S7
```

---

## 9. Vergessene Session

```mermaid
flowchart TD
    A["App-Start / Tab Training"] --> B{"Session läuft und<br/>letzte Aktivität > 2 h?"}
    B -- Nein --> Z["normal"]
    B -- Ja --> C["Hinweis: Noch laufende Session von Datum"]
    C --> D["Beenden um Zeit der letzten Aktivität"]
    C --> E["Fortsetzen"]
    C --> F["Verwerfen"]
```

---

## 10. Fehler und Verbindungsverlust (ohne Offline, PO-2)

```mermaid
flowchart TD
    A["Aktion getippt"] --> B["UI aktualisiert sofort"]
    B --> C{"Senden erfolgreich?"}
    C -- Ja --> D["Haptik, fertig"]
    C -- Nein --> E["Zeile: Nicht gespeichert<br/>Erneut senden"]
    E --> F["Tap Erneut senden"] --> C
    G["Start ohne Verbindung"] --> H["InfoOverlay: Keine Verbindung"]
```

---

## 11. Anlage einer eigenen Halle

```mermaid
flowchart TD
    A["S2b Halle anlegen"] --> B["Name + optional Ort eingeben"]
    B --> C{"Gleiche eigene Halle<br/>vorhanden?"}
    C -- Ja --> D["Hinweis: Halle X gibt es schon<br/>Halle X verwenden"]
    C -- Nein --> E["Skalentyp: Farben | Zahlen"]
    E -- Farben --> F["Farben aus Palette antippen<br/>Reihenfolge leicht → schwer"]
    E -- Zahlen --> G["Höchste Stufe festlegen"]
    F --> H["Vorschau"]
    G --> H
    H --> I["Speichern + Starten"]
```
