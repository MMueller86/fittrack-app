# Technischer Plan: Profilbereich redesignen und neu strukturieren

**Status:** Draft — retention until account deletion confirmed; disabled delete placeholder planned; live Alpha configuration verified on 2026-10-07; full account-deletion feature and required disclosure details remain open  
**User Story:** None — eigenständiger Plan unter `docs/User Stories/plans/`  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None

## Confirmed Product Decisions

- **Profil-Hub:** Bottom-Tab und Hauptscreen heißen `Profil`. Die bestehende Übersicht persönlicher Daten und Tagesziele bleibt oben; weitere Bereiche stehen darunter.
- **Eigene Lebensmittel:** Die Liste enthält nur selbst angelegte Lebensmittel. `sourceType: 'openFoodFacts'` wird ausgeschlossen; der bisherige Titel `Meine Lebensmittel` wird in der Bibliothek zu `Eigene Lebensmittel`.
- **Künftige Bereiche:** `Gemeinsam` und `Rechtliches` sind feste Plätze der Zielstruktur. Für Freunde/Haushalt wird bis zur Umsetzung kein leerer Bereich und kein toter Platzhalter angezeigt. Die Rechte- und Datenfreigabe wird in einem separaten Feature-Plan entschieden.
- **Rechtliche Inhalte:** `Impressum` und `Datenschutzerklärung` werden als kurze, scrollbare In-App-Seiten umgesetzt, nicht als externe Links. Beide liegen unter `Profil > Rechtliches`; Datenschutz muss zusätzlich vor der ersten Profileingabe erreichbar sein.
- **Alpha-Kontext:** Die App ist nicht-kommerziell und für eingeladene Alpha-Tester vorgesehen. Der Plan leitet daraus keine rechtliche Ausnahme ab.
- **Kontaktangaben:** Michael Müller, Richardstraße 120, 40231 Düsseldorf; E-Mail: Michi01mueller@gmail.com. Diese Angaben werden für den Text verwendet.
- **Aufbewahrung:** Kontodaten bleiben grundsätzlich gespeichert, bis das Konto vollständig gelöscht wird. Eine automatische altersbasierte Löschung der normalen Nutzerdaten ist nicht vorgesehen; bestehende Ablaufzeiten für kurzlebige Insights und technische Protokolle sind gesondert zu benennen.
- **Kontolöschung im Redesign:** Kontolöschung ist der einzige vorgesehene Weg, FitTrack-Kontodaten zu löschen. Im Profil-Edit-Bereich wird dafür ein klar als noch nicht verfügbar gekennzeichneter, deaktivierter Platzhalter `Konto löschen` vorgesehen. Bis die Funktion implementiert ist, gibt es keinen anderen Löschweg; der Datenschutzhinweis muss das ausdrücklich sagen. Der Platzhalter darf keine Lösch-API aufrufen oder den Eindruck erwecken, dass ein Tap bereits Daten löscht.
- **Textprüfung:** Der Planner gleicht den Text fachlich und technisch mit Repository und Knowledge Base ab. Eine separate Anwaltsfreigabe ist nicht vorgesehen. Ein Datenschutzhinweis allein macht eine Verarbeitung nicht automatisch zulässig: Der Text muss stimmen, und die App muss die darin beschriebenen Speicher- und Löschregeln tatsächlich einhalten.

## Later Implementation

- **Vollständige Kontolöschung (Folgefeature):** Die vollständige Löschfunktion wird später umgesetzt und ist der einzige FitTrack-Löschweg. Bis dahin ist sie in der App nicht verfügbar; es gibt keinen E-Mail- oder manuellen Ersatzweg. Die Datenschutzerklärung und der deaktivierte Platzhalter müssen diesen Ist-Zustand deutlich nennen. Bei der späteren Umsetzung muss die Löschung Entra, sämtliche Cosmos-Dokumente, Blob-Bilder, Insights/Feedback, Nutzungsdaten und lokale App-Daten abdecken. Bereits nach Health Connect exportierte Kopien liegen außerhalb von FitTrack.

## Pre-Alpha Verification

