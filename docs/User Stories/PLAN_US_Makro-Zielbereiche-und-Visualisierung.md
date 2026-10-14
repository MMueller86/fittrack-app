# Impact-Analyse und Umsetzungsvorschlag: Makro-Zielbereiche und Visualisierung

**Status:** Freigegeben. Die frische ausdrückliche User-Freigabe dieser Diary-API-Änderung ersetzt die frühere Planfreigabe.
**User Story:** [US_Makro-Zielbereiche-und-Visualisierung.md](US_Makro-Zielbereiche-und-Visualisierung.md)

Infrastructure Impact: Dev
Mobile Build Impact: None

## Resolved Product Owner Decisions

### PO-1: Rundung der Bereichsgrenzen

**Entscheidung (bestätigt):** Zuerst Protein-Unter- und Obergrenze auf ganze Gramm runden. Anschließend beide Kohlenhydratgrenzen mit `Math.round` runden und bei `0 g` begrenzen.

### PO-2: Sonderaktivitäten und Makro-Zielbereiche

**Entscheidung (bestätigt, Option A):** Eine Sonderaktivität erhöht ausschließlich das effektive Kalorienbudget um den bestehenden `activityBonus`. Der Zusatz steht zur freien Verwendung bereit und wird keinem Makro zugeordnet. Protein- und Kohlenhydratbereiche ändern sich an diesem Tag nicht; sie bleiben die Bereiche des ausgewählten Profil-Tages (`restDay` oder `trainingDay`). Es wird kein temporärer Makrobereich aus dem Aktivitätsbonus berechnet.

### PO-3: Protein oberhalb des Zielbereichs und Empfehlungs-Sperre

**Entscheidung (bestätigt):** Die Einordnung basiert auf der tatsächlichen Aufnahme in g/kg Körpergewicht:

- `1,5–2,0 g/kg` inklusive: Ziel erreicht, positive Bewertung.
- Über `2,0` bis einschließlich `2,2 g/kg`: oberhalb des Zielbereichs, aber kein Hinweis.
- Über `2,2 g/kg`: darf gelegentlich einen sachlichen, nicht-medizinischen Coaching-Hinweis auslösen; nicht an jedem qualifizierenden Tag automatisch.
- `2,2 g/kg` ist ein zentral konfigurierbarer Coaching-Parameter, keine medizinische Obergrenze. Der Beispieltext ist eine Tonalitätsreferenz, kein verpflichtender Literaltext:

  > Du hast heute bereits reichlich Protein aufgenommen – vermutlich mehr, als du für deine Ziele benötigst. Du könntest einen Teil deiner Kalorien auch für Kohlenhydrate, gesunde Fette oder Lebensmittel verwenden, die dir einfach schmecken.

- Die bestehende 20-g-Sperre für zusätzliche Proteinempfehlungen bleibt bestehen und wird gegen die neue, gerundete Protein-Untergrenze berechnet.

### PO-4: Kohlenhydrat-Richtbereich in Coaching und Hinweisen

**Entscheidung (bestätigt):** Werte innerhalb des Bereichs dürfen neutraler oder positiver Kontext sein. Werte außerhalb des Bereichs dürfen keine negativen Hinweise oder strikten AI-Aussagen erzeugen, dass die Aufnahme zu niedrig oder zu hoch sei.

### PO-5: Überlaufbereich der Home-Balken

**Entscheidung (bestätigt):** `100 %` liegt bei zwei Dritteln der Trackbreite; die Skala ist linear bis `150 %`. Nur die Balkengeometrie wird am Trackende begrenzt. Tatsächliche Grammwerte und Accessibility-Werte bleiben exakt; ein Überschreiten ändert die Farbe nicht.

### PO-6: Aktivitätsbonus-Zeile auf dem Homescreen

**Entscheidung (bestätigt; ersetzt die frühere akzeptierte Empfehlung, die Zeile zu entfernen):** Die separate Aktivitätsbonus-Zeile bleibt bei einer Sonderaktivität erhalten. Sie ist kein Makro-Zielbalken und darf weder als Protein-/Kohlenhydrat-Ziel noch als Makro-Zuteilung dargestellt werden. Ihre Darstellung passt sich dem vereinfachten Balken-Look an; Abschnitt 10.4 konkretisiert die dafür vorgesehene, von der Makrologik getrennte kcal-Darstellung. Die bestehende Kalorienring- und Bonuslogik bleibt unverändert.

## Open Product Owner Decisions
Keine offenen Produktentscheidungen. PO-1 bis PO-6 sind entschieden. Die in Abschnitt 10.4 beschriebene Darstellung konkretisiert PO-6.

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications; vor Produktion ist zusätzlich eine fachliche Ernährungsvalidierung erforderlich.

- **Nutzerproblem:** Ein einzelner Protein- und Kohlenhydratwert bildet die gewünschte Flexibilität nicht ab und kann „Ziel erreicht“ mit einem willkürlichen Punktwert verknüpfen.
- **Lösungsfit:** Ein deterministischer, gemeinsamer Shared-Helper kann die Zielbereiche für Profilberechnung, Backend-Regeln, Insights und Mobile liefern. Für die Berechnung selbst ist keine KI erforderlich.
- **Produktfit:** Die bestätigte Protein-Einordnung unterscheidet Zielbereich, leichte Überschreitung ohne Hinweis und eine konfigurierbare Schwelle für gelegentliche sachliche Coaching-Hinweise. Der Kohlenhydratbereich bleibt Orientierung; außerhalb des Bereichs wird kein negatives Urteil abgeleitet.
- **Domainvalidität:** Die konkreten Werte `1,5–2,0 g/kg` und die Makro-Energiefaktoren stammen aus der User Story, nicht aus einer im KB dokumentierten Expertenentscheidung. Vor Produktivsetzung sollte eine qualifizierte Ernährungsfachperson die Formel und ihre Anwendung über die im Profil zugelassenen Alters- und Gewichtsbereiche prüfen. Der Plan erfindet keine medizinische Empfehlung.
- **AI-Notwendigkeit:** Die Makrobereiche und Zielerreichung werden deterministisch berechnet. Nur der bestehende Daily-Insight-Prompt muss die neue Datenbedeutung einordnen; es wird kein neuer AI-Aufruf eingeführt.
- **Freigabe:** Die Diary-API-Änderung ist ausdrücklich freigegeben und aktualisiert diesen Plan; PO-1 bis PO-6 bleiben unverändert entschieden. Für Sonderaktivitätstage gibt es keinen offenen Makrobereich-Zweig.

## 2. Feature Summary

Protein erhält in jedem der beiden Profil-Tagesziele (`restDay` und `trainingDay`) den Bereich `1,5–2,0 g/kg`. Die Kohlenhydratspanne wird für jeden Profil-Tag separat aus genau dessen Kalorienziel, Proteinbereich und Fettziel abgeleitet. Ein zentraler Shared-Vertrag stellt beide Bereiche allen aktuellen Zielverbrauchern bereit. Eine Sonderaktivität erhöht ausschließlich das effektive Kalorienbudget; die Makrobereiche des ausgewählten Profil-Tages bleiben unverändert und der Bonus wird keinem Makro zugeteilt. Kalorien-, Fett- und Ballaststoffformeln sowie MealItem-Nährwert-Snapshots, Authentifizierung und AI-Quota bleiben unverändert.

## 3. Current Behaviour

