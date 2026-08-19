# User Story – Ernährungstrend der letzten 7 Tage

## User Story

**Als Nutzer**
möchte ich auf der Startseite eine kompakte Zusammenfassung meiner Ernährung der letzten 7 abgeschlossenen Tage sehen,
**damit ich auf einen Blick erkenne, wie meine tatsächliche Kalorienaufnahme im Verhältnis zu meinen individuellen Tageszielen lag und wie die vergangenen Tage insgesamt zu bewerten sind.**

Als visuelle Referenz dient das final abgestimmte Diagramm **„Ernährung – Letzte 7 Tage“**. Die folgenden Anforderungen definieren die fachliche Logik und das erwartete Verhalten.

## Akzeptanzkriterien

### 1. Zeitraum

* Die Karte zeigt immer die **letzten 7 vollständig abgeschlossenen Kalendertage**.
* Der aktuelle Tag ist nicht Bestandteil der Auswertung.
* Der konkrete Zeitraum wird im Header angezeigt.
* Der Zeitraum ist rollierend und nicht an eine Kalenderwoche gebunden.
* Jeder Tag wird mit Wochentag und Datum dargestellt.

### 2. Tageswerte und Tagesziel

Für jeden der sieben Tage werden dargestellt:

* tatsächlich konsumierte kcal,
* das für diesen Tag gültige Kalorienziel,
* prozentuale Zielerreichung: `konsumierte kcal / Tagesziel × 100`,
* der relevante Tagestyp bzw. eine besondere Aktivität, sofern vorhanden.

Das Tagesziel wird **tagesspezifisch** ermittelt. Unterschiedliche Ziele durch Ruhe-, Trainings- oder besondere Aktivitätstage müssen berücksichtigt werden.

Historische Tage werden mit dem für diesen Tag gültigen Ziel dargestellt. Eine spätere Änderung des aktuellen Kalorienziels darf historische Werte nicht verfälschen.

### 3. Diagrammdarstellung

* Die sieben Tage werden als vertikale Balken nebeneinander dargestellt.
* Die Balkenhöhe entspricht der **prozentualen Erreichung des jeweiligen Tagesziels**, nicht den absoluten kcal.
* Dadurch bleiben Tage mit unterschiedlich hohen Kalorienzielen direkt vergleichbar.
* `100 %` entspricht dem individuellen Kalorienziel des jeweiligen Tages und wird als gemeinsame Referenzlinie dargestellt.
* Oberhalb jedes Balkens werden Prozentwert und konsumierte kcal angezeigt.
* Pro Tag wird **genau eine Zielmarkierung** dargestellt.

### 4. Farblogik

Die Balkenfarbe basiert auf der Abweichung vom individuellen Tagesziel:

* **95–105 %:** Grün – im Zielbereich
* **<95 %:** Orange – unter Ziel
* **>105 %:** Orange – über Ziel

Eine Unter- oder Überschreitung wird damit nicht grundsätzlich als positiv bzw. negativ bewertet. Entscheidend ist die Nähe zum geplanten Kalorienziel.

Die Grenzwerte sollen zentral definiert werden und nicht ausschließlich Bestandteil der Darstellungskomponente sein.

### 5. Training und besondere Aktivitäten

Unter jedem Tag wird, sofern relevant, der Tagestyp bzw. eine Aktivität dargestellt, beispielsweise:

* Ruhetag
* Training
* besondere Aktivität wie Radtour oder Wandern

Besondere Aktivitäten dürfen entsprechend der visuellen Referenz hervorgehoben werden.

Verändert eine Aktivität das Kalorienziel eines Tages, muss das Diagramm mit dem **angepassten Tagesziel** rechnen.

Beispiel:

**Normales Ziel:** 2.300 kcal
**Intensive Radtour:** +1.300 kcal
**Angepasstes Tagesziel:** 3.600 kcal
**Gegessen:** 4.650 kcal
**Zielerreichung:** 129 %

Die Aktivität und das erhöhte Tagesziel müssen in der Darstellung nachvollziehbar sein.

