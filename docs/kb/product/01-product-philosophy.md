# Product Philosophy

## Mission

FitTrack is a mobile nutrition and training companion for people who want clear insight into what they eat and how it relates to their goals. The app prioritizes informed decisions over automation.

## MVP Scope

Confirmed MVP features:
- Google SSO / Entra CIAM authentication
- Guided onboarding (profile + goals)
- Nutrition target calculation (Mifflin-St Jeor)
- Daily nutrition diary with meals and macro tracking
- Weight tracking with trend visualization
- Reusable food library (personal catalog)
- Recipe management
- AI-assisted food entry (parse, estimate, scan, image)
- Daily AI personal insight (progress briefing)
- Open Food Facts catalog integration

Explicitly out of MVP scope:
- Health/heart rate/steps dashboard widgets
- Offline mode
- Generic AI chat
- Admin UI

## Core Principles

### 1. Guided Workflows over Raw Features

The app does not expose raw AI capabilities. Every AI feature is wrapped in a task-specific guided workflow with a clear start, review step, and confirmation. The user always knows what they are confirming.

### 2. AI-Assisted but Human-Confirmed

[Rule] AI estimates are previews, not results. The user must explicitly confirm before any AI output is saved to their data. This protects data quality and user trust.

### 3. Backend Owns Intelligence

No direct AI calls from the mobile app. The mobile app calls FitTrack backend APIs. The backend orchestrates AI. This keeps API keys secure and allows the backend to validate, enrich, and quota-manage AI responses.

### 4. Reuse-First Nutrition Logging

Users build a personal food library over time. The food search prioritizes the user's own library before the general catalog. Frequently used foods become favorites for one-tap access.

### 5. Cost-Aware Design

- Azure gpt-4o-mini (cost-efficient model for MVP)
- Monthly quotas per feature per user
- Serverless infrastructure (pay per use)
- On-the-fly day summary calculation (no redundant storage)

### 6. Cloud-Only, Internet Required

No offline mode. Persisted cloud data is the source of truth. The app fails gracefully when offline (friendly error messages, no data corruption).

### 7. Consistency Beats Perfection

The hint engine and daily insight system are designed to reward consistent logging, not perfect tracking. Motivational copy reflects this philosophy.

### Wochenrückblick auf der Startseite (US-01)

Der Homescreen zeigt den Wochenrückblick direkt nach der Tages-Nutrition-Karte. Er umfasst immer die sieben abgeschlossenen lokalen Kalendertage vor dem Referenzdatum und vergleicht jeden Tag mit seinem eigenen historischen effektiven Kalorienziel. Die Darstellung besteht aus genau sieben festen Balken ohne horizontales Scrollen. Jeder Balken ist ein zugänglicher Info-Trigger und öffnet zuerst ausschließlich das informative Tagesdetail-Overlay. Der Balken selbst navigiert und mutiert nicht; nur der darin enthaltene Link `Tagebuch öffnen` darf das bestehende Tagebuch für das ausgewählte date-only-Datum öffnen.

Die Zielnähe wird zentral mit einer inklusiven grünen Zone von `95–105 %` bewertet. Werte außerhalb dieser Zone werden orange dargestellt. Fehlende Ernährung, fehlendes historisches Ziel und vollständig fehlende Tagesdaten bleiben als neutrale diagonale Schraffur ohne Höhen-Semantik sichtbar und werden weder als `0 kcal` noch als Unterversorgung interpretiert. Ein vorhandener MealItem mit `0 kcal` bleibt ein solider normaler Balken. Training und besondere Aktivitäten erhalten kompakte Marker innerhalb ihrer jeweiligen Diagrammspalte; beide Marker bleiben bei einer Kombination sichtbar. Zeitraum im Header und Wochentag unter dem Balken bleiben sichtbar; das einzelne Tagesdatum sowie Tagesziel-, Ziel- und Statuszeilen entfallen aus dem engen Raster.

Die sichtbare Reihenfolge des Diagrammrasterbereichs ist `Balken -> Wochentag -> Markerbereich -> Markerlegende -> Farblegende`; sofern keine Sonderaktivität vorkommt, entfällt die Markerlegende. Die Marker liegen ausschließlich in sieben stabilen Zellen unterhalb der Wochentagslabels und nicht in `barTrack`. Bekannte Trainingsmarker übernehmen den gemeinsamen Home-Katalog: `Gym`, `Bouldern / Klettern`, `Laufen`, `Radfahren` und `Sonstiges`; ein fehlender oder unbekannter Workout-Wert wird neutral als `Training` dargestellt. Ein Ruhetag ohne Sonderaktivität bleibt markerfrei. Sonderaktivitäten werden als `Radtour`, `Wanderung` oder neutral als `Sonderaktivität` markiert; bei Training plus Sonderaktivität werden beide Marker in dieser Reihenfolge nebeneinander dargestellt. `cycling` als Workout bleibt dadurch mit dem Label `Radfahren` ein Trainingsmarker, während `cycling` als Sonderaktivität mit `Radtour` ein anderer Marker ist. Unter den Balken wird kein konkretes Datum gerendert; das date-only-Datum bleibt dem Tagesdetail-Overlay vorbehalten. Die Marker sind dekorativ und erzeugen keine eigenen TalkBack-Aktionsziele. Die Markerlegende wird bei beliebigen Sonderaktivitäten auf genau einen Eintrag `Sonderaktivität` dedupliziert; die vollständige Farblegende mit `Im Ziel`, `Nicht im Ziel` und `Keine Daten` bleibt erhalten. Die Farblegende ist vertikal zentriert und bricht ihre Einträge kontrolliert responsiv um.

