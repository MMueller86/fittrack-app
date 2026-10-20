# User Story – Dynamische KI-Begrüßung mit FitTrack Insight (Revision 2)

Status: Draft für Planner; Produktregeln in dieser Revision gemeinsam festgelegt. Noch kein Umsetzungsplan und keine Implementierungsfreigabe.
Supersedes for future planning: `US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md`. Die bisherige Datei bleibt als historischer Stand unverändert.

## 1. User Story

Als FitTrack-Nutzer möchte ich auf dem Homescreen eine persönliche KI-Begrüßung mit einer relevanten, zu meinen Daten und Zielen passenden Erkenntnis erhalten, damit ich direkt beim Öffnen der App eine hilfreiche und motivierende Einordnung meines Tages bekomme.

## 2. Motivation und Produktziel

Daily Insight soll aus den verfügbaren FitTrack-Daten eine verständliche, knappe und motivierende Einordnung erstellen. Die Einordnung soll die Ziele des Nutzers berücksichtigen, darf aus einem Tagesziel aber keine tatsächliche physiologische Energiebilanz ableiten. Relevante Fakten dürfen gemeinsam betrachtet werden; eine starre Rangfolge, die andere Themen grundsätzlich ausblendet, ist nicht das Produktziel.

Die KI bleibt beratend. Sie darf keine Daten erfinden, keine medizinischen Diagnosen stellen und keine Empfehlung geben, die den bekannten Zielen oder den verfügbaren Daten widerspricht.

## 3. Homescreen-Erlebnis

- Eine kompakte Karte verbindet die persönliche Begrüßung mit einem Kurz-Insight.
- Die Trainings-/Tagesart-Auswahl bleibt rechts in der Karte und behält ihr bestehendes Verhalten.
- „Mehr lesen“ öffnet den vollständigen, genau zu dieser Begrüßung gehörenden Insight einschließlich vorhandener Empfehlung, CTA und Feedback-Möglichkeit.
- Die separate Insight-Karte auf dem Homescreen entfällt.
- Die bestehende Lade-, Cache-, Refresh- und Aktualisierungslogik wird weiterverwendet. Es entstehen keine neuen Refresh-Trigger.
- Fehlt ein verfügbarer Insight oder ist das Begrüßungs-/Kurzsatz-Paar ungültig oder unvollständig, erscheint die vorhandene statische Begrüßung ohne Kurzsatz und ohne „Mehr lesen“.

## 4. Verbindliche Daily-Insight-Regeln

### 4.1 Ausgabe

- Begrüßung, Kurz-Insight und Volltext werden gemeinsam in derselben Modellgenerierung erstellt.
- Die Begrüßung ist tageszeitneutral und folgt `Hallo, <Name>! <ein freundliches Emoji>`. Der bestehende Namensfallback bleibt erhalten.
- `shortInsight` ist genau ein verständlicher, vollständiger deutscher Satz mit höchstens 240 Zeichen. Er fasst den zentralen Gedanken des Volltexts zusammen, fügt keine neue Tatsache hinzu und widerspricht ihm nicht.
- Der Volltext besteht aus einer kurzen Headline und einer vorhandenen, eigenständigen Beschreibung. Die Headline bleibt kurz (höchstens 40 Zeichen). Der Prompt soll eine kurze, knappe Beschreibung erzeugen; eine Mindestwortzahl gibt es nicht. Eine Beschreibung über 5.000 Zeichen darf technisch abgelehnt werden.
- Optionales `recommendation`, `cta` und `ctaTarget` müssen zusammenpassen. Keine Empfehlung ist ebenfalls ein gültiges Ergebnis.

### 4.2 Ziele und Kalorien

