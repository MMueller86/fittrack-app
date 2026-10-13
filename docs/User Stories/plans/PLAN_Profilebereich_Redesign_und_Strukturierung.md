# Technischer Plan: Profilbereich redesignen und neu strukturieren

**Status:** Ready for implementation — keine offenen Fragen. Die Rechtstexte sind ein pragmatischer Alpha-Text ohne juristische Prüfung und müssen vor einem öffentlichen Release neu bewertet werden. Kontolöschung ist in Alpha nicht implementiert.
**User Story:** None — eigenständiger Plan unter `docs/User Stories/plans/`  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None

## Rechtstexte (Textquellen)

- **Datenschutzerklärung:** [`docs/legal/datenschutzerklaerung-alpha.md`](../../legal/datenschutzerklaerung-alpha.md) ist die einzige Textquelle und wird in der App 1:1 eingebettet.
- **Impressum:** [`docs/legal/impressum-alpha.md`](../../legal/impressum-alpha.md).
- Beide Texte sind bewusst einfach gehalten: ein pragmatischer Alpha-Text ohne juristische Prüfung. Vor einem öffentlichen Release sind sie neu zu bewerten. Das ist keine Voraussetzung für die Alpha-Umsetzung.

## Confirmed Product Decisions

- **Profil-Hub:** Bottom-Tab und Hauptscreen heißen `Profil`. Die bestehende Übersicht persönlicher Daten und Tagesziele bleibt oben; weitere Bereiche stehen darunter.
- **Eigene Lebensmittel:** Die Liste enthält nur selbst angelegte Lebensmittel. `sourceType: 'openFoodFacts'` wird ausgeschlossen; der bisherige Titel `Meine Lebensmittel` wird in der Bibliothek zu `Eigene Lebensmittel`.
- **Künftige Bereiche:** `Gemeinsam` und `Rechtliches` sind feste Plätze der Zielstruktur. Für Freunde/Haushalt wird bis zur Umsetzung kein leerer Bereich und kein toter Platzhalter angezeigt. Die Rechte- und Datenfreigabe wird in einem separaten Feature-Plan entschieden.
- **Rechtliche Inhalte:** `Impressum` und `Datenschutzerklärung` werden als kurze, scrollbare In-App-Seiten umgesetzt, nicht als externe Links. Beide liegen unter `Profil > Rechtliches`; Datenschutz muss zusätzlich vor der ersten Profileingabe erreichbar sein. Textquelle: siehe „Rechtstexte (Textquellen)“.
- **Alpha-Kontext:** Die Alpha wird persönlich an eingeladene volljährige Tester verteilt. Das ist eine Verteilungspraxis, keine technische Altersprüfung oder Sperre.
- **Datenumfang und Zweck:** Es werden nur für die App-Funktionen nötige Daten verarbeitet; keine Werbung, kein Verkauf, keine Weitergabe zu anderen Zwecken.
- **Health Connect:** Gewichts- und Ernährungssynchronisierung sind auf Android getrennte, standardmäßig deaktivierte Funktionen mit eigener Android-Schreibberechtigung (`Weight` bzw. `Nutrition`). FitTrack schreibt lokal in Health Connect auf dem Gerät. Deaktivieren stoppt nur die weitere Synchronisation; bereits geschriebene Einträge bleiben. Die Oberfläche nennt vor der Aktivierung Datenkategorie und Ziel (Health Connect auf dem Gerät), ohne Google-Cloud- oder Google-Konto-Bezug.
- **Lokale Gerätedaten:** Die Health-Connect-Wiederholungswarteschlange bleibt bis zur Deinstallation der App; das Diagnoseprotokoll (max. 150 Einträge) ist in der Health-Connect-Ansicht manuell löschbar.
- **Aufbewahrung:** Kontodaten (inkl. Insight-Feedback) bleiben bis zur Kontolöschung gespeichert; Daily-/Weekly-Insights laufen automatisch ab; Application-Insights-Protokolle 30 Tage.
- **Kontolöschung im Redesign:** Im Profil-Edit-Bereich wird ein deaktivierter, als noch nicht verfügbar gekennzeichneter Platzhalter `Konto löschen` vorgesehen. Er ruft keine Lösch-API auf und erweckt nicht den Eindruck, ein Tap lösche Daten. Bis zur Implementierung gibt es keinen anderen Löschweg; der Datenschutztext sagt das ausdrücklich.

## Later Implementation
- **[Planned] Altersvalidierung (separate Folgestory):** Minderjährige erkennen und sperren; nicht Teil von F-1.1 oder F-1.3.
- **[Planned] Vollständige Kontolöschung (Folgefeature):** Muss später Entra, Cosmos-Dokumente, Blob-Bilder, Insights/Feedback, Nutzungsdaten und lokale App-Daten abdecken. `DELETE /api/profile` löscht heute nur das Profil-Dokument.

## Hinweis zur Verifikation

Keine rechtlichen Vorab-Gates. Der Datenschutztext beschreibt das tatsächliche App-Verhalten (siehe Confirmed Facts) und wird bei Verhaltensänderungen angepasst.

## 1. Requirement Assessment

**Classification:** Accept with modifications.

Die Design-System-Angleichung, die künftigen Profilbereiche und minimale In-App-Rechtstexte gehören in denselben Redesign-Plan. `Gemeinsam` und `Rechtliches` sind feste Plätze der Zielstruktur. Die Rechtstexte liegen als einfache Alpha-Texte unter `docs/legal/` vor und werden in der App eingebettet.

## 2. Feature Summary

