# User Story – Rezeptteilen um Exportansicht und Rezept-Detailbild erweitern

## User Story

Als Nutzer möchte ich beim Erstellen und Bearbeiten eines Rezepts eine eigene,
editierbare Exportansicht pflegen und beim Teilen neben dem bisherigen
Instagram-Bild zusätzlich ein übersichtliches Rezept-Detailbild erzeugen,
damit beide Bilder dieselben bestätigten Rezeptinformationen verwenden und
ich sie gemeinsam speichern und teilen kann.

Diese Story ist eine Folge-Story zu `PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`.
Sie beschreibt die fachliche Erweiterung des bestehenden Rezeptteilen-Flows.
Der technische Planner erstellt daraus einen separaten `PLAN_US-10_...`.

## Produktentscheidungen

1. Beim Teilen werden zwei Bilder erzeugt:
   - das bestehende Instagram-Rezeptbild;
   - das neue Rezept-Detailbild mit Titel, Teaser, Meta-Zeile, Zutaten und Zubereitung.
2. Beide Bilder werden im lokalen Album `FitTrack` gespeichert und als ein
   gemeinsamer Multi-Image-Share an das native Betriebssystem-Share-Sheet
   übergeben. Es soll dafür kein zweiter manueller Share-Vorgang erforderlich
   sein.
3. Die Exportinformationen werden nicht erst beim Teilen durch einen neuen
   KI-Aufruf erzeugt. Der bestehende Rezept-Analyse-Aufruf soll die
   Exportinformationen bereits liefern.
4. Die bestätigte Exportansicht wird als versionierte, editierbare
   Rezeptinformation persistiert. Der Nutzer sieht die KI-Vorschläge vor dem
   Speichern und kann sie ändern.
5. Das Detailtemplate unterstützt bis zu 20 Nicht-Gewürz-Zutaten. Die
   Zutatenkarte wechselt abhängig von der Anzahl:
   - 1 bis 8 Zutaten werden einspaltig in der größeren Darstellung gezeigt;
   - 9 bis 20 Zutaten werden kompakt zweispaltig dargestellt;
   - die Spalten werden möglichst gleichmäßig geteilt, sodass bei genau 9
     Zutaten fünf links und vier rechts stehen und bei 20 Zutaten jeweils
     zehn;
   - bei 9 bis 14 Zutaten wird der verbleibende Raum unter der Liste durch
     ein dezentes Teller-und-Gemüse-Garnitur-Motiv als rein dekorativen
     visuellen Anker genutzt;
   - bei 15 bis 20 Zutaten bleibt die kompakte Zutatenliste ohne dieses Motiv,
     damit die höhere Informationsdichte Vorrang hat.
   Menge und Name bleiben sichtbar.
6. Gewürze beziehungsweise Zutaten mit `category: 'seasoning'` werden in der
   Zutatenkarte des Detailbilds nicht angezeigt. Ihre Verwendung darf in den
   Zubereitungsschritten erhalten bleiben.
7. Das Detailtemplate unterstützt bis zu fünf Zubereitungsschritte:
   - 1 bis 4 Schritte werden in der größeren Darstellung gerendert;
   - genau 5 Schritte werden in der kompakten Darstellung gerendert;
   - bei mehr als 5 Ausgangsschritten muss die KI semantisch auf höchstens 5
     Schritte verdichten.
8. Bei mehr als 20 exportierbaren Nicht-Gewürz-Zutaten wählt der Nutzer in der
   Exportansicht selbst aus, welche Zutaten im Detailbild erscheinen. Es darf
   nicht stillschweigend auf die ersten 20 Zutaten gekürzt werden.

## Exportansicht

Die Exportansicht gehört zum Rezept und ist im Rezept-Erstellungs- und
Bearbeitungsworkflow sichtbar. Sie enthält mindestens:

- einen editierbaren Teasertext;
- eine editierbare Gesamtzeit in Minuten;
- maximal fünf editierbare Export-Zubereitungsschritte;
- eine editierbare Auswahl von maximal 20 Nicht-Gewürz-Zutaten;
- eine sichtbare Information, ob die kompakte Fünf-Schritte-Darstellung
  verwendet wird;