- Keine separate Anwaltsfreigabe ist vorgesehen. Vor Veröffentlichung bestätigt der Betreiber, welche Rechtsgrundlagen und gegebenenfalls zusätzlichen Bedingungen für die Gesundheits-/Gewichtsdaten und Health-Connect-Synchronisation gelten, welche Pflichtangaben zu Rechten und Aufsichtsbehörde aufzunehmen sind und dass Michael Müller als Anbieter/Verantwortlicher genannt werden soll. Der technische Textreview ersetzt diese Betreiberentscheidung nicht; Nicht-Kommerzialität und Alpha-Status begründen für sich keine Ausnahme.
- Read-only Azure-Prüfung am 2026-10-07: Alpha-Function-App, Cosmos DB, Blob Storage und Application Insights/Log Analytics liegen in `northeurope`; der Log-Analytics-Workspace hat 30 Tage Retention. Die Alpha Function App verwendet den gemeinsamen Azure-OpenAI-Endpunkt `oai-fittrackapp-dev` in `germanywestcentral` und den gemeinsamen Document-Intelligence-Endpunkt `di-fittrack-dev-ppf5sc` in `northeurope`.
- Die Live-`AUTH_ISSUER`-Einstellung der Alpha Function App bestätigt denselben Entra External ID-Tenant wie Dev. Die tatsächlichen Azure-Dienste/Regionen sind damit für die abgefragte Konfiguration bestätigt; geltende Vertrags-, Verarbeitungs- und Anbieterbedingungen sind keine Resource-Metadaten und bleiben vom Betreiber zu verifizieren. Keine unbelegte Aussage zu Modelltraining, Anbieter-Aufbewahrung oder Drittlandtransfer machen.
- Cosmos-Livewerte am 2026-10-07: reguläre Alpha-Nutzercontainer haben kein automatisches TTL. `aiInsights` hat `defaultTtl: -1` (kein Standardablauf), während Daily-/Weekly-Insight-Dokumente ein individuelles TTL setzen können; Feedback-Dokumente setzen keines und laufen daher nicht automatisch ab.
- Prüfen, ob der Alpha-Test auf volljährige, eingeladene Personen begrenzt werden soll; das Profilmodell erlaubt derzeit ein Alter ab 10 Jahren.
- Für das spätere Folgefeature vollständige Löschung von Entra-Konto, Cosmos-Dokumenten, Blob-Bildern, Insights/Feedback, Nutzungszählern und lokalen App-Daten implementieren. Bereits nach Health Connect exportierte Daten löscht FitTrack nicht automatisch.
- Aufbewahrung lokaler Health-Connect-Synchronisationswarteschlangen und Diagnoseprotokolle festlegen; die aktuelle Begrenzung auf 150 Log-Einträge ist keine zeitbasierte Löschfrist.

## 1. Requirement Assessment

**Classification:** Accept with modifications.

Die Design-System-Angleichung, die künftigen Profilbereiche und minimale In-App-Rechtstexte gehören in denselben Redesign-Plan. `Gemeinsam` und `Rechtliches` sind feste Plätze der Zielstruktur. Die Rechtstexte erhalten einen konkret belegbaren Arbeitsentwurf; vollständige Rechtskonformität, unbekannte Anbieterbedingungen sowie noch nicht definierte Speicher-/Löschregeln werden nicht als entschieden dargestellt. Eine Freigabe zur Alpha-Verteilung setzt die offenen Vorabprüfungen voraus.

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
- Die Datenschutzerklärung benennt Datenkategorien, Speicherung, KI-Verarbeitung, optionale Health-Connect-Übermittlung, ausdrücklich veröffentlichte Community-Rezepte und den tatsächlichen Stand von Löschung/Aufbewahrung. Sie macht keine unbelegten Rechts- oder Anbieterzusagen.
- Kontodaten bleiben grundsätzlich bis zur vollständigen Kontolöschung gespeichert. Im Profil-Edit-Bereich ist `Konto löschen` zunächst nur ein deaktivierter, klar als zukünftig gekennzeichneter Platzhalter; er führt keine Aktion aus. Bis zur späteren Implementierung gibt es keinen anderen Löschweg.
- Noch nicht verfügbare Aktionen werden nicht als funktionsfähige oder navigierbare Links dargestellt.
- Profil-, Ziel-, Lebensmittel- und Health-Connect-Funktionalität bleibt fachlich unverändert.

## 5. Scope

- Profil-Hub und Profil-Stack-Navigation in `mobile/src/app/navigation/RootNavigator.tsx`.
- Darstellung und UI-Zustände in `ProfileScreen`, `ProfileEditScreen`, `LibraryScreen`, `MyProductsScreen` (Konsolidierung), `SearchState` und der gemeinsamen Oberfläche von `HealthConnectScreen`.
- In-App-Rechtstextseiten und ihre Einstiege in `LoginScreen`, `ProfileWizardScreen` und dem Profilbereich.
- Arbeitsentwurf der Datenschutzerklärung, basierend auf überprüften Repository-Datenflüssen.
- Deaktivierter Kontolöschungs-Platzhalter im Profil-Edit-Bereich, ohne Backend-Aufruf.
- Ein konsolidierter Einstieg in Favoriten und selbst angelegte `Eigene Lebensmittel` einschließlich der heute vorhandenen Suche, Bearbeitung und Löschung.
- Gemeinsame, rein präsentative Produkt-Zusammenfassung für Search-Hub-Ergebnisse und eigene Lebensmittel; beide Bereiche behalten ihre eigenen Aktionen.
- Wiederverwendbare, profil-lokale Gruppen- und Zeilenkomponenten sowie die festgelegte Reihenfolge der künftigen `Gemeinsam`- und `Rechtliches`-Bereiche.
- Profilbezogene Bestätigungs-, Fehler-, Lade- und Leerzustände sowie Accessibility der betroffenen Bedienelemente.
- In-App-Darstellung der freigegebenen Rechtstexte ohne externe Legal-URLs.
- Knowledge-Base-Aktualisierung für Navigation und Mobile-Struktur.

