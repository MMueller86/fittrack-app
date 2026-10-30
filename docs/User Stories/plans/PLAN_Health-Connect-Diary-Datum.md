## Mini-Plan: Diary-Datum in Health Connect

**Status:** Planungsvorschlag, nicht implementiert  
**Bewertung:** Anforderung annehmen. Die Korrektur gehört ausschließlich in die mobile Zuordnung des Diary-Datums zum Health-Connect-Zeitstempel.  
Infrastructure Impact: None  
Mobile Build Impact: None

**Befund und Empfehlung**  
In [nutritionSyncService.ts](mobile/src/services/health/nutritionSyncService.ts) bevorzugt `toNutritionRecord` aktuell `meal.createdAt`; damit kann eine heute angelegte Mahlzeit für gestern in Health Connect auf heute datiert werden. Backend und Diary-API speichern das ausgewählte `meal.date` bereits getrennt vom Erstellungszeitpunkt. [HealthConnectService.ts](mobile/src/services/health/HealthConnectService.ts) reicht die gebauten Zeitstempel und Offsets an Health Connect weiter.

Der Mapper soll für die Ernährungseinträge das lokale Kalenderdatum aus `meal.date` verwenden, auch wenn `createdAt` vorhanden ist. Als technische Repräsentation des date-only-Werts eignet sich der bereits vorhandene Fallback: lokaler Mittag des Diary-Tages, mit einer Dauer von einer Sekunde. Das ist ein neutraler notwendiger Zeitanker für den Health-Connect-Record, **keine behauptete Mahlzeiten-Uhrzeit**. Die Zone-Offsets sollen zu diesem Anker gehören, nicht zum Zeitpunkt der Synchronisierung; so bleibt auch eine abweichende Sommerzeit für den betreffenden Tag korrekt abgebildet.

**Scope**
- Mobile-Mapping von `Meal.date` auf `NutritionHealthRecord` korrigieren.
- Regressionstest im bestehenden Nutrition-Sync-Test ergänzen.
- Die Date-only-/Zeitanker-Konvention in der mobilen Knowledge Base dokumentieren.

**Out of Scope**
- Änderungen an Backend, API, Datenmodell oder `createdAt`.
- Erfinden oder Speichern einer Mahlzeiten-Uhrzeit oder Zeitzone.
- Automatisches Reparieren bereits vorhandener Health-Connect-Einträge. Sie werden durch die Codeänderung allein nicht erneut geschrieben; eine spätere Synchronisierung/Upsert kann separat erfolgen.
- Native Module, Berechtigungen, App-Konfiguration oder Infrastruktur.

**Privacy Impact**  
Privacy Impact: Policy covered  
Data flow: Diary-Datum und Nährwerte → NutritionRecord in Health Connect auf dem Gerät, nach bestehender Berechtigung; lokaler Sync-Zustand bleibt wie bisher und enthält keine Mahlzeiten-Snapshots.  
Policy sections affected: „Health Connect (optional, nur Android)“ und bestehende Kontolöschungs-Aussage zu Health Connect.  
Proposed text: N/A  
Open questions: Keine. Die Korrektur ändert weder Datenkategorie, Empfänger, Zweck noch Aufbewahrung. Die Datenschutzerklärung muss dafür nicht angepasst werden.

**Frontend Work Package**
Agent: Frontend

Goal: Health-Connect-Nutrition-Zeitstempel aus dem fachlichen Diary-Datum bilden, unabhängig von `createdAt`.

Required Knowledge Base:
- [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md)
- [docs/kb/domain/02-diary.md](docs/kb/domain/02-diary.md)

Required Repository Context:
- [nutritionSyncService.ts](mobile/src/services/health/nutritionSyncService.ts)
- [nutritionSyncService.test.ts](mobile/src/services/health/nutritionSyncService.test.ts)
- [IHealthPlatformService.ts](mobile/src/services/health/IHealthPlatformService.ts)
- [HealthConnectService.ts](mobile/src/services/health/HealthConnectService.ts)
- [localDate.ts](mobile/src/shared/date/localDate.ts)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria: AC-1 bis AC-4

Dependencies: None

Expected Handoff: Geändertes Mapping, Regressionstest, aktualisierte KB-Dokumentation und Ergebnisse der fokussierten Tests.

**QA Work Package**
Agent: QA

Goal: Regression, Zone-Offset-Bildung, Dokumentation und Privacy-Konsistenz gegen die Akzeptanzkriterien prüfen.

Required Knowledge Base:
- [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md)
- [docs/kb/tech/08-testing.md](docs/kb/tech/08-testing.md)
- [docs/kb/domain/02-diary.md](docs/kb/domain/02-diary.md)

Required Repository Context:
- [nutritionSyncService.ts](mobile/src/services/health/nutritionSyncService.ts)
- [nutritionSyncService.test.ts](mobile/src/services/health/nutritionSyncService.test.ts)
- [IHealthPlatformService.ts](mobile/src/services/health/IHealthPlatformService.ts)
- [HealthConnectService.ts](mobile/src/services/health/HealthConnectService.ts)
- [docs/legal/datenschutzerklaerung-alpha.md](docs/legal/datenschutzerklaerung-alpha.md)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria: AC-1 bis AC-5

Dependencies: Frontend-Work-Package

Expected Handoff: QA-Ergebnis zu allen Kriterien; ein möglicher manueller Android-Check ist separat als `MANUAL VALIDATION REQUIRED` oder `UNVERIFIED` auszuweisen.

**Akzeptanzkriterien**
1. Bei `meal.date = gestern` und `createdAt = heute` liegt das lokale Kalenderdatum von `startTime` auf `meal.date`, nicht auf dem Erstellungsdatum.
2. Der Test prüft den date-only-Anker im lokalen Kalender, eine Endzeit genau eine Sekunde nach der Startzeit und Offsets passend zum Ankerdatum. Nährwerte, Meal-Type-Mapping und `clientRecordId` bleiben unverändert.
3. Der Fall wird als Regression in [nutritionSyncService.test.ts](mobile/src/services/health/nutritionSyncService.test.ts) abgedeckt, ohne eine Mahlzeiten-Uhrzeit als fachliche Information einzuführen.
4. [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md) dokumentiert die date-only-Abbildung und den neutralen Zeitanker. Die Datenschutzerklärung bleibt unverändert.
5. Keine Backend-, API-, Persistenz-, Berechtigungs- oder Infrastrukturänderung.
6. QA führt aus `mobile/`: `npx vitest run src/services/health/nutritionSyncService.test.ts` und `npx tsc --noEmit`.
7. Falls ein Android-Testgerät verfügbar ist: eine für gestern eingetragene Mahlzeit synchronisieren und das angezeigte Health-Connect-Datum prüfen. Dieser Integrationstest ist manuell; fehlende Geräte sind kein Code-Testfehler.

**Dokumentationsbewertung und Reihenfolge**  
Die KB beschreibt Health-Connect-Synchronisierung bereits, aber nicht diese Datumsabbildung. Daher sollte `docs/kb/tech/03-mobile.md` im selben Änderungspaket ergänzt werden; ein Privacy-Policy-Update ist nicht erforderlich. Reihenfolge: Frontend-Änderung samt Test und KB-Update, anschließend QA. Keine Datei wurde angelegt oder geändert.