### 6. Durchschnittswerte

Im Kopfbereich werden zwei Durchschnittswerte über die **7 abgeschlossenen Tage** angezeigt:

**Ø konsumierte kcal pro Tag**

`Summe konsumierte kcal / Anzahl berücksichtigter Tage`

**Ø Kalorienziel pro Tag**

`Summe der individuellen Tagesziele / Anzahl berücksichtigter Tage`

Der durchschnittliche Zielwert berücksichtigt damit automatisch Ruhe-, Trainings- und besondere Aktivitätstage.

### 7. 7-Tage-Bilanz

Im Kopfbereich wird zusätzlich eine kompakte Gesamtbilanz dargestellt:

* Summe der individuellen Kalorienziele der 7 Tage,
* Summe der konsumierten kcal,
* durchschnittliche prozentuale Zielerreichung.

Beispiel:

**7-Tage-Ziel:** 17.620 kcal
**Gegessen:** 16.890 kcal
**Ø 96 % des Kalorienziels**

Die Bilanz beschreibt die **Abweichung vom geplanten Kalorienziel**.

Sie darf nicht als tatsächliches Energiedefizit bezeichnet werden, da im Kalorienziel bereits ein geplantes Defizit für die Gewichtsabnahme enthalten sein kann.

### 8. Fehlende Daten

Ein abgeschlossener Tag ohne Ernährungseinträge darf **nicht automatisch als 0 kcal konsumiert** interpretiert werden.

Der Tag wird als fehlender Datenpunkt dargestellt und:

* nicht als starke Unterschreitung bewertet,
* nicht positiv oder negativ bewertet,
* nicht in Durchschnitts- oder Zielerreichungsberechnungen einbezogen, sofern keine ausreichenden Daten vorliegen.

Der dargestellte Zeitraum bleibt trotzdem bei den letzten 7 abgeschlossenen Kalendertagen. Ein Tag ohne Daten wird also **nicht durch einen älteren Tag ersetzt**.

### 9. KI-Wochenbewertung

Unterhalb des Diagramms wird entsprechend der visuellen Referenz eine **kompakte KI-generierte Bewertung über die gesamte Breite der Karte** angezeigt.

Die Bewertung bezieht sich ausschließlich auf die dargestellten 7 abgeschlossenen Tage und soll die Daten interpretieren, statt lediglich die bereits sichtbaren Zahlen zu wiederholen.

Berücksichtigt werden insbesondere:

* durchschnittliche Zielerreichung,
* relevante Über- und Unterschreitungen,
* Trainingstage,
* besondere Aktivitäten,
* angepasste Tagesziele,
* Unterschiede zwischen Ruhe- und Aktivitätstagen,
* erkennbare Auffälligkeiten oder Muster.

Die Bewertung wird als **kurzer zusammenhängender Text** dargestellt und soll bewusst wenig vertikalen Platz beanspruchen.

Separate Bereiche wie **„Stärken“**, **„Tipps für nächste Woche“** oder ähnliche Unterkategorien sind nicht Bestandteil dieser Story.

Die KI muss den Kontext angepasster Tagesziele korrekt berücksichtigen. Eine hohe absolute Kalorienaufnahme aufgrund einer außergewöhnlichen Aktivität darf beispielsweise nicht ohne Bezug auf das entsprechend erhöhte Tagesziel negativ bewertet werden.

Fehlende Daten dürfen von der KI nicht als tatsächliche Unterversorgung interpretiert werden.

## Fachliche Leitlinie

Die Darstellung bewertet nicht, ob möglichst wenig gegessen wurde.

Sie beantwortet primär die Frage:

**„Wie gut entsprach meine Energieaufnahme in den letzten 7 abgeschlossenen Tagen meinem individuell geplanten Kalorienziel?“**

Ein Wert nahe 100 % entspricht daher grundsätzlich stärker dem persönlichen Plan als eine deutliche Unter- oder Überschreitung. Aktivitätsbedingte Anpassungen des Kalorienziels sind vollständig Bestandteil dieser Betrachtung.