- Die KI erhält das Nutzerziel und das serverseitig berechnete effektive Kalorienziel. Das effektive Ziel berücksichtigt die Zielanpassung, z. B. das geplante Defizit bei Gewichtsabnahme, bereits. Die KI zieht kein weiteres Defizit ab und rekonstruiert das Ziel nicht selbst.
- Liegt die protokollierte Aufnahme innerhalb des verlässlichen Tagesziels, wird sie auch bei einem Gewichtsabnahmeziel nicht als „zu viel“ bewertet.
- Liegt die protokollierte Aufnahme über dem verlässlichen Tagesziel, darf und soll der Insight benennen, dass das heutige Kalorienziel überschritten wurde. Der Ton bleibt motivierend: ein einzelner Tag macht den Fortschritt nicht zunichte; morgen beginnt ein neuer Tag. Die Aussage bewertet das Tagesziel, nicht den Nutzer als Person.
- Die Tageszielrelation ist keine gemessene physiologische Energiebilanz und beweist für sich allein weder Energiedefizit noch Energieüberschuss. Bei fehlenden oder widersprüchlichen Kalorienwerten wird keine Zielüberschreitung behauptet.

### 4.3 Protein

- Die relevante Proteinrange beträgt 1,5 bis 2,0 g pro kg Körpergewicht. Backend übergibt der KI die Range und die serverseitige Bewertung, ob die Aufnahme unterhalb, innerhalb oder oberhalb der Range liegt. Die KI berechnet diese Bewertung nicht aus Rohdaten nach.
- Unterhalb der Range darf der Insight sachlich benennen, dass das Proteinziel nicht erreicht wurde. Das gilt auch, wenn das Kalorienziel erreicht oder überschritten ist.
- Eine proteinreiche Essensempfehlung ist nur zulässig, wenn alle drei Mahlzeitentypen Frühstück, Mittagessen und Abendessen jeweils mindestens einen gespeicherten Eintrag haben und mindestens 300 kcal Rest zum effektiven Tagesziel bestehen. Die Empfehlung ist optional, nicht verpflichtend.
- Sind nicht alle drei Mahlzeiten gepflegt oder weniger als 300 kcal übrig, darf keine zusätzliche Essensempfehlung gegeben werden. Die Feststellung, dass das Proteinziel nicht erreicht wurde, bleibt davon unberührt.
- Innerhalb der Range ist die Proteinzufuhr im Ziel. Oberhalb von 2,0 und unter 2,5 g/kg erfolgt keine besondere Proteinwarnung.
- Ab 2,5 g/kg darf der Insight optional und nicht alarmistisch darauf hinweisen, dass die Zufuhr vermutlich über dem benötigten Maß liegt. Er darf erwähnen, dass für die Kalorien andere Lebensmittel gewählt werden können, falls diese besser schmecken oder zufriedener machen; die Proteinzufuhr ist dadurch nicht automatisch ein Problem.
- Ist zugleich das Kalorienziel überschritten, darf der Insight die Protein-Einordnung mit der Kalorienzielüberschreitung verbinden und eine künftige Anpassung der Lebensmittelauswahl anregen. Diese Hinweise entfallen, wenn Proteinmenge oder Körpergewicht nicht verlässlich berechnet werden können.
- Ist die Proteinaufnahme innerhalb der Range und sind Mahlzeiten vollständig sowie mindestens 300 kcal übrig, darf ein allgemeiner Essensvorschlag erscheinen. Er ist optional; sein Vorhandensein oder Fehlen ist kein Eval-Fehler.

### 4.4 Mahlzeitenvollständigkeit und Empfehlungen

- „Gepflegt“ bedeutet: mindestens ein gespeicherter MealItem in jedem der drei Typen `breakfast`, `lunch` und `dinner`. Ein leer angelegter Mahlzeitenabschnitt zählt nicht.
- Eine Essensempfehlung darf nur erfolgen, wenn alle drei Mahlzeiten gepflegt sind und mindestens 300 kcal Rest bestehen. Weniger als 300 kcal oder eine noch nicht gepflegte Mahlzeit sperren Essensempfehlungen.
- Andere passende Hinweise, etwa Flüssigkeit oder Erholung bei einer besonderen Aktivität, sind keine Essensempfehlung und werden nicht durch diese Bedingung gesperrt.
- Ob eine erlaubte Empfehlung sinnvoll ist, bleibt der KI überlassen. Die Eval verlangt keine optionale Empfehlung und wertet sie nicht als Fehler, sofern sie datenbasiert und zielverträglich ist.

### 4.5 Besondere Aktivitäten

