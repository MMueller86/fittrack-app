# Plan: Daily Insight Prompt-Provenienz und globale Release-Identität

**Bezug:** `US_Home-Screen-Insights_Feedback_Review.md`  
**Korrekturbezug:** bestehender Feature-Plan `PLAN_US_Home-Screen-Insights_Feedback_Review.md`  
**Planner:** FitTrack Planner  
**Datum:** 2026-08-21  
**Status:** [Planned] Implementation-ready Korrekturplan; keine Source-Code- oder Teständerung durch den Planner.  
**Classification:** Accept with modifications  
Infrastructure Impact: Dev  
Mobile Build Impact: None

Dieser Plan behandelt ausschließlich die technische Korrektur der Prompt-
Identität, der Daily-Cache-Invalidierung, der Reproduzierbarkeit und der
irreführenden aktiven Dateibenennung. Die bereits geplanten fachlichen
F1-F9 bleiben die Baseline. Die Arbeitskopie ist dirty und enthält bereits
Änderungen in Prompt-, Handler-, Repository-, Test-, Shared- und
Knowledge-Base-Dateien. Diese Änderungen gelten als vorhandener Ausgangszustand
und dürfen durch die Implementierung weder verworfen noch überschrieben werden.

## 1. Requirement Assessment

### Problem

Die aktuelle Daily-Insight-Komposition ist funktional modularisiert, besitzt
aber nur eine manuell gepflegte globale Versionskonstante. `v14` wird im
Modul `dailyInsightV10.ts` exportiert, obwohl der Dateiname aus einem früheren
Refactoring stammt. Änderungen an `sharedTone.ts`, einem Intent-Modul oder an
der dynamischen Guard-Komposition ändern den an Azure OpenAI gesendeten Prompt,
ohne dass der Cache- und Provenienzvertrag diese Änderung unabhängig vom
manuellen Versionssprung erkennen kann.

Zusätzlich ist `DAILY_INSIGHT_SYSTEM_PROMPT` im aktiven Modul kein vollständiger
Runtime-Prompt. Der tatsächliche Prompt hängt von Intent, Kontext und den
angefügten Guards ab. Der Export ist daher eine irreführende, nicht autoritative
zweite Prompt-Oberfläche.

### Lösungseignung

Die Modularisierung soll beibehalten werden. Sie reduziert die Größe einzelner
Diffs, macht Intent-Regeln reviewbar und unterstützt fokussierte Tests. Sie ist
nicht die Ursache des Problems. Die Ursache ist das Fehlen eines einzigen
Composition Roots mit einer automatisch ermittelten Inhaltsidentität.

Empfohlen wird eine Dual-Identity:

- `promptVersion` bleibt eine lesbare, bewusst gepflegte Release-ID wie `v14`.
- `promptFingerprint` wird automatisch aus dem vollständigen Prompt-Bundle,
  der Assembly-Policy und dem Strict-Output-Schema als SHA-256 berechnet.

Der Fingerprint wird für Cache, Persistenz und Reproduktion verwendet. Die
Release-ID bleibt für Menschen, Feedback-Auswertung und Eval-Zuordnung lesbar.
Eine automatisch aus Git oder Dateizeitpunkten erzeugte Versionsnummer wird
nicht verwendet, weil sie keine Aussage über die semantische Freigabe macht.

### AI-Notwendigkeit

Es wird kein neues AI-Verhalten eingeführt. Die AI bleibt für die natürliche
Formulierung des bereits deterministisch ermittelten Daily-Intents erforderlich.
Deterministische Context-, Intent-, Schwellenwert- und Cache-Logik bleibt
autoritativ. Der Fingerprint schützt die AI-Grenze; er ersetzt keine fachliche
Validierung und erlaubt der AI nicht, Intent oder Datenlage selbst zu ändern.

### Product- und Domain-Bewertung

Die Korrektur ändert keine sichtbare Produktentscheidung, keine Ernährungsregel
und keine Nutzeraktion. Sie verbessert die Nachvollziehbarkeit und verhindert,
dass eine veraltete Prompt-Komposition als unverändert behandelt wird. Die im
aktuellen Vertrag dokumentierten Grenzen `remainingCalories` mit `> 0`, `= 0`
und `< 0` sowie `remainingProteinG` mit `> 20` und `<= 20` werden ausdrücklich
in den Cache-Key aufgenommen. Es werden keine neuen Domain-Schwellen eingeführt.

### Open Product Owner Decisions

Keine offenen Product-Owner-Entscheidungen. Die Fingerprint-Ausgabe bleibt
serverseitig und wird nicht in Mobile angezeigt. Die bestehende Antwort-
Eigenschaft `promptVersion` und der Feedback-Request bleiben unverändert.

Die folgende technische Release-Regel wird als Korrekturentscheidung empfohlen:
Jede provider-sichtbare Änderung am Prompt-Bundle, an Guard-Texten, an der
Assembly-Policy oder am Strict-Output-Schema erhält einen neuen Eintrag in der
append-only Release-Historie. Reine Änderungen außerhalb des Provider-Inputs
benötigen keinen Eintrag.

Diese Regel ist bewusst strenger als die bisherige Knowledge-Base-Formulierung,
die primär Änderungen der Output-Interpretation nennt. Der Vorteil ist eine
einfach prüfbare globale Release-Grenze auch bei provider-sichtbaren Text-
oder Whitespace-Änderungen; der Nachteil sind häufiger neue Release-IDs und
bewusste Cache-Invalidierungen.

## 2. Recommended Product Behaviour

1. Der aktuelle, inhaltlich unveränderte v14-Prompt bleibt `promptVersion: v14`.
   Bei einer Korrektur, die Provider-Input oder Output-Interpretation verändert,
   wird v15 als neuer lesbarer Release angelegt.
2. Unabhängig davon wird bei jedem Prozessstart der Fingerprint aus dem
   tatsächlichen Bundle berechnet. Ein vergessener manueller Release-Eintrag
   darf deshalb niemals dazu führen, dass ein alter Cache als aktuell gilt.
3. Die Daily-Antwort und der Feedback-Request zeigen keinen Fingerprint. Die
   gespeicherten Daily- und Feedback-Dokumente enthalten ihn zusätzlich zur
   lesbaren Version und zum exakten Prompt-Snapshot.
4. Ein Fingerprint- oder Release-Mismatch invalidiert den Daily-Cache hart,
   auch wenn das 30-Minuten-Intervall oder das Tageslimit sonst greifen würde.
5. Ein bestehender Cosmos-Datensatz ohne Fingerprint bleibt lesbar, gilt aber
   nicht als vollständige aktuelle Provenienz. Beim nächsten passenden Daily-
   Aufruf wird er neu erzeugt oder für Feedback als nicht verfügbar behandelt.

## 3. Feature Summary

