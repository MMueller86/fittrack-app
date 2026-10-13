// Einzige Einbettungsstelle der Alpha-Rechtstexte im Mobile-Code.
// Die Texte sind wortgleich zu docs/legal/*.md; legalTexts.test.ts prüft das gegen die Dateien.
// Änderungen am Text zuerst in der MD-Datei vornehmen und hier übernehmen.
// Pragmatischer Alpha-Text ohne juristische Prüfung — vor einem öffentlichen Release neu bewerten.

export type LegalDocumentId = 'privacy' | 'imprint';

export interface LegalDocument {
  title: string;
  markdown: string;
}

const PRIVACY_POLICY_MD = `# Datenschutzerklärung

Stand: 2026-10-12

## Wer ist verantwortlich?

- FitTrack ist eine nicht-kommerzielle Alpha-Testversion.
- Verantwortlich: Michael Müller, Richardstraße 120, 40231 Düsseldorf, Michi01mueller@gmail.com
- Die Alpha wird persönlich an eingeladene, volljährige Tester verteilt.

## Welche Daten verarbeiten wir?

- Anmeldedaten (Konto über Microsoft Entra External ID)
- Profil und Ziele: Alter, Größe, Gewicht, Aktivitätslevel, Ziel
- Gewichtsverlauf (das Fortschrittstracking braucht deine Gewichtseinträge)
- Ernährungstagebuch
- Eigene Lebensmittel und Favoriten
- Rezepte inklusive Bildern

Es werden nur Daten verarbeitet, die für die App-Funktionen nötig sind.

## Wofür nutzen wir die Daten?

- Nur, um die Funktionen der App zu betreiben.
- Keine Werbung, kein Verkauf, keine Weitergabe an Dritte zu anderen Zwecken.

## Wo und womit werden die Daten verarbeitet?

- **Speicherung:** Microsoft Azure (Azure-Dienste in Europa): Cosmos DB für deine Daten, Blob Storage für Rezeptbilder.
- **Betriebsprotokolle:** Application Insights, 30 Tage.
- **Anmeldung:** Microsoft Entra External ID. Deine Anmelde-Tokens liegen verschlüsselt auf deinem Gerät (SecureStore).
- **KI-Funktionen:** Je nach Funktion werden Text, Fotos oder Kontext (Profil, Tagebuch, Gewicht) an Azure OpenAI gesendet. Beim Etikettenscan wird das Foto zusätzlich mit Azure Document Intelligence ausgelesen. Ergebnisse werden erst gespeichert, nachdem du sie bestätigt hast.
  - An die KI werden keine Nutzer-ID, E-Mail-Adresse oder Anmelde-Tokens gesendet; deine Anfragen sind nicht mit deinem Konto verknüpft. Dein Anzeigename, deine Profildaten und von dir eingegebene Texte oder Fotos können aber Teil der Anfrage sein.

## Insight-Feedback

Wenn du Feedback zu einem Insight sendest, werden dein Kommentar, die Insight-Antwort und der zugehörige Kontext gespeichert.

## Health Connect (optional, nur Android)

- Du aktivierst Gewicht und Ernährung getrennt und erteilst die jeweilige Berechtigung.
- FitTrack schreibt die Einträge in Health Connect auf deinem Gerät.
- Deaktivieren stoppt nur die weitere Übertragung. Bereits geschriebene Einträge bleiben in Health Connect.
- Was Health Connect, Android oder andere Apps mit diesen Daten machen, regeln deren eigene Bedingungen.

## Wer sieht meine Daten?

- Deine Daten sind privat.
- Nur Rezepte, die du ausdrücklich in der Community veröffentlichst, sehen andere angemeldete Nutzer.

## Speicherdauer und Löschen

- Deine Daten bleiben gespeichert, bis dein Konto gelöscht wird.
- **Konto löschen ist in der Alpha noch nicht verfügbar.** Aktuell gibt es keinen anderen Weg, Daten zu löschen.
- Daily- und Weekly-Insights laufen automatisch ab.
- Auf deinem Gerät:
  - Die Health-Connect-Wiederholungswarteschlange bleibt bis zur Deinstallation der App.
  - Das Diagnoseprotokoll (max. 150 Einträge) kannst du in der Health-Connect-Ansicht manuell löschen.

## Fragen?

Schreib an Michi01mueller@gmail.com. Die Adresse dient nur für Fragen.

## Hinweis

Das ist eine Alpha-Version. Dieser Text kann sich ändern.`;

const IMPRINT_MD = `# Impressum

FitTrack — nicht-kommerzielle Alpha-Testversion

Michael Müller
Richardstraße 120
40231 Düsseldorf

E-Mail: Michi01mueller@gmail.com`;

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: { title: 'Datenschutzerklärung', markdown: PRIVACY_POLICY_MD },
  imprint: { title: 'Impressum', markdown: IMPRINT_MD },
};