- eine Möglichkeit, die Exportinformationen zu bestätigen und zu speichern.

Der fachliche Mindestinhalt der persistierten Exportfassung ist versioniert und
umfasst sinngemäß:

```ts
exportView?: {
  version: 1;
  teaser: string;
  totalTimeMinutes: number;
  steps: Array<{
    order: number;
    description: string;
  }>;
  includedIngredientIds: string[];
}
```

Die konkrete technische Typdefinition darf der Planner an bestehende Shared-
und Repository-Verträge anpassen, muss aber dieselbe fachliche Information
enthalten. Template-Optionen wie ein explizit gewähltes Highlight, Tags oder
ein temporärer Crop gehören nicht automatisch zur persistenten Exportansicht;
sie bleiben Presentation-Optionen des Share-Flows, sofern keine separate
Produktentscheidung getroffen wird.

### Neue Rezepte

- Der bestehende Rezept-Analyse-Aufruf erzeugt die Exportinformationen im selben
  strukturierten Ergebnis wie Name, Beschreibung, Zutaten und Schritte.
- Es wird kein zweiter KI-Aufruf nur für Teaser, Zeit oder Schrittverdichtung
  ausgeführt.
- Die KI-Ausgabe wird in der Rezeptprüfung angezeigt.
- Der Nutzer kann Teaser, Zeit, Exportzutaten und Exportschritte vor dem
  Speichern bearbeiten.
- Erst nach der ausdrücklichen Bestätigung werden die Exportinformationen mit
  dem Rezept gespeichert.
- Eine KI-Ausgabe darf nicht ohne Nutzerprüfung persistiert werden.

### Bestehende Rezepte

Bestehende Rezepte können noch keine Exportfassung besitzen. Beim Öffnen der
Exportansicht wird zunächst ein lokaler Entwurf aus den vorhandenen Rezeptdaten
gebildet:

- die vorhandene Rezeptbeschreibung wird als Teaser vorgeschlagen;
- vorhandene Rezeptschritte werden als Exportschritte vorgeschlagen;
- vorhandene Nicht-Gewürz-Zutaten werden als Auswahl vorgeschlagen, sofern
  höchstens 20 vorhanden sind;
- fehlt eine verlässliche Gesamtzeit, bleibt das Feld sichtbar offen und muss
  durch den Nutzer oder eine ausdrücklich gestartete KI-Vorbereitung ergänzt
  werden;
- bei mehr als fünf vorhandenen Schritten oder mehr als 20 vorhandenen
  Nicht-Gewürz-Zutaten wird der Entwurf als prüfbedürftig markiert;
- die KI wird für bestehende Rezepte nur durch eine ausdrückliche Nutzeraktion
  zur Vorbereitung der Exportansicht aufgerufen, nicht beim bloßen Öffnen und
  nicht beim Teilen;
- nach Bestätigung wird die Exportfassung persistiert.

Es darf keine erfundene Standardzeit wie `30 Minuten` in ein bestehendes Rezept
übernommen werden, ohne dass sie als Vorschlag erkennbar ist und bestätigt
wurde.

## KI-Fachlichkeit

Die Erweiterung des Recipe-Analyze-Aufrufs muss die Exportfelder in der
bestehenden Structured-Output-Struktur ergänzen. Die bestehenden Regeln für
Review, Plausibilitätsprüfung, Quota und Fehlerbehandlung bleiben gültig.

Die KI muss bei der Exportaufbereitung:

- einen kurzen, fitnessorientierten Teaser in deutscher Sprache erzeugen;
- eine positive, realistische Gesamtzeit in Minuten vorschlagen;
- bei mehr als fünf Schritten semantisch zusammengehörige Schritte verbinden;
- die ursprüngliche Reihenfolge erhalten;
- Zutatenbezüge, Handlungen, Temperaturen, Garzeiten und Wendepunkte erhalten;
- keine Schritte rein mechanisch abschneiden oder nur das Ende verwerfen;
- die Nicht-Gewürz-Zutaten für die Exportauswahl identifizierbar machen;
- keine Zutaten erfinden und keine fachlich relevanten Zutaten ohne Hinweis
  entfernen.