Den Bottom-Tab `Profile` mit dem sichtbaren Label `Profil` zu einem konsistenten Profil-Hub mit einer kanonischen Bibliothek `Eigene Lebensmittel`, klar gegliederten Navigationsgruppen und kurzen In-App-Seiten für Impressum und Datenschutz weiterentwickeln. Datenschutz wird zusätzlich vor der ersten Profileingabe erreichbar gemacht. Die vorhandene Darstellung persönlicher Daten und Tagesziele bleibt erhalten; spätere Bereiche nutzen dieselben UI-Muster.

## 3. Current Behaviour

- `RootNavigator` registriert einen Bottom-Tab mit dem Routennamen `Profile`, setzt aber kein deutsches `tabBarLabel`; die sichtbare Bezeichnung kann dadurch aus dem englischen Routennamen abgeleitet werden.
- `ProfileScreen` mischt Profilübersicht, Tagesziele, Health-Connect-Einstieg und einen zweiten Tab `Meine Lebensmittel`. Die Bibliothek wird zusätzlich über eine Header-Schaltfläche geöffnet.
- `LibraryScreen` bietet bereits die Tabs `Favoriten` und `Meine Lebensmittel`. Der Produkt-Tab dort hat andere Funktionen als die Produktverwaltung in `ProfileScreen` bzw. `MyProductsScreen`.
- `MyProductsScreen` ist im Profile-Stack registriert. Eine Navigation zu `MyProducts` wurde in `mobile/src/` nicht gefunden; der Screen dupliziert dennoch die Lebensmittelverwaltung.
- Die Screens weichen bei Headern, Karten, Suchfeldern, Icons sowie einzelnen Farben, Radien, Abständen und Schriftgrößen voneinander ab. Unter anderem kommen Emoji-/Unicode-Zeichen als Icons und direkte Farb-/Typografie-Werte vor.
- `ProfileScreen`, `ProfileEditScreen` und `LibraryScreen` verwenden `Alert.alert`, obwohl die UX-Vorgaben app-eigene Bestätigungs- und Informationskomponenten vorsehen.
- Fehler beim Laden des Profils und der Produkte werden in `ProfileScreen` ignoriert. Ein Ladefehler kann daher wie ein echtes leeres Profil bzw. eine leere Produktliste aussehen.
- `ProfileEditScreen` zeigt derzeit einen aktiven `Profil löschen`-Button. Der Dialog sagt, alle persönlichen Daten würden entfernt; `DELETE /api/profile` löscht tatsächlich nur das Profil-Dokument.
- `ProfileWizardScreen` sammelt Profil-, Gewichts- und Zielangaben vor dem Profil-Hub. Es gibt derzeit keinen Datenschutz-Einstieg auf `LoginScreen` oder im Wizard.
- Für die angefragten neuen Bereiche wurde keine bestehende Route oder freigegebene UI-Zieladresse im Mobile-Code gefunden. Das ist ein aktueller Implementierungsbefund und schränkt den durch den Nutzer bestätigten künftigen Strukturbedarf nicht ein.
- `HealthConnectScreen` enthält bereits app-eigene Bestätigungs- und Snackbar-Komponenten; der Synchronisationsablauf selbst liegt außerhalb dieses UI-Redesigns.

## 4. Desired Behaviour

- Ein explizit deutsch benannter Profil-Tab mit einer verständlichen, ruhigen Übersicht.
- Einheitliche Typografie, Farb-, Abstands-, Radius-, Karten- und Suchfeldregeln auf den Profil-Stack-Screens.
- Genau ein klarer Weg zu Favoriten und `Eigene Lebensmittel`; die Produktliste enthält selbst angelegte Einträge, nicht importierte Open-Food-Facts-Items. Bestehende Produktaktionen gehen bei der Zusammenführung nicht verloren.
- Der inhaltliche Produkt-Summary folgt in Suche und eigener Bibliothek demselben Aufbau. Suchauswahl/Favorisieren und Bearbeiten/Löschen bleiben getrennte Aktionen ihrer jeweiligen Screens.
- Ein stabiler Profil-Hub mit wiederverwendbaren Gruppen und Eintragszeilen. Die Gruppenpositionen für `Gemeinsam` und `Rechtliches` werden im Redesign festgelegt.
- Spätere Freundes-/Haushaltseinträge und Rechtsziele lassen sich an der vorgesehenen Position mit denselben Komponenten ergänzen; sie benötigen dafür keine neue Profil-Navigation oder ein alternatives visuelles System.
- `Impressum` und `Datenschutzerklärung` sind kurze In-App-Inhalte unter `Profil > Rechtliches`; die Datenschutzerklärung ist außerdem auf dem Login-Screen und vor dem Speichern im ersten Profileinrichtungs-Wizard erreichbar.
- Die Datenschutzerklärung entspricht dem Text in `docs/legal/datenschutzerklaerung-alpha.md` und beschreibt das tatsächliche App-Verhalten.
- Kontodaten bleiben bis zur Kontolöschung gespeichert. Im Profil-Edit-Bereich ist `Konto löschen` nur ein deaktivierter, als zukünftig gekennzeichneter Platzhalter ohne Aktion. Bis zur Implementierung gibt es keinen anderen Löschweg.
- Noch nicht verfügbare Aktionen werden nicht als funktionsfähige oder navigierbare Links dargestellt.
- Profil-, Ziel-, Lebensmittel- und Health-Connect-Funktionalität bleibt fachlich unverändert.

## 5. Scope