- Für eine im Tagebuch eingetragene besondere Aktivität mit mindestens 180 Minuten Dauer darf der Insight passende Hinweise zu Energie oder Kohlenhydraten, Flüssigkeit und Erholung geben. Die einzelnen Hinweise sind optional; es gibt keine Pflicht, jedes Mal alle drei Aspekte zu nennen.
- Diese besondere Aktivitätsregel gilt nicht für normale Trainingstage oder andere Insights.
- Vergangene, im Tagebuch gespeicherte Aktivitäten gelten als durchgeführt.
- Bei einer heutigen Aktivität wird vor 22 Uhr Ortszeit weder behauptet, sie sei geplant, noch, sie sei durchgeführt worden. Ab 22 Uhr darf der Insight davon ausgehen, dass die eingetragene Aktivität abgeschlossen ist.
- Die Kategorien `planned`, `likely_completed` und `unknown` sowie eine Abschlussableitung vor 22 Uhr sind nicht Teil des gewünschten Produktverhaltens.

### 4.6 Gewicht und Themenauswahl

- Gewichtsaussagen berücksichtigen das Nutzerziel. Die langfristige Fortschrittsrichtung basiert auf dem serverseitig berechneten 30-Tage-Trend. Die letzten zwei Messungen dürfen direkt verglichen werden, begründen allein aber keinen Trend oder Fortschritt.
- Ohne belastbaren 30-Tage-Trend wird keine langfristige Richtung behauptet. Gewichtsdaten älter als 14 Tage gelten als veraltet und dürfen nicht als aktuell dargestellt werden.
- Es gibt keine starre Vorrangfolge der bisherigen sechs Intents. Die KI erhält die verfügbaren, serverseitig geprüften Fakten und kann zusammengehörige Signale verbinden. Sie formuliert eine zentrale knappe Erkenntnis, statt alle Themen aufzuzählen.
- Ernährungsdaten dürfen nicht allein deshalb aus dem Modellkontext entfernt werden, weil ein Gewichtssignal vorliegt. Sie können in die Einordnung einfließen, sofern sie relevant und verlässlich sind.

### 4.7 Datentreue und Sicherheit

- Fehlende Daten bleiben unbekannt und werden nicht als Null interpretiert.
- Historische Aussagen verwenden ausschließlich die Daten und das aufgelöste Ziel des jeweiligen historischen Tags. Ein heutiges Profilziel ersetzt kein historisches Ziel.
- Zahlen, Kalorienwerte, Mahlzeiten, Aktivitätsdauer und Aktivitätsabschluss werden nicht erfunden.
- Die KI gibt keine medizinische Diagnose oder unbelegte Gesundheitsbehauptung aus. Empfehlungen dürfen dem bekannten Nutzerziel und den oben beschriebenen Kalorien-/Proteinregeln nicht widersprechen.

## 5. Akzeptanzkriterien