Die Korrektur besteht aus sechs zusammenhängenden Teilen:

1. aktiven Composition Root von `dailyInsightV10.ts` nach
   `dailyInsightPrompt.ts` umbenennen;
2. alle Promptbestandteile, Guard-Texte, Guard-Grenzen und das Strict-Schema
   in einer berechenbaren globalen Bundle-Identität zusammenführen;
3. lesbare Release-Historie und CI-Guard gegen Änderungen ohne neuen Release
   einführen;
4. `promptFingerprint` in Daily- und Feedback-Provenienz speichern und in den
   Cache-Key einbeziehen;
5. semantische Schwellenwert-Buckets zusätzlich zu den bestehenden
   Rausch-/Rundungs-Buckets hashen;
6. den partiellen `DAILY_INSIGHT_SYSTEM_PROMPT`-Export entfernen und die
   Unit-, Contract-, Eval- und CI-Prüfungen aktualisieren.

## 4. Current Behaviour

### 4.1 Aktiver Promptpfad

Bestätigt im Repository:

- `backend/src/lib/prompts/dailyInsightV10.ts` exportiert aktuell
  `DAILY_INSIGHT_PROMPT_VERSION = 'v14'`.
- Der Runtime-Builder importiert `sharedTone.ts`, `promptActivity.ts`,
  `promptGeneral.ts`, `promptMorning.ts`, `promptNutrition.ts` und
  `promptWeight.ts`.
- `buildDailyInsightPrompt()` fügt abhängig von Intent und Context zusätzliche
  Guards an. Der tatsächlich gesendete System-Prompt ist daher nicht nur die
  statische Modulverkettung.
- `DAILY_INSIGHT_SYSTEM_PROMPT` enthält nur Shared Tone, General-Modul und
  Output Contract. `generateDailyInsight()` verwendet stattdessen einen
  Context-/Intent-spezifischen `promptSnapshot`; der statische Export ist nur
  eine zweite, partielle Oberfläche.
- `openai.ts` importiert und re-exportiert den partiellen Export, obwohl der
  Daily-Generator ihn nicht für den Provider-Aufruf verwendet.

### 4.2 Aktueller Cache-Key

`computeInputHash()` in
`backend/src/lib/repositories/insightRepository.ts` enthält die manuelle
Prompt-Version, Intent und viele Context-Felder, aber keinen Fingerprint des
komponierten Prompt-Bundles und keinen Hash des tatsächlich erzeugten
System-Prompts.

Kalorien werden in 100er-Buckets und Makros in 10er-Buckets gerundet. Dadurch
können zum Beispiel ein kleiner negativer und ein kleiner positiver
`remainingCalories`-Wert denselben gerundeten Wert erhalten. Ebenso können
`remainingProteinG = 20` und ein knapp darüber liegender Wert denselben
Rundungs-Bucket erhalten, obwohl die Promptregeln unterschiedliche Guards
verwenden.

### 4.3 Persistenz und Feedback

`InsightDocument` und `InsightFeedbackDocument` speichern bereits Version,
Input-Hash, vollständigen Input-Context und den exakten `promptSnapshot`. Ein
separates `promptFingerprint`-Feld existiert nicht.

`shouldRegenerate()` invalidiert bei einer geänderten Version sowie bei
fehlender Intent-/Snapshot-Provenienz, aber nicht bei einer geänderten
Prompt-Komposition mit unveränderter Versionszeichenkette.

Der Feedback-Handler kopiert die vorhandene Daily-Provenienz in ein dauerhaftes
`insightFeedback`-Dokument. Ein Fingerprint kann daher heute nicht mitkopiert
werden. Die Idempotenz- und exakte Daily-Instanzbindung bleiben grundsätzlich
bestehen.

### 4.4 Benennung und Tests

Der aktive Pfad heißt `dailyInsightV10.ts`, obwohl er v14 exportiert. Die
historischen Module v3 bis v9 sind nicht der aktive Runtime-Pfad.

`dailyInsightPrompt.test.ts` und `dailyInsight.eval.test.ts` prüfen v14 mit
hartcodierten Erwartungen. Kein Test erzwingt aktuell, dass eine Änderung an
einem importierten Promptmodul einen globalen Inhaltsnachweis oder einen neuen
Release-Eintrag erzeugt.

### 4.5 Knowledge-Base-Abgleich

Die Knowledge Base dokumentiert v14 und die ausgelagerten Module korrekt,
nennt aber weiterhin `dailyInsightV10.ts` als aktiven Pfad und beschreibt nur
den manuellen Versionssprung bei semantischen Änderungen. Sie definiert noch
keine automatische Inhaltsidentität und keinen Release-Guard für importierte
Bestandteile. Diese Abweichung muss nach der Implementierung dokumentiert
korrigiert werden.

## 5. Desired Behaviour

### 5.1 Zentraler Composition Root

Der aktive Root wird zu
`backend/src/lib/prompts/dailyInsightPrompt.ts` umbenannt. Alle Runtime-
Imports von Handler, OpenAI-Client und Tests zeigen auf diesen Root.

Der Root ist die einzige Stelle, die den Daily-Prompt für den Provider
zusammenstellt. Die Module bleiben getrennt und liefern nur klar benannte,
side-effect-freie Promptbestandteile. Der Root enthält beziehungsweise
referenziert zusätzlich:

- Shared Tone;
- alle sechs Intent-Module;
- Output Contract;
- alle dynamischen Guard-Texte;
- die numerischen Guard-Grenzen, insbesondere `0`, `20` und `14`;
- eine explizite Assembly-Version;
- das Strict-Structured-Output-Schema.

Die Guards sollen aus einem typisierten Bundle beziehungsweise einer
zentralen Policy gebaut werden. Verstreute unbenannte String-Literale im
Builder sind zu vermeiden, damit sie in die Inhaltsidentität eingehen.

### 5.2 Duale Prompt-Identität

Die Implementierung führt eine append-only Release-Historie ein, zum Beispiel
in `backend/src/lib/prompts/dailyInsightPromptManifest.ts`:

- jede Release-ID ist eindeutig und monoton;
- jeder Eintrag enthält die erwartete Fingerprint-Zeichenkette;
- der aktive Release ist der letzte Eintrag;
- historische Einträge werden nicht nachträglich umgeschrieben.

Der Runtime-Fingerprint wird nicht als blind kopierter Literalwert verwendet,
sondern aus dem Bundle berechnet:

```text
promptFingerprint = SHA-256(canonicalJson({
  promptVersion,
  assemblyVersion,
  sharedTone,
  outputContract,
  sortedIntentModules,
  guardTextsAndGuardPolicy,
  strictStructuredOutputSchema
}))
```

