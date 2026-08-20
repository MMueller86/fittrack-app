# US -- Home-Screen-Insights verbessern, Feedback erfassen und technisch reviewen

## User Story

**Als Nutzer von FitTrack**\
möchte ich fachlich korrekte, nachvollziehbare und natürlich formulierte
Insights erhalten und problematische Insights direkt bewerten können,\
**damit** die Insights mich sinnvoll unterstützen und fehlerhafte
Ergebnisse systematisch analysiert und verbessert werden können.

------------------------------------------------------------------------

## Hintergrund

Bei der Nutzung der Home-Screen-Insights wurden mehrere fachliche und
qualitative Probleme festgestellt. Teilweise werden vorhandene Daten
falsch interpretiert oder Zusammenhänge nicht ausreichend
berücksichtigt.

Zusätzlich fehlt aktuell eine Möglichkeit, schlechte Insights inklusive
ihres Entstehungskontexts für eine spätere Analyse zu erfassen.

Der bestehende Insight-Bereich soll deshalb nicht nur punktuell
angepasst, sondern durch den Planner vollständig technisch und fachlich
reviewed werden. Wenn die bestehende Struktur unnötig komplex ist oder
die beobachteten Fehler begünstigt, soll eine Refaktorierung
vorgeschlagen werden.

------------------------------------------------------------------------

## Bekannte Findings

### F1 -- Einzelne Gewichtsschwankungen werden zu negativ bewertet

Eine einzelne Gewichtszunahme kann negativ interpretiert werden, obwohl
der längerfristige Gewichtstrend weiterhin nach unten zeigt.

In solchen Situationen soll die Schwankung eingeordnet und der Nutzer
motiviert werden. Der langfristige Trend ist wichtiger als ein einzelner
Messwert.

Beispiel:

> „Lass dich von der heutigen Schwankung nicht entmutigen. Dein
> langfristiger Trend zeigt weiterhin in die richtige Richtung."

### F2 -- Veraltete Gewichtsmessungen werden als aktuell interpretiert

Eine mehrere Tage alte Gewichtsmessung wurde weiterhin für Aussagen über
die aktuelle Gewichtsentwicklung verwendet.

Der Zeitpunkt einer Messung muss berücksichtigt werden. Ohne neue
Messung darf keine neue Gewichtsentwicklung suggeriert werden.

### F3 -- Besondere Aktivitäten werden bei der Kalorienbewertung nicht zuverlässig berücksichtigt

Insights haben Tage als Kalorienüberschuss bzw. „kalorienreich"
bewertet, obwohl aufgrund einer besonderen Aktivität ein erhöhtes
Tagesbudget bestand und der Nutzer unter seinem tatsächlichen
Kalorienziel lag.

Dies wurde sowohl für den aktuellen Tag als auch beim späteren Rückblick
auf einen vergangenen Tag beobachtet.

Für die Bewertung muss das für den jeweiligen Tag tatsächlich gültige
Kalorienbudget inklusive besonderer Aktivitäten berücksichtigt werden.

### F4 -- Geplante Aktivitäten werden als durchgeführt interpretiert

Eine für später geplante fünfstündige Radtour wurde bereits morgens als
„absolviert" beschrieben.

Der Insight darf aus einer vorhandenen besonderen Aktivität nicht
automatisch ableiten, dass diese bereits stattgefunden hat.

Geplante und tatsächlich durchgeführte Aktivitäten müssen korrekt
unterschieden werden.

### F5 -- Ernährungsempfehlungen bei intensiven Aktivitäten sind zu generisch

Bei einer langen Radtour wurde lediglich ein proteinreicher Snack
empfohlen.

Bei langen oder intensiven Ausdauerbelastungen soll der Insight die
Ernährung situationsgerecht betrachten. Insbesondere der erhöhte
Kohlenhydratbedarf vor und während einer längeren Belastung sowie die
Ernährung zur anschließenden Regeneration sollen berücksichtigt werden.

### F6 -- Aussagen innerhalb eines Insights können sich widersprechen

Beispielsweise wurde eine Proteinzufuhr als „fast optimal" bezeichnet,
obwohl noch eine relevante Menge zum Ziel fehlte und direkt danach eine
höhere Proteinzufuhr empfohlen wurde.

Bewertungen und daraus abgeleitete Empfehlungen müssen zueinander und zu
den zugrunde liegenden Daten passen.

### F7 -- Tageszeit wird nicht ausreichend berücksichtigt

Morgens stehen für den aktuellen Tag noch kaum aussagekräftige Daten zur
Verfügung.

Der Insight soll seinen Fokus deshalb abhängig vom Zeitpunkt anpassen:

-   morgens primär den Vortag bzw. die letzten Tage betrachten,
-   montags gegebenenfalls die vergangene Woche stärker einbeziehen,
-   daraus einen sinnvollen Fokus für den aktuellen Tag ableiten,
-   im weiteren Tagesverlauf zunehmend den aktuellen Tag
    berücksichtigen.

### F8 -- Sprache wirkt teilweise abstrakt und künstlich

Formulierungen wie:

-   „positive Entwicklung"
-   „positive Fortschrittsphase"
-   „Regressionsphase erkannt"

wirken wie ein Analysebericht und nicht wie ein persönlicher Coach.

Insights sollen natürliches, verständliches und alltagstaugliches
Deutsch verwenden.

### F9 -- Motivation fehlt teilweise

Der Insight soll Daten nicht nur beschreiben und bewerten.

Insbesondere bei normalen Schwankungen oder kleineren Rückschlägen soll
er die Situation verständlich einordnen, den langfristigen Fortschritt
hervorheben und den Nutzer angemessen motivieren.