- Profil-Hub und Profil-Stack-Navigation in `mobile/src/app/navigation/RootNavigator.tsx`.
- Darstellung und UI-Zustände in `ProfileScreen`, `ProfileEditScreen`, `LibraryScreen`, `MyProductsScreen` (Konsolidierung), `SearchState` und der gemeinsamen Oberfläche von `HealthConnectScreen`.
- In-App-Rechtstextseiten und ihre Einstiege in `LoginScreen`, `ProfileWizardScreen` und dem Profilbereich.
- Datenschutzerklärung als eingebetteter Text aus `docs/legal/datenschutzerklaerung-alpha.md`.
- Deaktivierter Kontolöschungs-Platzhalter im Profil-Edit-Bereich, ohne Backend-Aufruf.
- Ein konsolidierter Einstieg in Favoriten und selbst angelegte `Eigene Lebensmittel` einschließlich der heute vorhandenen Suche, Bearbeitung und Löschung.
- Gemeinsame, rein präsentative Produkt-Zusammenfassung für Search-Hub-Ergebnisse und eigene Lebensmittel; beide Bereiche behalten ihre eigenen Aktionen.
- Wiederverwendbare, profil-lokale Gruppen- und Zeilenkomponenten sowie die festgelegte Reihenfolge der künftigen `Gemeinsam`- und `Rechtliches`-Bereiche.
- Profilbezogene Bestätigungs-, Fehler-, Lade- und Leerzustände sowie Accessibility der betroffenen Bedienelemente.
- In-App-Darstellung der Rechtstexte aus `docs/legal/` ohne externe Legal-URLs.
- Knowledge-Base-Aktualisierung für Navigation und Mobile-Struktur.

## 6. Out of Scope

- Freunde einladen, Haushalte anlegen, Mitglieder verwalten oder Profil-, Tagebuch-, Ernährungs- oder Gewichtsdaten mit anderen Nutzern teilen.
- Backend-Endpunkte, gemeinsame Typen, Berechtigungsmodell, Cosmos-Datenmodell oder Infrastruktur für Haushalt/Freunde.
- Eine rechtliche Garantie oder juristische Prüfung der Rechtstexte.
- Implementierung der vollständigen Konto-/Datenlöschung oder Änderungen an Aufbewahrungsregeln; dieser Plan enthält nur den deaktivierten Platzhalter.
- Änderungen an Profilberechnung, Zielwerten, API-Verträgen oder Persistenz.
- Allgemeines Redesign des First-Launch-`ProfileWizardScreen`; der Datenschutz-Einstieg vor dem ersten Speichern bleibt Bestandteil dieses Plans.
- Neue Dependencies, Native Modules, Expo-Plugins oder Änderungen an `app.config.js`.

## 7. Confirmed Facts
- Die Backend-Profilvalidierung akzeptiert `age` als Ganzzahl von 10 bis 120 (`backend/src/functions/profile.ts`); eine technische Sperre für alle Minderjährigen ist nicht implementiert.
- Technische Altersprüfung, Minderjährigensperre oder Abbruch der Registrierung für Minderjährige; diese Validierung ist als separate `[Planned]`-Folgestory vorgesehen.

- Die App ist dark-only. Theme-Tokens liegen in `mobile/src/app/theme/`; `DiaryScreen` ist laut Design-System die visuelle Referenz.
- Die Mobile-Vorgaben verlangen deutsche UI-Texte, tokenbasierte Farben und Typografie sowie app-eigene Bestätigungs-/Fehler-UI statt nativer Alerts.
- Das Design-System definiert ein pillenförmiges Suchfeld mit `radius.full`, 52 pt Höhe, `surfaceMuted` und ohne Rahmen.
- `docs/kb/product/05-ux-patterns.md` definiert für Search-Result-Zeilen ein 52-pt-Thumbnail. `SearchState.ResultRow` setzt derzeit 44 pt um; der Code und das dokumentierte Pattern weichen voneinander ab. Das Redesign richtet die gemeinsame Präsentation an den dokumentierten 52 pt aus.
- Search Hub und Bibliothek haben unterschiedliche Aktionen und Datenformen. Der Search Hub rendert `ResultRow` in `SearchState.tsx`; die persönliche Bibliothek bearbeitet/löscht `ReusableItem`s. Die bestätigte Bedeutung von `Eigene Lebensmittel` schließt `sourceType: 'openFoodFacts'` aus.
- Die Knowledge Base erlaubt Community-Zugriff nur für ausdrücklich veröffentlichte Rezepte; andere Nutzerdaten bleiben benutzer-/partition-scoped. Diese Rezeptfreigabe ist kein Berechtigungsmodell für Haushalte.
- Die vorhandene Health-Connect-Funktion ist Android-spezifisch; ihre Synchronisationslogik ist nicht Ziel der Umstrukturierung.
- Anmeldung läuft über Microsoft Entra External ID; Zugriff auf FitTrack-Daten wird backendseitig dem authentifizierten Nutzer zugeordnet.
- Access- und Refresh-Tokens werden auf dem Gerät mit Expo SecureStore gespeichert.
- Profil-, Tagebuch-, Gewichts-, Rezept-, Bibliotheks-, Aktivitäts- und KI-Nutzungsdaten liegen in Cosmos DB; Rezeptbilder liegen in Azure Blob Storage. Die regulären User-Container haben in `cosmos.bicep` kein automatisches TTL.
- Gewichtsbasiertes Fortschrittstracking verwendet gespeicherte Gewichtseinträge. `ProgressScreen` zeigt ohne Eintrag den Hinweis, eine erste Messung einzutragen; der Gewichtsverlauf als Diagramm erscheint ab zwei Einträgen.
- `DELETE /api/profile` löscht ausschließlich das Profil-Dokument. Ein vollständiger Konto-/Datenlösch-Endpunkt ist nicht dokumentiert. Der derzeit aktive Button in `ProfileEditScreen` suggeriert daher fälschlich eine vollständige Löschung.
- Daily-Insight-Dokumente haben eine Ablaufzeit. Insight-Feedback-Dokumente haben weder `ttl` noch `expiresAt` und speichern Kommentar, Insight-Antwort, Prompt-Snapshot und Input-Kontext bis zur Kontolöschung.
- Application Insights ist an einen Log-Analytics-Workspace mit 30 Tagen Retention angebunden; Request-Bodies werden nicht protokolliert.
- Alpha-Ressourcen (Cosmos, Blob, Function App, Application Insights) liegen in North Europe; Azure OpenAI (`gpt-4o-mini`, Germany West Central) und Document Intelligence (North Europe) sind mit Dev geteilte Dienste; derselbe Entra-Tenant wie Dev (Stand Azure-Abfrage 2026-10-07).
- Gewichts- und Ernährungssynchronisierung sind auf Android standardmäßig deaktiviert und separat einschaltbar. Der Pfad ist ein lokaler Android-Schreibvorgang (`react-native-health-connect`, `insertRecords`, getrennte `write`-Berechtigung für `Weight`/`Nutrition`); im Exportpfad gibt es keinen Google-Cloud- oder Google-Konto-Aufruf. Die aktuellen Karten sagen „zu Google Health Connect“; F-1.1 formuliert das als Health Connect auf dem Gerät um. Deaktivieren lässt bereits geschriebene Einträge bestehen.
- Sync-Status und fehlgeschlagene Retry-Vorgänge liegen in AsyncStorage bis zur Deinstallation; das Diagnoseprotokoll (AsyncStorage, max. 150 Einträge) ist in der Health-Connect-Ansicht manuell löschbar.
- Azure OpenAI verarbeitet je nach Funktion Texte, Fotos und/oder Profil-, Tagebuch- und Gewichts-Kontext. Etikettenfotos liest zuerst Azure Document Intelligence aus.
- Andere FitTrack-Nutzerdaten bleiben privat. Ein Nutzer kann Rezepte ausdrücklich in der Community veröffentlichen; diese sind dann für angemeldete Nutzer sichtbar.
- `healthPlatformService` nutzt in Development-Builds und auf iOS den Mock-Service; der echte `HealthConnectService` läuft nur auf Android außerhalb des Development-Modus.
- Es existiert keine passende bestehende User Story für den Profilbereich. Der Nutzerwunsch in dieser Anfrage ist die bestätigte Grundlage für die künftigen Strukturplätze; der fehlende Story-Eintrag ist kein Ausschlusskriterium.