`canonicalJson` muss deterministische, rekursiv sortierte Objekt-Schlüssel
verwenden. Arrays behalten ihre fachlich definierte Reihenfolge. Die
Fingerprint-Zeichenkette soll das Hash-Verfahren erkennbar machen, zum Beispiel
`sha256:<64 lowercase hex characters>`.

Der Fingerprint umfasst bewusst alle Intent-Module, auch wenn eine konkrete
Anfrage nur eines davon auswählt. Damit ändert sich die globale
Provenienzidentität bei jeder Änderung an einem importierten Bestandteil und
alle betroffenen Daily-Caches werden konsistent invalidiert.

Zusätzlich wird der SHA-256-Hash des tatsächlich für den konkreten Intent
gebauten `promptSnapshot.system` in den `inputHash` aufgenommen. Damit werden
auch Änderungen an der contextabhängigen Assembly erkannt, die nicht durch
reine Fragmentdaten ausgedrückt werden. Eine Änderung der Assembly-Logik muss
außerdem die `assemblyVersion` oder den Release-Eintrag erhöhen.

### 5.3 Strict-Schema als Teil der Identität

Das Daily-Output-Schema wird in ein neutrales Backend-Modul ausgelagert, zum
Beispiel `backend/src/lib/dailyInsightSchema.ts`, damit Prompt-Identity und
`openai.ts` dasselbe Objekt ohne zyklischen Import verwenden.

Das Schema bleibt unverändert strikt:

- `response_format.type = 'json_schema'`;
- `strict: true`;
- alle Properties in `required`;
- `additionalProperties: false`;
- nullable optionale Felder wie bisher.

Eine Schemaänderung verändert den Fingerprint und erfordert einen neuen
Release-Eintrag sowie eine bewusste Eval-Überprüfung. Der bestehende interne
Export `DAILY_INSIGHT_SCHEMA` aus `openai.ts` darf für bestehende Tests als
Re-Export erhalten bleiben, muss aber auf die zentrale Schemaquelle zeigen.

### 5.4 Cache- und Input-Hash

`computeInputHash()` erhält den aktiven `promptFingerprint` und den Hash des
komponierten System-Prompts als Eingaben. Der stabile Cache-Key enthält
weiterhin alle tatsächlich promptrelevanten Context-Felder, insbesondere:

- Release-ID, globalen Prompt-Fingerprint, System-Prompt-Hash und Intent;
- Datum, normalisierten Zeitzonenoffset, lokale Stunde und Tageszeit-Bucket;
- Aktivität, Completion-Status und Statusquelle;
- aktuelle und historische Ernährung, Ziele und Zielquellen;
- Gewichts-, Staleness- und Progress-Intelligence-Signale.

Die bisherige Rauschunterdrückung bleibt für nicht steuernde Werte erhalten.
Zusätzlich werden die ungerundeten Schwellenwertzustände aufgenommen:

```text
remainingCalories:
  null/unknown | negative | zero | positive

remainingProteinG:
  null/unknown | nearly_complete (<= 20) | material_gap (> 20)
```

`-0` wird als `zero` normalisiert. Nicht-finite Werte werden nicht als echte
Zahl in den Cache-Key geschrieben. Die gerundeten numerischen Werte dürfen
zusätzlich bestehen bleiben, damit kleinere Änderungen innerhalb desselben
semantischen Zustands nicht unnötig regenerieren. Die Zustands-Buckets müssen
jedoch immer Vorrang bei der Grenzwertentscheidung haben.

### 5.5 Regeneration

`shouldRegenerate()` erhält die aktive Release-ID und den aktiven
`promptFingerprint`. Eine vollständige aktuelle Cachedokument-Identität
verlangt:

- gleiche aktive Release-ID;
- gleichen globalen Fingerprint;
- vorhandene Intent-Provenienz;
- vorhandenen vollständigen Prompt-Snapshot;
- unveränderten Input-Hash.

Fehlt der Fingerprint oder weicht er ab, wird unabhängig von
`MIN_REGEN_INTERVAL_MS`, `MAX_DAILY_GENERATIONS` und Admin-Status hart
regeneriert. Bei gleicher vollständiger Identität bleibt der bisherige
Cached-Pfad erhalten.

### 5.6 Persistenz und Reproduzierbarkeit

Neue Daily-Dokumente speichern zusätzlich:

```text
promptVersion       lesbare Release-ID, zum Beispiel v14
promptFingerprint   automatisch berechnete globale Inhaltsidentität
promptSnapshot      exakt gesendeter system- und user-String
inputHash           Cache-Key inklusive Fingerprint und System-Prompt-Hash
```

Neue Feedback-Dokumente kopieren den Fingerprint exakt aus dem Daily-Dokument.
Sie bewahren weiterhin die vollständige Antwort, den Context, den Input-Hash,
die Version, das Modell, die Intelligence-Version, Token-Nutzung und den
exakten Snapshot.

`promptFingerprint` wird in den Shared-Dokumenttypen als optionaler
Legacy-kompatibler Wert modelliert. Für jedes neue Daily- und Feedback-
Dokument ist er logisch erforderlich und wird vom Backend immer gesetzt.

Die Antwort `feedbackAvailable: true` darf nur zurückgegeben werden, wenn das
Daily-Dokument mit vollständiger neuer Provenienz erfolgreich persistiert
wurde. Schlägt die bestehende nicht-fatale Persistenz nach erfolgreicher AI-
Antwort fehl, bleibt der öffentliche Erfolgspfad kompatibel, meldet aber
`feedbackAvailable: false`, persistiert nichts Unvollständiges und schreibt den
Fehler strukturiert ins Log. Die erfolgreiche AI-Nutzung wird weiterhin gemäß
bestehendem Quota-Vertrag nach dem Provider-Erfolg behandelt.

### 5.7 Legacy-Dokumente

Es wird kein Backfill und keine neue Migration ausgeführt. Alte Daily-
Dokumente ohne `promptFingerprint` bleiben lesbar, werden aber durch den
aktiven Cachepfad als veraltete Provenienz erkannt und beim nächsten passenden
Aufruf ersetzt. Alte Feedback-Dokumente ohne Fingerprint bleiben direkt
lesbar und werden nicht verändert; ihr damaliger exakter Snapshot ist die
historische Quelle.

`hasFeedbackSnapshot()` verlangt für neue Feedback-Fähigkeit die vollständige
aktuelle Provenienz einschließlich Fingerprint. Ein altes Daily ohne diese
Provenienz erhält `feedbackAvailable: false` beziehungsweise den bestehenden
`feedback_snapshot_unavailable`-Vertrag. Der Feedback-Request akzeptiert
weiterhin keinerlei clientseitige Prompt- oder Hash-Felder.

### 5.8 Irreführender statischer Export

Der aktive `DAILY_INSIGHT_SYSTEM_PROMPT`-Export wird entfernt. `openai.ts`
importiert und re-exportiert ihn nicht mehr. Der Generator verwendet nur den
exakten Snapshot aus `buildDailyInsightPrompt()`.