Eine KI-Verdichtung wird nach der Ausgabe erneut gegen die Exportvalidierung
geprüft. Die KI darf keine Renderergrenze umgehen.

Wird das zugrunde liegende Rezept später inhaltlich geändert, darf die alte
Exportfassung nicht stillschweigend als aktuell ausgegeben werden. Die
Exportansicht wird als prüfbedürftig markiert und muss erneut bestätigt oder
über eine ausdrücklich gestartete KI-Vorbereitung aktualisiert werden.

## Template- und Exportregeln

Das neue Rezept-Detailbild bleibt ein PNG mit exakt `1080 x 1350` Pixeln.
Die visuell geprüften lokalen Prototypen liegen unter
`backend/output/nine-ingredients-details-template.png` und
`backend/output/twenty-ingredients-details-template.png`. Sie dienen als
Bestätigung der Gestaltung und als Ausgangspunkt für die Umsetzung dieser
Story. Die Produktionsintegration ist ausdrücklich Bestandteil dieser Story:
Der bestehende Share-Flow wird um beide Bilder, die gemeinsame Vorschau, das
Speichern und den Multi-Image-Share erweitert.

Verbindliche Regeln:

- Der Rezepttitel darf nicht still gekürzt werden. Er muss die bestehende
  Titelvalidierung und den tatsächlichen Titel-Layout-Gate bestehen.
- Der Teaser muss sichtbar, einzeilig beziehungsweise kontrolliert umbrechbar
  und innerhalb des vorgesehenen Bereichs bleiben. Die aktuelle technische
  Obergrenze beträgt 96 Zeichen; ein Probe-Render muss zusätzlich den
  tatsächlichen Overflow prüfen.
- Die Exportzutaten enthalten Menge und Name. Die Auswahl ist auf maximal 20
  Nicht-Gewürz-Zutaten begrenzt. Bei 1 bis 8 Einträgen wird eine Spalte
  verwendet; ab 9 Einträgen wird die kompakte Zwei-Spalten-Darstellung mit
  maximal zehn Einträgen je Spalte verwendet. Bei 9 bis 14 Einträgen darf der
  freie Bereich unter der Liste ausschließlich durch das dezente
  Teller-und-Gemüse-Garnitur-Motiv gestaltet werden; es trägt keine
  zusätzlichen Rezeptinformationen. Bei 15 bis 20 Einträgen entfällt das
  Motiv.
- Die Exportschritte sind auf maximal fünf Einträge begrenzt. Ein Schritt darf
  nicht still abgeschnitten oder durch eine Ellipse ersetzt werden.
- Bei 1 bis 4 Schritten bleibt die große Darstellung erhalten; bei genau 5
  Schritten wird die kompakte Darstellung verwendet.
- Titel, Teaser, Menge, Name und Schritttext müssen die bestehenden Zeichen-
  und Layoutgrenzen bestehen: maximal 60 Zeichen für den Titel, 96 für den
  Teaser, 16 für die Menge, 36 für den Zutatenname und 90 je Schritt. Reine
  Zeichenlimits reichen nicht als alleiniger Nachweis; der vollständige
  Satori/Resvg-Probe-Render ist das finale Gate.
- Ungültige oder nicht darstellbare Exportdaten blockieren nur den Export und
  werden mit einer verständlichen, feldbezogenen Meldung angezeigt. Das
  gespeicherte Rezept darf dadurch nicht beschädigt werden.
- Die Daten des Detailbilds stammen serverseitig aus dem authentifizierten
  Rezept und der bestätigten Exportansicht. Mobile darf keine eigenen Rezept-,
  Nutrition-, Eigentümer- oder Bilddaten in den Renderer einschleusen.

## Teilen und Speichern

Der bestehende Share-Flow wird so erweitert, dass er beide Renderausgaben als
einen Share-Draft verwaltet:

1. Der Nutzer öffnet `Teilen` aus dem Rezeptdetail.
2. Die bestehende Optionsauswahl für Tags, Highlight und Crop bleibt erhalten.
3. Der Flow rendert das bisherige Instagram-Bild und das neue Detailbild auf
   Basis derselben serverseitigen Rezept- und Exportdaten.