| Bereich | Repository-Ist-Zustand |
|---|---|
| Berechnung | `shared/lib/profileCalculator.ts` berechnet Protein als `1,8 g/kg` bei `maintain`, sonst `2,0 g/kg`; Protein, Fett und Kohlenhydrate werden auf 5 g gerundet. Kohlenhydrate sind der Kalorienrest nach Protein und Fett, mindestens 0 g. Ballaststoffe werden auf 1 g gerundet. |
| Datenmodell | `shared/types/nutrition.ts` definiert `DayTargets` mit einzelnen Zahlenfeldern `proteinG` und `carbsG`. `ProfileTargets` enthält Ruhe- und Trainingstagziele. Die aktuellen Profile samt Zielen werden im vorhandenen `profiles`-Container gespeichert. |
| Profil-API/Wizard | Live-Endpunkte sind `GET /api/profile/me`, `POST /api/profile`, `PUT /api/profile` und `POST /api/profile/calculate-preview`. Die Profil-Preview zeigt bereits getrennte Karten für `restDay` und `trainingDay`; `ProfileDetailsScreen` rendert über `TargetsSection` ebenfalls beide Tage. Beide zeigen derzeit Einzelwerte. Die Request-Eingabe bleibt `ProfileInput`. |
| Geplante Zielrouten | `backend/src/functions/nutritionTargets.ts` registriert derzeit nur `501`-Platzhalter. Diese Routen sind kein aktiver Berechnungs- oder Clientpfad und werden nicht als zweite API eingeführt. |
| Diary und Hint Engine | `GET /api/diary` enthält weder `targets` noch `macroRanges`. `backend/src/functions/diary.ts` wählt und verwendet die Profil-Tagesbereiche intern für die serverseitige Hint-Auswertung. `backend/src/lib/hintEngine.ts` verwendet derzeit den Protein-Punktwert in H3/H4/H8/H15/H16/H17/H28. |
| Home Coaching | `mobile/src/modules/home/getDayHint.ts` erzeugt zusätzlich einen eigenen Home-Hinweis anhand von `proteinG`; er ist getrennt vom Server-Hint. |
| Daily Insight | Der aktive Prompt ist v17 (`dailyInsightPrompt.ts`) und wird u. a. aus `promptNutrition.ts` und `promptActivity.ts` zusammengesetzt. `dailyInsightContext.ts` übergibt Einzelziele und `remainingProteinG`; `dailyInsightValidation.ts` schützt vor zusätzlichen Protein- und Mahlzeitenempfehlungen nahe dem Einzelziel. Cache-Identität und gespeicherte Input-Snapshots enthalten die Punktwerte. |
| Andere AI-Prompts | Der aktive Weekly-Insight-Prompt v3 erhält Kalorienziele, aber keine Protein-/Kohlenhydrat-Ziele. Food-, Label-, Meal- und Rezept-Prompts verwenden Produkt-/Rezeptnährwerte, nicht die persönlichen Makroziele. Versionierte Daily-Insight-v3-bis-v9-Dateien sind historische Promptstände; Runtime-Komposition läuft über `dailyInsightPrompt.ts`. |
| Aktivität | `specialActivity.ts` berechnet und speichert `activityBonus` als kcal-Betrag und liefert ein effektives Kalorienziel. `diary.ts` wählt Protein, Fett und Kohlenhydrate weiter aus dem Profilziel des `dayType`; bei Hint-Bewertungen wird nur `targets.calories` um den Bonus erhöht. Home übergibt `DayNutritionCard` das Profil-Tagesziel und den Bonus getrennt. Im belegten Zustand nutzt der Kalorienring `round(baseCalories + activityBonus)` und zeigt den Bonus neben dem Ziel. Bei positivem Bonus rendert `DayNutritionCard` zusätzlich eine fünfte `MacroRow`: ihr Wert ist der Verzehr oberhalb des Basis-Kalorienziels (mindestens 0 kcal), ihr Ziel der gerundete Aktivitätsbonus; sie zeigt derzeit Wert/Ziel, Rest, Prozent und einen Balken. Trotz der Wiederverwendung von `MacroRow` ist dies ein kcal-Zusatzbudget, kein Makroziel. |
| Mobile-Zielanzeigen | Home: `DayNutritionCard.tsx`; Tagebuch: `DayStoryCard.tsx` samt Makro-Breakdown; Profil-Preview: `ProfileWizardScreen.tsx` mit getrennten Ruhe-/Trainingstagskarten; gespeicherte Profilziele: `ProfileDetailsScreen.tsx` über `ProfileSummaryCards.tsx`/`TargetsSection`, ebenfalls getrennt nach Ruhe-/Trainingstag. Die Tagebuchanzeige bezieht Profilziele über die Profile API nur für heute und nur bei vorhandenem Profil; `dayType === 'training'` wählt `trainingDay`, andernfalls `restDay`. Für historische Tage werden keine aktuellen Makroziele rekonstruiert. `MacroSummaryCard.tsx` wird nach Repository-Suche nicht als Komponente gerendert, sein `MacroTarget`-Typ wird aber von aktiven Komponenten importiert. |
| Historie | Es gibt keine historischen Protein-/Kohlenhydrat-Zielsnapshots. Historische Insight-/Wochenvergleiche speichern bzw. bewerten Kalorienziele; historische Makroziele werden nicht rekonstruiert. |

## 4. Desired Behaviour

Für Körpergewicht `w` wird die Berechnung für jeden Profil-Tag `d ∈ {restDay, trainingDay}` separat mit dessen eigenem `kcal_d` und `fatG_d` durchgeführt. Die Protein-Grenzen werden zuerst gerundet; erst danach werden die Kohlenhydratgrenzen gerundet und auf `0 g` begrenzt:

```text
proteinMinG_d = Math.round(1.5 * w)
proteinMaxG_d = Math.round(2.0 * w)
carbsMinG_d   = Math.max(0, Math.round((kcal_d - 4 * proteinMaxG_d - 9 * fatG_d) / 4))
carbsMaxG_d   = Math.max(0, Math.round((kcal_d - 4 * proteinMinG_d - 9 * fatG_d) / 4))
```

Die Protein-Untergrenze ergibt die obere Kohlenhydratgrenze; die Protein-Obergrenze ergibt die untere Kohlenhydratgrenze. Jede Profil-Tagesspanne erfüllt `minG <= maxG`. Bei niedriger Restenergie werden Kohlenhydrate wie bisher nicht negativ. Der Shared-Helper wird mit den Kalorien- und Fettzielen des jeweiligen Profil-Tages aufgerufen; damit enthält `ProfileTargets.restDay` ebenso wie `ProfileTargets.trainingDay` eigene Protein- und Kohlenhydratbereiche. Ruhe-/Trainingstagsziele sind nicht mit einer am konkreten Datum protokollierten Sonderaktivität gleichzusetzen.

Die Einordnung der tatsächlichen Proteinaufnahme verwendet `proteinG / weightKg`: `1.5 <= g/kg <= 2.0` ist inklusive positiv, `2.0 < g/kg <= 2.2` liegt oberhalb des Zielbereichs ohne Hinweis, und nur `g/kg > 2.2` darf gelegentlich einen Hinweis auslösen. `2.2` ist ein zentral konfigurierbarer Coaching-Parameter und keine medizinische Obergrenze. Der bestehende 20-g-Stop für zusätzliche Proteinempfehlungen wird anhand der gerundeten neuen `proteinMinG_d` berechnet. Kohlenhydrate innerhalb ihrer Spanne dürfen neutral/positiv eingeordnet werden; außerhalb der Spanne gibt es keine negative Bewertung oder strikte „zu niedrig/zu hoch“-Aussage.

Für einen Tag mit Sonderaktivität bleiben Protein- und Kohlenhydratbereiche exakt die des ausgewählten Profil-Tages (`restDay`/`trainingDay`). Der bestehende Aktivitätsbonus erhöht nur das effektive Kalorienziel; er wird nicht auf Protein oder Kohlenhydrate verteilt und erzeugt keine temporäre Makro-Zielspanne. Nutzer können die zusätzlichen Kalorien frei verbrauchen. Bestehende qualitative Fueling-Hinweise bleiben davon getrennt.

In Profilansichten und der heutigen Tagebuchansicht ist `proteinMinG..proteinMaxG` beziehungsweise `carbsMinG..carbsMaxG` sichtbar. Die Tagebuchansicht bezieht diese Tagesbereiche aus der Profile API nur bei vorhandenem Profil; `dayType === 'training'` wählt `trainingDay`, andernfalls `restDay`. Historische Tage erhalten kein aktuelles Profil-Makroziel. Feste Fett- und Ballaststoffziele bleiben einzelne Werte. Zielerreichungs- und Coachingregeln verwenden die bestätigte PO-Semantik, nicht die alten Punktwerte.

## 5. Scope

- Gemeinsamer Bereichstyp und reine Bereichsberechnung für beide Profil-Tagesziele (`restDay` und `trainingDay`), jeweils anhand ihrer eigenen Kalorien- und Fettziele.
- Profile-Dokumente sowie Profil-API-Responses und Wizard-Preview.
- Read-Kompatibilität für Profile, die noch keine Bereichsfelder gespeichert haben.
- Server-Hint-Regeln, Home-Hinweis und aktueller Daily-Insight-Kontext/Prompt/Validierung.
- Profile-Preview und gespeicherte Profilzielanzeigen beider Tagesarten sowie Tagebuch- und Home-Anzeigen aller aktiven Makro-Zielverbraucher; die Tagebuchanzeige nutzt Profile-API-Ziele nur für heute und nur bei vorhandenem Profil, historische Tage erhalten kein aktuelles Profilziel.
- Vereinfachte vier Makrobalken auf Home mit Bereichsschraffur, festen Zielmarken und expliziter Überschreitungsskala nach PO-5.
- Separate Aktivitätsbonus-Zeile bei positivem Bonus beibehalten und im vereinfachten Home-Look darstellen; sie bleibt ein kcal-Zusatzbudget und von den vier Makro-Zielbalken getrennt.
- Gezielte Unit-, Handler-, Cosmos-Contract-, Prompt-Eval-, Typ- und UI-Prüfungen.
- KB-Aktualisierung für Berechnungsmodell, API, Hints, AI und geänderte Zielvisualisierung.

## 6. Out of Scope