Es wird kein neuer statischer Ersatzexport angelegt. Wer einen Prompt prüfen
will, verwendet den Builder mit Intent und Context. Historische, nicht aktive
v3-v9-Dateien werden in dieser Korrektur nicht umgebaut.

## 6. Scope

- aktiven Prompt-Root umbenennen und alle internen Imports aktualisieren;
- zentralen Prompt-Bundle-Vertrag und automatische SHA-256-Identität einführen;
- Release-Historie und offline ausführbaren CI-Guard anlegen;
- Strict-Schema aus `openai.ts` in eine gemeinsam verwendete Quelle auslagern;
- Prompt-Fingerprint und System-Prompt-Hash in Cache-Berechnung einbeziehen;
- semantische Kalorien-/Protein-Grenzbuckets ergänzen;
- Daily- und Feedback-Provenienz additiv erweitern;
- Cache-, Feedback- und Persistenztests aktualisieren;
- Knowledge Base und Testdokumentation nach erfolgreicher Implementierung
  angleichen.

## 7. Out of Scope

- keine Änderung an F1-F9, Intent-Priorität, Aktivitätsheuristik oder
  Ernährungsgrenzen außerhalb der beschriebenen Cache-Buckets;
- keine Änderung des öffentlichen Daily-Response- oder Feedback-Request-
  Schemas;
- keine Mobile-UI, Navigation oder native Moduländerung;
- kein neuer Cosmos-Container, keine Partition-Key-Änderung und keine
  Bicep-Änderung;
- keine globale Migration bestehender Daily- oder Feedback-Dokumente;
- keine Admin-UI, kein neuer Feedback-Read-Endpoint und kein Cleanup-
  Endpoint;
- kein automatisches Deployment nach Alpha;
- keine Umbenennung historischer v3-v9-Promptdateien.

## 8. Confirmed Facts

### Repository

- Der aktive Runtime-Kompositionspunkt ist
  `backend/src/lib/prompts/dailyInsightV10.ts` mit v14.
- Die Promptbestandteile liegen in den sechs importierten Moduldateien und
  werden nur über den aktiven Root zusammengesetzt.
- `dailyInsight.ts` baut Snapshot und Hash vor `shouldRegenerate()`.
- `openai.ts` sendet den Snapshot und validiert Strict Structured Output sowie
  Daily-Semantik.
- `insightRepository.ts` verwendet SHA-256 für den bestehenden Input-Hash,
  aber bisher ohne Prompt-Fingerprint.
- `aiInsights` ist ein vorhandener heterogener `/userId`-Container für Daily-,
  Weekly- und Feedback-Dokumente.
- `dailyInsightFeedback.ts` bindet Feedback an `userId`, Datum und den exakten
  `generatedAt`-Wert.
- Die Tests und der Eval-Guard enthalten derzeit harte v14-Erwartungen.

### Knowledge Base

- Daily Insight ist ein backendseitiger, quota-bewusster und gecachter AI-
  Workflow.
- Die AI formuliert deterministisch vorbereitete Daten; sie ist nicht die
  autoritative Quelle für Ziele, Aktivitätsstatus oder historische Fakten.
- Prompt-Snapshots und relevante Eingabedaten müssen für Feedback reproduzierbar
  gespeichert werden.
- Strict Structured Outputs sind mit `strict: true` und
  `additionalProperties: false` vorgeschrieben.
- Cosmos-Dokumente mit neuen optionalen Feldern werden nach dem
  Cosmos-Schema-Evolutionsmodell als Class 0 behandelt, wenn alte Dokumente
  ohne Feld sicher lesbar bleiben.
- Dev und Alpha verwenden getrennte Cosmos-Konten. Es gibt keinen Grund für
  eine neue Containerdefinition.

### Historie und Arbeitskopie

- Der Refactoring-Commit legte `dailyInsightV10.ts` an und exportierte zunächst
  v11; die Arbeitskopie trägt inzwischen v14.
- `git status` zeigt bereits fremde beziehungsweise vorherige Änderungen in
  den betroffenen Source-, Test-, Shared-, KB- und Release-Dateien sowie neue
  Migrations-/Testdateien. Diese Korrekturplanung nimmt sie nicht zurück.

## 9. Assumptions and Open Questions

### Assumptions

1. Der aktuelle Arbeitsbaum, nicht ausschließlich `HEAD`, ist die fachliche
   Baseline für die spätere Implementierung.
2. Die interne Suche zeigt keine externe Package- oder Mobile-Abhängigkeit vom
   Pfad `dailyInsightV10.ts`; der Backend-Agent prüft vor dem Löschen dennoch
   noch einmal alle Workspace-Referenzen.
3. Der v14-Fingerprint wird aus dem finalen aktuellen Prompt-Bundle erzeugt.
  Solange der Provider-Input und das Strict-Schema bytegleich bleiben, bleibt
  v14 aktiv. Jede provider-sichtbare Änderung, auch an Text oder Whitespace,
  erhält v15 beziehungsweise den nächsten Release.
4. `promptFingerprint` bleibt ein serverseitiges Persistenzfeld und wird nicht
   in `InsightResponse` aufgenommen.
5. Das bestehende Verhalten bei einem Persistenzfehler bleibt grundsätzlich
   nicht-fatale 200/Fresh-Verhalten; nur die falsche Zusicherung
   `feedbackAvailable: true` wird vermieden.

### Technische Klärung vor Implementation

- Der Backend-Agent muss die aktuelle Release-Historie gegen den Arbeitsbaum
  auflösen und darf keine historischen Fingerprints rückwirkend ändern.
- Bei einer Änderung der dynamischen Guard-Auswahl muss neben Tests auch die
  `assemblyVersion` oder die Release-ID aktualisiert werden.
- Die genaue CI-Basis-Commit-Auflösung muss für Pull Requests und Pushes auf
  `main` funktionieren; fehlende Git-Historie darf den Guard nicht still
  überspringen.

## 10. Existing Components to Reuse

- `buildDailyInsightPrompt()` als fachliche Runtime-Kompositionsfunktion;
- `DailyInsightPromptSnapshot` als exakte system/user-Snapshot-Struktur;
- `DAILY_INSIGHT_PROMPT_VERSION` als Kompatibilitätsname für die lesbare
  Release-ID;
- `validateDailyInsightResponse()` und die bestehende Strict-Schema-
  Integration in `openai.ts`;
- `computeInputHash()`, `shouldRegenerate()` und die bestehenden Zeit-/TTL-
  Hilfsfunktionen im Insight-Repository;
- `hasFeedbackSnapshot()`, `makeFeedbackId()` und die bestehende Feedback-
  Idempotenz;