## 6. Out of Scope

- Freunde einladen, Haushalte anlegen, Mitglieder verwalten oder Profil-, Tagebuch-, Ernährungs- oder Gewichtsdaten mit anderen Nutzern teilen.
- Backend-Endpunkte, gemeinsame Typen, Berechtigungsmodell, Cosmos-Datenmodell oder Infrastruktur für Haushalt/Freunde.
- Eine rechtliche Garantie. Der Plan prüft, ob Text und implementiertes Verhalten zusammenpassen; er entscheidet nicht abschließend, ob jede Verarbeitung rechtlich zulässig ist. Der Betreiber bestätigt die offenen rechtlichen und betrieblichen Angaben.
- Implementierung der vollständigen Konto-/Datenlöschung, kaskadierender Backend-Löschung oder Änderungen an Aufbewahrungsregeln. Diese Funktion wird später separat umgesetzt; dieser Plan enthält nur den deaktivierten Platzhalter und die Ziel-Aufbewahrungsregel.
- Änderungen an Profilberechnung, Zielwerten, API-Verträgen oder Persistenz.
- Allgemeines Redesign des First-Launch-`ProfileWizardScreen`; der Datenschutz-Einstieg vor dem ersten Speichern bleibt Bestandteil dieses Plans.
- Neue Dependencies, Native Modules, Expo-Plugins oder Änderungen an `app.config.js`.

## 7. Confirmed Facts

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
- `DELETE /api/profile` löscht ausschließlich das Profil-Dokument. Ein vollständiger Konto-/Datenlösch-Endpunkt ist nicht dokumentiert. Der derzeit aktive Button in `ProfileEditScreen` suggeriert daher fälschlich eine vollständige Löschung.
- Daily-Insight-Dokumente haben eine Ablaufzeit. Negative Insight-Feedback-Dokumente haben weder `ttl` noch `expiresAt` und speichern neben dem Kommentar die Insight-Antwort, den vollständigen Prompt-Snapshot und den Input-Kontext. Sie werden nicht automatisch gelöscht.
- Azure Application Insights ist an einen Log-Analytics-Workspace mit 30 Tagen Retention angebunden. Generische Function-Logs enthalten Handler, Methode, Status und Dauer; Request-Bodies werden dort nicht protokolliert, technische Fehlerdetails können geloggt werden.
- Die Azure-Abfrage vom 2026-10-07 bestätigt für Alpha Cosmos-, Blob-, Function-App- und Application-Insights-Ressourcen in North Europe; Application Insights/Log Analytics ist auf 30 Tage eingestellt. Azure OpenAI wird über den geteilten Endpunkt `oai-fittrackapp-dev` in Germany West Central genutzt, Document Intelligence über `di-fittrack-dev-ppf5sc` in North Europe. Der live konfigurierte Entra-Issuer ist der gemeinsame Dev-/Alpha-Tenant.
- Die Alpha-Cosmos-Container `profiles`, `users`, `nutritionDiaryMeals`, `weights`, `recipes`, `reusableMealItems`, `foodProducts`, `userFoodRelations` und `aiUsage` haben kein automatisches TTL. `aiInsights` hat `defaultTtl: -1`; Daily-/Weekly-Insights können pro Dokument ablaufen, Feedback-Dokumente ohne eigenes TTL nicht.
- Bei aktivierter Health-Connect-Synchronisation exportiert Mobile nach erteilter Berechtigung Gewichts- und Ernährungseinträge. Deaktivieren stoppt weitere Synchronisation, löscht aber nicht die bereits an Health Connect übertragenen Daten.
- Health-Connect-Synchronisationsstatus und fehlgeschlagene Retry-Vorgänge werden in AsyncStorage auf dem Gerät gehalten; fehlgeschlagene Vorgänge können die jeweiligen Gewichts- oder Mahlzeiteneinträge sowie Fehlerdetails enthalten. Deaktivieren löscht diese lokale Warteschlange nicht automatisch.
- Das lokale Health-Connect-Diagnoseprotokoll wird ebenfalls in AsyncStorage gespeichert, enthält Zeitstempel, Meldungen und ggf. Fehlerdetails, ist auf maximal 150 Einträge begrenzt und wird nicht automatisch nach Alter gelöscht. In der Health-Connect-Oberfläche existiert eine manuelle Löschaktion für dieses Protokoll.
- Azure OpenAI (`gpt-4o-mini`) verarbeitet je nach aufgerufener Funktion Texte, Fotos und/oder Profil-, Tagebuch- und Gewichts-Kontext. Nutrition-Label-Fotos werden zuerst mit Azure Document Intelligence ausgelesen; erkannter Text wird danach an Azure OpenAI übergeben. Feedback-Erfassung speichert den Insight-Kontext zusätzlich in Cosmos.
- Die Alpha-Bicep-Konfiguration verwendet Umgebungsnamen für getrennte Cosmos-, Blob-, Function-App- und Application-Insights-Ressourcen; ihre Azure-Region wird von der bestehenden Resource Group geerbt. Die dokumentierte Deploy-Anweisung übergibt den Dev-Azure-OpenAI-Endpunkt und den Dev-Document-Intelligence-Endpunkt und die Alpha-Parameter setzen denselben Entra-Tenant wie Dev. In der Alpha-Parameterdatei widersprechen sich die Kommentare zur DI-Trennung. Das Repository belegt nicht, welche Endpunkte/Regionen aktuell in der live Function App konfiguriert sind; diese müssen vor Veröffentlichung geprüft werden.
- Andere FitTrack-Nutzerdaten bleiben privat. Ein Nutzer kann Rezepte ausdrücklich in der Community veröffentlichen; diese Rezepte sind dann für angemeldete Nutzer sichtbar.
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
- Der aktuell aktive Button `Profil löschen` in `ProfileEditScreen` wird durch einen deaktivierten, klar als zukünftig gekennzeichneten Platzhalter `Konto löschen` mit dem Zusatz `Wird später verfügbar` ersetzt. Er hat keine Aktion, ruft `DELETE /api/profile` nicht auf und darf keine erfolgreiche Kontolöschung behaupten.
- Ladefehler werden von echten Leerzuständen unterschieden. Ein fehlendes Profil darf nur dann den Einrichtungszustand zeigen, wenn der Request erfolgreich war und tatsächlich kein Profil vorliegt.
- `Impressum` und `Datenschutzerklärung` werden als In-App-Seiten im bestehenden Profile-Stack dargestellt; keine Browser- oder `Linking`-Navigation. Dieselbe Datenschutzerklärung ist über `LoginScreen` und `ProfileWizardScreen` erreichbar, bevor neue Profil-/Gesundheitsdaten gespeichert werden. Die Inhalte werden als gemeinsame Quelle gepflegt, nicht in mehreren Screens dupliziert.
- Der Datenschutzhinweis nennt die konkret dokumentierten Anbieter und Datenarten sowie optionalen Health-Connect-Export und Community-Rezeptfreigabe. Es werden keine Behauptungen zu Rechtsgrundlage, Azure-Region, Anbieter-Aufbewahrung, Modelltraining oder vollständiger Löschung aufgenommen, solange diese nicht verifiziert und freigegeben sind.
- Kontodaten bleiben bis zur vollständigen Kontolöschung gespeichert. Daily-/Weekly-Insight-Caches, Application-Insights-Protokolle und lokale Sync-Diagnosedaten haben davon abweichende technische Ablauf-/Begrenzungsregeln, die der Datenschutzhinweis getrennt nennt. Bis zur späteren Implementierung gibt es keine Möglichkeit, FitTrack-Kontodaten zu löschen; der Text darf keinen Ersatzweg suggerieren.
- Der künftige Haushaltseinstieg erhält keinen API- oder Datenzugriff in diesem Plan. Vor einer Implementierung sind Berechtigungen, Einladungszustände, Widerruf und Datenumfang gesondert zu definieren; vorhandene Rezeptfreigabe darf nicht übertragen werden.
- Keine Änderungen an Backend, Shared, API, Cosmos, Azure oder nativer Mobile-Konfiguration.