1. Ein erfolgreicher Modelloutput enthält im selben Generierungsvorgang Begrüßung, vollständigen Kurzsatz, kurze Headline und Beschreibung.
2. Begrüßung und Kurzsatz erfüllen Format und Zeichenlimits aus Abschnitt 4.1. Der Kurzsatz ist vollständig, verständlich und mit dem Volltext konsistent.
3. Die Einordnung berücksichtigt das Nutzerziel und das bereits zielangepasste effektive Kalorienziel. Eine Aufnahme innerhalb des Ziels wird nicht als „zu viel“ bewertet; eine verlässliche Überschreitung wird unterstützend als verfehltes Tagesziel benannt.
4. Die Proteinbewertung verwendet die übergebene Range von 1,5–2,0 g/kg und die serverseitige Statusbewertung. Empfehlungserlaubnis und Proteinstatus werden gemäß Abschnitt 4.3 getrennt behandelt.
5. Essensempfehlungen sind nur bei mindestens einem Eintrag in Frühstück, Mittag- und Abendessen und mindestens 300 kcal Rest zulässig. Optionale Empfehlungen werden weder gefordert noch allein wegen ihres Vorhandenseins beanstandet.
6. Besondere Aktivitäten ab 180 Minuten dürfen passende Versorgungs- und Erholungshinweise erhalten. Diese Hinweise sind optional und erscheinen nicht als allgemeine Pflicht für normale Trainingstage.
7. Aktivitätsaussagen beachten die Zeitregel: vergangene Aktivitäten gelten als durchgeführt; für heute keine Statusbehauptung vor 22 Uhr, ab 22 Uhr darf Abschluss angenommen werden.
8. Gewichtsaussagen verwenden den 30-Tage-Trend als Richtungssignal, erfinden ohne belastbaren Trend keine Richtung und kennzeichnen Daten älter als 14 Tage als veraltet.
9. Relevante, zusammengehörige Daten können gemeinsam betrachtet werden. Es gibt keine exklusive Intent-Rangfolge; der Insight bleibt dennoch auf eine zentrale Aussage ausgerichtet.
10. Bei fehlendem oder ungültigem Insight beziehungsweise fehlendem Kurzfeldpaar erscheint der bestehende statische Client-Fallback ohne Kurzsatz und ohne „Mehr lesen“. Es gibt keine serverseitig erfundene Ersatzgenerierung.
11. „Mehr lesen“ öffnet exakt den angezeigten vollständigen Insight ohne zusätzlichen Request; bestehende CTAs, Feedback und Feedback-Provenienz bleiben erhalten.
12. Die separate Insight-Karte entfällt, die Tagesart-Auswahl bleibt rechts in der Begrüßungskarte, und sonstige Home-Bereiche bleiben unverändert.
13. Bei 320/360 dp und Font Scale 1,0/1,3 bleiben lange Namen, erlaubte Textlängen, Trainingsauswahl und „Mehr lesen“ lesbar und bedienbar. Safe Area, TalkBack und mindestens 48-dp-Aktionen werden berücksichtigt.
14. Stabile Offline-Tests prüfen Ausgabeformat, Pflichtfelder, Längenlimits, Faktenzuordnung, die Mahlzeiten-/300-kcal-Grenze, Protein-/Kalorienregeln, Aktivitätszeit und Gewichtsdaten. Tests hängen nicht an exakten Formulierungen wie einzelnen Pronomen oder Beispielphrasen.
15. Vor Abschluss der Backend-Phase führt Backend die vollständigen betroffenen Eval-Tests zehnmal für denselben Quell- und Promptkandidaten aus. Alle zehn vollständigen Läufe müssen erfolgreich sein; übersprungene oder `UNVERIFIED`-Läufe zählen nicht. Ein Safety-Fallback oder eine erwartete Ablehnung zählt bei einem positiven Generierungsfall nicht als Erfolg. Schlägt ein Lauf fehl, wird nach der Korrektur der Zehnerlauf für den korrigierten Kandidaten neu begonnen. Erst nach diesem Gate ist die Backend-Phase abgeschlossen und QA darf starten.
16. Die Planung erstellt ein eigenständiges, zentrales KB-Markdown-Dokument mit sämtlichen Daily-Insight-Regeln, Motivation, Zielen, Auslösern und Ausnahmen. Andere KB-Dokumente verlinken darauf, statt dieselben Regeln unabhängig zu definieren. Nach Umsetzung entsprechen Story, Regelwerk und technische KB dem implementierten Verhalten und der tatsächlich geprüften Promptidentität.

## 6. Scope und Grenzen

### Im Scope

- Überarbeitung der Daily-Insight-Prompt- und Kontextlogik sowie bestehender Validatoren und Evals.
- Entfernung, Zusammenführung oder Änderung vorhandener Regeln und Bestandsimplementierung, sofern sie dieser Story widersprechen.
- Serverseitige Bereitstellung von Proteinstatus, Mahlzeitenvollständigkeit, Aktivitätsdauer, Ziel- und Gewichtssignalen.
- Backend-, Shared- und erforderliche Mobile-Prüfungen sowie Aktualisierung der zugehörigen Dokumentation.
- Erstellung des zentralen Daily-Insight-Regeldokuments als Planungsergebnis.

### Nicht im Scope

- Neue Endpoints, zusätzliche KI-Aufrufe oder zusätzliche Refresh-Trigger.
- Änderungen an Quoten, Cache-/TTL-Grundverhalten, Authentifizierung oder Datenquellen, sofern der Planner keine zwingende Abhängigkeit nachweist.
- Migration, Backfill, Löschung oder Zwangsgenerierung alter Insights.
- Medizinische oder therapeutische Beratung.
- Deploy oder Infrastrukturänderungen ohne gesonderten operativen Auftrag.