Die Tagestyp-Auswahl, die Coachingkarte und die bekannten Wochenmarker verwenden denselben monochromen Home-Katalog aus `mobile/src/modules/home/homeTrainingPresentation.ts`: `rest`/`Ruhetag`/`sleep`, `gym`/`Gym`/`weight-lifter`, `bouldering`/`Bouldern / Klettern`/`human-handsup`, `running`/`Laufen`/`run`, `cycling`/`Radfahren`/`bike` und `other`/`Sonstiges`/`dots-horizontal`. Die Icons werden neutral einfarbig dargestellt; die lila semantische Hervorhebung ist ausschließlich der transparente Rahmen des exakten Sonderaktivitätstags, nicht eine Füllung, Zielstatusfarbe oder Nachbarspaltenkontur.

Das Tagesdetail-Overlay zeigt Wochentag sowie Verbrauch, Zielerreichung und effektives Ziel in der kompakten Kalorienvisualisierung. Diese drei Kalorienwerte werden nicht zusätzlich in den erklärenden Body geschrieben. Bei besonderer Aktivität oder Training werden nur die kompakten Label-/Wert-Gruppen `Basisziel`, `Aktivitätsbonus`, `Effektives Ziel` und `Sonderaktivität` im Sonderaktivitätskontext angezeigt (`Aktivität` nur bei Training ohne Sonderaktivität); `Tagestyp`, `Workout-Typ` und `Datenstatus` werden vollständig aus der sichtbaren und der Accessibility-Darstellung entfernt. Fehlende Werte heißen `Nicht verfügbar`, gültige `0`-Werte bleiben sichtbar. Die aus dem Wochenresponse vorab gelieferten tatsächlichen Makros werden absolut als Protein, Kohlenhydrate und Fett angezeigt; ohne belastbare Makrodaten bleibt der Bereich neutral, und es werden keine historischen Makroziele erfunden. Der Header-Link `Tagebuch öffnen` steht getrennt vom primären `Schließen`-CTA und öffnet ausschließlich das bestehende Tagebuch für das ausgewählte date-only-Datum. Nach dem Diagramm stehen genau zwei kompakte vollbreite Bilanzzeilen: `7-Tage-Ziel` zeigt sichtbar `<Gegessen> / <Ziel>`, `Ø Ziel / Tag` zeigt sichtbar `<Gegessen> / <Ziel>` im bestehenden Zahlenformat; `Gegessen` und `Ziel` werden nur in der Accessibility-Beschreibung zur Bedeutungs- und Reihenfolgesicherung genannt. Gegessene Aggregate folgen der bestehenden Gesamt-Zielbandsemantik inklusive gültiger `0 %`-Werte; Zielwerte nach dem Schrägstrich bleiben neutral. `Zielerreichung in Prozent` steht genau einmal rechts oben im Header und bleibt bei fehlenden Totals neutral. Darunter steht ausschließlich der serverseitig generierte KI-Wochenbewertungstext. Der Text ist initial auf maximal zwei Textzeilen begrenzt, wird unbeschränkt mit identischer Typografie und realer Breite gemessen und kann bei tatsächlichem Überlauf vollständig mit `Mehr anzeigen` beziehungsweise `Weniger anzeigen` geöffnet und geschlossen werden. Bei Quota-, Netzwerk-, Provider- oder Parse-Fehlern bleiben die deterministischen Wochenwerte nutzbar; es wird kein erfundener Ersatztext erzeugt, sondern ein neutraler Nicht-verfügbar-Zustand angezeigt. Textuelle Diagrammüberschriften sowie die sichtbare Tageszählung entfallen. Die PNG-Referenz definiert nur Hierarchie, Dichte, Zielmarkierung und Anordnung. Ihre Beispielzahlen und die darin fehlerhaft grün dargestellten Werte über `105 %` sind keine fachliche Vorgabe.

Das Tages-Overlay enthält eine kompakte Kalorienvisualisierung gegen das effektive Kalorienziel oder den gelieferten Zielprozentsatz. Es bewahrt die vorhandene Aktivitäts- und Bonussemantik und hält absolute Makrowerte (einschließlich `0 g`) von der Kalorienbewertung getrennt, ohne historische Makroziele zu erfinden. Bei einem Refresh-Fehler bleibt ein vorhandener Wochenrückblick sichtbar und zeigt dezent `Aktualisierung fehlgeschlagen` mit dem bestehenden `Erneut versuchen`; ohne vorhandenen Rückblick bleibt der bestehende Fehlerzustand erhalten.

## MVP Milestones (Internal Reference)

- **M1** — Core infrastructure, profile, diary, weight tracking (complete)
- **M2** — Auth + onboarding (auth endpoints are stubs — CIAM handles tokens directly)
- **M3** — Dashboard today endpoint (stub: returns 501)

## Technology Philosophy

- TypeScript everywhere — type safety across the full stack
- Shared types as the contract between backend and mobile
- Zod for runtime validation at API boundaries
- Pure functions for all business logic (testable, deterministic)
- Repository pattern for data access (swappable implementations)