- `InMemoryInsightRepository` für Unit-Tests und
  `CosmosInsightRepository` für Roundtrip-/Legacy-Contract-Tests;
- vorhandene Vitest-Konfiguration, `scripts/run-eval.mjs` und den bestehenden
  zweistufigen CI-Aufbau.

## 11. Proposed Technical Solution

### 11.1 Zielstruktur

```text
backend/src/lib/
  dailyInsightSchema.ts                 # gemeinsame Strict-Schema-Quelle
  prompts/
    dailyInsightPrompt.ts               # einziger aktiver Composition Root
    dailyInsightPromptManifest.ts       # append-only Releases + erwartete Hashes
    sharedTone.ts
    promptActivity.ts
    promptGeneral.ts
    promptMorning.ts
    promptNutrition.ts
    promptWeight.ts
```

`dailyInsightV10.ts` wird nach Aktualisierung aller internen Referenzen entfernt.
Die historischen v3-v9-Dateien bleiben unverändert und werden nicht als aktive
Promptquelle dokumentiert.

### 11.2 Release- und Fingerprint-Vertrag

Der Manifest-Guard prüft mindestens:

- numerisch monotone, eindeutige Release-IDs;
- aktiver Release ist der letzte Eintrag;
- berechneter Fingerprint entspricht dem erwarteten letzten Eintrag;
- bestehende historische Einträge wurden nicht editiert oder gelöscht;
- provider-sichtbare Änderungen an Prompt-, Schema-, Manifest- oder Assembly-
  Dateien enthalten einen neuen Release-Eintrag;
- der Release-Eintrag wird nicht nur geändert, um einen Fingerprint-Mismatch zu
  kaschieren.

Der Runtime-Code berechnet den Fingerprint aus dem Bundle. Der Manifestwert ist
nur ein überprüfbarer Release-Lock, nicht die eigentliche Inhaltsquelle.

### 11.3 Hash- und Grenzwertvertrag

Die Helper für `calorieBudgetState` und `proteinGapState` sollen pure,
exportierte Funktionen sein. Ihre Tests prüfen mindestens:

- `-0.01`, `0` und `0.01` erzeugen drei unterschiedliche Kalorienzustände;
- `19.99`, `20` und `20.01` erzeugen bei Protein die erwarteten Zustände;
- `null` bleibt `unknown`;
- Änderungen innerhalb desselben semantischen und numerischen Rundungs-
  buckets bleiben gemäß bestehender Rauschstrategie stabil;
- alle Schwellenwerte und deren Bedeutung sind im Fingerprint-Bundle erfasst.

### 11.4 Cache- und Feedback-Vertrag

Der Handler berechnet in dieser Reihenfolge:

1. aktuellen Context und Intent;
2. exakten Prompt-Snapshot;
3. globalen Prompt-Fingerprint und konkreten System-Prompt-Hash;
4. Input-Hash mit beiden Identitäten und den Grenzbuckets;
5. harte Provenienzprüfung und normale Cache-Entscheidung;
6. bei Bedarf Quota, AI-Aufruf, Persistenz und Usage-Tracking.

Die Feedback-Erstellung kopiert ausschließlich serverseitige Werte aus dem
passenden Daily-Dokument. Der Client kann keinen Fingerprint, Prompt, Context
oder Hash einschleusen.

## 12. Backend Work Package

### WP-BE-1: Prompt-Composition und Release-Identität

Agent: Backend

Goal

Den aktiven Daily-Prompt unter einem nicht irreführenden Root zentralisieren,
eine berechenbare globale Inhaltsidentität einschließlich Strict-Schema
bereitstellen und eine prüfbare Release-Historie etablieren, ohne den
v14-Provider-Input unbeabsichtigt zu verändern.

Required Knowledge Base:

- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:

- `backend/src/lib/prompts/dailyInsightV10.ts`
- `backend/src/lib/prompts/sharedTone.ts`
- `backend/src/lib/prompts/promptActivity.ts`
- `backend/src/lib/prompts/promptGeneral.ts`
- `backend/src/lib/prompts/promptMorning.ts`
- `backend/src/lib/prompts/promptNutrition.ts`
- `backend/src/lib/prompts/promptWeight.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.test.ts`
- `backend/src/lib/openai.daily.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.test.ts`

Required Skills:

- `azure-openai-feature-integration`

Relevant Acceptance Criteria:

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-10
- AC-13

Dependencies:

- None. Der aktuelle dirty Arbeitsbaum ist als Baseline zu erhalten.

Expected Handoff:

- `dailyInsightPrompt.ts` als einziger aktiver Composition Root;
- zentrale Schemaquelle und aktualisierte interne Exporte;
- berechneter v14-Fingerprint samt Manifest-Lock oder begründeter v15-
  Release-Entscheidung;
- aktualisierte Prompt-/OpenAI-Referenzen ohne `DAILY_INSIGHT_SYSTEM_PROMPT`;
- dokumentierte Information, ob der Provider-Input bytegleich blieb.

### WP-BE-2: Cache, Schwellenwerte und persistierte Provenienz

Agent: Backend

Goal

Den globalen Fingerprint, den konkreten System-Prompt-Hash und die semantischen
Grenzbuckets in Cache-Entscheidung und Daily-/Feedback-Persistenz integrieren.
Legacy-Dokumente müssen sicher lesbar bleiben und bei Bedarf hart invalidiert
werden.

Required Knowledge Base:

- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

Required Repository Context:

- `shared/types/insight.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/insightFeedback.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsightFeedback.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/functions/dailyInsightFeedback.test.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`

Required Skills:

- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

Relevant Acceptance Criteria:

- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-11
- AC-12
- AC-15

Dependencies:

- WP-BE-1 liefert den aktiven Release, den globalen Fingerprint, die zentrale
  Schemaquelle und die Snapshot-Assembly-API.

Expected Handoff:

- additive Shared-Typen mit optionalem Legacy-Fingerprint;
- Cache- und Bucket-Implementierung mit Handler-Integration;
- Daily-/Feedback-Provenienz einschließlich `promptFingerprint`;
- Legacy-Verhalten und Persistenzfehler-Verhalten;
- Liste der aktualisierten Unit- und Contract-Testfälle für QA.

## 13. Frontend Work Package

Kein Frontend-Work-Package erforderlich. Der öffentliche Daily-Response-
Vertrag und der Feedback-Request bleiben unverändert; `promptFingerprint` ist
nicht Teil der Mobile-DTOs. Mobile benötigt keinen neuen nativen Build. Der
Mobile-Typecheck bleibt als Regressionstest für die additive Shared-Typänderung
verpflichtend.

## 14. QA Work Package

### WP-QA-1: Offline Unit-, Contract- und CI-Verifikation

Agent: QA

Goal

Alle Akzeptanzkriterien anhand deterministischer Tests, Repository-
Roundtrips, Legacy-Dokumente und des neuen Release-Guards überprüfen.