------------------------------------------------------------------------

# Insight-Feedback

Der Nutzer soll einen angezeigten Insight als problematisch bzw.
schlecht markieren können.

Dabei soll er zusätzlich einen Freitext-Kommentar hinterlegen können.

Beispiele:

> „Die Radtour war nur geplant und wurde noch nicht durchgeführt."

> „Durch meine besondere Aktivität lag ich gestern nicht über meinem
> Kalorienziel."

Das Feedback soll dauerhaft gespeichert werden und als Grundlage für die
spätere Analyse und Verbesserung der Insight-Funktion dienen.

------------------------------------------------------------------------

## Analyse-Snapshot

Für ein abgegebenes Feedback muss nachvollziehbar sein, **warum FitTrack
genau diesen Insight erzeugt hat**.

Dafür sollen zusammen mit dem Feedback mindestens die für die Erzeugung
relevanten Informationen gespeichert werden, insbesondere:

-   generierter Titel,
-   generierter Insight-Text,
-   Empfehlung bzw. CTA,
-   Nutzerkommentar,
-   Zeitpunkt der Insight-Erzeugung,
-   Zeitpunkt des Feedbacks,
-   sämtliche tatsächlich für die Erzeugung verwendeten Inputparameter,
-   relevante Gewichts-, Ernährungs-, Ziel- und Aktivitätsdaten
    inklusive ihrer Zeitbezüge,
-   besondere Aktivitäten und der für den Insight verwendete Status,
-   verwendete Prompt-Version,
-   möglichst der tatsächlich an das Modell übergebene Prompt,
-   relevante Version der Insight-Logik bzw. des verwendeten Modells.

Der Snapshot muss die damalige Situation reproduzierbar machen. Eine
ausschließliche Referenz auf veränderbare aktuelle Nutzerdaten reicht
dafür nicht aus.

Die so entstehenden Datensätze sollen eine
**Insight-Feedback-/Analyse-Datenbank** bilden, die später auch
automatisiert durch Copilot ausgewertet und abgearbeitet werden kann.

------------------------------------------------------------------------

# Review und mögliche Refaktorierung

Der Planner soll den bestehenden Insight-Bereich vollständig analysieren
und nicht lediglich die einzelnen Findings isoliert beheben.

Insbesondere soll geprüft werden:

-   wie der Insight aktuell technisch erzeugt wird,
-   welche fachlichen Entscheidungen deterministisch getroffen werden,
-   welche Entscheidungen der KI überlassen werden,
-   welche Daten tatsächlich in die Insight-Erzeugung einfließen,
-   ob Bewertungslogik mehrfach oder an unterschiedlichen Stellen
    implementiert ist,
-   ob historische Daten mit ihrem tatsächlichen historischen Kontext
    ausgewertet werden,
-   wo die KI aktuell fachliche Zustände aus unzureichenden Daten selbst
    ableiten muss,
-   wie reproduzierbar und automatisiert testbar die Insight-Erzeugung
    ist,
-   ob die bestehende Architektur unnötig komplex ist.

Der Planner soll ausdrücklich prüfen, ob eine klarere Trennung sinnvoll
ist, beispielsweise:

**Daten → deterministische Analyse/Regeln → erkannter Insight/Intent →
KI-Formulierung**

Dies ist keine vorgegebene Zielarchitektur. Der Planner soll anhand der
bestehenden Implementierung bewerten, ob dieser oder ein anderer Ansatz
die Insight-Logik vereinfachen und robuster machen würde.

Wenn eine Refaktorierung sinnvoll ist, soll sie Bestandteil des Plans
sein und nicht zugunsten einzelner Quick-Fixes vermieden werden.

------------------------------------------------------------------------

## Akzeptanzkriterien

1.  Die bekannten Findings F1--F9 wurden bei der Überarbeitung der
    Insight-Funktion berücksichtigt.
2.  Besondere Aktivitäten und das dadurch tatsächlich gültige
    Kalorienbudget werden bei aktuellen und historischen Bewertungen
    korrekt berücksichtigt.
3.  Geplante Aktivitäten werden nicht als bereits durchgeführt
    dargestellt.
4.  Gewichtsaussagen berücksichtigen Zeitpunkt und Aktualität der
    vorhandenen Messungen.
5.  Einzelne Gewichtsschwankungen werden im Kontext des längerfristigen
    Trends bewertet.
6.  Empfehlungen passen zu den zugrunde liegenden Daten und
    widersprechen nicht anderen Aussagen desselben Insights.
7.  Ernährungsempfehlungen können Art und Intensität besonderer
    Aktivitäten berücksichtigen.
8.  Der zeitliche Fokus eines Insights berücksichtigt die Tageszeit und
    die zu diesem Zeitpunkt sinnvoll verfügbaren Daten.
9.  Die Sprache ist natürlich, verständlich und coachend; unnötig
    abstrakte Formulierungen werden vermieden.
10. Der Nutzer kann einen Insight als schlecht/problematisch markieren
    und einen Kommentar hinterlegen.
11. Zu diesem Feedback wird ein reproduzierbarer Snapshot der für die
    Insight-Erzeugung verwendeten Daten gespeichert.
12. Prompt bzw. Prompt-Version und die für die Reproduktion
    erforderlichen Informationen werden mit dem Feedback gespeichert.
13. Die Feedback-Daten können später als Analysegrundlage für eine
    automatisierte Auswertung verwendet werden.
14. Der Planner führt einen vollständigen Review der bestehenden
    Insight-Architektur durch und plant eine Refaktorierung, sofern sie
    zur Vereinfachung und Robustheit der Funktion sinnvoll ist.
