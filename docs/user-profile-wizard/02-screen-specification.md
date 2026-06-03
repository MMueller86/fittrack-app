# Screen Specification

## Screen 0 – Profile Prompt

### Purpose

Ask the user whether they want to create a profile.

### Layout

- Title
- Short explanation
- Primary button
- Secondary button

### Text

Title:

```text
Persönliches Profil einrichten?
```

Body:

```text
FitTrack kann dadurch deine Kalorien-
und Makroziele individuell berechnen.
```

Primary button:

```text
Profil anlegen
```

Secondary button:

```text
Später
```

---

# Wizard Shell

## Layout

Fullscreen modal / overlay.

### Header

- Close button
- Progress indicator
- Step label

Example:

```text
Schritt 2 von 5
```

### Content area

Step-specific form.

### Footer

- Back button
- Continue button

```text
Zurück
Weiter
```

Final step:

```text
Speichern
```

---

# Step 1 – Basisdaten

## Title

```text
Basisdaten
```

## Subtitle

```text
Diese Angaben helfen uns, deinen Grundbedarf zu berechnen.
```

## Fields

- Geschlecht
- Alter
- Größe
- Aktuelles Gewicht
- Zielgewicht optional

## UX details

Gender can be segmented buttons:

```text
Männlich | Weiblich | Divers / Keine Angabe
```

Height:

```text
173 cm
```

Weight:

```text
81,0 kg
```

Target weight optional:

```text
Optional: Zielgewicht
```

Helper text:

```text
Das Zielgewicht wird für Fortschritt und Prognosen genutzt,
nicht direkt für die Kalorienberechnung.
```

---

# Step 2 – Alltag ohne Sport

## Title

```text
Alltag ohne Sport
```

## Notice

```text
Bitte berücksichtige hier nur deinen Alltag.
Training erfassen wir im nächsten Schritt zusätzlich.
```

## Primary question

```text
Wie viele Schritte gehst du durchschnittlich pro Tag?
```

## Options

Quick chips:

- 5.000
- 7.500
- 10.000
- 12.500
- 15.000

Custom input:

```text
Eigener Wert
```

Fallback link/button:

```text
Ich weiß es nicht
```

## Fallback activity level

Show only if user chooses "Ich weiß es nicht".

```text
Wie aktiv bist du im Alltag?
```

Options:

- Überwiegend sitzend
- Etwas Bewegung
- Viel Bewegung
- Körperlich arbeitend

---

# Step 3 – Training

## Title

```text
Training
```

## Notice

```text
Die folgenden Angaben beziehen sich nur auf dein Training.
Deine Schritte und dein Alltag wurden bereits berücksichtigt.
```

## Question 1

```text
Wie oft trainierst du durchschnittlich pro Woche?
```

Options:

- 0
- 1
- 2
- 3
- 4
- 5
- 6
- 7

## Question 2

```text
Wie lange dauert eine typische Einheit?
```

Options:

- 30 Minuten
- 60 Minuten
- 90 Minuten
- 120 Minuten
- 150+ Minuten

If frequency is 0:

- Hide duration.
- Set duration to 0.

## Optional activity selection

```text
Welche Aktivitäten machst du regelmäßig?
```

Multi-select:

- Krafttraining
- Bouldern / Klettern
- Laufen
- Radfahren
- Schwimmen
- Wandern
- Teamsport
- Sonstiges

Helper text:

```text
Die Sportarten helfen später bei Auswertungen.
Für die erste Zielberechnung nutzen wir nur Häufigkeit und Dauer.
```

---

# Step 4 – Ziel

## Title

```text
Dein Ziel
```

## Options

- Abnehmen
- Gewicht halten
- Muskelaufbau
- Recomposition

## If Abnehmen

Show:

```text
Wie stark soll das Defizit sein?
```

Options:

- Sanft
- Moderat
- Aggressiv

Descriptions:

Sanft:

```text
Langsamer, nachhaltiger Fortschritt.
```

Moderat:

```text
Guter Kompromiss aus Fortschritt und Alltagstauglichkeit.
```

Aggressiv:

```text
Höheres Defizit. Kann schwieriger durchzuhalten sein.
```

## If Muskelaufbau

Show:

```text
Wie stark soll der Überschuss sein?
```

Options:

- Sanft
- Moderat
- Aggressiv

---

# Step 5 – Zielwerte prüfen

## Title

```text
Deine Zielwerte
```

## Display

Two cards:

### Ruhetag

- Calories
- Protein
- Fat
- Carbs
- Fiber

### Trainingstag

- Calories
- Protein
- Fat
- Carbs
- Fiber

## Actions

- Übernehmen
- Werte anpassen

## Explanation boxes

Each macro should have an expandable info box.

Example:

```text
Wie komme ich auf diese Werte?
```

---

# Home Screen Integration

## Day Type Toggle

Placement:

Near daily target overview.

Text:

```text
Heute ist ein:
[Ruhetag] [Trainingstag]
```

or compact:

```text
Trainingstag
[Toggle]
```

## Behavior

Switching immediately changes displayed targets.

## Important

This is user-controlled.

No automatic training detection in MVP.