4. Die Vorschau zeigt beide Bilder eindeutig und in ihrem festen Format.
5. Erst nach erfolgreicher Erzeugung beider PNGs ist `Speichern & teilen`
   möglich.
6. Beide Dateien werden im Album `FitTrack` gespeichert.
7. Beide Dateien werden in einem gemeinsamen Multi-Image-Share an das native
   Share-Sheet übergeben.
8. Bei Fehlern bleibt der Share-Draft für einen Retry erhalten. Ein
   unvollständiger Speichervorgang darf nicht als vollständig erfolgreich
   angezeigt werden.
9. Der Share-Flow löst keinen zusätzlichen KI-Aufruf aus.
10. Das bisherige Verhalten für Abbruch, Back, Berechtigungen, Album-
    Wiederverwendung, Rollback, Cleanup und Share-Retry bleibt erhalten und
    wird auf beide Dateien erweitert.

Die technische Unterstützung für einen Multi-Image-Share auf iOS und Android
muss der Planner beziehungsweise Infrastructure/Release vor der Umsetzung
prüfen. Eine Plattformgrenze darf nicht still zu zwei unabhängigen Share-
Dialogen umdefiniert werden.

## Akzeptanzkriterien

1. Im Rezept-Erstellungs- und Bearbeitungsworkflow gibt es eine sichtbare
   Exportansicht mit Teaser, Gesamtzeit, Exportschritten und
   Exportzutaten-Auswahl.
2. Die Exportansicht kann vor dem Speichern durch den Nutzer bearbeitet und
   ausdrücklich bestätigt werden.
3. Der neue Rezept-Analyse-Aufruf liefert die Exportinformationen im selben
   KI-Aufruf wie die übrigen Rezeptinformationen.
4. Beim Teilen wird kein weiterer KI-Aufruf ausgelöst.
5. Die bestätigte Exportfassung wird versioniert am Rezept gespeichert und bei
   späteren GET-/PUT-Operationen korrekt gelesen und geschrieben.
6. Bestehende Rezepte ohne Exportfassung bleiben lesbar und können über einen
   lokalen Fallback-Entwurf vorbereitet werden.
7. Bei bestehenden Rezepten wird die KI nur nach einer ausdrücklichen
   Nutzeraktion zur Exportvorbereitung aufgerufen.
8. Eine alte Exportfassung wird nach einer relevanten Rezeptänderung nicht
   stillschweigend als aktuell behandelt.
9. Das Detailbild zeigt 1 bis 8 exportierte Nicht-Gewürz-Zutaten in einer
  Spalte und 9 bis 20 exportierte Nicht-Gewürz-Zutaten kompakt in zwei
  Spalten mit maximal zehn Zeilen je Spalte; bei genau 9 Zutaten stehen fünf
  Einträge links und vier rechts.
10. Menge und Name jeder ausgewählten Zutat bleiben sichtbar; eine Zutat wird
    nicht still abgeschnitten.
11. Bei mehr als 20 Nicht-Gewürz-Zutaten muss der Nutzer vor dem Export eine
    Auswahl von höchstens 20 Zutaten bestätigen.
12. Gewürze erscheinen nicht in der Zutatenkarte, können aber in den
    Zubereitungsschritten genannt werden.
13. Ein bis vier Exportschritte werden in der großen Darstellung gerendert.
14. Genau fünf Exportschritte werden in der kompakten Darstellung gerendert.
15. Mehr als fünf Ausgangsschritte werden durch die KI semantisch auf höchstens
    fünf Schritte verdichtet oder der Export wird kontrolliert blockiert.
16. Die Verdichtung erhält Reihenfolge, Handlungen, Zutatenbezug, Temperatur,
    Dauer und Wendepunkte.
17. Teaser, Titel, Zutaten und Schritte werden vor dem Rendern auf Inhalt,
    Zeichenlänge und tatsächlichen Layout-Overflow geprüft.
18. Der Detailrenderer erzeugt bei gültigen Daten ein PNG mit exakt
    `1080 x 1350` Pixeln.
19. Ungültige Exportdaten führen zu einer verständlichen, feldbezogenen
    Exportfehlermeldung und nicht zu stiller Kürzung.