- Änderung der Kalorienbedarfsformel, Kalorien-Minimums, Fett- oder Ballaststoffformel.
- Änderungen an `MealItem.macros`, Food-Katalogdaten, Rezeptnährwerten oder beim Logging gespeicherten Nährwert-Snapshots.
- Neue Endpunkte, Request-Felder, Authentifizierungsregeln, AI-Aufrufe, Quota-Schlüssel oder Structured-Output-Felder.
- Historische Makro-Zielsnapshots, rückwirkende Wochen-/Tagesbewertungen oder ein Makro-History-Backfill.
- Änderungen am Weekly-Insight-Prompt, solange dieser keine persönlichen Makroziele erhält.
- Implementierung der derzeitigen `501`-Platzhalter in `nutritionTargets.ts`.
- Bicep-, Container-, App-Setting-, EAS- oder Dependency-Änderungen.
- Alpha-Deployment oder ein neuer Mobile-Build als Featurearbeit.

## 7. Confirmed Facts und Dokumentationskonflikte

- Die laufende Implementierung ist die Verhaltensquelle. Die vorhandenen Profile enthalten nur aktuelle Ruhe-/Trainingstagsziele; sie speichern keine historischen Makroziele.
- `calculateProfileTargets()` berechnet Kalorien und Makros getrennt für `restDay` und `trainingDay`; die neue Range-Berechnung muss deshalb beide Profilziele separat aktualisieren. Wizard-Preview und gespeicherte Profilzielansicht rendern heute bereits beide Tagesarten.
- Sonderaktivitäten sind ein eigener, datumsbezogener Kalorienbonus und keine dritte Profil-Tagesart. Der Code ändert am ausgewählten Profilziel nur `calories`; die Makroziele bleiben unverändert. Der Aktivitätsprompt kann bei langer/intensiver Belastung qualitativ Kohlenhydrate/Energie als Fueling erwähnen; das ist kein Makroziel und keine numerische Bonuszuteilung. PO-2 bestätigt dieses kalorische Prinzip.
- `docs/kb/domain/01-nutrition-model.md` beschreibt `DayTargets` derzeit ohne die implementierten Feldnamen mit `G`-Suffix (`proteinG`, `carbsG`, `fatG`, `fiberG`). Die Implementierung ist maßgeblich; die KB ist bei der Dokumentationsarbeit zu korrigieren.
- `docs/kb/domain/04-profile-goals.md` weicht beim Activity-Level-Fallback und bei `gain_muscle`-Kalorienanpassungen vom aktuellen `shared/lib/profileCalculator.ts` ab. Aktueller Code: PAL `1.40/1.55/1.70/1.90` für `sedentary/light/active/very_active`, `gain_muscle` `+200/+350/+500 kcal` für `gentle/moderate/aggressive`. Die Story ändert diese Kalorienregeln nicht; die KB soll den Ist-Code dokumentieren und nicht im Rahmen dieser Story die Berechnung angleichen.
- `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` umfasst ebenfalls die Profil-Tageszielanzeige. Frontend muss den tatsächlichen R2-Handoff prüfen und die bestehenden `TargetsSection`-/Profil-Details wiederverwenden; keinen zweiten Profilbereich bauen.

## 8. Compatibility, Data Model und API

**Kann das Ziel ohne Änderung des Shared-/Profil-Vertrags erreicht werden? Nein.** Ein einzelner Zahlenwert in `DayTargets` kann zwei Bereichsgrenzen nicht verlustfrei darstellen. Ein neuer gemeinsamer Bereichsvertrag ist notwendig.

**Empfohlene kompatible Änderung:** `DayTargets` erhält einen additiven `macroRanges`-Block, zum Beispiel:

```ts
macroRanges: {
  proteinG: { minG: number; maxG: number };
  carbsG: { minG: number; maxG: number };
};
```

- **Diary-API (unverändert):** `GET /api/diary` enthält weder `targets` noch `macroRanges`; Response, Route, Request-Form, Persistenz und Auth bleiben unverändert. Der Backend-Handler wählt und verwendet die Profil-Tagesbereiche intern für die Hint-Auswertung. Das effektive Kalorienziel enthält den Bonus; die Protein- und Kohlenhydratbereiche bleiben die des ausgewählten Profil-Tages. Es gibt keine separate Aktivitäts-Makrospanne und keinen historischen Makro-Snapshot. Die mobile Tagebuchanzeige bezieht Profilziele über die Profile API nur für heute und bei vorhandenem Profil; historische Tage erhalten kein aktuelles Profilziel.
- **Daily Insight:** Die öffentliche Responseform bleibt unverändert; `promptVersion` steigt auf v18. Der interne `InsightInputContext` verwendet weiterhin die normalisierten Profilbereiche und erhält ein explizites Signal für die Restmenge bis zur Protein-Untergrenze. Neue Inputs fließen in Cache-Identität und Prompt-Fingerprint ein.
- **Weekly Insight:** Request und Response bleiben unverändert und bleiben kalorienbasiert. Makro-Zielvergleiche für historische Tage werden nicht erfunden.
- **Profile-Persistenz und API:** Optionale `macroRanges`-Daten werden im vorhandenen Profil-Dokument unter `targets` ergänzt. Die Profile-API-Antworten von GET, POST, PUT und Preview enthalten die Bereiche für beide Profil-Tage; `ProfileInput` bleibt unverändert. **Persistence Impact: Class 1 — Read compatibility.** Für Legacy-Dokumente berechnet der Server den fehlenden Block deterministisch aus vorhandenem `weightKg`, `calories` und `fatG`; der GET-Pfad schreibt keine Migration. Ein normales späteres Profil-Update speichert die neuen Bereiche. Keine Container-, Partition-Key-, `cosmos.ts`- oder Bicep-Änderung.
- **Insight-Persistenz:** `InsightDocument.inputContext` und Feedback-Snapshots liegen im bestehenden AI-Insights-Modell. Neue Range-/Gap-Felder bleiben für alte gespeicherte Snapshots optional. **Persistence Impact: Class 0 — kein Backfill.** Alte Snapshots bleiben unverändert; Promptversion und Hash verhindern, dass neue Berechnungen v17-Eingaben als aktuellen v18-Kontext behandeln.
- **Rollout:** Backend/Shared-Vertrag wird im Development bereitgestellt bzw. im bestehenden lokalen Development-Runtime geprüft, bevor neue Mobile-Clients dagegen getestet werden. Alte Profile brauchen keine Batch-Migration. Alpha-Rollout ist kein Bestandteil dieses Plans.

Würde man die bisherigen Felder durch Objekte ersetzen, sie entfernen oder ihre Zahlen stillschweigend auf eine neue Kante umdeuten, wäre das ein inkompatibler API-/Persistenzwechsel. Dieser Weg wird nicht empfohlen.

## 9. Existing Components to Reuse

- `shared/lib/profileCalculator.ts` für den bestehenden Ruhe-/Trainingstags- und Kalorienpfad.
- Ein neuer schmaler Pure-Helper unter `shared/lib/` für die je Profil-Tag getrennte Bereichsberechnung und gemeinsame Range-Prädikate; eine zentral definierte, konfigurierbare Protein-Hinweis-Schwelle mit Default `2.2 g/kg`; keine duplizierte Range- oder Schwellenberechnung in Backend-Handlern oder UI-Komponenten.
- `shared/types/nutrition.ts` und bestehender `ProfileTargets`-Vertrag.
- `backend/src/lib/hintEngine.ts` als deterministische Regelengine; keine AI für Hint-Entscheidungen.
- Aktive Daily-Insight-Komposition `dailyInsightPrompt.ts` samt bestehenden Promptmodulen, Fingerprint, Cache und Eval-Gates.
- Profile-API, Profil-Wizard, `TargetsSection`, `DayStoryCard`, Home-`DayNutritionCard` und vorhandene `react-native-svg`-Abhängigkeit.
- Aktuelle Theme-Tokens und Makrofarben; keine neue Bibliothek und keine neue native Konfiguration.

## 10. Proposed Technical Solution

### 10.1 Shared Calculation und Target-Vertrag

Range-Grenzen und gemeinsame Statusfunktionen gehören in Shared-Pure-Code. `calculateProfileTargets()` ruft den Helper für beide Profil-Tagesziele separat auf und übergibt jeweils deren eigenes Kalorien- und Fettziel. Die so entstehenden Range-Blöcke liegen sowohl unter `targets.restDay` als auch `targets.trainingDay`. Backend-Value-Imports aus `@fittrack/shared` bleiben gemäß Importregel relative Imports aus `shared/lib/`; Typimporte dürfen den Package-Alias verwenden.

Die alte Profilberechnung für Kalorien, Fett und Ballaststoffe bleibt wertgleich. Die bisherigen skalaren Felder `proteinG`/`carbsG` bleiben für ältere Mobile-Clients numerisch und behalten ihre bestehende Einzelwertsemantik; neue Ziel- und Coachingpfade verwenden ausschließlich `macroRanges` und leiten keinen Status aus den Skalarfeldern ab.