Required Knowledge Base:

- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/02-backend.md`

Required Repository Context:

- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/prompts/dailyInsightPromptManifest.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/functions/dailyInsight.test.ts`
- `backend/src/functions/dailyInsightFeedback.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`
- `backend/package.json`
- `.github/workflows/ci.yml`

Required Skills:

- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

Relevant Acceptance Criteria:

- AC-1 through AC-15

Dependencies:

- WP-BE-2 muss abgeschlossen sein.
- Die Dokumentationsänderungen aus WP-DOC-1 müssen vor der abschließenden
  Dokumentationsprüfung vorliegen.

Expected Handoff:

- Unit- und Contract-Testresultate mit Exit-Codes;
- Ergebnis des offline Release-/Fingerprint-Guards;
- vollständige Kriterienmatrix für den Orchestrator;
- getrennte Kennzeichnung von live-Eval-Ergebnis und
  umgebungsbedingt nicht verifizierbaren Checks.

### WP-QA-2: Prompt-Eval und fachliche Regression

Agent: QA

Goal

Den unveränderten beziehungsweise bewusst neuen Prompt-Release gegen die
bestehenden Daily-Eval-Fixtures und die fachlichen v14-/v15-Erwartungen prüfen.

Required Knowledge Base:

- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:

- `backend/src/lib/prompts/dailyInsight.eval.test.ts`
- `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`
- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/prompts/dailyInsightPromptManifest.ts`
- `backend/scripts/run-eval.mjs`

Required Skills:

- `azure-openai-feature-integration`

Relevant Acceptance Criteria:

- AC-2
- AC-4
- AC-5
- AC-13

Dependencies:

- WP-QA-1 muss grün sein.
- Der Backend-Agent aktualisiert den bewussten `TESTED_PROMPT_VERSION`-
  beziehungsweise Fingerprint-Guard und revalidiert Fixtures bei einem neuen
  Release; QA ändert diese Eval-Dateien nicht, sondern prüft sie.

Expected Handoff:

- `cd backend && npm run test:eval` mit Ergebnis `VERIFIED` oder sauber
  dokumentiertem `UNVERIFIED` wegen fehlender Azure-Credentials;
- Bestätigung, dass Fixture-Erwartungen aus User Story/KB/Domain-Regeln und
  nicht zirkulär aus dem Prompt abgeleitet sind;
- fachliche Regressionseinschätzung für die bestehende Daily-Baseline.

## 15. Shared Package Changes

`shared/types/insight.ts` erhält ein additives Feld:

```ts
promptFingerprint?: string;
```

Das Feld ist in `InsightDocument` und `InsightFeedbackDocument` optional, damit
historische Cosmos-Dokumente ohne Feld typisiert und gelesen werden können. Die
Backend-Schreibpfade setzen es für jedes neue Dokument. Die bestehende
`shared/index.ts`-Exportkette bleibt ausreichend; es ist kein neuer Runtime-
Value-Import aus `@fittrack/shared` zulässig.

Die Mobile-Typen ändern keinen sichtbaren DTO-Vertrag. Der Shared-Typecheck und
der Mobile-Typecheck müssen trotzdem laufen, weil die Typdefinition geteilt
wird.

## 16. Infrastructure and Configuration

### Persistence Impact

Additives optionales Provenienzfeld auf bestehenden `InsightDocument`- und
`InsightFeedbackDocument`-Dokumenten, Schema-Evolutionsklasse **Class 0**.

- Kein neuer Entity-Typ und kein neuer Container.
- `aiInsights` bleibt `/userId`-partitioniert.
- Kein Bicep-Update in `infra/modules/cosmos.bicep`.
- Keine Änderung an TTL, `expiresAt`, Dokument-IDs oder Feedback-Aufbewahrung.
- Keine explizite Migration in Dev oder Alpha.
- Alte Dokumente ohne Fingerprint bleiben lesbar; Daily wird bei einem neuen
  Aufruf über die harte Provenienzprüfung regeneriert, Feedback-Dokumente
  werden unverändert historisch erhalten.

### Development

Nach Backend-Implementierung und QA wird der geänderte Backendstand in Dev
verifiziert. Dabei müssen ein neues Daily-Dokument mit Fingerprint, ein Cache-Hit
mit identischer Identität und eine Regeneration nach Fingerprint-Änderung
beobachtbar sein. Der bestehende Dev-/Cosmos-Emulator-Testpfad bleibt die
technische Datenbankprüfung.

### Alpha

Kein Alpha-Deployment ist Bestandteil dieses Plans. Eine spätere Alpha-
Freigabe erfolgt nur über den expliziten operativen `Deploy to Alpha`-Befehl
nach erfolgreicher Dev-Verifikation und QA. Es ist keine Datenmigration
vorzuschalten.

### Release und Mobile

Es gibt keine neue Azure-Ressource, keine neue Function-Route, keinen neuen
App-Setting-Schlüssel und keinen EAS-Build-Bedarf. `Infrastructure Impact: Dev`
bezeichnet die notwendige Dev-Verifikation des Backend-Verhaltens, nicht eine
IaC-Änderung.

## 17. Documentation Updates

### WP-DOC-1: Knowledge-Base-Korrektur

Agent: Backend

Goal

Die Knowledge Base nach der Implementierung auf die tatsächliche Prompt-
Identitäts-, Cache- und Legacy-Policy bringen, ohne geplantes Verhalten als
bereits implementiert zu beschreiben.

Required Knowledge Base:

- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

Required Repository Context:

- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/prompts/dailyInsightPromptManifest.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `shared/types/insight.ts`
- `backend/src/functions/dailyInsight.ts`
- `backend/src/functions/dailyInsightFeedback.ts`
- `.github/workflows/ci.yml`

Required Skills:

- None

Relevant Acceptance Criteria:

- AC-1
- AC-4
- AC-6
- AC-7
- AC-9
- AC-12
- AC-14

Dependencies:

- WP-BE-2 muss abgeschlossen sein, damit nur der tatsächlich implementierte
  Vertrag dokumentiert wird.

Expected Handoff:

- aktualisierte KB-Verweise auf `dailyInsightPrompt.ts`;
- dokumentierte Dual-Identity aus `promptVersion` und `promptFingerprint`;
- dokumentierte Grenzbuckets, Legacy-Lesbarkeit, Class-0-Einstufung und CI-
  Guard;
- Bestätigung, dass der API-Referenztext unverändert bleiben kann oder die
  konkret erforderliche minimale Korrektur benennt.

Zu aktualisieren sind mindestens die Daily-Abschnitte in
`docs/kb/domain/07-ai-features.md`, `docs/kb/tech/06-ai-integrations.md` und
der Test-/CI-Teil in `docs/kb/tech/08-testing.md`. `docs/kb/tech/09-api-reference.md`
wird nur geändert, falls die Implementierung entgegen diesem Plan einen
öffentlichen Response-Vertrag anfasst.

## 18. Infrastructure & Release Work Package

### WP-INFRA-1: Dev-Verifikation des Backend-Releases

Agent: Infrastructure & Release

Goal

Den von Backend und QA freigegebenen Stand in der Development-Umgebung
verifizieren und bestätigen, dass die Korrektur keine Infrastrukturänderung
oder Datenmigration benötigt.

Required Knowledge Base:

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

Required Repository Context:

- `backend/package.json`
- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/repositories/insightRepository.ts`
- `infra/main.bicep`
- `infra/modules/cosmos.bicep`
- `_deploy_staging/`