20. Der bestehende Instagram-Render und das neue Detailbild werden in einem
    Share-Draft gemeinsam erzeugt.
21. Die Vorschau macht beide Bilder unterscheidbar und verhindert `Speichern &
    teilen`, solange eines der beiden Bilder fehlt oder fehlerhaft ist.
22. Beide PNGs werden im Album `FitTrack` gespeichert und als gemeinsamer
    Multi-Image-Share übergeben.
23. Abbruch, Berechtigungsfehler, Albumfehler, Renderfehler, Retry und Cleanup
    funktionieren für beide Dateien ohne doppelte oder unvollständige
    Erfolgsmeldung.
24. Das bestehende Teilen, Speichern, Crop-, Tag- und Highlight-Verhalten des
    US-09-Flows bleibt für den bisherigen Instagram-Render kompatibel.
25. Für neue KI-Ausgaben gelten die bestehenden Review-, Structured-Output-,
    Plausibilitäts- und Quota-Regeln. Kein KI-Ergebnis wird ohne ausdrückliche
    Nutzerbestätigung als Rezeptdaten gespeichert.
26. Bestehende Rezepte und Cosmos-Dokumente ohne Exportfassung bleiben
    rückwärtskompatibel. Es werden keine neuen Cosmos-Container benötigt.
27. Tests decken mindestens neue Rezepte, bestehende Rezepte ohne Exportfassung,
    editierte Exportdaten, 1 bis 4 Schritte, genau 5 Schritte, mehr als 5
    Schritte, bis zu 20 Zutaten, mehr als 20 Zutaten, Gewürzausschluss,
    Teaser-/Text-Overflow, beide PNGs und den Multi-Image-Share ab.
28. Die Knowledge Base und die API-/Domänendokumentation beschreiben die
    persistierte Exportfassung, den KI-Aufruf, die Rendergrenzen und den
    rückwärtskompatiblen Umgang mit alten Rezepten.
29. Bei 9 bis 14 Zutaten wird der freie Bereich unter der kompakten
  Zutatenliste durch ein dezentes Teller-und-Gemüse-Garnitur-Motiv genutzt;
  bei 15 bis 20 Zutaten bleibt dieses Motiv aus Gründen der Lesbarkeit
  deaktiviert.

## Betroffene Bereiche für den Planner

Der Planner soll mindestens folgende Änderungsstellen bewerten und den Umfang
nicht auf den Renderer beschränken:

### Backend und AI

- bestehender Rezept-Analyse-Aufruf, Promptversion, Structured-Output-Schema,
  Mapping und AI-Evaluations-/Prompttests;
- serverseitige AI-Review-, Plausibilitäts- und Quota-Regeln;
- Rezept-Handler und Rezept-Validierung für die optionale versionierte
  Exportfassung;
- `shared/types/recipes.ts` und gemeinsame Rezeptvalidierung;
- Cosmos-Repository, Read-Kompatibilität und Update-Verhalten für das additive
  Exportfeld;
- bestehender Instagram-Render-Handler und API-Vertrag;
- Recipe-Adapter und bestehender Renderer;
- neues Detailtemplate einschließlich 1-bis-8-/9-bis-20-Zutaten-Layout,
  9-bis-14-Motiv, 1-bis-4-/5-Schritte-Typografie, Teaser und gemessener
  Overflow-Prüfung;
- Backend-Unit-, Handler-, Contract-, Prompt- und Render-Tests.

### Mobile

- Recipe-Wizard und Rezeptvorschau für die editierbare Exportansicht;
- Rezeptdetail und Einstieg in die Exportansicht für bestehende Rezepte;
- bestehende Recipe-API- und Shared-Vertragstypen;
- Share-Draft-State, Render-Requests und Vorschau für zwei PNGs;
- Options-, Crop-, Back-, Cancel-, Retry- und Fehlerzustände;
- Media-/Album-Service für zwei Dateien und einen Multi-Image-Share;
- Permission-, Rollback-, Cleanup- und Share-Retry-Verhalten auf iOS und
  Android;
- Mobile-Unit-, Komponenten-, API-, State- und gegebenenfalls E2E-Tests.