### 10.2 Profil-Read-Kompatibilität und API

Neuberechnungen und Preview erzeugen Range-Felder für Ruhe- und Trainingstag getrennt. Beim Lesen eines Legacy-Profils ohne Range-Felder leitet ein gemeinsamer Backend-Resolver beide Bereiche aus Gewicht sowie den jeweiligen Tageskalorien- und Fettzielen ab. Profile GET/POST/PUT und Preview liefern die Bereiche aus; der Resolver darf alte Dokumente bei einem GET nicht überschreiben. Der Diary-Handler verwendet die normalisierten Bereiche des ausgewählten Profil-Tages intern für die Hint-Auswertung; Daily Insight verwendet weiterhin die normalisierten Profilbereiche intern. `GET /api/diary` erhält dafür keine `targets`- oder `macroRanges`-Felder. Für heutige mobile Tagebuchziele ist die Profile API die Quelle; bei vorhandenem Profil wählt `dayType === 'training'` `trainingDay`, andernfalls `restDay`. Historische Tagebuchtage erhalten kein aktuelles Profil-Makroziel. Für Legacy-Profile verwendet der Resolver ausschließlich das Gewicht sowie die Basis-Kalorien- und Fettziele des jeweiligen Profil-Tages; `activityBonus` und das effektive Tageskalorienziel fließen nicht in die Bereichsberechnung ein.

`CalculationMeta.formulaVersion` erhält eine neue Version für Neuberechnungen, damit Profile mit dem bisherigen und dem neuen Zielmodell unterscheidbar bleiben. Alte Versionswerte bleiben lesbar; es erfolgt kein Backfill.

### 10.3 Regeln, Insights und AI

- Hint Engine: Proteinregeln H3/H4/H8/H15/H17/H28 und die Makroprüfung H16 nutzen die zentralen Bereiche und die bestätigte PO-3/PO-4-Semantik. Der Server bewertet Protein-Bänder und die konfigurierbare `2.2 g/kg`-Hinweis-Schwelle deterministisch; die Schwelle wird nicht vom Modell berechnet. Werte über `2.0` bis einschließlich `2.2 g/kg` bleiben ohne Hinweis; über `2.2 g/kg` ist ein gelegentlicher sachlicher, nicht-medizinischer Hinweis zulässig. Die zusätzliche Proteinempfehlungs-Sperre bleibt bei höchstens `20 g` Abstand zur neuen Untergrenze. H5 (Ballaststoffe), Kalorienregeln und bestehende Cooldowns bleiben unverändert.
- Home-Hinweis: `getDayHint()` verwendet denselben Shared-Helper wie Backend-Hints; es bleibt kein clientseitiger Vergleich gegen den alten Einzelwert.
- Daily Insight: `dailyInsightContext.ts` liefert Range-Grenzen, eine explizite Proteinlücke bis zur Untergrenze und ein deterministisch bestimmtes Protein-Coaching-Band. `dailyInsightValidation.ts`, der aktive v17-Prompt sowie `promptNutrition.ts` und `promptActivity.ts` werden semantisch auf Range-Verhalten umgestellt. Der v18-Provider-Input projiziert nur die neuen Bereiche und expliziten Coaching-Signale; Legacy-Einzelwerte dürfen nicht an das Modell gesendet werden, selbst wenn sie für alte gespeicherte Kontexte lesbar bleiben. Die Beispiel-Formulierung für hohe Proteinaufnahme ist optional und an aktuelle Produkt-Tonality anzupassen. Bestehende Aktivitätssprache zu qualitativem Fueling, Flüssigkeit und Erholung bleibt erhalten; Sonderaktivitätstage verwenden unverändert die Bereiche des ausgewählten Profil-Tages, und der Bonus wird keinem Makro zugeordnet.
- Prompt-Version: v17 → v18; Manifest, Fingerprint, Input-Hash, Unit-/Handler-Tests und `TESTED_PROMPT_VERSION` werden aktualisiert. Der aktive Weekly-Prompt bleibt unverändert, solange er keine Makroziele erhält.
- AI-Schema, öffentliche Insight-Antwort, Quota-Reihenfolge und neutrales Fehlerverhalten bleiben unverändert. Änderungen an Promptinterpretation benötigen die vorgeschriebenen Live-Evals. Bei Sonderaktivitäten bleibt der Bonus ein Kalorienbudget; qualitative Fueling-Aussagen bleiben möglich, dürfen aber keine numerische Protein-/Kohlenhydrat-Zielerhöhung oder Bonuszuordnung behaupten.

### 10.4 UI und Balken

- Profil-Wizard-Preview und gespeicherte Profil-Tageszielansicht zeigen für Ruhetag und Trainingstag jeweils Protein-/Kohlenhydratspannen als Ist-Wert plus Bereich. Die beiden Tageskarten verwenden ihre jeweils eigenen Profilziele; Kalorien, Fett und Ballaststoffe bleiben Einzelwerte.
- Tagebuchdetails und Breakdown verwenden für Protein/Kohlenhydrate die neuen Grenzen statt einer Zahl, aber nur für den heutigen Tag und wenn Profilziele vorhanden sind. Die mobile Anzeige bezieht sie über die Profile API; `dayType === 'training'` wählt `trainingDay`, andernfalls `restDay`. `GET /api/diary` bleibt ohne `targets` und `macroRanges`. Auch heute mit Sonderaktivität gelten unverändert die Bereiche des gewählten Profil-Tages; der Aktivitätsbonus erzeugt keine Makrospanne. Für historische Tage wird kein aktuelles Profil-Makroziel angezeigt oder rekonstruiert.
- Home `DayNutritionCard` zeigt vier Makro-Zielbalken. Protein/Kohlenhydrate erhalten Schraffur zwischen min/max; Fett/Ballaststoffe eine Zielmarke. Der Referenzwert ist jeweils die obere Bereichsgrenze oder das feste Ziel. Der 100-%-Marker liegt bei einer für alle vier Balken identischen Trackposition.
- Für die bestätigte PO-5-Geometrie ist `maxScale = 1.5 × referenceTarget`, `markerX = referenceTarget / maxScale = 2/3`, `fillX = clamp(actual / maxScale, 0, 1)` und die Schraffur liegt zwischen `min/maxScale` und `max/maxScale`. Die eigentlichen Grammwerte bleiben sichtbar. Es gibt keine Prozent-, Rest-, Status- oder Badge-Texte in den vier Makrozeilen; Füllfarbe wechselt bei Überschreitung nicht.
- **Separate Aktivitätsbonus-Zeile (PO-6):** Die fünfte Zeile bleibt bei positivem `activityBonus` erhalten und wird nach den vier Makrobalken als eigener, dezent abgesetzter Aktivitätsabschnitt gezeigt. Sie behält das Label `Aktivitätsbonus` und zeigt den bereits verwendeten kcal-Wert gegen den gerundeten Bonus (`x / y kcal`); der Fortschritt behält die bestehende Semantik: Verzehr oberhalb des Basis-Kalorienziels gegen den Aktivitätsbonus, bei 0 gedeckelt und visuell am Trackende begrenzt. Eine dünne, gleich hohe Trackdarstellung passt zum neuen Balken-Look. Als klar nicht-makro Akzent wird der vorhandene Token `colors.chart.specialActivityOutline` verwendet; keine Makrofarbe, keine Bereichsschraffur und keine Makro-Zielmarke. Für diese Zeile bedeutet die volle Trackbreite 100 % des Bonus (keine PO-5-150-%-Skala und kein 2/3-Marker). Die sichtbaren Werte und Screenreader-Angaben bleiben kcal-genau; Prozent-, Rest- und Statusangaben entfallen. Bei positivem Bonus bleibt die Zeile auch bei 0 kcal Verzehr sichtbar und zeigt dann `0 / y kcal`.
- Kalorienring, seine Basis, das effektive Ziel (`round(baseCalories + activityBonus)`) und die bestehende Bonusanzeige bleiben unverändert. Die Bonuszeile ist ausdrücklich zusätzlich zu und nicht Teil der vier Makro-Zielbalken.
- Schraffur und Marker werden mit vorhandenen React-Native-/SVG-Bausteinen gerendert. Keine neue Dependency; Accessibility-Angaben nennen für die vier Makros Ist-Wert und Zielbereich, für die separate Bonuszeile den tatsächlichen kcal-Verbrauch und Bonusbetrag.

## 11. Backend Work Packages

### WP-B1: Shared-Berechnung, Profilmodell und Profil-API

**Agent:** Backend

**Status:** Complete.