## 8. Recommended Information Architecture

Empfohlene Reihenfolge im Profil-Hub:

1. **Profil und Ziele:** vorhandene Zusammenfassung persönlicher Daten, Tagesziele und gut auffindbare Aktion `Bearbeiten`.
2. **Bibliothek:** ein Navigationseintrag zu `LibraryScreen`; dort bleiben `Favoriten` und `Eigene Lebensmittel` als getrennte Ansichten.
3. **Integrationen:** Health Connect mit bestehendem Android-/iOS-Verhalten.
4. **Gemeinsam:** fester Strukturplatz für Freunde und gemeinsamen Haushalt. Die Gruppe wird sichtbar, sobald mindestens ein freigegebener Eintrag oder eine aktive Funktion vorhanden ist; keine leere Gruppe und kein toter Platzhalter.
5. **Rechtliches:** fester Strukturplatz am Ende des Hubs für die In-App-Seiten `Impressum` und `Datenschutzerklärung`; es werden keine externen Links verwendet.

`Profil` ist als Tab- und Hauptscreen-Name bestätigt. `Eigene Lebensmittel` ist der bestätigte Name für selbst angelegte Lebensmittel. `Gemeinsam`, `Rechtliches` und der künftige Eintrag `Freunde & gemeinsamer Haushalt` bleiben Arbeitsnamen; die internen Route-IDs bleiben unverändert, sofern kein technischer Grund eine Änderung erfordert.

## 9. Proposed Technical Solution