## Draft In-App Legal Copy

**Arbeitsentwurf, noch nicht zur Alpha-Veröffentlichung freigegeben.** Der fachliche und technische Abgleich gegen Repository, Knowledge Base und die am 2026-10-07 abgefragte Alpha-Konfiguration ist erfolgt. Eine separate Anwaltsfreigabe ist nicht vorgesehen. Der Text muss ausdrücklich sagen, dass Kontolöschung der einzige Löschweg, in der aktuellen Alpha aber noch nicht verfügbar ist. Alle übrigen Pflichtangaben müssen vor Veröffentlichung ergänzt sein.

### Impressum

**FitTrack — nicht-kommerzielle Alpha-Testversion**

Anbieter:  
Michael Müller  
Richardstraße 120  
40231 Düsseldorf

Kontakt: Michi01mueller@gmail.com

### Datenschutzerklärung

**Stand:** [Datum der Freigabe]

**Verantwortlicher:** Michael Müller, Richardstraße 120, 40231 Düsseldorf. Kontakt: Michi01mueller@gmail.com.

**Daten und Zweck:** FitTrack verarbeitet Anmelde-/Nutzerkennungen sowie die von dir eingegebenen Profil- und Zielangaben, Ernährungs- und Tagebucheinträge, Gewichts- und Aktivitätsdaten, Rezepte samt hochgeladenen Rezeptbildern, eigene Lebensmittel und Favoriten. Diese Angaben werden genutzt, um die App-Funktionen für dich bereitzustellen und abzusichern.