### Persistenz und Infrastruktur

- additive Schemaänderung am bestehenden Recipe-Dokument ohne neuen Container;
- Rückwärtskompatibilität für Dev und Alpha sowie kein stiller Verlust alter
  Rezeptdaten;
- Prüfung, ob API-, Function- oder App-Settings unverändert ausreichen;
- Prüfung des Native-/EAS-Auswirkungsgrades für Multi-Image-Share und lokale
  Medienablage;
- Dev-Deployment und Release-Gates gemäß bestehendem US-09-Flow. Kein
  automatischer Alpha-Deploy als Teil dieser Story.

### Dokumentation und QA

- `docs/kb/domain/06-recipes.md` für Exportfassung und Bilddaten;
- `docs/kb/domain/07-ai-features.md` für den erweiterten Recipe-Analyze-Aufruf
  und Reviewpflicht;
- `docs/kb/tech/09-api-reference.md` für den Render-/Rezeptvertrag;
- gegebenenfalls Produkt-/UX-Dokumentation für Exportansicht und
  Multi-Image-Share;
- dediziertes QA-Arbeitspaket mit Render-, Persistenz-, AI-, Mobile-,
  Berechtigungs-, Multi-Image- und Rückwärtskompatibilitätsprüfung.

## Nichtumfang

- kein direkter Instagram-Login, kein Instagram-Graph-API-Upload und keine
  Zustellbestätigung durch Instagram;
- kein Google-Photos-Upload und keine Backupgarantie;
- keine Persistierung der fertigen PNG-Dateien in Cosmos oder Blob Storage;
- kein neuer Cosmos-Container;
- keine automatische fachliche High-Protein-Klassifikation;
- keine stille Kürzung von Titeln, Zutaten, Teasern oder Schritten;
- keine Änderung bestehender Rezeptdaten ohne Nutzerbestätigung;
- keine zweite KI-Anfrage beim Teilen eines bereits vorbereiteten Rezepts.

## Offene technische Prüfungen für den Planner

1. Wie übergibt die vorhandene Mobile-/Expo-Kombination zwei lokale PNG-URIs
   zuverlässig als einen Multi-Image-Share auf iOS und Android? Falls dafür
   native Erweiterungen notwendig sind, sind Mobile Build Impact und Dev-Build
   Folgen auszuweisen.
2. Wie werden die beiden PNGs über den bestehenden Backend-Vertrag effizient
   angefordert: als zwei Renderaufrufe ohne AI, als kombinierte Antwort oder
   über eine neue strukturierte Renderantwort?
3. Wie wird die Exportfassung bei Änderungen an Zutaten-IDs, Schritten,
   Beschreibung oder Rezeptname als prüfbedürftig erkannt, ohne alte Rezepte
   zu beschädigen?
4. Welche konkreten gemessenen Zeichen-/Breitenlimits gelten für Namen und
   Mengen in der 20-Zutaten-Zwei-Spalten-Variante? Die Umsetzung muss diese
   Limits durch Probe-Render und nicht nur durch Zeichenanzahl absichern.
5. Das bisherige Instagram-Template verwendet teilweise temporäre Meta-Werte.
   Der Planner muss entscheiden, ob die bestätigte Exportzeit auch dort
   verwendet wird, damit beide Bilder keine widersprüchlichen Zeiten zeigen.

## Persistence Impact

Additives optionales Feld `exportView` am bestehenden Recipe-Dokument. Die
bestehenden Rezepte ohne dieses Feld müssen weiterhin lesbar bleiben; der
Planner klassifiziert die Änderung als read-kompatible Schemaerweiterung und
prüft die Dev-/Alpha-Auswirkung gemäß Cosmos-Migrationsregeln. Kein neuer
Container und keine Datenkopie sind vorgesehen.

## Infrastructure Impact

Infrastructure Impact: Dev

Mobile Build Impact: Potential Native Impact

Der genaue `Dev Build Required`-Status hängt von der geprüften Umsetzung des
Multi-Image-Share- und Media-Library-Vertrags ab. Ein Alpha-Deploy ist kein
Bestandteil dieser User Story ohne separaten operativen Auftrag.