- `ProfileMain` bleibt der Einstieg. Die bestehende Profil-/Zielübersicht bleibt oben sichtbar; Navigationsbereiche werden darunter als lesbare Gruppen mit wiederverwendbaren Zeilen dargestellt.
- Die Header-Aktion `Bibliothek` wird in einen normalen Eintrag innerhalb der Inhaltsstruktur überführt. Der vorhandene zweite `ProfileScreen`-Tab `Meine Lebensmittel` entfällt.
- `LibraryScreen` wird der einzige Einstieg für `Favoriten` und `Eigene Lebensmittel`. Die Produktansicht übernimmt Suche, Bearbeiten, Löschen und erneutes Laden. Sie zeigt ausschließlich selbst angelegte Items und schließt `sourceType: 'openFoodFacts'` aus.
- Der Search Hub und `Eigene Lebensmittel` verwenden dieselbe präsentative Komponente für Thumbnail, Produktname, Marke, Herkunft/Status und Nährwertzeile. Die Komponente enthält keine Navigation oder Mutation. `SearchState.ResultRow` behält Auswahl-, Favoriten- und Rezept-Quick-Accept-Aktionen; die Verwaltungszeile öffnet Bearbeiten und bietet Löschen separat an. Die Ansicht `Favoriten` bleibt eine Relation-Liste und wird nicht in den `ReusableItem`-Verwaltungsflow gezwungen.
- Die gemeinsame Thumbnail-Größe folgt dem dokumentierten UX-Pattern von 52 pt. `SearchState.ResultRow` wird dabei von derzeit 44 pt auf 52 pt angeglichen; der Search-Hub-Ablauf selbst bleibt unverändert.
- `MyProducts` wird erst aus `ProfileStackParamList` und `RootNavigator` entfernt, wenn der Frontend-Agent alle Aufrufer, Deep-Link-Konfigurationen und sonstigen Route-Abhängigkeiten geprüft hat. Falls doch ein externer Einstieg existiert, leitet er zur entsprechenden Bibliotheksansicht statt ins Leere.
- Wiederkehrende Profilgruppen und Eintragszeilen werden als kleine, profil-lokale Komponenten ausgeführt, sofern sie nach dem Umbau mehrfach verwendet werden. Sie sollen Titel, optionalen Untertext und eine klar erkennbare Aktion unterstützen. Keine globale Navigations-Registry und keine vorab registrierte Placeholder-Route für künftige Features.
- Die Gruppenreihenfolge `Integrationen` → `Gemeinsam` → `Rechtliches` wird als Teil des Redesigns dokumentiert. Gruppen ohne nutzbare Einträge werden nicht leer gerendert; spätere Features befüllen die vorbereiteten Positionen mit denselben Gruppen-/Zeilenkomponenten.
- Die betroffenen Screens verwenden `colors.*`, `typography.*`, `spacing.*` und `radius.*`. Karten folgen dem dokumentierten Card-DNA-Muster; Suchfelder dem dokumentierten Pill-Muster. Bestehende Icons und app-eigene Komponenten werden wiederverwendet; dekorative Emoji-/Unicode-Icons werden nicht als Ersatz für die vorhandene Icon-UI eingesetzt.
- `Alert.alert` wird in den erfassten Profil-Flows durch die passenden vorhandenen `ConfirmSheet`, `InfoOverlay` oder `Snackbar`-Muster ersetzt.
- Die Health-Connect-Oberfläche behält getrennte Opt-ins für Gewichts- und Ernährungseinträge sowie den Hinweis auf Datenkategorie und Ziel vor jeder Aktivierung bei. Das Ziel wird als Health Connect auf dem Gerät benannt, ohne Google-Cloud- oder Google-Konto-Bezug. Keine Synchronisation ohne ausdrückliche Nutzeraktion und erteilte Android-Schreibberechtigung.
- Der aktuell aktive Button `Profil löschen` in `ProfileEditScreen` wird durch einen deaktivierten, klar als zukünftig gekennzeichneten Platzhalter `Konto löschen` mit dem Zusatz `Wird später verfügbar` ersetzt. Er hat keine Aktion, ruft `DELETE /api/profile` nicht auf und darf keine erfolgreiche Kontolöschung behaupten.
- Ladefehler werden von echten Leerzuständen unterschieden. Ein fehlendes Profil darf nur dann den Einrichtungszustand zeigen, wenn der Request erfolgreich war und tatsächlich kein Profil vorliegt.
- `Impressum` und `Datenschutzerklärung` werden als In-App-Seiten im bestehenden Profile-Stack dargestellt; keine Browser- oder `Linking`-Navigation. Dieselbe Datenschutzerklärung ist über `LoginScreen` und `ProfileWizardScreen` erreichbar, bevor neue Profildaten gespeichert werden. Die Inhalte stammen aus `docs/legal/datenschutzerklaerung-alpha.md` und `docs/legal/impressum-alpha.md`; die Einbettung (z. B. als gemeinsame Text-Konstante im Mobile-Code) erfolgt an einer einzigen Stelle, nicht dupliziert pro Screen. Bei Änderungen an der Datei wird die eingebettete Fassung mitgezogen.
- Der künftige Haushaltseinstieg erhält keinen API- oder Datenzugriff in diesem Plan. Vor einer Implementierung sind Berechtigungen, Einladungszustände, Widerruf und Datenumfang gesondert zu definieren; vorhandene Rezeptfreigabe darf nicht übertragen werden.
- Keine Änderungen an Backend, Shared, API, Cosmos, Azure oder nativer Mobile-Konfiguration.

## In-App Legal Copy

Der Text steht ausschließlich in `docs/legal/datenschutzerklaerung-alpha.md` (Datenschutz) und `docs/legal/impressum-alpha.md` (Impressum). Er wird in diesem Plan nicht wiederholt. Beide Dateien sind pragmatische Alpha-Texte ohne juristische Prüfung; vor einem öffentlichen Release neu bewerten.

## 10. Frontend Work Package F-1

### F-1.1 Profil-Hub und gemeinsame Darstellung

**Agent:** Frontend  
**Goal:** Profil-Hub samt Profilbearbeitung, Health-Connect-Einstieg und deaktiviertem Konto-Lösch-Platzhalter an die beschlossene Benennung und Informationsarchitektur sowie an die geltenden Design-System-Regeln anpassen. Die Profil-lokalen Gruppen-/Zeilenmuster müssen die vorgesehenen `Gemeinsam`- und `Rechtliches`-Erweiterungen ohne neue Navigationsstruktur unterstützen. Die getrennten Health-Connect-Opt-ins und der Hinweis auf Datenkategorie und gerätelokalen Health-Connect-Speicher vor jeder Aktivierung bleiben erhalten; die Copy darf keine Google-Cloud- oder Google-Kontoübermittlung nahelegen.

**Scope boundary:** Keine technische Altersprüfung oder Minderjährigensperre in F-1.1. Die Profilvalidierung bleibt unverändert; die separate geplante Registrierungsvalidierung ist nicht Teil dieses Arbeitspakets.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/04-profile-goals.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/app/theme/index.ts`
- `mobile/src/modules/profile/ProfileScreen.tsx`
- `mobile/src/modules/profile/ProfileEditScreen.tsx`
- `mobile/src/modules/healthConnect/HealthConnectScreen.tsx`
- `mobile/src/shared/components/Icon.tsx`
- `mobile/src/shared/components/ConfirmSheet.tsx`
- `mobile/src/shared/components/InfoOverlay.tsx`
- `mobile/src/shared/components/Snackbar.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-4
- AC-5
- AC-6
- AC-8
- AC-9
- AC-10
- AC-15

**Dependencies:** None; confirmed product decisions are recorded at the top of this plan.

**Expected Handoff:**