Required Skills:

- None

Relevant Acceptance Criteria:

- AC-12
- AC-13

Dependencies:

- WP-QA-2 muss grün sein.
- Es dürfen keine Bicep-, Container- oder Migrationsartefakte aus diesem Plan
  vorliegen.

Expected Handoff:

- Dev-Verifikation des Backendstands mit Ergebnis und Exit-Codes;
- Bestätigung: kein neuer Cosmos-Container, keine Partition-Key- oder
  TTL-Änderung, keine Migration und kein EAS-Build;
- klare Kennzeichnung, dass eine spätere Alpha-Freigabe nur über einen
  expliziten operativen Befehl erfolgt.

## 19. Test Strategy

### Unit-Tests

- Prompt-Root: alle sechs Intents, vollständige Snapshot-Komposition,
  keine Nutzung des partiellen statischen Exports, deterministischer
  Fingerprint.
- Fingerprint: identisches Bundle ergibt identischen Hash; jede veränderte
  Fragmentzeichenkette, Guard-Policy, Assembly-Version oder Schemaeigenschaft
  ergibt einen anderen Hash.
- Release-Guard: v14-Baseline entspricht dem Manifest; ein fehlender oder
  geänderter Release-Eintrag schlägt offline fehl.
- Hash: sign-sensitive Kalorien- und Protein-Grenzen, `null`, `-0`,
  Rundungsstabilität und Änderungen von Prompt-Fingerprint/System-Prompt-Hash.
- Cache: gleicher vollständiger Key liefert `cached`; Version, Fingerprint,
  fehlende Provenienz oder System-Prompt-Hash erzwingen Regeneration trotz
  Rate-Limits.
- Handler: neue Daily-Dokumente und Responses tragen korrekte serverseitige
  Provenienz; Persistenzfehler melden kein falsches Feedback-Angebot.
- Feedback: Fingerprint wird aus der Daily-Instanz kopiert; Client-Felder
  werden nicht akzeptiert; Idempotenz und Generation-Bindung bleiben erhalten.

### Contract-Tests

`cosmosInsightRepository.contract.test.ts` ergänzt:

- Roundtrip eines Daily-Dokuments mit `promptFingerprint`;
- Roundtrip eines Feedback-Dokuments mit Fingerprint;
- Lesen eines alten Daily-Dokuments ohne Fingerprint;
- Lesen eines alten Feedback-Dokuments ohne Fingerprint;
- unveränderte `_docType`-Filter, Partition, IDs und TTL-/No-TTL-Regeln.

Die Tests laufen ausschließlich gegen den lokalen beziehungsweise CI-Cosmos-
Emulator, niemals gegen Dev- oder Alpha-Cosmos.

### Prompt-Evals

`dailyInsight.eval.test.ts` behält einen bewussten Release-Guard. Bei v14
müssen bestehende Fixtures erneut geprüft werden. Bei v15 werden
`TESTED_PROMPT_VERSION`, der erwartete Fingerprint und alle betroffenen
Fixture-Constraints bewusst aktualisiert. `npm run test:eval` bleibt wegen
Kosten, Credentials und Provider-Stabilität ein expliziter QA-/Release-Check
und wird nicht als ungeschützter Azure-Aufruf in den normalen CI-Job gelegt.

### CI-Prüfungen

Der CI-Workflow ergänzt vor den Backend-Unit-Tests einen offline
`verify:daily-insight-prompt`-Schritt. Er prüft Release-Historie, berechneten
Fingerprint, append-only Verhalten und Änderungen an Prompt-/Schema-Dateien.
Die Unit-Stufe führt weiterhin Backend-/Shared-/Mobile-Typechecks und Backend-
Unit-Tests aus. Die Contract-Stufe bleibt nach erfolgreicher Unit-Stufe an den
Cosmos-Emulator gebunden.

Empfohlene lokale beziehungsweise QA-Kommandos:

```text
npm run verify:daily-insight-prompt --workspace=backend
npm run typecheck --workspace=shared
npm run typecheck --workspace=backend
npm run typecheck --workspace=mobile
npm test --workspace=shared
npm test --workspace=backend
npm run build:verify --workspace=backend
npm run test:contract --workspace=backend
cd backend && npm run test:eval
node scripts/check-encoding.mjs
```

## 20. Acceptance Criteria

**AC-1.** Der aktive Runtime-Import verwendet `dailyInsightPrompt.ts`; kein
aktiver Handler-, OpenAI- oder Testpfad verwendet `dailyInsightV10.ts`. Die
historischen v3-v9-Dateien bleiben unverändert und als nicht aktiv erkennbar.

**AC-2.** Ein einziger Composition Root verwendet Shared Tone, Output Contract,
alle sechs Intent-Module, Guard-Texte, Guard-Grenzen, Assembly-Version und das
Strict-Schema. Jeder Provider-Aufruf erhält den vom Builder erzeugten exakten
Snapshot.

**AC-3.** Der gleiche vollständige Prompt-Bundle-Input erzeugt bytegleich denselben
`promptFingerprint`. Eine gezielte Änderung an jedem einzelnen importierten
Promptmodul, an Guard-Policy, Assembly-Version oder Schema erzeugt einen anderen
Fingerprint. Dieser Nachweis ist durch Offline-Unit-Tests erbracht.

**AC-4.** Die Release-Historie enthält den berechneten aktuellen v14-Fingerprint
oder einen begründeten neuen v15-Eintrag. Der CI-Guard schlägt fehl, wenn ein
provider-sichtbarer Promptbestandteil geändert wurde, ohne einen neuen
append-only Release-Eintrag zu ergänzen oder wenn ein historischer Eintrag
verändert wird.

**AC-5.** Der Cache-Key enthält `promptVersion`, `promptFingerprint` und den Hash
des tatsächlich zusammengesetzten System-Prompts. Eine Promptänderung kann
keinen unveränderten Cache-Hit erzeugen, selbst wenn die manuelle Version
versehentlich gleich geblieben ist.