**Goal:** Shared-Zielbereichsberechnung samt Legacy-Read-Kompatibilität einführen und die vier aktiven Profile-API-Antworten additiv erweitern; Diary GET bleibt unverändert.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/04-profile-goals.md`

**Required Repository Context:**
- `shared/types/nutrition.ts`
- `shared/types/profile.ts`
- `shared/lib/profileCalculator.ts`
- `shared/lib/profileCalculator.test.ts`
- `backend/src/functions/profile.ts`
- `backend/src/functions/profile.test.ts`
- `backend/src/lib/repositories/profileRepository.ts`
- `backend/src/lib/repositories/cosmosProfileRepository.ts`
- `mobile/src/shared/api/profileApi.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-4, AC-5, AC-13, AC-14.

**Dependencies:** Plan approval is recorded. The `macroRanges` contract defined in sections 8 and 10.1 is the implementation contract. PO-1 is resolved.

**Persistence Impact:** Class 1 — optional profile range fields are derived from existing profile weight, per-day calories and fat target when absent. No explicit migration, backfill, new container or infrastructure change. Legacy documents must pass read-compatibility tests.

**Expected Handoff:** Shared range type/helper; both `restDay` and `trainingDay` ranges computed with their own profile calories/fat; passing formula/rounding tests; ranges in Profile GET/POST/PUT/preview responses; legacy profile read behavior; unchanged `ProfileInput` request contract. `GET /api/diary` remains unchanged and exposes neither `targets` nor `macroRanges`.

### WP-B2: Hint Engine, Daily Insight und AI-Prompt-Anpassung

**Agent:** Backend

**Status:** Complete.

**Goal:** Alle aktiven serverseitigen Makro-Bewertungen verwenden die zentralen Protein-/Kohlenhydratbereiche, ohne bestehende Kalorien- und Activity-Sicherheitsregeln abzuschwächen.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`

**Required Repository Context:**
- `backend/src/functions/diary.ts`
- `backend/src/lib/hintEngine.ts`
- `backend/src/lib/hintEngine.test.ts`
- `backend/src/lib/dailyInsightContext.ts`
- `backend/src/lib/dailyInsightValidation.ts`
- `backend/src/lib/dailyInsightValidation.test.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/prompts/promptNutrition.ts`
- `backend/src/lib/prompts/promptActivity.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `shared/types/insight.ts`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-3, AC-6, AC-7, AC-8, AC-9, AC-14.

**Dependencies:** WP-B1 handoff and plan approval are complete. PO-2, PO-3 and PO-4 are resolved. Use the selected profile-day macro ranges unchanged on special-activity days; only the existing calorie target includes `activityBonus`. No old scalar field may be authoritative in new paths. The Diary handler uses profile-day ranges internally; do not add range fields to the Diary response.

**Implementation Focus:** Update H3/H4/H8/H15/H16/H17/H28 with explicit edge tests; move Daily Insight’s protein-gap and 20-g policy to the approved range interpretation; include the range in canonical cache identity; increment active Daily Insight prompt version to v18; update prompt manifest/fingerprint and live eval guard. The v18 provider projection must omit legacy scalar protein/carbohydrate targets while retaining them only where required for old persisted context compatibility. For a special activity, keep the profile-day protein/carbohydrate ranges unchanged and do not allocate bonus calories to a macro; preserve existing qualitative activity-completion/fueling language without numeric macro claims. Keep quota, AI result schema, endpoint response shape, and historical calorie provenance unchanged. Do not edit archived v3-v9 prompt snapshots or the calorie-only Weekly Insight prompt.

**Persistence Impact:** Class 0 — new optional fields in persisted Daily Insight/feedback context snapshots. Legacy snapshots remain readable and unchanged; no data migration or backfill. New cache identity must include both range boundaries and the new gap signal.

**Expected Handoff:** Passing hint/context/validation/cache tests; v18 prompt manifest and fingerprint; prompt eval fixture/version update; recorded live-eval result or explicit `UNVERIFIED` reason; confirmation that quota, response schema and Weekly Insight are unchanged.

### WP-B3: Backend-, Shared- und Domain-KB aktualisieren

**Agent:** Backend

**Status:** Complete.

**Goal:** Knowledge Base auf den tatsächlich implementierten Vertrag und die bestätigte neue Zielsemantik bringen.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `shared/types/nutrition.ts`
- `shared/lib/profileCalculator.ts`
- `backend/src/functions/profile.ts`
- `backend/src/functions/diary.ts`
- `backend/src/lib/hintEngine.ts`
- `backend/src/lib/dailyInsightContext.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.ts`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1 through AC-9, AC-13, AC-14.

**Dependencies:** WP-B1 and WP-B2; implementation evidence for final field names and behavior. Document the confirmed calorie-only special-activity policy and unchanged profile macro ranges.

**Expected Handoff:** KB reflects the current implementation; `tech/09-api-reference.md` records that Profile GET/POST/PUT/preview return ranges while Diary GET has no `targets` or `macroRanges`; `domain/02-diary.md` records internal hint use and the Profile API as the source for today's mobile diary targets, with no historical target inference. `domain/04-profile-goals.md` records the verified current calorie constants and new macro-range formula without changing those constants in code.

## 12. Frontend Work Packages

### WP-F1: Wizard- und Profil-Tageszielanzeigen

**Agent:** Frontend

**Status:** Complete.

**Goal:** Profile Wizard, Profilübersicht und bestehende `TargetsSection` zeigen die neuen Bereiche und behalten Layout-/Navigationsentscheidungen des Profil-Redesigns bei.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/shared/api/profileApi.ts`
- `mobile/src/modules/profile/ProfileWizardScreen.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.test.tsx`
- `mobile/src/modules/profile/ProfileDetailsScreen.tsx`
- `mobile/src/modules/profile/ProfileDetailsScreen.test.tsx`
- `mobile/src/modules/profile/ProfileSummaryCards.tsx`
- `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-5, AC-10, AC-13, AC-14.

**Dependencies:** WP-B1; der Orchestrator bestätigt den tatsächlichen R2-Status und integriert beide Bereiche in die vorhandene Wizard-Preview und Profil-Tageszielansicht, statt einen zweiten Screen zu erstellen.

**Expected Handoff:** Wizard-Preview (`restDay` und `trainingDay`) und gespeicherte Profil-Tageszielansicht (`ProfileDetailsScreen`, beide Tage) zeigen dieselben bestätigten Protein-/Kohlenhydratbereiche; feste Kalorien-, Fett- und Ballaststoffwerte bleiben gleich.

### WP-F2: Tagebuch-Makrodetails und Home-Coaching

**Agent:** Frontend

**Status:** Complete.

**Goal:** Aktive Tagebuch-/Coachingansichten verwenden dieselben Range-Werte; heutige Tagebuchziele kommen aus der Profile API, historische Tage erhalten kein aktuelles Profil-Makroziel.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/nutrition/DiaryScreen.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`
- `mobile/src/shared/components/DayStoryCard.tsx`
- `mobile/src/shared/api/profileApi.ts`
- `mobile/src/shared/components/MacroSummaryCard.tsx`
- `mobile/src/modules/home/getDayHint.ts`
- `mobile/src/modules/home/getDayHint.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-3, AC-6, AC-7, AC-8, AC-9, AC-10, AC-14.

**Dependencies:** WP-B1, WP-B2; PO-2, PO-3 und PO-4 sind entschieden. Tagebuch und Home-Coaching verwenden auch an Sonderaktivitätstagen die unveränderten Profil-Tagesbereiche. Tagebuchhistorie nutzt weiterhin keine erfundenen historischen Makroziele.

**Expected Handoff:** Keine aktive Tagebuch-/Home-Coachinganzeige wertet Protein/Kohlenhydrate gegen einen Legacy-Punktwert oder einen Aktivitätsbonus aus. Die Tagebuchanzeige nutzt Profile-API-Ziele nur für heute und bei vorhandenem Profil; `dayType === 'training'` wählt `trainingDay`, andernfalls `restDay`. `GET /api/diary` liefert keine Zielbereiche, und historische Tage erhalten kein aktuelles Profil-Makroziel. Zielbereich, Breakdown und Hint stimmen an den Grenzwerten und an Sonderaktivitätstagen mit den ausgewählten Profilbereichen überein.
### WP-F3: Home-Makrobalken und Überlaufdarstellung

**Agent:** Frontend

**Status:** Complete. PO-2, PO-5 und PO-6 sind entschieden.

**Goal:** Bestehende Home-Makrobalken vereinfachen und Bereichs-/Festzielmarken mit einer einheitlichen 100-%-Position korrekt zeichnen.

**Required Knowledge Base:**
- `docs/kb/tech/03-mobile.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/shared/components/MacroSummaryCard.tsx`
- `mobile/src/app/theme/index.ts`
- `mobile/package.json`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-3, AC-4, AC-11, AC-12, AC-14.

**Dependencies:** WP-B1, WP-F2 and the confirmed decisions PO-2, PO-5 and PO-6. The four profile-range bars always use the selected profile-day targets; the retained activity row is a separate kcal allowance indicator.