- Profil-Hub mit bestätigter sichtbarer Benennung und konsistenter Gruppierung
- wiederverwendbare Profil-Gruppen-/Zeilenkomponenten und dokumentierte Einfügepositionen für die künftigen Bereiche
- deaktivierter, barrierefrei als nicht verfügbar gekennzeichneter Platzhalter `Konto löschen`; kein Aufruf der bisherigen Profil-DELETE-API
- tokenbasierte Profile-/Edit-/Health-Connect-Oberfläche bei unveränderter Profil- und Sync-Fachlogik
- Lade-, Leer- und Fehlerzustände klar unterscheidbar

### F-1.2 Bibliothek und Produktverwaltung konsolidieren

**Agent:** Frontend  
**Goal:** Den Profil-Produkt-Tab und den ungenutzten `MyProducts`-Stack-Einstieg in einen verlässlichen Weg `Eigene Lebensmittel` überführen. Den visuellen Produkt-Summary mit dem Search Hub teilen, aber die kontextspezifischen Zeilenaktionen getrennt lassen.

**Required Knowledge Base:**

- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/03-food-catalog.md`
- `docs/kb/tech/03-mobile.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/profile/ProfileScreen.tsx`
- `mobile/src/modules/profile/LibraryScreen.tsx`
- `mobile/src/modules/profile/MyProductsScreen.tsx`
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/shared/components/FoodSearchResultList.tsx` — vorhandene, im aktuellen Mobile-Code unreferenzierte Suchlisten-Komponente; nicht mit der aktiven Hub-`ResultRow` verwechseln
- `mobile/src/shared/api/reusableItemsApi.ts`
- `mobile/src/shared/api/favoritesApi.ts`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-3
- AC-4
- AC-5
- AC-6
- AC-10
- AC-11

**Dependencies:** F-1.1; die Produktsemantik ist durch den Nutzer bestätigt.

**Expected Handoff:**

- ein kanonischer Bibliothekseinstieg für Favoriten und `Eigene Lebensmittel` mit Filter auf selbst angelegte Items
- gemeinsam verwendeter, präsentativer Produkt-Summary mit 52-pt-Thumbnail für Search Hub und eigene Lebensmittel
- getrennte, weiterhin passende Aktionen für Suche und Verwaltung
- Suche, Bearbeiten, Löschen, Aktualisieren sowie Lade-, Fehler- und Leerzustände in der vereinbarten Produkteansicht
- Nachweis, dass die entfernte oder umgeleitete Route keine Aufrufer oder Deep-Link-Abhängigkeiten bricht

### F-1.3 In-App-Impressum und Datenschutzerklärung

**Agent:** Frontend  
**Goal:** Den Text aus `docs/legal/datenschutzerklaerung-alpha.md` und `docs/legal/impressum-alpha.md` als kurze, scrollbare In-App-Seiten einbetten. Datenschutz muss von `LoginScreen`, `ProfileWizardScreen` und `Profil > Rechtliches` erreichbar sein; keine externen Legal-Links.

**Status:** Ausführbar. Der Text ist ein pragmatischer Alpha-Text ohne juristische Prüfung; vor einem öffentlichen Release neu bewerten.

**Scope boundary:** Keine technische Altersprüfung oder Registrierungssperre; keine inhaltliche Änderung des Textes ohne Anpassung der MD-Datei.

**Required Knowledge Base:**

- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**

- `docs/legal/datenschutzerklaerung-alpha.md`
- `docs/legal/impressum-alpha.md`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/auth/LoginScreen.tsx`
- `mobile/src/modules/profile/ProfileScreen.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.tsx`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-7
- AC-8
- AC-10
- AC-11
- AC-12
- AC-13

**Dependencies:** F-1.1.

**Expected Handoff:**

- In-App-Routen für Impressum und Datenschutz ohne externes Öffnen
- Datenschutzerklärung erreichbar auf `LoginScreen`, `ProfileWizardScreen` (vor dem ersten Speichern) und `Profil > Rechtliches`
- eingebetteter Text stimmt mit den MD-Dateien überein, ohne Platzhalter

### F-1.4 Knowledge-Base-Abgleich

**Agent:** Frontend  
**Goal:** Nach der UI- und Routenänderung die Dokumentation zu Profilnavigation und Mobile-Struktur auf den bestätigten Implementierungsstand bringen.

**Required Knowledge Base:**

- `docs/kb/product/02-navigation.md`
- `docs/kb/tech/03-mobile.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/profile/`
- `mobile/src/modules/healthConnect/HealthConnectScreen.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-3
- AC-7
- AC-8
- AC-11

**Dependencies:** F-1.1 und F-1.2; F-1.3 für den In-App-Legal-Stand.

**Expected Handoff:**

- aktualisierte Navigation und Mobile-Dokumentation
- künftiger Freunde-/Haushaltsbereich eindeutig als `[Planned]` markiert, bis die Funktion implementiert ist
- festgelegte Position von `Rechtliches` und bestätigte Einstiege dokumentiert
- keine Knowledge-Base-Aussage zu Haushaltsrechten

## 11. QA Work Package Q-1

**Agent:** QA  
**Goal:** Die vollständigen Acceptance Criteria gegen die bestätigten PO-Entscheidungen, die mobile Implementierung, das Design-System und die aktualisierte Dokumentation verifizieren.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/03-food-catalog.md`
- `docs/kb/domain/04-profile-goals.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/app/theme/index.ts`
- `mobile/src/modules/profile/`
- `mobile/src/modules/auth/LoginScreen.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.tsx`
- `mobile/src/services/authService.ts`
- `mobile/src/services/health/healthSyncService.ts`
- `mobile/src/services/health/nutritionSyncService.ts`
- `mobile/src/services/health/syncLogger.ts`
- `docs/legal/datenschutzerklaerung-alpha.md`
- `docs/legal/impressum-alpha.md`
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/modules/healthConnect/HealthConnectScreen.tsx`
- `mobile/src/shared/components/`
- `mobile/src/shared/components/FoodProductSummary.tsx`
- `docs/kb/product/02-navigation.md`
- `docs/kb/tech/03-mobile.md`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-13
- AC-14
- AC-15
- AC-16