**KI-Funktionen:** Wenn du eine KI-Funktion verwendest, werden die für diese Funktion nötigen Texte, Bilder oder Kontextdaten durch das FitTrack-Backend an Azure OpenAI (`gpt-4o-mini`) übermittelt. Bei einem Etikettenscan wird das Bild zunächst mit Azure Document Intelligence ausgelesen; der erkannte Text wird anschließend an Azure OpenAI zur strukturierten Verarbeitung übergeben. Dazu können je nach Funktion Mahlzeitentexte, Rezepttexte, Essens-/Etikettbilder sowie Profil-, Ernährungs- oder Gewichts-Kontext gehören. Schätzungen und Analysen werden als Ergebnis angezeigt; das Speichern einer Schätzung als Tagebucheintrag oder Lebensmittel erfordert deine Bestätigung. Daily- und Weekly-Insights werden serverseitig mit konfigurierter Ablaufzeit gespeichert. Wenn du Insight-Feedback sendest, werden Kommentar, Insight-Antwort und zugehöriger Prompt-/Eingabekontext zusätzlich gespeichert; die aktuelle Implementierung setzt dafür keine automatische Ablaufzeit.

**Speicherung und Empfänger:** FitTrack speichert strukturierte App-Daten in Microsoft Azure Cosmos DB und Rezeptbilder in Azure Blob Storage. Diese Alpha-Ressourcen sowie Function App und Application Insights liegen in North Europe. Die Anmeldung erfolgt über Microsoft Entra External ID; Access- und Refresh-Tokens liegen auf deinem Gerät in Expo SecureStore. Technische Betriebs- und Fehlerprotokolle werden in Azure Application Insights verarbeitet und nach 30 Tagen gelöscht. Azure OpenAI (`gpt-4o-mini`) wird über einen mit Dev geteilten Dienst in Germany West Central genutzt; Azure Document Intelligence wird über einen mit Dev geteilten Dienst in North Europe genutzt. Diese Angaben entsprechen der am 2026-10-07 abgefragten Alpha-Konfiguration und sind vor späteren Releases erneut zu prüfen.

Auf deinem Gerät speichert FitTrack außerdem Synchronisationsstatus und fehlgeschlagene Health-Connect-Übertragungen, die Gewichts- oder Mahlzeitendetails enthalten können. Ein lokales Diagnoseprotokoll umfasst höchstens 150 Einträge und wird nicht automatisch nach einer bestimmten Zeit gelöscht; du kannst dieses Protokoll in der Health-Connect-Ansicht manuell löschen.

**Optionale Verbindungen und Veröffentlichung:** Wenn du Google Health Connect auf Android aktivierst und die Berechtigung erteilst, überträgt FitTrack Gewichts- und Ernährungseinträge an Health Connect. Das Deaktivieren stoppt weitere Synchronisation, löscht aber weder bereits übertragene Daten in Health Connect noch automatisch lokal gespeicherte fehlgeschlagene Übertragungen. Andere FitTrack-Daten sind nicht öffentlich. Nur Rezepte, die du ausdrücklich in der Community veröffentlichst, können andere angemeldete FitTrack-Nutzer sehen.

**Speicherdauer und Löschung:** Deine in FitTrack gespeicherten Kontodaten bleiben erhalten, solange dein Konto besteht, und werden erst bei vollständiger Kontolöschung entfernt. Tägliche und wöchentliche Insights können aufgrund ihrer technischen Ablaufzeit früher gelöscht werden; Azure-Betriebsprotokolle werden nach 30 Tagen gelöscht. Lokale Health-Connect-Synchronisationsdaten können auf deinem Gerät verbleiben; das Diagnoseprotokoll ist auf 150 Einträge begrenzt, wird aber nicht automatisch nach Zeit gelöscht. Die Kontolöschung ist der einzige vorgesehene Weg, FitTrack-Kontodaten zu löschen. Sie ist in der aktuellen Alpha noch nicht implementiert; der angezeigte `Konto löschen`-Eintrag ist ein deaktivierter Platzhalter. Bis die Funktion verfügbar ist, gibt es keinen anderen Löschweg. Eine Kontolöschung in FitTrack entfernt nicht automatisch bereits nach Google Health Connect exportierte Daten. [Betroffenenrechte und zuständige Aufsichtsbehörde vor Veröffentlichung vervollständigen.]

### Interne Redaktionshinweise

- Keine Aussage wie „deine Daten werden nicht zum Training verwendet“ oder „Azure speichert keine Inhalte“, bis die konkreten Azure-Vertrags- und Serviceeinstellungen geprüft wurden.
- Die Live-Abfrage vom 2026-10-07 bestätigte die gemeinsamen Dev-Endpunkte und Regionen für Azure OpenAI und Document Intelligence sowie getrennte Alpha-Datenspeicher in North Europe. Nach Änderungen der Azure-Konfiguration ist der Abgleich zu wiederholen; Resource-Metadaten belegen keine Vertrags-/Verarbeitungsbedingungen des Anbieters.
- Die Kontolöschungsfunktion ist noch nicht implementiert. Insight-Feedback-Snapshots enthalten Nutzernotiz, KI-Antwort, Prompt-Snapshot und vollständigen Input-Kontext ohne automatische Ablaufzeit; lokale fehlgeschlagene Sync-Vorgänge und Diagnoseeinträge haben ebenfalls keine zeitbasierte automatische Löschung. Der Hinweis muss diese fehlende Löschmöglichkeit transparent machen; ein E-Mail- oder manueller Ersatzweg darf nicht behauptet werden.
- „Nicht-kommerziell“ und „Alpha“ als Status beschreiben, nicht als Rechtsausnahme.