**Implementation Focus:** Denominator/Trackgeometrie als testbarer Pure-Helper; vier stabile Makrobalken; Schraffur nur für Protein-/Kohlenhydratbereiche; vertikale Marken für Fett/Ballaststoffe; gleiche Referenzposition; durchgehende Makrofarbe; keine sichtbaren Prozent-, Rest-, Status- oder Badge-Angaben. Zusätzlich die separate Aktivitätsbonus-Zeile gemäß der in Abschnitt 10.4 festgelegten Darstellung erhalten und im Empty-/0-kcal-Zustand bei positivem Bonus sichtbar halten. Sie zeigt ausschließlich kcal, verwendet den dort festgelegten Aktivitätsakzent und ihre eigene 100-%-Trackskala, nicht die Makro-Range-Geometrie. Kalorienring und Bonusberechnung bleiben unverändert. Overflow-Clamping ist nur ein Renderlimit; Ist-Werte werden exakt angezeigt.

**Expected Handoff:** Unit-Tests für min/max/fixed/0/über 100 %/Renderlimit und Bonuszeilenwerte; UI-Prüfung, dass die vier Makro-Zielmarken exakt fluchten, die separate Bonuszeile keine Makro-Zielsemantik nahelegt, keine Inhalte überlagert werden und Ring/Ziel/Bonusanzeige unverändert bleiben.
### WP-D1: Product-/UX-KB aktualisieren

**Agent:** Frontend

**Status:** Complete.

**Goal:** Die Produkt-/UX-Dokumentation an die genehmigte Profil- und Home-Makrozielanzeige anpassen.