**Dependencies:** F-1.1, F-1.2, F-1.3 und F-1.4.

**Expected Handoff:**

- QA-Report nach dem vom Orchestrator vorgegebenen Pfad mit Kriterienmatrix und Testergebnissen
- Ergebnisse der manuellen Layout-/Accessibility-Prüfung, soweit Gerät und Viewport verfügbar sind
- offene künftige Feature-Punkte separat ausgewiesen, nicht als implementiert bewertet

## 12. Acceptance Criteria

- **AC-1:** Bottom-Tab und Hauptscreen heißen sichtbar `Profil`; die Profil-/Zielübersicht bleibt oben und die Navigationsgruppen folgen darunter. Interne Route-IDs bleiben stabil, sofern keine dokumentierte Notwendigkeit zur Änderung besteht.
- **AC-2:** Das Profil zeigt persönliche Angaben und bestehende Tagesziele weiterhin korrekt an. Bearbeiten und Speichern ändern keine Profilfelder, Berechnungen oder API-Verträge außerhalb des bestehenden Verhaltens.
- **AC-3:** `Favoriten` und `Eigene Lebensmittel` sind über genau einen kanonischen Bibliotheksweg erreichbar. `Eigene Lebensmittel` enthält nur selbst angelegte Einträge und schließt `sourceType: 'openFoodFacts'` aus. Suche, Bearbeiten, Löschen und Aktualisieren bleiben verfügbar; kein erreichbarer Menüpunkt führt zu einer doppelten Liste.
- **AC-4:** Betroffene Profil-, Bibliotheks-, Edit- und Health-Connect-Oberflächen nutzen Theme-Tokens für Farben, Schriftgrößen, Abstände und Radien; bestehende direkte Werte in diesen Kategorien werden entfernt. Karten und Suchfelder folgen dem Design-System. Search Hub und `Eigene Lebensmittel` nutzen denselben präsentativen Produkt-Summary mit 52-pt-Thumbnail, Bild-Fallback, Name, Marke und Nährwertdarstellung. Auswahl/Favorisieren/Quick-Accept im Hub und Bearbeiten/Löschen in der Bibliothek bleiben getrennte, kontextgerechte Aktionen. Emoji-/Unicode-Zeichen werden nicht als UI-Icons verwendet.
- **AC-5:** Die abgegrenzten Profil-Flows verwenden keine `Alert.alert`-Dialoge mehr. Bestätigungen, Fehler und Feedback nutzen passende vorhandene App-Komponenten.
- **AC-6:** Request-Fehler, Laden und echte Leerzustände sind unterscheidbar und wiederherstellbar. Ein Profil-Ladefehler wird nicht als „Noch kein Profil“ behandelt; Fehler beim Produktladen werden nicht als leere Bibliothek dargestellt.
- **AC-7:** `Impressum` und `Datenschutzerklärung` öffnen native In-App-Inhalte und starten keinen externen Browser. Datenschutz ist über `Profil > Rechtliches`, `LoginScreen` und `ProfileWizardScreen` erreichbar, bevor das Profil erstmals gespeichert wird.
- **AC-8:** Die Informationsarchitektur dokumentiert die feste Reihenfolge der Bereiche `Integrationen`, `Gemeinsam`, `Rechtliches`. Die bestehenden Gruppen-/Zeilenkomponenten können um die vorgesehenen Einträge erweitert werden. Leere Gruppen, tote Routen und scheinbar aktive Platzhalter werden nicht gerendert; einzige ausdrücklich geplante Ausnahme ist der deaktivierte, klar als zukünftig gekennzeichnete Konto-Lösch-Platzhalter gemäß AC-15. Künftige Freunde-/Haushaltsfunktionen sind bis zu ihrer Implementierung als `[Planned]` gekennzeichnet.
- **AC-9:** Gewichts- und Ernährungssynchronisierung sind standardmäßig deaktiviert und werden jeweils separat aktiviert; die Android-Schreibberechtigung ist zusätzlich nötig. Vor jeder Aktivierung nennt die Oberfläche Datenkategorie und Health Connect auf dem Gerät als Ziel, ohne Google-Cloud-/Google-Konto-Bezug. Der Profilumbau löst keine Synchronisierung aus. Deaktivieren stoppt künftige Übertragungen, löscht aber weder geschriebene Health-Connect-Daten noch automatisch die lokale Warteschlange. Status und Re-Export bleiben unverändert.
- **AC-10:** Touch-Ziele, Textumbruch, Screenreader-Beschriftungen, Zurücknavigation und Scrollen funktionieren auf schmalen Viewports und bei vergrößerter Schrift ohne abgeschnittene Aktionen oder horizontales Überlaufen.
- **AC-11:** Es gibt keine Backend-, Shared-, API-, Cosmos-, Infrastruktur- oder nativen Konfigurationsänderungen und keine neue Dependency. `Mobile Build Impact` bleibt `None`.
- **AC-12:** Der In-App-Datenschutztext stimmt mit `docs/legal/datenschutzerklaerung-alpha.md` überein, enthält keine Platzhalter in eckigen Klammern und nennt keine Funktionen oder Zusagen, die die App nicht hat. Das Impressum stimmt mit `docs/legal/impressum-alpha.md` überein.
- **AC-13:** Der Text behauptet keinen Löschweg, der nicht existiert: Konto löschen ist als noch nicht verfügbar benannt; `DELETE /api/profile` wird nicht als Kontolöschung dargestellt.
- **AC-14:** Die Rechtstexte sind als pragmatischer Alpha-Text ohne juristische Prüfung gekennzeichnet (Notiz im Plan; im In-App-Text steht der Hinweis „Alpha-Version, Text kann sich ändern“).
- **AC-15:** Der Profil-Edit-Bereich enthält den deaktivierten Platzhalter `Konto löschen` mit `Wird später verfügbar`. Er ist nicht navigierbar, führt keine Bestätigungsaktion aus, sendet keinen Request an `DELETE /api/profile` und zeigt keine Erfolgsmeldung. Der bisher aktive `Profil löschen`-Button, dessen Endpoint nur das Profil-Dokument entfernt, ist nicht mehr als Löschaktion erreichbar.
- **AC-16:** Der Text sagt, dass Daten bis zur Kontolöschung gespeichert bleiben, dass Konto löschen in der Alpha noch nicht verfügbar ist und es keinen anderen Löschweg gibt. Er bietet keine Löschung per E-Mail an.