**AC-6.** Jedes neu persistierte Daily- und Feedback-Dokument enthält den
serverseitig berechneten Fingerprint zusätzlich zu Version, vollständigem
`promptSnapshot`, `inputContext` und `inputHash`. Kein Fingerprint wird aus dem
Client-Request übernommen.

**AC-7.** `shouldRegenerate()` invalidiert bei fehlender oder abweichender
Version, fehlendem oder abweichendem Fingerprint, fehlender Intent-Provenienz
oder fehlendem Snapshot hart und unabhängig von 30-Minuten-/Tageslimits. Bei
vollständig identischer Provenienz und identischem Input-Key bleibt der Cache-
Hit bestehen.

**AC-8.** Die Hash-Tests unterscheiden mindestens `remainingCalories = -0.01`,
`0` und `0.01` sowie `remainingProteinG = 19.99`, `20` und `20.01`. `null` wird
als unbekannt behandelt. Rundungsstabilität für Werte außerhalb einer
steuernden Grenze bleibt erhalten.

**AC-9.** Feedback kopiert den Fingerprint der exakt gebundenen Daily-Instanz.
Idempotente Wiederholung, Submission-Konflikt, abgelaufene Daily nach bereits
angelegtem Feedback und Generation-Mismatch behalten ihren bestehenden Vertrag.

**AC-10.** Ein altes Daily- oder Feedback-Dokument ohne Fingerprint bleibt durch
die Repository-Schicht lesbar. Es wird kein globaler Backfill ausgeführt. Ein
altes Daily wird nicht als vollständige neue Feedback-Provenienz ausgegeben;
bei einem neuen Daily-Aufruf greift die harte Erneuerungslogik.

**AC-11.** Der aktive partielle `DAILY_INSIGHT_SYSTEM_PROMPT`-Export ist entfernt.
`openai.ts` re-exportiert ihn nicht mehr, und es existiert keine zweite aktive
statische Promptquelle, die vom Runtime-Builder abweichen kann.

**AC-12.** Der öffentliche Daily-Response-Vertrag, `promptVersion`, der
Feedback-Request, Authentifizierung, Quota-Reihenfolge und die bestehende
Feedback-Idempotenz bleiben unverändert. `promptFingerprint` wird nicht an
Mobile ausgeliefert.

**AC-13.** Backend-Unit-Tests, Shared-/Backend-/Mobile-Typechecks,
`build:verify`, der offline Release-Guard und Cosmos-Contract-Tests sind grün.
Prompt-Evals bestehen für den bewussten getesteten Release; fehlende Azure-
Credentials werden als `UNVERIFIED` und nicht als stiller Erfolg dokumentiert.

**AC-14.** Die Knowledge Base verweist auf den neuen aktiven Root und beschreibt
Dual-Identity, Fingerprint-Berechnung, harte Cache-Invalidierung,
Grenzbuckets, Class-0-Legacy-Verhalten und CI-/Eval-Prüfungen korrekt.

**AC-15.** Wenn die Persistenz eines erfolgreichen AI-Ergebnisses fehlschlägt,
wird kein unvollständiges Dokument als vorhanden behandelt und die Antwort
behauptet nicht `feedbackAvailable: true`. Der Fehler ist strukturiert geloggt
und der bestehende Quota-Vertrag bleibt nachvollziehbar.

## 21. Risks and Edge Cases

- Ein globaler Fingerprint invalidiert auch Caches für Intents, deren Text sich
  nicht geändert hat. Das verursacht mögliche zusätzliche AI-Aufrufe, ist aber
  die erwartbare Folge einer globalen Release-Identität und verhindert
  gemischte Releases im selben Daily-System.
- Ein Entwickler könnte den Manifest-Lock manipulieren. Der append-only
  Vergleich gegen die CI-Basis und die Review der Release-Historie reduzieren
  dieses Risiko; der Runtime-Fingerprint bleibt unabhängig davon berechnet.
- Eine reine Assembly-Codeänderung kann statische Fragmentdaten unverändert
  lassen. Deshalb sind System-Prompt-Hash, Assembly-Version und ein expliziter
  Test für jede Guard-Variante erforderlich.
- Alte Daily-Dokumente können bei einem ersten Aufruf Kosten für eine neue
  Generation erzeugen. Das ist eine bewusste Sicherheitsentscheidung gegen die
  Rückgabe einer nicht reproduzierbaren alten Provenienz.
- Feedback-Dokumente ohne Fingerprint bleiben historisch unvollständig nach
  neuem Standard, dürfen aber nicht durch eine aktuelle Fingerprint-Annahme
  verfälscht werden.
- Ein Persistenzfehler nach erfolgreichem Provider-Aufruf kann wiederholte
  Generierungen auslösen. Logging und `feedbackAvailable: false` machen den
  Zustand sichtbar, ohne den bestehenden öffentlichen Fehlerpfad zu brechen.
- Der Hash darf `NaN`, Infinity oder `-0` nicht unkontrolliert über
  `JSON.stringify` in eine falsche semantische Kategorie überführen.
- Jede Änderung am Strict-Schema erfordert neben Unit- und Contract-Tests eine
  bewusste Eval- und Release-Prüfung; ein bloßer Fingerprint-Update ist dafür
  nicht ausreichend.
- Es dürfen keine Geheimnisse, Prompt-Credentials oder Azure-Schlüssel in
  Manifest, Fingerprint-Test, CI-Ausgabe oder Dokumentation gelangen.

## 22. Recommended Execution Order

Die Ausführung erfolgt strikt in dieser Reihenfolge:

1. **WP-BE-1:** aktiven Prompt-Root umbenennen, zentrale Schemaquelle,
   Bundle-Identität und Release-Manifest implementieren; feststellen, ob v14
   provider-semantisch unverändert bleibt.
2. **WP-BE-2:** Shared-Provenienzfeld, Fingerprint-/System-Hash, semantische
   Grenzbuckets, harte Cache-Invalidierung sowie Daily-/Feedback-Persistenz
   implementieren.
3. **WP-DOC-1:** Knowledge Base und Testdokumentation anhand des tatsächlich
   implementierten Vertrags aktualisieren.
4. **WP-QA-1:** Offline-Guard, Typechecks, Unit-Tests, Build-Verification und
   Cosmos-Contract-Tests ausführen und Abweichungen an den Orchestrator
   zurückgeben.
5. **WP-QA-2:** den bewussten Prompt-Release mit `npm run test:eval` prüfen,
   Fixture- und Provider-Ergebnis dokumentieren und die vollständige
   Kriterienmatrix abschließen.
6. **WP-INFRA-1:** Dev-Verifikation des geprüften Backendstands und Bestätigung
  der unveränderten Infrastruktur-/Migrationsgrenzen.
7. Eine Alpha-Freigabe bleibt ein separater, explizit angeforderter Vorgang.

**Plan-Ende.**