**Required Knowledge Base:**
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/modules/profile/ProfileSummaryCards.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.tsx`

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-10, AC-11, AC-12, AC-14.

**Dependencies:** WP-F1, WP-F2 und WP-F3; fertige UI-Implementierung und die in Abschnitt 10.4 festgelegte Darstellung der separaten Aktivitätsbonus-Zeile.

**Expected Handoff:** Product-/UX-KB beschreibt die tatsächlich gelieferte Zielbereichsanzeige und Home-Balkengeometrie, ohne neue Verhaltenserwartungen einzuführen.

## 13. QA Work Package

### WP-QA1: Cross-Package- und Kompatibilitätsprüfung

**Agent:** QA

**Status:** Next.

**Goal:** Alle Akzeptanzkriterien, Daten-/API-Kompatibilität, AI-Sicherheit, Makro-Bewertungen und Home-Visualisierung einschließlich der separaten kcal-Aktivitätsbonus-Zeile gegen diesen freigegebenen Plan prüfen. Diary GET muss ohne `targets` und `macroRanges` bleiben; heutige mobile Tagebuchziele müssen aus der Profile API stammen.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/04-shared-library.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/02-diary.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**
- `shared/lib/profileCalculator.test.ts`
- `backend/src/functions/profile.test.ts`
- `backend/src/functions/diary.test.ts`
- `backend/src/functions/diary.ts`
- `backend/src/lib/hintEngine.test.ts`
- `backend/src/lib/dailyInsightValidation.test.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`
- `backend/src/lib/repositories/cosmosProfileRepository.ts`
- `mobile/src/modules/profile/ProfileWizardScreen.test.tsx`
- `mobile/src/modules/profile/ProfileDetailsScreen.test.tsx`
- `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`
- `mobile/src/shared/api/profileApi.ts`
- `mobile/src/modules/home/getDayHint.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/shared/components/DayStoryCard.tsx`

**Required Skills:**
- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1 through AC-14.

**Dependencies:** WP-B1, WP-B2, WP-F1, WP-F2, WP-F3, WP-B3 und WP-D1. PO-1 bis PO-6 sind entschieden; QA prüft, dass Sonderaktivitäten nur das effektive Kalorienziel erhöhen und die separate Bonuszeile nicht mit den vier Makro-Zielbalken verwechselt werden kann.

**Expected Handoff:** QA-Report unter dem vom Orchestrator vorgegebenen Pfad mit Kriterienmatrix, Testbefehlen/Exit-Codes, explizitem Nachweis, dass Diary GET weder `targets` noch `macroRanges` enthält, Profile-API-Quell- und Tagesauswahltests, dokumentierter Legacy-Profilprüfung, AI-Eval-Status und separaten `UNVERIFIED`-/`MANUAL VALIDATION REQUIRED`-Checks. Der Legacy-Profil-Cosmos-Contract ist mangels lokalem Cosmos-Emulator `UNVERIFIED`; physische Geräte- und Screenreader-UI-Validierung wurde nicht durchgeführt und bleibt `MANUAL VALIDATION REQUIRED`.

## 14. Shared Package Changes

- Range-Typ für Protein und Kohlenhydrate in `shared/types/nutrition.ts`.
- Ein zentraler Pure-Helper zur Berechnung und Validierung `minG <= maxG` sowie „Protein ausreichend/im Band“-Semantik. Die Home-Trackgeometrie bleibt eine Darstellungsaufgabe; es gibt keine Aktivitätsbonus-Makroberechnung.
- `shared/lib/profileCalculator.ts` ruft die Range-Berechnung auf; keine getrennte Kopie in Backend oder Mobile.
- Tests für Gewichte mit Rundungsgrenzen, beide Tagesziele, alle GoalTypes, exakte Unter-/Obergrenze, Kohlenhydrat-Reihenfolge und 0-g-Guardrail.
- Backend importiert Shared-Werte gemäß KB mit relativen Pfaden; keine Laufzeit-Value-Imports aus `@fittrack/shared`.

## 15. Infrastructure and Configuration (Development + Alpha)

- Keine Bicep-, Cosmos-Container-, Partition-Key-, App-Setting-, Quota- oder EAS-Konfigurationsänderung.
- `Infrastructure Impact: Dev` bedeutet Prüfung im bestehenden Development-Setup mit lokalem Functions-Host und passender Emulator-/Dev-Datenquelle. Es ist keine neue Cloud-Ressource und kein Infrastructure-&-Release-Work-Package erforderlich.
- `Mobile Build Impact: None`: ausschließlich TypeScript-/JavaScript-Änderungen; keine nativen Module, Config-Plugins oder `app.config.js`-Änderungen.
- **Dev Build Required:** finale Entscheidung durch Infrastructure & Release; Planner-Signal ist JS-only/keine Native-Änderung.
- Eine spätere Alpha-Veröffentlichung ist ein separater direkter Releaseauftrag nach Merge und QA, nicht Bestandteil dieses Featureplans. Hier wird nichts deployed oder gestartet.

## 16. Documentation Updates

Dokumentationsarbeit liegt vor QA und ist in WP-B3/WP-D1 sequenziert:

- `docs/kb/domain/01-nutrition-model.md`: echte `DayTargets`-Feldnamen, Bereichsvertrag, inklusive Proteinsemantik und Kohlenhydrat-Richtbereich.
- `docs/kb/domain/04-profile-goals.md`: bestätigte Range-Formel; vorhandene Abweichungen von PAL-/Gain-Muscle-Werten zwischen KB und Code korrekt dokumentieren, ohne die unveränderte Berechnung nebenbei anzupassen.
- `docs/kb/domain/02-diary.md`: aktuelle Hint-Bewertung und interne Verwendung der Profil-Tagesbereiche dokumentieren; Diary GET enthält weder `targets` noch `macroRanges`; die mobile Tagebuchanzeige bezieht heutige Profilziele über die Profile API, historische Tage erhalten kein aktuelles Makroziel. Kalorischen Sonderaktivitätsbonus und qualitative Fueling-Sprache klar trennen; Sonderaktivitätstage verwenden unveränderte Protein-/Kohlenhydratbereiche und erhalten keine numerische Makrobonusspanne.
- `docs/kb/tech/04-shared-library.md` und `docs/kb/tech/09-api-reference.md`: Shared-/Profile-Response-Vertrag und Legacy-Kompatibilität; Profile GET/POST/PUT/preview liefern Bereiche, Diary GET bleibt ohne `targets` und `macroRanges`.
- `docs/kb/domain/07-ai-features.md` und `docs/kb/tech/06-ai-integrations.md`: aktive Daily-Insight-Promptversion und neue Range-/Gap-Semantik; Weekly Insight bleibt kalorienbasiert.
- `docs/kb/product/03-design-system.md`: endgültige Makrobalken-Geometrie, Range-Schraffur, feste Zielmarker, entfernte Statusangaben und die eigenständige kcal-Aktivitätsbonus-Zeile.

- Die User Story bleibt unverändert. Sie legt keine Aktivitätsbonus-Zuteilung zu Makros fest und widerspricht der bestätigten PO-2-Entscheidung nicht; die technischen Entscheidungen sind in diesem Plan dokumentiert.

## 17. Test Strategy

- **Shared:** reine Rechentests mit mehreren Gewichten und Rundungsgrenzen; beide Profilziele separat mit ihren jeweiligen Kalorien-/Fettwerten; alle GoalTypes; Minimal-Kalorien-Fälle; Null-/Überlauf; Invarianten `0 <= minG <= maxG`.
- **Profile/API:** Handler-Tests für Profile GET, POST, PUT und Preview; identische `ProfileInput`-Form; Legacy-Profil ohne Bereichsfeld; bestehende Kalorien-/Fett-/Ballaststoffwerte unverändert. Der Diary-Handler-/Contract-Test muss explizit bestätigen, dass `GET /api/diary` weder `targets` noch `macroRanges` enthält und Route, Request, Persistenz und Auth unverändert bleiben.
- **Cosmos:** Contract-Test mit einem im Emulator gespeicherten Legacy-Profil ohne Range-Felder; Lesen muss erfolgreich bleiben und die Antwort deterministisch ergänzen. Für den Legacy-Profil-Cosmos-Contract steht derzeit kein lokaler Emulator zur Verfügung; die Emulator-Prüfung bleibt `UNVERIFIED`. Keine Tests gegen Dev-/Alpha-Cosmos.
- **Hints:** Protein-Bandtests für exakt `1.5`, `2.0`, `2.2` und knapp über `2.2 g/kg`; `2.0` bleibt positiv, `(2.0, 2.2]` löst keinen Hinweis aus, nur Werte über `2.2` sind hinweisfähig. Prüfen, dass der 20-g-Stop gegen die gerundete neue Untergrenze gilt und bestehende Cooldowns eingehalten werden. H16: innerhalb der Kohlenhydratspanne neutral/positiv möglich, außerhalb weder negativ noch strikt; Kalorien-/Faserregeln unverändert.
- **Daily Insight:** Context-, Input-Hash-, Cache-, Feedback-Snapshot-, Validator- und Prompttests; Protein-Coaching-Band deterministisch vorgeben; optionale, gelegentliche hohe-Protein-Hinweise ohne medizinische Obergrenzen-Aussage; Activity planned/unknown/likely_completed; kein Zusatzprotein nach der bestätigten 20-g-Sperre; null/legacy-Kontexte bleiben lesbar.
- **Sonderaktivität:** Für Ruhe- und Trainingstag jeweils verifizieren, dass eine protokollierte Sonderaktivität das effektive Kalorienziel um `activityBonus` erhöht, während Protein- und Kohlenhydratbereiche exakt denen des gewählten Profil-Tages entsprechen. Es gibt keinen temporären Aktivitäts-Makrobereich und keine Bonuszuordnung zu Protein/Kohlenhydraten. Qualitative Fueling-Sprache darf bestehen bleiben, ohne numerische Zielaussage.
- **Prompt Eval:** `cd backend && npm run test:eval` für die semantisch geänderte v18-Promptversion. Fehlende Credentials ergeben `UNVERIFIED`, nicht PASS; der Backend-WP gilt ohne erforderliche Eval-Evidence nicht als abgeschlossen.
- **Mobile:** Wizard-Preview und gespeicherte Profilzielansicht jeweils mit Ruhe- und Trainingstag; Tagebuchdetails, Home-Hinweis und Makro-Breakdown; Home-Karte mit vier Makro-Zielbalken plus separater kcal-Aktivitätsbonus-Zeile. `DiaryScreen.f2.test.tsx` prüft, dass heutige Ziele aus den Profile-API-Zielen stammen, `dayType === 'training'` `trainingDay` auswählt und alle anderen Werte `restDay`; ohne Profilziel erscheint kein Makroziel und für historische Tage werden weder aktuelle Profilbereiche geladen noch als Tagesziel verwendet. Prüfen: Bonuszeile bei positivem Bonus einschließlich 0 kcal Verzehr sichtbar; korrekte bestehende Verzehr-über-Basisziel-/Bonussemantik; keine Makro-Schraffur/-Marke; eigener voller Track bei 100 %; Ring und Kalorienbonusanzeige unverändert. Pure-Helper-Tests für Makromarker, Füllung, Schraffur und 150-%-Grenze; Typecheck und Pakettests.
- **Visuell/barrierefrei:** Gerätetest mit kleinem und großem Viewport sowie erhöhter Schriftgröße; Ist-Werte passen, Markierungen fluchten, Überläufe bleiben erkennbar, Hatching bleibt dezent, Screenreader nennt den tatsächlichen Wert und den Zielbereich. Physische Geräte- und Screenreader-UI-Validierung wurde nicht durchgeführt und bleibt `MANUAL VALIDATION REQUIRED`.
- **Gates:** betroffene Shared-/Backend-/Mobile-Testläufe und Typechecks; `npm run build:verify --workspace=backend` für jede Backend-Änderung; Cosmos Contract Suite mit lokalem Emulator (Legacy-Profil-Contract derzeit `UNVERIFIED`, da kein lokaler Emulator verfügbar ist); `npm run verify:daily-insight-prompt --workspace=backend` plus Live-Eval nach Backend-KB-Testregeln.

## 18. Acceptance Criteria (Implementation)

1. **AC-1 — Proteinbereiche pro Profil-Tag:** `ProfileTargets.restDay` und `ProfileTargets.trainingDay` enthalten jeweils den aus dem Profilgewicht abgeleiteten Bereich `1,5–2,0 g/kg`; beide Tagesziele werden berechnet und ausgeliefert.
2. **AC-2 — Kohlenhydratbereiche pro Profil-Tag:** Jede Kohlenhydratspanne wird aus den Kalorien und dem Fettziel desselben Profil-Tages sowie den entgegengesetzten Protein-Grenzen berechnet. Protein wird zuerst gerundet; Kohlenhydratgrenzen verwenden anschließend `Math.round` und sind bei `0 g` begrenzt. Immer gilt `0 <= minG <= maxG`.
3. **AC-3 — Sonderaktivität erhöht nur Kalorien:** An einem Tag mit Sonderaktivität erhöht der bestehende `activityBonus` ausschließlich das effektive Kalorienziel. Protein- und Kohlenhydratbereiche entsprechen unverändert dem ausgewählten `restDay`-/`trainingDay`-Profilziel. Der Bonus wird keinem Makro zugeordnet; es wird keine temporäre Aktivitäts-Makrospanne berechnet.
4. **AC-4 — Unveränderte Zielberechnungen:** Profil-Kalorien-, Fett- und Ballaststoffberechnungen sowie die Aktivitätsbonus-Berechnung bleiben gegenüber dem bestehenden Verhalten unverändert. Der Kalorienring verwendet weiter das effektive Ziel aus Profil-Kalorienziel plus Bonus; die Bonuszeile wird separat nach AC-12 dargestellt.
5. **AC-5 — Profilverträge:** GET/POST/PUT/Preview geben Bereiche für Ruhe- und Trainingstag aus; `ProfileInput` bleibt gleich. Ein Legacy-Profil ohne Bereiche ist lesbar, beide Bereiche werden deterministisch aus den jeweiligen Profiltageszielen berechnet, und es läuft keine Backfill-Migration.
6. **AC-6 — Protein-Coaching:** Anhand tatsächlicher Aufnahme in g/kg ist `1,5–2,0` inklusive positiv; über `2,0` bis `2,2` inklusive gibt es keinen Hinweis; über `2,2` ist ein gelegentlicher sachlicher, nicht-medizinischer Hinweis zulässig. `2,2` ist konfigurierbar und keine medizinische Obergrenze. Die 20-g-Sperre für zusätzliche Proteinempfehlungen wird gegen die neue gerundete Untergrenze geprüft.
7. **AC-7 — Kohlenhydrat-Richtwert:** Aufnahme innerhalb der Spanne darf neutral oder positiv eingeordnet werden. Außerhalb der Spanne entstehen weder negative Hinweise noch strikte AI-Aussagen, die Aufnahme sei zu niedrig oder zu hoch.
8. **AC-8 — Zentrale Logik und AI:** Hints, Daily Insight, Home-Coaching und aktive Zielanzeigen verwenden die bestätigten Range-Daten statt Legacy-Punktwerten. Der Backend-Diary-Handler verwendet die ausgewählten Profil-Tagesbereiche intern für Hint-Auswertung; Daily Insight verwendet weiterhin normalisierte Profilbereiche intern. Die mobile Tagebuchanzeige bezieht heutige Bereiche über die Profile API nur bei vorhandenem Profil; historische Tage erhalten kein aktuelles Profilziel. Daily Insight v18 erhält aktuelle Bereiche, die Proteinlücke zur Untergrenze und deterministische Protein-Coaching-Information; bei Aktivität bleiben Konditionalität sowie qualitative Fueling-/Flüssigkeits-/Erholungsschutzregeln erhalten. Quota, Structured Output und öffentliche Antwortform bleiben unverändert; Promptversion, Cache-Identität und Evals sind aktualisiert.
9. **AC-9 — Historische Daten:** Tagebuch- und Weekly-Insight-Historie erhält keine erfundenen Makroziele; historische Aufnahme wird nicht gegen das aktuelle Profil als damaliges Ziel bewertet.
10. **AC-10 — Profil- und Tageszielanzeigen:** Wizard-Preview und gespeicherte Profilzielansicht zeigen für Ruhetag und Trainingstag jeweils Ist-Wert plus Protein-/Kohlenhydratbereich. Tagebuchdetails und Breakdown zeigen diese Bereiche nur für heute und bei vorhandenem Profil, bezogen über die Profile API; `dayType === 'training'` wählt `trainingDay`, andernfalls `restDay`. `GET /api/diary` liefert keine `targets` oder `macroRanges`; historische Tage erhalten kein aktuelles Profil-Makroziel. Fett und Ballaststoffe bleiben Einzelziele.
11. **AC-11 — Vier Home-Makrobalken:** Für alle vier Makros liegt die 100-%-Marke bei zwei Dritteln der Trackbreite; die lineare Skala reicht bis 150 %. Nur die Geometrie wird begrenzt; tatsächliche Gramm und Accessibility-Wert bleiben erhalten, Farbe ändert sich beim Überschreiten nicht. Prozent-, Rest-, Status- und Badge-Angaben entfallen auf den Makrobalken.
12. **AC-12 — Separate Aktivitätsbonus-Zeile:** Bei positivem `activityBonus` bleibt eine zusätzliche kcal-Zeile erhalten, auch wenn noch 0 kcal verzehrt wurden. Sie zeigt den bestehenden Verzehr oberhalb des Basis-Kalorienziels gegen den gerundeten Bonus in kcal; die Berechnung wird nicht verändert. Sie ist als Aktivitätsbudget von den vier Makrobalken visuell getrennt, verwendet keine Makrofarbe, Range-Schraffur oder Makro-Zielmarke und erhält keine Prozent-, Rest- oder Statusangaben. Die Darstellung folgt Abschnitt 10.4: eigener dünner Track, voller Track = 100 % des Bonus, bestehender Special-Activity-Akzent. Der Kalorienring, sein effektives Ziel und die Bonusanzeige bleiben unverändert.
13. **AC-13 — Kompatibilität:** Profile GET/POST/PUT/preview ergänzen die Bereiche für beide Profil-Tage; alte skalare Profilfelder bleiben numerisch und behalten ihre bisherige Bedeutung. `GET /api/diary` bleibt unverändert und enthält weder `targets` noch `macroRanges`. Es gibt keine neuen Diary-Response-Felder, Routen oder Request-Formen und keine Änderungen an Persistenz oder Auth; gespeicherte Nährwert-Snapshots bleiben unverändert. Keine neue Container-/Infrastruktur-/Dependency-Änderung.
14. **AC-14 — Gates und Dokumentation:** Alle relevanten Unit-, Handler-, Contract-, Typecheck-, Prompt- und visuellen Prüfungen sind nach QA-Regeln dokumentiert; betroffene KB-Dokumente entsprechen dem implementierten Verhalten. QA bestätigt explizit, dass Diary GET keine Zielbereiche liefert, die mobile Tagebuchanzeige heutige Bereiche aus der Profile API bezieht und historische Tage kein aktuelles Profilziel erhalten. QA bestätigt außerdem, dass an Sonderaktivitätstagen keine Protein-/Kohlenhydratbereiche aus dem Bonus abgeleitet werden und die separate Bonuszeile erhalten bleibt. Cosmos-Legacy-Contract ohne lokalen Emulator bleibt `UNVERIFIED`; physische Geräte-/Screenreader-UI-Validierung bleibt `MANUAL VALIDATION REQUIRED`.

## 19. Risks and Edge Cases

- **Domain-/Gesundheitsrisiko:** Die neuen Zahlen sind User-Entscheidungen, aber nicht durch die bestehende KB fachlich belegt; Expert:innenvalidierung vor produktivem Einsatz ist empfohlen.
- **Legacy-Felder:** Alte Clients interpretieren skalare Felder weiterhin als Einzelziel. Neue Clients müssen ausschließlich den Range-Block verwenden; API-Rollout-Reihenfolge Backend vor Mobile.
- **Historie:** Profiländerungen verändern wie bisher aktuelle Makroziele, nicht gespeicherte historische Makroziele. Die mobile Tagebuchansicht verwendet aktuelle Profilbereiche nur für heute; Wochen- und vergangene Daily-Insight-Aussagen dürfen keine historischen Bereiche erfinden.
- **Niedrige Restenergie:** Bei großen Gewichten/Minimum-Kalorien können beide Kohlenhydratgrenzen auf 0 g fallen. Keine negativen Zahlen, NaN oder vertauschte Grenzen zulassen; fachliche Folge im Domain-Review prüfen.
- **Sonderaktivitätsbonus:** Der Kalorienbonus darf weder in Protein-/Kohlenhydratziele umgerechnet noch als Makro-Zuteilung missverstanden werden. Die separate Home-Zeile muss als kcal-Zusatzbudget erkennbar sein; der Activity-Prompt darf weiterhin qualitatives Fueling erwähnen, aber keine numerische Makro-Zielerhöhung behaupten.
- **AI Cache:** Ein v17-Cache oder persistierter v17-Kontext darf nicht als nach aktueller Range-Logik generiert ausgegeben werden. Version, Hash und alte v14-Kompatibilitätsbehandlung regressionsprüfen.
- **Diagramm-Sättigung:** Jeder endliche Track hat eine Darstellungsgrenze. Die tatsächliche Zahl muss auch am Renderlimit exakt bleiben und Screenreader-Beschreibungen dürfen nicht den geclippten Füllwert als Ist-Wert ausgeben.
- **Profile-R2-Überschneidung:** Derselbe Profil-Zielbereich ist in einem bestehenden Profil-Redesign-Plan enthalten. Bestehende Umsetzung und Handoff vor F1 prüfen; nur Zielinhalte ergänzen, keine zweite Navigation oder zusätzliche Profilansicht.
- **KB-/Codeabweichung:** Korrektur der dokumentierten PAL-/Kalorienwerte muss als Dokumentationskorrektur erkennbar bleiben; diese Story darf die Kalorienformel nicht ändern.

## 20. Recommended Execution Order

1. Dieser Plan einschließlich der Diary-API-Korrektur ist ausdrücklich freigegeben; die frische User-Freigabe ersetzt die vorherige Planfreigabe. PO-1 bis PO-6 sind entschieden; es gibt keine offenen Produktentscheidungen. Ernährungsfachliche Prüfung der Zielbereiche wird vor Produktivsetzung terminiert.
2. WP-B1 implementiert Shared-Ranges für beide Profil-Tage, Legacy-Read-Kompatibilität und additive Profil-API; fokussierte Shared-/Handler-Tests bestehen. Der Legacy-Profil-Cosmos-Contract bleibt mangels lokalem Emulator `UNVERIFIED`.
3. WP-F1 aktualisiert Wizard-Preview und gespeicherte Profil-Tageszielansicht für Ruhe- und Trainingstag nach Abgleich mit dem R2-Handoff.
4. WP-B2 aktualisiert die rangebasierte Hint Engine, Protein-Coaching, Daily Insight, Cache und v18 Prompt für die Profilbereiche. Sonderaktivitätstage behalten die gewählten Profilbereiche; nur das effektive Kalorienziel enthält den Bonus. Backend-Unit-/Handler-/Eval-Gates bestehen.
5. WP-F2 aktualisiert Tagebuchdetails, Breakdown und Home-Coaching für bestätigte Profilbereiche, unverändert auch an Sonderaktivitätstagen.
6. WP-F3 setzt die bestätigte Balkengeometrie um und behält die separate Aktivitätsbonus-Zeile gemäß der in Abschnitt 10.4 festgelegten Darstellung bei.
7. WP-B3 aktualisiert technische/domainbezogene KB.
8. WP-D1 aktualisiert Product-/UX-Dokumentation. Beide Dokumentationspakete werden vor QA abgeschlossen und halten qualitative Fueling-Sprache klar von numerischen Makrozielen getrennt.
9. WP-QA1 prüft alle Akzeptanzkriterien, Legacy-Profile und Contracts, Prompt-Eval-Evidence sowie Geräte-/Accessibility-Zustände. Dazu gehören unveränderte Profilbereiche an Sonderaktivitätstagen und die erhaltene kcal-Bonuszeile. Fehlende Azure-Credentials oder Geräte werden als `UNVERIFIED` bzw. `MANUAL VALIDATION REQUIRED` ausgewiesen.
10. Integration wird im bestehenden Development-Setup validiert. Ein Alpha-Deploy bleibt ein separater, späterer Operationsauftrag und ist hier nicht autorisiert. In diesem Planungsschritt wird nichts implementiert, deployed oder gestartet.