## 10. Frontend Work Package F-1

### F-1.1 Profil-Hub und gemeinsame Darstellung

**Agent:** Frontend  
**Goal:** Profil-Hub samt Profilbearbeitung, Health-Connect-Einstieg und deaktiviertem Konto-Lösch-Platzhalter an die beschlossene Benennung und Informationsarchitektur sowie an die geltenden Design-System-Regeln anpassen. Die Profil-lokalen Gruppen-/Zeilenmuster müssen die vorgesehenen `Gemeinsam`- und `Rechtliches`-Erweiterungen ohne neue Navigationsstruktur unterstützen.

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
**Goal:** Den freigegebenen Impressums- und Datenschutzerklärungsinhalt als kurze, barrierearme In-App-Seiten umsetzen. Datenschutz muss von `LoginScreen`, `ProfileWizardScreen` und `Profil > Rechtliches` erreichbar sein; es werden keine externen Legal-Links geöffnet.

**Status:** Blocked — finale Veröffentlichung pending Pre-Alpha Verification und Vervollständigung der erforderlichen Angaben. Kontaktangaben und fachlich-technischer Textreview sind erledigt; eine separate Anwaltsfreigabe ist nicht vorgesehen. Die UI-Struktur kann vorbereitet werden; der Text muss offenlegen, dass Kontolöschung derzeit nicht verfügbar ist und es keinen anderen Löschweg gibt.

**Required Knowledge Base:**

- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/auth/LoginScreen.tsx`
- `mobile/src/modules/profile/ProfileScreen.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.tsx`
- `mobile/src/app/App.tsx`
- `mobile/src/services/authService.ts` — Access-/Refresh-Tokenablage
- `mobile/src/services/health/healthSyncService.ts`
- `mobile/src/services/health/nutritionSyncService.ts`
- `mobile/src/services/health/syncLogger.ts`
- `mobile/src/app/theme/index.ts`
- `backend/src/functions/profile.ts` — Profil-DELETE löscht nur das Profil-Dokument
- `backend/src/functions/dailyInsightFeedback.ts` — persistierter Feedback-Snapshot
- `infra/parameters/alpha.bicepparam`
- `infra/main.bicep`
- `infra/modules/functionapp.bicep`
- `infra/modules/cosmos.bicep` — TTL-Konfiguration der Container
- `infra/modules/appinsights.bicep` — Diagnose-Log-Retention

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-7
- AC-8
- AC-10
- AC-11
- AC-12
- AC-13
- AC-14
- AC-16

**Dependencies:** F-1.1; abgeschlossene Pre-Alpha Verification und Bestätigung der noch offenen Betreiber-/Verarbeitungsangaben durch den Product Owner. Eine separate Anwaltsfreigabe ist nicht vorgesehen.

**Expected Handoff:**

- In-App-Routen für Impressum und Datenschutz ohne externes Öffnen
- Datenschutzerklärung erreichbar vor dem Speichern erster Profildaten sowie später im Profil
- finale Kontakt-, Speicher-, Lösch-, Anbieter- und Rechteinformationen sind bestätigt und korrekt wiedergegeben
- dokumentierte PO-Bestätigung, dass Betreiber-/Verantwortlichenangaben und Pflichtinformationen vollständig sind und keine unbestätigten Aussagen zu Anbietertraining, Rechtsgrundlage oder Löschung enthalten sind
- keine Platzhalter und keine unfreigegebenen Rechtstexte in einem Alpha-Artefakt

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

**Dependencies:** F-1.1 und F-1.2; F-1.3 für den bestätigten In-App-Legal-Stand.

**Expected Handoff:**

- aktualisierte Navigation und Mobile-Dokumentation
- künftiger Freunde-/Haushaltsbereich eindeutig als `[Planned]` markiert, bis die Funktion implementiert ist
- festgelegte Position von `Rechtliches` und bestätigte Einstiege dokumentiert
- keine Knowledge-Base-Aussage zu nicht beschlossenen Rechtstexten oder Haushaltsrechten

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
- `infra/parameters/alpha.bicepparam`
- `infra/main.bicep`
- `infra/modules/functionapp.bicep`
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

**Dependencies:** F-1.1, F-1.2 und F-1.4; F-1.3 muss vor der abschließenden QA-Freigabe abgeschlossen sein. Das Fehlen von Platzhaltern kann vorab geprüft werden, ersetzt aber keine Prüfung des finalen Rechtstextes.

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
- **AC-9:** Health-Connect-Status, Aktivierung, Deaktivierung, Berechtigungen, Re-Export und platform-spezifischer Zustand verhalten sich wie zuvor; geändert wird nur die vereinbarte Oberflächenkonsistenz.
- **AC-10:** Touch-Ziele, Textumbruch, Screenreader-Beschriftungen, Zurücknavigation und Scrollen funktionieren auf schmalen Viewports und bei vergrößerter Schrift ohne abgeschnittene Aktionen oder horizontales Überlaufen.
- **AC-11:** Es gibt keine Backend-, Shared-, API-, Cosmos-, Infrastruktur- oder nativen Konfigurationsänderungen und keine neue Dependency. `Mobile Build Impact` bleibt `None`.
- **AC-12:** Die Datenschutzerklärung benennt die erhobenen Profil-/Ziel-, Ernährungs-/Tagebuch-, Gewichts-/Aktivitäts-, Rezept-/Bild-, Bibliotheks- und technischen Betriebsdaten sowie die Verarbeitung durch Entra External ID, Azure-Datenspeicher, Azure OpenAI, Document Intelligence und Application Insights. Sie erklärt außerdem die Tokenablage auf dem Gerät, lokale Health-Connect-Synchronisationsdaten, die optionale Health-Connect-Übermittlung und die ausdrückliche Community-Veröffentlichung von Rezepten.
- **AC-13:** Speicher- und Löschangaben entsprechen dem implementierten Verhalten: keine pauschale automatische Löschung von Cosmos-Nutzerdaten behaupten; `DELETE /api/profile` nicht als vollständige Kontolöschung darstellen; dauerhaft gespeicherte Insight-Feedback-Snapshots, lokale Sync-/Diagnosedaten und 30-Tage-Azure-Diagnoselog-Retention korrekt behandeln. Der Text verspricht keinen Löschweg, der noch nicht implementiert ist.
- **AC-14:** Vor der Alpha-Freigabe sind die bestätigten Kontaktdaten korrekt übernommen, Betreiber-/Verantwortlichenrolle und erforderliche Angaben zu Rechtsgrundlagen und Betroffenenrechten durch den Product Owner bestätigt und der Datenschutzhinweis mit der tatsächlichen Alpha-Konfiguration abgeglichen. Die am 2026-10-07 abgefragten Endpunkte/Regionen und die gemeinsame Nutzung der Dev-Dienste sind dokumentiert; nach Konfigurationsänderungen erfolgt eine erneute Prüfung. Vertragsbedingungen und Aussagen zu Modelltraining, Anbieter-Aufbewahrung und Drittlandtransfer werden nicht aus Resource-Metadaten abgeleitet. Eine separate Anwaltsfreigabe ist kein Kriterium; der veröffentlichte Text enthält keine Platzhalter und keine unbelegten Behauptungen.
- **AC-15:** Der Profil-Edit-Bereich enthält den deaktivierten Platzhalter `Konto löschen` mit `Wird später verfügbar`. Er ist nicht navigierbar, führt keine Bestätigungsaktion aus, sendet keinen Request an `DELETE /api/profile` und zeigt keine Erfolgsmeldung. Der bisher aktive `Profil löschen`-Button, dessen Endpoint nur das Profil-Dokument entfernt, ist nicht mehr als Löschaktion erreichbar.
- **AC-16:** Die Datenschutzerklärung sagt, dass Kontodaten bis zur vollständigen Kontolöschung gespeichert werden, und unterscheidet dies von früher ablaufenden Daily-/Weekly-Insight-Caches und 30-Tage-Azure-Protokollen. Sie sagt ausdrücklich, dass Kontolöschung der einzige Löschweg, in der aktuellen Alpha aber noch nicht verfügbar ist. Sie bietet weder E-Mail- noch manuelle Löschung als Ersatzweg an.

## 13. Risks and Edge Cases

- Das Zusammenführen der Produktansichten kann Such-, Bearbeitungs-, Lösch- oder Filterverhalten verlieren. Beide bestehenden Implementierungen und ihre Datenabfragen müssen vor dem Entfernen verglichen werden.
- Die gemeinsame Darstellung nimmt unterschiedliche Datenformen (`FoodSearchResult` und `ReusableItem`) auf. Sie darf keine mutations- oder navigationsbezogenen Aktionen in die Präsentationskomponente ziehen.
- Die Angleichung des Hub-Thumbs von 44 pt auf das dokumentierte 52-pt-Pattern kann die sichtbare Trefferdichte verringern; Darstellung und Scrollen im Bottom Sheet müssen geprüft werden.
- Kontaktangaben sind bestätigt. Der Datenschutzentwurf enthält absichtlich offene Aufbewahrungs-/Lösch- und Pflichtinformationsfelder. Diese Platzhalter dürfen nicht in einem Alpha-Build landen.
- Datenschutzangaben können durch spätere Datenflüsse oder Provider-Konfigurationen veralten. Vor Freigabe müssen sie gegen den implementierten Code und die tatsächlichen Azure-Servicebedingungen geprüft und einem verantwortlichen Owner zugeordnet werden.
- Die bestätigte Aufbewahrung bis zur Kontolöschung setzt eine vollständige Löschfunktion voraus. Der aktuelle API-Button löscht nur das Profil-Dokument; der neue Button ist absichtlich deaktiviert. Bis das Folgefeature umgesetzt ist, können Tester ihr FitTrack-Konto nicht löschen. Der Datenschutzhinweis muss diese Einschränkung deutlich benennen.
- Freunde-/Haushaltszugriff berührt benutzerübergreifende Autorisierung und möglicherweise Cosmos-Datenmodellierung. Dafür ist vor Umsetzung ein separater, genehmigter Plan einschließlich Zugriffs- und Widerrufsregeln notwendig; Community-Rezeptfreigabe ist keine ausreichende Grundlage.
- Bestehende Profil-Lösch- und Sync-Bestätigungen dürfen beim Wechsel von nativen Alerts auf app-eigene Komponenten keine Aktion verlieren oder versehentlich ausführen.
- Health Connect ist nur auf Android verfügbar; UI-Prüfungen müssen den bestehenden iOS-Platzhalter und Android-Status getrennt abdecken.

## 14. Test Strategy

- Mobile typecheck: `npm run typecheck --workspace=@fittrack/mobile`.
- Mobile Vitest-Suite: `npm test --workspace=@fittrack/mobile`.
- Fokussierte UI-/Navigationsprüfungen für kanonische Bibliotheksnavigation, den gemeinsamen Produkt-Summary in beiden Kontexten, korrekte 52-pt-Größe, getrennte Hub-/Verwaltungsaktionen, Filter auf selbst angelegte Lebensmittel, Profil-Ladefehler gegenüber echtem Leerzustand sowie Rücknavigation. Keine neue Test-Dependency einführen.
- Konto-Lösch-Platzhalter: sichtbar, eindeutig als deaktiviert/nicht verfügbar gekennzeichnet und für Screenreader entsprechend beschriftet; Antippen löst weder Bestätigungsdialog noch Request an `DELETE /api/profile` aus.
- In-App-Rechtstexte: native Navigation ohne Browser-Öffnung; Datenschutzerklärung auf Login-Screen, vor erstem Profilspeichern und im Profil erreichbar; keine Platzhalter im freigegebenen Build. Inhaltsprüfung gegen bestätigte Datenflüsse und Anbieterbedingungen, insbesondere KI-Kontext, Health Connect, Community-Rezepte und Aufbewahrung/Löschung.
- Manuelle Prüfung auf Android und iOS für Profil-Hub und Header, mit schmalem Viewport und vergrößerter Schrift. Auf Android zusätzlich bestätigen, dass Health-Connect-Verhalten unverändert ist; auf iOS bleibt der bestehende Nichtverfügbar-Zustand sichtbar. Im Search Hub prüfen, dass 52-pt-Thumbnails die Zeilen und Scroll-Interaktion nicht überlagern.
- Screenreader-Prüfung der neuen Gruppen-/Zeilenaktionen und der Bestätigungsdialoge. Nicht verfügbare Geräte-/Screenreader-Prüfungen im QA-Report als `MANUAL VALIDATION REQUIRED` ausweisen.

## 15. Recommended Execution Order

1. Die Aufbewahrungsentscheidung und der einzige vorgesehene Löschweg sind bestätigt. Der Text legt offen, dass dieser Weg in der aktuellen Alpha noch nicht implementiert und kein Ersatzweg verfügbar ist. PO bestätigt Betreiber-/Verantwortlichenrolle und verbleibende Pflichtinformationen. Die Azure-Endpunkte und Regionen wurden am 2026-10-07 live geprüft; nach Konfigurationsänderungen ist erneut abzugleichen, während Anbieterbedingungen gesondert bestätigt werden. Diese offenen Angaben blockieren die finale Textfreigabe, nicht die unabhängige Profil-/Bibliotheksarbeit. Eine separate Anwaltsfreigabe ist nicht vorgesehen.
2. Frontend F-1.1: Profil-Hub, Erweiterungsmuster und gemeinsame Darstellung.
3. Frontend F-1.2: Bibliothek und Produktdarstellung mit dem Search Hub konsolidieren.
4. Frontend F-1.3: In-App-Seiten implementieren und den freigegebenen Impressums- und Datenschutzerklärungstext einsetzen. Der Arbeitsentwurf mit Platzhaltern darf nicht als Alpha-Rechtstext ausgeliefert werden.
5. Frontend F-1.4: Navigation und Mobile-Knowledge-Base aktualisieren; nicht aktivierte spätere Einträge als `[Planned]` kennzeichnen.
6. QA Q-1: automatisierte und manuelle Kriterienprüfung. Abschließende Freigabe erst nach erfolgreichem F-1.3, vollständigen Texten ohne Platzhalter und Abschluss der Vorabprüfungen.