# US – Rezeptfoto für optimales Hero-Bild aufnehmen

## Ziel

Als Nutzer möchte ich bei der Aufnahme eines Rezeptfotos visuell dabei unterstützt werden, das Gericht so zu positionieren, dass es im späteren Hero-Bereich des Rezepts optimal dargestellt wird.

## Akzeptanzkriterien

- Beim Fotografieren eines Rezeptbildes wird innerhalb der Kamera ein **rechteckiger Hero-Frame** angezeigt.
- Der Hero-Frame entspricht dem Seitenverhältnis des später im Rezept verwendeten Hero-Bildes.
- Als Referenz wird das bereits vorgesehene Format von ungefähr **1080 × 880 px** verwendet.
- Der Bereich außerhalb des Hero-Frames wird leicht abgedunkelt, bleibt aber sichtbar.
- Der Nutzer kann dadurch bereits bei der Aufnahme erkennen, welcher Bildbereich später im Rezept sichtbar sein wird.
- Das Gericht soll innerhalb des Hero-Frames mit ausreichend Abstand zu den Rändern positioniert werden können.
- Beim Fotografieren wird das **vollständige Originalbild** gespeichert.
- Das Originalbild wird nicht auf den Hero-Frame zugeschnitten.
- Zusätzlich werden die Parameter des Hero-Ausschnitts gespeichert.
- Der Hero-Ausschnitt kann nachträglich durch Verschieben und Zoomen angepasst werden.
- Die Anpassung des Hero-Ausschnitts verändert das gespeicherte Originalbild nicht.
- Für das Rezept wird der gespeicherte Hero-Ausschnitt des Originalbildes dargestellt.
- Es wird keine zusätzliche Bilddatei für den Hero-Ausschnitt erzeugt.

## Datenmodell – fachliche Erwartung

Pro Rezeptfoto existiert weiterhin nur **eine Bilddatei**.

Zusätzlich werden Metadaten gespeichert, die beschreiben, welcher Bereich des Originalbildes als Hero-Bild dargestellt wird, beispielsweise:

- Position des Bildes innerhalb des Frames
- Zoomfaktor
- Seitenverhältnis bzw. verwendeter Hero-Frame

## Hinweis für den Planner

Die Story umfasst ausschließlich:

**Kameraaufnahme → Framing-Hilfe → Originalbild speichern → Hero-Ausschnitt speichern und darstellen.**

Eine KI-basierte Bildoptimierung oder die Erzeugung eines separaten Produktbildes ist **nicht Bestandteil dieser Story**.
