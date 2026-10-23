# User Story – Anmeldung im FitTrack-Design ohne Entra-Bestätigungsdialog

Als FitTrack-Nutzer möchte ich die Anmeldung auf einer von FitTrack gestalteten Oberfläche starten und bestätigen, damit ich einen durchgängigen Anmeldeablauf erhalte und den zusätzlichen Entra-Dialog „Möchten Sie sich bei FitTrack Mobile App anmelden?" nicht mehr durchlaufen muss.

## Ziel

FitTrack kontrolliert die Darstellung und Bedienung des Anmeldeeinstiegs sowie einer gegebenenfalls gewünschten eigenen Bestätigung. Der bisherige Entra-Bestätigungsdialog entfällt im regulären Anmeldeablauf. Google-Kontoauswahl und erforderliche Sicherheitsprüfungen der Identitätsanbieter bleiben Bestandteil der Anmeldung.

## Vorgesehener Architekturweg (Vision des Teams)

- Microsoft Entra External ID bleibt für Benutzerverwaltung, Gruppen und Token-Ausstellung zuständig. Google bleibt als Identitätsanbieter über Entra angebunden.
- FitTrack erhält einen eigenen React-Native-Anmeldescreen mit „Mit Google anmelden".
- Die bisherige mobile Redirect-URI `fittrack://auth` wird durch eine HTTPS-Redirect-URI mit verifiziertem Android App Link ersetzt.
- Eine Azure Static Web App im Free-Tarif stellt die von Azure bereitgestellte HTTPS-Adresse bereit. Eine eigene Domain ist nicht erforderlich.
- Unter `/.well-known/assetlinks.json` wird die Zuordnung zur Android-App einschließlich ihrer Signatur veröffentlicht.
- `/auth/callback` dient als Rücksprungadresse. Android übergibt den Link an FitTrack; die App verarbeitet die Authentifizierungsantwort.
- Authorization Code mit PKCE. Passwörter werden nicht in FitTrack gespeichert.
- Die direkte Google-Weiterleitung über `domain_hint` wird geprüft und eingebunden. Der bereits beobachtete Fehler muss berücksichtigt werden.

## Akzeptanzkriterien

1. Der Nutzer startet die Anmeldung über eine eigene Oberfläche im FitTrack-Design.
2. Die Google-Anmeldung läuft weiterhin über Entra.
3. Nach erfolgreicher Anmeldung kehrt der Nutzer automatisch zu FitTrack zurück, ohne den bisherigen Entra-Bestätigungsdialog bestätigen zu müssen.
4. Bestehende Nutzer gelangen weiterhin in dasselbe FitTrack-Profil; Daten und Gruppenzuordnungen bleiben erhalten.
5. Abbruch, fehlgeschlagene Anmeldung und fehlgeschlagene Rückleitung werden verständlich behandelt; ein erneuter Versuch ist möglich.
6. Der Ablauf funktioniert mit den tatsächlich verwendeten Android-Builds und deren Signaturen.

## Auftrag an den Planner

Zuerst die technische Machbarkeit mit dem bestehenden Auth-Code prüfen: HTTPS-Redirect als mobiler Public Client, Entra-Konfiguration, Expo-Verarbeitung des App Links und tatsächlicher Wegfall des Dialogs. Diese Punkte sollen vor dem vollständigen UI-Umbau durch einen kleinen technischen Durchstich auf Android nachgewiesen werden.

Der eigene Screen ersetzt die Benutzerinteraktion aus Produktsicht. Er übernimmt keine von Entra verlangte Sicherheitsbestätigung per API. Der geplante Weg soll deren Auslöser durch die HTTPS-Rückleitung vermeiden. Falls der Dialog trotzdem erforderlich bleibt, ist das Ziel noch nicht erfüllt und die Abweichung vor der weiteren Umsetzung vorzulegen.