## 13. Risks and Edge Cases

- Das Zusammenführen der Produktansichten kann Such-, Bearbeitungs-, Lösch- oder Filterverhalten verlieren. Beide bestehenden Implementierungen und ihre Datenabfragen müssen vor dem Entfernen verglichen werden.
- Die gemeinsame Darstellung nimmt unterschiedliche Datenformen (`FoodSearchResult` und `ReusableItem`) auf. Sie darf keine mutations- oder navigationsbezogenen Aktionen in die Präsentationskomponente ziehen.
- Die Angleichung des Hub-Thumbs von 44 pt auf das dokumentierte 52-pt-Pattern kann die sichtbare Trefferdichte verringern; Darstellung und Scrollen im Bottom Sheet müssen geprüft werden.
- Die In-App-Rechtstexte können veralten, wenn sich App-Verhalten ändert; bei Änderungen die MD-Dateien und die eingebettete Fassung gemeinsam pflegen.
- Bis zur Kontolöschungsfunktion können Tester ihr Konto nicht löschen. Der Datenschutztext sagt das deutlich; der Platzhalter ist absichtlich deaktiviert.
- Freunde-/Haushaltszugriff berührt benutzerübergreifende Autorisierung und möglicherweise Cosmos-Datenmodellierung. Dafür ist vor Umsetzung ein separater, genehmigter Plan einschließlich Zugriffs- und Widerrufsregeln notwendig; Community-Rezeptfreigabe ist keine ausreichende Grundlage.
- Bestehende Profil-Lösch- und Sync-Bestätigungen dürfen beim Wechsel von nativen Alerts auf app-eigene Komponenten keine Aktion verlieren oder versehentlich ausführen.
- Health Connect ist nur auf Android verfügbar; UI-Prüfungen müssen den bestehenden iOS-Platzhalter und Android-Status getrennt abdecken.

## 14. Test Strategy

- Mobile typecheck: `npm run typecheck --workspace=@fittrack/mobile`.
- Mobile Vitest-Suite: `npm test --workspace=@fittrack/mobile`.
- Fokussierte UI-/Navigationsprüfungen für kanonische Bibliotheksnavigation, den gemeinsamen Produkt-Summary in beiden Kontexten, korrekte 52-pt-Größe, getrennte Hub-/Verwaltungsaktionen, Filter auf selbst angelegte Lebensmittel, Profil-Ladefehler gegenüber echtem Leerzustand sowie Rücknavigation. Keine neue Test-Dependency einführen.
- Konto-Lösch-Platzhalter: sichtbar, eindeutig als deaktiviert/nicht verfügbar gekennzeichnet und für Screenreader entsprechend beschriftet; Antippen löst weder Bestätigungsdialog noch Request an `DELETE /api/profile` aus.
- In-App-Rechtstexte: native Navigation ohne Browser-Öffnen; Datenschutzerklärung auf Login-Screen, vor erstem Profilspeichern und im Profil erreichbar; eingebetteter Text stimmt mit `docs/legal/*.md` überein und enthält keine Platzhalter.
- Manuelle Prüfung auf Android und iOS für Profil-Hub und Header, mit schmalem Viewport und vergrößerter Schrift. Auf Android zusätzlich bestätigen, dass Health-Connect-Verhalten unverändert ist; auf iOS bleibt der bestehende Nichtverfügbar-Zustand sichtbar. Im Search Hub prüfen, dass 52-pt-Thumbnails die Zeilen und Scroll-Interaktion nicht überlagern.
- Screenreader-Prüfung der neuen Gruppen-/Zeilenaktionen und der Bestätigungsdialoge. Nicht verfügbare Geräte-/Screenreader-Prüfungen im QA-Report als `MANUAL VALIDATION REQUIRED` ausweisen.

## 15. Recommended Execution Order

1. Frontend F-1.1: Profil-Hub, Erweiterungsmuster und gemeinsame Darstellung.
2. Frontend F-1.2: Bibliothek und Produktdarstellung mit dem Search Hub konsolidieren.
3. Frontend F-1.3 (nur abhängig von F-1.1, kann parallel zu F-1.2 laufen): In-App-Seiten mit dem Text aus `docs/legal/` umsetzen.
4. Frontend F-1.4: Navigation und Mobile-Knowledge-Base aktualisieren; nicht aktivierte spätere Einträge als `[Planned]` kennzeichnen.
5. QA Q-1: automatisierte und manuelle Kriterienprüfung. Keine Blockierung durch Rechtsfragen; Q-1 prüft bei den Rechtstexten nur Einbettung, Übereinstimmung mit den MD-Dateien und fehlende Platzhalter.